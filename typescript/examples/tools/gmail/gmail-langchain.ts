#!/usr/bin/env node
/**
 * ============================================================================
 * GMAIL TOOLS - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide which Gmail tools to use from matimo
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
 *    GMAIL_ACCESS_TOKEN=ya29.xxxxxxxxxxxxx
 *    OPENAI_API_KEY=sk-xxxxxxxxxxxxx
 *
 * 2. Install dependencies:
 *    npm install
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export GMAIL_ACCESS_TOKEN=your_token_here
 *   export OPENAI_API_KEY=your_openai_key_here
 *   pnpm gmail:langchain
 *
 * WHAT IT DOES:
 * ─────────────────────────────────────────────────────────────────────────
 * This example shows an AI agent that can:
 * 1. Check your recent emails
 * 2. Send emails to you based on LLM reasoning
 * 3. Create draft emails with AI-generated content
 * 4. Respond naturally in conversation style
 *
 * Example conversation:
 *   User: "Send me a test email"
 *   Claude: "I'll send you a test email now..."
 *   [Claude calls gmail-send-email tool]
 *   Claude: "Done! Email sent to your address."
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { MatimoInstance, convertToolsToLangChain, ToolDefinition } from 'matimo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run AI Agent with Gmail tools
 * The agent receives natural language requests and decides which Gmail tools to use
 */
async function runGmailAIAgent() {
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
  console.info('║     Gmail AI Agent - LangChain + OpenAI               ║');
  console.info('║     True autonomous agent with LLM reasoning          ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // Check required environment variables
  const accessToken = process.env.GMAIL_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('❌ Error: GMAIL_ACCESS_TOKEN not set in .env');
    console.info('   Set it: export GMAIL_ACCESS_TOKEN="ya29...."');
    process.exit(1);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in .env');
    console.info('   Set it: export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  console.info(`📧 User Email: ${userEmail}`);
  console.info(`🤖 Using OpenAI (GPT-4o-mini) as the AI agent\n`);

  try {
    // Initialize Matimo
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Get Gmail tools and convert to LangChain format
    console.info('📬 Loading Gmail tools...');
    const matimoTools = matimo.listTools();
    const gmailTools = matimoTools.filter((t) => t.name.startsWith('gmail-'));
    console.info(`✅ Loaded ${gmailTools.length} Gmail tools\n`);

    // Convert to LangChain tools
    const langchainTools = await convertToolsToLangChain(gmailTools as ToolDefinition[], matimo, {
      GMAIL_ACCESS_TOKEN: accessToken,
    });

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
        title: 'Example 1: Check recent emails',
        request: 'How many recent emails do I have? List the first 3.',
      },
      {
        title: 'Example 2: Send a test email',
        request: `Please send a test email to ${userEmail} with subject "Hello from AI Agent" and body "This email was sent by an AI agent using Matimo tools."`,
      },
      {
        title: 'Example 3: Create an automated draft',
        request: `Create a draft email to ${userEmail} about "Weekly Summary" with a professional greeting and a summary of what this example demonstrated.`,
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
runGmailAIAgent().catch(console.error);
