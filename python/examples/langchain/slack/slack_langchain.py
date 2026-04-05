#!/usr/bin/env python3
"""
============================================================================
SLACK TOOLS — LANGCHAIN REACT AGENT
============================================================================

PATTERN: LangChain ReAct Agent
────────────────────────────────────────────────────────────────────────────
Converts all Slack tools to LangChain StructuredTools, binds them to
an OpenAI model, then runs a ReAct while-loop until the LLM produces
a final answer with no more tool calls.

Use this pattern when:
  ✅ You want the LLM to decide which Slack tools to call
  ✅ Multi-step Slack workflows orchestrated by the model
  ✅ Natural-language commands → Slack actions

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…
    SLACK_BOT_TOKEN=xoxb-…

USAGE:
────────────────────────────────────────────────────────────────────────────
  make slack-langchain
  # or with a custom task:
  uv run python slack/slack_langchain.py "Post a daily standup reminder to the first channel"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_openai import ChatOpenAI
from matimo_slack import get_tools_path

from matimo import Matimo
from matimo.integrations.langchain import convert_tools_to_langchain

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "List the Slack channels available, pick the first public one, "
    "and send a friendly hello message to it."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Slack Tools — LangChain ReAct Agent                ║")
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

    # ── 2. Convert to LangChain StructuredTools ───────────────────────────────
    lc_tools = convert_tools_to_langchain(slack_tools, matimo)
    print(f"🔧  {len(lc_tools)} LangChain tools ready\n")

    # ── 3. Bind tools to LLM ─────────────────────────────────────────────────
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    llm_with_tools = llm.bind_tools(lc_tools)
    tool_map = {t.name: t for t in lc_tools}

    # ── 4. ReAct loop ─────────────────────────────────────────────────────────
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
            if lc_tool is None:
                result = f"Error: tool '{call['name']}' not found"
            else:
                try:
                    result = await lc_tool.ainvoke(call["args"])
                except Exception as exc:
                    result = f"Error: {exc}"
            print(f"    → {str(result)[:200]}")
            messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))


def main() -> None:
    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_TASK
    asyncio.run(run(task))


if __name__ == "__main__":
    main()
