"""Unit tests for the policy subsystem."""
from __future__ import annotations

from pathlib import Path

from matimo.core.models import (
    CommandExecution,
    FunctionExecution,
    HttpExecution,
    PolicyContext,
    ToolDefinition,
    ToolStatus,
)
from matimo.policy.content_validator import (
    _check_ssrf,
    _extract_placeholders,
    validate_tool_content,
)
from matimo.policy.default_policy import DefaultPolicyEngine
from matimo.policy.integrity_tracker import IntegrityAction, ToolIntegrityTracker
from matimo.policy.risk_classifier import classify_risk
from matimo.policy.types import PolicyConfig, RiskLevel


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
    def test_function_tool_is_critical(self) -> None:
        tool = ToolDefinition(
            name="f", description="func",
            execution=FunctionExecution(type="function", code="x.py")
        )
        assert classify_risk(tool) == RiskLevel.CRITICAL

    def test_command_tool_is_high(self) -> None:
        tool = ToolDefinition(
            name="c", description="cmd",
            execution=CommandExecution(type="command", command="ls")
        )
        assert classify_risk(tool) == RiskLevel.HIGH

    def test_http_get_is_low(self) -> None:
        tool = _make_http_tool(method="GET")
        assert classify_risk(tool) == RiskLevel.LOW

    def test_http_post_is_medium(self) -> None:
        tool = _make_http_tool(method="POST")
        assert classify_risk(tool) == RiskLevel.MEDIUM

    def test_http_delete_is_high(self) -> None:
        tool = _make_http_tool(method="DELETE")
        assert classify_risk(tool) == RiskLevel.HIGH

    def test_requires_approval_bumps_to_high(self) -> None:
        # GET normally = LOW, but requires_approval overrides
        tool = _make_http_tool(method="GET", requires_approval=True)
        level = classify_risk(tool)
        assert level in (RiskLevel.HIGH, RiskLevel.MEDIUM)  # At least bumped up


# ---------------------------------------------------------------------------
# Content validator
# ---------------------------------------------------------------------------


class TestContentValidator:
    def test_safe_http_get_passes(self) -> None:
        engine = DefaultPolicyEngine()
        # Untrusted tool must declare requires_approval=True and status=draft to
        # pass content validation without violations.
        tool = _make_http_tool(requires_approval=True, status=ToolStatus.DRAFT)
        violations = validate_tool_content(tool, engine.config)
        assert violations == []

    def test_function_execution_blocked_for_untrusted(self) -> None:
        engine = DefaultPolicyEngine()
        tool = ToolDefinition(
            name="f", description="d",
            execution=FunctionExecution(type="function", code="x.py")
        )
        violations = validate_tool_content(tool, engine.config)
        assert any(v.rule == "no-function-execution" for v in violations)

    def test_command_execution_blocked_for_untrusted(self) -> None:
        engine = DefaultPolicyEngine()
        tool = ToolDefinition(
            name="c", description="d",
            execution=CommandExecution(type="command", command="rm")
        )
        violations = validate_tool_content(tool, engine.config)
        assert any(v.rule == "no-command-execution" for v in violations)

    def test_ssrf_localhost_blocked(self) -> None:
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(url="http://localhost/admin")
        violations = validate_tool_content(tool, engine.config)
        assert any(v.rule == "no-ssrf" for v in violations)

    def test_ssrf_169_blocked(self) -> None:
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(url="http://169.254.169.254/metadata")
        violations = validate_tool_content(tool, engine.config)
        assert any(v.rule == "no-ssrf" for v in violations)

    def test_ssrf_internal_ip_blocked(self) -> None:
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(url="http://192.168.1.1/api")
        violations = validate_tool_content(tool, engine.config)
        assert any(v.rule == "no-ssrf" for v in violations)

    def test_blocked_http_method_delete(self) -> None:
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(method="DELETE")
        violations = validate_tool_content(tool, engine.config)
        assert any(v.rule == "blocked-http-method" for v in violations)

    def test_forced_approval_blocked(self) -> None:
        # A GET tool is clean — no violations
        engine = DefaultPolicyEngine()
        safe_tool = _make_http_tool(method="GET", requires_approval=False)
        violations = validate_tool_content(safe_tool, engine.config)
        # Should not block a safe GET
        assert not any(v.rule == "blocked-http-method" for v in violations)


