"""
Content validator — validates untrusted tool definitions against policy rules.
Mirrors: packages/core/src/policy/content-validator.ts
"""
from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass
from urllib.parse import urlparse

from matimo.core.models import ToolDefinition
from matimo.policy.types import PolicyConfig, RiskLevel

# Internal / metadata service hostnames that SSRF protection blocks
_SSRF_BLOCKED = {
    "localhost",
    "169.254.169.254",  # AWS/GCP metadata
    "metadata.google.internal",
    "100.100.100.200",  # Alibaba Cloud metadata
    "fd00:ec2::254",    # AWS IPv6 metadata
}

_PLACEHOLDER_RE = re.compile(r"\{([^}]+)\}")


@dataclass
class ContentViolation:
    rule: str
    severity: RiskLevel
    message: str


def validate_tool_content(
    tool: ToolDefinition,
    policy: PolicyConfig,
) -> list[ContentViolation]:
    """
    Validate an (untrusted) tool definition against policy rules.
    Returns a list of violations (empty = clean).

    Rules mirror TypeScript content-validator.ts:
      no-function-execution   critical
      no-command-execution    critical
      no-ssrf                 critical
      unauthorized-credential high
      reserved-namespace      critical
      forced-approval         high
      blocked-http-method     high
      blocked-domain          high
      forced-draft-status     medium
    """
    violations: list[ContentViolation] = []
    exec_type = tool.execution.type

    # 1. No function execution
    if exec_type == "function" and not policy.allow_function_tools:
        violations.append(ContentViolation(
            rule="no-function-execution",
            severity=RiskLevel.CRITICAL,
            message="Function execution tools are not permitted for untrusted sources",
        ))

    # 2. No command execution
    if exec_type == "command" and not policy.allow_command_tools:
        violations.append(ContentViolation(
            rule="no-command-execution",
            severity=RiskLevel.CRITICAL,
            message="Command execution tools are not permitted for untrusted sources",
        ))

    # 3. SSRF protection (HTTP tools)
    if exec_type == "http":
        url: str = tool.execution.url  # type: ignore[attr-defined]
        ssrf = _check_ssrf(url)
        if ssrf:
            violations.append(ContentViolation(
                rule="no-ssrf",
                severity=RiskLevel.CRITICAL,
                message=f"URL targets a blocked internal/metadata address: {ssrf}",
            ))

    # 4. Unauthorized credentials
    if policy.allowed_credentials is not None:
        placeholders = _extract_placeholders(tool)
        for ph in placeholders:
            lower = ph.lower()
            is_cred = any(
                kw in lower for kw in ("token", "key", "secret", "password", "auth")
            )
            if is_cred and ph not in policy.allowed_credentials:
                violations.append(ContentViolation(
                    rule="unauthorized-credential",
                    severity=RiskLevel.HIGH,
                    message=f"Tool references credential '{ph}' not in allowed_credentials",
                ))

    # 5. Reserved namespace
    tool_name = tool.name
    for ns in policy.protected_namespaces:
        if tool_name.startswith(ns):
            violations.append(ContentViolation(
                rule="reserved-namespace",
                severity=RiskLevel.CRITICAL,
                message=f"Tool name '{tool_name}' uses reserved namespace '{ns}'",
            ))

    # 6. Forced approval flag — untrusted tools must declare requires_approval
    if not tool.requires_approval:
        violations.append(ContentViolation(
            rule="forced-approval",
            severity=RiskLevel.HIGH,
            message="Untrusted tools must set requires_approval: true",
        ))

    # 7. Blocked HTTP method
    if exec_type == "http":
        method: str = tool.execution.method  # type: ignore[attr-defined]
        if method not in policy.allowed_http_methods:
            violations.append(ContentViolation(
                rule="blocked-http-method",
                severity=RiskLevel.HIGH,
                message=f"HTTP method '{method}' is not in allowed_http_methods: {policy.allowed_http_methods}",
            ))

    # 8. Blocked domain
    if exec_type == "http" and policy.allowed_domains:
        url = tool.execution.url  # type: ignore[attr-defined]
        try:
            parsed = urlparse(url)
            host = parsed.hostname or ""
        except Exception:
            host = ""
        if host and not any(
            host == d or host.endswith(f".{d}") for d in policy.allowed_domains
        ):
            violations.append(ContentViolation(
                rule="blocked-domain",
                severity=RiskLevel.HIGH,
                message=f"Tool targets domain '{host}' which is not in allowed_domains",
            ))

    # 9. Forced draft status
    if tool.status not in ("draft", None):
        violations.append(ContentViolation(
            rule="forced-draft-status",
            severity=RiskLevel.MEDIUM,
            message=f"Untrusted tool has status '{tool.status}'; must be 'draft' or unset",
        ))

    return violations


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _check_ssrf(url: str) -> str | None:
    """
    Return the blocked hostname/IP if the URL targets an internal/metadata
    service, otherwise None.
    """
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
    except Exception:
        return None

    # Strip placeholders before resolving
    host_clean = re.sub(r"\{[^}]+\}", "", host).strip(".")

    if host_clean in _SSRF_BLOCKED:
        return host_clean

    # Block private IP ranges
    try:
        addr = ipaddress.ip_address(host_clean)
        if addr.is_private or addr.is_loopback or addr.is_link_local:
            return host_clean
    except ValueError:
        pass

    return None


def _extract_placeholders(tool: ToolDefinition) -> set[str]:
    """Extract all {placeholder} names from execution config."""
    placeholders: set[str] = set()
    exec_type = tool.execution.type
    if exec_type == "http":
        exec_ = tool.execution
        _scan_obj(exec_.url, placeholders)            # type: ignore[attr-defined]
        _scan_obj(exec_.headers or {}, placeholders)  # type: ignore[attr-defined]
        _scan_obj(exec_.body, placeholders)            # type: ignore[attr-defined]
    elif exec_type == "command":
        _scan_obj(tool.execution.command, placeholders)     # type: ignore[attr-defined]
        for arg in tool.execution.args or []:               # type: ignore[attr-defined]
            _scan_obj(arg, placeholders)
    return placeholders


def _scan_obj(obj: object, out: set[str]) -> None:
    if isinstance(obj, str):
        for m in _PLACEHOLDER_RE.finditer(obj):
            out.add(m.group(1))
    elif isinstance(obj, dict):
        for v in obj.values():
            _scan_obj(v, out)
    elif isinstance(obj, list):
        for item in obj:
            _scan_obj(item, out)
