import { MatimoInstance, getGlobalApprovalHandler, type ApprovalRequest } from '@matimo/core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create an interactive approval callback for file conversion operations.
 * convert_to_file sets requires_approval: true (same as `read` / `extract_from_file`)
 * because it can write generated files to the local filesystem.
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR FILE CONVERSION');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);
    console.info(`\n📄 Conversion Request:`);
    console.info(`   ${request.params.source_format} -> ${request.params.target_format}`);
    if (request.params.output_path) console.info(`   output_path: ${request.params.output_path}`);

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (no terminal)');
      console.info('\n💡 To enable auto-approval in CI/scripts:');
      console.info('   export MATIMO_AUTO_APPROVE=true');
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
 * Example: convert_to_file tool using the factory pattern.
 * Demonstrates JSON -> CSV (returned inline as base64) and Markdown -> PDF
 * (written to disk) with interactive approval.
 */
async function convertToFileExample() {
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  const approvalHandler = getGlobalApprovalHandler();
  approvalHandler.setApprovalCallback(createApprovalCallback());

  console.info('=== Convert To File Tool - Factory Pattern (Interactive Approval) ===\n');

  try {
    // Example 1: Convert a JSON array of records to CSV, returned as base64
    console.info('1. Converting a JSON array of records to CSV\n');
    const jsonContent = JSON.stringify([
      { name: 'Ada Lovelace', role: 'Mathematician' },
      { name: 'Alan Turing', role: 'Computer Scientist' },
    ]);
    const result1 = await matimo.execute('convert_to_file', {
      content: jsonContent,
      source_format: 'json',
      target_format: 'csv',
    });

    if ((result1 as any).success) {
      console.info('MIME type:', (result1 as any).mime_type);
      console.info(
        'CSV output:\n',
        Buffer.from((result1 as any).file_base64, 'base64').toString('utf8')
      );
    } else {
      console.info('Conversion failed:', (result1 as any).error);
    }
    console.info('---\n');

    // Example 2: Render a Markdown report as a PDF written to disk
    console.info('2. Converting a Markdown report to a PDF on disk\n');
    const outputPath = path.join(__dirname, 'quarterly-report.pdf');
    const markdown =
      '# Quarterly Report\n\nRevenue grew steadily this quarter.\n\n- Q1: strong\n- Q2: flat\n- Q3: recovery';
    const result2 = await matimo.execute('convert_to_file', {
      content: markdown,
      source_format: 'markdown',
      target_format: 'pdf',
      output_path: outputPath,
    });

    if ((result2 as any).success) {
      console.info('Written to:', (result2 as any).output_path);
      console.info('Size (bytes):', (result2 as any).size_bytes);
    } else {
      console.info('Conversion failed:', (result2 as any).error);
    }
    console.info('---\n');

    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  } catch (error: any) {
    console.error('Error converting file:', error.message, error.code, error.details);
  }
}

convertToFileExample();
