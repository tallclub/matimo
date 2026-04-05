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
            command: Shell command to execute
            timeout: Timeout in milliseconds
            
        Returns:
            Execution result with stdout/stderr
        """
        ...

    @tool("execute")
    async def list_directory(self, command: str = "ls") -> dict:
        """List files in current directory."""
        ...

    @tool("execute")
    async def get_pwd(self) -> dict:
        """Get current working directory."""
        ...

    @tool("execute")
    async def echo_message(self, message: str) -> dict:
        """Echo a message."""
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
        print("1. Running command: echo 'Hello from decorator'\n")
        result1 = await executor.run_command('echo "Hello from decorator"')
        print(f"Success: {result1.get('success', False)}")
        print(f"Output: {result1.get('stdout', '').strip()}")
        print("---\n")

        # Example 2: List directory
        print("2. Running command: ls\n")
        result2 = await executor.list_directory()
        print(f"Success: {result2.get('success', False)}")
        output = result2.get("stdout", "")
        print(f"Output (first 200 chars): {output[:200]}")
        print("---\n")

        # Example 3: Get pwd
        print("3. Running command: pwd\n")
        result3 = await executor.get_pwd()
        print(f"Success: {result3.get('success', False)}")
        print(f"Output: {result3.get('stdout', '').strip()}")
        print("---\n")

        # Example 4: Echo message
        print('4. Running command: echo "Decorator pattern works!"\n')
        result4 = await executor.echo_message("Decorator pattern works!")
        print(f"Success: {result4.get('success', False)}")
        print(f"Output: {result4.get('stdout', '').strip()}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
