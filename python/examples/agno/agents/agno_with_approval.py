#!/usr/bin/env python3
"""
============================================================================
AGNO AGENT WITH HUMAN-IN-THE-LOOP CONFIRMATION
============================================================================

PATTERN: Risk-driven confirmation, no policy code in the agent
----------------------------------------------------------------------------
Matimo decides from each tool's YAML definition whether a call needs a
human. The Agno connector sets Agno's requires_confirmation flag on every
tool whose definition needs approval on each call, and on every tool whose
execution risk is high or critical, so the run pauses before a destructive
call and waits for a human decision. The human's answer is the approval:
a confirmed call is not asked about again by Matimo.

Nothing in this file marks a tool as sensitive. It all comes from the tool
definitions:

  requires_approval: true         -> pauses   (every GitHub write tool)
  HTTP DELETE, type: command      -> pauses   (approval by default, high risk)
  HTTP GET                        -> low      runs freely
  HTTP POST / PUT / PATCH         -> medium   runs freely by default

Use this pattern when:
  Yes: an agent can take actions you want to sign off on
  Yes: you want an audit point in front of writes and deletes
  No:  every tool is read-only, then agno_agent.py is enough

SETUP:
----------------------------------------------------------------------------
  Set in .env:
    OPENAI_API_KEY=sk-...
    GITHUB_TOKEN=ghp_...

USAGE:
----------------------------------------------------------------------------
  make agno-approval
  # approve everything without prompting:
  uv run python agno/agents/agno_with_approval.py --auto-approve
  # or with a custom task:
  uv run python agno/agents/agno_with_approval.py "Open an issue titled Test"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from dotenv import load_dotenv
from matimo_github import get_tools_path

from matimo import Matimo, classify_execution_risk, definition_requires_approval
from matimo.integrations.agno import MatimoTools

# Load .env from examples directory (where this project lives)
load_dotenv(Path(__file__).parent.parent.parent / ".env", override=True)

DEFAULT_TASK = (
    "Find the matimo repository owned by tallclub and report its description, "
    "star count and open issue count."
)


def _resolve_requirements(result: object, auto_approve: bool) -> None:
    """Confirm or reject every active Agno requirement in place."""
    for requirement in result.active_requirements:
        if not requirement.needs_confirmation:
            continue

        call = requirement.tool_execution
        print(f"\n  PAUSED: {call.tool_name}")
        print(f"    Args: {call.tool_args}")

        if auto_approve:
            requirement.confirm()
            print("    Auto-approved (--auto-approve flag set)")
            continue

        try:
            answer = input("    This tool needs approval. Approve? [y/N] ").strip().lower()
        except EOFError:
            answer = "n"

        if answer == "y":
            requirement.confirm()
            print("    Approved")
        else:
            requirement.reject()
            print("    Rejected, the tool will not execute")


async def run(task: str, auto_approve: bool) -> None:
    print("\n+--------------------------------------------------------+")
    print("|     Agno Agent with Human-in-the-Loop Confirmation     |")
    print("+--------------------------------------------------------+\n")

    for key, label in [("OPENAI_API_KEY", "OpenAI"), ("GITHUB_TOKEN", "GitHub token")]:
        if not os.environ.get(key):
            print(f"{label} ({key}) not set in .env")
            sys.exit(1)

    # -- 1. Initialise Matimo with GitHub tools -------------------------------
    print("Initialising Matimo...")
    matimo = await Matimo.init(get_tools_path(), log_level="silent")
    github_tools = [t for t in matimo.list_tools() if t.name.startswith("github")]
    print(f"Loaded {len(github_tools)} GitHub tools\n")

    # -- 2. Convert, letting Matimo's rules drive the confirmation flag -------
    toolkit = MatimoTools(matimo, github_tools, name="github_tools")

    print("Matimo's approval rules mapped onto Agno's confirmation flag:")
    for name in sorted(toolkit.functions):
        tool = matimo.get_tool(name)
        risk = classify_execution_risk(tool).value
        needs_approval = definition_requires_approval(tool)
        pauses = toolkit.functions[name].requires_confirmation
        print(
            f"  {name:<34} risk={risk:<7} requires_approval={needs_approval!s:<5} "
            f"pauses={pauses}"
        )
    print()

    # -- 3. Build the agent ---------------------------------------------------
    agent = Agent(
        model=OpenAIChat(id="gpt-4o-mini", api_key=os.environ["OPENAI_API_KEY"]),
        tools=[toolkit],
        instructions="You are a GitHub assistant. Report concrete facts and numbers.",
        markdown=False,
    )

    # -- 4. Run, resolving any pause the policy engine triggers ---------------
    print(f"Task: {task}")
    print(f"Approval mode: {'AUTO' if auto_approve else 'INTERACTIVE'}\n")
    print("-" * 60)

    result = await agent.arun(task)

    while result.is_paused:
        _resolve_requirements(result, auto_approve)
        result = await agent.acontinue_run(run_response=result)

    print("-" * 60)
    print(f"\nAgent answer:\n{result.content}\n")


def main() -> None:
    auto_approve = "--auto-approve" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--auto-approve"]
    task = " ".join(args) if args else DEFAULT_TASK
    asyncio.run(run(task, auto_approve))


if __name__ == "__main__":
    main()
