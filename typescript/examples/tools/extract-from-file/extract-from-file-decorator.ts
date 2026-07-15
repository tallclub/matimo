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
 * Create an interactive approval callback for file extraction operations.
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR FILE EXTRACTION');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);
    if (request.params.filePath) console.info(`   filePath: ${request.params.filePath}`);
    if (request.params.fileUrl) console.info(`   fileUrl: ${request.params.fileUrl}`);

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
 * Example: extract_from_file tool using the @tool decorator pattern.
 */
class FileExtractor {
  @tool('extract_from_file')
  async extractLocalFile(filePath: string, format?: string): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo
    return undefined;
  }
}

async function decoratorExample() {
  const matimo = await MatimoInstance.init({ autoDiscover: true });
  setGlobalMatimoInstance(matimo);

  const approvalHandler = getGlobalApprovalHandler();
  approvalHandler.setApprovalCallback(createApprovalCallback());

  console.info('\n' + '='.repeat(70));
  console.info('🚀 Extract From File Tool - Decorator Pattern Example');
  console.info('='.repeat(70));

  const autoApproveEnabled = process.env.MATIMO_AUTO_APPROVE === 'true';
  console.info('\n🔐 APPROVAL CONFIGURATION:');
  console.info(
    autoApproveEnabled
      ? '   ✅ MATIMO_AUTO_APPROVE=true — extraction requests will be AUTO-APPROVED'
      : '   ⚠️  INTERACTIVE MODE ENABLED — you will be prompted to approve extractions'
  );

  const sampleTxt = path.join(__dirname, 'sample-notes.txt');
  fs.writeFileSync(
    sampleTxt,
    'Matimo makes it easy to define tools once in YAML and run them anywhere.'
  );

  const extractor = new FileExtractor();

  try {
    console.info('\n1️⃣  EXTRACTING PLAIN TEXT FILE');
    console.info('-'.repeat(70));
    console.info('Extracting sample-notes.txt\n');
    const result = await extractor.extractLocalFile(sampleTxt, 'txt');
    if (result) {
      console.info('✅ Format:', (result as any).format_detected);
      console.info('📊 Word count:', (result as any).metadata?.word_count);
      console.info('📝 Extracted text:', (result as any).extracted_text);
    }
    console.info('---\n');

    console.info('✅ Decorator example completed successfully');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    if (fs.existsSync(sampleTxt)) fs.unlinkSync(sampleTxt);
  }
}

decoratorExample();
