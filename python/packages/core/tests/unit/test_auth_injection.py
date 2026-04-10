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


class TestNonAuthPlaceholderHandling:
    """Verify non-auth placeholders are NOT injected from env vars."""

    def test_non_auth_placeholders_not_injected(self) -> None:
        """Non-auth placeholders (e.g., user_id) should NOT be injected even if env var exists."""
        from matimo.core.models import HttpExecution
        
        tool = ToolDefinition(
            name="get_user",
            description="Fetch user",
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://api.example.com/users/{user_id}",
                headers={"Authorization": "Bearer {API_KEY}"},
            ),
        )
        
        # Set env var for non-auth placeholder
        env = {"USER_ID": "12345", "API_KEY": "secret_key"}
        with patch.dict(os.environ, env, clear=True):
            params = inject_auth_parameters(tool, {})
        
        # API_KEY should be injected (it's auth-related)
        assert params.get("API_KEY") == "secret_key"
        
        # user_id should NOT be injected (not auth-related)
        assert "user_id" not in params

    def test_non_auth_placeholder_from_caller_preserved(self) -> None:
        """Non-auth params passed by caller should be preserved."""
        tool = _make_slack_tool()
        
        params = inject_auth_parameters(
            tool,
            {"channel": "#general", "text": "Test", "custom_field": "value"},
        )
        
        assert params["channel"] == "#general"
        assert params["text"] == "Test"
        assert params["custom_field"] == "value"

    def test_auth_patterns_case_insensitive(self) -> None:
        """Auth pattern matching should be case-insensitive."""
        from matimo.core.models import HttpExecution
        
        tool = ToolDefinition(
            name="test_case",
            description="Test",
            execution=HttpExecution(
                type="http",
                method="POST",
                url="https://api.example.com",
                headers={
                    "Authorization": "Bearer {TOKEN}",
                    "X-API-Key": "{API_KEY}",
                    "X-Secret": "{SECRET}",
                    "X-Password": "{PASSWORD}",
                },
            ),
        )
        
        env = {
            "TOKEN": "token_val",
            "API_KEY": "key_val",
            "SECRET": "secret_val",
            "PASSWORD": "pass_val",
            "OTHER_PARAM": "should_not_inject",
        }
        
        with patch.dict(os.environ, env, clear=True):
            params = inject_auth_parameters(tool, {})
        
        # All auth-like params should be injected
        assert params.get("TOKEN") == "token_val"
        assert params.get("API_KEY") == "key_val"
        assert params.get("SECRET") == "secret_val"
        assert params.get("PASSWORD") == "pass_val"
        
        # Non-auth placeholder should NOT be injected
        assert "OTHER_PARAM" not in params


class TestInjectionPrecedenceOrder:
    """Verify precise precedence: credentials dict > MATIMO_* env > direct env."""

    def test_credentials_preferred_over_direct_env(self) -> None:
        """Explicit credentials should override both environment variables."""
        tool = _make_slack_tool()
        
        env = {
            "SLACK_BOT_TOKEN": "direct_env_value",
            "MATIMO_SLACK_SEND_CHANNEL_MESSAGE_SLACK_BOT_TOKEN": "matimo_env_value",
        }
        
        with patch.dict(os.environ, env, clear=True):
            params = inject_auth_parameters(
                tool,
                {"channel": "#test", "text": "msg"},
                credentials={"SLACK_BOT_TOKEN": "explicit_value"},
            )
        
        assert params["SLACK_BOT_TOKEN"] == "explicit_value"

    def test_matimo_env_preferred_over_direct_env(self) -> None:
        """MATIMO_* env var should take precedence over direct env var."""
        tool = _make_slack_tool()
        
        env = {
            "SLACK_BOT_TOKEN": "direct_value",
            "MATIMO_SLACK_SEND_CHANNEL_MESSAGE_SLACK_BOT_TOKEN": "matimo_value",
        }
        
        with patch.dict(os.environ, env, clear=True):
            params = inject_auth_parameters(tool, {"channel": "#test", "text": "msg"})
        
        # MATIMO_* should win over direct
        assert params["SLACK_BOT_TOKEN"] == "matimo_value"


class TestCommandAndHttpPlaceholderExtraction:
    """Verify placeholder extraction works correctly for both HTTP and command tools."""

    def test_http_tool_full_extraction(self) -> None:
        """HTTP tool extraction from URL, headers, body, query_params."""
        from matimo.core.models import HttpExecution
        
        tool = ToolDefinition(
            name="comprehensive_http",
            description="Full HTTP test",
            execution=HttpExecution(
                type="http",
                method="POST",
                url="https://api.example.com/{version}/users/{user_id}",
                headers={"Authorization": "Bearer {API_TOKEN}"},
                query_params={"filter": "{filter_value}", "page": "{page}"},
                body={"name": "{name}", "email": "{email}"},
            ),
        )
        
        placeholders = extract_parameter_placeholders(tool)
        
        # All placeholders should be extracted
        assert "version" in placeholders
        assert "user_id" in placeholders
        assert "API_TOKEN" in placeholders
        assert "filter_value" in placeholders
        assert "page" in placeholders
        assert "name" in placeholders
        assert "email" in placeholders

    def test_command_tool_extraction(self) -> None:
        """Command tool extraction from command and args."""
        from matimo.core.models import CommandExecution
        
        tool = ToolDefinition(
            name="cmd_test",
            description="Command tool",
            execution=CommandExecution(
                type="command",
                command="deploy {service}",
                args=["--env", "{ENVIRONMENT}", "--token", "{API_TOKEN}", "--region", "{region}"],
            ),
        )
        
        placeholders = extract_parameter_placeholders(tool)
        
        assert "service" in placeholders
        assert "ENVIRONMENT" in placeholders
        assert "API_TOKEN" in placeholders
        assert "region" in placeholders

    def test_command_tool_injection_behavior(self) -> None:
        """Auth parameters should be injected for command tools."""
        from matimo.core.models import CommandExecution
        
        tool = ToolDefinition(
            name="cli_deploy",
            description="CLI deploy tool",
            execution=CommandExecution(
                type="command",
                command="cli deploy",
                args=["--token", "{API_TOKEN}", "--id", "{deployment_id}"],
            ),
        )
        
        env = {"API_TOKEN": "secret_token", "DEPLOYMENT_ID": "should_not_inject"}
        with patch.dict(os.environ, env, clear=True):
            params = inject_auth_parameters(tool, {})
        
        # Auth param should be injected
        assert params.get("API_TOKEN") == "secret_token"
        
        # Non-auth param should NOT be injected
        assert "deployment_id" not in params
