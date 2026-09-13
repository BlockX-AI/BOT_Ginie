from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import asyncio
import json
import os
import io
import zipfile
import httpx
from fastapi import Depends
from datetime import datetime, timezone

from sqlalchemy import select
from agent.service import agent_service
from integrations.dapp_orchestrator import dapp_orchestrator
from auth.router import router
from routes.download import router as download_router
from db.models import User, Chat, Message
from auth.dependencies import get_current_user, get_current_user_optional
from sqlalchemy.ext.asyncio import AsyncSession
from db.base import get_db, engine, Base
import uuid
import re

from auth.utils import decode_token


app = FastAPI(title="Evi")

origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3100",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3100",
    "https://webbuilder.elevenai.xyz",
    "https://evi-web-lovat.vercel.app",
]

def is_allowed_origin(origin: str) -> bool:
    """Check if origin is allowed (supports Vercel preview deployments)"""
    if origin in origins:
        return True
    if origin and origin.endswith(".vercel.app"):
        return True
    if origin and (origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:")):
        return True
    return False

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app|http://(localhost|127\.0\.0\.1):\d+",
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

app.include_router(router=router)
app.include_router(router=download_router)


@app.on_event("startup")
async def create_tables_on_startup():
    """Create all database tables on startup if they don't exist.

    This runs regardless of the deployment start command, so tables are
    always initialized even if migrations/scripts are skipped by the platform.
    """
    try:
        print("🔧 Ensuring database tables exist...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print(" Database tables are ready!")
    except Exception as e:
        print(f" Could not create tables on startup: {e}")

active_sockets: dict[str, WebSocket] = {}
active_runs: dict[str, asyncio.Task] = {}
agent_tasks: dict[str, dict] = {}  # Store agent task state independently of WebSocket


class SocketProxy:
    """Proxy that always sends to the *current* WebSocket for a chat ID.

    Background tasks (dapp_creation_task, agent_task, etc.) capture a socket
    reference once, but the WebSocket may disconnect and reconnect (e.g. proxy
    idle timeout).  This proxy looks up the live socket from ``active_sockets``
    on every call so messages always reach the user's current connection.
    """

    def __init__(self, sockets: dict, chat_id: str):
        self._sockets = sockets
        self._chat_id = chat_id

    def _sock(self):
        return self._sockets.get(self._chat_id)

    @property
    def application_state(self):
        s = self._sock()
        if s:
            return s.application_state
        class _Closed:
            value = 0
        return _Closed()

    @property
    def client_state(self):
        s = self._sock()
        if s:
            return s.client_state
        class _Closed:
            value = 0
        return _Closed()

    async def send_json(self, data):
        s = self._sock()
        if s:
            try:
                await s.send_json(data)
            except Exception as e:
                print(f"SocketProxy send_json failed for {self._chat_id}: {e}")

    async def send_text(self, text):
        s = self._sock()
        if s:
            try:
                await s.send_text(text)
            except Exception as e:
                print(f"SocketProxy send_text failed for {self._chat_id}: {e}")

    def __getattr__(self, name):
        s = self._sock()
        if s:
            return getattr(s, name)
        raise AttributeError(f"No active socket for {self._chat_id}")

# Share the single Service instance (and its sandbox registry) with the DApp
# orchestrator so the /projects/{id}/files endpoints can see sandboxes created
# during the full contract+frontend pipeline.
dapp_orchestrator.webbuilder = agent_service

class ChatPayload(BaseModel):
    prompt: str
    model: str = "gpt-4o"  # Default model, supports: gpt-4o, gemini-2.5-pro, gemini-2.5-flash, claude-3


@app.get("/")
async def get_health():
    return {"message": "Welome", "status": "Healthy"}


@app.get("/chats/{id}/messages")
async def get_chat_messages(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get message history for a chat"""
    # Verify the chat exists and belongs to the user
    result = await db.execute(select(Chat).where(Chat.id == id))
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this chat")

    # Get all messages for the chat
    result = await db.execute(
        select(Message)
        .where(Message.chat_id == id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()

    return {
        "chat": {
            "id": chat.id,
            "title": chat.title,
            "app_url": chat.app_url,
            "vercel_url": chat.vercel_url,  # Include Vercel permanent deployment URL
            "deployment_status": chat.deployment_status,
            "github_repo_url": getattr(chat, "github_repo_url", None),
            "created_at": chat.created_at
        },
        "messages": [
            {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "event_type": msg.event_type,
                "created_at": msg.created_at
            }
            for msg in messages
        ]
    }


@app.get("/chats/{id}/build-status")
async def get_build_status(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the build status of a project with real-time task progress"""
    result = await db.execute(select(Chat).where(Chat.id == id))
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this chat")
    
    # Include agent task state if available
    task_state = agent_tasks.get(id, {})
    
    return {
        "build_status": chat.build_status,
        "build_started_at": chat.build_started_at,
        "last_build_event": chat.last_build_event,
        "task_running": id in active_runs and not active_runs[id].done(),
        "task_state": {
            "status": task_state.get("status", "unknown"),
            "started_at": task_state.get("started_at"),
            "last_update": task_state.get("last_update"),
            "error": task_state.get("error")
        } if task_state else None
    }


@app.post("/chat")
async def create_project(
    payload: ChatPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import uuid
    
    # Generate UUID on backend
    chat_id = str(uuid.uuid4())

    prompt = payload.prompt
    model = payload.model  # Get selected model from payload

    if not prompt:
        return JSONResponse({"error": "Too short or no description"}, status_code=400)

    # Check if user has tokens/credits remaining
    if not current_user.can_make_query():
        hours_remaining = current_user.get_time_until_reset()
        return JSONResponse(
            {
                "error": "No tokens remaining",
                "message": f"You have used all your tokens. You get 2 tokens per 24 hours. Reset in {hours_remaining:.1f} hours.",
                "tokens_remaining": current_user.tokens_remaining,
                "reset_in_hours": hours_remaining
            },
            status_code=403
        )
    
    # Use one token for this request
    if not current_user.use_token():
        return JSONResponse(
            {"error": "Failed to consume token", "message": "Unable to process request"},
            status_code=500
        )
    
    # Commit the token usage
    await db.commit()
    await db.refresh(current_user)

    if chat_id in active_runs:
        return JSONResponse(
            {"error": "Project is being created. Kindly wait"}, status_code=400
        )

    new_chat = Chat(
        id=chat_id,
        user_id=current_user.id,
        title=prompt[:100] if len(prompt) > 100 else prompt,
    )

    db.add(new_chat)
    await db.commit()

    async def agent_task():
        try:
            while chat_id not in active_sockets:
                await asyncio.sleep(0.2)
            socket = SocketProxy(active_sockets, chat_id)
            await agent_service.run_agent_stream(prompt=prompt, id=chat_id, socket=socket, model=model)
        except Exception as e:
            print(f"Error in agent task for project {chat_id}: {e}")
            print(f"Error type: {type(e)}")
            import traceback

            traceback.print_exc()
        finally:
            active_runs.pop(chat_id, None)

    active_runs[chat_id] = asyncio.create_task(agent_task())
    return {
        "status": "success",
        "message": f"Agent started for project {chat_id}. Connect via WebSocket to see progress.",
        "chat_id": chat_id,
        "tokens_remaining": current_user.tokens_remaining,
        "reset_in_hours": current_user.get_time_until_reset()
    }


@app.post("/demo/chat")
async def create_demo_project(
    payload: ChatPayload,
    db: AsyncSession = Depends(get_db),
):
    """Public demo endpoint that doesn't require authentication"""
    import uuid
    
    # Generate UUID on backend
    chat_id = str(uuid.uuid4())

    prompt = payload.prompt
    model = payload.model  # Get selected model from payload

    if not prompt:
        return JSONResponse({"error": "Too short or no description"}, status_code=400)

    if chat_id in active_runs:
        return JSONResponse(
            {"error": "Project is being created. Kindly wait"}, status_code=400
        )

    # Try to create chat record, but don't fail if DB migration hasn't run yet
    try:
        new_chat = Chat(
            id=chat_id,
            user_id=None,  # No user for demo
            title=prompt[:100] if len(prompt) > 100 else prompt,
        )
        db.add(new_chat)
        await db.commit()
    except Exception as e:
        print(f"Warning: Could not save chat to database (migration may be pending): {e}")
        # Continue anyway - the agent can still run without DB record

    async def agent_task():
        try:
            while chat_id not in active_sockets:
                await asyncio.sleep(0.2)
            socket = SocketProxy(active_sockets, chat_id)

            # Full DApp pipeline: deploy + verify smart contract via the
            # Evi_Contract_Engine, then build the frontend wired to the REAL
            # contract address/ABI, then deploy to Vercel.
            network = os.getenv("DEFAULT_NETWORK", "botchain")
            contract_ok = False
            # Retry the full contract pipeline once before falling back. The EVI
            # contract engine can fail intermittently; a single retry dramatically
            # reduces the chance of shipping a contract-less (empty) DApp.
            max_attempts = 2
            for attempt in range(1, max_attempts + 1):
                try:
                    if attempt > 1 and socket:
                        try:
                            await socket.send_json({
                                "e": "contract_retry",
                                "message": f"🔁 Contract pipeline failed — retrying (attempt {attempt}/{max_attempts})...",
                            })
                        except Exception:
                            pass
                    async for task_db in get_db():
                        result = await dapp_orchestrator.create_full_dapp(
                            db=task_db,
                            chat_id=chat_id,
                            prompt=prompt,
                            network=network,
                            socket=socket,
                        )
                        contract_ok = bool(result and result.get("success"))
                        if not contract_ok:
                            print(f"Contract pipeline did not succeed for {chat_id} (attempt {attempt}/{max_attempts}): {result.get('error') if result else 'no result'}")
                        break
                except Exception as dapp_err:
                    print(f"DApp orchestrator failed for {chat_id} (attempt {attempt}/{max_attempts}): {dapp_err}")
                    import traceback
                    traceback.print_exc()
                if contract_ok:
                    break

            # If the contract phase failed, stop the pipeline and inform the user.
            if not contract_ok:
                error_code = result.get('error') if result else 'UNKNOWN'
                error_details = result.get('details') if result else {}
                print(f"Contract pipeline failed for {chat_id}: {error_code}")

                # Build a user-friendly error message
                if error_code == 'CONSTRUCTOR_ARGS_REQUIRED':
                    expected_args = error_details.get('expectedConstructor', []) if error_details else []
                    arg_desc = ", ".join(
                        f"{a.get('name', '?')} ({a.get('type', '?')})"
                        for a in expected_args
                    ) if expected_args else "unknown arguments"
                    user_msg = (
                        f"❌ Contract deployment failed: Your contract requires constructor arguments "
                        f"that were not provided. Expected: {arg_desc}. "
                        f"Please rephrase your prompt to include these values or simplify the contract. "
                        f"Try again with a different prompt."
                    )
                else:
                    user_msg = (
                        f"❌ Contract pipeline failed: {error_code}. "
                        f"Please try again with a different prompt."
                    )

                try:
                    await socket.send_json({
                        "e": "pipeline_failed",
                        "error": error_code,
                        "details": error_details,
                        "message": user_msg,
                    })
                except Exception:
                    pass

                # Update chat status to failed
                try:
                    async for task_db in get_db():
                        chat_result = await task_db.execute(select(Chat).where(Chat.id == chat_id))
                        chat_row = chat_result.scalar_one_or_none()
                        if chat_row:
                            chat_row.status = "failed"
                        await task_db.commit()
                        break
                except Exception:
                    pass
                return
        except Exception as e:
            print(f"Error in agent task for project {chat_id}: {e}")
            print(f"Error type: {type(e)}")
            import traceback

            traceback.print_exc()
        finally:
            active_runs.pop(chat_id, None)

    active_runs[chat_id] = asyncio.create_task(agent_task())
    return {
        "status": "success",
        "message": f"Agent started for project {chat_id}. Connect via WebSocket to see progress.",
        "chat_id": chat_id,
    }


@app.get("/demo/projects/{id}/meta")
async def get_demo_project_meta(id: str, db: AsyncSession = Depends(get_db)):
    """Unauthenticated endpoint returning chat metadata, contracts, and file list.

    Used by the demo frontend to display contract info, Vercel URL, and
    generated files after the pipeline completes.
    """
    chat_result = await db.execute(select(Chat).where(Chat.id == id))
    chat = chat_result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Project not found")

    # Contracts
    from db.models import Contract
    contract_result = await db.execute(select(Contract).where(Contract.chat_id == id))
    contracts = contract_result.scalars().all()

    contract_list = []
    for c in contracts:
        contract_list.append({
            "id": c.id,
            "name": c.contract_name,
            "address": c.contract_address,
            "network": c.network,
            "chain_id": c.chain_id,
            "abi": c.abi,
            "source_code": c.source_code,
            "verified": c.verified,
            "explorer_url": c.explorer_url,
            "deployment_status": c.deployment_status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    # Files from database
    files_list = []
    try:
        from utils.file_manager import get_project_files_list
        files_list = await get_project_files_list(db=db, project_id=id) or []
    except Exception as e:
        print(f"Failed to get files list for demo meta: {e}")

    return {
        "project_id": id,
        "chat": {
            "id": chat.id,
            "title": chat.title,
            "app_url": chat.app_url,
            "vercel_url": getattr(chat, "vercel_url", None),
            "deployment_status": getattr(chat, "deployment_status", None),
            "github_repo_url": getattr(chat, "github_repo_url", None),
            "created_at": chat.created_at.isoformat() if chat.created_at else None,
        },
        "contracts": contract_list,
        "files": files_list,
    }


@app.get("/projects/{id}/files")
async def get_project_files(id: str, db: AsyncSession = Depends(get_db)):
    sandbox = agent_service.sandboxes.get(id)
    
    # If sandbox not available, try to get files from database
    if not sandbox:
        try:
            from utils.file_manager import get_project_files_list
            files = await get_project_files_list(db=db, project_id=id)
            if files:
                return {
                    "project_id": id,
                    "files": files,
                    "sandbox_id": None,
                    "sandbox_active": False,
                    "source": "database"
                }
        except Exception as db_error:
            print(f"Failed to get files from database: {db_error}")
        
        raise HTTPException(
            status_code=404, detail="Project sandbox not found and no files in database."
        )

    try:
        # Use a simple Python script to list files, excluding node_modules and other unnecessary files
        list_files_script = """
import os
import json

def should_exclude(path):
    # Exclude patterns
    exclude_dirs = ['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', '.venv', 'venv']
    exclude_files = ['.DS_Store', 'package-lock.json', 'yarn.lock']
    
    parts = path.split(os.sep)
    
    # Check if any part of the path matches excluded directories
    for part in parts:
        if part in exclude_dirs:
            return True
    
    # Check if filename matches excluded files
    filename = os.path.basename(path)
    if filename in exclude_files:
        return True
    
    return False

def list_files_recursive(path):
    file_structure = []
    for root, dirs, files in os.walk(path):
        # Modify dirs in-place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', '.venv', 'venv']]
        
        for name in files:
            relative_path = os.path.relpath(os.path.join(root, name), path)
            if not should_exclude(relative_path):
                file_structure.append(relative_path)
    return file_structure

react_app_path = "/home/user/react-app"
if os.path.exists(react_app_path):
    files = list_files_recursive(react_app_path)
    print(json.dumps(files))
else:
    print(json.dumps([]))
"""
        
        # Write the script to sandbox and execute it
        await sandbox.files.write("/tmp/list_files.py", list_files_script)
        proc = await sandbox.commands.run("python /tmp/list_files.py", cwd="/tmp")
        
        if proc.exit_code != 0:
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to list files: {proc.stderr}"
            )
        
        files = json.loads(proc.stdout)

        return {
            "project_id": id,
            "files": files,
            "sandbox_id": sandbox.sandbox_id,
            "sandbox_active": True,
        }
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse file list: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching files: {str(e)}"
        )


@app.get("/projects/{id}/files/{file_path:path}")
async def get_file_content(id: str, file_path: str, db: AsyncSession = Depends(get_db)):
    """Get the content of a specific file from the project"""
    sandbox = agent_service.sandboxes.get(id)
    
    # If sandbox not available, try to get file from database
    if not sandbox:
        try:
            from utils.file_manager import get_project_file_content
            content = await get_project_file_content(db=db, project_id=id, file_path=file_path)
            if content is not None:
                return {
                    "file_path": file_path,
                    "content": content,
                    "source": "database"
                }
        except Exception as db_error:
            print(f"Failed to get file from database: {db_error}")
        
        raise HTTPException(
            status_code=404, detail="Project sandbox not found and file not in database."
        )

    try:
        full_path = f"/home/user/react-app/{file_path}"
        content = await sandbox.files.read(full_path)
        
        return {
            "file_path": file_path,
            "content": content,
            "source": "sandbox"
        }
    except Exception as e:
        # Fallback to database if sandbox read fails
        try:
            from utils.file_manager import get_project_file_content
            content = await get_project_file_content(db=db, project_id=id, file_path=file_path)
            if content is not None:
                return {
                    "file_path": file_path,
                    "content": content,
                    "source": "database"
                }
        except Exception as db_error:
            print(f"Failed to get file from database: {db_error}")
        
        raise HTTPException(
            status_code=500,
            detail=f"Error reading file: {str(e)}"
        )


@app.get("/projects/{id}/download")
async def download_all_files(id: str, db: AsyncSession = Depends(get_db)):
    """Download all project files as a ZIP archive"""
    sandbox = agent_service.sandboxes.get(id)
    
    # If sandbox not available, redirect to database-backed download
    if not sandbox:
        from utils.file_manager import get_project_files_with_content
        try:
            files = await get_project_files_with_content(db=db, project_id=id)
            if not files:
                raise HTTPException(
                    status_code=404, detail="Project not found or no files in database."
                )
            
            # Create ZIP from database files
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for file_path, content in files.items():
                    try:
                        zip_file.writestr(file_path, content)
                    except Exception as e:
                        print(f"Failed to add {file_path} to ZIP: {e}")
                        continue
            
            zip_buffer.seek(0)
            return StreamingResponse(
                zip_buffer,
                media_type="application/zip",
                headers={
                    "Content-Disposition": f"attachment; filename={id}-project.zip"
                }
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error creating ZIP from database: {str(e)}"
            )

    try:
        # Get list of files first (excluding node_modules, etc.)
        list_files_script = """
import os
import json

def should_exclude(path):
    # Exclude patterns
    exclude_dirs = ['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', '.venv', 'venv']
    exclude_files = ['.DS_Store', 'package-lock.json', 'yarn.lock']
    
    parts = path.split(os.sep)
    
    # Check if any part of the path matches excluded directories
    for part in parts:
        if part in exclude_dirs:
            return True
    
    # Check if filename matches excluded files
    filename = os.path.basename(path)
    if filename in exclude_files:
        return True
    
    return False

def list_files_recursive(path):
    file_structure = []
    for root, dirs, files in os.walk(path):
        # Modify dirs in-place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', '.venv', 'venv']]
        
        for name in files:
            relative_path = os.path.relpath(os.path.join(root, name), path)
            if not should_exclude(relative_path):
                file_structure.append(relative_path)
    return file_structure

react_app_path = "/home/user/react-app"
if os.path.exists(react_app_path):
    files = list_files_recursive(react_app_path)
    print(json.dumps(files))
else:
    print(json.dumps([]))
"""
        
        await sandbox.files.write("/tmp/list_files.py", list_files_script)
        proc = await sandbox.commands.run("python /tmp/list_files.py", cwd="/tmp")
        
        if proc.exit_code != 0:
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to list files: {proc.stderr}"
            )
        
        files = json.loads(proc.stdout)
        
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file_path in files:
                try:
                    full_path = f"/home/user/react-app/{file_path}"
                    content = await sandbox.files.read(full_path)
                    zip_file.writestr(file_path, content)
                except Exception as e:
                    print(f"Failed to add {file_path} to ZIP: {e}")
                    continue
        
        zip_buffer.seek(0)
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={id}-project.zip"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creating ZIP: {str(e)}"
        )


@app.get("/projects")
async def list_user_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all Projects per user"""
    result = await db.execute(
        select(Chat).where(Chat.user_id == current_user.id)
    )
    projects = result.scalars().all()
    return {
        "projects" : projects
    }


# ==================== DApp Creation Endpoints ====================

@app.get("/dapp/themes")
async def get_themes():
    """Get list of available visual themes for DApp generation"""
    from agent.themes import get_theme_list
    return {"themes": get_theme_list()}


class DAppPayload(BaseModel):
    prompt: str
    network: str = "botchain"  # Default to BOT Chain mainnet
    contract_only: bool = False  # If True, only deploy contract
    theme_id: str = "neo-brutalist"  # Visual theme for the frontend


class FrontendForContractPayload(BaseModel):
    contract_address: str
    abi: list
    network: str
    prompt: str  # Description of desired UI


class GitHubExportPayload(BaseModel):
    repo_name: str | None = None


@app.post("/dapp/create")
async def create_dapp(
    payload: DAppPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Create a complete DApp: deploy smart contract + generate Web3 frontend
    
    This endpoint orchestrates both AcademicChain (contract) and WebBuilder (frontend)
    """
    try:
        print(f"📥 DApp creation request: {payload.dict()}")
        
        # Skip authentication checks for testing
        if current_user is None:
            print("❌ No user found in database")
            return JSONResponse(
                {"error": "No user found in database. Please create a user first."},
                status_code=500
            )
        
        print(f"✅ User found: {current_user.email} (ID: {current_user.id})")
    except Exception as e:
        print(f"❌ Error in DApp creation setup: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            {"error": f"Setup error: {str(e)}"},
            status_code=500
        )
    
    # Skip token check for testing
    # if not current_user.can_make_query():
    #     hours_remaining = current_user.get_time_until_reset()
    #     return JSONResponse(
    #         {
    #             "error": "No tokens remaining",
    #             "message": f"You have used all your tokens. You get 2 tokens per 24 hours. Reset in {hours_remaining:.1f} hours.",
    #             "tokens_remaining": current_user.tokens_remaining,
    #             "reset_in_hours": hours_remaining
    #         },
    #         status_code=403
    #     )
    
    # Use token (commented out for testing)
    # if not current_user.use_token():
    #     return JSONResponse(
    #         {"error": "Failed to consume token"},
    #         status_code=500
    #     )
    
    # await db.commit()
    # await db.refresh(current_user)
    
    # Generate chat ID
    chat_id = str(uuid.uuid4())
    
    # Create chat
    new_chat = Chat(
        id=chat_id,
        user_id=current_user.id,
        title=f"DApp: {payload.prompt[:80]}",
    )
    db.add(new_chat)
    await db.commit()
    
    # Start DApp creation in background
    from integrations.dapp_orchestrator import dapp_orchestrator
    
    async def dapp_creation_task():
        try:
            while chat_id not in active_sockets:
                await asyncio.sleep(0.2)

            # Use SocketProxy so messages always go to the *current* WebSocket,
            # even if the client disconnects and reconnects during the pipeline.
            socket = SocketProxy(active_sockets, chat_id)

            result = await dapp_orchestrator.create_full_dapp(
                db=db,
                chat_id=chat_id,
                prompt=payload.prompt,
                network=payload.network,
                socket=socket,
                user_id=current_user.id,
                contract_only=payload.contract_only,
                theme_id=payload.theme_id
            )

            if not result["success"]:
                await socket.send_json({
                    "e": "error",
                    "message": result.get("error", "DApp creation failed")
                })
        except Exception as e:
            print(f"Error in DApp creation: {e}")
            import traceback
            traceback.print_exc()
        finally:
            active_runs.pop(chat_id, None)
    
    active_runs[chat_id] = asyncio.create_task(dapp_creation_task())
    
    return {
        "status": "success",
        "message": "DApp creation started. Connect via WebSocket to see progress.",
        "chat_id": chat_id,
        "tokens_remaining": current_user.tokens_remaining,
        "network": payload.network
    }


@app.post("/api/projects/{project_id}/export-github")
async def export_project_to_github(
    project_id: str,
    payload: GitHubExportPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Chat).where(Chat.id == project_id))
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    from utils.file_manager import get_project_files_with_content

    files = await get_project_files_with_content(db=db, project_id=project_id)
    if not files:
        raise HTTPException(
            status_code=400,
            detail="No files found in database for this project. Build must complete and snapshot files first.",
        )

    # Attach on-chain contract artifacts (if any) under contracts/
    try:
        from db.models import Contract

        result = await db.execute(select(Contract).where(Contract.chat_id == project_id))
        contracts = result.scalars().all()

        def _safe_name(s: str) -> str:
            s = (s or "contract").strip()
            s = re.sub(r"[^a-zA-Z0-9._-]+", "_", s)
            return s or "contract"

        deployments = []
        for c in contracts:
            name = _safe_name(getattr(c, "contract_name", "Contract"))
            addr = getattr(c, "contract_address", "") or ""
            addr_suffix = addr[-6:] if len(addr) >= 6 else ""
            base = f"{name}_{addr_suffix}" if addr_suffix else name

            # Solidity source (if present)
            if getattr(c, "source_code", None):
                files[f"contracts/{base}.sol"] = c.source_code

            # ABI (always stored in DB in Contract model)
            try:
                abi_json = json.dumps(c.abi, indent=2)
                files[f"contracts/abi/{base}.abi.json"] = abi_json
            except Exception:
                pass

            deployments.append(
                {
                    "contract_name": getattr(c, "contract_name", None),
                    "contract_address": getattr(c, "contract_address", None),
                    "network": getattr(c, "network", None),
                    "chain_id": getattr(c, "chain_id", None),
                    "explorer_url": getattr(c, "explorer_url", None),
                    "verified": getattr(c, "verified", None),
                    "deployment_status": getattr(c, "deployment_status", None),
                    "job_id": getattr(c, "job_id", None),
                    "deploy_tx_hash": getattr(c, "deploy_tx_hash", None),
                    "created_at": c.created_at.isoformat() if getattr(c, "created_at", None) else None,
                }
            )

        if deployments:
            files["contracts/deployments.json"] = json.dumps(
                {
                    "project_id": project_id,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "deployments": deployments,
                },
                indent=2,
            )
    except Exception:
        # Export should still succeed even if contract metadata retrieval fails
        pass

    def _slugify(name: str) -> str:
        s = name.lower().strip()
        s = re.sub(r"[^a-z0-9\-_ ]+", "-", s)
        s = s.replace("_", "-").replace(" ", "-")
        s = re.sub(r"-+", "-", s).strip("-")
        return s or "webbuilder-project"

    base_name = payload.repo_name or _slugify(chat.title)
    suffix = project_id[-8:] if len(project_id) >= 8 else project_id
    repo_name = f"{base_name}-{suffix}" if suffix else base_name
    repo_name = repo_name[:90]

    from integrations.github_client import GitHubClient

    gh = GitHubClient()
    try:
        # Force public repos for now (PAT-based MVP)
        repo_full_name, repo_html_url = await gh.export_files_to_new_repo(
            repo_name=repo_name,
            files=files,
            description=f"Exported from WebBuilder project {project_id}",
            private=False,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=400,
            detail=f"GitHub export failed: {e.response.status_code} - {e.response.text}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GitHub export failed: {str(e)}")

    chat.github_repo_url = repo_html_url
    await db.commit()

    try:
        msg = Message(
            id=str(uuid.uuid4()),
            chat_id=project_id,
            role="assistant",
            content=f"✅ Exported to GitHub!\n\nRepository: {repo_html_url}",
            event_type="github_export_success",
        )
        db.add(msg)
        await db.commit()
    except Exception:
        await db.rollback()

    socket = active_sockets.get(project_id)
    if socket:
        try:
            await socket.send_json(
                {
                    "e": "github_export_success",
                    "message": "✅ Exported to GitHub!",
                    "github_repo_url": repo_html_url,
                    "repo_full_name": repo_full_name,
                }
            )
        except Exception:
            pass

    return {
        "ok": True,
        "project_id": project_id,
        "repo_full_name": repo_full_name,
        "github_repo_url": repo_html_url,
    }


@app.post("/dapp/frontend-for-contract")
async def create_frontend_for_existing_contract(
    payload: FrontendForContractPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate Web3 frontend for an existing deployed contract
    
    User provides contract address, ABI, and network
    """
    # Check tokens
    if not current_user.can_make_query():
        hours_remaining = current_user.get_time_until_reset()
        return JSONResponse(
            {
                "error": "No tokens remaining",
                "message": f"Reset in {hours_remaining:.1f} hours.",
                "tokens_remaining": current_user.tokens_remaining,
            },
            status_code=403
        )
    
    if not current_user.use_token():
        return JSONResponse(
            {"error": "Failed to consume token"},
            status_code=500
        )
    
    await db.commit()
    await db.refresh(current_user)
    
    # Generate chat ID
    chat_id = str(uuid.uuid4())
    
    # Create chat
    new_chat = Chat(
        id=chat_id,
        user_id=current_user.id,
        title=f"Frontend: {payload.contract_address[:10]}...",
    )
    db.add(new_chat)
    await db.commit()
    
    # Start frontend creation
    from integrations.dapp_orchestrator import dapp_orchestrator
    
    async def frontend_task():
        try:
            while chat_id not in active_sockets:
                await asyncio.sleep(0.2)

            socket = SocketProxy(active_sockets, chat_id)

            result = await dapp_orchestrator.create_frontend_for_existing_contract(
                db=db,
                chat_id=chat_id,
                contract_address=payload.contract_address,
                abi=payload.abi,
                network=payload.network,
                prompt=payload.prompt,
                socket=socket
            )
            
            if not result["success"]:
                await socket.send_json({
                    "e": "error",
                    "message": result.get("error", "Frontend creation failed")
                })
        except Exception as e:
            print(f"Error in frontend creation: {e}")
            import traceback
            traceback.print_exc()
        finally:
            active_runs.pop(chat_id, None)
    
    active_runs[chat_id] = asyncio.create_task(frontend_task())
    
    return {
        "status": "success",
        "message": "Frontend creation started. Connect via WebSocket.",
        "chat_id": chat_id,
        "tokens_remaining": current_user.tokens_remaining
    }


@app.get("/projects/{id}/contracts")
async def get_project_contracts(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all contracts associated with a project"""
    from db.models import Contract
    
    # Verify chat belongs to user
    result = await db.execute(select(Chat).where(Chat.id == id))
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Project not found")
    if chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get contracts
    result = await db.execute(
        select(Contract).where(Contract.chat_id == id)
    )
    contracts = result.scalars().all()
    
    return {
        "project_id": id,
        "contracts": [
            {
                "id": c.id,
                "name": c.contract_name,
                "address": c.contract_address,
                "network": c.network,
                "chain_id": c.chain_id,
                "explorer_url": c.explorer_url,
                "verified": c.verified,
                "deployment_status": c.deployment_status,
                "created_at": c.created_at
            }
            for c in contracts
        ]
    }


class VerifyContractPayload(BaseModel):
    project_id: str
    network: str = "botchain"


@app.post("/dapp/verify-contract")
async def verify_contract(
    payload: VerifyContractPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify a deployed contract on the block explorer"""
    from db.models import Contract
    from integrations.dapp_orchestrator import dapp_orchestrator

    result = await db.execute(select(Chat).where(Chat.id == payload.project_id))
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Project not found")
    if chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(Contract).where(Contract.chat_id == payload.project_id)
    )
    contracts = result.scalars().all()
    if not contracts:
        raise HTTPException(status_code=404, detail="No contracts found for this project")

    contract = contracts[0]
    if not contract.job_id:
        raise HTTPException(status_code=400, detail="Contract has no job_id — cannot verify via explorer")

    try:
        verify_result = await dapp_orchestrator.evi_client.verify_by_job(
            job_id=contract.job_id,
            network=payload.network
        )

        verified = verify_result.get("ok", False) and verify_result.get("verified", False)
        contract.verified = verified
        await db.commit()

        return {
            "ok": True,
            "verified": verified,
            "explorer_url": f"{contract.explorer_url}#code" if contract.explorer_url else None,
            "raw_result": verify_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@app.websocket("/ws/{id}")
async def ws_listener(websocket: WebSocket, id: str, token: str = None):
    """WebSocket endpoint for real-time chat communication with JWT authentication"""

    if not token:
        await websocket.close(code=1008, reason="Missing authentication token")
        return

    try:

        payload = decode_token(token)

        if payload is None:
            await websocket.close(code=1008, reason="Invalid token")
            return

        user_id = payload.get("sub")
        if user_id is None:
            await websocket.close(code=1008, reason="Invalid token payload")
            return

        async for db in get_db():
            result = await db.execute(select(User).where(User.id == int(user_id)))
            user = result.scalar_one_or_none()

            if user is None:
                await websocket.close(code=1008, reason="User not found")
                return

            result = await db.execute(select(Chat).where(Chat.id == id))
            chat = result.scalar_one_or_none()

            if chat is None:
                await websocket.close(code=1008, reason="Invalid token payload")
                return

            elif chat.user_id != user.id:
                await websocket.close(
                    code=1008, reason="Unauthorized: Chat belongs to another user"
                )
                return

            break  # Exit the async generator after first iteration

    except Exception as e:
        print(f"WebSocket authentication error: {e}")
        await websocket.close(code=1011, reason="Authentication failed")
        return

    # Check if there's already an active connection for this chat BEFORE accepting
    if id in active_sockets:
        print(f"Connection already exists for {id}, rejecting new connection")
        await websocket.close(code=1008, reason="Connection already active for this chat")
        return

    # Now safe to accept the connection
    await websocket.accept()
    print(f"WebSocket accepted and connected for project {id} by user {user_id}")
    active_sockets[id] = websocket

    # Heartbeat task to keep connection alive during long operations
    async def heartbeat_task():
        """Send periodic pings to prevent idle timeout during audit/deployment"""
        try:
            while True:
                await asyncio.sleep(5)  # Ping every 5 seconds (keep Railway proxy alive)
                if active_sockets.get(id) is not websocket:
                    break
                if hasattr(websocket, 'application_state') and websocket.application_state.value != 1:
                    break
                if hasattr(websocket, 'client_state') and websocket.client_state.value != 1:
                    break
                await websocket.send_json({
                    "e": "heartbeat",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
        except Exception as e:
            if "close" not in str(e).lower():
                print(f"Heartbeat stopped for {id}: {e}")
    
    # Start heartbeat in background
    heartbeat = asyncio.create_task(heartbeat_task())

    # Send message history on connect
    try:
        async for db in get_db():
            # Get chat info including app_url
            chat_result = await db.execute(
                select(Chat).where(Chat.id == id)
            )
            chat = chat_result.scalar_one_or_none()
            
            print(f"Chat info for {id}: {chat}")
            print(f"App URL: {chat.app_url if chat else 'No chat found'}")
            
            result = await db.execute(
                select(Message)
                .where(Message.chat_id == id)
                .order_by(Message.created_at)
            )
            messages = result.scalars().all()
            
            print(f"Sending history with {len(messages)} messages and app_url: {chat.app_url if chat else None}")
            
            if messages:  # Only send if there are messages
                await websocket.send_json({
                    "type": "history",
                    "messages": [
                        {
                            "id": msg.id,
                            "role": msg.role,
                            "content": msg.content,
                            "event_type": msg.event_type,
                            "created_at": msg.created_at.isoformat(),
                            "tool_calls": msg.tool_calls if hasattr(msg, 'tool_calls') else None
                        }
                        for msg in messages
                    ],
                    "app_url": chat.app_url if chat else None
                })
            else:
                # Send empty history for new chats
                await websocket.send_json({
                    "type": "history",
                    "messages": [],
                    "app_url": chat.app_url if chat else None
                })
            print(f"Successfully sent history for {id}")
            break
    except Exception as e:
        print(f"Error sending message history: {e}")
        import traceback
        traceback.print_exc()
        # Continue anyway, this is not critical

    try:
        # If there's an active agent task waiting for the socket, keep it alive
        # by receiving messages while the agent sends
        while True:
            try:
                # Set a receive timeout to handle long deployments (1 hour)
                # Heartbeat keeps connection alive, this catches truly idle clients
                data = await asyncio.wait_for(websocket.receive_json(), timeout=3600.0)
            except asyncio.TimeoutError:
                # Client idle for 1 hour, close connection
                print(f"WebSocket timeout for {id} - closing idle connection after 1 hour")
                break
            except RuntimeError as e:
                # WebSocket was closed (probably replaced by new connection)
                print(f"WebSocket receive error for {id}: {e}")
                break

            if data.get("type") == "chat_message":
                prompt = data.get("prompt")
                model = data.get("model", "gemini-2.5-pro")  # Get model from WebSocket data, default to Gemini

                if not prompt:
                    await websocket.send_json(
                        {"e": "error", "message": "No prompt provided"}
                    )
                    continue

                # Check token/credit availability before processing query
                async for db in get_db():
                    result = await db.execute(
                        select(User).where(User.id == int(user_id))
                    )
                    current_user = result.scalar_one_or_none()

                    if not current_user.can_make_query():
                        hours_remaining = current_user.get_time_until_reset()
                        await websocket.send_json(
                            {
                                "e": "error",
                                "message": f"No tokens remaining. You have used all your tokens. You get 2 tokens per 24 hours. Reset in {hours_remaining:.1f} hours.",
                                "tokens_remaining": current_user.tokens_remaining,
                                "reset_in_hours": hours_remaining
                            }
                        )
                        break

                    # Use one token for this query
                    if not current_user.use_token():
                        await websocket.send_json(
                            {
                                "e": "error",
                                "message": "Failed to consume token. Please try again."
                            }
                        )
                        break
                    
                    await db.commit()
                    
                    # Send token status to client
                    await websocket.send_json(
                        {
                            "type": "token_update",
                            "tokens_remaining": current_user.tokens_remaining,
                            "reset_in_hours": current_user.get_time_until_reset()
                        }
                    )
                    break

                if id in active_runs:
                    await websocket.send_json(
                        {
                            "e": "error",
                            "message": "Project is being created. Please wait for the current build to complete.",
                        }
                    )
                    continue

                # Store the user message
                async for db in get_db():
                    user_message = Message(
                        id=str(uuid.uuid4()),
                        chat_id=id,
                        role="user",
                        content=prompt
                    )
                    db.add(user_message)
                    await db.commit()
                    break

                # Start the agent task
                async def agent_task():
                    try:
                        # Store task state
                        agent_tasks[id] = {
                            "status": "starting",
                            "prompt": prompt,
                            "started_at": datetime.now(timezone.utc).isoformat(),
                            "last_update": None
                        }
                        
                        # Mark build as started in database
                        async for db in get_db():
                            chat = await db.get(Chat, id)
                            if chat:
                                chat.build_status = "building"
                                chat.build_started_at = datetime.now(timezone.utc)
                                await db.commit()
                            break
                        
                        agent_tasks[id]["status"] = "running"
                        agent_tasks[id]["last_update"] = datetime.now(timezone.utc).isoformat()
                        
                        await agent_service.run_agent_stream(
                            prompt=prompt, id=id, socket=websocket, model=model
                        )
                        
                        # Mark build as completed
                        agent_tasks[id]["status"] = "completed"
                        agent_tasks[id]["completed_at"] = datetime.now(timezone.utc).isoformat()
                        
                        async for db in get_db():
                            chat = await db.get(Chat, id)
                            if chat:
                                chat.build_status = "completed"
                                await db.commit()
                            break
                            
                    except Exception as e:
                        print(f"Error in agent task for project {id}: {e}")
                        print(f"Error type: {type(e)}")
                        import traceback

                        traceback.print_exc()
                        
                        # Store failure state
                        agent_tasks[id]["status"] = "failed"
                        agent_tasks[id]["error"] = str(e)
                        agent_tasks[id]["failed_at"] = datetime.now(timezone.utc).isoformat()
                        
                        # Mark build as failed in database
                        try:
                            async for db in get_db():
                                chat = await db.get(Chat, id)
                                if chat:
                                    chat.build_status = "failed"
                                    chat.last_build_event = f"Build failed: {str(e)}"
                                    await db.commit()
                                break
                        except Exception as db_err:
                            print(f"Failed to update build status: {db_err}")
                        
                        # Store the error message
                        try:
                            async for db in get_db():
                                error_message = Message(
                                    id=str(uuid.uuid4()),
                                    chat_id=id,
                                    role="assistant",
                                    content=f"Build failed: {str(e)}",
                                    event_type="error"
                                )
                                db.add(error_message)
                                await db.commit()
                                break
                        except Exception as db_err:
                            print(f"Failed to store error message: {db_err}")

                        # Try to send error to client, but don't fail if WebSocket is closed
                        try:
                            await websocket.send_json(
                                {"e": "error", "message": f"Build failed: {str(e)}"}
                            )
                        except Exception as ws_err:
                            print(f"Failed to send error to WebSocket: {ws_err}")
                    finally:
                        active_runs.pop(id, None)

                active_runs[id] = asyncio.create_task(agent_task())

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for project {id}")
    finally:
        # Clean up — only remove our socket if it's still ours (race-safe)
        if active_sockets.get(id) is websocket:
            active_sockets.pop(id, None)

        # Cancel heartbeat task
        if 'heartbeat' in locals():
            heartbeat.cancel()
            try:
                await heartbeat
            except asyncio.CancelledError:
                pass

        # DON'T cancel agent task - let it complete independently
        # Task will continue running and update database state
        # Client can reconnect and poll for status
        if id in active_runs:
            task = active_runs.get(id)
            if task and not task.done():
                print(f"Agent task for {id} continues running after WebSocket disconnect")
                # Task will clean itself up from active_runs when complete


@app.websocket("/ws/status/{id}")
async def ws_status_listener(websocket: WebSocket, id: str):
    """WebSocket endpoint for demo chat status updates (no authentication required)"""
    
    # Accept connection immediately for demo chats
    await websocket.accept()
    print(f"Status WebSocket connected for chat {id}")
    
    # Register in active_sockets so agent can send messages
    active_sockets[id] = websocket
    
    # Heartbeat task — frequent enough to keep Railway proxy alive
    async def heartbeat_task():
        try:
            while True:
                await asyncio.sleep(5)
                # Bail out if the socket has been closed/replaced
                if active_sockets.get(id) is not websocket:
                    break
                if hasattr(websocket, 'application_state') and websocket.application_state.value != 1:
                    break
                if hasattr(websocket, 'client_state') and websocket.client_state.value != 1:
                    break
                await websocket.send_json({
                    "e": "heartbeat",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
        except Exception as e:
            if "close" not in str(e).lower():
                print(f"Status heartbeat stopped for {id}: {e}")

    heartbeat = asyncio.create_task(heartbeat_task())

    # Send message history on connect
    try:
        # Bail out early if the socket is already closed (e.g. client connected
        # and immediately disconnected during the reconnect storm).
        if hasattr(websocket, 'application_state') and websocket.application_state.value != 1:
            print(f"WebSocket already closed for {id}, skipping history")
        elif hasattr(websocket, 'client_state') and websocket.client_state.value != 1:
            print(f"WebSocket client disconnected for {id}, skipping history")
        else:
            async for db in get_db():
                chat_result = await db.execute(select(Chat).where(Chat.id == id))
                chat = chat_result.scalar_one_or_none()

                if not chat:
                    await websocket.send_json({"e": "error", "message": "Chat not found"})
                    await websocket.close()
                    return

                result = await db.execute(
                    select(Message)
                    .where(Message.chat_id == id)
                    .order_by(Message.created_at)
                )
                messages = result.scalars().all()

                await websocket.send_json({
                    "type": "history",
                    "messages": [
                        {
                            "id": msg.id,
                            "role": msg.role,
                            "content": msg.content,
                            "event_type": msg.event_type,
                            "created_at": msg.created_at.isoformat(),
                            "tool_calls": msg.tool_calls if hasattr(msg, 'tool_calls') else None
                        }
                        for msg in messages
                    ],
                    "app_url": chat.app_url if chat else None
                })
                break
    except Exception as e:
        print(f"Error sending status history: {e}")
    
    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive(), timeout=3600.0)
                
                # Handle different message types
                if message["type"] == "websocket.disconnect":
                    print(f"Status WebSocket disconnect message for {id}")
                    break
                elif message["type"] == "websocket.receive":
                    # Check if it's a text message with JSON
                    if "text" in message:
                        try:
                            data = json.loads(message["text"])
                            # Handle incoming messages if needed
                            if data.get("type") == "ping":
                                await websocket.send_json({"type": "pong"})
                        except json.JSONDecodeError:
                            print(f"Received non-JSON text message: {message.get('text', '')[:100]}")
                    # Ignore bytes messages (ping/pong frames handled by uvicorn)
                    
            except asyncio.TimeoutError:
                print(f"Status WebSocket timeout for {id}")
                break
            except RuntimeError as e:
                print(f"Status WebSocket receive error for {id}: {e}")
                break
                
    except WebSocketDisconnect:
        print(f"Status WebSocket disconnected for {id}")
    finally:
        # Clean up — only remove our socket if it's still ours (race-safe)
        if active_sockets.get(id) is websocket:
            active_sockets.pop(id, None)
        heartbeat.cancel()
        try:
            await heartbeat
        except asyncio.CancelledError:
            pass
