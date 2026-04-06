#!/usr/bin/env python3
"""
============================================================================
GENERIC MULTI-PROVIDER AGENT — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with auto-discovered tools
────────────────────────────────────────────────────────────────────────────
Auto-discovers all installed Matimo provider packages, converts every
tool to a CrewAI BaseTool, then runs a single-agent Crew to complete
the requested task.

Use this pattern when:
  ✅ You want the LLM to pick from ALL available Matimo tools
  ✅ Cross-provider workflows (e.g. check GitHub → post Slack message)
  ✅ Quick demonstration without picking a specific provider

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env at least one provider credential, e.g.:
    OPENAI_API_KEY=sk-…
    SLACK_BOT_TOKEN=xoxb-…

USAGE:
────────────────────────────────────────────────────────────────────────────
  make agent-crewai
  # or with a custom task:
  uv run python agents/crewai_agent.py "List the Slack channels and send a hello"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv

from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "Use the available tools to list the public Slack channels "
    "and return a short summary of what you found."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Multi-Provider Matimo — CrewAI Crew                ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("OPENAI_API_KEY"):
        print("❌  OPENAI_API_KEY not set in .env")
        sys.exit(1)

    # ── 1. Auto-discover all installed Matimo providers ───────────────────────
    print("🚀  Initialising Matimo (auto-discover)…")
    matimo = await Matimo.init(auto_discover=True)
    all_tools = matimo.list_tools()
    print(f"✅  Loaded {len(all_tools)} tools from all providers\n")

    # ── 2. Convert to CrewAI BaseTools ───────────────────────────────────────
    crewai_tools = convert_tools_to_crewai(all_tools, matimo)
    print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

    # ── 3. Build Agent + Task + Crew ─────────────────────────────────────────
    agent = Agent(
        role="Matimo Integration Specialist",
        goal="Use the provided tools to complete the user's request accurately and concisely.",
        backstory=(
            "You are an expert at using integration tools to interact with external services. "
            "You always pick the right tool for the job and return clean, structured results."
        ),
        model="gpt-4o-mini",
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="A concise summary of what was done and the results obtained.",
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
