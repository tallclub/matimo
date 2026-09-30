"""Function tools receive the host-supplied PolicyContext — mirrors
typescript/packages/core/test/unit/function-tool-context.test.ts."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from matimo import FunctionToolContext, Matimo
from matimo.core.models import PolicyContext

pytestmark = pytest.mark.asyncio


def _write_tool(root: Path, name: str, body: str) -> None:
    tool_dir = root / name
    tool_dir.mkdir()
    (tool_dir / "definition.yaml").write_text(
        f"name: {name}\nversion: '1.0.0'\nrisk: low\ndescription: d\n"
        f"execution:\n  type: function\n  code: './{name}.py'\n"
    )
    (tool_dir / f"{name}.py").write_text(body)


async def _matimo(tmp_path: Path) -> Matimo:
    _write_tool(
        tmp_path,
        "whoami",
        "async def run(params, context):\n"
        "    return {'agent': context.policy_context and context.policy_context.agent_id,\n"
        "            'roles': context.policy_context and context.policy_context.roles,\n"
        "            'credentials': context.credentials}\n",
    )
    _write_tool(tmp_path, "legacy", "def run(params):\n    return {'params': params}\n")
    return await Matimo.init(str(tmp_path), log_level="silent")


async def test_run_with_context_gets_the_policy_context(tmp_path: Path) -> None:
    matimo = await _matimo(tmp_path)
    result: dict[str, Any] = await matimo.execute(
        "whoami", {}, context=PolicyContext(agent_id="agent-7", roles=["admin"])
    )
    assert result == {"agent": "agent-7", "roles": ["admin"], "credentials": None}


async def test_run_with_context_gets_credentials_too(tmp_path: Path) -> None:
    matimo = await _matimo(tmp_path)
    result = await matimo.execute("whoami", {}, credentials={"TOKEN": "t"})
    assert result["credentials"] == {"TOKEN": "t"}
    assert result["agent"] is None


async def test_single_argument_run_keeps_working(tmp_path: Path) -> None:
    matimo = await _matimo(tmp_path)
    assert await matimo.execute("legacy", {"x": 1}) == {"params": {"x": 1}}


def test_context_type_is_exported() -> None:
    assert FunctionToolContext().policy_context is None
