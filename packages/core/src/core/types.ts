/**
 * Core type definitions for Matimo tool ecosystem
 */

import { ParameterEncodingConfig } from '../encodings/parameter-encoding';

/**
 * Parameter definition for a tool
 */
export interface Parameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: (string | number | boolean)[];
  default?: unknown;
  items?: Parameter;
  properties?: Record<string, Parameter>;
}

/**
 * Authentication configuration for a tool
 */
export interface AuthConfig {
  type?: 'none' | 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom';
  location?: 'header' | 'query' | 'body';
  name?: string;
  scheme?: string;
  /**
   * For type: basic — name of the environment variable holding the HTTP Basic Auth username.
   * HttpExecutor will read this env var and the password_env var, base64-encode them as
   * "username:password", and inject `Authorization: Basic <encoded>` automatically.
   */
  username_env?: string;
  /**
   * For type: basic — name of the environment variable holding the HTTP Basic Auth password.
   * Used together with username_env to build the Authorization header automatically.
   */
  password_env?: string;
}

/**
 * HTTP execution configuration
 */
export interface HttpExecution {
  type: 'http';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query_params?: Record<string, string>;
  parameter_encoding?: ParameterEncodingConfig[];
  timeout?: number;
}

/**
 * Command execution configuration
 */
export interface CommandExecution {
  type: 'command';
  command: string;
  args?: string[];
  cwd?: string;
  shell?: boolean;
  timeout?: number;
  env?: Record<string, string>;
}

/**
 * Function execution configuration
 * Supports embedded async functions for direct execution
 */
export interface FunctionExecution {
  type: 'function';
  code: string; // JavaScript async function code
  timeout?: number;
}

/**
 * Output schema for tool response validation.
 * TypeScript interface inferred from Zod schema in schema.ts.
 * Properties allows nested output schemas or any unknown structure for flexibility.
 */
export interface OutputSchema {
  type?: string;
  properties?: Record<string, unknown>;
  items?: OutputSchema;
  required?: string[];
  description?: string;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled?: boolean;
  requests_per_minute?: number;
  requests_per_hour?: number;
  burst_size?: number;
}

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  retry?: number;
  backoff_type?: 'exponential' | 'linear' | 'fixed';
  initial_delay_ms?: number;
  max_delay_ms?: number;
}

/**
 * Tool example configuration
 */
export interface ToolExample {
  name: string;
  params: Record<string, unknown>;
  description?: string;
}

/**
 * Complete tool definition
 */
export interface ToolDefinition {
  name: string;
  version: string;
  description: string;
  parameters?: Record<string, Parameter>;
  execution: HttpExecution | CommandExecution | FunctionExecution;
  authentication?: AuthConfig;
  output_schema?: OutputSchema;
  rate_limiting?: RateLimitConfig;
  error_handling?: ErrorHandlingConfig;
  examples?: ToolExample[];
  deprecated?: boolean;
  deprecation_message?: string;
  tags?: string[];
  /**
   * Whether this tool requires approval before execution
   * Set to true for destructive operations (CREATE, DELETE, DROP, etc.)
   */
  requires_approval?: boolean;
  /**
   * Tool lifecycle status. Tools without a status are treated as 'approved'.
   * - draft: Agent-created, not yet human-reviewed
   * - approved: Human-reviewed and ready for use
   * - deprecated: Scheduled for removal
   */
  status?: 'draft' | 'approved' | 'deprecated';
  /**
   * Internal: Path to the tool definition file (set by ToolLoader)
   * Used to resolve relative paths for function executors
   */
  _definitionPath?: string;
}

/**
 * Tool execution result
 */
export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  statusCode?: number;
  duration: number;
  traceId: string;
}

/**
 * Execution context for a tool run
 */
export interface ExecutionContext {
  traceId: string;
  userId?: string;
  toolName: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
  secrets: Record<string, string>;
}

/**
 * Schema validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  expectedType?: string;
  receivedValue?: unknown;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Options for MatimoInstance.execute()
 *
 * @example
 * // Single-tenant (reads from process.env)
 * await matimo.execute('slack-send-message', { channel: '#general', text: 'Hello' });
 *
 * // Multi-tenant (credentials supplied per call — never touches process.env)
 * await matimo.execute('slack-send-message', { channel: '#general', text: 'Hello' }, {
 *   credentials: { SLACK_BOT_TOKEN: 'xoxb-tenant-a-token' },
 * });
 */
