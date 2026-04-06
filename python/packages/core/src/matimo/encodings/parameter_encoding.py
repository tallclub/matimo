"""
Parameter encoding — converts parameter groups into encoded string values.
Mirrors: packages/core/src/encodings/parameter-encoding.ts

Supported encoding types:
  mime_rfc2822_base64url  — Gmail API: RFC 2822 MIME message → base64url
  json_compact            — JSON.dumps compact equivalent
  url_encoded             — application/x-www-form-urlencoded
"""
from __future__ import annotations

import base64
import json
from typing import Any
from urllib.parse import urlencode

from matimo.errors import ErrorCode, MatimoError


def apply_parameter_encodings(
    params: dict[str, Any],
    encodings: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Apply a list of encoding configs to params, returning a new dict.
    Source parameters are consumed (removed) and replace with the target key.

    Args:
        params:    Original parameter dict.
        encodings: List of ParameterEncodingConfig-compatible dicts.

    Returns:
        New dict with encoded values written to target keys.
    """
    result = dict(params)

    for enc in encodings:
        source_keys: list[str] = enc.get("source", [])
        target_key: str = enc.get("target", "")
        encoding: str = enc.get("encoding", "")
        options: dict[str, Any] = enc.get("options") or {}

        # Gather source values
        source_values: dict[str, Any] = {k: result[k] for k in source_keys if k in result}

        encoded = _encode(source_values, encoding, options)

        # Remove source keys, write target
        for k in source_keys:
            result.pop(k, None)
        result[target_key] = encoded

    return result


# ---------------------------------------------------------------------------
# Internal dispatchers
# ---------------------------------------------------------------------------


def _encode(values: dict[str, Any], encoding: str, options: dict[str, Any]) -> str:
    if encoding == "mime_rfc2822_base64url":
        return _encode_mime_rfc2822(values)
    if encoding == "json_compact":
        return _encode_json_compact(values)
    if encoding == "url_encoded":
        return _encode_url_encoded(values)
    raise MatimoError(
        f"Unknown parameter encoding type: '{encoding}'",
        ErrorCode.INVALID_PARAMETER,
        {"encoding": encoding, "supported": ["mime_rfc2822_base64url", "json_compact", "url_encoded"]},
    )


def _encode_mime_rfc2822(values: dict[str, Any]) -> str:
    """
    Build an RFC 2822 MIME email and base64url-encode it.
    Used by the Gmail API 'send' tool.

    Expected keys: to, subject, body (plain text).
    """
    to = values.get("to", "")
    subject = values.get("subject", "")
    body = values.get("body", "")
    from_addr = values.get("from", "")
    cc = values.get("cc", "")
    bcc = values.get("bcc", "")

    lines: list[str] = []
    if from_addr:
        lines.append(f"From: {from_addr}")
    if to:
        lines.append(f"To: {to}")
    if cc:
        lines.append(f"Cc: {cc}")
    if bcc:
        lines.append(f"Bcc: {bcc}")
    lines.append(f"Subject: {subject}")
    lines.append("MIME-Version: 1.0")
    lines.append("Content-Type: text/plain; charset=utf-8")
    lines.append("Content-Transfer-Encoding: 7bit")
    lines.append("")
    lines.append(str(body))

    mime_bytes = "\r\n".join(lines).encode("utf-8")
    return base64.urlsafe_b64encode(mime_bytes).decode("ascii").rstrip("=")


def _encode_json_compact(values: dict[str, Any]) -> str:
    """JSON.stringify equivalent — compact, no whitespace."""
    if len(values) == 1:
        # Single source value — encode the value directly (not the wrapper dict)
        return json.dumps(next(iter(values.values())), separators=(",", ":"))
    return json.dumps(values, separators=(",", ":"))


def _encode_url_encoded(values: dict[str, Any]) -> str:
    """application/x-www-form-urlencoded encoding."""
    return urlencode({k: str(v) for k, v in values.items()})
