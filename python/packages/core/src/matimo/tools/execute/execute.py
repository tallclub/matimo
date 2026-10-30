"""Execute tool: run commands and capture output.

By default runs the command WITHOUT a shell (exec on a parsed argv), matching the TypeScript SDK.
Shell operators, redirection and expansion do not work; builtins such as `dir` or `echo`
are not executables and are unavailable on Windows (use `python`, `git`, ... instead).
Passing `shell` opts in to running the command through that shell; every such call needs
a human approval that MATIMO_AUTO_APPROVE, approved patterns and `approved=True` cannot skip.
"""
from __future__ import annotations

import asyncio
import re
import sys
import time
from typing import Any

from matimo.errors import ErrorCode, MatimoError

SAFE_VARS = re.compile(r"^\$(HOME|PATH|USER|PWD|SHELL|LANG|TERM)$", re.IGNORECASE)
# Newline / CR / NUL are command separators in sh, never legitimate in one command.
DANGEROUS = re.compile(r"[\r\n\0;&|`<>]|\$\(|\$\{")


def _detect_injection(command: str) -> bool:
    if DANGEROUS.search(command):
        return True
    for var in re.findall(r"\$\w+", command):
        if not SAFE_VARS.match(var):
            return True
    return False


def _split_command(command: str) -> list[str]:
    """
    Split a command line into argv the way a POSIX shell would for quoting only:
    whitespace separates arguments, single and double quotes group, and a
    backslash escapes the next character (not on Windows, where it is a path
    separator). No expansion, globbing, or operators are interpreted.
    """
    args: list[str] = []
    current: list[str] = []
    in_arg = False
    quote: str | None = None
    backslash_escapes = sys.platform != "win32"

    i = 0
    n = len(command)
    while i < n:
        ch = command[i]
        if quote:
            if ch == quote:
                quote = None
            elif (
                ch == "\\"
                and quote == '"'
                and backslash_escapes
                and command[i + 1 : i + 2] in ('"', "\\")
            ):
                i += 1
                current.append(command[i])
            else:
                current.append(ch)
        elif ch in ('"', "'"):
            quote = ch
            in_arg = True
        elif ch == "\\" and backslash_escapes and i + 1 < n:
            i += 1
            current.append(command[i])
            in_arg = True
        elif ch.isspace():
            if in_arg:
                args.append("".join(current))
                current = []
                in_arg = False
        else:
            current.append(ch)
            in_arg = True
        i += 1

    if quote:
        raise MatimoError(
            "Unterminated quote in command",
            ErrorCode.INVALID_PARAMETER,
            {"reason": "Command has an unmatched quote character"},
        )
    if in_arg:
        args.append("".join(current))
    return args


def _shell_invocation(shell: str, command: str, args: list[str]) -> list[str]:
    """
    Build the argv for running `command` through `shell`. POSIX-style shells get
    `-c command` with `args` as positional parameters ($1, $2, ...); cmd and
    PowerShell take the command line only.
    """
    name = re.split(r"[\\/]", shell)[-1].lower().removesuffix(".exe")
    if name in ("cmd", "powershell", "pwsh"):
        if args:
            raise MatimoError(
                "Invalid args",
                ErrorCode.INVALID_PARAMETER,
                {"reason": f"args are not supported with shell '{name}'; put them in the command"},
            )
        return ["/c", command] if name == "cmd" else ["-NoProfile", "-Command", command]
    return ["-c", command, shell, *args]


async def run(params: dict[str, Any]) -> dict[str, Any]:
    command: str = params.get("command") or ""
    extra_args = params.get("args") or []
    cwd: str | None = params.get("cwd")
    timeout_ms: int = int(params.get("timeout", 30000))
    timeout_s = timeout_ms / 1000.0
    shell_param = params.get("shell")
    use_shell = shell_param is not None and shell_param != ""

    if not command.strip():
        raise MatimoError(
            "Command required", ErrorCode.INVALID_PARAMETER, {"reason": "No command provided"}
        )

    if use_shell and (
        not isinstance(shell_param, str) or re.search(r"[\r\n\0]", shell_param)
    ):
        raise MatimoError(
            "Invalid shell",
            ErrorCode.INVALID_PARAMETER,
            {"reason": "shell must be a single-line string naming a shell executable"},
        )

    # A command run through an explicit shell is a shell line by definition, so the
    # injection filter does not apply: such a call always goes to a human first
    # (see requires_mandatory_human_approval).
    if not use_shell and _detect_injection(command):
        raise MatimoError(
            "Command injection detected",
            ErrorCode.INVALID_PARAMETER,
            {
                "reason": "Command contains potentially dangerous shell metacharacters",
                "command": command,
            },
        )

    if not isinstance(extra_args, list) or not all(isinstance(a, str) for a in extra_args):
        raise MatimoError(
            "Invalid args",
            ErrorCode.INVALID_PARAMETER,
            {"reason": "args must be an array of strings"},
        )

    # Explicit args are appended verbatim (never re-split), so an argument with spaces
    # stays one argument.
    parts: list[str]
    if use_shell:
        shell = str(shell_param)
        parts = [shell, *_shell_invocation(shell, command, extra_args)]
    else:
        parts = [*_split_command(command), *extra_args]
    if not parts:
        raise MatimoError(
            "Command required", ErrorCode.INVALID_PARAMETER, {"reason": "No command provided"}
        )

    start = time.monotonic()
    try:
        proc = await asyncio.create_subprocess_exec(
            *parts,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
        )
    except Exception as exc:
        # Spawn failures (e.g. file not found): exit code 1 and the message, as in TypeScript.
        return {
            "success": False,
            "exitCode": 1,
            "stdout": "",
            "stderr": str(exc),
            "command": command,
            "duration": int((time.monotonic() - start) * 1000),
        }

    try:
        stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=timeout_s)
    except TimeoutError:
        proc.kill()
        stdout_b, stderr_b = await proc.communicate()
        return {
            "success": False,
            "exitCode": -1,
            "stdout": stdout_b.decode("utf-8", errors="replace").strip(),
            "stderr": stderr_b.decode("utf-8", errors="replace").strip(),
            "command": command,
            "duration": int((time.monotonic() - start) * 1000),
        }

    exit_code = proc.returncode or 0
    return {
        "success": exit_code == 0,
        "exitCode": exit_code,
        "stdout": stdout_b.decode("utf-8", errors="replace").strip(),
        "stderr": stderr_b.decode("utf-8", errors="replace").strip(),
        "command": command,
        "duration": int((time.monotonic() - start) * 1000),
    }
