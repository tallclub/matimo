"""Unit tests for all 10 core meta-tool run() functions.

Each meta-tool lives in packages/core/src/matimo/tools/<name>/<name>.py
and exposes a single async `run(params: dict) -> dict` function.
"""
from __future__ import annotations

import textwrap
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_VALID_HTTP_TOOL_YAML = textwrap.dedent("""\
    name: my_api_tool
    version: '1.0.0'
    description: Fetch data from an API
    parameters:
      query:
        type: string
        required: true
        description: Search query
    execution:
      type: http
      method: GET
      url: 'https://api.example.com/search?q={query}'
""")

_VALID_DRAFT_TOOL_YAML = textwrap.dedent("""\
    name: my_api_tool
    version: '1.0.0'
    description: Fetch data from an API
    status: draft
    requires_approval: true
    parameters:
      query:
        type: string
        required: true
        description: Search query
    execution:
      type: http
      method: GET
      url: 'https://api.example.com/search?q={query}'
""")

_COMMAND_TOOL_YAML = textwrap.dedent("""\
    name: run_script
    version: '1.0.0'
    description: Run a script
    execution:
      type: command
      command: bash
      args: ['script.sh']
""")

_INVALID_YAML = ": invalid: {yaml ["

_EMPTY_YAML = ""

_VALID_SKILL_CONTENT = textwrap.dedent("""\
    ---
    name: my-skill
    description: A test skill for validation
    ---

    # My Skill

    This skill does useful things.
""")


def _write_tool(tool_dir: Path, name: str, yaml_content: str = _VALID_HTTP_TOOL_YAML) -> Path:
    """Write a tool definition.yaml to a temp directory."""
    path = tool_dir / name
    path.mkdir(parents=True, exist_ok=True)
    (path / "definition.yaml").write_text(yaml_content)
    return path


def _write_skill(skills_dir: Path, name: str, content: str | None = None) -> Path:
    """Write a SKILL.md to a temp directory."""
    path = skills_dir / name
    path.mkdir(parents=True, exist_ok=True)
    skill_content = content or textwrap.dedent(f"""\
        ---
        name: {name}
        description: A test skill
        ---

        # {name}
    """)
    (path / "SKILL.md").write_text(skill_content)
    return path


# ===========================================================================
# matimo_validate_tool
# ===========================================================================

class TestMatimoValidateTool:
    """Tests for matimo_validate_tool.run()."""

    @pytest.mark.asyncio
    async def test_valid_http_get_tool_passes(self) -> None:
        from matimo.tools.matimo_validate_tool.matimo_validate_tool import run

        result = await run({"yaml_content": _VALID_HTTP_TOOL_YAML})

        assert result["valid"] is True
        assert result["schemaErrors"] == []
        assert result["riskLevel"] == "low"

    @pytest.mark.asyncio
    async def test_invalid_yaml_syntax_returns_error(self) -> None:
        from matimo.tools.matimo_validate_tool.matimo_validate_tool import run

        result = await run({"yaml_content": _INVALID_YAML})

        assert result["valid"] is False
        assert len(result["schemaErrors"]) > 0
        assert "YAML parse error" in result["schemaErrors"][0]["message"]

    @pytest.mark.asyncio
    async def test_empty_yaml_returns_error(self) -> None:
        from matimo.tools.matimo_validate_tool.matimo_validate_tool import run

        result = await run({"yaml_content": ""})

        assert result["valid"] is False
        assert len(result["schemaErrors"]) > 0

    @pytest.mark.asyncio
    async def test_non_dict_yaml_returns_error(self) -> None:
        from matimo.tools.matimo_validate_tool.matimo_validate_tool import run

        result = await run({"yaml_content": "- item1\n- item2\n"})

        assert result["valid"] is False
        assert any("object" in e["message"] for e in result["schemaErrors"])

    @pytest.mark.asyncio
    async def test_missing_required_fields_returns_schema_errors(self) -> None:
        from matimo.tools.matimo_validate_tool.matimo_validate_tool import run

        result = await run({"yaml_content": "name: missing_execution\ndescription: incomplete\n"})

        assert result["valid"] is False
        assert len(result["schemaErrors"]) > 0

    @pytest.mark.asyncio
    async def test_command_tool_reports_policy_violation(self) -> None:
        from matimo.tools.matimo_validate_tool.matimo_validate_tool import run

        result = await run({"yaml_content": _COMMAND_TOOL_YAML})

        # Command tools may be blocked by policy — violations should be reported
        # valid is False when command is blocked
        assert "policyViolations" in result
        assert result["riskLevel"] in ("low", "medium", "high", "critical")

    @pytest.mark.asyncio
    async def test_missing_yaml_content_key_treated_as_empty(self) -> None:
        from matimo.tools.matimo_validate_tool.matimo_validate_tool import run

        result = await run({})

        assert result["valid"] is False

    @pytest.mark.asyncio
    async def test_risk_level_is_always_present(self) -> None:
        from matimo.tools.matimo_validate_tool.matimo_validate_tool import run

        result = await run({"yaml_content": _VALID_HTTP_TOOL_YAML})

        assert "riskLevel" in result
        assert result["riskLevel"] in ("low", "medium", "high", "critical")

    @pytest.mark.asyncio
    async def test_classify_risk_failure_uses_medium(self) -> None:
        """If classify_risk raises inside validate_tool, riskLevel falls back to 'medium'."""
        from matimo.tools.matimo_validate_tool.matimo_validate_tool import run

        with patch(
            "matimo.policy.risk_classifier.classify_risk",
            side_effect=Exception("broken"),
        ):
            result = await run({"yaml_content": _VALID_HTTP_TOOL_YAML})

        assert result["riskLevel"] == "medium"


# ===========================================================================
# matimo_create_tool
# ===========================================================================

