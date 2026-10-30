"""postgres-execute-sql: schema handling and TLS mode (asyncpg is mocked)."""
from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from matimo.errors import MatimoError

TOOL = (
    Path(__file__).resolve().parents[2]
    / "src" / "matimo_postgres" / "tools" / "execute-sql" / "execute-sql.py"
)


@pytest.fixture
def tool(monkeypatch: pytest.MonkeyPatch) -> tuple[Any, MagicMock, AsyncMock]:
    conn = MagicMock()
    conn.execute = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    conn.close = AsyncMock()
    connect = AsyncMock(return_value=conn)
    monkeypatch.setitem(sys.modules, "asyncpg", types.SimpleNamespace(connect=connect))
    monkeypatch.setenv("MATIMO_POSTGRES_URL", "postgresql://u:p@db.example.com/app")
    monkeypatch.delenv("MATIMO_POSTGRES_SSL", raising=False)
    spec = importlib.util.spec_from_file_location("execute_sql_under_test", TOOL)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module, conn, connect


@pytest.mark.asyncio
async def test_schema_is_a_bound_parameter_never_interpolated(
    tool: tuple[Any, MagicMock, AsyncMock],
) -> None:
    module, conn, _ = tool
    hostile = "public; DROP TABLE users; --"
    await module.run({"sql": "SELECT 1", "schema": hostile})
    conn.execute.assert_awaited_once_with("SELECT set_config('search_path', $1, false)", hostile)
    for call in conn.execute.await_args_list:
        assert hostile not in call.args[0]


@pytest.mark.asyncio
async def test_no_ssl_kwarg_by_default(tool: tuple[Any, MagicMock, AsyncMock]) -> None:
    module, _, connect = tool
    await module.run({"sql": "SELECT 1"})
    connect.assert_awaited_once_with("postgresql://u:p@db.example.com/app")


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["require", "verify-ca", "verify-full", "VERIFY-FULL"])
async def test_ssl_mode_is_forwarded(
    tool: tuple[Any, MagicMock, AsyncMock], monkeypatch: pytest.MonkeyPatch, mode: str
) -> None:
    module, _, connect = tool
    monkeypatch.setenv("MATIMO_POSTGRES_SSL", mode)
    await module.run({"sql": "SELECT 1"})
    assert connect.await_args.kwargs == {"ssl": mode.lower()}


@pytest.mark.asyncio
async def test_unknown_ssl_mode_is_rejected(
    tool: tuple[Any, MagicMock, AsyncMock], monkeypatch: pytest.MonkeyPatch
) -> None:
    module, _, connect = tool
    monkeypatch.setenv("MATIMO_POSTGRES_SSL", "sometimes")
    with pytest.raises(MatimoError, match="Invalid MATIMO_POSTGRES_SSL"):
        await module.run({"sql": "SELECT 1"})
    connect.assert_not_awaited()
