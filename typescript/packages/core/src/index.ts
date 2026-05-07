/**
 * Matimo - Universal AI Agent Tools Ecosystem
 *
 * Framework-agnostic SDK that enables any developer to integrate 1000+ tools
 * across any AI framework (LangChain, CrewAI, Anthropic SDK, etc.).
 */

// Core types and schema
export type {
  Parameter,
  AuthConfig,
  HttpExecution,
  CommandExecution,
  FunctionExecution,
  OutputSchema,
  RateLimitConfig,
  ErrorHandlingConfig,
  ToolDefinition,
  ExecuteOptions,
  SkillDefinition,
  SkillFrontmatter,
  ParsedSkill,
  SkillSummary,
  SearchSkillsOptions,
  BundledResources,
  SkillCatalogInfo,
  SkillSection,
  SkillContentOptions,
  EmbeddingProvider,
} from './core/types.js';
export { ParameterSchema, AuthConfigSchema, ExecutionConfigSchema } from './core/schema.js';
export { ToolLoader } from './core/tool-loader.js';
export { ToolRegistry } from './core/tool-registry.js';
export { SkillLoader } from './core/skill-loader.js';
export { SkillRegistry } from './core/skill-registry.js';
export type { SemanticSearchResult } from './core/skill-registry.js';
export {
  parseSkillSections,
  extractSkillContent,
  listSkillSections,
} from './core/skill-content-parser.js';
export { extractSkillMetadata } from './core/skill-loader.js';
export type { ParsedSkillContent } from './core/skill-content-parser.js';
export { TfIdfEmbeddingProvider, cosineSimilarity } from './core/tfidf-embedding.js';

// Executors
export { CommandExecutor } from './executors/command-executor.js';
export { HttpExecutor } from './executors/http-executor.js';
export { FunctionExecutor } from './executors/function-executor.js';

// Parameter Encoding
export { applyParameterEncodings } from './encodings/parameter-encoding.js';
export type { ParameterEncodingConfig } from './encodings/parameter-encoding.js';

// Decorators
export {
  tool,
  setGlobalMatimoInstance,
  getGlobalMatimoInstance,
} from './decorators/tool-decorator.js';

// Error handling
export {
  MatimoError,
  ErrorCode,
  createValidationError,
  createExecutionError,
} from './errors/matimo-error.js';

// Logging
export {
  MatimoLogger,
  LogLevel,
  LoggerConfig,
  getLoggerConfig,
  setGlobalMatimoLogger,
  getGlobalMatimoLogger,
} from './logging/index.js';
export { WinstonMatimoLogger, createLogger } from './logging/winston-logger.js';

// Matimo instance and namespace
export { MatimoInstance, matimo } from './matimo-instance.js';
export type { InitOptions } from './matimo-instance.js';

// OAuth2 authentication (Phase 2+)
export type {
  OAuth2Provider,
  OAuth2Token,
  OAuth2Config,
  AuthorizationOptions,
  TokenResponse,
  OAuth2Endpoints,
} from './auth/oauth2-config.js';
export type { ProviderDefinition } from './core/schema.js';
export { OAuth2ProviderLoader } from './auth/oauth2-provider-loader.js';
export { OAuth2Handler } from './auth/oauth2-handler.js';

// LangChain integration
export {
  convertToolsToLangChain,
  getSkillsMetadata,
  buildRelevantSkillPrompt,
} from './integrations/langchain.js';
export type { LangChainTool, SkillContext } from './integrations/langchain.js';

// Vercel AI integration
// export { convertToolsToVercelAI } from './integrations/vercel-ai.js';
// export type { VercelAITool, VercelAIToolSet } from './integrations/vercel-ai.js';

// Policy engine
export type {
  PolicyEngine,
  PolicyContext,
  PolicyDecision,
  PolicyConfig,
  PolicyTier,
  RiskLevel,
  Violation,
  ValidationResult,
  ValidationContext,
  HITLCallback,
  HITLRequest,
} from './policy/types.js';
export { DefaultPolicyEngine, getTierForTool } from './policy/default-policy.js';
export { validateToolContent, isSSRFTarget } from './policy/content-validator.js';
export { classifyRisk } from './policy/risk-classifier.js';
export { ToolIntegrityTracker } from './policy/integrity-tracker.js';
export { ApprovalManifest } from './policy/approval-manifest.js';
export { loadPolicyFromFile, parsePolicyFile } from './policy/policy-loader.js';
export type { MatimoEvent, MatimoEventHandler } from './policy/events.js';

// Schema validation
export { ToolDefinitionSchema, validateToolDefinition } from './core/schema.js';

// Hot-reload
export type { ReloadResult } from './matimo-instance.js';

// Generic Approval System - Simple, scalable flow for any tool
// Tools declare requires_approval in YAML, or system detects destructive keywords
// Single approval callback handles all tools - no per-provider logic needed
export { ApprovalHandler, getGlobalApprovalHandler } from './approval/approval-handler.js';
export type { ApprovalRequest, ApprovalCallback } from './approval/approval-handler.js';

// MCP Server - Model Context Protocol integration
// Exposes all Matimo tools via MCP for Claude Desktop, Cursor, etc.
export { MCPServer, createMCPServer } from './mcp/index.js';
export type { MCPServerOptions } from './mcp/index.js';

// Secret Resolvers - pluggable secret management
export type {
  SecretResolver,
  SecretResolverConfig,
  SecretResolverChainConfig,
} from './mcp/index.js';
export {
  EnvSecretResolver,
  DotenvSecretResolver,
  SecretResolverChain,
  createResolverChain,
} from './mcp/index.js';
export {
  convertParametersToMcpSchema,
  toolToMcpRegistration,
  extractAuthPlaceholders,
} from './mcp/index.js';