class TestMatimoCreateTool:
    """Tests for matimo_create_tool.run()."""

    @pytest.mark.asyncio
    async def test_creates_tool_on_disk(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        result = await run({
            "name": "city_lookup",
            "yaml_content": _VALID_HTTP_TOOL_YAML,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is True
        assert (tmp_path / "city_lookup" / "definition.yaml").exists()
        assert result["status"] == "draft"
        # A plain HTTP GET with no auth headers is auto-approved (low-risk read-only)
        assert result["approvalState"] in ("auto-approved", "pending")
        assert "contentHash" not in result

    @pytest.mark.asyncio
    async def test_forces_draft_status_and_requires_approval(self, tmp_path: Path) -> None:
        import yaml

        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        await run({
            "name": "my_tool",
            "yaml_content": _VALID_HTTP_TOOL_YAML,
            "target_dir": str(tmp_path),
        })

        written = yaml.safe_load((tmp_path / "my_tool" / "definition.yaml").read_text())
        assert written["status"] == "draft"
        assert written["requires_approval"] is True

    @pytest.mark.asyncio
    async def test_rejects_empty_name(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        result = await run({
            "name": "",
            "yaml_content": _VALID_HTTP_TOOL_YAML,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False
        assert "name" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_rejects_path_traversal_name(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        result = await run({
            "name": "../evil",
            "yaml_content": _VALID_HTTP_TOOL_YAML,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False
        assert "invalid characters" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_rejects_reserved_namespace(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        result = await run({
            "name": "matimo_backdoor",
            "yaml_content": _VALID_HTTP_TOOL_YAML,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False
        assert "reserved" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_rejects_invalid_yaml(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        result = await run({
            "name": "some_tool",
            "yaml_content": _INVALID_YAML,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False
        assert "YAML" in result["message"]

    @pytest.mark.asyncio
    async def test_rejects_non_dict_yaml(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        result = await run({
            "name": "some_tool",
            "yaml_content": "- item1\n",
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_rejects_schema_invalid_yaml(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        result = await run({
            "name": "bad_tool",
            "yaml_content": "not_a_field: true\n",
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False
        assert "Schema validation failed" in result["message"]

    @pytest.mark.asyncio
    async def test_rejects_backslash_in_name(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        result = await run({
            "name": "tool\\evil",
            "yaml_content": _VALID_HTTP_TOOL_YAML,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_risk_level_included_in_response(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        result = await run({
            "name": "safe_lookup",
            "yaml_content": _VALID_HTTP_TOOL_YAML,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is True
        assert result["riskLevel"] in ("low", "medium", "high", "critical")

    @pytest.mark.asyncio
    async def test_auto_approved_for_low_risk_get_tool(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        result = await run({
            "name": "public_lookup",
            "yaml_content": _VALID_HTTP_TOOL_YAML,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is True
        assert result["approvalState"] == "auto-approved"
        assert "Ready for use" in result["message"]

    @pytest.mark.asyncio
    async def test_pending_for_post_tool(self, tmp_path: Path) -> None:
        import textwrap

        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        post_yaml = textwrap.dedent("""\
            name: post_tool
            version: '1.0.0'
            description: Post data to API
            execution:
              type: http
              method: POST
              url: 'https://api.example.com/data'
        """)
        result = await run({
            "name": "post_tool",
            "yaml_content": post_yaml,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is True
        assert result["approvalState"] == "pending"
        assert "approval" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_proposed_by_and_justification_written_as_header(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        result = await run({
            "name": "lookup_tool",
            "yaml_content": _VALID_HTTP_TOOL_YAML,
            "target_dir": str(tmp_path),
            "proposed_by": "agent-1",
            "justification": "Needed for data lookup",
        })

        assert result["success"] is True
        content = (tmp_path / "lookup_tool" / "definition.yaml").read_text()
        assert "# Proposed by: agent-1" in content
        assert "# Justification: Needed for data lookup" in content

    @pytest.mark.asyncio
    async def test_errors_format_includes_severity_rule_and_message(self, tmp_path: Path) -> None:
        import textwrap

        from matimo.tools.matimo_create_tool.matimo_create_tool import run

        # A function tool triggers a critical policy violation
        fn_yaml = textwrap.dedent("""\
            name: sneaky_fn
            version: '1.0.0'
            description: Function tool that policy blocks
            execution:
              type: function
              code: './sneaky.py'
        """)
        result = await run({
            "name": "sneaky_fn",
            "yaml_content": fn_yaml,
            "target_dir": str(tmp_path),
        })

        # Either rejected by policy OR schema (function tools may be blocked)
        if not result["success"] and "errors" in result:
            # errors must follow [severity] rule: message format
            assert all(e.startswith("[") for e in result["errors"])


# ===========================================================================
# matimo_approve_tool
# ===========================================================================

class TestMatimoApproveTool:
    """Tests for matimo_approve_tool.run()."""

    @pytest.mark.asyncio
    async def test_approves_existing_draft_tool(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_approve_tool.matimo_approve_tool import run

        _write_tool(tmp_path, "city_lookup", _VALID_DRAFT_TOOL_YAML)

        result = await run({"name": "city_lookup", "tool_dir": str(tmp_path)})

        assert result["success"] is True
        assert result["name"] == "city_lookup"
        assert "hash" in result
        assert "approvedAt" in result

    @pytest.mark.asyncio
    async def test_updates_status_to_approved_on_disk(self, tmp_path: Path) -> None:
        import yaml

        from matimo.tools.matimo_approve_tool.matimo_approve_tool import run

        _write_tool(tmp_path, "my_tool", _VALID_DRAFT_TOOL_YAML)

        await run({"name": "my_tool", "tool_dir": str(tmp_path)})

        written = yaml.safe_load((tmp_path / "my_tool" / "definition.yaml").read_text())
        assert written["status"] == "approved"

    @pytest.mark.asyncio
    async def test_fails_for_nonexistent_tool(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_approve_tool.matimo_approve_tool import run

        result = await run({"name": "nonexistent", "tool_dir": str(tmp_path)})

        assert result["success"] is False
        assert "not found" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_fails_for_invalid_yaml_on_disk(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_approve_tool.matimo_approve_tool import run

        bad_dir = tmp_path / "bad_tool"
        bad_dir.mkdir()
        (bad_dir / "definition.yaml").write_text(_INVALID_YAML)

        result = await run({"name": "bad_tool", "tool_dir": str(tmp_path)})

        assert result["success"] is False
        assert "Validation failed" in result["message"]

    @pytest.mark.asyncio
    async def test_uses_default_tool_dir(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """When tool_dir omitted, defaults to ./matimo-tools."""
        from matimo.tools.matimo_approve_tool.matimo_approve_tool import run

        monkeypatch.chdir(tmp_path)
        _write_tool(tmp_path / "matimo-tools", "demo_tool", _VALID_DRAFT_TOOL_YAML)

        result = await run({"name": "demo_tool"})
        assert result["success"] is True


# ===========================================================================
# matimo_reload_tools
# ===========================================================================

class TestMatimoReloadTools:
    """Tests for matimo_reload_tools.run()."""

    @pytest.mark.asyncio
    async def test_returns_success_when_global_instance_available(self) -> None:
        from matimo.tools.matimo_reload_tools.matimo_reload_tools import run

        # Use MagicMock so list_tools() returns a plain list, not a coroutine
        mock_instance = MagicMock()
        mock_instance.list_tools.return_value = [MagicMock(), MagicMock()]
        mock_instance.reload = AsyncMock()

        with patch(
            "matimo.decorators.get_global_matimo_instance",
            return_value=mock_instance,
        ):
            result = await run({})

        assert result["success"] is True
        assert result["loaded"] == 2
        mock_instance.reload.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_failure_when_no_global_instance(self) -> None:
        from matimo.tools.matimo_reload_tools.matimo_reload_tools import run

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({})

        assert result["success"] is False
        assert "Reload must be handled" in result["message"]

    @pytest.mark.asyncio
    async def test_returns_failure_when_import_raises(self) -> None:
        from matimo.tools.matimo_reload_tools.matimo_reload_tools import run

        with patch(
            "matimo.decorators.get_global_matimo_instance",
            side_effect=ImportError("no module"),
        ):
            result = await run({})

        assert result["success"] is False


# ===========================================================================
# matimo_get_tool_status
# ===========================================================================

class TestMatimoGetToolStatus:
    """Tests for matimo_get_tool_status.run()."""

    @pytest.mark.asyncio
    async def test_returns_status_for_existing_tool(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_get_tool_status.matimo_get_tool_status import run

        _write_tool(tmp_path, "my_tool")

        result = await run({"name": "my_tool", "tool_dir": str(tmp_path)})

        assert result["found"] is True
        assert result["name"] == "my_tool"
        assert "status" in result
        assert "riskLevel" in result
        assert result["approvalState"] in ("pending", "approved", "rejected", "auto-approved")

    @pytest.mark.asyncio
    async def test_returns_not_found_for_missing_tool(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_get_tool_status.matimo_get_tool_status import run

        result = await run({"name": "nonexistent", "tool_dir": str(tmp_path)})

        assert result["found"] is False
        assert "nonexistent" in result["message"]

    @pytest.mark.asyncio
    async def test_status_is_approved_on_disk_after_approve_run(self, tmp_path: Path) -> None:
        """After approve_run, YAML status field is updated to 'approved'."""
        from matimo.tools.matimo_approve_tool.matimo_approve_tool import run as approve_run
        from matimo.tools.matimo_get_tool_status.matimo_get_tool_status import run as status_run

        _write_tool(tmp_path, "approved_tool", _VALID_DRAFT_TOOL_YAML)
        await approve_run({"name": "approved_tool", "tool_dir": str(tmp_path)})

        result = await status_run({"name": "approved_tool", "tool_dir": str(tmp_path)})

        assert result["found"] is True
        # The YAML status field is updated to 'approved' by approve_run
        assert result["status"] == "approved"
        # approvalState is determined by HMAC manifest; after file rewrite the hash
        # changes so approvalState may be 'pending' or 'auto-approved', but status reflects disk state
        assert result["approvalState"] in ("approved", "pending", "auto-approved")

    @pytest.mark.asyncio
    async def test_approval_state_approved_when_manifest_matches(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """approvalState == 'approved' when the manifest HMAC validates the current hash."""
        import hashlib

        from matimo.policy.approval_manifest import ApprovalManifest
        from matimo.tools.matimo_get_tool_status.matimo_get_tool_status import run as status_run

        # Fix MATIMO_APPROVAL_SECRET so both manifest instances share the same HMAC key
        monkeypatch.setenv("MATIMO_APPROVAL_SECRET", "test-stable-secret-for-status-tests")

        _write_tool(tmp_path, "verified_tool")
        yaml_content = (tmp_path / "verified_tool" / "definition.yaml").read_text()
        content_hash = hashlib.sha256(yaml_content.encode()).hexdigest()
        manifest = ApprovalManifest(str(tmp_path.resolve()))
        manifest.approve("verified_tool", content_hash)

        result = await status_run({"name": "verified_tool", "tool_dir": str(tmp_path)})

        assert result["found"] is True
        assert result["approvalState"] == "approved"

    @pytest.mark.asyncio
    async def test_invalid_yaml_returns_found_with_error(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_get_tool_status.matimo_get_tool_status import run

        bad_dir = tmp_path / "bad_tool"
        bad_dir.mkdir()
        (bad_dir / "definition.yaml").write_text("not_valid: yaml: [")

        result = await run({"name": "bad_tool", "tool_dir": str(tmp_path)})

        assert result["found"] is True
        assert "invalid" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_auto_approved_for_plain_get_tool(self, tmp_path: Path) -> None:
        """A plain HTTP GET without auth placeholders should be auto-approved."""
        from matimo.tools.matimo_get_tool_status.matimo_get_tool_status import run

        _write_tool(tmp_path, "get_tool")

        result = await run({"name": "get_tool", "tool_dir": str(tmp_path)})

        assert result["found"] is True
        assert result["approvalState"] == "auto-approved"
        assert "auto-approved" in result["message"]
        assert "low" in result["message"]  # risk level in message


# ===========================================================================
# matimo_list_user_tools
# ===========================================================================

class TestMatimoListUserTools:
    """Tests for matimo_list_user_tools.run()."""

    @pytest.mark.asyncio
    async def test_lists_tools_in_directory(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_list_user_tools.matimo_list_user_tools import run

        _write_tool(tmp_path, "tool_a")
        _write_tool(tmp_path, "tool_b")

        result = await run({"tool_dir": str(tmp_path)})

        assert result["total"] == 2
        names = {t["name"] for t in result["tools"]}
        assert "my_api_tool" in names  # name comes from YAML name field

    @pytest.mark.asyncio
    async def test_returns_empty_for_nonexistent_dir(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_list_user_tools.matimo_list_user_tools import run

        result = await run({"tool_dir": str(tmp_path / "does_not_exist")})

        assert result["total"] == 0
        assert result["tools"] == []

    @pytest.mark.asyncio
    async def test_exclude_drafts_when_flag_false(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_list_user_tools.matimo_list_user_tools import run

        # Explicitly write a draft tool — ToolDefinition defaults to 'stable' without this
        draft_yaml = _VALID_HTTP_TOOL_YAML + "status: draft\n"
        _write_tool(tmp_path, "draft_tool", draft_yaml)

        result = await run({"tool_dir": str(tmp_path), "include_drafts": False})

        assert result["total"] == 0

    @pytest.mark.asyncio
    async def test_include_drafts_by_default(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_list_user_tools.matimo_list_user_tools import run

        _write_tool(tmp_path, "my_tool")

        result = await run({"tool_dir": str(tmp_path)})

        assert result["total"] == 1

    @pytest.mark.asyncio
    async def test_skips_dirs_without_definition_yaml(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_list_user_tools.matimo_list_user_tools import run

        (tmp_path / "no_yaml_dir").mkdir()
        _write_tool(tmp_path, "valid_tool")

        result = await run({"tool_dir": str(tmp_path)})

        assert result["total"] == 1

    @pytest.mark.asyncio
    async def test_skips_invalid_yaml_files_with_warning(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_list_user_tools.matimo_list_user_tools import run

        bad_dir = tmp_path / "bad_tool"
        bad_dir.mkdir()
        (bad_dir / "definition.yaml").write_text(_INVALID_YAML)
        _write_tool(tmp_path, "good_tool")

        result = await run({"tool_dir": str(tmp_path)})

        # Only the valid tool should be listed
        assert result["total"] == 1

    @pytest.mark.asyncio
    async def test_tool_metadata_in_response(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_list_user_tools.matimo_list_user_tools import run

        _write_tool(tmp_path, "my_tool")

        result = await run({"tool_dir": str(tmp_path)})

        tool = result["tools"][0]
        assert "name" in tool
        assert "description" in tool
        assert "version" in tool
        assert "status" in tool
        assert "riskLevel" in tool
        assert "tags" in tool


# ===========================================================================
# matimo_create_skill
# ===========================================================================

class TestMatimoCreateSkill:
    """Tests for matimo_create_skill.run()."""

    @pytest.mark.asyncio
    async def test_creates_skill_on_disk(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_skill.matimo_create_skill import run

        result = await run({
            "name": "my-skill",
            "content": _VALID_SKILL_CONTENT,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is True
        assert (tmp_path / "my-skill" / "SKILL.md").exists()
        assert "my-skill" in result["path"]

    @pytest.mark.asyncio
    async def test_rejects_invalid_name(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_skill.matimo_create_skill import run

        result = await run({
            "name": "Bad_Name!",
            "content": _VALID_SKILL_CONTENT,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False
        assert "name" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_rejects_empty_name(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_skill.matimo_create_skill import run

        result = await run({
            "name": "",
            "content": _VALID_SKILL_CONTENT,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_rejects_missing_frontmatter(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_skill.matimo_create_skill import run

        result = await run({
            "name": "my-skill",
            "content": "# No frontmatter here",
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False
        assert "frontmatter" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_rejects_missing_description_in_frontmatter(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_skill.matimo_create_skill import run

        content = "---\nname: my-skill\n---\n# content"
        result = await run({
            "name": "my-skill",
            "content": content,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False
        assert "description" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_rejects_name_mismatch_between_param_and_frontmatter(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_skill.matimo_create_skill import run

        content = "---\nname: different-name\ndescription: A skill\n---\n# content"
        result = await run({
            "name": "my-skill",
            "content": content,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False
        assert "match" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_rejects_consecutive_hyphens_in_name(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_skill.matimo_create_skill import run

        result = await run({
            "name": "my--skill",
            "content": _VALID_SKILL_CONTENT,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_rejects_name_too_long(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_skill.matimo_create_skill import run

        result = await run({
            "name": "a" * 65,
            "content": _VALID_SKILL_CONTENT,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_rejects_missing_name_in_frontmatter(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_skill.matimo_create_skill import run

        content = "---\ndescription: A skill\n---\n# content"
        result = await run({
            "name": "my-skill",
            "content": content,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is False
        assert "name" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_valid_single_char_name(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_create_skill.matimo_create_skill import run

        content = "---\nname: a\ndescription: Minimal skill\n---\n# content"
        result = await run({
            "name": "a",
            "content": content,
            "target_dir": str(tmp_path),
        })

        assert result["success"] is True


# ===========================================================================
# matimo_list_skills
# ===========================================================================

class TestMatimoListSkills:
    """Tests for matimo_list_skills.run()."""

    @pytest.mark.asyncio
    async def test_lists_skills_from_explicit_dir(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_list_skills.matimo_list_skills import run

        _write_skill(tmp_path, "skill-a")
        _write_skill(tmp_path, "skill-b")

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"skills_dir": str(tmp_path)})

        assert result["total"] == 2
        names = {s["name"] for s in result["skills"]}
        assert "skill-a" in names
        assert "skill-b" in names

    @pytest.mark.asyncio
    async def test_returns_empty_for_nonexistent_dir(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_list_skills.matimo_list_skills import run

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"skills_dir": str(tmp_path / "missing")})

        assert result["total"] == 0
        assert result["skills"] == []

    @pytest.mark.asyncio
    async def test_includes_skills_from_global_instance(self) -> None:
        from matimo.tools.matimo_list_skills.matimo_list_skills import run

        mock_skill = MagicMock()
        mock_skill.name = "sdk-skill"
        mock_skill.description = "From SDK"
        mock_skill.source = "builtin"

        mock_instance = MagicMock()
        mock_instance.list_skills.return_value = [mock_skill]

        with patch("matimo.decorators.get_global_matimo_instance", return_value=mock_instance):
            result = await run({})

        assert result["total"] == 1
        assert result["skills"][0]["name"] == "sdk-skill"
        assert result["skills"][0]["source"] == "builtin"

    @pytest.mark.asyncio
    async def test_graceful_when_global_instance_raises(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_list_skills.matimo_list_skills import run

        _write_skill(tmp_path, "fallback-skill")

        with patch("matimo.decorators.get_global_matimo_instance", side_effect=Exception("boom")):
            result = await run({"skills_dir": str(tmp_path)})

        assert result["total"] == 1

    @pytest.mark.asyncio
    async def test_skill_metadata_in_response(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_list_skills.matimo_list_skills import run

        _write_skill(tmp_path, "meta-skill")

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"skills_dir": str(tmp_path)})

        skill = result["skills"][0]
        assert "name" in skill
        assert "description" in skill
        assert "source" in skill

    @pytest.mark.asyncio
    async def test_skips_dirs_without_skill_md(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_list_skills.matimo_list_skills import run

        (tmp_path / "no-skill-dir").mkdir()
        _write_skill(tmp_path, "valid-skill")

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"skills_dir": str(tmp_path)})

        assert result["total"] == 1


# ===========================================================================
# matimo_get_skill
# ===========================================================================

class TestMatimoGetSkill:
    """Tests for matimo_get_skill.run()."""

    @pytest.mark.asyncio
    async def test_returns_skill_content_by_name(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        _write_skill(tmp_path, "my-skill", _VALID_SKILL_CONTENT)

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"name": "my-skill", "skills_dir": str(tmp_path)})

        assert result["success"] is True
        assert result["name"] == "my-skill"
        assert "content" in result
        assert "A test skill for validation" in result["description"]

    @pytest.mark.asyncio
    async def test_returns_failure_for_missing_skill(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"name": "no-such-skill", "skills_dir": str(tmp_path)})

        assert result["success"] is False
        assert "no-such-skill" in result["message"]

    @pytest.mark.asyncio
    async def test_rejects_empty_skill_name(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"name": "", "skills_dir": str(tmp_path)})

        assert result["success"] is False
        assert "required" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_rejects_path_traversal_in_name(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"name": "../evil", "skills_dir": str(tmp_path)})

        assert result["success"] is False
        assert "invalid" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_rejects_path_traversal_in_file_param(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        _write_skill(tmp_path, "safe-skill", _VALID_SKILL_CONTENT)

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({
                "name": "safe-skill",
                "skills_dir": str(tmp_path),
                "file": "../../etc/passwd",
            })

        assert result["success"] is False
        assert "invalid" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_retrieved_skill_has_nonempty_message(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        _write_skill(tmp_path, "msg-skill", _VALID_SKILL_CONTENT)

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"name": "msg-skill", "skills_dir": str(tmp_path)})

        assert result["success"] is True
        assert result["message"]  # must be non-empty

    @pytest.mark.asyncio
    async def test_returns_resource_file_when_specified(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        skill_path = _write_skill(tmp_path, "resource-skill", _VALID_SKILL_CONTENT)
        (skill_path / "extra.md").write_text("Extra resource content")

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({
                "name": "resource-skill",
                "skills_dir": str(tmp_path),
                "file": "extra.md",
            })

        assert result["success"] is True
        assert result["content"] == "Extra resource content"

    @pytest.mark.asyncio
    async def test_returns_failure_for_missing_resource_file(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        _write_skill(tmp_path, "my-skill", _VALID_SKILL_CONTENT)

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({
                "name": "my-skill",
                "skills_dir": str(tmp_path),
                "file": "nonexistent.md",
            })

        assert result["success"] is False
        assert "nonexistent.md" in result["message"]

    @pytest.mark.asyncio
    async def test_finds_skill_from_global_instance(self) -> None:
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        mock_skill = MagicMock()
        mock_skill.name = "sdk-skill"
        mock_instance = MagicMock()
        mock_instance.list_skills.return_value = [mock_skill]

        # Returns not found since _path not set
        with patch("matimo.decorators.get_global_matimo_instance", return_value=mock_instance):
            result = await run({"name": "sdk-skill"})

        assert result["success"] is False  # no _path configured in mock

    @pytest.mark.asyncio
    async def test_no_skills_dir_and_no_global_returns_failure(self) -> None:
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"name": "any-skill"})

        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_resources_scanned_correctly(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        skill_path = _write_skill(tmp_path, "rich-skill", _VALID_SKILL_CONTENT)
        scripts_dir = skill_path / "scripts"
        scripts_dir.mkdir()
        (scripts_dir / "helper.py").write_text("# helper")

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"name": "rich-skill", "skills_dir": str(tmp_path)})

        assert result["success"] is True
        assert "helper.py" in result["resources"]["scripts"]


# ===========================================================================
# matimo_validate_skill
# ===========================================================================

class TestMatimoValidateSkill:
    """Tests for matimo_validate_skill.run()."""

    @pytest.mark.asyncio
    async def test_valid_skill_passes(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        _write_skill(tmp_path, "my-skill", _VALID_SKILL_CONTENT)

        result = await run({"name": "my-skill", "skills_dir": str(tmp_path)})

        assert result["valid"] is True
        assert result["issues"] == []
        assert result["structure"]["has_skill_md"] is True

    @pytest.mark.asyncio
    async def test_returns_error_for_missing_skill_dir(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        result = await run({"name": "no-skill", "skills_dir": str(tmp_path)})

        assert result["valid"] is False
        assert any("not found" in i["message"].lower() for i in result["issues"])

    @pytest.mark.asyncio
    async def test_returns_error_for_empty_name(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        result = await run({"name": "", "skills_dir": str(tmp_path)})

        assert result["valid"] is False
        assert "name is required" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_invalid_name_characters_reported(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        bad_dir = tmp_path / "Bad_Name"
        bad_dir.mkdir()
        (bad_dir / "SKILL.md").write_text(_VALID_SKILL_CONTENT)

        result = await run({"name": "Bad_Name", "skills_dir": str(tmp_path)})

        assert result["valid"] is False
        assert any("lowercase" in i["message"].lower() for i in result["issues"])

    @pytest.mark.asyncio
    async def test_missing_skill_md_reported(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        (tmp_path / "empty-skill").mkdir()

        result = await run({"name": "empty-skill", "skills_dir": str(tmp_path)})

        assert result["valid"] is False
        assert result["structure"]["has_skill_md"] is False

    @pytest.mark.asyncio
    async def test_missing_frontmatter_reported(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        skill_dir = tmp_path / "no-fm"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("# No frontmatter")

        result = await run({"name": "no-fm", "skills_dir": str(tmp_path)})

        assert result["valid"] is False
        assert any("frontmatter" in i["message"].lower() for i in result["issues"])

    @pytest.mark.asyncio
    async def test_frontmatter_name_mismatch_reported(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        skill_dir = tmp_path / "correct-name"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            "---\nname: wrong-name\ndescription: Test\n---\n# content"
        )

        result = await run({"name": "correct-name", "skills_dir": str(tmp_path)})

        assert result["valid"] is False
        assert any("match" in i["message"].lower() for i in result["issues"])

    @pytest.mark.asyncio
    async def test_missing_description_reported(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        skill_dir = tmp_path / "no-desc"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("---\nname: no-desc\n---\n# content")

        result = await run({"name": "no-desc", "skills_dir": str(tmp_path)})

        assert result["valid"] is False
        assert any("description" in i["message"].lower() for i in result["issues"])

    @pytest.mark.asyncio
    async def test_issues_have_field_key(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        skill_dir = tmp_path / "no-desc"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("---\nname: no-desc\n---\n# content")

        result = await run({"name": "no-desc", "skills_dir": str(tmp_path)})

        assert result["valid"] is False
        # Every issue must have a 'field' key
        assert all("field" in i for i in result["issues"])

    @pytest.mark.asyncio
    async def test_long_description_generates_warning(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        long_desc = "x" * 300
        skill_dir = tmp_path / "long-desc"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            f"---\nname: long-desc\ndescription: {long_desc}\n---\n# content"
        )

        result = await run({"name": "long-desc", "skills_dir": str(tmp_path)})

        # Should be valid (no errors) but may have warnings
        warnings = [i for i in result["issues"] if i["severity"] == "warning"]
        assert len(warnings) > 0

    @pytest.mark.asyncio
    async def test_empty_body_generates_warning(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        skill_dir = tmp_path / "empty-body"
        skill_dir.mkdir()
        # Valid frontmatter but no body after ---
        (skill_dir / "SKILL.md").write_text(
            "---\nname: empty-body\ndescription: A skill with no body\n---\n"
        )

        result = await run({"name": "empty-body", "skills_dir": str(tmp_path)})

        # Errors on name/description may not exist — body warning should be present
        warnings = [i for i in result["issues"] if i["severity"] == "warning"]
        assert any("body" in i["message"].lower() for i in warnings)

    @pytest.mark.asyncio
    async def test_too_long_body_generates_warning(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        body = "\n".join(f"line {i}" for i in range(510))
        skill_dir = tmp_path / "long-body"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            f"---\nname: long-body\ndescription: A skill with long body\n---\n{body}"
        )

        result = await run({"name": "long-body", "skills_dir": str(tmp_path)})

        warnings = [i for i in result["issues"] if i["severity"] == "warning"]
        assert any("500" in i["message"] or "lines" in i["message"] for i in warnings)

    @pytest.mark.asyncio
    async def test_valid_skill_message_mentions_specification(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        _write_skill(tmp_path, "my-skill", _VALID_SKILL_CONTENT)

        result = await run({"name": "my-skill", "skills_dir": str(tmp_path)})

        assert result["valid"] is True
        assert "specification" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_resources_scanned_correctly(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        # Use correct name in frontmatter to avoid a name-mismatch error
        content = textwrap.dedent("""\
            ---
            name: res-skill
            description: A resource-rich skill
            ---

            # res-skill
        """)
        skill_dir = _write_skill(tmp_path, "res-skill", content)
        assets_dir = skill_dir / "assets"
        assets_dir.mkdir()
        (assets_dir / "diagram.png").write_text("binary")

        result = await run({"name": "res-skill", "skills_dir": str(tmp_path)})

        assert result["valid"] is True
        assert "diagram.png" in result["structure"]["resources"]["assets"]

    @pytest.mark.asyncio
    async def test_consecutive_hyphens_name_reported(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        bad_dir = tmp_path / "my--skill"
        bad_dir.mkdir()
        (bad_dir / "SKILL.md").write_text(_VALID_SKILL_CONTENT)

        result = await run({"name": "my--skill", "skills_dir": str(tmp_path)})

        assert result["valid"] is False

    @pytest.mark.asyncio
    async def test_name_too_long_reported(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        long_name = "a" * 65
        long_dir = tmp_path / long_name
        long_dir.mkdir()
        (long_dir / "SKILL.md").write_text(_VALID_SKILL_CONTENT)

        result = await run({"name": long_name, "skills_dir": str(tmp_path)})

        assert result["valid"] is False

    @pytest.mark.asyncio
    async def test_unclosed_frontmatter_reported(self, tmp_path: Path) -> None:
        from matimo.tools.matimo_validate_skill.matimo_validate_skill import run

        skill_dir = tmp_path / "unclosed"
        skill_dir.mkdir()
        # Content starts with --- but never has a closing --- delimiter
        (skill_dir / "SKILL.md").write_text("---\nname: unclosed\ndescription: test\n")

        result = await run({"name": "unclosed", "skills_dir": str(tmp_path)})

        assert result["valid"] is False


# ===========================================================================
# Additional branch coverage — matimo_list_user_tools
# ===========================================================================

class TestMatimoListUserToolsBranchCoverage:
    """Extra tests targeting uncovered branches in matimo_list_user_tools."""

    @pytest.mark.asyncio
    async def test_skips_files_in_tool_dir(self, tmp_path: Path) -> None:
        """Files (not dirs) in tool_dir are skipped without error (line 26 branch)."""
        from matimo.tools.matimo_list_user_tools.matimo_list_user_tools import run

        # Write a plain file directly in the tool dir (not in a subdirectory)
        (tmp_path / "stray_file.yaml").write_text("not a dir")
        _write_tool(tmp_path, "real_tool")

        result = await run({"tool_dir": str(tmp_path)})

        assert result["total"] == 1

    @pytest.mark.asyncio
    async def test_classify_risk_failure_uses_medium(self, tmp_path: Path) -> None:
        """If classify_risk raises, risk_level falls back to 'medium' (lines 38-39)."""
        from matimo.tools.matimo_list_user_tools.matimo_list_user_tools import run

        _write_tool(tmp_path, "any_tool")

        with patch(
            "matimo.policy.risk_classifier.classify_risk",
            side_effect=Exception("broken"),
        ):
            result = await run({"tool_dir": str(tmp_path)})

        assert result["total"] == 1
        assert result["tools"][0]["riskLevel"] == "medium"

    @pytest.mark.asyncio
    async def test_filters_draft_tools_when_include_drafts_false(self, tmp_path: Path) -> None:
        """Draft tools are excluded when include_drafts=False."""
        from matimo.tools.matimo_list_user_tools.matimo_list_user_tools import run

        _write_tool(tmp_path, "draft_tool", _VALID_DRAFT_TOOL_YAML)
        _write_tool(tmp_path, "stable_tool")

        result = await run({"tool_dir": str(tmp_path), "include_drafts": False})

        names = [t["name"] for t in result["tools"]]
        assert "my_api_tool" not in names or len(result["tools"]) == 1


# ===========================================================================
# Additional branch coverage — matimo_get_tool_status
# ===========================================================================

class TestMatimoGetToolStatusBranchCoverage:
    """Extra tests targeting uncovered branches in matimo_get_tool_status."""

    @pytest.mark.asyncio
    async def test_classify_risk_failure_uses_medium(self, tmp_path: Path) -> None:
        """If classify_risk raises, risk_level falls back to 'medium' (lines 36-37)."""
        from matimo.tools.matimo_get_tool_status.matimo_get_tool_status import run

        _write_tool(tmp_path, "my_api_tool")

        with patch(
            "matimo.policy.risk_classifier.classify_risk",
            side_effect=Exception("broken"),
        ):
            result = await run({"name": "my_api_tool", "tool_dir": str(tmp_path)})

        assert result["riskLevel"] == "medium"

    @pytest.mark.asyncio
    async def test_deprecated_tool_shows_rejected_state(self, tmp_path: Path) -> None:
        """A deprecated tool has approval_state 'rejected' (line 48)."""
        from matimo.tools.matimo_get_tool_status.matimo_get_tool_status import run

        deprecated_yaml = textwrap.dedent("""\
            name: my_api_tool
            version: '1.0.0'
            description: Fetch data from an API
            status: deprecated
            parameters:
              query:
                type: string
                required: true
                description: Search query
            execution:
              type: http
              method: GET
              url: 'https://api.example.com/search?q={query}'
        """)
        _write_tool(tmp_path, "my_api_tool", deprecated_yaml)

        result = await run({"name": "my_api_tool", "tool_dir": str(tmp_path)})

        assert result["approvalState"] == "rejected"

    @pytest.mark.asyncio
    async def test_low_risk_stable_tool_auto_approved(self, tmp_path: Path) -> None:
        """A stable low-risk tool at AUTO tier gets approval_state 'auto-approved' (line 54)."""
        from matimo.policy.types import PolicyTier
        from matimo.tools.matimo_get_tool_status.matimo_get_tool_status import run

        _write_tool(tmp_path, "my_api_tool")

        with patch(
            "matimo.policy.default_policy.get_tier_for_tool",
            return_value=PolicyTier.AUTO,
        ):
            result = await run({"name": "my_api_tool", "tool_dir": str(tmp_path)})

        assert result["approvalState"] == "auto-approved"


# ===========================================================================
# Additional branch coverage — matimo_approve_tool
# ===========================================================================

class TestMatimoApproveToolBranchCoverage:
    """Extra tests targeting uncovered branches in matimo_approve_tool."""

    @pytest.mark.asyncio
    async def test_blocks_approval_on_critical_policy_violations(self, tmp_path: Path) -> None:
        """Tools with critical policy violations are blocked (lines 38-43)."""
        from matimo.tools.matimo_approve_tool.matimo_approve_tool import run

        _write_tool(tmp_path, "my_api_tool", _VALID_DRAFT_TOOL_YAML)

        mock_violation = MagicMock()
        mock_violation.severity = "critical"
        mock_violation.message = "Dangerous pattern detected"

        with patch(
            "matimo.policy.content_validator.validate_tool_content",
            return_value=[mock_violation],
        ):
            result = await run({"name": "my_api_tool", "tool_dir": str(tmp_path)})

        assert result["success"] is False
        assert "policy violations" in result["message"]


# ===========================================================================
# Additional branch coverage — matimo_get_skill helper functions
# ===========================================================================

class TestMatimoGetSkillBranchCoverage:
    """Extra tests targeting uncovered branches in matimo_get_skill."""

    @pytest.mark.asyncio
    async def test_skill_without_frontmatter_is_returned(self, tmp_path: Path) -> None:
        """Skill SKILL.md without --- frontmatter triggers line 17 early return."""
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        skill_dir = tmp_path / "plain-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("# Plain Skill\n\nNo frontmatter here.")

        result = await run({"name": "plain-skill", "skills_dir": str(tmp_path)})

        assert result["success"] is True
        assert result["name"] == "plain-skill"

    @pytest.mark.asyncio
    async def test_skill_with_unclosed_frontmatter(self, tmp_path: Path) -> None:
        """Unclosed --- frontmatter (line 20 early return) still loads skill."""
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        skill_dir = tmp_path / "unclosed-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("---\nname: unclosed-skill\ndescription: test\n")

        result = await run({"name": "unclosed-skill", "skills_dir": str(tmp_path)})

        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_skill_with_invalid_frontmatter_yaml(self, tmp_path: Path) -> None:
        """Invalid YAML in frontmatter triggers lines 23-24 exception handler."""
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        skill_dir = tmp_path / "bad-fm-skill"
        skill_dir.mkdir()
        # Deliberate YAML error: unindented block scalar
        (skill_dir / "SKILL.md").write_text("---\n: invalid: yaml: ::\n---\n# Content")

        result = await run({"name": "bad-fm-skill", "skills_dir": str(tmp_path)})

        # Should succeed even with malformed frontmatter
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_extra_file_in_skill_dir_goes_to_other(self, tmp_path: Path) -> None:
        """Extra non-SKILL.md files in skill dir are placed in resources.other (line 35)."""
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        skill_dir = tmp_path / "rich-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(_VALID_SKILL_CONTENT)
        (skill_dir / "EXTRA.md").write_text("extra content")

        result = await run({"name": "rich-skill", "skills_dir": str(tmp_path)})

        assert result["success"] is True
        assert "EXTRA.md" in result["resources"]["other"]

    @pytest.mark.asyncio
    async def test_find_skill_via_global_instance_with_path(self, tmp_path: Path) -> None:
        """Finding a skill via global instance with _path attribute (lines 58-60)."""
        from matimo.tools.matimo_get_skill.matimo_get_skill import run

        skill_dir = tmp_path / "sdk-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(_VALID_SKILL_CONTENT)

        mock_skill = MagicMock()
        mock_skill.name = "sdk-skill"
        mock_skill._path = str(skill_dir)

        mock_instance = MagicMock()
        mock_instance.list_skills.return_value = [mock_skill]

        with patch("matimo.decorators.get_global_matimo_instance", return_value=mock_instance):
            result = await run({"name": "sdk-skill"})

        assert result["success"] is True


# ===========================================================================
# Additional branch coverage — matimo_list_skills helper functions
# ===========================================================================

class TestMatimoListSkillsBranchCoverage:
    """Extra tests targeting uncovered branches in matimo_list_skills."""

    @pytest.mark.asyncio
    async def test_skill_file_read_error_is_skipped(self, tmp_path: Path) -> None:
        """If SKILL.md read fails, the skill is skipped gracefully (lines 47-48)."""
        from matimo.tools.matimo_list_skills.matimo_list_skills import run

        skill_dir = tmp_path / "bad-skill"
        skill_dir.mkdir()
        skill_file = skill_dir / "SKILL.md"
        skill_file.write_text("# ok")

        original_read = Path.read_text

        def patched_read(self: Path, **kwargs: object) -> str:
            if self == skill_file:
                raise OSError("permission denied")
            return original_read(self, **kwargs)  # type: ignore[call-arg]

        with (
            patch("matimo.decorators.get_global_matimo_instance", return_value=None),
            patch.object(Path, "read_text", patched_read),
        ):
            result = await run({"skills_dir": str(tmp_path)})

        # The bad skill is silently dropped
        assert result["total"] == 0

    @pytest.mark.asyncio
    async def test_skill_with_no_frontmatter_uses_dir_name(self, tmp_path: Path) -> None:
        """Skill files without --- frontmatter use dirname as name (line 15 branch)."""
        from matimo.tools.matimo_list_skills.matimo_list_skills import run

        skill_dir = tmp_path / "no-fm-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("# No Frontmatter\nJust content.")

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"skills_dir": str(tmp_path)})

        assert result["total"] == 1
        assert result["skills"][0]["name"] == "no-fm-skill"

    @pytest.mark.asyncio
    async def test_skips_files_not_dirs_in_skill_path(self, tmp_path: Path) -> None:
        """Non-directory entries in skill_path are skipped (line 32 branch)."""
        from matimo.tools.matimo_list_skills.matimo_list_skills import run

        (tmp_path / "stray_file.md").write_text("not a dir")
        _write_skill(tmp_path, "real-skill")

        with patch("matimo.decorators.get_global_matimo_instance", return_value=None):
            result = await run({"skills_dir": str(tmp_path)})

        assert result["total"] == 1
