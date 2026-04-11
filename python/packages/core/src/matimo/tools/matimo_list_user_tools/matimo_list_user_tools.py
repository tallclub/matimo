"""matimo_list_user_tools — list all user-created tools in a directory."""
from __future__ import annotations

import logging
from pathlib import Path

import yaml

logger = logging.getLogger("matimo")


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    from matimo.core.models import ToolDefinition
    from matimo.policy.risk_classifier import classify_risk

    tool_dir: str = params.get("tool_dir", "./matimo-tools")
    include_drafts: bool = bool(params.get("include_drafts", True))

    root = Path(tool_dir)
    if not root.exists():
        return {"tools": [], "total": 0}

    tools = []
    for subdir in sorted(root.iterdir()):
        if not subdir.is_dir():
            continue
        def_path = subdir / "definition.yaml"
        if not def_path.exists():
            continue
        try:
            parsed = yaml.safe_load(def_path.read_text(encoding="utf-8"))
            tool_def = ToolDefinition.model_validate(parsed)
            status = str(tool_def.status)
            if not include_drafts and status == "draft":
                continue
            try:
                risk_level = classify_risk(tool_def)
            except Exception:
                risk_level = "medium"
            tools.append({
                "name": tool_def.name,
                "description": tool_def.description,
                "version": tool_def.version,
                "status": status,
                "riskLevel": risk_level,
                "tags": tool_def.tags or [],
            })
        except Exception as exc:
            logger.warning("matimo_list_user_tools: failed to parse %s: %s", def_path, exc)

    return {"tools": tools, "total": len(tools)}
