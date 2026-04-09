"""Unit tests for policy/policy_loader.py."""
from __future__ import annotations

from pathlib import Path

import pytest

from matimo.errors import ErrorCode, MatimoError
from matimo.policy.default_policy import DefaultPolicyEngine
from matimo.policy.policy_loader import _normalise_keys, load_policy_from_file
from matimo.policy.types import RiskLevel


class TestLoadPolicyFromFile:
    def test_missing_file_raises_file_not_found(self, tmp_path: Path) -> None:
        with pytest.raises(MatimoError) as exc_info:
            load_policy_from_file(tmp_path / "nonexistent.yaml")
        assert exc_info.value.code == ErrorCode.FILE_NOT_FOUND

    def test_empty_yaml_uses_defaults(self, tmp_path: Path) -> None:
        policy_file = tmp_path / "policy.yaml"
        policy_file.write_text("{}", encoding="utf-8")
        engine = load_policy_from_file(policy_file)
        assert isinstance(engine, DefaultPolicyEngine)

    def test_valid_policy_file_returns_engine(self, tmp_path: Path) -> None:
        policy_file = tmp_path / "policy.yaml"
        policy_file.write_text(
            "allowedHttpMethods:\n  - GET\n  - POST\n", encoding="utf-8"
        )
        engine = load_policy_from_file(policy_file)
        assert isinstance(engine, DefaultPolicyEngine)

    def test_camelcase_keys_normalised(self, tmp_path: Path) -> None:
        policy_file = tmp_path / "policy.yaml"
        content = """\
allowCommandTools: true
allowFunctionTools: false
enableHITL: false
allowedHttpMethods:
  - GET
  - POST
"""
        policy_file.write_text(content, encoding="utf-8")
        engine = load_policy_from_file(policy_file)
        assert isinstance(engine, DefaultPolicyEngine)

    def test_quarantine_risk_levels_normalised(self, tmp_path: Path) -> None:
        policy_file = tmp_path / "policy.yaml"
        policy_file.write_text("quarantineRiskLevels:\n  - medium\n  - high\n", encoding="utf-8")
        engine = load_policy_from_file(policy_file)
        assert isinstance(engine, DefaultPolicyEngine)

    def test_invalid_yaml_raises_invalid_schema(self, tmp_path: Path) -> None:
        policy_file = tmp_path / "policy.yaml"
        policy_file.write_text("invalid: yaml: : : :\n---\nbad\n", encoding="utf-8")
        with pytest.raises(MatimoError) as exc_info:
            load_policy_from_file(policy_file)
        assert exc_info.value.code == ErrorCode.INVALID_SCHEMA

    def test_trusted_paths_passed_to_engine(self, tmp_path: Path) -> None:
        policy_file = tmp_path / "policy.yaml"
        policy_file.write_text("{}", encoding="utf-8")
        trusted = [str(tmp_path / "trusted")]
        engine = load_policy_from_file(policy_file, trusted_paths=trusted)
        assert isinstance(engine, DefaultPolicyEngine)

    def test_untrusted_paths_passed_to_engine(self, tmp_path: Path) -> None:
        policy_file = tmp_path / "policy.yaml"
        policy_file.write_text("{}", encoding="utf-8")
        untrusted = [str(tmp_path / "untrusted")]
        engine = load_policy_from_file(policy_file, untrusted_paths=untrusted)
        assert isinstance(engine, DefaultPolicyEngine)

    def test_allows_string_path(self, tmp_path: Path) -> None:
        policy_file = tmp_path / "policy.yaml"
        policy_file.write_text("{}", encoding="utf-8")
        engine = load_policy_from_file(str(policy_file))
        assert isinstance(engine, DefaultPolicyEngine)

    def test_allowed_domains_parsed(self, tmp_path: Path) -> None:
        policy_file = tmp_path / "policy.yaml"
        policy_file.write_text(
            "allowedDomains:\n  - api.example.com\n", encoding="utf-8"
        )
        engine = load_policy_from_file(policy_file)
        assert isinstance(engine, DefaultPolicyEngine)

    def test_full_policy_document(self, tmp_path: Path) -> None:
        policy_file = tmp_path / "full_policy.yaml"
        content = """\
allowedDomains:
  - api.slack.com
  - api.github.com
allowedCredentials:
  - SLACK_BOT_TOKEN
  - GITHUB_TOKEN
allowedHttpMethods:
  - GET
  - POST
allowCommandTools: false
allowFunctionTools: false
protectedNamespaces:
  - matimo_
enableHITL: false
quarantineRiskLevels:
  - high
  - critical
"""
        policy_file.write_text(content, encoding="utf-8")
        engine = load_policy_from_file(policy_file)
        assert isinstance(engine, DefaultPolicyEngine)


class TestNormaliseKeys:
    def test_camelcase_to_snake_case(self) -> None:
        data = {
            "allowedDomains": ["a.com"],
            "allowCommandTools": True,
            "allowFunctionTools": False,
            "enableHITL": False,
        }
        result = _normalise_keys(data)
        assert "allowed_domains" in result
        assert "allow_command_tools" in result
        assert "allow_function_tools" in result
        assert "enable_hitl" in result

    def test_snake_case_keys_unchanged(self) -> None:
        data = {"allowed_domains": ["test.com"]}
        result = _normalise_keys(data)
        assert result["allowed_domains"] == ["test.com"]

    def test_unknown_keys_passed_through(self) -> None:
        data = {"customField": "value"}
        result = _normalise_keys(data)
        assert result["customField"] == "value"

    def test_quarantine_risk_levels_converted(self) -> None:
        data = {"quarantineRiskLevels": ["medium", "high"]}
        result = _normalise_keys(data)
        assert RiskLevel.MEDIUM in result["quarantine_risk_levels"]
        assert RiskLevel.HIGH in result["quarantine_risk_levels"]

    def test_quarantine_risk_levels_non_list_unchanged(self) -> None:
        data = {"quarantineRiskLevels": "high"}
        result = _normalise_keys(data)
        # Non-list value should pass through without conversion
        assert result["quarantine_risk_levels"] == "high"

    def test_empty_dict_returns_empty(self) -> None:
        assert _normalise_keys({}) == {}
