"""
Policy system types.
Mirrors: packages/core/src/policy/types.ts
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Awaitable, Callable, Literal, Union

from pydantic import BaseModel


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class PolicyTier(str, Enum):
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


PolicyDecision = Union[PolicyAllowed, PolicyDenied, PolicyPendingApproval]


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
    type: Literal["tool:executed"] = "tool:executed"
    tool_name: str
    agent_id: str | None = None
    duration: float
    success: bool
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


MatimoEvent = Union[
    ToolCreatedEvent,
    ToolApprovedEvent,
    ToolRejectedEvent,
    ToolRevokedEvent,
    ToolExecutedEvent,
    ToolExecutionDeniedEvent,
    ToolQuarantinedEvent,
    ToolQuarantineApprovedEvent,
    ToolQuarantineRejectedEvent,
    PolicyReloadedEvent,
    ToolsReloadedEvent,
]

MatimoEventHandler = Callable[[MatimoEvent], None]
