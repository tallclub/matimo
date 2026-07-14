#!/usr/bin/env python3
"""
============================================================================
WEB_SCRAPER TOOL — DECORATOR PATTERN
============================================================================

PATTERN: @tool Decorator
────────────────────────────────────────────────────────────────────────────
Wraps Matimo tool calls in a class using the @tool("tool-name") decorator.
The decorator intercepts method calls and routes them through Matimo
automatically — the method body is never executed.

Use this pattern when:
  ✅ Building class-based applications or services
  ✅ Encapsulating site-crawling logic in strongly-typed wrappers
  ✅ Combining multiple tools in a single service layer
  ✅ Object-oriented design

SETUP:
────────────────────────────────────────────────────────────────────────────
  No API key required — web_scraper is a built-in core tool.

USAGE:
────────────────────────────────────────────────────────────────────────────
  export MATIMO_AUTO_APPROVE=true
  uv run python native/web_scraper/web_scraper_decorator.py

============================================================================
"""

import asyncio
from pathlib import Path

from dotenv import load_dotenv

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


# ───────────────────────────────────────────────────────────────────────────
# Service class — each method is auto-routed to the matching Matimo tool
# ───────────────────────────────────────────────────────────────────────────

class SiteCrawler:
    """High-level site-crawling service using the @tool decorator pattern."""

    @tool("web_scraper")
    async def crawl(self, url: str, max_pages: int = 20, max_depth: int = 3) -> dict:
        """
        Decorator auto-calls matimo.execute('web_scraper', {...}).

        Args:
            url: Starting URL to crawl
            max_pages: Maximum number of pages to fetch
            max_depth: Maximum link-following depth from the starting page

        Returns:
            Crawl result with one entry per successfully fetched page
        """
        ...


# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Web Scraper Tool — Decorator Pattern               ║")
    print("║     (@tool decorators for automatic execution)          ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    set_global_matimo_instance(matimo)
    print("✅  Matimo initialized\n")

    crawler = SiteCrawler()

    try:
        print("1. Crawling a site (maxDepth 0 — starting page only)\n")
        result = await crawler.crawl("https://example.com", max_pages=1, max_depth=0)
        if result.get("success"):
            pages = result.get("pages", [])
            print(f"Pages crawled: {result.get('pagesCrawled')}")
            if pages:
                print(f"Title: {pages[0].get('title')}")
                print(f"Text preview: {(pages[0].get('text') or '')[:150]}")
        else:
            print(f"Error: {result.get('error')}")
        print("---\n")

        print("✅  Decorator example completed successfully")
    except Exception as error:
        print(f"❌  Error: {error}\n")


if __name__ == "__main__":
    asyncio.run(main())
