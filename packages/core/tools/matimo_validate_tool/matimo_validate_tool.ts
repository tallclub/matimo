import yaml from 'js-yaml';
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

interface ValidateResult {
  valid: boolean;
  schemaErrors: string[];
  policyViolations: Array<{ rule: string; severity: string; message: string }>;
  riskLevel: string;
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
    result.schemaErrors.push(`YAML parse error: ${(err as Error).message}`);
    logger.warn('matimo_validate_tool: YAML parse failed', { error: (err as Error).message });
    return result;
  }

  // Step 2: Validate against ToolDefinition schema
  let tool: ReturnType<typeof validateToolDefinition>;
  try {
    tool = validateToolDefinition(parsed);
  } catch (err) {
    result.valid = false;
    const message = (err as Error).message;
    result.schemaErrors.push(message);
    logger.warn('matimo_validate_tool: schema validation failed', { error: message });
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
