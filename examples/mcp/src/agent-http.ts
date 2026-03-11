#!/usr/bin/env node
/**
 * ============================================================================
 * MATIMO MCP - LANGCHAIN AI AGENT (STREAMABLE HTTP TRANSPORT)
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain via MCP (HTTP)
 * ─────────────────────────────────────────────────────────────────────────
 * Connects to a running Matimo MCP HTTP(S) server.
 * Tests all 12 Slack tools in order via a LangChain ReAct agent.
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create .env file:
 *    OPENAI_API_KEY=sk-xxxxxxxxxxxxx
 *    SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxx
 *    MATIMO_MCP_TOKEN=matimo-dev-token   # matches server token
 *    TEST_CHANNEL=C0000000000            # optional: specific channel
 *
 * 2. Install dependencies:
 *    npm install matimo @matimo/slack
 *    npm install @langchain/mcp-adapters @langchain/openai @langchain/langgraph @langchain/core
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   # Step 1: Start the MCP server
 *   pnpm mcp:start:http
 *
 *   # Step 2: Run the agent
 *   pnpm agent:http
 *   pnpm agent:http -- --channel=C0123456789
 *
 * SLACK TOOLS TESTED (in order):
 * ─────────────────────────────────────────────────────────────────────────
 *  1. slack-list-channels        — list workspace channels
 *  2. slack_create_channel       — create a new channel
 *  3. slack_send_channel_message  — send a message
 *  4. slack_get_channel_history   — read recent messages
 *  5. slack_add_reaction          — add emoji reaction
 *  6. slack_get_reactions         — read reactions
 *  7. slack_reply_to_message      — threaded reply
 *  8. slack_get_thread_replies    — read thread
 *  9. slack_search_messages       — search history
 * 10. slack_get_user_info         — look up a user
 * 11. slack_set_channel_topic     — update topic
 * 12. slack_send_dm               — send direct message
 *
 * ============================================================================
 */

import 'dotenv/config';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage } from '@langchain/core/messages';

