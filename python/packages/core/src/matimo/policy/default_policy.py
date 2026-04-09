"""
Default policy engine implementation.
Mirrors: packages/core/src/policy/default-policy.ts
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Protocol, runtime_checkable

from matimo.core.models import PolicyContext, ToolDefinition
from matimo.policy.content_validator import ContentViolation, validate_tool_content
from matimo.policy.risk_classifier import RiskLevel, classify_risk
from matimo.policy.types import (
    PolicyAllowed,
    PolicyConfig,
    PolicyDecision,
    PolicyDenied,
    PolicyPendingApproval,
)

if TYPE_CHECKING:
    pass

logger = logging.getLogger("matimo")


@runtime_checkable
class PolicyEngine(Protocol):
    """
    Policy engine protocol — can_execute / can_create / filter_for_agent.
    Mirrors: PolicyEngine interface in policy/types.ts
    """

    def can_execute(
        self, context: PolicyContext, tool: ToolDefinition
    ) -> PolicyDecision: ...

    def can_create(
        self, context: PolicyContext, tool_def: ToolDefinition
    ) -> PolicyDecision: ...

    def filter_for_agent(
        self, context: PolicyContext, tools: list[ToolDefinition]
    ) -> list[ToolDefinition]: ...


class DefaultPolicyEngine:
    """
    Reference implementation of PolicyEngine.
    Mirrors: DefaultPolicyEngine in default-policy.ts

    Tiers:
      auto              — execute without approval
      approval-required — quarantine until HITL clears
      blocked           — never execute
    """

    def __init__(
        self,
        config: PolicyConfig | None = None,
        trusted_paths: list[str] | None = None,
        untrusted_paths: list[str] | None = None,
    ) -> None:
        self.config = config or PolicyConfig()
        self._trusted_paths = set(trusted_paths or [])
        self._untrusted_paths = set(untrusted_paths or [])

    def update_config(self, config: PolicyConfig) -> None:
        """Replace the active policy configuration."""
        self.config = config

    # ------------------------------------------------------------------
    # can_execute
    # ------------------------------------------------------------------

    def can_execute(
        self, context: PolicyContext, tool: ToolDefinition
    ) -> PolicyDecision:
        """
        Decide whether a tool may execute in the given context.

        Block conditions:
        - Tool is deprecated
        - Tool is in 'draft' status in a production environment without admin role
        - Tool requires explicit approval in production without admin/operator role
        - Policy HITL is enabled and tool risk level is in quarantineRiskLevels
        """
        env = (context.environment or "").lower()
        roles = context.roles or []

        # 1. Deprecated tools are blocked
        if tool.deprecated or tool.status.value == "deprecated":
            return PolicyDenied(
                allowed=False,
                reason=f"Tool '{tool.name}' is deprecated"
                + (f": {tool.deprecation_message}" if tool.deprecation_message else ""),
            )

        # 2. Draft tools blocked in production without admin role
        if tool.status.value == "draft" and _is_production(env) and "admin" not in roles:
            return PolicyDenied(
                allowed=False,
                reason=f"Tool '{tool.name}' is in draft status and cannot be used in production",
            )

        # 3. requires_approval in production without privileged role
        if tool.requires_approval and _is_production(env):
            if not any(r in roles for r in ("admin", "operator")):
                return PolicyDenied(
                    allowed=False,
                    reason=f"Tool '{tool.name}' requires approval and the current context lacks admin/operator role",
                )

        # 4. HITL quarantine for high-risk tools
        if self.config.enable_hitl:
            risk = classify_risk(tool)
            if risk in self.config.quarantine_risk_levels:
                return PolicyPendingApproval(
                    allowed="pending_approval",
                    reason=f"Tool '{tool.name}' has risk level '{risk.value}' and requires human approval",
                    risk_level=risk,
                    tool_name=tool.name,
                )

        return PolicyAllowed()

    # ------------------------------------------------------------------
    # can_create (for agent-created tools)
    # ------------------------------------------------------------------

    def can_create(
        self, context: PolicyContext, tool_def: ToolDefinition
    ) -> PolicyDecision:
        """
        Validate a tool definition that an agent wants to register.
        Runs content validation for untrusted sources.

        Hard blocks (Tier 3):
        - Reserved namespace
        - Function/command execution without policy permission
        - SSRF
        Then risk-classifies and optionally quarantines.
        """
        definition_path = tool_def.definition_path or ""
        is_untrusted = self._is_untrusted_path(definition_path)

        if is_untrusted:
            violations: list[ContentViolation] = validate_tool_content(
                tool_def, self.config
            )
            critical = [v for v in violations if v.severity == RiskLevel.CRITICAL]
            high = [v for v in violations if v.severity == RiskLevel.HIGH]

            if critical:
                msgs = "; ".join(v.message for v in critical)
                return PolicyDenied(
                    allowed=False,
                    reason=f"Tool '{tool_def.name}' failed critical content policy: {msgs}",
                    risk_level=RiskLevel.CRITICAL,
                )

            if high:
                env = (context.environment or "").lower()
                if _is_production(env):
                    msgs = "; ".join(v.message for v in high)
                    return PolicyDenied(
                        allowed=False,
                        reason=f"Tool '{tool_def.name}' failed high-severity content policy in production: {msgs}",
                        risk_level=RiskLevel.HIGH,
                    )

        # Risk-classify and optionally quarantine
        risk = classify_risk(tool_def)
        if self.config.enable_hitl and risk in self.config.quarantine_risk_levels:
            return PolicyPendingApproval(
                allowed="pending_approval",
                reason=f"Tool '{tool_def.name}' (risk: {risk.value}) requires human approval before registration",
                risk_level=risk,
                tool_name=tool_def.name,
            )

        return PolicyAllowed()

    # ------------------------------------------------------------------
    # filter_for_agent
    # ------------------------------------------------------------------

    def filter_for_agent(
        self, context: PolicyContext, tools: list[ToolDefinition]
    ) -> list[ToolDefinition]:
        """
        Return only the tools that pass can_execute() for the given context.
        """
        allowed: list[ToolDefinition] = []
        for tool in tools:
            decision = self.can_execute(context, tool)
            if decision.allowed is True:
                allowed.append(tool)
        return allowed

    # ------------------------------------------------------------------
    # Path classification helpers
    # ------------------------------------------------------------------

    def register_trusted_path(self, path: str) -> None:
        self._trusted_paths.add(path)

    def register_untrusted_path(self, path: str) -> None:
        self._untrusted_paths.add(path)

    def _is_untrusted_path(self, path: str) -> bool:
        if not path:
            return False
        if any(path.startswith(up) for up in self._untrusted_paths):
            return True
        # If explicit trusted paths are set, anything outside them is untrusted
        if self._trusted_paths:
            return not any(path.startswith(tp) for tp in self._trusted_paths)
        return False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_production(environment: str) -> bool:
    return "prod" in environment
