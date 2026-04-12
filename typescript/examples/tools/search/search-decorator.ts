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
    console.info(`\n📄 Search Operation:`);
    console.info(`   Query: ${request.params.query}`);
    console.info(`   Directory: ${request.params.directory}`);
    if (request.params.filePattern) {
      console.info(`   File Pattern: ${request.params.filePattern}`);
    }

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (no terminal)');
      console.info('\n💡 To enable auto-approval in CI/scripts:');
      console.info('   export MATIMO_AUTO_APPROVE=true');
      console.info('\n💡 Or approve specific patterns:');
      console.info('   export MATIMO_APPROVED_PATTERNS="search"');
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
 * Example: Search tool using @tool decorator pattern
 * Demonstrates class-based file search with automatic decoration
 */
class FileSearcher {
  @tool('search')
  async findPattern(
    query: string,
    directory: string,
    filePattern: string,
    maxResults?: number
  ): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo with:
    // { query, directory, filePattern, maxResults }
    // Positional args map to parameters in tool definition order
    return undefined;
  }

  @tool('search')
  async searchInDirectory(
    query: string,
    directory: string,
    filePattern?: string
  ): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo with:
    // { query, directory, filePattern }
    return undefined;
  }

  @tool('search')
  async regexSearch(
    query: string,
    directory: string,
    filePattern: string,
    isRegex: boolean = true,
    maxResults?: number
  ): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo with:
    // { query, directory, filePattern, isRegex, maxResults }
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
  console.info('🚀 Search Tool - Decorator Pattern Example');
  console.info('='.repeat(70));

  // Show current approval mode
  const autoApproveEnabled = process.env.MATIMO_AUTO_APPROVE === 'true';
  const approvedPatterns = process.env.MATIMO_APPROVED_PATTERNS;

  console.info('\n🔐 APPROVAL CONFIGURATION:');
  if (autoApproveEnabled) {
    console.info('   ✅ MATIMO_AUTO_APPROVE=true');
    console.info('   → All search operations will be AUTO-APPROVED');
  } else if (approvedPatterns) {
    console.info(`   ✅ MATIMO_APPROVED_PATTERNS="${approvedPatterns}"`);
    console.info('   → Matching operations will be auto-approved');
  } else {
    console.info('   ⚠️  INTERACTIVE MODE ENABLED');
    console.info('   → You will be prompted to approve search operations');
  }

  // Get the workspace root (parent of examples directory)
  // File is in examples/tools/search/, so go up 3 levels
  const workspaceRoot = path.resolve(__dirname, '../../..');

  const searcher = new FileSearcher();

  try {
    // Example 1: Find pattern through decorated method
    console.info('\n1️⃣  SEARCHING FOR A PATTERN');
    console.info('-'.repeat(70));
    console.info('Finding "export" in TypeScript files (max 5 results)\n');
    const result1 = await searcher.findPattern(
      'export',
      path.join(workspaceRoot, 'packages/core/src'),
      '*.ts',
      5
    );
    if (result1) {
      console.info('✅ Total matches:', (result1 as any).totalMatches);
      console.info('📊 Matches found:', (result1 as any).matches?.length);
      if ((result1 as any).matches?.length > 0) {
        console.info('📝 First match:', (result1 as any).matches[0]);
      }
    }
    console.info('---\n');

    // Example 2: Search in specific directory
    console.info('2️⃣  SEARCHING IN EXAMPLES DIRECTORY');
    console.info('-'.repeat(70));
    console.info('Searching for "async" in TypeScript files\n');
    const result2 = await searcher.searchInDirectory(
      'async',
      path.join(workspaceRoot, 'examples/tools'),
      '*.ts'
    );
    if (result2) {
      console.info('✅ Total matches:', (result2 as any).totalMatches);
      console.info('📊 Matches found:', (result2 as any).matches?.length);
    }
    console.info('---\n');

    // Example 3: Regex search
    console.info('3️⃣  USING REGEX PATTERN');
    console.info('-'.repeat(70));
    console.info('Finding "console.info" calls (max 5 results)\n');
    const result3 = await searcher.regexSearch(
      'console\\.info',
      path.join(workspaceRoot, 'packages/core/src'),
      '*.ts',
      true,
      5
    );
    if (result3) {
      console.info('✅ Total matches:', (result3 as any).totalMatches);
      console.info('📊 Matches found:', (result3 as any).matches?.length);
    }
    console.info('---\n');

    console.info('✅ Decorator example completed successfully');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

decoratorExample();
