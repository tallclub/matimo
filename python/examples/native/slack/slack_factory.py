#!/usr/bin/env python3
"""
============================================================================
SLACK TOOLS - FACTORY PATTERN EXAMPLE
============================================================================

PATTERN: SDK Factory Pattern
─────────────────────────────────────────────────────────────────────────
Direct tool execution via MatimoInstance - the simplest way to use tools.

Use this pattern when:
✅ Building simple scripts or CLI tools
✅ Direct API calls without abstraction
✅ Quick prototyping
✅ One-off tool execution

SETUP:
─────────────────────────────────────────────────────────────────────────
1. Create .env file in project root:
   SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx

2. Get a Slack bot token:
   - Go to: https://api.slack.com/apps
   - Create a new app or select existing
   - OAuth & Permissions → Install app to workspace
   - Copy "Bot User OAuth Token"
   - Required scopes: chat:write, channels:read, conversations:history

USAGE:
─────────────────────────────────────────────────────────────────────────
  export SLACK_BOT_TOKEN=xoxb-xxxx
  python slack_factory.py --channel=C123456

AVAILABLE TOOLS:
─────────────────────────────────────────────────────────────────────────
1. slack-send-message
   Parameters: channel (required), text (required), [blocks]
   Returns: Message timestamp and channel ID
   Example: Send a message to #general channel

2. slack-list-channels
   Parameters: [types], [limit], [cursor]
   Returns: List of channels, DMs, and groups
   Types: public_channel, private_channel, mpim, im

3. slack_create_channel
   Parameters: name (required), [is_private]
   Returns: Channel object with ID and name
   Example: Create a new public or private channel

4. slack_join_channel
   Parameters: channel (required)
   Returns: { ok: true/false }
   Example: Bot joins a public channel

5. slack_set_channel_topic
   Parameters: channel (required), topic (required)
   Returns: { ok: true/false, topic }
   Example: Set channel description/topic

6. slack_get_channel_history
   Parameters: channel (required), [limit], [oldest], [latest], [cursor]
   Returns: Messages array with pagination
   Example: Get recent messages from channel

And more...

============================================================================
"""

import asyncio
import os
import sys
from datetime import datetime

from dotenv import load_dotenv

from matimo import Matimo

# Load environment variables from .env file
load_dotenv()


