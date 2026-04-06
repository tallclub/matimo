#!/usr/bin/env python3
"""
Search Tool - Factory Pattern with Interactive Approval

Example: Search for information in files using Matimo's search tool
Demonstrates searching files for patterns and content with interactive approval
"""

import asyncio
import os
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
            request: ApprovalRequest with toolName, description, params
            
        Returns:
            bool: True if approved, False otherwise
        """
        is_interactive = sys.stdin.isatty()

        print('\n' + '=' * 70)
        print('🔒 APPROVAL REQUIRED FOR SEARCH OPERATION')
        print('=' * 70)
        print(f'\n📋 Tool: {request["toolName"]}')
        print(f'📝 Description: {request.get("description", "(no description provided)")}')
        print('\n🔍 Search Operation:')
        print(f'   Query: {request["params"].get("query", "N/A")}')
        print(f'   Directory: {request["params"].get("directory", "N/A")}')
        print(f'   Pattern: {request["params"].get("filePattern", "N/A")}')

        if not is_interactive:
            print('\n❌ REJECTED - Non-interactive environment (no terminal)')
            print('\n💡 To enable auto-approval in CI/scripts:')
            print('   export MATIMO_AUTO_APPROVE=true')
            print('\n💡 Or approve specific patterns:')
            print('   export MATIMO_APPROVED_PATTERNS="search"')
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
    Main entry point for search factory example
    
    Demonstrates:
    1️⃣ Searching for "import" patterns in examples
    2️⃣ Searching for function definitions in core packages
    3️⃣ Searching for console patterns with regex
    """
    # Load environment variables
    load_dotenv()

    # Initialize Matimo with auto-discovery to find all tools
    matimo = await Matimo.init(auto_discover=True)

    # Configure centralized approval handler
    approval_handler = get_global_approval_handler()
    approval_handler.set_approval_callback(create_approval_callback())

    print('=== Search Tool - Factory Pattern (Interactive Approval) ===\n')

    # Get the workspace root (parent of examples directory)
    current_file = Path(__file__)
    workspace_root = current_file.parent.parent.parent.parent.parent

    try:
        # 1️⃣ Example 1: Search for pattern in TypeScript files
        print('1️⃣ Searching for "import" in examples\n')
        examples_dir = workspace_root / 'typescript' / 'examples' / 'tools'
        
        try:
            result1 = await matimo.execute(
                'search',
                {
                    'query': 'import',
                    'directory': str(examples_dir),
                    'filePattern': '*.ts',
                    'maxResults': 5,
                }
            )

            if result1.get('success'):
                print(f'Total matches: {result1.get("totalMatches")}')
                print(f'Matches found: {len(result1.get("matches", []))}')
                
                # Show first 3 matches
                for match in result1.get('matches', [])[:3]:
                    print(f'  - {match.get("filePath")}:{match.get("lineNumber")}: {match.get("lineContent")}')
            else:
                print(f'Search denied: {result1.get("error")}')
        except Exception as e:
            print(f'Error: {e}')
        
        print('---\n')

        # 2️⃣ Example 2: Search for function definitions
        print('2️⃣ Searching for function definitions\n')
        core_src_dir = workspace_root / 'typescript' / 'packages' / 'core' / 'src'
        
        try:
            result2 = await matimo.execute(
                'search',
                {
                    'query': 'export function',
                    'directory': str(core_src_dir),
                    'filePattern': '*.ts',
                    'maxResults': 10,
                }
            )

            if result2.get('success'):
                print(f'Total matches: {result2.get("totalMatches")}')
                print(f'Matches found: {len(result2.get("matches", []))}')
            else:
                print(f'Search denied: {result2.get("error")}')
        except Exception as e:
            print(f'Error: {e}')
        
        print('---\n')

        # 3️⃣ Example 3: Search in specific directory with regex
        print('3️⃣ Searching for "console" patterns with regex\n')
        
        try:
            result3 = await matimo.execute(
                'search',
                {
                    'query': r'console\.log',
                    'directory': str(core_src_dir),
                    'filePattern': '*.ts',
                    'isRegex': True,
                    'maxResults': 5,
                }
            )

            if result3.get('success'):
                print(f'Total matches: {result3.get("totalMatches")}')
                print(f'Matches found: {len(result3.get("matches", []))}')
            else:
                print(f'Search denied: {result3.get("error")}')
        except Exception as e:
            print(f'Error: {e}')
        
        print('---\n')

    except Exception as error:
        print(f'Error searching files: {error}')
        if hasattr(error, 'message'):
            print(f'Error message: {error.message}')


if __name__ == '__main__':
    asyncio.run(main())
