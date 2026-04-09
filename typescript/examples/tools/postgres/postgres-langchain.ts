#!/usr/bin/env node
/**
 * ============================================================================
 * POSTGRES TOOLS - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide which Postgres tools to use
 * 3. Generates appropriate SQL based on context
 * 4. Executes queries autonomously
 * 5. Processes results and responds naturally
 *
 * CRITICAL: Database credentials are NEVER exposed to the LLM
 * - LLM only sees tool descriptions and results
 * - Matimo handles all credential loading from environment variables
 * - Tool execution is secure and isolated
 *
 * Use this pattern when:
 * ✅ Building true autonomous AI agents
 * ✅ LLM should decide which tools to use
 * ✅ Complex workflows with LLM reasoning
 * ✅ Multi-step agentic processes
 * ✅ User gives high-level instructions (not SQL queries)
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Make sure Postgres is running (see POSTGRES_EXAMPLE_SETUP.md)
 * 2. Create .env file with database credentials:
 *    MATIMO_POSTGRES_HOST=localhost
 *    MATIMO_POSTGRES_PORT=5432
 *    MATIMO_POSTGRES_USER=matimo
 *    MATIMO_POSTGRES_PASSWORD=development
 *    MATIMO_POSTGRES_DB=matimo
 *    OPENAI_API_KEY=sk-xxxxxxxxxxxxx
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   pnpm postgres:langchain
 *
 * WHAT IT DOES:
 * ─────────────────────────────────────────────────────────────────────────
 * This example shows an AI agent that can:
 * 1. Explore database tables and schema
 * 2. Execute SELECT queries to analyze data
 * 3. Respond naturally in conversation style
 * 4. Multi-step reasoning without exposing credentials
 *
 * Example:
 *   User: "What tables exist in matimo?"
 *   AI Agent: "Let me query the database to see what tables are available..."
 *   [Agent calls postgres-execute-sql tool with SELECT query]
 *   AI Agent: "The matimo database contains these tables: ..."
 *
 * ============================================================================
 */

import 'dotenv/config';
import { MatimoInstance, convertToolsToLangChain, ToolDefinition } from 'matimo';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Run AI Agent with Postgres tools
 * The agent receives natural language requests and decides which Postgres tools to use
 */
async function runPostgresAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Postgres AI Agent - LangChain + OpenAI             ║');
  console.info('║     True autonomous agent with LLM reasoning           ║');
  console.info('║     Database credentials: NEVER exposed to LLM         ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // Check required environment variables
  const pgConnected =
    process.env.MATIMO_POSTGRES_HOST &&
    process.env.MATIMO_POSTGRES_USER &&
    process.env.MATIMO_POSTGRES_PASSWORD &&
    process.env.MATIMO_POSTGRES_DB;

  if (!pgConnected) {
    console.error('❌ Error: Postgres connection not configured in .env');
    console.info('   Required environment variables:');
    console.info('     MATIMO_POSTGRES_HOST');
    console.info('     MATIMO_POSTGRES_USER');
    console.info('     MATIMO_POSTGRES_PASSWORD');
    console.info('     MATIMO_POSTGRES_DB');
    process.exit(1);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in .env');
    console.info('   Set it: export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  console.info(
    `📍 Postgres: ${process.env.MATIMO_POSTGRES_DB}@${process.env.MATIMO_POSTGRES_HOST}`
  );
  console.info(`🤖 Using OpenAI (GPT-4o-mini) as the AI agent\n`);

  try {
    // Initialize Matimo with auto-discovery
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Get Postgres tools and convert to LangChain format
    console.info('💬 Loading Postgres tools...');
    const matimoTools = matimo.listTools();
    const postgresTools = matimoTools.filter((t) => t.name.startsWith('postgres'));
    console.info(`✅ Loaded ${postgresTools.length} Postgres tool(s)\n`);

    // ✅ Convert Matimo tools to LangChain format using the built-in integration
    const langchainTools = await convertToolsToLangChain(
      postgresTools as ToolDefinition[],
      matimo,
      {
        // Pass database credentials so LLM tool calls can execute securely
        // The LLM will NEVER see these values - only Matimo tool execution will use them
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

    // Define agent tasks (sequential - each task uses results from previous)
    const userRequests = [
      {
        title: 'Step 1: Discover tables',
        request:
          'Get a list of all tables in the matimo database. Query the information_schema to show me all tables and their row counts.',
      },
      {
        title: 'Step 2: Analyze data volume',
        request:
          'Now that you know which tables exist, tell me the total number of records across all tables and which tables have the most data.',
      },
      {
        title: 'Step 3: Show schema for main table',
        request:
          'For the table with the most records, show me the column structure (column names and data types) so I understand what data is stored there.',
      },
    ];

    console.info('🧪 Running AI Agent Tasks (Sequential Workflow)');
    console.info('═'.repeat(60));

    // Run each task through the agent sequentially
    // Each task builds on previous results instead of making assumptions
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
    console.info('  ✅ Natural language requests, not SQL queries');
    console.info('  ✅ LLM generates SQL based on context');
    console.info('  ✅ Database credentials NEVER exposed to LLM');
    console.info('  ✅ Matimo handles secure credential injection');
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
runPostgresAIAgent().catch(console.error);
