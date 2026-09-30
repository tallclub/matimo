"""
Ranks tools against a natural-language prompt using TF-IDF cosine similarity.

Mirrors: typescript/packages/evals/src/tool-selection/tool-selection-matcher.ts

Same deterministic, zero-API-cost mechanism SkillRegistry's semantic search
already uses for skill discovery. Stands in for "would an external LLM pick
the right tool from its description?" without ever calling a model.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from matimo.core.tfidf_embedding import TfIdfEmbeddingProvider, cosine_similarity


@dataclass
class ToolCorpusEntry:
    """Minimal shape needed to rank a tool — narrower than ToolDefinition."""

    name: str
    description: str
    parameter_descriptions: list[str] = field(default_factory=list)


@dataclass
class RankedTool:
    name: str
    score: float


class ToolSelectionMatcher:
    """Ranks every tool in a corpus against a prompt, most similar first."""

    def __init__(self, corpus: list[ToolCorpusEntry]) -> None:
        self._corpus = corpus
        self._provider = TfIdfEmbeddingProvider()

    def rank(self, prompt: str) -> list[RankedTool]:
        tool_texts = [self._tool_to_text(t) for t in self._corpus]
        # Refit per query, including the query itself in the vocabulary —
        # mirrors SkillRegistry's rank_by_similarity so short prompts still
        # get meaningful IDF weights.
        self._provider.fit([*tool_texts, prompt])

        prompt_vector = self._provider.embed_sync(prompt)
        tool_vectors = [self._provider.embed_sync(text) for text in tool_texts]

        ranked = [
            RankedTool(name=tool.name, score=cosine_similarity(prompt_vector, vector))
            for tool, vector in zip(self._corpus, tool_vectors, strict=True)
        ]
        ranked.sort(key=lambda r: r.score, reverse=True)
        return ranked

    @staticmethod
    def _tool_to_text(tool: ToolCorpusEntry) -> str:
        parts = [
            tool.name.replace("-", " ").replace("_", " "),
            tool.description,
            *tool.parameter_descriptions,
        ]
        return " ".join(parts)
