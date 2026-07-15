#!/usr/bin/env python3
"""
============================================================================
CONVERT_TO_FILE TOOL — DECORATOR PATTERN
============================================================================

PATTERN: @tool Decorator
────────────────────────────────────────────────────────────────────────────
Wraps Matimo tool calls in a class using the @tool("tool-name") decorator.
The decorator intercepts method calls and routes them through Matimo
automatically — the method body is never executed.

Use this pattern when:
  ✅ Building class-based applications or services
  ✅ Encapsulating content-conversion logic in strongly-typed wrappers
  ✅ Combining multiple tools in a single service layer
  ✅ Object-oriented design

SETUP:
────────────────────────────────────────────────────────────────────────────
  No API key required — convert_to_file is a built-in core tool.

USAGE:
────────────────────────────────────────────────────────────────────────────
  export MATIMO_AUTO_APPROVE=true
  uv run python native/convert_to_file/convert_to_file_decorator.py

============================================================================
"""

import asyncio
import base64
from pathlib import Path

from dotenv import load_dotenv

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


# ───────────────────────────────────────────────────────────────────────────
# Service class — each method is auto-routed to the matching Matimo tool
# ───────────────────────────────────────────────────────────────────────────

class FileConverter:
    """High-level content-conversion service using the @tool decorator pattern."""

    @tool("convert_to_file")
    async def convert(self, content: str, source_format: str, target_format: str) -> dict:
        """
        Decorator auto-calls matimo.execute('convert_to_file', {...}).

        Args:
            content: The source content to convert
            source_format: 'json' | 'csv' | 'markdown' | 'text'
            target_format: 'pdf' | 'docx' | 'csv' | 'json' | 'txt'

        Returns:
            output_path / file_base64 / mime_type / size_bytes
        """
        ...


# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Convert To File Tool — Decorator Pattern            ║")
    print("║     (@tool decorators for automatic execution)          ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    set_global_matimo_instance(matimo)
    print("✅  Matimo initialized\n")

    converter = FileConverter()

    try:
        print("1. Converting CSV to JSON\n")
        csv_content = "name,role\nAda,Mathematician\nAlan,Computer Scientist\n"
        result = await converter.convert(csv_content, "csv", "json")
        if result.get("success"):
            decoded = base64.b64decode(result["file_base64"]).decode("utf-8")
            print(f"✅  MIME type: {result.get('mime_type')}")
            print(f"📝  JSON output:\n{decoded}")
        else:
            print(f"Error: {result.get('error')}")
        print("---\n")

        print("✅  Decorator example completed successfully")
    except Exception as error:
        print(f"❌  Error: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
