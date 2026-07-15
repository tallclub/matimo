"""Extract-from-file tool — extract text from local/remote PDF, DOCX, TXT, and CSV files.

Mirrors: typescript/packages/core/tools/extract_from_file/extract_from_file.ts
"""
from __future__ import annotations

import csv
import io
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from docx import Document
from pypdf import PdfReader

from matimo.errors import ErrorCode, MatimoError

SUPPORTED_FORMATS = ("pdf", "docx", "txt", "csv")
DEFAULT_MAX_SIZE_BYTES = 25 * 1024 * 1024  # 25MB
DEFAULT_TIMEOUT_MS = 30000


def _resolve_local_path(file_path: str) -> Path:
    """Expand ~ and resolve relative paths, mirroring the `read` core tool."""
    if file_path.startswith("~"):
        file_path = str(Path.home()) + file_path[1:]
    return Path(file_path).resolve()


def _is_blocked_url(url: str) -> bool:
    """SSRF guard mirroring is_blocked_url() in matimo.policy.default_policy.

    Blocks localhost, loopback, link-local/AWS metadata, and RFC1918 private
    ranges so a remote fileUrl fetch is held to the same bar Matimo's policy
    engine applies to agent-proposed HTTP tools. Callers are expected to have
    already validated that `url` parses cleanly (see `_load_remote_file`),
    so a bare/empty host is the only remaining "can't verify — block it" case.
    """
    hostname = (urlparse(url).hostname or "").lower()
    if not hostname:
        return True
    if hostname in ("localhost", "127.0.0.1", "::1"):
        return True
    if hostname.startswith("169.254."):
        return True
    if hostname.startswith("10.") or hostname.startswith("192.168."):
        return True
    return bool(re.match(r"^172\.(1[6-9]|2\d|3[01])\.", hostname))


def _extension_format(name: str) -> str | None:
    ext = Path(name).suffix.lower()
    return {".pdf": "pdf", ".docx": "docx", ".csv": "csv", ".txt": "txt"}.get(ext)


def _sniff_format(data: bytes) -> str:
    """Sniff a format from magic bytes / content when the extension is missing or ambiguous."""
    if data[:4] == b"%PDF":
        return "pdf"
    # DOCX (and other Office Open XML files) are ZIP archives: PK\x03\x04
    if data[:4] == b"PK\x03\x04":
        return "docx"
    sample = data[:2048].decode("utf-8", errors="replace")
    first_line = sample.splitlines()[0] if sample else ""
    if "," in first_line and len(first_line.split(",")) > 1:
        return "csv"
    return "txt"


def _detect_format(requested: str, name: str, data: bytes) -> str:
    if requested != "auto":
        return requested
    return _extension_format(name) or _sniff_format(data)


def _count_words(text: str) -> int:
    stripped = text.strip()
    return 0 if not stripped else len(stripped.split())


def _analyze_csv(text: str) -> tuple[int, int]:
    """Return (row_count, column_count) — row_count excludes the header row."""
    reader = csv.reader(io.StringIO(text))
    rows = [row for row in reader if row]
    column_count = len(rows[0]) if rows else 0
    row_count = max(0, len(rows) - 1)
    return row_count, column_count


def _load_local_file(file_path: str, max_size_bytes: int) -> tuple[bytes, str, str, str]:
    resolved = _resolve_local_path(file_path)

    if not resolved.exists():
        raise MatimoError(
            "File not found", ErrorCode.FILE_NOT_FOUND, {"filePath": str(resolved)}
        )
    if not resolved.is_file():
        raise MatimoError(
            "Not a file",
            ErrorCode.EXECUTION_FAILED,
            {"filePath": str(resolved), "reason": "Path exists but is not a file"},
        )

    size = resolved.stat().st_size
    if size > max_size_bytes:
        raise MatimoError(
            "File too large",
            ErrorCode.EXECUTION_FAILED,
            {"filePath": str(resolved), "size": size, "maxSizeBytes": max_size_bytes},
        )

    data = resolved.read_bytes()
    return data, "filePath", str(resolved), str(resolved)


