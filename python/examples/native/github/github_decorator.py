#!/usr/bin/env python3
"""
============================================================================
GITHUB TOOLS — DECORATOR PATTERN
============================================================================

PATTERN: @tool Decorator
────────────────────────────────────────────────────────────────────────────
Wraps GitHub tool calls in a class using @tool("tool-name") decorators.

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set GITHUB_TOKEN in .env

USAGE:
────────────────────────────────────────────────────────────────────────────
  make github-decorator

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_github import get_tools_path

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


class GitHubService:
    """GitHub operations via the @tool decorator pattern."""

    @tool("github-search-repositories")
    async def search_repos(self, query: str, sort: str = "stars", per_page: int = 5):
        ...

    @tool("github-list-issues")
    async def list_issues(self, owner: str, repo: str, state: str = "open", per_page: int = 5):
        ...

    @tool("github-list-pull-requests")
    async def list_prs(self, owner: str, repo: str, state: str = "open", per_page: int = 5):
        ...

    @tool("github-list-commits")
    async def list_commits(self, owner: str, repo: str, per_page: int = 5):
        ...


async def run() -> None:
    owner = "matimo-ai"
    repo = "matimo"

    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     GitHub Tools — Decorator Pattern                   ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("GITHUB_TOKEN"):
        print("❌  GITHUB_TOKEN not set in .env")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    set_global_matimo_instance(matimo)
    print(f"✅  Loaded {len(matimo.list_tools())} GitHub tools\n")

    svc = GitHubService()

    # 1. Search repos
    print("🔍  Searching repos: 'matimo'")
    result = await svc.search_repos(query="matimo", per_page=3)
    data = (result or {}).get("data", result) or {}
    for r in (data.get("items") or [])[:3]:
        print(f"   • {r['full_name']} ⭐ {r.get('stargazers_count', 0)}")

    # 2. List issues
    print(f"\n📋  Issues in {owner}/{repo}")
    result = await svc.list_issues(owner=owner, repo=repo, per_page=3)
    data = (result or {}).get("data", result) or {}
    issues = data if isinstance(data, list) else data.get("items", [])
    for i in (issues or [])[:3]:
        print(f"   • #{i['number']} {i['title'][:60]}")
    if not issues:
        print("   ℹ️   No open issues")

    # 3. List PRs
    print(f"\n🔀  Pull Requests in {owner}/{repo}")
    result = await svc.list_prs(owner=owner, repo=repo, per_page=3)
    data = (result or {}).get("data", result) or {}
    prs = data if isinstance(data, list) else data.get("items", [])
    for pr in (prs or [])[:3]:
        print(f"   • #{pr['number']} {pr['title'][:60]}")
    if not prs:
        print("   ℹ️   No open pull requests")

    # 4. List commits
    print(f"\n📝  Recent commits in {owner}/{repo}")
    result = await svc.list_commits(owner=owner, repo=repo, per_page=3)
    data = (result or {}).get("data", result) or {}
    commits = data if isinstance(data, list) else data.get("items", [])
    for c in (commits or [])[:3]:
        sha = c.get("sha", "")[:7]
        msg = (c.get("commit", {}).get("message") or "")[:60]
        print(f"   • {sha} {msg}")
    if not commits:
        print("   ℹ️   No commits found")

    print("\n" + "═" * 60)
    print("✨  Decorator Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
