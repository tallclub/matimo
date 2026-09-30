"""
Loads every tool definition across the workspace.

Mirrors: typescript/packages/evals/src/tool-selection/tool-corpus.ts
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml
from matimo.core.models import ToolDefinition

from matimo_evals.tool_selection.tool_selection_matcher import ToolCorpusEntry


@dataclass
class LoadedTool:
    definition: ToolDefinition
    package_name: str
    definition_path: str


def load_tool_corpus(packages_dir: Path) -> list[LoadedTool]:
    """
    Load every tool definition across the workspace — reuses the same glob
    shape as scripts/validate_tools.py (packages/<name>/src/matimo_<name>/tools/**/definition.yaml)
    so the eval corpus always reflects the real, currently-registered tool
    catalog, not a hand-maintained subset.
    """
    files = sorted(packages_dir.glob("*/src/*/tools/**/definition.yaml"))
    loaded: list[LoadedTool] = []

    for file in files:
        parsed = yaml.safe_load(file.read_text())
        # Provider-level definition.yaml is `type: provider`, not a tool — skip it.
        if isinstance(parsed, dict) and parsed.get("type") == "provider":
            continue

        definition = ToolDefinition.model_validate(parsed)
        package_name = file.relative_to(packages_dir).parts[0]
        loaded.append(
            LoadedTool(
                definition=definition,
                package_name=package_name,
                definition_path=str(file),
            )
        )

    return loaded


def to_corpus_entry(tool: ToolDefinition) -> ToolCorpusEntry:
    parameter_descriptions = (
        [p.description for p in tool.parameters.values()] if tool.parameters else []
    )
    return ToolCorpusEntry(
        name=tool.name,
        description=tool.description,
        parameter_descriptions=parameter_descriptions,
    )
