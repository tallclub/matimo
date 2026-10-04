"""matimo_approve_tool — approve a draft tool for production use."""
from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path
from typing import TYPE_CHECKING

import yaml

if TYPE_CHECKING:
    from matimo.executors.function_executor import FunctionToolContext
    from matimo.policy.approval_manifest import ApprovalManifest

logger = logging.getLogger("matimo")

UNSAFE_NAME = re.compile(r"[/\\]|\.\.|[\x00-\x1f]")


async def run(params: dict, context: FunctionToolContext | None = None) -> dict:  # type: ignore[type-arg]
    from matimo.core.models import ToolDefinition
    from matimo.policy.approval_manifest import ApprovalManifest
    from matimo.policy.content_validator import validate_tool_content
    from matimo.policy.types import PolicyConfig

    name: str = params.get("name", "")
    tool_dir: str = params.get("tool_dir", "./matimo-tools")

    if not name or not name.strip():
        return {"success": False, "message": "Tool name is required"}
    if UNSAFE_NAME.search(name):
        return {
            "success": False,
            "message": "Tool name contains invalid characters (path traversal, backslash, or control characters)",
        }

    # When the host identifies the caller, only an admin may approve. The policy
    # context comes from the host (execute(..., context=...) or the MCP server's
    # `context` option), never from the agent, so an agent cannot grant itself
    # the role. Without any context, the human who must confirm this call
    # (requires_approval, which nothing can pre-approve) is the approver.
    caller = context.policy_context if context else None
    if caller is not None and "admin" not in (caller.roles or []):
        return {
            "success": False,
            "message": (
                "Approving a tool requires the admin role. The host grants it with "
                "execute(..., context=PolicyContext(roles=['admin'])) or the MCP "
                "server's context option."
            ),
        }

    def_path = Path(tool_dir) / name / "definition.yaml"
    if not def_path.exists():
        return {"success": False, "message": f"Tool not found: {def_path}"}

    yaml_content = def_path.read_text(encoding="utf-8")

    # An agent may not approve a tool it created itself (matimo_create_tool
    # records the creating agent as created_by).
    try:
        created_by = (yaml.safe_load(yaml_content) or {}).get("created_by")
    except yaml.YAMLError:
        created_by = None
    if (
        isinstance(created_by, str)
        and caller is not None
        and caller.agent_id is not None
        and created_by == caller.agent_id
    ):
        return {
            "success": False,
            "message": (
                f'Tool "{name}" was created by {created_by}; someone other than its '
                "creator must approve it."
            ),
        }

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

    # Update status in definition.yaml to 'approved' — write first, so the approval
    # hash below is computed from the file's *final* on-disk content. Hashing
    # yaml_content (pre-mutation) here would make is_approved() unable to ever
    # match the tool's own post-approval file — approvals would silently never
    # validate.
    parsed["status"] = "approved"
    updated_yaml = yaml.dump(parsed, default_flow_style=False, allow_unicode=True)
    def_path.write_text(updated_yaml, encoding="utf-8")

    final_content = def_path.read_text(encoding="utf-8")
    content_hash = hashlib.sha256(final_content.encode("utf-8")).hexdigest()
    manifest = _owner_approval_manifest() or ApprovalManifest(str(Path(tool_dir).resolve()))
    record = manifest.approve(name, content_hash)

    logger.info("matimo_approve_tool: approved name=%s", name)
    return {
        "success": True,
        "name": name,
        "hash": content_hash,
        "approvedAt": record.approved_at,
        "message": "Tool approved. Effective after reload or immediately if auto-reload is active.",
    }


def _owner_approval_manifest() -> ApprovalManifest | None:
    """
    The approval manifest of the instance that owns this call. Recording the
    approval there means the instance's next reload sees it, signed with the
    same secret and stored where that instance looks; a manifest of our own
    would sign with a different ephemeral secret when none is configured.
    """
    from matimo.decorators import get_global_matimo_instance

    owner = get_global_matimo_instance()
    return owner.get_approval_manifest() if owner is not None else None
