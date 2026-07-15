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

6. gmail-get-attachment
   Parameters: messageId (required), attachmentId (required)
   Returns: { attachmentId, size, data } — data is base64url-encoded raw bytes
   Example: Fetch the raw bytes of an attachment found on a message

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

try:
    from matimo_gmail import get_tools_path
    from matimo import Matimo, MatimoError
except ImportError:
    from matimo import Matimo, MatimoError
    get_tools_path = None

load_dotenv(Path(__file__).parent.parent.parent / ".env")


def describe_error(error: Exception) -> str:
    """Render a MatimoError with its underlying HTTP status/body, not just the
    generic wrapper message — e.g. surfaces "401 Unauthorized: token expired"
    instead of just "HTTP error executing tool 'gmail-list-messages'"."""
    if isinstance(error, MatimoError) and error.details:
        status = error.details.get("status_code")
        body = error.details.get("body")
        extra = f" (status {status})" if status else ""
        if body:
            extra += f"\n   → {body}"
        return f"{error}{extra}"
    return str(error)


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
            print(f"❌ List failed: {describe_error(error)}")

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
            print(f"❌ Send failed: {describe_error(error)}")

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
            print(f"❌ Draft failed: {describe_error(error)}")

        # Example 4: Get Attachment
        print("\n4️⃣  Get Attachment")
        print("─" * 60)
        try:
            # NOTE: we deliberately do NOT use query="has:attachment" here.
            # Gmail's `q` search param requires an app that has completed
            # Google's OAuth verification review — unverified apps get a 403
            # ("Metadata scope does not support 'q' parameter") even with
            # gmail.readonly granted. Instead, scan recent messages
            # client-side for one that has an attachment.
            list_result = await matimo.execute(
                "gmail-list-messages",
                {"maxResults": 10, "GMAIL_ACCESS_TOKEN": access_token},
            )
            list_data = list_result.get("data", list_result) if isinstance(list_result, dict) else {}
            candidates = list_data.get("messages") if isinstance(list_data, dict) else None or []

            found = None
            for candidate in candidates:
                message_result = await matimo.execute(
                    "gmail-get-message",
                    {
                        "messageId": candidate["id"],
                        "format": "full",
                        "GMAIL_ACCESS_TOKEN": access_token,
                    },
                )
                message_data = (
                    message_result.get("data", message_result)
                    if isinstance(message_result, dict)
                    else {}
                )
                parts = (message_data.get("payload") or {}).get("parts") or []
                attachment_part = next(
                    (p for p in parts if (p.get("body") or {}).get("attachmentId")), None
                )
                if attachment_part:
                    found = (candidate["id"], attachment_part)
                    break

            if not found:
                print(f"ℹ️  Scanned {len(candidates)} recent messages — none had an attachment. Skipping.")
            else:
                message_id, attachment_part = found
                attachment_result = await matimo.execute(
                    "gmail-get-attachment",
                    {
                        "messageId": message_id,
                        "attachmentId": attachment_part["body"]["attachmentId"],
                        "GMAIL_ACCESS_TOKEN": access_token,
                    },
                )
                attachment_data = (
                    attachment_result.get("data", attachment_result)
                    if isinstance(attachment_result, dict)
                    else {}
                )
                print("✅ Attachment retrieved successfully!")
                print(f"   Filename: {attachment_part.get('filename') or '(unnamed)'}")
                print(f"   Size: {attachment_data.get('size')} bytes")
                print(f"   Base64url data length: {len(attachment_data.get('data') or '')} chars")
        except Exception as error:
            print(f"❌ Get attachment failed: {describe_error(error)}")

        print("\n" + "═" * 60)
        print("✨ Factory Pattern Examples Complete!\n")
        print("Usage:")
        print("  make gmail-factory")
        print("  make gmail-factory -- --email:your-email@gmail.com\n")

    except Exception as error:
        print(f"❌ Error: {describe_error(error)}")
        sys.exit(1)


def main() -> None:
    """Run the async main function."""
    asyncio.run(run_factory_pattern_examples())


if __name__ == "__main__":
    main()
