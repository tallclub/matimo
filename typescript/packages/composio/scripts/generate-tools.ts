/**
 * @matimo/composio tool generator
 *
 * Fetches a Composio toolkit's action catalog and writes one Matimo
 * `definition.yaml` per action under `tools/composio_<action_slug>/`.
 *
 * Usage:
 *   pnpm generate:composio --toolkits=JIRA,LINEAR,ASANA [--force-refresh]
 *
 * Requires COMPOSIO_API_KEY in the environment (used only at generation
 * time, to call Composio's catalog API — generated tools resolve it again
 * at execution time via Matimo's auth-parameter injection).
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import yaml from 'js-yaml';
import { validateToolDefinition, type Parameter, type RiskLevel } from '@matimo/core';

// Both `pnpm generate:composio` (tsx) and Jest resolve `process.cwd()` to the
// `typescript/` workspace root, so paths are anchored there rather than via
// `import.meta.url` / `__dirname` — which conflict across ESM and ts-jest's
// CommonJS transform (TS1343).
const PACKAGE_ROOT = path.join(process.cwd(), 'packages/composio');

export const COMPOSIO_API_BASE = 'https://backend.composio.dev/api/v3';
export const TOOLS_OUTPUT_DIR = path.join(PACKAGE_ROOT, 'tools');
export const RISK_OVERRIDES_PATH = path.join(PACKAGE_ROOT, 'scripts/risk-overrides.json');

// ─── Composio catalog types (subset of GET /api/v3/tools response) ────────

export interface ComposioJsonSchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: ComposioJsonSchemaProperty;
  properties?: Record<string, ComposioJsonSchemaProperty>;
}

export interface ComposioJsonSchema {
  type?: string;
  properties?: Record<string, ComposioJsonSchemaProperty>;
  required?: string[];
}

export interface ComposioTool {
  slug: string;
  name: string;
  description?: string;
  toolkit?: { slug?: string; name?: string };
  input_parameters?: ComposioJsonSchema;
  output_parameters?: ComposioJsonSchema;
}

export type ComposioRiskOverrides = Record<string, RiskLevel>;

export type GenerateOutcome = 'created' | 'skipped' | 'invalid';

// ─── Risk classification heuristic ─────────────────────────────────────────

const HIGH_RISK_PATTERN = /DELETE|REMOVE|ARCHIVE|REVOKE|CANCEL/;
const MEDIUM_RISK_PATTERN = /CREATE|SEND|UPDATE|EDIT|ADD|POST|UPLOAD|INVITE/;
const LOW_RISK_PATTERN = /GET|LIST|FETCH|SEARCH|READ|FIND/;

/**
 * Classify a Composio action's risk level from its slug, mirroring
 * `classifyRisk`'s HTTP-method heuristic but applied to the action name
 * (every generated tool is `type: http` / `method: POST`, so method-based
 * classification alone would put everything at `medium`).
 *
 * Destructive patterns are checked first: an ambiguous name that also looks
 * destructive (e.g. "ARCHIVE_AND_GET") should still be flagged `high`.
 * Anything that matches none of the patterns defaults to `medium` —
 * an unnecessary approval prompt is preferable to a silent destructive write.
 */
export function classifyComposioActionRisk(actionSlug: string): RiskLevel {
  const upper = actionSlug.toUpperCase();
  if (HIGH_RISK_PATTERN.test(upper)) return 'high';
  if (MEDIUM_RISK_PATTERN.test(upper)) return 'medium';
  if (LOW_RISK_PATTERN.test(upper)) return 'low';
  return 'medium';
}

/**
 * Resolve the final risk level for a Composio action: an explicit entry in
 * `risk-overrides.json` (keyed by Composio tool slug) wins, otherwise fall
 * back to the heuristic.
 */
export function resolveRisk(actionSlug: string, overrides: ComposioRiskOverrides): RiskLevel {
  return overrides[actionSlug] ?? classifyComposioActionRisk(actionSlug);
}

export function loadRiskOverrides(overridesPath: string = RISK_OVERRIDES_PATH): ComposioRiskOverrides {
  if (!fs.existsSync(overridesPath)) {
    return {};
  }
  const raw = fs.readFileSync(overridesPath, 'utf-8');
  return JSON.parse(raw) as ComposioRiskOverrides;
}

// ─── Parameter mapping ──────────────────────────────────────────────────────

const JSON_SCHEMA_TYPE_MAP: Record<string, Parameter['type']> = {
  string: 'string',
  number: 'number',
  integer: 'number',
  boolean: 'boolean',
  array: 'array',
  object: 'object',
};

