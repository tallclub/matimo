"""
Risk classifier — assigns a RiskLevel to a tool definition.
Mirrors: packages/core/src/policy/risk-classifier.ts
"""
from __future__ import annotations

from matimo.core.models import ToolDefinition
from matimo.policy.types import RiskLevel

_SEVERITY_RANK: dict[RiskLevel, int] = {
    RiskLevel.LOW: 0,
    RiskLevel.MEDIUM: 1,
    RiskLevel.HIGH: 2,
    RiskLevel.CRITICAL: 3,
}


def max_risk(a: RiskLevel, b: RiskLevel) -> RiskLevel:
    """
    Rank two risk levels and return the more severe one. Used so a tool's
    self-declared `risk` can only raise the automatically computed level,
    never lower it — a `type: function` tool declaring `risk: low` must
    still classify as `critical`.
    """
    return a if _SEVERITY_RANK[a] >= _SEVERITY_RANK[b] else b


def _classify_automatic_risk(tool: ToolDefinition) -> RiskLevel:
    """
    Compute risk purely from execution type, HTTP method, and approval
    requirement — ignores any self-declared `risk` field.

    Rules (matches TypeScript classifyAutomaticRisk):
      function → critical
      command  → high
      http:
        requires_approval → high
        DELETE            → high
        POST / PUT / PATCH → medium
        GET (default)     → low
    """
    if tool.execution.type == "function":
        return RiskLevel.CRITICAL

    if tool.execution.type == "command":
        return RiskLevel.HIGH

    if tool.execution.type == "http":
        if tool.requires_approval:
            return RiskLevel.HIGH
        method = tool.execution.method.upper()
        if method == "DELETE":
            return RiskLevel.HIGH
        if method in ("POST", "PUT", "PATCH"):
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    return RiskLevel.HIGH  # unknown execution type


def classify_risk(tool: ToolDefinition) -> RiskLevel:
    """
    Assign a risk level based on execution type and HTTP method.

    A self-declared `risk` field can only raise the automatically computed
    risk level, never lower it — a `type: function` tool cannot downgrade
    itself from `critical` to `low` by declaring `risk: low`.
    """
    automatic_risk = _classify_automatic_risk(tool)
    if tool.risk:
        return max_risk(automatic_risk, RiskLevel(tool.risk))
    return automatic_risk


def classify_execution_risk(tool: ToolDefinition) -> RiskLevel:
    """
    Classify the risk of *running* an already-registered tool.
    Mirrors: classifyExecutionRisk() in policy/risk-classifier.ts

    Identical to ``classify_risk`` except for ``type: function`` tools, which
    ``classify_risk`` always rates critical because an agent-proposed code tool
    is the worst case at creation time. Every function tool that reaches the
    registry is developer-authored (can_create/can_reload reject agent-created
    function tools unconditionally), so its declared ``risk`` describes what
    the call actually does. An undeclared function tool is treated as high,
    and ``requires_approval`` raises it to at least high.
    """
    if tool.execution.type != "function":
        return classify_risk(tool)
    declared = RiskLevel(tool.risk) if tool.risk else RiskLevel.HIGH
    return max_risk(declared, RiskLevel.HIGH) if tool.requires_approval else declared


def meets_risk_threshold(risk: RiskLevel, threshold: RiskLevel) -> bool:
    """True when ``risk`` is at or above ``threshold`` (low < medium < high < critical)."""
    return _SEVERITY_RANK[risk] >= _SEVERITY_RANK[threshold]


def lowest_risk(levels: list[RiskLevel]) -> RiskLevel | None:
    """The least severe level in ``levels``, or None when the list is empty."""
    return min(levels, key=lambda level: _SEVERITY_RANK[level], default=None)
