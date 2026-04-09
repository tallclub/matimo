"""Unit tests for mcp/server.py."""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from matimo.core.models import HttpExecution, Parameter, ParameterType, ToolDefinition
from matimo.errors import ErrorCode, MatimoError
from matimo.mcp.server import MCPServer, MCPServerOptions, create_mcp_server


def _make_matimo_mock(tools: list[ToolDefinition] | None = None) -> MagicMock:
    """Create a mock Matimo instance."""
    mock = MagicMock()
    mock.list_tools.return_value = tools or []
    mock.get_tool.return_value = None
    mock.execute = AsyncMock(return_value={"ok": True})
    return mock


def _make_tool(name: str = "test_tool") -> ToolDefinition:
    return ToolDefinition(
        name=name,
        description="A test tool",
        parameters={
            "message": Parameter(type=ParameterType.STRING, required=True),
        },
        execution=HttpExecution(type="http", method="GET", url="https://api.example.com/"),
    )


# ---------------------------------------------------------------------------
# MCPServerOptions
# ---------------------------------------------------------------------------


class TestMCPServerOptions:
    def test_defaults(self) -> None:
        opts = MCPServerOptions()
        assert opts.transport == "stdio"
        assert opts.port == 3100
        assert opts.tools is None
        assert opts.exclude_tools is None
        assert opts.secret_resolver is None
        assert opts.mcp_token is None

    def test_custom_values(self) -> None:
        opts = MCPServerOptions(transport="http", port=4200, tools=["tool_a"])
        assert opts.transport == "http"
        assert opts.port == 4200
        assert opts.tools == ["tool_a"]


# ---------------------------------------------------------------------------
# MCPServer._filter_tools
# ---------------------------------------------------------------------------


class TestMCPServerFilterTools:
    def test_no_filter_returns_all(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions())
        tools = [_make_tool("a"), _make_tool("b"), _make_tool("c")]
        result = server._filter_tools(tools)
        assert len(result) == 3

    def test_allowlist_filters(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions(tools=["a", "c"]))
        tools = [_make_tool("a"), _make_tool("b"), _make_tool("c")]
        result = server._filter_tools(tools)
        assert {t.name for t in result} == {"a", "c"}

    def test_denylist_excludes(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions(exclude_tools=["b"]))
        tools = [_make_tool("a"), _make_tool("b"), _make_tool("c")]
        result = server._filter_tools(tools)
        assert {t.name for t in result} == {"a", "c"}

    def test_allowlist_and_denylist_combined(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions(tools=["a", "b"], exclude_tools=["b"]))
        tools = [_make_tool("a"), _make_tool("b"), _make_tool("c")]
        result = server._filter_tools(tools)
        assert {t.name for t in result} == {"a"}

    def test_empty_tools_returns_empty(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions())
        result = server._filter_tools([])
        assert result == []


# ---------------------------------------------------------------------------
# MCPServer._get_mcp_tools
# ---------------------------------------------------------------------------


class TestMCPServerGetMcpTools:
    def test_returns_empty_if_mcp_not_installed(self) -> None:
        matimo = _make_matimo_mock(tools=[_make_tool("t1")])
        server = MCPServer(matimo, MCPServerOptions())
        with patch.dict("sys.modules", {"mcp": None, "mcp.types": None}):
            result = server._get_mcp_tools()
        assert result == []

    def test_converts_tools_with_mcp_available(self) -> None:
        # mcp is installed -- _get_mcp_tools should return tool objects
        matimo = _make_matimo_mock(tools=[_make_tool("my_tool")])
        server = MCPServer(matimo, MCPServerOptions())
        try:
            result = server._get_mcp_tools()
            assert len(result) == 1
        except ImportError:
            pytest.skip("mcp not installed")


# ---------------------------------------------------------------------------
# MCPServer._call_tool
# ---------------------------------------------------------------------------


class TestMCPServerCallTool:
    async def test_call_tool_returns_text_content(self) -> None:
        mock_mcp_types = MagicMock()
        text_content_instance = MagicMock()
        text_content_instance.type = "text"
        mock_mcp_types.TextContent.return_value = text_content_instance

        matimo = _make_matimo_mock()
        matimo.execute = AsyncMock(return_value={"ok": True, "result": "done"})
        matimo.get_tool.return_value = None

        server = MCPServer(matimo, MCPServerOptions())

        with patch.dict("sys.modules", {"mcp": MagicMock(), "mcp.types": mock_mcp_types}):
            result = await server._call_tool("test_tool", {"key": "value"})
        assert len(result) == 1

    async def test_call_tool_returns_empty_if_mcp_not_installed(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions())
        with patch.dict("sys.modules", {"mcp": None, "mcp.types": None}):
            result = await server._call_tool("test_tool", {})
        assert result == []

    async def test_call_tool_handles_matimo_error(self) -> None:
        mock_mcp_types = MagicMock()
        error_content = MagicMock()
        mock_mcp_types.TextContent.return_value = error_content

        matimo = _make_matimo_mock()
        matimo.execute = AsyncMock(
            side_effect=MatimoError("fail", ErrorCode.EXECUTION_FAILED)
        )
        matimo.get_tool.return_value = None

        server = MCPServer(matimo, MCPServerOptions())

        with patch.dict("sys.modules", {"mcp": MagicMock(), "mcp.types": mock_mcp_types}):
            result = await server._call_tool("test_tool", {})
        assert len(result) == 1

    async def test_call_tool_resolves_secrets(self) -> None:
        from matimo.core.models import HttpExecution, ToolDefinition

        mock_mcp_types = MagicMock()
        mock_mcp_types.TextContent.return_value = MagicMock()

        tool = ToolDefinition(
            name="tool_with_secret",
            description="d",
            parameters={"SLACK_BOT_TOKEN": Parameter(type=ParameterType.STRING)},
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://slack.com/api/test",
                headers={"Authorization": "Bearer {SLACK_BOT_TOKEN}"},
            ),
        )

        mock_resolver = AsyncMock()
        mock_resolver.resolve_all = AsyncMock(return_value={"SLACK_BOT_TOKEN": "xoxb-secret"})

        matimo = _make_matimo_mock(tools=[tool])
        matimo.get_tool.return_value = tool
        matimo.execute = AsyncMock(return_value={"ok": True})

        server = MCPServer(matimo, MCPServerOptions(secret_resolver=mock_resolver))

        with patch.dict("sys.modules", {"mcp": MagicMock(), "mcp.types": mock_mcp_types}):
            await server._call_tool("tool_with_secret", {})
        mock_resolver.resolve_all.assert_called_once()


