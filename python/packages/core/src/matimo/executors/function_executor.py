"""
Function executor — imports and calls Python functions for 'type: function' tools.
Mirrors: typescript/packages/core/src/executors/function-executor.ts

Python function contract:
  Every tool file specified in definition.yaml must export a run() function (sync OR async):

      def run(params: dict) -> dict: ...
      async def run(params: dict) -> dict: ...

Example tool definition (definition.yaml):
  name: my_tool
  execution:
    type: function
    code: "./my_tool.py"  # Direct Python file reference
"""
from __future__ import annotations

import asyncio
import importlib.util
import inspect
import logging
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from matimo.core.models import FunctionExecution, ToolDefinition
from matimo.errors import ErrorCode, MatimoError

logger = logging.getLogger("matimo")


class FunctionExecutor:
    """
    Loads and executes Python function tools via importlib.
    Mirrors: FunctionExecutor in function-executor.ts
    """

    def __init__(self, tools_base_path: str = "") -> None:
        """
        Args:
            tools_base_path: Base directory used to resolve relative code paths.
                             Defaults to cwd if not provided.
        """
        self._base_path = Path(tools_base_path) if tools_base_path else Path.cwd()

    async def execute(
        self,
        tool: ToolDefinition,
        params: dict[str, Any],
        credentials: dict[str, str] | None = None,
    ) -> Any:  # noqa: ANN401
        """
        Load and execute the Python run() function specified in the tool definition.

        Returns Any because tool run() functions return arbitrary Python values.
        """
        exec_cfg = tool.execution
        if not isinstance(exec_cfg, FunctionExecution):
            raise MatimoError(
                f"Tool '{tool.name}' is not a function tool",
                ErrorCode.EXECUTION_FAILED,
                {"tool_name": tool.name, "execution_type": exec_cfg.type},
            )

        py_path = self._resolve_python_path(tool)

        if not py_path.exists():
            raise MatimoError(
                f"Python implementation not found for tool '{tool.name}': {py_path}",
                ErrorCode.FILE_NOT_FOUND,
                {"tool_name": tool.name, "expected_path": str(py_path), "code_field": exec_cfg.code},
            )

        start = time.monotonic()
        run_fn = self._load_run_function(py_path, tool.name)

        # Merge credentials into params for function tools (they may need env-like tokens)
        call_params = dict(params)
        if credentials:
            call_params.update(credentials)

        timeout_s = (exec_cfg.timeout or 30_000) / 1000.0

        try:
            if inspect.iscoroutinefunction(run_fn):
                result = await asyncio.wait_for(run_fn(call_params), timeout=timeout_s)
            else:
                # Run sync function in executor to avoid blocking the event loop
                result = await asyncio.wait_for(
                    asyncio.get_running_loop().run_in_executor(None, run_fn, call_params),
                    timeout=timeout_s,
                )
        except TimeoutError:
            duration = time.monotonic() - start
            raise MatimoError(
                f"Tool '{tool.name}' timed out after {duration:.1f}s",
                ErrorCode.TIMEOUT,
                {"tool_name": tool.name, "timeout_ms": exec_cfg.timeout or 30_000},
            ) from None
        except MatimoError:
            raise
        except Exception as exc:
            raise MatimoError(
                f"Function tool '{tool.name}' raised an exception: {exc}",
                ErrorCode.EXECUTION_FAILED,
                {"tool_name": tool.name, "py_path": str(py_path)},
                cause=exc,
            ) from exc

        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_python_path(self, tool: ToolDefinition) -> Path:
        """
        Resolve the Python file path from the tool's 'code' field.
        Paths are resolved relative to the tool's definition_path directory first,
        then fall back to self._base_path. Supports both relative and absolute paths.
        """
        exec_cfg = tool.execution
        code_str: str = exec_cfg.code  # type: ignore[attr-defined]

        # Resolve relative to the definition file directory first
        base = (
            Path(tool.definition_path).parent
            if tool.definition_path
            else self._base_path
        )

        # SECURITY: reject path-traversal sequences in relative paths.
        # Absolute paths are permitted (explicit admin intent);
        # relative paths must not escape the tool directory via '..'.
        raw_path = Path(code_str)
        if ".." in raw_path.parts:
            raise MatimoError(
                f"Tool '{tool.name}': execution.code must not contain path traversal "
                f"sequences: '{code_str}'.",
                ErrorCode.EXECUTION_FAILED,
                {"tool_name": tool.name, "code": code_str},
            )
        if raw_path.is_absolute():
            resolved = raw_path.resolve()
        else:
            resolved = (base / raw_path).resolve()

        # If the path has a non-.py extension (e.g. .ts from a TypeScript tool definition)
        # and a sibling .py file exists, use it instead.
        if resolved.suffix != ".py":
            py_sibling = resolved.with_suffix(".py")
            if py_sibling.exists():
                resolved = py_sibling

        return resolved

    def _load_run_function(self, py_path: Path, tool_name: str) -> Callable[..., Any]:
        """
        Import the Python module at py_path and return its run() function.
        Raises MatimoError if 'run' is not defined.
        """
        spec = importlib.util.spec_from_file_location(
            f"matimo_tool_{tool_name}", py_path
        )
        if spec is None or spec.loader is None:
            raise MatimoError(
                f"Cannot load Python module for tool '{tool_name}': {py_path}",
                ErrorCode.EXECUTION_FAILED,
                {"tool_name": tool_name, "py_path": str(py_path)},
            )

        module = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(module)  # type: ignore[union-attr]
        except Exception as exc:
            raise MatimoError(
                f"Error importing module for tool '{tool_name}': {exc}",
                ErrorCode.EXECUTION_FAILED,
                {"tool_name": tool_name, "py_path": str(py_path)},
                cause=exc,
            ) from exc

        run_fn = getattr(module, "run", None)
        if run_fn is None or not callable(run_fn):
            raise MatimoError(
                f"Tool '{tool_name}' module has no callable run() function: {py_path}",
                ErrorCode.EXECUTION_FAILED,
                {"tool_name": tool_name, "py_path": str(py_path)},
            )

        return run_fn
