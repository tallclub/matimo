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
from pathlib import Path
from dotenv import load_dotenv

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


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
        # Example 1: Fetch public API (JSONPlaceholder)
        print("1. Fetching user data from JSONPlaceholder API\n")
        result1 = await matimo.execute(
            "web",
            {
                "url": "https://jsonplaceholder.typicode.com/users/1",
                "method": "GET"
            }
        )
        
        if result1.get("success"):
            print(f"Status Code: {result1.get('statusCode')}")
            print(f"Content Type: {result1.get('contentType')}")
            content = result1.get("content", "")
            if isinstance(content, dict):
                print(f"User: {content.get('name')} ({content.get('email')})")
            else:
                print(f"Content (first 200 chars): {str(content)[:200]}")
        else:
            print(f"Request failed: {result1.get('error')}")
        print("---\n")

        # Example 2: Fetch JSON data
        print("2. Fetching GitHub repository info\n")
        result2 = await matimo.execute(
            "web",
            {
                "url": "https://api.github.com/repos/tallclub/matimo",
                "method": "GET"
            }
        )
        
        if result2.get("success"):
            print(f"Status Code: {result2.get('statusCode')}")
            content = result2.get("content", {})
            if isinstance(content, dict):
                print(f"Repository: {content.get('full_name')}")
                print(f"Description: {content.get('description', 'N/A')}")
                print(f"Stars: {content.get('stargazers_count', 0)}")
                print(f"Forks: {content.get('forks_count', 0)}")
            else:
                print(f"Content (first 300 chars): {str(content)[:300]}")
        else:
            print(f"Request failed: {result2.get('error')}")
        print("---\n")

        # Example 3: POST request with body
        print("3. Making a POST request to echo service\n")
        result3 = await matimo.execute(
            "web",
            {
                "url": "https://httpbin.org/post",
                "method": "POST",
                "headers": {"Content-Type": "application/json"},
                "body": '{"message": "Hello from Matimo", "test": true}',
                "timeout": 15000
            }
        )
        
        if result3.get("success"):
            print(f"Status Code: {result3.get('statusCode')}")
            content = result3.get("content", {})
            if isinstance(content, dict):
                json_data = content.get("json", {})
                print(f"Echoed data: {json_data}")
            else:
                print(f"Response received: {str(content)[:200]}")
        else:
            print(f"Request failed: {result3.get('error')}")
        print("---\n")

        # Example 4: Fetch HTML content
        print("4. Fetching HTML content\n")
        result4 = await matimo.execute(
            "web",
            {
                "url": "https://www.example.com",
                "timeout": 15000
            }
        )
        
        if result4.get("success"):
            print(f"Status Code: {result4.get('statusCode')}")
            print(f"Content Type: {result4.get('contentType')}")
            print(f"Content Size: {result4.get('size')} bytes")
            content = result4.get("content", "")
            if isinstance(content, str):
                print(f"Content (first 300 chars):\n{content[:300]}")
        else:
            print(f"Request failed: {result4.get('error')}")
        print("---\n")

    except Exception as error:
        print(f"❌  Error making web request: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
