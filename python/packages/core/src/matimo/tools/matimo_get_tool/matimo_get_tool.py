"""matimo_get_tool — retrieve the full definition of a tool (YAML + parsed fields)."""
from __future__ import annotations

import logging
import re
from pathlib import Path

import yaml

logger = logging.getLogger("matimo")

UNSAFE_NAME = re.compile(r"[/\\]|\.\.|[\x00-\x1f]")


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    from matimo.core.models import ToolDefinition

    name: str = params.get("name", "")
    tool_dir: str = params.get("tool_dir", "./matimo-tools")

    if not name or not name.strip():
        return {"found": False, "message": "Tool name is required"}
    if UNSAFE_NAME.search(name):
        return {
            "found": False,
            "message": "Tool name contains invalid characters (path traversal, backslash, or control characters)",
        }

    def_path = Path(tool_dir) / name / "definition.yaml"
    if not def_path.exists():
        logger.warning("matimo_get_tool: tool not found at %s", def_path)
        return {"found": False, "message": f'Tool "{name}" not found at {def_path}'}

    yaml_content = def_path.read_text(encoding="utf-8")

    try:
        parsed = yaml.safe_load(yaml_content)
        tool_def = ToolDefinition.model_validate(parsed)
    except Exception as exc:
        return {
            "found": True,
            "name": name,
            "yaml_content": yaml_content,
            "message": f"Tool YAML is invalid: {exc}",
        }

    # Convert to dict, excluding internal private fields
    definition = tool_def.model_dump(exclude_none=True)
    definition.pop("_definition_path", None)

    logger.debug("matimo_get_tool: retrieved %s", name)

    return {
        "found": True,
        "name": name,
        "yaml_content": yaml_content,
        "definition": definition,
        "message": f'Tool "{name}" retrieved successfully',
    }
