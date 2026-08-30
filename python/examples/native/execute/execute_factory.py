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
  command   (str, required) - Command to execute (e.g., "git --version")
  timeout   (int, optional) - Timeout in milliseconds (default: 30000)

NOTE ON CROSS-PLATFORM COMMANDS:
────────────────────────────────────────────────────────────────────────────
  Unlike the TypeScript SDK's `execute` tool (which runs commands through a
  real shell — cmd.exe on Windows, sh elsewhere), the Python `execute` tool
  spawns the command directly via asyncio.create_subprocess_exec() with no
  shell involved. That means shell built-ins (`ls`, `pwd`, `dir`, `cd`,
  `echo`) and pipes are not available — `command` must name a real,
  installed executable. This example uses `git`, which is a real executable
  on every platform, so the same commands work identically on Windows,
  macOS, and Linux.

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
        # Example 1: Check the installed git version (a real executable on
        # every platform — no shell built-in required)
        print("1️⃣  Running: git --version\n")
        try:
            version_result: Dict[str, Any] = await matimo.execute(
                "execute",
                {
                    "command": "git --version",
                    "timeout": 10000,
                }
            )

            print(f"Success: {version_result.get('success', False)}")
            stdout = version_result.get("stdout", "").strip()
            print(f"Output: {stdout}" if stdout else "Output: (empty)")

            stderr = version_result.get("stderr", "")
            if stderr:
                print(f"Errors: {stderr[:100]}")
        except Exception as e:
            print(f"Error in Example 1: {e}")
        print("---\n")

        # Example 2: Get the repo root (the closest cross-platform equivalent
        # of `pwd` that doesn't require a shell)
        print("2️⃣  Running: git rev-parse --show-toplevel\n")
        try:
            toplevel_result: Dict[str, Any] = await matimo.execute(
                "execute",
                {
                    "command": "git rev-parse --show-toplevel",
                }
            )

            print(f"Success: {toplevel_result.get('success', False)}")
            stdout = toplevel_result.get("stdout", "").strip()
            print(f"Output: {stdout}")
        except Exception as e:
            print(f"Error in Example 2: {e}")
        print("---\n")

        # Example 3: Show the latest commit subject
        print("3️⃣  Running: git log -1 --format=%s\n")
        try:
            log_result: Dict[str, Any] = await matimo.execute(
                "execute",
                {
                    "command": "git log -1 --format=%s",
                }
            )

            print(f"Success: {log_result.get('success', False)}")
            stdout = log_result.get("stdout", "").strip()
            print(f"Output: {stdout}")
        except Exception as e:
            print(f"Error in Example 3: {e}")
        print("---\n")

        # Example 4: List changed files in the working tree
        print("4️⃣  Running: git status --short\n")
        try:
            status_result: Dict[str, Any] = await matimo.execute(
                "execute",
                {
                    "command": "git status --short",
                }
            )

            print(f"Success: {status_result.get('success', False)}")
            stdout = status_result.get("stdout", "").strip()
            print(f"Output: {stdout}" if stdout else "Output: (clean working tree)")
        except Exception as e:
            print(f"Error in Example 4: {e}")
        print("---\n")

        # Example 5: Count total commits (no shell pipe needed — `execute`
        # spawns a single process directly, so `| wc -l` style pipelines
        # aren't supported; git has a dedicated flag for this instead)
        print("5️⃣  Running: git rev-list --count HEAD\n")
        try:
            count_result: Dict[str, Any] = await matimo.execute(
                "execute",
                {
                    "command": "git rev-list --count HEAD",
                    "timeout": 15000,
                }
            )

            print(f"Success: {count_result.get('success', False)}")
            stdout = count_result.get("stdout", "").strip()
            print(f"Commit count: {stdout}")
        except Exception as e:
            print(f"Error in Example 5: {e}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error executing command: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
