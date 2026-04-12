"""Execute tool — run shell commands and capture output."""
from __future__ import annotations

import asyncio
import re
import shlex
import time

SAFE_VARS = re.compile(r"^\$(HOME|PATH|USER|PWD|SHELL|LANG|TERM)$", re.IGNORECASE)
DANGEROUS = re.compile(r"[;&|`<>]|\$\(|\$\{")


def _detect_injection(command: str) -> bool:
    if DANGEROUS.search(command):
        return True
    for var in re.findall(r"\$\w+", command):
        if not SAFE_VARS.match(var):
            return True
    return False


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    command: str = params["command"]
    cwd: str | None = params.get("cwd")
    timeout_ms: int = int(params.get("timeout", 30000))
    timeout_s = timeout_ms / 1000.0

    if _detect_injection(command):
        raise ValueError(f"Potential command injection detected in: {command!r}")

    parts = shlex.split(command)
    start = time.monotonic()
    try:
        proc = await asyncio.create_subprocess_exec(
            *parts,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=timeout_s)
        except TimeoutError:
            proc.kill()
            await proc.communicate()
            duration = int((time.monotonic() - start) * 1000)
            return {
                "success": False,
                "exitCode": -1,
                "stdout": "",
                "stderr": f"Timed out after {timeout_s}s",
                "command": command,
                "duration": duration,
            }
    except Exception as exc:
        duration = int((time.monotonic() - start) * 1000)
        return {
            "success": False,
            "exitCode": -1,
            "stdout": "",
            "stderr": str(exc),
            "command": command,
            "duration": duration,
        }

    duration = int((time.monotonic() - start) * 1000)
    exit_code = proc.returncode or 0
    return {
        "success": exit_code == 0,
        "exitCode": exit_code,
        "stdout": stdout_b.decode("utf-8", errors="replace"),
        "stderr": stderr_b.decode("utf-8", errors="replace"),
        "command": command,
        "duration": duration,
    }
