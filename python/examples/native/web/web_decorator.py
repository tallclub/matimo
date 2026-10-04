#!/usr/bin/env python3
"""
============================================================================
WEB TOOL — DECORATOR PATTERN
============================================================================

PATTERN: @tool Decorator
────────────────────────────────────────────────────────────────────────────
Wraps Matimo tool calls in a class using the @tool("tool-name") decorator.
The decorator intercepts method calls and routes them through Matimo
automatically — the method body is never executed.

Use this pattern when:
  ✅ Building class-based applications or services
  ✅ Encapsulating HTTP logic in strongly-typed wrappers
  ✅ Combining multiple API calls in a single service layer
  ✅ Object-oriented design

SETUP:
────────────────────────────────────────────────────────────────────────────
  No API key required for public APIs.

USAGE:
────────────────────────────────────────────────────────────────────────────
  uv run python web/web_decorator.py

NOTE: @tool sends the method's own parameter names as the tool's parameters,
so they must match the tool definition exactly (url, method, body, headers,
timeout), and only the arguments you pass are sent — Python defaults are not.

============================================================================
"""

import asyncio
import json
from pathlib import Path
from dotenv import load_dotenv

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


# ───────────────────────────────────────────────────────────────────────────
# Service class — each method is auto-routed to the matching Matimo tool
# ───────────────────────────────────────────────────────────────────────────

class APIClient:
    """High-level API client service using the @tool decorator pattern."""

    @tool("web")
    async def get(self, url: str, timeout: int) -> dict:
        """
        Decorator auto-calls matimo.execute('web', {'url': ..., 'timeout': ...}).

        Args:
            url: URL to fetch
            timeout: Request timeout in milliseconds

        Returns:
            Response content (parsed when JSON) and metadata
        """
        ...

    @tool("web")
    async def send(self, url: str, method: str, body: str, headers: dict) -> dict:
        """Send a request with a method and body, e.g. a JSON POST."""
        ...


# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Web Tool — Decorator Pattern                     ║")
    print("║     (@tool decorators for automatic execution)       ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Initialize Matimo and register globally for the decorator ────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    set_global_matimo_instance(matimo)
    print("✅  Matimo initialized\n")

    client = APIClient()

    try:
        # Example 1: GET JSON from public API
        print("1. Fetching user data from JSONPlaceholder\n")
        result1 = await client.get("https://jsonplaceholder.typicode.com/users/1", 30000)
        if result1.get("success"):
            content = result1.get("content", {})
            if isinstance(content, dict):
                print(f"Name: {content.get('name')}")
                print(f"Email: {content.get('email')}")
                print(f"Company: {content.get('company', {}).get('name')}")
            else:
                print(f"Content: {str(content)[:200]}")
        else:
            print(f"Error: {result1.get('error')}")
        print("---\n")

        # Example 2: POST request
        print("2. Making a POST request to echo service\n")
        body = json.dumps({"test": "data", "timestamp": "now"})
        result2 = await client.send(
            "https://httpbin.org/post",
            method="POST",
            body=body,
            headers={"Content-Type": "application/json"},
        )
        if result2.get("success"):
            print(f"Status: {result2.get('statusCode')}")
            content = result2.get("content", {})
            if isinstance(content, dict):
                json_echo = content.get("json", {})
                print(f"Echoed: {json_echo}")
            else:
                print(f"Response: {str(content)[:200]}")
        else:
            print(f"Error: {result2.get('error')}")
        print("---\n")

        # Example 3: GitHub API call
        print("3. Fetching GitHub repository info\n")
        result3 = await client.get("https://api.github.com/repos/tallclub/matimo", 30000)
        if result3.get("success"):
            print(f"Status: {result3.get('statusCode')}")
            content = result3.get("content", {})
            if isinstance(content, dict):
                print(f"Repository: {content.get('full_name')}")
                print(f"Stars: {content.get('stargazers_count', 0)}")
            else:
                print(f"Response: {str(content)[:200]}")
        else:
            print(f"Error: {result3.get('error')}")
        print("---\n")

        # Example 4: Fetch HTML
        print("4. Fetching HTML content\n")
        result4 = await client.get("https://www.example.com", 30000)
        if result4.get("success"):
            print(f"Status: {result4.get('statusCode')}")
            print(f"Content Type: {result4.get('contentType')}")
            print(f"Size: {result4.get('size')} bytes")
            content = result4.get("content", "")
            if isinstance(content, str):
                print(f"First 200 chars: {content[:200]}")
        else:
            print(f"Error: {result4.get('error')}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
