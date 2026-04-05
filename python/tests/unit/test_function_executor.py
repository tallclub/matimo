"""Unit tests for FunctionExecutor."""
from __future__ import annotations

from pathlib import Path

import pytest

from matimo.core.models import FunctionExecution, Parameter, ParameterType, ToolDefinition
from matimo.errors import ErrorCode, MatimoError
from matimo.executors.function_executor import FunctionExecutor


def _make_function_tool(code: str, tmp_path: Path, params: dict | None = None) -> ToolDefinition:
    py_file = tmp_path / "tool_func.py"
    py_file.write_text(code)
    tool = ToolDefinition(
        name="func_tool",
        description="test",
        parameters=params or {},
        execution=FunctionExecution(type="function", code=str(py_file)),
    )
    tool.set_definition_path(str(tmp_path / "definition.yaml"))
    return tool


@pytest.fixture()
def executor() -> FunctionExecutor:
    return FunctionExecutor()


class TestFunctionExecutorSync:
    @pytest.mark.asyncio
    async def test_sync_run_returns_result(self, executor: FunctionExecutor, tmp_path: Path):
        tool = _make_function_tool(
            "def run(params):\n    return {'value': params['x'] * 2}\n",
            tmp_path,
            params={"x": Parameter(type=ParameterType.NUMBER, description="x", required=True)},
        )
        result = await executor.execute(tool, {"x": 5})
        assert result == {"value": 10}

    @pytest.mark.asyncio
    async def test_sync_run_string_return(self, executor: FunctionExecutor, tmp_path: Path):
        tool = _make_function_tool(
            "def run(params):\n    return 'pong'\n", tmp_path
        )
        result = await executor.execute(tool, {})
        assert result == "pong"


class TestFunctionExecutorAsync:
    @pytest.mark.asyncio
    async def test_async_run_returns_result(self, executor: FunctionExecutor, tmp_path: Path):
        tool = _make_function_tool(
            "import asyncio\nasync def run(params):\n    await asyncio.sleep(0)\n    return {'n': params['n'] + 1}\n",
            tmp_path,
            params={"n": Parameter(type=ParameterType.NUMBER, description="n", required=True)},
        )
        result = await executor.execute(tool, {"n": 41})
        assert result == {"n": 42}


class TestFunctionExecutorTsResolution:
    @pytest.mark.asyncio
    async def test_ts_path_resolves_to_py(self, executor: FunctionExecutor, tmp_path: Path):
        """If code path ends in .ts but .py sibling exists, should load .py."""
        py_file = tmp_path / "my_tool.py"
        py_file.write_text("def run(params):\n    return 'py'\n")

        ts_path = str(tmp_path / "my_tool.ts")
        tool = ToolDefinition(
            name="func_tool",
            description="test",
            execution=FunctionExecution(type="function", code=ts_path),
        )
        tool.set_definition_path(str(tmp_path / "definition.yaml"))
        result = await executor.execute(tool, {})
        assert result == "py"


class TestFunctionExecutorErrors:
    @pytest.mark.asyncio
    async def test_missing_file_raises(self, executor: FunctionExecutor, tmp_path: Path):
        tool = ToolDefinition(
            name="func_tool",
            description="test",
            execution=FunctionExecution(type="function", code="/nonexistent/path.py"),
        )
        tool.set_definition_path(str(tmp_path / "definition.yaml"))
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code in (ErrorCode.TOOL_NOT_FOUND, ErrorCode.FILE_NOT_FOUND)

    @pytest.mark.asyncio
    async def test_missing_run_function_raises(self, executor: FunctionExecutor, tmp_path: Path):
        tool = _make_function_tool(
            "# no run function\ndef other(): pass\n", tmp_path
        )
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @pytest.mark.asyncio
    async def test_runtime_exception_raises(self, executor: FunctionExecutor, tmp_path: Path):
        tool = _make_function_tool(
            "def run(params):\n    raise ValueError('oops')\n", tmp_path
        )
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED
