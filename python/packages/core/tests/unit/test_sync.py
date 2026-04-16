"""Unit tests for MatimoSync synchronous wrapper."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from matimo.core.models import HttpExecution, Parameter, ParameterType, ToolDefinition
from matimo.errors import ErrorCode, MatimoError


def _make_tool(name: str = "test_tool") -> ToolDefinition:
    """Create a test tool definition."""
    return ToolDefinition(
        name=name,
        description=f"Test tool {name}",
        parameters={
            "input": Parameter(type=ParameterType.STRING, description="input", required=True)
        },
        execution=HttpExecution(type="http", method="GET", url="https://example.com"),
    )


class TestMatimoSyncFactory:
    """Tests for MatimoSync.init factory method."""

    def test_init_creates_instance(self, tmp_path: Path) -> None:
        """Test that init creates a MatimoSync instance."""
        from matimo import MatimoSync

        # Create a minimal tools directory
        tools_dir = tmp_path / "tools"
        tools_dir.mkdir()

        m = MatimoSync.init(str(tools_dir))
        assert m is not None
        assert hasattr(m, "_instance")

    def test_init_with_auto_discover(self) -> None:
        """Test that init works with auto_discover=True."""
        from matimo import MatimoSync

        m = MatimoSync.init(auto_discover=True)
        assert m is not None

    def test_init_stores_instance(self, tmp_path: Path) -> None:
        """Test that init stores the async instance."""
        from matimo import MatimoSync

        tools_dir = tmp_path / "tools"
        tools_dir.mkdir()

        m = MatimoSync.init(str(tools_dir))
        assert m.async_instance is not None


class TestMatimoSyncExecute:
    """Tests for MatimoSync.execute method."""

    def test_execute_returns_result(self, tmp_path: Path) -> None:
        """Test that execute synchronously returns tool results."""
        from matimo import MatimoSync

        tools_dir = tmp_path / "tools"
        tools_dir.mkdir()

        m = MatimoSync.init(str(tools_dir))

        # Mock the async execute to test the sync wrapper
        expected_result = {"success": True, "data": "test"}
        m._instance.execute = AsyncMock(return_value=expected_result)

        result = m.execute("test_tool", {"param": "value"})
        assert result == expected_result

    def test_execute_with_empty_params(self, tmp_path: Path) -> None:
        """Test execute with None params defaults to empty dict."""
        from matimo import MatimoSync

        tools_dir = tmp_path / "tools"
        tools_dir.mkdir()

        m = MatimoSync.init(str(tools_dir))
        m._instance.execute = AsyncMock(return_value={"ok": True})

        result = m.execute("test_tool")
        m._instance.execute.assert_called_once()
        assert result == {"ok": True}

    def test_execute_passes_kwargs(self, tmp_path: Path) -> None:
        """Test that execute passes credential kwargs through."""
        from matimo import MatimoSync

        tools_dir = tmp_path / "tools"
        tools_dir.mkdir()

        m = MatimoSync.init(str(tools_dir))
        m._instance.execute = AsyncMock(return_value={"ok": True})

        m.execute(
            "test_tool", {"param": "value"}, credentials={"key": "secret"}
        )
        m._instance.execute.assert_called_once_with(
            "test_tool", {"param": "value"}, credentials={"key": "secret"}
        )

    def test_execute_handles_exceptions(self, tmp_path: Path) -> None:
        """Test that execute propagates exceptions from async layer."""
        from matimo import MatimoSync

        tools_dir = tmp_path / "tools"
        tools_dir.mkdir()

        m = MatimoSync.init(str(tools_dir))
        m._instance.execute = AsyncMock(
            side_effect=MatimoError(
                "Tool not found", ErrorCode.TOOL_NOT_FOUND
            )
        )

        with pytest.raises(MatimoError):
            m.execute("nonexistent_tool")


class TestMatimoSyncListTools:
    """Tests for MatimoSync.list_tools method."""

    def test_list_tools_returns_tools(self, tmp_path: Path) -> None:
        """Test that list_tools returns tool definitions."""
        from matimo import MatimoSync

        tools_dir = tmp_path / "tools"
        tools_dir.mkdir()

        m = MatimoSync.init(str(tools_dir))
        tools = m.list_tools()
        assert isinstance(tools, list)

    def test_list_tools_calls_instance_method(self, tmp_path: Path) -> None:
        """Test that list_tools delegates to instance."""
        from matimo import MatimoSync

        tools_dir = tmp_path / "tools"
        tools_dir.mkdir()

        m = MatimoSync.init(str(tools_dir))
        test_tools = [_make_tool("tool1"), _make_tool("tool2")]
        m._instance.list_tools = MagicMock(return_value=test_tools)

        result = m.list_tools()
        assert len(result) == 2
        assert result[0].name == "tool1"
        assert result[1].name == "tool2"


class TestMatimoSyncSearchTools:
    """Tests for MatimoSync.search_tools method."""

    def test_search_tools_returns_results(self, tmp_path: Path) -> None:
        """Test that search_tools returns search results."""
        from matimo import MatimoSync

        tools_dir = tmp_path / "tools"
        tools_dir.mkdir()

        m = MatimoSync.init(str(tools_dir))
        results = m.search_tools("test")
        assert isinstance(results, list)

    def test_search_tools_delegates_to_instance(self, tmp_path: Path) -> None:
        """Test that search_tools delegates to instance."""
        from matimo import MatimoSync

        tools_dir = tmp_path / "tools"
        tools_dir.mkdir()

        m = MatimoSync.init(str(tools_dir))
        test_results = [_make_tool("matching_tool")]
        m._instance.search_tools = MagicMock(return_value=test_results)

        result = m.search_tools("matching")
        assert len(result) == 1
        m._instance.search_tools.assert_called_once_with("matching")


class TestMatimoSyncReload:
    """Tests for MatimoSync.reload method."""

    def test_reload_calls_instance_method(self, tmp_path: Path) -> None:
        """Test that reload delegates to async instance."""
        from matimo import MatimoSync

        tools_dir = tmp_path / "tools"
        tools_dir.mkdir()

        m = MatimoSync.init(str(tools_dir))
        m._instance.reload = AsyncMock(return_value={"reloaded": True})

        m.reload()
        m._instance.reload.assert_called_once()


class TestMatimoSyncAsyncProperty:
    """Tests for MatimoSync.async_instance property."""

    def test_async_instance_property(self, tmp_path: Path) -> None:
        """Test that async_instance property returns the underlying instance."""
        from matimo import MatimoSync

        tools_dir = tmp_path / "tools"
        tools_dir.mkdir()

        m = MatimoSync.init(str(tools_dir))
        async_instance = m.async_instance

        assert async_instance is not None
        assert async_instance == m._instance
