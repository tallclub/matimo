#!/usr/bin/env python3
"""
============================================================================
EXTRACT_FROM_FILE TOOL — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with a document-analyst agent
────────────────────────────────────────────────────────────────────────────
Converts the extract_from_file core tool to a CrewAI BaseTool, creates a
document analyst agent, and runs the crew to extract and summarize a file.

Use this pattern when:
  ✅ You want CrewAI role-based agents to read and summarize documents
  ✅ Automated report/CSV/PDF/DOCX ingestion as part of a larger crew
  ✅ Natural-language document questions answered by an LLM agent

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…

USAGE:
────────────────────────────────────────────────────────────────────────────
  make extract-from-file-crewai
  # or with a custom task:
  uv run python crewai/extract_from_file/extract_from_file_crewai.py "Summarize the sample report"

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
    "Extract the contents of the CSV file created alongside this script "
    "(sample-report.csv, in the same directory) and summarize the revenue "
    "trend across quarters."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Extract From File Tool — CrewAI Crew               ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("OPENAI_API_KEY"):
        print("❌  OPENAI_API_KEY not set in .env")
        sys.exit(1)

    # ── 1. Initialise Matimo (auto-discovers built-in core tools) ────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    extract_tools = [t for t in matimo.list_tools() if t.name == "extract_from_file"]
    print(f"✅  Loaded {len(extract_tools)} extract_from_file tool(s)\n")

    if not extract_tools:
        print("❌  extract_from_file tool not found")
        sys.exit(1)

    # ── 2. Create a sample CSV for the crew to extract from ──────────────────
    sample_file = Path(__file__).parent / "sample-report.csv"
    sample_file.write_text("quarter,revenue,region\nQ1,120000,EMEA\nQ2,138000,EMEA\nQ3,151000,APAC\n")

    try:
        # ── 3. Convert to CrewAI BaseTools ───────────────────────────────────────
        crewai_tools = convert_tools_to_crewai(extract_tools, matimo)
        print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

        # ── 4. Build Agent + Task + Crew ─────────────────────────────────────────
        agent = Agent(
            role="Document Analyst",
            goal="Extract and analyse text from local or remote documents to answer questions accurately.",
            backstory=(
                "You are a meticulous document analyst who extracts text from PDFs, "
                "Word documents, plain text, and CSV files, then translates the raw "
                "content into clear, actionable summaries for stakeholders."
            ),
            llm="gpt-4o-mini",
            tools=crewai_tools,
            verbose=True,
        )

        crew_task = Task(
            description=task,
            agent=agent,
            expected_output="A concise summary of the extracted document content with key findings.",
        )

        crew = Crew(
            agents=[agent],
            tasks=[crew_task],
            process=Process.sequential,
            verbose=True,
        )

        # ── 5. Run crew (kickoff is synchronous — wrap in executor) ───────────────
        print(f"🎯  Task: {task}\n")
        print("─" * 60)

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, crew.kickoff)

        print("\n" + "─" * 60)
        print(f"\n✨  Crew result:\n{result}\n")
    finally:
        if sample_file.exists():
            sample_file.unlink()


def main() -> None:
    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_TASK
    asyncio.run(run(task))


if __name__ == "__main__":
    main()
