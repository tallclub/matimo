#!/usr/bin/env python3
"""
============================================================================
MAILCHIMP TOOLS — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with a campaign analyst agent
────────────────────────────────────────────────────────────────────────────
Converts all Mailchimp tools to CrewAI BaseTools, creates a marketing
campaign analyst agent, and runs the crew to analyse audience and
campaign data.

Use this pattern when:
  ✅ You want CrewAI role-based agents querying Mailchimp
  ✅ Automated campaign performance analysis
  ✅ Audience segmentation and list management research

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…
    MAILCHIMP_API_KEY=…-us1

USAGE:
────────────────────────────────────────────────────────────────────────────
  make mailchimp-crewai
  # or with a custom task:
  uv run python mailchimp/mailchimp_crewai.py "Summarise recent campaign performance"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv
from matimo_mailchimp import get_tools_path

from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "List the Mailchimp audience lists and return a summary "
    "of each list including its name and subscriber count."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Mailchimp Tools — CrewAI Crew                      ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key, label in [("OPENAI_API_KEY", "OpenAI"), ("MAILCHIMP_API_KEY", "Mailchimp API key")]:
        if not os.environ.get(key):
            print(f"❌  {label} ({key}) not set in .env")
            sys.exit(1)

    # ── 1. Initialise Matimo with Mailchimp tools ─────────────────────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(get_tools_path())
    mailchimp_tools = [t for t in matimo.list_tools() if t.name.startswith("mailchimp")]
    print(f"✅  Loaded {len(mailchimp_tools)} Mailchimp tools\n")

    # ── 2. Convert to CrewAI BaseTools ───────────────────────────────────────
    crewai_tools = convert_tools_to_crewai(mailchimp_tools, matimo)
    print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

    # ── 3. Build Agent + Task + Crew ─────────────────────────────────────────
    agent = Agent(
        role="Email Marketing Campaign Analyst",
        goal="Analyse Mailchimp audience data and campaign performance to provide marketing insights.",
        backstory=(
            "You are a digital marketing specialist who understands email campaign metrics. "
            "You can extract audience insights, evaluate campaign performance, and "
            "recommend improvements to increase engagement."
        ),
        model="gpt-4o-mini",
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="A marketing analysis report with audience data and campaign performance insights.",
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
