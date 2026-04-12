#!/usr/bin/env python3
"""
============================================================================
WEB TOOL — FACTORY PATTERN
============================================================================

PATTERN: SDK Factory Pattern
────────────────────────────────────────────────────────────────────────────
Direct tool execution via Matimo.init() — the simplest way to make HTTP requests.
Supports GET, POST, PUT, DELETE and returns parsed content.

Use this pattern when:
  ✅ Building simple scripts or CLI tools
  ✅ Direct HTTP requests without LLM overhead
  ✅ API testing and debugging
  ✅ Quick prototyping

SETUP:
────────────────────────────────────────────────────────────────────────────
  The web tool is built-in to Matimo core (no API key required for public APIs).
  Uses public APIs for examples (no authentication needed).

USAGE:
────────────────────────────────────────────────────────────────────────────
  uv run python web/web_factory.py

AVAILABLE WEB TOOL PARAMETERS:
────────────────────────────────────────────────────────────────────────────
  url       (str, required)    - URL to request
  method    (str, optional)    - HTTP method (GET, POST, PUT, DELETE)
  headers   (dict, optional)   - Custom headers
  body      (str, optional)    - Request body for POST/PUT
  timeout   (int, optional)    - Timeout in milliseconds

============================================================================
"""

import asyncio
import json
from pathlib import Path
from typing import Any, Dict
from dotenv import load_dotenv

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


def _parse_content(content: Any) -> str:
    """Parse content response, handling both dict and string formats."""
    if isinstance(content, dict):
        return json.dumps(content, indent=2)
    elif isinstance(content, str):
        return content
    else:
        return str(content)


async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Web Tool — Factory Pattern                        ║")
    print("║     (Direct execution — simplest approach)            ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Initialize Matimo with autoDiscover to find all tools ─────────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    all_tools = matimo.list_tools()
    print(f"✅  Loaded {len(all_tools)} tools\n")

    try:
        # Example 1: Fetch GitHub API (public endpoint) ────────────────────────
        print("1️⃣  Fetching GitHub API (public endpoint)\n")
        try:
            result1: Dict[str, Any] = await matimo.execute(
                "web",
                {
                    "url": "https://api.github.com/repos/tallclub/matimo",
                }
            )
            
            if result1.get("success", False):
                print(f"Status Code: {result1.get('statusCode')}")
                print(f"Content Size: {result1.get('size')} bytes")
                
                # Content is already parsed as an object
                content = result1.get("content", {})
                if isinstance(content, dict):
                    print(f"Repository: {content.get('full_name')}")
                    print(f"Description: {content.get('description')}")
                else:
                    parsed = json.loads(content) if isinstance(content, str) else content
                    print(f"Repository: {parsed.get('full_name')}")
                    print(f"Description: {parsed.get('description')}")
            else:
                print(f"Request failed: {result1.get('error', 'Unknown error')}")
        except Exception as e:
            print(f"Error in Example 1: {e}")
        print("---\n")

        # Example 2: Fetch HTML content ──────────────────────────────────────────
        print("2️⃣  Fetching HTML content\n")
        try:
            result2: Dict[str, Any] = await matimo.execute(
                "web",
                {
                    "url": "https://www.example.com",
                    "timeout": 15000,
                }
            )
            
            if result2.get("success", False):
                print(f"Status Code: {result2.get('statusCode')}")
                print(f"Content Type: {result2.get('contentType')}")
                print(f"Content Size: {result2.get('size')} bytes")
                
                content = result2.get("content", "")
                if isinstance(content, str):
                    content_preview = content[:200]
                else:
                    content_preview = str(content)[:200]
                print("Content preview:")
                print(content_preview)
            else:
                print(f"Request failed: {result2.get('error', 'Unknown error')}")
        except Exception as e:
            print(f"Error in Example 2: {e}")
        print("---\n")

        # Example 3: POST request ────────────────────────────────────────────────
        print("3️⃣  POST request (echo service)\n")
        try:
            result3: Dict[str, Any] = await matimo.execute(
                "web",
                {
                    "url": "https://httpbin.org/post",
                    "method": "POST",
                    "body": json.dumps({"message": "Hello from Matimo"}),
                    "headers": {"Content-Type": "application/json"},
                }
            )
            
            if result3.get("success", False):
                print(f"Status Code: {result3.get('statusCode')}")
                
                content = result3.get("content", {})
                content_str = _parse_content(content)
                print(f"Response: {content_str[:200]}")
            else:
                print(f"Request failed: {result3.get('error', 'Unknown error')}")
        except Exception as e:
            print(f"Error in Example 3: {e}")
        print("---\n")

        # Example 4: Fetch JSON data with custom headers and timeout
        print("4️⃣  Fetch user data with custom timeout\n")
        try:
            result4: Dict[str, Any] = await matimo.execute(
                "web",
                {
                    "url": "https://jsonplaceholder.typicode.com/users/1",
                    "timeout": 10000,
                }
            )
            
            if result4.get("success", False):
                print(f"Status Code: {result4.get('statusCode')}")
                
                content = result4.get("content", {})
                if isinstance(content, dict):
                    print(f"User Name: {content.get('name')}")
                    print(f"Email: {content.get('email')}")
                    print(f"Phone: {content.get('phone')}")
                else:
                    parsed = json.loads(content) if isinstance(content, str) else content
                    print(f"User Name: {parsed.get('name')}")
                    print(f"Email: {parsed.get('email')}")
                    print(f"Phone: {parsed.get('phone')}")
            else:
                print(f"Request failed: {result4.get('error', 'Unknown error')}")
        except Exception as e:
            print(f"Error in Example 4: {e}")
        print("---\n")

        # Example 5: HEAD request to check endpoint availability
        print("5️⃣  HEAD request to check endpoint availability\n")
        try:
            result5: Dict[str, Any] = await matimo.execute(
                "web",
                {
                    "url": "https://httpbin.org/status/200",
                    "method": "HEAD",
                }
            )
            
            if result5.get("success", False):
                print(f"Status Code: {result5.get('statusCode')}")
                print("Endpoint is accessible")
            else:
                print(f"Request failed: {result5.get('error', 'Unknown error')}")
        except Exception as e:
            print(f"Error in Example 5: {e}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error fetching web content: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
