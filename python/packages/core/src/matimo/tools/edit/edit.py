"""Edit tool — insert, replace, delete, append lines in files."""
from __future__ import annotations

import shutil
import time
from pathlib import Path


def _resolve(file_path: str) -> Path:
    if file_path.startswith("~"):
        file_path = str(Path.home()) + file_path[1:]
    return Path(file_path).resolve()


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    file_path: str = params["filePath"]
    operation: str = params["operation"].lower()
    content: str = params.get("content", "")
    start_line: int = int(params["startLine"])
    end_line: int | None = int(params["endLine"]) if params.get("endLine") is not None else None
    do_backup: bool = params.get("backup", True)

    resolved = _resolve(file_path)
    if not resolved.exists():
        raise FileNotFoundError(f"File not found: {resolved}")

    start = time.monotonic()
    original = resolved.read_text(encoding="utf-8")
    lines = original.splitlines(keepends=True)

    backup_created = False
    backup_path = None
    if do_backup:
        backup_path = str(resolved) + ".backup"
        shutil.copy2(resolved, backup_path)
        backup_created = True

    prev_content = None
    lines_affected = 0

    if operation == "insert":
        new_lines = [ln + ("\n" if not ln.endswith("\n") else "") for ln in content.splitlines()]
        idx = start_line - 1
        lines = lines[:idx] + new_lines + lines[idx:]
        lines_affected = len(new_lines)
    elif operation == "replace":
        e = end_line or start_line
        s = start_line - 1
        prev_content = "".join(lines[s:e])
        new_lines = [ln + ("\n" if not ln.endswith("\n") else "") for ln in content.splitlines()]
        lines = lines[:s] + new_lines + lines[e:]
        lines_affected = len(new_lines)
    elif operation == "delete":
        e = end_line or start_line
        s = start_line - 1
        prev_content = "".join(lines[s:e])
        lines_affected = e - s
        lines = lines[:s] + lines[e:]
    elif operation == "append":
        new_lines = [ln + ("\n" if not ln.endswith("\n") else "") for ln in content.splitlines()]
        lines = lines + new_lines
        lines_affected = len(new_lines)
    else:
        raise ValueError(f"Unknown operation: {operation}")

    resolved.write_text("".join(lines), encoding="utf-8")
    duration = int((time.monotonic() - start) * 1000)

    return {
        "success": True,
        "filePath": str(resolved),
        "operation": operation,
        "linesAffected": lines_affected,
        "backupCreated": backup_created,
        "backupPath": backup_path,
        "previousContent": prev_content,
        "newLineCount": len(lines),
        "duration": duration,
    }
