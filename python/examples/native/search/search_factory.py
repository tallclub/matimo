#!/usr/bin/env python3
"""
============================================================================
SEARCH TOOL — FACTORY PATTERN
============================================================================

PATTERN: SDK Factory Pattern
────────────────────────────────────────────────────────────────────────────
Direct tool execution via Matimo.init() — the simplest way to search files.
Includes interactive approval for sensitive file operations.

Use this pattern when:
  ✅ Building simple scripts or CLI tools
  ✅ Direct file searching without LLM overhead
  ✅ Quick prototyping and testing
  ✅ One-off file searches

SETUP:
────────────────────────────────────────────────────────────────────────────
  The search tool is built-in to Matimo core (no API key required).
  Requires MATIMO_AUTO_APPROVE=true or interactive terminal for approval.

USAGE:
────────────────────────────────────────────────────────────────────────────
  export MATIMO_AUTO_APPROVE=true
  uv run python search/search_factory.py

AVAILABLE SEARCH TOOL PARAMETERS:
────────────────────────────────────────────────────────────────────────────
  query       (str, required)  - Pattern to search for
  directory   (str, required)  - Directory to search in
  filePattern (str, optional)  - File pattern filter (e.g., "*.py")
  maxResults  (int, optional)  - Maximum number of results

============================================================================
"""

import asyncio
from pathlib import Path
from dotenv import load_dotenv

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Search Tool — Factory Pattern                    ║")
    print("║     (Direct execution — simplest approach)           ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Initialize Matimo with autoDiscover to find all tools ─────────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    all_tools = matimo.list_tools()
    print(f"✅  Loaded {len(all_tools)} tools\n")

    # Get the examples directory
    examples_dir = str(Path(__file__).parent.parent.parent)

    try:
        # Example 1: Search for "import asyncio" in Python files
        print("1. Searching for 'import asyncio' in Python files\n")
        result1 = await matimo.execute(
            "search",
            {
                "query": "import asyncio",
                "directory": examples_dir,
                "filePattern": "*.py",
                "maxResults": 5
            }
        )
        
        if result1.get("success"):
            print(f"Total matches: {result1.get('totalMatches', 0)}")
            matches = result1.get("matches", [])
            print(f"Matches found: {len(matches)}")
            if matches:
                for match in matches[:3]:
                    print(f"  - {match.get('filePath')}:{match.get('lineNumber')}")
                    print(f"    {match.get('lineContent', '')[:80]}")
        else:
            print(f"Search failed: {result1.get('error', 'Unknown error')}")
        print("---\n")

        # Example 2: Search for "async def" in Python files
        print("2. Searching for 'async def' in Python files\n")
        result2 = await matimo.execute(
            "search",
            {
                "query": "async def",
                "directory": examples_dir,
                "filePattern": "*.py",
                "maxResults": 10
            }
        )
        
        if result2.get("success"):
            print(f"Total matches: {result2.get('totalMatches', 0)}")
            matches = result2.get("matches", [])
            print(f"Matches found: {len(matches)}")
            if matches:
                for match in matches[:5]:
                    file_path = match.get('filePath', '')
                    line_num = match.get('lineNumber', 0)
                    # Extract just the filename
                    filename = Path(file_path).name if file_path else "Unknown"
                    print(f"  - {filename}:{line_num}")
        else:
            print(f"Search failed: {result2.get('error')}")
        print("---\n")

        # Example 3: Search for "Matimo" in all files
        print("3. Searching for 'Matimo' in all files\n")
        result3 = await matimo.execute(
            "search",
            {
                "query": "Matimo",
                "directory": examples_dir,
                "maxResults": 3
            }
        )
        
        if result3.get("success"):
            print(f"Total matches: {result3.get('totalMatches', 0)}")
            matches = result3.get("matches", [])
            print(f"Matches shown: {len(matches)}")
            if matches:
                for match in matches[:3]:
                    filename = Path(match.get('filePath', '')).name
                    print(f"  - {filename}:{match.get('lineNumber')}")
        else:
            print(f"Search failed: {result3.get('error')}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error searching files: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
