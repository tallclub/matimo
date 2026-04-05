#!/usr/bin/env python3
"""
============================================================================
NOTION TOOLS — DECORATOR PATTERN
============================================================================
@tool decorator pattern — each method auto-routes through Matimo.

SETUP:  Set NOTION_API_KEY in .env
USAGE:  make notion-decorator
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_notion import get_tools_path

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


class NotionService:
    """Notion workspace operations via the @tool decorator pattern."""

    @tool("notion-search")
    async def search(self, query: str):
        ...

    @tool("notion-list-databases")
    async def list_databases(self):
        ...

    @tool("notion-create-page")
    async def create_page(self, parent_id: str, title: str, content: str = ""):
        ...

    @tool("notion-get-page")
    async def get_page(self, page_id: str):
        ...


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Notion Tools — Decorator Pattern                   ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("NOTION_API_KEY"):
        print("❌  NOTION_API_KEY not set in .env")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    set_global_matimo_instance(matimo)
    tools = [t for t in matimo.list_tools() if t.name.startswith("notion")]
    print(f"✅  Loaded {len(tools)} Notion tools\n")

    svc = NotionService()

    print("🔍  Searching for 'meeting'…")
    result = await svc.search(query="meeting")
    data = (result or {}).get("data", result) or {}
    for r in (data.get("results") or [])[:3]:
        print(f"   • [{r['object']}] {r.get('id', '?')}")

    print("\n🗄️   Listing databases…")
    result = await svc.list_databases()
    data = (result or {}).get("data", result) or {}
    for db in (data.get("results") or [])[:3]:
        title_arr = db.get("title", [])
        name = "".join(t.get("plain_text", "") for t in title_arr) if title_arr else db.get("id", "?")
        print(f"   • {name}")

    print("\n" + "═" * 60)
    print("✨  Decorator Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
