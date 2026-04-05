"""
``matimo review`` — human oversight for agent-created tools.

Mirrors: packages/cli/src/commands/review.ts

Subcommands:
  matimo review list              Show all tools awaiting approval
  matimo review approve <name>    Approve a pending tool
  matimo review reject  <name>    Reject / revoke a tool
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import yaml


def _resolve_manifest_dir() -> str:
    tool_dir = os.environ.get("MATIMO_TOOL_DIR")
    return str(Path(tool_dir).resolve()) if tool_dir else os.getcwd()


def _try_load_manifest(directory: str):
    """Try to import ApprovalManifest from matimo core."""
    try:
        from matimo.policy.approval_manifest import ApprovalManifest  # type: ignore[import-not-found]
        return ApprovalManifest(directory)
    except ImportError:
        return None


def _print_table(headers: list[str], rows: list[list[str]]) -> None:
    cols = len(headers)
    widths = [
        max(len(h), *(len(r[i]) if i < len(r) else 0 for r in rows))
        for i, h in enumerate(headers)
    ]
    fmt = lambda row: "│ " + " │ ".join(c.ljust(w) for c, w in zip(row, widths)) + " │"

    print("┌" + "┬".join("─" * (w + 2) for w in widths) + "┐")
    print(fmt(headers))
    print("├" + "┼".join("─" * (w + 2) for w in widths) + "┤")
    for row in rows:
        padded = (row + [""] * cols)[:cols]
        print(fmt(padded))
    print("└" + "┴".join("─" * (w + 2) for w in widths) + "┘")


def _list_pending(directory: str) -> None:
    manifest = _try_load_manifest(directory)
    if manifest is None:
        print("❌ matimo core is not available. Run `pip install matimo` first.", file=sys.stderr)
        sys.exit(1)

    pending = manifest.get_pending_tools()
    approved = manifest.list_approved()

    if not pending and not approved:
        print("ℹ️  No tools are pending or approved.")
        return

    if pending:
        print("\n⏳ Pending approval:\n")
        rows = [[name, "pending", "—", "—"] for name in pending]
        _print_table(["Tool name", "Status", "Approved by", "Approved at"], rows)

    if approved:
        print("\n✅ Approved tools:\n")
        rows = []
        for name in approved:
            rec = manifest.get_approval(name) or {}
            rows.append([name, "approved", rec.get("approved_by", "—"), rec.get("approved_at", "—")])
        _print_table(["Tool name", "Status", "Approved by", "Approved at"], rows)

    if pending:
        print('\nRun "matimo review approve <tool-name>" to approve, '
              'or "matimo review reject <tool-name>" to reject.')


def _approve_tool(tool_name: str, directory: str) -> None:
    if not tool_name:
        print("❌ Usage: matimo review approve <tool-name>", file=sys.stderr)
        sys.exit(1)

    manifest = _try_load_manifest(directory)
    if manifest is None:
        print("❌ matimo core is not available.", file=sys.stderr)
        sys.exit(1)

    pending = manifest.get_pending_tools()
    if tool_name not in pending:
        approved = manifest.list_approved()
        if tool_name in approved:
            print(f'ℹ️  "{tool_name}" is already approved.')
            return
        print(f'❌ No pending tool named "{tool_name}". Run "matimo review list" to see pending tools.', file=sys.stderr)
        sys.exit(1)

    secret = os.environ.get("MATIMO_APPROVAL_SECRET")
    if not secret:
        print("❌ MATIMO_APPROVAL_SECRET is not set.", file=sys.stderr)
        print("   Set it to approve tools: export MATIMO_APPROVAL_SECRET=<your-secret>")
        sys.exit(1)

    yaml_path = Path(directory) / tool_name / "definition.yaml"
    if not yaml_path.is_file():
        print(f'❌ Cannot find definition.yaml for tool "{tool_name}" at:\n   {yaml_path}', file=sys.stderr)
        sys.exit(1)

    content = yaml_path.read_text(encoding="utf-8")

    # Promote status to "approved"
    try:
        parsed = yaml.safe_load(content) or {}
        if isinstance(parsed, dict) and parsed.get("status") != "approved":
            parsed["status"] = "approved"
            content = yaml.dump(parsed, default_flow_style=False)
            tmp_path = yaml_path.with_suffix(".yaml.tmp")
            tmp_path.write_text(content, encoding="utf-8")
            tmp_path.rename(yaml_path)
            print("   📝 Updated status: draft → approved in definition.yaml")
    except Exception:
        print("⚠️  Failed to update status in definition.yaml; proceeding with manifest approval only.")

    hash_val = manifest.compute_hash(content)
    approved_by = os.environ.get("USER") or os.environ.get("USERNAME") or "cli"
    manifest.approve(tool_name, hash_val, approved_by)
    print(f'✅ Tool "{tool_name}" approved.')


def _reject_tool(tool_name: str, directory: str) -> None:
    if not tool_name:
        print("❌ Usage: matimo review reject <tool-name>", file=sys.stderr)
        sys.exit(1)

    manifest = _try_load_manifest(directory)
    if manifest is None:
        print("❌ matimo core is not available.", file=sys.stderr)
        sys.exit(1)

    was_approved = manifest.revoke(tool_name)
    pending = manifest.get_pending_tools()
    was_pending = tool_name in pending

    if not was_approved and not was_pending:
        print(f'ℹ️  No record of tool "{tool_name}". Nothing to reject.')
        return

    print(f'🗑  Tool "{tool_name}" has been rejected/revoked.')
    if was_approved:
        print("   (Approval signature removed — the tool will be blocked until re-approved.)")


def review_command(args: list[str]) -> None:
    sub = args[0] if args else None
    directory = _resolve_manifest_dir()

    match sub:
        case "list" | None:
            _list_pending(directory)
        case "approve":
            _approve_tool(args[1] if len(args) > 1 else "", directory)
        case "reject":
            _reject_tool(args[1] if len(args) > 1 else "", directory)
        case _:
            print(f'❌ Unknown review subcommand: "{sub}"', file=sys.stderr)
            print("Usage: matimo review [list|approve|reject] [tool-name]")
            sys.exit(1)
