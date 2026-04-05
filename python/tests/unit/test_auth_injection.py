"""Unit tests for auth injection."""
from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from matimo.auth.injection import inject_auth_parameters, extract_parameter_placeholders
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
    def test_extract_from_headers(self):
        tool = _make_slack_tool()
        placeholders = extract_parameter_placeholders(tool)
        assert "SLACK_BOT_TOKEN" in placeholders

    def test_extract_from_body(self):
        tool = _make_slack_tool()
        placeholders = extract_parameter_placeholders(tool)
        assert "channel" in placeholders
        assert "text" in placeholders

    def test_extract_from_url(self):
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
    def test_explicit_credentials_take_priority(self):
        """Per-call credentials override env vars."""
        tool = _make_slack_tool()
        with patch.dict(os.environ, {"MATIMO_SLACK_BOT_TOKEN": "env_token"}):
            params = inject_auth_parameters(
                tool, {"channel": "#general", "text": "Hi"},
                credentials={"SLACK_BOT_TOKEN": "explicit_token"}
            )
        assert params["SLACK_BOT_TOKEN"] == "explicit_token"

    def test_matimo_prefixed_env_var_resolved(self):
        """MATIMO_{TOOL_NAME}_{PARAM} should be picked up."""
        tool = _make_slack_tool()
        env = {"MATIMO_SLACK_SEND_CHANNEL_MESSAGE_SLACK_BOT_TOKEN": "matimo_token"}
        with patch.dict(os.environ, env, clear=True):
            params = inject_auth_parameters(tool, {"channel": "#general", "text": "Hi"})
        assert params.get("SLACK_BOT_TOKEN") == "matimo_token"

    def test_direct_env_var_fallback(self):
        """Direct env var {PARAM} is the last fallback."""
        tool = _make_slack_tool()
        with patch.dict(os.environ, {"SLACK_BOT_TOKEN": "direct_token"}, clear=True):
            params = inject_auth_parameters(tool, {"channel": "#general", "text": "Hi"})
        assert params.get("SLACK_BOT_TOKEN") == "direct_token"

    def test_missing_credential_not_injected(self):
        """If not found anywhere, param is not added (tool logic handles missing)."""
        tool = _make_slack_tool()
        with patch.dict(os.environ, {}, clear=True):
            params = inject_auth_parameters(tool, {"channel": "#general", "text": "Hi"})
        # SLACK_BOT_TOKEN should NOT be injected with a None/empty value
        assert params.get("SLACK_BOT_TOKEN") is None or "SLACK_BOT_TOKEN" not in params

    def test_existing_params_preserved(self):
        """inject_auth_parameters must not strip non-secret params."""
        tool = _make_slack_tool()
        with patch.dict(os.environ, {"SLACK_BOT_TOKEN": "token"}, clear=True):
            params = inject_auth_parameters(
                tool, {"channel": "#general", "text": "Hello"}
            )
        assert params["channel"] == "#general"
        assert params["text"] == "Hello"
