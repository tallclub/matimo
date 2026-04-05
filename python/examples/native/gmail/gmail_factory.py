#!/usr/bin/env python3
"""
============================================================================
GMAIL TOOLS — FACTORY PATTERN
============================================================================
Direct tool execution via Matimo.init() — no LLM, deterministic calls.

SETUP:  Set GMAIL_ACCESS_TOKEN in .env (https://developers.google.com/oauthplayground)
USAGE:  make gmail-factory
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_gmail import get_tools_path

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Gmail Tools — Factory Pattern                      ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("GMAIL_ACCESS_TOKEN"):
        print("❌  GMAIL_ACCESS_TOKEN not set in .env")
        print("    Generate one at: https://developers.google.com/oauthplayground")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    tools = [t for t in matimo.list_tools() if t.name.startswith("gmail")]
    print(f"✅  Loaded {len(tools)} Gmail tools\n")
    print("═" * 60)

    # ── Example 1: Get profile ────────────────────────────────────────────────
    print("\n1️⃣   Getting Gmail profile…")
    result = await matimo.execute("gmail-get-profile", {})
    data = (result or {}).get("data", result) or {}
    print(f"   Email:   {data.get('emailAddress', 'unknown')}")
    print(f"   Threads: {data.get('threadsTotal', '?')}")
    print(f"   Messages:{data.get('messagesTotal', '?')}")

    # ── Example 2: List messages ──────────────────────────────────────────────
    print("\n2️⃣   Listing inbox messages (last 5)…")
    result = await matimo.execute("gmail-list-messages", {"max_results": 5})
    data = (result or {}).get("data", result) or {}
    messages = data.get("messages", [])
    if messages:
        print(f"   ✅  {data.get('resultSizeEstimate', len(messages))} message(s) found")
        for msg in messages[:3]:
            print(f"      • id={msg.get('id')} threadId={msg.get('threadId')}")
    else:
        print(f"   ℹ️   No messages or error: {str(data)[:100]}")

    print("\n" + "═" * 60)
    print("✨  Factory Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
