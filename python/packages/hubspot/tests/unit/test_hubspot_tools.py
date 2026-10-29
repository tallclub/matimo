"""Unit tests for the HubSpot tool definition YAML files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
import yaml

TOOLS_ROOT = Path(__file__).resolve().parent.parent.parent / "src" / "matimo_hubspot" / "tools"

EXPECTED_NOTES = {"env": "MATIMO_HUBSPOT_API_KEY"}


def _tool_names() -> list[str]:
    """Every tool directory under the package's tools/ root, discovered live."""
    names = sorted(d.name for d in TOOLS_ROOT.iterdir() if d.is_dir())
    assert names, f"no tool directories found under {TOOLS_ROOT}"
    return names


@pytest.fixture(params=_tool_names())
def tool_name(request: pytest.FixtureRequest) -> str:
    return str(request.param)


@pytest.fixture
def tool_definition(tool_name: str) -> dict[str, Any]:
    tool_path = TOOLS_ROOT / tool_name / "definition.yaml"
    with open(tool_path) as f:
        return yaml.safe_load(f)  # type: ignore[return-value]


def test_tool_definition_valid(tool_name: str, tool_definition: dict[str, Any]) -> None:
    assert tool_definition.get("name") == tool_name
    assert "description" in tool_definition
    assert "execution" in tool_definition


def test_authentication_notes_declare_env_var(
    tool_name: str, tool_definition: dict[str, Any]
) -> None:
    auth = tool_definition.get("authentication")
    assert isinstance(auth, dict), f"missing authentication block in {tool_name}"
    assert auth.get("notes") == EXPECTED_NOTES
