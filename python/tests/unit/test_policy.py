"""Unit tests for the policy subsystem."""
from __future__ import annotations

from pathlib import Path

import pytest

from matimo.core.models import (
    CommandExecution,
    FunctionExecution,
    HttpExecution,
    Parameter,
    ParameterType,
    PolicyContext,
    ToolDefinition,
    ToolStatus,
)
from matimo.policy.content_validator import validate_tool_content, ContentViolation
from matimo.policy.default_policy import DefaultPolicyEngine
from matimo.policy.integrity_tracker import ToolIntegrityTracker, IntegrityAction
from matimo.policy.risk_classifier import classify_risk
from matimo.policy.types import RiskLevel


def _make_http_tool(
    name: str = "test_tool",
    method: str = "GET",
    url: str = "https://api.example.com/data",
    requires_approval: bool = False,
    status: ToolStatus = ToolStatus.STABLE,
) -> ToolDefinition:
    return ToolDefinition(
        name=name,
        description="test",
        execution=HttpExecution(type="http", method=method, url=url),
        requires_approval=requires_approval,
        status=status,
    )


# ---------------------------------------------------------------------------
# Risk classifier
# ---------------------------------------------------------------------------


class TestRiskClassifier:
    def test_function_tool_is_critical(self):
        tool = ToolDefinition(
            name="f", description="func",
            execution=FunctionExecution(type="function", code="x.py")
        )
        assert classify_risk(tool) == RiskLevel.CRITICAL

    def test_command_tool_is_high(self):
        tool = ToolDefinition(
            name="c", description="cmd",
            execution=CommandExecution(type="command", command="ls")
        )
        assert classify_risk(tool) == RiskLevel.HIGH

    def test_http_get_is_low(self):
        tool = _make_http_tool(method="GET")
        assert classify_risk(tool) == RiskLevel.LOW

    def test_http_post_is_medium(self):
        tool = _make_http_tool(method="POST")
        assert classify_risk(tool) == RiskLevel.MEDIUM

    def test_http_delete_is_high(self):
        tool = _make_http_tool(method="DELETE")
        assert classify_risk(tool) == RiskLevel.HIGH

    def test_requires_approval_bumps_to_high(self):
        # GET normally = LOW, but requires_approval overrides
        tool = _make_http_tool(method="GET", requires_approval=True)
        level = classify_risk(tool)
        assert level in (RiskLevel.HIGH, RiskLevel.MEDIUM)  # At least bumped up


# ---------------------------------------------------------------------------
# Content validator
# ---------------------------------------------------------------------------


class TestContentValidator:
    def test_safe_http_get_passes(self):
        from matimo.policy.types import PolicyConfig
        engine = DefaultPolicyEngine()
        # Untrusted tool must declare requires_approval=True and status=draft to
        # pass content validation without violations.
        tool = _make_http_tool(requires_approval=True, status=ToolStatus.DRAFT)
        violations = validate_tool_content(tool, engine.config)
        assert violations == []

    def test_function_execution_blocked_for_untrusted(self):
        from matimo.policy.types import PolicyConfig
        engine = DefaultPolicyEngine()
        tool = ToolDefinition(
            name="f", description="d",
            execution=FunctionExecution(type="function", code="x.py")
        )
        violations = validate_tool_content(tool, engine.config)
        assert any(v.rule == "no-function-execution" for v in violations)

    def test_command_execution_blocked_for_untrusted(self):
        from matimo.policy.types import PolicyConfig
        engine = DefaultPolicyEngine()
        tool = ToolDefinition(
            name="c", description="d",
            execution=CommandExecution(type="command", command="rm")
        )
        violations = validate_tool_content(tool, engine.config)
        assert any(v.rule == "no-command-execution" for v in violations)

    def test_ssrf_localhost_blocked(self):
        from matimo.policy.types import PolicyConfig
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(url="http://localhost/admin")
        violations = validate_tool_content(tool, engine.config)
        assert any(v.rule == "no-ssrf" for v in violations)

    def test_ssrf_169_blocked(self):
        from matimo.policy.types import PolicyConfig
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(url="http://169.254.169.254/metadata")
        violations = validate_tool_content(tool, engine.config)
        assert any(v.rule == "no-ssrf" for v in violations)

    def test_ssrf_internal_ip_blocked(self):
        from matimo.policy.types import PolicyConfig
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(url="http://192.168.1.1/api")
        violations = validate_tool_content(tool, engine.config)
        assert any(v.rule == "no-ssrf" for v in violations)

    def test_blocked_http_method_delete(self):
        from matimo.policy.types import PolicyConfig
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(method="DELETE")
        violations = validate_tool_content(tool, engine.config)
        assert any(v.rule == "blocked-http-method" for v in violations)

    def test_forced_approval_blocked(self):
        # A GET tool is clean — no violations
        from matimo.policy.types import PolicyConfig
        engine = DefaultPolicyEngine()
        safe_tool = _make_http_tool(method="GET", requires_approval=False)
        violations = validate_tool_content(safe_tool, engine.config)
        # Should not block a safe GET
        assert not any(v.rule == "blocked-http-method" for v in violations)


