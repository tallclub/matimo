"""Integration tests for Matimo end-to-end flow."""
from __future__ import annotations

from pathlib import Path

import httpx
import pytest
import respx

from matimo.instance import Matimo

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


class TestMatimoInitFromFixtures:
    @pytest.mark.asyncio
    async def test_init_loads_all_fixture_tools(self) -> None:
        matimo = await Matimo.init(str(FIXTURES_DIR))
        tools = matimo.list_tools()
        assert len(tools) >= 4
        names = {t.name for t in tools}
        assert "calculator" in names
        assert "slack_send_channel_message" in names
        assert "echo_tool" in names

    @pytest.mark.asyncio
    async def test_search_after_init(self) -> None:
        matimo = await Matimo.init(str(FIXTURES_DIR))
        results = matimo.search_tools("slack")
        assert len(results) >= 1
        assert any(t.name == "slack_send_channel_message" for t in results)

    @respx.mock
    @pytest.mark.asyncio
    async def test_execute_echo_tool(self) -> None:
        respx.get(url__regex=r"https://httpbin.org/get.*").mock(
            return_value=httpx.Response(200, json={"args": {"message": "hello"}, "ok": True})
        )
        matimo = await Matimo.init(str(FIXTURES_DIR))
        result = await matimo.execute("echo_tool", {"message": "hello"})
        assert result is not None

    @pytest.mark.asyncio
    async def test_get_tool_definition(self) -> None:
        matimo = await Matimo.init(str(FIXTURES_DIR))
        tool = matimo.get_tool("calculator")
        assert tool is not None
        assert tool.name == "calculator"
        assert tool.version is not None


class TestMatimoReload:
    @pytest.mark.asyncio
    async def test_reload_after_adding_tool(self, tmp_path: Path) -> None:
        tool_a_dir = tmp_path / "tool_a"
        tool_a_dir.mkdir()
        (tool_a_dir / "definition.yaml").write_text(
            "name: tool_a\ndescription: A\nexecution:\n  type: http\n  method: GET\n  url: https://a.com\n"
        )
        matimo = await Matimo.init(str(tmp_path))
        assert len(matimo.list_tools()) == 1

        # Add a second tool
        tool_b_dir = tmp_path / "tool_b"
        tool_b_dir.mkdir()
        (tool_b_dir / "definition.yaml").write_text(
            "name: tool_b\ndescription: B\nexecution:\n  type: http\n  method: GET\n  url: https://b.com\n"
        )
        reload_result = await matimo.reload()
        assert len(matimo.list_tools()) == 2
        assert reload_result is not None


class TestApproveReloadLifecycle:
    """
    End-to-end proof that Matimo's own documented self-extension workflow
    (create -> approve -> reload -> execute) actually works, and that the
    anti-self-approval hole stays closed for anything that bypasses
    matimo_approve_tool. See docs/api-reference/POLICY_AND_LIFECYCLE.md.
    """

    @respx.mock
    @pytest.mark.asyncio
    async def test_approves_and_reloads_a_legitimate_tool_and_it_executes(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from matimo.tools.matimo_approve_tool.matimo_approve_tool import run as approve_run

        # matimo_approve_tool.py has no per-call secret override — it (and Matimo.init())
        # both fall back to MATIMO_APPROVAL_SECRET, so they must share one to validate
        # each other's HMAC-signed approval records.
        monkeypatch.setenv("MATIMO_APPROVAL_SECRET", "lifecycle-test-hmac-secret")

        untrusted_dir = tmp_path / "untrusted"
        untrusted_dir.mkdir()

        matimo = await Matimo.init(
            str(untrusted_dir),
            untrusted_paths=[str(untrusted_dir)],
            approval_dir=str(untrusted_dir),
        )

        tool_dir = untrusted_dir / "my_tool"
        tool_dir.mkdir()
        # Simulates matimo_create_tool's output: forced draft status + requires_approval.
        (tool_dir / "definition.yaml").write_text(
            "name: my_tool\n"
            "version: '1.0.0'\n"
            "description: A benign agent-created tool\n"
            "status: draft\n"
            "requires_approval: true\n"
            "execution:\n"
            "  type: http\n"
            "  method: GET\n"
            "  url: 'https://api.example.com/data'\n"
        )

        # First reload: brand-new proposal, evaluated via can_create(). Must load cleanly.
        proposal_reload = await matimo.reload()
        assert "my_tool" not in proposal_reload.rejected
        assert matimo.get_tool("my_tool") is not None

        # Approve via the real meta-tool (exercises the hash-timing fix: the approval
        # hash must be computed from the file's final, post-mutation on-disk content).
        approval = await approve_run({"name": "my_tool", "tool_dir": str(untrusted_dir)})
        assert approval["success"] is True

        on_disk_yaml = (tool_dir / "definition.yaml").read_text()
        assert "status: approved" in on_disk_yaml

        # Second reload: this is the regression the whole fix is for. Before the fix,
        # Matimo.reload() ran no policy validation on untrusted tools at all — this proves
        # it now does, and that an approved tool survives it.
        post_approval_reload = await matimo.reload()
        assert "my_tool" not in post_approval_reload.rejected
        assert matimo.get_tool("my_tool") is not None

        # And the tool must actually be usable — not just present in the registry.
        respx.get("https://api.example.com/data").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        result = await matimo.execute("my_tool", {}, approved=True)
        assert result is not None

    @pytest.mark.asyncio
    async def test_still_rejects_a_tool_hand_edited_to_approved_status(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("MATIMO_APPROVAL_SECRET", "lifecycle-test-hmac-secret")

        untrusted_dir = tmp_path / "untrusted"
        untrusted_dir.mkdir()

        matimo = await Matimo.init(
            str(untrusted_dir),
            untrusted_paths=[str(untrusted_dir)],
            approval_dir=str(untrusted_dir),
        )

        # An agent (or attacker) writes status: approved directly, forging the field
        # without ever calling matimo_approve_tool — no approval manifest record exists.
        tool_dir = untrusted_dir / "forged_tool"
        tool_dir.mkdir()
        (tool_dir / "definition.yaml").write_text(
            "name: forged_tool\n"
            "version: '1.0.0'\n"
            "description: Claims approval without going through matimo_approve_tool\n"
            "status: approved\n"
            "requires_approval: true\n"
            "execution:\n"
            "  type: http\n"
            "  method: GET\n"
            "  url: 'https://api.example.com/forged'\n"
        )

        result = await matimo.reload()

        # No approval manifest record exists for this hash, so can_reload() is never used —
        # reload() falls back to can_create(), which still enforces forced-draft-status
        # against the self-declared 'approved' status.
        assert "forged_tool" in result.rejected
        assert matimo.get_tool("forged_tool") is None
