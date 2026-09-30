"""Unit tests for tool_selection/fixtures.py."""

from __future__ import annotations

from pathlib import Path

import pytest

from matimo_evals.tool_selection.fixtures import load_fixtures

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures" / "packages"


class TestLoadFixtures:
    def test_loads_every_eval_yaml_under_evals_dirs(self) -> None:
        fixtures = load_fixtures(FIXTURES_DIR)
        tools = sorted(f.tool for f in fixtures)
        assert tools == ["demo-get-widget", "demo-list-widgets", "demo-send-widget"]

    def test_records_package_and_path(self) -> None:
        fixtures = load_fixtures(FIXTURES_DIR)
        assert all(f.package_name == "demo" for f in fixtures)
        assert all(f.fixture_path.endswith(".eval.yaml") for f in fixtures)

    def test_rejects_fixture_missing_tool_or_cases(self, tmp_path: Path) -> None:
        evals_dir = tmp_path / "demo" / "evals"
        evals_dir.mkdir(parents=True)
        (evals_dir / "broken.eval.yaml").write_text("not_a_tool_field: true\n")

        with pytest.raises(ValueError, match="Invalid eval fixture"):
            load_fixtures(tmp_path)

    def test_rejects_fixture_that_parses_to_null(self, tmp_path: Path) -> None:
        evals_dir = tmp_path / "demo" / "evals"
        evals_dir.mkdir(parents=True)
        (evals_dir / "null.eval.yaml").write_text("null\n")

        with pytest.raises(ValueError, match="Invalid eval fixture"):
            load_fixtures(tmp_path)
