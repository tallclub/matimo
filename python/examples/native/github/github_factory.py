#!/usr/bin/env python3
"""
============================================================================
GITHUB TOOLS — FACTORY PATTERN
============================================================================

PATTERN: SDK Factory Pattern
────────────────────────────────────────────────────────────────────────────
Direct tool execution via Matimo.init() — no LLM, deterministic calls.

AVAILABLE GITHUB TOOLS:
────────────────────────────────────────────────────────────────────────────
  SEARCH:     github-search-repositories, github-search-code,
              github-search-issues, github-search-users
  REPOS:      github-list-repositories, github-get-repository,
              github-create-repository, github-delete-repository
  ISSUES:     github-list-issues, github-create-issue,
              github-get-issue, github-update-issue
  PULL REQ:   github-list-pull-requests, github-create-pull-request,
              github-merge-pull-request
  COMMITS:    github-list-commits
  RELEASES:   github-list-releases, github-create-release

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set GITHUB_TOKEN in .env (https://github.com/settings/tokens)
  Scopes: repo, read:org  (public repos need no scopes)

USAGE:
────────────────────────────────────────────────────────────────────────────
  make github-factory
  # or
  uv run python github/github_factory.py --owner matimo-ai --repo matimo

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_github import get_tools_path

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def run() -> None:
    owner = "matimo-ai"
    repo = "matimo"
    for arg in sys.argv[1:]:
        if arg.startswith("--owner="):
            owner = arg.split("=", 1)[1]
        elif arg.startswith("--repo="):
            repo = arg.split("=", 1)[1]

    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     GitHub Tools — Factory Pattern                     ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("❌  GITHUB_TOKEN not set in .env")
        sys.exit(1)
    print(f"🔑  Token: {token[:10]}…\n")

    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(get_tools_path())
    gh_tools = [t for t in matimo.list_tools() if t.name.startswith("github")]
    print(f"✅  Loaded {len(gh_tools)} GitHub tools\n")
    print("═" * 60)

    # ── Example 1: Search repositories ───────────────────────────────────────
    print("\n1️⃣   Searching repositories: 'matimo language:typescript'")
    result = await matimo.execute(
        "github-search-repositories",
        {"query": "matimo language:typescript", "sort": "stars", "per_page": 5},
    )
    data = (result or {}).get("data", result) or {}
    items = data.get("items", [])
    if items:
        print(f"   ✅  {data.get('total_count', len(items))} result(s):")
        for r in items[:3]:
            print(f"      • {r['full_name']} ⭐ {r.get('stargazers_count', 0)}")
    else:
        print(f"   ℹ️   No results or error: {data}")

    # ── Example 2: List issues ────────────────────────────────────────────────
    print(f"\n2️⃣   Listing open issues in {owner}/{repo}")
    result = await matimo.execute(
        "github-list-issues",
        {"owner": owner, "repo": repo, "state": "open", "per_page": 5},
    )
    data = (result or {}).get("data", result) or {}
    issues = data if isinstance(data, list) else data.get("items", [])
    if issues:
        print(f"   ✅  {len(issues)} open issue(s):")
        for issue in issues[:3]:
            print(f"      • #{issue['number']} {issue['title'][:60]}")
    else:
        print(f"   ℹ️   No issues found")

    # ── Example 3: List repositories in an org/user ───────────────────────────
    print(f"\n3️⃣   Listing repositories for '{owner}'")
    result = await matimo.execute(
        "github-list-repositories",
        {"owner": owner, "type": "public", "per_page": 5},
    )
    data = (result or {}).get("data", result) or {}
    repos = data if isinstance(data, list) else data.get("items", [])
    if repos:
        print(f"   ✅  {len(repos)} repo(s):")
        for r in repos[:3]:
            print(f"      • {r.get('name')} — {r.get('description', '')[:50]}")
    else:
        print(f"   ℹ️   No repos found")

    print("\n" + "═" * 60)
    print("✨  Factory Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
