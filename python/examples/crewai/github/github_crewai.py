#!/usr/bin/env python3
"""
============================================================================
GITHUB TOOLS — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with a GitHub code research agent
────────────────────────────────────────────────────────────────────────────
Converts all GitHub tools to CrewAI BaseTools, creates a code research
agent, and runs the crew to explore repositories and issues.

Use this pattern when:
  ✅ You want CrewAI role-based agents browsing GitHub
  ✅ Automated code review or issue triage crews
  ✅ Structured research output about a repository

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…
    GITHUB_TOKEN=ghp_…

USAGE:
────────────────────────────────────────────────────────────────────────────
  make github-crewai
  # or with a custom task:
  uv run python github/github_crewai.py "Summarise the open issues in matimo/matimo"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv
from matimo_github import get_tools_path

from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "Search for repositories related to 'matimo python sdk' on GitHub "
    "and return a short summary of the top 3 results."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     GitHub Tools — CrewAI Crew                         ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key, label in [("OPENAI_API_KEY", "OpenAI"), ("GITHUB_TOKEN", "GitHub token")]:
        if not os.environ.get(key):
            print(f"❌  {label} ({key}) not set in .env")
            sys.exit(1)

    # ── 1. Initialise Matimo with GitHub tools ────────────────────────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(get_tools_path())
    github_tools = [t for t in matimo.list_tools() if t.name.startswith("github")]
    print(f"✅  Loaded {len(github_tools)} GitHub tools\n")

    # ── 2. Convert to CrewAI BaseTools ───────────────────────────────────────
    crewai_tools = convert_tools_to_crewai(github_tools, matimo)
    print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

    # ── 3. Build Agent + Task + Crew ─────────────────────────────────────────
    agent = Agent(
        role="GitHub Code Research Analyst",
        goal="Search and analyse GitHub repositories, issues, and pull requests to provide actionable insights.",
        backstory=(
            "You are a seasoned software engineer who specialises in code research "
            "and repository analysis. You can quickly navigate GitHub to find relevant "
            "information and synthesise it into clear reports."
        ),
        llm="gpt-4o-mini",
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="A structured summary of the GitHub findings with key details and insights.",
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
