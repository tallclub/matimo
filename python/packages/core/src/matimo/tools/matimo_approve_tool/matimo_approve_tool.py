"""matimo_approve_tool — approve a draft tool for production use."""
from __future__ import annotations

import hashlib
import logging
from pathlib import Path

import yaml

logger = logging.getLogger("matimo")


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    from matimo.core.models import ToolDefinition
    from matimo.policy.approval_manifest import ApprovalManifest
    from matimo.policy.content_validator import validate_tool_content
    from matimo.policy.types import PolicyConfig

    name: str = params.get("name", "")
    tool_dir: str = params.get("tool_dir", "./matimo-tools")

    def_path = Path(tool_dir) / name / "definition.yaml"
    if not def_path.exists():
        return {"success": False, "message": f"Tool not found: {def_path}"}

    yaml_content = def_path.read_text(encoding="utf-8")

    try:
        parsed = yaml.safe_load(yaml_content)
        tool_def = ToolDefinition.model_validate(parsed)
    except Exception as exc:
        return {"success": False, "message": f"Validation failed: {exc}"}

    try:
        result = validate_tool_content(tool_def, PolicyConfig())
        critical = [v for v in result if v.severity in ("critical", "high")]
        if critical:
            return {
                "success": False,
                "message": "Tool has policy violations that must be resolved before approval",
            }
    except Exception as exc:
        return {"success": False, "message": f"Content validation error: {exc}"}

    content_hash = hashlib.sha256(yaml_content.encode("utf-8")).hexdigest()
    manifest = ApprovalManifest(str(Path(tool_dir).resolve()))
    record = manifest.approve(name, content_hash)

    # Update status in definition.yaml to 'approved'
    parsed["status"] = "approved"
    updated_yaml = yaml.dump(parsed, default_flow_style=False, allow_unicode=True)
    def_path.write_text(updated_yaml, encoding="utf-8")

    logger.info("matimo_approve_tool: approved name=%s", name)
    return {
        "success": True,
        "name": name,
        "hash": content_hash,
        "approvedAt": record.approved_at,
        "message": "Tool approved. Effective after reload or immediately if auto-reload is active.",
    }
