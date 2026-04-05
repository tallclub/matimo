#!/usr/bin/env python3
"""
============================================================================
EDIT TOOL — FACTORY PATTERN
============================================================================

PATTERN: SDK Factory Pattern
────────────────────────────────────────────────────────────────────────────
Direct tool execution via Matimo.init() — the simplest way to edit files.
Includes interactive approval for sensitive file operations.

Use this pattern when:
  ✅ Building simple scripts or CLI tools
  ✅ Direct file editing without LLM overhead
  ✅ Quick prototyping and testing
  ✅ One-off file modifications

SETUP:
────────────────────────────────────────────────────────────────────────────
  The edit tool is built-in to Matimo core (no API key required).
  Requires MATIMO_AUTO_APPROVE=true or interactive terminal for approval.

USAGE:
────────────────────────────────────────────────────────────────────────────
  export MATIMO_AUTO_APPROVE=true
  uv run python edit/edit_factory.py

AVAILABLE EDIT TOOL PARAMETERS:
────────────────────────────────────────────────────────────────────────────
  filePath     (str, required)  - Path to file to edit
  newContent   (str, required)  - New content to write
  createIfMissing (bool, optional) - Create file if it doesn't exist

⚠️  WARNING: This tool modifies files on disk. Use with caution!

============================================================================
"""

import asyncio
import tempfile
from pathlib import Path
from dotenv import load_dotenv

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Edit Tool — Factory Pattern                       ║")
    print("║     (Direct execution — simplest approach)            ║")
    print("║     ⚠️  WARNING: This modifies files!                 ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Initialize Matimo with autoDiscover to find all tools ─────────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    all_tools = matimo.list_tools()
    print(f"✅  Loaded {len(all_tools)} tools\n")

    try:
        # Create a temporary file for testing
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as tmp:
            tmp_path = tmp.name
            tmp.write("Original content\n")

        print(f"Created temporary file: {tmp_path}\n")

        # Example 1: Replace entire file content
        print("1. Replacing entire file content\n")
        new_content = "Hello from Matimo!\nThis is the new content.\n"
        result1 = await matimo.execute(
            "edit",
            {
                "filePath": tmp_path,
                "newContent": new_content
            }
        )
        
        if result1.get("success"):
            print(f"File edited successfully")
            print(f"Status: {result1.get('status')}")
            # Read the file to verify
            with open(tmp_path, 'r') as f:
                content = f.read()
            print(f"Verified content:\n{content}")
        else:
            print(f"Edit failed: {result1.get('error', 'Unknown error')}")
        print("---\n")

        # Example 2: Create a new file
        print("2. Creating a new file\n")
        new_file = tempfile.mktemp(suffix='.py', prefix='test_')
        new_python_content = '''#!/usr/bin/env python3
"""Auto-generated Python file from Matimo edit tool."""

def hello():
    """Say hello."""
    print("Hello from Matimo!")

if __name__ == "__main__":
    hello()
'''
        
        result2 = await matimo.execute(
            "edit",
            {
                "filePath": new_file,
                "newContent": new_python_content,
                "createIfMissing": True
            }
        )
        
        if result2.get("success"):
            print(f"File created: {new_file}")
            print(f"Status: {result2.get('status')}")
            # Verify file was created
            if Path(new_file).exists():
                print("✓ File exists on disk")
                with open(new_file, 'r') as f:
                    print(f"Content preview:\n{f.read()[:150]}...")
        else:
            print(f"File creation failed: {result2.get('error')}")
        print("---\n")

        # Example 3: Append content to existing file
        print("3. Modifying file content (append)\n")
        append_content = tmp_path  # Use existing file
        new_content_with_append = "Hello from Matimo!\nThis is the new content.\n\n--- Appended content ---\n"
        new_content_with_append += "This was appended by the edit tool.\n"
        
        result3 = await matimo.execute(
            "edit",
            {
                "filePath": append_content,
                "newContent": new_content_with_append
            }
        )
        
        if result3.get("success"):
            print(f"File appended successfully")
            with open(append_content, 'r') as f:
                content = f.read()
            print(f"Updated content:\n{content}")
        else:
            print(f"Failed: {result3.get('error')}")
        print("---\n")

        # Clean up
        print("Cleaning up temporary files…")
        Path(tmp_path).unlink(missing_ok=True)
        if Path(new_file).exists():
            Path(new_file).unlink()
        print("✓ Cleanup complete\n")

    except Exception as error:
        print(f"❌  Error editing file: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
