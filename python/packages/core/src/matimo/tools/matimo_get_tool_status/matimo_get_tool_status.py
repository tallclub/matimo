"""matimo_get_tool_status — get the approval state and risk level of a tool."""
from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path

import yaml

logger = logging.getLogger("matimo")

UNSAFE_NAME = re.compile(r"[/\\]|\.\.|[\x00-\x1f]")


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    from matimo.core.models import ToolDefinition, ToolStatus
    from matimo.policy.approval_manifest import ApprovalManifest
    from matimo.policy.default_policy import get_tier_for_tool
    from matimo.policy.risk_classifier import classify_risk
    from matimo.policy.types import PolicyTier

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
        return {"found": False, "message": f'Tool "{name}" not found at {def_path}'}

    yaml_content = def_path.read_text(encoding="utf-8")
    try:
        parsed = yaml.safe_load(yaml_content)
        tool_def = ToolDefinition.model_validate(parsed)
    except Exception as exc:
        return {"found": True, "name": name, "message": f"Tool YAML is invalid: {exc}"}

    try:
        risk_level = classify_risk(tool_def)
    except Exception:
        risk_level = "medium"

    content_hash = hashlib.sha256(yaml_content.encode("utf-8")).hexdigest()
    manifest = ApprovalManifest(str(Path(tool_dir).resolve()))
    is_approved = manifest.is_approved(name, content_hash)

    # Find approval record from get_all()
    approval = next((r for r in manifest.get_all() if r.name == name), None)

    status = str(tool_def.status)
    if status == ToolStatus.DEPRECATED:
        approval_state = "rejected"
    elif is_approved:
        approval_state = "approved"
    elif get_tier_for_tool(tool_def) == PolicyTier.AUTO:
        approval_state = "auto-approved"
    else:
        approval_state = "pending"

    return {
        "found": True,
        "name": name,
        "status": status,
        "riskLevel": risk_level,
        "approvalState": approval_state,
        "approvedAt": approval.approved_at if approval else None,
        "approvedBy": approval.approved_by if approval else None,
        "message": f'Tool "{name}" is {approval_state} ({risk_level} risk)',
    }
