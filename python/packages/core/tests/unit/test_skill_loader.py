"""Unit tests for core/skill_loader.py."""
from __future__ import annotations

from pathlib import Path

import pytest

from matimo.core.skill_loader import (
    SkillLoader,
    _extract_frontmatter,
    _list_bundled_resources,
    _validate_skill_name,
    extract_skill_metadata,
    parse_skill_content,
)
from matimo.errors import ErrorCode, MatimoError

# ---------------------------------------------------------------------------
# _validate_skill_name
# ---------------------------------------------------------------------------


class TestValidateSkillName:
    def test_valid_simple_name(self) -> None:
        assert _validate_skill_name("my-skill") is None

    def test_valid_alphanumeric(self) -> None:
        assert _validate_skill_name("skill123") is None

    def test_valid_single_char(self) -> None:
        assert _validate_skill_name("a") is None

    def test_empty_returns_error(self) -> None:
        assert _validate_skill_name("") is not None

    def test_whitespace_only_returns_error(self) -> None:
        assert _validate_skill_name("   ") is not None

    def test_starts_with_hyphen_returns_error(self) -> None:
        assert _validate_skill_name("-bad") is not None

    def test_ends_with_hyphen_returns_error(self) -> None:
        assert _validate_skill_name("bad-") is not None

    def test_consecutive_hyphens_returns_error(self) -> None:
        assert _validate_skill_name("bad--name") is not None

    def test_uppercase_not_allowed(self) -> None:
        assert _validate_skill_name("MySkill") is not None

    def test_too_long_returns_error(self) -> None:
        long_name = "a" * 65
        assert _validate_skill_name(long_name) is not None

    def test_max_length_ok(self) -> None:
        # Exactly 64 chars should be fine
        ok_name = "a" * 64
        assert _validate_skill_name(ok_name) is None

    def test_spaces_not_allowed(self) -> None:
        assert _validate_skill_name("my skill") is not None

    def test_underscore_not_allowed(self) -> None:
        assert _validate_skill_name("my_skill") is not None


# ---------------------------------------------------------------------------
# _extract_frontmatter
# ---------------------------------------------------------------------------

_VALID_FM = """\
---
name: my-skill
description: A test skill
---
## Body here
"""


class TestExtractFrontmatter:
    def test_valid_frontmatter(self) -> None:
        fm, body, error = _extract_frontmatter(_VALID_FM)
        assert error is None
        assert fm is not None
        assert fm.name == "my-skill"
        assert body is not None
        assert "Body" in body

    def test_no_frontmatter_delimiter_returns_error(self) -> None:
        fm, body, error = _extract_frontmatter("just plain text")
        assert error is not None
        assert fm is None

    def test_missing_closing_delimiter_returns_error(self) -> None:
        content = "---\nname: x\ndescription: y\n"
        fm, body, error = _extract_frontmatter(content)
        assert error is not None

    def test_missing_name_returns_error(self) -> None:
        content = "---\ndescription: A description\n---\nbody"
        fm, body, error = _extract_frontmatter(content)
        assert error is not None

    def test_missing_description_returns_error(self) -> None:
        content = "---\nname: my-skill\n---\nbody"
        fm, body, error = _extract_frontmatter(content)
        assert error is not None

    def test_invalid_yaml_returns_error(self) -> None:
        content = "---\nname: :\n bad yaml\n---\nbody"
        fm, body, error = _extract_frontmatter(content)
        assert error is not None

    def test_non_mapping_yaml_returns_error(self) -> None:
        content = "---\n- item1\n- item2\n---\nbody"
        fm, body, error = _extract_frontmatter(content)
        assert error is not None

    def test_allowed_tools_string_converted_to_list(self) -> None:
        content = "---\nname: s\ndescription: d\nallowed-tools: tool_a tool_b\n---"
        fm, body, error = _extract_frontmatter(content)
        assert error is None
        assert fm is not None
        assert isinstance(fm.allowed_tools, list)
        assert "tool_a" in fm.allowed_tools


# ---------------------------------------------------------------------------
# parse_skill_content
# ---------------------------------------------------------------------------


class TestParseSkillContent:
    def test_valid_content_returns_parsed_skill(self) -> None:
        result = parse_skill_content(_VALID_FM)
        assert result.frontmatter.name == "my-skill"
        assert result.frontmatter.description == "A test skill"

    def test_invalid_frontmatter_returns_fallback(self) -> None:
        result = parse_skill_content("not frontmatter content")
        # Fallback: empty frontmatter name
        assert result.frontmatter.name == ""

    def test_body_is_populated(self) -> None:
        result = parse_skill_content(_VALID_FM)
        assert "Body" in result.body

    def test_sections_are_parsed(self) -> None:
        content = "---\nname: skill\ndescription: desc\n---\n## Section A\n\nContent."
        result = parse_skill_content(content)
        assert result.sections is not None
        assert len(result.sections) > 0


