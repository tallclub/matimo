"""Unit tests for core/response_size_guardrail.py."""
from __future__ import annotations

from matimo.core.models import HttpExecution, OutputSchema, ToolDefinition
from matimo.core.response_size_guardrail import (
    DEFAULT_MAX_RESPONSE_SIZE_BYTES,
    apply_response_size_guardrail,
)


def _make_tool(output_schema: OutputSchema | None = None) -> ToolDefinition:
    return ToolDefinition(
        name="test-tool",
        description="Test",
        execution=HttpExecution(type="http", method="GET", url="https://api.example.com"),
        output_schema=output_schema,
    )


class TestApplyResponseSizeGuardrail:
    def test_small_result_unchanged(self) -> None:
        tool = _make_tool()
        result = {"success": True, "data": {"id": 1}}
        assert apply_response_size_guardrail(tool, result) == result

    def test_truncates_large_array_with_correct_marker(self) -> None:
        tool = _make_tool()
        items = [{"id": i, "name": f"item-{i}", "description": "x" * 50} for i in range(5000)]

        result = apply_response_size_guardrail(tool, items, 5_000)

        assert isinstance(result, list)
        marker = result[-1]
        assert isinstance(marker, str)
        assert marker.endswith("of 5000 items shown")
        shown_count = len(result) - 1
        assert f"...truncated, {shown_count} of 5000 items shown" == marker
        assert 0 < shown_count < len(items)

    def test_array_already_fitting_budget_unchanged(self) -> None:
        tool = _make_tool()
        items = [{"id": 1}, {"id": 2}, {"id": 3}]
        assert apply_response_size_guardrail(tool, items, 10_000) == items

    def test_truncates_long_string(self) -> None:
        tool = _make_tool()
        long_string = "a" * 10_000
        result = apply_response_size_guardrail(tool, long_string, 500)
        assert len(result) < len(long_string)
        assert "of 10000 characters shown" in result

    def test_truncates_nested_object_preserves_small_fields_and_marks_once(self) -> None:
        tool = _make_tool()
        result = {
            "success": True,
            "statusCode": 200,
            "headers": {"content-type": "application/json"},
            "data": [{"id": i, "payload": "y" * 100} for i in range(2000)],
        }

        truncated = apply_response_size_guardrail(tool, result, 5_000)

        assert truncated["success"] is True
        assert truncated["statusCode"] == 200
        assert truncated["headers"] == {"content-type": "application/json"}
        assert isinstance(truncated["data"], list)
        assert len(truncated["data"]) < 2001
        assert truncated["_truncated"] is True

    def test_respects_per_tool_output_schema_override(self) -> None:
        tool = _make_tool(output_schema=OutputSchema(max_response_size=200))
        items = [{"id": i, "name": f"item-{i}"} for i in range(100)]

        # Instance default is huge, but the per-tool override (200 bytes) should win.
        result = apply_response_size_guardrail(tool, items, 1_000_000)
        assert len(result) < len(items) + 1

    def test_respects_instance_level_default_when_no_per_tool_override(self) -> None:
        tool = _make_tool()
        items = [{"id": i, "name": f"item-{i}"} for i in range(100)]
        result = apply_response_size_guardrail(tool, items, 200)
        assert len(result) < len(items) + 1

    def test_falls_back_to_default_constant(self) -> None:
        tool = _make_tool()
        small = {"ok": True}
        assert apply_response_size_guardrail(tool, small) == small

        huge = [{"id": i, "blob": "z" * 50} for i in range(200_000)]
        result = apply_response_size_guardrail(tool, huge)
        assert len(result) < len(huge) + 1
        assert DEFAULT_MAX_RESPONSE_SIZE_BYTES == 262_144

    def test_never_removes_or_renames_existing_keys(self) -> None:
        tool = _make_tool()
        result = {
            "success": True,
            "data": [{"id": i, "blob": "q" * 100} for i in range(1000)],
            "statusCode": 200,
            "headers": {},
        }
        truncated = apply_response_size_guardrail(tool, result, 2_000)
        assert set(["success", "data", "statusCode", "headers"]).issubset(truncated.keys())
