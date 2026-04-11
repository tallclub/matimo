"""Search tool — search files by name or content."""
from __future__ import annotations

import fnmatch
import logging
import re
import time
from pathlib import Path

logger = logging.getLogger("matimo")

ALWAYS_EXCLUDE = {"node_modules", ".git", "dist", "build", "__pycache__", ".venv", ".mypy_cache"}


def _resolve_dir(directory: str) -> Path:
    if directory.startswith("~"):
        directory = str(Path.home()) + directory[1:]
    return Path(directory).resolve()


def _matches_pattern(path: Path, file_pattern: str) -> bool:
    return fnmatch.fnmatch(path.name, file_pattern) or fnmatch.fnmatch(str(path), file_pattern)


def _excluded(path: Path, exclude_patterns: list[str]) -> bool:
    for part in path.parts:
        if part in ALWAYS_EXCLUDE:
            return True
    for pat in exclude_patterns:
        if fnmatch.fnmatch(str(path), pat):
            return True
    return False


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    query: str = params["query"]
    directory: str = params.get("directory", ".")
    file_pattern: str = params.get("filePattern", "*")
    is_regex: bool = bool(params.get("isRegex", False))
    case_sensitive: bool = bool(params.get("caseSensitive", False))
    max_results: int = int(params.get("maxResults", 50))
    context_lines: int = int(params.get("contextLines", 2))
    exclude_patterns: list[str] = params.get("excludePatterns", ["**/node_modules/**", "**/.git/**"])

    resolved_dir = _resolve_dir(directory)
    if not resolved_dir.exists():
        raise FileNotFoundError(f"Directory not found: {resolved_dir}")

    flags = 0 if case_sensitive else re.IGNORECASE
    if is_regex:
        pattern = re.compile(query, flags)
    else:
        escaped = re.escape(query)
        pattern = re.compile(escaped, flags)

    start = time.monotonic()
    matches = []
    files_searched = 0
    truncated = False

    for fp in sorted(resolved_dir.rglob("*")):
        if not fp.is_file():
            continue
        rel = fp.relative_to(resolved_dir)
        if _excluded(rel, exclude_patterns):
            continue
        if file_pattern != "*" and not _matches_pattern(fp, file_pattern):
            continue
        try:
            text = fp.read_text(encoding="utf-8", errors="ignore")
        except Exception as exc:
            logger.debug("search: skipping unreadable file %s: %s", fp, exc)
            continue
        files_searched += 1
        lines = text.splitlines()
        for i, line in enumerate(lines):
            m = pattern.search(line)
            if m:
                ctx_start = max(0, i - context_lines)
                ctx_end = min(len(lines), i + context_lines + 1)
                context = lines[ctx_start:ctx_end]
                matches.append({
                    "filePath": str(fp),
                    "lineNumber": i + 1,
                    "lineContent": line,
                    "matchIndex": m.start(),
                    "context": context,
                })
                if len(matches) >= max_results:
                    truncated = True
                    break
        if truncated:
            break

    duration = int((time.monotonic() - start) * 1000)
    return {
        "success": True,
        "query": query,
        "directory": str(resolved_dir),
        "pattern": file_pattern,
        "matches": matches,
        "totalMatches": len(matches),
        "filesSearched": files_searched,
        "duration": duration,
        "truncated": truncated,
    }
