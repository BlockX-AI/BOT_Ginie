"""
Vercel Deployment Client
Handles automatic deployment of built apps to Vercel for permanent URLs
"""

import os
import httpx
import logging
from typing import Dict, List, Optional, Tuple
import asyncio

logger = logging.getLogger(__name__)


class VercelDeploymentClient:
    """Client for deploying projects to Vercel"""

    def __init__(self):
        self.api_token = os.getenv("VERCEL_API_TOKEN")
        self.team_id = os.getenv("VERCEL_TEAM_ID")
        self.base_url = "https://api.vercel.com"
        
        if not self.api_token:
            raise ValueError("VERCEL_API_TOKEN environment variable is required")
        
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

    async def deploy_project(
        self,
        project_name: str,
        files: Dict[str, str],
        chat_id: str,
        env_vars: Optional[Dict[str, str]] = None
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Deploy a project to Vercel
        
        Args:
            project_name: Name for the deployment (will be slugified)
            files: Dictionary mapping file paths to file contents
            chat_id: Chat ID for tracking
            env_vars: Optional dict of environment variables (e.g. VITE_CONTRACT_ADDRESS)
                     These are injected as build-time env so Vite inlines them.
            
        Returns:
            Tuple of (success, vercel_url, error_message)
        """
        try:
            logger.info(f"Starting Vercel deployment for chat {chat_id}")
            
            # Sanitize project name for Vercel (lowercase, no spaces, no special chars)
            safe_name = self._sanitize_project_name(project_name, chat_id)
            
            # Prepare files for deployment
            deployment_files = self._prepare_files(files)
            
            # Create deployment payload
            payload = {
                "name": safe_name,
                "files": deployment_files,
                "projectSettings": {
                    "framework": "vite",
                    "buildCommand": "npm run build",
                    "outputDirectory": "dist",
                    "installCommand": "npm install"
                },
                "target": "production"
            }
            
            # Inject env vars for build-time (Vite inlines VITE_* at build)
            if env_vars:
                payload["env"] = {k: v for k, v in env_vars.items() if v}
                payload["build"] = {"env": {k: v for k, v in env_vars.items() if v}}
                logger.info(f"Injecting {len(payload['env'])} env vars into Vercel deployment")
            
            # Try deployment without team ID first (personal account)
            # If that fails, we can try with team ID
            params = {}
            
            # Make deployment request
            async with httpx.AsyncClient(timeout=60.0) as client:
                logger.info(f"Sending deployment request to Vercel for {safe_name}")
                response = await client.post(
                    f"{self.base_url}/v13/deployments",
                    headers=self.headers,
                    json=payload,
                    params=params
                )
                
                if response.status_code not in [200, 201]:
                    error_msg = f"Vercel deployment failed: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    return False, None, error_msg
                
                deployment_data = response.json()
                deployment_url = deployment_data.get("url")
                
                if deployment_url:
                    # Add https if not present
                    if not deployment_url.startswith("http"):
                        deployment_url = f"https://{deployment_url}"
                    
                    logger.info(f"✅ Vercel deployment successful: {deployment_url}")
                    return True, deployment_url, None
                else:
                    error_msg = "Deployment created but no URL returned"
                    logger.error(error_msg)
                    return False, None, error_msg
                    
        except httpx.TimeoutException:
            error_msg = "Vercel deployment timed out (60s)"
            logger.error(error_msg)
            return False, None, error_msg
        except Exception as e:
            error_msg = f"Vercel deployment error: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    def _sanitize_project_name(self, name: str, chat_id: str) -> str:
        """
        Create a Vercel-compatible project name based on the chat title/prompt
        
        Vercel requirements:
        - Lowercase
        - Max 100 characters
        - Only alphanumeric and hyphens
        - No consecutive hyphens
        
        Strategy: Use the project title as the primary name, with a short suffix for uniqueness
        """
        # Remove special characters and spaces from title
        safe_name = name.lower()
        safe_name = ''.join(c if c.isalnum() or c in ['-', '_', ' '] else '-' for c in safe_name)
        
        # Replace underscores and spaces with hyphens
        safe_name = safe_name.replace('_', '-').replace(' ', '-')
        
        # Remove consecutive hyphens
        while '--' in safe_name:
            safe_name = safe_name.replace('--', '-')
        
        # Trim hyphens from start/end
        safe_name = safe_name.strip('-')
        
        # If name is empty or very short, use a default
        if not safe_name or len(safe_name) < 3:
            safe_name = "my-app"
        
        # Add short suffix for uniqueness (last 4 chars of chat_id)
        # This keeps URLs cleaner while maintaining uniqueness
        suffix = chat_id[-4:] if len(chat_id) >= 4 else chat_id
        
        # Construct final name: prioritize readable title
        if len(safe_name) <= 90:
            # Title fits comfortably, add suffix
            safe_name = f"{safe_name}-{suffix}"
        else:
            # Title too long, truncate and add suffix
            safe_name = f"{safe_name[:90]}-{suffix}"
        
        # Final safety check for length
        if len(safe_name) > 100:
            safe_name = safe_name[:100]
        
        logger.info(f"Sanitized project name '{name}' -> '{safe_name}'")
        return safe_name

    def _prepare_files(self, files: Dict[str, str]) -> List[Dict]:
        """
        Convert file dictionary to Vercel deployment format
        
        Vercel v13 API expects files in this format:
        [
            {
                "file": "path/to/file.js",
                "data": "actual_file_content_as_string"  # NOT base64!
            }
        ]
        
        Note: Vercel v13 API does NOT use base64 encoding for file data.
        It expects the raw file content as a string.
        """
        deployment_files = []
        
        for file_path, content in files.items():
            try:
                # Ensure content is a string (not bytes)
                if isinstance(content, bytes):
                    file_content = content.decode('utf-8')
                else:
                    file_content = content
                
                deployment_files.append({
                    "file": file_path,
                    "data": file_content  # Send raw content, not base64
                })
            except Exception as e:
                logger.warning(f"Failed to prepare file {file_path}: {e}")
                continue
        
        logger.info(f"Prepared {len(deployment_files)} files for deployment")
        return deployment_files

    async def check_deployment_status(self, deployment_url: str) -> Tuple[bool, str]:
        """
        Check if a deployment is ready
        
        Returns:
            Tuple of (is_ready, status)
        """
        try:
            # Extract deployment ID from URL
            # URL format: https://project-abc123.vercel.app
            # We'll just check if it's accessible
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(deployment_url, follow_redirects=True)
                
                if response.status_code == 200:
                    return True, "ready"
                elif response.status_code in [404, 502, 503]:
                    return False, "building"
                else:
                    return False, "unknown"
                    
        except Exception as e:
            logger.warning(f"Failed to check deployment status: {e}")
            return False, "unknown"
