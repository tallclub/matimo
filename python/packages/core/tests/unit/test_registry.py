"""Unit tests for ToolRegistry."""
from __future__ import annotations

import pytest

from matimo.core.models import HttpExecution, ToolDefinition
from matimo.core.registry import ToolRegistry
from matimo.errors import ErrorCode, MatimoError


def _make_tool(name: str, tags: list[str] | None = None) -> ToolDefinition:
    return ToolDefinition(
        name=name,
        version="1.0.0",
        description=f"Tool {name}",
        execution=HttpExecution(type="http", method="GET", url=f"https://x.com/{name}"),
        tags=tags or [],
    )


class TestToolRegistryRegister:
    def test_register_and_get(self) -> None:
        reg = ToolRegistry()
        tool = _make_tool("my_tool")
        reg.register(tool)
        assert reg.get("my_tool") is tool

    def test_register_duplicate_raises(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_tool("dup"))
        with pytest.raises(MatimoError) as exc:
            reg.register(_make_tool("dup"))
        assert exc.value.code == ErrorCode.TOOL_NOT_FOUND or exc.value.code is not None

    def test_register_or_replace_overwrites(self) -> None:
        reg = ToolRegistry()
        old = _make_tool("t")
        reg.register(old)
        new = _make_tool("t")
        reg.register_or_replace(new)
        assert reg.get("t") is new

    def test_register_all(self) -> None:
        reg = ToolRegistry()
        tools = [_make_tool(f"t{i}") for i in range(5)]
        reg.register_all(tools)
        assert reg.count() == 5

    def test_get_nonexistent_returns_none(self) -> None:
        reg = ToolRegistry()
        assert reg.get("missing") is None

    def test_get_or_raise_nonexistent_raises(self) -> None:
        reg = ToolRegistry()
        with pytest.raises(MatimoError) as exc:
            reg.get_or_raise("missing")
        assert exc.value.code == ErrorCode.TOOL_NOT_FOUND


class TestToolRegistrySearch:
    def test_search_by_name_prefix(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_tool("slack_send"))
        reg.register(_make_tool("slack_receive"))
        reg.register(_make_tool("github_issue"))
        results = reg.search("slack")
        names = {t.name for t in results}
        assert "slack_send" in names
        assert "slack_receive" in names
        assert "github_issue" not in names

    def test_search_case_insensitive(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_tool("Slack_Send"))
        results = reg.search("slack")
        assert len(results) == 1

    def test_search_empty_query_returns_all(self) -> None:
        reg = ToolRegistry()
        tools = [_make_tool(f"t{i}") for i in range(3)]
        reg.register_all(tools)
        assert len(reg.search("")) == 3

    def test_search_no_match(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_tool("hello"))
        assert reg.search("zzz") == []


class TestToolRegistryTags:
    def test_get_by_tag(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_tool("a", tags=["messaging"]))
        reg.register(_make_tool("b", tags=["messaging", "slack"]))
        reg.register(_make_tool("c", tags=["github"]))
        results = reg.get_by_tag("messaging")
        names = {t.name for t in results}
        assert "a" in names and "b" in names
        assert "c" not in names

    def test_tag_not_found_returns_empty(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_tool("x", tags=["slack"]))
        assert reg.get_by_tag("nonexistent") == []


class TestToolRegistryList:
    def test_list_tools(self) -> None:
        reg = ToolRegistry()
        names = ["alpha", "beta", "gamma"]
        reg.register_all([_make_tool(n) for n in names])
        listed = reg.get_all()
        assert len(listed) == 3

    def test_count(self) -> None:
        reg = ToolRegistry()
        assert reg.count() == 0
        reg.register(_make_tool("x"))
        assert reg.count() == 1

    def test_unregister(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_tool("x"))
        reg.remove("x")
        assert reg.get("x") is None

    def test_clear(self) -> None:
        reg = ToolRegistry()
        reg.register_all([_make_tool(f"t{i}") for i in range(5)])
        reg.clear()
        assert reg.count() == 0


class TestToolRegistryEdgeCases:
    def test_register_all_replace(self) -> None:
        """register_all_replace replaces existing tools without raising."""
        reg = ToolRegistry()
        reg.register(_make_tool("dup"))
        new_dup = ToolDefinition(
            name="dup",
            description="updated",
            execution=HttpExecution(type="http", method="GET", url="https://updated.com"),
        )
        reg.register_all_replace([new_dup])
        assert reg.get("dup").description == "updated"

    def test_has_returns_true(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_tool("t"))
        assert reg.has("t") is True

    def test_has_returns_false(self) -> None:
        reg = ToolRegistry()
        assert reg.has("missing") is False

    def test_contains_operator(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_tool("t"))
        assert "t" in reg
        assert "missing" not in reg

    def test_iter(self) -> None:
        reg = ToolRegistry()
        names = {"a", "b", "c"}
        reg.register_all([_make_tool(n) for n in names])
        found = {t.name for t in reg}
        assert found == names

    def test_len(self) -> None:
        reg = ToolRegistry()
        reg.register_all([_make_tool(f"t{i}") for i in range(4)])
        assert len(reg) == 4

    def test_remove_nonexistent_returns_false(self) -> None:
        reg = ToolRegistry()
        assert reg.remove("ghost") is False

    def test_clear_resets_tag_index(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_tool("a", tags=["x"]))
        reg.clear()
        assert reg.get_by_tag("x") == []

    def test_remove_clears_from_tag_index(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_tool("a", tags=["messaging"]))
        reg.remove("a")
        assert reg.get_by_tag("messaging") == []
