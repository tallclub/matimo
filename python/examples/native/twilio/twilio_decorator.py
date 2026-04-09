#!/usr/bin/env python3
"""
============================================================================
TWILIO TOOLS — DECORATOR PATTERN
============================================================================
@tool decorator pattern — each method auto-routes through Matimo.

SETUP:  Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN in .env
USAGE:  make twilio-decorator
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_twilio import get_tools_path

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


class TwilioService:
    """Twilio messaging operations via the @tool decorator pattern."""

    @tool("twilio-list-messages")
    async def list_messages(self, page_size: int = 5):
        ...

    @tool("twilio-send-sms")
    async def send_sms(self, to: str, from_: str, body: str):
        ...

    @tool("twilio-send-whatsapp")
    async def send_whatsapp(self, to: str, from_: str, body: str):
        ...


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Twilio Tools — Decorator Pattern                   ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key in ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]:
        if not os.environ.get(key):
            print(f"❌  {key} not set in .env")
            sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    set_global_matimo_instance(matimo)
    tools = [t for t in matimo.list_tools() if t.name.startswith("twilio")]
    print(f"✅  Loaded {len(tools)} Twilio tools\n")

    svc = TwilioService()

    print("📋  Listing messages…")
    result = await svc.list_messages(page_size=3)
    data = (result or {}).get("data", result) or {}
    for msg in (data.get("messages") or [])[:3]:
        print(f"   • [{msg.get('direction')}] {msg.get('from')} → {msg.get('to')}: {(msg.get('body') or '')[:40]}")

    to_number = os.environ.get("TWILIO_TO_NUMBER", "")
    from_number = os.environ.get("TWILIO_FROM_NUMBER", "+15005550006")
    if to_number:
        print(f"\n📤  Sending SMS to {to_number}…")
        result = await svc.send_sms(to=to_number, from_=from_number, body="Hello from Matimo! Decorator pattern.")
        data = (result or {}).get("data", result) or {}
        print(f"   Result: {str(data)[:100]}")
    else:
        print("\n⚠️   SMS skipped — set TWILIO_TO_NUMBER in .env")

    print("\n" + "═" * 60)
    print("✨  Decorator Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
