"""Unit tests for policy/approval_manifest.py."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from matimo.policy.approval_manifest import ApprovalManifest, ApprovalRecord


class TestApprovalManifestInit:
    def test_init_creates_manifest(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="test-secret")
        assert manifest is not None

    def test_init_uses_env_var_for_dir(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("MATIMO_APPROVAL_DIR", str(tmp_path))
        manifest = ApprovalManifest(approval_secret="test-secret")
        assert manifest._dir == tmp_path

    def test_init_uses_env_var_for_secret(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("MATIMO_APPROVAL_SECRET", "env-secret")
        manifest = ApprovalManifest(approval_dir=str(tmp_path))
        assert manifest._secret == b"env-secret"

    def test_init_generates_ephemeral_secret_when_none_set(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("MATIMO_APPROVAL_SECRET", raising=False)
        manifest = ApprovalManifest(approval_dir=str(tmp_path))
        # Should have some secret even without env var
        assert len(manifest._secret) > 0


class TestApprovalManifestApprove:
    def test_approve_creates_record(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        record = manifest.approve("my_tool", "abc123hash")
        assert record.name == "my_tool"
        assert record.hash == "abc123hash"
        assert record.signature != ""

    def test_approve_with_approver(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        record = manifest.approve("tool_x", "hash_x", approved_by="alice")
        assert record.approved_by == "alice"

    def test_approve_persists_to_file(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        manifest.approve("persist_tool", "hash_persist")
        manifest_file = tmp_path / ".matimo-approvals.json"
        assert manifest_file.exists()

    def test_approve_file_contains_approval(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        manifest.approve("stored_tool", "stored_hash")
        data = json.loads((tmp_path / ".matimo-approvals.json").read_text())
        assert data["version"] == "1"
        names = [a["name"] for a in data["approvals"]]
        assert "stored_tool" in names

    def test_approve_overrides_existing(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        manifest.approve("tool", "hash1")
        manifest.approve("tool", "hash2")
        records = manifest.get_all()
        assert len(records) == 1
        assert records[0].hash == "hash2"


class TestApprovalManifestIsApproved:
    def test_approved_tool_returns_true(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        manifest.approve("approved_tool", "valid_hash")
        assert manifest.is_approved("approved_tool", "valid_hash") is True

    def test_unknown_tool_returns_false(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        assert manifest.is_approved("unknown_tool", "hash") is False

    def test_wrong_hash_returns_false(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        manifest.approve("tool", "correct_hash")
        assert manifest.is_approved("tool", "wrong_hash") is False

    def test_tampered_signature_returns_false(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        manifest.approve("tool_tamper", "hash_tamper")
        # Tamper with the in-memory record signature
        record = manifest._records["tool_tamper"]
        manifest._records["tool_tamper"] = ApprovalRecord(
            name=record.name,
            hash=record.hash,
            signature="tampered_signature_xyz",
            approved_at=record.approved_at,
            approved_by=record.approved_by,
        )
        assert manifest.is_approved("tool_tamper", "hash_tamper") is False


class TestApprovalManifestRevoke:
    def test_revoke_existing_returns_true(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        manifest.approve("revoke_tool", "hash")
        result = manifest.revoke("revoke_tool")
        assert result is True

    def test_revoke_nonexistent_returns_false(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        result = manifest.revoke("ghost_tool")
        assert result is False

    def test_revoke_removes_from_records(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        manifest.approve("to_remove", "hash")
        manifest.revoke("to_remove")
        assert manifest.is_approved("to_remove", "hash") is False

    def test_revoke_updates_file(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        manifest.approve("remove_from_file", "hash")
        manifest.revoke("remove_from_file")
        data = json.loads((tmp_path / ".matimo-approvals.json").read_text())
        names = [a["name"] for a in data["approvals"]]
        assert "remove_from_file" not in names


class TestApprovalManifestLoad:
    def test_loads_existing_manifest_on_init(self, tmp_path: Path) -> None:
        # Create first manifest and approve a tool
        m1 = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        m1.approve("persist_tool", "persisted_hash")
        # Create second manifest reading same dir
        m2 = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        assert m2.is_approved("persist_tool", "persisted_hash") is True

    def test_discards_records_with_invalid_signatures(self, tmp_path: Path) -> None:
        # Write manifest with tampered signature
        payload = {
            "version": "1",
            "approvals": [
                {
                    "name": "bad_tool",
                    "hash": "some_hash",
                    "signature": "invalid_signature",
                    "approved_at": "2024-01-01T00:00:00+00:00",
                    "approved_by": None,
                }
            ],
        }
        (tmp_path / ".matimo-approvals.json").write_text(
            json.dumps(payload), encoding="utf-8"
        )
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        assert manifest.is_approved("bad_tool", "some_hash") is False

    def test_handles_missing_manifest_file(self, tmp_path: Path) -> None:
        # No manifest file exists — should start fresh
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        assert manifest.get_all() == []

    def test_handles_corrupt_json(self, tmp_path: Path) -> None:
        (tmp_path / ".matimo-approvals.json").write_text("not valid json !!!", encoding="utf-8")
        # Should not raise, just start fresh
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        assert manifest.get_all() == []


class TestApprovalManifestGetAll:
    def test_get_all_empty(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        assert manifest.get_all() == []

    def test_get_all_returns_all_records(self, tmp_path: Path) -> None:
        manifest = ApprovalManifest(approval_dir=str(tmp_path), approval_secret="secret")
        manifest.approve("tool_a", "hash_a")
        manifest.approve("tool_b", "hash_b")
        records = manifest.get_all()
        names = {r.name for r in records}
        assert names == {"tool_a", "tool_b"}
