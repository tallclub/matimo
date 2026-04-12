#!/usr/bin/env node
/**
 * ============================================================================
 * TWILIO TOOLS - DECORATOR PATTERN EXAMPLE
 * ============================================================================
 *
 * PATTERN: Decorator Pattern with @tool
 * ─────────────────────────────────────────────────────────────────────────
 * Uses TypeScript @tool decorators to wrap Twilio tool calls in a class.
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
 *    TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *    TWILIO_AUTH_TOKEN=your_auth_token_here
 *    TWILIO_FROM_NUMBER=+15557122661
 *    TWILIO_TO_NUMBER=+15558675310
 *
 *    Matimo automatically handles base64 Basic Auth encoding — no extra steps!
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   pnpm twilio:decorator
 *
 * ============================================================================
 */

import 'dotenv/config';
import { MatimoInstance, tool, setGlobalMatimoInstance } from 'matimo';

/**
 * Decorator Pattern Agent - Uses @tool decorators for Twilio messaging operations.
 * The account_sid is bound at construction time and reused in all tool calls.
 */
class TwilioDecoratorAgent {
  constructor(private readonly accountSid: string) {}

  /**
   * Send an SMS message - automatically executes via @tool decorator
   */
  @tool('twilio-send-sms')
  async sendSms(
    account_sid: string,
    to: string,
    from: string,
    body: string,
    status_callback?: string
  ): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('twilio-send-sms', { account_sid, to, from, body, status_callback })
    return undefined;
  }

  /**
   * Send an MMS message with media - automatically executes via @tool decorator
   */
  @tool('twilio-send-mms')
  async sendMms(
    account_sid: string,
    to: string,
    from: string,
    media_url: string,
    body?: string
  ): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('twilio-send-mms', { account_sid, to, from, media_url, body })
    return undefined;
  }

  /**
   * Fetch a message by SID - automatically executes via @tool decorator
   */
  @tool('twilio-get-message')
  async getMessage(account_sid: string, message_sid: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('twilio-get-message', { account_sid, message_sid })
    return undefined;
  }

  /**
   * List messages with optional filters - automatically executes via @tool decorator
   */
  @tool('twilio-list-messages')
  async listMessages(
    account_sid: string,
    to?: string,
    from?: string,
    date_sent?: string,
    page_size?: number
  ): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('twilio-list-messages', { account_sid, to, from, date_sent, page_size })
    return undefined;
  }

  // ── Convenience helpers that bind account_sid automatically ──────────────

  /** Send SMS using the bound account SID */
  async sms(to: string, from: string, body: string): Promise<unknown> {
    return this.sendSms(this.accountSid, to, from, body);
  }

  /** Send MMS using the bound account SID */
  async mms(to: string, from: string, mediaUrl: string, body?: string): Promise<unknown> {
    return this.sendMms(this.accountSid, to, from, mediaUrl, body);
  }

  /** Fetch a message using the bound account SID */
  async fetch(messageSid: string): Promise<unknown> {
    return this.getMessage(this.accountSid, messageSid);
  }

  /** List recent messages using the bound account SID */
  async list(
    options: { to?: string; from?: string; dateSent?: string; pageSize?: number } = {}
  ): Promise<unknown> {
    return this.listMessages(
      this.accountSid,
      options.to,
      options.from,
      options.dateSent,
      options.pageSize
    );
  }
}

/**
 * Run decorator pattern examples
 */
