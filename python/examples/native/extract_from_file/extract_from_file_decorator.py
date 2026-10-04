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
  uv run python native/extract_from_file/extract_from_file_decorator.py   # asks first

  extract_from_file declares requires_approval: true. To run unattended:
  MATIMO_APPROVED_PATTERNS="extract_from_file" \
    uv run python native/extract_from_file/extract_from_file_decorator.py

NOTE: @tool sends the method's own parameter names as the tool's parameters,
so they must match the tool definition exactly (filePath, fileUrl, format),
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


# ───────────────────────────────────────────────────────────────────────────
# Service class — each method is auto-routed to the matching Matimo tool
# ───────────────────────────────────────────────────────────────────────────

async def approve(request: ApprovalRequest) -> bool:
    """Ask in the terminal before each call that needs approval."""
    source = request.params.get("filePath") or request.params.get("fileUrl")
    print(f"\n🔒 Approval required — {request.tool_name}: {source}")
    if not sys.stdin.isatty():
        print(
            '   ❌ Rejected: no terminal. Pre-approve with '
            'MATIMO_APPROVED_PATTERNS="extract_from_file"'
        )
        return False
    return input("   Approve? (y/n): ").strip().lower() in ("y", "yes")


class FileExtractor:
    """High-level file-extraction service using the @tool decorator pattern."""

    @tool("extract_from_file")
    async def extract_local_file(self, filePath: str, format: str) -> dict:  # noqa: A002, N803
        """
        Decorator auto-calls matimo.execute('extract_from_file', {...}).

        Args:
            filePath: Path to a local PDF/DOCX/TXT/CSV file
            format: 'auto' | 'pdf' | 'docx' | 'txt' | 'csv'

        Returns:
            Extracted text plus format-specific metadata
        """
        ...

    @tool("extract_from_file")
    async def extract_remote_file(self, fileUrl: str, format: str) -> dict:  # noqa: A002, N803
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
    matimo = await Matimo.init(auto_discover=True, on_approval=approve)
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