async def _load_remote_file(
    file_url: str, max_size_bytes: int, timeout_ms: int
) -> tuple[bytes, str, str, str]:
    try:
        parsed = urlparse(file_url)
    except ValueError as exc:
        raise MatimoError(
            "Invalid URL",
            ErrorCode.INVALID_PARAMETER,
            {"fileUrl": file_url, "reason": "fileUrl must be a valid http or https URL"},
        ) from exc

    if parsed.scheme not in ("http", "https"):
        raise MatimoError(
            "Unsupported URL protocol",
            ErrorCode.INVALID_PARAMETER,
            {"fileUrl": file_url, "scheme": parsed.scheme, "reason": "Only http and https URLs are supported"},
        )

    if _is_blocked_url(file_url):
        raise MatimoError(
            "URL targets a blocked internal/metadata address",
            ErrorCode.INVALID_PARAMETER,
            {"fileUrl": file_url},
        )

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout_ms / 1000.0) as client:
            response = await client.get(
                file_url, headers={"User-Agent": "Matimo/1.0 (AI Agent Tool SDK)"}
            )
    except httpx.HTTPError as exc:
        raise MatimoError(
            "HTTP request failed", ErrorCode.NETWORK_ERROR, {"fileUrl": file_url, "originalError": str(exc)}
        ) from exc

    if response.status_code < 200 or response.status_code >= 300:
        raise MatimoError(
            "Failed to fetch fileUrl",
            ErrorCode.NETWORK_ERROR,
            {"fileUrl": file_url, "statusCode": response.status_code},
        )

    data = response.content
    if len(data) > max_size_bytes:
        raise MatimoError(
            "File too large",
            ErrorCode.EXECUTION_FAILED,
            {"fileUrl": file_url, "size": len(data), "maxSizeBytes": max_size_bytes},
        )

    return data, "fileUrl", file_url, urlparse(file_url).path


def _extract_pdf(data: bytes) -> tuple[str, dict[str, Any]]:
    reader = PdfReader(io.BytesIO(data))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    return text, {
        "page_count": len(reader.pages),
        "word_count": _count_words(text),
        "char_count": len(text),
    }


def _extract_docx(data: bytes) -> tuple[str, dict[str, Any]]:
    document = Document(io.BytesIO(data))
    text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    return text, {"word_count": _count_words(text), "char_count": len(text)}


def _extract_txt(data: bytes, encoding: str) -> tuple[str, dict[str, Any]]:
    text = data.decode(encoding)
    return text, {"word_count": _count_words(text), "char_count": len(text)}


def _extract_csv(data: bytes, encoding: str) -> tuple[str, dict[str, Any]]:
    text = data.decode(encoding)
    row_count, column_count = _analyze_csv(text)
    return text, {
        "word_count": _count_words(text),
        "char_count": len(text),
        "row_count": row_count,
        "column_count": column_count,
    }


async def run(params: dict[str, Any]) -> dict[str, Any]:
    file_path: str | None = params.get("filePath")
    file_url: str | None = params.get("fileUrl")
    fmt: str = params.get("format") or "auto"
    encoding: str = params.get("encoding") or "utf-8"
    max_size_bytes = int(params.get("maxSizeBytes") or DEFAULT_MAX_SIZE_BYTES)
    timeout_ms = int(params.get("timeout") or DEFAULT_TIMEOUT_MS)

    if not file_path and not file_url:
        raise MatimoError(
            "Missing required parameter",
            ErrorCode.INVALID_PARAMETER,
            {"reason": "Provide either filePath or fileUrl"},
        )
    if file_path and file_url:
        raise MatimoError(
            "Conflicting parameters",
            ErrorCode.INVALID_PARAMETER,
            {"reason": "Provide exactly one of filePath or fileUrl, not both"},
        )

    if fmt != "auto" and fmt not in SUPPORTED_FORMATS:
        raise MatimoError(
            "Unsupported format",
            ErrorCode.INVALID_PARAMETER,
            {"format": fmt, "supported": ["auto", *SUPPORTED_FORMATS]},
        )

    if file_path:
        data, source, source_location, name_for_detection = _load_local_file(file_path, max_size_bytes)
    else:
        data, source, source_location, name_for_detection = await _load_remote_file(
            file_url,  # type: ignore[arg-type]
            max_size_bytes,
            timeout_ms,
        )

    format_detected = _detect_format(fmt, name_for_detection, data)

    if format_detected == "pdf":
        text, metadata = _extract_pdf(data)
    elif format_detected == "docx":
        text, metadata = _extract_docx(data)
    elif format_detected == "csv":
        text, metadata = _extract_csv(data, encoding)
    else:
        text, metadata = _extract_txt(data, encoding)

    return {
        "success": True,
        "extracted_text": text,
        "format_detected": format_detected,
        "source": source,
        "sourceLocation": source_location,
        "size": len(data),
        "metadata": metadata,
    }
