#!/usr/bin/env python3
"""
Convert To File Tool - Factory Pattern with Interactive Approval

Example: Convert JSON/CSV/Markdown/text content into a target file (PDF, DOCX,
CSV, JSON, TXT) using Matimo's convert_to_file tool. Demonstrates direct
execution with interactive approval (convert_to_file sets
requires_approval: true, same as `read` / `extract_from_file`).
"""

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

from matimo import Matimo, get_global_approval_handler


def create_approval_callback():
    """Create an interactive approval callback for file conversion operations."""

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
        print('🔒 APPROVAL REQUIRED FOR FILE CONVERSION')
        print('=' * 70)
        print(f'\n📋 Tool: {request.tool_name}')
        print(f'📝 Description: {request.description or "(no description provided)"}')
        print('\n📄 Conversion Request:')
        print(f'   {request.params.get("source_format")} -> {request.params.get("target_format")}')
        if request.params.get('output_path'):
            print(f'   output_path: {request.params["output_path"]}')

        if not is_interactive:
            print('\n❌ REJECTED - Non-interactive environment (no terminal)')
            print('\n💡 To enable auto-approval in CI/scripts:')
            print('   export MATIMO_AUTO_APPROVE=true')
            print('\n' + '=' * 70 + '\n')
            return False

        # Interactive mode: prompt user
        user_input = input('   Type "yes" to approve or "no" to reject: ').strip().lower()
        approved = user_input in ('yes', 'y')

        print('   ✅ Operation APPROVED by user' if approved else '   ❌ Operation REJECTED by user')
        print('=' * 70 + '\n')

        return approved

    return approval_handler


async def main():
    """
    Main entry point for convert_to_file factory example

    Demonstrates:
    1️⃣ Converting a JSON array of records to CSV (returned as base64)
    2️⃣ Rendering a Markdown report as a PDF written to disk
    """
    load_dotenv()

    matimo = await Matimo.init(auto_discover=True)

    approval_handler = get_global_approval_handler()
    approval_handler.set_approval_callback(create_approval_callback())

    print('=== Convert To File Tool - Factory Pattern (Interactive Approval) ===\n')

    output_path = Path(__file__).parent / 'quarterly-report.pdf'

    try:
        # 1️⃣ Example 1: JSON -> CSV, returned inline as base64
        print('1️⃣ Converting a JSON array of records to CSV\n')
        try:
            import base64
            import json

            json_content = json.dumps(
                [
                    {'name': 'Ada Lovelace', 'role': 'Mathematician'},
                    {'name': 'Alan Turing', 'role': 'Computer Scientist'},
                ]
            )
            result1 = await matimo.execute(
                'convert_to_file',
                {'content': json_content, 'source_format': 'json', 'target_format': 'csv'},
            )

            if result1.get('success'):
                print(f'MIME type: {result1.get("mime_type")}')
                csv_text = base64.b64decode(result1['file_base64']).decode('utf-8')
                print(f'CSV output:\n{csv_text}')
            else:
                print(f'Conversion failed: {result1.get("error")}')
        except Exception as e:
            print(f'Error: {e}')

        print('---\n')

        # 2️⃣ Example 2: Markdown -> PDF, written to disk
        print('2️⃣ Converting a Markdown report to a PDF on disk\n')
        try:
            markdown = (
                '# Quarterly Report\n\nRevenue grew steadily this quarter.\n\n'
                '- Q1: strong\n- Q2: flat\n- Q3: recovery'
            )
            result2 = await matimo.execute(
                'convert_to_file',
                {
                    'content': markdown,
                    'source_format': 'markdown',
                    'target_format': 'pdf',
                    'output_path': str(output_path),
                },
            )

            if result2.get('success'):
                print(f'Written to: {result2.get("output_path")}')
                print(f'Size (bytes): {result2.get("size_bytes")}')
            else:
                print(f'Conversion failed: {result2.get("error")}')
        except Exception as e:
            print(f'Error: {e}')

        print('---\n')

    finally:
        if output_path.exists():
            output_path.unlink()


if __name__ == '__main__':
    asyncio.run(main())
