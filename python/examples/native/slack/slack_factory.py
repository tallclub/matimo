#!/usr/bin/env python3
"""
============================================================================
SLACK TOOLS — FACTORY PATTERN
============================================================================

PATTERN: SDK Factory Pattern
────────────────────────────────────────────────────────────────────────────
Direct tool execution via Matimo.init() — the simplest way to call tools.
No LLM involved: you decide which tool to run and with what parameters.

Use this pattern when:
  ✅ Building simple scripts or CLI tools
  ✅ Direct API calls without LLM overhead
  ✅ Quick prototyping and testing
  ✅ One-off tool execution

AVAILABLE SLACK TOOLS:
────────────────────────────────────────────────────────────────────────────
  slack-send-message          Send a message to a channel
  slack-list-channels         List workspace channels
  slack_create_channel        Create a new channel
  slack_join_channel          Bot joins a channel
  slack_set_channel_topic     Update a channel's topic
  slack_get_channel_history   Get recent messages from a channel
  slack_add_reaction          Add emoji reaction to a message
  slack_remove_reaction       Remove emoji reaction
  slack_upload_file           Upload a file to a channel
  ... and more

SETUP:
────────────────────────────────────────────────────────────────────────────
  1. Copy .env.example → .env
  2. Set SLACK_BOT_TOKEN=xoxb-your-token
     Get one from: https://api.slack.com/apps
     Required scopes: chat:write, channels:read, channels:history, reactions:write

USAGE:
────────────────────────────────────────────────────────────────────────────
  make slack-factory
  # or
  uv run python slack/slack_factory.py
  # with a specific channel:
  uv run python slack/slack_factory.py --channel C1234567890

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_slack import get_tools_path

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def run() -> None:
    # ── Parse CLI args ────────────────────────────────────────────────────────
    channel_id = os.environ.get("SLACK_CHANNEL_ID", "")
    for arg in sys.argv[1:]:
        if arg.startswith("--channel="):
            channel_id = arg.split("=", 1)[1]
        elif arg.startswith("--channel"):
            channel_id = arg.split(":", 1)[-1] if ":" in arg else ""

    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Slack Tools — Factory Pattern                      ║")
    print("║     (Direct execution — simplest approach)             ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    bot_token = os.environ.get("SLACK_BOT_TOKEN")
    if not bot_token:
        print("❌  SLACK_BOT_TOKEN not set in .env")
        print("    Get one from: https://api.slack.com/apps")
        sys.exit(1)

    print(f"🤖  Bot token: {bot_token[:10]}…")

    # ── 1. Initialise Matimo with the Slack provider ──────────────────────────
    print("\n🚀  Initialising Matimo…")
    matimo = await Matimo.init(get_tools_path())
    slack_tools = [t for t in matimo.list_tools() if t.name.startswith("slack")]
    print(f"✅  Loaded {len(slack_tools)} Slack tools\n")

    # ── 2. Find a usable channel ──────────────────────────────────────────────
    print("📋  Listing channels to find an active one…")
    list_result = await matimo.execute(
        "slack-list-channels",
        {"limit": 10, "types": "public_channel,private_channel"},
    )
    data = (list_result or {}).get("data", list_result) or {}
    channels = data.get("channels", []) if data.get("ok") else []

    if channels and not channel_id:
        channel_id = channels[0]["id"]
        print(f"   Using first available channel: #{channels[0]['name']} ({channel_id})\n")
    elif channel_id:
        name = next((c["name"] for c in channels if c["id"] == channel_id), channel_id)
        print(f"   Using specified channel: #{name} ({channel_id})\n")
    else:
        print("   ⚠️  Could not determine a channel — set SLACK_CHANNEL_ID in .env\n")

    print("═" * 60)

    # ── Example 1: Send a message ─────────────────────────────────────────────
    print("\n1️⃣   Sending a message…")
    if channel_id:
        result = await matimo.execute(
            "slack-send-message",
            {
                "channel": channel_id,
                "text": f"🤖 Factory Pattern test — {__import__('datetime').datetime.utcnow().isoformat()}Z",
            },
        )
        r = (result or {}).get("data", result) or {}
        if r.get("ok"):
            print(f"   ✅  Message sent — ts={r.get('ts')}, channel={r.get('channel')}")
        else:
            print(f"   ❌  {r.get('error', 'unknown error')}")
    else:
        print("   ⚠️  Skipped — no channel ID")

    # ── Example 2: List channels ──────────────────────────────────────────────
    print("\n2️⃣   Listing channels…")
    r = (list_result or {}).get("data", list_result) or {}
    if r.get("ok") and channels:
        print(f"   ✅  Found {len(channels)} channel(s):")
        for ch in channels[:3]:
            print(f"      • #{ch['name']} ({ch['id']})")
    else:
        print(f"   ❌  {r.get('error', 'unknown error')}")

    # ── Example 3: Set channel topic ──────────────────────────────────────────
    print("\n3️⃣   Setting channel topic…")
    if channel_id:
        result = await matimo.execute(
            "slack_set_channel_topic",
            {
                "channel": channel_id,
                "topic": "🎯 Matimo Testing Channel — Factory Pattern",
            },
        )
        r = (result or {}).get("data", result) or {}
        if r.get("ok"):
            print("   ✅  Topic updated")
        else:
            print(f"   ❌  {r.get('error', 'unknown error')}")
    else:
        print("   ⚠️  Skipped — no channel ID")

    print("\n" + "═" * 60)
    print("✨  Factory Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
