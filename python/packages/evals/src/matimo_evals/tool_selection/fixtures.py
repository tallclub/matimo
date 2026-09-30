"""
Loads eval fixtures co-located under packages/<provider>/evals/.

Mirrors: typescript/packages/evals/src/tool-selection/fixtures.ts
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml


@dataclass
class EvalCase:
    prompt: str
    expected_required_params: list[str] = field(default_factory=list)
    # Recall band: expected tool must rank within the top K, not strictly
    # top-1. Defaults to 1 (strict).
    top_k: int = 1


@dataclass
class LoadedFixture:
    tool: str
    cases: list[EvalCase]
    package_name: str
    fixture_path: str


def _parse_fixture(raw: object, file: Path) -> tuple[str, list[EvalCase]]:
    if (
        not isinstance(raw, dict)
        or "tool" not in raw
        or not isinstance(raw.get("cases"), list)
    ):
        raise ValueError(f"Invalid eval fixture (expected {{tool, cases[]}}): {file}")

    tool = raw["tool"]
    cases = [
        EvalCase(
            prompt=c["prompt"],
            expected_required_params=list(c.get("expected_required_params", [])),
            top_k=c.get("top_k", 1),
        )
        for c in raw["cases"]
    ]
    return tool, cases


def load_fixtures(packages_dir: Path) -> list[LoadedFixture]:
    """
    Load every *.eval.yaml fixture co-located under packages/<provider>/evals/,
    mirroring how packages/<provider>/tests/ sits alongside each provider
    rather than centralizing fixtures away from the tools they cover.
    """
    files = sorted(packages_dir.glob("*/evals/*.eval.yaml"))
    fixtures: list[LoadedFixture] = []

    for file in files:
        parsed = yaml.safe_load(file.read_text())
        tool, cases = _parse_fixture(parsed, file)
        package_name = file.relative_to(packages_dir).parts[0]
        fixtures.append(
            LoadedFixture(
                tool=tool,
                cases=cases,
                package_name=package_name,
                fixture_path=str(file),
            )
        )

    return fixtures
