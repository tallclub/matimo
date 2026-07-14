#!/usr/bin/env python3
"""
============================================================================
EXTRACT_FROM_FILE TOOL — DECORATOR PATTERN
============================================================================

PATTERN: @tool Decorator
────────────────────────────────────────────────────────────────────────────
Wraps Matimo tool calls in a class using the @tool("tool-name") decorator.
The decorator intercepts method calls and routes them through Matimo
automatically — the method body is never executed.

Use this pattern when:
  ✅ Building class-based applications or services
  ✅ Encapsulating file/URL text-extraction logic in strongly-typed wrappers
  ✅ Combining multiple tools in a single service layer
  ✅ Object-oriented design

SETUP:
────────────────────────────────────────────────────────────────────────────
  No API key required — extract_from_file is a built-in core tool.

USAGE:
────────────────────────────────────────────────────────────────────────────
  export MATIMO_AUTO_APPROVE=true
  uv run python native/extract_from_file/extract_from_file_decorator.py

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

class FileExtractor:
    """High-level file-extraction service using the @tool decorator pattern."""

    @tool("extract_from_file")
    async def extract_local_file(self, file_path: str, format: str = "auto") -> dict:  # noqa: A002
        """
        Decorator auto-calls matimo.execute('extract_from_file', {...}).

        Args:
            file_path: Path to a local PDF/DOCX/TXT/CSV file
            format: 'auto' | 'pdf' | 'docx' | 'txt' | 'csv'

        Returns:
            Extracted text plus format-specific metadata
        """
        ...

    @tool("extract_from_file")
    async def extract_remote_file(self, file_url: str, format: str = "auto") -> dict:  # noqa: A002
        """Extract text from a remote file over HTTP(S)."""
        ...


# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Extract From File Tool — Decorator Pattern        ║")
    print("║     (@tool decorators for automatic execution)         ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    set_global_matimo_instance(matimo)
    print("✅  Matimo initialized\n")

    extractor = FileExtractor()
    sample_txt = Path(__file__).parent / "sample-notes.txt"
    sample_txt.write_text(
        "Matimo makes it easy to define tools once in YAML and run them anywhere."
    )

    try:
        print("1. Extracting sample-notes.txt\n")
        result1 = await extractor.extract_local_file(str(sample_txt), format="txt")
        if result1.get("success"):
            metadata = result1.get("metadata", {})
            print(f"Format: {result1.get('format_detected')}")
            print(f"Word count: {metadata.get('word_count')}")
            print(f"Extracted text: {result1.get('extracted_text')}")
        else:
            print(f"Error: {result1.get('error')}")
        print("---\n")

        print("✅  Decorator example completed successfully")
    except Exception as error:
        print(f"❌  Error: {error}\n")
    finally:
        if sample_txt.exists():
            sample_txt.unlink()


if __name__ == "__main__":
    asyncio.run(main())
