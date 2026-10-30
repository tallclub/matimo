"""HTTP-mode MCP hardening: auth is mandatory and the bind address defaults to loopback."""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from matimo.mcp.server import MCPServer, MCPServerOptions


def test_default_bind_host_is_loopback() -> None:
    assert MCPServerOptions().host == "127.0.0.1"


async def _serve(options: MCPServerOptions) -> tuple[MCPServer, dict[str, Any], MagicMock]:
    matimo = MagicMock()
    matimo.list_tools.return_value = []
    server = MCPServer(matimo, options)
    captured: dict[str, Any] = {}
    sm = MagicMock()
    sm.run.return_value = MagicMock(__aenter__=AsyncMock(), __aexit__=AsyncMock())
    sm.handle_request = AsyncMock()

    def fake_config(app: Any, **kw: Any) -> MagicMock:  # noqa: ANN401
        captured.update(kw, app=app)
        return MagicMock()

    with (
        patch("uvicorn.Config", side_effect=fake_config),
        patch("uvicorn.Server", return_value=MagicMock(serve=AsyncMock())),
        patch("mcp.server.streamable_http_manager.StreamableHTTPSessionManager", return_value=sm),
    ):
        await server._run_http(MagicMock())
    return server, captured, sm


async def _call(app: Any, headers: list[tuple[bytes, bytes]]) -> int:  # noqa: ANN401
    sent: list[dict[str, Any]] = []

    async def send(message: dict[str, Any]) -> None:
        sent.append(message)

    scope = {"type": "http", "method": "POST", "path": "/mcp", "headers": headers}
    await app(scope, AsyncMock(return_value={}), send)
    starts = [m for m in sent if m["type"] == "http.response.start"]
    return int(starts[0]["status"]) if starts else 0  # 0: forwarded to the session manager


@pytest.mark.asyncio
async def test_binds_loopback_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MATIMO_MCP_TOKEN", raising=False)
    _, config, _ = await _serve(MCPServerOptions(transport="http"))
    assert config["host"] == "127.0.0.1"


@pytest.mark.asyncio
async def test_host_option_is_honoured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MATIMO_MCP_TOKEN", raising=False)
    _, config, _ = await _serve(MCPServerOptions(transport="http", host="0.0.0.0"))  # noqa: S104
    assert config["host"] == "0.0.0.0"  # noqa: S104


@pytest.mark.asyncio
async def test_unauthenticated_requests_are_rejected_when_no_token_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("MATIMO_MCP_TOKEN", raising=False)
    server, config, sm = await _serve(MCPServerOptions(transport="http"))
    assert server.get_active_token()
    assert await _call(config["app"], []) == 401
    sm.handle_request.assert_not_awaited()


@pytest.mark.asyncio
async def test_auto_generated_token_is_accepted_and_printed(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("MATIMO_MCP_TOKEN", raising=False)
    server, config, sm = await _serve(MCPServerOptions(transport="http"))
    token = server.get_active_token()
    assert token
    assert token in capsys.readouterr().err
    assert await _call(config["app"], [(b"authorization", f"Bearer {token}".encode())]) != 401
    sm.handle_request.assert_awaited_once()


@pytest.mark.asyncio
async def test_env_token_is_used_and_not_printed(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("MATIMO_MCP_TOKEN", "env-token")
    server, config, _ = await _serve(MCPServerOptions(transport="http"))
    assert server.get_active_token() == "env-token"
    assert "env-token" not in capsys.readouterr().err
    assert await _call(config["app"], [(b"authorization", b"Bearer wrong")]) == 401
