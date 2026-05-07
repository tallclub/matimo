/**
 * Tool Schema Converter
 *
 * Converts Matimo ToolDefinition parameters to MCP-compatible Zod schemas.
 * The MCP SDK's registerTool() accepts { [key]: ZodType } as inputSchema.
 * Reuses the same parameterToZod logic as the LangChain integration.
 */

import { z } from 'zod';
import type { Parameter } from '../core/types.js';
import type { ToolDefinition } from '../core/schema.js';

/**
 * Convert a single Matimo Parameter to a Zod schema.
 * Handles: string, number, boolean, array, object, enum, defaults, optionals.
 */
export function parameterToZod(param: Parameter): z.ZodType<unknown> {
  let schema: z.ZodType<unknown>;

  // Handle enum constraints
  if (param.enum && param.enum.length > 0) {
    if (param.enum.length === 1) {
      // z.union requires at least 2 schemas — handle single-value enum explicitly
      schema = z.literal(param.enum[0]);
    } else {
      const enumSchemas = param.enum.map((value) => z.literal(value));
      schema = z.union(enumSchemas as unknown as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
    }
  } else {
    switch (param.type) {
      case 'string':
        schema = z.string();
        break;
      case 'number':
        schema = z.number();
        break;
      case 'boolean':
        schema = z.boolean();
        break;
      case 'array': {
        const itemSchema = param.items ? parameterToZod(param.items) : z.unknown();
        schema = z.array(itemSchema);
        break;
      }
      case 'object': {
        if (param.properties) {
          const props: Record<string, z.ZodType<unknown>> = {};
          for (const [key, prop] of Object.entries(param.properties)) {
            props[key] = parameterToZod(prop);
          }
          schema = z.object(props);
        } else {
          schema = z.record(z.string(), z.unknown());
        }
        break;
      }
      default:
        schema = z.unknown();
    }
  }

  // Add description
  if (param.description) {
    schema = schema.describe(param.description);
  }

  // Make optional before applying default.
  // Order matters: .optional().default(val) produces ZodDefault(ZodOptional(...)),
  // so parse(undefined) triggers the default. Reversing the order wraps ZodDefault
  // in ZodOptional, causing undefined to be absorbed before the default is reached.
  if (!param.required) {
    schema = schema.optional();
  }

  // Apply default after optional so parse(undefined) returns the default value.
  if (param.default !== undefined) {
    schema = schema.default(param.default);
  }

  return schema;
}

/**
 * Auth-related parameter name patterns.
 * Parameters matching these are excluded from the MCP input schema
 * because they are injected server-side by the secret resolver.
 */
const AUTH_PATTERNS = ['token', 'key', 'secret', 'password', 'credential', 'auth', 'bearer'];

/**
 * Check if a parameter name looks like a secret/auth parameter.
 * Normalises camelCase to segments first (e.g. apiKey → ['api','key']),
 * then splits on word separators (_ - .) and checks each segment for an
 * exact match against AUTH_PATTERNS, preventing false positives such as
 * "monkey" matching "key" or "author" matching "auth".
 */
function isAuthParameter(paramName: string): boolean {
  const segments = paramName
    .replace(/([a-z])([A-Z])/g, '$1_$2') // camelCase → snake_case (apiKey → api_Key)
    .toLowerCase()
    .split(/[_\-.]+/)
    .filter(Boolean);
  return segments.some((segment) => AUTH_PATTERNS.includes(segment));
}

/**
 * Convert a ToolDefinition's parameters to MCP inputSchema format.
 * Excludes auth parameters — those are injected server-side.
 *
 * @returns A plain object mapping param names to Zod types,
 *          which is what MCP SDK's registerTool() expects for inputSchema.
 */
export function convertParametersToMcpSchema(
  parameters: Record<string, Parameter>
): Record<string, z.ZodTypeAny> {
  const schema: Record<string, z.ZodTypeAny> = {};

  for (const [name, param] of Object.entries(parameters)) {
    // Skip auth parameters — they are injected by the MCP server
    if (isAuthParameter(name)) {
      continue;
    }
    schema[name] = parameterToZod(param) as z.ZodTypeAny;
  }

  return schema;
}

/**
 * Build the full MCP tool registration metadata from a ToolDefinition.
 *
 * @returns Object ready for server.registerTool(name, metadata, handler)
 */
export function toolToMcpRegistration(tool: ToolDefinition): {
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
} {
  const schema = convertParametersToMcpSchema(tool.parameters || {});

  // Tools with requires_approval need the _matimo_approved parameter in
  // the MCP schema so clients can confirm destructive operations.
  if (tool.requires_approval) {
    schema._matimo_approved = z
      .boolean()
      .optional()
      .describe('Set to true to confirm execution of this approval-required tool');
  }

  return {
    title: tool.name,
    description: tool.description || tool.name,
    inputSchema: schema,
  };
}

/**
 * Extract auth placeholder names from a tool's execution config.
 * These are the env var names the tool needs (e.g., SLACK_BOT_TOKEN, GITHUB_TOKEN).
 * Used by `matimo mcp setup` to generate config templates.
 */
export function extractAuthPlaceholders(tool: ToolDefinition): string[] {
  const placeholders: string[] = [];
  // Use \w+ (word chars only) instead of [^}]+ to avoid polynomial backtracking (ReDoS) on
  // uncontrolled input — placeholder names are always alphanumeric identifiers anyway.
  const placeholderRegex = /\{(\w+)\}/g;
  const execution = tool.execution;

  const scanString = (str: string) => {
    placeholderRegex.lastIndex = 0; // reset before each scan to avoid stale lastIndex from /g flag
    let match;
    while ((match = placeholderRegex.exec(str)) !== null) {
      const name = match[1];
      if (isAuthParameter(name) && !placeholders.includes(name)) {
        placeholders.push(name);
      }
    }
  };

  const scanObject = (obj: unknown) => {
    if (typeof obj === 'string') {
      scanString(obj);
    } else if (obj && typeof obj === 'object') {
      for (const value of Object.values(obj as Record<string, unknown>)) {
        scanObject(value);
      }
    }
  };

  // Scan URL, headers, body, query_params
  if ('url' in execution) scanString(execution.url);
  if ('headers' in execution && execution.headers) scanObject(execution.headers);
  if ('body' in execution && execution.body) scanObject(execution.body);
  if ('query_params' in execution && execution.query_params) scanObject(execution.query_params);
  if ('args' in execution && execution.args) {
    for (const arg of execution.args) {
      scanString(arg);
    }
  }
  if ('command' in execution) scanString(execution.command);

  return placeholders;
}
