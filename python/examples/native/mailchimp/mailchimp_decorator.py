#!/usr/bin/env python3
"""
============================================================================
MAILCHIMP TOOLS — DECORATOR PATTERN
============================================================================
@tool decorator pattern — each method auto-routes through Matimo.

SETUP:  Set MAILCHIMP_API_KEY in .env
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
    async def get_lists(self, count: int = 10):
        ...

    @tool("mailchimp-get-campaigns")
    async def get_campaigns(self, count: int = 10):
        ...

    @tool("mailchimp-add-member")
    async def add_member(self, list_id: str, email_address: str, status: str = "subscribed"):
        ...


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Mailchimp Tools — Decorator Pattern                ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("MAILCHIMP_API_KEY"):
        print("❌  MAILCHIMP_API_KEY not set in .env")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    set_global_matimo_instance(matimo)
    tools = [t for t in matimo.list_tools() if t.name.startswith("mailchimp")]
    print(f"✅  Loaded {len(tools)} Mailchimp tools\n")

    svc = MailchimpService()

    print("📋  Getting audiences…")
    result = await svc.get_lists(count=3)
    data = (result or {}).get("data", result) or {}
    for lst in (data.get("lists") or [])[:3]:
        print(f"   • {lst['name']} ({lst.get('stats', {}).get('member_count', '?')} members)")

    print("\n📢  Getting campaigns…")
    result = await svc.get_campaigns(count=3)
    data = (result or {}).get("data", result) or {}
    for c in (data.get("campaigns") or [])[:3]:
        print(f"   • [{c.get('status', '?')}] {c.get('settings', {}).get('subject_line', c.get('id', '?'))}")

    print("\n" + "═" * 60)
    print("✨  Decorator Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
