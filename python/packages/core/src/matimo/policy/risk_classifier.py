"""
Risk classifier — assigns a RiskLevel to a tool definition.
Mirrors: packages/core/src/policy/risk-classifier.ts
"""
from __future__ import annotations

from matimo.core.models import ToolDefinition
from matimo.policy.types import RiskLevel


def classify_risk(tool: ToolDefinition) -> RiskLevel:
    """
    Assign a risk level based on execution type and HTTP method.

    Rules (matches TypeScript classifyRisk):
      explicit risk field → honours it directly
      function → critical
      command  → high
      http:
        requires_approval → high
        DELETE            → high
        POST / PUT / PATCH → medium
        GET (default)     → low
    """
    # Explicit override declared in the tool YAML takes precedence
    if tool.risk:
        return RiskLevel(tool.risk)

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
