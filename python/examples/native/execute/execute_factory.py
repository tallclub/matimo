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
from typing import Any, Dict
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
        print("1️⃣  Running: ls\n")
        try:
            ls_result: Dict[str, Any] = await matimo.execute(
                "execute",
                {
                    "command": "ls",
                    "timeout": 10000,
                }
            )
            
            print(f"Success: {ls_result.get('success', False)}")
            stdout = ls_result.get("stdout", "")
            
            # Show first 200 chars of output
            if stdout:
                preview = stdout[:200]
                print(f"Output: {preview}")
            else:
                print("Output: (empty)")
                
            # Check for errors
            stderr = ls_result.get("stderr", "")
            if stderr:
                print(f"Errors: {stderr[:100]}")
        except Exception as e:
            print(f"Error in Example 1: {e}")
        print("---\n")

        # Example 2: Get current working directory
        print("2️⃣  Running: pwd\n")
        try:
            pwd_result: Dict[str, Any] = await matimo.execute(
                "execute",
                {
                    "command": "pwd",
                }
            )
            
            print(f"Success: {pwd_result.get('success', False)}")
            stdout = pwd_result.get("stdout", "").strip()
            print(f"Output: {stdout}")
        except Exception as e:
            print(f"Error in Example 2: {e}")
        print("---\n")

        # Example 3: Echo command
        print('3️⃣  Running: echo "Hello from Matimo"\n')
        try:
            echo_result: Dict[str, Any] = await matimo.execute(
                "execute",
                {
                    "command": 'echo "Hello from Matimo"',
                }
            )
            
            print(f"Success: {echo_result.get('success', False)}")
            stdout = echo_result.get("stdout", "").strip()
            print(f"Output: {stdout}")
        except Exception as e:
            print(f"Error in Example 3: {e}")
        print("---\n")

        # Example 4: Get system information
        print("4️⃣  Running: uname -a\n")
        try:
            uname_result: Dict[str, Any] = await matimo.execute(
                "execute",
                {
                    "command": "uname -a",
                }
            )
            
            print(f"Success: {uname_result.get('success', False)}")
            stdout = uname_result.get("stdout", "").strip()
            print(f"Output: {stdout}")
        except Exception as e:
            print(f"Error in Example 4: {e}")
        print("---\n")

        # Example 5: File count in directory
        print("5️⃣  Running: find . -type f | wc -l\n")
        try:
            find_result: Dict[str, Any] = await matimo.execute(
                "execute",
                {
                    "command": "find . -type f | wc -l",
                    "timeout": 15000,
                }
            )
            
            print(f"Success: {find_result.get('success', False)}")
            stdout = find_result.get("stdout", "").strip()
            print(f"File count: {stdout}")
        except Exception as e:
            print(f"Error in Example 5: {e}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error executing command: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
