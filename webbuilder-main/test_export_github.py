#!/usr/bin/env python3
"""Test GitHub export feature (PAT-based)

This tests the backend endpoint:
POST /api/projects/{project_id}/export-github

Prereqs:
- Backend running locally (default http://localhost:8000) OR set API_BASE
- Valid user credentials OR set ACCESS_TOKEN
- GITHUB_PAT set in backend environment (server-side)

Usage examples:
- With existing token:
  ACCESS_TOKEN=... python3 test_export_github.py --project <chat_id>

- Full flow (register/login, create chat, wait for files, export):
  python3 test_export_github.py --create "Build a simple landing page" \
    --email test_x@example.com --password TestPassword123! --name "Test User"
"""

import argparse
import asyncio
import json
import os
import time
from typing import Optional

import httpx


DEFAULT_API_BASE = os.getenv("API_BASE", "http://localhost:8000")


async def get_access_token(client: httpx.AsyncClient, email: str, password: str, name: str) -> str:
    # Try register (ignore if already exists)
    try:
        r = await client.post(
            f"{DEFAULT_API_BASE}/auth/register",
            json={"email": email, "password": password, "name": name},
        )
        if r.status_code in (200, 201):
            return r.json()["access_token"]
    except Exception:
        pass

    # Login
    r = await client.post(
        f"{DEFAULT_API_BASE}/auth/login",
        json={"email": email, "password": password},
    )
    r.raise_for_status()
    return r.json()["access_token"]


async def create_chat(client: httpx.AsyncClient, token: str, prompt: str) -> str:
    r = await client.post(
        f"{DEFAULT_API_BASE}/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"prompt": prompt, "model": "gemini-2.5-pro"},
    )
    r.raise_for_status()
    return r.json()["chat_id"]


async def wait_for_files(client: httpx.AsyncClient, token: str, project_id: str, timeout_s: float = 180.0) -> int:
    start = time.time()
    while True:
        r = await client.get(
            f"{DEFAULT_API_BASE}/api/projects/{project_id}/files-list",
            headers={"Authorization": f"Bearer {token}"},
        )

        # 200 => list available
        if r.status_code == 200:
            data = r.json()
            count = int(data.get("file_count", 0) or len(data.get("files", [])))
            if count > 0:
                return count

        if time.time() - start > timeout_s:
            raise TimeoutError("Timed out waiting for project files to be stored in DB")

        await asyncio.sleep(3.0)


async def export_to_github(client: httpx.AsyncClient, token: str, project_id: str, repo_name: Optional[str] = None) -> dict:
    payload = {"private": False}
    if repo_name:
        payload["repo_name"] = repo_name

    r = await client.post(
        f"{DEFAULT_API_BASE}/api/projects/{project_id}/export-github",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    r.raise_for_status()
    return r.json()


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", help="Existing project/chat id to export")
    parser.add_argument("--create", help="Create a new chat with this prompt, then export")
    parser.add_argument("--repo", help="Optional repo base name")

    parser.add_argument("--email", default=os.getenv("TEST_EMAIL", "test_export@example.com"))
    parser.add_argument("--password", default=os.getenv("TEST_PASSWORD", "TestPassword123!"))
    parser.add_argument("--name", default=os.getenv("TEST_NAME", "Test Export"))

    args = parser.parse_args()

    access_token = os.getenv("ACCESS_TOKEN")

    async with httpx.AsyncClient(timeout=60.0) as client:
        if not access_token:
            if not args.email or not args.password:
                raise SystemExit("Provide ACCESS_TOKEN or --email/--password")
            access_token = await get_access_token(client, args.email, args.password, args.name)

        project_id = args.project
        if args.create:
            project_id = await create_chat(client, access_token, args.create)
            print("Created project:", project_id)

        if not project_id:
            raise SystemExit("Provide --project or --create")

        file_count = await wait_for_files(client, access_token, project_id)
        print("DB files ready:", file_count)

        result = await export_to_github(client, access_token, project_id, repo_name=args.repo)
        print("Export result:\n", json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
