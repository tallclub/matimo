/**
 * LangChain Integration for Matimo
 *
 * Converts Matimo tools to LangChain-compatible format.
 * Simple, lightweight, scales to 2000+ tools.
 *
 * NOTE: Requires @langchain/core as peer dependency.
 * Install with: npm install @langchain/core langchain
 *
 * Usage:
 *   const matimo = await MatimoInstance.init('./tools');
 *   const langchainTools = await convertToolsToLangChain(
 *     matimo.listTools(),
 *     matimo,
 *     { SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN }
 *   );
 */

import { z } from 'zod';
import type { ToolDefinition, Parameter } from '../core/types';
import type { MatimoInstance } from '../matimo-instance';

// LangChain tool type - dynamically imported to avoid hard dependency
export interface LangChainTool {
  name: string;
  description: string;
  schema: z.ZodSchema;
  invoke: (input: Record<string, unknown>) => Promise<unknown>;
}

// Lazy load LangChain to avoid hard dependency
let langChainToolFn:
  | ((
      fn: (input: Record<string, unknown>) => Promise<unknown>,
      options: {
        name: string;
        description: string;
        schema: z.ZodSchema;
      }
    ) => LangChainTool)
  | null = null;

async function getLangChainTool(): Promise<
  (
    fn: (input: Record<string, unknown>) => Promise<unknown>,
    options: {
      name: string;
      description: string;
      schema: z.ZodSchema;
    }
  ) => LangChainTool
> {
  if (!langChainToolFn) {
    try {
      const langChainModule = await import('@langchain/core/tools');
      langChainToolFn = langChainModule.tool;
    } catch {
      throw new Error('LangChain not installed. Install: npm install @langchain/core langchain');
    }
  }
  return langChainToolFn;
}

/**
 * Convert parameter to Zod schema
 *
 * Supports:
 * - enum constraints (if present, validates against allowed values)
 * - default values (sets default in schema)
 * - type validation (string, number, boolean, array, object)
 * - description and required metadata
 */
