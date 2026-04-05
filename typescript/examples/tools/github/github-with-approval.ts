#!/usr/bin/env node

import 'dotenv/config';
import { MatimoInstance, getGlobalApprovalHandler, type ApprovalRequest } from '@matimo/core';
import * as readline from 'readline';

/**
 * GitHub Tool Example with Destructive Operation Approval Flow
 *
 * This example demonstrates the NEW GENERIC approval system:
 * 1. Loading GitHub tools via Matimo
 * 2. Executing read-only operations (no approval needed)
 * 3. Attempting destructive operations (requires approval)
 * 4. Human-in-the-loop approval with interactive callback
 *
 * NEW Approval Flow (Generic for ALL tools):
 * - Tool contains destructive keywords (CREATE, DELETE, DROP, UPDATE, MERGE, etc.)
 * - Check MATIMO_AUTO_APPROVE=true (auto-approve all)
 * - Check MATIMO_APPROVED_PATTERNS (pre-approved patterns)
 * - Or call single generic approval callback for interactive approval
 *
 * Setup:
 * ------
 * 1. Create a GitHub Personal Access Token: https://github.com/settings/tokens
 *    export GITHUB_TOKEN=\"ghp_xxxx...\"
 *
 * 2. Run the example (interactive mode - you'll be prompted):
 *    pnpm github-with-approval
 *
 * 3. Or auto-approve in CI:
 *    export MATIMO_AUTO_APPROVE=true && pnpm github-with-approval
 */

// Interactive approval callback for GitHub operations
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR DESTRUCTIVE GITHUB OPERATION');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (no terminal)');
      console.info('\n💡 To enable auto-approval in CI/scripts:');
      console.info('   export MATIMO_AUTO_APPROVE=true');
      console.info('\n💡 Or approve specific patterns:');
      console.info('   export MATIMO_APPROVED_PATTERNS="github-*"');
      console.info('\n' + '='.repeat(70) + '\n');
      return false;
    }

    // Interactive mode: prompt user
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      console.info('\n❓ User Action Required');
      const question = '   Type "yes" to approve or "no" to reject: ';

      rl.question(question, (answer) => {
        const approved = answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';

        if (approved) {
          console.info('   ✅ Operation APPROVED by user');
        } else {
          console.info('   ❌ Operation REJECTED by user');
        }
        console.info('='.repeat(70) + '\n');

        rl.close();
        resolve(approved);
      });
    });
  };
}

