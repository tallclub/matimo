#!/usr/bin/env node
/**
 * ============================================================================
 * TWILIO TOOLS - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide which Twilio tools to use
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
 *    TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *    TWILIO_AUTH_TOKEN=your_auth_token_here
 *    TWILIO_FROM_NUMBER=+15557122661
 *    TWILIO_TO_NUMBER=+15558675310
 *    OPENAI_API_KEY=sk-xxxxxxxxxxxxx
 *
 *    Matimo automatically handles base64 Basic Auth encoding — no extra steps!
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   pnpm twilio:langchain
 *
 * WHAT IT DOES:
 * ─────────────────────────────────────────────────────────────────────────
 * This example shows an AI agent that can:
 * 1. Check recent message history
 * 2. Send SMS messages based on instructions
 * 3. Retrieve message delivery status
 * 4. Filter and search messages
 *
 * Example conversation:
 *   User: "Send a test SMS to my phone number"
 *   AI Agent: "I'll send a test SMS using twilio-send-sms..."
 *   [AI Agent calls twilio-send-sms tool]
 *   AI Agent: "Done! SMS sent successfully with SID: SM..."
 *
 * ============================================================================
 */

import 'dotenv/config';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { MatimoInstance, convertToolsToLangChain, ToolDefinition } from 'matimo';

/**
 * Run Twilio AI Agent with LangChain
 * The agent receives natural language requests and decides which Twilio tools to use
 */
async function runTwilioAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Twilio AI Agent - LangChain + OpenAI               ║');
  console.info('║     True autonomous agent with LLM reasoning           ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // Check required environment variables
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
    process.exit(1);
  }

  const toNumber = process.env.TWILIO_TO_NUMBER;
  if (!toNumber) {
    console.error('❌ Error: TWILIO_TO_NUMBER not set in .env');
    console.info('   Set it: export TWILIO_TO_NUMBER="+15558675310"');
    process.exit(1);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in .env');
    console.info('   Set it: export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  console.info(`🔑 Account SID: Configured`);
  console.info(`📤 From Number: ${fromNumber}`);
  console.info(`📥 To Number:   ${toNumber}`);
  console.info(`🤖 Using OpenAI (GPT-4o-mini) as the AI agent\n`);

  try {
    // Initialize Matimo with auto-discovery
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Get Twilio tools and convert to LangChain format
    console.info('📱 Loading Twilio tools...');
    const allTools = matimo.listTools();
    const twilioTools = allTools.filter((t) => t.name.startsWith('twilio-'));
    console.info(`✅ Loaded ${twilioTools.length} Twilio tools\n`);

    // List recent messages first to give agent context
    console.info('📋 Fetching recent messages for agent context...');
    const listResult = await matimo.execute('twilio-list-messages', {
      account_sid: accountSid,
      page_size: 5,
    });
    const listData = (listResult as any).data || listResult;
    const recentCount = listData.messages?.length ?? 0;
    console.info(`   ${recentCount} recent message(s) in account\n`);

    // Convert Twilio tools to LangChain format using the Matimo integration
    const langchainTools = await convertToolsToLangChain(twilioTools as ToolDefinition[], matimo);

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
        title: 'Example 1: Check message history',
        request: `Check my recent Twilio message history. How many messages are there and what are their statuses?`,
      },
      {
        title: 'Example 2: Send a test SMS',
        request: `Send a test SMS from ${fromNumber} to ${toNumber} saying "Hello from the Matimo AI Agent! LangChain integration test." Use account SID  .`,
      },
      {
        title: 'Example 3: Check sent message status',
        request: `List the 3 most recent messages sent from ${fromNumber} on my account    and describe their delivery status.`,
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
runTwilioAIAgent().catch(console.error);
