#!/usr/bin/env node
/**
 * ============================================================================
 * NOTION TOOLS - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide which Notion tools to use
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
 *    NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *    OPENAI_API_KEY=sk-xxxxxxxxxxxxx
 *
 * 2. Install dependencies:
 *    npm install
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export NOTION_API_KEY=secret_xxxx
 *   export OPENAI_API_KEY=sk-xxxx
 *   npm run notion:langchain
 *
 * WHAT IT DOES:
 * ─────────────────────────────────────────────────────────────────────────
 * This example shows an AI agent that can:
 * 1. Search Notion workspace
 * 2. Query databases
 * 3. Create pages
 * 4. Update pages
 * 5. Add comments
 * 6. Respond naturally in conversation style
 *
 * Example conversation:
 *   User: "Search my Notion workspace for important items"
 *   AI Agent: "I'll search your Notion workspace..."
 *   [AI Agent calls notion_search tool]
 *   AI Agent: "I found 5 items. Here's what I discovered..."
 *
 * ============================================================================
 */

import 'dotenv/config';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { MatimoInstance, convertToolsToLangChain, ToolDefinition } from '@matimo/core';

/**
 * Notion AI Agent - Autonomous agent with LangChain
 */
async function runNotionAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     NOTION AI AGENT - LangChain Agentic Loop        ║');
  console.info('║     Autonomous Notion workspace management           ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // Validate credentials
  const notionKey = process.env.NOTION_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!notionKey) {
    console.error('❌ Error: NOTION_API_KEY not set in .env');
    console.info('   Get one from: https://www.notion.so/my-integrations');
    process.exit(1);
  }

  if (!openaiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in .env');
    console.info('   Get one from: https://platform.openai.com/api-keys');
    process.exit(1);
  }

  console.info(`🤖 Using OpenAI (GPT-4o-mini) as the AI agent\n`);

  try {
    // Initialize Matimo with auto-discovery
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Get Notion tools and convert to LangChain format
    console.info('💬 Loading Notion tools...');
    const matimoTools = matimo.listTools();
    const notionTools = matimoTools.filter((t) => t.name.startsWith('notion_'));
    console.info(`✅ Loaded ${notionTools.length} Notion tools\n`);

    // Select key Notion tools for agent (in order of typical workflow)
    const keyNotionTools = notionTools.filter((t) =>
      [
        'notion_list_databases',
        'notion_query_database',
        'notion_create_page',
        'notion_update_page',
      ].includes(t.name)
    );

    // ✅ Discover a database first (required for notion_create_page parent parameter)
    // This mirrors the factory example that queries databases before creating pages
    console.info('🧪 Discovering accessible databases...');
    let selectedDatabaseId: string | null = null;
    let selectedDatabaseTitle: string | null = null;

    try {
      const listResult = (await matimo.execute('notion_list_databases', { page_size: 5 })) as any;
      const databases = listResult.data?.results || listResult.results || [];
      console.info(`   ✅ Direct tool call succeeded`);
      console.info(`   📊 Found ${databases.length} accessible database(s)\n`);

      if (databases && databases.length > 0) {
        selectedDatabaseId = databases[0].id;
        selectedDatabaseTitle = databases[0].title?.[0]?.plain_text || 'Untitled';
        console.info(
          `   📍 Selected database: "${selectedDatabaseTitle}" (${selectedDatabaseId})\n`
        );
      } else {
        console.info('   ℹ️  No databases accessible - notion_create_page will fail\n');
        console.info(
          '   📌 Share a Notion database with your integration to enable full functionality\n'
        );
      }
    } catch (testError) {
      console.info(`   ⚠️  Direct tool test failed: ${testError}\n`);
    }

    // ✅ Convert Matimo tools to LangChain format
    console.info('🔄 Converting tools to LangChain format...');
    const langchainTools = await convertToolsToLangChain(
      keyNotionTools as ToolDefinition[],
      matimo,
      {
        NOTION_API_KEY: notionKey,
        ...(selectedDatabaseId ? { parent: { database_id: selectedDatabaseId } } : {}),
      } as any
    );

    console.info(`✅ Converted ${langchainTools.length} tools for LangChain\n`);

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

    // Define agent tasks (natural language requests that require real API usage)
    const userRequests = [
      {
        title: 'Example 1: Explore Workspace',
        request:
          'Explore my Notion workspace and tell me what databases you find. List them by name.',
      },
      {
        title: 'Example 2: Query and Analyze',
        request:
          'Find a database in my workspace and query it. Tell me how many pages it contains and what you discover.',
      },
      {
        title: 'Example 3: Create Page',
        request: `Create a new page with the title "AI Agent Report - ${new Date().toLocaleTimeString()}" in the available database`,
      },
    ];

    console.info('🧪 Running AI Agent Tasks');
    console.info('═'.repeat(60));
    console.info('📌 IMPORTANT: Each task shows:');
    console.info('   1. Natural language user request');
    console.info('   2. AI agent decision (which tools to call)');
    console.info('   3. Actual tool execution results\n');

    // Run each task through the agent
    for (const task of userRequests) {
      console.info(`\n${task.title}`);
      console.info('─'.repeat(60));
      console.info(`👤 User: "${task.request}"\n`);

      try {
        // Use the same invoke shape as the Slack example: supply `messages` array
        const response = (await (agent as any).invoke({
          messages: [
            {
              role: 'user',
              content: task.request,
            },
          ],
        })) as any;

        // Get the output from the agent
        const output = response.output;
        if (output) {
          console.info(`🤖 Agent Response:\n${output}\n`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.info(`⚠️  Agent error: ${errorMsg}\n`);
        console.info('📌 Note: This is expected if you lack API permissions or database access');
      }
    }

    console.info('═'.repeat(60));
    console.info('✨ AI Agent Examples Complete!\n');
    console.info('Key Features:');
    console.info('  ✅ Real LLM (OpenAI) decides which tools to use');
    console.info('  ✅ Natural language requests (not API calls)');
    console.info('  ✅ LLM generates parameters based on context');
    console.info('  ✅ Actual tools executed in your Notion workspace');
    console.info('  ✅ Results processed through LLM for natural response\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the AI agent
runNotionAIAgent().catch(console.error);
