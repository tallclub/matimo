"""
Integrity tracker — SHA-256 fingerprinting for tool hot-reload.
Mirrors: packages/core/src/policy/integrity-tracker.ts
"""
from __future__ import annotations

import hashlib
import logging
from enum import Enum
from pathlib import Path

logger = logging.getLogger("matimo")


class IntegrityAction(str, Enum):
    KEEP = "keep"           # content unchanged — skip re-validation
    REVALIDATE = "revalidate"  # content or source changed — re-validate
    VALIDATE = "validate"   # new tool — run full validation


class ToolIntegrityTracker:
    """
    Tracks SHA-256 hashes of loaded tool YAML files to determine whether
    re-validation is needed on hot-reload.
    Mirrors: ToolIntegrityTracker in integrity-tracker.ts
    """

    def __init__(self) -> None:
        # tool_name → (hash, source_path)
        self._hashes: dict[str, tuple[str, str]] = {}

    def get_action(self, tool_name: str, file_path: str) -> IntegrityAction:
        """
        Determine the action for a tool during reload.

        Returns:
            KEEP       — file unchanged since last load
            REVALIDATE — file content or path changed
            VALIDATE   — tool not previously seen
        """
        current_hash = self._hash_file(file_path)
        if current_hash is None:
            return IntegrityAction.VALIDATE

        if tool_name not in self._hashes:
            return IntegrityAction.VALIDATE

        stored_hash, stored_path = self._hashes[tool_name]

        if stored_path != file_path:
            logger.debug(
                "Tool '%s' source path changed: %s → %s", tool_name, stored_path, file_path
            )
            return IntegrityAction.REVALIDATE

        if stored_hash != current_hash:
            logger.debug("Tool '%s' content changed (hash mismatch)", tool_name)
            return IntegrityAction.REVALIDATE

        return IntegrityAction.KEEP

    def record(self, tool_name: str, file_path: str) -> str | None:
        """
        Record the current hash for a tool definition file.
        Returns the hash string, or None if the file cannot be read.
        """
        h = self._hash_file(file_path)
        if h is not None:
            self._hashes[tool_name] = (h, file_path)
        return h

    def remove(self, tool_name: str) -> None:
        self._hashes.pop(tool_name, None)

    def hash_for(self, tool_name: str) -> str | None:
        entry = self._hashes.get(tool_name)
        return entry[0] if entry else None

    def clear(self) -> None:
        self._hashes.clear()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @staticmethod
    def _hash_file(file_path: str) -> str | None:
        try:
            content = Path(file_path).read_bytes()
            return hashlib.sha256(content).hexdigest()
        except OSError:
            return None
