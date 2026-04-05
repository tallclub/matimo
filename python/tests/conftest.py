"""
Shared pytest fixtures for the Matimo Python SDK test suite.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
import pytest_asyncio

from matimo.core.loader import ToolLoader
from matimo.core.models import (
    CommandExecution,
    FunctionExecution,
    HttpExecution,
    Parameter,
    ParameterType,
    ToolDefinition,
)
from matimo.core.registry import ToolRegistry

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# Fixture tool definitions (inline — fast, no I/O)
# ---------------------------------------------------------------------------


@pytest.fixture()
def http_tool() -> ToolDefinition:
    """Minimal HTTP GET tool for testing."""
    return ToolDefinition(
        name="echo_tool",
        version="1.0.0",
        description="Echo a message",
        parameters={
            "message": Parameter(
                type=ParameterType.STRING,
                description="Message to echo",
                required=True,
            )
        },
        execution=HttpExecution(
            type="http",
            method="GET",
            url="https://httpbin.org/get?message={message}",
        ),
    )


@pytest.fixture()
def post_tool() -> ToolDefinition:
    """HTTP POST tool with body templating."""
    return ToolDefinition(
        name="slack_send",
        version="1.0.0",
        description="Send Slack message",
        parameters={
            "channel": Parameter(type=ParameterType.STRING, description="Channel", required=True),
            "text": Parameter(type=ParameterType.STRING, description="Text", required=False),
            "SLACK_BOT_TOKEN": Parameter(
                type=ParameterType.STRING, description="Token", required=True
            ),
        },
        execution=HttpExecution(
            type="http",
            method="POST",
            url="https://slack.com/api/chat.postMessage",
            headers={"Authorization": "Bearer {SLACK_BOT_TOKEN}", "Content-Type": "application/json"},
            body={"channel": "{channel}", "text": "{text}"},
        ),
    )


@pytest.fixture()
def command_tool() -> ToolDefinition:
    """A simple echo command tool."""
    return ToolDefinition(
        name="echo_command",
        version="1.0.0",
        description="Echo via command",
        parameters={
            "message": Parameter(
                type=ParameterType.STRING, description="Message", required=True
            )
        },
        execution=CommandExecution(
            type="command",
            command="echo",
            args=["{message}"],
            timeout=5000,
        ),
    )


@pytest.fixture()
def function_tool(tmp_path: Path) -> ToolDefinition:
    """A function tool backed by a real .py file."""
    py_file = tmp_path / "my_func.py"
    py_file.write_text(
        "def run(params):\n    return {'result': params.get('x', 0) * 2}\n"
    )
    tool = ToolDefinition(
        name="doubler",
        version="1.0.0",
        description="Double a number",
        parameters={
            "x": Parameter(type=ParameterType.NUMBER, description="Input", required=True)
        },
        execution=FunctionExecution(
            type="function",
            code=str(py_file),
        ),
    )
    tool.set_definition_path(str(tmp_path / "definition.yaml"))
    return tool


@pytest.fixture()
def async_function_tool(tmp_path: Path) -> ToolDefinition:
    """A function tool backed by an async .py file."""
    py_file = tmp_path / "async_func.py"
    py_file.write_text(
        "import asyncio\nasync def run(params):\n    await asyncio.sleep(0)\n    return {'value': params['n']}\n"
    )
    tool = ToolDefinition(
        name="async_tool",
        version="1.0.0",
        description="Async tool",
        parameters={"n": Parameter(type=ParameterType.NUMBER, description="n", required=True)},
        execution=FunctionExecution(type="function", code=str(py_file)),
    )
    tool.set_definition_path(str(tmp_path / "definition.yaml"))
    return tool


@pytest.fixture()
def registry_with_tools(http_tool: ToolDefinition, command_tool: ToolDefinition) -> ToolRegistry:
    """A ToolRegistry pre-loaded with http_tool and command_tool."""
    reg = ToolRegistry()
    reg.register(http_tool)
    reg.register(command_tool)
    return reg


@pytest.fixture()
def loader() -> ToolLoader:
    """A fresh ToolLoader instance with cleared discovery cache."""
    ToolLoader.clear_discovery_cache()
    return ToolLoader()


# ---------------------------------------------------------------------------
# Matimo instance fixture (integration use)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture()
async def matimo_instance(http_tool: ToolDefinition):
    """A Matimo instance pre-loaded with the echo_tool fixture."""
    from matimo.instance import Matimo
    from matimo.core.registry import ToolRegistry
    from matimo.core.loader import ToolLoader
    from matimo.policy.default_policy import DefaultPolicyEngine
    from matimo.logging import setup_logger

    reg = ToolRegistry()
    reg.register(http_tool)

    return Matimo(
        registry=reg,
        policy_engine=DefaultPolicyEngine(),
        loader=ToolLoader(),
        tool_paths=[],
        on_event=None,
        on_hitl=None,
        matimo_logger=setup_logger("silent"),
    )
