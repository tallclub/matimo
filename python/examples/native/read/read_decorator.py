#!/usr/bin/env python3
"""
============================================================================
READ TOOL — DECORATOR PATTERN
============================================================================

PATTERN: @tool Decorator
────────────────────────────────────────────────────────────────────────────
Wraps Matimo tool calls in a class using the @tool("tool-name") decorator.
The decorator intercepts method calls and routes them through Matimo
automatically — the method body is never executed.

Use this pattern when:
  ✅ Building class-based applications or services
  ✅ Encapsulating file reading logic in strongly-typed wrappers
  ✅ Combining multiple tools in a single service layer
  ✅ Object-oriented design

SETUP:
────────────────────────────────────────────────────────────────────────────
  No API key required — read is a built-in core tool.

USAGE:
────────────────────────────────────────────────────────────────────────────
  uv run python read/read_decorator.py        # asks before each read

  read declares requires_approval: true. To run unattended, pre-approve it:
  MATIMO_APPROVED_PATTERNS="read" uv run python read/read_decorator.py

NOTE: @tool sends the method's own parameter names as the tool's parameters,
so they must match the tool definition exactly (filePath, startLine, endLine),
and only the arguments you pass are sent — Python defaults are not.

============================================================================
"""

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

from matimo import ApprovalRequest, Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def approve(request: ApprovalRequest) -> bool:
    """Ask in the terminal before each call that needs approval."""
    print(f"\n🔒 Approval required — {request.tool_name}: {request.params.get('filePath')}")
    if not sys.stdin.isatty():
        print('   ❌ Rejected: no terminal. Pre-approve with MATIMO_APPROVED_PATTERNS="read"')
        return False
    return input("   Approve? (y/n): ").strip().lower() in ("y", "yes")


# ───────────────────────────────────────────────────────────────────────────
# Service class — each method is auto-routed to the matching Matimo tool
# ───────────────────────────────────────────────────────────────────────────

class FileReader:
    """High-level file reading service using the @tool decorator pattern."""

    @tool("read")
    async def read_full_file(self, filePath: str) -> dict:  # noqa: N803
        """Decorator auto-calls matimo.execute('read', {'filePath': ...})."""
        ...

    @tool("read")
    async def read_lines(self, filePath: str, startLine: int, endLine: int) -> dict:  # noqa: N803
        """Read an inclusive line range."""
        ...


# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Read Tool — Decorator Pattern                    ║")
    print("║     (@tool decorators for automatic execution)       ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Initialize Matimo and register globally for the decorator ────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True, on_approval=approve)
    set_global_matimo_instance(matimo)
    print("✅  Matimo initialized\n")

    reader = FileReader()
    this_file = str(Path(__file__))

    try:
        # Example 1: Read the first 10 lines of this file
        print("1. Reading lines 1-10 of read_decorator.py\n")
        result1 = await reader.read_lines(this_file, 1, 10)
        if result1.get("success"):
            print(f"File: {result1.get('filePath')}")
            print(f"Lines read: {result1.get('readLines')} of {result1.get('lineCount')}")
            print(f"Content:\n{result1.get('content', '')[:500]}")
        else:
            print(f"Error: {result1.get('error')}")
        print("---\n")

        # Example 2: Read a specific range
        print("2. Reading lines 20-30 of read_decorator.py\n")
        result2 = await reader.read_lines(this_file, startLine=20, endLine=30)
        if result2.get("success"):
            print(f"Lines read: {result2.get('readLines')}")
            print(f"Content:\n{result2.get('content', '')}")
        else:
            print(f"Error: {result2.get('error')}")
        print("---\n")

        # Example 3: Read an entire (small) file
        print("3. Reading .env.example\n")
        env_example = str(Path(__file__).parent.parent.parent / ".env.example")
        result3 = await reader.read_full_file(env_example)
        if result3.get("success"):
            print(f"File: {result3.get('filePath')}")
            print(f"Total lines: {result3.get('lineCount')}")
            lines = (result3.get("content") or "").split("\n")
            for line in lines[:5]:
                print(f"  {line}")
            if len(lines) > 5:
                print(f"  ... ({len(lines) - 5} more lines)")
        else:
            print(f"Error: {result3.get('error')}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
