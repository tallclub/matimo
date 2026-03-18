/**
 * Policy-as-YAML loader for Matimo.
 *
 * Allows the developer to configure the policy engine through a YAML file
 * instead of inline TypeScript, making it easy to adjust policy across
 * environments without rebuilding.
 *
 * Schema for policy.yaml:
 *
 * ```yaml
 * allowedDomains:
 *   - api.slack.com
 *   - slack.com
 *
 * allowedCredentials:
 *   - SLACK_BOT_TOKEN
 *   - OPENAI_API_KEY
 *
 * allowedHttpMethods:
 *   - GET
 *   - POST
 *
 * allowCommandTools: false
 * allowFunctionTools: false
 *
 * protectedNamespaces:
 *   - matimo_
 * ```
 *
 * Usage:
 *   const matimo = await MatimoInstance.init({ policyFile: './policy.yaml' });
 */

import fs from 'fs';
import yaml from 'js-yaml';
import { z } from 'zod';
import { DefaultPolicyEngine } from './default-policy';
import type { PolicyEngine, PolicyConfig } from './types';
import { MatimoError, ErrorCode } from '../errors/matimo-error';

// ──────────────────────────────────────────────────────────────────────────────
// Zod schema — validates the YAML before constructing PolicyConfig
// ──────────────────────────────────────────────────────────────────────────────

const PolicyFileSchema = z.object({
  allowedDomains: z.array(z.string()).optional(),
  allowedCredentials: z.array(z.string()).optional(),
  allowedHttpMethods: z.array(z.string().toUpperCase()).optional(),
  allowCommandTools: z.boolean().optional(),
  allowFunctionTools: z.boolean().optional(),
  protectedNamespaces: z.array(z.string()).optional(),
});

type PolicyFile = z.infer<typeof PolicyFileSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parse a YAML policy file and return a PolicyEngine configured from it.
 *
 * Throws `MatimoError(INVALID_SCHEMA)` if the file cannot be read or fails validation.
 *
 * @param filePath - Absolute or cwd-relative path to the policy YAML file
 * @returns A frozen `DefaultPolicyEngine` built from the parsed config
 *
 * @example
 * ```ts
 * // Direct usage
 * const engine = loadPolicyFromFile('./policy.yaml');
 * const matimo = await MatimoInstance.init({ policy: engine });
 *
 * // Or use the shorthand InitOption (preferred)
 * const matimo = await MatimoInstance.init({ policyFile: './policy.yaml' });
 * ```
 */
export function loadPolicyFromFile(filePath: string): PolicyEngine {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new MatimoError(
      `Cannot read policy file "${filePath}": ${(err as NodeJS.ErrnoException).message}`,
      ErrorCode.INVALID_SCHEMA,
      { filePath }
    );
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new MatimoError(
      `Policy file "${filePath}" contains invalid YAML: ${(err as Error).message}`,
      ErrorCode.INVALID_SCHEMA,
      { filePath }
    );
  }

  const result = PolicyFileSchema.safeParse(parsed ?? {});
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new MatimoError(
      `Policy file "${filePath}" is invalid:\n${issues}`,
      ErrorCode.INVALID_SCHEMA,
      { filePath, issues: result.error.issues }
    );
  }

  const policyConfig: PolicyConfig = buildPolicyConfig(result.data);
  return new DefaultPolicyEngine(policyConfig);
}

function buildPolicyConfig(data: PolicyFile): PolicyConfig {
  const config: PolicyConfig = {};
  if (data.allowedDomains !== undefined) config.allowedDomains = data.allowedDomains;
  if (data.allowedCredentials !== undefined) config.allowedCredentials = data.allowedCredentials;
  if (data.allowedHttpMethods !== undefined) config.allowedHttpMethods = data.allowedHttpMethods;
  if (data.allowCommandTools !== undefined) config.allowCommandTools = data.allowCommandTools;
  if (data.allowFunctionTools !== undefined) config.allowFunctionTools = data.allowFunctionTools;
  if (data.protectedNamespaces !== undefined) config.protectedNamespaces = data.protectedNamespaces;
  return config;
}
