#!/usr/bin/env node
/**
 * ============================================================================
 * HUBSPOT TOOLS - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide which HubSpot tools to use
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
 *    MATIMO_HUBSPOT_API_KEY=pat-na1-xxxxxxxxxxxxx
 *    OPENAI_API_KEY=sk-xxxxxxxxxxxxx
 *
 * 2. Install dependencies:
 *    npm install
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export MATIMO_HUBSPOT_API_KEY=pat-na1-xxxx
 *   export OPENAI_API_KEY=sk-xxxx
 *   npm run hubspot:langchain
 *
 * WHAT IT DOES:
 * ─────────────────────────────────────────────────────────────────────────
 * This example shows an AI agent that can:
 * 1. Create contacts in HubSpot
 * 2. Create companies
 * 3. List existing contacts
 * 4. Create products
 * 5. Create invoices
 * 6. Respond naturally in conversation style
 *
 * Example conversation:
 *   User: "Create a new contact with email test@example.com"
 *   AI Agent: "I'll create a new contact with that email..."
 *   [AI Agent calls hubspot-create-contact tool]
 *   AI Agent: "Done! Contact created with ID xxxxxx."
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { MatimoInstance, convertToolsToLangChain, ToolDefinition } from '@matimo/core';

/**
 * Run AI Agent with HubSpot tools
 * The agent receives natural language requests and decides which HubSpot tools to use
 */
async function runHubSpotAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     HubSpot AI Agent - LangChain + OpenAI             ║');
  console.info('║     True autonomous agent with LLM reasoning          ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // Check required environment variables
  const hubspotKey = process.env.MATIMO_HUBSPOT_API_KEY;
  if (!hubspotKey) {
    console.error('❌ Error: MATIMO_HUBSPOT_API_KEY not set in .env');
    console.info('   Go to: https://app.hubapi.com/settings/integrations/service-keys');
    console.info('   Create a service key and copy it');
    process.exit(1);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in .env');
    console.info('   Set it: export OPENAI_API_KEY="sk-..."');
    console.info('   Get one from: https://platform.openai.com/account/api-keys');
    process.exit(1);
  }

  console.info(`🔑 HubSpot Service Key is set`);
  console.info(`🔑 OpenAI API Key is set`);
  console.info(`🤖 Using OpenAI (GPT-4o-mini) as the AI agent\n`);

  try {
    // Initialize Matimo with auto-discovery
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Get HubSpot tools and convert to LangChain format
    console.info('💼 Loading HubSpot tools...');
    const matimoTools = matimo.listTools();
    const hubspotTools = matimoTools.filter((t) => t.name.startsWith('hubspot-'));
    console.info(`✅ Loaded ${hubspotTools.length} HubSpot tools\n`);

    // Select key HubSpot tools for the agent
    const keyHubSpotTools = hubspotTools.filter((t) =>
      [
        'hubspot-create-contact',
        'hubspot-get-contact',
        'hubspot-list-contacts',
        'hubspot-create-company',
        'hubspot-create-product',
        'hubspot-create-invoice',
      ].includes(t.name)
    );

    // ✅ Convert Matimo tools to LangChain format
    console.info('🔧 Converting tools to LangChain format...');
    const langchainTools = await convertToolsToLangChain(
      keyHubSpotTools as ToolDefinition[],
      matimo,
      {
        MATIMO_HUBSPOT_API_KEY: hubspotKey,
      }
    );

    console.info(`✅ Converted ${langchainTools.length} tools\n`);

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
        title: 'Example 1: Create a new contact',
        request:
          'Create a new contact for a prospect named John Smith with email john.smith@company.com',
      },
      {
        title: 'Example 2: Create a company',
        request: 'Add a new company called TechCorp for tracking in HubSpot',
      },
      {
        title: 'Example 3: Create a product',
        request:
          'Create a new product called "Premium Analytics Suite" priced at $299.99 with description "Advanced analytics for enterprise use"',
      },
      {
        title: 'Example 4: List contacts',
        request: 'How many contacts do we have in HubSpot? Show me the first 5 with their emails.',
      },
      {
        title: 'Example 5: Create an invoice',
        request: 'Generate a new invoice in USD for billing',
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
    console.info('  ✅ Agentic reasoning and decision-making');
    console.info('  ✅ Multi-step workflows with tool chaining\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the AI agent
runHubSpotAIAgent().catch(console.error);
