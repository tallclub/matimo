#!/usr/bin/env node

import 'dotenv/config';
import { MatimoInstance, getGlobalApprovalHandler, type ApprovalRequest } from 'matimo';
import * as readline from 'readline';

/**
 * Microsoft Graph Tools — Human-in-the-Loop Approval Flow Example
 *
 * Demonstrates Matimo's generic HITL approval system applied to the two
 * high-risk Microsoft Graph tools:
 *   - ms_send_email             (risk: high — sends mail on the user's behalf)
 *   - ms_publish_to_sharepoint  (risk: high — publishes a page visible site-wide)
 *
 * Both are declared `requires_approval: true` in their YAML definitions, so
 * MatimoInstance.execute() routes them through the approval handler BEFORE
 * the executor (and its own input validation) ever runs.
 *
 * Approval Flow:
 * - Check MATIMO_AUTO_APPROVE=true        → approve everything automatically
 * - Check MATIMO_APPROVED_PATTERNS        → approve only matching tool-name patterns
 * - Otherwise                             → call the interactive callback below
 *
 * Setup:
 * ------
 * 1. Get a delegated Graph token (see microsoft-factory.ts header for details):
 *      export MICROSOFT_GRAPH_ACCESS_TOKEN="eyJ0eXAi...."
 *
 * 2. Run interactively (you'll be prompted to approve/reject each operation):
 *      pnpm microsoft:approval
 *
 * 3. Or auto-approve for unattended/CI runs:
 *      MATIMO_AUTO_APPROVE=true pnpm microsoft:approval
 *
 * 4. Or pre-approve just these two tools:
 *      MATIMO_APPROVED_PATTERNS="ms_send_email,ms_publish_to_sharepoint" pnpm microsoft:approval
 */

function isToolFailure(
  result: unknown
): result is { success: false; error: string; code?: string } {
  return (
    !!result &&
    typeof result === 'object' &&
    'success' in result &&
    (result as { success: unknown }).success === false
  );
}

// Interactive approval callback for high-risk Microsoft Graph operations
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR HIGH-RISK MICROSOFT GRAPH OPERATION');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);
    console.info(`📦 Params: ${JSON.stringify(request.params, null, 2)}`);

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (no terminal)');
      console.info('\n💡 To enable auto-approval in CI/scripts:');
      console.info('   export MATIMO_AUTO_APPROVE=true');
      console.info('\n💡 Or approve specific patterns:');
      console.info('   export MATIMO_APPROVED_PATTERNS="ms_send_email,ms_publish_to_sharepoint"');
      console.info('\n' + '='.repeat(70) + '\n');
      return false;
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      console.info('\n❓ User Action Required');
      rl.question('   Type "yes" to approve or "no" to reject: ', (answer) => {
        const approved = answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
        console.info(
          approved ? '   ✅ Operation APPROVED by user' : '   ❌ Operation REJECTED by user'
        );
        console.info('='.repeat(70) + '\n');
        rl.close();
        resolve(approved);
      });
    });
  };
}

