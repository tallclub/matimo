#!/usr/bin/env node
/**
 * ============================================================================
 * MICROSOFT GRAPH TOOLS - DECORATOR PATTERN EXAMPLE
 * ============================================================================
 *
 * PATTERN: Decorator Pattern with @tool
 * ─────────────────────────────────────────────────────────────────────────
 * Uses TypeScript @tool decorators to wrap Microsoft Graph tool calls in a class.
 *
 * Use this pattern when:
 * ✅ Building class-based applications
 * ✅ Encapsulating tool logic in services
 * ✅ Adding custom methods that combine multiple tools
 * ✅ Object-oriented design preferred
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create a .env file in project root:
 *    MICROSOFT_GRAPH_ACCESS_TOKEN=eyJ0eXAiOiJKV1Qi...
 *
 * 2. Same scopes as the factory pattern example (see microsoft-factory.ts)
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export MICROSOFT_GRAPH_ACCESS_TOKEN=your_token_here
 *   pnpm microsoft:decorator
 *
 * ============================================================================
 */

import 'dotenv/config';
import { MatimoInstance, tool, setGlobalMatimoInstance } from 'matimo';

/**
 * Function-tool failures resolve as `{ success: false, error, code, details }`
 * rather than throwing — callers must check `success` before treating the
 * result as the expected success payload (see FunctionExecutor.handleError).
 */
function isToolFailure(
  result: unknown
): result is { success: false; error: string; code?: string } {
  return (
    !!result &&
    typeof result === 'object' &&
    'success' in result &&
    (result as { success: unknown }).success === false
  );
}

function printOutcome(
  label: string,
  result: unknown,
  onSuccess: (data: Record<string, unknown>) => void
) {
  if (isToolFailure(result)) {
    console.info(`❌ ${label} — ${result.code ?? 'ERROR'}: ${result.error}`);
  } else {
    console.info(`✅ ${label}`);
    onSuccess(result as Record<string, unknown>);
  }
}

/**
 * Microsoft Graph Manager - class-based interface to Microsoft Graph tools.
 * Each method is decorated with @tool() which auto-executes via Matimo —
 * Matimo injects MICROSOFT_GRAPH_ACCESS_TOKEN from the environment.
 */
class MicrosoftGraphManager {
  @tool('ms_search_knowledge')
  async searchKnowledge(query: string, top?: number): Promise<unknown> {
    // Decorator intercepts -> matimo.execute('ms_search_knowledge', { query, top })
    throw new Error('Should not be called - decorator handles execution');
  }

  @tool('ms_list_files')
  async listFiles(drive_id: string, item_id?: string, top?: number): Promise<unknown> {
    throw new Error('Should not be called - decorator handles execution');
  }

  @tool('ms_get_email')
  async getEmail(top?: number, filter?: string): Promise<unknown> {
    throw new Error('Should not be called - decorator handles execution');
  }

  @tool('ms_send_teams_message')
  async sendTeamsMessage(team_id: string, channel_id: string, text: string): Promise<unknown> {
    throw new Error('Should not be called - decorator handles execution');
  }

  @tool('ms_create_calendar_event')
  async createCalendarEvent(
    subject: string,
    start: string,
    end: string,
    timezone?: string,
    is_online_meeting?: boolean
  ): Promise<unknown> {
    throw new Error('Should not be called - decorator handles execution');
  }
}

async function runDecoratorPatternExamples() {
  const args = process.argv.slice(2);
  let teamId = process.env.TEST_TEAM_ID || '';
  let channelId = process.env.TEST_CHANNEL_ID || '';

  for (const arg of args) {
    if (arg.startsWith('--team:')) teamId = arg.split(':')[1];
    if (arg.startsWith('--channel:')) channelId = arg.split(':')[1];
  }

  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Microsoft Graph Tools - Decorator Pattern         ║');
  console.info('║     (Uses @tool decorators for automatic execution)   ║');
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
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });
    setGlobalMatimoInstance(matimo);

    const msTools = matimo.listTools().filter((t) => t.name.startsWith('ms_'));
    console.info(`📦 Loaded ${msTools.length} Microsoft Graph tools\n`);

    const manager = new MicrosoftGraphManager();

    console.info('🧪 Testing Microsoft Graph Tools with Decorator Pattern');
    console.info('═'.repeat(60));

    // Example 1: Search via decorator
    console.info('\n🔍 Example 1: Search Organizational Knowledge via @tool Decorator');
    console.info('─'.repeat(60));
    try {
      const result = await manager.searchKnowledge('quarterly report', 5);
      printOutcome('Search complete', result, (data) => {
        const results = (data.results ?? []) as Array<{ name: string; web_url: string }>;
        console.info(`   Found ${(data.total_count as number) ?? 0} result(s):`);
        results.slice(0, 3).forEach((hit, idx) => {
          console.info(`   ${idx + 1}. ${hit.name} — ${hit.web_url}`);
        });
      });
    } catch (error) {
      console.info(`❌ Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Example 2: List recent inbox messages via decorator
    console.info('\n📬 Example 2: List Recent Inbox Messages via @tool Decorator');
    console.info('─'.repeat(60));
    try {
      const result = await manager.getEmail(5, 'isRead eq false');
      printOutcome('Inbox retrieved', result, (data) => {
        const messages = (data.messages ?? []) as Array<{ subject: string; from: string }>;
        console.info(`   Found ${messages.length} unread message(s):`);
        messages.slice(0, 3).forEach((msg, idx) => {
          console.info(`   ${idx + 1}. "${msg.subject}" — from ${msg.from}`);
        });
      });
    } catch (error) {
      console.info(`❌ List failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Example 3: Post a Teams channel message via decorator
    console.info('\n💬 Example 3: Post a Teams Channel Message via @tool Decorator');
    console.info('─'.repeat(60));
    if (!teamId || !channelId) {
      console.info(
        '⊘ Skipping — pass --team:<team_id> --channel:<channel_id> (or set TEST_TEAM_ID / TEST_CHANNEL_ID) to try this'
      );
    } else {
      try {
        const result = await manager.sendTeamsMessage(
          teamId,
          channelId,
          'Hello from the Matimo decorator pattern example! 👋'
        );
        printOutcome('Message posted', result, (data) => {
          console.info(`   Message ID: ${data.message_id}`);
        });
      } catch (error) {
        console.info(`❌ Send failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Example 4: Create a calendar event via decorator
    console.info('\n📅 Example 4: Create a Calendar Event via @tool Decorator');
    console.info('─'.repeat(60));
    try {
      const result = await manager.createCalendarEvent(
        'Matimo Decorator Pattern — Sync',
        '2026-06-16T10:00:00',
        '2026-06-16T10:30:00',
        'UTC',
        false
      );
      printOutcome('Event created', result, (data) => {
        console.info(`   Event ID: ${data.event_id}`);
        console.info(`   Web link: ${data.web_link}`);
      });
    } catch (error) {
      console.info(
        `❌ Create event failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    console.info('\n' + '═'.repeat(60));
    console.info('✨ Decorator Pattern Examples Complete!\n');
    console.info('Usage:');
    console.info('  pnpm microsoft:decorator');
    console.info('  pnpm microsoft:decorator -- --team:<team_id> --channel:<channel_id>\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

runDecoratorPatternExamples().catch(console.error);