# ---------------------------------------------------------------------------
# extract_skill_metadata
# ---------------------------------------------------------------------------


class TestExtractSkillMetadata:
    def test_valid_returns_summary(self) -> None:
        ok, summary, error = extract_skill_metadata(_VALID_FM)
        assert ok is True
        assert summary is not None
        assert summary.name == "my-skill"
        assert error is None

    def test_invalid_returns_failure(self) -> None:
        ok, summary, error = extract_skill_metadata("plain text")
        assert ok is False
        assert summary is None
        assert error is not None

    def test_source_is_propagated(self) -> None:
        ok, summary, _ = extract_skill_metadata(_VALID_FM, source="catalog")
        assert ok is True
        assert summary is not None
        assert summary.source == "catalog"


# ---------------------------------------------------------------------------
# _list_bundled_resources
# ---------------------------------------------------------------------------


class TestListBundledResources:
    def test_non_existent_dir_returns_empty(self, tmp_path: Path) -> None:
        result = _list_bundled_resources(tmp_path / "nosuchdir")
        assert result.scripts == []
        assert result.other == []

    def test_known_subdir_scripts(self, tmp_path: Path) -> None:
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()
        (scripts_dir / "run.sh").write_text("#!/bin/bash")
        result = _list_bundled_resources(tmp_path)
        assert "scripts/run.sh" in result.scripts

    def test_known_subdir_references(self, tmp_path: Path) -> None:
        refs_dir = tmp_path / "references"
        refs_dir.mkdir()
        (refs_dir / "guide.md").write_text("# Guide")
        result = _list_bundled_resources(tmp_path)
        assert "references/guide.md" in result.references

    def test_known_subdir_assets(self, tmp_path: Path) -> None:
        assets_dir = tmp_path / "assets"
        assets_dir.mkdir()
        (assets_dir / "image.png").write_text("data")
        result = _list_bundled_resources(tmp_path)
        assert "assets/image.png" in result.assets

    def test_unknown_subdir_goes_to_other(self, tmp_path: Path) -> None:
        custom_dir = tmp_path / "custom"
        custom_dir.mkdir()
        (custom_dir / "file.txt").write_text("content")
        result = _list_bundled_resources(tmp_path)
        assert "custom/file.txt" in result.other

    def test_skill_md_excluded(self, tmp_path: Path) -> None:
        (tmp_path / "SKILL.md").write_text("# Skill")
        result = _list_bundled_resources(tmp_path)
        assert "SKILL.md" not in result.other

    def test_loose_file_goes_to_other(self, tmp_path: Path) -> None:
        (tmp_path / "readme.txt").write_text("text")
        result = _list_bundled_resources(tmp_path)
        assert "readme.txt" in result.other


# ---------------------------------------------------------------------------
# SkillLoader
# ---------------------------------------------------------------------------


def _create_skill_dir(base: Path, name: str, content: str) -> Path:
    """Helper: create a skill directory with SKILL.md."""
    skill_dir = base / name
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")
    return skill_dir


_VALID_SKILL_CONTENT = """\
---
name: my-skill
description: A sample skill
version: "1.0.0"
---
## Overview

This is the overview.
"""


