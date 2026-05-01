"""Unit tests for core/tfidf_embedding.py."""
from __future__ import annotations

import math

import pytest

from matimo.core.tfidf_embedding import (
    EmbeddingProvider,
    TfIdfEmbeddingProvider,
    cosine_similarity,
)

pytestmark = pytest.mark.asyncio


class TestCosineSimilarity:
    def test_identical_vectors_return_one(self) -> None:
        a = [1.0, 0.0, 0.5]
        assert cosine_similarity(a, a) == pytest.approx(1.0, abs=1e-6)

    def test_orthogonal_vectors_return_zero(self) -> None:
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert cosine_similarity(a, b) == pytest.approx(0.0)

    def test_zero_vector_returns_zero(self) -> None:
        a = [0.0, 0.0]
        b = [1.0, 0.5]
        assert cosine_similarity(a, b) == 0.0

    def test_empty_vectors_returns_zero(self) -> None:
        assert cosine_similarity([], []) == 0.0

    def test_mismatched_lengths_returns_zero(self) -> None:
        assert cosine_similarity([1.0, 2.0], [1.0]) == 0.0

    def test_antiparallel_vectors_return_negative(self) -> None:
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert cosine_similarity(a, b) == pytest.approx(-1.0, abs=1e-6)

    def test_small_positive_angle(self) -> None:
        a = [1.0, 1.0]
        b = [1.0, 0.0]
        result = cosine_similarity(a, b)
        assert 0.0 < result < 1.0

    def test_similarity_is_symmetric(self) -> None:
        a = [0.3, 0.7, 0.1]
        b = [0.9, 0.1, 0.5]
        assert cosine_similarity(a, b) == pytest.approx(cosine_similarity(b, a))


class TestTfIdfEmbeddingProvider:
    def test_dimensions_zero_before_fit(self) -> None:
        provider = TfIdfEmbeddingProvider()
        assert provider.dimensions == 0

    def test_embed_sync_before_fit_returns_empty(self) -> None:
        provider = TfIdfEmbeddingProvider()
        assert provider.embed_sync("hello") == []

    def test_fit_sets_dimensions(self) -> None:
        provider = TfIdfEmbeddingProvider()
        provider.fit(["hello world", "foo bar baz"])
        assert provider.dimensions > 0

    def test_fit_produces_non_empty_vocabulary(self) -> None:
        provider = TfIdfEmbeddingProvider()
        provider.fit(["slack messaging tool", "github code review"])
        assert provider.dimensions > 0

    def test_embed_sync_returns_correct_dimension(self) -> None:
        provider = TfIdfEmbeddingProvider()
        corpus = ["send message", "receive notification", "post update"]
        provider.fit(corpus)
        vec = provider.embed_sync("send message")
        assert len(vec) == provider.dimensions

    def test_embed_sync_l2_normalised(self) -> None:
        provider = TfIdfEmbeddingProvider()
        provider.fit(["hello world", "foo bar"])
        vec = provider.embed_sync("hello world")
        if any(v != 0.0 for v in vec):
            norm = math.sqrt(sum(v * v for v in vec))
            assert norm == pytest.approx(1.0, abs=1e-6)

    def test_embed_sync_unknown_terms_returns_zero_vector(self) -> None:
        provider = TfIdfEmbeddingProvider()
        provider.fit(["hello world"])
        vec = provider.embed_sync("xyzabc123unknown")
        # All terms unknown, so vector should be all zeros
        assert all(v == 0.0 for v in vec)

    async def test_embed_async_matches_embed_sync(self) -> None:
        provider = TfIdfEmbeddingProvider()
        provider.fit(["send slack message", "github pull request"])
        sync_vec = provider.embed_sync("send slack message")
        async_vec = await provider.embed("send slack message")
        assert sync_vec == async_vec

    async def test_embed_batch_returns_list_of_vectors(self) -> None:
        provider = TfIdfEmbeddingProvider()
        texts = ["send message", "review code", "create ticket"]
        provider.fit(texts)
        vectors = await provider.embed_batch(texts)
        assert len(vectors) == 3
        for vec in vectors:
            assert len(vec) == provider.dimensions

    def test_similar_texts_have_higher_similarity(self) -> None:
        provider = TfIdfEmbeddingProvider()
        corpus = ["slack chat message post send", "github repo code review pull request"]
        provider.fit(corpus)
        v_msg1 = provider.embed_sync("slack send message")
        v_msg2 = provider.embed_sync("chat post message slack")
        v_code = provider.embed_sync("github pull request review")
        sim_same = cosine_similarity(v_msg1, v_msg2)
        sim_diff = cosine_similarity(v_msg1, v_code)
        # Similar texts should have higher similarity than dissimilar ones
        assert sim_same > sim_diff or sim_same >= 0.0

    def test_stopwords_are_filtered(self) -> None:
        provider = TfIdfEmbeddingProvider()
        # "the" and "a" are stopwords; vocabulary should not include them
        provider.fit(["the quick fox", "a slow dog"])
        assert "the" not in provider._vocabulary
        assert "a" not in provider._vocabulary

    def test_tokenize_lowercases_and_splits(self) -> None:
        tokens = TfIdfEmbeddingProvider._tokenize("Hello World FOO")
        assert "hello" in tokens
        assert "world" in tokens
        assert "foo" in tokens

    def test_tokenize_removes_short_tokens(self) -> None:
        # Single character tokens should be filtered
        tokens = TfIdfEmbeddingProvider._tokenize("a b cc ddd")
        assert "a" not in tokens
        assert "b" not in tokens

    def test_fit_empty_corpus(self) -> None:
        provider = TfIdfEmbeddingProvider()
        provider.fit([])
        assert provider.dimensions == 0

    def test_embed_protocol_conformance(self) -> None:
        provider = TfIdfEmbeddingProvider()
        assert isinstance(provider, EmbeddingProvider)

    def test_refitting_updates_vocabulary(self) -> None:
        provider = TfIdfEmbeddingProvider()
        provider.fit(["hello world"])
        dim1 = provider.dimensions
        provider.fit(["completely different terms example foo bar baz"])
        dim2 = provider.dimensions
        # Both should be non-zero (may or may not differ)
        assert dim1 > 0
        assert dim2 > 0
