"""GitHub Integration Client (PAT-based)

Creates repositories and uploads project files for "Export to GitHub".
"""

import base64
import os
from typing import Dict, Optional, Tuple

import httpx


class GitHubClient:
    def __init__(self, token: Optional[str] = None):
        self.token = token or os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_PAT")
        if not self.token:
            raise ValueError("GITHUB_TOKEN (or GITHUB_PAT) environment variable is required")

        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def get_authenticated_user(self) -> Dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/user", headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    async def get_file_sha(
        self,
        owner: str,
        repo: str,
        path: str,
        branch: str = "main",
    ) -> Optional[str]:
        if path.startswith("/"):
            path = path[1:]

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{self.base_url}/repos/{owner}/{repo}/contents/{path}",
                headers=self.headers,
                params={"ref": branch},
            )

            if resp.status_code == 404:
                return None

            resp.raise_for_status()
            data = resp.json()
            return data.get("sha")

    async def create_repo(
        self,
        name: str,
        description: str = "",
        private: bool = False,
        auto_init: bool = True,
    ) -> Dict:
        payload = {
            "name": name,
            "description": description,
            "private": private,
            "auto_init": auto_init,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/user/repos", headers=self.headers, json=payload
            )
            resp.raise_for_status()
            return resp.json()

    async def put_file_contents(
        self,
        owner: str,
        repo: str,
        path: str,
        content: str,
        message: str,
        branch: str = "main",
        sha: Optional[str] = None,
    ) -> Dict:
        if path.startswith("/"):
            path = path[1:]

        raw = content.encode("utf-8")
        if len(raw) > 900_000:
            raise ValueError(f"File too large for GitHub Contents API: {path} ({len(raw)} bytes)")

        b64 = base64.b64encode(raw).decode("ascii")
        payload = {
            "message": message,
            "content": b64,
            "branch": branch,
        }
        if sha:
            payload["sha"] = sha

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.put(
                f"{self.base_url}/repos/{owner}/{repo}/contents/{path}",
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    async def upsert_file_contents(
        self,
        owner: str,
        repo: str,
        path: str,
        content: str,
        message: str,
        branch: str = "main",
    ) -> Dict:
        try:
            return await self.put_file_contents(
                owner=owner,
                repo=repo,
                path=path,
                content=content,
                message=message,
                branch=branch,
                sha=None,
            )
        except httpx.HTTPStatusError as e:
            # If file exists, GitHub returns 422 and requires sha for update
            if e.response is not None and e.response.status_code == 422:
                sha = await self.get_file_sha(owner=owner, repo=repo, path=path, branch=branch)
                if sha:
                    return await self.put_file_contents(
                        owner=owner,
                        repo=repo,
                        path=path,
                        content=content,
                        message=message,
                        branch=branch,
                        sha=sha,
                    )
            raise

    async def export_files_to_new_repo(
        self,
        repo_name: str,
        files: Dict[str, str],
        description: str = "",
        private: bool = False,
    ) -> Tuple[str, str]:
        user = await self.get_authenticated_user()
        owner = user["login"]

        repo = await self.create_repo(
            name=repo_name,
            description=description,
            private=private,
            auto_init=True,
        )

        repo_full_name = repo["full_name"]
        repo_html_url = repo["html_url"]

        for file_path, content in files.items():
            if not file_path or file_path.endswith("/"):
                continue

            await self.upsert_file_contents(
                owner=owner,
                repo=repo_name,
                path=file_path,
                content=content,
                message=f"Add {file_path}",
            )

        return repo_full_name, repo_html_url
