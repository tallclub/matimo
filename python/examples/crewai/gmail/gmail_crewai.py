#!/usr/bin/env python3
"""
============================================================================
GMAIL TOOLS — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with an email management agent
────────────────────────────────────────────────────────────────────────────
Converts all Gmail tools to CrewAI BaseTools, creates an email
management agent, and runs the crew to process email tasks.

Use this pattern when:
  ✅ You want CrewAI role-based agents managing email
  ✅ Automated email triage or drafting workflows
  ✅ Multi-step email tasks orchestrated by the model

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…
    GMAIL_ACCESS_TOKEN=ya29.…
    # or OAuth2:
    GMAIL_CLIENT_ID=…
    GMAIL_CLIENT_SECRET=…
    GMAIL_REFRESH_TOKEN=…

USAGE:
────────────────────────────────────────────────────────────────────────────
  make gmail-crewai
  # or with a custom task:
  uv run python gmail/gmail_crewai.py "Find unread emails from last 24h and summarise them"
  uv run python gmail/gmail_crewai.py "Check my most recent email with an attachment and report its size"

The Gmail toolset is converted wholesale via convert_tools_to_crewai(), so
gmail-get-attachment is available to the agent alongside every other Gmail
tool without any additional wiring.

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv
from matimo_gmail import get_tools_path

from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "List recent emails in the inbox and return a short summary "
    "of the 3 most recent messages (sender, subject, snippet)."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Gmail Tools — CrewAI Crew                          ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key, label in [("OPENAI_API_KEY", "OpenAI"), ("GMAIL_ACCESS_TOKEN", "Gmail access token")]:
        if not os.environ.get(key):
            print(f"❌  {label} ({key}) not set in .env")
            sys.exit(1)

    # ── 1. Initialise Matimo with Gmail tools ─────────────────────────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(get_tools_path())
    gmail_tools = [t for t in matimo.list_tools() if t.name.startswith("gmail")]
    print(f"✅  Loaded {len(gmail_tools)} Gmail tools\n")

    # ── 2. Convert to CrewAI BaseTools ───────────────────────────────────────
    crewai_tools = convert_tools_to_crewai(gmail_tools, matimo)
    print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

    # ── 3. Build Agent + Task + Crew ─────────────────────────────────────────
    agent = Agent(
        role="Email Management Specialist",
        goal="Read, organise, and draft email communications efficiently.",
        backstory=(
            "You are a meticulous personal assistant who handles email with precision. "
            "You triage inboxes, identify important messages, and draft clear replies."
        ),
        llm="gpt-4o-mini",
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="A structured summary of the email actions taken and their outcomes.",
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
