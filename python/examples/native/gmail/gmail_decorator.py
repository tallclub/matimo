#!/usr/bin/env python3
"""
============================================================================
GMAIL TOOLS — DECORATOR PATTERN
============================================================================
@tool decorator pattern — each method auto-routes through Matimo.

SETUP:  Set GMAIL_ACCESS_TOKEN in .env
USAGE:  make gmail-decorator
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_gmail import get_tools_path

from matimo import Matimo, MatimoError
from matimo.decorators import set_global_matimo_instance, tool

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


class GmailService:
    """Gmail operations via the @tool decorator pattern."""

    # Parameter names below intentionally match the YAML param keys (maxResults,
    # labelIds, messageId, attachmentId) exactly, since @tool maps Python arg
    # names 1:1 to tool params with no snake_case → camelCase conversion.
    @tool("gmail-list-messages")
    async def list_messages(self, maxResults: int = 10, labelIds: str = "INBOX"):
        ...

    @tool("gmail-send-email")
    async def send_email(self, to: str, subject: str, body: str):
        ...

    @tool("gmail-get-message")
    async def get_message(self, messageId: str, format: str = "full"):
        ...

    @tool("gmail-get-attachment")
    async def get_attachment(self, messageId: str, attachmentId: str):
        ...


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Gmail Tools — Decorator Pattern                    ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("GMAIL_ACCESS_TOKEN"):
        print("❌  GMAIL_ACCESS_TOKEN not set in .env")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    set_global_matimo_instance(matimo)
    tools = [t for t in matimo.list_tools() if t.name.startswith("gmail")]
    print(f"✅  Loaded {len(tools)} Gmail tools\n")

    svc = GmailService()

    print("📥  Listing inbox (top 3)…")
    try:
        result = await svc.list_messages(maxResults=3)
        data = (result or {}).get("data", result) or {}
        for msg in (data.get("messages") or [])[:3]:
            print(f"   • {msg.get('id')}")
    except Exception as error:
        print(f"   ⚠️  List failed: {describe_error(error)}")

    print("\n📎  Looking for an attachment on a recent message…")
    try:
        # NOTE: no query="has:attachment" here — Gmail's `q` search param
        # requires a Google-verified OAuth app; unverified apps get a 403
        # even with gmail.readonly granted. Scan recent messages client-side.
        attach_search = await svc.list_messages(maxResults=10)
        attach_data = (attach_search or {}).get("data", attach_search) or {}
        candidates = attach_data.get("messages") or []

        found = None
        for candidate in candidates:
            message_result = await svc.get_message(messageId=candidate["id"], format="full")
            message_data = (message_result or {}).get("data", message_result) or {}
            parts = ((message_data.get("payload") or {}).get("parts")) or []
            attachment_part = next(
                (p for p in parts if (p.get("body") or {}).get("attachmentId")), None
            )
            if attachment_part:
                found = (candidate["id"], attachment_part)
                break

        if not found:
            print(f"   Scanned {len(candidates)} recent messages — none had an attachment.")
        else:
            message_id, attachment_part = found
            attachment_result = await svc.get_attachment(
                messageId=message_id,
                attachmentId=attachment_part["body"]["attachmentId"],
            )
            attachment_data = (attachment_result or {}).get("data", attachment_result) or {}
            print(f"   ✅ Attachment size: {attachment_data.get('size')} bytes")
    except Exception as error:
        print(f"   ⚠️  Attachment lookup failed: {describe_error(error)}")

    print("\n" + "═" * 60)
    print("✨  Decorator Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
