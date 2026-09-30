"""
Fixture coverage meta-test — mirrors:
typescript/packages/evals/test/unit/fixture-coverage.test.ts

Unlike the TypeScript SDK, Python has no auto-routed Composio catalog yet,
so every tool in the real workspace needs a fixture — no exclusion list.
"""

from __future__ import annotations

from pathlib import Path

from matimo_evals.tool_selection.fixtures import load_fixtures
from matimo_evals.tool_selection.tool_corpus import load_tool_corpus

# The real, live workspace catalog — not tests/fixtures — since this test's
# whole point is confirming coverage of the actual tools shipping here.
PACKAGES_DIR = Path(__file__).resolve().parents[3]


class TestFixtureCoverage:
    def test_every_tool_has_an_eval_fixture(self) -> None:
        tools = load_tool_corpus(PACKAGES_DIR)
        fixtures = load_fixtures(PACKAGES_DIR)
        fixtured_tool_names = {f.tool for f in fixtures}

        missing = sorted(
            f"{t.package_name}/{t.definition.name}"
            for t in tools
            if t.definition.name not in fixtured_tool_names
        )

        assert missing == []

    def test_sanity_corpus_is_not_empty(self) -> None:
        tools = load_tool_corpus(PACKAGES_DIR)
        assert len(tools) > 0
