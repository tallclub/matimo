#!/usr/bin/env python3
"""
============================================================================
GENERIC AGNO AGENT (ALL PROVIDERS)
============================================================================

PATTERN: Agno Agent with a governed Matimo toolkit
----------------------------------------------------------------------------
Auto-discovers every installed Matimo provider, wraps the tools in a single
Agno Toolkit via MatimoTools, and lets the model choose what to call.

Agno decides which tool to call. Matimo decides whether it may run: every
call goes through the policy engine, and any tool classified high or critical
risk reaches Agno with requires_confirmation already set.

Use this pattern when:
  Yes: you want an Agno agent over many providers at once
  Yes: you want governance without writing policy code in the agent
  No:  you need the confirmation flow, see agno_with_approval.py

SETUP:
----------------------------------------------------------------------------
  Set in .env:
    OPENAI_API_KEY=sk-...
  Plus any provider credentials you want the agent to be able to use,
  for example SLACK_BOT_TOKEN or GITHUB_TOKEN.

USAGE:
----------------------------------------------------------------------------
  make agno-agent
  # or with a custom mission:
  uv run python agno/agents/agno_agent.py "Summarise the last 5 GitHub issues"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from dotenv import load_dotenv

from matimo import Matimo
from matimo.integrations.agno import MatimoTools

# Load .env from examples directory (where this project lives)
load_dotenv(Path(__file__).parent.parent.parent / ".env", override=True)

DEFAULT_MISSION = (
    "List the tools you have available, then use a read-only one to fetch "
    "something useful and summarise what you found."
)


async def run_agent(mission: str) -> None:
    """Run an Agno agent over every auto-discovered Matimo provider."""
    print("\n+--------------------------------------------------------+")
    print("|     Generic Agno Agent (all providers)                 |")
    print("+--------------------------------------------------------+\n")

    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY not set in .env")
        sys.exit(1)
    openai_key = os.environ.get("OPENAI_API_KEY")

    # -- 1. Initialise Matimo with every installed provider -------------------
    print("Initialising Matimo (auto-discover mode)...")
    matimo = await Matimo.init(auto_discover=True, log_level="silent")
    all_tools = matimo.list_tools()
    print(f"Loaded {len(all_tools)} tools across all providers")

    # -- 1.5 Filter tools to OpenAI's 128-tool limit --------------------------
    allowed_prefixes = (
        "slack_", "gmail_", "github_", "notion_",
        "execute", "read", "search", "web", "edit",
        "postgres_", "twilio_", "hubspot_", "mailchimp_",
    )
    filtered_tools = [t for t in all_tools if t.name.startswith(allowed_prefixes)]
    if len(filtered_tools) > 128:
        filtered_tools = filtered_tools[:128]
    print(f"Filtered to {len(filtered_tools)} tools (OpenAI limit: 128)\n")

    # -- 2. Wrap them as an Agno toolkit --------------------------------------
    toolkit = MatimoTools(matimo, filtered_tools)
    confirm_count = sum(1 for f in toolkit.functions.values() if f.requires_confirmation)
    print(f"{len(toolkit.functions)} Agno tools ready")
    print(f"{confirm_count} of them are high or critical risk and will pause for confirmation\n")

    # -- 3. Build the agent ---------------------------------------------------
    agent = Agent(
        model=OpenAIChat(id="gpt-4o", api_key=openai_key),
        tools=[toolkit],
        instructions=(
            "You are a helpful operations assistant. Prefer read-only tools. "
            "Explain what you did and report concrete results."
        ),
        markdown=False,
    )

    # -- 4. Run ---------------------------------------------------------------
    print(f"Mission: {mission}\n")
    print("-" * 60)
    result = await agent.arun(mission)
    print("-" * 60)

    if result.is_paused:
        names = [r.tool_execution.tool_name for r in result.active_requirements]
        print(f"\nRun paused awaiting confirmation for: {', '.join(names)}")
        print("See agno_with_approval.py for the full confirmation flow.\n")
        return

    print(f"\nAgent answer:\n{result.content}\n")


def main() -> None:
    mission = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_MISSION
    asyncio.run(run_agent(mission))


if __name__ == "__main__":
    main()
