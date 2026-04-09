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
  export MATIMO_AUTO_APPROVE=true
  uv run python search/search_decorator.py

============================================================================
"""

import asyncio
from pathlib import Path
from dotenv import load_dotenv

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


# ───────────────────────────────────────────────────────────────────────────
# Service class — each method is auto-routed to the matching Matimo tool
# ───────────────────────────────────────────────────────────────────────────

class FileSearcher:
    """High-level file search service using the @tool decorator pattern."""

    @tool("search")
    async def search_pattern(
        self,
        query: str,
        directory: str,
        file_pattern: str = None,
        max_results: int = 10
    ) -> dict:
        """
        Decorator auto-calls matimo.execute('search', {...}).
        
        Args:
            query: Pattern to search for
            directory: Directory to search in
            file_pattern: File pattern filter (e.g., "*.py")
            max_results: Maximum number of results
            
        Returns:
            Search results with matches
        """
        ...

    @tool("search")
    async def search_pythonfiles(self, query: str, directory: str) -> dict:
        """Search for pattern in Python files."""
        ...

    @tool("search")
    async def find_imports(self, module_name: str, directory: str) -> dict:
        """Find import statements in files."""
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
    matimo = await Matimo.init(auto_discover=True)
    set_global_matimo_instance(matimo)
    print("✅  Matimo initialized\n")

    searcher = FileSearcher()
    examples_dir = str(Path(__file__).parent.parent.parent)

    try:
        # Example 1: Search for "async def" in Python files
        print("1. Searching for 'async def' in Python files\n")
        result1 = await searcher.search_pythonfiles("async def", examples_dir)
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
        result2 = await searcher.find_imports("langchain", examples_dir)
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
            result3 = await searcher.search_pattern(
                "def main",
                str(native_dir),
                "*.py",
                max_results=5
            )
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
