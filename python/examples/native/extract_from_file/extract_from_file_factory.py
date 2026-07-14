#!/usr/bin/env python3
"""
Extract From File Tool - Factory Pattern with Interactive Approval

Example: Extract text from local PDF/DOCX/TXT/CSV files using Matimo's
extract_from_file tool. Demonstrates direct execution with interactive
approval (extract_from_file sets requires_approval: true, same as `read`).
"""

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

from matimo import Matimo, get_global_approval_handler


def create_approval_callback():
    """Create an interactive approval callback for file extraction operations."""

    async def approval_handler(request):
        """
        Handle approval requests interactively

        Args:
            request: ApprovalRequest with tool_name, description, params

        Returns:
            bool: True if approved, False otherwise
        """
        is_interactive = sys.stdin.isatty()

        print('\n' + '=' * 70)
        print('🔒 APPROVAL REQUIRED FOR FILE EXTRACTION')
        print('=' * 70)
        print(f'\n📋 Tool: {request.tool_name}')
        print(f'📝 Description: {request.description or "(no description provided)"}')
        print('\n📄 Extraction Request:')
        if request.params.get('filePath'):
            print(f'   filePath: {request.params["filePath"]}')
        if request.params.get('fileUrl'):
            print(f'   fileUrl: {request.params["fileUrl"]}')
        print(f'   format: {request.params.get("format", "auto")}')

        if not is_interactive:
            print('\n❌ REJECTED - Non-interactive environment (no terminal)')
            print('\n💡 To enable auto-approval in CI/scripts:')
            print('   export MATIMO_AUTO_APPROVE=true')
            print('\n💡 Or approve specific patterns:')
            print('   export MATIMO_APPROVED_PATTERNS="extract_from_file"')
            print('\n' + '=' * 70 + '\n')
            return False

        # Interactive mode: prompt user
        print('\n❓ User Action Required')
        user_input = input('   Type "yes" to approve or "no" to reject: ').strip().lower()
        approved = user_input in ('yes', 'y')

        print('   ✅ Operation APPROVED by user' if approved else '   ❌ Operation REJECTED by user')
        print('=' * 70 + '\n')

        return approved

    return approval_handler


async def main():
    """
    Main entry point for extract_from_file factory example

    Demonstrates:
    1️⃣ Extracting a local CSV file (row/column metadata)
    2️⃣ Extracting this example file itself as plain text
    """
    load_dotenv()

    matimo = await Matimo.init(auto_discover=True)

    approval_handler = get_global_approval_handler()
    approval_handler.set_approval_callback(create_approval_callback())

    print('=== Extract From File Tool - Factory Pattern (Interactive Approval) ===\n')

    current_file = Path(__file__)
    sample_csv = current_file.parent / 'sample-data.csv'
    sample_csv.write_text('name,role\nAda Lovelace,Mathematician\nAlan Turing,Computer Scientist\n')

    try:
        # 1️⃣ Example 1: Extract a local CSV file
        print('1️⃣ Extracting sample-data.csv\n')
        try:
            result1 = await matimo.execute('extract_from_file', {'filePath': str(sample_csv)})

            if result1.get('success'):
                print(f'Format detected: {result1.get("format_detected")}')
                metadata = result1.get('metadata', {})
                print(f'Rows: {metadata.get("row_count")}')
                print(f'Columns: {metadata.get("column_count")}')
                print(f'Extracted text:\n{result1.get("extracted_text")}')
            else:
                print(f'Extraction failed: {result1.get("error")}')
        except Exception as e:
            print(f'Error: {e}')

        print('---\n')

        # 2️⃣ Example 2: Extract this example file as plain text
        print('2️⃣ Extracting extract_from_file_factory.py as plain text\n')
        try:
            result2 = await matimo.execute(
                'extract_from_file',
                {'filePath': str(current_file), 'format': 'txt'},
            )

            if result2.get('success'):
                metadata = result2.get('metadata', {})
                print(f'Word count: {metadata.get("word_count")}')
                print(f'Char count: {metadata.get("char_count")}')
                text = result2.get('extracted_text', '')
                print(f'Preview: {text[:200]}')
            else:
                print(f'Extraction failed: {result2.get("error")}')
        except Exception as e:
            print(f'Error: {e}')

        print('---\n')

    finally:
        if sample_csv.exists():
            sample_csv.unlink()


if __name__ == '__main__':
    asyncio.run(main())
