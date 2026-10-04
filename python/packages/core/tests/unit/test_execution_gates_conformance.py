"""
Cross-SDK conformance: the same fixture is asserted by
typescript/packages/core/test/unit/policy/execution-gates-conformance.test.ts,
so both SDKs must gate draft, deprecated and approval-required tools the same
way for every caller environment and role.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from matimo.core.models import PolicyContext, ToolDefinition
from matimo.policy.default_policy import DefaultPolicyEngine

_FIXTURE_PATH = (
    Path(__file__).resolve().parents[5] / "conformance" / "policy" / "execution-gates.json"
)
_FIXTURE: dict[str, Any] = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))

_CASES = [
    (f"{c['tool']['name']}-{context_name}", c["tool"], context_name, expected)
    for c in _FIXTURE["cases"]
    for context_name, expected in c["expected"].items()
]


@pytest.mark.parametrize(
    ("case_id", "tool_data", "context_name", "expected"),
    _CASES,
    ids=[c[0] for c in _CASES],
)
def test_can_execute_gate(
    case_id: str, tool_data: dict[str, Any], context_name: str, expected: str
) -> None:
    tool = ToolDefinition.model_validate(tool_data)
    context = PolicyContext(**_FIXTURE["contexts"][context_name])
    decision = DefaultPolicyEngine().can_execute(context, tool)
    outcome = "allowed" if decision.allowed is True else "denied"
    assert outcome == expected
