#!/usr/bin/env python3
"""
============================================================================
SLACK TOOLS — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with a single Slack researcher agent
────────────────────────────────────────────────────────────────────────────
Converts all Slack tools to CrewAI BaseTools, creates a Slack research
agent, defines a task, and runs the crew to completion.

Use this pattern when:
  ✅ You want CrewAI role-based agents interacting with Slack
  ✅ Multi-agent Slack workflows with explicit task delegation
  ✅ Structured crew output for downstream processing

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…
    SLACK_BOT_TOKEN=xoxb-…

USAGE:
────────────────────────────────────────────────────────────────────────────
  make slack-crewai
  # or with a custom task:
  uv run python slack/slack_crewai.py "Find the first public channel and greet it"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv
from matimo_slack import get_tools_path

from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "List the available Slack channels and send a short hello message "
    "to the first public channel you find."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Slack Tools — CrewAI Crew                          ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key, label in [("OPENAI_API_KEY", "OpenAI"), ("SLACK_BOT_TOKEN", "Slack bot token")]:
        if not os.environ.get(key):
            print(f"❌  {label} ({key}) not set in .env")
            sys.exit(1)

    # ── 1. Initialise Matimo with Slack tools ─────────────────────────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(get_tools_path())
    slack_tools = [t for t in matimo.list_tools() if t.name.startswith("slack")]
    print(f"✅  Loaded {len(slack_tools)} Slack tools\n")

    # ── 2. Convert to CrewAI BaseTools ───────────────────────────────────────
    crewai_tools = convert_tools_to_crewai(slack_tools, matimo)
    print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

    # ── 3. Build Agent + Task + Crew ─────────────────────────────────────────
    agent = Agent(
        role="Slack Community Manager",
        goal="Interact with Slack to monitor channels and communicate with team members.",
        backstory=(
            "You are an experienced Slack community manager who knows how to navigate "
            "channels, post messages, and keep teams informed efficiently."
        ),
        llm="gpt-4o-mini",
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="A confirmation of what Slack actions were taken and their results.",
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
