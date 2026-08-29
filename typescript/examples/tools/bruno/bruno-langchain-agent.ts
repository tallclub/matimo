/**
 * ============================================================================
 * BRUNO TOOLS - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide which Bruno tools to use
 * 3. Generates appropriate parameters based on context
 * 4. Executes tools autonomously
 * 5. Processes results and responds naturally
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Set OPENAI_API_KEY environment variable
 * 2. Ensure Bruno CLI is installed: npm install -g @usebruno/cli
 * 3. No other environment variables required
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   pnpm bruno:langchain
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

async function runBrunoLangChainAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Bruno Tools - LangChain AI Agent                   ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not set. Agent tasks will fail gracefully.\n');
  }

  // Initialize Matimo
  console.info('🚀 Initializing Matimo...');
  const matimo = await MatimoInstance.init({ autoDiscover: true });
  const allTools = matimo.listTools();
  console.info(`✅ Loaded ${allTools.length} total tools\n`);

  // Get Bruno tools
  const brunoTools = allTools.filter((t: ToolDefinition) => t.name.startsWith('bruno'));
  console.info(`🔧 Found ${brunoTools.length} Bruno tools for agent\n`);

  // Convert to LangChain format
  const langchainTools = await convertToolsToLangChain(brunoTools, matimo);
  console.info(`🔗 Converted to ${langchainTools.length} LangChain tools\n`);

  // Initialize LLM
  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0,
  });

  // Create agent using langchain 1.x API
  console.info('🔧 Creating LangChain agent...\n');
  const agent = await createAgent({
    model,
    tools: langchainTools as any,
  });

  const workspaceDir = path.join(__dirname, '..', 'example-collections');
  const collectionPath = path.join(workspaceDir, 'langchain-agent-api');

  const tasks = [
    {
      title: 'Task 1: Create collection',
      request: `Create a new Bruno collection called "LangChain Agent API Tests" at the path "${collectionPath}"`,
    },
    {
      title: 'Task 2: Add a request',
      request: `Add a GET request named "list-todos" to the collection at "${collectionPath}" with URL https://jsonplaceholder.typicode.com/todos?_limit=3 and Accept: application/json header`,
    },
    {
      title: 'Task 3: Inspect collection',
      request: `Get the collection info for the collection at "${collectionPath}" and tell me how many requests it has`,
    },
    {
      title: 'Task 4: Run a request',
      request: `Run the request named "list-todos" from the collection at "${collectionPath}"`,
    },
  ];

  console.info('🧪 Running AI Agent Tasks');
  console.info('═'.repeat(60));

  for (const task of tasks) {
    console.info(`\n${task.title}`);
    console.info('─'.repeat(60));
    console.info(`👤 User: "${task.request}"\n`);

    try {
      const response = await agent.invoke({
        messages: [{ role: 'user', content: task.request }],
      });

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
      console.info(`⚠️  Agent error (expected without API key): ${errorMsg.substring(0, 100)}\n`);
    }
  }

  console.info('═'.repeat(60));
  console.info('✨ Bruno LangChain Agent Example Complete!\n');
  console.info('Key Features:');
  console.info('  ✅ Real LLM (OpenAI) decides which tools to use');
  console.info('  ✅ Natural language requests, not API calls');
  console.info('  ✅ LLM generates tool parameters based on context');
  console.info('  ✅ Matimo SDK handles Bruno CLI execution transparently\n');
}

runBrunoLangChainAgent().catch((error) => {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error('❌ Fatal error:', errorMsg);
  process.exit(1);
});
