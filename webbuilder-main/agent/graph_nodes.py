from langchain_core.messages import HumanMessage, SystemMessage
from fastapi import WebSocket
from .graph_state import GraphState
from .tools import create_tools_with_context
from .agent import llm, llm_gemini_pro, llm_gemini_flash, get_llm_by_name
from .formatters import create_formatted_message, format_plan_as_markdown
import json
import asyncio
import os
import re
from langgraph.prebuilt import create_react_agent
from .prompts import INITPROMPT, PROMPT_ENHANCER_SYSTEM, DAPP_BUILDER_SYSTEM
from utils.store import load_json_store, save_json_store
from agent.file_storage_hook import snapshot_and_store_files, snapshot_project_to_context_and_db
import traceback
from db.base import get_db
from db.models import Message
import uuid


async def safe_send_socket(socket: WebSocket, data):
    """Helper to safely send WebSocket messages"""
    if socket:
        try:
            # Check if the WebSocket is still connected
            if socket.client_state.name == "CONNECTED":
                await socket.send_json(data)
        except Exception as e:
            # Silently ignore send errors when WebSocket is disconnected
            # This is expected when frontend closes connection
            pass


async def store_message(chat_id: str, role: str, content: str, event_type: str = None, tool_calls: list = None):
    """Helper to store a message in the database"""
    try:
        async for db in get_db():
            message = Message(
                id=str(uuid.uuid4()),
                chat_id=chat_id,
                role=role,
                content=content,
                event_type=event_type,
                tool_calls=tool_calls,
            )
            db.add(message)
            await db.commit()
            break
    except Exception as e:
        print(f"Failed to store message: {e}")


def is_llm_permission_error(err):
    """Detect provider permission errors that require user action (e.g., leaked/invalid key)."""
    msg = str(err)
    return (
        "PermissionDenied" in msg
        or "Your API key was reported as leaked" in msg
        or "permission denied" in msg.lower()
    )


def is_rate_limit_error(err):
    """Detect API rate limit/quota exhaustion errors."""
    msg = str(err).lower()
    return (
        "429" in str(err)
        or "resource_exhausted" in msg
        or "rate limit" in msg
        or "quota exceeded" in msg
        or "too many requests" in msg
    )


