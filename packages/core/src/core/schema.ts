import { z } from 'zod';
import { MatimoError, ErrorCode } from '../errors/matimo-error';

/**
 * Core Zod validation schemas for all Matimo tool properties.
 * These schemas ensure YAML tools conform to the spec on load.
 */

// Parameter types that tools can define
export const ParameterSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  description: z.string(),
  required: z.boolean().optional(),
  enum: z.array(z.any()).optional(),
  default: z.any().optional(),
  examples: z.array(z.any()).optional(),
});

export type Parameter = z.infer<typeof ParameterSchema>;

// Authentication configuration
export const AuthConfigSchema = z.object({
  type: z.enum(['api_key', 'basic', 'bearer', 'oauth2', 'custom']).optional(),
  location: z.enum(['header', 'query', 'body']).optional(),
  name: z.string().optional(),
  provider: z.string().optional(),
  required: z.boolean().optional(),
  /**
   * For type: basic — name of the environment variable holding the HTTP Basic Auth username.
   * HttpExecutor will read this env var and the password_env var, base64-encode them as
   * "username:password", and inject `Authorization: Basic <encoded>` automatically.
   * This eliminates the need for developers to pre-compute a base64 credential string.
   */
  username_env: z.string().optional(),
  /**
   * For type: basic — name of the environment variable holding the HTTP Basic Auth password.
   * Used together with username_env to build the Authorization header automatically.
   */
  password_env: z.string().optional(),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

// Execution configuration (command, HTTP, or function)
export const ExecutionConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('command'),
    command: z.string(),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    shell: z.boolean().optional(),
    timeout: z.number().optional(),
  }),
  z.object({
    type: z.literal('http'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    url: z.string(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.unknown().optional(),
    query_params: z.record(z.string(), z.string()).optional(),
    parameter_encoding: z
      .array(
        z.object({
          source: z.array(z.string()),
          target: z.string(),
          encoding: z.string(),
          options: z.record(z.string(), z.unknown()).optional(),
        })
      )
      .optional(),
    timeout: z.number().optional(),
  }),
  z.object({
    type: z.literal('function'),
    code: z.string(),
    timeout: z.number().optional(),
  }),
]);

export type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;

// Output schema for validation
export const OutputSchemaSchema = z.object({
  type: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  required: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export type OutputSchema = z.infer<typeof OutputSchemaSchema>;

// Error handling configuration
export const ErrorHandlingSchema = z.object({
  retry: z.number().optional(),
  backoff_type: z.enum(['linear', 'exponential']).optional(),
  initial_delay_ms: z.number().optional(),
  max_delay_ms: z.number().optional(),
});

export type ErrorHandling = z.infer<typeof ErrorHandlingSchema>;

// Rate limiting configuration
export const RateLimitingSchema = z.object({
  enabled: z.boolean().optional(),
  requests_per_minute: z.number().optional(),
  burst_size: z.number().optional(),
  quota_per_hour: z.number().optional(),
});

export type RateLimiting = z.infer<typeof RateLimitingSchema>;

// Complete tool definition
export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string(),
  parameters: z.record(z.string(), ParameterSchema).optional(),
  execution: ExecutionConfigSchema,
  authentication: AuthConfigSchema.optional(),
  output_schema: OutputSchemaSchema.optional(),
  error_handling: ErrorHandlingSchema.optional(),
  rate_limiting: RateLimitingSchema.optional(),
  requires_approval: z.boolean().optional(),
  examples: z
    .array(
      z.object({
        name: z.string(),
        params: z.record(z.string(), z.unknown()),
        description: z.string().optional(),
      })
    )
    .optional(),
  deprecated: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  deprecation_message: z.string().optional(),
  status: z.enum(['draft', 'approved', 'deprecated']).optional(),
  // _definitionPath: z.string().optional(), // Internal use for tracking source file path
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema> & {
  /**
   * Internal metadata indicating where this tool definition was loaded from.
   * Not part of the external schema; added programmatically after validation.
   */
  _definitionPath?: string;
};

// export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// OAuth2 provider endpoints schema
export const OAuth2EndpointsSchema = z.object({
  authorizationUrl: z.string().url(),
  tokenUrl: z.string().url(),
  revokeUrl: z.string().url().optional(),
});

export type OAuth2Endpoints = z.infer<typeof OAuth2EndpointsSchema>;

// Provider definition schema
export const ProviderDefinitionSchema = z.object({
  name: z.string(),
  type: z.literal('provider'),
  version: z.string(),
  description: z.string().optional(),
  provider: z.object({
    name: z.string(),
    displayName: z.string().optional(),
    endpoints: OAuth2EndpointsSchema,
    defaultScopes: z.array(z.string()).optional(),
    documentation: z.string().url().optional(),
    learnMore: z.string().url().optional(),
  }),
});

export type ProviderDefinition = z.infer<typeof ProviderDefinitionSchema>;

/**
 * Validate a tool definition against the schema
 * Provides detailed error messages for validation failures
 *
 * @param tool - Tool definition to validate
 * @returns Validated tool definition
 * @throws {Error} If validation fails with detailed error information
 *
 * @example
 * ```typescript
 * import { getGlobalMatimoLogger } from '../logging';
 *
 * try {
 *   const tool = validateToolDefinition(parsedYAML);
 * } catch (error) {
 *   const logger = getGlobalMatimoLogger();
 *   logger.error('Invalid tool definition', {
 *     details: error.message
 *   });
 *   throw error;
 * }
 * ```
 */
export function validateToolDefinition(tool: unknown): ToolDefinition {
  const result = ToolDefinitionSchema.safeParse(tool);

  if (!result.success) {
    // Format detailed error messages from Zod v4
    const errors = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
        return `  • ${path}: ${issue.message} (${issue.code})`;
      })
      .join('\n');

    throw new MatimoError(`Tool schema validation failed:\n${errors}`, ErrorCode.INVALID_SCHEMA, {
      issues: result.error.issues,
    });
  }

  return result.data;
}

/**
 * Validate a provider definition against the schema
 * Provides detailed error messages for validation failures
 *
 * @param provider - Provider definition to validate
 * @returns Validated provider definition
 * @throws {MatimoError} If validation fails with detailed error information
 */
export function validateProviderDefinition(provider: unknown): ProviderDefinition {
  const result = ProviderDefinitionSchema.safeParse(provider);

  if (!result.success) {
    // Format detailed error messages from Zod v4
    const errors = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
        return `  • ${path}: ${issue.message} (${issue.code})`;
      })
      .join('\n');

    throw new MatimoError(
      `Provider schema validation failed:\n${errors}`,
      ErrorCode.INVALID_SCHEMA,
      {
        issues: result.error.issues,
      }
    );
  }

  return result.data;
}
