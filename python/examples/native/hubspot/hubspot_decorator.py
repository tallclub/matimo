#!/usr/bin/env python3
"""
============================================================================
HUBSPOT TOOLS — DECORATOR PATTERN
============================================================================
@tool decorator pattern — each method auto-routes through Matimo.

SETUP:  Set MATIMO_HUBSPOT_API_KEY in .env
USAGE:  make hubspot-decorator
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_hubspot import get_tools_path

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


class HubspotService:
    """HubSpot CRM operations via the @tool decorator pattern."""

    @tool("hubspot-list-contacts")
    async def list_contacts(self, limit: int = 10):
        ...

    @tool("hubspot-get-contact")
    async def get_contact(self, contact_id: str):
        ...

    @tool("hubspot-create-contact")
    async def create_contact(self, email: str, firstname: str = "", lastname: str = ""):
        ...

    @tool("hubspot-get-companies")
    async def get_companies(self, limit: int = 10):
        ...


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     HubSpot Tools — Decorator Pattern                  ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("MATIMO_HUBSPOT_API_KEY"):
        print("❌  MATIMO_HUBSPOT_API_KEY not set in .env")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    set_global_matimo_instance(matimo)
    tools = [t for t in matimo.list_tools() if t.name.startswith("hubspot")]
    print(f"✅  Loaded {len(tools)} HubSpot tools\n")

    svc = HubspotService()

    print("📋  Listing contacts…")
    result = await svc.list_contacts(limit=3)
    data = (result or {}).get("data", result) or {}
    contacts = data.get("results", data.get("contacts", []))
    for c in (contacts or [])[:3]:
        props = c.get("properties", {})
        print(f"   • {props.get('firstname', '')} {props.get('lastname', '')} — {props.get('email', c.get('id', ''))}")

    print("\n🏢  Listing companies…")
    result = await svc.get_companies(limit=3)
    data = (result or {}).get("data", result) or {}
    companies = data.get("results", data.get("companies", []))
    for c in (companies or [])[:3]:
        props = c.get("properties", {})
        print(f"   • {props.get('name', c.get('id', '?'))}")

    print("\n" + "═" * 60)
    print("✨  Decorator Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
