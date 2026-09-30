"""Unit tests for tool_selection/tool_selection_matcher.py."""

from __future__ import annotations

from matimo.core.tfidf_embedding import TfIdfEmbeddingProvider
from matimo_evals.tool_selection.tool_selection_matcher import (
    ToolCorpusEntry,
    ToolSelectionMatcher,
)

CORPUS = [
    ToolCorpusEntry(
        name="slack-get-user",
        description="Retrieve detailed information about a Slack user by ID.",
        parameter_descriptions=["Slack user ID to lookup."],
    ),
    ToolCorpusEntry(
        name="slack-send-message",
        description="Send a message to a Slack channel or user.",
        parameter_descriptions=[
            "Channel ID to send the message to.",
            "The message text to send.",
        ],
    ),
    ToolCorpusEntry(
        name="postgres-run-query",
        description="Execute a read-only SQL query against a Postgres database.",
        parameter_descriptions=["The SQL query to run."],
    ),
]


class TestToolSelectionMatcher:
    def test_ranks_most_relevant_tool_first(self) -> None:
        matcher = ToolSelectionMatcher(CORPUS)
        ranked = matcher.rank("Run a SQL query against the database")
        assert ranked[0].name == "postgres-run-query"

    def test_returns_every_tool_sorted_descending(self) -> None:
        matcher = ToolSelectionMatcher(CORPUS)
        ranked = matcher.rank("Send a Slack message to #general")
        assert len(ranked) == len(CORPUS)
        for i in range(1, len(ranked)):
            assert ranked[i - 1].score >= ranked[i].score

    def test_distinguishes_near_duplicate_tools(self) -> None:
        matcher = ToolSelectionMatcher(CORPUS)
        ranked = matcher.rank("Look up a Slack user profile")
        assert ranked[0].name == "slack-get-user"

    def test_reuses_core_tfidf_provider(self, monkeypatch) -> None:  # noqa: ANN001
        fit_calls = []
        embed_calls = []
        original_fit = TfIdfEmbeddingProvider.fit
        original_embed_sync = TfIdfEmbeddingProvider.embed_sync

        def spy_fit(self, documents):  # noqa: ANN001, ANN202
            fit_calls.append(documents)
            return original_fit(self, documents)

        def spy_embed_sync(self, text):  # noqa: ANN001, ANN202
            embed_calls.append(text)
            return original_embed_sync(self, text)

        monkeypatch.setattr(TfIdfEmbeddingProvider, "fit", spy_fit)
        monkeypatch.setattr(TfIdfEmbeddingProvider, "embed_sync", spy_embed_sync)

        matcher = ToolSelectionMatcher(CORPUS)
        matcher.rank("Send a Slack message")

        assert len(fit_calls) > 0
        assert len(embed_calls) > 0

    def test_handles_empty_corpus(self) -> None:
        matcher = ToolSelectionMatcher([])
        assert matcher.rank("anything") == []
