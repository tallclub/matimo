#!/usr/bin/env node
/**
 * ============================================================================
 * TWILIO TOOLS - FACTORY PATTERN EXAMPLE
 * ============================================================================
 *
 * PATTERN: SDK Factory Pattern
 * ─────────────────────────────────────────────────────────────────────────
 * Direct tool execution via MatimoInstance - the simplest way to use tools.
 *
 * Use this pattern when:
 * ✅ Building simple scripts or CLI tools
 * ✅ Direct API calls without abstraction
 * ✅ Quick prototyping
 * ✅ One-off tool execution
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create .env file in project root:
 *    TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *    TWILIO_AUTH_TOKEN=your_auth_token_here
 *    TWILIO_FROM_NUMBER=+15557122661
 *    TWILIO_TO_NUMBER=+15558675310
 *
 * 2. Get Twilio credentials:
 *    - Go to: https://console.twilio.com
 *    - Account SID and Auth Token are on the dashboard
 *    - Buy a phone number or use your trial number as TWILIO_FROM_NUMBER
 *    - In trial mode, TWILIO_TO_NUMBER must be a verified caller ID
 *    - Matimo automatically handles base64 encoding — no extra steps required!
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   pnpm twilio:factory
 *
 * AVAILABLE TOOLS:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. twilio-send-sms
 *    Parameters: account_sid (required), to (required), from (required), body (required)
 *    Optional: status_callback
 *    Returns: Message resource with sid and status: queued
 *
 * 2. twilio-send-mms
 *    Parameters: account_sid (required), to (required), from (required), media_url (required)
 *    Optional: body, status_callback
 *    Returns: Message resource with sid and num_media: "1"
 *
 * 3. twilio-get-message
 *    Parameters: account_sid (required), message_sid (required)
 *    Returns: Full Message resource with current status
 *
 * 4. twilio-list-messages
 *    Parameters: account_sid (required)
 *    Optional: to, from, date_sent, page_size
 *    Returns: Paginated list of Message resources
 *
 * ============================================================================
 */

import 'dotenv/config';
import { MatimoInstance } from 'matimo';

/**
 * Run factory pattern examples for Twilio messaging tools
 */
