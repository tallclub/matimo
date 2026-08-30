import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import {
  validateToolDefinition,
  validateToolContent,
  classifyRisk,
  getTierForTool,
  getGlobalMatimoLogger,
} from '@matimo/core';
import type { Violation } from '@matimo/core';

interface CreateParams {
  name: string;
  yaml_content: string;
  target_dir?: string;
  proposed_by?: string;
  justification?: string;
}

interface CreateResult {
  success: boolean;
  path?: string;
  riskLevel?: string;
  status?: string;
  /** Signals what approval state the tool is in after creation.
   * - `pending`: requires human approval before execution (untrusted source, non-trivial risk)
   * - `auto-approved`: low-risk read-only GET tool, can be used immediately
   * - `approved`: manually approved (set externally by matimo_approve_tool)
   * - `rejected`: policy blocked the tool
   */
  approvalState?: 'pending' | 'auto-approved' | 'approved' | 'rejected';
  message: string;
  errors?: string[];
}

const UNSAFE_NAME_PATTERN = /[/\\]|\.\.|[\x00-\x1f]/;

export default async function matimoCreateTool(
  params: CreateParams,
): Promise<CreateResult> {
  const logger = getGlobalMatimoLogger();
  const targetDir = params.target_dir || './matimo-tools';

  // Step 1: Sanitize name
  if (!params.name || params.name.trim().length === 0) {
    return { success: false, message: 'Tool name is required' };
  }
  if (UNSAFE_NAME_PATTERN.test(params.name)) {
    return { success: false, message: 'Tool name contains invalid characters (path traversal, backslash, or control characters)' };
  }
  if (params.name.startsWith('matimo_')) {
    return { success: false, message: 'Tool name cannot start with reserved namespace "matimo_"' };
  }

  // Step 2: Parse YAML
  let parsed: Record<string, unknown>;
  try {
    parsed = yaml.load(params.yaml_content) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, message: 'YAML must parse to an object' };
    }
  } catch (err) {
    return { success: false, message: `YAML parse error: ${(err as Error).message}` };
  }

  // Step 3: Force safety fields
  parsed.name = params.name;
  parsed.requires_approval = true;
  parsed.status = 'draft';

  // Step 4: Validate against schema
  const yamlStr = yaml.dump(parsed);
  try {
    validateToolDefinition(yaml.load(yamlStr));
  } catch (err) {
    return { success: false, message: `Schema validation failed: ${(err as Error).message}` };
  }

  // Step 5: Run content validator
  const tool = validateToolDefinition(yaml.load(yamlStr));
  const validation = validateToolContent(tool, { source: 'untrusted' });
  const criticalOrHigh = validation.violations.filter(
    (v: Violation) => v.severity === 'critical' || v.severity === 'high',
  );
  if (criticalOrHigh.length > 0) {
    return {
      success: false,
      message: 'Tool failed policy validation',
      errors: criticalOrHigh.map((v: Violation) => `[${v.severity}] ${v.rule}: ${v.message}`),
    };
  }

  // Step 6: Classify risk + tier
  const riskLevel = classifyRisk(tool);
  const tier = getTierForTool(tool);
  const approvalState: CreateResult['approvalState'] = tier === 'auto' ? 'auto-approved' : 'pending';

  // Step 7: Write to disk
  const toolDirPath = path.resolve(targetDir, params.name);
  fs.mkdirSync(toolDirPath, { recursive: true });

  let header = '';
  if (params.proposed_by) {
    header += `# Proposed by: ${params.proposed_by}\n`;
  }
  if (params.justification) {
    header += `# Justification: ${params.justification}\n`;
  }
  if (header) {
    header += '\n';
  }

  const filePath = path.join(toolDirPath, 'definition.yaml');
  fs.writeFileSync(filePath, header + yamlStr, 'utf-8');

  logger.info('matimo_create_tool: tool created', {
    name: params.name,
    path: filePath,
    riskLevel,
    approvalState,
  });

  const message =
    approvalState === 'auto-approved'
      ? 'Tool created and auto-approved (low-risk read-only). Ready for use.'
      : 'Tool created as draft. Requires approval before execution. Use matimo_approve_tool to promote.';

  return {
    success: true,
    path: filePath,
    riskLevel,
    status: 'draft',
    approvalState,
    message,
  };
}