async function main() {
  console.info('\n' + '='.repeat(70));
  console.info('🚀 Microsoft Graph Tools with Approval Flow');
  console.info('='.repeat(70));

  const accessToken = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('\n❌ Error: MICROSOFT_GRAPH_ACCESS_TOKEN environment variable not set');
    console.info('\n📖 Setup Instructions:');
    console.info('   1. Get a delegated Graph token via the Entra admin center or Graph Explorer:');
    console.info('      https://developer.microsoft.com/en-us/graph/graph-explorer');
    console.info('   2. Set the environment variable:');
    console.info('      export MICROSOFT_GRAPH_ACCESS_TOKEN="eyJ0eXAi...."');
    console.info('   3. Run this example again:');
    console.info('      pnpm microsoft:approval\n');
    process.exit(1);
  }

  const userEmail = process.env.TEST_EMAIL || '<signed-in-user>@example.com';
  const siteId = process.env.TEST_SITE_ID || '';

  const matimo = await MatimoInstance.init({ autoDiscover: true });

  // Configure approval handler
  const approvalHandler = getGlobalApprovalHandler();
  approvalHandler.setApprovalCallback(createApprovalCallback());

  const autoApproveEnabled = process.env.MATIMO_AUTO_APPROVE === 'true';
  const approvedPatterns = process.env.MATIMO_APPROVED_PATTERNS;

  console.info('\n🔐 APPROVAL CONFIGURATION:');
  if (autoApproveEnabled) {
    console.info('   ✅ MATIMO_AUTO_APPROVE=true');
    console.info('   → All high-risk operations will be AUTO-APPROVED');
  } else if (approvedPatterns) {
    console.info(`   ✅ MATIMO_APPROVED_PATTERNS="${approvedPatterns}"`);
    console.info('   → Matching operations will be auto-approved');
  } else {
    console.info('   ⚠️  INTERACTIVE MODE ENABLED');
    console.info('   → You will be prompted to approve each high-risk operation');
  }

  try {
    const tools = matimo.listTools().filter((t) => t.name.startsWith('ms_'));
    const highRiskTools = tools.filter((t) => t.requires_approval === true);

    console.info(`\n📋 Microsoft Graph Tools Inventory:`);
    console.info(`   Total: ${tools.length}`);
    console.info(
      `   High-risk (require approval): ${highRiskTools.length} — ${highRiskTools.map((t) => t.name).join(', ')}`
    );
    console.info(
      `   Everything else (no approval needed): ${tools.length - highRiskTools.length}\n`
    );

    // Example 1: Read-only operation — no approval needed
    console.info('═'.repeat(70));
    console.info('Example 1: Read-Only Operation (no approval gate)');
    console.info('═'.repeat(70));
    console.info('\n📖 Operation: List recent inbox messages');
    console.info('   Tool: ms_get_email   Risk: low\n');
    try {
      const result = await matimo.execute(
        'ms_get_email',
        { top: 3 },
        { credentials: { MICROSOFT_GRAPH_ACCESS_TOKEN: accessToken } }
      );
      if (isToolFailure(result)) {
        console.info(`❌ ${result.code ?? 'ERROR'}: ${result.error}\n`);
      } else {
        const { messages } = result as { messages?: unknown[] };
        console.info(
          `✅ Success — retrieved ${messages?.length ?? 0} message(s), no approval required\n`
        );
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }

    // Example 2: High-risk operation — sending an email
    console.info('═'.repeat(70));
    console.info('Example 2: High-Risk Operation — Send Email');
    console.info('═'.repeat(70));
    console.info('\n✉️  Operation: Send an email as the signed-in user');
    console.info('   Tool: ms_send_email   Risk: HIGH (requires_approval: true)\n');
    try {
      const result = await matimo.execute(
        'ms_send_email',
        {
          to: [userEmail],
          subject: 'Approval Flow Demo — Matimo Microsoft Graph Tools',
          body: 'This email was sent only after passing through the human-in-the-loop approval gate.',
        },
        { credentials: { MICROSOFT_GRAPH_ACCESS_TOKEN: accessToken } }
      );
      if (isToolFailure(result)) {
        console.info(`❌ ${result.code ?? 'ERROR'}: ${result.error}\n`);
      } else {
        const { message_id } = result as { message_id?: string };
        console.info(`✅ Success — email sent! message_id: ${message_id}\n`);
      }
    } catch (error: any) {
      // The approval handler throws MatimoError when a request is rejected
      // (or when no callback/auto-approve is configured in a non-interactive run).
      console.info(`❌ Not sent: ${error.message}\n`);
    }

    // Example 3: High-risk operation — publishing a SharePoint page
    console.info('═'.repeat(70));
    console.info('Example 3: High-Risk Operation — Publish to SharePoint');
    console.info('═'.repeat(70));
    console.info('\n📰 Operation: Create + publish a SharePoint site page');
    console.info('   Tool: ms_publish_to_sharepoint   Risk: HIGH (requires_approval: true)\n');
    if (!siteId) {
      console.info('⊘ Skipping — pass TEST_SITE_ID to try this (publishing makes the page');
      console.info("   visible to everyone with site access, so we don't guess at a site).\n");
    } else {
      try {
        const result = await matimo.execute(
          'ms_publish_to_sharepoint',
          {
            site_id: siteId,
            title: 'Matimo Approval Flow Demo',
            content:
              'This page was created and published only after passing the HITL approval gate.',
            publish: true,
          },
          { credentials: { MICROSOFT_GRAPH_ACCESS_TOKEN: accessToken } }
        );
        if (isToolFailure(result)) {
          console.info(`❌ ${result.code ?? 'ERROR'}: ${result.error}\n`);
        } else {
          const { page_id, web_url } = result as { page_id?: string; web_url?: string };
          console.info(`✅ Success — page published! page_id: ${page_id}, url: ${web_url}\n`);
        }
      } catch (error: any) {
        console.info(`❌ Not published: ${error.message}\n`);
      }
    }

    console.info('═'.repeat(70));
    console.info('📊 Approval System Summary');
    console.info('='.repeat(70));
    console.info('\n💡 How Approval Works:');
    console.info('   1. Low/medium-risk operations (search, list, get, create_calendar_event,');
    console.info('      send_teams_message, create_document) execute immediately');
    console.info('   2. High-risk operations (ms_send_email, ms_publish_to_sharepoint) are');
    console.info('      gated by requires_approval: true and pause for approval BEFORE the');
    console.info('      executor — and its own input validation — ever runs');
    console.info('   3. Approval is controlled by environment or interactive callback:');
    console.info('\n🔐 Supported Approval Modes:');
    console.info('   • MATIMO_AUTO_APPROVE=true     → Approve all high-risk operations');
    console.info('   • MATIMO_APPROVED_PATTERNS     → Approve only matching tool names');
    console.info('   • Interactive (no env vars)    → Prompt user for each operation\n');
    console.info('💡 How to Use:');
    console.info('   1. Interactive (default):     pnpm microsoft:approval');
    console.info(
      '   2. Auto-approve in CI:         MATIMO_AUTO_APPROVE=true pnpm microsoft:approval'
    );
    console.info(
      '   3. Pre-approved patterns:      MATIMO_APPROVED_PATTERNS="ms_send_email,ms_publish_to_sharepoint" pnpm microsoft:approval\n'
    );
    console.info('='.repeat(70) + '\n');
  } catch (error: any) {
    console.error('\n❌ Fatal Error:', error.message);
    if (error.details) console.error('Details:', JSON.stringify(error.details, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
