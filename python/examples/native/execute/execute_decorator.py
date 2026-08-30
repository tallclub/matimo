#!/usr/bin/env python3
"""
============================================================================
EXECUTE TOOL — DECORATOR PATTERN
============================================================================

PATTERN: @tool Decorator
────────────────────────────────────────────────────────────────────────────
Wraps Matimo tool calls in a class using the @tool("tool-name") decorator.
The decorator intercepts method calls and routes them through Matimo
automatically — the method body is never executed.

Use this pattern when:
  ✅ Building class-based applications or services
  ✅ Encapsulating command logic in strongly-typed wrappers
  ✅ Combining multiple tools in a single service layer
  ✅ Object-oriented design

SETUP:
────────────────────────────────────────────────────────────────────────────
  No API key required — execute is a built-in core tool.

NOTE ON CROSS-PLATFORM COMMANDS:
────────────────────────────────────────────────────────────────────────────
  Python's `execute` tool spawns commands directly (asyncio.create_subprocess_exec,
  no shell) — shell built-ins (`ls`, `pwd`, `echo`) aren't available, so this
  example uses `git`, a real installed executable on every platform. Also note
  that @tool maps positional call-site arguments to a method's OWN declared
  parameter names (see _build_params() in matimo/decorators), not to any
  default value on the method signature — a method called with no arguments
  sends no params at all, regardless of a declared Python default.

USAGE:
────────────────────────────────────────────────────────────────────────────
  uv run python execute/execute_decorator.py

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

class CommandExecutor:
    """High-level command execution service using the @tool decorator pattern."""

    @tool("execute")
    async def run_command(self, command: str, timeout: int = None) -> dict:
        """
        Decorator auto-calls matimo.execute('execute', {...}).

        Args:
            command: Command to execute (a real executable — no shell)
            timeout: Timeout in milliseconds

        Returns:
            Execution result with stdout/stderr
        """
        ...

    @tool("execute")
    async def list_directory(self, command: str) -> dict:
        """Run a directory-listing-equivalent command (caller supplies it —
        see the NOTE above: a Python default value here is never applied,
        since @tool only forwards arguments actually passed at the call site)."""
        ...

    @tool("execute")
    async def get_pwd(self, command: str) -> dict:
        """Run a pwd-equivalent command (caller supplies it; same caveat as above)."""
        ...

    @tool("execute")
    async def echo_message(self, command: str) -> dict:
        """Run the given command directly (e.g. 'git --version')."""
        ...


# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Execute Tool — Decorator Pattern                  ║")
    print("║     (@tool decorators for automatic execution)        ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Initialize Matimo and register globally for the decorator ────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    set_global_matimo_instance(matimo)
    print("✅  Matimo initialized\n")

    executor = CommandExecutor()

    try:
        # Example 1: Run command through decorated method
        print("1. Running command: git --version\n")
        result1 = await executor.run_command("git --version")
        print(f"Success: {result1.get('success', False)}")
        print(f"Output: {result1.get('stdout', '').strip()}")
        print("---\n")

        # Example 2: List directory (git ls-files is the closest no-shell
        # equivalent to `ls` that works identically on every platform)
        print("2. Running command: git ls-files\n")
        result2 = await executor.list_directory("git ls-files")
        print(f"Success: {result2.get('success', False)}")
        output = result2.get("stdout", "")
        print(f"Output (first 200 chars): {output[:200]}")
        print("---\n")

        # Example 3: Get repo root (closest no-shell equivalent to `pwd`)
        print("3. Running command: git rev-parse --show-toplevel\n")
        result3 = await executor.get_pwd("git rev-parse --show-toplevel")
        print(f"Success: {result3.get('success', False)}")
        print(f"Output: {result3.get('stdout', '').strip()}")
        print("---\n")

        # Example 4: Run an arbitrary command
        print("4. Running command: git log -1 --format=%s\n")
        result4 = await executor.echo_message("git log -1 --format=%s")
        print(f"Success: {result4.get('success', False)}")
        print(f"Output: {result4.get('stdout', '').strip()}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