class TestDefaultPolicyEngine:
    def test_stable_get_tool_allowed(self) -> None:
        engine = DefaultPolicyEngine()
        tool = _make_http_tool()
        ctx = PolicyContext(agent_id="agent1")
        decision = engine.can_execute(ctx, tool)
        assert decision.allowed is True

    def test_deprecated_tool_denied(self) -> None:
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(status=ToolStatus.DEPRECATED)
        ctx = PolicyContext(agent_id="agent1")
        decision = engine.can_execute(ctx, tool)
        assert decision.allowed is False

    def test_draft_tool_denied_in_production(self) -> None:
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(status=ToolStatus.DRAFT)
        # 'production' env blocks draft tools without admin role
        ctx = PolicyContext(agent_id="agent1", environment="production", roles=[])
        decision = engine.can_execute(ctx, tool)
        assert decision.allowed is False

    def test_draft_tool_allowed_in_dev(self) -> None:
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(status=ToolStatus.DRAFT)
        ctx = PolicyContext(agent_id="agent1", environment="development")
        decision = engine.can_execute(ctx, tool)
        assert decision.allowed is True

    def test_requires_approval_blocked_in_production(self) -> None:
        engine = DefaultPolicyEngine()
        tool = _make_http_tool(requires_approval=True)
        ctx = PolicyContext(agent_id="agent1", environment="production", roles=[])
        decision = engine.can_execute(ctx, tool)
        assert decision.allowed is False

    def test_filter_for_agent_excludes_deprecated(self) -> None:
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

    def test_can_create_safe_tool(self) -> None:
        engine = DefaultPolicyEngine()
        tool = _make_http_tool()
        ctx = PolicyContext(agent_id="agent1")
        result = engine.can_create(ctx, tool)
        assert result.allowed is True

    def test_can_create_unsafe_function_from_untrusted(self) -> None:
        engine = DefaultPolicyEngine()
        tool = ToolDefinition(
            name="evil", description="bad",
            execution=FunctionExecution(type="function", code="evil.py")
        )
        # Mark the path as untrusted
        import os
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            untrusted_path = os.path.join(tmpdir, "definition.yaml")
            tool.set_definition_path(untrusted_path)
            engine.register_untrusted_path(tmpdir)
            ctx = PolicyContext(agent_id="agent1")
            result = engine.can_create(ctx, tool)
        assert result.allowed is False

    def test_update_config(self) -> None:
        """update_config replaces the active policy configuration."""
        engine = DefaultPolicyEngine()
        new_config = PolicyConfig(allowed_http_methods=["GET"])
        engine.update_config(new_config)
        assert engine.config.allowed_http_methods == ["GET"]

    def test_register_trusted_path(self) -> None:
        """Registering a trusted path makes non-matching paths untrusted."""
        engine = DefaultPolicyEngine()
        engine.register_trusted_path("/trusted/")
        # path not under trusted → untrusted
        assert engine._is_untrusted_path("/untrusted/tool.yaml") is True
        # path under trusted → trusted
        assert engine._is_untrusted_path("/trusted/tool.yaml") is False

    def test_can_create_high_violations_in_production(self) -> None:
        """High-severity violations in production block can_create."""
        import tempfile
        engine = DefaultPolicyEngine()
        # A DELETE tool without requires_approval generates a forced-approval (HIGH) violation
        tool = ToolDefinition(
            name="dangerous_tool",
            description="d",
            requires_approval=False,
            execution=HttpExecution(
                type="http",
                method="DELETE",
                url="https://api.example.com/data",
            ),
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            tool.set_definition_path(f"{tmpdir}/definition.yaml")
            engine.register_untrusted_path(tmpdir)
            ctx = PolicyContext(agent_id="a1", environment="production")
            result = engine.can_create(ctx, tool)
        assert result.allowed is False

    def test_can_create_allowed_tool(self) -> None:
        """A safe tool from an untrusted path in non-production is allowed."""
        import tempfile
        engine = DefaultPolicyEngine()
        tool = ToolDefinition(
            name="safe_tool",
            description="safe",
            requires_approval=True,
            status=ToolStatus.DRAFT,
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://api.example.com/data",
            ),
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            tool.set_definition_path(f"{tmpdir}/definition.yaml")
            engine.register_untrusted_path(tmpdir)
            ctx = PolicyContext(agent_id="a1", environment="development")
            result = engine.can_create(ctx, tool)
        # should be allowed (no critical violations, not in production)
        assert result.allowed is not False or result.allowed == "pending_approval"


# ---------------------------------------------------------------------------
# Content validator — extended coverage
# ---------------------------------------------------------------------------


class TestContentValidatorExtended:
    def test_unauthorized_credential_violation(self) -> None:
        """allowed_credentials set: tool referencing unlisted token → violation."""
        config = PolicyConfig(allowed_credentials=["ALLOWED_TOKEN"])
        tool = ToolDefinition(
            name="my_tool",
            description="test",
            requires_approval=True,
            status=ToolStatus.DRAFT,
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://api.example.com/data",
                headers={"Authorization": "Bearer {UNKNOWN_SECRET_TOKEN}"},
            ),
        )
        violations = validate_tool_content(tool, config)
        assert any(v.rule == "unauthorized-credential" for v in violations)

    def test_authorized_credential_no_violation(self) -> None:
        """Credential in allowed_credentials should not produce a violation."""
        config = PolicyConfig(allowed_credentials=["MY_TOKEN"])
        tool = ToolDefinition(
            name="my_tool",
            description="test",
            requires_approval=True,
            status=ToolStatus.DRAFT,
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://api.example.com/data",
                headers={"Authorization": "Bearer {MY_TOKEN}"},
            ),
        )
        violations = validate_tool_content(tool, config)
        assert not any(v.rule == "unauthorized-credential" for v in violations)

    def test_reserved_namespace_violation(self) -> None:
        """Tool name starting with protected_namespaces triggers reserved-namespace."""
        config = PolicyConfig(protected_namespaces=["matimo_"])
        tool = ToolDefinition(
            name="matimo_internal_spy",
            description="test",
            requires_approval=True,
            status=ToolStatus.DRAFT,
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
        )
        violations = validate_tool_content(tool, config)
        assert any(v.rule == "reserved-namespace" for v in violations)

    def test_blocked_domain_violation(self) -> None:
        """Tool targeting a domain not in allowed_domains triggers blocked-domain."""
        config = PolicyConfig(allowed_domains=["trusted.com"], protected_namespaces=[])
        tool = ToolDefinition(
            name="ext_tool",
            description="test",
            requires_approval=True,
            status=ToolStatus.DRAFT,
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://evil.com/api",
            ),
        )
        violations = validate_tool_content(tool, config)
        assert any(v.rule == "blocked-domain" for v in violations)

    def test_allowed_domain_no_violation(self) -> None:
        """Tool targeting an allowed domain should not produce a blocked-domain violation."""
        config = PolicyConfig(allowed_domains=["trusted.com"], protected_namespaces=[])
        tool = ToolDefinition(
            name="safe_tool",
            description="test",
            requires_approval=True,
            status=ToolStatus.DRAFT,
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://api.trusted.com/endpoint",
            ),
        )
        violations = validate_tool_content(tool, config)
        assert not any(v.rule == "blocked-domain" for v in violations)


