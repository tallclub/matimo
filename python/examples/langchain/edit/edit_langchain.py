#!/usr/bin/env python3
"""
============================================================================
EDIT TOOL — LANGCHAIN REACT AGENT
============================================================================

PATTERN: LangChain ReAct Agent with OpenAI
────────────────────────────────────────────────────────────────────────────
Converts the edit tool to a LangChain StructuredTool, binds it to
an OpenAI model, then runs a ReAct while-loop until the LLM produces
a final answer with no more tool calls.

Use this pattern when:
  ✅ You want the LLM to decide how/when to edit files
  ✅ Autonomous code generation and file updates
  ✅ Natural-language requests → automated file edits
  ⚠️  SECURITY WARNING: Can modify any file the process can write!
  ⚠️  ONLY use with trusted LLM inputs and restricted directories!

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…

USAGE:
────────────────────────────────────────────────────────────────────────────
  uv run python edit/edit_langchain.py

============================================================================
"""

import asyncio
import os
import shutil
import sys
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_openai import ChatOpenAI

from matimo import ApprovalRequest, Matimo
from matimo.integrations.langchain import convert_tools_to_langchain

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def approve(request: ApprovalRequest) -> bool:
    """Ask in the terminal before any tool call that needs approval."""
    print(f"\n🔒  Approval required — {request.tool_name}: {request.params}")
    if not sys.stdin.isatty():
        print(
            "    ❌  Rejected: no terminal. Pre-approve with "
            f'MATIMO_APPROVED_PATTERNS="{request.tool_name}"'
        )
        return False
    return input("    Approve? [y/N] ").strip().lower() in ("y", "yes")


SAMPLE_TODOS = (
    "# Project TODOs\n"
    "TODO: Add authentication to the login page\n"
    "TODO: Write unit tests for the auth module\n"
    "TODO: Update the README\n"
)

# {file} is replaced with the path of a temporary copy of SAMPLE_TODOS.
DEFAULT_TASK = (
    "In the file {file}, mark the authentication TODO as DONE, then add a new "
    'line "TODO: Set up error logging" at the end of the file. '
    "Tell me what you changed."
)


async def main(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Edit Tool — LangChain ReAct Agent                 ║")
    print("║     ⚠️  WARNING: Can modify files!                    ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # Check for API key
    if not os.environ.get("OPENAI_API_KEY"):
        print("❌  OPENAI_API_KEY not set in .env")
        print("    Get one from: https://platform.openai.com/api-keys")
        sys.exit(1)

    # ── 1. Initialize Matimo ──────────────────────────────────────────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True, on_approval=approve)
    
    # Find edit tool
    edit_tool = None
    for tool in matimo.list_tools():
        if tool.name == "edit":
            edit_tool = tool
            break
    
    if not edit_tool:
        print("❌  Edit tool not found in Matimo")
        sys.exit(1)
    
    print("✅  Matimo initialized\n")

    # ── 2. Convert to LangChain StructuredTools ───────────────────────────────
    lc_tools = convert_tools_to_langchain([edit_tool], matimo)
    print(f"🔧  {len(lc_tools)} LangChain tool(s) ready\n")

    # ── 3. Bind tools to LLM ──────────────────────────────────────────────────
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    llm_with_tools = llm.bind_tools(lc_tools)
    tool_map = {t.name: t for t in lc_tools}

    # ── 4. A temporary file for the agent to edit ──────────────────────────────
    work_dir = Path(tempfile.mkdtemp(prefix="matimo-edit-"))
    todo_file = work_dir / "todos.md"
    todo_file.write_text(SAMPLE_TODOS)
    task = task.replace("{file}", str(todo_file))

    # ── 5. ReAct loop ─────────────────────────────────────────────────────────
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

    print(f"📄  File after the agent's edits:\n{todo_file.read_text()}")

    # Clean up: only the temporary directory this example created
    shutil.rmtree(work_dir, ignore_errors=True)


def main_sync() -> None:
    """Synchronous entry point."""
    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_TASK
    asyncio.run(main(task))


if __name__ == "__main__":
    main_sync()
