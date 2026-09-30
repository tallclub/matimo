"""Unit tests for tool_selection/run_eval.py."""

from __future__ import annotations

from pathlib import Path

import pytest

from matimo_evals.tool_selection.run_eval import (
    has_failures,
    print_report,
    run_tool_selection_eval,
)

FIXTURES_ROOT = Path(__file__).parent.parent / "fixtures"


class TestRunToolSelectionEval:
    def test_passes_cleanly_against_well_formed_set(self) -> None:
        result = run_tool_selection_eval(FIXTURES_ROOT / "packages")
        assert result.tool_corpus_size == 3
        assert result.fixture_count == 3
        assert result.case_count == 3
        assert result.unknown_tools == []
        assert result.param_mismatches == []
        assert result.aggregate.failures == []
        assert result.aggregate.precision == 1.0

    def test_flags_fixture_whose_tool_is_not_in_corpus(self) -> None:
        result = run_tool_selection_eval(FIXTURES_ROOT / "packages-unknown-tool")
        assert len(result.unknown_tools) == 1
        assert "demo-get-widget" in result.unknown_tools[0]
        assert result.case_count == 0

    def test_flags_expected_required_params_not_actually_required(self) -> None:
        result = run_tool_selection_eval(FIXTURES_ROOT / "packages-param-mismatch")
        assert len(result.param_mismatches) == 1
        assert result.param_mismatches[0].missing_from_schema == ["not_a_real_param"]

    def test_flags_case_missing_its_recall_band(self) -> None:
        result = run_tool_selection_eval(FIXTURES_ROOT / "packages-recall-miss")
        assert len(result.aggregate.failures) == 1
        assert result.aggregate.failures[0].expected_tool == "demo-get-widget"
        assert result.aggregate.failures[0].rank != 1


class TestHasFailures:
    def test_false_for_clean_result(self) -> None:
        result = run_tool_selection_eval(FIXTURES_ROOT / "packages")
        assert has_failures(result) is False

    def test_true_for_unknown_tools_param_mismatches_or_recall_misses(self) -> None:
        assert (
            has_failures(
                run_tool_selection_eval(FIXTURES_ROOT / "packages-unknown-tool")
            )
            is True
        )
        assert (
            has_failures(
                run_tool_selection_eval(FIXTURES_ROOT / "packages-param-mismatch")
            )
            is True
        )
        assert (
            has_failures(
                run_tool_selection_eval(FIXTURES_ROOT / "packages-recall-miss")
            )
            is True
        )


class TestPrintReport:
    def test_prints_passing_summary(self, capsys: pytest.CaptureFixture[str]) -> None:
        result = run_tool_selection_eval(FIXTURES_ROOT / "packages")
        print_report(result)
        out = capsys.readouterr().out
        assert "Tool-selection eval passed" in out

    def test_prints_unknown_tool_diagnostics(
        self, capsys: pytest.CaptureFixture[str]
    ) -> None:
        result = run_tool_selection_eval(FIXTURES_ROOT / "packages-unknown-tool")
        print_report(result)
        out = capsys.readouterr().out
        assert "not found in the corpus" in out

    def test_prints_param_mismatch_diagnostics(
        self, capsys: pytest.CaptureFixture[str]
    ) -> None:
        result = run_tool_selection_eval(FIXTURES_ROOT / "packages-param-mismatch")
        print_report(result)
        out = capsys.readouterr().out
        assert "not required in schema" in out

    def test_prints_recall_miss_diagnostics(
        self, capsys: pytest.CaptureFixture[str]
    ) -> None:
        result = run_tool_selection_eval(FIXTURES_ROOT / "packages-recall-miss")
        print_report(result)
        out = capsys.readouterr().out
        assert "missed their recall band" in out
        assert "Tool-selection eval failed" in out
