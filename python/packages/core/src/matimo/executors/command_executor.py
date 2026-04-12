"""
Command executor — spawns subprocess for 'type: command' tools.
Mirrors: packages/core/src/executors/command-executor.ts
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

from matimo.core.models import CommandExecution, ToolDefinition
from matimo.errors import ErrorCode, MatimoError

logger = logging.getLogger("matimo")

_PLACEHOLDER_RE = re.compile(r"\{([^}]+)\}")

_DEFAULT_TIMEOUT_MS = 30_000


class CommandExecutor:
    """
    Executes command tools by spawning subprocesses.
    Mirrors: CommandExecutor in command-executor.ts

    Security:
    - Credentials merged onto env for the child process only — never logged.
    - Shell=False by default to prevent shell injection.
    """

    def __init__(self, cwd: str | None = None) -> None:
        self._cwd = cwd

    async def execute(
        self,
        tool: ToolDefinition,
        params: dict[str, Any],
        credentials: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """
        Execute a command tool.

        Returns dict: {success, stdout, stderr, exit_code, duration}
        """
        exec_cfg = tool.execution
        if not isinstance(exec_cfg, CommandExecution):
            raise MatimoError(
                f"Tool '{tool.name}' is not a command tool",
                ErrorCode.EXECUTION_FAILED,
                {"tool_name": tool.name, "execution_type": exec_cfg.type},
            )

        # SECURITY: command must be a fixed executable — never a templated value.
        # Only 'args' may contain {placeholder} tokens.
        if _PLACEHOLDER_RE.search(exec_cfg.command):
            raise MatimoError(
                f"execution.command must not contain parameter placeholders — only 'args' may be "
                f"templated. Found: '{exec_cfg.command}'. Move the dynamic part into 'args'.",
                ErrorCode.EXECUTION_FAILED,
                {"tool_name": tool.name},
            )
        command = exec_cfg.command  # Never template the executable
        args = [self._template(a, params) for a in (exec_cfg.args or [])]

        # Build child environment: process env + tool env + credentials (last wins)
        child_env = dict(os.environ)
        if exec_cfg.env:
            child_env.update(exec_cfg.env)
        if credentials:
            child_env.update(credentials)  # SECURITY: not logged

        # Determine working directory
        cwd: str | None = None
        if exec_cfg.cwd:
            cwd = exec_cfg.cwd
        elif self._cwd:
            cwd = self._cwd
        else:
            cwd = str(Path.cwd())

        timeout_s = (exec_cfg.timeout or _DEFAULT_TIMEOUT_MS) / 1000.0
        start = time.monotonic()

        try:
            proc = await asyncio.create_subprocess_exec(
                command,
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=child_env,
                cwd=cwd,
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout_s
                )
            except TimeoutError:
                proc.kill()
                await proc.communicate()
                duration = time.monotonic() - start
                raise MatimoError(
                    f"Tool '{tool.name}' timed out after {duration:.1f}s",
                    ErrorCode.TIMEOUT,
                    {"tool_name": tool.name, "timeout_ms": exec_cfg.timeout or _DEFAULT_TIMEOUT_MS},
                ) from None

        except MatimoError:
            raise
        except Exception as exc:
            raise MatimoError(
                f"Failed to spawn process for tool '{tool.name}': {exc}",
                ErrorCode.EXECUTION_FAILED,
                {"tool_name": tool.name, "command": command},
                cause=exc,
            ) from exc

        duration = time.monotonic() - start
        exit_code = proc.returncode or 0
        stdout = stdout_bytes.decode("utf-8", errors="replace").strip()
        stderr = stderr_bytes.decode("utf-8", errors="replace").strip()

        return {
            "success": exit_code == 0,
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": exit_code,
            "duration": duration,
        }

    # ------------------------------------------------------------------
    # Templating
    # ------------------------------------------------------------------

    def _template(self, value: str, params: dict[str, Any]) -> str:
        """Replace {placeholder} tokens with param values."""
        def replacer(m: re.Match[str]) -> str:
            name = m.group(1)
            if name in params:
                return str(params[name])
            env_val = os.environ.get(name)
            if env_val is not None:
                return env_val
            raise MatimoError(
                f"Missing value for placeholder '{{{name}}}'",
                ErrorCode.INVALID_PARAMETER,
                {"placeholder": name},
            )

        return _PLACEHOLDER_RE.sub(replacer, value)
