#!/usr/bin/env python3
"""
============================================================================
MICROSOFT GRAPH TOOLS — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with a Microsoft 365 productivity agent
────────────────────────────────────────────────────────────────────────────
Converts all Microsoft Graph tools to CrewAI BaseTools, creates a
productivity assistant agent, and runs the crew to process Microsoft 365
tasks (mail, calendar, Teams, files, SharePoint).

Use this pattern when:
  ✅ You want CrewAI role-based agents managing Microsoft 365 work
  ✅ Automated triage across mail, calendar, and Teams
  ✅ Multi-step Microsoft 365 tasks orchestrated by the model

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…
    MICROSOFT_GRAPH_ACCESS_TOKEN=eyJ0eXAiOiJKV1Qi…

USAGE:
────────────────────────────────────────────────────────────────────────────
  make microsoft-crewai
  # or with a custom task:
  uv run python microsoft/microsoft_crewai.py "Summarise my 3 most recent unread emails"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv
from matimo_microsoft import get_tools_path

from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "List my 3 most recent unread emails and give me a short summary of each "
    "(sender, subject, preview)."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Microsoft Graph Tools — CrewAI Crew               ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key, label in [("OPENAI_API_KEY", "OpenAI"), ("MICROSOFT_GRAPH_ACCESS_TOKEN", "Microsoft Graph token")]:
        if not os.environ.get(key):
            print(f"❌  {label} ({key}) not set in .env")
            sys.exit(1)

    # ── 1. Initialise Matimo with Microsoft Graph tools ───────────────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(get_tools_path())
    ms_tools = [t for t in matimo.list_tools() if t.name.startswith("ms_")]
    print(f"✅  Loaded {len(ms_tools)} Microsoft Graph tools\n")

    # ── 2. Convert to CrewAI BaseTools ───────────────────────────────────────
    crewai_tools = convert_tools_to_crewai(ms_tools, matimo)
    print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

    # ── 3. Build Agent + Task + Crew ─────────────────────────────────────────
    agent = Agent(
        role="Microsoft 365 Productivity Assistant",
        goal="Help the user stay on top of mail, calendar, Teams, and shared files in Microsoft 365.",
        backstory=(
            "You are an efficient executive assistant fluent in Outlook, Teams, OneDrive, "
            "and SharePoint. You triage inboxes, summarise documents, schedule meetings, "
            "and keep the user informed without overwhelming them."
        ),
        llm="gpt-4o-mini",
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="A structured summary of the Microsoft 365 actions taken and their outcomes.",
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
