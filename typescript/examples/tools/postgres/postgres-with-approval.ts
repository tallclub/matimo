/**
 * Postgres Tool Example with Real Database and Approval Flow
 *
 * This example demonstrates:
 * 1. Connecting to a real Postgres database
 * 2. Executing non-destructive queries (SELECT) - no approval needed
 * 3. Executing destructive queries - approval required and handled
 * 4. Setting up a single generic approval callback
 *
 * Approval Flow (Generic for ALL tools):
 * - Tool declares requires_approval in YAML OR contains destructive keywords
 * - Check MATIMO_AUTO_APPROVE=true (approve all)
 * - Check MATIMO_APPROVED_PATTERNS="pattern*" (pre-approved patterns)
 * - Call single approval callback for user/policy approval
 * - No per-tool, per-provider custom logic needed
 *
 * Setup Instructions:
 * 1. Make sure you have a Postgres instance running locally or accessible
 * 2. Set the connection string via environment variable:
 *    export MATIMO_POSTGRES_URL="postgresql://user:password@localhost:5432/dbname"
 *    OR set individual components:
 *    export MATIMO_POSTGRES_HOST="localhost"
 *    export MATIMO_POSTGRES_PORT="5432"
 *    export MATIMO_POSTGRES_USER="user"
 *    export MATIMO_POSTGRES_PASSWORD="password"
 *    export MATIMO_POSTGRES_DB="dbname"
 *
 * 3. Run the example:
 *    pnpm postgres:approval
 */

import 'dotenv/config';
import { MatimoInstance, getGlobalApprovalHandler, type ApprovalRequest } from '@matimo/core';
import * as readline from 'readline';

