"""
TF-IDF Embedding Provider — zero-dependency semantic search.

Mirrors: packages/core/src/core/tfidf-embedding.ts

Lightweight TF-IDF (Term Frequency–Inverse Document Frequency) for
cosine-similarity ranking. Good enough for 10–200 skills. For production
enterprise deployments, plug in an OpenAI/Cohere embedding provider via the
``EmbeddingProvider`` protocol instead.
"""
from __future__ import annotations

import math
import re
from typing import Protocol, runtime_checkable

# ---------------------------------------------------------------------------
# EmbeddingProvider protocol (mirrors TS EmbeddingProvider interface)
# ---------------------------------------------------------------------------


@runtime_checkable
class EmbeddingProvider(Protocol):
    """Pluggable embedding provider for semantic skill search."""

    @property
    def dimensions(self) -> int: ...

    async def embed(self, text: str) -> list[float]: ...

    async def embed_batch(self, texts: list[str]) -> list[list[float]]: ...


# ---------------------------------------------------------------------------
# TF-IDF provider
# ---------------------------------------------------------------------------

_STOPWORDS = frozenset(
    "a an the and or but in on at to for of with by from is it as be was are "
    "this that not do if so no up my we he she they you me us all can had has "
    "have will would could should may might shall been being were did does its "
    "than then also very just about more some any each every how what when where".split()
)

_SPLIT_RE = re.compile(r"[^a-z0-9]+")


class TfIdfEmbeddingProvider:
    """
    Simple TF-IDF based embedding provider.

    Builds a vocabulary from a registered corpus and represents each text as a
    TF-IDF weighted vector with L2 normalisation.
    """

    def __init__(self) -> None:
        self._vocabulary: dict[str, int] = {}
        self._idf: list[float] = []
        self._corpus_size: int = 0
        self._dimensions: int = 0

    @property
    def dimensions(self) -> int:
        return self._dimensions

    # ------------------------------------------------------------------
    # Fit vocabulary
    # ------------------------------------------------------------------

    def fit(self, documents: list[str]) -> None:
        """Build vocabulary and IDF weights from a corpus. Must be called before ``embed``."""
        self._vocabulary.clear()
        self._corpus_size = len(documents)

        doc_frequency: dict[str, int] = {}
        for doc in documents:
            unique_terms = set(self._tokenize(doc))
            for term in unique_terms:
                doc_frequency[term] = doc_frequency.get(term, 0) + 1

        idx = 0
        idf_values: list[float] = []
        for term, df in doc_frequency.items():
            self._vocabulary[term] = idx
            idx += 1
            # Smooth IDF: log((N+1) / (df+1)) + 1
            idf_values.append(math.log((self._corpus_size + 1) / (df + 1)) + 1)

        self._dimensions = len(idf_values)
        self._idf = idf_values

    # ------------------------------------------------------------------
    # Embed
    # ------------------------------------------------------------------

    async def embed(self, text: str) -> list[float]:
        return self.embed_sync(text)

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_sync(t) for t in texts]

    def embed_sync(self, text: str) -> list[float]:
        """Synchronous embed — no async overhead."""
        if self._dimensions == 0:
            return []

        terms = self._tokenize(text)
        tf = [0.0] * self._dimensions

        for term in terms:
            idx = self._vocabulary.get(term)
            if idx is not None:
                tf[idx] += 1.0

        # Sublinear TF: 1 + log(tf) if tf > 0, weighted by IDF
        for i in range(self._dimensions):
            if tf[i] > 0:
                tf[i] = (1 + math.log(tf[i])) * self._idf[i]

        # L2 normalise
        norm = math.sqrt(sum(v * v for v in tf))
        if norm > 0:
            tf = [v / norm for v in tf]

        return tf

    # ------------------------------------------------------------------
    # Tokenise
    # ------------------------------------------------------------------

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        return [
            t
            for t in _SPLIT_RE.split(text.lower())
            if len(t) > 1 and t not in _STOPWORDS
        ]


# ---------------------------------------------------------------------------
# Cosine similarity
# ---------------------------------------------------------------------------


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors (1 = identical, 0 = orthogonal)."""
    if len(a) != len(b) or not a:
        return 0.0

    dot = sum(ai * bi for ai, bi in zip(a, b, strict=False))
    norm_a = math.sqrt(sum(ai * ai for ai in a))
    norm_b = math.sqrt(sum(bi * bi for bi in b))

    denom = norm_a * norm_b
    return dot / denom if denom > 0 else 0.0
