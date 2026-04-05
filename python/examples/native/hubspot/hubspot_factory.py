#!/usr/bin/env python3
"""
============================================================================
HUBSPOT TOOLS — FACTORY PATTERN
============================================================================
Direct tool execution via Matimo.init() — no LLM, deterministic calls.

SETUP:  Set MATIMO_HUBSPOT_API_KEY in .env (https://app.hubspot.com/private-apps)
USAGE:  make hubspot-factory
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_hubspot import get_tools_path

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     HubSpot Tools — Factory Pattern                    ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("MATIMO_HUBSPOT_API_KEY"):
        print("❌  MATIMO_HUBSPOT_API_KEY not set in .env")
        print("    Get one from: https://app.hubspot.com/private-apps")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    tools = [t for t in matimo.list_tools() if t.name.startswith("hubspot")]
    print(f"✅  Loaded {len(tools)} HubSpot tools\n")
    print("═" * 60)

    # ── Example 1: List contacts ──────────────────────────────────────────────
    print("\n1️⃣   Listing HubSpot contacts (top 5)…")
    result = await matimo.execute("hubspot-list-contacts", {"limit": 5})
    data = (result or {}).get("data", result) or {}
    contacts = data.get("results", data.get("contacts", []))
    if contacts:
        print(f"   ✅  {len(contacts)} contact(s):")
        for c in contacts[:3]:
            props = c.get("properties", {})
            print(f"      • {props.get('firstname', '')} {props.get('lastname', '')} — {props.get('email', '')}")
    else:
        print(f"   ℹ️   No contacts: {str(data)[:100]}")

    # ── Example 2: List companies ─────────────────────────────────────────────
    print("\n2️⃣   Listing HubSpot companies (top 3)…")
    result = await matimo.execute("hubspot-get-companies", {"limit": 3})
    data = (result or {}).get("data", result) or {}
    companies = data.get("results", data.get("companies", []))
    if companies:
        print(f"   ✅  {len(companies)} company/companies:")
        for c in companies[:3]:
            props = c.get("properties", {})
            print(f"      • {props.get('name', c.get('id', '?'))}")
    else:
        print(f"   ℹ️   No companies: {str(data)[:100]}")

    print("\n" + "═" * 60)
    print("✨  Factory Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
