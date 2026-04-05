#!/usr/bin/env python3
"""
============================================================================
NOTION TOOLS — FACTORY PATTERN
============================================================================
Direct tool execution via Matimo.init() — no LLM, deterministic calls.

SETUP:  Set NOTION_API_KEY in .env (https://www.notion.so/my-integrations)
        Share pages/databases with the integration.
USAGE:  make notion-factory
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_notion import get_tools_path

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Notion Tools — Factory Pattern                     ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("NOTION_API_KEY"):
        print("❌  NOTION_API_KEY not set in .env")
        print("    Get one from: https://www.notion.so/my-integrations")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    tools = [t for t in matimo.list_tools() if t.name.startswith("notion")]
    print(f"✅  Loaded {len(tools)} Notion tools\n")
    print("═" * 60)

    # ── Example 1: Search ─────────────────────────────────────────────────────
    print("\n1️⃣   Searching Notion for 'project'…")
    result = await matimo.execute("notion-search", {"query": "project"})
    data = (result or {}).get("data", result) or {}
    results = data.get("results", [])
    if results:
        print(f"   ✅  {len(results)} result(s):")
        for r in results[:3]:
            title = ""
            if r.get("object") == "page":
                props = r.get("properties", {})
                title_prop = props.get("title") or props.get("Name") or {}
                title_parts = title_prop.get("title", []) if isinstance(title_prop, dict) else []
                title = "".join(t.get("plain_text", "") for t in title_parts)
            print(f"      • [{r['object']}] {title or r.get('id', '?')}")
    else:
        print(f"   ℹ️   No results or error: {str(data)[:100]}")

    # ── Example 2: List databases ─────────────────────────────────────────────
    print("\n2️⃣   Listing databases…")
    result = await matimo.execute("notion-list-databases", {})
    data = (result or {}).get("data", result) or {}
    dbs = data.get("results", [])
    if dbs:
        print(f"   ✅  {len(dbs)} database(s):")
        for db in dbs[:3]:
            title_arr = db.get("title", [])
            name = "".join(t.get("plain_text", "") for t in title_arr) if title_arr else db.get("id", "?")
            print(f"      • {name}")
    else:
        print(f"   ℹ️   No databases shared with this integration")

    print("\n" + "═" * 60)
    print("✨  Factory Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
