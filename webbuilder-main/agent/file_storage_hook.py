"""
Hook for storing files in database when agent creates them
"""
import asyncio
import json
from typing import Optional, Dict, Callable, Awaitable
from sqlalchemy.ext.asyncio import AsyncSession
from db.base import get_db
from utils.file_manager import store_project_file
from utils.store import load_json_store, save_json_store
from e2b_code_interpreter import AsyncSandbox
import logging

logger = logging.getLogger(__name__)


async def snapshot_project_to_context_and_db(
    project_id: str,
    sandbox: AsyncSandbox,
    socket_callback: Optional[Callable[[dict], Awaitable[None]]] = None,
    files_created: Optional[list] = None,
) -> Dict[str, int]:
    """
    Snapshot all files from E2B sandbox, write to context.json["files"], and store in DB.
    Safe to call multiple times (idempotent — overwrites context["files"] each time).

    Returns: dict with 'stored' and 'failed' counts
    """
    try:
        file_list_cmd = (
            "find . -type f -not -path './node_modules/*' -not -path './dist/*' "
            "-not -name 'server.log' -not -name '*.log' -not -name '.DS_Store'"
        )
        result = await sandbox.commands.run(
            file_list_cmd,
            cwd="/home/user/react-app",
            timeout=30,
        )

        if result.exit_code != 0:
            logger.error(f"Snapshot file listing failed: {result.stderr}")
            return {"stored": 0, "failed": 0}

        rel_paths = [p.strip() for p in result.stdout.split("\n") if p.strip()]
        rel_paths = [p[2:] if p.startswith("./") else p for p in rel_paths]

        files_map = {}
        for rel in rel_paths:
            try:
                content = await sandbox.files.read(f"/home/user/react-app/{rel}")
                files_map[rel] = content
            except Exception:
                continue

        # Write to context.json for Vercel deployer
        if project_id:
            context = load_json_store(project_id, "context.json") or {}
            context["files"] = files_map
            if files_created:
                existing_fc = context.get("files_created", [])
                merged_fc = list(dict.fromkeys(existing_fc + files_created))
                context["files_created"] = merged_fc
            save_json_store(project_id, "context.json", context)

        # Store in DB for real-time viewing and ZIP download
        storage_result = await snapshot_and_store_files(
            project_id=project_id,
            sandbox=sandbox,
            socket_callback=socket_callback,
        )

        if socket_callback:
            await socket_callback({
                "e": "snapshot_saved",
                "message": f"Saved {len(files_map)} files for deployment",
            })

        logger.info(f"Snapshot complete: {len(files_map)} files in context, "
                     f"{storage_result.get('stored', 0)} stored in DB")
        return {"stored": storage_result.get("stored", 0), "failed": storage_result.get("failed", 0)}

    except Exception as e:
        logger.error(f"Error in snapshot_project_to_context_and_db: {e}")
        return {"stored": 0, "failed": 0}


async def snapshot_and_store_files(
    project_id: str,
    sandbox: AsyncSandbox,
    socket_callback: Optional[callable] = None
) -> Dict[str, int]:
    """
    Snapshot all files from E2B sandbox and store them in database
    Returns: dict with 'stored' and 'failed' counts
    """
    try:
        # Get list of files from sandbox (exclude node_modules, dist, etc.)
        file_list_cmd = "find . -type f -not -path './node_modules/*' -not -path './dist/*' -not -name 'server.log' -not -name '*.log' -not -name '.DS_Store'"
        result = await sandbox.commands.run(
            file_list_cmd,
            cwd="/home/user/react-app",
            timeout=30,
        )
        
        if result.exit_code != 0:
            logger.error(f"Failed to list files: {result.stderr}")
            return {"stored": 0, "failed": 0}
        
        file_paths = [p.strip() for p in result.stdout.split("\n") if p.strip()]
        
        # Normalize paths (remove leading ./)
        file_paths = [p[2:] if p.startswith("./") else p for p in file_paths]
        
        logger.info(f"Found {len(file_paths)} files to store")
        
        stored_count = 0
        failed_count = 0
        
        # Get database session
        async for db in get_db():
            for file_path in file_paths:
                try:
                    # Read file content from sandbox
                    full_path = f"/home/user/react-app/{file_path}"
                    content = await sandbox.files.read(full_path)
                    
                    # Store in database
                    await store_project_file(
                        db=db,
                        project_id=project_id,
                        file_path=file_path,
                        content=content,
                        notify_callback=socket_callback
                    )
                    
                    stored_count += 1
                    
                except Exception as e:
                    logger.warning(f"Failed to store file {file_path}: {e}")
                    failed_count += 1
                    continue
            
            break  # Exit after first db session
        
        logger.info(f"Stored {stored_count} files, {failed_count} failed")
        
        # Send summary notification
        if socket_callback:
            await socket_callback({
                "e": "files_stored",
                "stored_count": stored_count,
                "failed_count": failed_count,
                "message": f"📦 Stored {stored_count} files in database"
            })
        
        return {"stored": stored_count, "failed": failed_count}
        
    except Exception as e:
        logger.error(f"Error in snapshot_and_store_files: {e}")
        return {"stored": 0, "failed": 0}


async def store_single_file_from_sandbox(
    project_id: str,
    sandbox: AsyncSandbox,
    file_path: str,
    socket_callback: Optional[callable] = None
) -> bool:
    """
    Store a single file from E2B sandbox to database
    Returns: True if successful, False otherwise
    """
    try:
        # Read file content from sandbox
        full_path = f"/home/user/react-app/{file_path}"
        content = await sandbox.files.read(full_path)
        
        # Store in database
        async for db in get_db():
            await store_project_file(
                db=db,
                project_id=project_id,
                file_path=file_path,
                content=content,
                notify_callback=socket_callback
            )
            break
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to store single file {file_path}: {e}")
        return False
