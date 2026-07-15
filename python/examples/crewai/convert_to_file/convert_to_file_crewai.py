#!/usr/bin/env python3
"""
============================================================================
CONVERT_TO_FILE TOOL — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with a report-writer agent
────────────────────────────────────────────────────────────────────────────
Converts the convert_to_file core tool to a CrewAI BaseTool, creates a
report-writing agent, and runs the crew to turn structured content into a
target file format (PDF, DOCX, CSV, JSON, TXT).

Use this pattern when:
  ✅ You want CrewAI role-based agents to produce deliverable files
  ✅ Automated report generation (Markdown -> PDF/DOCX) as part of a larger crew
  ✅ Natural-language "give me this as a file" requests answered by an LLM agent

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…

USAGE:
────────────────────────────────────────────────────────────────────────────
  make convert-to-file-crewai
  # or with a custom task:
  uv run python crewai/convert_to_file/convert_to_file_crewai.py "Turn the sample CSV into JSON"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv

from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "Convert this Markdown content to a DOCX file using convert_to_file: "
    '"# Meeting Notes\\n\\n- Decision one\\n- Decision two". '
    "source_format is markdown and target_format is docx. "
    "Report the resulting MIME type and size in bytes."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Convert To File Tool — CrewAI Crew                 ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("OPENAI_API_KEY"):
        print("❌  OPENAI_API_KEY not set in .env")
        sys.exit(1)

    # ── 1. Initialise Matimo (auto-discovers built-in core tools) ────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    convert_tools = [t for t in matimo.list_tools() if t.name == "convert_to_file"]
    print(f"✅  Loaded {len(convert_tools)} convert_to_file tool(s)\n")

    if not convert_tools:
        print("❌  convert_to_file tool not found")
        sys.exit(1)

    # ── 2. Convert to CrewAI BaseTools ───────────────────────────────────────
    crewai_tools = convert_tools_to_crewai(convert_tools, matimo)
    print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

    # ── 3. Build Agent + Task + Crew ─────────────────────────────────────────
    agent = Agent(
        role="Report Writer",
        goal="Convert structured content (JSON, CSV, Markdown, text) into the file format a stakeholder needs.",
        backstory=(
            "You are a meticulous report writer who turns raw JSON, CSV, Markdown, "
            "and plain text into polished deliverable files — CSV exports, JSON "
            "payloads, and Markdown reports rendered as PDF or Word documents."
        ),
        llm="gpt-4o-mini",
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="Confirmation of the conversion, including MIME type and size in bytes.",
    )

    crew = Crew(
        agents=[agent],
        tasks=[crew_task],
        process=Process.sequential,
        verbose=True,
    )

    # ── 4. Run crew (kickoff is synchronous — wrap in executor) ───────────────
    print(f"🎯  Task: {task}\n")
    print("─" * 60)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, crew.kickoff)

    print("\n" + "─" * 60)
    print(f"\n✨  Crew result:\n{result}\n")


def main() -> None:
    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_TASK
    asyncio.run(run(task))


if __name__ == "__main__":
    main()
