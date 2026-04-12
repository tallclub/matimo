#!/usr/bin/env python3
"""
============================================================================
POSTGRESQL TOOLS — DECORATOR PATTERN
============================================================================
@tool decorator pattern — each method auto-routes through Matimo.

SETUP:  Set MATIMO_POSTGRES_URL in .env
USAGE:  make postgres-decorator
============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from matimo_postgres import get_tools_path

from matimo import Matimo
from matimo.decorators import set_global_matimo_instance, tool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


class PostgresService:
    """PostgreSQL operations via the @tool decorator pattern."""

    @tool("postgres-execute-query")
    async def execute_query(self, query: str):
        ...


async def run() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     PostgreSQL Tools — Decorator Pattern               ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    has_url = bool(os.environ.get("MATIMO_POSTGRES_URL"))
    has_host = bool(os.environ.get("MATIMO_POSTGRES_HOST"))
    if not has_url and not has_host:
        print("❌  PostgreSQL credentials not set in .env")
        sys.exit(1)

    matimo = await Matimo.init(get_tools_path())
    set_global_matimo_instance(matimo)
    tools = [t for t in matimo.list_tools() if t.name.startswith("postgres")]
    print(f"✅  Loaded {len(tools)} PostgreSQL tool(s)\n")

    svc = PostgresService()

    print("🗄️   Listing tables…")
    result = await svc.execute_query(
        query="SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 5"
    )
    data = (result or {}).get("data", result) or {}
    rows = data.get("rows", data if isinstance(data, list) else [])
    for row in (rows or [])[:5]:
        print(f"   • {row}")

    print("\n" + "═" * 60)
    print("✨  Decorator Pattern example complete!\n")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
