#!/usr/bin/env node
/**
 * ============================================================================
 * GMAIL TOOLS - DECORATOR PATTERN EXAMPLE
 * ============================================================================
 *
 * PATTERN: Decorator Pattern with @tool
 * ─────────────────────────────────────────────────────────────────────────
 * Uses TypeScript @tool decorators to wrap Gmail tool calls in a class.
 *
 * Use this pattern when:
 * ✅ Building class-based applications
 * ✅ Encapsulating tool logic in services
 * ✅ Adding custom methods that combine multiple tools
 * ✅ Need reusable tool wrappers
 * ✅ Object-oriented design preferred
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create .env file:
 *    GMAIL_ACCESS_TOKEN=ya29.xxxxxxxxxxxxx
 *
 * 2. Same scopes as factory pattern
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export GMAIL_ACCESS_TOKEN=your_token_here
 *   npm run gmail:decorator
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatimoInstance, tool, setGlobalMatimoInstance } from 'matimo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Decorator Pattern Agent - Uses @tool decorators for Gmail operations
 */
class DecoratorPatternAgent {
  constructor(private matimo: MatimoInstance) {}

  /**
   * Gmail send-email tool - automatically executes via @tool decorator
   */
  @tool('gmail-send-email')
  async sendEmail(to: string, subject: string, body: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('gmail-send-email', { to, subject, body })
    // Matimo automatically injects GMAIL_ACCESS_TOKEN from env vars
    return undefined;
  }

  /**
   * Gmail list-messages tool - automatically executes via @tool decorator
   */
  @tool('gmail-list-messages')
  async listMessages(query?: string, maxResults?: number): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('gmail-list-messages', { query, maxResults })
    // Matimo automatically injects GMAIL_ACCESS_TOKEN from env vars
    return undefined;
  }

  /**
   * Gmail get-message tool - automatically executes via @tool decorator
   */
  @tool('gmail-get-message')
  async getMessage(messageId: string, format?: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('gmail-get-message', { messageId, format })
    // Matimo automatically injects GMAIL_ACCESS_TOKEN from env vars
    return undefined;
  }

  /**
   * Gmail create-draft tool - automatically executes via @tool decorator
   */
  @tool('gmail-create-draft')
  async createDraft(to: string, subject: string, body: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('gmail-create-draft', { to, subject, body })
    // Matimo automatically injects GMAIL_ACCESS_TOKEN from env vars
    return undefined;
  }

  /**
   * Gmail delete-message tool - automatically executes via @tool decorator
   */
  @tool('gmail-delete-message')
  async deleteMessage(messageId: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('gmail-delete-message', { messageId })
    // Matimo automatically injects GMAIL_ACCESS_TOKEN from env vars
    return undefined;
  }
}

/**
 * Run decorator pattern examples
 */
async function runDecoratorPatternExamples() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  let userEmail = process.env.TEST_EMAIL || 'test@example.com';

  for (const arg of args) {
    if (arg.startsWith('--email:')) {
      userEmail = arg.split(':')[1];
    } else if (arg.startsWith('--email=')) {
      userEmail = arg.split('=')[1];
    }
  }

  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Gmail Tools - Decorator Pattern                    ║');
  console.info('║     (Uses @tool decorators for automatic execution)    ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  const accessToken = process.env.GMAIL_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('❌ Error: GMAIL_ACCESS_TOKEN not set in .env');
    console.info('   Set it: export GMAIL_ACCESS_TOKEN="ya29...."');
    console.info('   Or get a token from: https://developers.google.com/oauthplayground');
    process.exit(1);
  }

  console.info(`📧 User Email: ${userEmail}\n`);

  try {
    // Initialize Matimo
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });
    setGlobalMatimoInstance(matimo);

    const matimoTools = matimo.listTools();
    console.info(`📦 Loaded ${matimoTools.length} tools:\n`);
    matimoTools.forEach((t) => {
      console.info(`  • ${t.name}`);
      console.info(`    ${t.description}\n`);
    });

    // Create agent
    const agent = new DecoratorPatternAgent(matimo);

    console.info('🧪 Testing Gmail Tools with Decorator Pattern');
    console.info('═'.repeat(60));

    // Example 1: List Messages via decorator
    console.info('\n📬 Example 1: List Messages via @tool Decorator');
    console.info('─'.repeat(60));
    try {
      const listResult = await agent.listMessages('', 5);
      console.info('✅ Messages retrieved successfully!');
      if (typeof listResult === 'object' && listResult !== null) {
        const data = listResult as any;
        if (data.messages && Array.isArray(data.messages)) {
          console.info(`   Found ${data.messages.length} recent messages:`);
          data.messages.slice(0, 3).forEach((msg: any, idx: number) => {
            console.info(`   ${idx + 1}. ID: ${msg.id.substring(0, 15)}...`);
          });
        } else {
          console.info('   No messages or unexpected format');
        }
      }
    } catch (error) {
      console.info(`⚠️  List failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Example 2: Send Email via decorator
    console.info('\n📧 Example 2: Send Email via @tool Decorator');
    console.info('─'.repeat(60));
    try {
      const sendResult = await agent.sendEmail(
        userEmail,
        'Hello from Decorator Pattern',
        'This email was sent using the @tool decorator'
      );
      console.info('✅ Email sent successfully!');
      if (typeof sendResult === 'object' && sendResult !== null) {
        const data = sendResult as any;
        if (data.id) console.info(`   Message ID: ${data.id}`);
      }
    } catch (error) {
      console.info(`⚠️  Send failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Example 3: Create Draft via decorator
    console.info('\n✏️  Example 3: Create Draft via @tool Decorator');
    console.info('─'.repeat(60));
    try {
      const draftResult = await agent.createDraft(
        userEmail,
        'Decorator Pattern Draft',
        'This draft was created using the @tool decorator'
      );
      console.info('✅ Draft created successfully!');
      if (typeof draftResult === 'object' && draftResult !== null) {
        const data = draftResult as any;
        if (data.id) console.info(`   Draft ID: ${data.id}`);
      }
    } catch (error) {
      console.info(`⚠️  Draft failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.info('\n' + '═'.repeat(60));
    console.info('✨ Decorator Pattern Examples Complete!\n');
    console.info('Usage:');
    console.info('  npm run gmail:decorator');
    console.info('  npm run gmail:decorator -- --email:your-email@gmail.com\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the examples
runDecoratorPatternExamples().catch(console.error);
