#!/usr/bin/env python3
"""
============================================================================
TWILIO TOOLS - FACTORY PATTERN EXAMPLE
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
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_FROM_NUMBER=+15557122661
   TWILIO_TO_NUMBER=+15558675310

2. Get Twilio credentials:
   - Go to: https://console.twilio.com
   - Account SID and Auth Token are on the dashboard
   - Buy a phone number or use your trial number as TWILIO_FROM_NUMBER
   - In trial mode, TWILIO_TO_NUMBER must be a verified caller ID
   - Matimo automatically handles base64 encoding — no extra steps required!

USAGE:
─────────────────────────────────────────────────────────────────────────
  make twilio-factory

AVAILABLE TOOLS:
─────────────────────────────────────────────────────────────────────────
1. twilio-send-sms
   Parameters: account_sid (required), to (required), from (required), body (required)
   Optional: status_callback
   Returns: Message resource with sid and status: queued

2. twilio-send-mms
   Parameters: account_sid (required), to (required), from (required), media_url (required)
   Optional: body, status_callback
   Returns: Message resource with sid and num_media: "1"

3. twilio-get-message
   Parameters: account_sid (required), message_sid (required)
   Returns: Full Message resource with current status

4. twilio-list-messages
   Parameters: account_sid (required)
   Optional: to, from, date_sent, page_size
   Returns: Paginated list of Message resources

============================================================================
"""

import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

try:
    from matimo_twilio import get_tools_path
    from matimo import Matimo
except ImportError:
    from matimo import Matimo
    get_tools_path = None

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def run_twilio_factory_examples() -> None:
    """Run factory pattern examples for Twilio messaging tools."""
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Twilio Tools - Factory Pattern                     ║")
    print("║     (Direct execution - simplest approach)             ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # Validate required environment variables
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    if not account_sid:
        print("❌ Error: TWILIO_ACCOUNT_SID not set in .env")
        print('   Set it: export TWILIO_ACCOUNT_SID="ACxxxxxxxxxx"')
        print("   Get it from: https://console.twilio.com")
        sys.exit(1)

    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not auth_token:
        print("❌ Error: TWILIO_AUTH_TOKEN not set in .env")
        print("   Set it: export TWILIO_AUTH_TOKEN=\"your_auth_token\"")
        print("   Get it from: https://console.twilio.com")
        sys.exit(1)

    from_number = os.environ.get("TWILIO_FROM_NUMBER")
    if not from_number:
        print("❌ Error: TWILIO_FROM_NUMBER not set in .env")
        print("   Set it: export TWILIO_FROM_NUMBER=\"+15557122661\"")
        print("   (Your Twilio phone number in E.164 format)")
        sys.exit(1)

    to_number = os.environ.get("TWILIO_TO_NUMBER")
    if not to_number:
        print("❌ Error: TWILIO_TO_NUMBER not set in .env")
        print("   Set it: export TWILIO_TO_NUMBER=\"+15558675310\"")
        print("   (In trial mode, must be a verified caller ID)")
        sys.exit(1)

    print("🔑 Account SID: Configured.")
    print(f"📤 From: {from_number}")
    print(f"📥 To:   {to_number}\n")

    # Initialize Matimo with auto-discovery to find all @matimo/* packages
    print("🚀 Initializing Matimo...")
    matimo = await Matimo.init(get_tools_path() if get_tools_path else None, auto_discover=True)

    all_tools = matimo.list_tools()
    twilio_tools = [t for t in all_tools if t.name.startswith("twilio-")]
    print(f"✅ Loaded {len(all_tools)} tools total")
    print(f"🔧 Found {len(twilio_tools)} Twilio tools: {', '.join([t.name for t in twilio_tools])}\n")

    print("════════════════════════════════════════════════════════════\n")
    print("Running Examples:")
    print("════════════════════════════════════════════════════════════\n")

    sent_message_sid: Optional[str] = None

    try:
        # ── EXAMPLE 1: List recent messages ──────────────────────────────────
        print("1️⃣   Listing recent messages...")
        list_result = await matimo.execute(
            "twilio-list-messages",
            {"account_sid": account_sid, "page_size": 5}
        )
        list_data = (list_result or {}).get("data", list_result) or {}

        if isinstance(list_data.get("messages"), list):
            messages = list_data["messages"]
            print(f"   ✅ Found {len(messages)} recent message(s)")
            for idx, msg in enumerate(messages[:3], 1):
                body_preview = (msg.get("body") or "")[:40]
                print(f"      {idx}. {msg.get('sid')} — {msg.get('direction')} — {msg.get('status')} — \"{body_preview}\"")
        else:
            print(f"   ℹ️  No messages found or unexpected response: {str(list_data)[:100]}")
        print()

        # ── EXAMPLE 2: Send SMS ───────────────────────────────────────────────
        print("2️⃣   Sending SMS message...")
        try:
            sms_result = await matimo.execute(
                "twilio-send-sms",
                {
                    "account_sid": account_sid,
                    "to": to_number,
                    "from": from_number,
                    "body": f"Hello from Matimo! Factory pattern test at {datetime.now().isoformat()}",
                }
            )
            sms_data = (sms_result or {}).get("data", sms_result) or {}

            if sms_data.get("sid"):
                sent_message_sid = sms_data["sid"]
                print("   ✅ SMS queued successfully!")
                print(f"      SID:    {sms_data['sid']}")
                print(f"      Status: {sms_data.get('status')}")
                print(f"      To:     {sms_data.get('to')}")
                print(f"      From:   {sms_data.get('from')}")
            else:
                print(f"   ❌ SMS failed: {str(sms_data)[:100]}")
        except Exception as sms_err:
            msg = str(sms_err) if isinstance(sms_err, Exception) else str(sms_err)
            print(f"   ⚠️   SMS skipped: {msg}")
            if from_number == to_number:
                print("   ℹ️  Tip: TWILIO_FROM_NUMBER and TWILIO_TO_NUMBER must be different numbers.")
                print("          In trial mode, TWILIO_TO_NUMBER must be a verified caller ID.")
        print()

        # ── EXAMPLE 3: Fetch the sent message ──────────────────────────────────
        if sent_message_sid:
            print("3️⃣   Fetching the sent message...")
            try:
                fetch_result = await matimo.execute(
                    "twilio-get-message",
                    {"account_sid": account_sid, "message_sid": sent_message_sid}
                )
                fetch_data = (fetch_result or {}).get("data", fetch_result) or {}

                if fetch_data.get("sid"):
                    print("   ✅ Message fetched!")
                    print(f"      SID:          {fetch_data['sid']}")
                    print(f"      Status:       {fetch_data.get('status')}")
                    print(f"      Direction:    {fetch_data.get('direction')}")
                    print(f"      Num Segments: {fetch_data.get('num_segments')}")
                    print(f"      Date Created: {fetch_data.get('date_created')}")
                else:
                    print(f"   ❌ Failed to fetch message: {str(fetch_data)[:100]}")
            except Exception as fetch_err:
                print(f"   ⚠️   Fetch skipped: {str(fetch_err)}")
            print()
        else:
            print("3️⃣   Fetching sent message — skipped (no SMS was queued)")
            print()

        # ── EXAMPLE 4: List messages filtered by recipient ────────────────────
        print("4️⃣   Listing messages filtered by recipient...")
        filtered_result = await matimo.execute(
            "twilio-list-messages",
            {"account_sid": account_sid, "to": to_number, "page_size": 5}
        )
        filtered_data = (filtered_result or {}).get("data", filtered_result) or {}

        if isinstance(filtered_data.get("messages"), list):
            print(f"   ✅ Found {len(filtered_data['messages'])} message(s) sent to {to_number}")
        else:
            print(f"   ℹ️  Response: {str(filtered_data)[:100]}")
        print()

    except Exception as error:
        print(f"❌ Error: {str(error)}")
        sys.exit(1)

    print("════════════════════════════════════════════════════════════")
    print("✨ Factory Pattern Example Complete!")
    print("════════════════════════════════════════════════════════════\n")


def main() -> None:
    """Run the async main function."""
    asyncio.run(run_twilio_factory_examples())


if __name__ == "__main__":
    main()