async function runTwilioFactoryExamples() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Twilio Tools - Factory Pattern                     ║');
  console.info('║     (Direct execution - simplest approach)             ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // Validate required environment variables
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  if (!accountSid) {
    console.error('❌ Error: TWILIO_ACCOUNT_SID not set in .env');
    console.info('   Set it: export TWILIO_ACCOUNT_SID="ACxxxxxxxxxx"');
    console.info('   Get it from: https://console.twilio.com');
    process.exit(1);
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('❌ Error: TWILIO_AUTH_TOKEN not set in .env');
    console.info('   Set it: export TWILIO_AUTH_TOKEN="your_auth_token"');
    console.info('   Get it from: https://console.twilio.com');
    process.exit(1);
  }

  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!fromNumber) {
    console.error('❌ Error: TWILIO_FROM_NUMBER not set in .env');
    console.info('   Set it: export TWILIO_FROM_NUMBER="+15557122661"');
    console.info('   (Your Twilio phone number in E.164 format)');
    process.exit(1);
  }

  const toNumber = process.env.TWILIO_TO_NUMBER;
  if (!toNumber) {
    console.error('❌ Error: TWILIO_TO_NUMBER not set in .env');
    console.info('   Set it: export TWILIO_TO_NUMBER="+15558675310"');
    console.info('   (In trial mode, must be a verified caller ID)');
    process.exit(1);
  }

  console.info(`🔑 Account SID: Configured.`);
  console.info(`📤 From: ${fromNumber}`);
  console.info(`📥 To:   ${toNumber}\n`);

  // Initialize Matimo with auto-discovery to find all @matimo/* packages
  console.info('🚀 Initializing Matimo...');
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  const allTools = matimo.listTools();
  const twilioTools = allTools.filter((t) => t.name.startsWith('twilio-'));
  console.info(`✅ Loaded ${allTools.length} tools total`);
  console.info(
    `🔧 Found ${twilioTools.length} Twilio tools: ${twilioTools.map((t) => t.name).join(', ')}\n`
  );

  console.info('════════════════════════════════════════════════════════════\n');
  console.info('Running Examples:');
  console.info('════════════════════════════════════════════════════════════\n');

  try {
    // ── EXAMPLE 1: List recent messages ──────────────────────────────────
    console.info('1️⃣  Listing recent messages...');
    const listResult = await matimo.execute('twilio-list-messages', {
      account_sid: accountSid,
      page_size: 5,
    });
    const listData = (listResult as any).data || listResult;

    if (listData.messages && Array.isArray(listData.messages)) {
      const messages = listData.messages;
      console.info(`   ✅ Found ${messages.length} recent message(s)`);
      messages.slice(0, 3).forEach((msg: any, idx: number) => {
        console.info(
          `      ${idx + 1}. ${msg.sid} — ${msg.direction} — ${msg.status} — "${msg.body?.substring(0, 40)}"`
        );
      });
    } else {
      console.info(
        `   ℹ️  No messages found or unexpected response: ${JSON.stringify(listData).substring(0, 100)}`
      );
    }
    console.info();

    // ── EXAMPLE 2: Send SMS ───────────────────────────────────────────────
    console.info('2️⃣  Sending SMS message...');
    let sentMessageSid: string | undefined;
    try {
      const smsResult = await matimo.execute('twilio-send-sms', {
        account_sid: accountSid,
        to: toNumber,
        from: fromNumber,
        body: `Hello from Matimo! Factory pattern test at ${new Date().toISOString()}`,
      });
      const smsData = (smsResult as any).data || smsResult;

      if (smsData.sid) {
        sentMessageSid = smsData.sid;
        console.info(`   ✅ SMS queued successfully!`);
        console.info(`      SID:    ${smsData.sid}`);
        console.info(`      Status: ${smsData.status}`);
        console.info(`      To:     ${smsData.to}`);
        console.info(`      From:   ${smsData.from}`);
      } else {
        console.info(`   ❌ SMS failed: ${JSON.stringify(smsData).substring(0, 100)}`);
      }
    } catch (smsErr: any) {
      const msg = smsErr?.message || String(smsErr);
      console.info(`   ⚠️  SMS skipped: ${msg}`);
      if (fromNumber === toNumber) {
        console.info(
          `   ℹ️  Tip: TWILIO_FROM_NUMBER and TWILIO_TO_NUMBER must be different numbers.`
        );
        console.info(`          In trial mode, TWILIO_TO_NUMBER must be a verified caller ID.`);
      }
    }
    console.info();

    // ── EXAMPLE 3: Fetch the sent message ──────────────────────────────────
    if (sentMessageSid) {
      console.info('3️⃣  Fetching the sent message...');
      try {
        const fetchResult = await matimo.execute('twilio-get-message', {
          account_sid: accountSid,
          message_sid: sentMessageSid,
        });
        const fetchData = (fetchResult as any).data || fetchResult;

        if (fetchData.sid) {
          console.info(`   ✅ Message fetched!`);
          console.info(`      SID:          ${fetchData.sid}`);
          console.info(`      Status:       ${fetchData.status}`);
          console.info(`      Direction:    ${fetchData.direction}`);
          console.info(`      Num Segments: ${fetchData.num_segments}`);
          console.info(`      Date Created: ${fetchData.date_created}`);
        } else {
          console.info(
            `   ❌ Failed to fetch message: ${JSON.stringify(fetchData).substring(0, 100)}`
          );
        }
      } catch (fetchErr: any) {
        console.info(`   ⚠️  Fetch skipped: ${fetchErr?.message || fetchErr}`);
      }
      console.info();
    } else {
      console.info('3️⃣  Fetching sent message — skipped (no SMS was queued)');
      console.info();
    }

    // ── EXAMPLE 4: List messages filtered by recipient ────────────────────
    console.info('4️⃣  Listing messages filtered by recipient...');
    const filteredResult = await matimo.execute('twilio-list-messages', {
      account_sid: accountSid,
      to: toNumber,
      page_size: 5,
    });
    const filteredData = (filteredResult as any).data || filteredResult;

    if (filteredData.messages && Array.isArray(filteredData.messages)) {
      console.info(`   ✅ Found ${filteredData.messages.length} message(s) sent to ${toNumber}`);
    } else {
      console.info(`   ℹ️  Response: ${JSON.stringify(filteredData).substring(0, 100)}`);
    }
    console.info();
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.info('════════════════════════════════════════════════════════════');
  console.info('✨ Factory Pattern Example Complete!');
  console.info('════════════════════════════════════════════════════════════\n');
}

runTwilioFactoryExamples().catch(console.error);