async function runTwilioDecoratorExamples() {
  console.info('╔════════════════════════════════════════════════════════╗');
  console.info('║     Twilio Tools - Decorator Pattern                   ║');
  console.info('║     (Uses @tool decorators for automatic execution)    ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // Validate required environment variables
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const toNumber = process.env.TWILIO_TO_NUMBER;

  if (!accountSid) {
    console.info('🔐 Warning: TWILIO_ACCOUNT_SID not set in environment');
    console.info('   Set it: export TWILIO_ACCOUNT_SID="ACxxxxxxxxxx"');
    console.info('   Get it from: https://console.twilio.com\n');
  }

  if (!authToken) {
    console.info('🔐 Warning: TWILIO_AUTH_TOKEN not set');
    console.info('   Set it: export TWILIO_AUTH_TOKEN="your_auth_token"\n');
  }

  if (!fromNumber || !toNumber) {
    console.info('📱 Warning: TWILIO_FROM_NUMBER or TWILIO_TO_NUMBER not set\n');
  }

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    console.info('⚠️  Missing credentials — skipping live API calls.\n');
  }

  console.info(`🔑 Account SID: ${accountSid ? 'Configured' : '(not set)'}`);
  console.info(`📤 From: ${fromNumber || '(not set)'}`);
  console.info(`📥 To:   ${toNumber || '(not set)'}\n`);

  try {
    // Initialize Matimo with auto-discovery
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });
    setGlobalMatimoInstance(matimo);

    const allTools = matimo.listTools();
    const twilioTools = allTools.filter((t) => t.name.startsWith('twilio-'));
    console.info(`📦 Loaded ${allTools.length} total tools, ${twilioTools.length} Twilio tools\n`);

    // Create agent with bound account SID
    const agent = new TwilioDecoratorAgent(accountSid || 'ACxxxxxxxx');

    console.info('🧪 Testing Twilio Tools with Decorator Pattern');
    console.info('═'.repeat(60) + '\n');

    // ── Example 1: List recent messages ─────────────────────────────────
    console.info('📋 Example 1: List Recent Messages');
    console.info('─'.repeat(60));
    try {
      const listResult = await agent.list({ pageSize: 5 });
      const listData = (listResult as any).data || listResult;

      if (listData.messages && Array.isArray(listData.messages)) {
        console.info(`✅ Found ${listData.messages.length} recent message(s):`);
        listData.messages.slice(0, 3).forEach((msg: any, idx: number) => {
          console.info(
            `   ${idx + 1}. ${msg.sid} — ${msg.status} — "${msg.body?.substring(0, 40)}"`
          );
        });
      } else {
        console.info(`ℹ️  Response: ${JSON.stringify(listData).substring(0, 100)}`);
      }
    } catch (error) {
      console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.info();

    // ── Example 2: Send SMS ──────────────────────────────────────────────
    console.info('💬 Example 2: Send SMS Message');
    console.info('─'.repeat(60));

    if (!accountSid || !fromNumber || !toNumber) {
      console.info('⏭️  Skipping — credentials not set');
    } else {
      try {
        const smsResult = await agent.sms(
          toNumber,
          fromNumber,
          `👋 Hello from Matimo! Decorator pattern test at ${new Date().toISOString()}`
        );
        const smsData = (smsResult as any).data || smsResult;

        if (smsData.sid) {
          console.info(`✅ SMS queued successfully!`);
          console.info(`   SID:    ${smsData.sid}`);
          console.info(`   Status: ${smsData.status}`);
          console.info(`   To:     ${smsData.to}`);

          // ── Example 3: Fetch the sent message ────────────────────────────
          console.info();
          console.info('🔍 Example 3: Fetch the Sent Message');
          console.info('─'.repeat(60));
          const fetchResult = await agent.fetch(smsData.sid);
          const fetchData = (fetchResult as any).data || fetchResult;

          if (fetchData.sid) {
            console.info(`✅ Message fetched!`);
            console.info(`   Status:       ${fetchData.status}`);
            console.info(`   Direction:    ${fetchData.direction}`);
            console.info(`   Num Segments: ${fetchData.num_segments}`);
          } else {
            console.info(`❌ Failed: ${JSON.stringify(fetchData).substring(0, 100)}`);
          }
        } else {
          console.info(`❌ SMS failed: ${JSON.stringify(smsData).substring(0, 100)}`);
        }
      } catch (error) {
        console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.info();

    // ── Example 4: List messages filtered by sender ──────────────────────
    console.info('📊 Example 4: List Messages Filtered by Sender');
    console.info('─'.repeat(60));

    if (!accountSid || !fromNumber) {
      console.info('⏭️  Skipping — credentials not set');
    } else {
      try {
        const fromResult = await agent.list({ from: fromNumber, pageSize: 5 });
        const fromData = (fromResult as any).data || fromResult;

        if (fromData.messages && Array.isArray(fromData.messages)) {
          console.info(`✅ Found ${fromData.messages.length} message(s) from ${fromNumber}`);
          fromData.messages.slice(0, 3).forEach((msg: any, idx: number) => {
            console.info(`   ${idx + 1}. ${msg.sid} — ${msg.status}`);
          });
        } else {
          console.info(`ℹ️  Response: ${JSON.stringify(fromData).substring(0, 100)}`);
        }
      } catch (error) {
        console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.info('\n' + '═'.repeat(60));
    console.info('✨ Decorator Pattern Example Complete!');
    console.info('═'.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the example
runTwilioDecoratorExamples().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