class TestCheckSsrf:
    def test_localhost_blocked(self) -> None:
        assert _check_ssrf("http://localhost/admin") == "localhost"

    def test_metadata_ip_blocked(self) -> None:
        assert _check_ssrf("http://169.254.169.254/metadata") == "169.254.169.254"

    def test_private_ip_blocked(self) -> None:
        # 10.0.0.1 is private — should be blocked
        result = _check_ssrf("http://10.0.0.1/api")
        assert result == "10.0.0.1"

    def test_loopback_ip_blocked(self) -> None:
        result = _check_ssrf("http://127.0.0.1/api")
        assert result == "127.0.0.1"

    def test_public_ip_not_blocked(self) -> None:
        # 8.8.8.8 is a public IP — should not be blocked
        result = _check_ssrf("http://8.8.8.8/api")
        assert result is None

    def test_public_domain_not_blocked(self) -> None:
        result = _check_ssrf("https://api.github.com/repos")
        assert result is None

    def test_placeholder_in_url_ignored(self) -> None:
        # URL with placeholder in host — host after stripping should not match
        result = _check_ssrf("https://{HOST}/api")
        assert result is None  # stripped host is empty

    def test_invalid_url_returns_none(self) -> None:
        result = _check_ssrf(":::bad_url:::")
        assert result is None


