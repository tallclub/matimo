import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import {
  validateToolDefinition,
  classifyRisk,
  getTierForTool,
  ApprovalManifest,
  getGlobalMatimoLogger,
} from '@matimo/core';

interface StatusParams {
  name: string;
  tool_dir?: string;
}

interface StatusResult {
  found: boolean;
  name?: string;
  status?: string;
  riskLevel?: string;
  approvalState?: 'pending' | 'auto-approved' | 'approved' | 'rejected';
  approvedAt?: string;
  approvedBy?: string;
  message: string;
}

const UNSAFE_NAME_PATTERN = /[/\\]|\.\.|[\x00-\x1f]/;

export default async function matimoGetToolStatus(
  params: StatusParams,
  context?: { credentials?: Record<string, string> }
): Promise<StatusResult> {
  const logger = getGlobalMatimoLogger();
  const toolDir = params.tool_dir || './matimo-tools';

  if (!params.name || params.name.trim().length === 0) {
    return { found: false, message: 'Tool name is required' };
  }
  if (UNSAFE_NAME_PATTERN.test(params.name)) {
    return {
      found: false,
      message:
        'Tool name contains invalid characters (path traversal, backslash, or control characters)',
    };
  }

  const defPath = path.join(toolDir, params.name, 'definition.yaml');
  if (!fs.existsSync(defPath)) {
    logger.warn('matimo_get_tool_status: tool not found', { name: params.name, path: defPath });
    return { found: false, message: `Tool "${params.name}" not found at ${defPath}` };
  }

  const yamlContent = fs.readFileSync(defPath, 'utf-8');

  let tool;
  try {
    const parsed = yaml.load(yamlContent);
    tool = validateToolDefinition(parsed);
  } catch (err) {
    return {
      found: true,
      name: params.name,
      message: `Tool YAML is invalid: ${(err as Error).message}`,
    };
  }

  const riskLevel = classifyRisk(tool);
  const tier = getTierForTool(tool);

  // Determine approval state from manifest
  const approvalDir = path.resolve(toolDir);
  const manifest = new ApprovalManifest(approvalDir, context?.credentials?.MATIMO_APPROVAL_SECRET);

  const hash = manifest.computeHash(yamlContent);
  const approvalRecord = manifest.getApproval(params.name);
  const isApproved = approvalRecord ? manifest.isApproved(params.name, hash) : false;
  const pendingTools = manifest.getPendingTools();

  let approvalState: StatusResult['approvalState'];
  if (tool.status === 'deprecated') {
    approvalState = 'rejected';
  } else if (isApproved) {
    approvalState = 'approved';
  } else if (tier === 'auto') {
    approvalState = 'auto-approved';
  } else if (pendingTools.includes(params.name)) {
    approvalState = 'pending';
  } else {
    // Tool exists on disk but no pending record and not approved — treat as pending
    approvalState = 'pending';
  }

  logger.debug('matimo_get_tool_status: status retrieved', {
    name: params.name,
    status: tool.status,
    riskLevel,
    approvalState,
  });

  return {
    found: true,
    name: params.name,
    status: tool.status ?? 'draft',
    riskLevel,
    approvalState,
    approvedAt: approvalRecord?.approvedAt,
    approvedBy: approvalRecord?.approvedBy,
    message: `Tool "${params.name}" is ${approvalState} (${riskLevel} risk)`,
  };
}
