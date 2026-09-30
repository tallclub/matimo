"""
Approval handler — human-in-the-loop approval gating for sensitive tools.
Mirrors: packages/core/src/approval/approval-handler.ts
"""
from __future__ import annotations

import fnmatch
import logging
import os
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger("matimo")

# Destructive action keywords that trigger approval prompts
DEFAULT_DESTRUCTIVE_KEYWORDS: list[str] = [
    "CREATE", "DELETE", "DESTROY", "DROP", "ALTER", "TRUNCATE", "UPDATE",
    "INSERT", "UPSERT", "REPLACE", "MERGE", "GRANT", "REVOKE",
    "EDIT", "WRITE", "APPEND", "REMOVE", "PURGE", "RENAME", "SHUTDOWN",
    "EXECUTE", "EXEC",
]


@dataclass
class ApprovalRequest:
    """Represents a pending approval for a tool execution."""

    tool_name: str
    description: str | None
    params: dict[str, Any]


ApprovalCallback = Callable[[ApprovalRequest], Awaitable[bool]]


class ApprovalHandler:
    """
    Manages interactive approval gating for sensitive tool executions.
    Mirrors: ApprovalHandler in approval-handler.ts

    Approval flow:
    1. auto_approve=True (MATIMO_AUTO_APPROVE env) → always approve
    2. tool_name matches an approved pattern → approve
    3. HITL callback set → invoke it and return its decision
    4. Default → deny
    """

    def __init__(self) -> None:
        self.auto_approve: bool = (
            os.environ.get("MATIMO_AUTO_APPROVE", "").lower() == "true"
        )
        self.approved_patterns: set[str] = self._load_approved_patterns()
        self.destructive_keywords: list[str] = list(DEFAULT_DESTRUCTIVE_KEYWORDS)
        self._callback: ApprovalCallback | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def set_approval_callback(self, callback: ApprovalCallback | None) -> None:
        """Wire an async approval callback (e.g., Slack DM, CLI prompt), or clear it."""
        self._callback = callback

    def get_approval_callback(self) -> ApprovalCallback | None:
        """Return the current approval callback (for save/restore patterns)."""
        return self._callback

    def requires_approval(
        self, requires_approval_in_yaml: bool | None, content: str | None = None
    ) -> bool:
        """
        Whether a call needs per-call approval. Mirrors requiresApproval() in
        approval-handler.ts: an explicit YAML `requires_approval: true` always
        does; otherwise the supplied content (SQL, shell command, ...) is
        scanned for destructive keywords.
        """
        if requires_approval_in_yaml is True:
            return True
        if content:
            upper = content.upper()
            return any(kw in upper for kw in self.destructive_keywords)
        return False

    def is_pre_approved(self, tool_name: str) -> bool:
        """True when MATIMO_AUTO_APPROVE is on or the tool matches an approved pattern."""
        return self.auto_approve or self._matches_approved_pattern(tool_name)

    async def request_approval(
        self, request: ApprovalRequest, callback: ApprovalCallback | None = None
    ) -> bool:
        """
        Gate execution on approval.
        Returns True if approved, False if denied.
        `callback` overrides this handler's callback for this request (a Matimo
        instance passes its own `on_approval` here).
        """
        callback = callback if callback is not None else self._callback
        # 1. Hard auto-approve (CI / testing)
        if self.auto_approve:
            logger.debug(
                "Auto-approving tool '%s' (MATIMO_AUTO_APPROVE=true)", request.tool_name
            )
            return True

        # 2. Pattern allowlist
        if self._matches_approved_pattern(request.tool_name):
            logger.debug(
                "Tool '%s' matches approved pattern — skipping approval prompt",
                request.tool_name,
            )
            return True

        # 3. HITL callback
        if callback is not None:
            approved = await callback(request)
            if not approved:
                logger.info(
                    "Approval denied for tool '%s' by callback", request.tool_name
                )
            return approved

        # 4. No callback → default deny
        logger.warning(
            "Approval required for tool '%s' but no callback configured — denying",
            request.tool_name,
        )
        return False

    def is_destructive(self, tool_name: str, params: dict[str, Any]) -> bool:
        """
        Heuristically determine whether a tool invocation is destructive,
        based on keyword scanning of the tool name and string parameter values.
        """
        combined = tool_name.upper()
        for v in params.values():
            if isinstance(v, str):
                combined += " " + v.upper()

        return any(kw in combined for kw in self.destructive_keywords)

    def add_approved_pattern(self, pattern: str) -> None:
        """Add a glob pattern to the pre-approved tool allowlist."""
        self.approved_patterns.add(pattern)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _load_approved_patterns(self) -> set[str]:
        raw = os.environ.get("MATIMO_APPROVED_PATTERNS", "")
        if not raw:
            return set()
        return {p.strip() for p in raw.split(",") if p.strip()}

    def _matches_approved_pattern(self, tool_name: str) -> bool:
        # Case-insensitive on every OS, like matchesPattern() in approval-handler.ts
        return any(
            fnmatch.fnmatchcase(tool_name.lower(), pattern.lower())
            for pattern in self.approved_patterns
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_global_handler: ApprovalHandler | None = None


def get_global_approval_handler() -> ApprovalHandler:
    """Return the global ApprovalHandler, creating one if necessary."""
    global _global_handler
    if _global_handler is None:
        _global_handler = ApprovalHandler()
    return _global_handler


def set_global_approval_handler(handler: ApprovalHandler) -> None:
    """Replace the global approval handler (useful in tests)."""
    global _global_handler
    _global_handler = handler
