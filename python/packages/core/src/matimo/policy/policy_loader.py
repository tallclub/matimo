"""
Policy loader — parses policy.yaml and returns a DefaultPolicyEngine.
Mirrors: packages/core/src/policy/policy-loader.ts
"""
from __future__ import annotations

import logging
from pathlib import Path

import yaml
from pydantic import ValidationError

from matimo.errors import ErrorCode, MatimoError
from matimo.policy.default_policy import DefaultPolicyEngine
from matimo.policy.types import PolicyConfig, RiskLevel

logger = logging.getLogger("matimo")


def load_policy_from_file(
    file_path: str | Path,
    trusted_paths: list[str] | None = None,
    untrusted_paths: list[str] | None = None,
) -> DefaultPolicyEngine:
    """
    Load a policy.yaml file and return a configured DefaultPolicyEngine.

    Expected YAML keys (all optional — safe defaults if omitted):
      allowedDomains: [...]
      allowedCredentials: [...]
      allowedHttpMethods: [GET, POST]
      allowCommandTools: false
      allowFunctionTools: false
      protectedNamespaces: [matimo_]
      enableHITL: false
      quarantineRiskLevels: [medium]

    Raises:
        MatimoError(FILE_NOT_FOUND) if the file does not exist.
        MatimoError(INVALID_SCHEMA) if the YAML is malformed.
    """
    path = Path(file_path)
    if not path.exists():
        raise MatimoError(
            f"Policy file not found: {path}",
            ErrorCode.FILE_NOT_FOUND,
            {"path": str(path)},
        )

    try:
        raw = path.read_text(encoding="utf-8")
        data = yaml.safe_load(raw) or {}
    except Exception as exc:
        raise MatimoError(
            f"Failed to parse policy file: {path}\n{exc}",
            ErrorCode.INVALID_SCHEMA,
            {"path": str(path)},
            cause=exc,
        ) from exc

    # Normalise camelCase YAML keys → snake_case for Pydantic
    normalised = _normalise_keys(data)

    try:
        config = PolicyConfig.model_validate(normalised)
    except ValidationError as exc:
        raise MatimoError(
            f"Policy config validation failed: {path}\n{exc}",
            ErrorCode.INVALID_SCHEMA,
            {"path": str(path), "issues": exc.errors()},
            cause=exc,
        ) from exc

    logger.info("Loaded policy from %s", path)
    return DefaultPolicyEngine(
        config=config,
        trusted_paths=trusted_paths,
        untrusted_paths=untrusted_paths,
    )


# ---------------------------------------------------------------------------
# Key normalisation helper
# ---------------------------------------------------------------------------

_CAMEL_TO_SNAKE: dict[str, str] = {
    "allowedDomains": "allowed_domains",
    "allowedCredentials": "allowed_credentials",
    "allowedHttpMethods": "allowed_http_methods",
    "allowCommandTools": "allow_command_tools",
    "allowFunctionTools": "allow_function_tools",
    "protectedNamespaces": "protected_namespaces",
    "enableHITL": "enable_hitl",
    "quarantineRiskLevels": "quarantine_risk_levels",
    "approvalTtlSeconds": "approval_ttl_seconds",
}


def _normalise_keys(data: dict) -> dict:
    """Convert camelCase policy.yaml keys to snake_case for Pydantic."""
    result: dict = {}
    for k, v in data.items():
        snake_key = _CAMEL_TO_SNAKE.get(k, k)
        if snake_key == "quarantine_risk_levels" and isinstance(v, list):
            v = [RiskLevel(level) for level in v]
        result[snake_key] = v
    return result
