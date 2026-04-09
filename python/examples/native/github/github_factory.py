#!/usr/bin/env python3
"""
GitHub Factory Pattern Example
================================

Demonstrates the simplest way to use Matimo tools: direct execution via matimo.execute().
This pattern is best for:
  - Simple scripts and CLIs
  - Direct tool invocation
  - Learning Matimo basics

Setup:
------
1. Get a GitHub Personal Access Token (PAT):
   Visit: https://github.com/settings/tokens
   Create token with: repo, read:org scopes (for public repo access)

2. Set environment variable:
   export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"

3. Run this example:
   make github-factory

Available GitHub Tools:
-----------------------
SEARCH:
  - github-search-repositories: Find repositories by query (language, stars, etc.)
  - github-search-code: Search code across repositories
  - github-search-issues: Find issues and pull requests
  - github-search-users: Find GitHub users

REPOSITORIES:
  - github-list-repositories: List repos in an org/user
  - github-get-repository: Get detailed repo info
  - github-create-repository: Create new repo (write access required)
  - github-delete-repository: Delete a repo (write access required)

ISSUES:
  - github-list-issues: List issues in a repo
  - github-create-issue: Create issue (write access required)
  - github-get-issue: Get issue details
  - github-update-issue: Update issue (write access required)

PULL REQUESTS:
  - github-list-pull-requests: List PRs in a repo
  - github-create-pull-request: Create PR (write access required)
  - github-merge-pull-request: Merge PR (write access required)

COMMITS:
  - github-list-commits: List commits in repo

COLLABORATORS:
  - github-list-collaborators: List repo collaborators
  - github-add-collaborator: Add collaborator (admin access required)

RELEASES:
  - github-list-releases: List releases
  - github-create-release: Create release (write access required)

CODE SCANNING:
  - github-list-code-alerts: List security alerts (Advanced Security)
  - github-update-code-alert: Update alert status (Advanced Security)
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

from dotenv import load_dotenv

try:
    from matimo_github import get_tools_path
    from matimo import Matimo
except ImportError:
    from matimo import Matimo
    get_tools_path = None

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def main() -> None:
    """Run GitHub factory pattern examples."""
    print("\n╔════════════════════════════════════════════════════════════╗")
    print("║  🐙 GitHub Factory Pattern Example                      ║")
    print("║  Direct tool execution using matimo.execute()           ║")
    print("╚════════════════════════════════════════════════════════════╝\n")

    # Check for GitHub token
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("\n❌ Error: GITHUB_TOKEN environment variable not set")
        print("\n📖 Setup Instructions:")
        print("   1. Create a GitHub Personal Access Token:")
        print("      https://github.com/settings/tokens")
        print("   2. Set the environment variable:")
        print('      export GITHUB_TOKEN="ghp_xxxx..."')
        print("   3. Run this example again:")
        print("      make github-factory\n")
        sys.exit(1)

    try:
        # Initialize Matimo with auto-discovery
        print("🚀  Initialising Matimo…")
        matimo = await Matimo.init(get_tools_path() if get_tools_path else None, auto_discover=True)

        # Get all GitHub tools (filter by prefix)
        all_tools = matimo.list_tools()
        github_tools = [t for t in all_tools if t.name.startswith("github-")]
        print(f"📚 Loaded {len(github_tools)} GitHub tools from Matimo\n")

        # Example 1: Search repositories
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("Example 1: Search TypeScript Repositories")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("📦 Searching: language:typescript fork:false stars:>100\n")
        try:
            search_results = await matimo.execute(
                "github-search-repositories",
                {"query": "language:typescript fork:false stars:>100"}
            )
            search_data = (search_results or {}).get("data", search_results) or {}
            print(f"✅ Found {search_data.get('total_count', 0)} TypeScript repositories\n")
            items = search_data.get("items", [])
            if items:
                print("Top 3 Results:")
                for idx, repo in enumerate(items[:3], 1):
                    print(f"  {idx}. {repo.get('full_name')} ⭐ {repo.get('stargazers_count', 0)}")
                    print(f"     {repo.get('description') or 'No description'}\n")
        except Exception as error:
            print(f"❌ Search failed: {str(error)}")

        # Example 2: Get repository details
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("Example 2: Get Repository Details")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🔎 Getting details for: kubernetes/kubernetes\n")
        try:
            repo = await matimo.execute(
                "github-get-repository",
                {"owner": "kubernetes", "repo": "kubernetes"}
            )
            repo_data = (repo or {}).get("data", repo) or {}
            if repo_data and repo_data.get("full_name"):
                print(f"✅ Repository: {repo_data.get('full_name')}")
                print(f"   Description: {repo_data.get('description')}")
                print(f"   Stars: ⭐ {repo_data.get('stargazers_count', 0):,}")
                print(f"   Language: {repo_data.get('language') or 'Mixed'}")
                print(f"   Open Issues: {repo_data.get('open_issues_count', 0)}")
                topics = repo_data.get("topics", [])
                if topics:
                    print(f"   Topics: {', '.join(topics)}")
                print()
            else:
                print(f"❌ Get repository returned unexpected format: {str(repo_data)[:100]}")
        except Exception as error:
            print(f"❌ Get repository failed: {str(error)}")

        # Example 3: List repositories
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("Example 3: List Organization Repositories")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("📋 Listing top 5 Node.js repositories\n")
        try:
            repos = await matimo.execute(
                "github-list-repositories",
                {"owner": "nodejs", "type": "public", "per_page": 5}
            )
            repos_data = (repos or {}).get("data", repos) or {}
            repo_list = repos_data if isinstance(repos_data, list) else repos_data.get("repositories", [])
            if repo_list:
                print(f"✅ Found {len(repo_list)} repositories from nodejs org:\n")
                for idx, repo in enumerate(repo_list, 1):
                    print(f"  {idx}. {repo.get('name')} ⭐ {repo.get('stargazers_count', 0)}")
                    print(f"     Full Name: {repo.get('full_name')}")
                    print(f"     Language: {repo.get('language') or 'Mixed'}")
                    print()
            else:
                print("⚠️  No repositories found or unexpected response format")
        except Exception as error:
            print(f"❌ List repositories failed: {str(error)}")

        # Example 4: List pull requests
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("Example 4: List Open Pull Requests")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🔀 Listing PRs from: cli/cli\n")
        try:
            prs = await matimo.execute(
                "github-list-pull-requests",
                {"owner": "cli", "repo": "cli", "state": "open", "per_page": 5}
            )
            prs_data = (prs or {}).get("data", prs) or {}
            pr_list = prs_data if isinstance(prs_data, list) else prs_data.get("pull_requests", [])
            if pr_list:
                print(f"✅ Found {len(pr_list)} open pull requests:\n")
                for idx, pr in enumerate(pr_list, 1):
                    created_date = datetime.fromisoformat(pr.get("created_at", "").replace("Z", "+00:00")).strftime("%Y-%m-%d")
                    print(f"  {idx}. #{pr.get('number')}: {pr.get('title')}")
                    print(f"     Status: {pr.get('state')} | Created: {created_date}")
                    print()
            else:
                print("⚠️  No open pull requests found or unexpected response format")
        except Exception as error:
            print(f"❌ List pull requests failed: {str(error)}")

        # Example 5: List commits
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("Example 5: List Recent Commits")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("📝 Listing commits from: golang/go\n")
        try:
            commits = await matimo.execute(
                "github-list-commits",
                {"owner": "golang", "repo": "go", "per_page": 5}
            )
            commits_data = (commits or {}).get("data", commits) or {}
            commit_list = commits_data if isinstance(commits_data, list) else commits_data.get("commits", [])
            if commit_list:
                print(f"✅ Found {len(commit_list)} recent commits:\n")
                for idx, commit in enumerate(commit_list[:3], 1):
                    commit_obj = commit.get("commit", {})
                    msg = commit_obj.get("message", "").split("\n")[0]
                    author = commit_obj.get("author", {})
                    print(f"  {idx}. {author.get('name', 'Unknown')}")
                    print(f"     {msg}")
                    print(f"     SHA: {commit.get('sha', '')[:7]}")
                    print()
            else:
                print("⚠️  No commits found or unexpected response format")
        except Exception as error:
            print(f"❌ List commits failed: {str(error)}")

        # Example 6: List releases
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("Example 6: List Releases")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🎉 Listing releases from: nodejs/node\n")
        try:
            releases = await matimo.execute(
                "github-list-releases",
                {"owner": "nodejs", "repo": "node", "per_page": 5}
            )
            releases_data = (releases or {}).get("data", releases) or {}
            release_list = releases_data if isinstance(releases_data, list) else releases_data.get("releases", [])
            if release_list:
                print(f"✅ Found {len(release_list)} releases:\n")
                for idx, release in enumerate(release_list[:3], 1):
                    pub_date = datetime.fromisoformat(
                        (release.get("published_at") or "").replace("Z", "+00:00")
                    ).strftime("%Y-%m-%d") if release.get("published_at") else "N/A"
                    print(f"  {idx}. {release.get('tag_name')} \"{release.get('name')}\"")
                    print(f"     Published: {pub_date}")
                    print()
            else:
                print("⚠️  No releases found or unexpected response format")
        except Exception as error:
            print(f"❌ List releases failed: {str(error)}")

        # Example 7: Search code
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("Example 7: Search Code")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🔍 Searching for: \"async function\" in React\n")
        try:
            code_results = await matimo.execute(
                "github-search-code",
                {"query": "language:typescript \"async function\" repo:facebook/react"}
            )
            code_data = (code_results or {}).get("data", code_results) or {}
            print(f"✅ Found {code_data.get('total_count', 0)} code matches in React\n")
        except Exception as error:
            print(f"❌ Search code failed: {str(error)}")

        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("✅ All factory pattern examples completed!")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    except Exception as error:
        print(f"\n❌ Fatal Error: {str(error)}")
        if hasattr(error, "details"):
            import json
            print(f"Details: {json.dumps(error.details, indent=2)}")
        sys.exit(1)


def run() -> None:
    """Run the async main function."""
    asyncio.run(main())


if __name__ == "__main__":
    run()