/**
 * Map Composio's JSON-Schema `input_parameters` to Matimo's `parameters` block.
 * Unknown/missing JSON Schema types fall back to `string`; `integer` collapses
 * to Matimo's `number` (Matimo has no separate integer type); nullable unions
 * (e.g. `["string", "null"]`) resolve to their first non-null member.
 */
export function mapInputParametersToMatimoParams(
  inputParameters?: ComposioJsonSchema
): Record<string, Parameter> {
  const result: Record<string, Parameter> = {};
  if (!inputParameters?.properties) {
    return result;
  }

  const required = new Set(inputParameters.required ?? []);

  for (const [paramName, prop] of Object.entries(inputParameters.properties)) {
    const rawType = Array.isArray(prop.type)
      ? prop.type.find((t) => t !== 'null') ?? 'string'
      : prop.type ?? 'string';

    const param: Parameter = {
      type: JSON_SCHEMA_TYPE_MAP[rawType] ?? 'string',
      description: prop.description?.trim() || `The ${paramName} parameter.`,
    };

    if (required.has(paramName)) {
      param.required = true;
    }
    if (prop.enum) {
      param.enum = prop.enum as Parameter['enum'];
    }
    if (prop.default !== undefined) {
      param.default = prop.default;
    }

    result[paramName] = param;
  }

  return result;
}

// ─── Tool definition builder ────────────────────────────────────────────────

const OUTPUT_SCHEMA = {
  type: 'object',
  description: "Response envelope from Composio's tool execution endpoint.",
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the HTTP request to Composio succeeded (2xx status).',
    },
    data: {
      type: 'object',
      description: "Composio's response body.",
      properties: {
        data: {
          type: 'object',
          description: 'The action-specific result payload.',
        },
        error: {
          type: ['string', 'null'],
          description: 'Error message if Composio could not execute the action.',
        },
        successful: {
          type: 'boolean',
          description: 'Whether Composio successfully executed the underlying action.',
        },
      },
    },
  },
} as const;

/**
 * Build a Matimo tool definition (plain object, not yet validated) for a
 * single Composio action.
 */
export function buildToolDefinition(
  toolkit: string,
  tool: ComposioTool,
  overrides: ComposioRiskOverrides
): Record<string, unknown> {
  const slugLower = tool.slug.toLowerCase();
  const toolkitLower = toolkit.toLowerCase();
  const params = mapInputParametersToMatimoParams(tool.input_parameters);
  const name = `composio_${slugLower}`;

  // Composio's `/tools/execute/{slug}` endpoint requires the `arguments` key
  // to be present in the request body (even as `{}`) — but Matimo's HTTP
  // executor drops empty nested objects after templating, which would strip
  // `arguments` entirely for actions with no, or all-optional and unfilled,
  // parameters. This literal marker (baked in at generation time, not a
  // `{param}` placeholder, so it always survives templating) keeps
  // `arguments` non-empty and doubles as a debugging breadcrumb in Composio's
  // logs identifying which Matimo tool made the call.
  const callArguments: Record<string, string> = { _matimo_tool: name };
  for (const paramName of Object.keys(params)) {
    callArguments[paramName] = `{${paramName}}`;
  }

  return {
    name,
    description: tool.description?.trim() || tool.name || tool.slug,
    version: '1.0.0',
    risk: resolveRisk(tool.slug, overrides),
    parameters: {
      composio_user_id: {
        type: 'string',
        description: 'The Composio entity/user ID for the calling tenant or user.',
        required: true,
      },
      composio_connected_account_id: {
        type: 'string',
        description: `The Composio connected account ID for the ${toolkit} toolkit, scoped to the calling tenant. The "Connect ${toolkit}" flow must be completed before this tool will succeed.`,
        required: true,
      },
      ...params,
    },
    execution: {
      type: 'http',
      method: 'POST',
      url: `${COMPOSIO_API_BASE}/tools/execute/${tool.slug}`,
      headers: {
        'x-api-key': '{COMPOSIO_API_KEY}',
        'Content-Type': 'application/json',
      },
      body: {
        user_id: '{composio_user_id}',
        connected_account_id: '{composio_connected_account_id}',
        arguments: callArguments,
      },
      timeout: 30000,
    },
    authentication: {
      type: 'api_key',
      location: 'header',
      name: 'x-api-key',
    },
    output_schema: OUTPUT_SCHEMA,
    tags: ['composio', toolkitLower],
    notes: {
      env: 'COMPOSIO_API_KEY',
      toolkit: toolkitLower,
      composio_slug: tool.slug,
    },
  };
}

