#!/usr/bin/env python3
"""
============================================================================
SEARCH TOOL — DECORATOR PATTERN
============================================================================

PATTERN: @tool Decorator
────────────────────────────────────────────────────────────────────────────
Wraps Matimo tool calls in a class using the @tool("tool-name") decorator.
The decorator intercepts method calls and routes them through Matimo
automatically — the method body is never executed.

Use this pattern when:
  ✅ Building class-based applications or services
  ✅ Encapsulating search logic in strongly-typed wrappers
  ✅ Combining multiple tools in a single service layer
  ✅ Object-oriented design

SETUP:
────────────────────────────────────────────────────────────────────────────
  No API key required — search is a built-in core tool.

USAGE:
────────────────────────────────────────────────────────────────────────────
  uv run python search/search_decorator.py        # asks before each search

  search declares requires_approval: true. To run unattended, pre-approve it:
  MATIMO_APPROVED_PATTERNS="search" uv run python search/search_decorator.py

NOTE: @tool sends the method's own parameter names as the tool's parameters,
so they must match the tool definition exactly (query, directory,
filePattern, maxResults), and only the arguments you pass are sent —
Python defaults are not.

============================================================================
"""

import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

from matimo import ApprovalRequest, Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


# ───────────────────────────────────────────────────────────────────────────
# Service class — each method is auto-routed to the matching Matimo tool
# ───────────────────────────────────────────────────────────────────────────

async def approve(request: ApprovalRequest) -> bool:
    """Ask in the terminal before each call that needs approval."""
    params = request.params
    print(f"\n🔒 Approval required — {request.tool_name}: {params.get('query')!r} in {params.get('directory')}")
    if not sys.stdin.isatty():
        print('   ❌ Rejected: no terminal. Pre-approve with MATIMO_APPROVED_PATTERNS="search"')
        return False
    return input("   Approve? (y/n): ").strip().lower() in ("y", "yes")


class FileSearcher:
    """High-level file search service using the @tool decorator pattern."""

    @tool("search")
    async def search_files(
        self,
        query: str,
        directory: str,
        filePattern: str,  # noqa: N803
        maxResults: int,  # noqa: N803
    ) -> dict:
        """
        Decorator auto-calls matimo.execute('search', {...}).

        Args:
            query: Text to search for
            directory: Directory to search in
            filePattern: Glob filter such as "*.py"
            maxResults: Maximum number of matches to return
        """
        ...

    @tool("search")
    async def search_everywhere(self, query: str, directory: str) -> dict:
        """Search every file under a directory."""
        ...


# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Search Tool — Decorator Pattern                  ║")
    print("║     (@tool decorators for automatic execution)       ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Initialize Matimo and register globally for the decorator ────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True, on_approval=approve)
    set_global_matimo_instance(matimo)
    print("✅  Matimo initialized\n")

    searcher = FileSearcher()
    examples_dir = str(Path(__file__).parent.parent.parent)

    try:
        # Example 1: Search for "async def" in Python files
        print("1. Searching for 'async def' in Python files\n")
        result1 = await searcher.search_files("async def", examples_dir, "*.py", 20)
        if result1.get("success"):
            print(f"Total matches: {result1.get('totalMatches', 0)}")
            matches = result1.get("matches", [])
            print(f"Showing: {len(matches)} matches")
            for match in matches[:3]:
                filename = Path(match.get('filePath', '')).name
                print(f"  - {filename}:{match.get('lineNumber')}")
                print(f"    {match.get('lineContent', '')[:70]}")
        else:
            print(f"Error: {result1.get('error')}")
        print("---\n")

        # Example 2: Search for imports
        print("2. Searching for imports of 'langchain'\n")
        result2 = await searcher.search_everywhere("from langchain", examples_dir)
        if result2.get("success"):
            print(f"Total matches: {result2.get('totalMatches', 0)}")
            matches = result2.get("matches", [])
            print(f"Matches found: {len(matches)}")
            for match in matches[:3]:
                filename = Path(match.get('filePath', '')).name
                print(f"  - {filename}:{match.get('lineNumber')}")
        else:
            print(f"Error: {result2.get('error')}")
        print("---\n")

        # Example 3: Search with pattern filter
        print("3. Searching for 'def main' in native/ Python files\n")
        native_dir = Path(examples_dir) / "native"
        if native_dir.exists():
            result3 = await searcher.search_files("def main", str(native_dir), "*.py", maxResults=5)
            if result3.get("success"):
                print(f"Total matches: {result3.get('totalMatches', 0)}")
                matches = result3.get("matches", [])
                print(f"Matches shown: {len(matches)}")
                for match in matches[:3]:
                    filename = Path(match.get('filePath', '')).name
                    print(f"  - {filename}:{match.get('lineNumber')}")
            else:
                print(f"Error: {result3.get('error')}")
        else:
            print(f"Native directory not found: {native_dir}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
