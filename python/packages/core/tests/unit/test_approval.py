"""Unit tests for ApprovalHandler."""
from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest

from matimo.approval.handler import (
    ApprovalHandler,
    ApprovalRequest,
    get_global_approval_handler,
    set_global_approval_handler,
)
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
    def test_requires_approval_flag_is_destructive(self) -> None:
        handler = ApprovalHandler()
        tool = _make_delete_tool()
        assert handler.is_destructive(tool.name, {}) is True

    def test_safe_tool_not_destructive(self) -> None:
        handler = ApprovalHandler()
        tool = _make_safe_tool()
        assert handler.is_destructive(tool.name, {}) is False

    def test_destructive_keyword_in_name(self) -> None:
        handler = ApprovalHandler()
        for keyword in ["delete", "destroy", "drop", "purge", "remove"]:
            assert handler.is_destructive(f"{keyword}_user", {}) is True, (
                f"Expected {keyword} to be destructive"
            )

    def test_destructive_keyword_in_tags(self) -> None:
        handler = ApprovalHandler()
        # The handler checks name — 'delete_something' contains 'delete'
        assert handler.is_destructive("delete_something", {}) is True


def _make_request(tool: ToolDefinition, params: dict | None = None) -> ApprovalRequest:
    """Build an ApprovalRequest from a ToolDefinition."""
    return ApprovalRequest(tool_name=tool.name, description=None, params=params or {})


class TestApprovalHandlerAutoApprove:
    @pytest.mark.asyncio
    async def test_auto_approve_env_bypasses_check(self) -> None:
        tool = _make_delete_tool()
        with patch.dict(os.environ, {"MATIMO_AUTO_APPROVE": "true"}):
            handler = ApprovalHandler()
            approved = await handler.request_approval(_make_request(tool, {"id": "123"}))
        assert approved is True

    @pytest.mark.asyncio
    async def test_safe_tool_always_approved(self) -> None:
        tool = _make_safe_tool()
        with patch.dict(os.environ, {"MATIMO_AUTO_APPROVE": "true"}):
            handler = ApprovalHandler()
            req = _make_request(tool)
            approved = await handler.request_approval(req)
        assert approved is True


class TestApprovalHandlerPatterns:
    @pytest.mark.asyncio
    async def test_approved_pattern_grants_access(self) -> None:
        tool = _make_delete_tool()
        with patch.dict(os.environ, {"MATIMO_APPROVED_PATTERNS": "delete_*"}):
            handler = ApprovalHandler()
            approved = await handler.request_approval(_make_request(tool, {"id": "123"}))
        assert approved is True

    @pytest.mark.asyncio
    async def test_non_matching_pattern_uses_callback(self) -> None:
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
    async def test_hitl_callback_approves(self) -> None:
        handler = ApprovalHandler()
        tool = _make_delete_tool()
        callback = AsyncMock(return_value=True)
        handler.set_approval_callback(callback)
        approved = await handler.request_approval(_make_request(tool, {"id": "x"}))
        assert approved is True
        callback.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_hitl_callback_denies(self) -> None:
        handler = ApprovalHandler()
        tool = _make_delete_tool()
        callback = AsyncMock(return_value=False)
        handler.set_approval_callback(callback)
        approved = await handler.request_approval(_make_request(tool, {"id": "x"}))
        assert approved is False

    @pytest.mark.asyncio
    async def test_no_callback_default_deny(self) -> None:
        handler = ApprovalHandler()
        tool = _make_delete_tool()
        # No callback, no auto_approve, no pattern → default deny
        approved = await handler.request_approval(_make_request(tool, {"id": "x"}))
        assert approved is False


class TestApprovalHandlerAddPattern:
    def test_add_approved_pattern(self) -> None:
        handler = ApprovalHandler()
        handler.add_approved_pattern("read_*")
        assert "read_*" in handler.approved_patterns

    @pytest.mark.asyncio
    async def test_added_pattern_grants_access(self) -> None:
        handler = ApprovalHandler()
        handler.add_approved_pattern("get_*")
        req = ApprovalRequest(tool_name="get_user", description=None, params={})
        approved = await handler.request_approval(req)
        assert approved is True

    @pytest.mark.asyncio
    async def test_non_matching_added_pattern_denies(self) -> None:
        handler = ApprovalHandler()
        handler.add_approved_pattern("get_*")
        req = ApprovalRequest(tool_name="delete_record", description=None, params={})
        approved = await handler.request_approval(req)
        assert approved is False


class TestApprovalHandlerLoadPatterns:
    def test_empty_env_returns_empty_set(self) -> None:
        with patch.dict(os.environ, {"MATIMO_APPROVED_PATTERNS": ""}):
            handler = ApprovalHandler()
            assert handler.approved_patterns == set()

    def test_multiple_patterns_parsed(self) -> None:
        with patch.dict(
            os.environ, {"MATIMO_APPROVED_PATTERNS": "get_*, list_*, read_*"}
        ):
            handler = ApprovalHandler()
            assert handler.approved_patterns == {"get_*", "list_*", "read_*"}

    def test_whitespace_trimmed(self) -> None:
        with patch.dict(
            os.environ, {"MATIMO_APPROVED_PATTERNS": "  get_* , list_*  "}
        ):
            handler = ApprovalHandler()
            assert "get_*" in handler.approved_patterns
            assert "list_*" in handler.approved_patterns


class TestApprovalHandlerGlobal:
    def setup_method(self) -> None:
        """Reset global handler before each test."""
        set_global_approval_handler(ApprovalHandler())

    def test_global_handler_returns_same_instance(self) -> None:
        h1 = get_global_approval_handler()
        h2 = get_global_approval_handler()
        assert h1 is h2

    def test_set_global_handler_replaces_instance(self) -> None:
        custom = ApprovalHandler()
        set_global_approval_handler(custom)
        assert get_global_approval_handler() is custom

    def test_get_global_creates_if_none(self) -> None:
        # Force None by patching the module global
        import matimo.approval.handler as handler_mod

        handler_mod._global_handler = None
        h = get_global_approval_handler()
        assert isinstance(h, ApprovalHandler)
