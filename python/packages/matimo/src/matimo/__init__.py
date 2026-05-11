"""
Matimo meta-package: Re-exports matimo-core public API.

Install with: pip install matimo

This meta-package declares dependencies on matimo-core and matimo-cli,
providing a single installation point that gives you the complete Matimo SDK.

Write tools once in YAML, use them everywhere via TypeScript SDK, Python SDK,
CLI, or MCP.

Usage:
    from matimo import Matimo
    matimo = await Matimo.init('./tools')
    result = await matimo.execute('my_tool', {'param': 'value'})
"""
from __future__ import annotations

import pkgutil

# Extend __path__ so this package namespace merges with matimo-core's files
# in site-packages. This allows `from matimo.instance import Matimo` to resolve
# even when this meta-package's directory doesn't contain instance.py.
# Must happen before any matimo.* sub-imports below.
__path__ = pkgutil.extend_path(__path__, __name__)  # type: ignore[assignment]

__version__ = "0.1.1"

# ---------------------------------------------------------------------------
# matimo-core re-exports
# All imports below are E402-suppressed because they must follow the
# pkgutil.extend_path() call above which extends __path__ at module level.
# ---------------------------------------------------------------------------

# Approval
from matimo.approval.handler import (  # noqa: E402
    ApprovalCallback,
    ApprovalHandler,
    ApprovalRequest,
    get_global_approval_handler,
    set_global_approval_handler,
)

# Auth
from matimo.auth.injection import extract_parameter_placeholders, inject_auth_parameters  # noqa: E402
from matimo.auth.oauth2_config import (  # noqa: E402
    AuthorizationOptions,
    OAuth2Config,
    OAuth2Token,
    TokenResponse,
)
from matimo.auth.oauth2_handler import OAuth2Handler  # noqa: E402
from matimo.auth.oauth2_provider_loader import OAuth2ProviderLoader  # noqa: E402

# Core loading + registry
from matimo.core.loader import ToolLoader  # noqa: E402

# Core models
from matimo.core.models import (  # noqa: E402
    AuthConfig,
    AuthType,
    BundledResources,
    CommandExecution,
    ExecuteOptions,
    ExecutionResult,
    FunctionExecution,
    HttpExecution,
    OutputSchema,
    Parameter,
    ParameterEncoding,
    ParameterEncodingConfig,
    ParameterEncodingType,
    ParameterType,
    ParsedSkill,
    PolicyContext,
    ProviderDefinition,
    RateLimitConfig,
    SearchSkillsOptions,
    SkillContentOptions,
    SkillDefinition,
    SkillFrontmatter,
    SkillSection,
    SkillSummary,
    ToolDefinition,
    ToolExample,
    ToolStatus,
    ValidationError,
    ValidationResult,
)
from matimo.core.registry import ToolRegistry  # noqa: E402

# Skills
from matimo.core.skill_content_parser import (  # noqa: E402
    ParsedSkillContent,
    extract_skill_content,
    list_skill_sections,
    parse_skill_sections,
)
from matimo.core.skill_loader import SkillLoader, extract_skill_metadata, parse_skill_content  # noqa: E402
from matimo.core.skill_registry import SemanticSearchResult, SkillRegistry  # noqa: E402
from matimo.core.tfidf_embedding import (  # noqa: E402
    EmbeddingProvider,
    TfIdfEmbeddingProvider,
    cosine_similarity,
)

# Decorators
from matimo.decorators import (  # noqa: E402
    get_global_matimo_instance,
    set_global_matimo_instance,
    tool,
)

# Encodings
from matimo.encodings.parameter_encoding import apply_parameter_encodings  # noqa: E402

# Errors
from matimo.errors import (  # noqa: E402
    ErrorCode,
    MatimoError,
    create_execution_error,
    create_validation_error,
    from_http_error,
)

# Executors
from matimo.executors.command_executor import CommandExecutor  # noqa: E402
from matimo.executors.function_executor import FunctionExecutor  # noqa: E402
from matimo.executors.http_executor import HttpExecutor  # noqa: E402

# Main entry point + sync API
from matimo.instance import InitOptions, Matimo, ReloadResult, matimo  # noqa: E402

# Logging
from matimo.logging import (  # noqa: E402
    MatimoLogger,
    get_global_matimo_logger,
    set_global_matimo_logger,
    setup_logger,
)

# MCP
from matimo.mcp.secrets import (  # noqa: E402
    AwsSecretsManagerResolver,
    DotenvSecretResolver,
    EnvSecretResolver,
    SecretResolverChain,
    VaultSecretResolver,
    create_resolver_chain,
)
from matimo.mcp.server import MCPServer, MCPServerOptions, create_mcp_server  # noqa: E402
from matimo.mcp.tool_converter import convert_parameters_to_mcp_schema  # noqa: E402

# Policy
from matimo.policy.approval_manifest import ApprovalManifest, ApprovalRecord  # noqa: E402
from matimo.policy.content_validator import ContentViolation, validate_tool_content  # noqa: E402
from matimo.policy.default_policy import DefaultPolicyEngine, PolicyEngine, get_tier_for_tool  # noqa: E402
from matimo.policy.integrity_tracker import IntegrityAction, ToolIntegrityTracker  # noqa: E402
from matimo.policy.policy_loader import load_policy_from_file  # noqa: E402
from matimo.policy.risk_classifier import classify_risk  # noqa: E402
from matimo.policy.types import (  # noqa: E402
    HITLCallback,
    HITLRequest,
    MatimoEvent,
    MatimoEventHandler,
    PolicyAllowed,
    PolicyConfig,
    PolicyDecision,
    PolicyDenied,
    PolicyPendingApproval,
    PolicyTier,
    RiskLevel,
)
from matimo.sync import MatimoSync  # noqa: E402

