"""matimo_validate_tool — validate a tool definition YAML string."""
from __future__ import annotations

import logging

import yaml

logger = logging.getLogger("matimo")


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    from matimo.core.models import ToolDefinition
    from matimo.policy.content_validator import validate_tool_content
    from matimo.policy.risk_classifier import classify_risk
    from matimo.policy.types import PolicyConfig, RiskLevel

    yaml_content: str = params.get("yaml_content", "")
    schema_errors = []
    policy_violations = []
    risk_level = "low"
    tool_def = None

    try:
        parsed = yaml.safe_load(yaml_content)
    except yaml.YAMLError as exc:
        return {
            "valid": False,
            "schemaErrors": [{"field": "root", "message": f"YAML parse error: {exc}"}],
            "policyViolations": [],
            "riskLevel": "low",
        }

    if not parsed or not isinstance(parsed, dict):
        return {
            "valid": False,
            "schemaErrors": [{"field": "root", "message": "YAML must parse to an object"}],
            "policyViolations": [],
            "riskLevel": "low",
        }

    # Check the tool as matimo_create_tool will write it: creation forces these
    # fields, so the rules about them must not fail a definition that omits them.
    declared_requires_approval = parsed.get("requires_approval") is True
    parsed = {**parsed, "requires_approval": True, "status": "draft"}

    try:
        tool_def = ToolDefinition.model_validate(parsed)
    except Exception as exc:
        # Extract per-field errors from Pydantic ValidationError when available
        try:
            import pydantic

            if isinstance(exc, pydantic.ValidationError):
                for e in exc.errors():
                    field = ".".join(str(p) for p in e["loc"]) if e["loc"] else "root"
                    schema_errors.append({"field": field, "message": e["msg"]})
            else:
                schema_errors.append({"field": "root", "message": str(exc)})
        except ImportError:
            schema_errors.append({"field": "root", "message": str(exc)})

    refused = False
    if tool_def is not None:
        violations = validate_tool_content(tool_def, PolicyConfig())
        # Like matimo_create_tool, only critical and high violations refuse the tool.
        refused = any(v.severity in (RiskLevel.CRITICAL, RiskLevel.HIGH) for v in violations)
        policy_violations = [
            {"rule": v.rule, "severity": v.severity, "message": v.message}
            for v in violations
        ]
        try:
            # The risk of the definition as written, before the forced
            # requires_approval raises it.
            risk_level = classify_risk(
                tool_def.model_copy(update={"requires_approval": declared_requires_approval})
            )
        except Exception:
            risk_level = "medium"

    return {
        "valid": tool_def is not None and len(schema_errors) == 0 and not refused,
        "schemaErrors": schema_errors,
        "policyViolations": policy_violations,
        "riskLevel": risk_level,
    }
