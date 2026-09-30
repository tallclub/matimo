"""Unit tests for tool_selection/tool_corpus.py."""

from __future__ import annotations

from pathlib import Path

from matimo_evals.tool_selection.tool_corpus import load_tool_corpus, to_corpus_entry

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures" / "packages"


class TestLoadToolCorpus:
    def test_loads_and_validates_every_definition(self) -> None:
        tools = load_tool_corpus(FIXTURES_DIR)
        names = sorted(t.definition.name for t in tools)
        assert names == ["demo-get-widget", "demo-list-widgets", "demo-send-widget"]

    def test_records_which_package_each_tool_came_from(self) -> None:
        tools = load_tool_corpus(FIXTURES_DIR)
        assert all(t.package_name == "demo" for t in tools)

    def test_skips_provider_level_definitions(self, tmp_path: Path) -> None:
        # Built ephemerally (not a static fixture) so this minimal, deliberately
        # incomplete `type: provider` stub never gets swept up by
        # scripts/validate_tools.py's repo-wide, unscoped recursive walk.
        tool_dir = (
            tmp_path / "demo" / "src" / "matimo_demo" / "tools" / "demo-get-widget"
        )
        tool_dir.mkdir(parents=True)
        (tool_dir / "definition.yaml").write_text(
            (
                FIXTURES_DIR
                / "demo"
                / "src"
                / "matimo_demo"
                / "tools"
                / "demo-get-widget"
                / "definition.yaml"
            ).read_text()
        )

        provider_dir = (
            tmp_path / "demo" / "src" / "matimo_demo" / "tools" / "demo-provider-def"
        )
        provider_dir.mkdir(parents=True)
        (provider_dir / "definition.yaml").write_text(
            "type: provider\nname: demo-provider\n"
        )

        tools = load_tool_corpus(tmp_path)
        assert [t.definition.name for t in tools] == ["demo-get-widget"]


class TestToCorpusEntry:
    def test_flattens_name_description_and_parameter_descriptions(self) -> None:
        tools = load_tool_corpus(FIXTURES_DIR)
        tool = next(t for t in tools if t.definition.name == "demo-get-widget")
        entry = to_corpus_entry(tool.definition)
        assert entry.name == tool.definition.name
        assert entry.description == tool.definition.description
        assert len(entry.parameter_descriptions) > 0

    def test_handles_tool_with_no_parameters(self) -> None:
        tools = load_tool_corpus(FIXTURES_DIR)
        tool = next(t for t in tools if t.definition.name == "demo-list-widgets")
        entry = to_corpus_entry(tool.definition)
        assert entry.parameter_descriptions == []
