#!/usr/bin/env node
/**
 * ============================================================================
 * MICROSOFT GRAPH TOOLS - FACTORY PATTERN EXAMPLE
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
 * 1. Register an app in the Microsoft Entra admin center (https://entra.microsoft.com)
 *    and obtain a delegated Microsoft Graph access token. Common scopes:
 *      • Sites.Read.All / Files.Read.All  (search, read, list)
 *      • Mail.Read / Mail.Send            (mail)
 *      • ChannelMessage.Send              (Teams)
 *      • Calendars.ReadWrite              (calendar)
 *      • Files.ReadWrite / Sites.Manage.All (uploads, SharePoint pages)
 *
 * 2. Create a .env file in project root:
 *    MICROSOFT_GRAPH_ACCESS_TOKEN=eyJ0eXAiOiJKV1Qi...
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export MICROSOFT_GRAPH_ACCESS_TOKEN=your_token_here
 *   pnpm microsoft:factory
 *
 * AVAILABLE TOOLS:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. ms_search_knowledge      Search SharePoint/OneDrive/sites — POST /search/query
 * 2. ms_read_file             Read a file's contents — GET /drives/{id}/items/{id}/content
 * 3. ms_list_files            List a folder's children — GET /drives/{id}/items/{id}/children
 * 4. ms_get_email             List inbox messages — GET /me/messages
 * 5. ms_send_email            Send an email (HIGH risk, requires approval)
 * 6. ms_send_teams_message    Post to a Teams channel — POST /teams/{id}/channels/{id}/messages
 * 7. ms_create_document       Upload a small file (≤4 MB) — PUT .../content
 * 8. ms_create_calendar_event Create a calendar event, optionally a Teams meeting
 * 9. ms_publish_to_sharepoint Create + publish a SharePoint page (HIGH risk, requires approval)
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatimoInstance } from 'matimo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Function-tool failures resolve as `{ success: false, error, code, details }`
 * rather than throwing — callers must check `success` before treating the
 * result as the expected success payload (see FunctionExecutor.handleError).
 */
function isToolFailure(
  result: unknown
): result is { success: false; error: string; code?: string; details?: unknown } {
  return (
    !!result &&
    typeof result === 'object' &&
    'success' in result &&
    (result as { success: unknown }).success === false
  );
}

function printFailure(label: string, result: { error: string; code?: string }) {
  console.info(`❌ ${label} — ${result.code ?? 'ERROR'}: ${result.error}`);
}