class TestSkillLoader:
    def test_load_skill_valid(self, tmp_path: Path) -> None:
        _create_skill_dir(tmp_path, "my-skill", _VALID_SKILL_CONTENT)
        loader = SkillLoader()
        skill = loader.load_skill("my-skill", str(tmp_path))
        assert skill is not None
        assert skill.name == "my-skill"
        assert skill.description == "A sample skill"

    def test_load_skill_invalid_name_raises(self, tmp_path: Path) -> None:
        loader = SkillLoader()
        with pytest.raises(MatimoError) as exc_info:
            loader.load_skill("BadName!", str(tmp_path))
        assert exc_info.value.code == ErrorCode.INVALID_SCHEMA

    def test_load_skill_missing_file_raises(self, tmp_path: Path) -> None:
        loader = SkillLoader()
        with pytest.raises(MatimoError) as exc_info:
            loader.load_skill("no-skill", str(tmp_path))
        assert exc_info.value.code == ErrorCode.TOOL_NOT_FOUND

    def test_load_skill_name_mismatch_raises(self, tmp_path: Path) -> None:
        content = "---\nname: wrong-name\ndescription: d\n---\nbody"
        _create_skill_dir(tmp_path, "my-skill", content)
        loader = SkillLoader()
        with pytest.raises(MatimoError) as exc_info:
            loader.load_skill("my-skill", str(tmp_path))
        assert exc_info.value.code == ErrorCode.INVALID_SCHEMA

    def test_load_skill_invalid_frontmatter_raises(self, tmp_path: Path) -> None:
        content = "---\n# missing name and description\n---\nbody"
        _create_skill_dir(tmp_path, "my-skill", content)
        loader = SkillLoader()
        with pytest.raises(MatimoError) as exc_info:
            loader.load_skill("my-skill", str(tmp_path))
        assert exc_info.value.code == ErrorCode.INVALID_SCHEMA

    def test_load_skills_from_directory(self, tmp_path: Path) -> None:
        _create_skill_dir(tmp_path, "skill-a", "---\nname: skill-a\ndescription: A\n---\nbody")
        _create_skill_dir(tmp_path, "skill-b", "---\nname: skill-b\ndescription: B\n---\nbody")
        loader = SkillLoader()
        skills = loader.load_skills_from_directory(str(tmp_path))
        names = {s.name for s in skills}
        assert "skill-a" in names
        assert "skill-b" in names

    def test_load_skills_from_nonexistent_dir_returns_empty(self, tmp_path: Path) -> None:
        loader = SkillLoader()
        skills = loader.load_skills_from_directory(str(tmp_path / "nonexistent"))
        assert skills == []

    def test_load_skills_skips_files(self, tmp_path: Path) -> None:
        # Files at root level (not directories) should be skipped
        (tmp_path / "not-a-skill.txt").write_text("text")
        _create_skill_dir(tmp_path, "real-skill", "---\nname: real-skill\ndescription: D\n---")
        loader = SkillLoader()
        skills = loader.load_skills_from_directory(str(tmp_path))
        assert len(skills) == 1

    def test_load_skills_skips_dirs_without_skill_md(self, tmp_path: Path) -> None:
        (tmp_path / "empty-dir").mkdir()
        loader = SkillLoader()
        skills = loader.load_skills_from_directory(str(tmp_path))
        assert skills == []

    def test_load_skill_resource_valid(self, tmp_path: Path) -> None:
        skill_dir = tmp_path / "my-skill"
        skill_dir.mkdir()
        scripts_dir = skill_dir / "scripts"
        scripts_dir.mkdir()
        resource = scripts_dir / "helper.sh"
        resource.write_text("#!/bin/bash\necho hi")
        loader = SkillLoader()
        content = loader.load_skill_resource("my-skill", str(tmp_path), "scripts/helper.sh")
        assert "echo hi" in content

    def test_load_skill_resource_path_traversal_raises(self, tmp_path: Path) -> None:
        loader = SkillLoader()
        with pytest.raises(MatimoError) as exc_info:
            loader.load_skill_resource("my-skill", str(tmp_path), "../secret.txt")
        assert exc_info.value.code == ErrorCode.INVALID_SCHEMA

    def test_load_skill_resource_backslash_raises(self, tmp_path: Path) -> None:
        loader = SkillLoader()
        with pytest.raises(MatimoError) as exc_info:
            loader.load_skill_resource("my-skill", str(tmp_path), "scripts\\evil.sh")
        assert exc_info.value.code == ErrorCode.INVALID_SCHEMA

    def test_load_skill_resource_control_char_raises(self, tmp_path: Path) -> None:
        loader = SkillLoader()
        with pytest.raises(MatimoError) as exc_info:
            loader.load_skill_resource("my-skill", str(tmp_path), "scripts/\x00evil.sh")
        assert exc_info.value.code == ErrorCode.INVALID_SCHEMA

    def test_load_skill_resource_missing_file_raises(self, tmp_path: Path) -> None:
        skill_dir = tmp_path / "my-skill"
        skill_dir.mkdir()
        loader = SkillLoader()
        with pytest.raises(MatimoError) as exc_info:
            loader.load_skill_resource("my-skill", str(tmp_path), "scripts/nosuchfile.sh")
        assert exc_info.value.code == ErrorCode.TOOL_NOT_FOUND

    def test_load_skill_allowed_tools_string_converted_to_list(self, tmp_path: Path) -> None:
        content = "---\nname: my-skill\ndescription: d\nallowed-tools: tool_a tool_b\n---\nbody"
        _create_skill_dir(tmp_path, "my-skill", content)
        loader = SkillLoader()
        skill = loader.load_skill("my-skill", str(tmp_path))
        assert skill is not None
        assert isinstance(skill.allowed_tools, list)