// Interactive approval callback - prompts user when MATIMO_AUTO_APPROVE is not set
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR DESTRUCTIVE OPERATION');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);

    // Show SQL content if available
    if (request.params && typeof request.params.sql === 'string') {
      console.info(`\n📄 SQL to execute:`);
      console.info('   ' + request.params.sql.split('\n').join('\n   '));
    }

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (no terminal)');
      console.info('\n💡 To enable auto-approval in CI/scripts:');
      console.info('   export MATIMO_AUTO_APPROVE=true');
      console.info('\n💡 Or approve specific patterns:');
      console.info('   export MATIMO_APPROVED_PATTERNS="postgres-execute-sql"');
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
  // Check if database connection is available
  if (
    !process.env.MATIMO_POSTGRES_URL &&
    (!process.env.MATIMO_POSTGRES_HOST ||
      !process.env.MATIMO_POSTGRES_USER ||
      !process.env.MATIMO_POSTGRES_PASSWORD ||
      !process.env.MATIMO_POSTGRES_DB)
  ) {
    console.error('❌ Database connection not configured.');
    console.error('Please set one of:');
    console.error('  - MATIMO_POSTGRES_URL="postgresql://user:password@host:port/db"');
    console.error(
      '  - MATIMO_POSTGRES_HOST, MATIMO_POSTGRES_PORT, MATIMO_POSTGRES_USER, MATIMO_POSTGRES_PASSWORD, MATIMO_POSTGRES_DB'
    );
    process.exit(1);
  }

  // Initialize Matimo with postgres tools
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  console.info('\n' + '='.repeat(70));
  console.info('🚀 Postgres Tool Example with Approval Flow');
  console.info('='.repeat(70));

  // Configure centralized approval handler
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
    console.info('   → Type "yes" or "no" when prompted');
  }

  try {
    // 1. List available tools
    const tools = matimo.listTools();
    const postgresTools = tools.filter((t) => t.name.startsWith('postgres'));
    console.info(`\n📋 Available Postgres tools: ${postgresTools.map((t) => t.name).join(', ')}`);

    // Sequential discovery workflow

    // STEP 1: Discover tables (SELECT - no approval needed)
    console.info('\n\n1️⃣  DISCOVER TABLES (Step 1/3 - No approval needed)');
    console.info('-'.repeat(70));

    let discoveredTables: string[] = [];
    try {
      console.info('Executing: SELECT table_name FROM information_schema.tables...');
      console.info('(This is a SELECT - no approval will be requested)\n');
      const tablesResult = await matimo.execute('postgres-execute-sql', {
        sql: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `,
      });
      if (
        tablesResult &&
        typeof tablesResult === 'object' &&
        'success' in tablesResult &&
        (tablesResult as any).success === false
      ) {
        throw new Error((tablesResult as any).error || 'Query failed');
      }
      console.info('✅ Query executed successfully (no approval required for SELECT)');
      if (tablesResult && typeof tablesResult === 'object' && 'rows' in tablesResult) {
        const rows = (tablesResult as any).rows;
        if (rows && rows.length > 0) {
          console.info('Tables found:');
          rows.forEach((row: any) => {
            console.info(`   - ${row.table_name}`);
            discoveredTables.push(row.table_name);
          });
        } else {
          console.info('(No tables found in public schema)');
        }
      } else {
        console.info('(No tables found in public schema)');
      }
    } catch (err: any) {
      console.error('❌ Error:', err.message);
    }

    // STEP 2: Get row counts (SELECT - no approval needed)
    console.info('\n\n2️⃣  COUNT RECORDS (Step 2/3 - No approval needed)');
    console.info('-'.repeat(60));
    console.info('SQL: SELECT tablename, n_live_tup FROM pg_stat_user_tables\n');

    try {
      const countsResult = await matimo.execute('postgres-execute-sql', {
        sql: `
          SELECT 
            table_name,
            (SELECT count(*) FROM information_schema.columns 
             WHERE information_schema.columns.table_name = t.table_name) as columns
          FROM information_schema.tables t
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `,
      });
      if (
        countsResult &&
        typeof countsResult === 'object' &&
        'success' in countsResult &&
        (countsResult as any).success === false
      ) {
        throw new Error((countsResult as any).error || 'Query failed');
      }
      console.info('✅ Query executed successfully (no approval needed for SELECT)');
      if (countsResult && typeof countsResult === 'object' && 'rows' in countsResult) {
        const rows = (countsResult as any).rows;
        if (rows && rows.length > 0) {
          console.info('Tables found:');
          rows.forEach((row: any) => {
            console.info(`   - ${row.table_name} (${row.columns} columns)`);
          });
        } else {
          console.info('(No tables found in public schema)');
        }
      } else {
        console.info('(No tables found in public schema)');
      }
    } catch (err: any) {
      console.error('❌ Error:', err.message);
    }

    // STEP 3: Try a destructive operation that requires approval
    console.info('\n\n3️⃣  DESTRUCTIVE OPERATION (Step 3/3 - Requires approval)');
    console.info('-'.repeat(70));
    console.info('Attempting DELETE operation - this WILL trigger approval...\n');

    if (discoveredTables.length > 0) {
      const tableName = discoveredTables[0];
      const deleteSql = `DELETE FROM ${tableName} WHERE 1=0;`;
      console.info(`📄 SQL Query: ${deleteSql}`);
      console.info('⚠️  NOTE: This is a DESTRUCTIVE operation (DELETE keyword detected)');
      console.info('⚠️  NOTE: WHERE 1=0 matches no rows, so it is SAFE\n');

      if (autoApproveEnabled) {
        console.info('ℹ️  MATIMO_AUTO_APPROVE=true → Will auto-approve this operation\n');
      } else if (approvedPatterns) {
        console.info(`ℹ️  MATIMO_APPROVED_PATTERNS set → Checking pattern matching...\n`);
      } else {
        console.info('ℹ️  INTERACTIVE MODE → You will be prompted to approve/reject\n');
      }

      try {
        // Safe DELETE that matches no rows (WHERE 1=0)
        const deleteResult = await matimo.execute('postgres-execute-sql', {
          sql: deleteSql,
        });

        // Check if operation was rejected by user approval
        if (
          deleteResult &&
          typeof deleteResult === 'object' &&
          'approved' in deleteResult &&
          (deleteResult as any).approved === false
        ) {
          console.info('\n⚠️  DELETE was REJECTED by user approval');
          console.info(`   Reason: ${(deleteResult as any).reason}`);
          console.info('   The operation was cancelled due to approval denial\n');
        } else {
          console.info('\n✅ DELETE APPROVED AND EXECUTED');
          console.info('   Operation was approved (or auto-approved)');
          console.info('   (0 rows deleted - safe WHERE clause)\n');
        }
      } catch (err: any) {
        const errorMsg = err?.message || String(err);

        if (
          errorMsg.includes('Operation rejected') ||
          errorMsg.includes('not approved') ||
          errorMsg.includes('User or policy rejected')
        ) {
          console.info('\n⚠️  DELETE was REJECTED by user');
          console.info(`   Reason: ${errorMsg}`);
          console.info('   You chose to reject this destructive operation\n');
        } else if (errorMsg.includes('approval') && errorMsg.includes('required')) {
          console.info('\n⚠️  DELETE REQUIRES APPROVAL');
          console.info(`   Error: ${errorMsg}`);
          console.info('   Set MATIMO_AUTO_APPROVE=true to auto-approve, or run interactively\n');
        } else {
          console.error(`\n❌ Unexpected error: ${errorMsg}\n`);
        }
      }
    } else {
      console.info('\n⚠️  No tables found to demonstrate destructive operation');
      console.info('   (Would require approval when attempting DELETE/UPDATE/CREATE/DROP/ALTER)\n');
    }

    // STEP 4: Show approval configuration and summary
    console.info('\n\n4️⃣  APPROVAL SYSTEM SUMMARY');
    console.info('='.repeat(70));

    console.info('\n📋 Current Settings:');
    if (autoApproveEnabled) {
      console.info('   ✅ MATIMO_AUTO_APPROVE=true → All destructive ops AUTO-APPROVED');
    } else if (approvedPatterns) {
      console.info(`   ✅ MATIMO_APPROVED_PATTERNS="${approvedPatterns}"`);
      console.info('   → Matching patterns AUTO-APPROVED, others require user input');
    } else {
      console.info('   ⚠️  Interactive Mode (RECOMMENDED FOR HUMANS)');
      console.info('   → All destructive operations require your "yes/no" input');
    }

    console.info('\n💡 How to Use:');
    console.info('   1. Interactive (default):     pnpm postgres:approval');
    console.info(
      '   2. Auto-approve in CI:         MATIMO_AUTO_APPROVE=true pnpm postgres:approval'
    );
    console.info(
      '   3. Pre-approved patterns:      MATIMO_APPROVED_PATTERNS="postgres*" pnpm postgres:approval'
    );

    console.info('\n🔐 Supported Approval Modes:');
    console.info('   • MATIMO_AUTO_APPROVE=true     → Approve all destructive operations');
    console.info(
      '   • MATIMO_APPROVED_PATTERNS     → Approve only matching tool names (glob pattern)'
    );
    console.info('   • Interactive (no env vars)    → Prompt user for each operation');

    console.info('\n✨ Workflow Complete! You tested:');
    console.info('   1. ✅ SELECT (non-destructive) → No approval needed');
    console.info('   2. ✅ SELECT (non-destructive) → No approval needed');
    console.info('   3. 🔒 DELETE (destructive)    → Approval required/tested');

    console.info('\n' + '='.repeat(70) + '\n');
  } catch (err: any) {
    console.error('\n❌ Error:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('\nDatabase connection refused. Make sure your Postgres instance is running.');
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
