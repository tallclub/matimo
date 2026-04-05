#!/usr/bin/env python3
"""
============================================================================
EXECUTE TOOL — FACTORY PATTERN
============================================================================

PATTERN: SDK Factory Pattern
────────────────────────────────────────────────────────────────────────────
Direct tool execution via Matimo.init() — the simplest way to call tools.
No LLM involved: you decide which command to run and capture output.

Use this pattern when:
  ✅ Building simple scripts or CLI tools
  ✅ Direct command execution without LLM overhead
  ✅ Quick prototyping and testing
  ✅ One-off command execution

SETUP:
────────────────────────────────────────────────────────────────────────────
  The execute tool is built-in to Matimo core (no API key required).
  Just initialize Matimo with autoDiscover=True.

USAGE:
────────────────────────────────────────────────────────────────────────────
  uv run python execute/execute_factory.py

AVAILABLE EXECUTE TOOL PARAMETERS:
────────────────────────────────────────────────────────────────────────────
  command   (str, required) - Shell command to execute (e.g., "ls", "pwd")
  timeout   (int, optional) - Timeout in milliseconds (default: 30000)

============================================================================
"""

import asyncio
from pathlib import Path
from dotenv import load_dotenv

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Execute Tool — Factory Pattern                    ║")
    print("║     (Direct execution — simplest approach)            ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Initialize Matimo with autoDiscover to find all tools ─────────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    all_tools = matimo.list_tools()
    print(f"✅  Loaded {len(all_tools)} tools\n")

    try:
        # Example 1: List files in current directory
        print("1. Running: ls\n")
        ls_result = await matimo.execute(
            "execute",
            {"command": "ls", "timeout": 10000}
        )
        print(f"Success: {ls_result.get('success', False)}")
        output = ls_result.get("stdout", "")
        print(f"Output (first 200 chars): {output[:200]}")
        print("---\n")

        # Example 2: Get current working directory
        print("2. Running: pwd\n")
        pwd_result = await matimo.execute(
            "execute",
            {"command": "pwd"}
        )
        print(f"Success: {pwd_result.get('success', False)}")
        print(f"Output: {pwd_result.get('stdout', '').strip()}")
        print("---\n")

        # Example 3: Echo command
        print("3. Running: echo 'Hello from Matimo'\n")
        echo_result = await matimo.execute(
            "execute",
            {"command": 'echo "Hello from Matimo"'}
        )
        print(f"Success: {echo_result.get('success', False)}")
        print(f"Output: {echo_result.get('stdout', '').strip()}")
        print("---\n")

        # Example 4: Get system information
        print("4. Running: uname -a\n")
        uname_result = await matimo.execute(
            "execute",
            {"command": "uname -a"}
        )
        print(f"Success: {uname_result.get('success', False)}")
        print(f"Output: {uname_result.get('stdout', '').strip()}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error executing command: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
