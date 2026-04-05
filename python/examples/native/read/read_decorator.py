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
  export MATIMO_AUTO_APPROVE=true
  uv run python read/read_decorator.py

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

class FileReader:
    """High-level file reading service using the @tool decorator pattern."""

    @tool("read")
    async def read_full_file(self, file_path: str) -> dict:
        """
        Decorator auto-calls matimo.execute('read', {...}).
        
        Args:
            file_path: Path to file to read
            
        Returns:
            File content and metadata
        """
        ...

    @tool("read")
    async def read_lines(
        self,
        file_path: str,
        start_line: int,
        end_line: int
    ) -> dict:
        """Read specific lines from file."""
        ...

    @tool("read")
    async def read_first_lines(self, file_path: str, start_line: int = 1, end_line: int = 10) -> dict:
        """Read first N lines of file."""
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
    matimo = await Matimo.init(auto_discover=True)
    set_global_matimo_instance(matimo)
    print("✅  Matimo initialized\n")

    reader = FileReader()
    this_file = str(Path(__file__))

    try:
        # Example 1: Read first 10 lines of this file
        print("1. Reading first 10 lines of read_decorator.py\n")
        result1 = await reader.read_first_lines(this_file)
        if result1.get("success"):
            print(f"File: {result1.get('filePath')}")
            print(f"Lines read: {result1.get('readLines')}")
            content = result1.get("content", "")
            print(f"Content:\n{content[:500]}")
        else:
            print(f"Error: {result1.get('error')}")
        print("---\n")

        # Example 2: Read specific range
        print("2. Reading lines 20-30 of read_decorator.py\n")
        result2 = await reader.read_lines(this_file, start_line=20, end_line=30)
        if result2.get("success"):
            content = result2.get("content", "")
            print(f"Lines {result2.get('startLine')}-{result2.get('endLine')}")
            print(f"Content:\n{content}")
        else:
            print(f"Error: {result2.get('error')}")
        print("---\n")

        # Example 3: Read entire file (small file)
        print("3. Reading .env.example file\n")
        env_example = str(Path(__file__).parent.parent.parent / ".env.example")
        result3 = await reader.read_full_file(env_example)
        if result3.get("success"):
            print(f"File: {result3.get('filePath')}")
            print(f"Total lines: {result3.get('totalLines')}")
            content = result3.get("content", "")
            lines = content.split("\n") if content else []
            print(f"Content ({len(lines)} lines):")
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
