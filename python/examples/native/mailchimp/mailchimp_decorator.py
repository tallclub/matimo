#!/usr/bin/env python3
"""
============================================================================
MAILCHIMP TOOLS — DECORATOR PATTERN
============================================================================
@tool decorator pattern — each method auto-routes through Matimo.

SETUP:  Set MAILCHIMP_API_KEY in .env (format: "abc123def456-us6")
USAGE:  make mailchimp-decorator
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_mailchimp import get_tools_path

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


class MailchimpService:
    """Mailchimp marketing operations via the @tool decorator pattern."""

    @tool("mailchimp-get-lists")
    async def get_lists(self, server_prefix: str, count: int = 10):
        ...

    @tool("mailchimp-get-list-members")
    async def get_list_members(self, server_prefix: str, list_id: str, count: int = 10):
        ...

    @tool("mailchimp-add-list-member")
    async def add_list_member(
        self,
        server_prefix: str,
        list_id: str,
        email_address: str,
        status: str = "subscribed",
    ):
        ...


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Mailchimp Tools — Decorator Pattern                ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    api_key = os.environ.get("MAILCHIMP_API_KEY")
    if not api_key:
        print("❌  MAILCHIMP_API_KEY not set in .env")
        sys.exit(1)

    # Mailchimp API keys are formatted "<key>-<server_prefix>", e.g. "abc123-us6".
    server_prefix = api_key.rsplit("-", 1)[-1]

    matimo = await Matimo.init(get_tools_path())
    set_global_matimo_instance(matimo)
    tools = [t for t in matimo.list_tools() if t.name.startswith("mailchimp")]
    print(f"✅  Loaded {len(tools)} Mailchimp tools\n")

    svc = MailchimpService()

    print("📋  Getting audiences…")
    result = await svc.get_lists(server_prefix, count=3)
    data = (result or {}).get("data", result) or {}
    lists = data.get("lists") or []
    for lst in lists[:3]:
        print(f"   • {lst['name']} ({lst.get('stats', {}).get('member_count', '?')} members)")

    if lists:
        list_id = lists[0]["id"]
        print(f"\n👥  Getting members of \"{lists[0]['name']}\"…")
        result = await svc.get_list_members(server_prefix, list_id, count=3)
        data = (result or {}).get("data", result) or {}
        for m in (data.get("members") or [])[:3]:
            print(f"   • {m.get('email_address', '?')} ({m.get('status', '?')})")

    print("\n" + "═" * 60)
    print("✨  Decorator Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
