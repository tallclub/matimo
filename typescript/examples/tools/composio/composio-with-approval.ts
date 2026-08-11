#!/usr/bin/env node
/**
 * ============================================================================
 * @matimo/composio — Human-in-the-Loop (HITL) Approval Example
 * ============================================================================
 *
 * PATTERN: Risk-aware custom PolicyEngine + onHITL callback
 * ─────────────────────────────────────────────────────────────────────────
 * This example shows how to enforce human approval for medium- and high-risk
 * Composio tools before they execute. It demonstrates the governance story
 * that makes @matimo/composio more than a thin Composio proxy.
 *
 * WHY A CUSTOM POLICY ENGINE?
 * ─────────────────────────────────────────────────────────────────────────
 * Matimo's DefaultPolicyEngine.canExecute() does not gate on the `risk:`
 * field — it only checks deprecation/draft status and requires_approval +
 * role. Since generated composio tools do not set `requires_approval: true`,
 * medium/high-risk tools (create, delete) execute immediately by default.
 *
 * To quarantine those tools, supply a custom PolicyEngine whose canExecute()
 * checks classifyRisk() and returns { allowed: 'pending_approval' } for
 * unacceptable risk levels. Matimo's execute() then invokes onHITL before
 * proceeding — wiring it to an interactive prompt, a Slack message, an
 * approval queue, or any async mechanism you choose.
 *
 * WHAT THIS EXAMPLE SHOWS:
 * ─────────────────────────────────────────────────────────────────────────
 * • composio_jira_get_current_user (risk: low)  → executes immediately
 * • composio_jira_create_issue     (risk: medium) → pauses for approval
 * • composio_jira_delete_issue     (risk: high)   → pauses for approval
 * • composio_gmail_get_profile     (risk: low)    → executes immediately
 * • composio_gmail_send_email      (risk: medium) → pauses for approval
 * • composio_gmail_delete_message  (risk: high)   → pauses for approval
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Set in .env:
 *    COMPOSIO_API_KEY=...
 *    COMPOSIO_USER_ID=...
 *    JIRA_CONNECTED_ACCOUNT_ID=ca_...   (optional, enables the Jira demo)
 *    GMAIL_CONNECTED_ACCOUNT_ID=ca_...  (optional, enables the Gmail demo)
 *
 * 2. Run interactively (prompted for each write/delete):
 *    pnpm composio:approval
 *
 * 3. Or auto-approve for CI / scripts:
 *    MATIMO_AUTO_APPROVE=true pnpm composio:approval
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import {
  MatimoInstance,
  DefaultPolicyEngine,
  classifyRisk,
  type PolicyEngine,
  type PolicyContext,
  type PolicyDecision,
  type ToolDefinition,
  type HITLCallback,
  type RiskLevel,
} from '@matimo/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.join(__dirname, '../../../packages/composio/tools');

// Risk levels that require human approval before execution.
// Adjust this threshold to match your governance requirements.
const QUARANTINE_LEVELS: ReadonlySet<RiskLevel> = new Set(['medium', 'high']);

/**
 * Risk-aware PolicyEngine for composio tools.
 *
 * Delegates all checks to DefaultPolicyEngine (deprecation, draft status,
 * requires_approval + role) and then additionally quarantines any tool whose
 * classifyRisk() result is in QUARANTINE_LEVELS.
 */
class ComposioRiskPolicyEngine implements PolicyEngine {
  private readonly base: DefaultPolicyEngine;

  constructor() {
    this.base = new DefaultPolicyEngine();
  }

  canExecute(context: PolicyContext, tool: ToolDefinition): PolicyDecision {
    // Run standard checks first (deprecated, draft, requires_approval + role).
    const base = this.base.canExecute(context, tool);
    if (base.allowed !== true) return base;

    // For composio tools, additionally quarantine by risk level.
    if (tool.name.startsWith('composio_')) {
      const risk = classifyRisk(tool);
      if (QUARANTINE_LEVELS.has(risk)) {
        return {
          allowed: 'pending_approval',
          riskLevel: risk,
          reason: `composio tool "${tool.name}" (risk: ${risk}) requires human approval before execution`,
          toolName: tool.name,
        };
      }
    }

    return { allowed: true };
  }

  canCreate(context: PolicyContext, tool: ToolDefinition): PolicyDecision {
    return this.base.canCreate(context, tool);
  }

  filterForAgent(context: PolicyContext, tools: ToolDefinition[]): ToolDefinition[] {
    return this.base.filterForAgent(context, tools);
  }
}

function createApprovalCallback(): HITLCallback {
  const autoApprove = process.env.MATIMO_AUTO_APPROVE === 'true';

  return async (request): Promise<boolean> => {
    const riskEmoji = request.riskLevel === 'high' ? '🔴' : '🟡';

    console.info('\n' + '='.repeat(70));
    console.info(
      `${riskEmoji} APPROVAL REQUIRED — ${request.riskLevel.toUpperCase()} RISK COMPOSIO TOOL`
    );
    console.info('='.repeat(70));
    console.info(`\n🔧 Tool:   ${request.toolName}`);
    console.info(`⚡ Risk:   ${request.riskLevel}`);
    console.info(`📝 Reason: ${request.reason}`);

    if (autoApprove) {
      console.info('\n✅ Auto-approved (MATIMO_AUTO_APPROVE=true)');
      console.info('='.repeat(70) + '\n');
      return true;
    }

    if (!process.stdin.isTTY) {
      console.info('\n❌ Rejected — non-interactive terminal');
      console.info('💡 Set MATIMO_AUTO_APPROVE=true for unattended runs');
      console.info('='.repeat(70) + '\n');
      return false;
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question('\n❓ Approve this operation? (yes/no): ', (answer) => {
        const approved =
          answer.trim().toLowerCase() === 'yes' || answer.trim().toLowerCase() === 'y';
        console.info(approved ? '✅ Approved' : '❌ Rejected');
        console.info('='.repeat(70) + '\n');
        rl.close();
        resolve(approved);
      });
    });
  };
}