function parameterToZod(param: Parameter): z.ZodType<unknown> {
  let schema: z.ZodType<unknown>;

  // If enum is present, validate against allowed values
  if (param.enum && param.enum.length > 0) {
    // Create enum schema from allowed values using z.union for mixed types
    const enumSchemas = param.enum.map((value) => z.literal(value));
    // Build union from array of literal schemas (type-safe via unknown cast)
    schema = z.union(enumSchemas as unknown as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
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

  if (param.description) {
    schema = schema.describe(param.description);
  }

  // Make optional before applying default — same ordering rule as tool-converter.ts:
  // .optional().default(val) → ZodDefault(ZodOptional), so parse(undefined) returns the default.
  if (!param.required) {
    schema = schema.optional();
  }

  if (param.default !== undefined) {
    schema = schema.default(param.default);
  }

  return schema;
}

/**
 * Auto-detect if a parameter name looks like a secret
 * based on common patterns (TOKEN, KEY, SECRET, PASSWORD)
 *
 * Uses word-boundary matching and camelCase detection to avoid false positives:
 * - ✅ Matches: "api_token", "API_KEY", "getToken", "secret", "password_hash"
 * - ❌ Rejects: "monkey", "turkey_id", "donkey" (substrings only)
 */
function isSecretParameter(paramName: string): boolean {
  const upperName = paramName.toUpperCase();

  // Pattern 1: Word boundaries (works for snake_case: api_token, API_KEY)
  if (/\b(TOKEN|KEY|SECRET|PASSWORD)\b/.test(upperName)) {
    return true;
  }

  // Pattern 2: Underscore prefix/suffix (works for snake_case: _token_, prefix_token_)
  if (/(^|_)(TOKEN|KEY|SECRET|PASSWORD)(_|$)/.test(upperName)) {
    return true;
  }

  // Pattern 3: CamelCase detection (works for camelCase: getToken, apiKey)
  // Check if secret word appears after a lowercase letter (camelCase boundary)
  if (/[a-z](TOKEN|KEY|SECRET|PASSWORD)/.test(paramName)) {
    return true;
  }

  return false;
}

/**
 * Build Zod schema for tool input, excluding secret parameters
 */
function buildInputSchema(
  tool: ToolDefinition,
  secretParams: Set<string>
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  if (!tool.parameters) {
    return z.object({});
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [name, param] of Object.entries(tool.parameters)) {
    if (secretParams.has(name)) {
      continue; // Skip secrets - they're injected
    }
    shape[name] = parameterToZod(param);
  }

  return z.object(shape);
}

/**
 * Convert Matimo tool to LangChain format
 */
async function convertTool(
  matimo: MatimoInstance,
  tool: ToolDefinition,
  secretParams: Set<string>,
  secrets: Record<string, string>
): Promise<LangChainTool> {
  const toolFn = await getLangChainTool();
  const schema = buildInputSchema(tool, secretParams);

  return toolFn(
    async (input: Record<string, unknown>) => {
      const params: Record<string, unknown> = { ...input };

      // Inject secrets
      for (const param of secretParams) {
        if (param in secrets) {
          params[param] = secrets[param];
        }
      }

      try {
        return await matimo.execute(tool.name, params);
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
    {
      name: tool.name,
      description: tool.description || tool.name,
      schema,
    }
  );
}

/**
 * Convert Matimo tools to LangChain format
 *
 * @param tools - Matimo tools
 * @param matimo - MatimoInstance
 * @param secrets - Map of parameter names to secret values
 * @param secretParamNames - Explicitly declared secret parameters (optional)
 * @returns LangChain tools
 *
 * @example
 * ```ts
 * const tools = await convertToolsToLangChain(
 *   matimo.listTools().filter(t => t.name.startsWith('slack')),
 *   matimo,
 *   { SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN }
 * );
 * ```
 */
export async function convertToolsToLangChain(
  tools: ToolDefinition[],
  matimo: MatimoInstance,
  secrets: Record<string, string> = {},
  secretParamNames?: Set<string>
): Promise<LangChainTool[]> {
  // Start with explicitly declared secret param names or auto-detect from secrets keys
  const detectedSecrets = secretParamNames || new Set(Object.keys(secrets));

  // Auto-detect additional secret parameters by scanning all tool parameters
  for (const tool of tools) {
    if (tool.parameters) {
      for (const paramName of Object.keys(tool.parameters)) {
        // Auto-detect if parameter looks like a secret
        if (isSecretParameter(paramName)) {
          detectedSecrets.add(paramName);
        }
      }
    }
  }

  return Promise.all(tools.map((tool) => convertTool(matimo, tool, detectedSecrets, secrets)));
}

// ─── Skill injection helpers for non-MCP (direct) integrations ───────────────
//
// When Matimo is used directly (e.g., LangChain without an MCP server), skills
// are not surfaced via MCP Resources.  These helpers provide a spec-compliant
// alternative that preserves the progressive disclosure model:
//
//   Level 1 — Discovery : getSkillsMetadata()      → name + description only
//   Level 2 — Activation: buildRelevantSkillPrompt() → semantic search → load matched content
//
// NOTE: Avoid loading all skill content upfront (getSkillContent for every skill).
// That defeats the purpose of progressive disclosure and bloats the context window.
// The agentskills.io spec and Matimo's TF-IDF search exist precisely to avoid this.
//
// Correct pattern for non-MCP LangChain usage:
//   1. At startup — inject Level 1 metadata (name + description) via getSkillsMetadata()
//   2. Per-request — call buildRelevantSkillPrompt(matimo, userQuery) to load only the
//      skills that are semantically relevant to the current request.

export interface SkillContext {
  name: string;
  description: string;
  content: string;
}

/**
 * Return Level 1 metadata (name + description) for all available skills.
 *
 * Token-safe — only a few lines per skill. Include this in the system prompt
 * so the agent knows what skills exist and can request them by name, mirroring
 * what `matimo_list_skills` does in the tool-based flow.
 *
 * @example
 * ```ts
 * const meta = getSkillsMetadata(matimo);
 * // → [{ name: 'code-review', description: 'Code review checklist' }, ...]
 * ```
 */
export function getSkillsMetadata(
  matimo: MatimoInstance
): Array<{ name: string; description: string }> {
  return matimo.listSkills().map((s) => ({
    name: s.name,
    description: s.description ?? '',
  }));
}

/**
 * Build a per-request system prompt snippet from semantically relevant skills.
 *
 * Uses TF-IDF semantic search (built-in, zero dependencies) to rank all skills
 * against the user's query and loads full content only for the top matches.
 * This preserves the progressive disclosure model without MCP:
 *
 *   Level 1 at startup → Level 2 per-request (only relevant skills)
 *
 * @param matimo     - Initialised MatimoInstance
 * @param query      - The user's current message/query; drives semantic ranking
 * @param options.topK      - Max skills to load (default 3); keeps token cost bounded
 * @param options.minScore  - Minimum cosine similarity to include (default 0.3)
 * @param options.header    - Custom header text (optional)
 * @returns Formatted string ready to inject as a context block, or empty string
 *          when no skills score above `minScore`.
 *
 * @example
 * ```ts
 * // In your ReAct loop, per message:
 * const skillContext = await buildRelevantSkillPrompt(matimo, userMessage, { topK: 2 });
 * const messages = [
 *   new SystemMessage(baseSystemPrompt),
 *   ...(skillContext ? [new SystemMessage(skillContext)] : []),
 *   new HumanMessage(userMessage),
 * ];
 * ```
 */
export async function buildRelevantSkillPrompt(
  matimo: MatimoInstance,
  query: string,
  options: { topK?: number; minScore?: number; header?: string } = {}
): Promise<string> {
  const { topK = 3, minScore = 0.3 } = options;

  const searchResults = await matimo.semanticSearchSkills(query, { limit: topK, minScore });
  if (searchResults.length === 0) return '';

  const blocks: string[] = [];
  for (const result of searchResults) {
    const content = matimo.getSkillContent(result.skill.name);
    if (content) {
      const desc = result.skill.description ? `_${result.skill.description}_\n\n` : '';
      blocks.push(
        `## Skill: ${result.skill.name} (relevance: ${result.score.toFixed(2)})\n${desc}${content}`
      );
    }
  }

  if (blocks.length === 0) return '';

  const header =
    options.header ??
    'The following skills are relevant to the current request — apply their guidelines:';

  return [header, ...blocks].join('\n\n');
}