export interface ExecuteOptions {
  /**
   * Maximum time (ms) to wait for the tool to complete.
   * Overrides the timeout defined in the tool's YAML definition.
   */
  timeout?: number;
  /**
   * Per-call credential overrides. Keys must match the env-var names that the
   * tool's YAML references (e.g. `SLACK_BOT_TOKEN`, `GITHUB_ACCESS_TOKEN`).
   *
   * When provided:
   * - **HttpExecutor**: used for Authorization headers / query params / Basic Auth
   *   instead of `process.env`.
   * - **CommandExecutor**: injected as environment variables into the child process
   *   (`{ ...process.env, ...credentials }`), so spawned scripts see them normally.
   * - **FunctionExecutor**: passed as `context.credentials` to the tool function.
   *
   * When NOT provided the current behaviour is unchanged — credentials are read
   * from `process.env` as before (fully backward-compatible).
   *
   * SECURITY: values are never logged, never persisted, and held only for the
   * duration of the execute() call.
   */
  credentials?: Record<string, string>;
  /**
   * Policy context for the current execution. When a PolicyEngine is active,
   * this context is checked against the tool's requirements before execution.
   */
  context?: import('../policy/types').PolicyContext;
  /**
   * Skip approval check for this execution. Use when the caller (e.g., MCP layer)
   * has already confirmed approval out-of-band, to avoid re-prompting the user.
   * Does not override policy-level quarantine checks (pending_approval state).
   * Default: false
   */
  approved?: boolean;
}

/**
 * Bundled resources within a skill directory (scripts, references, assets)
 */
export interface BundledResources {
  scripts: string[];
  references: string[];
  assets: string[];
  other: string[];
}

/**
 * YAML frontmatter for a SKILL.md file
 * Follows agentskills.io/specification
 */
export interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  license?: string;
  compatibility?: string;
  'allowed-tools'?: string[];
  metadata?: Record<string, string>;
}

/**
 * A single section of a skill body, parsed from Markdown headings.
 */
export interface SkillSection {
  heading: string;
  level: number;
  content: string;
  tokenEstimate: number;
  children: SkillSection[];
  path: string;
}

/**
 * Parsed skill content (frontmatter + body + structured sections)
 */
export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  body: string;
  raw: string;
  sections?: SkillSection[];
  totalTokens?: number;
}

/**
 * Catalog metadata for a skill (download count, rating, etc.)
 */
export interface SkillCatalogInfo {
  author: string;
  downloads: number;
  rating: number;
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  repository?: string;
  checksum?: string;
}

/**
 * Complete skill definition
 * Implements agentskills.io specification with Matimo extensions
 */
export interface SkillDefinition {
  name: string;
  description: string;
  version?: string;
  license?: string;
  compatibility?: string;
  allowedTools?: string[];
  metadata?: Record<string, string>;
  body: string;
  /** Structured sections parsed from Markdown headings */
  sections?: SkillSection[];
  /** Approximate total token count for the skill body */
  totalTokens?: number;
  resources: BundledResources;
  source: 'builtin' | 'user' | 'catalog';
  _path?: string; // Internal: path to skill directory
  catalogInfo?: SkillCatalogInfo;
  // Skill composition (Phase 4)
  dependsOn?: string[];
}

/**
 * Skill summary for discovery (Level 1 - minimal context)
 */
export interface SkillSummary {
  name: string;
  description: string;
  version?: string;
  license?: string;
  metadata?: Record<string, string>;
  source: 'builtin' | 'user' | 'catalog';
}

/**
 * Options for searching skills
 */
export interface SearchSkillsOptions {
  query?: string;
  category?: string;
  difficulty?: string;
  tags?: string[];
  author?: string;
  limit?: number;
  offset?: number;
  /** Use semantic search via embeddings (requires an EmbeddingProvider) */
  semantic?: boolean;
}

/**
 * Options for selective skill content loading
 */
export interface SkillContentOptions {
  /** Only return sections matching these headings (case-insensitive partial match) */
  sections?: string[];
  /** Maximum total tokens to return */
  maxTokens?: number;
  /** Include the preamble (default: true) */
  includePreamble?: boolean;
  /** Depth limit for section inclusion (1 = top-level only) */
  maxDepth?: number;
}

/**
 * Pluggable embedding provider for semantic skill search.
 * Implement this interface to connect to OpenAI, Cohere, local models, etc.
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  /** Embedding dimensionality */
  dimensions: number;
}
