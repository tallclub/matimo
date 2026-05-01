"""Unit tests for FunctionExecutor."""
from __future__ import annotations

from pathlib import Path

import pytest

from matimo.core.models import FunctionExecution, Parameter, ParameterType, ToolDefinition
from matimo.errors import ErrorCode, MatimoError
from matimo.executors.function_executor import FunctionExecutor

pytestmark = pytest.mark.asyncio



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
    async def test_sync_run_returns_result(self, executor: FunctionExecutor, tmp_path: Path) -> None:
        tool = _make_function_tool(
            "def run(params):\n    return {'value': params['x'] * 2}\n",
            tmp_path,
            params={"x": Parameter(type=ParameterType.NUMBER, description="x", required=True)},
        )
        result = await executor.execute(tool, {"x": 5})
        assert result == {"value": 10}

    @pytest.mark.asyncio
    async def test_sync_run_string_return(self, executor: FunctionExecutor, tmp_path: Path) -> None:
        tool = _make_function_tool(
            "def run(params):\n    return 'pong'\n", tmp_path
        )
        result = await executor.execute(tool, {})
        assert result == "pong"


class TestFunctionExecutorAsync:
    @pytest.mark.asyncio
    async def test_async_run_returns_result(self, executor: FunctionExecutor, tmp_path: Path) -> None:
        tool = _make_function_tool(
            "import asyncio\nasync def run(params):\n    await asyncio.sleep(0)\n    return {'n': params['n'] + 1}\n",
            tmp_path,
            params={"n": Parameter(type=ParameterType.NUMBER, description="n", required=True)},
        )
        result = await executor.execute(tool, {"n": 41})
        assert result == {"n": 42}


class TestFunctionExecutorTsResolution:
    @pytest.mark.asyncio
    async def test_ts_path_resolves_to_py(self, executor: FunctionExecutor, tmp_path: Path) -> None:
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
    async def test_missing_file_raises(self, executor: FunctionExecutor, tmp_path: Path) -> None:
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
    async def test_missing_run_function_raises(self, executor: FunctionExecutor, tmp_path: Path) -> None:
        tool = _make_function_tool(
            "# no run function\ndef other(): pass\n", tmp_path
        )
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @pytest.mark.asyncio
    async def test_runtime_exception_raises(self, executor: FunctionExecutor, tmp_path: Path) -> None:
        tool = _make_function_tool(
            "def run(params):\n    raise ValueError('oops')\n", tmp_path
        )
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED


class TestFunctionExecutorEdgeCases:
    @pytest.mark.asyncio
    async def test_non_function_tool_raises(self, tmp_path: Path) -> None:
        """Passing an HTTP tool to FunctionExecutor raises EXECUTION_FAILED."""
        from matimo.core.models import HttpExecution
        tool = ToolDefinition(
            name="http_tool",
            description="test",
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
        )
        executor = FunctionExecutor()
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @pytest.mark.asyncio
    async def test_exec_module_error_raises(self, executor: FunctionExecutor, tmp_path: Path) -> None:
        """A module that raises on import is wrapped as EXECUTION_FAILED."""
        tool = _make_function_tool(
            "raise ImportError('missing dep')\ndef run(params): return {}\n", tmp_path
        )
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @pytest.mark.asyncio
    async def test_sync_function_executed_in_thread(self, executor: FunctionExecutor, tmp_path: Path) -> None:
        """Sync run() functions are executed via run_in_executor."""
        tool = _make_function_tool(
            "import threading\ndef run(params):\n    return {'tid': str(threading.current_thread().name)}\n",
            tmp_path,
        )
        result = await executor.execute(tool, {})
        # Result should have a thread ID key
        assert "tid" in result

    @pytest.mark.asyncio
    async def test_credentials_merged_into_params(
        self, executor: FunctionExecutor, tmp_path: Path
    ) -> None:
        """Cover line 82: credentials merged into call_params when provided."""
        tool = _make_function_tool(
            "def run(params):\n    return {'token': params.get('MY_TOKEN')}\n",
            tmp_path,
        )
        result = await executor.execute(tool, {}, credentials={"MY_TOKEN": "secret"})
        assert result == {"token": "secret"}

    @pytest.mark.asyncio
    async def test_timeout_raises_matimo_error(
        self, executor: FunctionExecutor, tmp_path: Path
    ) -> None:
        """Cover lines 96-97: TimeoutError is wrapped as TIMEOUT MatimoError."""
        import asyncio
        from unittest.mock import patch

        tool = _make_function_tool(
            "async def run(params):\n    return {}\n", tmp_path
        )

        def _raise_timeout(coro: object, *args: object, **kwargs: object) -> object:
            # Close the coroutine so Python doesn't warn "coroutine was never awaited"
            if asyncio.iscoroutine(coro):
                coro.close()  # type: ignore[union-attr]
            raise TimeoutError("timed out")

        with patch("asyncio.wait_for", side_effect=_raise_timeout):
            with pytest.raises(MatimoError) as exc:
                await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.TIMEOUT

    @pytest.mark.asyncio
    async def test_matimo_error_from_run_reraises(
        self, executor: FunctionExecutor, tmp_path: Path
    ) -> None:
        """Cover line 103: MatimoError raised inside run() is re-raised as-is."""
        tool = _make_function_tool(
            "from matimo.errors import MatimoError, ErrorCode\n"
            "def run(params):\n"
            "    raise MatimoError('tool failed', ErrorCode.EXECUTION_FAILED)\n",
            tmp_path,
        )
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @pytest.mark.asyncio
    async def test_relative_code_path_resolved_from_definition_dir(
        self, executor: FunctionExecutor, tmp_path: Path
    ) -> None:
        """Cover line 137: relative code path is resolved from definition_path parent."""
        tool_dir = tmp_path / "my_tool"
        tool_dir.mkdir()
        py_file = tool_dir / "index.py"
        py_file.write_text("def run(params):\n    return {'ok': True}\n")

        # Use relative path
        tool = ToolDefinition(
            name="func_tool",
            description="test",
            execution=FunctionExecution(type="function", code="index.py"),
        )
        tool.set_definition_path(str(tool_dir / "definition.yaml"))

        result = await executor.execute(tool, {})
        assert result == {"ok": True}

    @pytest.mark.asyncio
    async def test_spec_none_raises(self, executor: FunctionExecutor, tmp_path: Path) -> None:
        """Cover lines 159-160: spec_from_file_location returning None raises EXECUTION_FAILED."""
        import importlib.util
        from unittest.mock import patch

        tool = _make_function_tool("def run(params): return {}\n", tmp_path)
        with patch.object(importlib.util, "spec_from_file_location", return_value=None):
            with pytest.raises(MatimoError) as exc:
                await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED
