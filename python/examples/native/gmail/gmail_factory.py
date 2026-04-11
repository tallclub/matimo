#!/usr/bin/env python3
"""
============================================================================
GMAIL TOOLS - FACTORY PATTERN EXAMPLE
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
   GMAIL_ACCESS_TOKEN=ya29.xxxxxxxxxxxxx

2. Get a Gmail access token:
   - Use OAuth2Handler to authenticate with Google
   - Request these scopes:
     • https://www.googleapis.com/auth/gmail.send (send emails)
     • https://www.googleapis.com/auth/gmail.readonly (read emails)
     • https://www.googleapis.com/auth/gmail.modify (drafts, delete)

USAGE:
─────────────────────────────────────────────────────────────────────────
  export GMAIL_ACCESS_TOKEN=your_token_here
  make gmail-factory

AVAILABLE TOOLS:
─────────────────────────────────────────────────────────────────────────
1. gmail-send-email
   Parameters: to (required), subject (required), body (required), [cc], [bcc]
   Returns: { id, threadId, labelIds }
   Example: Send an email to someone@example.com

2. gmail-list-messages
   Parameters: [query], [maxResults], [pageToken]
   Returns: { messages[], nextPageToken }
   Example queries: "is:unread", "from:someone@example.com", "has:attachment"

3. gmail-get-message
   Parameters: messageId, [format]
   Format options: "minimal" (lightweight), "full" (complete with headers)
   Returns: { payload { headers, body }, snippet }

4. gmail-create-draft
   Parameters: to, subject, body, [cc], [bcc]
   Returns: { id, message { id, threadId } }
   Note: Draft is created but not sent - user edits then sends manually

5. gmail-delete-message
   Parameters: messageId
   Returns: { success }
   Note: Permanently deletes the message

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

try:
    from matimo_gmail import get_tools_path
    from matimo import Matimo
except ImportError:
    from matimo import Matimo
    get_tools_path = None

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def run_factory_pattern_examples() -> None:
    """Run factory pattern examples."""
    # Parse CLI arguments
    user_email = os.environ.get("TEST_EMAIL", "test@example.com")

    for arg in sys.argv[1:]:
        if arg.startswith("--email:"):
            user_email = arg.split(":", 1)[1]
        elif arg.startswith("--email="):
            user_email = arg.split("=", 1)[1]

    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Gmail Tools - Factory Pattern                      ║")
    print("║     (Direct execution - simplest approach)             ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    access_token = os.environ.get("GMAIL_ACCESS_TOKEN")
    if not access_token:
        print("❌ Error: GMAIL_ACCESS_TOKEN not set in .env")
        print('   Set it: export GMAIL_ACCESS_TOKEN="ya29...."')
        print("   Or get a token from: https://developers.google.com/oauthplayground")
        sys.exit(1)

    print(f"📧 User Email: {user_email}\n")

    try:
        # Initialize Matimo
        print("🚀 Initializing Matimo...")
        matimo = await Matimo.init(get_tools_path() if get_tools_path else None, auto_discover=True)

        matimo_tools = matimo.list_tools()
        print(f"📦 Loaded {len(matimo_tools)} tools\n")

        # Filter to Gmail tools
        gmail_tools = [t for t in matimo_tools if t.name.startswith("gmail-")]
        print(f"📧 Found {len(gmail_tools)} Gmail tools\n")

        print("🧪 Testing Gmail Tools with Factory Pattern")
        print("═" * 60)

        # Example 1: List Messages (GET emails)
        print("\n1️⃣  List Your Recent Messages")
        print("─" * 60)
        try:
            list_result = await matimo.execute(
                "gmail-list-messages",
                {"maxResults": 5, "GMAIL_ACCESS_TOKEN": access_token}
            )

            if isinstance(list_result, dict):
                data = list_result
                messages = None
                if data.get("data") and isinstance(data["data"].get("messages"), list):
                    messages = data["data"]["messages"]
                elif isinstance(data.get("messages"), list):
                    messages = data["messages"]

                if messages:
                    print(f"✅ Found {len(messages)} recent messages:")
                    for idx, msg in enumerate(messages[:3], 1):
                        print(f"   {idx}. ID: {msg.get('id')}")
                        print(f"      Thread: {msg.get('threadId')}")
                else:
                    print("⚠️  No messages found or unexpected format")
        except Exception as error:
            print(f"❌ List failed: {str(error)}")

        # Example 2: Send Email
        print("\n2️⃣  Send Email")
        print("─" * 60)
        try:
            send_result = await matimo.execute(
                "gmail-send-email",
                {
                    "to": user_email,
                    "subject": "Hello from Matimo Factory Pattern",
                    "body": "This is a test email from the Factory pattern",
                    "GMAIL_ACCESS_TOKEN": access_token,
                }
            )

            if isinstance(send_result, dict):
                data = send_result
                message_id = None
                thread_id = None

                if data.get("data") and data["data"].get("id"):
                    message_id = data["data"]["id"]
                    thread_id = data["data"].get("threadId")
                elif data.get("id"):
                    message_id = data["id"]
                    thread_id = data.get("threadId")

                if message_id:
                    print("✅ Email sent successfully!")
                    print(f"   Message ID: {message_id}")
                    print(f"   Thread ID: {thread_id or 'N/A'}")
                else:
                    print("⚠️  Unexpected response format")
        except Exception as error:
            print(f"❌ Send failed: {str(error)}")

        # Example 3: Create Draft
        print("\n3️⃣  Create Draft")
        print("─" * 60)
        try:
            draft_result = await matimo.execute(
                "gmail-create-draft",
                {
                    "to": user_email,
                    "subject": "Factory Pattern Draft",
                    "body": "This is a draft created by the Factory pattern",
                    "GMAIL_ACCESS_TOKEN": access_token,
                }
            )

            if isinstance(draft_result, dict):
                data = draft_result
                draft_id = None
                message_id = None

                if data.get("data") and data["data"].get("id"):
                    draft_id = data["data"]["id"]
                    message_id = data["data"].get("message", {}).get("id")
                elif data.get("id"):
                    draft_id = data["id"]

                if draft_id:
                    print("✅ Draft created successfully!")
                    print(f"   Draft ID: {draft_id}")
                    print(f"   Message ID: {message_id or 'N/A'}")
                else:
                    print("⚠️  Unexpected response format")
        except Exception as error:
            print(f"❌ Draft failed: {str(error)}")

        print("\n" + "═" * 60)
        print("✨ Factory Pattern Examples Complete!\n")
        print("Usage:")
        print("  make gmail-factory")
        print("  make gmail-factory -- --email:your-email@gmail.com\n")

    except Exception as error:
        print(f"❌ Error: {str(error)}")
        sys.exit(1)


def main() -> None:
    """Run the async main function."""
    asyncio.run(run_factory_pattern_examples())


if __name__ == "__main__":
    main()
