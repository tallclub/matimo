#!/usr/bin/env python3
"""
============================================================================
MICROSOFT GRAPH TOOLS — DECORATOR PATTERN
============================================================================
@tool decorator pattern — each method auto-routes through Matimo.

SETUP:  Set MICROSOFT_GRAPH_ACCESS_TOKEN in .env
USAGE:  make microsoft-decorator
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_microsoft import get_tools_path

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


class MicrosoftGraphService:
    """Microsoft Graph operations via the @tool decorator pattern."""

    @tool("ms_search_knowledge")
    async def search_knowledge(self, query: str, top: int = 10):
        ...

    @tool("ms_get_email")
    async def get_email(self, top: int = 10, filter: str | None = None):
        ...

    @tool("ms_list_files")
    async def list_files(self, drive_id: str, item_id: str = "root", top: int = 20):
        ...


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Microsoft Graph Tools — Decorator Pattern         ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("MICROSOFT_GRAPH_ACCESS_TOKEN"):
        print("❌  MICROSOFT_GRAPH_ACCESS_TOKEN not set in .env")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    set_global_matimo_instance(matimo)
    tools = [t for t in matimo.list_tools() if t.name.startswith("ms_")]
    print(f"✅  Loaded {len(tools)} Microsoft Graph tools\n")

    svc = MicrosoftGraphService()

    print("🔍  Searching organizational knowledge for 'quarterly report'…")
    result = await svc.search_knowledge(query="quarterly report", top=3)
    for hit in (result.get("results") or [])[:3]:
        print(f"   • {hit.get('name')} — {hit.get('web_url')}")

    print("\n📥  Listing inbox (top 3, unread)…")
    result = await svc.get_email(top=3, filter="isRead eq false")
    for msg in (result.get("messages") or [])[:3]:
        print(f"   • \"{msg.get('subject')}\" — from {msg.get('from')}")

    print("\n" + "═" * 60)
    print("✨  Decorator Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
