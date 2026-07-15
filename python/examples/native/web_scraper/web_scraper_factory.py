#!/usr/bin/env python3
"""
Web Scraper Tool - Factory Pattern with Interactive Approval

Example: Crawl a small site using Matimo's web_scraper tool. Demonstrates
direct execution with interactive approval (web_scraper sets
requires_approval: true, same as extract_from_file/convert_to_file, because
it makes outbound HTTP requests to arbitrary domains).
"""

import asyncio
import sys

from dotenv import load_dotenv

from matimo import Matimo, get_global_approval_handler


def create_approval_callback():
    """Create an interactive approval callback for web-crawling operations."""

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
        print('🔒 APPROVAL REQUIRED FOR WEB CRAWL')
        print('=' * 70)
        print(f'\n📋 Tool: {request.tool_name}')
        print(f'📝 Description: {request.description or "(no description provided)"}')
        print('\n🌐 Crawl Request:')
        print(f'   url: {request.params.get("url")}')
        print(f'   maxPages: {request.params.get("maxPages", 20)}')
        print(f'   maxDepth: {request.params.get("maxDepth", 3)}')

        if not is_interactive:
            print('\n❌ REJECTED - Non-interactive environment (no terminal)')
            print('\n💡 To enable auto-approval in CI/scripts:')
            print('   export MATIMO_AUTO_APPROVE=true')
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
    Main entry point for web_scraper factory example

    Demonstrates:
    1️⃣ Crawling a small site bounded by maxPages/maxDepth
    """
    load_dotenv()

    matimo = await Matimo.init(auto_discover=True)

    approval_handler = get_global_approval_handler()
    approval_handler.set_approval_callback(create_approval_callback())

    print('=== Web Scraper Tool - Factory Pattern (Interactive Approval) ===\n')

    print('1️⃣ Crawling a small site (maxPages: 5, maxDepth: 1)\n')
    try:
        result = await matimo.execute(
            'web_scraper',
            {'url': 'https://example.com', 'maxPages': 5, 'maxDepth': 1, 'format': 'text'},
        )

        if result.get('success'):
            print(f'Domain: {result.get("domain")}')
            print(f'Pages crawled: {result.get("pagesCrawled")}')
            print(f'Truncated crawl: {result.get("truncatedCrawl")}')
            for page in result.get('pages', []):
                print(f'\n- {page["url"]} (depth {page["depth"]})')
                print(f'  title: {page["title"]}')
                print(f'  text preview: {(page.get("text") or "")[:150]}')
            if result.get('errors'):
                print(f'\nPages that failed to crawl: {result["errors"]}')
        else:
            print(f'Crawl failed: {result.get("error")}')
    except Exception as e:
        print(f'Error: {e}')

    print('---\n')


if __name__ == '__main__':
    asyncio.run(main())
