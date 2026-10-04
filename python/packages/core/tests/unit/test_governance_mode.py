"""
governance_mode: "secure" (default) asks before every call to a DELETE or
command tool that doesn't declare requires_approval; "legacy" restores the
pre-0.2.0 default of not asking. Mirrors governance-mode.test.ts.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest

from matimo import Matimo
from matimo.approval.handler import get_global_approval_handler
from matimo.core.models import HttpExecution, ToolDefinition
from matimo.errors import MatimoError
from matimo.mcp.tool_converter import tool_to_mcp_registration
from matimo.policy.default_policy import DefaultPolicyEngine
from matimo.policy.policy_loader import load_policy_from_file
from matimo.policy.types import PolicyAllowed, PolicyConfig


@pytest.fixture
def tool_dir(tmp_path: Path) -> Path:
    echo = tmp_path / "tools" / "plain_echo"
    echo.mkdir(parents=True)
    (echo / "definition.yaml").write_text(
        "name: plain_echo\nversion: '1.0.0'\ndescription: Echo\n"
        "execution:\n  type: command\n  command: echo\n  args: ['hi']\n"
    )
    get_global_approval_handler().set_approval_callback(None)
    return echo.parent


async def _init(tool_dir: Path, **kwargs: Any) -> Matimo:  # noqa: ANN401
    kwargs.setdefault("policy_config", PolicyConfig(allow_command_tools=True))
    return await Matimo.init(str(tool_dir), log_level="silent", **kwargs)


def _write_policy(tmp_path: Path, mode: str) -> str:
    path = tmp_path / "policy.yaml"
    path.write_text(f"governanceMode: {mode}\nallowCommandTools: true\n")
    return str(path)


@pytest.mark.asyncio
async def test_defaults_to_secure_which_asks_before_a_command_tool(tool_dir: Path) -> None:
    matimo = await _init(tool_dir)
    assert matimo.get_governance_mode() == "secure"
    with pytest.raises(MatimoError, match="requires approval"):
        await matimo.execute("plain_echo", {})


@pytest.mark.asyncio
async def test_legacy_runs_the_command_tool_without_asking(tool_dir: Path) -> None:
    on_approval = AsyncMock(return_value=True)
    matimo = await _init(tool_dir, governance_mode="legacy", on_approval=on_approval)
    assert matimo.get_governance_mode() == "legacy"
    await matimo.execute("plain_echo", {})
    on_approval.assert_not_called()


@pytest.mark.asyncio
async def test_reads_the_mode_from_policy_config(tool_dir: Path) -> None:
    matimo = await _init(tool_dir, policy_config=PolicyConfig(governance_mode="legacy"))
    assert matimo.get_governance_mode() == "legacy"


@pytest.mark.asyncio
async def test_reads_the_mode_from_a_policy_file(tool_dir: Path, tmp_path: Path) -> None:
    policy_file = _write_policy(tmp_path, "legacy")
    engine = load_policy_from_file(policy_file)
    assert isinstance(engine, DefaultPolicyEngine)
    assert engine.config.governance_mode == "legacy"
    matimo = await _init(tool_dir, policy_config=None, policy_file=policy_file)
    assert matimo.get_governance_mode() == "legacy"


def test_rejects_an_unknown_mode_in_a_policy_file(tmp_path: Path) -> None:
    with pytest.raises(Exception, match="governance_mode"):
        load_policy_from_file(_write_policy(tmp_path, "relaxed"))


@pytest.mark.asyncio
async def test_init_option_overrides_the_policy_config(tool_dir: Path) -> None:
    matimo = await _init(
        tool_dir, governance_mode="secure", policy_config=PolicyConfig(governance_mode="legacy")
    )
    assert matimo.get_governance_mode() == "secure"


@pytest.mark.asyncio
async def test_uses_secure_with_a_custom_policy_engine(tool_dir: Path) -> None:
    class AllowAll:
        def can_execute(self, context: Any, tool: Any) -> PolicyAllowed:  # noqa: ANN401
            return PolicyAllowed()

        def can_create(self, context: Any, tool: Any) -> PolicyAllowed:  # noqa: ANN401
            return PolicyAllowed()

        def filter_for_agent(self, context: Any, tools: list[Any]) -> list[Any]:  # noqa: ANN401
            return tools

    matimo = await _init(tool_dir, policy_config=None, policy=AllowAll())  # type: ignore[arg-type]
    assert matimo.get_governance_mode() == "secure"
    assert DefaultPolicyEngine().config.governance_mode is None


@pytest.mark.parametrize(("mode", "offered"), [("secure", True), ("legacy", False)])
def test_mcp_client_approval_follows_the_mode(mode: str, offered: bool) -> None:
    tool = ToolDefinition(
        name="wipe",
        description="d",
        execution=HttpExecution(type="http", method="DELETE", url="https://api.example.com/x"),
    )
    registration = tool_to_mcp_registration(
        tool, client_approval=True, governance_mode=mode  # type: ignore[arg-type]
    )
    assert ("_matimo_approved" in registration["inputSchema"].get("properties", {})) is offered
