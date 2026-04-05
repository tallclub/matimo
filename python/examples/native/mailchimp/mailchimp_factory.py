#!/usr/bin/env python3
"""
============================================================================
MAILCHIMP TOOLS — FACTORY PATTERN
============================================================================
Direct tool execution via Matimo.init() — no LLM, deterministic calls.

SETUP:  Set MAILCHIMP_API_KEY in .env (https://mailchimp.com/help/about-api-keys/)
        Format: <key>-<datacenter>  e.g. abc123-us1
USAGE:  make mailchimp-factory
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_mailchimp import get_tools_path

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Mailchimp Tools — Factory Pattern                  ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("MAILCHIMP_API_KEY"):
        print("❌  MAILCHIMP_API_KEY not set in .env")
        print("    Get one from: https://mailchimp.com/help/about-api-keys/")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    tools = [t for t in matimo.list_tools() if t.name.startswith("mailchimp")]
    print(f"✅  Loaded {len(tools)} Mailchimp tools\n")
    print("═" * 60)

    # ── Example 1: List audiences ─────────────────────────────────────────────
    print("\n1️⃣   Listing Mailchimp audiences…")
    result = await matimo.execute("mailchimp-get-lists", {"count": 5})
    data = (result or {}).get("data", result) or {}
    lists = data.get("lists", [])
    if lists:
        print(f"   ✅  {data.get('total_items', len(lists))} audience(s):")
        for lst in lists[:3]:
            print(f"      • {lst['name']} (id={lst['id']}, members={lst.get('stats', {}).get('member_count', '?')})")
    else:
        print(f"   ℹ️   No audiences or error: {str(data)[:100]}")

    # ── Example 2: List campaigns ─────────────────────────────────────────────
    print("\n2️⃣   Listing campaigns (last 5)…")
    result = await matimo.execute("mailchimp-get-campaigns", {"count": 5})
    data = (result or {}).get("data", result) or {}
    campaigns = data.get("campaigns", [])
    if campaigns:
        print(f"   ✅  {data.get('total_items', len(campaigns))} campaign(s):")
        for c in campaigns[:3]:
            print(f"      • [{c.get('status', '?')}] {c.get('settings', {}).get('subject_line', c.get('id', '?'))}")
    else:
        print(f"   ℹ️   No campaigns: {str(data)[:100]}")

    print("\n" + "═" * 60)
    print("✨  Factory Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
