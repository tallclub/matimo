"""
Pydantic v2 models for Matimo tool definitions.
Mirrors: packages/core/src/core/types.ts
         packages/core/src/core/schema.ts (Zod schemas)

All field names use snake_case matching the YAML keys.
"""
from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# ---------------------------------------------------------------------------
# Parameter
# ---------------------------------------------------------------------------


class ParameterType(StrEnum):
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    ARRAY = "array"
    OBJECT = "object"


class Parameter(BaseModel):
    """Tool parameter definition. Mirrors TS Parameter interface."""

    model_config = ConfigDict(extra="allow")

    type: ParameterType
    description: str = ""
    required: bool | None = None
    enum: list[str | int | bool] | None = None
    default: Any = None
    examples: list[Any] | None = None
    # Nested types
    items: Parameter | None = None          # for type=array
    properties: dict[str, Parameter] | None = None  # for type=object


# ---------------------------------------------------------------------------
# Auth config
# ---------------------------------------------------------------------------


class AuthType(StrEnum):
    NONE = "none"
    API_KEY = "api_key"
    BEARER = "bearer"
    BASIC = "basic"
    OAUTH2 = "oauth2"
    CUSTOM = "custom"


class AuthLocation(StrEnum):
    HEADER = "header"
    QUERY = "query"
    BODY = "body"


class AuthConfig(BaseModel):
    """Authentication configuration. Mirrors TS AuthConfig."""

    model_config = ConfigDict(extra="allow")

    type: AuthType | None = None
    location: AuthLocation | None = None
    name: str | None = None
    provider: str | None = None
    required: bool | None = None
    scheme: str | None = None
    username_env: str | None = None  # for type=basic
    password_env: str | None = None  # for type=basic


# ---------------------------------------------------------------------------
# Tool status
# ---------------------------------------------------------------------------


class ToolStatus(StrEnum):
    """Tool lifecycle status. Mirrors TS tool status literals."""

    STABLE = "stable"
    DRAFT = "draft"
    APPROVED = "approved"
    DEPRECATED = "deprecated"


# ---------------------------------------------------------------------------
# Parameter encoding
# ---------------------------------------------------------------------------


class ParameterEncodingType(StrEnum):
    """Supported encoding types for parameter_encoding configs."""

    MIME_RFC2822_BASE64URL = "mime_rfc2822_base64url"
    JSON = "json_compact"
    URL_ENCODED = "url_encoded"


class ParameterEncoding(BaseModel):
    """
    Simple per-parameter encoding shorthand.
    Maps a single parameter name to an encoding type.
    Convenience alias: use this when a tool encodes one param at a time.
    """

    param: str
    encoding: ParameterEncodingType


class ParameterEncodingConfig(BaseModel):
    """Full parameter encoding configuration. Mirrors TS ParameterEncodingConfig."""

    source: list[str]
    target: str
    encoding: str
    options: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Execution configs (discriminated union on 'type')
# ---------------------------------------------------------------------------


class HttpExecution(BaseModel):
    """HTTP execution config. Mirrors TS HttpExecution."""

    model_config = ConfigDict(extra="allow")

    type: Literal["http"]
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"]
    url: str
    headers: dict[str, str] = Field(default_factory=dict)
    body: Any = None
    params: dict[str, str] = Field(default_factory=dict)
    query_params: dict[str, str] = Field(default_factory=dict)
    parameter_encodings: list[ParameterEncoding] = Field(default_factory=list)
    parameter_encoding: list[ParameterEncodingConfig] = Field(default_factory=list)
    timeout: int | None = None  # milliseconds

    @model_validator(mode="before")
    @classmethod
    def _normalise_method(cls, data: Any) -> Any:  # noqa: ANN401
        # Pydantic passes raw (pre-validation) input here; Any is the correct type per pydantic docs.
        if isinstance(data, dict) and "method" in data:
            data["method"] = str(data["method"]).upper()
        return data


class CommandExecution(BaseModel):
    """Command execution config. Mirrors TS CommandExecution."""

    model_config = ConfigDict(extra="allow")

    type: Literal["command"]
    command: str
    args: list[str] = Field(default_factory=list)
    cwd: str | None = None
    shell: bool | None = None
    timeout: int = 30_000  # milliseconds
    env: dict[str, str] | None = None


class FunctionExecution(BaseModel):
    """
    Function execution config. Mirrors TS FunctionExecution.

    In Python, 'code' points to a .py file path (relative to definition.yaml).
    The Python SDK will resolve .ts → .py transparently (dual-file convention).
    """

    model_config = ConfigDict(extra="allow")

    type: Literal["function"]
    code: str   # path to .py (or .ts — auto-resolved to .py sibling)
    timeout: int | None = None  # milliseconds


