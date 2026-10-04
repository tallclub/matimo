"""
Response Size Guardrail
Mirrors: packages/core/src/core/response-size-guardrail.ts

Caps the size of a tool's serialized result before it reaches the caller
(direct SDK, LangChain, CrewAI, or MCP) — a tool result with a generous
page size (e.g. a Slack channel history or a HubSpot contact list) would
otherwise be returned unbounded, silently consuming the calling agent's
entire context budget.

Precedence: per-tool ``output_schema.max_response_size`` (YAML) overrides
the instance-level ``default_max_response_size`` option, which overrides
the built-in ``DEFAULT_MAX_RESPONSE_SIZE_BYTES`` fallback.
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from matimo.core.models import ToolDefinition

# Fallback cap (bytes, UTF-8) applied to every tool that doesn't declare its own.
DEFAULT_MAX_RESPONSE_SIZE_BYTES = 262_144  # 256 KB


def apply_response_size_guardrail(
    tool: ToolDefinition,
    result: Any,  # noqa: ANN401 — a tool result is arbitrary JSON (dict/list/str/number)
    instance_default: int | None = None,
) -> Any:  # noqa: ANN401 — same as `result`, above
    """Apply the response-size guardrail to a tool's raw execution result.

    Returns the result unchanged when it already fits within the effective
    limit (the common case — this is a cheap size check, not a deep clone).
    """
    output_schema = getattr(tool, "output_schema", None)
    per_tool_limit = getattr(output_schema, "max_response_size", None) if output_schema else None
    limit = per_tool_limit or instance_default or DEFAULT_MAX_RESPONSE_SIZE_BYTES

    if _byte_size_of(result) <= limit:
        return result

    value, truncated = _truncate_value(result, limit)

    # Decorate only the outermost object, exactly once, regardless of how
    # deep the actual truncation happened — list/string fields already
    # carry their own inline "...truncated, N of M ..." marker.
    if truncated and isinstance(value, dict):
        return {**value, "_truncated": True}
    return value


def _byte_size_of(value: Any) -> int:  # noqa: ANN401 — arbitrary JSON value
    """Best-effort UTF-8 byte size of a value's JSON serialization.

    Non-serializable values (e.g. circular refs) are treated as free rather
    than raising.
    """
    try:
        return len(json.dumps(value, default=str).encode("utf-8"))
    except (TypeError, ValueError):
        return 0


def _truncate_value(value: Any, budget_bytes: int) -> tuple[Any, bool]:  # noqa: ANN401 — arbitrary JSON value
    if _byte_size_of(value) <= budget_bytes:
        return value, False
    if isinstance(value, list):
        return _truncate_array(value, budget_bytes)
    if isinstance(value, str):
        return _truncate_string(value, budget_bytes)
    if isinstance(value, dict):
        return _truncate_object(value, budget_bytes)
    # A scalar (number/bool/None) exceeding the budget can't happen in
    # practice — leave it untouched rather than fabricating a truncated scalar.
    return value, False


def _truncate_array(arr: list[Any], budget_bytes: int) -> tuple[list[Any], bool]:
    if not arr:
        return arr, False

    # Estimate average item size from a sample rather than serializing the
    # whole array — keeps this O(sample) instead of O(items) on huge arrays.
    sample_size = min(len(arr), 20)
    sample_bytes = sum(_byte_size_of(arr[i]) for i in range(sample_size))
    avg_item_bytes = max(1, sample_bytes / sample_size)
    marker_reserve = 96  # rough overhead for the marker string + surrounding JSON punctuation

    n = min(len(arr), max(0, int((budget_bytes - marker_reserve) / avg_item_bytes)))
    sliced = arr[:n]

    # Re-measure once and shrink proportionally if the estimate overshot —
    # bounded to a single extra pass rather than iterating item-by-item.
    actual_bytes = _byte_size_of(sliced)
    if actual_bytes > budget_bytes and n > 0:
        ratio = budget_bytes / actual_bytes
        n = max(0, int(n * ratio))
        sliced = arr[:n]

    marker = f"...truncated, {n} of {len(arr)} items shown"
    return [*sliced, marker], True


def _truncate_string(s: str, budget_bytes: int) -> tuple[str, bool]:
    total_length = len(s)

    def marker_for(shown: int) -> str:
        return f"...truncated, {shown} of {total_length} characters shown"

    reserve = len(marker_for(total_length).encode("utf-8"))
    content_budget = max(0, budget_bytes - reserve)

    # Slice on the raw UTF-8 bytes then decode back with errors="ignore" so a
    # multi-byte character split by the cut is dropped rather than raising or
    # emitting invalid UTF-8.
    buf = s.encode("utf-8")
    kept = buf[:content_budget].decode("utf-8", errors="ignore")

    return kept + marker_for(len(kept)), True


def _truncate_object(obj: dict[str, Any], budget_bytes: int) -> tuple[dict[str, Any], bool]:
    entries = list(obj.items())
    # Smallest-first: small metadata fields (e.g. an HTTP envelope's
    # `statusCode`/`headers`) survive intact, and whatever budget remains
    # goes to the one field that's actually large (typically `data`).
    sized_ascending = sorted(
        ((key, value, _byte_size_of(value)) for key, value in entries), key=lambda item: item[2]
    )

    truncated_by_key: dict[str, Any] = {}
    remaining = budget_bytes
    any_truncated = False

    for key, value, size in sized_ascending:
        if size <= remaining:
            truncated_by_key[key] = value
            remaining -= size
        else:
            truncated_value, truncated = _truncate_value(value, max(remaining, 0))
            truncated_by_key[key] = truncated_value
            any_truncated = any_truncated or truncated
            remaining = 0

    # Restore original key order for predictability.
    ordered = {key: truncated_by_key[key] for key, _ in entries}

    return ordered, any_truncated
