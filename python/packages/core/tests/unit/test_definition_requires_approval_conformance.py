"""
Cross-SDK conformance: the same fixture is asserted by
typescript/packages/core/test/unit/approval/definition-requires-approval-conformance.test.ts,
so both SDKs ask for per-call approval on exactly the same tool definitions.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from matimo.approval.handler import definition_requires_approval
from matimo.core.models import ToolDefinition

_FIXTURE_PATH = (
    Path(__file__).resolve().parents[5]
    / "conformance"
    / "approval"
    / "definition-requires-approval.json"
)
_CASES: list[dict[str, Any]] = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))["cases"]


def _build_tool(case: dict[str, Any]) -> ToolDefinition:
    """Fill in the fields the fixture leaves out because they don't affect the answer."""
    raw = {"name": case["name"], "description": "conformance case", **case["tool"]}
    if raw["execution"]["type"] == "http":
        raw["execution"] = {"url": "https://api.example.com/x", **raw["execution"]}
    return ToolDefinition.model_validate(raw)


@pytest.mark.parametrize("case", _CASES, ids=[c["name"] for c in _CASES])
def test_definition_requires_approval(case: dict[str, Any]) -> None:
    tool = _build_tool(case)
    # A case without a mode runs in the default mode.
    actual = (
        definition_requires_approval(tool)
        if "mode" not in case
        else definition_requires_approval(tool, case["mode"])
    )
    assert actual is case["expected"]
