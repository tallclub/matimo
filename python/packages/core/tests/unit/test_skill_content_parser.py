"""Unit tests for core/skill_content_parser.py."""
from __future__ import annotations

from matimo.core.models import SkillContentOptions
from matimo.core.skill_content_parser import (
    ParsedSkillContent,
    extract_skill_content,
    list_skill_sections,
    parse_skill_sections,
)


class TestParseSkillSections:
    def test_empty_body_returns_empty_result(self) -> None:
        result = parse_skill_sections("")
        assert result.preamble == ""
        assert result.sections == []
        assert result.total_tokens == 0

    def test_whitespace_only_returns_empty_result(self) -> None:
        result = parse_skill_sections("   \n\t  ")
        assert result.sections == []

    def test_preamble_only(self) -> None:
        body = "This is the intro text with some words."
        result = parse_skill_sections(body)
        assert result.preamble == body
        assert result.preamble_tokens > 0
        assert result.sections == []

    def test_single_heading(self) -> None:
        body = "# Overview\n\nThis section describes the skill."
        result = parse_skill_sections(body)
        assert len(result.sections) == 1
        assert result.sections[0].heading == "Overview"
        assert result.sections[0].level == 1
        assert "describes" in result.sections[0].content

    def test_multiple_top_level_headings(self) -> None:
        body = "# Section One\n\nContent one.\n\n# Section Two\n\nContent two."
        result = parse_skill_sections(body)
        assert len(result.sections) == 2
        assert result.sections[0].heading == "Section One"
        assert result.sections[1].heading == "Section Two"

    def test_nested_headings_become_children(self) -> None:
        body = "# Parent\n\n## Child\n\nChild content."
        result = parse_skill_sections(body)
        assert len(result.sections) == 1
        parent = result.sections[0]
        assert len(parent.children) == 1
        assert parent.children[0].heading == "Child"

    def test_deeply_nested_headings(self) -> None:
        body = "# H1\n\n## H2\n\n### H3\n\nDeep content."
        result = parse_skill_sections(body)
        h1 = result.sections[0]
        assert h1.heading == "H1"
        h2 = h1.children[0]
        assert h2.heading == "H2"
        h3 = h2.children[0]
        assert h3.heading == "H3"

    def test_heading_inside_code_block_ignored(self) -> None:
        body = "# Real Heading\n\n```python\n# not a heading\ncode here\n```"
        result = parse_skill_sections(body)
        assert len(result.sections) == 1
        assert result.sections[0].heading == "Real Heading"

    def test_preamble_before_first_heading(self) -> None:
        body = "Intro text.\n\n# First Section\n\nContent."
        result = parse_skill_sections(body)
        assert "Intro" in result.preamble
        assert len(result.sections) == 1

    def test_index_contains_all_sections(self) -> None:
        body = "# Alpha\n\n## Beta\n\n# Gamma"
        result = parse_skill_sections(body)
        assert "alpha" in result.index
        assert "gamma" in result.index
        # Nested section path is "Alpha.Beta"
        assert "alpha.beta" in result.index

    def test_total_tokens_positive_for_content(self) -> None:
        body = "# Section\n\nLots of words here to count as tokens for testing."
        result = parse_skill_sections(body)
        assert result.total_tokens > 0

    def test_section_path_is_heading(self) -> None:
        body = "# My Section\n\nContent."
        result = parse_skill_sections(body)
        assert result.sections[0].path == "My Section"

    def test_nested_section_path_uses_dot_notation(self) -> None:
        body = "# Parent\n\n## Child Section\n\nContent."
        result = parse_skill_sections(body)
        child = result.sections[0].children[0]
        assert child.path == "Parent.Child Section"

    def test_h2_h2_siblings_not_nested(self) -> None:
        body = "## First\n\none.\n\n## Second\n\ntwo."
        result = parse_skill_sections(body)
        assert len(result.sections) == 2

    def test_h3_after_h1_becomes_child_through_stack(self) -> None:
        body = "# H1\n\n### H3 direct child\n\ncontent."
        result = parse_skill_sections(body)
        # H3 should nest under H1 because no H2 in stack
        assert len(result.sections[0].children) == 1


