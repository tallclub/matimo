"""
Approval manifest — HMAC-signed on-disk record of approved tools.
Mirrors: packages/core/src/policy/approval-manifest.ts
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import tempfile
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC
from pathlib import Path

logger = logging.getLogger("matimo")

_MANIFEST_FILENAME = ".matimo-approvals.json"


@dataclass
class ApprovalRecord:
    name: str
    hash: str
    signature: str   # HMAC-SHA256 hex of "{name}:{hash}"
    approved_at: str
    approved_by: str | None = None


class ApprovalManifest:
    """
    Persists HMAC-signed tool approval records to disk.
    Mirrors: ApprovalManifest in approval-manifest.ts

    Uses an ephemeral UUID signing key if MATIMO_APPROVAL_SECRET is not set.
    Ephemeral keys mean approvals do not survive process restarts — which is
    the safe default.

    Security:
    - Only the first 4 chars of the signing key are logged (fingerprint only).
    - Atomic write prevents manifest corruption on crash.
    """

    def __init__(
        self,
        approval_dir: str | None = None,
        approval_secret: str | None = None,
    ) -> None:
        self._dir = Path(
            approval_dir or os.environ.get("MATIMO_APPROVAL_DIR", ".")
        )
        raw_secret = (
            approval_secret
            or os.environ.get("MATIMO_APPROVAL_SECRET")
            or self._generate_ephemeral_secret()
        )
        self._secret = raw_secret.encode("utf-8")
        fingerprint = raw_secret[:4] + "****"
        logger.debug("ApprovalManifest initialised (key fingerprint: %s)", fingerprint)

        self._manifest_path = self._dir / _MANIFEST_FILENAME
        self._records: dict[str, ApprovalRecord] = {}
        self._load()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def is_approved(self, tool_name: str, content_hash: str) -> bool:
        """Return True if tool_name has a valid approval for content_hash."""
        record = self._records.get(tool_name)
        if record is None:
            return False
        if record.hash != content_hash:
            return False
        return self._verify_signature(record)

    def approve(
        self,
        tool_name: str,
        content_hash: str,
        approved_by: str | None = None,
    ) -> ApprovalRecord:
        """Record a new approval for a tool."""
        from datetime import datetime

        signature = self._sign(tool_name, content_hash)
        record = ApprovalRecord(
            name=tool_name,
            hash=content_hash,
            signature=signature,
            approved_at=datetime.now(UTC).isoformat(),
            approved_by=approved_by,
        )
        self._records[tool_name] = record
        self._save()
        logger.info("Tool '%s' approved (hash: %s...)", tool_name, content_hash[:8])
        return record

    def revoke(self, tool_name: str) -> bool:
        """Remove the approval for a tool. Returns True if it existed."""
        if tool_name not in self._records:
            return False
        del self._records[tool_name]
        self._save()
        logger.info("Approval revoked for tool '%s'", tool_name)
        return True

    def get_all(self) -> list[ApprovalRecord]:
        return list(self._records.values())

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _sign(self, tool_name: str, content_hash: str) -> str:
        message = f"{tool_name}:{content_hash}".encode()
        return hmac.new(self._secret, message, hashlib.sha256).hexdigest()

    def _verify_signature(self, record: ApprovalRecord) -> bool:
        expected = self._sign(record.name, record.hash)
        return hmac.compare_digest(expected, record.signature)

    def _load(self) -> None:
        if not self._manifest_path.exists():
            return
        try:
            raw = self._manifest_path.read_text(encoding="utf-8")
            data = json.loads(raw)
            for entry in data.get("approvals", []):
                record = ApprovalRecord(**entry)
                if self._verify_signature(record):
                    self._records[record.name] = record
                else:
                    logger.warning(
                        "Approval record for '%s' has invalid signature — discarding",
                        entry.get("name", "?"),
                    )
        except Exception as exc:
            logger.warning("Failed to load approval manifest: %s", exc)

    def _save(self) -> None:
        """Atomic write to prevent manifest corruption on crash."""
        self._dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": "1",
            "approvals": [asdict(r) for r in self._records.values()],
        }
        tmp_fd, tmp_path = tempfile.mkstemp(
            dir=self._dir, prefix=".matimo-approvals-tmp-"
        )
        try:
            with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
            os.replace(tmp_path, self._manifest_path)
        except Exception as exc:
            # Clean up temp file on failure
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            logger.error("Failed to save approval manifest: %s", exc)

    @staticmethod
    def _generate_ephemeral_secret() -> str:
        """Generate a random ephemeral signing key (not persistent across restarts)."""
        return str(uuid.uuid4())
