#!/usr/bin/env python3
"""
============================================================================
WEB_SCRAPER TOOL — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with a web-research agent
────────────────────────────────────────────────────────────────────────────
Converts the web_scraper core tool to a CrewAI BaseTool, creates a web
research agent, and runs the crew to crawl and summarize a site.

Use this pattern when:
  ✅ You want CrewAI role-based agents to research and summarize websites
  ✅ Automated multi-page site ingestion as part of a larger crew
  ✅ Natural-language "what does this site say about X" questions

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…

USAGE:
────────────────────────────────────────────────────────────────────────────
  make web-scraper-crewai
  # or with a custom task:
  uv run python crewai/web_scraper/web_scraper_crewai.py "Summarize example.com"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv

from matimo import ApprovalRequest, Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def approve(request: ApprovalRequest) -> bool:
    """Ask in the terminal before any tool call that needs approval."""
    print(f"\n🔒  Approval required — {request.tool_name}: {request.params}")
    if not sys.stdin.isatty():
        print(
            "    ❌  Rejected: no terminal. Pre-approve with "
            f'MATIMO_APPROVED_PATTERNS="{request.tool_name}"'
        )
        return False
    return input("    Approve? [y/N] ").strip().lower() in ("y", "yes")


DEFAULT_TASK = (
    "Crawl https://example.com with at most 5 pages and a max depth of 1, "
    "then summarize what the site is about based on the pages you found."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║        Web Scraper Tool — CrewAI Crew                   ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("OPENAI_API_KEY"):
        print("❌  OPENAI_API_KEY not set in .env")
        sys.exit(1)

    # ── 1. Initialise Matimo (auto-discovers built-in core tools) ────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(auto_discover=True, on_approval=approve)
    scraper_tools = [t for t in matimo.list_tools() if t.name == "web_scraper"]
    print(f"✅  Loaded {len(scraper_tools)} web_scraper tool(s)\n")

    if not scraper_tools:
        print("❌  web_scraper tool not found")
        sys.exit(1)

    # ── 2. Convert to CrewAI BaseTools ───────────────────────────────────────
    crewai_tools = convert_tools_to_crewai(scraper_tools, matimo)
    print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

    # ── 3. Build Agent + Task + Crew ─────────────────────────────────────────
    agent = Agent(
        role="Web Researcher",
        goal="Crawl websites and summarize their content accurately for stakeholders.",
        backstory=(
            "You are a meticulous web researcher who crawls sites within their own "
            "domain, extracts the main readable content of each page, and turns "
            "the raw text into clear, actionable summaries."
        ),
        llm="gpt-4o-mini",
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="A concise summary of the crawled site's content with key findings.",
    )

    crew = Crew(
        agents=[agent],
        tasks=[crew_task],
        process=Process.sequential,
        verbose=True,
    )

    # ── 4. Run crew (kickoff is synchronous — wrap in executor) ───────────────
    print(f"🎯  Task: {task}\n")
    print("─" * 60)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, crew.kickoff)

    print("\n" + "─" * 60)
    print(f"\n✨  Crew result:\n{result}\n")


def main() -> None:
    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_TASK
    asyncio.run(run(task))


if __name__ == "__main__":
    main()
