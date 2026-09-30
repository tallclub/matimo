"""
Policy system types.
Mirrors: packages/core/src/policy/types.ts
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel


class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


GovernanceMode = Literal["secure", "legacy"]
"""Which set of defaults governs tools that don't say otherwise.

- "secure" (default since 0.2.0): HTTP DELETE and ``type: command`` tools need
  per-call approval unless their YAML sets ``requires_approval: false``.
- "legacy": the pre-0.2.0 defaults — only tools that declare
  ``requires_approval: true`` (or hit a destructive keyword) need approval.

Security fixes made in 0.2.0 apply in both modes. Mirrors GovernanceMode in types.ts.
"""


class PolicyTier(StrEnum):
    AUTO = "auto"
    APPROVAL_REQUIRED = "approval-required"
    BLOCKED = "blocked"


# ---------------------------------------------------------------------------
# Policy decisions
# ---------------------------------------------------------------------------


class PolicyAllowed(BaseModel):
    allowed: Literal[True] = True


class PolicyDenied(BaseModel):
    allowed: Literal[False] = False
    reason: str
    risk_level: RiskLevel | None = None


class PolicyPendingApproval(BaseModel):
    allowed: Literal["pending_approval"] = "pending_approval"
    reason: str
    risk_level: RiskLevel
    tool_name: str | None = None


PolicyDecision = PolicyAllowed | PolicyDenied | PolicyPendingApproval


# ---------------------------------------------------------------------------
# HITL (Human-In-The-Loop) types
# ---------------------------------------------------------------------------


class HITLRequest(BaseModel):
    tool_name: str
    risk_level: RiskLevel
    reason: str
    environment: str | None = None
    agent_id: str | None = None
    tool_definition: Any = None


HITLCallback = Callable[[HITLRequest], Awaitable[bool]]


# ---------------------------------------------------------------------------
# Policy configuration
# ---------------------------------------------------------------------------


class PolicyConfig(BaseModel):
    """
    Configuration for DefaultPolicyEngine.
    Mirrors: PolicyConfig in policy/types.ts
    """

    allowed_domains: list[str] | None = None
    allowed_credentials: list[str] | None = None
    allowed_http_methods: list[str] = ["GET", "POST"]
    allow_command_tools: bool = False
    allow_function_tools: bool = False
    protected_namespaces: list[str] = ["matimo_"]
    enable_hitl: bool = False
    quarantine_risk_levels: list[RiskLevel] = [RiskLevel.MEDIUM]
    """Risk levels quarantined (instead of rejected) when an agent *creates* a tool.
    Its least severe entry is also the execution threshold unless hitl_min_risk_level is set."""
    hitl_min_risk_level: RiskLevel | None = None
    """Execution-time quarantine threshold: with enable_hitl, every tool whose execution
    risk is at or above this level is quarantined."""
    approval_ttl_seconds: int | None = None
    """Number of seconds after which an approval expires. None means never expire."""
    governance_mode: GovernanceMode | None = None
    """Default approval behaviour for tools that don't declare requires_approval
    (see GovernanceMode). Matimo.init(governance_mode=) overrides it. None means "secure"."""


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


class ToolCreatedEvent(BaseModel):
    type: Literal["tool:created"] = "tool:created"
    tool_name: str
    source: str | None = None
    risk_level: RiskLevel | None = None
    timestamp: str


class ToolApprovedEvent(BaseModel):
    type: Literal["tool:approved"] = "tool:approved"
    tool_name: str
    approved_by: str | None = None
    hash: str | None = None
    timestamp: str


class ToolRejectedEvent(BaseModel):
    type: Literal["tool:rejected"] = "tool:rejected"
    tool_name: str
    violations: list[str] = []
    timestamp: str


class ToolRevokedEvent(BaseModel):
    type: Literal["tool:revoked"] = "tool:revoked"
    tool_name: str
    reason: str
    timestamp: str


class ToolExecutedEvent(BaseModel):
    """A tool ran to completion. ``success`` is False when it returned {"success": False}."""

    type: Literal["tool:executed"] = "tool:executed"
    tool_name: str
    agent_id: str | None = None
    trace_id: str
    duration_ms: int  # time in the tool itself, after every gate passed
    success: bool
    risk_level: RiskLevel
    timestamp: str


class ToolExecutionFailedEvent(BaseModel):
    """A tool that passed every gate raised instead of returning."""

    type: Literal["tool:execution_failed"] = "tool:execution_failed"
    tool_name: str
    agent_id: str | None = None
    trace_id: str
    duration_ms: int
    risk_level: RiskLevel
    error_code: str
    error: str
    timestamp: str


class ToolExecutionDeniedEvent(BaseModel):
    type: Literal["tool:execution_denied"] = "tool:execution_denied"
    tool_name: str
    reason: str
    agent_id: str | None = None
    timestamp: str


class ToolQuarantinedEvent(BaseModel):
    type: Literal["tool:quarantined"] = "tool:quarantined"
    tool_name: str
    risk_level: RiskLevel
    reason: str
    environment: str | None = None
    timestamp: str


class ToolQuarantineApprovedEvent(BaseModel):
    type: Literal["tool:quarantine_approved"] = "tool:quarantine_approved"
    tool_name: str
    approved_by: str | None = None
    timestamp: str


class ToolQuarantineRejectedEvent(BaseModel):
    type: Literal["tool:quarantine_rejected"] = "tool:quarantine_rejected"
    tool_name: str
    timestamp: str


class PolicyReloadedEvent(BaseModel):
    type: Literal["policy:reloaded"] = "policy:reloaded"
    timestamp: str


class ToolsReloadedEvent(BaseModel):
    type: Literal["tools:reloaded"] = "tools:reloaded"
    loaded: int
    removed: int
    rejected: list[str] = []
    timestamp: str


class SkillCreatedEvent(BaseModel):
    type: Literal["skill:created"] = "skill:created"
    skill_name: str
    source: Literal["user", "catalog"] = "user"
    timestamp: str


MatimoEvent = (
    ToolCreatedEvent
    | ToolApprovedEvent
    | ToolRejectedEvent
    | ToolRevokedEvent
    | ToolExecutedEvent
    | ToolExecutionFailedEvent
    | ToolExecutionDeniedEvent
    | ToolQuarantinedEvent
    | ToolQuarantineApprovedEvent
    | ToolQuarantineRejectedEvent
    | PolicyReloadedEvent
    | ToolsReloadedEvent
    | SkillCreatedEvent
)

MatimoEventHandler = Callable[[MatimoEvent], None]
