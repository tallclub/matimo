#!/usr/bin/env python3
"""
============================================================================
MULTI-AGENT CREW — ROLE-BASED TOOL PARTITIONING VIA MATIMO
============================================================================

PATTERN: Multiple specialised agents each receive a governed subset of
Matimo tools, selected by role context using get_tools_for_agent().
────────────────────────────────────────────────────────────────────────────

WHY THIS MATTERS
────────────────────────────────────────────────────────────────────────────
The real power of Matimo + CrewAI is not giving every agent every tool —
it's giving each agent only the tools it needs (least-privilege).
This reduces hallucination surface, makes crews more predictable, and lets
Matimo's policy engine govern each agent independently.

CREW DESIGN
────────────────────────────────────────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────────┐
│  CREW: "GitHub-to-Slack Incident Reporter"                          │
│                                                                     │
│  Agent 1: GitHub Analyst       ─ tools: github_*                   │
│    - list open issues labelled "incident"                           │
│    - read issue details and linked PRs                              │
│                                                                     │
│  Agent 2: Slack Broadcaster    ─ tools: slack_*                     │
│    - format summary from Agent 1's findings                         │
│    - post to #incidents channel                                     │
│                                                                     │
│  Process: sequential (Agent 1 → Agent 2)                           │
└─────────────────────────────────────────────────────────────────────┘

SETUP
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…
    GITHUB_TOKEN=ghp_…
    SLACK_BOT_TOKEN=xoxb-…

    # Optional: filter to specific repo / channel
    GITHUB_REPO=owner/repo          # defaults to "tallclub/matimo"
    SLACK_INCIDENTS_CHANNEL=#incidents

USAGE
────────────────────────────────────────────────────────────────────────────
  make multi-agent-crewai
  # or:
  uv run python agents/multi_agent_crew.py
  uv run python agents/multi_agent_crew.py "Summarise critical incidents from last 7 days"

============================================================================
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv

from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")

# ---------------------------------------------------------------------------
# Defaults (override via env or CLI arg)
# ---------------------------------------------------------------------------
DEFAULT_TASK = (
    "Find any open GitHub issues labelled 'incident' or 'bug' in the repo, "
    "then post a concise summary to the Slack #incidents channel."
)
GITHUB_REPO = os.getenv("GITHUB_REPO", "tallclub/matimo")
SLACK_CHANNEL = os.getenv("SLACK_INCIDENTS_CHANNEL", "#incidents")


# ---------------------------------------------------------------------------
# Tool partitioning helpers
# ---------------------------------------------------------------------------

def _select_tools(
    all_tools: list,
    matimo: Matimo,
    prefix: str,
) -> list:
    """Return CrewAI tools whose Matimo name starts with *prefix*."""
    subset = [t for t in all_tools if t.name.startswith(prefix)]
    return convert_tools_to_crewai(subset, matimo)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(task: str) -> None:
    print("\n╔═══════════════════════════════════════════════════════════╗")
    print("║   Matimo Multi-Agent Crew — GitHub → Slack Reporter       ║")
    print("╚═══════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("OPENAI_API_KEY"):
        print("❌  OPENAI_API_KEY not set in .env")
        sys.exit(1)

    # ── 1. Load all tools (auto-discover installed providers) ─────────────
    print("🚀  Initialising Matimo (auto-discover)…")
    matimo = await Matimo.init(auto_discover=True)
    all_tools = matimo.list_tools()
    print(f"✅  Loaded {len(all_tools)} tools total\n")

    # ── 2. Partition tools by role (least-privilege) ──────────────────────
    github_tools = _select_tools(all_tools, matimo, "github_")
    slack_tools  = _select_tools(all_tools, matimo, "slack_")

    if not github_tools:
        print("⚠️   No GitHub tools found — install matimo-github and set GITHUB_TOKEN")
    if not slack_tools:
        print("⚠️   No Slack tools found  — install matimo-slack  and set SLACK_BOT_TOKEN")

    print(f"🔧  GitHub agent: {len(github_tools)} tools")
    print(f"🔧  Slack agent:  {len(slack_tools)}  tools\n")

    # ── 3. Define agents ──────────────────────────────────────────────────
    github_analyst = Agent(
        role="GitHub Analyst",
        goal=(
            f"Retrieve and analyse open incidents and bugs from the {GITHUB_REPO} "
            "GitHub repository. Return a structured summary of each issue: title, "
            "number, severity, and key details."
        ),
        backstory=(
            "You are a senior SRE who monitors GitHub issues to spot service degradations "
            "and bugs before they escalate. You are thorough and precise."
        ),
        llm="gpt-4o-mini",
        tools=github_tools,
        verbose=True,
        allow_delegation=False,
    )

    slack_broadcaster = Agent(
        role="Slack Broadcaster",
        goal=(
            f"Post a clear, concise incident summary to the {SLACK_CHANNEL} Slack channel. "
            "Format it for engineers — bullet points, severity, links where possible."
        ),
        backstory=(
            "You are a communication specialist who translates raw incident data into "
            "crisp Slack messages that engineers can act on immediately."
        ),
        llm="gpt-4o-mini",
        tools=slack_tools,
        verbose=True,
        allow_delegation=False,
    )

    # ── 4. Define tasks ───────────────────────────────────────────────────
    research_task = Task(
        description=(
            f"Search open GitHub issues in '{GITHUB_REPO}' labelled 'incident' or 'bug'. "
            "For each issue: capture the title, number, creation date, labels, and a "
            "one-sentence description. Return a structured list."
        ),
        agent=github_analyst,
        expected_output=(
            "A bullet list of open incidents/bugs: title, issue number, date opened, "
            "labels, and a brief description of each."
        ),
    )

    broadcast_task = Task(
        description=(
            f"Take the incident list from the previous step and post a formatted summary "
            f"to the Slack channel '{SLACK_CHANNEL}'. Include: total count, a short entry "
            "per issue, and a call-to-action footer (e.g. 'See GitHub for details')."
        ),
        agent=slack_broadcaster,
        context=[research_task],  # receives output from research_task
        expected_output=(
            "Confirmation that the Slack message was sent, plus the message text that was posted."
        ),
    )

    # ── 5. Assemble crew ─────────────────────────────────────────────────
    crew = Crew(
        agents=[github_analyst, slack_broadcaster],
        tasks=[research_task, broadcast_task],
        process=Process.sequential,
        verbose=True,
    )

    # ── 6. Run (kickoff is synchronous — wrap in executor) ────────────────
    print(f"🎯  Task: {task}\n")
    print("─" * 64)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, lambda: crew.kickoff(inputs={"task": task}))

    print("\n" + "─" * 64)
    print(f"\n✨  Crew result:\n{result}\n")


def main() -> None:
    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_TASK
    asyncio.run(run(task))


if __name__ == "__main__":
    main()
