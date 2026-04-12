import {
  MatimoInstance,
  setGlobalMatimoInstance,
  tool,
  getGlobalApprovalHandler,
  type ApprovalRequest,
} from '@matimo/core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create an interactive approval callback
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
    console.info(`   Operation: ${request.params.operation}`);
    if (request.params.content) {
      console.info(`   Content: ${String(request.params.content).substring(0, 50)}...`);
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
 * Example: Edit tool using @tool decorator pattern
 * Demonstrates class-based file editing with automatic decoration
 */
class FileEditor {
  @tool('edit')
  async replaceContent(
    filePath: string,
    operation: string,
    content: string,
    startLine: number,
    endLine: number
  ): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo
    return undefined;
  }

  @tool('edit')
  async insertContent(
    filePath: string,
    operation: string,
    content: string,
    startLine: number,
    endLine: number
  ): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo
    return undefined;
  }
}

async function decoratorExample() {
  // Set up decorator support with autoDiscover
  const matimo = await MatimoInstance.init({ autoDiscover: true });
  setGlobalMatimoInstance(matimo);

  // Configure centralized approval handler
  const approvalHandler = getGlobalApprovalHandler();
  approvalHandler.setApprovalCallback(createApprovalCallback());

  console.info('\n' + '='.repeat(70));
  console.info('🚀 Edit Tool - Decorator Pattern Example');
  console.info('='.repeat(70));

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
    console.info('   → You will be prompted to approve file operations');
  }

  const editor = new FileEditor();

  // Create a temp file for demonstration
  const tempFile = path.join(__dirname, 'temp-demo-decorator.txt');
  fs.writeFileSync(tempFile, 'Original line\nAnother line\nThird line\n');

  try {
    // Example 1: Replace through decorated method
    console.info('\n1️⃣  REPLACING CONTENT');
    console.info('-'.repeat(70));
    console.info('Replacing line 1 with: "Updated line"');
    console.info('(This is a write operation - may require approval)\n');
    const result1 = await editor.replaceContent(tempFile, 'replace', 'Updated line', 1, 1);
    if (result1) {
      console.info('✅ Edit Result:', (result1 as any).success);
      console.info('📊 Lines Affected:', (result1 as any).linesAffected);
      console.info('📝 File content:');
      console.info(fs.readFileSync(tempFile, 'utf-8'));
    }
    console.info('---\n');

    // Example 2: Insert through decorated method
    console.info('2️⃣  INSERTING CONTENT');
    console.info('-'.repeat(70));
    console.info('Inserting "Inserted line" at line 1');
    console.info('(This is a write operation - may require approval)\n');
    const result2 = await editor.insertContent(tempFile, 'insert', 'Inserted line', 1, 0);
    if (result2) {
      console.info('✅ Insert Result:', (result2 as any).success);
      console.info('📊 Lines Affected:', (result2 as any).linesAffected);
      console.info('📝 File content:');
      console.info(fs.readFileSync(tempFile, 'utf-8'));
    }
    console.info('---\n');

    console.info('✅ Decorator example completed successfully');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
      console.info('\n🧹 Cleaned up temporary file');
    }
    console.info('');
  }
}

decoratorExample();
