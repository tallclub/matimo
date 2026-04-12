#!/usr/bin/env python3
"""
Read Tool - Factory Pattern with Interactive Approval

Example: Read and parse files/content using Matimo's read tool
Demonstrates reading file contents with interactive approval handler
"""

import asyncio
import sys
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
        print('\n📄 File Operation:')
        print(f'   Path: {request.params.get("filePath", "N/A")}')
        
        if request.params.get('startLine'):
            print(f'   Start Line: {request.params["startLine"]}')
        if request.params.get('endLine'):
            print(f'   End Line: {request.params["endLine"]}')

        if not is_interactive:
            print('\n❌ REJECTED - Non-interactive environment (no terminal)')
            print('\n💡 To enable auto-approval in CI/scripts:')
            print('   export MATIMO_AUTO_APPROVE=true')
            print('\n💡 Or approve specific patterns:')
            print('   export MATIMO_APPROVED_PATTERNS="read"')
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
    Main entry point for read factory example
    
    Demonstrates:
    1️⃣ Reading this example file with line range
    2️⃣ Reading package.json with line range
    """
    # Load environment variables
    load_dotenv()

    # Initialize Matimo with auto-discovery to find all tools
    matimo = await Matimo.init(auto_discover=True)

    # Configure centralized approval handler
    approval_handler = get_global_approval_handler()
    approval_handler.set_approval_callback(create_approval_callback())

    print('=== Read Tool - Factory Pattern (Interactive Approval) ===\n')

    try:
        # 1️⃣ Example 1: Read this example file
        print('1️⃣ Reading read_factory.py\n')
        current_file = Path(__file__)
        
        try:
            result1 = await matimo.execute(
                'read',
                {
                    'filePath': str(current_file),
                    'startLine': 1,
                    'endLine': 20,
                }
            )

            if result1.get('success'):
                print(f'File: {result1.get("filePath")}')
                print(f'Lines read: {result1.get("readLines")}')
                print('Content preview:')
                content = result1.get('content', '')
                print(content[:300] if content else '(no content)')
            else:
                print(f'Access denied: {result1.get("error")}')
        except Exception as e:
            print(f'Error: {e}')
        
        print('---\n')

        # 2️⃣ Example 2: Read package.json
        print('2️⃣ Reading package.json\n')
        project_root = current_file.parent.parent.parent.parent.parent
        package_json = project_root / 'typescript' / 'package.json'
        
        try:
            result2 = await matimo.execute(
                'read',
                {
                    'filePath': str(package_json),
                    'startLine': 1,
                    'endLine': 15,
                }
            )

            if result2.get('success'):
                print(f'File: {result2.get("filePath")}')
                print(f'Lines read: {result2.get("readLines")}')
                print('Content preview:')
                content = result2.get('content', '')
                print(content[:200] if content else '(no content)')
            else:
                print(f'Access denied: {result2.get("error")}')
        except Exception as e:
            print(f'Error: {e}')
        
        print('---\n')

    except Exception as error:
        print(f'Error reading file: {error}')
        if hasattr(error, 'code'):
            print(f'Error code: {error.code}')
        if hasattr(error, 'details'):
            print(f'Error details: {error.details}')


if __name__ == '__main__':
    asyncio.run(main())
