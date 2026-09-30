#!/usr/bin/env python3
"""
============================================================================
POSTGRESQL TOOLS — HUMAN-IN-THE-LOOP APPROVAL
============================================================================

PATTERN: LangChain ReAct Agent with approval gate for write SQL
────────────────────────────────────────────────────────────────────────────
The LLM suggests SQL queries. Before any statement containing a destructive
keyword (INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, ...) runs, the
user must explicitly approve it. Matimo itself scans the `sql` parameter and
sends those calls to the `on_approval` callback passed to Matimo.init();
read-only queries run without asking.

Use this pattern when:
  ✅ The LLM is generating SQL autonomously
  ✅ Production database — mutations need human review
  ✅ Compliance requires an audit trail of AI-proposed SQL

SETUP:  Set OPENAI_API_KEY and MATIMO_POSTGRES_URL in .env
USAGE:
  make postgres-approval
  uv run python postgres/postgres_with_approval.py --auto-approve "Add a test record to users table"
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_openai import ChatOpenAI
from matimo_postgres import get_tools_path

from matimo import ApprovalCallback, ApprovalRequest, Matimo
from matimo.integrations.langchain import convert_tools_to_langchain

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = "List all tables and their row counts, then add a test record to the 'logs' table if it exists."


def make_approval_callback(auto_approve: bool) -> ApprovalCallback:
    """Matimo calls this before every statement with a destructive keyword."""

    async def approve(request: ApprovalRequest) -> bool:
        print(f"    🔴  Write query needs approval: {request.params.get('sql')}")
        if auto_approve:
            print("    ✅  Auto-approved")
            return True
        try:
            answer = input("    ⚠️   Execute? [y/N] ")
        except EOFError:
            answer = ""
        approved = answer.strip().lower() == "y"
        print("    ✅  Approved" if approved else "    🚫  Declined — not executed")
        return approved

    return approve


async def run(task: str, auto_approve: bool = False) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     PostgreSQL — LangChain + Human Approval            ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("OPENAI_API_KEY"):
        print("❌  OPENAI_API_KEY not set in .env")
        sys.exit(1)

    has_url = bool(os.environ.get("MATIMO_POSTGRES_URL"))
    has_host = bool(os.environ.get("MATIMO_POSTGRES_HOST"))
    if not has_url and not has_host:
        print("❌  PostgreSQL credentials not set in .env")
        sys.exit(1)

    matimo = await Matimo.init(
        get_tools_path(), on_approval=make_approval_callback(auto_approve)
    )
    provider_tools = [t for t in matimo.list_tools() if t.name.startswith("postgres")]
    lc_tools = convert_tools_to_langchain(provider_tools, matimo)
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
            print(f"\n🔵  Tool: {tool_name}")
            print(f"    SQL: {tool_args.get('sql', tool_args)}")

            lc_tool = tool_map.get(tool_name)
            try:
                result = await lc_tool.ainvoke(tool_args) if lc_tool else f"Tool not found: {tool_name}"
            except Exception as exc:
                # A declined approval arrives here as a MatimoError.
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
