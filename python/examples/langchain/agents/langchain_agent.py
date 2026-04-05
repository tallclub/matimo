#!/usr/bin/env python3
"""
============================================================================
GENERIC LANGCHAIN REACT AGENT
============================================================================

PATTERN: LangChain ReAct Agent
────────────────────────────────────────────────────────────────────────────
Loads all installed Matimo provider packages, converts them to LangChain
StructuredTools, and runs a full ReAct loop where the LLM decides which
tools to call.

Use this pattern when:
  ✅ You want the LLM to reason about which tools to use
  ✅ You need a multi-step autonomous agent
  ✅ You have multiple providers and want them all available

SETUP:
────────────────────────────────────────────────────────────────────────────
1. Copy .env.example → .env and fill in credentials
2. Install dependencies: make install

USAGE:
────────────────────────────────────────────────────────────────────────────
  make agent-langchain
  # or
  uv run python agents/langchain_agent.py
  # with a custom mission:
  uv run python agents/langchain_agent.py "List all open GitHub issues in matimo-ai/matimo"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_openai import ChatOpenAI

from matimo import Matimo
from matimo.integrations.langchain import convert_tools_to_langchain

# Load .env from examples directory (where this project lives)
load_dotenv(Path(__file__).parent.parent.parent / ".env")


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

DEFAULT_MISSION = (
    "List the available Slack channels, then send a short hello message "
    "to the first public channel you find."
)


async def run_agent(mission: str) -> None:
    """Run a multi-provider ReAct agent for the given mission."""

    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Matimo — Generic LangChain ReAct Agent             ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        print("❌  OPENAI_API_KEY not set in .env")
        sys.exit(1)

    # ── 1. Initialise Matimo (auto-discover all installed providers) ──────────
    print("🚀  Initialising Matimo (auto-discover mode)…")
    matimo = await Matimo.init(auto_discover=True)
    all_tools = matimo.list_tools()
    print(f"✅  Loaded {len(all_tools)} tools across all providers\n")

    # ── 2. Convert to LangChain StructuredTools ───────────────────────────────
    lc_tools = convert_tools_to_langchain(all_tools, matimo)
    print(f"🔧  {len(lc_tools)} LangChain tools ready\n")

    # ── 3. Bind tools to LLM ─────────────────────────────────────────────────
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    llm_with_tools = llm.bind_tools(lc_tools)

    tool_map = {t.name: t for t in lc_tools}

    # ── 4. ReAct loop ─────────────────────────────────────────────────────────
    messages = [HumanMessage(content=mission)]
    print(f"🎯  Mission: {mission}\n")
    print("─" * 60)

    while True:
        response: AIMessage = await llm_with_tools.ainvoke(messages)
        messages.append(response)

        if not response.tool_calls:
            # LLM is done — print final answer
            print(f"\n✨  Agent answer:\n{response.content}\n")
            break

        for call in response.tool_calls:
            tool_name = call["name"]
            tool_args = call["args"]
            print(f"\n🔨  Tool call: {tool_name}")
            print(f"    Args: {tool_args}")

            lc_tool = tool_map.get(tool_name)
            if lc_tool is None:
                result = f"Error: tool '{tool_name}' not found"
            else:
                try:
                    result = await lc_tool.ainvoke(tool_args)
                except Exception as exc:
                    result = f"Error executing {tool_name}: {exc}"

            print(f"    Result: {str(result)[:200]}")
            messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))


def main() -> None:
    mission = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_MISSION
    asyncio.run(run_agent(mission))


if __name__ == "__main__":
    main()
