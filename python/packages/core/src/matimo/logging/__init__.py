"""
Matimo structured logger.
Mirrors: packages/core/src/logging/logger.ts + winston-logger.ts

Uses stdlib logging — configured once via setup_logger() or MATIMO_LOG_LEVEL env var.
"""
from __future__ import annotations

import logging
import os
import sys
from typing import Any

# ---------------------------------------------------------------------------
# Public log-level type (mirrors TypeScript LogLevel)
# ---------------------------------------------------------------------------

LOG_LEVELS = ("silent", "error", "warn", "info", "debug")
_LEVEL_MAP: dict[str, int] = {
    "silent": logging.CRITICAL + 10,  # effectively off
    "error": logging.ERROR,
    "warn": logging.WARNING,
    "info": logging.INFO,
    "debug": logging.DEBUG,
}

# ---------------------------------------------------------------------------
# MatimoLogger protocol — thin adapter around stdlib Logger
# ---------------------------------------------------------------------------


class MatimoLogger:
    """
    Thin logging adapter that mirrors the TypeScript MatimoLogger interface.
    Delegates to a stdlib logging.Logger internally.
    """

    def __init__(self, logger: logging.Logger) -> None:
        self._logger = logger

    # --- levelled methods ---

    def debug(self, message: str, **meta: object) -> None:
        self._logger.debug(message, extra={"meta": meta} if meta else {})

    def info(self, message: str, **meta: object) -> None:
        self._logger.info(message, extra={"meta": meta} if meta else {})

    def warn(self, message: str, **meta: object) -> None:
        self._logger.warning(message, extra={"meta": meta} if meta else {})

    def error(self, message: str, **meta: object) -> None:
        self._logger.error(message, extra={"meta": meta} if meta else {})

    def is_silent(self) -> bool:
        return self._logger.level >= logging.CRITICAL + 10

    @property
    def level(self) -> int:
        return self._logger.level


# ---------------------------------------------------------------------------
# Global singleton (mirrors getGlobalMatimoLogger / setGlobalMatimoLogger)
# ---------------------------------------------------------------------------

_global_logger: MatimoLogger | None = None


def setup_logger(
    level: str | None = None,
    log_format: str | None = None,
) -> MatimoLogger:
    """
    Configure and return a MatimoLogger.
    Updates handler levels and formatters on every call (not one-shot).

    Args:
        level: One of 'silent' | 'error' | 'warn' | 'info' | 'debug'.
               Falls back to MATIMO_LOG_LEVEL env var, then 'info'.
        log_format: 'json' | 'simple'. Falls back to MATIMO_LOG_FORMAT, then 'simple'.
    """
    resolved_level = (
        level
        or os.environ.get("MATIMO_LOG_LEVEL", "info")
    ).lower()
    resolved_format = (
        log_format
        or os.environ.get("MATIMO_LOG_FORMAT", "simple")
    ).lower()

    numeric_level = _LEVEL_MAP.get(resolved_level, logging.INFO)

    stdlib_logger = logging.getLogger("matimo")
    stdlib_logger.setLevel(numeric_level)

    # Create formatter based on format
    if resolved_format == "json":
        formatter = _JsonFormatter()
    else:
        formatter = logging.Formatter(
            fmt="%(asctime)s [matimo] %(levelname)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )

    # Update or create handlers
    if not stdlib_logger.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setLevel(numeric_level)
        handler.setFormatter(formatter)
        stdlib_logger.addHandler(handler)
    else:
        # Reconfigure existing handlers with new level and formatter
        for handler in stdlib_logger.handlers:
            handler.setLevel(numeric_level)
            handler.setFormatter(formatter)

    stdlib_logger.propagate = False

    return MatimoLogger(stdlib_logger)


def get_global_matimo_logger() -> MatimoLogger:
    """Return the global logger, initialising with defaults if not yet set."""
    global _global_logger
    if _global_logger is None:
        _global_logger = setup_logger()
    return _global_logger


def set_global_matimo_logger(logger: MatimoLogger) -> None:
    """Replace the global logger (useful for testing or custom logging sinks)."""
    global _global_logger
    _global_logger = logger


# ---------------------------------------------------------------------------
# Sensitive key redaction
# ---------------------------------------------------------------------------

_SENSITIVE_KEYS = frozenset((
    "token", "access_token", "refresh_token",
    "secret", "api_key", "apikey", "api_secret",
    "password", "passwd",
    "credential", "credentials",
    "auth", "authorization",
    "bearer", "key",
    "private_key", "privatekey",
    "client_secret",
    "webhook_secret", "signing_secret",
    "session_id", "session_token",
))


def _redact_meta(meta: dict[str, Any]) -> dict[str, Any]:
    """
    Return a copy of meta with sensitive keys redacted to '[REDACTED]'.
    Case-insensitive matching against common secret key names.
    """
    if not meta:
        return {}
    redacted = {}
    for key, value in meta.items():
        if key.lower() in _SENSITIVE_KEYS:
            redacted[key] = "[REDACTED]"
        else:
            redacted[key] = value
    return redacted


# ---------------------------------------------------------------------------
# Minimal JSON formatter for production use
# ---------------------------------------------------------------------------


class _JsonFormatter(logging.Formatter):
    """Single-line JSON log formatter with secret redaction."""

    def format(self, record: logging.LogRecord) -> str:
        import json
        import time

        payload: dict[str, Any] = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
        }
        meta = getattr(record, "meta", None)
        if meta:
            payload["meta"] = _redact_meta(meta)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload)
