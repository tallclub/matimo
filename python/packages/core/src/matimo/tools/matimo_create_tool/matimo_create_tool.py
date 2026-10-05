"""matimo_create_tool — create a new tool definition on disk."""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import TYPE_CHECKING

import yaml

if TYPE_CHECKING:
    from matimo.executors.function_executor import FunctionToolContext

logger = logging.getLogger("matimo")

UNSAFE_NAME = re.compile(r"[/\\]|\.\.|[\x00-\x1f]")
RESERVED_PREFIX = "matimo_"


async def run(params: dict, context: FunctionToolContext | None = None) -> dict:  # type: ignore[type-arg]
    from matimo.core.models import ToolDefinition
    from matimo.policy.content_validator import validate_tool_content
    from matimo.policy.default_policy import get_tier_for_tool
    from matimo.policy.risk_classifier import classify_risk
    from matimo.policy.types import PolicyConfig, PolicyTier

    name: str = (params.get("name") or "").strip()
    yaml_content: str = params.get("yaml_content", "")
    target_dir: str = params.get("target_dir", "./matimo-tools")
    proposed_by: str | None = params.get("proposed_by")
    justification: str | None = params.get("justification")

    if not name:
        return {"success": False, "message": "Tool name is required"}
    if UNSAFE_NAME.search(name):
        return {
            "success": False,
            "message": "Tool name contains invalid characters (path traversal, backslash, or control characters)",
        }
    if name.startswith(RESERVED_PREFIX):
        return {"success": False, "message": 'Tool name cannot start with reserved namespace "matimo_"'}

    try:
        parsed = yaml.safe_load(yaml_content)
        if not parsed or not isinstance(parsed, dict):
            return {"success": False, "message": "YAML must parse to an object"}
    except yaml.YAMLError as exc:
        return {"success": False, "message": f"YAML parse error: {exc}"}

    parsed["name"] = name
    parsed["requires_approval"] = True
    parsed["status"] = "draft"
    # Record the creating agent (from the host-supplied policy context) so
    # matimo_approve_tool can refuse to let it approve its own tool. Never
    # taken from the YAML: an agent could otherwise name someone else.
    parsed.pop("created_by", None)
    agent_id = context.policy_context.agent_id if context and context.policy_context else None
    if agent_id:
        parsed["created_by"] = agent_id
    final_yaml = yaml.dump(parsed, default_flow_style=False, allow_unicode=True)

    try:
        tool_def = ToolDefinition.model_validate(parsed)
    except Exception as exc:
        return {"success": False, "message": f"Schema validation failed: {exc}"}

    # Content validation — hard fail on critical/high violations (matches TS behaviour)
    violations = validate_tool_content(tool_def, PolicyConfig())
    critical_or_high = [v for v in violations if v.severity in ("critical", "high")]
    if critical_or_high:
        return {
            "success": False,
            "message": "Tool failed policy validation",
            "errors": [f"[{v.severity}] {v.rule}: {v.message}" for v in critical_or_high],
        }

    risk_level = classify_risk(tool_def)
    tier = get_tier_for_tool(tool_def)
    # Every created tool is a draft, and a draft runs only once it is approved.
    approval_state = "pending"

    # Build optional comment header (proposed_by / justification)
    header = ""
    if proposed_by:
        header += f"# Proposed by: {proposed_by}\n"
    if justification:
        header += f"# Justification: {justification}\n"
    if header:
        header += "\n"

    tool_path = Path(target_dir) / name
    tool_path.mkdir(parents=True, exist_ok=True)
    (tool_path / "definition.yaml").write_text(header + final_yaml, encoding="utf-8")

    logger.info(
        "matimo_create_tool: tool created name=%s approvalState=%s", name, approval_state
    )

    message = (
        "Tool created as a draft (low risk, read-only). It runs after a reviewer "
        "approves it with matimo_approve_tool and the tools reload."
        if tier == PolicyTier.AUTO
        else "Tool created as a draft. It runs after a reviewer approves it with "
        "matimo_approve_tool and the tools reload."
    )

    return {
        "success": True,
        "path": str(tool_path / "definition.yaml"),
        "riskLevel": risk_level,
        "status": "draft",
        "approvalState": approval_state,
        "message": message,
    }