class TestExtractSkillContent:
    def _parse(self, body: str) -> ParsedSkillContent:
        return parse_skill_sections(body)

    def test_no_options_returns_all_sections(self) -> None:
        body = "# A\n\nContent A.\n\n# B\n\nContent B."
        parsed = self._parse(body)
        result = extract_skill_content(parsed)
        assert "Content A" in result
        assert "Content B" in result

    def test_include_preamble_false_excludes_preamble(self) -> None:
        body = "Intro text.\n\n# Section\n\nContent."
        parsed = self._parse(body)
        result = extract_skill_content(parsed, SkillContentOptions(include_preamble=False))
        assert "Intro" not in result
        assert "Content" in result

    def test_include_preamble_true_includes_preamble(self) -> None:
        body = "Intro text.\n\n# Section\n\nBody."
        parsed = self._parse(body)
        result = extract_skill_content(parsed, SkillContentOptions(include_preamble=True))
        assert "Intro" in result

    def test_sections_filter_returns_only_requested(self) -> None:
        body = "# Alpha\n\nContent A.\n\n# Beta\n\nContent B."
        parsed = self._parse(body)
        result = extract_skill_content(parsed, SkillContentOptions(sections=["Alpha"]))
        assert "Content A" in result
        assert "Content B" not in result

    def test_sections_partial_match(self) -> None:
        body = "# Usage Examples\n\nHere are some examples."
        parsed = self._parse(body)
        result = extract_skill_content(parsed, SkillContentOptions(sections=["examples"]))
        assert "Here are some examples" in result

    def test_max_tokens_limits_output(self) -> None:
        # Each section has many words — max_tokens will cut them off
        many_words = " ".join(["word"] * 100)
        body = f"# Section1\n\n{many_words}\n\n# Section2\n\n{many_words}"
        parsed = self._parse(body)
        result_full = extract_skill_content(parsed)
        result_limited = extract_skill_content(parsed, SkillContentOptions(max_tokens=5))
        assert len(result_limited) < len(result_full)

    def test_max_depth_limits_children(self) -> None:
        body = "# H1\n\n## H2\n\n### H3\n\nDeep content."
        parsed = self._parse(body)
        result_shallow = extract_skill_content(parsed, SkillContentOptions(max_depth=1))
        result_deep = extract_skill_content(parsed)
        # Shallow should not include H3 content
        assert "Deep content" not in result_shallow
        assert "Deep content" in result_deep

    def test_empty_parsed_returns_empty_string(self) -> None:
        parsed = ParsedSkillContent()
        result = extract_skill_content(parsed)
        assert result == ""

    def test_section_not_found_gracefully_skipped(self) -> None:
        body = "# Real Section\n\nContent."
        parsed = self._parse(body)
        result = extract_skill_content(parsed, SkillContentOptions(sections=["nonexistent"]))
        assert result == ""


class TestListSkillSections:
    def test_empty_returns_empty_list(self) -> None:
        parsed = ParsedSkillContent()
        result = list_skill_sections(parsed)
        assert result == []

    def test_returns_flat_list_with_metadata(self) -> None:
        body = "# Section One\n\nWords here.\n\n# Section Two\n\nMore words."
        parsed = parse_skill_sections(body)
        result = list_skill_sections(parsed)
        assert len(result) == 2
        assert result[0]["path"] == "Section One"
        assert result[0]["level"] == 1
        assert "token_estimate" in result[0]

    def test_nested_sections_included_flat(self) -> None:
        body = "# Parent\n\n## Child\n\n### Grandchild\n\nContent."
        parsed = parse_skill_sections(body)
        result = list_skill_sections(parsed)
        assert len(result) == 3
        paths = [r["path"] for r in result]
        assert "Parent" in paths
        assert "Parent.Child" in paths
        assert "Parent.Child.Grandchild" in paths

    def test_token_estimates_are_non_negative(self) -> None:
        body = "# Section\n\nSome content words."
        parsed = parse_skill_sections(body)
        result = list_skill_sections(parsed)
        for item in result:
            assert item["token_estimate"] >= 0
