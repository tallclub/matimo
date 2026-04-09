"""
Matimo error types.
Mirrors: packages/core/src/errors/matimo-error.ts
"""
from __future__ import annotations

from enum import StrEnum
from typing import Any


class ErrorCode(StrEnum):
    """Structured error codes — mirrors TypeScript ErrorCode enum."""

    INVALID_SCHEMA = "INVALID_SCHEMA"
    EXECUTION_FAILED = "EXECUTION_FAILED"
    AUTH_FAILED = "AUTH_FAILED"
    TOOL_NOT_FOUND = "TOOL_NOT_FOUND"
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    TIMEOUT = "TIMEOUT"
    NETWORK_ERROR = "NETWORK_ERROR"
    INVALID_PARAMETER = "INVALID_PARAMETER"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
    POLICY_DENIED = "POLICY_DENIED"
    POLICY_TIER_BLOCKED = "POLICY_TIER_BLOCKED"


class MatimoError(Exception):
    """
    Structured Matimo error with code and optional details.
    Mirrors: MatimoError class in matimo-error.ts
    """

    def __init__(
        self,
        message: str,
        code: ErrorCode,
        details: dict[str, Any] | None = None,
        cause: Exception | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.details = details or {}
        self.__cause__ = cause

    def to_dict(self) -> dict[str, Any]:
        """Serialise to a plain dict — safe for logging (never contains secrets)."""
        result: dict[str, Any] = {
            "name": "MatimoError",
            "message": str(self),
            "code": self.code.value,
            "details": self.details,
        }
        if self.__cause__ is not None:
            result["cause"] = {
                "message": str(self.__cause__),
                "type": type(self.__cause__).__name__,
            }
        return result

    def __repr__(self) -> str:
        return f"MatimoError(code={self.code.value!r}, message={str(self)!r})"


# ---------------------------------------------------------------------------
# Convenience constructors — mirror TypeScript helpers
# ---------------------------------------------------------------------------


def create_validation_error(
    message: str, details: dict[str, Any] | None = None
) -> MatimoError:
    """Create a VALIDATION_FAILED MatimoError."""
    return MatimoError(message, ErrorCode.VALIDATION_FAILED, details)


def create_execution_error(
    message: str, details: dict[str, Any] | None = None
) -> MatimoError:
    """Create an EXECUTION_FAILED MatimoError."""
    return MatimoError(message, ErrorCode.EXECUTION_FAILED, details)


def from_http_error(error: Exception, message: str = "HTTP request failed") -> MatimoError:
    """Wrap an httpx / requests exception into a structured MatimoError."""
    details: dict[str, Any] = {"original_error": str(error)}
    # httpx exposes .response on HTTPStatusError
    response = getattr(error, "response", None)
    if response is not None:
        details["status_code"] = getattr(response, "status_code", None)
        try:
            details["body"] = response.text[:500]  # truncate — never log full body
        except Exception:  # noqa: BLE001, S110
            pass  # response.text access failed — continue without body
    return MatimoError(message, ErrorCode.EXECUTION_FAILED, details, cause=error)
