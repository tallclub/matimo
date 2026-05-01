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
    mock.list_skills.return_value = []
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

    def test_allowlist_with_wildcard_patterns(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions(tools=["slack_*", "github_create_*"]))
        tools = [
            _make_tool("slack_send_message"),
            _make_tool("slack_post_reaction"),
            _make_tool("github_create_issue"),
            _make_tool("github_list_issues"),
            _make_tool("notion_create_page"),
        ]
        result = server._filter_tools(tools)
        assert {t.name for t in result} == {
            "slack_send_message",
            "slack_post_reaction",
            "github_create_issue",
        }

    def test_denylist_with_wildcard_patterns(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions(exclude_tools=["*_deprecated", "test_*"]))
        tools = [
            _make_tool("slack_send_message"),
            _make_tool("slack_deprecated"),
            _make_tool("test_tool"),
            _make_tool("github_create_issue"),
        ]
        result = server._filter_tools(tools)
        assert {t.name for t in result} == {"slack_send_message", "github_create_issue"}

    def test_wildcard_pattern_asterisk(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions(tools=["*_send*"]))
        tools = [
            _make_tool("slack_send_message"),
            _make_tool("slack_send_dm"),
            _make_tool("github_send_pr_comment"),
            _make_tool("slack_post_message"),
        ]
        result = server._filter_tools(tools)
        assert {t.name for t in result} == {
            "slack_send_message",
            "slack_send_dm",
            "github_send_pr_comment",
        }

    def test_wildcard_pattern_question_mark(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions(tools=["slack_?end_*"]))
        tools = [
            _make_tool("slack_send_message"),
            _make_tool("slack_fend_message"),
            _make_tool("slack_send"),
            _make_tool("slack_message"),
        ]
        result = server._filter_tools(tools)
        assert {t.name for t in result} == {
            "slack_send_message",
            "slack_fend_message",
        }

    def test_denylist_takes_precedence_over_allowlist(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions(
            tools=["slack_*"],
            exclude_tools=["*_deprecated"]
        ))
        tools = [
            _make_tool("slack_send_message"),
            _make_tool("slack_deprecated"),
            _make_tool("github_create_issue"),
        ]
        result = server._filter_tools(tools)
        # slack_send_message matches allowlist, slack_deprecated matches denylist (excluded)
        assert {t.name for t in result} == {"slack_send_message"}

    def test_exact_match_still_works(self) -> None:
        """Verify exact matching still works alongside wildcard patterns."""
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions(tools=["slack_send_message", "github_*"]))
        tools = [
            _make_tool("slack_send_message"),
            _make_tool("slack_post_reaction"),
            _make_tool("github_create_issue"),
            _make_tool("notion_create_page"),
        ]
        result = server._filter_tools(tools)
        assert {t.name for t in result} == {
            "slack_send_message",
            "github_create_issue",
        }


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
        """When _resolved_secrets is empty, fall back to per-call resolution."""
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

        # _resolved_secrets is empty (start() not called) → fallback to per-call resolution
        server = MCPServer(matimo, MCPServerOptions(secret_resolver=mock_resolver))

        with patch.dict("sys.modules", {"mcp": MagicMock(), "mcp.types": mock_mcp_types}):
            await server._call_tool("tool_with_secret", {})
        mock_resolver.resolve_all.assert_called_once()

    async def test_call_tool_uses_preresolved_secrets(self) -> None:
        """When _resolved_secrets is populated, skip per-call resolution."""
        mock_mcp_types = MagicMock()
        mock_mcp_types.TextContent.return_value = MagicMock()

        mock_resolver = AsyncMock()
        mock_resolver.resolve_all = AsyncMock(return_value={})

        matimo = _make_matimo_mock()
        matimo.execute = AsyncMock(return_value={"ok": True})

        server = MCPServer(matimo, MCPServerOptions(secret_resolver=mock_resolver))
        # Simulate pre-resolved secrets as if start() was called
        server._resolved_secrets = {"SLACK_BOT_TOKEN": "xoxb-pre-resolved"}

        with patch.dict("sys.modules", {"mcp": MagicMock(), "mcp.types": mock_mcp_types}):
            await server._call_tool("any_tool", {})

        # resolve_all must NOT be called — secrets were pre-resolved
        mock_resolver.resolve_all.assert_not_called()
        # execute must be called with the pre-resolved credentials
        matimo.execute.assert_awaited_once()
        _, kwargs = matimo.execute.await_args
        assert kwargs.get("credentials") == {"SLACK_BOT_TOKEN": "xoxb-pre-resolved"}

    async def test_call_tool_approval_required_without_flag(self) -> None:
        """Tools with requires_approval=True must reject calls without _matimo_approved."""
        mock_mcp_types = MagicMock()
        text_content = MagicMock()
        mock_mcp_types.TextContent.return_value = text_content

        tool = _make_tool("dangerous_tool")
        object.__setattr__(tool, "requires_approval", True)

        matimo = _make_matimo_mock()
        matimo.get_tool.return_value = tool
        server = MCPServer(matimo, MCPServerOptions())

        with patch.dict("sys.modules", {"mcp": MagicMock(), "mcp.types": mock_mcp_types}):
            result = await server._call_tool("dangerous_tool", {})

        assert len(result) == 1
        # execute must NOT have been called
        matimo.execute.assert_not_awaited()

    async def test_call_tool_does_not_trust_approval_flag_by_default(self) -> None:
        """_matimo_approved=True must not bypass server-side approval by default."""
        mock_mcp_types = MagicMock()
        mock_mcp_types.TextContent.return_value = MagicMock()

        tool = _make_tool("dangerous_tool")
        object.__setattr__(tool, "requires_approval", True)

        matimo = _make_matimo_mock()
        matimo.get_tool.return_value = tool
        matimo.execute = AsyncMock(return_value={"ok": True})
        server = MCPServer(matimo, MCPServerOptions())

        with patch.dict("sys.modules", {"mcp": MagicMock(), "mcp.types": mock_mcp_types}):
            result = await server._call_tool("dangerous_tool", {"_matimo_approved": True})

        assert len(result) == 1
        matimo.execute.assert_awaited_once()
        _, kwargs = matimo.execute.await_args
        assert kwargs.get("approved") is False

    async def test_call_tool_trusts_approval_flag_only_when_configured(self) -> None:
        """Servers can opt in to trusting transport-level approval confirmation."""
        mock_mcp_types = MagicMock()
        mock_mcp_types.TextContent.return_value = MagicMock()

        tool = _make_tool("dangerous_tool")
        object.__setattr__(tool, "requires_approval", True)

        matimo = _make_matimo_mock()
        matimo.get_tool.return_value = tool
        matimo.execute = AsyncMock(return_value={"ok": True})
        server = MCPServer(
            matimo,
            MCPServerOptions(trust_client_approval=True),
        )

        with patch.dict("sys.modules", {"mcp": MagicMock(), "mcp.types": mock_mcp_types}):
            result = await server._call_tool("dangerous_tool", {"_matimo_approved": True})

        assert len(result) == 1
        matimo.execute.assert_awaited_once()
        _, kwargs = matimo.execute.await_args
        assert kwargs.get("approved") is True

    async def test_call_tool_strips_matimo_approved_from_args(self) -> None:
        """_matimo_approved must be stripped before passing args to execute."""
        mock_mcp_types = MagicMock()
        mock_mcp_types.TextContent.return_value = MagicMock()

        matimo = _make_matimo_mock()
        matimo.execute = AsyncMock(return_value={"ok": True})
        server = MCPServer(matimo, MCPServerOptions())

        with patch.dict("sys.modules", {"mcp": MagicMock(), "mcp.types": mock_mcp_types}):
            await server._call_tool("test_tool", {"channel": "#general", "_matimo_approved": True})

        call_args = matimo.execute.await_args
        passed_params = call_args[0][1]  # positional arg 1 = params dict
        assert "_matimo_approved" not in passed_params
        assert passed_params == {"channel": "#general"}


