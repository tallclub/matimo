"""
Deterministic tool-selection eval orchestration.

Mirrors: typescript/packages/evals/src/tool-selection/run-eval.ts
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from matimo_evals.scoring.precision_recall import (
    AggregateScore,
    CaseScore,
    aggregate_scores,
    score_case,
)
from matimo_evals.tool_selection.fixtures import load_fixtures
from matimo_evals.tool_selection.tool_corpus import (
    LoadedTool,
    load_tool_corpus,
    to_corpus_entry,
)
from matimo_evals.tool_selection.tool_selection_matcher import ToolSelectionMatcher


@dataclass
class RequiredParamMismatch:
    tool: str
    package_name: str
    fixture_path: str
    missing_from_schema: list[
        str
    ]  # declared in fixture as required, but not required=True on the tool


@dataclass
class ToolSelectionEvalResult:
    tool_corpus_size: int
    fixture_count: int
    case_count: int
    scores: list[CaseScore]
    aggregate: AggregateScore
    unknown_tools: list[str] = field(
        default_factory=list
    )  # fixtures whose `tool:` doesn't match any loaded tool
    param_mismatches: list[RequiredParamMismatch] = field(default_factory=list)


def run_tool_selection_eval(packages_dir: Path) -> ToolSelectionEvalResult:
    """
    Rank every fixture prompt against the full, live tool catalog (glob'd
    fresh each run, never hand-maintained) and assert each fixture's own
    tool clears its recall band. Also cross-checks
    `expected_required_params` against the tool's actual schema — a pure
    structural check, no matcher involved.
    """
    tools = load_tool_corpus(packages_dir)
    tools_by_name: dict[str, LoadedTool] = {t.definition.name: t for t in tools}
    matcher = ToolSelectionMatcher([to_corpus_entry(t.definition) for t in tools])

    fixtures = load_fixtures(packages_dir)

    scores: list[CaseScore] = []
    unknown_tools: list[str] = []
    param_mismatches: list[RequiredParamMismatch] = []

    for fixture in fixtures:
        tool = tools_by_name.get(fixture.tool)
        if tool is None:
            unknown_tools.append(
                f"{fixture.package_name}: {fixture.tool} ({fixture.fixture_path})"
            )
            continue

        required_params = {
            name for name, p in tool.definition.parameters.items() if p.required
        }

        for eval_case in fixture.cases:
            missing_from_schema = [
                p
                for p in eval_case.expected_required_params
                if p not in required_params
            ]
            if missing_from_schema:
                param_mismatches.append(
                    RequiredParamMismatch(
                        tool=fixture.tool,
                        package_name=fixture.package_name,
                        fixture_path=fixture.fixture_path,
                        missing_from_schema=missing_from_schema,
                    )
                )

            ranked = matcher.rank(eval_case.prompt)
            scores.append(
                score_case(eval_case.prompt, fixture.tool, ranked, eval_case.top_k)
            )

    return ToolSelectionEvalResult(
        tool_corpus_size=len(tools),
        fixture_count=len(fixtures),
        case_count=len(scores),
        scores=scores,
        aggregate=aggregate_scores(scores),
        unknown_tools=unknown_tools,
        param_mismatches=param_mismatches,
    )


def print_report(result: ToolSelectionEvalResult) -> None:
    aggregate = result.aggregate
    print("Matimo tool-selection eval — tool-selection & argument correctness\n")
    print(f"Tool corpus:  {result.tool_corpus_size} tools")
    print(f"Fixtures:     {result.fixture_count}")
    print(f"Cases:        {result.case_count}")
    print(
        f"Precision:    {aggregate.precision * 100:.1f}% ({aggregate.precision_hits}/{aggregate.total} top-1)"
    )
    print(
        f"Recall:       {aggregate.recall * 100:.1f}% ({aggregate.recall_hits}/{aggregate.total} within top-K)\n"
    )

    if result.unknown_tools:
        print(
            f"❌ {len(result.unknown_tools)} fixture(s) reference a tool not found in the corpus:"
        )
        for entry in result.unknown_tools:
            print(f"   - {entry}")
        print("")

    if result.param_mismatches:
        print(
            f"❌ {len(result.param_mismatches)} fixture(s) declare expected_required_params not required in schema:"
        )
        for m in result.param_mismatches:
            print(
                f"   - {m.package_name}/{m.tool}: {', '.join(m.missing_from_schema)} ({m.fixture_path})"
            )
        print("")

    if aggregate.failures:
        print(f"❌ {len(aggregate.failures)} case(s) missed their recall band:")
        for f in aggregate.failures:
            rank_display = "∞" if f.rank == -1 else str(f.rank)
            print(
                f'   - "{f.prompt}" → expected "{f.expected_tool}" within top-{f.top_k}, ranked #{rank_display}'
            )
        print("")

    ok = (
        not aggregate.failures
        and not result.unknown_tools
        and not result.param_mismatches
    )
    print("✅ Tool-selection eval passed." if ok else "❌ Tool-selection eval failed.")


def has_failures(result: ToolSelectionEvalResult) -> bool:
    """True when the aggregate result should fail the run (unknown tools, param mismatches, or recall misses)."""
    return bool(
        result.aggregate.failures or result.unknown_tools or result.param_mismatches
    )
