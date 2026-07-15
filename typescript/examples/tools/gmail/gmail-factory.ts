#!/usr/bin/env node
/**
 * ============================================================================
 * GMAIL TOOLS - FACTORY PATTERN EXAMPLE
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
 *    GMAIL_ACCESS_TOKEN=ya29.xxxxxxxxxxxxx
 *
 * 2. Get a Gmail access token:
 *    - Use OAuth2Handler to authenticate with Google
 *    - Request these scopes:
 *      • https://www.googleapis.com/auth/gmail.send (send emails)
 *      • https://www.googleapis.com/auth/gmail.readonly (read emails)
 *      • https://www.googleapis.com/auth/gmail.modify (drafts, delete)
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export GMAIL_ACCESS_TOKEN=your_token_here
 *   npm run gmail:factory
 *
 * AVAILABLE TOOLS:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. gmail-send-email
 *    Parameters: to (required), subject (required), body (required), [cc], [bcc]
 *    Returns: { id, threadId, labelIds }
 *    Example: Send an email to someone@example.com
 *
 * 2. gmail-list-messages
 *    Parameters: [query], [maxResults], [pageToken]
 *    Returns: { messages[], nextPageToken }
 *    Example queries: "is:unread", "from:someone@example.com", "has:attachment"
 *
 * 3. gmail-get-message
 *    Parameters: messageId, [format]
 *    Format options: "minimal" (lightweight), "full" (complete with headers)
 *    Returns: { payload { headers, body }, snippet }
 *
 * 4. gmail-create-draft
 *    Parameters: to, subject, body, [cc], [bcc]
 *    Returns: { id, message { id, threadId } }
 *    Note: Draft is created but not sent - user edits then sends manually
 *
 * 5. gmail-delete-message
 *    Parameters: messageId
 *    Returns: { success }
 *    Note: Permanently deletes the message
 *
 * 6. gmail-get-attachment
 *    Parameters: messageId (required), attachmentId (required)
 *    Returns: { attachmentId, size, data } — data is base64url-encoded raw bytes
 *    Example: Fetch the raw bytes of an attachment found on a message
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatimoInstance, MatimoError } from 'matimo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Render a MatimoError with its underlying HTTP status/body, not just the
 * generic wrapper message — e.g. surfaces "401 Unauthorized: token expired"
 * instead of just "HTTP error executing tool 'gmail-list-messages'".
 */