async function main() {
  console.info('\n' + '='.repeat(70));
  console.info('🚀 GitHub Tools with Approval Flow');
  console.info('='.repeat(70));

  // Check for GitHub token
  if (!process.env.GITHUB_TOKEN) {
    console.error('\n❌ Error: GITHUB_TOKEN environment variable not set');
    console.info('\n📖 Setup Instructions:');
    console.info('   1. Create a GitHub Personal Access Token:');
    console.info('      https://github.com/settings/tokens');
    console.info('   2. Set the environment variable:');
    console.info('      export GITHUB_TOKEN="ghp_xxxx..."');
    console.info('   3. Run this example again:');
    console.info('      pnpm github-with-approval\n');
    process.exit(1);
  }

  // Initialize Matimo with GitHub tools
  const matimo = await MatimoInstance.init({
    autoDiscover: true,
  });

  // Configure approval handler
  const approvalHandler = getGlobalApprovalHandler();
  approvalHandler.setApprovalCallback(createApprovalCallback());

  // Show current approval mode
  const autoApproveEnabled = process.env.MATIMO_AUTO_APPROVE === 'true';
  const approvedPatterns = process.env.MATIMO_APPROVED_PATTERNS;

  console.info('\n🔐 APPROVAL CONFIGURATION:');
  if (autoApproveEnabled) {
    console.info('   ✅ MATIMO_AUTO_APPROVE=true');
    console.info('   → All destructive operations will be AUTO-APPROVED');
  } else if (approvedPatterns) {
    console.info(`   ✅ MATIMO_APPROVED_PATTERNS="${approvedPatterns}"`);
    console.info('   → Matching operations will be auto-approved');
  } else {
    console.info('   ⚠️  INTERACTIVE MODE ENABLED');
    console.info('   → You will be prompted to approve destructive operations');
  }

  try {
    // List available tools
    const tools = matimo.listTools();
    const githubTools = tools.filter((t) => t.name.startsWith('github-'));

    // Destructive operations that require approval
    const destructivePatterns = ['create-', 'delete-', 'merge-', 'update-', 'add-'];
    const destructiveTools = githubTools.filter((t) =>
      destructivePatterns.some((pattern) => t.name.includes(pattern))
    );

    console.info(`\n📋 GitHub Tools Inventory:`);
    console.info(`   Total: ${githubTools.length}`);
    console.info(`   Destructive (require approval): ${destructiveTools.length}`);
    console.info(
      `   Read-only (no approval needed): ${githubTools.length - destructiveTools.length}\n`
    );

    console.info('📊 Sample Destructive Operations:');
    destructiveTools.slice(0, 5).forEach((tool) => {
      console.info(`   - ${tool.name}`);
    });
    if (destructiveTools.length > 5) {
      console.info(`   ... and ${destructiveTools.length - 5} more\n`);
    }

    // Example 1: Read-only operation (no approval needed)
    console.info('═'.repeat(70));
    console.info('Example 1: Read-Only Operation');
    console.info('═'.repeat(70));
    console.info('\n📖 Operation: Search repositories (no approval needed)');
    console.info('   Tool: github-search-repositories');
    console.info('   Type: Read-only\n');
    try {
      const searchResults = await matimo.execute('github-search-repositories', {
        query: 'language:typescript fork:false stars:>100',
      });
      const data = (searchResults as any).data || searchResults;
      console.info(`✅ Success: Found ${data?.total_count} repositories\n`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}\n`);
    }

    // Example 2: Read-only operation (no approval needed)
    console.info('═'.repeat(60));
    console.info('Example 2: Get Repository Details');
    console.info('═'.repeat(60));
    console.info('\n📖 Operation: Get repository details (no approval needed)');
    console.info('   Tool: github-get-repository\n');
    try {
      const repo = await matimo.execute('github-get-repository', {
        owner: 'kubernetes',
        repo: 'kubernetes',
      });
      const data = (repo as any).data || repo;
      console.info(`✅ Success: Retrieved repo details for ${data?.full_name}\n`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}\n`);
    }
    // Add more examples for destructive operations here (they will require approval).
    console.info('═'.repeat(70));
    console.info('📊 Approval System Summary');
    console.info('═'.repeat(70));
    console.info('\n💡 How Approval Works:');
    console.info('   1. Read-only operations (list, get, search) execute immediately');
    console.info('   2. Destructive operations (create, delete, merge, update, add)');
    console.info('      are detected and require approval before execution');
    console.info('   3. Approval is controlled by environment or interactive callback:');

    console.info('\n🔐 Supported Approval Modes:');
    console.info('   • MATIMO_AUTO_APPROVE=true     → Approve all destructive operations');
    console.info(
      '   • MATIMO_APPROVED_PATTERNS     → Approve only matching tool names (glob pattern)'
    );
    console.info('   • Interactive (no env vars)    → Prompt user for each operation');

    console.info('\n💡 How to Use:');
    console.info('   1. Interactive (default):     pnpm github-with-approval');
    console.info(
      '   2. Auto-approve in CI:         MATIMO_AUTO_APPROVE=true pnpm github-with-approval'
    );
    console.info(
      '   3. Pre-approved patterns:      MATIMO_APPROVED_PATTERNS="github-*" pnpm github-with-approval'
    );

    console.info('\n✅ Read-Only Examples Completed Successfully!');
    console.info('\nNote: Destructive operations in tests are only read-only GitHub operations.');
    console.info(
      '      To test destructive approvals, you would need creation/deletion permissions.\n'
    );
    console.info('='.repeat(70) + '\n');
  } catch (error: any) {
    console.error('\n❌ Fatal Error:', error.message);
    if (error.details) {
      console.error('Details:', JSON.stringify(error.details, null, 2));
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
