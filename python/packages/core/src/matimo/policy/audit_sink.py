"""
Audit sinks — durable destinations for Matimo's audit events.

``on_event`` hands events to host code; an ``AuditSink`` is the same stream
with a storage contract. ``JsonlFileSink`` appends one hash-chained JSON line
per event, so deleting, reordering or editing any line breaks
``verify_audit_log``.

The line format and hashing rules are shared with the TypeScript SDK
(conformance/audit/hash-chain.json): a log written by either SDK verifies in
the other.

Mirrors: typescript/packages/core/src/policy/audit-sink.ts
"""
from __future__ import annotations

import hashlib
import json
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol, runtime_checkable

AUDIT_GENESIS_HASH = "0" * 64
"""``prevHash`` of the first entry in a log."""

REDACTED = "[REDACTED]"

_SECRET_KEY_PARTS = (
    "password",
    "passwd",
    "secret",
    "token",
    "apikey",
    "api_key",
    "authorization",
    "credential",
    "cookie",
    "private_key",
    "access_key",
)


@runtime_checkable
class AuditSink(Protocol):
    """A destination for audit events. Errors it raises never reach tool execution."""

    def write(self, event: dict[str, Any]) -> None: ...


@dataclass(frozen=True)
class AuditLogVerification:
    valid: bool
    entries: int
    """Entries read before verification stopped."""
    line: int | None = None
    """1-based line number of the first bad entry, when invalid."""
    reason: str | None = None


def is_secret_key(key: str) -> bool:
    """True for keys that name a secret (``apiKey``, ``client_secret``, ``X-Auth-Token``…).

    CamelCase and dashes are normalised to snake_case before matching.
    """
    normalised = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", key).replace("-", "_").lower()
    return any(part in normalised for part in _SECRET_KEY_PARTS)


def redact_secrets(value: Any) -> Any:  # noqa: ANN401
    """Deep copy of ``value`` with every secret-named key's value replaced by ``[REDACTED]``."""
    if isinstance(value, dict):
        return {k: REDACTED if is_secret_key(k) else redact_secrets(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact_secrets(v) for v in value]
    return value


def _normalise_numbers(value: Any) -> Any:  # noqa: ANN401
    # JSON.stringify writes 2.0 as "2"; match it so both SDKs hash the same bytes.
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, dict):
        return {k: _normalise_numbers(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_normalise_numbers(v) for v in value]
    return value


def canonical_json(value: Any) -> str:  # noqa: ANN401
    """JSON with object keys sorted at every level and no whitespace."""
    return json.dumps(
        _normalise_numbers(value),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def hash_audit_entry(seq: int, prev_hash: str, event: Any) -> str:  # noqa: ANN401
    """sha256(prev_hash + canonical_json({"seq": seq, "event": event})), hex."""
    payload = prev_hash + canonical_json({"seq": seq, "event": event})
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class JsonlFileSink:
    """Append-only JSONL sink; each line chains to the previous by hash."""

    def __init__(self, file_path: str | Path) -> None:
        """
        Args:
            file_path: Log file. Created if missing; an existing log is continued
                from its last entry. Raises ValueError if that entry can't be parsed.
        """
        self.file_path = Path(file_path).resolve()
        self._lock = threading.Lock()
        last = _read_last_entry(self.file_path)
        self._seq: int = last["seq"] if last else 0
        self._prev_hash: str = last["hash"] if last else AUDIT_GENESIS_HASH

    def write(self, event: dict[str, Any]) -> None:
        with self._lock:
            seq = self._seq + 1
            redacted = redact_secrets(event)
            entry_hash = hash_audit_entry(seq, self._prev_hash, redacted)
            entry = {"seq": seq, "prevHash": self._prev_hash, "event": redacted, "hash": entry_hash}
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            with self.file_path.open("a", encoding="utf-8") as f:
                f.write(canonical_json(entry) + "\n")
            self._seq = seq
            self._prev_hash = entry_hash


def _read_last_entry(file_path: Path) -> dict[str, Any] | None:
    if not file_path.exists():
        return None
    lines = [ln for ln in file_path.read_text(encoding="utf-8").split("\n") if ln.strip()]
    if not lines:
        return None
    entry = json.loads(lines[-1])
    if (
        not isinstance(entry, dict)
        or not isinstance(entry.get("seq"), int)
        or not isinstance(entry.get("hash"), str)
    ):
        raise ValueError(f"Audit log {file_path} ends with a line that is not an audit entry")
    return entry


def verify_audit_log(file_path: str | Path) -> AuditLogVerification:
    """Check a JSONL audit log: sequence numbers run 1..n, every ``prevHash`` is
    the previous line's ``hash``, and every ``hash`` matches its entry."""
    prev_hash = AUDIT_GENESIS_HASH
    entries = 0
    lines = Path(file_path).read_text(encoding="utf-8").split("\n")
    for index, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            return AuditLogVerification(False, entries, index, "not valid JSON")
        if not isinstance(entry, dict):
            entry = {}
        seq = entry.get("seq")
        if seq != entries + 1:
            return AuditLogVerification(
                False, entries, index, f"expected seq {entries + 1}, got {seq}"
            )
        if entry.get("prevHash") != prev_hash:
            return AuditLogVerification(
                False, entries, index, "prevHash does not match the previous entry"
            )
        if hash_audit_entry(seq, prev_hash, entry.get("event")) != entry.get("hash"):
            return AuditLogVerification(False, entries, index, "hash does not match the entry")
        prev_hash = entry["hash"]
        entries += 1
    return AuditLogVerification(True, entries)
