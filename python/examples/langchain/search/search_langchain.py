#!/usr/bin/env python3
"""
============================================================================
SEARCH TOOL — LANGCHAIN REACT AGENT
============================================================================

PATTERN: LangChain ReAct Agent with OpenAI
────────────────────────────────────────────────────────────────────────────
Converts the search tool to a LangChain StructuredTool, binds it to
an OpenAI model, then runs a ReAct while-loop until the LLM produces
a final answer with no more tool calls.

Use this pattern when:
  ✅ You want the LLM to decide what files/patterns to search
  ✅ Multi-file analysis with intelligent pattern discovery
  ✅ Natural-language search queries → automated file discovery
  ⚠️  Be careful with untrusted LLM inputs — can search arbitrary files!

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…

USAGE:
────────────────────────────────────────────────────────────────────────────
  export MATIMO_AUTO_APPROVE=true
  uv run python search/search_langchain.py

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

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "In the examples directory, search for Python files that contain "
    "'async def main' and list the files you find."
)


async def main(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Search Tool — LangChain ReAct Agent              ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # Check for API key
    if not os.environ.get("OPENAI_API_KEY"):
        print("❌  OPENAI_API_KEY not set in .env")
        print("    Get one from: https://platform.openai.com/api-keys")
        sys.exit(1)

    # ── 1. Initialize Matimo ──────────────────────────────────────────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    
    # Find search tool
    search_tool = None
    for tool in matimo.list_tools():
        if tool.name == "search":
            search_tool = tool
            break
    
    if not search_tool:
        print("❌  Search tool not found in Matimo")
        sys.exit(1)
    
    print("✅  Matimo initialized\n")

    # ── 2. Convert to LangChain StructuredTools ───────────────────────────────
    lc_tools = convert_tools_to_langchain([search_tool], matimo)
    print(f"🔧  {len(lc_tools)} LangChain tool(s) ready\n")

    # ── 3. Bind tools to LLM ──────────────────────────────────────────────────
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    llm_with_tools = llm.bind_tools(lc_tools)
    tool_map = {t.name: t for t in lc_tools}

    # ── 4. ReAct loop ─────────────────────────────────────────────────────────
    messages = [HumanMessage(content=task)]
    print(f"🎯  Task: {task}\n")
    print("─" * 60)

    iteration = 0
    max_iterations = 10

    while iteration < max_iterations:
        iteration += 1
        
        # Get response from LLM
        response: AIMessage = await llm_with_tools.ainvoke(messages)
        messages.append(response)

        # If no tool calls, we're done
        if not response.tool_calls:
            print(f"\n✨  Agent answer:\n{response.content}\n")
            break

        # Execute each tool call
        for call in response.tool_calls:
            args_str = str(call['args'])[:100]
            print(f"\n🔨  {call['name']}  {args_str}...")
            lc_tool = tool_map.get(call["name"])
            
            if lc_tool is None:
                result = f"Error: tool '{call['name']}' not found"
            else:
                try:
                    result = await lc_tool.ainvoke(call["args"])
                except Exception as exc:
                    result = f"Error: {exc}"
            
            result_str = str(result)[:300]
            print(f"    → {result_str}")
            messages.append(ToolMessage(
                content=str(result),
                tool_call_id=call["id"]
            ))

    if iteration >= max_iterations:
        print(f"\n⚠️  Reached max iterations ({max_iterations})")


def main_sync() -> None:
    """Synchronous entry point."""
    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_TASK
    asyncio.run(main(task))


if __name__ == "__main__":
    main_sync()