function describeError(error: unknown): string {
  if (error instanceof MatimoError && error.details) {
    const status = error.details.statusCode;
    const body = error.details.details;
    let extra = status ? ` (status ${status})` : '';
    if (body) extra += `\n   → ${JSON.stringify(body)}`;
    return `${error.message}${extra}`;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Run factory pattern examples
 */
async function runFactoryPatternExamples() {
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
  console.info('║     Gmail Tools - Factory Pattern                      ║');
  console.info('║     (Direct execution - simplest approach)             ║');
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

    const matimoTools = matimo.listTools();
    console.info(`📦 Loaded ${matimoTools.length} tools:\n`);
    matimoTools.forEach((t) => {
      console.info(`  • ${t.name}`);
      console.info(`    ${t.description}\n`);
    });

    // Filter to Gmail tools
    const gmailTools = matimoTools.filter((t) => t.name.startsWith('gmail-'));
    console.info(`📧 Found ${gmailTools.length} Gmail tools\n`);

    console.info('🧪 Testing Gmail Tools with Factory Pattern');
    console.info('═'.repeat(60));

    // Example 1: List Messages (GET emails)
    console.info('\n📬 Example 1: List Your Recent Messages');
    console.info('─'.repeat(60));
    try {
      const listResult = await matimo.execute('gmail-list-messages', {
        maxResults: 5,
        GMAIL_ACCESS_TOKEN: accessToken,
      });
      console.info('📤 Raw Result:', JSON.stringify(listResult, null, 2));

      if (typeof listResult === 'object' && listResult !== null) {
        const data = listResult as any;
        if (data.data?.messages && Array.isArray(data.data.messages)) {
          console.info(`✅ Found ${data.data.messages.length} recent messages:`);
          data.data.messages.slice(0, 3).forEach((msg: any, idx: number) => {
            console.info(`   ${idx + 1}. ID: ${msg.id}`);
            console.info(`      Thread: ${msg.threadId}`);
          });
        } else if (data.messages && Array.isArray(data.messages)) {
          console.info(`✅ Found ${data.messages.length} recent messages:`);
          data.messages.slice(0, 3).forEach((msg: any, idx: number) => {
            console.info(`   ${idx + 1}. ID: ${msg.id}`);
            console.info(`      Thread: ${msg.threadId}`);
          });
        } else {
          console.info('❌ Unexpected response format');
        }
      }
    } catch (error) {
      console.info(`❌ List failed: ${describeError(error)}`);
      console.info(JSON.stringify(error, null, 2));
    }

    // Example 2: Send Email
    console.info('\n📧 Example 2: Send Email');
    console.info('─'.repeat(60));
    try {
      // Simple API - just pass to, subject, body
      // Matimo automatically converts to MIME format (defined in YAML)
      const sendResult = await matimo.execute('gmail-send-email', {
        to: userEmail,
        subject: 'Hello from Matimo Factory Pattern',
        body: 'This is a test email from the Factory pattern',
        GMAIL_ACCESS_TOKEN: accessToken,
      });
      console.info('📤 Raw Result:', JSON.stringify(sendResult, null, 2));

      if (typeof sendResult === 'object' && sendResult !== null) {
        const data = sendResult as any;
        if (data.data?.id) {
          console.info(`✅ Email sent successfully!`);
          console.info(`   Message ID: ${data.data.id}`);
          console.info(`   Thread ID: ${data.data.threadId || 'N/A'}`);
        } else if (data.id) {
          console.info(`✅ Email sent successfully!`);
          console.info(`   Message ID: ${data.id}`);
          console.info(`   Thread ID: ${data.threadId || 'N/A'}`);
        } else {
          console.info('❌ Unexpected response format');
        }
      }
    } catch (error) {
      console.info(`❌ Send failed: ${describeError(error)}`);
      console.info(JSON.stringify(error, null, 2));
    }

    // Example 3: Create Draft
    console.info('\n✏️  Example 3: Create Draft');
    console.info('─'.repeat(60));
    try {
      // Simple API - just pass to, subject, body
      // Matimo automatically converts to MIME format (defined in YAML)
      const draftResult = await matimo.execute('gmail-create-draft', {
        to: userEmail,
        subject: 'Factory Pattern Draft',
        body: 'This is a draft created by the Factory pattern',
        GMAIL_ACCESS_TOKEN: accessToken,
      });
      console.info('📤 Raw Result:', JSON.stringify(draftResult, null, 2));

      if (typeof draftResult === 'object' && draftResult !== null) {
        const data = draftResult as any;
        if (data.data?.id) {
          console.info(`✅ Draft created successfully!`);
          console.info(`   Draft ID: ${data.data.id}`);
          console.info(`   Message ID: ${data.data.message?.id || 'N/A'}`);
        } else if (data.id) {
          console.info(`✅ Draft created successfully!`);
          console.info(`   Draft ID: ${data.id}`);
        } else {
          console.info('❌ Unexpected response format');
        }
      }
    } catch (error) {
      console.info(`❌ Draft failed: ${describeError(error)}`);
      console.info(JSON.stringify(error, null, 2));
    }

    // Example 4: Get Attachment
    console.info('\n📎 Example 4: Get Attachment');
    console.info('─'.repeat(60));
    try {
      // NOTE: we deliberately do NOT use `query: 'has:attachment'` here.
      // Gmail's `q` search param requires an app that has completed Google's
      // OAuth verification review — unverified apps get a 403 ("Metadata
      // scope does not support 'q' parameter") even with gmail.readonly
      // granted. Instead, scan recent messages client-side for an attachment.
      const listResult = await matimo.execute('gmail-list-messages', {
        maxResults: 10,
        GMAIL_ACCESS_TOKEN: accessToken,
      });
      const listData = (listResult as any).data ?? listResult;
      const candidates: any[] = listData?.messages ?? [];

      let found: { messageId: string; filename?: string; attachmentId: string } | null = null;

      for (const candidate of candidates) {
        const messageResult = await matimo.execute('gmail-get-message', {
          messageId: candidate.id,
          format: 'full',
          GMAIL_ACCESS_TOKEN: accessToken,
        });
        const messageData = (messageResult as any).data ?? messageResult;
        const parts: any[] = messageData?.payload?.parts ?? [];
        const attachmentPart = parts.find((p) => p?.body?.attachmentId);

        if (attachmentPart) {
          found = {
            messageId: candidate.id,
            filename: attachmentPart.filename,
            attachmentId: attachmentPart.body.attachmentId,
          };
          break;
        }
      }

      if (!found) {
        console.info(
          `ℹ️  Scanned ${candidates.length} recent messages — none had an attachment. Skipping.`
        );
      } else {
        const attachmentResult = await matimo.execute('gmail-get-attachment', {
          messageId: found.messageId,
          attachmentId: found.attachmentId,
          GMAIL_ACCESS_TOKEN: accessToken,
        });
        const attachmentData = (attachmentResult as any).data ?? attachmentResult;
        console.info(`✅ Attachment retrieved successfully!`);
        console.info(`   Filename: ${found.filename || '(unnamed)'}`);
        console.info(`   Size: ${attachmentData.size} bytes`);
        console.info(`   Base64url data length: ${attachmentData.data?.length ?? 0} chars`);
      }
    } catch (error) {
      console.info(`❌ Get attachment failed: ${describeError(error)}`);
    }

    console.info('\n' + '═'.repeat(60));
    console.info('✨ Factory Pattern Examples Complete!\n');
    console.info('Usage:');
    console.info('  npm run gmail:factory');
    console.info('  npm run gmail:factory -- --email:your-email@gmail.com\n');
  } catch (error) {
    console.error('❌ Error:', describeError(error));
    process.exit(1);
  }
}

// Run the examples
runFactoryPatternExamples().catch(console.error);
