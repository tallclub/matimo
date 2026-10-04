/**
 * ============================================================================
 * APPROVAL MODES — who decides, and when a call must ask
 * ============================================================================
 *
 * A call needs a human's approval when its tool declares
 * `requires_approval: true`, when it is an HTTP DELETE or `type: command`
 * tool that does not declare `requires_approval: false` (the 0.2.0 secure
 * default), or when its `sql`/`command` contains a destructive keyword.
 *
 * Who decides, in order: `execute(..., { onApproval })` for one call, then
 * the instance's `onApproval`, then the process-wide handler. With none of
 * them, the call is rejected. Tools matched by MATIMO_APPROVED_PATTERNS skip
 * the question.
 *
 * Separately, `enableHITL` quarantines every call whose risk is at or above
 * `hitlMinRiskLevel` until `onHITL` approves it, and function tools receive
 * the caller's policy context.
 *
 * No API keys needed. The DELETE calls go to the JSONPlaceholder test API,
 * which only pretends to delete.
 *
 * Run: pnpm policy:approval-modes
 * ============================================================================
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  MatimoInstance,
  definitionRequiresApproval,
  type ApprovalRequest,
  type HITLRequest,
  type MatimoEvent,
} from '@matimo/core';

const TOOLS: Record<string, string> = {
  'shell_echo/definition.yaml': `name: shell_echo
version: '1.0.0'
description: Print a greeting with the shell's echo command
execution:
  type: command
  command: echo
  args: ['hello from a command tool']
`,
  'delete_post/definition.yaml': `name: delete_post
version: '1.0.0'
description: Delete a post (JSONPlaceholder only pretends to)
execution:
  type: http
  method: DELETE
  url: 'https://jsonplaceholder.typicode.com/posts/1'
`,
  'delete_draft/definition.yaml': `name: delete_draft
version: '1.0.0'
description: Delete a scratch draft; opted out of per-call approval
requires_approval: false
execution:
  type: http
  method: DELETE
  url: 'https://jsonplaceholder.typicode.com/posts/2'
`,
  'get_post/definition.yaml': `name: get_post
version: '1.0.0'
description: Fetch one post
execution:
  type: http
  method: GET
  url: 'https://jsonplaceholder.typicode.com/posts/1'
`,
  'whoami/definition.yaml': `name: whoami
version: '1.0.0'
description: Report which agent is calling
risk: low
execution:
  type: function
  code: './whoami.js'
`,
  // A function tool's second argument carries the caller's policy context.
  'whoami/whoami.js': `export default async function whoami(params, context) {
  return { agentId: context?.policyContext?.agentId ?? null, roles: context?.policyContext?.roles ?? [] };
}
`,
};

const approve = (label: string) => async (request: ApprovalRequest) => {
  console.info(`   🔒 ${label} approves ${request.toolName}`);
  return true;
};
const decline = (label: string) => async (request: ApprovalRequest) => {
  console.info(`   🔒 ${label} declines ${request.toolName}`);
  return false;
};

async function attempt(matimo: MatimoInstance, tool: string, options = {}): Promise<void> {
  try {
    await matimo.execute(tool, {}, options);
    console.info(`   ✅ ${tool} ran`);
  } catch (error) {
    console.info(`   ⛔ ${tool}: ${error instanceof Error ? error.message : error}`);
  }
}

async function main(): Promise<void> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-approval-'));
  const toolsDir = path.join(workDir, 'tools');
  for (const [file, content] of Object.entries(TOOLS)) {
    fs.mkdirSync(path.dirname(path.join(toolsDir, file)), { recursive: true });
    fs.writeFileSync(path.join(toolsDir, file), content);
  }
  const base = { toolPaths: [toolsDir], logLevel: 'silent' as const, approvalDir: workDir };

  try {
    console.info('\n1. Which tools ask on every call?');
    const probe = await MatimoInstance.init(base);
    for (const tool of probe.listTools()) {
      console.info(
        `   ${tool.name.padEnd(13)} secure=${definitionRequiresApproval(tool, 'secure')}` +
          `  legacy=${definitionRequiresApproval(tool, 'legacy')}`
      );
    }

    console.info(`\n2. Secure mode (${probe.getGovernanceMode()}) with no approval callback`);
    await attempt(probe, 'shell_echo');

    console.info('\n3. An instance onApproval callback decides');
    const secure = await MatimoInstance.init({ ...base, onApproval: approve('instance callback') });
    await attempt(secure, 'shell_echo');
    await attempt(secure, 'delete_post');

    console.info('\n4. A per-call onApproval overrides the instance callback');
    await attempt(secure, 'delete_post', { onApproval: decline('per-call callback') });

    console.info('\n5. requires_approval: false opts a DELETE tool out');
    await attempt(probe, 'delete_draft');

    console.info("\n6. governanceMode: 'legacy' restores the pre-0.2.0 default");
    const legacy = await MatimoInstance.init({ ...base, governanceMode: 'legacy' });
    console.info(`   mode: ${legacy.getGovernanceMode()}`);
    await attempt(legacy, 'shell_echo');

    console.info('\n7. HITL quarantine for calls at or above hitlMinRiskLevel: high');
    const quarantined = await MatimoInstance.init({
      ...base,
      policyConfig: { enableHITL: true, hitlMinRiskLevel: 'high' },
      onHITL: async (request: HITLRequest) => {
        console.info(`   🛑 onHITL: ${request.toolName} (${request.riskLevel}) — approved`);
        return true;
      },
      onApproval: approve('instance callback'),
      onEvent: (event: MatimoEvent) => console.info(`   📣 ${event.type}`),
    });
    await attempt(quarantined, 'get_post');
    await attempt(quarantined, 'delete_post');

    console.info("\n8. Function tools receive the caller's policy context");
    const result = await probe.execute(
      'whoami',
      {},
      { context: { agentId: 'agent-7', roles: ['analyst'] } }
    );
    console.info(`   whoami → ${JSON.stringify(result)}`);
    console.info('');
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
