#!/usr/bin/env python3
"""
============================================================================
GMAIL TOOLS — DECORATOR PATTERN
============================================================================
@tool decorator pattern — each method auto-routes through Matimo.

SETUP:  Set GMAIL_ACCESS_TOKEN in .env
USAGE:  make gmail-decorator
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_gmail import get_tools_path

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


class GmailService:
    """Gmail operations via the @tool decorator pattern."""

    @tool("gmail-get-profile")
    async def get_profile(self):
        ...

    @tool("gmail-list-messages")
    async def list_messages(self, max_results: int = 10, label_ids: str = "INBOX"):
        ...

    @tool("gmail-send-email")
    async def send_email(self, to: str, subject: str, body: str):
        ...


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Gmail Tools — Decorator Pattern                    ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("GMAIL_ACCESS_TOKEN"):
        print("❌  GMAIL_ACCESS_TOKEN not set in .env")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    set_global_matimo_instance(matimo)
    tools = [t for t in matimo.list_tools() if t.name.startswith("gmail")]
    print(f"✅  Loaded {len(tools)} Gmail tools\n")

    svc = GmailService()

    print("👤  Getting profile…")
    result = await svc.get_profile()
    data = (result or {}).get("data", result) or {}
    print(f"   Email: {data.get('emailAddress', str(data)[:60])}")

    print("\n📥  Listing inbox (top 3)…")
    result = await svc.list_messages(max_results=3)
    data = (result or {}).get("data", result) or {}
    for msg in (data.get("messages") or [])[:3]:
        print(f"   • {msg.get('id')}")

    print("\n" + "═" * 60)
    print("✨  Decorator Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
