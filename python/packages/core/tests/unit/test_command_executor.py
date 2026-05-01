"""Unit tests for CommandExecutor."""
from __future__ import annotations

from pathlib import Path

import pytest

from matimo.core.models import CommandExecution, Parameter, ParameterType, ToolDefinition
from matimo.errors import ErrorCode, MatimoError
from matimo.executors.command_executor import CommandExecutor

pytestmark = pytest.mark.asyncio



def _make_command_tool(
    command: str = "echo",
    args: list[str] | None = None,
    params: dict | None = None,
    timeout: int = 30_000,
) -> ToolDefinition:
    return ToolDefinition(
        name="cmd_tool",
        description="test",
        parameters=params or {},
        execution=CommandExecution(
            type="command",
            command=command,
            args=args or [],
            timeout=timeout,
        ),
    )


@pytest.fixture()
def executor() -> CommandExecutor:
    return CommandExecutor()


class TestCommandExecutorSuccess:
    @pytest.mark.asyncio
    async def test_echo_command_succeeds(self, executor: CommandExecutor) -> None:
        tool = _make_command_tool(command="echo", args=["hello"])
        result = await executor.execute(tool, {})
        assert result["success"] is True
        assert "hello" in result["stdout"]
        assert result["exit_code"] == 0

    @pytest.mark.asyncio
    async def test_arg_template_substitution(self, executor: CommandExecutor) -> None:
        tool = _make_command_tool(
            command="echo",
            args=["{greeting}"],
            params={"greeting": Parameter(type=ParameterType.STRING, description="g", required=True)},
        )
        result = await executor.execute(tool, {"greeting": "world"})
        assert "world" in result["stdout"]

    @pytest.mark.asyncio
    async def test_result_contains_duration(self, executor: CommandExecutor) -> None:
        tool = _make_command_tool(command="echo", args=["timing"])
        result = await executor.execute(tool, {})
        assert "duration" in result
        assert isinstance(result["duration"], (int, float))

    @pytest.mark.asyncio
    async def test_stderr_captured(self, executor: CommandExecutor) -> None:
        # 'ls' on a nonexistent path writes to stderr
        tool = _make_command_tool(command="ls", args=["/nonexistent_xyz_abc"])
        result = await executor.execute(tool, {})
        assert result["success"] is False or len(result["stderr"]) > 0


class TestCommandExecutorErrors:
    @pytest.mark.asyncio
    async def test_command_not_found_raises(self, executor: CommandExecutor) -> None:
        tool = _make_command_tool(command="__nonexistent_command_xyz__")
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @pytest.mark.asyncio
    async def test_timeout_raises(self, executor: CommandExecutor) -> None:
        # Use a very short timeout (1ms) to force a timeout
        tool = _make_command_tool(command="sleep", args=["10"], timeout=1)
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code in (ErrorCode.EXECUTION_FAILED, ErrorCode.TIMEOUT)

    @pytest.mark.asyncio
    async def test_nonzero_exit_marks_failed(self, executor: CommandExecutor) -> None:
        # 'false' always exits with code 1
        tool = _make_command_tool(command="false")
        result = await executor.execute(tool, {})
        assert result["success"] is False
        assert result["exit_code"] != 0


class TestCommandExecutorEnvInjection:
    @pytest.mark.asyncio
    async def test_credentials_merged_into_env(self, executor: CommandExecutor) -> None:
        """Credentials should be injected as env vars, not as log output."""
        tool = _make_command_tool(command="env")
        result = await executor.execute(tool, {}, credentials={"MY_SECRET": "super_secret"})
        # The env command outputs all env vars; our secret should be there
        assert "MY_SECRET=super_secret" in result["stdout"]


class TestCommandExecutorEdgeCases:
    @pytest.mark.asyncio
    async def test_non_command_tool_raises(self) -> None:
        """Passing an http tool to CommandExecutor raises EXECUTION_FAILED."""
        from matimo.core.models import HttpExecution
        tool = ToolDefinition(
            name="http_tool",
            description="test",
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
        )
        executor = CommandExecutor()
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @pytest.mark.asyncio
    async def test_env_var_template_fallback(self) -> None:
        """Placeholders without explicit params fall back to env vars."""
        import os
        import unittest.mock
        tool = _make_command_tool(command="echo", args=["{MY_PARAM}"])
        with unittest.mock.patch.dict(os.environ, {"MY_PARAM": "hello_from_env"}):
            executor = CommandExecutor()
            result = await executor.execute(tool, {})
        assert "hello_from_env" in result["stdout"]

    @pytest.mark.asyncio
    async def test_uses_exec_cfg_cwd(self, tmp_path: Path) -> None:
        """CommandExecution.cwd overrides global executor cwd."""
        tool = ToolDefinition(
            name="pwd_tool",
            description="test",
            execution=CommandExecution(
                type="command",
                command="pwd",
                cwd=str(tmp_path),
            ),
        )
        executor = CommandExecutor()
        result = await executor.execute(tool, {})
        assert result["success"] is True
