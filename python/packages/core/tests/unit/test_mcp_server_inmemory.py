"""End-to-end tests for mcp/server.py against the real mcp>=2.0 SDK.

Unlike test_mcp_server.py, nothing on the mcp side is mocked: the server built
by MCPServer is connected to a real mcp client over the SDK's in-memory
transport, so a breaking change in the mcp 2.x API shows up here.
"""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from matimo.core.models import HttpExecution, Parameter, ParameterType, ToolDefinition
from matimo.mcp.server import MCPServer, MCPServerOptions

pytestmark = pytest.mark.asyncio


def _make_tool(name: str = "echo_tool") -> ToolDefinition:
    return ToolDefinition(
        name=name,
        description="Echoes a message",
        parameters={"message": Parameter(type=ParameterType.STRING, required=True)},
        execution=HttpExecution(type="http", method="GET", url="https://api.example.com/"),
    )


def _make_server(*, skills: list[Any] | None = None) -> MCPServer:
    matimo = MagicMock()
    matimo.list_tools.return_value = [_make_tool()]
    matimo.list_skills.return_value = skills or []
    matimo.get_tool.return_value = None
    matimo.get_skill_content.return_value = "# Skill body"
    matimo.execute = AsyncMock(return_value={"echoed": "hi"})
    return MCPServer(matimo, MCPServerOptions())


def _build(server: MCPServer) -> Any:  # noqa: ANN401
    import mcp.types as mcp_types

    return server._build_server(mcp_types)


async def test_lists_and_calls_tools_over_real_client() -> None:
    from mcp.client import Client

    server = _make_server()
    async with Client(_build(server)) as client:
        listed = await client.list_tools()
        assert [t.name for t in listed.tools] == ["echo_tool"]
        assert listed.tools[0].annotations is not None
        assert listed.tools[0].annotations.read_only_hint is True

        result = await client.call_tool("echo_tool", {"message": "hi"})
        assert result.is_error is False
        assert "echoed" in result.content[0].text


async def test_tool_failure_is_reported_as_error_result() -> None:
    from mcp.client import Client

    server = _make_server()
    server._matimo.execute = AsyncMock(side_effect=RuntimeError("boom"))  # type: ignore[attr-defined]
    async with Client(_build(server)) as client:
        result = await client.call_tool("echo_tool", {"message": "hi"})
        assert result.is_error is True


async def test_lists_and_reads_skill_resources_over_real_client() -> None:
    from mcp.client import Client

    skill = SimpleNamespace(name="my-skill", description="Does things")
    server = _make_server(skills=[skill])
    async with Client(_build(server)) as client:
        listed = await client.list_resources()
        assert [str(r.uri) for r in listed.resources] == ["skills://my-skill"]

        read = await client.read_resource("skills://my-skill")
        assert read.contents[0].text == "# Skill body"
