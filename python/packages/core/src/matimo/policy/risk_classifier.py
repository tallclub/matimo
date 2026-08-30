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
    exec_type = tool.execution.type

    if exec_type == "function":
        return RiskLevel.CRITICAL

    if exec_type == "command":
        return RiskLevel.HIGH

    if exec_type == "http":
        if tool.requires_approval:
            return RiskLevel.HIGH
        method = tool.execution.method.upper()  # type: ignore[attr-defined]
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
