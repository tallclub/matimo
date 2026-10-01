import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import {
  validateToolDefinition,
  validateToolContent,
  ApprovalManifest,
  getGlobalMatimoLogger,
  getGlobalMatimoInstance,
} from '@matimo/core';
import type { Violation, FunctionToolContext } from '@matimo/core';

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
  context?: FunctionToolContext
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

  // When the host identifies the caller, only an admin may approve. The policy
  // context comes from the host (execute(..., { context }) or the MCP server's
  // `context` option), never from the agent, so an agent cannot grant itself
  // the role. Without any context, the human who must confirm this call
  // (requires_approval, which nothing can pre-approve) is the approver.
  const caller = context?.policyContext;
  if (caller && !caller.roles?.includes('admin')) {
    return {
      success: false,
      message:
        "Approving a tool requires the admin role. The host grants it with execute(..., { context: { roles: ['admin'] } }) or the MCP server's context option.",
    };
  }

  // Step 1: Read tool definition
  const defPath = path.join(toolDir, params.name, 'definition.yaml');
  if (!fs.existsSync(defPath)) {
    return { success: false, message: `Tool not found: ${defPath}` };
  }

  const yamlContent = fs.readFileSync(defPath, 'utf-8');

  // An agent may not approve a tool it created itself (matimo_create_tool
  // records the creating agent as created_by).
  const createdBy = (yaml.load(yamlContent) as Record<string, unknown> | null)?.created_by;
  if (
    typeof createdBy === 'string' &&
    caller?.agentId !== undefined &&
    createdBy === caller.agentId
  ) {
    return {
      success: false,
      message: `Tool "${params.name}" was created by ${createdBy}; someone other than its creator must approve it.`,
    };
  }

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
  const manifest =
    ownerApprovalManifest() ??
    new ApprovalManifest(path.resolve(toolDir), context?.credentials?.MATIMO_APPROVAL_SECRET);

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

/**
 * The approval manifest of the instance that owns this call. Recording the
 * approval there means the instance's next reload sees it, signed with the
 * same secret and stored where that instance looks; a manifest of our own
 * would sign with a different ephemeral secret when none is configured.
 */
function ownerApprovalManifest(): ApprovalManifest | null {
  try {
    return getGlobalMatimoInstance().getApprovalManifest();
  } catch {
    return null;
  }
}
