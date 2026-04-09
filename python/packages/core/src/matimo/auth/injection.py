"""
Auth parameter injection.
Mirrors: MatimoInstance.injectAuthParameters() in matimo-instance.ts
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any

from matimo.core.models import ToolDefinition

logger = logging.getLogger("matimo")

# Patterns that indicate a parameter placeholder is auth-related
_AUTH_PATTERNS = (
    "token", "key", "secret", "password", "credential",
    "auth", "bearer", "api_key",
)

_PLACEHOLDER_RE = re.compile(r"\{([^}]+)\}")


def inject_auth_parameters(
    tool: ToolDefinition,
    params: dict[str, Any],
    credentials: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Scan all placeholders in the tool's execution config (URL, headers, body,
    query_params). For any placeholder that looks auth-related and has no value
    in params, attempt to resolve it from:
      1. per-call credentials dict
      2. process environment (MATIMO_{TOOL_NAME}_{KEY} or just {KEY})

    SECURITY: injected values are never logged.

    Returns a new params dict with the resolved auth values merged in.
    """
    placeholders = extract_parameter_placeholders(tool)
    result = dict(params)

    for placeholder in placeholders:
        # Already supplied by the caller
        if placeholder in result:
            continue

        lower = placeholder.lower()
        is_auth = any(pattern in lower for pattern in _AUTH_PATTERNS)
        if not is_auth:
            continue

        # Attempt resolution
        value = _resolve_auth_value(tool.name, placeholder, credentials)
        if value is not None:
            result[placeholder] = value
            logger.debug(
                "Injected auth parameter '%s' for tool '%s'",
                placeholder, tool.name
            )

    return result


def extract_parameter_placeholders(tool: ToolDefinition) -> set[str]:
    """
    Extract all {placeholder} names from the tool's execution config
    (url, headers, body, query_params, params, args).
    Mirrors: extractParameterPlaceholders() in matimo-instance.ts
    """
    placeholders: set[str] = set()
    exec_cfg = tool.execution
    exec_type = exec_cfg.type

    if exec_type == "http":
        _scan_string(exec_cfg.url, placeholders)  # type: ignore[attr-defined]
        _scan_object(exec_cfg.headers, placeholders)  # type: ignore[attr-defined]
        _scan_object(exec_cfg.body, placeholders)  # type: ignore[attr-defined]
        _scan_object(exec_cfg.query_params, placeholders)  # type: ignore[attr-defined]
        _scan_object(exec_cfg.params, placeholders)  # type: ignore[attr-defined]

    elif exec_type == "command":
        _scan_string(exec_cfg.command, placeholders)  # type: ignore[attr-defined]
        for arg in exec_cfg.args or []:  # type: ignore[attr-defined]
            _scan_string(arg, placeholders)

    elif exec_type == "function":
        # Function tools may have params passed directly — nothing to scan
        pass

    return placeholders


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _resolve_auth_value(
    tool_name: str,
    placeholder: str,
    credentials: dict[str, str] | None,
) -> str | None:
    """
    Try to resolve an auth placeholder in priority order:
    1. per-call credentials
    2. env MATIMO_{TOOL_NAME_UPPER}_{PLACEHOLDER_UPPER}
    3. env {PLACEHOLDER} directly
    """
    if credentials and placeholder in credentials:
        return credentials[placeholder]

    # e.g. MATIMO_SLACK_SLACK_BOT_TOKEN
    env_key_prefixed = f"MATIMO_{tool_name.upper()}_{placeholder.upper()}"
    val = os.environ.get(env_key_prefixed)
    if val:
        return val

    # env directly (e.g. SLACK_BOT_TOKEN)
    return os.environ.get(placeholder)


def _scan_string(value: str | None, out: set[str]) -> None:
    if value is None:
        return
    for m in _PLACEHOLDER_RE.finditer(value):
        out.add(m.group(1))


def _scan_object(obj: object, out: set[str]) -> None:
    if obj is None:
        return
    if isinstance(obj, str):
        _scan_string(obj, out)
    elif isinstance(obj, dict):
        for v in obj.values():
            _scan_object(v, out)
    elif isinstance(obj, list):
        for item in obj:
            _scan_object(item, out)
