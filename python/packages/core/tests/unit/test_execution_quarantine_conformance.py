"""
Cross-SDK conformance: the same fixture is asserted by
typescript/packages/core/test/unit/policy/execution-quarantine-conformance.test.ts,
so both SDKs must quarantine exactly the same tools under the same config.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from matimo.core.models import PolicyContext, ToolDefinition
from matimo.policy.default_policy import DefaultPolicyEngine
from matimo.policy.policy_loader import _normalise_keys
from matimo.policy.risk_classifier import classify_execution_risk
from matimo.policy.types import PolicyConfig, RiskLevel

_FIXTURE_PATH = (
    Path(__file__).resolve().parents[5] / "conformance" / "policy" / "execution-quarantine.json"
)
_FIXTURE: dict[str, Any] = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))

_RISK_CASES = [(c["tool"]["name"], c) for c in _FIXTURE["cases"]]
_DECISION_CASES = [
    (f"{c['tool']['name']}-{config_name}", c, config_name, expected)
    for c in _FIXTURE["cases"]
    for config_name, expected in c["expected"].items()
]


@pytest.mark.parametrize(("name", "case"), _RISK_CASES, ids=[n for n, _ in _RISK_CASES])
def test_execution_risk(name: str, case: dict[str, Any]) -> None:
    tool = ToolDefinition.model_validate(case["tool"])
    assert classify_execution_risk(tool) == RiskLevel(case["executionRisk"])


@pytest.mark.parametrize(
    ("case_id", "case", "config_name", "expected"),
    _DECISION_CASES,
    ids=[c[0] for c in _DECISION_CASES],
)
def test_can_execute_decision(
    case_id: str, case: dict[str, Any], config_name: str, expected: str
) -> None:
    tool = ToolDefinition.model_validate(case["tool"])
    config = PolicyConfig(**_normalise_keys(_FIXTURE["configs"][config_name]))
    decision = DefaultPolicyEngine(config=config).can_execute(PolicyContext(), tool)
    outcome = "allowed" if decision.allowed is True else decision.allowed
    assert outcome == expected
