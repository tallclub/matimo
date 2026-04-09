"""Unit tests for auth injection."""
from __future__ import annotations

import os
from unittest.mock import patch

from matimo.auth.injection import extract_parameter_placeholders, inject_auth_parameters
from matimo.core.models import HttpExecution, ToolDefinition


def _make_slack_tool() -> ToolDefinition:
    return ToolDefinition(
        name="slack_send_channel_message",
        description="Send Slack msg",
        execution=HttpExecution(
            type="http",
            method="POST",
            url="https://slack.com/api/chat.postMessage",
            headers={"Authorization": "Bearer {SLACK_BOT_TOKEN}"},
            body={"channel": "{channel}", "text": "{text}"},
        ),
    )


class TestExtractPlaceholders:
    def test_extract_from_headers(self) -> None:
        tool = _make_slack_tool()
        placeholders = extract_parameter_placeholders(tool)
        assert "SLACK_BOT_TOKEN" in placeholders

    def test_extract_from_body(self) -> None:
        tool = _make_slack_tool()
        placeholders = extract_parameter_placeholders(tool)
        assert "channel" in placeholders
        assert "text" in placeholders

    def test_extract_from_url(self) -> None:
        tool = ToolDefinition(
            name="t",
            description="d",
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://api.example.com/users/{user_id}/repos/{repo}",
            ),
        )
        placeholders = extract_parameter_placeholders(tool)
        assert "user_id" in placeholders
        assert "repo" in placeholders


class TestInjectAuthParameters:
    def test_explicit_credentials_take_priority(self) -> None:
        """Per-call credentials override env vars."""
        tool = _make_slack_tool()
        with patch.dict(os.environ, {"MATIMO_SLACK_BOT_TOKEN": "env_token"}):
            params = inject_auth_parameters(
                tool, {"channel": "#general", "text": "Hi"},
                credentials={"SLACK_BOT_TOKEN": "explicit_token"}
            )
        assert params["SLACK_BOT_TOKEN"] == "explicit_token"

    def test_matimo_prefixed_env_var_resolved(self) -> None:
        """MATIMO_{TOOL_NAME}_{PARAM} should be picked up."""
        tool = _make_slack_tool()
        env = {"MATIMO_SLACK_SEND_CHANNEL_MESSAGE_SLACK_BOT_TOKEN": "matimo_token"}
        with patch.dict(os.environ, env, clear=True):
            params = inject_auth_parameters(tool, {"channel": "#general", "text": "Hi"})
        assert params.get("SLACK_BOT_TOKEN") == "matimo_token"

    def test_direct_env_var_fallback(self) -> None:
        """Direct env var {PARAM} is the last fallback."""
        tool = _make_slack_tool()
        with patch.dict(os.environ, {"SLACK_BOT_TOKEN": "direct_token"}, clear=True):
            params = inject_auth_parameters(tool, {"channel": "#general", "text": "Hi"})
        assert params.get("SLACK_BOT_TOKEN") == "direct_token"

    def test_missing_credential_not_injected(self) -> None:
        """If not found anywhere, param is not added (tool logic handles missing)."""
        tool = _make_slack_tool()
        with patch.dict(os.environ, {}, clear=True):
            params = inject_auth_parameters(tool, {"channel": "#general", "text": "Hi"})
        # SLACK_BOT_TOKEN should NOT be injected with a None/empty value
        assert params.get("SLACK_BOT_TOKEN") is None or "SLACK_BOT_TOKEN" not in params

    def test_existing_params_preserved(self) -> None:
        """inject_auth_parameters must not strip non-secret params."""
        tool = _make_slack_tool()
        with patch.dict(os.environ, {"SLACK_BOT_TOKEN": "token"}, clear=True):
            params = inject_auth_parameters(
                tool, {"channel": "#general", "text": "Hello"}
            )
        assert params["channel"] == "#general"
        assert params["text"] == "Hello"


class TestExtractPlaceholdersEdgeCases:
    def test_function_tool_returns_empty_set(self) -> None:
        """Function tools have no URL/headers to scan — returns empty set."""
        from matimo.core.models import FunctionExecution
        tool = ToolDefinition(
            name="func_tool",
            description="d",
            execution=FunctionExecution(type="function", code="tool.py"),
        )
        placeholders = extract_parameter_placeholders(tool)
        assert placeholders == set()

    def test_command_tool_extracts_placeholders(self) -> None:
        """Command tools scan command string and args."""
        from matimo.core.models import CommandExecution
        tool = ToolDefinition(
            name="cmd_tool",
            description="d",
            execution=CommandExecution(
                type="command",
                command="my_cli",
                args=["--channel", "{channel}", "--token", "{SLACK_TOKEN}"],
            ),
        )
        placeholders = extract_parameter_placeholders(tool)
        assert "channel" in placeholders
        assert "SLACK_TOKEN" in placeholders

    def test_scan_object_handles_list(self) -> None:
        """inject_auth_parameters works when query_params contains a list-valued body."""
        tool = ToolDefinition(
            name="t",
            description="d",
            execution=HttpExecution(
                type="http",
                method="POST",
                url="https://api.example.com/send",
                body={"recipients": ["{to}", "{cc}"]},
            ),
        )
        placeholders = extract_parameter_placeholders(tool)
        assert "to" in placeholders
        assert "cc" in placeholders
