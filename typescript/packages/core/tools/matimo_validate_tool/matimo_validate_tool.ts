import * as yaml from 'js-yaml';
import {
  validateToolDefinition,
  validateToolContent,
  classifyRisk,
  getGlobalMatimoLogger,
} from '@matimo/core';
import type { Violation } from '@matimo/core';

interface ValidateParams {
  yaml_content: string;
}

/** Structured schema error with field path and optional valid values. */
interface SchemaError {
  field: string;
  message: string;
  validOptions?: string[];
}

interface ValidateResult {
  valid: boolean;
  schemaErrors: SchemaError[];
  policyViolations: Array<{ rule: string; severity: string; message: string }>;
  riskLevel: string;
}

const EXECUTION_TYPE_OPTIONS = ['command', 'http', 'function'];
const PARAMETER_TYPE_OPTIONS = ['string', 'number', 'boolean', 'array', 'object'];
const HTTP_METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const AUTH_TYPE_OPTIONS = ['api_key', 'basic', 'bearer', 'oauth2', 'custom'];
const STATUS_OPTIONS = ['draft', 'approved', 'deprecated'];

/**
 * Map known field paths to valid option sets so agents get actionable errors.
 */
const VALID_OPTIONS_BY_PATH: Record<string, string[]> = {
  'execution.type': EXECUTION_TYPE_OPTIONS,
  'execution.method': HTTP_METHOD_OPTIONS,
  'authentication.type': AUTH_TYPE_OPTIONS,
  status: STATUS_OPTIONS,
};

const PARAMETER_TYPE_PATTERN = /^parameters\.[^.]+\.type$/;
const PARAMETER_ENCODING_BACKOFF = /^error_handling\.backoff_type$/;

function getValidOptions(fieldPath: string): string[] | undefined {
  if (VALID_OPTIONS_BY_PATH[fieldPath]) return VALID_OPTIONS_BY_PATH[fieldPath];
  if (PARAMETER_TYPE_PATTERN.test(fieldPath)) return PARAMETER_TYPE_OPTIONS;
  if (PARAMETER_ENCODING_BACKOFF.test(fieldPath)) return ['linear', 'exponential'];
  return undefined;
}

/**
 * Convert a raw Zod issue into a human-readable SchemaError.
 * Handles the most common patterns: missing fields, invalid enums,
 * invalid discriminated union (execution.type).
 */
function formatZodIssue(issue: { path: (string | number)[]; message: string; code: string; expected?: string; received?: string }): SchemaError {
  const fieldPath = issue.path.length > 0 ? issue.path.join('.') : 'root';
  const validOptions = getValidOptions(fieldPath);

  let message: string;

  switch (issue.code) {
    case 'invalid_type':
      if (issue.received === 'undefined') {
        message = `Missing required field: \`${fieldPath}\``;
        if (validOptions) {
          message += ` — must be one of: ${validOptions.map((v) => `'${v}'`).join(', ')}`;
        }
      } else {
        message = `Invalid type for \`${fieldPath}\`: expected ${issue.expected ?? 'unknown'}, got ${issue.received ?? 'unknown'}`;
      }
      break;

    case 'invalid_literal':
    case 'invalid_enum_value':
      message = `Invalid value for \`${fieldPath}\``;
      if (validOptions) {
        message += ` — must be one of: ${validOptions.map((v) => `'${v}'`).join(', ')}`;
      } else {
        message += ` (${issue.message})`;
      }
      break;

    case 'invalid_union':
      // Discriminated union failure — most commonly execution.type
      message = `Invalid value for \`${fieldPath}\``;
      if (fieldPath === 'execution' || fieldPath === 'root') {
        message = `Missing or invalid \`execution.type\` — must be one of: ${EXECUTION_TYPE_OPTIONS.map((v) => `'${v}'`).join(', ')}`;
        return { field: 'execution.type', message, validOptions: EXECUTION_TYPE_OPTIONS };
      }
      if (validOptions) {
        message += ` — must be one of: ${validOptions.map((v) => `'${v}'`).join(', ')}`;
      } else {
        message += ` (${issue.message})`;
      }
      break;

    default:
      message = `\`${fieldPath}\`: ${issue.message}`;
  }

  return { field: fieldPath, message, ...(validOptions ? { validOptions } : {}) };
}

export default async function matimoValidateTool(
  params: ValidateParams,
): Promise<ValidateResult> {
  const logger = getGlobalMatimoLogger();
  const result: ValidateResult = {
    valid: true,
    schemaErrors: [],
    policyViolations: [],
    riskLevel: 'low',
  };

  // Step 1: Parse YAML
  let parsed: unknown;
  try {
    parsed = yaml.load(params.yaml_content);
  } catch (err) {
    result.valid = false;
    result.schemaErrors.push({
      field: 'root',
      message: `YAML parse error: ${(err as Error).message}`,
    });
    logger.warn('matimo_validate_tool: YAML parse failed', { error: (err as Error).message });
    return result;
  }

  // Step 2: Validate against ToolDefinition schema
  let tool: ReturnType<typeof validateToolDefinition>;
  try {
    tool = validateToolDefinition(parsed);
  } catch (err) {
    result.valid = false;
    // MatimoError carries raw Zod issues in details.issues — use them for structured output
    const matimoErr = err as { details?: { issues?: unknown[] }; message?: string };
    const rawIssues = matimoErr.details?.issues;
    if (Array.isArray(rawIssues) && rawIssues.length > 0) {
      result.schemaErrors = (rawIssues as { path: (string | number)[]; message: string; code: string; expected?: string; received?: string }[]).map(formatZodIssue);
    } else {
      result.schemaErrors.push({ field: 'root', message: (err as Error).message });
    }
    logger.warn('matimo_validate_tool: schema validation failed', {
      errorCount: result.schemaErrors.length,
    });
    return result;
  }

  // Step 3: Run content validator (as untrusted source)
  const validation = validateToolContent(tool, { source: 'untrusted' });
  if (!validation.valid) {
    result.valid = false;
    result.policyViolations = validation.violations.map((v: Violation) => ({
      rule: v.rule,
      severity: v.severity,
      message: v.message,
    }));
  }

  // Step 4: Classify risk
  result.riskLevel = classifyRisk(tool);

  return result;
}
