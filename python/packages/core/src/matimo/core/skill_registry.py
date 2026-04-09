"""
Skill Registry — in-memory store and search for skills.

Mirrors: packages/core/src/core/skill-registry.ts

Provides discovery, search, filtering, and semantic search via pluggable
embeddings (TF-IDF fallback).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from matimo.core.models import (
    SearchSkillsOptions,
    SkillContentOptions,
    SkillDefinition,
    SkillSummary,
)
from matimo.core.skill_content_parser import (
    ParsedSkillContent,
    extract_skill_content,
    list_skill_sections,
    parse_skill_sections,
)
from matimo.core.tfidf_embedding import (
    EmbeddingProvider,
    TfIdfEmbeddingProvider,
    cosine_similarity,
)
from matimo.errors import ErrorCode, MatimoError

logger = logging.getLogger("matimo")


@dataclass
class SemanticSearchResult:
    """Semantic search result with relevance score."""

    skill: SkillSummary
    score: float  # cosine similarity (0–1)


class SkillRegistry:
    """In-memory skill registry with search and semantic search."""

    def __init__(self) -> None:
        self._skills: dict[str, SkillDefinition] = {}
        self._embedding_provider: EmbeddingProvider | None = None
        self._embeddings: dict[str, list[float]] = {}
        self._embeddings_dirty: bool = True
        self._parsed_content: dict[str, ParsedSkillContent] = {}
        self._default_provider: TfIdfEmbeddingProvider | None = None

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    def set_embedding_provider(self, provider: EmbeddingProvider) -> None:
        """Set a custom embedding provider (OpenAI, Cohere, etc.)."""
        self._embedding_provider = provider
        self._embeddings_dirty = True
        logger.debug("SkillRegistry: custom embedding provider set")

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, skill: SkillDefinition) -> None:
        if not skill.name:
            raise MatimoError("Skill must have a name", ErrorCode.INVALID_SCHEMA)
        self._skills[skill.name] = skill
        self._embeddings_dirty = True
        if skill.body:
            self._parsed_content[skill.name] = parse_skill_sections(skill.body)
        logger.debug("SkillRegistry: skill registered: %s", skill.name)

    def register_all(self, skills: list[SkillDefinition]) -> None:
        for skill in skills:
            self.register(skill)

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    def get(self, name: str) -> SkillDefinition | None:
        return self._skills.get(name)

    def get_required(self, name: str) -> SkillDefinition:
        skill = self._skills.get(name)
        if not skill:
            raise MatimoError(f"Skill not found: {name}", ErrorCode.TOOL_NOT_FOUND)
        return skill

    def get_skill_content(
        self,
        name: str,
        options: SkillContentOptions | None = None,
    ) -> str | None:
        """Get selective skill content — only the sections an agent needs."""
        parsed = self._parsed_content.get(name)
        if parsed is None:
            return None
        return extract_skill_content(parsed, options)

    def get_skill_sections(
        self,
        name: str,
    ) -> list[dict[str, object]] | None:
        """List all sections of a skill with their token costs."""
        parsed = self._parsed_content.get(name)
        if parsed is None:
            return None
        return list_skill_sections(parsed)

    # ------------------------------------------------------------------
    # Listing
    # ------------------------------------------------------------------

    def list(self) -> list[SkillSummary]:
        """List all skills (Level 1 discovery — minimal context)."""
        return [self._to_summary(s) for s in self._skills.values()]

    def get_all(self) -> list[SkillDefinition]:
        return list(self._skills.values())

    def has(self, name: str) -> bool:
        return name in self._skills

    def count(self) -> int:
        return len(self._skills)

    # ------------------------------------------------------------------
    # Search (substring + optional semantic)
    # ------------------------------------------------------------------

    def search(self, options: SearchSkillsOptions | None = None) -> list[SkillSummary]:
        if options is None:
            options = SearchSkillsOptions()

        results = list(self._skills.values())

        # Filters
        if options.category:
            cat = options.category.lower()
            results = [
                s
                for s in results
                if s.metadata and s.metadata.get("category", "").lower() == cat
            ]
        if options.difficulty:
            diff = options.difficulty.lower()
            results = [
                s
                for s in results
                if s.metadata and s.metadata.get("difficulty", "").lower() == diff
            ]
        if options.tags:
            tag_set = {t.lower() for t in options.tags}
            results = [
                s
                for s in results
                if s.metadata
                and tag_set & {
                    t.strip().lower()
                    for t in s.metadata.get("tags", "").split(",")
                }
            ]
        if options.author:
            auth = options.author.lower()
            results = [
                s
                for s in results
                if s.metadata and s.metadata.get("author", "").lower() == auth
            ]

        # Query
        if options.query:
            if options.semantic:
                scored = self._rank_by_similarity(options.query, results)
                skill_by_name = {s.name: s for s in results}
                results = [
                    skill_by_name[r.skill.name]
                    for r in sorted(scored, key=lambda x: x.score, reverse=True)
                    if r.score > 0.1 and r.skill.name in skill_by_name
                ]
            else:
                lq = options.query.lower()
                results = [
                    s
                    for s in results
                    if lq in s.name.lower() or lq in s.description.lower()
                ]

        # Pagination
        paged = results[options.offset : options.offset + options.limit]
        return [self._to_summary(s) for s in paged]

    # ------------------------------------------------------------------
    # Semantic search (async, with scores)
    # ------------------------------------------------------------------

    async def semantic_search(
        self,
        query: str,
        *,
        limit: int = 10,
        min_score: float = 0.1,
    ) -> list[SemanticSearchResult]:
        await self._ensure_embeddings()

        provider: EmbeddingProvider = self._embedding_provider or self._get_default_provider()
        query_embedding = await provider.embed(query)

        results: list[SemanticSearchResult] = []
        for name, embedding in self._embeddings.items():
            skill = self._skills.get(name)
            if not skill:
                continue
            score = cosine_similarity(query_embedding, embedding)
            if score >= min_score:
                results.append(SemanticSearchResult(skill=self._to_summary(skill), score=score))

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:limit]

    # ------------------------------------------------------------------
    # Mutation
    # ------------------------------------------------------------------

    def clear(self) -> None:
        self._skills.clear()
        self._embeddings.clear()
        self._parsed_content.clear()
        self._embeddings_dirty = True

    def remove(self, name: str) -> bool:
        self._embeddings.pop(name, None)
        self._parsed_content.pop(name, None)
        self._embeddings_dirty = True
        return self._skills.pop(name, None) is not None

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    async def _ensure_embeddings(self) -> None:
        if not self._embeddings_dirty:
            return

        provider: EmbeddingProvider = self._embedding_provider or self._get_default_provider()
        skills = list(self._skills.values())
        texts = [self._skill_to_text(s) for s in skills]

        if isinstance(provider, TfIdfEmbeddingProvider):
            provider.fit(texts)

        vectors = await provider.embed_batch(texts)
        self._embeddings.clear()
        for i, skill in enumerate(skills):
            self._embeddings[skill.name] = vectors[i]
        self._embeddings_dirty = False

    def _rank_by_similarity(
        self,
        query: str,
        candidates: list[SkillDefinition],
    ) -> list[SemanticSearchResult]:
        provider = self._get_default_provider()
        texts = [self._skill_to_text(s) for s in candidates]
        provider.fit([*texts, query])
        query_vec = provider.embed_sync(query)

        return [
            SemanticSearchResult(
                skill=self._to_summary(skill),
                score=cosine_similarity(query_vec, provider.embed_sync(self._skill_to_text(skill))),
            )
            for skill in candidates
        ]

    def _get_default_provider(self) -> TfIdfEmbeddingProvider:
        if self._default_provider is None:
            self._default_provider = TfIdfEmbeddingProvider()
        return self._default_provider

    @staticmethod
    def _skill_to_text(skill: SkillDefinition) -> str:
        parts = [skill.name.replace("-", " "), skill.description]
        if skill.metadata:
            if skill.metadata.get("tags"):
                parts.append(skill.metadata["tags"])
            if skill.metadata.get("category"):
                parts.append(skill.metadata["category"])
        if skill.allowed_tools:
            parts.append(" ".join(skill.allowed_tools))
        return " ".join(parts)

    @staticmethod
    def _to_summary(skill: SkillDefinition) -> SkillSummary:
        return SkillSummary(
            name=skill.name,
            description=skill.description,
            version=skill.version,
            license=skill.license,
            metadata=skill.metadata,
            source=skill.source,
        )
