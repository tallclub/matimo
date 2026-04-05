#!/usr/bin/env python3
"""
============================================================================
POSTGRESQL TOOLS — HUMAN-IN-THE-LOOP APPROVAL
============================================================================

PATTERN: LangChain ReAct Agent with approval gate for write SQL
────────────────────────────────────────────────────────────────────────────
The LLM suggests SQL queries. Before any INSERT/UPDATE/DELETE/DROP/TRUNCATE
is executed, the user must explicitly approve it. Read-only queries (SELECT)
run automatically.

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
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_openai import ChatOpenAI
from matimo_postgres import get_tools_path

from matimo import Matimo
from matimo.integrations.langchain import convert_tools_to_langchain

load_dotenv(Path(__file__).parent.parent.parent / ".env")

# SQL keywords that indicate mutations
WRITE_PATTERN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE)\b",
    re.IGNORECASE,
)

DEFAULT_TASK = "List all tables and their row counts, then add a test record to the 'logs' table if it exists."


def is_write_query(args: dict) -> bool:
    query = args.get("query", "")
    return bool(WRITE_PATTERN.search(query))


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

    matimo = await Matimo.init(get_tools_path())
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
            write = is_write_query(tool_args)

            print(f"\n{'🔴' if write else '🔵'}  Tool: {tool_name}")
            print(f"    SQL: {tool_args.get('query', tool_args)}")

            if write:
                if auto_approve:
                    print("    ✅  Auto-approved")
                    approved = True
                else:
                    try:
                        answer = input("    ⚠️   Write query detected. Execute? [y/N] ").strip().lower()
                        approved = answer == "y"
                    except EOFError:
                        approved = False

                if not approved:
                    result = "Query declined by user — not executed."
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