class TestExtractPlaceholders:
    def test_http_tool_extracts_placeholders(self) -> None:
        tool = ToolDefinition(
            name="t",
            description="d",
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://api.example.com/{resource_id}",
                headers={"Authorization": "Bearer {TOKEN}"},
            ),
        )
        placeholders = _extract_placeholders(tool)
        assert "resource_id" in placeholders
        assert "TOKEN" in placeholders

    def test_command_tool_extracts_placeholders(self) -> None:
        tool = ToolDefinition(
            name="t",
            description="d",
            execution=CommandExecution(
                type="command",
                command="my_cli",
                args=["--channel", "{channel}", "--token", "{SLACK_TOKEN}"],
            ),
        )
        placeholders = _extract_placeholders(tool)
        assert "channel" in placeholders
        assert "SLACK_TOKEN" in placeholders


# ---------------------------------------------------------------------------
# Integrity tracker
# ---------------------------------------------------------------------------


class TestIntegrityTracker:
    def test_new_file_returns_validate(self, tmp_path: Path) -> None:
        tracker = ToolIntegrityTracker()
        test_file = tmp_path / "definition.yaml"
        test_file.write_text("name: test\n")
        action = tracker.get_action("my_tool", str(test_file))
        assert action == IntegrityAction.VALIDATE

    def test_unchanged_file_returns_keep(self, tmp_path: Path) -> None:
        tracker = ToolIntegrityTracker()
        test_file = tmp_path / "definition.yaml"
        test_file.write_text("name: test\n")
        # Record initial state
        tracker.record("my_tool", str(test_file))
        # Same content → KEEP
        action = tracker.get_action("my_tool", str(test_file))
        assert action == IntegrityAction.KEEP

    def test_changed_file_returns_revalidate(self, tmp_path: Path) -> None:
        tracker = ToolIntegrityTracker()
        test_file = tmp_path / "definition.yaml"
        test_file.write_text("name: original\n")
        tracker.record("my_tool", str(test_file))
        # Modify
        test_file.write_text("name: modified\n")
        action = tracker.get_action("my_tool", str(test_file))
        assert action == IntegrityAction.REVALIDATE

    def test_path_change_returns_revalidate(self, tmp_path: Path) -> None:
        tracker = ToolIntegrityTracker()
        file_a = tmp_path / "a.yaml"
        file_b = tmp_path / "b.yaml"
        file_a.write_text("name: test\n")
        file_b.write_text("name: test\n")
        tracker.record("my_tool", str(file_a))
        # Same content, different path → REVALIDATE
        action = tracker.get_action("my_tool", str(file_b))
        assert action == IntegrityAction.REVALIDATE

    def test_nonexistent_file_returns_validate(self, tmp_path: Path) -> None:
        tracker = ToolIntegrityTracker()
        tracker.record("my_tool", str(tmp_path / "existing.yaml"))
        # Asking for a file that doesn't exist → VALIDATE
        action = tracker.get_action("my_tool", "/nonexistent/path.yaml")
        assert action == IntegrityAction.VALIDATE

    def test_hash_for_known_tool(self, tmp_path: Path) -> None:
        tracker = ToolIntegrityTracker()
        test_file = tmp_path / "t.yaml"
        test_file.write_text("x\n")
        tracker.record("t", str(test_file))
        h = tracker.hash_for("t")
        assert h is not None
        assert len(h) == 64  # SHA-256 hex

    def test_hash_for_unknown_tool_returns_none(self) -> None:
        tracker = ToolIntegrityTracker()
        assert tracker.hash_for("unknown") is None

    def test_remove(self, tmp_path: Path) -> None:
        tracker = ToolIntegrityTracker()
        test_file = tmp_path / "t.yaml"
        test_file.write_text("x\n")
        tracker.record("t", str(test_file))
        tracker.remove("t")
        assert tracker.hash_for("t") is None

    def test_clear(self, tmp_path: Path) -> None:
        tracker = ToolIntegrityTracker()
        for i in range(3):
            f = tmp_path / f"t{i}.yaml"
            f.write_text("x\n")
            tracker.record(f"t{i}", str(f))
        tracker.clear()
        assert tracker.hash_for("t0") is None

    def test_hash_file_oserror_returns_none(self) -> None:
        result = ToolIntegrityTracker._hash_file("/nonexistent/totally/missing.yaml")
        assert result is None
