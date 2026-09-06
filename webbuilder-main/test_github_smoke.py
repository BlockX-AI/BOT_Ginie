#!/usr/bin/env python3
"""Smoke test for GitHub PAT integration.

This script will:
- Authenticate using GITHUB_TOKEN (or GITHUB_PAT)
- Create a NEW public repo under the authenticated user
- Upload a couple files via GitHub Contents API

NOTE: This performs real external side-effects (creates a repo).

Usage:
  GITHUB_TOKEN=*** python3 test_github_smoke.py

Optional:
  python3 test_github_smoke.py --name my-test-repo
"""

import argparse
import asyncio
import os
import time

import httpx

from integrations.github_client import GitHubClient


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", help="Repo name (optional). Will be suffixed for uniqueness.")
    args = parser.parse_args()

    token = os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_PAT")
    if not token:
        raise SystemExit("Missing GITHUB_TOKEN (or GITHUB_PAT) in environment")

    gh = GitHubClient()

    repo_base = args.name or "webbuilder-export-smoke"
    repo_name = f"{repo_base}-{int(time.time())}"

    files = {
        "README.md": "# WebBuilder GitHub Export (Smoke Test)\n\nThis repository was created by an automated smoke test.\n",
        "contracts/deployments.json": "{\n  \"ok\": true,\n  \"note\": \"smoke test\"\n}\n",
    }

    full_name, url = await gh.export_files_to_new_repo(
        repo_name=repo_name,
        files=files,
        description="Smoke test repo created by WebBuilder backend",
        private=False,
    )

    print("✅ GitHub smoke test passed")
    print("Repo:", full_name)
    print("URL:", url)


async def _run_with_diagnostics():
    try:
        await main()
    except httpx.HTTPStatusError as e:
        resp = e.response
        print("❌ GitHub API request failed")
        print("Status:", resp.status_code)
        print("URL:", str(resp.request.url))
        print("X-OAuth-Scopes:", resp.headers.get("x-oauth-scopes"))
        print("X-Accepted-OAuth-Scopes:", resp.headers.get("x-accepted-oauth-scopes"))
        print("WWW-Authenticate:", resp.headers.get("www-authenticate"))
        try:
            print("Body:", resp.text)
        except Exception:
            pass
        raise


if __name__ == "__main__":
    asyncio.run(_run_with_diagnostics())
