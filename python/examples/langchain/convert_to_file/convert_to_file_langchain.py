#!/usr/bin/env python3
"""
============================================================================
CONVERT_TO_FILE TOOL — LANGCHAIN REACT AGENT
============================================================================

PATTERN: LangChain ReAct Agent with OpenAI
────────────────────────────────────────────────────────────────────────────
Converts the convert_to_file tool to a LangChain StructuredTool, binds it
to an OpenAI model, then runs a ReAct while-loop until the LLM produces
a final answer with no more tool calls.

Use this pattern when:
  ✅ You want the LLM to decide which content to convert and to what format
  ✅ Multi-format report generation orchestrated by the model
  ✅ Natural-language "turn this into a PDF/DOCX/CSV" requests
  ⚠️  Be careful with untrusted LLM inputs — output_path can write arbitrary
      files to the local filesystem (subject to the tool's path resolution)!

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…

USAGE:
────────────────────────────────────────────────────────────────────────────
  export MATIMO_AUTO_APPROVE=true
  uv run python langchain/convert_to_file/convert_to_file_langchain.py

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
    'Convert this JSON content to CSV using convert_to_file: '
    '[{"name":"Ada","role":"Mathematician"},{"name":"Alan","role":"Computer Scientist"}]. '
    "source_format is json and target_format is csv. Tell me the resulting MIME type."
)


async def main(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Convert To File Tool — LangChain ReAct Agent        ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("OPENAI_API_KEY"):
        print("❌  OPENAI_API_KEY not set in .env")
        print("    Get one from: https://platform.openai.com/api-keys")
        sys.exit(1)

    # ── 1. Initialize Matimo ──────────────────────────────────────────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)

    convert_tool = None
    for t in matimo.list_tools():
        if t.name == "convert_to_file":
            convert_tool = t
            break

    if not convert_tool:
        print("❌  convert_to_file tool not found in Matimo")
        sys.exit(1)

    print("✅  Matimo initialized\n")

    # ── 2. Convert to LangChain StructuredTools ───────────────────────────
    lc_tools = convert_tools_to_langchain([convert_tool], matimo)
    print(f"🔧  {len(lc_tools)} LangChain tool(s) ready\n")

    # ── 3. Bind tools to LLM ───────────────────────────────────────────────
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    llm_with_tools = llm.bind_tools(lc_tools)
    tool_map = {t.name: t for t in lc_tools}

    # ── 4. ReAct loop ───────────────────────────────────────────────────────
    messages = [HumanMessage(content=task)]
    print(f"🎯  Task: {task}\n")
    print("─" * 60)

    iteration = 0
    max_iterations = 10

    while iteration < max_iterations:
        iteration += 1

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

            result_str = str(result)[:300]
            print(f"    → {result_str}")
            messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))

    if iteration >= max_iterations:
        print(f"\n⚠️  Reached max iterations ({max_iterations})")


def main_sync() -> None:
    """Synchronous entry point."""
    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_TASK
    asyncio.run(main(task))


if __name__ == "__main__":
    main_sync()
