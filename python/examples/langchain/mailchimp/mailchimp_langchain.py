#!/usr/bin/env python3
"""
============================================================================
MAILCHIMP TOOLS — LANGCHAIN REACT AGENT
============================================================================
Converts Mailchimp tools to LangChain StructuredTools and runs a ReAct loop.

SETUP:  Set OPENAI_API_KEY and MAILCHIMP_API_KEY in .env
USAGE:
  make mailchimp-langchain
  uv run python mailchimp/mailchimp_langchain.py "Show me my audiences and last 3 campaigns"
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_openai import ChatOpenAI
from matimo_mailchimp import get_tools_path

from matimo import Matimo
from matimo.integrations.langchain import convert_tools_to_langchain

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = "Show me my Mailchimp audiences and the last 3 campaigns sent."


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Mailchimp Tools — LangChain ReAct Agent            ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    for key, label in [("OPENAI_API_KEY", "OpenAI"), ("MAILCHIMP_API_KEY", "Mailchimp key")]:
        if not os.environ.get(key):
            print(f"❌  {label} ({key}) not set in .env")
            sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    provider_tools = [t for t in matimo.list_tools() if t.name.startswith("mailchimp")]
    lc_tools = convert_tools_to_langchain(provider_tools, matimo)
    print(f"✅  {len(lc_tools)} LangChain tools ready\n")

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
