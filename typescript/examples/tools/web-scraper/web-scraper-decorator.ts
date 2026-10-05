import { MatimoInstance, setGlobalMatimoInstance, tool, type ApprovalRequest } from '@matimo/core';
import * as readline from 'readline';

/**
 * Create an interactive approval callback for web-crawling operations.
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR WEB CRAWL');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);
    console.info(`   url: ${request.params.url}`);

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (no terminal)');
      console.info('\n💡 To pre-approve this tool in CI/scripts:');
      console.info('   export MATIMO_APPROVED_PATTERNS="web_scraper"');
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
 * Example: web_scraper tool using the @tool decorator pattern.
 */
class SiteCrawler {
  @tool('web_scraper')
  async crawl(url: string, maxPages?: number, maxDepth?: number): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo
    return undefined;
  }
}

async function decoratorExample() {
  const matimo = await MatimoInstance.init({
    autoDiscover: true,
    // Decides every call that needs approval, for this instance only.
    onApproval: createApprovalCallback(),
  });
  setGlobalMatimoInstance(matimo);

  console.info('\n' + '='.repeat(70));
  console.info('🚀 Web Scraper Tool - Decorator Pattern Example');
  console.info('='.repeat(70));

  const approvedPatterns = process.env.MATIMO_APPROVED_PATTERNS;
  console.info('\n🔐 APPROVAL CONFIGURATION:');
  console.info(
    approvedPatterns
      ? `   ✅ MATIMO_APPROVED_PATTERNS="${approvedPatterns}" — matching crawl requests are pre-approved`
      : '   ⚠️  INTERACTIVE MODE ENABLED — you will be prompted to approve crawls'
  );

  const crawler = new SiteCrawler();

  try {
    console.info('\n1️⃣  CRAWLING A SITE (maxDepth 0 — starting page only)');
    console.info('-'.repeat(70));
    const result = await crawler.crawl('https://example.com', 1, 0);
    if (result) {
      console.info('✅ Pages crawled:', (result as any).pagesCrawled);
      console.info('📄 Title:', (result as any).pages?.[0]?.title);
      console.info(
        '📝 Text preview:',
        String((result as any).pages?.[0]?.text ?? '').slice(0, 150)
      );
    }
    console.info('---\n');

    console.info('✅ Decorator example completed successfully');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

decoratorExample();
