"""
Matimo meta-package: Re-exports matimo-core and matimo-cli public API.

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

# Extend __path__ so this package merges with matimo-core's files in
# site-packages. This allows `from matimo.instance import Matimo` to resolve
# even when this meta-package's directory doesn't contain instance.py.
__path__ = pkgutil.extend_path(__path__, __name__)

__version__ = "0.1.1"

# ---------------------------------------------------------------------------
# matimo-core re-exports
# ---------------------------------------------------------------------------

# Approval
from matimo.approval.handler import (
    ApprovalCallback,
    ApprovalHandler,
    ApprovalRequest,
    get_global_approval_handler,
    set_global_approval_handler,
)

# Auth
from matimo.auth.injection import extract_parameter_placeholders, inject_auth_parameters
from matimo.auth.oauth2_config import (
    AuthorizationOptions,
    OAuth2Config,
    OAuth2Token,
    TokenResponse,
)
from matimo.auth.oauth2_handler import OAuth2Handler
from matimo.auth.oauth2_provider_loader import OAuth2ProviderLoader

# Core loading + registry
from matimo.core.loader import ToolLoader

# Core models
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

# Skills
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

# Decorators
from matimo.decorators import (
    get_global_matimo_instance,
    set_global_matimo_instance,
    tool,
)

# Encodings
from matimo.encodings.parameter_encoding import apply_parameter_encodings

# Errors
from matimo.errors import (
    ErrorCode,
    MatimoError,
    create_execution_error,
    create_validation_error,
    from_http_error,
)

# Executors
from matimo.executors.command_executor import CommandExecutor
from matimo.executors.function_executor import FunctionExecutor
from matimo.executors.http_executor import HttpExecutor

# Integrations
from matimo.integrations.crewai import convert_tools_to_crewai
from matimo.integrations.langchain import (
    build_relevant_skill_prompt,
    convert_tools_to_langchain,
    get_skills_metadata,
)

# Main entry point + sync API
from matimo.instance import InitOptions, Matimo, ReloadResult, matimo

# Logging
from matimo.logging import (
    MatimoLogger,
    get_global_matimo_logger,
    set_global_matimo_logger,
    setup_logger,
)

# MCP
from matimo.mcp.secrets import (
    AwsSecretsManagerResolver,
    DotenvSecretResolver,
    EnvSecretResolver,
    SecretResolverChain,
    VaultSecretResolver,
    create_resolver_chain,
)
from matimo.mcp.server import MCPServer, MCPServerOptions, create_mcp_server
from matimo.mcp.tool_converter import convert_parameters_to_mcp_schema

# Policy
from matimo.policy.approval_manifest import ApprovalManifest, ApprovalRecord
from matimo.policy.content_validator import ContentViolation, validate_tool_content
from matimo.policy.default_policy import DefaultPolicyEngine, PolicyEngine, get_tier_for_tool
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
from matimo.sync import MatimoSync

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
]

