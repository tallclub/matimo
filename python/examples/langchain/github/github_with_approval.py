#!/usr/bin/env python3
"""
============================================================================
GITHUB TOOLS — HUMAN-IN-THE-LOOP APPROVAL
============================================================================

PATTERN: LangChain ReAct Agent with Human Approval Gate
────────────────────────────────────────────────────────────────────────────
Same ReAct loop as github_langchain.py, but any write operation (create
issue, create PR, merge PR, create release, etc.) pauses and waits for
explicit human approval before executing.

Use this pattern when:
  ✅ The LLM is empowered to perform mutations (create/update/delete)
  ✅ You need an audit trail of AI-proposed vs human-approved actions
  ✅ Compliance or safety requirements demand human sign-off

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set OPENAI_API_KEY and GITHUB_TOKEN in .env

USAGE:
────────────────────────────────────────────────────────────────────────────
  make github-approval
  # or non-interactive (auto-approve all, for CI):
  uv run python github/github_with_approval.py --auto-approve "Create an issue titled 'Test'"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_openai import ChatOpenAI
from matimo_github import get_tools_path

from matimo import Matimo
from matimo.integrations.langchain import convert_tools_to_langchain

load_dotenv(Path(__file__).parent.parent.parent / ".env")

# Tools that mutate state — require approval
WRITE_TOOLS = {
    "github-create-repository",
    "github-delete-repository",
    "github-create-issue",
    "github-update-issue",
    "github-create-pull-request",
    "github-merge-pull-request",
    "github-create-release",
    "github-add-collaborator",
    "github-update-code-alert",
}

DEFAULT_TASK = (
    "List the open issues in the matimo-ai/matimo repository and then "
    "create a new issue titled 'Automated test issue from Matimo Python SDK'."
)


async def run(task: str, auto_approve: bool = False) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     GitHub Tools — LangChain + Human Approval         ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key, label in [("OPENAI_API_KEY", "OpenAI"), ("GITHUB_TOKEN", "GitHub token")]:
        if not os.environ.get(key):
            print(f"❌  {label} ({key}) not set in .env")
            sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    gh_tools = [t for t in matimo.list_tools() if t.name.startswith("github")]
    lc_tools = convert_tools_to_langchain(gh_tools, matimo)
    tool_map = {t.name: t for t in lc_tools}

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    llm_with_tools = llm.bind_tools(lc_tools)

    messages = [HumanMessage(content=task)]
    print(f"🎯  Task: {task}")
    print(f"🔒  Approval mode: {'AUTO' if auto_approve else 'INTERACTIVE'}\n")
    print("─" * 60)

    while True:
        response: AIMessage = await llm_with_tools.ainvoke(messages)
        messages.append(response)

        if not response.tool_calls:
            print(f"\n✨  Agent answer:\n{response.content}\n")
            break

        for call in response.tool_calls:
            tool_name = call["name"]
            tool_args = call["args"]
            is_write = tool_name in WRITE_TOOLS

            print(f"\n{'🔴' if is_write else '🔵'}  Tool: {tool_name}")
            print(f"    Args: {tool_args}")

            # ── Approval gate for write operations ───────────────────────────
            if is_write:
                if auto_approve:
                    print("    ✅  Auto-approved (--auto-approve flag set)")
                    approved = True
                else:
                    try:
                        answer = input("    ⚠️   This is a WRITE operation. Approve? [y/N] ").strip().lower()
                        approved = answer == "y"
                    except EOFError:
                        approved = False

                if not approved:
                    result = "Action declined by user — not executed."
                    print(f"    🚫  {result}")
                    messages.append(ToolMessage(content=result, tool_call_id=call["id"]))
                    continue

            lc_tool = tool_map.get(tool_name)
            try:
                result = await lc_tool.ainvoke(tool_args) if lc_tool else f"Tool not found: {tool_name}"
            except Exception as exc:
                result = f"Error: {exc}"
            print(f"    → {str(result)[:200]}")
            messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))


def main() -> None:
    auto_approve = "--auto-approve" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--auto-approve"]
    task = " ".join(args) if args else DEFAULT_TASK
    asyncio.run(run(task, auto_approve=auto_approve))


if __name__ == "__main__":
    main()
