#!/usr/bin/env node
/**
 * ============================================================================
 * SLACK TOOLS - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide which Slack tools to use
 * 3. Generates appropriate parameters based on context
 * 4. Executes tools autonomously
 * 5. Processes results and responds naturally
 *
 * Use this pattern when:
 * ✅ Building true autonomous AI agents
 * ✅ LLM should decide which tools to use
 * ✅ Complex workflows with LLM reasoning
 * ✅ Multi-step agentic processes
 * ✅ User gives high-level instructions (not low-level API calls)
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create .env file:
 *    SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxx
 *    OPENAI_API_KEY=sk-xxxxxxxxxxxxx
 *
 * 2. Install dependencies:
 *    npm install
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export SLACK_BOT_TOKEN=xoxb-xxxx
 *   export OPENAI_API_KEY=sk-xxxx
 *   npm run slack:langchain
 *
 * WHAT IT DOES:
 * ─────────────────────────────────────────────────────────────────────────
 * This example shows an AI agent that can:
 * 1. List Slack channels
 * 2. Send messages to channels
 * 3. Search message history
 * 4. Retrieve channel information
 * 5. Respond naturally in conversation style
 *
 * Example conversation:
 *   User: "Send a test message to #general"
 *   AI Agent: "I'll send a test message to the general channel..."
 *   [AI Agent calls slack-send-message tool]
 *   AI Agent: "Done! Message sent successfully."
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { MatimoInstance, convertToolsToLangChain, ToolDefinition } from 'matimo';

/**
 * Run AI Agent with Slack tools
 * The agent receives natural language requests and decides which Slack tools to use
 */
async function runSlackAIAgent() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  let channelId = process.env.TEST_CHANNEL || 'C0000000000';

  for (const arg of args) {
    if (arg.startsWith('--channel:')) {
      channelId = arg.split(':')[1];
    } else if (arg.startsWith('--channel=')) {
      channelId = arg.split('=')[1];
    }
  }

  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Slack AI Agent - LangChain + OpenAI               ║');
  console.info('║     True autonomous agent with LLM reasoning          ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // Check required environment variables
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    console.error('❌ Error: SLACK_BOT_TOKEN not set in .env');
    console.info('   Set it: export SLACK_BOT_TOKEN="xoxb-..."');
    console.info('   Get one from: https://api.slack.com/apps');
    process.exit(1);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in .env');
    console.info('   Set it: export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  console.info(`📍 Target Channel: ${channelId}`);
  console.info(`🤖 Using OpenAI (GPT-4o-mini) as the AI agent\n`);

  try {
    // Initialize Matimo with auto-discovery
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Get Slack tools and convert to LangChain format
    console.info('💬 Loading Slack tools...');
    const matimoTools = matimo.listTools();
    const slackTools = matimoTools.filter((t) => t.name.startsWith('slack'));
    console.info(`✅ Loaded ${slackTools.length} Slack tools\n`);

    // Find an available channel before creating agent
    console.info('📋 Finding an available channel...');
    const listChannelsResult = await matimo.execute('slack-list-channels', {
      types: 'public_channel,private_channel',
      limit: 10,
    });

    const listData = (listChannelsResult as any).data || listChannelsResult;
    let activeChannel = channelId;

    if (listData.ok === true && listData.channels && listData.channels.length > 0) {
      const defaultChannelExists = listData.channels.some((ch: any) => ch.id === channelId);
      if (!defaultChannelExists) {
        activeChannel = listData.channels[0].id;
        console.info(
          `   Using first available channel: #${listData.channels[0].name} (${activeChannel})\n`
        );
      } else {
        console.info(
          `   Using specified channel: #${listData.channels.find((ch: any) => ch.id === channelId)?.name} (${channelId})\n`
        );
      }
    } else {
      console.info(`   ⚠️  Could not list channels, using default: ${channelId}\n`);
    }

    // Convert to LangChain tools (select key ones for agent)
    const keySlackTools = slackTools.filter((t) =>
      [
        'slack-send-message',
        'slack-list-channels',
        'slack_get_channel_history',
        'slack_search_messages',
        'slack_get_user_info',
      ].includes(t.name)
    );

    // ✅ Convert Matimo tools to LangChain format using the new integration
    const langchainTools = await convertToolsToLangChain(
      keySlackTools as ToolDefinition[],
      matimo,
      {
        SLACK_BOT_TOKEN: botToken,
      }
    );

    // Initialize OpenAI LLM
    console.info('🤖 Initializing OpenAI (GPT-4o-mini) LLM...');
    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
    });

    // Create agent
    console.info('🔧 Creating agent...\n');
    const agent = await createAgent({
      model,
      tools: langchainTools as any[], // Type casting for LangChain tools
    });

    // Define agent tasks (natural language requests)
    const userRequests = [
      {
        title: 'Example 1: List channels',
        request: 'What Slack channels are available in this workspace?',
      },
      {
        title: 'Example 2: Send a message',
        request: `Send a test message to channel ${activeChannel} saying "Hello from AI Agent! This message was sent autonomously."`,
      },
      {
        title: 'Example 3: Get channel history',
        request: `What are the recent messages in channel ${activeChannel}?`,
      },
    ];

    console.info('🧪 Running AI Agent Tasks');
    console.info('═'.repeat(60));

    // Run each task through the agent
    for (const task of userRequests) {
      console.info(`\n${task.title}`);
      console.info('─'.repeat(60));
      console.info(`👤 User: "${task.request}"\n`);

      try {
        const response = await agent.invoke({
          messages: [
            {
              role: 'user',
              content: task.request,
            },
          ],
        });

        // Get the last message from the agent
        const lastMessage = response.messages[response.messages.length - 1];
        if (lastMessage) {
          if (typeof lastMessage.content === 'string') {
            console.info(`🤖 Agent: ${lastMessage.content}\n`);
          } else {
            console.info(`🤖 Agent:`, lastMessage.content, '\n');
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.info(`⚠️  Agent error: ${errorMsg}\n`);
      }
    }

    console.info('═'.repeat(60));
    console.info('✨ AI Agent Examples Complete!\n');
    console.info('Key Features:');
    console.info('  ✅ Real LLM (OpenAI) decides which tools to use');
    console.info('  ✅ Natural language requests, not API calls');
    console.info('  ✅ LLM generates tool parameters based on context');
    console.info('  ✅ Agentic reasoning and decision-making\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the AI agent
runSlackAIAgent().catch(console.error);