async function runFactoryPatternExamples() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  let driveId = process.env.TEST_DRIVE_ID || '';
  let itemId = process.env.TEST_ITEM_ID || 'root';

  for (const arg of args) {
    if (arg.startsWith('--drive:')) driveId = arg.split(':')[1];
    if (arg.startsWith('--item:')) itemId = arg.split(':')[1];
  }

  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Microsoft Graph Tools - Factory Pattern           ║');
  console.info('║     (Direct execution - simplest approach)            ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  const accessToken = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('❌ Error: MICROSOFT_GRAPH_ACCESS_TOKEN not set in .env');
    console.info('   Set it: export MICROSOFT_GRAPH_ACCESS_TOKEN="eyJ0eXAi...."');
    console.info('   Get a token via the Entra admin center or Graph Explorer:');
    console.info('   https://developer.microsoft.com/en-us/graph/graph-explorer');
    process.exit(1);
  }

  try {
    // Initialize Matimo
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    const matimoTools = matimo.listTools();
    const msTools = matimoTools.filter((t) => t.name.startsWith('ms_'));
    console.info(`📦 Loaded ${msTools.length} Microsoft Graph tools:\n`);
    msTools.forEach((t) => {
      console.info(`  • ${t.name}`);
      console.info(`    ${t.description}\n`);
    });

    console.info('🧪 Testing Microsoft Graph Tools with Factory Pattern');
    console.info('═'.repeat(60));

    // Example 1: Search organizational knowledge
    console.info('\n🔍 Example 1: Search Organizational Knowledge');
    console.info('─'.repeat(60));
    try {
      const searchResult = await matimo.execute(
        'ms_search_knowledge',
        { query: 'quarterly report', top: 5 },
        { credentials: { MICROSOFT_GRAPH_ACCESS_TOKEN: accessToken } }
      );

      if (isToolFailure(searchResult)) {
        printFailure('Search failed', searchResult);
      } else {
        const { results, total_count } = searchResult as {
          results?: Array<{ id: string; name: string; web_url: string }>;
          total_count?: number;
        };
        console.info(`✅ Found ${total_count ?? 0} result(s):`);
        (results ?? []).slice(0, 3).forEach((hit, idx) => {
          console.info(`   ${idx + 1}. ${hit.name} — ${hit.web_url}`);
        });
      }
    } catch (error) {
      console.info(`❌ Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Example 2: List files in OneDrive/SharePoint
    console.info('\n📁 Example 2: List Files in a Drive Folder');
    console.info('─'.repeat(60));
    if (!driveId) {
      console.info('⊘ Skipping — pass --drive:<drive_id> or set TEST_DRIVE_ID to try this');
    } else {
      try {
        const listResult = await matimo.execute(
          'ms_list_files',
          { drive_id: driveId, item_id: itemId, top: 10 },
          { credentials: { MICROSOFT_GRAPH_ACCESS_TOKEN: accessToken } }
        );

        if (isToolFailure(listResult)) {
          printFailure('List failed', listResult);
        } else {
          const { items } = listResult as { items?: Array<{ name: string; type: string }> };
          console.info(`✅ Found ${items?.length ?? 0} item(s):`);
          (items ?? []).slice(0, 5).forEach((item, idx) => {
            console.info(`   ${idx + 1}. [${item.type}] ${item.name}`);
          });
        }
      } catch (error) {
        console.info(`❌ List failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Example 3: List recent inbox messages
    console.info('\n📬 Example 3: List Recent Inbox Messages');
    console.info('─'.repeat(60));
    try {
      const emailResult = await matimo.execute(
        'ms_get_email',
        { top: 5, filter: 'isRead eq false' },
        { credentials: { MICROSOFT_GRAPH_ACCESS_TOKEN: accessToken } }
      );

      if (isToolFailure(emailResult)) {
        printFailure('List failed', emailResult);
      } else {
        const { messages } = emailResult as { messages?: Array<{ subject: string; from: string }> };
        console.info(`✅ Found ${messages?.length ?? 0} unread message(s):`);
        (messages ?? []).slice(0, 3).forEach((msg, idx) => {
          console.info(`   ${idx + 1}. "${msg.subject}" — from ${msg.from}`);
        });
      }
    } catch (error) {
      console.info(`❌ List failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Example 4: Create a calendar event with a Teams meeting
    console.info('\n📅 Example 4: Create a Calendar Event with a Teams Meeting');
    console.info('─'.repeat(60));
    try {
      const eventResult = await matimo.execute(
        'ms_create_calendar_event',
        {
          subject: 'Matimo Factory Pattern — Sync',
          start: '2026-06-15T09:00:00',
          end: '2026-06-15T09:30:00',
          timezone: 'UTC',
          is_online_meeting: true,
        },
        { credentials: { MICROSOFT_GRAPH_ACCESS_TOKEN: accessToken } }
      );

      if (isToolFailure(eventResult)) {
        printFailure('Create event failed', eventResult);
      } else {
        const { event_id, web_link, join_url } = eventResult as {
          event_id?: string;
          web_link?: string;
          join_url?: string;
        };
        console.info(`✅ Event created!`);
        console.info(`   Event ID: ${event_id}`);
        console.info(`   Web link: ${web_link}`);
        if (join_url) console.info(`   Join URL: ${join_url}`);
      }
    } catch (error) {
      console.info(
        `❌ Create event failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    console.info('\n' + '═'.repeat(60));
    console.info('✨ Factory Pattern Examples Complete!\n');
    console.info('Usage:');
    console.info('  pnpm microsoft:factory');
    console.info('  pnpm microsoft:factory -- --drive:<drive_id> --item:<folder_item_id>\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

runFactoryPatternExamples().catch(console.error);
