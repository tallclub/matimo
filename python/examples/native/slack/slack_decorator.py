#!/usr/bin/env python3
"""
============================================================================
SLACK TOOLS — DECORATOR PATTERN
============================================================================

PATTERN: @tool Decorator
────────────────────────────────────────────────────────────────────────────
Wraps Matimo tool calls in a class using the @tool("tool-name") decorator.
The decorator intercepts method calls and routes them through Matimo
automatically — the method body is never executed.

Use this pattern when:
  ✅ Building class-based applications or services
  ✅ Encapsulating tool logic in strongly-typed wrappers
  ✅ Combining multiple tools in a single service layer
  ✅ Object-oriented design

SETUP:
────────────────────────────────────────────────────────────────────────────
  Same as factory — set SLACK_BOT_TOKEN in .env

USAGE:
────────────────────────────────────────────────────────────────────────────
  make slack-decorator
  # or
  uv run python slack/slack_decorator.py

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_slack import get_tools_path

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


# ---------------------------------------------------------------------------
# Service class — each method is auto-routed to the matching Matimo tool
# ---------------------------------------------------------------------------

class SlackService:
    """High-level Slack service using the @tool decorator pattern."""

    @tool("slack-list-channels")
    async def list_channels(self, types: str = "public_channel,private_channel", limit: int = 20):
        """Decorator auto-calls matimo.execute('slack-list-channels', {...})."""
        ...

    @tool("slack-send-message")
    async def send_message(self, channel: str, text: str):
        """Decorator auto-calls matimo.execute('slack-send-message', {...})."""
        ...

    @tool("slack_get_channel_history")
    async def get_history(self, channel: str, limit: int = 5):
        """Decorator auto-calls matimo.execute('slack_get_channel_history', {...})."""
        ...

    @tool("slack_set_channel_topic")
    async def set_topic(self, channel: str, topic: str):
        """Decorator auto-calls matimo.execute('slack_set_channel_topic', {...})."""
        ...

    @tool("slack_add_reaction")
    async def add_reaction(self, channel: str, timestamp: str, name: str):
        """Decorator auto-calls matimo.execute('slack_add_reaction', {...})."""
        ...


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Slack Tools — Decorator Pattern                    ║")
    print("║     (@tool decorators for automatic execution)         ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    bot_token = os.environ.get("SLACK_BOT_TOKEN")
    if not bot_token:
        print("❌  SLACK_BOT_TOKEN not set in .env")
        sys.exit(1)

    print("🤖  Bot token: configured\n")

    # ── Initialise Matimo and register globally for the decorator ────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(get_tools_path())
    set_global_matimo_instance(matimo)

    slack_tools = [t for t in matimo.list_tools() if t.name.startswith("slack")]
    print(f"✅  Loaded {len(slack_tools)} Slack tools\n")

    service = SlackService()

    print("═" * 60 + "\n")

    # ── Example 1: List channels ──────────────────────────────────────────────
    print("📋  Example 1: List Channels")
    print("─" * 60)
    result = await service.list_channels(limit=10)
    data = (result or {}).get("data", result) or {}
    channels = data.get("channels", []) if data.get("ok") else []

    if channels:
        print(f"✅  Found {len(channels)} channel(s):")
        for ch in channels[:5]:
            print(f"   • #{ch['name']} ({ch['id']})")
        first_channel = channels[0]["id"]
        first_name = channels[0]["name"]
    else:
        print(f"❌  {data.get('error', 'unknown error')}")
        first_channel = os.environ.get("SLACK_CHANNEL_ID", "")
        first_name = first_channel

    # ── Example 2: Send a message ─────────────────────────────────────────────
    print(f"\n💬  Example 2: Send Message to #{first_name}")
    print("─" * 60)
    if first_channel:
        result = await service.send_message(
            channel=first_channel,
            text=f"👋 Hello from Matimo! Decorator pattern — {__import__('datetime').datetime.utcnow().isoformat()}Z",
        )
        r = (result or {}).get("data", result) or {}
        if r.get("ok"):
            print(f"✅  Sent — ts={r.get('ts')}")
        else:
            print(f"❌  {r.get('error', 'unknown error')}")
    else:
        print("⚠️   Skipped — no channel available")

    # ── Example 3: Get history ────────────────────────────────────────────────
    print(f"\n📜  Example 3: Get Channel History from #{first_name}")
    print("─" * 60)
    if first_channel:
        result = await service.get_history(channel=first_channel, limit=3)
        r = (result or {}).get("data", result) or {}
        msgs = r.get("messages", []) if r.get("ok") else []
        if msgs:
            print(f"✅  {len(msgs)} message(s):")
            for msg in msgs[:3]:
                preview = (msg.get("text") or "")[:60]
                print(f"   [{msg.get('ts')}] {preview}…")
        else:
            print(f"❌  {r.get('error', 'no messages')}")
    else:
        print("⚠️   Skipped — no channel available")

    # ── Example 4: Set topic ──────────────────────────────────────────────────
    print(f"\n🏷️   Example 4: Set Channel Topic for #{first_name}")
    print("─" * 60)
    if first_channel:
        result = await service.set_topic(
            channel=first_channel,
            topic="🎯 Matimo Testing — Decorator Pattern",
        )
        r = (result or {}).get("data", result) or {}
        if r.get("ok"):
            print("✅  Topic updated")
        else:
            print(f"❌  {r.get('error', 'unknown error')}")
    else:
        print("⚠️   Skipped — no channel available")

    print("\n" + "═" * 60)
    print("✨  Decorator Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
