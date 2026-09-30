"""
Precision/recall scoring for tool-selection eval cases.

Mirrors: typescript/packages/evals/src/scoring/precision-recall.ts
"""

from __future__ import annotations

from dataclasses import dataclass, field

from matimo_evals.tool_selection.tool_selection_matcher import RankedTool


@dataclass
class CaseScore:
    prompt: str
    expected_tool: str
    rank: int  # 1-based position of expected_tool in the ranking; -1 if absent
    top_k: int
    precision_hit: bool  # rank == 1
    recall_hit: bool  # rank != -1 and rank <= top_k


def score_case(
    prompt: str, expected_tool: str, ranked: list[RankedTool], top_k: int = 1
) -> CaseScore:
    """
    Score one fixture case against a ranked tool list.

    Precision = the expected tool is the single best match (rank 1).
    Recall (band) = the expected tool is at least within the fixture's
    declared top_k, for legitimately near-duplicate tools where strict
    top-1 isn't realistic.
    """
    rank = -1
    for i, r in enumerate(ranked):
        if r.name == expected_tool:
            rank = i + 1
            break

    return CaseScore(
        prompt=prompt,
        expected_tool=expected_tool,
        rank=rank,
        top_k=top_k,
        precision_hit=rank == 1,
        recall_hit=rank != -1 and rank <= top_k,
    )


@dataclass
class AggregateScore:
    total: int
    precision_hits: int
    recall_hits: int
    precision: float
    recall: float
    failures: list[CaseScore] = field(default_factory=list)


def aggregate_scores(scores: list[CaseScore]) -> AggregateScore:
    """
    Aggregate scores across every case in a tool-selection eval run. A case
    "passes" the suite when it clears its own recall band (top_k, default 1
    = strict top-1); `failures` lists every case that didn't.
    """
    total = len(scores)
    precision_hits = sum(1 for s in scores if s.precision_hit)
    recall_hits = sum(1 for s in scores if s.recall_hit)
    return AggregateScore(
        total=total,
        precision_hits=precision_hits,
        recall_hits=recall_hits,
        precision=1.0 if total == 0 else precision_hits / total,
        recall=1.0 if total == 0 else recall_hits / total,
        failures=[s for s in scores if not s.recall_hit],
    )
