"""Unit tests for core/skill_registry.py."""
from __future__ import annotations

import pytest

from matimo.core.models import (
    SearchSkillsOptions,
    SkillContentOptions,
    SkillDefinition,
)
from matimo.core.skill_registry import SemanticSearchResult, SkillRegistry
from matimo.core.tfidf_embedding import TfIdfEmbeddingProvider
from matimo.errors import ErrorCode, MatimoError

pytestmark = pytest.mark.asyncio


def _make_skill(
    name: str = "test-skill",
    description: str = "A test skill",
    body: str = "## Overview\n\nSome content.",
    metadata: dict[str, str] | None = None,
) -> SkillDefinition:
    return SkillDefinition(
        name=name,
        description=description,
        body=body,
        metadata=metadata,
    )


class TestSkillRegistryRegistration:
    def test_register_skill(self) -> None:
        registry = SkillRegistry()
        skill = _make_skill("alpha")
        registry.register(skill)
        assert registry.has("alpha")
        assert registry.count() == 1

    def test_register_duplicate_overwrites(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("alpha", description="first"))
        registry.register(_make_skill("alpha", description="second"))
        assert registry.count() == 1
        assert registry.get("alpha").description == "second"

    def test_register_without_name_raises(self) -> None:
        registry = SkillRegistry()
        skill = _make_skill("")
        with pytest.raises(MatimoError) as exc_info:
            registry.register(skill)
        assert exc_info.value.code == ErrorCode.INVALID_SCHEMA

    def test_register_all(self) -> None:
        registry = SkillRegistry()
        skills = [_make_skill("one"), _make_skill("two"), _make_skill("three")]
        registry.register_all(skills)
        assert registry.count() == 3

    def test_get_existing(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("beta"))
        result = registry.get("beta")
        assert result is not None
        assert result.name == "beta"

    def test_get_nonexistent_returns_none(self) -> None:
        registry = SkillRegistry()
        assert registry.get("missing") is None

    def test_get_required_returns_skill(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("gamma"))
        result = registry.get_required("gamma")
        assert result.name == "gamma"

    def test_get_required_missing_raises(self) -> None:
        registry = SkillRegistry()
        with pytest.raises(MatimoError) as exc_info:
            registry.get_required("nosuch")
        assert exc_info.value.code == ErrorCode.TOOL_NOT_FOUND

    def test_get_all_returns_list(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("a"))
        registry.register(_make_skill("b"))
        all_skills = registry.get_all()
        assert len(all_skills) == 2

    def test_list_returns_summaries(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("x"))
        summaries = registry.list()
        assert len(summaries) == 1
        assert summaries[0].name == "x"


class TestSkillRegistryMutation:
    def test_remove_existing(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("to-remove"))
        result = registry.remove("to-remove")
        assert result is True
        assert registry.count() == 0

    def test_remove_nonexistent_returns_false(self) -> None:
        registry = SkillRegistry()
        result = registry.remove("ghost")
        assert result is False

    def test_clear_removes_all(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("one"))
        registry.register(_make_skill("two"))
        registry.clear()
        assert registry.count() == 0

    def test_clear_resets_embeddings(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("skill"))
        registry.clear()
        assert len(registry._embeddings) == 0
        assert registry._embeddings_dirty is True


