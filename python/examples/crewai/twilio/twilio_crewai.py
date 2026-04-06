#!/usr/bin/env python3
"""
============================================================================
TWILIO TOOLS — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with a messaging monitor agent
────────────────────────────────────────────────────────────────────────────
Converts all Twilio tools to CrewAI BaseTools, creates a messaging
monitor agent, and runs the crew to check message logs and send
communications.

Use this pattern when:
  ✅ You want CrewAI role-based agents managing SMS / WhatsApp via Twilio
  ✅ Automated communication workflows
  ✅ Message delivery monitoring and reporting

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…
    TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TWILIO_AUTH_TOKEN=…
    TWILIO_FROM_NUMBER=+1…   (your Twilio number)

USAGE:
────────────────────────────────────────────────────────────────────────────
  make twilio-crewai
  # or with a custom task:
  uv run python twilio/twilio_crewai.py "List the 5 most recent outbound messages"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv
from matimo_twilio import get_tools_path

from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "List the 5 most recent messages in the Twilio account "
    "and provide a brief status report on message delivery."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Twilio Tools — CrewAI Crew                         ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key, label in [
        ("OPENAI_API_KEY", "OpenAI"),
        ("TWILIO_ACCOUNT_SID", "Twilio Account SID"),
        ("TWILIO_AUTH_TOKEN", "Twilio Auth Token"),
    ]:
        if not os.environ.get(key):
            print(f"❌  {label} ({key}) not set in .env")
            sys.exit(1)

    # ── 1. Initialise Matimo with Twilio tools ────────────────────────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(get_tools_path())
    twilio_tools = [t for t in matimo.list_tools() if t.name.startswith("twilio")]
    print(f"✅  Loaded {len(twilio_tools)} Twilio tools\n")

    # ── 2. Convert to CrewAI BaseTools ───────────────────────────────────────
    crewai_tools = convert_tools_to_crewai(twilio_tools, matimo)
    print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

    # ── 3. Build Agent + Task + Crew ─────────────────────────────────────────
    agent = Agent(
        role="Communications Monitoring Specialist",
        goal="Monitor and manage SMS and messaging operations, ensuring reliable message delivery.",
        backstory=(
            "You are a communications operations expert specialising in Twilio. "
            "You track message delivery, identify failures, and ensure that all "
            "critical communications reach their intended recipients."
        ),
        model="gpt-4o-mini",
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="A messaging status report with delivery statistics and any notable issues.",
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
