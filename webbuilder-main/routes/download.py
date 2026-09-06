"""
File download routes for ZIP generation from database
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from db.base import get_db
from utils.file_manager import get_project_files_with_content, get_file_count
import io
import zipfile
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["downloads"])


@router.get("/projects/{project_id}/download-db")
async def download_project_from_database(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Download all project files as a ZIP archive from database
    This works even if E2B sandbox is closed or build failed
    """
    try:
        # Get all files with content from database
        files = await get_project_files_with_content(db, project_id)
        
        if not files:
            raise HTTPException(
                status_code=404,
                detail="No files found for this project"
            )
        
        logger.info(f"Creating ZIP for project {project_id} with {len(files)} files")
        
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file_path, content in files.items():
                try:
                    # Write file to ZIP with proper path
                    zip_file.writestr(file_path, content)
                except Exception as e:
                    logger.warning(f"Failed to add {file_path} to ZIP: {e}")
                    continue
        
        zip_buffer.seek(0)
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename=project-{project_id[:8]}.zip"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating ZIP from database: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating ZIP: {str(e)}"
        )


@router.get("/projects/{project_id}/files-list")
async def get_files_list(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of all files for a project (without content)
    Used for real-time file viewer in frontend
    """
    try:
        from utils.file_manager import get_project_files
        files = await get_project_files(db, project_id)
        count = len(files)
        
        return {
            "project_id": project_id,
            "file_count": count,
            "files": files
        }
    except Exception as e:
        logger.error(f"Error getting files list: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting files: {str(e)}"
        )


@router.get("/projects/{project_id}/file-content/{file_path:path}")
async def get_file_content_from_db(
    project_id: str,
    file_path: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get content of a specific file from database
    This works even if E2B sandbox is closed - always reads from database
    """
    try:
        from utils.file_manager import get_project_file_content
        content = await get_project_file_content(db, project_id, file_path)
        
        if content is None:
            raise HTTPException(
                status_code=404,
                detail=f"File '{file_path}' not found in project"
            )
        
        return {
            "project_id": project_id,
            "file_path": file_path,
            "content": content,
            "source": "database"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting file content for {file_path}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error reading file: {str(e)}"
        )
