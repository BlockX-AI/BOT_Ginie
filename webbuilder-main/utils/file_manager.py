"""
File management utilities for storing and retrieving project files
"""
import uuid
from typing import Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from db.models import ProjectFile
import logging

logger = logging.getLogger(__name__)


async def store_project_file(
    db: AsyncSession,
    project_id: str,
    file_path: str,
    content: str,
    notify_callback: Optional[callable] = None
) -> ProjectFile:
    """
    Store a project file in the database and optionally notify via WebSocket
    
    Args:
        db: Database session
        project_id: Project/chat ID
        file_path: Relative path of the file (e.g., "src/App.jsx")
        content: File content as string
        notify_callback: Optional async function to send WebSocket notification
        
    Returns:
        ProjectFile object
    """
    try:
        # Check if file already exists
        stmt = select(ProjectFile).where(
            ProjectFile.project_id == project_id,
            ProjectFile.file_path == file_path
        )
        result = await db.execute(stmt)
        existing_file = result.scalar_one_or_none()
        
        if existing_file:
            # Update existing file
            existing_file.content = content
            existing_file.size = len(content.encode('utf-8'))
            await db.commit()
            await db.refresh(existing_file)
            logger.info(f"Updated file: {file_path} ({existing_file.size} bytes)")
            
            # Notify via WebSocket
            if notify_callback:
                await notify_callback({
                    "e": "file_updated",
                    "file_path": file_path,
                    "size": existing_file.size,
                    "message": f"📝 Updated {file_path}"
                })
            
            return existing_file
        else:
            # Create new file
            new_file = ProjectFile(
                id=str(uuid.uuid4()),
                project_id=project_id,
                file_path=file_path,
                content=content,
                size=len(content.encode('utf-8'))
            )
            db.add(new_file)
            await db.commit()
            await db.refresh(new_file)
            logger.info(f"Stored new file: {file_path} ({new_file.size} bytes)")
            
            # Notify via WebSocket
            if notify_callback:
                await notify_callback({
                    "e": "file_created",
                    "file_path": file_path,
                    "size": new_file.size,
                    "message": f"✅ Created {file_path}"
                })
            
            return new_file
            
    except Exception as e:
        logger.error(f"Failed to store file {file_path}: {e}")
        await db.rollback()
        raise


async def get_project_files(
    db: AsyncSession,
    project_id: str
) -> List[Dict]:
    """
    Get all files for a project
    
    Returns:
        List of file dictionaries with path, size, and timestamps
    """
    try:
        stmt = select(ProjectFile).where(
            ProjectFile.project_id == project_id
        ).order_by(ProjectFile.file_path)
        
        result = await db.execute(stmt)
        files = result.scalars().all()
        
        return [
            {
                "id": f.id,
                "file_path": f.file_path,
                "size": f.size,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
            }
            for f in files
        ]
    except Exception as e:
        logger.error(f"Failed to get project files: {e}")
        return []


async def get_project_files_with_content(
    db: AsyncSession,
    project_id: str
) -> Dict[str, str]:
    """
    Get all files for a project with their content (for ZIP generation)
    
    Returns:
        Dictionary mapping file_path -> content
    """
    try:
        stmt = select(ProjectFile).where(
            ProjectFile.project_id == project_id
        ).order_by(ProjectFile.file_path)
        
        result = await db.execute(stmt)
        files = result.scalars().all()
        
        return {f.file_path: f.content for f in files}
    except Exception as e:
        logger.error(f"Failed to get project files with content: {e}")
        return {}


async def get_project_files_list(
    db: AsyncSession,
    project_id: str
) -> List[str]:
    """
    Get list of file paths for a project (for file browser when sandbox unavailable)
    
    Returns:
        List of file paths (e.g., ["src/App.jsx", "package.json"])
    """
    try:
        stmt = select(ProjectFile).where(
            ProjectFile.project_id == project_id
        ).order_by(ProjectFile.file_path)
        
        result = await db.execute(stmt)
        files = result.scalars().all()
        
        return [f.file_path for f in files]
    except Exception as e:
        logger.error(f"Failed to get project files list: {e}")
        return []


async def get_project_file_content(
    db: AsyncSession,
    project_id: str,
    file_path: str
) -> Optional[str]:
    """
    Get content of a specific file from database
    
    Returns:
        File content as string, or None if not found
    """
    try:
        stmt = select(ProjectFile).where(
            ProjectFile.project_id == project_id,
            ProjectFile.file_path == file_path
        )
        
        result = await db.execute(stmt)
        file = result.scalar_one_or_none()
        
        if file:
            return file.content
        return None
    except Exception as e:
        logger.error(f"Failed to get file content for {file_path}: {e}")
        return None


async def delete_project_files(
    db: AsyncSession,
    project_id: str
) -> int:
    """
    Delete all files for a project
    
    Returns:
        Number of files deleted
    """
    try:
        stmt = delete(ProjectFile).where(
            ProjectFile.project_id == project_id
        )
        result = await db.execute(stmt)
        await db.commit()
        
        deleted_count = result.rowcount
        logger.info(f"Deleted {deleted_count} files for project {project_id}")
        return deleted_count
    except Exception as e:
        logger.error(f"Failed to delete project files: {e}")
        await db.rollback()
        return 0


async def get_file_count(
    db: AsyncSession,
    project_id: str
) -> int:
    """
    Get the count of files for a project
    """
    try:
        stmt = select(ProjectFile).where(
            ProjectFile.project_id == project_id
        )
        result = await db.execute(stmt)
        files = result.scalars().all()
        return len(files)
    except Exception as e:
        logger.error(f"Failed to get file count: {e}")
        return 0
