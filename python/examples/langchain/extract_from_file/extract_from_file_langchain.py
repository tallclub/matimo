#!/usr/bin/env python3
"""
============================================================================
EXTRACT_FROM_FILE TOOL — LANGCHAIN REACT AGENT
============================================================================

PATTERN: LangChain ReAct Agent with OpenAI
────────────────────────────────────────────────────────────────────────────
Converts the extract_from_file tool to a LangChain StructuredTool, binds it
to an OpenAI model, then runs a ReAct while-loop until the LLM produces
a final answer with no more tool calls.

Use this pattern when:
  ✅ You want the LLM to decide which file to extract and how to summarize it
  ✅ Multi-file analysis orchestrated by the model
  ✅ Natural-language document queries → automated extraction and analysis
  ⚠️  Be careful with untrusted LLM inputs — can read arbitrary local files
      or fetch arbitrary remote URLs (subject to the tool's SSRF guard)!

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…

USAGE:
────────────────────────────────────────────────────────────────────────────
  export MATIMO_AUTO_APPROVE=true
  uv run python langchain/extract_from_file/extract_from_file_langchain.py

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
    "Extract the contents of the CSV file created alongside this script "
    "(sample-report.csv, in the same directory) and tell me how many data "
    "rows and columns it has."
)


async def main(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Extract From File Tool — LangChain ReAct Agent    ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("OPENAI_API_KEY"):
        print("❌  OPENAI_API_KEY not set in .env")
        print("    Get one from: https://platform.openai.com/api-keys")
        sys.exit(1)

    # ── 1. Initialize Matimo ──────────────────────────────────────────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)

    extract_tool = None
    for t in matimo.list_tools():
        if t.name == "extract_from_file":
            extract_tool = t
            break

    if not extract_tool:
        print("❌  extract_from_file tool not found in Matimo")
        sys.exit(1)

    print("✅  Matimo initialized\n")

    # ── 2. Create a sample CSV for the agent to extract from ─────────────────
    sample_file = Path(__file__).parent / "sample-report.csv"
    sample_file.write_text("quarter,revenue,region\nQ1,120000,EMEA\nQ2,138000,EMEA\nQ3,151000,APAC\n")

    try:
        # ── 3. Convert to LangChain StructuredTools ───────────────────────────
        lc_tools = convert_tools_to_langchain([extract_tool], matimo)
        print(f"🔧  {len(lc_tools)} LangChain tool(s) ready\n")

        # ── 4. Bind tools to LLM ───────────────────────────────────────────────
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        llm_with_tools = llm.bind_tools(lc_tools)
        tool_map = {t.name: t for t in lc_tools}

        # ── 5. ReAct loop ───────────────────────────────────────────────────────
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
    finally:
        if sample_file.exists():
            sample_file.unlink()


def main_sync() -> None:
    """Synchronous entry point."""
    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_TASK
    asyncio.run(main(task))


if __name__ == "__main__":
    main_sync()