// ─── Catalog fetching ────────────────────────────────────────────────────────

interface ComposioToolsPage {
  items?: ComposioTool[];
  next_cursor?: string | null;
}

/**
 * Fetch every action for a toolkit from Composio's REST catalog,
 * following `next_cursor` pagination until exhausted.
 */
export async function fetchToolkitTools(toolkit: string, apiKey: string): Promise<ComposioTool[]> {
  const tools: ComposioTool[] = [];
  let cursor: string | undefined;

  do {
    const response = await axios.get<ComposioToolsPage>(`${COMPOSIO_API_BASE}/tools`, {
      headers: { 'x-api-key': apiKey },
      params: {
        toolkit_slug: toolkit.toLowerCase(),
        limit: 100,
        ...(cursor ? { cursor } : {}),
      },
    });

    tools.push(...(response.data.items ?? []));
    cursor = response.data.next_cursor ?? undefined;
  } while (cursor);

  return tools;
}

// ─── File writer ────────────────────────────────────────────────────────────

/**
 * Validate and write a single generated tool definition to
 * `tools/<name>/definition.yaml`. Idempotent: an existing file is left
 * untouched unless `forceRefresh` is set.
 */
export function generateToolFile(
  toolkit: string,
  tool: ComposioTool,
  overrides: ComposioRiskOverrides,
  outputDir: string = TOOLS_OUTPUT_DIR,
  forceRefresh = false
): { outcome: GenerateOutcome; name: string; error?: string } {
  const toolDef = buildToolDefinition(toolkit, tool, overrides);
  const name = toolDef.name as string;

  try {
    validateToolDefinition(toolDef);
  } catch (error) {
    return { outcome: 'invalid', name, error: (error as Error).message };
  }

  const dirPath = path.join(outputDir, name);
  const filePath = path.join(dirPath, 'definition.yaml');

  if (fs.existsSync(filePath) && !forceRefresh) {
    return { outcome: 'skipped', name };
  }

  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(filePath, yaml.dump(toolDef, { lineWidth: 100, noRefs: true, noCompatMode: true }));

  return { outcome: 'created', name };
}

// ─── CLI entry point ────────────────────────────────────────────────────────

export function parseArgs(argv: string[]): { toolkits: string[]; forceRefresh: boolean } {
  const toolkitsArg = argv.find((arg) => arg.startsWith('--toolkits='));
  const toolkits = toolkitsArg
    ? toolkitsArg
        .slice('--toolkits='.length)
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
    : [];

  return { toolkits, forceRefresh: argv.includes('--force-refresh') };
}

async function main(): Promise<void> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.error('Error: COMPOSIO_API_KEY environment variable is required.');
    process.exit(1);
  }

  const { toolkits, forceRefresh } = parseArgs(process.argv.slice(2));
  if (toolkits.length === 0) {
    console.error('Usage: pnpm generate:composio --toolkits=JIRA,LINEAR,ASANA [--force-refresh]');
    process.exit(1);
  }

  const overrides = loadRiskOverrides();
  let created = 0;
  let skipped = 0;
  let invalid = 0;

  for (const toolkit of toolkits) {
    console.info(`\n${toolkit}`);
    const tools = await fetchToolkitTools(toolkit, apiKey);
    console.info(`  fetched ${tools.length} action(s)`);

    for (const tool of tools) {
      const result = generateToolFile(toolkit, tool, overrides, TOOLS_OUTPUT_DIR, forceRefresh);
      if (result.outcome === 'created') {
        created++;
        console.info(`  + ${result.name}`);
      } else if (result.outcome === 'skipped') {
        skipped++;
      } else {
        invalid++;
        console.error(`  ✗ ${result.name}: ${result.error}`);
      }
    }
  }

  console.info(`\nDone. ${created} created, ${skipped} skipped, ${invalid} invalid.`);
  process.exit(invalid > 0 ? 1 : 0);
}

/**
 * True when this file is executed directly (e.g. `tsx generate-tools.ts`),
 * as opposed to being `import`ed by a test. Comparing `process.argv[1]`'s
 * basename avoids `import.meta`/`__dirname`, which conflict across ESM and
 * ts-jest's CommonJS transform (TS1343).
 */
function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && path.basename(entry) === 'generate-tools.ts';
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
