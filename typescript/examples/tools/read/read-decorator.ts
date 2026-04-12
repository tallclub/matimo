import {
  MatimoInstance,
  setGlobalMatimoInstance,
  tool,
  getGlobalApprovalHandler,
  type ApprovalRequest,
} from '@matimo/core';
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
 * Example: Read tool using @tool decorator pattern
 * Demonstrates class-based file reading with automatic decoration
 */
class FileReader {
  @tool('read')
  async readFile(filePath: string, startLine: number, endLine: number): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo
    return undefined;
  }

  @tool('read')
  async getFileMetadata(filePath: string): Promise<unknown> {
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
  console.info('🚀 Read Tool - Decorator Pattern Example');
  console.info('='.repeat(70));

  // Show current approval mode
  const autoApproveEnabled = process.env.MATIMO_AUTO_APPROVE === 'true';
  const approvedPatterns = process.env.MATIMO_APPROVED_PATTERNS;

  console.info('\n🔐 APPROVAL CONFIGURATION:');
  if (autoApproveEnabled) {
    console.info('   ✅ MATIMO_AUTO_APPROVE=true');
    console.info('   → All file read operations will be AUTO-APPROVED');
  } else if (approvedPatterns) {
    console.info(`   ✅ MATIMO_APPROVED_PATTERNS="${approvedPatterns}"`);
    console.info('   → Matching operations will be auto-approved');
  } else {
    console.info('   ⚠️  INTERACTIVE MODE ENABLED');
    console.info('   → You will be prompted to approve file operations');
  }

  const reader = new FileReader();

  try {
    // Example 1: Read file through decorated method
    console.info('\n1️⃣  READING FILE WITH LINE RANGE');
    console.info('-'.repeat(70));
    console.info('Reading read-factory.ts (lines 1-15)\n');
    const result1 = await reader.readFile(path.join(__dirname, './read-factory.ts'), 1, 15);
    if (result1) {
      console.info('✅ File:', (result1 as any).filePath);
      console.info('📊 Lines read:', (result1 as any).readLines);
      console.info('📝 Content preview:');
      console.info((result1 as any).content?.substring(0, 150) + '...');
    }
    console.info('---\n');

    // Example 2: Read another file
    console.info('2️⃣  READING ENTIRE FILE');
    console.info('-'.repeat(70));
    console.info('Reading package.json (all lines)\n');
    const result2 = await reader.getFileMetadata(path.join(__dirname, '../../../package.json'));
    if (result2) {
      console.info('✅ File:', (result2 as any).filePath);
      console.info('📊 Lines read:', (result2 as any).readLines);
      console.info('📝 Content preview:');
      console.info((result2 as any).content?.substring(0, 150) + '...');
    }
    console.info('---\n');

    console.info('✅ Decorator example completed successfully');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

decoratorExample();
