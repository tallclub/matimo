"""
execute-sql — Execute arbitrary SQL against a PostgreSQL database.
Mirrors: typescript/packages/postgres/tools/execute-sql/execute-sql.ts
"""
from __future__ import annotations

import os
from typing import Any
from urllib.parse import quote_plus

from matimo.errors import ErrorCode, MatimoError


async def run(params: dict[str, Any]) -> dict[str, Any]:
    sql: str = params.get("sql", "").strip()
    query_params: list | None = params.get("params")
    schema: str | None = params.get("schema")

    if not sql:
        raise MatimoError(
            "Missing SQL statement",
            ErrorCode.EXECUTION_FAILED,
            {"tool_name": "postgres-execute-sql"},
        )

    # Build connection string from MATIMO_POSTGRES_URL or separate env vars
    connection_string = os.environ.get("MATIMO_POSTGRES_URL")

    if not connection_string:
        host = os.environ.get("MATIMO_POSTGRES_HOST")
        port = os.environ.get("MATIMO_POSTGRES_PORT", "5432")
        user = os.environ.get("MATIMO_POSTGRES_USER")
        password = os.environ.get("MATIMO_POSTGRES_PASSWORD")
        database = os.environ.get("MATIMO_POSTGRES_DB")

        if host and user and password and database:
            connection_string = (
                f"postgresql://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{database}"
            )

    if not connection_string:
        raise MatimoError(
            "Postgres connection information not provided. "
            "Set MATIMO_POSTGRES_URL or MATIMO_POSTGRES_HOST/PORT/USER/PASSWORD/DB",
            ErrorCode.EXECUTION_FAILED,
            {"tool_name": "postgres-execute-sql"},
        )

    try:
        import asyncpg  # type: ignore[import]
    except ImportError:
        raise MatimoError(
            "asyncpg is required for the postgres tool. Install it with: pip install asyncpg",
            ErrorCode.EXECUTION_FAILED,
            {"tool_name": "postgres-execute-sql"},
        ) from None

    conn = None
    try:
        conn = await asyncpg.connect(connection_string)

        # Set search_path if schema is specified
        if schema:
            await conn.execute(f"SET search_path TO {schema}")

        rows = await conn.fetch(sql, *(query_params or []))
        return {
            "rows": [dict(row) for row in rows],
            "row_count": len(rows),
        }

    except MatimoError:
        raise
    except Exception as exc:
        msg = str(exc)
        details: dict[str, Any] = {"original_message": msg}

        if "Connection refused" in msg or "ECONNREFUSED" in msg:
            details["hint"] = "Connection refused — is Postgres running at the configured host/port?"
        elif "role" in msg and "does not exist" in msg:
            details["hint"] = "Database user does not exist — check MATIMO_POSTGRES_USER env var"
        elif "database" in msg and "does not exist" in msg:
            details["hint"] = "Database does not exist — check MATIMO_POSTGRES_DB env var"

        raise MatimoError(
            f"Postgres query failed: {msg}",
            ErrorCode.EXECUTION_FAILED,
            {"tool_name": "postgres-execute-sql", "details": details},
        ) from exc

    finally:
        if conn:
            await conn.close()
