#!/usr/bin/env python3
"""
============================================================================
GITHUB TOOLS — LANGCHAIN REACT AGENT
============================================================================

PATTERN: LangChain ReAct Agent
────────────────────────────────────────────────────────────────────────────
Converts GitHub tools to LangChain StructuredTools, lets an OpenAI model
drive a multi-step ReAct loop to complete GitHub research tasks.

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set OPENAI_API_KEY and GITHUB_TOKEN in .env

USAGE:
────────────────────────────────────────────────────────────────────────────
  make github-langchain
  # custom task:
  uv run python github/github_langchain.py "Find the top 3 Python repos about LLMs"

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

DEFAULT_TASK = (
    "Search for the top 3 TypeScript repositories about AI agents on GitHub, "
    "sorted by stars. Summarise each one briefly."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     GitHub Tools — LangChain ReAct Agent               ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key, label in [("OPENAI_API_KEY", "OpenAI"), ("GITHUB_TOKEN", "GitHub token")]:
        if not os.environ.get(key):
            print(f"❌  {label} ({key}) not set in .env")
            sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    gh_tools = [t for t in matimo.list_tools() if t.name.startswith("github")]
    print(f"✅  Loaded {len(gh_tools)} GitHub tools")

    lc_tools = convert_tools_to_langchain(gh_tools, matimo)
    print(f"🔧  {len(lc_tools)} LangChain tools ready\n")

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    llm_with_tools = llm.bind_tools(lc_tools)
    tool_map = {t.name: t for t in lc_tools}

    messages = [HumanMessage(content=task)]
    print(f"🎯  Task: {task}\n")
    print("─" * 60)

    while True:
        response: AIMessage = await llm_with_tools.ainvoke(messages)
        messages.append(response)

        if not response.tool_calls:
            print(f"\n✨  Agent answer:\n{response.content}\n")
            break

        for call in response.tool_calls:
            print(f"\n🔨  {call['name']}  {call['args']}")
            lc_tool = tool_map.get(call["name"])
            try:
                result = await lc_tool.ainvoke(call["args"]) if lc_tool else f"Tool not found: {call['name']}"
            except Exception as exc:
                result = f"Error: {exc}"
            print(f"    → {str(result)[:200]}")
            messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))


def main() -> None:
    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_TASK
    asyncio.run(run(task))


if __name__ == "__main__":
    main()
