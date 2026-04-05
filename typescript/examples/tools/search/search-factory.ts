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
 * Example: Search tool using factory pattern
 * Demonstrates searching files for patterns and content with interactive approval
 */
async function searchExample() {
  // Initialize Matimo with autoDiscover to find all tools (core + providers)
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  // Configure centralized approval handler
  const approvalHandler = getGlobalApprovalHandler();
  approvalHandler.setApprovalCallback(createApprovalCallback());

  console.info('=== Search Tool - Factory Pattern (Interactive Approval) ===\n');

  // Get the workspace root (parent of examples directory)
  // File is in examples/tools/search/, so go up 3 levels
  const workspaceRoot = path.resolve(__dirname, '../../..');

  try {
    // Example 1: Search for pattern in TypeScript files
    console.info('1. Searching for "import" in examples\n');
    const result1 = await matimo.execute('search', {
      query: 'import',
      directory: path.join(workspaceRoot, 'examples/tools'),
      filePattern: '*.ts',
      maxResults: 5,
    });

    if ((result1 as any).success) {
      console.info('Total matches:', (result1 as any).totalMatches);
      console.info('Matches found:', (result1 as any).matches?.length);
      if ((result1 as any).matches) {
        (result1 as any).matches.slice(0, 3).forEach((match: any) => {
          console.info(`  - ${match.filePath}:${match.lineNumber}: ${match.lineContent}`);
        });
      }
    } else {
      console.info('Search denied:', (result1 as any).error);
    }
    console.info('---\n');

    // Example 2: Search for function definitions
    console.info('2. Searching for function definitions\n');
    const result2 = await matimo.execute('search', {
      query: 'export function',
      directory: path.join(workspaceRoot, 'packages/core/src'),
      filePattern: '*.ts',
      maxResults: 10,
    });

    if ((result2 as any).success) {
      console.info('Total matches:', (result2 as any).totalMatches);
      console.info('Matches found:', (result2 as any).matches?.length);
    } else {
      console.info('Search denied:', (result2 as any).error);
    }
    console.info('---\n');

    // Example 3: Search in specific directory with regex
    console.info('3. Searching for "console.info" patterns\n');
    const result3 = await matimo.execute('search', {
      query: 'console\\.info',
      directory: path.join(workspaceRoot, 'packages/core/src'),
      filePattern: '*.ts',
      isRegex: true,
      maxResults: 5,
    });

    if ((result3 as any).success) {
      console.info('Total matches:', (result3 as any).totalMatches);
      console.info('Matches found:', (result3 as any).matches?.length);
    } else {
      console.info('Search denied:', (result3 as any).error);
    }
    console.info('---\n');
  } catch (error: any) {
    console.error('Error searching files:', error.message);
  }
}

searchExample();
