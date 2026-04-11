#!/usr/bin/env python3
"""
Edit Tool - Factory Pattern with Interactive Approval

Example: Edit and modify content using Matimo's edit tool
Demonstrates editing and modifying file contents with interactive approval
"""

import asyncio
import sys
import tempfile
from pathlib import Path

from dotenv import load_dotenv

from matimo import Matimo, get_global_approval_handler


def create_approval_callback():
    """Create an interactive approval callback for file operations"""

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
        print('🔒 APPROVAL REQUIRED FOR FILE OPERATION')
        print('=' * 70)
        print(f'\n📋 Tool: {request.tool_name}')
        print(f'📝 Description: {request.description or "(no description provided)"}')
        print('\n📝 File Operation:')
        print(f'   Path: {request.params.get("filePath", "N/A")}')
        print(f'   Operation: {request.params.get("operation", "N/A")}')
        
        if request.params.get('startLine'):
            print(f'   Start Line: {request.params["startLine"]}')
        if request.params.get('endLine'):
            print(f'   End Line: {request.params["endLine"]}')

        if not is_interactive:
            print('\n❌ REJECTED - Non-interactive environment (no terminal)')
            print('\n💡 To enable auto-approval in CI/scripts:')
            print('   export MATIMO_AUTO_APPROVE=true')
            print('\n💡 Or approve specific patterns:')
            print('   export MATIMO_APPROVED_PATTERNS="edit"')
            print('\n' + '=' * 70 + '\n')
            return False

        # Interactive mode: prompt user
        print('\n❓ User Action Required')
        user_input = input('   Type "yes" to approve or "no" to reject: ').strip().lower()
        approved = user_input in ('yes', 'y')

        if approved:
            print('   ✅ Operation APPROVED by user')
        else:
            print('   ❌ Operation REJECTED by user')
        print('=' * 70 + '\n')

        return approved

    return approval_handler


async def main():
    """
    Main entry point for edit factory example
    
    Demonstrates:
    1️⃣ Replacing content in a file (replace line 2)
    2️⃣ Inserting new content into a file
    """
    # Load environment variables
    load_dotenv()

    # Initialize Matimo with auto-discovery to find all tools
    matimo = await Matimo.init(auto_discover=True)

    # Configure centralized approval handler
    approval_handler = get_global_approval_handler()
    approval_handler.set_approval_callback(create_approval_callback())

    print('=== Edit Tool - Factory Pattern (Interactive Approval) ===\n')

    # Create a temporary file for demonstration
    temp_file = None
    try:
        # Create temp file with initial content
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.txt',
            delete=False,
            dir='/tmp'
        ) as f:
            temp_file = Path(f.name)
            f.write('Line 1\nLine 2\nLine 3\n')

        # 1️⃣ Example 1: Replace text in file (replace line 2)
        print('1️⃣ Replacing content in file\n')
        print('Original content:')
        with open(temp_file, 'r') as f:
            original_content = f.read()
        print(original_content)
        print('---\n')

        try:
            result = await matimo.execute(
                'edit',
                {
                    'filePath': str(temp_file),
                    'operation': 'replace',
                    'content': 'Line 2 (Modified)',
                    'startLine': 2,
                    'endLine': 2,
                }
            )

            if result.get('success'):
                print(f'Edit Result: {result.get("success")}')
                print(f'Lines Affected: {result.get("linesAffected")}')
                print('\nModified content:')
                with open(temp_file, 'r') as f:
                    modified_content = f.read()
                print(modified_content)
            else:
                print(f'Edit denied: {result.get("error")}')
        except Exception as e:
            print(f'Error: {e}')
        
        print('---\n')

        # 2️⃣ Example 2: Insert new content
        print('2️⃣ Inserting new line\n')
        
        try:
            insert_result = await matimo.execute(
                'edit',
                {
                    'filePath': str(temp_file),
                    'operation': 'insert',
                    'content': 'New inserted line',
                    'startLine': 2,
                }
            )

            if insert_result.get('success'):
                print(f'Insert Result: {insert_result.get("success")}')
                print(f'Lines Affected: {insert_result.get("linesAffected")}')
                print('\nFinal content:')
                with open(temp_file, 'r') as f:
                    final_content = f.read()
                print(final_content)
            else:
                print(f'Insert denied: {insert_result.get("error")}')
        except Exception as e:
            print(f'Error: {e}')
        
        print('---\n')

    except Exception as error:
        print(f'Error editing file: {error}')
        if hasattr(error, 'message'):
            print(f'Error message: {error.message}')
    
    finally:
        # Clean up temporary file
        if temp_file and temp_file.exists():
            try:
                temp_file.unlink()
            except Exception as e:
                print(f'Warning: Could not delete temp file: {e}')


if __name__ == '__main__':
    asyncio.run(main())