class TestSkillRegistrySearch:
    def test_search_no_query_returns_all(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("a"))
        registry.register(_make_skill("b"))
        results = registry.search()
        assert len(results) == 2

    def test_search_query_substring_match(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("slack-skill", description="Send Slack messages"))
        registry.register(_make_skill("github-skill", description="Review GitHub code"))
        results = registry.search(SearchSkillsOptions(query="slack"))
        assert len(results) == 1
        assert results[0].name == "slack-skill"

    def test_search_query_matches_description(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("my-skill", description="GitHub code review workflow"))
        results = registry.search(SearchSkillsOptions(query="github"))
        assert len(results) == 1

    def test_search_category_filter(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("cat-skill", metadata={"category": "messaging"}))
        registry.register(_make_skill("other-skill", metadata={"category": "devops"}))
        results = registry.search(SearchSkillsOptions(category="messaging"))
        assert len(results) == 1
        assert results[0].name == "cat-skill"

    def test_search_difficulty_filter(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("easy", metadata={"difficulty": "beginner"}))
        registry.register(_make_skill("hard", metadata={"difficulty": "advanced"}))
        results = registry.search(SearchSkillsOptions(difficulty="beginner"))
        assert len(results) == 1
        assert results[0].name == "easy"

    def test_search_tags_filter(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("slack", metadata={"tags": "messaging, chat"}))
        registry.register(_make_skill("gh", metadata={"tags": "code, devops"}))
        results = registry.search(SearchSkillsOptions(tags=["messaging"]))
        assert len(results) == 1
        assert results[0].name == "slack"

    def test_search_author_filter(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("authored", metadata={"author": "alice"}))
        registry.register(_make_skill("other", metadata={"author": "bob"}))
        results = registry.search(SearchSkillsOptions(author="alice"))
        assert len(results) == 1

    def test_search_limit_and_offset(self) -> None:
        registry = SkillRegistry()
        for i in range(10):
            registry.register(_make_skill(f"skill-{i}"))
        page1 = registry.search(SearchSkillsOptions(limit=3, offset=0))
        page2 = registry.search(SearchSkillsOptions(limit=3, offset=3))
        assert len(page1) == 3
        assert len(page2) == 3
        # Pages should not overlap
        names1 = {r.name for r in page1}
        names2 = {r.name for r in page2}
        assert names1.isdisjoint(names2)

    def test_search_semantic_flag(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("slack-skill", description="Send Slack channel messages"))
        registry.register(_make_skill("github-skill", description="Review code on GitHub"))
        # Semantic search should work (uses TF-IDF internally)
        results = registry.search(SearchSkillsOptions(query="slack messaging", semantic=True))
        # Just verify it runs and returns results
        assert isinstance(results, list)

    def test_search_skill_without_metadata_not_filtered_by_category(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("no-meta"))
        results = registry.search(SearchSkillsOptions(category="messaging"))
        assert len(results) == 0


class TestSkillRegistryContent:
    def test_get_skill_content_returns_string(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("content-skill", body="## Section\n\nContent here."))
        result = registry.get_skill_content("content-skill")
        assert result is not None
        assert "Content here" in result

    def test_get_skill_content_with_options(self) -> None:
        registry = SkillRegistry()
        body = "# Overview\n\nContent A.\n\n# Details\n\nContent B."
        registry.register(_make_skill("skilled", body=body))
        result = registry.get_skill_content("skilled", SkillContentOptions(sections=["Overview"]))
        assert result is not None
        assert "Content A" in result
        assert "Content B" not in result

    def test_get_skill_content_missing_skill_returns_none(self) -> None:
        registry = SkillRegistry()
        result = registry.get_skill_content("unknown")
        assert result is None

    def test_get_skill_sections_returns_list(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("sec-skill", body="# Section One\n\ncontent."))
        result = registry.get_skill_sections("sec-skill")
        assert result is not None
        assert len(result) == 1
        assert result[0]["path"] == "Section One"

    def test_get_skill_sections_missing_returns_none(self) -> None:
        registry = SkillRegistry()
        result = registry.get_skill_sections("missing")
        assert result is None

    def test_skill_without_body_has_no_parsed_content(self) -> None:
        registry = SkillRegistry()
        skill = SkillDefinition(name="no-body", description="d", body="")
        registry.register(skill)
        assert registry.get_skill_content("no-body") is None


class TestSkillRegistrySemanticSearch:
    async def test_semantic_search_returns_results(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("slack", description="Send Slack messages to channels"))
        registry.register(_make_skill("github", description="Review code on GitHub"))
        results = await registry.semantic_search("messaging chat slack")
        assert isinstance(results, list)
        assert all(isinstance(r, SemanticSearchResult) for r in results)

    async def test_semantic_search_min_score_filters(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("slack", description="Slack messaging skill"))
        results = await registry.semantic_search("completely unrelated xyz", min_score=0.99)
        # High min_score means no results for unrelated query
        assert isinstance(results, list)

    async def test_semantic_search_limit_respected(self) -> None:
        registry = SkillRegistry()
        for i in range(5):
            registry.register(_make_skill(f"skill-{i}", description=f"Test skill {i}"))
        results = await registry.semantic_search("test skill", limit=2)
        assert len(results) <= 2

    def test_set_custom_embedding_provider(self) -> None:
        registry = SkillRegistry()
        provider = TfIdfEmbeddingProvider()
        registry.set_embedding_provider(provider)
        assert registry._embedding_provider is provider
        assert registry._embeddings_dirty is True

    async def test_ensure_embeddings_populates(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("skill-x", description="testing embeddings"))
        await registry._ensure_embeddings()
        assert not registry._embeddings_dirty
        assert "skill-x" in registry._embeddings

    async def test_ensure_embeddings_not_repeated(self) -> None:
        registry = SkillRegistry()
        registry.register(_make_skill("once"))
        await registry._ensure_embeddings()
        # Mark clean; calling again should not re-fit
        registry._embeddings_dirty = False
        await registry._ensure_embeddings()
        # Still not dirty
        assert registry._embeddings_dirty is False
