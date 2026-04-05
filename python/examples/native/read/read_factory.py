#!/usr/bin/env python3
"""
============================================================================
READ TOOL — FACTORY PATTERN
============================================================================

PATTERN: SDK Factory Pattern
────────────────────────────────────────────────────────────────────────────
Direct tool execution via Matimo.init() — the simplest way to read files.
Includes interactive approval for sensitive file operations.

Use this pattern when:
  ✅ Building simple scripts or CLI tools
  ✅ Direct file reading without LLM overhead
  ✅ Quick prototyping and testing
  ✅ One-off file reads

SETUP:
────────────────────────────────────────────────────────────────────────────
  The read tool is built-in to Matimo core (no API key required).
  Requires MATIMO_AUTO_APPROVE=true or interactive terminal for approval.

USAGE:
────────────────────────────────────────────────────────────────────────────
  export MATIMO_AUTO_APPROVE=true
  uv run python read/read_factory.py

AVAILABLE READ TOOL PARAMETERS:
────────────────────────────────────────────────────────────────────────────
  filePath  (str, required)  - Path to file to read
  startLine (int, optional)  - Start line number (1-indexed)
  endLine   (int, optional)  - End line number (1-indexed)

============================================================================
"""

import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Read Tool — Factory Pattern                       ║")
    print("║     (Direct execution — simplest approach)            ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Initialize Matimo with autoDiscover to find all tools ─────────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    all_tools = matimo.list_tools()
    print(f"✅  Loaded {len(all_tools)} tools\n")

    try:
        # Example 1: Read this example file (lines 1-20)
        print("1. Reading read_factory.py (lines 1-20)\n")
        this_file = Path(__file__)
        result1 = await matimo.execute(
            "read",
            {
                "filePath": str(this_file),
                "startLine": 1,
                "endLine": 20
            }
        )
        
        if result1.get("success"):
            print(f"File: {result1.get('filePath')}")
            print(f"Lines read: {result1.get('readLines', 0)}")
            content = result1.get("content", "")
            print(f"Content (first 300 chars):\n{content[:300]}")
        else:
            print(f"Access denied: {result1.get('error', 'Unknown error')}")
        print("---\n")

        # Example 2: Read a parent file (parent directory file)
        print("2. Reading __init__.py from parent package\n")
        parent_file = this_file.parent.parent / "__init__.py"
        if parent_file.exists():
            result2 = await matimo.execute(
                "read",
                {"filePath": str(parent_file)}
            )
            if result2.get("success"):
                content = result2.get("content", "")
                print(f"File: {result2.get('filePath')}")
                print(f"Total lines: {result2.get('totalLines', 0)}")
                print(f"Content (first 200 chars):\n{content[:200]}")
            else:
                print(f"Could not read: {result2.get('error')}")
        else:
            print(f"File not found: {parent_file}")
        print("---\n")

        # Example 3: Read entire small file
        print("3. Reading .env.example file\n")
        env_example = Path(__file__).parent.parent.parent / ".env.example"
        if env_example.exists():
            result3 = await matimo.execute(
                "read",
                {"filePath": str(env_example)}
            )
            if result3.get("success"):
                print(f"File: {result3.get('filePath')}")
                print(f"Total lines: {result3.get('totalLines', 0)}")
                content = result3.get("content", "")
                lines = content.split("\n") if content else []
                print(f"Content ({len(lines)} lines):")
                for line in lines[:10]:
                    print(f"  {line}")
                if len(lines) > 10:
                    print(f"  ... ({len(lines) - 10} more lines)")
            else:
                print(f"Could not read: {result3.get('error')}")
        else:
            print(f"File not found: {env_example}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error reading file: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
