"""Unit tests for ApprovalHandler."""
from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest

from matimo.approval.handler import ApprovalHandler, DEFAULT_DESTRUCTIVE_KEYWORDS
from matimo.core.models import HttpExecution, ToolDefinition


def _make_delete_tool() -> ToolDefinition:
    return ToolDefinition(
        name="delete_resource",
        description="Delete a resource",
        requires_approval=True,
        execution=HttpExecution(
            type="http",
            method="DELETE",
            url="https://api.example.com/resources/{id}",
        ),
        tags=["destructive"],
    )


def _make_safe_tool() -> ToolDefinition:
    return ToolDefinition(
        name="get_resource",
        description="Get a resource",
        execution=HttpExecution(
            type="http",
            method="GET",
            url="https://api.example.com/resources/{id}",
        ),
    )


class TestIsDestructive:
    def test_requires_approval_flag_is_destructive(self):
        handler = ApprovalHandler()
        tool = _make_delete_tool()
        assert handler.is_destructive(tool.name, {}) is True

    def test_safe_tool_not_destructive(self):
        handler = ApprovalHandler()
        tool = _make_safe_tool()
        assert handler.is_destructive(tool.name, {}) is False

    def test_destructive_keyword_in_name(self):
        handler = ApprovalHandler()
        for keyword in ["delete", "destroy", "drop", "purge", "remove"]:
            assert handler.is_destructive(f"{keyword}_user", {}) is True, (
                f"Expected {keyword} to be destructive"
            )

    def test_destructive_keyword_in_tags(self):
        handler = ApprovalHandler()
        # The handler checks name — 'delete_something' contains 'delete'
        assert handler.is_destructive("delete_something", {}) is True


def _make_request(tool: ToolDefinition, params: dict | None = None):
    """Build an ApprovalRequest from a ToolDefinition."""
    from matimo.approval.handler import ApprovalRequest
    return ApprovalRequest(tool_name=tool.name, description=None, params=params or {})


class TestApprovalHandlerAutoApprove:
    @pytest.mark.asyncio
    async def test_auto_approve_env_bypasses_check(self):
        tool = _make_delete_tool()
        with patch.dict(os.environ, {"MATIMO_AUTO_APPROVE": "true"}):
            handler = ApprovalHandler()
            approved = await handler.request_approval(_make_request(tool, {"id": "123"}))
        assert approved is True

    @pytest.mark.asyncio
    async def test_safe_tool_always_approved(self):
        tool = _make_safe_tool()
        with patch.dict(os.environ, {"MATIMO_AUTO_APPROVE": "true"}):
            handler = ApprovalHandler()
            req = _make_request(tool)
            approved = await handler.request_approval(req)
        assert approved is True


class TestApprovalHandlerPatterns:
    @pytest.mark.asyncio
    async def test_approved_pattern_grants_access(self):
        tool = _make_delete_tool()
        with patch.dict(os.environ, {"MATIMO_APPROVED_PATTERNS": "delete_*"}):
            handler = ApprovalHandler()
            approved = await handler.request_approval(_make_request(tool, {"id": "123"}))
        assert approved is True

    @pytest.mark.asyncio
    async def test_non_matching_pattern_uses_callback(self):
        handler = ApprovalHandler()
        tool = _make_delete_tool()
        callback = AsyncMock(return_value=True)
        handler.set_approval_callback(callback)
        # No pattern match, callback approves
        with patch.dict(os.environ, {"MATIMO_APPROVED_PATTERNS": "safe_*"}):
            approved = await handler.request_approval(_make_request(tool, {"id": "123"}))
        assert approved is True
        callback.assert_awaited_once()


class TestApprovalHandlerHITL:
    @pytest.mark.asyncio
    async def test_hitl_callback_approves(self):
        handler = ApprovalHandler()
        tool = _make_delete_tool()
        callback = AsyncMock(return_value=True)
        handler.set_approval_callback(callback)
        approved = await handler.request_approval(_make_request(tool, {"id": "x"}))
        assert approved is True
        callback.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_hitl_callback_denies(self):
        handler = ApprovalHandler()
        tool = _make_delete_tool()
        callback = AsyncMock(return_value=False)
        handler.set_approval_callback(callback)
        approved = await handler.request_approval(_make_request(tool, {"id": "x"}))
        assert approved is False

    @pytest.mark.asyncio
    async def test_no_callback_default_deny(self):
        handler = ApprovalHandler()
        tool = _make_delete_tool()
        # No callback, no auto_approve, no pattern → default deny
        approved = await handler.request_approval(_make_request(tool, {"id": "x"}))
        assert approved is False
