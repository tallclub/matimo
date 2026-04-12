import { MatimoInstance, getGlobalApprovalHandler, type ApprovalRequest } from '@matimo/core';
import fs from 'fs';
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
      console.info('   export MATIMO_APPROVED_PATTERNS="edit"');
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
 * Example: Edit tool using factory pattern
 * Demonstrates editing and modifying file contents with interactive approval
 */
async function editExample() {
  // Initialize Matimo with autoDiscover to find all tools (core + providers)
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  // Configure centralized approval handler
  const approvalHandler = getGlobalApprovalHandler();
  approvalHandler.setApprovalCallback(createApprovalCallback());

  console.info('=== Edit Tool - Factory Pattern (Interactive Approval) ===\n');

  // Create a temp file for demonstration
  const tempFile = path.join(__dirname, 'temp-demo.txt');
  fs.writeFileSync(tempFile, 'Line 1\nLine 2\nLine 3\n');

  try {
    // Example 1: Replace text in file (replace line 2)
    console.info('1. Replacing content in file\n');
    console.info('Original content:');
    console.info(fs.readFileSync(tempFile, 'utf-8'));
    console.info('---\n');

    const result = await matimo.execute('edit', {
      filePath: tempFile,
      operation: 'replace',
      content: 'Line 2 (Modified)',
      startLine: 2,
      endLine: 2,
    });

    if ((result as any).success) {
      console.info('Edit Result:', (result as any).success);
      console.info('Lines Affected:', (result as any).linesAffected);
      console.info('\nModified content:');
      console.info(fs.readFileSync(tempFile, 'utf-8'));
    } else {
      console.info('Edit denied:', (result as any).error);
    }
    console.info('---\n');

    // Example 2: Insert new content
    console.info('2. Inserting new line\n');
    const insertResult = await matimo.execute('edit', {
      filePath: tempFile,
      operation: 'insert',
      content: 'New inserted line',
      startLine: 2,
    });

    if ((insertResult as any).success) {
      console.info('Insert Result:', (insertResult as any).success);
      console.info('Lines Affected:', (insertResult as any).linesAffected);
      console.info('\nFinal content:');
      console.info(fs.readFileSync(tempFile, 'utf-8'));
    } else {
      console.info('Insert denied:', (insertResult as any).error);
    }
    console.info('---\n');
  } catch (error: any) {
    console.error('Error editing file:', error.message);
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

editExample();