async def run_factory_pattern_examples() -> None:
    """
    Run factory pattern examples
    """
    # Parse CLI arguments
    args = sys.argv[1:]
    channel_id = os.getenv("SLACK_CHANNEL_ID", "C0000000000")

    for arg in args:
        if arg.startswith("--channel:"):
            channel_id = arg.split(":", 1)[1]
        elif arg.startswith("--channel="):
            channel_id = arg.split("=", 1)[1]

    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Slack Tools - Factory Pattern                      ║")
    print("║     (Direct execution - simplest approach)             ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    bot_token = os.getenv("SLACK_BOT_TOKEN")
    if not bot_token:
        print("❌ Error: SLACK_BOT_TOKEN not set in .env")
        print("   Set it: export SLACK_BOT_TOKEN=\"xoxb-xxxx\"")
        print("   Get one from: https://api.slack.com/apps")
        sys.exit(1)

    print("🤖 Bot Token: configured")
    print(f"📍 Target Channel: {channel_id}\n")

    # Initialize Matimo with auto-discovery to find all @matimo/* packages
    print("🚀 Initializing Matimo...")
    matimo = await Matimo.init(auto_discover=True)

    all_tools = matimo.list_tools()
    print(f"✅ Loaded {len(all_tools)} tools\n")

    # Get Slack tools
    slack_tools = [t for t in all_tools if t.name.startswith("slack")]
    print(f"🔧 Found {len(slack_tools)} Slack tools\n")

    # List available channels and use first one if default doesn't exist
    print("📋 Finding an available channel...")
    list_result = await matimo.execute(
        "slack-list-channels",
        {
            "limit": 10,
            "types": "public_channel,private_channel",
        },
    )
    list_data = list_result.get("data", list_result) if isinstance(list_result, dict) else list_result
    active_channel = channel_id

    if (
        isinstance(list_data, dict)
        and list_data.get("ok") is True
        and list_data.get("channels")
    ):
        channels = list_data.get("channels", [])
        default_channel_exists = any(ch.get("id") == channel_id for ch in channels)
        if not default_channel_exists:
            active_channel = channels[0].get("id")
            print(
                f"   Using first available channel: #{channels[0].get('name')} ({active_channel})"
            )
        else:
            channel_obj = next((ch for ch in channels if ch.get("id") == channel_id), None)
            if channel_obj:
                print(
                    f"   Using specified channel: #{channel_obj.get('name')} ({channel_id})"
                )
    else:
        print(f"   ⚠️  Could not list channels, using default: {channel_id}")
    print()

    print("════════════════════════════════════════════════════════════\n")
    print("Running Examples:")
    print("════════════════════════════════════════════════════════════\n")

    try:
        # Example 1: Send a message
        print("1️⃣  Sending message to channel...")
        send_result = await matimo.execute(
            "slack-send-message",
            {
                "channel": active_channel,
                "text": f"🤖 Factory Pattern test message at {datetime.now().isoformat()}",
            },
        )
        # Slack API returns {ok: true/false, ...} or wrapped in data
        send_data = send_result.get("data", send_result) if isinstance(send_result, dict) else send_result
        if isinstance(send_data, dict) and send_data.get("ok") is True:
            print("   ✅ Message sent successfully")
            print(f"      Channel: {send_data.get('channel')}")
            print(f"      Timestamp: {send_data.get('ts')}\n")
        else:
            error_msg = send_data.get("error", "Unknown error") if isinstance(send_data, dict) else "Unknown error"
            print(f"   ❌ Failed: {error_msg}")
            print(f"      Response: {send_data}\n")

        # Example 2: List channels
        print("2️⃣  Listing channels...")
        list_result = await matimo.execute(
            "slack-list-channels",
            {
                "limit": 5,
                "types": "public_channel,private_channel",
            },
        )
        list_data = list_result.get("data", list_result) if isinstance(list_result, dict) else list_result
        if isinstance(list_data, dict) and list_data.get("ok") is True and list_data.get("channels"):
            channels = list_data.get("channels", [])
            print(f"   ✅ Found {len(channels)} channels")
            for ch in channels[:3]:
                print(f"      • #{ch.get('name')} ({ch.get('id')})")
            print()
        else:
            error_msg = list_data.get("error", "Unknown error") if isinstance(list_data, dict) else "Unknown error"
            print(f"   ❌ Failed: {error_msg}")
            print(f"      Response: {list_data}\n")

        # Example 3: Set channel topic
        print("3️⃣  Setting channel topic...")
        topic_result = await matimo.execute(
            "slack_set_channel_topic",
            {
                "channel": active_channel,
                "topic": "🎯 Matimo Testing Channel - Factory Pattern Example",
            },
        )
        topic_data = topic_result.get("data", topic_result) if isinstance(topic_result, dict) else topic_result
        if isinstance(topic_data, dict) and topic_data.get("ok") is True:
            print("   ✅ Topic set successfully\n")
        else:
            error_msg = topic_data.get("error", "Unknown error") if isinstance(topic_data, dict) else "Unknown error"
            print(f"   ❌ Failed: {error_msg}")
            print(f"      Response: {topic_data}\n")

        # Example 4: Get channel history
        print("4️⃣  Retrieving channel history...")
        history_result = await matimo.execute(
            "slack_get_channel_history",
            {
                "channel": active_channel,
                "limit": 5,
            },
        )
        history_data = history_result.get("data", history_result) if isinstance(history_result, dict) else history_result
        if isinstance(history_data, dict) and history_data.get("ok") is True and history_data.get("messages"):
            messages = history_data.get("messages", [])
            print(f"   ✅ Retrieved {len(messages)} recent messages\n")
        else:
            error_msg = history_data.get("error", "Unknown error") if isinstance(history_data, dict) else "Unknown error"
            print(f"   ❌ Failed: {error_msg}")
            print(f"      Response: {history_data}\n")
    except Exception as error:
        print(f"❌ Error: {error}")
        sys.exit(1)

    print("════════════════════════════════════════════════════════════")
    print("✨ Factory Pattern Example Complete!")
    print("════════════════════════════════════════════════════════════\n")


async def main() -> None:
    """Entry point for pyproject.toml console script."""
    await run_factory_pattern_examples()


if __name__ == "__main__":
    asyncio.run(main())
