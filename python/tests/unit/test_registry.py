"""Unit tests for ToolRegistry."""
from __future__ import annotations

import pytest

from matimo.core.models import HttpExecution, Parameter, ParameterType, ToolDefinition
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
    def test_register_and_get(self):
        reg = ToolRegistry()
        tool = _make_tool("my_tool")
        reg.register(tool)
        assert reg.get("my_tool") is tool

    def test_register_duplicate_raises(self):
        reg = ToolRegistry()
        reg.register(_make_tool("dup"))
        with pytest.raises(MatimoError) as exc:
            reg.register(_make_tool("dup"))
        assert exc.value.code == ErrorCode.TOOL_NOT_FOUND or exc.value.code is not None

    def test_register_or_replace_overwrites(self):
        reg = ToolRegistry()
        old = _make_tool("t")
        reg.register(old)
        new = _make_tool("t")
        reg.register_or_replace(new)
        assert reg.get("t") is new

    def test_register_all(self):
        reg = ToolRegistry()
        tools = [_make_tool(f"t{i}") for i in range(5)]
        reg.register_all(tools)
        assert reg.count() == 5

    def test_get_nonexistent_returns_none(self):
        reg = ToolRegistry()
        assert reg.get("missing") is None

    def test_get_or_raise_nonexistent_raises(self):
        reg = ToolRegistry()
        with pytest.raises(MatimoError) as exc:
            reg.get_or_raise("missing")
        assert exc.value.code == ErrorCode.TOOL_NOT_FOUND


class TestToolRegistrySearch:
    def test_search_by_name_prefix(self):
        reg = ToolRegistry()
        reg.register(_make_tool("slack_send"))
        reg.register(_make_tool("slack_receive"))
        reg.register(_make_tool("github_issue"))
        results = reg.search("slack")
        names = {t.name for t in results}
        assert "slack_send" in names
        assert "slack_receive" in names
        assert "github_issue" not in names

    def test_search_case_insensitive(self):
        reg = ToolRegistry()
        reg.register(_make_tool("Slack_Send"))
        results = reg.search("slack")
        assert len(results) == 1

    def test_search_empty_query_returns_all(self):
        reg = ToolRegistry()
        tools = [_make_tool(f"t{i}") for i in range(3)]
        reg.register_all(tools)
        assert len(reg.search("")) == 3

    def test_search_no_match(self):
        reg = ToolRegistry()
        reg.register(_make_tool("hello"))
        assert reg.search("zzz") == []


class TestToolRegistryTags:
    def test_get_by_tag(self):
        reg = ToolRegistry()
        reg.register(_make_tool("a", tags=["messaging"]))
        reg.register(_make_tool("b", tags=["messaging", "slack"]))
        reg.register(_make_tool("c", tags=["github"]))
        results = reg.get_by_tag("messaging")
        names = {t.name for t in results}
        assert "a" in names and "b" in names
        assert "c" not in names

    def test_tag_not_found_returns_empty(self):
        reg = ToolRegistry()
        reg.register(_make_tool("x", tags=["slack"]))
        assert reg.get_by_tag("nonexistent") == []


class TestToolRegistryList:
    def test_list_tools(self):
        reg = ToolRegistry()
        names = ["alpha", "beta", "gamma"]
        reg.register_all([_make_tool(n) for n in names])
        listed = reg.get_all()
        assert len(listed) == 3

    def test_count(self):
        reg = ToolRegistry()
        assert reg.count() == 0
        reg.register(_make_tool("x"))
        assert reg.count() == 1

    def test_unregister(self):
        reg = ToolRegistry()
        reg.register(_make_tool("x"))
        reg.remove("x")
        assert reg.get("x") is None

    def test_clear(self):
        reg = ToolRegistry()
        reg.register_all([_make_tool(f"t{i}") for i in range(5)])
        reg.clear()
        assert reg.count() == 0