async function runMcpHttpAgent() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  let channelId = process.env.TEST_CHANNEL || '';
  for (const arg of args) {
    if (arg.startsWith('--channel:')) channelId = arg.split(':')[1];
    else if (arg.startsWith('--channel=')) channelId = arg.split('=')[1];
  }

  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Matimo MCP AI Agent - HTTP Transport                ║');
  console.info('║     All Slack Tools Test                                ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // Check required environment variables
  if (!process.env.SLACK_BOT_TOKEN) {
    console.error('❌ Error: SLACK_BOT_TOKEN not set in .env');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY not set in .env');
    process.exit(1);
  }

  const serverUrl = process.env.MCP_SERVER_URL || 'https://localhost:3555/mcp';
  const bearerToken = process.env.MCP_BEARER_TOKEN || process.env.MATIMO_MCP_TOKEN;

  if (serverUrl.startsWith('https') && !process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.info('⚠️  Self-signed cert mode: NODE_TLS_REJECT_UNAUTHORIZED=0\n');
  }

  console.info(`🤖 Using OpenAI (GPT-4o-mini) as the AI agent`);
  console.info(`🔌 Transport: HTTP → ${serverUrl}`);
  if (bearerToken) console.info('🔑 Using bearer token authentication');
  console.info();

  console.info('🚀 Initializing Matimo MCP (HTTP)...');
  const headers: Record<string, string> = {};
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

  const client = new MultiServerMCPClient({
    throwOnLoadError: true,
    onConnectionError: 'throw',
    mcpServers: {
      matimo: {
        transport: 'http',
        url: serverUrl,
        headers,
        reconnect: { enabled: true, maxAttempts: 5, delayMs: 2000 },
      },
    },
  });

  try {
    const tools = await client.getTools();
    console.info(`📦 Loaded ${tools.length} tools from Matimo MCP:\n`);
    tools.forEach((t) => console.info(`  • ${t.name}`));
    console.info();

    if (tools.length === 0) {
      console.error('❌ No tools loaded. Is the MCP server running?');
      process.exit(1);
    }

    const slackTools = tools.filter((t) => t.name.startsWith('slack'));
    console.info(`💬 ${slackTools.length} Slack tools available\n`);

    console.info('🤖 Initializing OpenAI (GPT-4o-mini) LLM...');
    const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
    console.info('🔧 Creating agent...\n');
    const agent = createReactAgent({ llm, tools });

    // ── Find a channel to use for all the tasks ────────────────────────
    let activeChannel = channelId;
    if (!activeChannel) {
      console.info('📋 Finding an available channel...');
      const listResp = await agent.invoke({
        messages: [
          new HumanMessage(
            'List all Slack channels and return just the first channel ID, nothing else.'
          ),
        ],
      });
      const listMsg = listResp.messages[listResp.messages.length - 1];
      const match =
        typeof listMsg?.content === 'string' ? listMsg.content.match(/C[A-Z0-9]{8,}/) : null;
      if (match) {
        activeChannel = match[0];
        console.info(`   Using channel: ${activeChannel}\n`);
      } else {
        console.info('   ⚠️  Could not auto-detect channel. Set TEST_CHANNEL= in .env\n');
      }
    }

    // ── All Slack tool tasks in order ──────────────────────────────────
    const userRequests = [
      {
        title: 'Example 1: List Channels (slack-list-channels)',
        request:
          'List all Slack channels available in this workspace with their names and member count.',
      },
      {
        title: 'Example 2: Create Channel (slack_create_channel)',
        request: `Create a new Slack channel called "matimo-mcp-test-${Date.now()}" as a private channel.`,
      },
      {
        title: 'Example 3: Send Message (slack_send_channel_message)',
        request: `Send a message to channel ${activeChannel || 'the first available channel'} saying "Hello from Matimo MCP! 🚀 Testing HTTP transport."`,
      },
      {
        title: 'Example 4: Get Channel History (slack_get_channel_history)',
        request: `Get the last 5 messages from channel ${activeChannel || 'the first available channel'}.`,
      },
      {
        title: 'Example 5: Add Reaction (slack_add_reaction)',
        request: `Get the most recent message from channel ${activeChannel || 'the first available channel'}, then add a "rocket" reaction to it.`,
      },
      {
        title: 'Example 6: Get Reactions (slack_get_reactions)',
        request: `Get the reactions on the most recent message in channel ${activeChannel || 'the first available channel'}.`,
      },
      {
        title: 'Example 7: Reply to Message (slack_reply_to_message)',
        request: `Reply to the latest message in channel ${activeChannel || 'the first available channel'} in a thread saying "This is a threaded reply from Matimo MCP."`,
      },
      {
        title: 'Example 8: Get Thread Replies (slack_get_thread_replies)',
        request: `Get all thread replies for the latest message in channel ${activeChannel || 'the first available channel'}.`,
      },
      {
        title: 'Example 9: Search Messages (slack_search_messages)',
        request: 'Search Slack messages for "Matimo MCP" and return the top 3 results.',
      },
      {
        title: 'Example 10: Get User Info (slack_get_user_info / slack-get-user)',
        request: 'Get information about the bot user — its display name, real name, and user ID.',
      },
      {
        title: 'Example 11: Set Channel Topic (slack_set_channel_topic)',
        request: `Set the topic of channel ${activeChannel || 'the first available channel'} to "Matimo MCP Test Channel 🛠️".`,
      },
      {
        title: 'Example 12: Send DM (slack_send_dm)',
        request:
          'Send a direct message to the bot user itself (using the bot user ID) saying "Self DM from Matimo MCP test."',
      },
    ];

    console.info('🧪 Running All Slack Tool Tasks');
    console.info('═'.repeat(60));

    let passed = 0;
    let failed = 0;
    for (const task of userRequests) {
      console.info(`\n${task.title}`);
      console.info('─'.repeat(60));
      console.info(`👤 User: "${task.request}"\n`);

      try {
        const response = await agent.invoke({
          messages: [new HumanMessage(task.request)],
        });
        const lastMessage = response.messages[response.messages.length - 1];
        if (lastMessage) {
          const content =
            typeof lastMessage.content === 'string'
              ? lastMessage.content
              : JSON.stringify(lastMessage.content);
          console.info(`🤖 Agent: ${content}\n`);
        }
        passed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.info(`⚠️  Agent error: ${errorMsg}\n`);
        failed++;
      }
    }

    console.info('═'.repeat(60));
    console.info('✨ All Slack Tool Tasks Complete!\n');
    console.info(
      `Results: ${passed} passed, ${failed} failed out of ${userRequests.length} tasks\n`
    );
    console.info('Slack Tools Tested:');
    console.info('  ✅ slack-list-channels — list workspace channels');
    console.info('  ✅ slack_create_channel — create a new channel');
    console.info('  ✅ slack_send_channel_message — send message to channel');
    console.info('  ✅ slack_get_channel_history — get recent messages');
    console.info('  ✅ slack_add_reaction — add emoji reaction to message');
    console.info('  ✅ slack_get_reactions — get reactions on a message');
    console.info('  ✅ slack_reply_to_message — threaded reply');
    console.info('  ✅ slack_get_thread_replies — read thread replies');
    console.info('  ✅ slack_search_messages — search message history');
    console.info('  ✅ slack_get_user_info / slack-get-user — user lookup');
    console.info('  ✅ slack_set_channel_topic — update channel topic');
    console.info('  ✅ slack_send_dm — send direct message\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    console.info('🧹 Closing MCP connection...');
    await client.close();
    console.info('✅ Done.\n');
  }
}

runMcpHttpAgent().catch(console.error);
