import { MatimoInstance, getGlobalApprovalHandler, type ApprovalRequest } from '@matimo/core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create an interactive approval callback for file extraction operations.
 * extract_from_file sets requires_approval: true (same as the `read` core tool)
 * because it touches the local filesystem and/or fetches remote content.
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR FILE EXTRACTION');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);
    console.info(`\n📄 Extraction Request:`);
    if (request.params.filePath) console.info(`   filePath: ${request.params.filePath}`);
    if (request.params.fileUrl) console.info(`   fileUrl: ${request.params.fileUrl}`);
    console.info(`   format: ${request.params.format ?? 'auto'}`);

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (no terminal)');
      console.info('\n💡 To enable auto-approval in CI/scripts:');
      console.info('   export MATIMO_AUTO_APPROVE=true');
      console.info('\n💡 Or approve specific patterns:');
      console.info('   export MATIMO_APPROVED_PATTERNS="extract_from_file"');
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

/**
 * Example: extract_from_file tool using the factory pattern.
 * Demonstrates extracting text from a local txt/csv file and a local "PDF-like"
 * fixture (via magic-byte sniffing) with interactive approval.
 */
async function extractFromFileExample() {
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  const approvalHandler = getGlobalApprovalHandler();
  approvalHandler.setApprovalCallback(createApprovalCallback());

  console.info('=== Extract From File Tool - Factory Pattern (Interactive Approval) ===\n');

  // Create a small sample CSV file for the example to extract from.
  const sampleCsv = path.join(__dirname, 'sample-data.csv');
  fs.writeFileSync(
    sampleCsv,
    'name,role\nAda Lovelace,Mathematician\nAlan Turing,Computer Scientist\n'
  );

  try {
    // Example 1: Extract a local CSV file (format auto-detected from extension)
    console.info('1. Extracting sample-data.csv\n');
    const result1 = await matimo.execute('extract_from_file', {
      filePath: sampleCsv,
    });

    if ((result1 as any).success) {
      console.info('Format detected:', (result1 as any).format_detected);
      console.info('Rows:', (result1 as any).metadata?.row_count);
      console.info('Columns:', (result1 as any).metadata?.column_count);
      console.info('Extracted text:\n', (result1 as any).extracted_text);
    } else {
      console.info('Extraction failed:', (result1 as any).error);
    }
    console.info('---\n');

    // Example 2: Extract this example file itself as plain text
    console.info('2. Extracting extract-from-file-factory.ts as plain text\n');
    const result2 = await matimo.execute('extract_from_file', {
      filePath: path.join(__dirname, './extract-from-file-factory.ts'),
      format: 'txt',
    });

    if ((result2 as any).success) {
      console.info('Word count:', (result2 as any).metadata?.word_count);
      console.info('Char count:', (result2 as any).metadata?.char_count);
      console.info('Preview:', (result2 as any).extracted_text?.substring(0, 200));
    } else {
      console.info('Extraction failed:', (result2 as any).error);
    }
    console.info('---\n');
  } catch (error: any) {
    console.error('Error extracting file:', error.message, error.code, error.details);
  } finally {
    if (fs.existsSync(sampleCsv)) fs.unlinkSync(sampleCsv);
  }
}

extractFromFileExample();
