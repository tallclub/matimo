"""Unit tests for scoring/precision_recall.py."""

from __future__ import annotations

import pytest

from matimo_evals.scoring.precision_recall import aggregate_scores, score_case
from matimo_evals.tool_selection.tool_selection_matcher import RankedTool

RANKED = [
    RankedTool(name="tool-a", score=0.9),
    RankedTool(name="tool-b", score=0.5),
    RankedTool(name="tool-c", score=0.1),
]


class TestScoreCase:
    def test_precision_hit_when_expected_tool_ranks_first(self) -> None:
        score = score_case("prompt", "tool-a", RANKED)
        assert score.rank == 1
        assert score.precision_hit is True
        assert score.recall_hit is True

    def test_recall_hit_within_wider_top_k(self) -> None:
        score = score_case("prompt", "tool-b", RANKED, top_k=2)
        assert score.rank == 2
        assert score.precision_hit is False
        assert score.recall_hit is True

    def test_misses_recall_outside_top_k(self) -> None:
        score = score_case("prompt", "tool-c", RANKED, top_k=2)
        assert score.rank == 3
        assert score.recall_hit is False

    def test_rank_negative_one_when_absent(self) -> None:
        score = score_case("prompt", "tool-z", RANKED)
        assert score.rank == -1
        assert score.precision_hit is False
        assert score.recall_hit is False

    def test_top_k_defaults_to_one(self) -> None:
        score = score_case("prompt", "tool-b", RANKED)
        assert score.top_k == 1
        assert score.recall_hit is False


class TestAggregateScores:
    def test_computes_precision_and_recall(self) -> None:
        scores = [
            score_case("p1", "tool-a", RANKED),
            score_case("p2", "tool-b", RANKED, top_k=2),
            score_case("p3", "tool-c", RANKED, top_k=2),
        ]
        aggregate = aggregate_scores(scores)
        assert aggregate.total == 3
        assert aggregate.precision_hits == 1
        assert aggregate.recall_hits == 2
        assert aggregate.precision == pytest.approx(1 / 3)
        assert aggregate.recall == pytest.approx(2 / 3)
        assert len(aggregate.failures) == 1
        assert aggregate.failures[0].expected_tool == "tool-c"

    def test_empty_scores_is_a_full_pass(self) -> None:
        aggregate = aggregate_scores([])
        assert aggregate.total == 0
        assert aggregate.precision == 1.0
        assert aggregate.recall == 1.0
        assert aggregate.failures == []
