#!/usr/bin/env python3
"""
============================================================================
EDIT TOOL — DECORATOR PATTERN
============================================================================

PATTERN: @tool Decorator
────────────────────────────────────────────────────────────────────────────
Wraps Matimo tool calls in a class using the @tool("tool-name") decorator.
The decorator intercepts method calls and routes them through Matimo
automatically — the method body is never executed.

Use this pattern when:
  ✅ Building class-based applications or services
  ✅ Encapsulating file editing logic in strongly-typed wrappers
  ✅ Combining multiple tools in a single service layer
  ✅ Object-oriented design

SETUP:
────────────────────────────────────────────────────────────────────────────
  No API key required — edit is a built-in core tool.

USAGE:
────────────────────────────────────────────────────────────────────────────
  uv run python edit/edit_decorator.py        # asks before each edit

  edit declares requires_approval: true. To run unattended, pre-approve it:
  MATIMO_APPROVED_PATTERNS="edit" uv run python edit/edit_decorator.py

NOTE: @tool sends the method's own parameter names as the tool's parameters,
so they must match the tool definition exactly (filePath, operation,
content, startLine, endLine), and only the arguments you pass are sent —
Python defaults are not.

⚠️  WARNING: This tool modifies files on disk. Use with caution!

============================================================================
"""

import asyncio
import sys
import tempfile
from pathlib import Path

from dotenv import load_dotenv

from matimo import ApprovalRequest, Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def approve(request: ApprovalRequest) -> bool:
    """Ask in the terminal before each call that needs approval."""
    params = request.params
    print(
        f"\n🔒 Approval required — {request.tool_name}: {params.get('operation')} "
        f"{params.get('filePath')} (line {params.get('startLine')})"
    )
    if not sys.stdin.isatty():
        print('   ❌ Rejected: no terminal. Pre-approve with MATIMO_APPROVED_PATTERNS="edit"')
        return False
    return input("   Approve? (y/n): ").strip().lower() in ("y", "yes")


# ───────────────────────────────────────────────────────────────────────────
# Service class — each method is auto-routed to the matching Matimo tool
# ───────────────────────────────────────────────────────────────────────────

class FileEditor:
    """High-level file editing service using the @tool decorator pattern."""

    @tool("edit")
    async def replace_lines(
        self,
        filePath: str,  # noqa: N803
        operation: str,
        content: str,
        startLine: int,  # noqa: N803
        endLine: int,  # noqa: N803
    ) -> dict:
        """Decorator auto-calls matimo.execute('edit', {...}) with operation='replace'."""
        ...

    @tool("edit")
    async def insert_before(
        self,
        filePath: str,  # noqa: N803
        operation: str,
        content: str,
        startLine: int,  # noqa: N803
    ) -> dict:
        """Insert content before a line (operation='insert')."""
        ...


# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Edit Tool — Decorator Pattern                    ║")
    print("║     (@tool decorators for automatic execution)       ║")
    print("║     ⚠️  WARNING: This modifies files!                ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Initialize Matimo and register globally for the decorator ────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True, on_approval=approve)
    set_global_matimo_instance(matimo)
    print("✅  Matimo initialized\n")

    editor = FileEditor()

    with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as tmp:
        tmp.write("Original line\nAnother line\nThird line\n")
        tmp_path = Path(tmp.name)
    backup_path = Path(f"{tmp_path}.backup")  # edit writes this before each change
    print(f"Created temporary file {tmp_path.name}\n")

    try:
        # Example 1: Replace line 1
        print("1. Replacing line 1\n")
        result1 = await editor.replace_lines(
            str(tmp_path), "replace", "Updated line from the decorator", 1, 1
        )
        if result1.get("success"):
            print(f"Lines affected: {result1.get('linesAffected')}")
            print(f"Backup created: {result1.get('backupCreated')}")
            print(f"Content now:\n{tmp_path.read_text()}")
        else:
            print(f"Failed: {result1.get('error')}")
        print("---\n")

        # Example 2: Insert a line before line 2
        print("2. Inserting a line before line 2\n")
        result2 = await editor.insert_before(str(tmp_path), "insert", "Inserted line", 2)
        if result2.get("success"):
            print(f"File now has {result2.get('newLineCount')} lines")
            print(f"Content now:\n{tmp_path.read_text()}")
        else:
            print(f"Failed: {result2.get('error')}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error: {error}\n")
    finally:
        for path in (tmp_path, backup_path):
            path.unlink(missing_ok=True)
        print("🧹 Cleaned up temporary files\n")


if __name__ == "__main__":
    asyncio.run(main())