# ---------------------------------------------------------------------------
# MCPServer._seed_environment_secrets
# ---------------------------------------------------------------------------


class TestSeedEnvironmentSecrets:
    async def test_no_op_when_no_resolver(self) -> None:
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions())
        tool = _make_tool("t")
        await server._seed_environment_secrets([tool])
        assert server._resolved_secrets == {}

    async def test_populates_resolved_secrets_from_resolver(self) -> None:
        from matimo.core.models import HttpExecution, ToolDefinition

        tool = ToolDefinition(
            name="slack_post",
            description="Post a message",
            parameters={},
            execution=HttpExecution(
                type="http",
                method="POST",
                url="https://slack.com/api/chat.postMessage",
                headers={"Authorization": "Bearer {SLACK_BOT_TOKEN}"},
            ),
        )

        mock_resolver = AsyncMock()
        mock_resolver.resolve_all = AsyncMock(
            return_value={"SLACK_BOT_TOKEN": "xoxb-real-token"}
        )

        matimo = _make_matimo_mock(tools=[tool])
        server = MCPServer(matimo, MCPServerOptions(secret_resolver=mock_resolver))
        await server._seed_environment_secrets([tool])

        assert server._resolved_secrets["SLACK_BOT_TOKEN"] == "xoxb-real-token"
        # Also stored with MATIMO_ prefix
        assert server._resolved_secrets["MATIMO_SLACK_BOT_TOKEN"] == "xoxb-real-token"

    async def test_no_op_when_no_placeholders(self) -> None:
        tool = _make_tool("no_auth_tool")  # plain tool, no auth in execution
        mock_resolver = AsyncMock()
        mock_resolver.resolve_all = AsyncMock(return_value={})

        matimo = _make_matimo_mock(tools=[tool])
        server = MCPServer(matimo, MCPServerOptions(secret_resolver=mock_resolver))
        await server._seed_environment_secrets([tool])

        # resolve_all should not be called for tools with no placeholders
        mock_resolver.resolve_all.assert_not_called()


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

    async def test_run_http_starts_server(self) -> None:
        """Test that HTTP transport starts uvicorn."""
        matimo = _make_matimo_mock()
        server = MCPServer(matimo, MCPServerOptions(transport="http"))
        
        with patch("uvicorn.Server.serve", new_callable=AsyncMock) as mock_serve:
            await server.start()
            mock_serve.assert_called_once()

    async def test_start_http_transport_calls_run_http(self) -> None:
        """Cover start() body (lines 90-108) by reaching _run_http via transport='http'."""
        matimo_inst = _make_matimo_mock()
        server = MCPServer(matimo_inst, MCPServerOptions(transport="http"))

        with patch("uvicorn.Server.serve", new_callable=AsyncMock) as mock_serve:
            await server.start()
            mock_serve.assert_called_once()

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
