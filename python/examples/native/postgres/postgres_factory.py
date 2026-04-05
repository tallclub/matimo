#!/usr/bin/env python3
"""
============================================================================
POSTGRESQL TOOLS — FACTORY PATTERN
============================================================================
Direct tool execution via Matimo.init() — no LLM, deterministic queries.

SETUP:
  Set MATIMO_POSTGRES_URL=postgresql://user:pass@host:5432/db in .env
  (or MATIMO_POSTGRES_HOST/PORT/USER/PASSWORD/DB separately)
USAGE:  make postgres-factory
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_postgres import get_tools_path

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     PostgreSQL Tools — Factory Pattern                 ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    has_url = bool(os.environ.get("MATIMO_POSTGRES_URL"))
    has_host = bool(os.environ.get("MATIMO_POSTGRES_HOST"))
    if not has_url and not has_host:
        print("❌  PostgreSQL credentials not set in .env")
        print("    Set MATIMO_POSTGRES_URL or MATIMO_POSTGRES_HOST/PORT/USER/PASSWORD/DB")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    tools = [t for t in matimo.list_tools() if t.name.startswith("postgres")]
    print(f"✅  Loaded {len(tools)} PostgreSQL tool(s)\n")
    print("═" * 60)

    # ── Example 1: Execute a simple SELECT ────────────────────────────────────
    print("\n1️⃣   Listing tables in public schema…")
    result = await matimo.execute(
        "postgres-execute-query",
        {
            "query": "SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 10",
        },
    )
    data = (result or {}).get("data", result) or {}
    rows = data.get("rows", data if isinstance(data, list) else [])
    if rows:
        print(f"   ✅  {len(rows)} table(s):")
        for row in rows[:5]:
            print(f"      • {row}")
    else:
        print(f"   ℹ️   No tables or error: {str(data)[:100]}")

    # ── Example 2: Count rows in first table ──────────────────────────────────
    if rows:
        table = rows[0].get("table_name", "") if isinstance(rows[0], dict) else str(rows[0])
        if table:
            print(f"\n2️⃣   Counting rows in '{table}'…")
            result = await matimo.execute(
                "postgres-execute-query",
                {"query": f"SELECT COUNT(*) AS count FROM {table}"},
            )
            data = (result or {}).get("data", result) or {}
            count_rows = data.get("rows", data if isinstance(data, list) else [])
            if count_rows:
                print(f"   ✅  {count_rows[0]}")

    print("\n" + "═" * 60)
    print("✨  Factory Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
