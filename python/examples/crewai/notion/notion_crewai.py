#!/usr/bin/env python3
"""
============================================================================
NOTION TOOLS — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with a knowledge base search agent
────────────────────────────────────────────────────────────────────────────
Converts all Notion tools to CrewAI BaseTools, creates a knowledge
base agent, and runs the crew to search and retrieve Notion pages.

Use this pattern when:
  ✅ You want CrewAI role-based agents traversing a Notion workspace
  ✅ Automated knowledge base queries and content retrieval
  ✅ Research tasks that require pulling together Notion pages

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…
    NOTION_API_KEY=secret_…

USAGE:
────────────────────────────────────────────────────────────────────────────
  make notion-crewai
  # or with a custom task:
  uv run python notion/notion_crewai.py "Search Notion for pages about onboarding"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv
from matimo_notion import get_tools_path

from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "Search the Notion workspace for pages related to 'project' "
    "and return a summary of the top 3 results."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Notion Tools — CrewAI Crew                         ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key, label in [("OPENAI_API_KEY", "OpenAI"), ("NOTION_API_KEY", "Notion API key")]:
        if not os.environ.get(key):
            print(f"❌  {label} ({key}) not set in .env")
            sys.exit(1)

    # ── 1. Initialise Matimo with Notion tools ────────────────────────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(get_tools_path())
    notion_tools = [t for t in matimo.list_tools() if t.name.startswith("notion")]
    print(f"✅  Loaded {len(notion_tools)} Notion tools\n")

    # ── 2. Convert to CrewAI BaseTools ───────────────────────────────────────
    crewai_tools = convert_tools_to_crewai(notion_tools, matimo)
    print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

    # ── 3. Build Agent + Task + Crew ─────────────────────────────────────────
    agent = Agent(
        role="Knowledge Base Curator",
        goal="Search and retrieve information from the Notion workspace to answer questions accurately.",
        backstory=(
            "You are a knowledge management expert who has mastered Notion. "
            "You can efficiently search through databases and pages to surface "
            "the most relevant information for any knowledge request."
        ),
        llm="gpt-4o-mini",
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="A structured summary of the Notion content found, with page titles and key details.",
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
