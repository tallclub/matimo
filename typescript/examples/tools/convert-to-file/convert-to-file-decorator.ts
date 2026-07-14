import {
  MatimoInstance,
  setGlobalMatimoInstance,
  tool,
  getGlobalApprovalHandler,
  type ApprovalRequest,
} from '@matimo/core';

/**
 * Create an interactive approval callback for file conversion operations.
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR FILE CONVERSION');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`   ${request.params.source_format} -> ${request.params.target_format}`);

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (no terminal)');
      console.info('\n💡 To enable auto-approval in CI/scripts:');
      console.info('   export MATIMO_AUTO_APPROVE=true');
      console.info('\n' + '='.repeat(70) + '\n');
      return false;
    }

    // Non-interactive example environments should set MATIMO_AUTO_APPROVE=true.
    console.info('   ✅ Auto-approved (see MATIMO_AUTO_APPROVE)');
    console.info('='.repeat(70) + '\n');
    return true;
  };
}

/**
 * Example: convert_to_file tool using the @tool decorator pattern.
 */
class FileConverter {
  @tool('convert_to_file')
  async convert(content: string, source_format: string, target_format: string): Promise<unknown> {
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
  console.info('🚀 Convert To File Tool - Decorator Pattern Example');
  console.info('='.repeat(70));

  const converter = new FileConverter();

  try {
    console.info('\n1️⃣  CONVERTING CSV TO JSON');
    console.info('-'.repeat(70));
    const csv = 'name,role\nAda,Mathematician\nAlan,Computer Scientist\n';
    const result = await converter.convert(csv, 'csv', 'json');
    if (result) {
      const decoded = Buffer.from((result as any).file_base64, 'base64').toString('utf8');
      console.info('✅ MIME type:', (result as any).mime_type);
      console.info('📝 JSON output:', decoded);
    }
    console.info('---\n');

    console.info('✅ Decorator example completed successfully');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

decoratorExample();