# Discriminated union: Pydantic picks the right model based on 'type'
ExecutionConfig = Annotated[
    HttpExecution | CommandExecution | FunctionExecution,
    Field(discriminator="type"),
]


# ---------------------------------------------------------------------------
# Output schema / error handling / rate limiting
# ---------------------------------------------------------------------------


class OutputSchema(BaseModel):
    """Output schema for response validation."""

    model_config = ConfigDict(extra="allow")

    type: str | None = None
    properties: dict[str, OutputSchema] | None = None
    items: OutputSchema | None = None
    required: list[str] | None = None
    description: str | None = None
    enum: list[Any] | None = None


class ErrorHandlingConfig(BaseModel):
    """Error handling / retry configuration."""

    retry: int | None = None
    backoff_type: Literal["linear", "exponential", "fixed"] | None = None
    initial_delay_ms: int | None = None
    max_delay_ms: int | None = None


class RateLimitConfig(BaseModel):
    """Rate limiting configuration."""

    enabled: bool | None = None
    requests_per_minute: int | None = None
    burst_size: int | None = None
    quota_per_hour: int | None = None


class ToolExample(BaseModel):
    """Example invocation for a tool."""

    name: str
    params: dict[str, Any]
    description: str | None = None


# ---------------------------------------------------------------------------
# ToolDefinition — the central model
# ---------------------------------------------------------------------------


class ToolDefinition(BaseModel):
    """
    Complete tool definition. Mirrors TS ToolDefinition interface + Zod schema.

    extra="allow" because real YAML files may contain fields like 'notes:' that
    are not in the core schema (forward-compatibility).
    """

    model_config = ConfigDict(extra="allow")

    name: str
    version: str = "1.0.0"
    description: str = ""
    parameters: dict[str, Parameter] = Field(default_factory=dict)
    execution: ExecutionConfig
    authentication: AuthConfig | None = None
    output_schema: OutputSchema | None = None
    error_handling: ErrorHandlingConfig | None = None
    rate_limiting: RateLimitConfig | None = None
    requires_approval: bool = False
    risk: str | None = None  # optional explicit override: 'low' | 'medium' | 'high' | 'critical'
    examples: list[ToolExample] = Field(default_factory=list)
    deprecated: bool = False
    deprecation_message: str | None = None
    tags: list[str] = Field(default_factory=list)
    status: ToolStatus = ToolStatus.STABLE

    # Injected programmatically after loading — not from YAML
    _definition_path: str | None = None

    @model_validator(mode="after")
    def _set_definition_path(self) -> ToolDefinition:
        # Ensure _definition_path is always initialised
        if not hasattr(self, "_definition_path"):
            object.__setattr__(self, "_definition_path", None)
        return self

    def set_definition_path(self, path: str) -> None:
        """Set the filesystem path this definition was loaded from."""
        object.__setattr__(self, "_definition_path", path)

    @property
    def definition_path(self) -> str | None:
        return getattr(self, "_definition_path", None)


# ---------------------------------------------------------------------------
# ExecutionResult / ExecutionContext — runtime types
# ---------------------------------------------------------------------------


class ExecutionResult(BaseModel):
    """Result of a tool execution. Mirrors TS ExecutionResult."""

    success: bool
    data: Any = None
    error: str | None = None
    status_code: int | None = None
    duration: float       # seconds
    trace_id: str


class ValidationError(BaseModel):
    """Single parameter validation error."""

    field: str
    message: str
    expected_type: str | None = None
    received_value: Any = None


class ValidationResult(BaseModel):
    """Aggregate validation result for a set of parameters."""

    valid: bool
    errors: list[ValidationError] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Provider definition (for OAuth2 providers like Slack, GitHub, etc.)
# ---------------------------------------------------------------------------


class OAuth2Endpoints(BaseModel):
    """OAuth2 endpoint URLs for a provider."""

    authorization_url: str = Field(alias="authorizationUrl")
    token_url: str = Field(alias="tokenUrl")
    revoke_url: str | None = Field(default=None, alias="revokeUrl")

    model_config = ConfigDict(populate_by_name=True)


class ProviderInfo(BaseModel):
    """Provider metadata block inside a provider definition."""

    model_config = ConfigDict(extra="allow")

    name: str
    display_name: str | None = Field(default=None, alias="displayName")
    endpoints: OAuth2Endpoints
    default_scopes: list[str] | None = Field(default=None, alias="defaultScopes")
    documentation: str | None = None
    learn_more: str | None = Field(default=None, alias="learnMore")


