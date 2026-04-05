#!/usr/bin/env python3
"""
============================================================================
TWILIO TOOLS — FACTORY PATTERN
============================================================================
Direct tool execution via Matimo.init() — no LLM, deterministic calls.

SETUP:
  Set in .env (https://console.twilio.com):
    TWILIO_ACCOUNT_SID=ACxxxx
    TWILIO_AUTH_TOKEN=your-auth-token
    TWILIO_FROM_NUMBER=+15005550006
    TWILIO_TO_NUMBER=+1234567890
USAGE:  make twilio-factory
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_twilio import get_tools_path

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Twilio Tools — Factory Pattern                     ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key in ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]:
        if not os.environ.get(key):
            print(f"❌  {key} not set in .env")
            print("    Get credentials from: https://console.twilio.com")
            sys.exit(1)

    from_number = os.environ.get("TWILIO_FROM_NUMBER", "+15005550006")
    to_number = os.environ.get("TWILIO_TO_NUMBER", "")

    matimo = await Matimo.init(get_tools_path())
    tools = [t for t in matimo.list_tools() if t.name.startswith("twilio")]
    print(f"✅  Loaded {len(tools)} Twilio tools\n")
    print("═" * 60)

    # ── Example 1: List recent messages ──────────────────────────────────────
    print("\n1️⃣   Listing recent SMS messages…")
    result = await matimo.execute("twilio-list-messages", {"page_size": 5})
    data = (result or {}).get("data", result) or {}
    messages = data.get("messages", [])
    if messages:
        print(f"   ✅  {len(messages)} message(s):")
        for msg in messages[:3]:
            direction = msg.get("direction", "?")
            body_preview = (msg.get("body") or "")[:50]
            print(f"      • [{direction}] {msg.get('from')} → {msg.get('to')}: {body_preview}")
    else:
        print(f"   ℹ️   No messages: {str(data)[:100]}")

    # ── Example 2: Send SMS (only if to_number is set) ────────────────────────
    print(f"\n2️⃣   Sending test SMS…")
    if to_number:
        result = await matimo.execute(
            "twilio-send-sms",
            {
                "to": to_number,
                "from_": from_number,
                "body": "Hello from Matimo! Factory Pattern test.",
            },
        )
        data = (result or {}).get("data", result) or {}
        sid = data.get("sid") or (data if isinstance(data, str) else None)
        if sid:
            print(f"   ✅  Sent — SID={sid}")
        else:
            print(f"   Result: {str(data)[:100]}")
    else:
        print("   ⚠️   Skipped — set TWILIO_TO_NUMBER in .env")

    print("\n" + "═" * 60)
    print("✨  Factory Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
