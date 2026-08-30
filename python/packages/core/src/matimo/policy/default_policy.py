"""
Default policy engine implementation.
Mirrors: packages/core/src/policy/default-policy.ts
"""
from __future__ import annotations

import logging
import re
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
    PolicyTier,
)

if TYPE_CHECKING:
    pass

logger = logging.getLogger("matimo")

# ---------------------------------------------------------------------------
# Tier classification (mirrors getTierForTool in default-policy.ts)
# ---------------------------------------------------------------------------

_DEFAULT_PROTECTED_NAMESPACES = ["matimo_"]
_AUTH_KEYWORDS = ("token", "key", "secret", "password", "credential", "auth", "bearer", "api_key")
_PLACEHOLDER_RE = re.compile(r"\{(\w+)\}")
_PRIVATE_HOST_RE = re.compile(
    r"^(localhost|127\.0\.0\.1|::1|169\.254\.|10\.|192\.168\.|"
    r"172\.(1[6-9]|2[0-9]|3[01])\.)"
)


def get_tier_for_tool(
    tool: ToolDefinition, config: PolicyConfig | None = None
) -> PolicyTier:
    """
    Assign a policy tier to a tool definition.
    Mirrors: getTierForTool() in packages/core/src/policy/default-policy.ts

    Tiers:
      blocked           — never execute (function/command, reserved namespace, SSRF)
      approval-required — POST/PUT/PATCH/DELETE HTTP or has auth placeholders
      auto              — low-risk read-only GET with no auth required
    """
    protected = (
        config.protected_namespaces
        if config is not None and config.protected_namespaces
        else _DEFAULT_PROTECTED_NAMESPACES
    )

    # TIER 3 — BLOCKED
    if any(tool.name.startswith(ns) for ns in protected):
        return PolicyTier.BLOCKED
    exec_type = tool.execution.type
    if exec_type in ("function", "command"):
        return PolicyTier.BLOCKED
    if exec_type == "http":
        url: str = getattr(tool.execution, "url", "") or ""
        if _is_blocked_url(url):
            return PolicyTier.BLOCKED

    # TIER 2 — APPROVAL REQUIRED
    if exec_type == "http":
        method = (getattr(tool.execution, "method", None) or "GET").upper()
        if method != "GET":
            return PolicyTier.APPROVAL_REQUIRED
        if _has_auth_placeholders(tool):
            return PolicyTier.APPROVAL_REQUIRED

    # TIER 1 — AUTO (low-risk read-only)
    return PolicyTier.AUTO


def _is_blocked_url(url: str) -> bool:
    """Return True if the URL targets a private/localhost address (SSRF defence)."""
    if not url:
        return False
    try:
        from urllib.parse import urlparse

        hostname = (urlparse(url).hostname or "").lower()
        return bool(_PRIVATE_HOST_RE.match(hostname))
    except Exception:
        return False


def _has_auth_placeholders(tool: ToolDefinition) -> bool:
    """Return True when execution config contains auth-related {placeholder} names."""
    parts: list[str] = []
    exec_cfg = tool.execution
    _collect_str(getattr(exec_cfg, "url", None), parts)
    _collect_str(getattr(exec_cfg, "headers", None), parts)
    _collect_str(getattr(exec_cfg, "body", None), parts)
    _collect_str(getattr(exec_cfg, "query_params", None), parts)
    for text in parts:
        for m in _PLACEHOLDER_RE.finditer(text):
            name = m.group(1).lower()
            if any(kw in name for kw in _AUTH_KEYWORDS):
                return True
    return False


def _collect_str(obj: object, out: list[str]) -> None:
    if obj is None:
        return
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            _collect_str(v, out)
    elif isinstance(obj, list):
        for item in obj:
            _collect_str(item, out)


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

    # can_reload is intentionally NOT declared here — it's optional so
    # third-party PolicyEngine implementations aren't broken by this Protocol.
    # Call sites (Matimo.reload()) check `hasattr(engine, "can_reload")` and
    # fall back to `can_create` when it's absent. DefaultPolicyEngine below
    # implements it.


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
        return self._evaluate_untrusted_tool(context, tool_def, skip_rules=frozenset())

    def can_reload(
        self, context: PolicyContext, tool_def: ToolDefinition
    ) -> PolicyDecision:
        """
        Check whether an already-legitimately-approved tool may be reloaded.
        Same evaluation as `can_create`, except the two rules whose sole
        purpose is "a *new proposal* cannot self-declare approval/non-draft
        status" are skipped — a real approval via matimo_approve_tool
        legitimately changes those fields. All other content rules still apply.
        """
        return self._evaluate_untrusted_tool(
            context, tool_def, skip_rules=frozenset({"forced-approval", "forced-draft-status"})
        )

    def _evaluate_untrusted_tool(
        self,
        context: PolicyContext,
        tool_def: ToolDefinition,
        skip_rules: frozenset[str],
    ) -> PolicyDecision:
        definition_path = tool_def.definition_path or ""
        is_untrusted = self._is_untrusted_path(definition_path)

        if is_untrusted:
            violations: list[ContentViolation] = validate_tool_content(
                tool_def, self.config, skip_rules=skip_rules
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

            # Remaining (medium/low) violations — e.g. forced-draft-status, which fires
            # when a tool's status no longer matches 'draft' without a legitimate approval
            # (skip_rules only suppresses it for already-approved reloads). Previously
            # silently ignored here, which meant a hand-edited `status: approved` that
            # bypassed matimo_approve_tool would pass can_create() unconditionally — the
            # anti-self-approval hole this whole check exists to close. Deny (or quarantine
            # when HITL is configured for the risk level) instead of silently allowing.
            remaining = [v for v in violations if v.severity not in (RiskLevel.CRITICAL, RiskLevel.HIGH)]
            if remaining:
                most_severe = (
                    RiskLevel.MEDIUM
                    if any(v.severity == RiskLevel.MEDIUM for v in remaining)
                    else RiskLevel.LOW
                )
                msgs = "; ".join(v.message for v in remaining)
                if self.config.enable_hitl and most_severe in self.config.quarantine_risk_levels:
                    return PolicyPendingApproval(
                        allowed="pending_approval",
                        reason=f"Tool '{tool_def.name}' failed content policy: {msgs}",
                        risk_level=most_severe,
                        tool_name=tool_def.name,
                    )
                return PolicyDenied(
                    allowed=False,
                    reason=f"Tool '{tool_def.name}' failed content policy: {msgs}",
                    risk_level=most_severe,
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
