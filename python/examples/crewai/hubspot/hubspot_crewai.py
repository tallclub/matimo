#!/usr/bin/env python3
"""
============================================================================
HUBSPOT TOOLS — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with a CRM research agent
────────────────────────────────────────────────────────────────────────────
Converts all HubSpot tools to CrewAI BaseTools, creates a CRM
research agent, and runs the crew to analyse contacts, companies,
and deals.

Use this pattern when:
  ✅ You want CrewAI role-based agents querying HubSpot CRM
  ✅ Automated sales pipeline analysis
  ✅ Contact and deal research for sales teams

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…
    HUBSPOT_ACCESS_TOKEN=pat-…

USAGE:
────────────────────────────────────────────────────────────────────────────
  make hubspot-crewai
  # or with a custom task:
  uv run python hubspot/hubspot_crewai.py "Search for contacts at Acme Corp"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from matimo_hubspot import get_tools_path

from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "Search HubSpot for the most recently updated contacts "
    "and return a summary of the top 5 results."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     HubSpot Tools — CrewAI Crew                        ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key, label in [("OPENAI_API_KEY", "OpenAI"), ("HUBSPOT_ACCESS_TOKEN", "HubSpot token")]:
        if not os.environ.get(key):
            print(f"❌  {label} ({key}) not set in .env")
            sys.exit(1)

    # ── 1. Initialise Matimo with HubSpot tools ───────────────────────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(get_tools_path())
    hubspot_tools = [t for t in matimo.list_tools() if t.name.startswith("hubspot")]
    print(f"✅  Loaded {len(hubspot_tools)} HubSpot tools\n")

    # ── 2. Convert to CrewAI BaseTools ───────────────────────────────────────
    crewai_tools = convert_tools_to_crewai(hubspot_tools, matimo)
    print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

    # ── 3. Build Agent + Task + Crew ─────────────────────────────────────────
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    agent = Agent(
        role="CRM Research Analyst",
        goal="Query HubSpot to find contacts, companies, and deals, then synthesise the data into useful reports.",
        backstory=(
            "You are a sales operations expert who knows the HubSpot CRM inside out. "
            "You excel at searching for contacts, uncovering deal pipeline gaps, and "
            "producing actionable summaries for sales teams."
        ),
        llm=llm,
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="A structured CRM report with key findings and recommended next steps.",
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