async function main(): Promise<void> {
  const userId = process.env.COMPOSIO_USER_ID || '';
  const jiraAccountId = process.env.JIRA_CONNECTED_ACCOUNT_ID || '';
  const gmailAccountId = process.env.GMAIL_CONNECTED_ACCOUNT_ID || '';
  const gmailTestRecipient = process.env.GMAIL_TEST_RECIPIENT_EMAIL || 'test@example.com';

  if (!process.env.COMPOSIO_API_KEY || !userId) {
    console.error('\n❌ COMPOSIO_API_KEY and COMPOSIO_USER_ID are required');
    process.exit(1);
  }

  console.info('\n' + '='.repeat(70));
  console.info('🔒 @matimo/composio — HITL Approval Flow');
  console.info('='.repeat(70));
  console.info('\nRisk policy:');
  console.info('  • risk: low    → executes immediately');
  console.info('  • risk: medium → pauses for human approval');
  console.info('  • risk: high   → pauses for human approval');

  const matimo = await MatimoInstance.init({
    toolPaths: [TOOLS_DIR],
    policy: new ComposioRiskPolicyEngine(),
    onHITL: createApprovalCallback(),
  });

  if (!jiraAccountId) {
    console.error(
      '\n⚠️  JIRA_CONNECTED_ACCOUNT_ID not set — using dummy values to demonstrate policy flow'
    );
  }

  const creds = {
    composio_user_id: userId,
    composio_connected_account_id: jiraAccountId || 'ca_not_connected',
  };

  // ── 1. Low-risk tool: executes immediately, no prompt ─────────────────────
  console.info('\n─── 1. Low-risk: composio_jira_get_current_user ─────────────────');
  try {
    const result = await matimo.execute('composio_jira_get_current_user', creds);
    console.info('✅ Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.info('⚠️  Error (expected if Jira is not connected):', (err as Error).message);
  }

  // ── 2. Medium-risk tool: paused until approved ────────────────────────────
  console.info('\n─── 2. Medium-risk: composio_jira_create_issue ──────────────────');
  try {
    const result = await matimo.execute('composio_jira_create_issue', {
      ...creds,
      project_key: 'TEST',
      summary: 'Investigate flaky integration test',
      issue_type: 'Task',
    });
    console.info('✅ Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('rejected') || msg.includes('denied')) {
      console.info('⛔ Tool execution rejected by approver — no issue created');
    } else {
      console.info('⚠️  Error:', msg);
    }
  }

  // ── 3. High-risk tool: paused until approved ──────────────────────────────
  console.info('\n─── 3. High-risk: composio_jira_delete_issue ────────────────────');
  try {
    const result = await matimo.execute('composio_jira_delete_issue', {
      ...creds,
      issue_id_or_key: 'TEST-999',
    });
    console.info('✅ Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('rejected') || msg.includes('denied')) {
      console.info('⛔ Tool execution rejected by approver — no issue deleted');
    } else {
      console.info('⚠️  Error:', msg);
    }
  }

  // ── Gmail: same three-tier risk demo, different toolkit ────────────────────
  if (!gmailAccountId) {
    console.error(
      '\n⚠️  GMAIL_CONNECTED_ACCOUNT_ID not set — using dummy values to demonstrate policy flow'
    );
  }

  const gmailCreds = {
    composio_user_id: userId,
    composio_connected_account_id: gmailAccountId || 'ca_not_connected',
  };

  // ── 4. Low-risk tool: executes immediately, no prompt ─────────────────────
  console.info('\n─── 4. Low-risk: composio_gmail_get_profile ──────────────────────');
  try {
    const result = await matimo.execute('composio_gmail_get_profile', gmailCreds);
    console.info('✅ Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.info('⚠️  Error (expected if Gmail is not connected):', (err as Error).message);
  }

  // ── 5. Medium-risk tool: paused until approved ────────────────────────────
  console.info('\n─── 5. Medium-risk: composio_gmail_send_email ────────────────────');
  try {
    const result = await matimo.execute('composio_gmail_send_email', {
      ...gmailCreds,
      recipient_email: gmailTestRecipient,
      subject: 'Matimo composio HITL demo',
      body: "Sent via composio_gmail_send_email through Matimo's HITL approval flow.",
    });
    console.info('✅ Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('rejected') || msg.includes('denied')) {
      console.info('⛔ Tool execution rejected by approver — no email sent');
    } else {
      console.info('⚠️  Error:', msg);
    }
  }

  // ── 6. High-risk tool: paused until approved ──────────────────────────────
  console.info('\n─── 6. High-risk: composio_gmail_delete_message ──────────────────');
  try {
    const result = await matimo.execute('composio_gmail_delete_message', {
      ...gmailCreds,
      message_id: 'test_message_id_placeholder',
    });
    console.info('✅ Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('rejected') || msg.includes('denied')) {
      console.info('⛔ Tool execution rejected by approver — no message deleted');
    } else {
      console.info('⚠️  Error:', msg);
    }
  }

  console.info('\n' + '='.repeat(70));
  console.info('✅ Done — governance policy enforced at execute() time');
  console.info('='.repeat(70) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
