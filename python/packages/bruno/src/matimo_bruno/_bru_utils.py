"""Shared utilities for Bruno CLI tools."""
from __future__ import annotations

import re
import shutil
import subprocess

BRU_MIN_VERSION: tuple[int, int, int] = (1, 0, 0)
BRU_MIN_VERSION_STR = "1.0.0"


def check_bru_version() -> None:
    """Verify the Bruno CLI is installed and meets the minimum required version.

    Raises:
        RuntimeError: If ``bru`` is not installed or below :data:`BRU_MIN_VERSION`.

    Silently skips the version comparison when the version output cannot be
    parsed (graceful degradation — the tool is installed, which is sufficient).
    """
    if shutil.which("bru") is None:
        raise RuntimeError(
            "Bruno CLI ('bru') is not installed or not in PATH. "
            "Install it with: npm install -g @usebruno/cli  "
            "or via Homebrew: brew install bruno"
        )
    try:
        result = subprocess.run(
            ["bru", "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        version_str = result.stdout.strip()
        match = re.match(r"^(\d+)\.(\d+)\.(\d+)", version_str)
        if match:
            installed: tuple[int, int, int] = (
                int(match.group(1)),
                int(match.group(2)),
                int(match.group(3)),
            )
            if installed < BRU_MIN_VERSION:
                raise RuntimeError(
                    f"Bruno CLI version {version_str} is below the minimum required "
                    f"version {BRU_MIN_VERSION_STR}. "
                    f"Upgrade with: npm install -g @usebruno/cli"
                )
    except RuntimeError:
        raise  # Re-raise version-too-low errors
    except Exception:  # noqa: BLE001
        pass  # Best-effort check — if version cannot be determined, proceed
