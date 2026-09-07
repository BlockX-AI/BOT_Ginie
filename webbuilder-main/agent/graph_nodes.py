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
from .prompts import INITPROMPT, PROMPT_ENHANCER_SYSTEM
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

        # Extract contract details block before enhancement so it survives the LLM rewrite
        import re
        contract_block = ""
        contract_match = re.search(
            r'<<<CONTRACT_DETAILS_DO_NOT_ALTER>>>.*?<<<END_CONTRACT_DETAILS>>>',
            user_prompt, re.DOTALL
        )
        if contract_match:
            contract_block = contract_match.group(0)
            # Remove it from the prompt sent to LLM to avoid confusion
            llm_input_prompt = user_prompt.replace(contract_block, "").strip()
            print(f"📋 Extracted contract details block ({len(contract_block)} chars) — will re-append after enhancement")
        else:
            llm_input_prompt = user_prompt

        # Create the enhancement prompt
        enhancement_messages = [
            SystemMessage(content=PROMPT_ENHANCER_SYSTEM),
            HumanMessage(content=llm_input_prompt)
        ]

        # Call LLM to enhance the prompt
        print("🤖 Calling LLM for prompt enhancement...")
        response = await llm.ainvoke(enhancement_messages)
        enhanced_prompt = response.content.strip()

        # Re-append the contract details block verbatim so the builder gets real address + ABI
        if contract_block:
            enhanced_prompt = f"{enhanced_prompt}\n\n{contract_block}\n\nIMPORTANT: You MUST call save_contract_info() with the EXACT contract name, address, chain_id, network, and abi_json shown above. Wire all read/write functions to this address using wagmi useReadContract/useWriteContract."
            print(f"📋 Re-appended contract details block to enhanced prompt")
        
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

        if current_errors:
            error_details = []
            for error_type, errors in current_errors.items():
                if isinstance(errors, list):
                    for err in errors:
                        if isinstance(err, dict):
                            error_msg = err.get("error", str(err))
                            error_details.append(f"ERROR: {error_msg}")
                        else:
                            error_details.append(f"ERROR: {str(err)}")
                else:
                    error_details.append(f"{error_type}: {str(errors)}")

            builder_prompt = f"""            
            CRITICAL: BUILD FAILED - YOU MUST FIX THESE ERRORS
            
            The previous build attempt failed with these errors:
            
            {chr(10).join(error_details)}
            
            YOUR TASK:
            1. Read the error messages carefully
            2. Identify which files have syntax errors
            3. Read those files using read_file
            4. Fix the syntax errors (escape sequences, missing imports, etc.)
            5. Use write_file to save the corrected files
            
            COMMON FIXES:
            - If you see "Expecting Unicode escape sequence" → Fix \\n in strings
            - If you see "Cannot find module" → Check import paths
            - If you see "Unexpected token" → Fix JSX syntax errors
            
            Fix ALL errors before finishing!
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

        messages = [
            SystemMessage(content=INITPROMPT),
            HumanMessage(content=builder_prompt),
        ]

        agent_executor = create_react_agent(get_llm_by_name('gpt-4o') if get_llm_by_name('gpt-4o') else llm_gemini_pro, tools=base_tools)
        config = {"recursion_limit": 40}

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
                        import re
                        file_matches = re.findall(r"(\w+\.(jsx?|tsx?|css|json))", str(tool_output))
                        files_created.extend([match[0] for match in file_matches])

            print(f"Builder node: Agent execution completed")
            print(f"Builder node: Final files_created: {files_created}")

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
            try:
                from agent.dapp_shell import write_shell_files
                restored = await write_shell_files(sandbox)
                print(f"🛡️ Restored {len(restored)} shell files before build: {restored}")

                # Restore protected contract config from context.json
                project_id_restore = state.get("project_id", "")
                ctx_restore = load_json_store(project_id_restore, "context.json") or {}
                protected = ctx_restore.get("protected_files", {})
                for rel_path, content in protected.items():
                    await sandbox.files.write(f"/home/user/react-app/{rel_path}", content)
                if protected:
                    print(f"🛡️ Restored {len(protected)} protected contract files: {list(protected.keys())}")
            except Exception as restore_err:
                print(f"⚠️ Shell restore failed (non-fatal): {restore_err}")

            # Check if main files exist
            main_files = ["src/App.jsx", "src/main.jsx", "package.json"]
            missing_files = []

            for file_path in main_files:
                try:
                    await sandbox.files.read(f"/home/user/react-app/{file_path}")
                except Exception:
                    missing_files.append(file_path)

            if missing_files:
                runtime_errors.append(
                    {
                        "type": "missing_files",
                        "error": f"Missing essential files: {', '.join(missing_files)}",
                    }
                )
            else:
                print("Application checker: All essential files present")
                
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
                    
                    # Run npm install in FOREGROUND with proper timeout and error checking
                    install_result = await sandbox.commands.run(
                        "cd /home/user/react-app && npm install --legacy-peer-deps 2>&1",
                        timeout=300  # 5 minutes - enough for large projects
                    )
                    
                    # Check if npm install succeeded
                    if install_result.exit_code != 0:
                        error_msg = f"npm install failed with exit code {install_result.exit_code}"
                        print(error_msg)
                        print(f"npm install stderr: {install_result.stderr}")
                        print(f"npm install stdout: {install_result.stdout}")
                        
                        if socket:
                            await safe_send_socket(socket, {
                                "e": "error",
                                "message": f"❌ Dependency installation failed: {install_result.stderr[:200]}"
                            })
                        
                        runtime_errors.append({
                            "type": "npm_install_failure",
                            "message": error_msg,
                            "details": install_result.stderr
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
                    print("Building production bundle with Vite...")
                    
                    if socket:
                        await safe_send_socket(socket, {
                            "e": "building",
                            "message": "Building production-optimized bundle..."
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

                    if real_exit_code != 0:
                        # Now we have the FULL Vite error output instead of an empty message
                        error_output = build_output or "No error output available"
                        error_msg = f"Production build failed with exit code {real_exit_code}:\n{error_output}"
                        print(error_msg)

                        # Send detailed error to frontend
                        if socket:
                            await safe_send_socket(socket, {
                                "e": "error",
                                "message": f"❌ Build failed: {error_output[:300]}"
                            })

                        raise Exception(error_msg)
                    
                    print("✅ Build completed successfully")
                    print(f"Build output: {build_result.stdout[-500:]}")  # Last 500 chars

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
                    
                    # Now serve the built dist folder with a simple HTTP server
                    print("Starting HTTP server for built files...")
                    start_result = await sandbox.commands.run(
                        "cd /home/user/react-app/dist && nohup python3 -m http.server 5173 > ../server.log 2>&1 & echo $!",
                        timeout=30
                    )
                    
                    if start_result.exit_code != 0:
                        error_msg = f"Failed to start HTTP server: {start_result.stderr}"
                        print(error_msg)
                        raise Exception(error_msg)
                    
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

                        # The new deterministic shell has these markers — old boilerplate doesn't
                        has_connect_button = "ConnectButton" in app_jsx_content
                        has_contract_import = "CONTRACT_ADDRESS" in app_jsx_content or "contractConfig" in app_jsx_content
                        has_wagmi_provider = "WagmiProvider" in main_jsx_content
                        has_rainbowkit = "RainbowKitProvider" in main_jsx_content

                        # Old boilerplate markers that should NOT be present
                        is_old_boilerplate = (
                            "Loading contract functions" in app_jsx_content or
                            "wallet-connect-placeholder" in app_jsx_content
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
