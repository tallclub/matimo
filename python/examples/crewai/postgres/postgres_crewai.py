#!/usr/bin/env python3
"""
============================================================================
POSTGRES TOOLS — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with a database analyst agent
────────────────────────────────────────────────────────────────────────────
Converts all PostgreSQL tools to CrewAI BaseTools, creates a database
analyst agent, and runs the crew to query and analyse data.

Use this pattern when:
  ✅ You want CrewAI role-based agents querying a PostgreSQL database
  ✅ Automated schema exploration and data analysis
  ✅ SQL query generation and result interpretation

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…
    POSTGRES_CONNECTION_STRING=postgresql://user:password@host:5432/dbname
    # or individual vars:
    POSTGRES_HOST=localhost
    POSTGRES_PORT=5432
    POSTGRES_DB=mydb
    POSTGRES_USER=myuser
    POSTGRES_PASSWORD=mypassword

USAGE:
────────────────────────────────────────────────────────────────────────────
  make postgres-crewai
  # or with a custom task:
  uv run python postgres/postgres_crewai.py "List all tables and their row counts"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from matimo_postgres import get_tools_path

from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "List the tables available in the database schemas "
    "and return a brief description of what each table likely contains."
)


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     PostgreSQL Tools — CrewAI Crew                     ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("OPENAI_API_KEY"):
        print("❌  OPENAI_API_KEY not set in .env")
        sys.exit(1)

    pg_vars = ["POSTGRES_CONNECTION_STRING", "POSTGRES_HOST"]
    if not any(os.environ.get(v) for v in pg_vars):
        print("❌  No PostgreSQL connection configured in .env")
        print("    Set POSTGRES_CONNECTION_STRING or POSTGRES_HOST/DB/USER/PASSWORD")
        sys.exit(1)

    # ── 1. Initialise Matimo with PostgreSQL tools ────────────────────────────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(get_tools_path())
    pg_tools = [t for t in matimo.list_tools() if t.name.startswith("postgres")]
    print(f"✅  Loaded {len(pg_tools)} PostgreSQL tools\n")

    # ── 2. Convert to CrewAI BaseTools ───────────────────────────────────────
    crewai_tools = convert_tools_to_crewai(pg_tools, matimo)
    print(f"🔧  {len(crewai_tools)} CrewAI tools ready\n")

    # ── 3. Build Agent + Task + Crew ─────────────────────────────────────────
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    agent = Agent(
        role="Database Analyst",
        goal="Query and analyse the PostgreSQL database to answer data questions accurately and safely.",
        backstory=(
            "You are a senior database analyst with deep SQL expertise. "
            "You can explore schemas, write efficient queries, and translate raw data "
            "into clear, actionable insights for stakeholders."
        ),
        llm=llm,
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="A structured data analysis report with findings and supporting query results.",
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