# ---------------------------------------------------------------------------
# MCPServer.start — import error path
# ---------------------------------------------------------------------------


class TestMCPServerStart:
    async def test_start_raises_if_mcp_not_installed(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo)
        with patch.dict("sys.modules", {"mcp": None, "mcp.types": None,
                                         "mcp.server": None}):
            with pytest.raises(MatimoError) as exc_info:
                await server.start()
        assert exc_info.value.code == ErrorCode.EXECUTION_FAILED

    async def test_run_http_raises_not_implemented(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions(transport="http"))
        with pytest.raises(MatimoError) as exc_info:
            await server._run_http(MagicMock())
        assert exc_info.value.code == ErrorCode.EXECUTION_FAILED

    async def test_start_http_transport_calls_run_http(self) -> None:
        """Cover start() body (lines 90-108) by reaching _run_http via transport='http'."""
        mock_server_instance = MagicMock()
        mock_server_class = MagicMock(return_value=mock_server_instance)

        matimo_inst = _make_matimo_mock()
        server = MCPServer(matimo_inst, MCPServerOptions(transport="http"))

        with patch("mcp.server.Server", mock_server_class):
            with pytest.raises(MatimoError) as exc_info:
                await server.start()
        assert exc_info.value.code == ErrorCode.EXECUTION_FAILED

    async def test_start_stdio_covers_handler_callbacks(self) -> None:
        """Cover lines 96, 103 (registered callbacks) and 106 (stdio dispatch)."""
        registered: dict[str, Any] = {}

        def capture_list_tools() -> Any:  # noqa: ANN401  # test helper mimics MCP decorator factory
            def decorator(fn: Any) -> Any:  # noqa: ANN401
                registered["list_tools"] = fn
                return fn
            return decorator

        def capture_call_tool() -> Any:  # noqa: ANN401  # test helper mimics MCP decorator factory
            def decorator(fn: Any) -> Any:  # noqa: ANN401
                registered["call_tool"] = fn
                return fn
            return decorator

        mock_server_instance = MagicMock()
        mock_server_instance.list_tools.side_effect = capture_list_tools
        mock_server_instance.call_tool.side_effect = capture_call_tool
        mock_server_class = MagicMock(return_value=mock_server_instance)

        matimo_inst = _make_matimo_mock(tools=[_make_tool("t")])
        server = MCPServer(matimo_inst, MCPServerOptions(transport="stdio"))
        server._run_stdio = AsyncMock()  # type: ignore[method-assign]

        with patch("mcp.server.Server", mock_server_class):
            await server.start()

        server._run_stdio.assert_awaited_once()  # line 106 covered

        # Invoke the captured callbacks to cover lines 96 and 103
        list_result = await registered["list_tools"]()
        assert isinstance(list_result, list)  # line 96 covered

        call_result = await registered["call_tool"]("t", {})
        assert isinstance(call_result, list)  # line 103 covered
        """Cover _run_stdio body (lines 115-120) by mocking the stdio transport."""
        from contextlib import asynccontextmanager

        mock_run_server = MagicMock()
        mock_run_server.run = AsyncMock()
        mock_run_server.get_capabilities.return_value = MagicMock()

        @asynccontextmanager  # type: ignore[misc]
        async def fake_stdio_server() -> Any:  # noqa: ANN401  # yields arbitrary mock tuple
            yield (MagicMock(), MagicMock())

        matimo_inst = _make_matimo_mock()
        server = MCPServer(matimo_inst, MCPServerOptions())

        with patch("mcp.server.stdio.stdio_server", fake_stdio_server), \
             patch("mcp.types.NotificationOptions", MagicMock(return_value=MagicMock()), create=True), \
             patch("mcp.server.models.InitializationOptions", MagicMock(return_value=MagicMock())):
            await server._run_stdio(mock_run_server)

        mock_run_server.run.assert_awaited_once()


# ---------------------------------------------------------------------------
# create_mcp_server factory
# ---------------------------------------------------------------------------


class TestCreateMcpServer:
    async def test_create_mcp_server_returns_server(self, tmp_path: pytest.TempPathFactory) -> None:
        import pathlib
        tools_dir = pathlib.Path(str(tmp_path)) / "tools"
        tools_dir.mkdir()
        server = await create_mcp_server(tool_paths=[str(tools_dir)])
        assert isinstance(server, MCPServer)

    async def test_create_mcp_server_with_none_paths(self) -> None:
        server = await create_mcp_server(tool_paths=[])
        assert isinstance(server, MCPServer)
