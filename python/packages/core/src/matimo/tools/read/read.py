"""Read tool — read file contents with optional line ranges."""
from __future__ import annotations

import time
from pathlib import Path


def _resolve(file_path: str) -> Path:
    if file_path.startswith("~"):
        file_path = str(Path.home()) + file_path[1:]
    return Path(file_path).resolve()


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    file_path = params["filePath"]
    start_line: int | None = params.get("startLine")
    end_line: int | None = params.get("endLine")
    encoding: str = params.get("encoding", "utf-8")
    max_lines: int = int(params.get("maxLines", 10000))

    resolved = _resolve(file_path)
    if not resolved.exists():
        raise FileNotFoundError(f"File not found: {resolved}")

    stat = resolved.stat()
    start = time.monotonic()
    raw = resolved.read_bytes()
    content = raw.decode(encoding, errors="replace")
    lines = content.splitlines(keepends=True)
    total_lines = len(lines)

    s = (start_line - 1) if start_line else 0
    e = end_line if end_line else total_lines
    s = max(0, s)
    e = min(total_lines, e)

    selected = lines[s:e]
    if len(selected) > max_lines:
        raise ValueError(f"Requested range exceeds maxLines ({max_lines})")

    duration = int((time.monotonic() - start) * 1000)
    return {
        "success": True,
        "filePath": str(resolved),
        "content": "".join(selected),
        "encoding": encoding,
        "lineCount": total_lines,
        "readLines": len(selected),
        "linesRequested": {"start": s + 1, "end": e},
        "size": stat.st_size,
        "mtime": str(stat.st_mtime),
        "duration": duration,
    }
