"""Integration tests for Matimo end-to-end flow."""
from __future__ import annotations

from pathlib import Path

import pytest
import respx
import httpx

from matimo.instance import Matimo


FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


class TestMatimoInitFromFixtures:
    @pytest.mark.asyncio
    async def test_init_loads_all_fixture_tools(self):
        matimo = await Matimo.init(str(FIXTURES_DIR))
        tools = matimo.list_tools()
        assert len(tools) >= 4
        names = {t.name for t in tools}
        assert "calculator" in names
        assert "slack_send_channel_message" in names
        assert "echo_tool" in names

    @pytest.mark.asyncio
    async def test_search_after_init(self):
        matimo = await Matimo.init(str(FIXTURES_DIR))
        results = matimo.search_tools("slack")
        assert len(results) >= 1
        assert any(t.name == "slack_send_channel_message" for t in results)

    @respx.mock
    @pytest.mark.asyncio
    async def test_execute_echo_tool(self):
        respx.get(url__regex=r"https://httpbin.org/get.*").mock(
            return_value=httpx.Response(200, json={"args": {"message": "hello"}, "ok": True})
        )
        matimo = await Matimo.init(str(FIXTURES_DIR))
        result = await matimo.execute("echo_tool", {"message": "hello"})
        assert result is not None

    @pytest.mark.asyncio
    async def test_get_tool_definition(self):
        matimo = await Matimo.init(str(FIXTURES_DIR))
        tool = matimo.get_tool("calculator")
        assert tool is not None
        assert tool.name == "calculator"
        assert tool.version is not None


class TestMatimoReload:
    @pytest.mark.asyncio
    async def test_reload_after_adding_tool(self, tmp_path: Path):
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
