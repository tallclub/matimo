import { MatimoInstance, getGlobalApprovalHandler, type ApprovalRequest } from '@matimo/core';
import * as readline from 'readline';

/**
 * Create an interactive approval callback for web-crawling operations.
 * web_scraper sets requires_approval: true (same as extract_from_file/convert_to_file)
 * because it makes outbound HTTP requests to arbitrary domains.
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR WEB CRAWL');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);
    console.info(`\n🌐 Crawl Request:`);
    console.info(`   url: ${request.params.url}`);
    console.info(`   maxPages: ${request.params.maxPages ?? 20}`);
    console.info(`   maxDepth: ${request.params.maxDepth ?? 3}`);

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
 * Example: web_scraper tool using the factory pattern.
 * Demonstrates crawling a small documentation-style site starting from one URL,
 * bounded by maxPages/maxDepth, with interactive approval.
 */
async function webScraperExample() {
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  const approvalHandler = getGlobalApprovalHandler();
  approvalHandler.setApprovalCallback(createApprovalCallback());

  console.info('=== Web Scraper Tool - Factory Pattern (Interactive Approval) ===\n');

  try {
    console.info('1. Crawling a small site (maxPages: 5, maxDepth: 1)\n');
    const result = await matimo.execute('web_scraper', {
      url: 'https://example.com',
      maxPages: 5,
      maxDepth: 1,
      format: 'text',
    });

    if ((result as any).success) {
      console.info('Domain:', (result as any).domain);
      console.info('Pages crawled:', (result as any).pagesCrawled);
      console.info('Truncated crawl:', (result as any).truncatedCrawl);
      for (const page of (result as any).pages) {
        console.info(`\n- ${page.url} (depth ${page.depth})`);
        console.info(`  title: ${page.title}`);
        console.info(`  text preview: ${String(page.text ?? '').slice(0, 150)}`);
      }
      if ((result as any).errors.length > 0) {
        console.info('\nPages that failed to crawl:', (result as any).errors);
      }
    } else {
      console.info('Crawl failed:', (result as any).error);
    }
    console.info('---\n');
  } catch (error: any) {
    console.error('Error crawling site:', error.message, error.code, error.details);
  }
}

webScraperExample();