def get_retry_delay_from_error(err):
    """Extract retry delay from error message if present."""
    import re
    msg = str(err)
    # Look for patterns like "retry in 10.5s" or "retryDelay': '55s'"
    match = re.search(r'retry.*?(\d+(?:\.\d+)?)\s*s', msg, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return 60  # Default to 60 seconds if no delay found


async def prompt_enhancer_node(state: GraphState) -> GraphState:
    """
    Prompt Enhancer Node: Transforms user's vague prompt into detailed professional specification
    
    This node takes a simple user request like "build a todo app" and enhances it with:
    - Detailed feature specifications
    - UI/UX design requirements
    - Technical stack recommendations
    - Component structure
    - Best practices and modern patterns
    """
    try:
        socket = state.get("socket")
        user_prompt = state.get("user_prompt", "")
        chat_id = state.get("project_id", "")
        
        # Send status update to frontend
        if socket:
            await safe_send_socket(socket, {
                "e": "prompt_enhancer_started",
                "message": "🔍 Analyzing your request and creating detailed specifications...",
            })
        
        print(f"🔍 PROMPT ENHANCER: Enhancing user prompt: {user_prompt[:100]}...")
        
        # Check if prompt is already detailed (>300 chars with technical terms)
        technical_keywords = ['component', 'feature', 'ui', 'ux', 'design', 'technical', 'stack', 'requirements']
        is_detailed = len(user_prompt) > 300 and any(keyword in user_prompt.lower() for keyword in technical_keywords)
        
        if is_detailed:
            print("📝 Prompt appears detailed, adding polish and structure...")
            await safe_send_socket(socket, {
                "e": "prompt_enhancer_status",
                "message": "✨ Adding professional polish to your detailed requirements...",
            })
        else:
            print("🚀 Prompt is simple, expanding with professional specifications...")
            await safe_send_socket(socket, {
                "e": "prompt_enhancer_status", 
                "message": "🎯 Transforming your idea into a comprehensive specification...",
            })
        
        # Use GPT-4o if available, else Gemini Flash
        llm = get_llm_by_name('gpt-4o') if get_llm_by_name('gpt-4o') else llm_gemini_flash

        # Extract ALL "*_DO_NOT_ALTER" blocks before enhancement so they survive the
        # LLM rewrite verbatim (contract details, strict design system, 2-page spec, etc.)
        import re
        preserved_blocks = re.findall(
            r'<<<[A-Z_]+_DO_NOT_ALTER>>>.*?<<<END_[A-Z_]+>>>',
            user_prompt, re.DOTALL
        )
        contract_block = ""  # kept for backwards-compat logging
        llm_input_prompt = user_prompt
        for block in preserved_blocks:
            llm_input_prompt = llm_input_prompt.replace(block, "")
            if "CONTRACT_DETAILS" in block:
                contract_block = block
        llm_input_prompt = llm_input_prompt.strip()
        if preserved_blocks:
            print(f"📋 Extracted {len(preserved_blocks)} protected block(s) — will re-append verbatim after enhancement")

        # Create the enhancement prompt
        enhancement_messages = [
            SystemMessage(content=PROMPT_ENHANCER_SYSTEM),
            HumanMessage(content=llm_input_prompt)
        ]

        # Call LLM to enhance the prompt
        print("🤖 Calling LLM for prompt enhancement...")
        response = await llm.ainvoke(enhancement_messages)
        enhanced_prompt = response.content.strip()

        # Re-append ALL protected blocks verbatim so the builder gets the real
        # address/ABI, the strict design system, and the 2-page spec unaltered.
        if preserved_blocks:
            blocks_text = "\n\n".join(preserved_blocks)
            enhanced_prompt = (
                f"{enhanced_prompt}\n\n{blocks_text}\n\n"
                "IMPORTANT: You MUST follow the protected blocks above EXACTLY. "
                "Call save_contract_info() with the EXACT contract name, address, chain_id, "
                "network, and abi_json shown. Wire all read/write functions to this address "
                "using wagmi useReadContract/useWriteContract. Implement the MANDATORY "
                "two-page architecture and the strict design system verbatim — do not "
                "substitute a single-page layout or a different visual theme."
            )
            print(f"📋 Re-appended {len(preserved_blocks)} protected block(s) to enhanced prompt")
        
        print(f"✅ PROMPT ENHANCED: {len(enhanced_prompt)} characters")
        print(f"📊 Original: {len(user_prompt)} chars → Enhanced: {len(enhanced_prompt)} chars")
        
        # Store enhanced prompt message in database
        await store_message(
            chat_id=chat_id,
            role="system",
            content=f"Enhanced Specification:\n\n{enhanced_prompt}",
            event_type="prompt_enhanced"
        )
        
        # Send success update to frontend
        if socket:
            await safe_send_socket(socket, {
                "e": "prompt_enhanced",
                "message": "✅ Detailed specification created successfully!",
                "enhanced_prompt": enhanced_prompt,
                "original_length": len(user_prompt),
                "enhanced_length": len(enhanced_prompt)
            })
        
        # Update state with enhanced prompt
        state["enhanced_prompt"] = enhanced_prompt
        state["execution_log"].append({
            "node": "prompt_enhancer",
            "status": "success",
            "original_prompt_length": len(user_prompt),
            "enhanced_prompt_length": len(enhanced_prompt),
            "message": "Prompt successfully enhanced with professional specifications"
        })
        
        return state
        
    except Exception as e:
        error_msg = f"Prompt enhancement failed: {str(e)}"
        print(f"❌ ERROR in prompt_enhancer_node: {error_msg}")
        traceback.print_exc()
        
        # Check for rate limit error
        if is_rate_limit_error(e):
            retry_delay = get_retry_delay_from_error(e)
            if socket:
                await safe_send_socket(socket, {
                    "e": "rate_limit_error",
                    "message": f"⏳ API rate limit reached. Please wait {retry_delay:.0f} seconds and try again.",
                    "retry_delay": retry_delay
                })
            await store_message(
                chat_id=state.get("project_id", ""),
                role="assistant",
                content=f"API rate limit reached during prompt enhancement. Please wait {retry_delay:.0f} seconds.",
                event_type="rate_limit_error",
            )
        
        # If enhancement fails, use original prompt
        print("⚠️ Falling back to original user prompt...")
        state["enhanced_prompt"] = state.get("user_prompt", "")
        state["execution_log"].append({
            "node": "prompt_enhancer",
            "status": "fallback",
            "error": error_msg,
            "message": "Using original prompt due to enhancement error"
        })
        
        if socket and not is_rate_limit_error(e):
            await safe_send_socket(socket, {
                "e": "prompt_enhancer_fallback",
                "message": "⚠️ Using your original prompt (enhancement skipped)",
            })
        
        return state


async def planner_node(state: GraphState) -> GraphState:
    """
    Planner node: Analyzes user prompt and generates comprehensive implementation plan
    """
    try:
        socket = state.get("socket")
        if socket:
            await safe_send_socket(socket, 
                {
                    "e": "planner_started",
                    "message": "Planning the application architecture...",
                }
            )

        enhanced_prompt = state.get("enhanced_prompt", state.get("user_prompt", ""))
        print(f"INFO: Recieved Prompt {enhanced_prompt}")
        project_id = state.get("project_id", "")
        print(f"INFO: Project ID: {project_id}")

        previous_context = ""

        # check if previous context is there
        if project_id:
            print(f"Loading context for project: {project_id}")
            context = load_json_store(project_id, "context.json")
            print(f"Loaded context: {context}")

            if context:
                print(f"Context keys found: {context.keys()}")
                
                # Format conversation history
                conversation_history_text = ""
                conversation_history = context.get("conversation_history", [])
                print(f"Conversation history entries: {len(conversation_history)}")
                
                if conversation_history:
                    conversation_history_text = (
                        "\nCONVERSATION HISTORY (Last requests):\n"
                    )
                    for i, conv in enumerate(conversation_history[-5:], 1):
                        status = "[SUCCESS]" if conv.get("success") else "[FAILED]"
                        conversation_history_text += f"   {i}. {status} {conv.get('user_prompt', 'Unknown')[:100]}\n"

                previous_context = f"""

                IMPORTANT: PREVIOUS WORK ON THIS PROJECT
                
                WHAT THIS PROJECT IS:
                {context.get('semantic', 'Not documented')}
                
                HOW IT WORKS:
                {context.get('procedural', 'Not documented')}
                
                WHAT HAS BEEN DONE:
                {context.get('episodic', 'Not documented')}
                
                EXISTING FILES: {len(context.get('files_created', []))} files already exist
                {conversation_history_text} 
                
                CRITICAL: This is an EXISTING project. Your plan should:
                - Build upon what already exists
                - Consider the conversation history to understand the user's intent
                - Only add/modify what's needed for the new request
                - NOT recreate existing components/pages
                - Integrate with the existing structure
                """
                print(f"Previous context prepared successfully")
            else:
                print("No previous context found - empty dict returned")

        planning_prompt = f"""
        You are an expert React application architect. Analyze the following user request and create a comprehensive implementation plan.
        {previous_context}

        USER REQUEST:
        {enhanced_prompt}

        Create a detailed plan that includes:
        1. Application overview and purpose
        2. Component hierarchy and structure
        3. Page/routing structure
        4. Required dependencies
        5. File structure
        6. Implementation steps

        {"NOTE: Since this is an existing project, focus your plan on the NEW features/changes requested, not recreating everything." if previous_context else ""}

        Respond with a JSON object containing the plan.
        """

        messages = [
            SystemMessage(
                content="You are an expert React application architect. Create detailed implementation plans."
            ),
            HumanMessage(content=planning_prompt),
        ]

        if socket:
            await safe_send_socket(socket, {"e": "thinking", "message": "Analyzing your request and creating implementation plan..."})

        # Store thinking message
        await store_message(
            chat_id=state.get("project_id"),
            role="assistant",
            content="Analyzing your request and creating implementation plan...",
            event_type="thinking"
        )

        try:
            response = await llm.ainvoke(messages)
        except Exception as e:
            # Detect fatal provider errors early and stop graph retries
            if is_llm_permission_error(e):
                if socket:
                    await safe_send_socket(socket, {"e": "fatal_error", "message": str(e)})
                await store_message(
                    chat_id=state.get("project_id"),
                    role="assistant",
                    content=f"Fatal LLM error: {str(e)}",
                    event_type="fatal_error",
                )
                new_state = state.copy()
                new_state["current_node"] = "planner"
                new_state["error_message"] = str(e)
                new_state["fatal_error"] = True
                return new_state
            raise

        # Format the plan preview for better display
        plan_preview = response.content[:500] if len(response.content) > 500 else response.content
        formatted_preview = create_formatted_message("thinking", plan_preview)
        
        if socket:
            await safe_send_socket(socket, formatted_preview)

        # Store plan preview with formatting
        await store_message(
            chat_id=state.get("project_id"),
            role="assistant",
            content=formatted_preview.get("formatted", plan_preview),
            event_type="thinking"
        )

        try:
            plan = json.loads(response.content)
        except json.JSONDecodeError:
            plan = {
                "overview": response.content,
                "components": [],
                "pages": [],
                "dependencies": [],
                "file_structure": [],
                "implementation_steps": [],
            }

        new_state = state.copy()
        new_state["plan"] = plan
        new_state["current_node"] = "planner"
        new_state["execution_log"].append(
            {"node": "planner", "status": "completed", "plan": plan}
        )

        # Create formatted plan message
        formatted_plan_msg = create_formatted_message(
            "planner_complete",
            plan,
            message="Planning completed successfully"
        )
        
        if socket:
            await safe_send_socket(socket, formatted_plan_msg)

        # Store plan completion with formatted markdown
        await store_message(
            chat_id=state.get("project_id"),
            role="assistant",
            content=formatted_plan_msg.get("formatted", json.dumps(plan, indent=2)),
            event_type="planner_complete"
        )

        return new_state

    except Exception as e:
        error_msg = f"Planner node error: {str(e)}"
        print(error_msg)

        new_state = state.copy()
        new_state["current_node"] = "planner"
        new_state["error_message"] = error_msg
        if is_llm_permission_error(e):
            new_state["fatal_error"] = True
        elif is_rate_limit_error(e):
            retry_delay = get_retry_delay_from_error(e)
            new_state["error_message"] = f"API rate limit reached. Please wait {retry_delay:.0f} seconds."
            if socket:
                await safe_send_socket(socket, {
                    "e": "rate_limit_error",
                    "message": f"⏳ API rate limit reached. Please wait {retry_delay:.0f} seconds and try again.",
                    "retry_delay": retry_delay
                })
            await store_message(
                chat_id=state.get("project_id", ""),
                role="assistant",
                content=f"API rate limit reached during planning. Please wait {retry_delay:.0f} seconds.",
                event_type="rate_limit_error",
            )
            return new_state
            
        new_state["execution_log"].append(
            {"node": "planner", "status": "error", "error": error_msg}
        )

        if socket:
            await safe_send_socket(socket, {"e": "planner_error", "message": error_msg})

        return new_state


async def builder_node(state: GraphState) -> GraphState:
    """
    Builder node: Creates and modifies files based on plan or feedback
    """

    try:
        socket = state.get("socket")
        sandbox = state.get("sandbox")

        if not sandbox:
            raise Exception("Sandbox not available")

        # Short-circuit if a fatal error was already detected upstream
        if state.get("fatal_error"):
            print("Fatal error flag set - skipping builder")
            new_state = state.copy()
            new_state["current_node"] = "builder"
            return new_state

        if socket:
            await safe_send_socket(socket, 
                {
                    "e": "builder_started",
                    "message": "Starting to build the application...",
                }
            )

        plan = state.get("plan", {})
        if plan:
            print("INFO: Plan Recieved")

        current_errors = state.get("current_errors", {})

        project_id = state.get("project_id", "")

        base_tools = create_tools_with_context(sandbox, socket, project_id)

        # DApp flow marker: the orchestrator embeds this protected spec block
        is_dapp = "<<<FRONTEND_SPEC_DO_NOT_ALTER>>>" in (state.get("enhanced_prompt") or "")

        if current_errors:
            error_details = []
            missing_file_list = []
            for error_type, errors in current_errors.items():
                if isinstance(errors, list):
                    for err in errors:
                        if isinstance(err, dict):
                            error_msg = err.get("error", str(err))
                            error_details.append(f"ERROR: {error_msg}")
                            if err.get("type") == "missing_files" and err.get("files"):
                                missing_file_list.extend(err["files"])
                        else:
                            error_details.append(f"ERROR: {str(err)}")
                else:
                    error_details.append(f"{error_type}: {str(errors)}")

            missing_directive = ""
            if missing_file_list:
                missing_directive = f"""
            ⚠️ MISSING FILES — THESE DO NOT EXIST AND MUST BE CREATED:
            {chr(10).join(f"- {f}" for f in dict.fromkeys(missing_file_list))}

            You MUST create each missing file with write_file/create_file before
            finishing. Do NOT just read files and stop — the build will fail
            again if the files still don't exist.
            """

            builder_prompt = f"""            
            CRITICAL: BUILD FAILED - YOU MUST FIX THESE ERRORS
            
            The previous build attempt failed with these errors:
            
            {chr(10).join(error_details)}
            {missing_directive}
            YOUR TASK:
            1. Read the error messages carefully
            2. If the error lists MISSING files → CREATE each one with
               write_file/create_file, fully implemented per the spec
            3. If files exist but have errors → read them with read_file,
               fix the problem, and save with write_file
            4. NEVER finish having only read files — you must write at least
               one corrected or new file, or the build fails again
            5. Verify every required file exists before finishing
            
            COMMON FIXES:
            - If you see "Expecting Unicode escape sequence" → Fix \\n in strings
            - If you see "Cannot find module" → Check import paths
            - If you see "Unexpected token" → Fix JSX syntax errors
            - If you see '"X" is not exported by "...lucide-react..."' → that icon
              was REMOVED from lucide-react (Github, Twitter, Linkedin, Instagram,
              Facebook, Youtube, Chrome, Slack, Twitch, Figma...). Replace the
              import with a valid icon (e.g. GitBranch, Share2, Briefcase, Camera,
              Globe, ExternalLink) and update its usages.
            - If you see 'Rollup failed to resolve import "pkg"' → run
              execute_command("npm install pkg") for missing packages, or fix the
              relative path / create the missing file.
            - Ignore "/*#__PURE__*/" annotation warnings from node_modules — they
              are harmless. Focus on the LAST error in the output.
            
            Fix ALL errors before finishing!
            """
        elif is_dapp:
            builder_prompt = f"""
            The scaffold is PRE-BUILT and protected — routing, pages, providers,
            contract config and typed hooks already exist. Your ONLY job is to
            write the 10 design files listed in your system instructions.

            IMPLEMENTATION PLAN FROM PLANNER:

            {json.dumps(plan, indent=2)}

            CRITICAL STEPS — DO ALL OF THESE:

            1. Call get_context() for previous work on this project (if any).
            2. Read 1-2 stub files to confirm import paths/exports
               (e.g. read_file("src/components/app/ContractActions.jsx"),
               read_file("src/theme.css")).
            3. Write src/theme.css FIRST — it defines the palette and effects
               every component consumes.
            4. Write all 9 component files with write_multiple_files
               (2-3 batches is fine).
            5. VERIFY with list_directory("src/components") — every file from
               the list must contain YOUR implementation, not the stub.

            DO NOT STOP until all 10 files have YOUR implementation!
            """
        else:
            builder_prompt = f"""
            STEP 0: CHECK PREVIOUS WORK (IMPORTANT!)

            FIRST ACTION: Call get_context() to see if there's any previous work on this project.
            - If context exists, read it carefully to understand what's already built
            - Check which files already exist before creating new ones
            - Build upon existing work instead of recreating everything
            
            IMPLEMENTATION PLAN FROM PLANNER:

            {json.dumps(plan, indent=2)}
            
            YOUR MISSION:

            Build the COMPLETE application according to the plan above.
            
            CRITICAL STEPS - DO ALL OF THESE:
            
            1. READ EXISTING FILES FIRST:
               - read_file("package.json") to see dependencies
               - read_file("src/App.jsx") to see current structure
               - read_file("src/main.jsx") to see entry point
               - use tool list_directory to see the directory and try to get context of all file you need by reading them
            
            2. CREATE ALL DIRECTORIES (only create those directory if not there):
               - Use execute_command("mkdir -p ...") for all needed directories
               - Example: mkdir -p src/components/card src/components/navigation src/pages
            
            3. CREATE ALL COMPONENTS, PAGES AND FILES:
               - Use create_file for EVERY component, pages mentioned in the plan
               - Create components and pages ONE BY ONE
               - Follow the component, pages hierarchy in the plan
               - Make sure each component and pages has proper imports and exports
            
            4. UPDATE MAIN FILES:
               - Update src/App.jsx to use the new pages
               - make sure index.css file have this import "@import "tailwindcss";" on top otherwise tailwind not work
               - Update src/App.css with Tailwind directives if needed
            
            5. VERIFY YOUR WORK:
               - Use list_directory to see what you created
               - Make sure ALL components, pages from the plan are created
               - if you need to make extra component and pages, do create them if neeeded
            
            6. SAVE YOUR WORK (FINAL STEP):
               - After completing all files, call save_context() to document what you built
               - Include: what the project is, how it works, and what you created
               - This helps future sessions understand the project
            
            DO NOT STOP until you have created ALL files mentioned in the implementation plan!
            """

        # Inject protected spec blocks (contract details, strict design system,
        # mandatory two-page architecture, exact index.css) VERBATIM into the
        # builder prompt. The planner produces a summarized plan, so these exact
        # instructions must be re-attached here or they get lost.
        try:
            _enh = state.get("enhanced_prompt", "") or ""
            _protected = re.findall(
                r'<<<[A-Z_]+_DO_NOT_ALTER>>>.*?<<<END_[A-Z_]+>>>',
                _enh, re.DOTALL
            )
            if _protected:
                builder_prompt = (
                    builder_prompt
                    + "\n\n=== NON-NEGOTIABLE SPEC (follow EXACTLY, verbatim) ===\n"
                    + "\n\n".join(_protected)
                    + "\n\nYou MUST write every file listed in the spec — the "
                      "pre-built pages already stitch them together. Write only "
                      "your assigned component/theme files; protected scaffold "
                      "files are blocked."
                )
                print(f"🛡️ Builder: injected {len(_protected)} protected spec block(s)")
        except Exception as _spec_err:
            print(f"⚠️ Builder: failed to inject protected spec: {_spec_err}")

        messages = [
            SystemMessage(content=DAPP_BUILDER_SYSTEM if is_dapp else INITPROMPT),
            HumanMessage(content=builder_prompt),
        ]

        # Use GPT-4o for builder - more reliable than Gemini for multi-step tool use
        agent_executor = create_react_agent(get_llm_by_name('gpt-4o'), tools=base_tools)
        config = {"recursion_limit": 60}

        try:
            print(
                f"Builder node: Starting agent execution with {len(base_tools)} tools"
            )
            
            files_created = []
            files_modified = []
            _builder_start = asyncio.get_event_loop().time()

            _event_gen = agent_executor.astream_events(
                {"messages": messages}, version="v2", config=config
            )
            while True:
                try:
                    event = await asyncio.wait_for(_event_gen.__anext__(), timeout=120)
                except StopAsyncIteration:
                    break
                except asyncio.TimeoutError:
                    print("Builder node: 2 min timeout waiting for next event, stopping agent")
                    raise asyncio.TimeoutError("Builder agent stalled waiting for next event")
                kind = event["event"]

                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content:
                        # Handle content that could be string or list of content blocks
                        if isinstance(content, list):
                            # If content is a list of blocks, extract text
                            text_parts = []
                            for block in content:
                                if isinstance(block, str):
                                    text_parts.append(block)
                                elif isinstance(block, dict) and block.get("type") == "text":
                                    text_parts.append(block.get("text", ""))
                                elif hasattr(block, "text"):
                                    text_parts.append(block.text)
                            content = "\n".join(filter(None, text_parts))
                        else:
                            content = str(content)
                        
                        if content and socket:
                            await safe_send_socket(socket, {"e": "thinking", "message": content})
                            # Store thinking message (batched to avoid too many DB writes)
                            if len(content) > 50:  # Only store substantial thinking
                                await store_message(
                                    chat_id=state.get("project_id"),
                                    role="assistant",
                                    content=content,
                                    event_type="thinking"
                                )

                elif kind == "on_tool_start":
                    tool_name = event.get("name")
                    tool_input = event.get("data", {}).get("input", {})
                    print(f"🔧 tool_start: {tool_name} | input: {str(tool_input)[:100]}")
                    if socket:
                        await safe_send_socket(socket, 
                            {
                                "e": "tool_started",
                                "tool_name": tool_name,
                                "tool_input": tool_input,
                            }
                        )
                    # Store tool start
                    await store_message(
                        chat_id=state.get("project_id"),
                        role="assistant",
                        content=f"Using tool: {tool_name}",
                        event_type="tool_started",
                        tool_calls=[{"name": tool_name, "status": "running", "input": str(tool_input)}]
                    )

                elif kind == "on_tool_end":
                    tool_name = event.get("name")
                    tool_output = event.get("data", {}).get("output")
                    
                    if hasattr(tool_output, "content"):
                        tool_output = tool_output.content
                    elif not isinstance(tool_output, str):
                        tool_output = str(tool_output)
                    
                    if socket:
                        await safe_send_socket(socket, 
                            {
                                "e": "tool_completed",
                                "tool_name": tool_name,
                                "tool_output": tool_output,
                            }
                        )
                    # Store tool completion
                    await store_message(
                        chat_id=state.get("project_id"),
                        role="assistant",
                        content=f"Completed: {tool_name}\n{tool_output[:200]}",
                        event_type="tool_completed",
                        tool_calls=[{"name": tool_name, "status": "success", "output": tool_output[:500]}]
                    )
                    
                    if "created" in str(tool_output).lower() and "file" in str(tool_output).lower():
                        file_matches = re.findall(r"(\w+\.(jsx?|tsx?|css|json))", str(tool_output))
                        files_created.extend([match[0] for match in file_matches])

            print(f"Builder node: Agent execution completed")
            print(f"Builder node: Final files_created: {files_created}")

            # ── expectedFiles verification (wizard-style) ──
            # Every AI-owned file ships as a functional stub, so a file that is
            # missing OR still equals the stub means the agent skipped it.
            # Give it a bounded follow-up pass to finish the design set.
            if is_dapp:
                try:
                    from agent.dapp_shell import EXPECTED_COMPONENT_FILES, AI_STUB_FILES
                    for _ef_pass in range(2):
                        pending = []
                        for _rel in EXPECTED_COMPONENT_FILES:
                            try:
                                _c = await sandbox.files.read(f"/home/user/react-app/{_rel}")
                            except Exception:
                                _c = ""
                            if not _c or _c.strip() == AI_STUB_FILES.get(_rel, "").strip():
                                pending.append(_rel)
                        if not pending:
                            break
                        print(f"⚠️ Builder: {len(pending)} file(s) still stubs after pass {_ef_pass + 1}: {pending}")
                        _follow = [
                            SystemMessage(content=DAPP_BUILDER_SYSTEM),
                            HumanMessage(content=(
                                "You finished but did NOT implement these files — they are "
                                f"still the default stubs: {pending}\n\n"
                                "Write EACH one now with create_file/write_multiple_files, "
                                "fully implemented per your spec (same default export and "
                                "filename). Do not just read files — WRITE them."
                            )),
                        ]
                        _gen = agent_executor.astream_events(
                            {"messages": _follow}, version="v2", config=config
                        )
                        while True:
                            try:
                                await _gen.__anext__()
                            except StopAsyncIteration:
                                break
                        print(f"Builder node: expected-files follow-up pass {_ef_pass + 1} done")
                except Exception as _ef_err:
                    print(f"⚠️ Builder: expected-files check failed (non-fatal): {_ef_err}")

            # Snapshot project files for deployment (exclude node_modules, dist)
            try:
                project_id_snapshot = state.get("project_id", "")
                if project_id_snapshot:
                    async def _notify_cb(event_data):
                        if socket:
                            await safe_send_socket(socket, event_data)

                    await snapshot_project_to_context_and_db(
                        project_id=project_id_snapshot,
                        sandbox=sandbox,
                        socket_callback=_notify_cb,
                        files_created=files_created,
                    )
            except Exception as snapshot_err:
                print(f"Snapshotting project files failed: {snapshot_err}")

            new_state = state.copy()
            new_state["files_created"] = files_created
            new_state["files_modified"] = files_modified
            print(f"INFO : {files_created}")
            new_state["current_node"] = "builder"
            new_state["execution_log"].append(
                {
                    "node": "builder",
                    "status": "completed",
                    "files_created": files_created,
                    "files_modified": files_modified,
                }
            )

            if socket:
                await safe_send_socket(socket, 
                    {
                        "e": "builder_complete",
                        "files_created": files_created,
                        "files_modified": files_modified,
                        "message": "Building completed",
                    }
                )

            return new_state

        except asyncio.TimeoutError:
            print("Builder agent stalled (no event for 2 min) - snapshotting and continuing")
            files_created = []
            files_modified = []

            # Snapshot whatever files were created before timeout
            try:
                project_id_snapshot = state.get("project_id", "")
                if project_id_snapshot:
                    async def _timeout_notify_cb(event_data):
                        if socket:
                            await safe_send_socket(socket, event_data)

                    await snapshot_project_to_context_and_db(
                        project_id=project_id_snapshot,
                        sandbox=sandbox,
                        socket_callback=_timeout_notify_cb,
                        files_created=files_created,
                    )
                    print("✅ Files snapshot saved despite timeout")
            except Exception as snap_err:
                print(f"Timeout snapshot failed: {snap_err}")

            new_state = state.copy()
            new_state["files_created"] = files_created
            new_state["files_modified"] = files_modified
            new_state["current_node"] = "builder"
            new_state["execution_log"].append(
                {
                    "node": "builder",
                    "status": "timeout",
                    "files_created": files_created,
                    "files_modified": files_modified,
                }
            )

            if socket:
                await safe_send_socket(socket, 
                    {
                        "e": "builder_error",
                        "message": "Builder agent timed out after 10 minutes",
                    }
                )

            return new_state

        except Exception as e:
            print(f"Builder agent execution error: {e}")
            import traceback

            traceback.print_exc()
            files_created = []
            files_modified = []

            new_state = state.copy()
            new_state["files_created"] = files_created
            new_state["files_modified"] = files_modified
            new_state["current_node"] = "builder"
            new_state["execution_log"].append(
                {
                    "node": "builder",
                    "status": "error",
                    "files_created": files_created,
                    "files_modified": files_modified,
                }
            )

            if is_llm_permission_error(e):
                new_state["fatal_error"] = True
                new_state["error_message"] = str(e)
                if socket:
                    await safe_send_socket(socket, {"e": "fatal_error", "message": str(e)})
                await store_message(
                    chat_id=state.get("project_id"),
                    role="assistant",
                    content=f"Fatal LLM error during build: {str(e)}",
                    event_type="fatal_error",
                )
            elif is_rate_limit_error(e):
                retry_delay = get_retry_delay_from_error(e)
                new_state["error_message"] = f"API rate limit reached. Please wait {retry_delay:.0f} seconds and try again."
                if socket:
                    await safe_send_socket(socket, 
                        {
                            "e": "rate_limit_error",
                            "message": f"⏳ API rate limit reached. The AI service is temporarily busy. Please wait {retry_delay:.0f} seconds and try again, or upgrade your API plan for higher limits.",
                            "retry_delay": retry_delay
                        }
                    )
                await store_message(
                    chat_id=state.get("project_id"),
                    role="assistant",
                    content=f"API rate limit reached. Please wait {retry_delay:.0f} seconds and try again.",
                    event_type="rate_limit_error",
                )
            else:
                if socket:
                    await safe_send_socket(socket, 
                        {
                            "e": "builder_error",
                            "message": f"Builder agent execution error: {str(e)}",
                        }
                    )

            return new_state

    except Exception as e:
        error_msg = f"Builder node error: {str(e)}"
        print(error_msg)

        new_state = state.copy()
        new_state["current_node"] = "builder"
        new_state["error_message"] = error_msg
        new_state["execution_log"].append(
            {"node": "builder", "status": "error", "error": error_msg}
        )

        if socket:
            await safe_send_socket(socket, {"e": "builder_error", "message": error_msg})

        return new_state



async def code_validator_node(state: GraphState) -> GraphState:
    """
    Code Validator node: Active React agent that reviews, validates, and fixes code
    """
    try:
        socket = state.get("socket")
        sandbox = state.get("sandbox")

        if not sandbox:
            raise Exception("Sandbox not available")

        # Short-circuit if fatal error exists
        if state.get("fatal_error"):
            print("Fatal error flag set - skipping code validator")
            new_state = state.copy()
            new_state["current_node"] = "code_validator"
            return new_state

        if socket:
            await safe_send_socket(socket, 
                {
                    "e": "code_validator_started",
                    "message": "Code validator agent reviewing and fixing code...",
                }
            )

        project_id = state.get("project_id", "")
        base_tools = create_tools_with_context(sandbox, socket, project_id)

        validator_prompt = """
        You are a Code Validator Agent - an expert at reviewing and fixing React code.
        
        YOUR MISSION:
        1. Review ALL files in the src/ directory
        2. Check for syntax errors, missing imports, and code issues
        3. Fix any problems you find
        4. Ensure all dependencies are properly installed
        
        STEP-BY-STEP PROCESS:
        
        STEP 1: VALIDATE FILE EXTENSIONS FIRST (CRITICAL!)
        - Use validate_file_extensions() tool to check for .js files containing JSX
        - If ANY files are reported, you MUST rename them to .jsx immediately
        - Use execute_command("mv src/path/File.js src/path/File.jsx") for each file
        - Update all imports that reference the renamed files
        - This prevents "JSX syntax extension is not currently enabled" errors
        
        STEP 2: CHECK DEPENDENCIES
        - Use check_missing_packages() tool to automatically scan all files and find missing packages
        - This tool will tell you exactly which packages are missing and give you a single install command
        - Run that ONE combined command using execute_command() (e.g. "npm install pkg1 pkg2 pkg3")
        - NEVER run multiple `npm install` commands in parallel or back-to-back — concurrent npm
          processes corrupt node_modules (ENOTEMPTY/rmdir errors) and hang the build. Always install
          all missing packages in a SINGLE `npm install` command.
        
        STEP 3: LIST ALL FILES
        - Use execute_command("find src -name '*.jsx' -o -name '*.js'") to list all files
        
        STEP 4: READ AND REVIEW EACH FILE
        - Use read_file to read each .jsx and .js file
        - Check for:
          * 🚨 CRITICAL: Wrong file extensions (ANY file with JSX syntax MUST be .jsx, NOT .js)
          * If a .js file contains JSX like `<div>`, `<Component>`, `return (<...>)` → rename to .jsx
          * Use execute_command("mv src/path/File.js src/path/File.jsx") to rename
          * Update all imports referencing the renamed file
          * Syntax errors (missing brackets, quotes, semicolons)
          * Escape sequence issues (\\n in strings should be proper)
          * Missing imports (components used but not imported)
          * Incorrect import paths
          * Missing export statements
          * Indentation issues
          * Incomplete components
          * Missing dependencies (like react-icons, react-router-dom)
        
        STEP 5: FIX ISSUES IMMEDIATELY
        - If you find ANY issue, use create_file to fix it RIGHT AWAY
        - Fix one file at a time
        - Make sure imports match the actual file structure
        - Install missing packages with execute_command("npm install package-name")
        
        STEP 6: VALIDATE IMPORTS AND FILE EXISTENCE
        - For each import statement, verify the imported file exists
        - Use execute_command("ls -la src/components/") to check files exist
        - Fix any import paths that are wrong
        
        STEP 7: CHECK FOR COMPLETENESS
        - Make sure App.jsx has proper routing setup
        - Verify all components are properly exported
        - Check that main.jsx imports App correctly
        
        STEP 8: CODE REVIEW COMPLETE
        - You have completed the code review and dependency checking
        - No build test needed - focus on code quality and dependencies only
        
        COMMON MISSING PACKAGES TO CHECK:
        - react-icons (for icons like FaShoppingCart, FaUser, FaTrash, etc.)
        - react-router-dom (for routing)
        - Any other packages imported in the code
        
        CRITICAL: If you see errors like "Failed to resolve import 'react-icons/fa'", 
        it means react-icons is missing. ALWAYS run check_missing_packages() FIRST!
        
        CRITICAL RULES:
        - Fix issues as you find them, don't just report them
        - Use create_file to save corrected code
        - Install missing packages immediately
        - Be thorough - check EVERY file
        - Focus on code quality and dependencies, no build testing needed
        
        SPECIFIC ERROR HANDLING:
        - If you see "Failed to resolve import 'react-icons/fa'" → Install react-icons
        - If you see "Cannot find module" → Check if package is installed
        - If you see "Module not found" → Install the missing package
        - If you see "Failed to resolve import '../../features/products/productsSlice'" → Check if productsSlice.js exists, recreate if missing
        - If you see "Does the file exist?" → The file is missing, recreate it using create_file
        
        START NOW: First run check_missing_packages() to find missing packages, then install them and review files
        """

        messages = [
            SystemMessage(
                content="You are a Code Validator Agent. Review and fix all code issues."
            ),
            HumanMessage(content=validator_prompt),
        ]

        validator_agent = create_react_agent(get_llm_by_name('gpt-4o') if get_llm_by_name('gpt-4o') else llm_gemini_flash, tools=base_tools)
        config = {"recursion_limit": 40}

        try:
            print(
                f"Code validator: Starting agent execution with {len(base_tools)} tools"
            )
            
            validation_errors = []

            _val_gen = validator_agent.astream_events(
                {"messages": messages}, version="v2", config=config
            )
            while True:
                try:
                    event = await asyncio.wait_for(_val_gen.__anext__(), timeout=120)
                except StopAsyncIteration:
                    break
                except asyncio.TimeoutError:
                    print("Code validator: 2 min timeout waiting for next event, stopping agent")
                    raise asyncio.TimeoutError("Code validator stalled waiting for next event")
                kind = event["event"]

                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content:
                        # Handle content that could be string or list of content blocks
                        if isinstance(content, list):
                            # If content is a list of blocks, extract text
                            text_parts = []
                            for block in content:
                                if isinstance(block, str):
                                    text_parts.append(block)
                                elif isinstance(block, dict) and block.get("type") == "text":
                                    text_parts.append(block.get("text", ""))
                                elif hasattr(block, "text"):
                                    text_parts.append(block.text)
                            content = "\n".join(filter(None, text_parts))
                        else:
                            content = str(content)
                        
                        if content and socket:
                            await safe_send_socket(socket, {"e": "thinking", "message": content})
                            # Store thinking message (batched to avoid too many DB writes)
                            if len(content) > 50:  # Only store substantial thinking
                                await store_message(
                                    chat_id=state.get("project_id"),
                                    role="assistant",
                                    content=content,
                                    event_type="thinking"
                                )

                elif kind == "on_tool_start":
                    tool_name = event.get("name")
                    tool_input = event.get("data", {}).get("input", {})
                    print(f"🔧 tool_start: {tool_name} | input: {str(tool_input)[:100]}")
                    if socket:
                        await safe_send_socket(socket, 
                            {
                                "e": "tool_started",
                                "tool_name": tool_name,
                                "tool_input": tool_input,
                            }
                        )
                    # Store tool start
                    await store_message(
                        chat_id=state.get("project_id"),
                        role="assistant",
                        content=f"Using tool: {tool_name}",
                        event_type="tool_started",
                        tool_calls=[{"name": tool_name, "status": "running", "input": str(tool_input)}]
                    )

                elif kind == "on_tool_end":
                    tool_name = event.get("name")
                    tool_output = event.get("data", {}).get("output")
                    
                    if hasattr(tool_output, "content"):
                        tool_output = tool_output.content
                    elif not isinstance(tool_output, str):
                        tool_output = str(tool_output)
                    
                    if socket:
                        await safe_send_socket(socket, 
                            {
                                "e": "tool_completed",
                                "tool_name": tool_name,
                                "tool_output": tool_output,
                            }
                        )
                    # Store tool completion
                    await store_message(
                        chat_id=state.get("project_id"),
                        role="assistant",
                        content=f"Completed: {tool_name}\n{tool_output[:200]}",
                        event_type="tool_completed",
                        tool_calls=[{"name": tool_name, "status": "success", "output": tool_output[:500]}]
                    )

            print(f"Code validator: Agent execution completed")
            print("Code validator: Code review and dependency checking completed")

            if socket:
                await safe_send_socket(socket, 
                    {
                        "e": "validation_success",
                        "message": "Code validator completed - code review and dependencies checked!",
                    }
                )

            new_state = state.copy()
            new_state["validation_errors"] = validation_errors
            new_state["current_node"] = "code_validator"

            if validation_errors:
                retry_count = new_state.get("retry_count", {})
                retry_count["validation_errors"] = (
                    retry_count.get("validation_errors", 0) + 1
                )
                new_state["retry_count"] = retry_count
                new_state["current_errors"] = {"validation_errors": validation_errors}
                print(
                    f"Code validator: Found {len(validation_errors)} validation errors"
                )
            else:
                print("Code validator: No validation errors found")

            new_state["execution_log"].append(
                {
                    "node": "code_validator",
                    "status": "completed",
                    "validation_errors": validation_errors,
                }
            )

            if socket:
                await safe_send_socket(socket, 
                    {
                        "e": "code_validator_complete",
                        "errors": validation_errors,
                        "message": f"Code validation completed. Found {len(validation_errors)} errors.",
                    }
                )

            return new_state

        except asyncio.TimeoutError:
            print("Code validator stalled (no event for 2 min) - continuing")

            new_state = state.copy()
            new_state["validation_errors"] = [
                {
                    "type": "timeout",
                    "error": "Code validator timed out",
                    "details": "Validation took too long",
                }
            ]
            new_state["current_node"] = "code_validator"

            if socket:
                await safe_send_socket(socket, 
                    {
                        "e": "code_validator_timeout",
                        "message": "Code validator timed out",
                    }
                )

            return new_state

    except Exception as e:
        error_msg = f"Code validator node error: {str(e)}"
        print(error_msg)
        traceback.print_exc()

        new_state = state.copy()
        new_state["current_node"] = "code_validator"
        new_state["error_message"] = error_msg
        # Mark fatal on provider permission errors (e.g., leaked/invalid key)
        if is_llm_permission_error(e):
            new_state["fatal_error"] = True
            if socket:
                await safe_send_socket(socket, {"e": "fatal_error", "message": str(e)})
            await store_message(
                chat_id=state.get("project_id"),
                role="assistant",
                content=f"Fatal LLM error during validation: {str(e)}",
                event_type="fatal_error",
            )
        elif is_rate_limit_error(e):
            retry_delay = get_retry_delay_from_error(e)
            new_state["error_message"] = f"API rate limit reached. Please wait {retry_delay:.0f} seconds and try again."
            if socket:
                await safe_send_socket(socket, 
                    {
                        "e": "rate_limit_error",
                        "message": f"⏳ API rate limit reached. The AI service is temporarily busy. Please wait {retry_delay:.0f} seconds and try again, or upgrade your API plan for higher limits.",
                        "retry_delay": retry_delay
                    }
                )
            await store_message(
                chat_id=state.get("project_id"),
                role="assistant",
                content=f"API rate limit reached. Please wait {retry_delay:.0f} seconds and try again.",
                event_type="rate_limit_error",
            )
        else:
            # Ensure retries are bounded for non-fatal errors
            retry_count = new_state.get("retry_count", {})
            retry_count["validation_errors"] = retry_count.get("validation_errors", 0) + 1
            new_state["retry_count"] = retry_count
        new_state["validation_errors"] = [
            {
                "type": "validator_error",
                "error": str(e),
                "details": "Code validator crashed",
            }
        ]
        new_state["execution_log"].append(
            {"node": "code_validator", "status": "error", "error": error_msg}
        )

        if socket:
            await safe_send_socket(socket, {"e": "code_validator_error", "message": error_msg})

        return new_state


# ---------------------------------------------------------------------------
# Deterministic build-error repair (WIZARD §4.7 self-healing)
#
# Vite/Rollup failures in LLM-generated apps are highly repetitive: removed
# lucide-react brand icons, missing npm packages, and unresolved relative
# imports. We can fix all three deterministically inside the sandbox, without
# burning a full LLM builder cycle.
# ---------------------------------------------------------------------------

# lucide-react removed its brand icons (Github, Twitter, ...) — map them to
# guaranteed-existing icons. Specifiers are rewritten as `Valid as Missing`
# so existing JSX usages keep working.
_LUCIDE_ICON_FALLBACKS = {
    "Github": "GitBranch",
    "Gitlab": "GitBranch",
    "Twitter": "Share2",
    "Facebook": "Globe",
    "Linkedin": "Briefcase",
    "Instagram": "Camera",
    "Youtube": "Play",
    "Chrome": "Globe",
    "Slack": "MessageSquare",
    "Twitch": "Video",
    "Dribbble": "Palette",
    "Figma": "PenTool",
    "Codepen": "Code2",
    "Codesandbox": "Package",
    "Bitcoin": "Coins",
    "ChromeIcon": "Globe",
}
_LUCIDE_GENERIC_FALLBACK = "Globe"

_REACT_APP_ROOT = "/home/user/react-app"


def _npm_package_name(spec: str) -> str:
    """'@scope/pkg/sub' -> '@scope/pkg'; 'pkg/sub' -> 'pkg'"""
    parts = spec.split("/")
    if spec.startswith("@") and len(parts) >= 2:
        return "/".join(parts[:2])
    return parts[0]


def _sandbox_path(path: str) -> str:
    """Normalize a Vite-reported path to an absolute sandbox path."""
    p = path.strip()
    if p.startswith(_REACT_APP_ROOT):
        return p
    if p.startswith("/"):
        return p
    return f"{_REACT_APP_ROOT}/{p.lstrip('./')}"


def _extract_build_error_summary(build_output: str, max_lines: int = 50) -> str:
    """Pull the actionable error out of noisy Vite/Rollup output.

    `/*#__PURE__*/` annotation warnings from bundled deps (ox, zod) flood the
    log but are harmless — Rollup strips the comments and continues. The fatal
    error is always after them ("error during build:", "is not exported",
    "Could not resolve", ...). Filtering those warning lines keeps the real
    error visible for logs and for the builder-retry prompt.
    """
    if not build_output:
        return "No build output captured"

    filtered = []
    for line in build_output.splitlines():
        if "contains an annotation that Rollup cannot interpret" in line:
            continue
        if re.match(r"^\s*node_modules/[^\s]+\s*\(\d+:\d+\):\s*A comment", line):
            continue
        if "/*#__PURE__*/" in line:
            continue
        filtered.append(line)

    summary = "\n".join(filtered).strip()
    if not summary:
        summary = build_output.strip()
    return "\n".join(summary.splitlines()[-max_lines:])[-4000:]


async def _alias_lucide_icon(sandbox, importer: str, missing: str) -> str:
    """Rewrite `import { Github } from 'lucide-react'` ->
    `import { GitBranch as Github } from 'lucide-react'` in the importer file.
    Returns the replacement icon name, or '' if nothing changed."""
    path = _sandbox_path(importer)
    try:
        src = await sandbox.files.read(path)
    except Exception:
        return ""

    replacement = _LUCIDE_ICON_FALLBACKS.get(missing, _LUCIDE_GENERIC_FALLBACK)
    changed = False

    def _fix(match):
        nonlocal changed
        inner = match.group(1)

        def _sub(m):
            nonlocal changed
            changed = True
            alias = m.group(2)
            return f"{replacement} as {alias}" if alias else f"{replacement} as {missing}"

        new_inner = re.sub(
            rf"\b{re.escape(missing)}\b(\s+as\s+([\w$]+))?",
            _sub,
            inner,
        )
        return match.group(0).replace(inner, new_inner, 1)

    new_src = re.sub(
        r"import\s*{([^}]*)}\s*from\s*['\"]lucide-react['\"]",
        _fix,
        src,
    )
    if changed and new_src != src:
        await sandbox.files.write(path, new_src)
        return replacement
    return ""


async def _stub_missing_module(sandbox, importer: str, spec: str) -> str:
    """Create a stub file for an unresolved relative import. Named imports in
    the importer are re-exported as no-op values so the build passes."""
    importer_rel = importer.strip()
    if importer_rel.startswith(_REACT_APP_ROOT):
        importer_rel = importer_rel[len(_REACT_APP_ROOT):]
    importer_rel = importer_rel.lstrip("/")

    base_dir = os.path.dirname(importer_rel)
    resolved = os.path.normpath(os.path.join(base_dir, spec)).replace("\\", "/")

    _, ext = os.path.splitext(resolved)
    if not ext:
        for cand in (".jsx", ".js", ".tsx", ".ts", ".css", ".json"):
            try:
                if await sandbox.files.exists(f"{_REACT_APP_ROOT}/{resolved}{cand}"):
                    return ""
            except Exception:
                pass
        resolved += ".jsx"
        ext = ".jsx"

    abs_path = f"{_REACT_APP_ROOT}/{resolved}"
    try:
        if await sandbox.files.exists(abs_path):
            return ""
    except Exception:
        pass

    if ext == ".css":
        content = "/* auto-generated stub */\n"
    elif ext == ".json":
        content = "{}\n"
    else:
        named = []
        try:
            importer_src = await sandbox.files.read(_sandbox_path(importer))
            for imp in re.finditer(
                rf"import\s+([^;]+?)\s+from\s+['\"]{re.escape(spec)}['\"]",
                importer_src,
            ):
                clause = imp.group(1)
                brace = re.search(r"{([^}]*)}", clause)
                if brace:
                    for part in brace.group(1).split(","):
                        nm = part.strip().split(" as ")[0].strip()
                        if re.match(r"^[A-Za-z_$][\w$]*$", nm):
                            named.append(nm)
        except Exception:
            pass

        lines = ["import React from 'react'", "", "const _Stub = () => null", "export default _Stub"]
        lines += [f"export const {n} = _Stub" for n in dict.fromkeys(named)]
        content = "\n".join(lines) + "\n"

    try:
        parent = os.path.dirname(abs_path)
        if parent:
            await sandbox.commands.run(f"mkdir -p {parent}", timeout=15)
        await sandbox.files.write(abs_path, content)
        return abs_path
    except Exception:
        return ""


async def _apply_deterministic_build_fixes(sandbox, build_output: str) -> list:
    """Best-effort deterministic repairs for common Vite build failures.

    Returns a list of human-readable descriptions of applied fixes."""
    fixes = []
    if not build_output:
        return fixes

    # 1) "X" is not exported by "node_modules/<pkg>/...", imported by "<file>"
    for name, pkg_path, importer in dict.fromkeys(re.findall(
        r'"([A-Za-z_$][\w$]*)"\s+is not exported by\s+"node_modules/([^"]+)",\s*imported by\s+"([^"]+)"',
        build_output,
    )):
        pkg = _npm_package_name(pkg_path)
        try:
            if pkg == "lucide-react":
                used = await _alias_lucide_icon(sandbox, importer, name)
                if used:
                    fixes.append(f"{importer}: lucide icon '{name}' -> '{used} as {name}'")
                continue
        except Exception as e:
            print(f"   lucide alias fix failed ({importer}:{name}): {e}")

    # 2) Unresolved imports: 'Rollup failed to resolve import "x" from "y"',
    #    'Could not resolve "x"', 'Cannot find module "x"'
    for spec, importer in dict.fromkeys(re.findall(
        r'(?:Rollup failed to resolve import|Could not resolve|Cannot find module|Failed to resolve import)\s+["\']([^"\']+)["\'](?:\s+from\s+["\']([^"\']+)["\'])?',
        build_output,
    )):
        if spec.startswith("."):
            if importer:
                stub = await _stub_missing_module(sandbox, importer, spec)
                if stub:
                    fixes.append(f"created stub {stub} for unresolved import '{spec}'")
        elif not spec.startswith("/") and ":" not in spec:
            pkg = _npm_package_name(spec)
            if pkg in {"react", "react-dom", "vite"}:
                continue
            try:
                res = await sandbox.commands.run(
                    f"cd {_REACT_APP_ROOT} && npm install {pkg} --legacy-peer-deps 2>&1",
                    timeout=180,
                )
                if res.exit_code == 0:
                    fixes.append(f"installed missing package '{pkg}'")
                else:
                    print(f"   npm install {pkg} failed: {res.stderr[:200] if res.stderr else res.stdout[-200:]}")
            except Exception as e:
                print(f"   npm install {pkg} failed: {e}")

    # 3) "Failed to parse source for import analysis" — usually a stray */
    #    inside a JSDoc block comment (e.g. "uint*/int*") that prematurely
    #    closes the comment. Re-seed the protected scaffold files to undo
    #    any corruption.
    _parse_err = re.search(
        r'Failed to parse source for import analysis.*?\nfile:\s*([^\s]+)',
        build_output, re.DOTALL,
    )
    if _parse_err:
        bad_file = _parse_err.group(1).strip()
        _rel = bad_file.replace("/home/user/react-app/", "")
        try:
            from agent.dapp_shell import write_scaffold_files
            await write_scaffold_files(sandbox)
            fixes.append(
                f"re-seeded protected scaffold (parse error in {_rel})"
            )
        except Exception as _reseed_err:
            print(f"   scaffold re-seed failed: {_reseed_err}")

    return fixes


async def application_checker_node(state: GraphState) -> GraphState:
    """
    Application Checker node: Checks if the application is running and captures errors
    """
    try:
        socket = state.get("socket")
        sandbox = state.get("sandbox")

        if not sandbox:
            raise Exception("Sandbox not available")

        # If a fatal upstream error occurred, skip heavy checks and finish
        if state.get("fatal_error"):
            print("Fatal error flag set - skipping application checker")
            new_state = state.copy()
            new_state["current_node"] = "application_checker"
            new_state["success"] = False
            return new_state

        if socket:
            await safe_send_socket(socket, 
                {
                    "e": "app_check_started",
                    "message": "Checking application status and capturing errors...",
                }
            )

        runtime_errors = []

        print("Application checker: Installing dependencies and starting dev server...")

        try:
            # ── PROTECT + RESTORE: overwrite any LLM damage to critical files ──
            # The builder/validator agents sometimes blank out or replace the
            # deterministic ABI-driven shell. Restore the golden copies here so
            # the production build is ALWAYS correct and wired to the contract.
            # SKIP restoration if user requested custom theme via prompt.
            try:
                from agent.dapp_shell import write_scaffold_files, write_missing_stubs

                project_id_restore = state.get("project_id", "")
                ctx_restore = load_json_store(project_id_restore, "context.json") or {}

                # Always restore the protected scaffold (theme-neutral — the
                # design lives in AI-owned component files, never touched here)
                restored = await write_scaffold_files(sandbox)
                # Fill in AI-owned stubs ONLY where the file is missing/empty —
                # never overwrite AI-generated components.
                stubbed = await write_missing_stubs(sandbox)
                print(f"🛡️ Restored {len(restored)} scaffold files before build")
                if stubbed:
                    print(f"🧩 Filled missing component stubs: {stubbed}")

                # Restore protected contract config from context.json
                protected = ctx_restore.get("protected_files", {})
                for rel_path, content in protected.items():
                    await sandbox.files.write(f"/home/user/react-app/{rel_path}", content)
                if protected:
                    print(f"🛡️ Restored {len(protected)} protected contract files: {list(protected.keys())}")
            except Exception as restore_err:
                print(f"⚠️ Shell restore failed (non-fatal): {restore_err}")

            # ========== WIZARD §4.6: expectedFiles verification ==========
            # Check if main files exist AND are non-placeholder
            expected_files = {
                "src/App.jsx": ["import", "export", "function", "return"],
                "src/main.jsx": ["ReactDOM", "render", "import"],
                "src/pages/LandingPage.jsx": ["export", "function", "return"],
                "src/pages/AppPage.jsx": ["export", "function", "return", "ContractActions"],
                "package.json": ["dependencies", "react", "vite"],
            }
            missing_files = []
            placeholder_files = []

            for file_path, required_keywords in expected_files.items():
                try:
                    content = await sandbox.files.read(f"/home/user/react-app/{file_path}")
                    # Check if file is a placeholder (too short or missing key content)
                    if len(content) < 50:
                        placeholder_files.append(file_path)
                    elif not any(keyword in content for keyword in required_keywords):
                        placeholder_files.append(file_path)
                except Exception:
                    missing_files.append(file_path)

            if missing_files:
                print(f"⚠️ Missing essential files: {missing_files}")
                runtime_errors.append(
                    {
                        "type": "missing_files",
                        "error": f"Missing essential files: {', '.join(missing_files)}",
                        "files": missing_files,
                    }
                )
            elif placeholder_files:
                # Files exist but are placeholders - request targeted retry
                print(f"⚠️ Placeholder files detected: {placeholder_files}")
                runtime_errors.append(
                    {
                        "type": "placeholder_files",
                        "error": f"Files exist but appear incomplete: {', '.join(placeholder_files)}",
                        "files": placeholder_files
                    }
                )
            else:
                print("✅ Application checker: All essential files present and complete")
                
                # Install dependencies
                if socket:
                    await safe_send_socket(socket, 
                        {
                            "e": "installing_dependencies",
                            "message": "Installing npm dependencies...",
                        }
                    )
                
                try:
                    print("Installing npm dependencies (this may take up to 5 minutes for large projects)...")
                    
                    # Run npm install wrapped in subshell that always exits 0 and appends exit code marker
                    # This prevents E2B CommandExitException from hiding the real error output
                    install_result = await sandbox.commands.run(
                        "cd /home/user/react-app && (npm install --legacy-peer-deps 2>&1; echo \"__INSTALL_EXIT__:$?\")",
                        timeout=300  # 5 minutes - enough for large projects
                    )
                    
                    # Extract real exit code from marker
                    install_output = install_result.stdout or ""
                    exit_match = re.search(r"__INSTALL_EXIT__:(\d+)", install_output)
                    real_exit_code = int(exit_match.group(1)) if exit_match else install_result.exit_code
                    # Strip the marker from visible output
                    install_output = re.sub(r"__INSTALL_EXIT__:\d+\s*$", "", install_output).strip()
                    
                    # Check if npm install succeeded
                    if real_exit_code != 0:
                        error_msg = f"npm install failed with exit code {real_exit_code}"
                        print(error_msg)
                        print(f"npm install output:\n{install_output[-2000:]}")  # Last 2000 chars
                        
                        if socket:
                            await safe_send_socket(socket, {
                                "e": "error",
                                "message": f"❌ Dependency installation failed: {install_output[-200:]}"
                            })
                        
                        runtime_errors.append({
                            "type": "npm_install_failure",
                            "message": error_msg,
                            "details": install_output
                        })
                        
                        # Mark as failed and return early
                        success = False
                        print("Aborting due to npm install failure")
                        
                        # Still save what we have
                        return {
                            "success": False,
                            "runtime_errors": runtime_errors,
                            "files_created": state.get("files_created", []),
                            "error_message": "npm install failed - dependencies could not be installed"
                        }
                    
                    print(f"✅ npm install completed successfully")
                    
                    if socket:
                        await safe_send_socket(socket, {
                            "e": "install_complete",
                            "message": "✅ Dependencies installed successfully"
                        })
                        
                except Exception as install_error:
                    error_msg = f"npm install exception: {str(install_error)}"
                    print(error_msg)
                    runtime_errors.append({
                        "type": "npm_install_exception",
                        "message": error_msg
                    })
                    success = False
                    return {
                        "success": False,
                        "runtime_errors": runtime_errors,
                        "files_created": state.get("files_created", []),
                        "error_message": f"npm install error: {str(install_error)}"
                    }
                
                # Build and serve application
                if socket:
                    await safe_send_socket(socket, 
                        {
                            "e": "starting_build",
                            "message": "Building production-ready application...",
                        }
                    )
                
                try:
                    # ========== WIZARD §4.7: Build self-healing loop ==========
                    # Try build up to 3 times, feeding errors back to the LLM for fixes
                    max_build_retries = 3
                    build_succeeded = False
                    build_output = ""
                    
                    for build_attempt in range(1, max_build_retries + 1):
                        print(f"Building production bundle with Vite (attempt {build_attempt}/{max_build_retries})...")
                        
                        if socket:
                            await safe_send_socket(socket, {
                                "e": "building",
                                "message": f"Building production-optimized bundle (attempt {build_attempt}/{max_build_retries})..."
                            })
                        
                        # Run production build. Wrap in a subshell that ALWAYS exits 0 and
                        # appends an exit-code marker. Otherwise E2B's SDK raises a
                        # CommandExitException with an EMPTY error (stderr was merged into
                        # stdout via 2>&1), which hid the real Vite build failure.
                        build_result = await sandbox.commands.run(
                            "cd /home/user/react-app && (npm run build 2>&1; echo \"__BUILD_EXIT__:$?\")",
                            timeout=120  # 2 minutes should be enough for build
                        )

                        build_output = build_result.stdout or ""
                        exit_match = re.search(r"__BUILD_EXIT__:(\d+)", build_output)
                        real_exit_code = int(exit_match.group(1)) if exit_match else build_result.exit_code
                        # Strip the marker from the visible output
                        build_output = re.sub(r"__BUILD_EXIT__:\d+\s*$", "", build_output).strip()

                        if real_exit_code == 0:
                            build_succeeded = True
                            print(f"✅ Build completed successfully on attempt {build_attempt}")
                            print(f"Build output: {build_output[-500:]}")  # Last 500 chars
                            break
                        
                        # Build failed - extract the actionable error for LLM feedback.
                        # Filter the harmless Rollup `/*#__PURE__*/` annotation warnings so
                        # the real error stays visible instead of being buried/truncated.
                        error_output = build_output or "No error output available"
                        error_summary = _extract_build_error_summary(error_output)
                        error_truncated = error_summary

                        print(f"❌ Build attempt {build_attempt} failed with exit code {real_exit_code}")
                        print(f"Error summary: {error_summary[:1500]}")

                        if socket:
                            await safe_send_socket(socket, {
                                "e": "build_retry",
                                "message": f"⚠️ Build failed (attempt {build_attempt}), analyzing errors..."
                            })

                        # If this is not the last attempt, try to auto-fix
                        if build_attempt < max_build_retries:
                            print(f"🔧 Attempting auto-fix for build errors...")
                            try:
                                applied = await _apply_deterministic_build_fixes(
                                    sandbox, error_output
                                )
                                for _fix_desc in applied:
                                    print(f"   🔧 {_fix_desc}")
                                if not applied:
                                    print("   ⚠️ No deterministic fix matched - retrying unchanged")
                            except Exception as _fix_err:
                                print(f"   ⚠️ Auto-fix crashed: {_fix_err}")

                            await asyncio.sleep(2)  # Brief pause before retry
                    
                    if not build_succeeded:
                        # All retries exhausted
                        error_msg = f"Production build failed after {max_build_retries} attempts:\n{error_truncated}"
                        print(error_msg)

                        # Send detailed error to frontend
                        if socket:
                            await safe_send_socket(socket, {
                                "e": "error",
                                "message": f"❌ Build failed after {max_build_retries} attempts: {error_truncated[:300]}"
                            })

                        raise Exception(error_msg)

                    # Snapshot files to context.json + DB after successful build
                    # This ensures files are persisted even if the builder timed out
                    try:
                        project_id_snapshot = state.get("project_id", "")
                        if project_id_snapshot:
                            async def _app_checker_notify_cb(event_data):
                                if socket:
                                    await safe_send_socket(socket, event_data)

                            await snapshot_project_to_context_and_db(
                                project_id=project_id_snapshot,
                                sandbox=sandbox,
                                socket_callback=_app_checker_notify_cb,
                            )
                            print("✅ Files snapshot saved after build")
                    except Exception as snap_err:
                        print(f"Post-build snapshot failed: {snap_err}")

                    if socket:
                        await safe_send_socket(socket, {
                            "e": "build_success",
                            "message": "✅ Build completed, starting server..."
                        })
                    
                    # Now serve the built dist folder with a simple HTTP server.
                    # background=True detaches the process via the E2B SDK —
                    # "nohup ... &" inside a foreground run keeps the command
                    # session alive until the timeout fires.
                    print("Starting HTTP server for built files...")
                    await sandbox.commands.run(
                        "cd /home/user/react-app/dist && python3 -m http.server 5173 > ../server.log 2>&1",
                        background=True,
                    )
                    
                    print("HTTP server process spawned, verifying...")
                    
                    # Wait and verify the server actually started
                    server_started = False
                    
                    for attempt in range(15):  # Try for 15 seconds (HTTP server is fast)
                        await asyncio.sleep(1)
                        
                        # Check if server is responding
                        try:
                            check = await sandbox.commands.run(
                                "curl -s -o /dev/null -w '%{http_code}' http://localhost:5173",
                                timeout=5
                            )
                            
                            if "200" in check.stdout:
                                server_started = True
                                print(f"✅ HTTP server verified running on port 5173 (attempt {attempt + 1})")
                                break
                        except:
                            pass
                    
                    if not server_started:
                        error_msg = "HTTP server did not start within 15 seconds"
                        print(f"❌ {error_msg}")
                        
                        # Try to read log for debugging
                        try:
                            log_content = await sandbox.files.read("/home/user/react-app/server.log")
                            print(f"Server log:\n{log_content[-1000:]}")  # Last 1000 chars
                        except:
                            print("Could not read server.log")
                        
                        if socket:
                            await safe_send_socket(socket, {
                                "e": "error",
                                "message": "❌ HTTP server failed to start"
                            })
                        
                        runtime_errors.append({
                            "type": "server_timeout",
                            "message": error_msg
                        })
                        
                        success = False
                        return {
                            "success": False,
                            "runtime_errors": runtime_errors,
                            "files_created": state.get("files_created", []),
                            "error_message": "HTTP server did not start"
                        }
                    
                    # Server verified - health gate: check source files for real contract wiring
                    try:
                        # Check the snapshot/source files for contract wiring
                        project_id_hg = state.get("project_id", "")
                        context_hg = load_json_store(project_id_hg, "context.json") or {}
                        files_map = context_hg.get("files", {})
                        files_count = len(files_map)
                        app_jsx_content = files_map.get("src/App.jsx", "")
                        main_jsx_content = files_map.get("src/main.jsx", "")
                        # Two-page shell: contract wiring lives in the app/*
                        # components (AppHeader owns ConnectButton; ContractInfo/
                        # StatCards/ContractActions own the contract imports)
                        wiring_content = "".join(
                            files_map.get(p, "")
                            for p in (
                                "src/App.jsx",
                                "src/pages/AppPage.jsx",
                                "src/components/ContractCards.jsx",
                                "src/components/app/AppHeader.jsx",
                                "src/components/app/ContractInfo.jsx",
                                "src/components/app/StatCards.jsx",
                                "src/components/app/ContractActions.jsx",
                            )
                        )

                        # The new deterministic shell has these markers — old boilerplate doesn't
                        has_connect_button = "ConnectButton" in wiring_content
                        has_contract_import = "CONTRACT_ADDRESS" in wiring_content or "contractConfig" in wiring_content
                        has_wagmi_provider = "WagmiProvider" in main_jsx_content
                        has_rainbowkit = "RainbowKitProvider" in main_jsx_content

                        # Old boilerplate markers that should NOT be present
                        is_old_boilerplate = (
                            "Loading contract functions" in wiring_content or
                            "wallet-connect-placeholder" in wiring_content
                        )

                        is_healthy = (
                            has_connect_button and
                            has_contract_import and
                            has_wagmi_provider and
                            has_rainbowkit and
                            not is_old_boilerplate and
                            files_count >= 5
                        )

                        if not is_healthy:
                            print(f"⚠️ Health gate FAILED: connectBtn={has_connect_button}, contractImport={has_contract_import}, wagmiProvider={has_wagmi_provider}, rainbowkit={has_rainbowkit}, oldBoilerplate={is_old_boilerplate}, files={files_count}")

                            # Check retry count
                            retry_count_hg = state.get("retry_count", {})
                            builder_retries = retry_count_hg.get("builder", 0)

                            if builder_retries < 1:
                                print("🔄 Triggering builder retry (health gate failed, attempt 1)")
                                if socket:
                                    await safe_send_socket(socket, {
                                        "e": "health_gate_retry",
                                        "message": "⚠️ App looks like boilerplate — retrying builder...",
                                    })

                                new_state = state.copy()
                                new_state["retry_count"] = {**retry_count_hg, "builder": builder_retries + 1}
                                new_state["current_node"] = "application_checker"
                                new_state["success"] = False
                                new_state["runtime_errors"] = [{"type": "boilerplate_detected", "message": "App is still boilerplate, retrying builder"}]
                                new_state["retry_builder"] = True
                                return new_state
                            else:
                                print("Health gate failed but max retries reached — continuing with current build")
                        else:
                            print(f"✅ Health gate passed: {files_count} files, ConnectButton+contract+wagmi all present")

                    except Exception as hg_err:
                        print(f"Health gate check failed (non-fatal): {hg_err}")

                    # Generate and send preview URL
                    try:
                        host = sandbox.get_host(port=5173)
                        preview_url = f"https://{host}"
                        print(f"✅ Preview URL verified and ready: {preview_url}")
                        
                        if socket:
                            await safe_send_socket(socket, 
                                {
                                    "e": "server_started",
                                    "message": "✅ Production build deployed and ready",
                                    "preview_url": preview_url,
                                }
                            )
                    except Exception as url_error:
                        print(f"Warning: Could not generate preview URL: {url_error}")
                        # Continue anyway - server is running
                        
                except Exception as server_error:
                    error_msg = f"Failed to build/serve application: {str(server_error)}"
                    print(error_msg)
                    # Fallback: if build succeeded and dist exists but preview/server step timed out,
                    # treat as success and continue to deployment.
                    try:
                        if "context deadline exceeded" in error_msg:
                            exist_check = await sandbox.commands.run(
                                "test -f /home/user/react-app/dist/index.html && echo OK || echo MISS",
                                timeout=5
                            )
                            if "OK" in exist_check.stdout:
                                if socket:
                                    await safe_send_socket(socket, {
                                        "e": "server_warning",
                                        "message": "Build succeeded but preview server check timed out. Continuing to deployment.",
                                    })
                                return {
                                    "success": True,
                                    "runtime_errors": [],
                                    "files_created": state.get("files_created", []),
                                    "error_message": None,
                                }
                    except Exception:
                        pass
                    runtime_errors.append({
                        "type": "build_server_exception",
                        "message": error_msg
                    })
                    success = False
                    return {
                        "success": False,
                        "runtime_errors": runtime_errors,
                        "files_created": state.get("files_created", []),
                        "error_message": f"Build/server error: {str(server_error)}"
                    }

        except Exception as e:
            runtime_errors.append(
                {
                    "type": "file_check_failed",
                    "error": f"Failed to check application files: {str(e)}",
                }
            )

        new_state = state.copy()
        new_state["runtime_errors"] = runtime_errors
        new_state["current_node"] = "application_checker"

        if runtime_errors:
            retry_count = new_state.get("retry_count", {})
            retry_count["runtime_errors"] = retry_count.get("runtime_errors", 0) + 1
            new_state["retry_count"] = retry_count

            new_state["current_errors"] = {"runtime_errors": runtime_errors}
        else:
            new_state["success"] = True
            print(
                "Application checker: No runtime errors found - setting success to True"
            )

        new_state["execution_log"].append(
            {
                "node": "application_checker",
                "status": "completed",
                "runtime_errors": runtime_errors,
            }
        )

        if socket:
            await safe_send_socket(socket, 
                {
                    "e": "app_check_complete",
                    "errors": runtime_errors,
                    "message": f"Application check completed. Found {len(runtime_errors)} runtime errors.",
                }
            )

        return new_state

    except Exception as e:
        error_msg = f"Application checker node error: {str(e)}"
        print(error_msg)

        new_state = state.copy()
        new_state["current_node"] = "application_checker"
        new_state["error_message"] = error_msg
        new_state["execution_log"].append(
            {"node": "application_checker", "status": "error", "error": error_msg}
        )

        if socket:
            await safe_send_socket(socket, {"e": "app_check_error", "message": error_msg})

        return new_state


def should_retry_builder_for_validation(state: GraphState) -> str:
    """Decide whether to retry builder for validation errors or continue.

    The deterministic shell is restored in application_checker before every
    build, so validator findings never block a working build. We therefore
    always continue to application_checker instead of retrying the builder,
    which avoids wasting an expensive builder cycle.
    """
    validation_errors = state.get("validation_errors", [])
    print(f"Code validator decision: {len(validation_errors)} errors - continuing to application checker (shell is protected)")
    return "application_checker"


def _unused_should_retry_builder_for_validation(state: GraphState) -> str:
    """Decide whether to retry builder for validation errors or continue"""
    if state.get("fatal_error"):
        print("Fatal error detected - skipping validation retries")
        return "application_checker"
    validation_errors = state.get("validation_errors", [])
    retry_count = state.get("retry_count", {})
    max_retries = state.get("max_retries", 3)

    # Safety check: prevent infinite loops
    total_retries = sum(retry_count.values())
    if total_retries > 10:
        print(
            f"Maximum total retries reached ({total_retries}) - continuing to application checker"
        )
        return "application_checker"

    print(
        f"Code validator decision: {len(validation_errors)} errors, {retry_count.get('validation_errors', 0)} retries"
    )

    if not validation_errors:
        print("No validation errors - continuing to application checker")
        return "application_checker"

    current_retries = retry_count.get("validation_errors", 0)
    if current_retries < max_retries:
        print(
            f"Retrying builder for validation errors (attempt {current_retries + 1}/{max_retries})"
        )
        return "builder"
    else:
        print(
            f"Max retries reached for validation errors - continuing to application checker"
        )
        return "application_checker"


def should_retry_builder_or_finish(state: GraphState) -> str:
    """Decide whether to retry builder or finish based on runtime errors"""
    if state.get("fatal_error"):
        print("Fatal error detected - forcing end")
        return "end"

    # Health gate retry takes priority
    if state.get("retry_builder"):
        print("Health gate requested builder retry")
        # Clear the flag so it doesn't loop infinitely
        state["retry_builder"] = False
        return "builder"

    runtime_errors = state.get("runtime_errors", [])
    retry_count = state.get("retry_count", {})
    max_retries = state.get("max_retries", 3)

    # Safety check: prevent infinite loops
    total_retries = sum(retry_count.values())
    if total_retries > 10:
        print(f"Maximum total retries reached ({total_retries}) - forcing end")
        return "end"

    print(
        f"Application checker decision: {len(runtime_errors)} errors, {retry_count.get('runtime_errors', 0)} retries"
    )

    if not runtime_errors:
        print("No runtime errors - finishing successfully")
        return "end"

    current_retries = retry_count.get("runtime_errors", 0)
    if current_retries < max_retries:
        print(
            f"Retrying builder for runtime errors (attempt {current_retries + 1}/{max_retries})"
        )
        return "builder"
    else:
        print(f"Max retries reached for runtime errors - finishing with errors")
        state["success"] = False
        state["error_message"] = (
            f"Failed after {max_retries} retries for runtime errors"
        )
        return "end"


async def vercel_deployer_node(state: GraphState) -> GraphState:
    """
    Vercel Deployer node: Automatically deploys successful builds to Vercel
    """
    try:
        socket = state.get("socket")
        # Use project_id as fallback when chat_id isn't explicitly set in state
        project_id = state.get("project_id", "")
        chat_id = state.get("chat_id") or project_id
        success = state.get("success", False)
        
        # Only deploy if build was successful
        if not success:
            print("Build failed - skipping Vercel deployment")
            if socket:
                await safe_send_socket(socket, {
                    "e": "deployment_skipped",
                    "message": "Deployment skipped - build failed",
                })
            return state
        
        # Check if we have files to deploy
        from utils.store import load_json_store
        project_data = load_json_store(project_id, "context.json")
        
        if not project_data or "files" not in project_data:
            print("No files found - skipping deployment")
            if socket:
                await safe_send_socket(socket, {
                    "e": "deployment_skipped",
                    "message": "No files to deploy",
                })
            return state
        
        files = project_data.get("files", {})
        if not files:
            print("Empty files dict - skipping deployment")
            return state
        
        # Send deployment starting message
        if socket:
            await safe_send_socket(socket, {
                "e": "deployment_started",
                "message": "🚀 Starting Vercel deployment...",
            })
        
        # Store deployment status in database and get chat title for naming
        chat_title = None
        async for db in get_db():
            from db.models import Chat
            chat = await db.get(Chat, chat_id)
            if chat:
                chat.deployment_status = "deploying"
                chat_title = chat.title  # Get the chat title for project naming
                await db.commit()
            break
        
        # Import and initialize Vercel client
        vercel_token = os.getenv("VERCEL_API_TOKEN")
        if not vercel_token:
            print("⚠️ VERCEL_API_TOKEN not set - skipping Vercel deployment, keeping E2B preview URL")
            if socket:
                await safe_send_socket(socket, {
                    "e": "deployment_skipped",
                    "message": "Vercel deployment skipped - no API token. App is live on E2B preview.",
                })
            return state

        from integrations.vercel_client import VercelDeploymentClient
        vercel_client = VercelDeploymentClient()
        
        # Use chat title as project name (Vercel client will sanitize it)
        # Fallback to generic name if title is not available
        project_name = chat_title if chat_title else f"my-app-{chat_id[-4:]}"

        # Build VITE_* env vars from context.json so Vercel build can inline them
        env_vars = {}
        contract_files = {k: v for k, v in files.items() if k.startswith("src/contracts/") and k.endswith(".json")}
        if contract_files:
            import json as _json
            for cpath, ccontent in contract_files.items():
                try:
                    cdata = _json.loads(ccontent)
                    env_vars["VITE_CONTRACT_ADDRESS"] = cdata.get("address", "")
                    env_vars["VITE_CHAIN_ID"] = str(cdata.get("chainId", 968))
                    env_vars["VITE_NETWORK"] = cdata.get("network", "botchain-testnet")
                    break
                except Exception:
                    continue

        # Add RPC + explorer from known network config
        network = env_vars.get("VITE_NETWORK", "botchain-testnet")
        if network == "botchain-testnet":
            env_vars["VITE_RPC_URL"] = "https://rpc.bohr.life"
            env_vars["VITE_EXPLORER_URL"] = "https://scan.bohr.life"
        elif network == "botchain":
            env_vars["VITE_RPC_URL"] = "https://rpc.botchain.ai"
            env_vars["VITE_EXPLORER_URL"] = "https://scan.botchain.ai"

        # WalletConnect project ID (optional — fallback in wagmi.js handles missing)
        wc_pid = os.getenv("WALLETCONNECT_PROJECT_ID")
        if wc_pid:
            env_vars["VITE_WALLETCONNECT_PROJECT_ID"] = wc_pid

        print(f"Deploying {len(files)} files to Vercel as '{project_name}' with {len(env_vars)} env vars")
        success_deploy, vercel_url, error_msg = await vercel_client.deploy_project(
            project_name=project_name,
            files=files,
            chat_id=chat_id,
            env_vars=env_vars if env_vars else None
        )
        
        if success_deploy and vercel_url:
            # Update database with Vercel URL
            async for db in get_db():
                from db.models import Chat
                chat = await db.get(Chat, chat_id)
                if chat:
                    chat.vercel_url = vercel_url
                    chat.app_url = vercel_url  # Set app_url to permanent Vercel URL (replaces temporary E2B sandbox URL)
                    chat.deployment_status = "deployed"
                    await db.commit()
                break
            
            # Send success message
            if socket:
                await safe_send_socket(socket, {
                    "e": "deployment_success",
                    "message": f"✅ Deployed to Vercel!",
                    "vercel_url": vercel_url,
                })
            
            # Store in context for persistence
            project_data["vercel_url"] = vercel_url
            project_data["deployment_status"] = "deployed"
            from utils.store import save_json_store
            save_json_store(project_id, "context.json", project_data)
            
            # Update state
            state["vercel_url"] = vercel_url
            state["deployment_status"] = "deployed"
            
            print(f"✅ Vercel deployment successful: {vercel_url}")
            
            # Store message in database
            await store_message(
                chat_id=chat_id,
                role="assistant",
                content=f"🎉 Successfully deployed to Vercel!\n\nYour app is live at: {vercel_url}\n\nThis URL is permanent and will never expire.",
                event_type="deployment_success"
            )
            
        else:
            # Deployment failed
            async for db in get_db():
                from db.models import Chat
                chat = await db.get(Chat, chat_id)
                if chat:
                    chat.deployment_status = "failed"
                    await db.commit()
                break
            
            if socket:
                await safe_send_socket(socket, {
                    "e": "deployment_failed",
                    "message": f"❌ Vercel deployment failed: {error_msg}",
                })
            
            state["deployment_status"] = "failed"
            state["deployment_error"] = error_msg
            
            print(f"❌ Vercel deployment failed: {error_msg}")
            
            # Store error message
            await store_message(
                chat_id=chat_id,
                role="assistant",
                content=f"Deployment to Vercel failed: {error_msg}",
                event_type="deployment_failed"
            )
        
        return state
        
    except Exception as e:
        print(f"Vercel deployer error: {e}")
        traceback.print_exc()
        
        # Update database
        chat_id = state.get("chat_id", "")
        async for db in get_db():
            from db.models import Chat
            chat = await db.get(Chat, chat_id)
            if chat:
                chat.deployment_status = "failed"
                await db.commit()
            break
        
        # Send error message
        socket = state.get("socket")
        if socket:
            await safe_send_socket(socket, {
                "e": "deployment_error",
                "message": f"Deployment error: {str(e)}",
            })
        
        state["deployment_status"] = "failed"
        state["deployment_error"] = str(e)
        
        return state


def should_deploy_to_vercel(state: GraphState) -> str:
    """Decide whether to deploy to Vercel or skip"""
    success = state.get("success", False)
    
    if success:
        print("Build successful - proceeding to Vercel deployment")
        return "deployer"
    else:
        print("Build failed - skipping Vercel deployment")
        return "end"
