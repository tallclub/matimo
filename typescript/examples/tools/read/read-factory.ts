import { MatimoInstance, getGlobalApprovalHandler, type ApprovalRequest } from '@matimo/core';
import path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create an interactive approval callback for file operations
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR FILE OPERATION');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);
    console.info(`\n📄 File Operation:`);
    console.info(`   Path: ${request.params.filePath}`);
    if (request.params.startLine) {
      console.info(`   Start Line: ${request.params.startLine}`);
    }
    if (request.params.endLine) {
      console.info(`   End Line: ${request.params.endLine}`);
    }

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (no terminal)');
      console.info('\n💡 To enable auto-approval in CI/scripts:');
      console.info('   export MATIMO_AUTO_APPROVE=true');
      console.info('\n💡 Or approve specific patterns:');
      console.info('   export MATIMO_APPROVED_PATTERNS="read"');
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

/**
 * Example: Read tool using factory pattern
 * Demonstrates reading file contents and metadata with interactive approval
 */
async function readExample() {
  // Initialize Matimo with autoDiscover to find all tools (core + providers)
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  // Configure centralized approval handler
  const approvalHandler = getGlobalApprovalHandler();
  approvalHandler.setApprovalCallback(createApprovalCallback());

  console.info('=== Read Tool - Factory Pattern (Interactive Approval) ===\n');

  try {
    // Example 1: Read this example file
    console.info('1. Reading read-factory.ts\n');
    const result1 = await matimo.execute('read', {
      filePath: path.join(__dirname, './read-factory.ts'),
      startLine: 1,
      endLine: 20,
    });

    if ((result1 as any).success) {
      console.info('File:', (result1 as any).filePath);
      console.info('Lines read:', (result1 as any).readLines);
      console.info('Content preview:');
      console.info((result1 as any).content?.substring(0, 300));
    } else {
      console.info('Access denied:', (result1 as any).error);
    }
    console.info('---\n');

    // Example 2: Read package.json
    console.info('2. Reading package.json\n');
    const result2 = await matimo.execute('read', {
      filePath: path.join(__dirname, '../../../package.json'),
      startLine: 1,
      endLine: 15,
    });

    if ((result2 as any).success) {
      console.info('File:', (result2 as any).filePath);
      console.info('Lines read:', (result2 as any).readLines);
      console.info('Content preview:');
      console.info((result2 as any).content?.substring(0, 200));
    } else {
      console.info('Access denied:', (result2 as any).error);
    }
    console.info('---\n');
  } catch (error: any) {
    console.error('Error reading file:', error.message, error.code, error.details);
  }
}

readExample();
