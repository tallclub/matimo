import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import {
  validateToolDefinition,
  validateToolContent,
  ApprovalManifest,
  getGlobalMatimoLogger,
} from '@matimo/core';
import type { Violation } from '@matimo/core';

interface ApproveParams {
  name: string;
  tool_dir?: string;
}

interface ApproveResult {
  success: boolean;
  name?: string;
  hash?: string;
  approvedAt?: string;
  message: string;
}

const UNSAFE_NAME_PATTERN = /[/\\]|\.\.|[\x00-\x1f]/;

export default async function matimoApproveTool(
  params: ApproveParams,
  context?: { credentials?: Record<string, string> }
): Promise<ApproveResult> {
  const logger = getGlobalMatimoLogger();
  const toolDir = params.tool_dir || './matimo-tools';

  if (!params.name || params.name.trim().length === 0) {
    return { success: false, message: 'Tool name is required' };
  }
  if (UNSAFE_NAME_PATTERN.test(params.name)) {
    return {
      success: false,
      message:
        'Tool name contains invalid characters (path traversal, backslash, or control characters)',
    };
  }

  // Step 1: Read tool definition
  const defPath = path.join(toolDir, params.name, 'definition.yaml');
  if (!fs.existsSync(defPath)) {
    return { success: false, message: `Tool not found: ${defPath}` };
  }

  const yamlContent = fs.readFileSync(defPath, 'utf-8');

  // Step 2: Parse and validate
  let tool;
  try {
    const parsed = yaml.load(yamlContent);
    tool = validateToolDefinition(parsed);
  } catch (err) {
    return { success: false, message: `Validation failed: ${(err as Error).message}` };
  }

  // Step 3: Re-run content validator
  const validation = validateToolContent(tool, { source: 'untrusted' });
  const criticalOrHigh = validation.violations.filter(
    (v: Violation) => v.severity === 'critical' || v.severity === 'high'
  );
  if (criticalOrHigh.length > 0) {
    return {
      success: false,
      message: 'Tool has policy violations that must be resolved before approval',
    };
  }

  // Step 4: Update status in YAML — write first, so the approval hash below is
  // computed from the file's *final* on-disk content, not the pre-mutation content.
  const parsed = yaml.load(yamlContent) as Record<string, unknown>;
  parsed.status = 'approved';
  const updatedYaml = yaml.dump(parsed);
  fs.writeFileSync(defPath, updatedYaml, 'utf-8');

  // Step 5: Approve via manifest, hashing the file's actual final content.
  // Hashing yamlContent (pre-mutation) here would make isApproved() unable to
  // ever match the tool's own post-approval file — approvals would silently
  // never validate.
  const finalContent = fs.readFileSync(defPath, 'utf-8');
  const approvalDir = path.resolve(toolDir);
  const manifest = new ApprovalManifest(approvalDir, context?.credentials?.MATIMO_APPROVAL_SECRET);

  const hash = manifest.computeHash(finalContent);
  manifest.approve(params.name, hash);
  const approval = manifest.getApproval(params.name);

  logger.info('matimo_approve_tool: tool approved', {
    name: params.name,
    hash,
  });

  return {
    success: true,
    name: params.name,
    hash,
    approvedAt: approval?.approvedAt,
    message: 'Tool approved. Effective after reload or immediately if auto-reload is active.',
  };
}
