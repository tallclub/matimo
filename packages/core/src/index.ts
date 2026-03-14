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
} from './core/types';
export { ParameterSchema, AuthConfigSchema, ExecutionConfigSchema } from './core/schema';
export { ToolLoader } from './core/tool-loader';
export { ToolRegistry } from './core/tool-registry';

// Executors
export { CommandExecutor } from './executors/command-executor';
export { HttpExecutor } from './executors/http-executor';
export { FunctionExecutor } from './executors/function-executor';

// Parameter Encoding
export { applyParameterEncodings } from './encodings/parameter-encoding';
export type { ParameterEncodingConfig } from './encodings/parameter-encoding';

// Decorators
export {
  tool,
  setGlobalMatimoInstance,
  getGlobalMatimoInstance,
} from './decorators/tool-decorator';

// Error handling
export {
  MatimoError,
  ErrorCode,
  createValidationError,
  createExecutionError,
} from './errors/matimo-error';

// Logging
export {
  MatimoLogger,
  LogLevel,
  LoggerConfig,
  getLoggerConfig,
  setGlobalMatimoLogger,
  getGlobalMatimoLogger,
} from './logging';
export { WinstonMatimoLogger, createLogger } from './logging/winston-logger';

// Matimo instance and namespace
export { MatimoInstance, matimo } from './matimo-instance';
export type { InitOptions } from './matimo-instance';

// OAuth2 authentication (Phase 2+)
export type {
  OAuth2Provider,
  OAuth2Token,
  OAuth2Config,
  AuthorizationOptions,
  TokenResponse,
  OAuth2Endpoints,
} from './auth/oauth2-config';
export type { ProviderDefinition } from './core/schema';
export { OAuth2ProviderLoader } from './auth/oauth2-provider-loader';
export { OAuth2Handler } from './auth/oauth2-handler';

// LangChain integration
export { convertToolsToLangChain } from './integrations/langchain';
export type { LangChainTool } from './integrations/langchain';

// Policy engine
export type {
  PolicyEngine,
  PolicyContext,
  PolicyDecision,
  PolicyConfig,
  RiskLevel,
  Violation,
  ValidationResult,
  ValidationContext,
} from './policy/types';
export { DefaultPolicyEngine } from './policy/default-policy';
export { validateToolContent, isSSRFTarget } from './policy/content-validator';
export { classifyRisk } from './policy/risk-classifier';
export { ToolIntegrityTracker } from './policy/integrity-tracker';
export { ApprovalManifest } from './policy/approval-manifest';
export type { MatimoEvent, MatimoEventHandler } from './policy/events';

// Schema validation
export { ToolDefinitionSchema, validateToolDefinition } from './core/schema';

// Hot-reload
export type { ReloadResult } from './matimo-instance';

// Generic Approval System - Simple, scalable flow for any tool
// Tools declare requires_approval in YAML, or system detects destructive keywords
// Single approval callback handles all tools - no per-provider logic needed
export { ApprovalHandler, getGlobalApprovalHandler } from './approval/approval-handler';
export type { ApprovalRequest, ApprovalCallback } from './approval/approval-handler';

// MCP Server - Model Context Protocol integration
// Exposes all Matimo tools via MCP for Claude Desktop, Cursor, etc.
export { MCPServer, createMCPServer } from './mcp/index';
export type { MCPServerOptions } from './mcp/index';

// Secret Resolvers - pluggable secret management
export type { SecretResolver, SecretResolverConfig, SecretResolverChainConfig } from './mcp/index';
export {
  EnvSecretResolver,
  DotenvSecretResolver,
  SecretResolverChain,
  createResolverChain,
} from './mcp/index';
export {
  convertParametersToMcpSchema,
  toolToMcpRegistration,
  extractAuthPlaceholders,
} from './mcp/index';
