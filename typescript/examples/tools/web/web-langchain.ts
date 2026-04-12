#!/usr/bin/env node
/**
 * ============================================================================
 * WEB TOOL - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide when to make HTTP requests
 * 3. Generates appropriate URLs and methods based on context
 * 4. Executes tools autonomously
 * 5. Processes results and responds naturally
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create .env file:
 *    OPENAI_API_KEY=sk-xxxxxxxxxxxxx
 *
 * 2. Install dependencies:
 *    npm install
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export OPENAI_API_KEY=sk-xxxx
 *   npm run web:langchain
 *
 * ============================================================================
 */

import 'dotenv/config';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { MatimoInstance, convertToolsToLangChain, type ToolDefinition } from '@matimo/core';

/**
 * Run AI Agent with Web tool
 * The agent receives natural language requests and decides when to make HTTP requests
 */
async function runWebAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║      Web Tool AI Agent - LangChain + OpenAI            ║');
  console.info('║      True autonomous agent with LLM reasoning          ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // Check required environment variables
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in .env');
    console.info('   Set it: export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  console.info('🤖 Using OpenAI (GPT-4o-mini) as the AI agent\n');

  try {
    // Initialize Matimo with auto-discovery
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Get web tool
    console.info('💬 Loading web tool...');
    const matimoTools = matimo.listTools();
    const webTool = matimoTools.filter((t) => t.name === 'web');
    console.info(`✅ Loaded ${webTool.length} web tool(s)\n`);

    if (webTool.length === 0) {
      console.error('❌ Web tool not found');
      process.exit(1);
    }

    // Convert to LangChain tools using the built-in converter
    const webTools = webTool as ToolDefinition[];
    const langchainTools = await convertToolsToLangChain(webTools, matimo);

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
      tools: langchainTools as any,
    });

    // Define agent tasks (natural language requests)
    const userRequests = [
      {
        title: 'Example 1: Fetch GitHub repository info',
        request: 'Get information about the tallclub/matimo repository from GitHub API',
      },
      {
        title: 'Example 2: Check API status',
        request: 'Make a request to the GitHub API and tell me what HTTP status code we get',
      },
      {
        title: 'Example 3: Fetch public data',
        request: 'Get JSON data from a public REST API endpoint and summarize the response',
      },
    ];

    console.info('🧪 Running AI Agent Tasks');
    console.info('═'.repeat(60) + '\n');

    // Run each task through the agent
    for (const task of userRequests) {
      console.info(`${task.title}`);
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
          const content =
            typeof lastMessage.content === 'string'
              ? lastMessage.content
              : String(lastMessage.content);

          if (content && content.trim()) {
            console.info(`🤖 Agent: ${content}\n`);
          } else {
            console.info('🤖 Agent: (Request completed successfully)\n');
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.info(`⚠️  Agent error: ${errorMsg}\n`);
      }
    }

    console.info('═'.repeat(60));
    console.info('\n✨ AI Agent Examples Complete!\n');
    console.info('Key Features:');
    console.info('  ✅ Real LLM (OpenAI) decides which tools to use');
    console.info('  ✅ Natural language requests, not API calls');
    console.info('  ✅ LLM generates URLs and HTTP methods based on context');
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
runWebAIAgent().catch(console.error);
