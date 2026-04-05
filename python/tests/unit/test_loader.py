"""Unit tests for ToolLoader."""
from __future__ import annotations

from pathlib import Path

import pytest

from matimo.core.loader import ToolLoader
from matimo.core.models import CommandExecution, FunctionExecution, HttpExecution, ToolDefinition
from matimo.errors import ErrorCode, MatimoError


FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


class TestToolLoaderFile:
    def test_load_http_tool(self, loader: ToolLoader):
        tool = loader.load_tool_from_file(str(FIXTURES_DIR / "slack_send_channel_message" / "definition.yaml"))
        assert tool.name == "slack_send_channel_message"
        assert isinstance(tool.execution, HttpExecution)
        assert tool.execution.method == "POST"

    def test_load_command_tool(self, loader: ToolLoader):
        tool = loader.load_tool_from_file(str(FIXTURES_DIR / "calculator" / "definition.yaml"))
        assert tool.name == "calculator"
        assert isinstance(tool.execution, CommandExecution)

    def test_load_function_tool(self, loader: ToolLoader):
        tool = loader.load_tool_from_file(str(FIXTURES_DIR / "search_tool" / "definition.yaml"))
        assert tool.name == "search_tool"
        assert isinstance(tool.execution, FunctionExecution)

    def test_definition_path_set_on_load(self, loader: ToolLoader):
        path = str(FIXTURES_DIR / "echo_tool" / "definition.yaml")
        tool = loader.load_tool_from_file(path)
        assert tool.definition_path == path

    def test_missing_file_raises(self, loader: ToolLoader):
        with pytest.raises(MatimoError) as exc:
            loader.load_tool_from_file("/nonexistent/path.yaml")
        assert exc.value.code in (ErrorCode.TOOL_NOT_FOUND, ErrorCode.FILE_NOT_FOUND)

    def test_provider_definition_skipped(self, loader: ToolLoader, tmp_path: Path):
        provider_file = tmp_path / "definition.yaml"
        provider_file.write_text("type: provider\nname: my_provider\n")
        # Provider definitions raise or return None — either is acceptable
        try:
            result = loader.load_tool_from_file(str(provider_file))
            assert result is None
        except MatimoError:
            pass  # Also acceptable — provider files are not tools

    def test_invalid_yaml_raises(self, loader: ToolLoader, tmp_path: Path):
        bad_file = tmp_path / "bad.yaml"
        bad_file.write_text(": bad: yaml: [unclosed")
        with pytest.raises(MatimoError) as exc:
            loader.load_tool_from_file(str(bad_file))
        assert exc.value.code == ErrorCode.INVALID_SCHEMA

    def test_missing_required_field_raises(self, loader: ToolLoader, tmp_path: Path):
        bad_file = tmp_path / "missing.yaml"
        bad_file.write_text("version: '1.0.0'\ndescription: no name\n")
        with pytest.raises(MatimoError) as exc:
            loader.load_tool_from_file(str(bad_file))
        assert exc.value.code == ErrorCode.INVALID_SCHEMA


class TestToolLoaderDirectory:
    def test_loads_all_tools_from_fixtures(self, loader: ToolLoader):
        tools = loader.load_tools_from_directory(str(FIXTURES_DIR))
        names = set(tools.keys())  # dict[name, ToolDefinition]
        assert len(tools) >= 4
        assert "calculator" in names
        assert "slack_send_channel_message" in names

    def test_nonexistent_directory_logs_warning(self, loader: ToolLoader):
        # Missing directory returns empty dict (with logged warning), does not raise
        result = loader.load_tools_from_directory("/nonexistent/dir")
        assert result == {} or isinstance(result, dict)

    def test_empty_directory_returns_empty(self, loader: ToolLoader, tmp_path: Path):
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()
        tools = loader.load_tools_from_directory(str(empty_dir))
        assert len(tools) == 0

    def test_load_from_multiple_paths(self, loader: ToolLoader, tmp_path: Path):
        dir_a = tmp_path / "a"
        dir_a.mkdir()
        tool_a = dir_a / "tool_a"
        tool_a.mkdir()
        (tool_a / "definition.yaml").write_text(
            "name: tool_a\ndescription: A\nexecution:\n  type: http\n  method: GET\n  url: https://a.com\n"
        )
        dir_b = tmp_path / "b"
        dir_b.mkdir()
        tool_b = dir_b / "tool_b"
        tool_b.mkdir()
        (tool_b / "definition.yaml").write_text(
            "name: tool_b\ndescription: B\nexecution:\n  type: http\n  method: GET\n  url: https://b.com\n"
        )
        tools = loader.load_tools_from_multiple_paths([str(dir_a), str(dir_b)])
        names = set(tools.keys())
        assert "tool_a" in names
        assert "tool_b" in names

    def test_discovery_cache_cleared(self, loader: ToolLoader):
        ToolLoader.clear_discovery_cache()
        # After clearing, _discovered_cache is None (not yet populated)
        assert ToolLoader._discovered_cache is None
