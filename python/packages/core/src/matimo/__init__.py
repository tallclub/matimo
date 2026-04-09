"""
Matimo Python SDK — Public API
================================

Write tools once in YAML, use them everywhere.

Quick start:
    from matimo import Matimo

    matimo = await Matimo.init('./tools')
    result = await matimo.execute('my_tool', {'param': 'value'})

LangChain integration:
    from matimo import Matimo, convert_tools_to_langchain
    matimo = await Matimo.init('./tools')
    tools = convert_tools_to_langchain(matimo.list_tools(), matimo)

CrewAI integration:
    from matimo import Matimo, convert_tools_to_crewai
    matimo = await Matimo.init('./tools')
    tools = convert_tools_to_crewai(matimo.list_tools(), matimo)
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from matimo.instance import Matimo

__version__ = "0.1.0"

# ---------------------------------------------------------------------------
# Approval
# ---------------------------------------------------------------------------
from matimo.approval.handler import (
    ApprovalCallback,
    ApprovalHandler,
    ApprovalRequest,
    get_global_approval_handler,
    set_global_approval_handler,
)

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
from matimo.auth.injection import extract_parameter_placeholders, inject_auth_parameters
from matimo.auth.oauth2_config import (
    AuthorizationOptions,
    OAuth2Config,
    OAuth2Token,
    TokenResponse,
)
from matimo.auth.oauth2_handler import OAuth2Handler
from matimo.auth.oauth2_provider_loader import OAuth2ProviderLoader

# ---------------------------------------------------------------------------
# Core loading + registry
# ---------------------------------------------------------------------------
from matimo.core.loader import ToolLoader

# ---------------------------------------------------------------------------
# Core models
# ---------------------------------------------------------------------------
from matimo.core.models import (
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
from matimo.core.registry import ToolRegistry

# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------
from matimo.core.skill_content_parser import (
    ParsedSkillContent,
    extract_skill_content,
    list_skill_sections,
    parse_skill_sections,
)
from matimo.core.skill_loader import SkillLoader, extract_skill_metadata, parse_skill_content
from matimo.core.skill_registry import SemanticSearchResult, SkillRegistry
from matimo.core.tfidf_embedding import (
    EmbeddingProvider,
    TfIdfEmbeddingProvider,
    cosine_similarity,
)

# ---------------------------------------------------------------------------
# Encodings
# ---------------------------------------------------------------------------
from matimo.encodings.parameter_encoding import apply_parameter_encodings

# ---------------------------------------------------------------------------
# Executors
# ---------------------------------------------------------------------------
from matimo.executors.command_executor import CommandExecutor
from matimo.executors.function_executor import FunctionExecutor
from matimo.executors.http_executor import HttpExecutor
from matimo.mcp.secrets import (
    AwsSecretsManagerResolver,
    DotenvSecretResolver,
    EnvSecretResolver,
    SecretResolverChain,
    VaultSecretResolver,
    create_resolver_chain,
)

# ---------------------------------------------------------------------------
# MCP
# ---------------------------------------------------------------------------
from matimo.mcp.server import MCPServer, MCPServerOptions, create_mcp_server
from matimo.mcp.tool_converter import convert_parameters_to_mcp_schema

# ---------------------------------------------------------------------------
# Policy
# ---------------------------------------------------------------------------
from matimo.policy.approval_manifest import ApprovalManifest, ApprovalRecord
from matimo.policy.content_validator import ContentViolation, validate_tool_content
from matimo.policy.default_policy import DefaultPolicyEngine, PolicyEngine
from matimo.policy.integrity_tracker import IntegrityAction, ToolIntegrityTracker
from matimo.policy.policy_loader import load_policy_from_file
from matimo.policy.risk_classifier import classify_risk
from matimo.policy.types import (
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

# ---------------------------------------------------------------------------
# Integrations (lazy — raise ImportError with hint on missing optional dep)
# ---------------------------------------------------------------------------


def convert_tools_to_langchain(
    tools: list[Any],
    matimo_instance: Matimo,
    credentials: dict[str, str] | None = None,
) -> list[Any]:
    """Convert Matimo tools to LangChain StructuredTool list. Requires langchain-core."""
    from matimo.integrations.langchain import convert_tools_to_langchain as _inner
    return _inner(tools, matimo_instance, credentials)


def convert_tools_to_crewai(
    tools: list[Any],
    matimo_instance: Matimo,
    credentials: dict[str, str] | None = None,
) -> list[Any]:
    """Convert Matimo tools to CrewAI BaseTool list. Requires crewai."""
    from matimo.integrations.crewai import convert_tools_to_crewai as _inner
    return _inner(tools, matimo_instance, credentials)


# ---------------------------------------------------------------------------
# Decorators
# ---------------------------------------------------------------------------
from matimo.decorators import (  # noqa: E402
    get_global_matimo_instance,
    set_global_matimo_instance,
    tool,
)

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------
from matimo.errors import (  # noqa: E402
    ErrorCode,
    MatimoError,
    create_execution_error,
    create_validation_error,
    from_http_error,
)

# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
from matimo.instance import InitOptions, Matimo, ReloadResult, matimo  # noqa: E402

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
from matimo.logging import (  # noqa: E402
    MatimoLogger,
    get_global_matimo_logger,
    set_global_matimo_logger,
    setup_logger,
)

# ---------------------------------------------------------------------------
# Synchronous API
# ---------------------------------------------------------------------------
from matimo.sync import MatimoSync  # noqa: E402

__all__ = [
    # Core models
    "ToolDefinition", "Parameter", "ParameterType", "AuthConfig", "AuthType",
    "HttpExecution", "CommandExecution", "FunctionExecution",
    "OutputSchema", "RateLimitConfig", "ToolExample",
    "ParameterEncoding", "ParameterEncodingConfig", "ParameterEncodingType",
    "ToolStatus",
    "ExecutionResult", "ExecuteOptions", "PolicyContext",
    "ValidationError", "ValidationResult",
    "ParsedSkill", "SkillFrontmatter", "ProviderDefinition",
    "SkillDefinition", "SkillSummary", "SkillSection", "SkillContentOptions",
    "SearchSkillsOptions", "BundledResources",
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
    "RiskLevel", "PolicyTier",
    "MatimoEvent", "MatimoEventHandler", "HITLCallback", "HITLRequest",
    "ContentViolation", "validate_tool_content",
    "classify_risk",
    "ToolIntegrityTracker", "IntegrityAction",
    "ApprovalManifest", "ApprovalRecord",
    "load_policy_from_file",
    # MCP
    "MCPServer", "MCPServerOptions", "create_mcp_server",
    "convert_parameters_to_mcp_schema",
    "EnvSecretResolver", "DotenvSecretResolver",
    "VaultSecretResolver", "AwsSecretsManagerResolver",
    "SecretResolverChain", "create_resolver_chain",
    # Integrations
    "convert_tools_to_langchain",
    "convert_tools_to_crewai",
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
]