# ---------------------------------------------------------------------------
# Integrations — lazy wrappers so optional deps (langchain-core, crewai) are
# only imported when the function is actually called, matching matimo-core's
# own behaviour and avoiding ImportError at package import time.
# ---------------------------------------------------------------------------


def convert_tools_to_langchain(*args: object, **kwargs: object) -> object:  # noqa: ANN401
    """Convert Matimo tools to LangChain StructuredTool list. Requires langchain-core."""
    from matimo.integrations.langchain import convert_tools_to_langchain as _inner
    return _inner(*args, **kwargs)


def get_skills_metadata(*args: object, **kwargs: object) -> object:  # noqa: ANN401
    """Return Level-1 metadata (name + description) for all available skills."""
    from matimo.integrations.langchain import get_skills_metadata as _inner
    return _inner(*args, **kwargs)


async def build_relevant_skill_prompt(*args: object, **kwargs: object) -> str:
    """Build a per-request skill context prompt using TF-IDF semantic search."""
    from matimo.integrations.langchain import build_relevant_skill_prompt as _inner
    return await _inner(*args, **kwargs)


def convert_tools_to_crewai(*args: object, **kwargs: object) -> object:  # noqa: ANN401
    """Convert Matimo tools to CrewAI BaseTool list. Requires crewai."""
    from matimo.integrations.crewai import convert_tools_to_crewai as _inner
    return _inner(*args, **kwargs)


def get_core_tools_path() -> str:
    """Return the absolute path to matimo-core's bundled tool definitions.

    Resolves via ``matimo.instance`` (always lives in matimo-core) so the
    path is correct regardless of whether this meta-package is installed
    as an editable package or as a regular wheel.
    """
    from pathlib import Path
    import matimo.instance as _instance_mod
    return str(Path(_instance_mod.__file__).parent / "tools")


__all__ = [
    # Core models
    "ToolDefinition", "Parameter", "ParameterType", "AuthConfig", "AuthType",
    "HttpExecution", "CommandExecution", "FunctionExecution",
    "OutputSchema", "RateLimitConfig", "ToolExample",
    "ParameterEncoding", "ParameterEncodingConfig", "ParameterEncodingType",
    "ToolStatus", "ExecutionResult", "ExecuteOptions", "PolicyContext",
    "ValidationError", "ValidationResult", "ParsedSkill", "SkillFrontmatter",
    "ProviderDefinition", "SkillDefinition", "SkillSummary", "SkillSection",
    "SkillContentOptions", "SearchSkillsOptions", "BundledResources",
    # Core
    "ToolLoader", "ToolRegistry",
    # Skills
    "SkillLoader", "SkillRegistry",
    "parse_skill_content", "extract_skill_metadata",
    "parse_skill_sections", "extract_skill_content", "list_skill_sections",
    "ParsedSkillContent", "SemanticSearchResult",
    "TfIdfEmbeddingProvider", "EmbeddingProvider", "cosine_similarity",
    # Executors
    "HttpExecutor", "CommandExecutor", "FunctionExecutor",
    # Auth
    "inject_auth_parameters", "extract_parameter_placeholders",
    "OAuth2Handler", "OAuth2ProviderLoader",
    "OAuth2Config", "OAuth2Token", "AuthorizationOptions", "TokenResponse",
    # Approval
    "ApprovalHandler", "ApprovalRequest", "ApprovalCallback",
    "get_global_approval_handler", "set_global_approval_handler",
    # Encodings
    "apply_parameter_encodings",
    # Policy
    "PolicyEngine", "DefaultPolicyEngine", "PolicyConfig",
    "PolicyDecision", "PolicyAllowed", "PolicyDenied", "PolicyPendingApproval",
    "RiskLevel", "PolicyTier", "MatimoEvent", "MatimoEventHandler",
    "HITLCallback", "HITLRequest", "ContentViolation", "validate_tool_content",
    "classify_risk", "get_tier_for_tool", "ToolIntegrityTracker", "IntegrityAction",
    "ApprovalManifest", "ApprovalRecord", "load_policy_from_file",
    # MCP
    "MCPServer", "MCPServerOptions", "create_mcp_server",
    "convert_parameters_to_mcp_schema",
    "EnvSecretResolver", "DotenvSecretResolver",
    "VaultSecretResolver", "AwsSecretsManagerResolver",
    "SecretResolverChain", "create_resolver_chain",
    # Integrations
    "convert_tools_to_langchain", "get_skills_metadata",
    "build_relevant_skill_prompt", "convert_tools_to_crewai",
    # Decorators
    "tool", "set_global_matimo_instance", "get_global_matimo_instance",
    # Logging
    "MatimoLogger", "setup_logger",
    "get_global_matimo_logger", "set_global_matimo_logger",
    # Errors
    "MatimoError", "ErrorCode",
    "create_execution_error", "create_validation_error", "from_http_error",
    # Instance
    "Matimo", "MatimoSync", "matimo", "InitOptions", "ReloadResult",
    # Core tools path
    "get_core_tools_path",
]