class ProviderDefinition(BaseModel):
    """Top-level provider definition (e.g. packages/slack/definition.yaml)."""

    model_config = ConfigDict(extra="allow")

    name: str
    type: Literal["provider"]
    version: str
    description: str | None = None
    provider: ProviderInfo


# ---------------------------------------------------------------------------
# Skill types (mirrors TS skill types in types.ts)
# ---------------------------------------------------------------------------


class SkillFrontmatter(BaseModel):
    """YAML frontmatter of a .md skill file."""

    model_config = ConfigDict(extra="allow")

    name: str
    description: str
    version: str | None = None
    license: str | None = None
    compatibility: str | None = None
    allowed_tools: str | list[str] | None = Field(default=None, alias="allowed-tools")
    metadata: dict[str, str] | None = None


class SkillSection(BaseModel):
    """A single section of a skill body, parsed from Markdown headings."""

    heading: str
    level: int
    content: str
    token_estimate: int
    children: list[SkillSection] = Field(default_factory=list)
    path: str


class ParsedSkill(BaseModel):
    """Parsed representation of a Markdown skill file."""

    frontmatter: SkillFrontmatter
    body: str
    raw: str
    sections: list[SkillSection] | None = None
    total_tokens: int | None = None
    definition_path: str | None = None


class BundledResources(BaseModel):
    """Bundled resources within a skill directory."""

    scripts: list[str] = Field(default_factory=list)
    references: list[str] = Field(default_factory=list)
    assets: list[str] = Field(default_factory=list)
    other: list[str] = Field(default_factory=list)


class SkillCatalogInfo(BaseModel):
    """Catalog metadata for a skill (download count, rating, etc.)."""

    author: str
    downloads: int
    rating: float
    tags: list[str] = Field(default_factory=list)
    published_at: str
    updated_at: str
    repository: str | None = None
    checksum: str | None = None


class SkillDefinition(BaseModel):
    """
    Complete skill definition.
    Implements agentskills.io specification with Matimo extensions.
    """

    name: str
    description: str
    version: str | None = None
    license: str | None = None
    compatibility: str | None = None
    allowed_tools: list[str] | None = None
    metadata: dict[str, str] | None = None
    body: str
    sections: list[SkillSection] | None = None
    total_tokens: int | None = None
    resources: BundledResources = Field(default_factory=BundledResources)
    source: Literal["builtin", "user", "catalog"] = "user"
    path_: str | None = Field(default=None, alias="_path")
    catalog_info: SkillCatalogInfo | None = None
    depends_on: list[str] | None = None


class SkillSummary(BaseModel):
    """Skill summary for discovery (Level 1 — minimal context)."""

    name: str
    description: str
    version: str | None = None
    license: str | None = None
    metadata: dict[str, str] | None = None
    source: Literal["builtin", "user", "catalog"] = "user"


class SearchSkillsOptions(BaseModel):
    """Options for searching skills."""

    query: str = ""
    category: str | None = None
    difficulty: str | None = None
    tags: list[str] | None = None
    author: str | None = None
    limit: int = 50
    offset: int = 0
    semantic: bool = False


class SkillContentOptions(BaseModel):
    """Options for selective skill content loading."""

    sections: list[str] | None = None
    max_tokens: int | None = None
    include_preamble: bool = True
    max_depth: int | None = None


# ---------------------------------------------------------------------------
# Policy context (mirrors TS PolicyContext — imported here for circular-safety)
# ---------------------------------------------------------------------------


class PolicyContext(BaseModel):
    """Context passed to the policy engine during execution checks."""

    agent_id: str | None = None
    environment: str | None = None
    roles: list[str] | None = None
    metadata: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# ExecuteOptions (mirrors TS ExecuteOptions)
# ---------------------------------------------------------------------------


class ExecuteOptions(BaseModel):
    """Options for Matimo.execute()."""

    timeout: int | None = None
    """
    Per-call credential overrides (multi-tenant).
    Keys = env var names the tool YAML references (e.g. SLACK_BOT_TOKEN).
    SECURITY: never logged, never persisted, held only for the duration of execute().
    """
    credentials: dict[str, str] | None = None
    context: PolicyContext | None = None
    """
    Skip approval check — use when the caller (e.g. MCP layer) already confirmed
    approval out-of-band. Does not override policy-level quarantine.
    """
    approved: bool | None = None