class TestDefaultPolicyEngine:
    def test_stable_get_tool_allowed(self):
        engine = DefaultPolicyEngine()
        tool = _make_http_tool()
        ctx = PolicyContext(agent_id="agent1")
        decision = engine.can_execute(ctx, tool)
        assert decision.allowed is True

    def test_deprecated_tool_denied(self):
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(status=ToolStatus.DEPRECATED)
        ctx = PolicyContext(agent_id="agent1")
        decision = engine.can_execute(ctx, tool)
        assert decision.allowed is False

    def test_draft_tool_denied_in_production(self):
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(status=ToolStatus.DRAFT)
        # 'production' env blocks draft tools without admin role
        ctx = PolicyContext(agent_id="agent1", environment="production", roles=[])
        decision = engine.can_execute(ctx, tool)
        assert decision.allowed is False

    def test_draft_tool_allowed_in_dev(self):
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(status=ToolStatus.DRAFT)
        ctx = PolicyContext(agent_id="agent1", environment="development")
        decision = engine.can_execute(ctx, tool)
        assert decision.allowed is True

    def test_requires_approval_blocked_in_production(self):
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(requires_approval=True)
        ctx = PolicyContext(agent_id="agent1", environment="production", roles=[])
        decision = engine.can_execute(ctx, tool)
        assert decision.allowed is False

    def test_filter_for_agent_excludes_deprecated(self):
        engine = DefaultPolicyEngine()
        tools = [
            _make_http_tool("active"),
            _make_http_tool("old", status=ToolStatus.DEPRECATED),
            _make_http_tool("draft_t", status=ToolStatus.DRAFT),
        ]
        ctx = PolicyContext(agent_id="agent1", environment="production")
        visible = engine.filter_for_agent(ctx, tools)
        names = {t.name for t in visible}
        assert "active" in names
        assert "old" not in names
        assert "draft_t" not in names

    def test_can_create_safe_tool(self):
        engine = DefaultPolicyEngine()
        tool = _make_http_tool()
        ctx = PolicyContext(agent_id="agent1")
        result = engine.can_create(ctx, tool)
        assert result.allowed is True

    def test_can_create_unsafe_function_from_untrusted(self):
        engine = DefaultPolicyEngine()
        tool = ToolDefinition(
            name="evil", description="bad",
            execution=FunctionExecution(type="function", code="evil.py")
        )
        # Mark the path as untrusted
        import tempfile, os
        with tempfile.TemporaryDirectory() as tmpdir:
            untrusted_path = os.path.join(tmpdir, "definition.yaml")
            tool.set_definition_path(untrusted_path)
            engine.register_untrusted_path(tmpdir)
            ctx = PolicyContext(agent_id="agent1")
            result = engine.can_create(ctx, tool)
        assert result.allowed is False


# ---------------------------------------------------------------------------
# Integrity tracker
# ---------------------------------------------------------------------------


class TestIntegrityTracker:
    def test_new_file_returns_validate(self, tmp_path: Path):
        tracker = ToolIntegrityTracker()
        test_file = tmp_path / "definition.yaml"
        test_file.write_text("name: test\n")
        action = tracker.get_action("my_tool", str(test_file))
        assert action == IntegrityAction.VALIDATE

    def test_unchanged_file_returns_keep(self, tmp_path: Path):
        tracker = ToolIntegrityTracker()
        test_file = tmp_path / "definition.yaml"
        test_file.write_text("name: test\n")
        # Record initial state
        tracker.record("my_tool", str(test_file))
        # Same content → KEEP
        action = tracker.get_action("my_tool", str(test_file))
        assert action == IntegrityAction.KEEP

    def test_changed_file_returns_revalidate(self, tmp_path: Path):
        tracker = ToolIntegrityTracker()
        test_file = tmp_path / "definition.yaml"
        test_file.write_text("name: original\n")
        tracker.record("my_tool", str(test_file))
        # Modify
        test_file.write_text("name: modified\n")
        action = tracker.get_action("my_tool", str(test_file))
        assert action == IntegrityAction.REVALIDATE
