#!/usr/bin/env python3
"""
============================================================================
MICROSOFT GRAPH TOOLS — FACTORY PATTERN EXAMPLE
============================================================================

PATTERN: SDK Factory Pattern
─────────────────────────────────────────────────────────────────────────
Direct tool execution via Matimo.execute() — the simplest way to use tools.

Use this pattern when:
✅ Building simple scripts or CLI tools
✅ Direct API calls without abstraction
✅ Quick prototyping
✅ One-off tool execution

SETUP:
─────────────────────────────────────────────────────────────────────────
1. Register an app in the Microsoft Entra admin center (https://entra.microsoft.com)
   and obtain a delegated Microsoft Graph access token. Common scopes:
     • Sites.Read.All / Files.Read.All     (search, read, list)
     • Mail.Read / Mail.Send               (mail)
     • ChannelMessage.Send                 (Teams)
     • Calendars.ReadWrite                 (calendar)
     • Files.ReadWrite / Sites.Manage.All  (uploads, SharePoint pages)

2. Create a .env file in project root:
   MICROSOFT_GRAPH_ACCESS_TOKEN=eyJ0eXAiOiJKV1Qi...

USAGE:
─────────────────────────────────────────────────────────────────────────
  export MICROSOFT_GRAPH_ACCESS_TOKEN=your_token_here
  make microsoft-factory
  make microsoft-factory -- --drive:<drive_id> --item:<folder_item_id>

AVAILABLE TOOLS:
─────────────────────────────────────────────────────────────────────────
1. ms_search_knowledge      Search SharePoint/OneDrive/sites — POST /search/query
2. ms_read_file             Read a file's contents — GET /drives/{id}/items/{id}/content
3. ms_list_files            List a folder's children — GET /drives/{id}/items/{id}/children
4. ms_get_email             List inbox messages — GET /me/messages
5. ms_send_email            Send an email (HIGH risk, requires approval)
6. ms_send_teams_message    Post to a Teams channel — POST /teams/{id}/channels/{id}/messages
7. ms_create_document       Upload a small file (≤4 MB) — PUT .../content
8. ms_create_calendar_event Create a calendar event, optionally a Teams meeting
9. ms_publish_to_sharepoint Create + publish a SharePoint page (HIGH risk, requires approval)

Note: unlike the TypeScript SDK, Matimo.execute() in Python RAISES a
MatimoError on failure rather than resolving `{ success: False, ... }` —
each example below wraps its call in try/except.
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_microsoft import get_tools_path

from matimo import Matimo
from matimo.errors import MatimoError

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def run_factory_pattern_examples() -> None:
    """Run factory pattern examples."""
    drive_id = os.environ.get("TEST_DRIVE_ID", "")
    item_id = os.environ.get("TEST_ITEM_ID", "root")

    for arg in sys.argv[1:]:
        if arg.startswith("--drive:"):
            drive_id = arg.split(":", 1)[1]
        elif arg.startswith("--item:"):
            item_id = arg.split(":", 1)[1]

    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Microsoft Graph Tools — Factory Pattern           ║")
    print("║     (Direct execution — simplest approach)            ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    access_token = os.environ.get("MICROSOFT_GRAPH_ACCESS_TOKEN")
    if not access_token:
        print("❌ Error: MICROSOFT_GRAPH_ACCESS_TOKEN not set in .env")
        print('   Set it: export MICROSOFT_GRAPH_ACCESS_TOKEN="eyJ0eXAi...."')
        print("   Get a token via the Entra admin center or Graph Explorer:")
        print("   https://developer.microsoft.com/en-us/graph/graph-explorer")
        sys.exit(1)

    credentials = {"MICROSOFT_GRAPH_ACCESS_TOKEN": access_token}

    print("🚀 Initializing Matimo...")
    matimo = await Matimo.init(get_tools_path(), auto_discover=True)

    matimo_tools = matimo.list_tools()
    ms_tools = [t for t in matimo_tools if t.name.startswith("ms_")]
    print(f"📦 Loaded {len(ms_tools)} Microsoft Graph tools:\n")
    for t in ms_tools:
        print(f"  • {t.name}")
        print(f"    {t.description.strip().splitlines()[0]}\n")

    print("🧪 Testing Microsoft Graph Tools with Factory Pattern")
    print("═" * 60)

    # Example 1: Search organizational knowledge
    print("\n🔍 Example 1: Search Organizational Knowledge")
    print("─" * 60)
    try:
        search_result = await matimo.execute(
            "ms_search_knowledge", {"query": "quarterly report", "top": 5}, credentials=credentials
        )
        results = search_result.get("results") or []
        print(f"✅ Found {search_result.get('total_count', 0)} result(s):")
        for idx, hit in enumerate(results[:3], 1):
            print(f"   {idx}. {hit.get('name')} — {hit.get('web_url')}")
    except MatimoError as error:
        print(f"❌ Search failed — {error.code.value}: {error}")

    # Example 2: List files in OneDrive/SharePoint
    print("\n📁 Example 2: List Files in a Drive Folder")
    print("─" * 60)
    if not drive_id:
        print("⊘ Skipping — pass --drive:<drive_id> or set TEST_DRIVE_ID to try this")
    else:
        try:
            list_result = await matimo.execute(
                "ms_list_files", {"drive_id": drive_id, "item_id": item_id, "top": 10}, credentials=credentials
            )
            items = list_result.get("items") or []
            print(f"✅ Found {len(items)} item(s):")
            for idx, item in enumerate(items[:5], 1):
                print(f"   {idx}. [{item.get('type')}] {item.get('name')}")
        except MatimoError as error:
            print(f"❌ List failed — {error.code.value}: {error}")

    # Example 3: List recent inbox messages
    print("\n📬 Example 3: List Recent Inbox Messages")
    print("─" * 60)
    try:
        email_result = await matimo.execute(
            "ms_get_email", {"top": 5, "filter": "isRead eq false"}, credentials=credentials
        )
        messages = email_result.get("messages") or []
        print(f"✅ Found {len(messages)} unread message(s):")
        for idx, msg in enumerate(messages[:3], 1):
            print(f"   {idx}. \"{msg.get('subject')}\" — from {msg.get('from')}")
    except MatimoError as error:
        print(f"❌ List failed — {error.code.value}: {error}")

    # Example 4: Create a calendar event with a Teams meeting
    print("\n📅 Example 4: Create a Calendar Event with a Teams Meeting")
    print("─" * 60)
    try:
        event_result = await matimo.execute(
            "ms_create_calendar_event",
            {
                "subject": "Matimo Factory Pattern — Sync",
                "start": "2026-06-15T09:00:00",
                "end": "2026-06-15T09:30:00",
                "timezone": "UTC",
                "is_online_meeting": True,
            },
            credentials=credentials,
        )
        print("✅ Event created!")
        print(f"   Event ID: {event_result.get('event_id')}")
        print(f"   Web link: {event_result.get('web_link')}")
        if event_result.get("join_url"):
            print(f"   Join URL: {event_result['join_url']}")
    except MatimoError as error:
        print(f"❌ Create event failed — {error.code.value}: {error}")

    print("\n" + "═" * 60)
    print("✨ Factory Pattern Examples Complete!\n")
    print("Usage:")
    print("  make microsoft-factory")
    print("  make microsoft-factory -- --drive:<drive_id> --item:<folder_item_id>\n")


def main() -> None:
    """Run the async main function."""
    asyncio.run(run_factory_pattern_examples())


if __name__ == "__main__":
    main()
