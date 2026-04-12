#!/usr/bin/env node
/**
 * ============================================================================
 * SEARCH TOOL - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide when to search files
 * 3. Generates appropriate search queries and patterns based on context
 * 4. Executes tools autonomously
 * 5. Processes results and responds naturally
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create .env file in examples/tools/:
 *    OPENAI_API_KEY=sk-xxxxxxxxxxxxx
 *
 * 2. Install dependencies:
 *    cd examples/tools && npm install
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   # From root directory:
 *   pnpm search:langchain
 *
 *   # Or from examples/tools directory:
 *   npm run search:langchain
 *
 * ============================================================================
 */

import 'dotenv/config';
import * as readline from 'readline';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import {
  MatimoInstance,
  convertToolsToLangChain,
  type ToolDefinition,
  getGlobalApprovalHandler,
  type ApprovalRequest,
} from '@matimo/core';

/**
 * Create an interactive approval callback for file operations
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR FILE OPERATION');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);
    console.info(`\n📄 File Operation:`);
    console.info(`   Path: ${request.params.filePath}`);
    if (request.params.startLine) {
      console.info(`   Start Line: ${request.params.startLine}`);
    }
    if (request.params.endLine) {
      console.info(`   End Line: ${request.params.endLine}`);
    }

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (no terminal)');
      console.info('\n💡 To enable auto-approval in CI/scripts:');
      console.info('   export MATIMO_AUTO_APPROVE=true');
      console.info('\n💡 Or approve specific patterns:');
      console.info('   export MATIMO_APPROVED_PATTERNS="search"');
      console.info('\n' + '='.repeat(70) + '\n');
      return false;
    }

    // Interactive mode: prompt user
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      console.info('\n❓ User Action Required');
      const question = '   Type "yes" to approve or "no" to reject: ';

      rl.question(question, (answer) => {
        const approved = answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';

        if (approved) {
          console.info('   ✅ Operation APPROVED by user');
        } else {
          console.info('   ❌ Operation REJECTED by user');
        }
        console.info('='.repeat(70) + '\n');

        rl.close();
        resolve(approved);
      });
    });
  };
}

/**
 * Run AI Agent with Search tool
 * The agent receives natural language requests and decides what to search for
 */
async function runSearchAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Search Tool AI Agent - LangChain + OpenAI          ║');
  console.info('║     True autonomous agent with LLM reasoning           ║');
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

    // Configure centralized approval handler
    const approvalHandler = getGlobalApprovalHandler();
    approvalHandler.setApprovalCallback(createApprovalCallback());

    // Get search tool
    console.info('💬 Loading search tool...');
    const matimoTools = matimo.listTools();
    const searchTools = matimoTools.filter((t) => t.name === 'search') as ToolDefinition[];
    console.info(`✅ Loaded ${searchTools.length} search tool(s)\n`);

    if (searchTools.length === 0) {
      console.error('❌ Search tool not found');
      process.exit(1);
    }

    // Convert to LangChain tools using the built-in converter
    const langchainTools = await convertToolsToLangChain(searchTools, matimo);

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
        title: 'Example 1: Search for TypeScript files',
        request:
          'Search for all TypeScript files by looking for files matching the pattern "*.ts" in the packages directory',
      },
      {
        title: 'Example 2: Search for specific imports',
        request:
          'Search for all files containing "import MatimoInstance" to find where MatimoInstance is being imported',
      },
      {
        title: 'Example 3: Search for function definitions',
        request:
          'Search for files containing "export default async function" to find all exported async functions in the codebase',
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
        // Add system context to help the LLM understand how to use the search tool
        const systemPrompt = `You have access to a search tool that can find files in the filesystem.
The search tool takes a 'query' parameter which can be:
- A file pattern (glob) like '*.ts', '*.json', 'src/**/*.test.ts'
- Text to search within files like 'import MatimoInstance', 'export default function'

When the user asks you to search, extract the search query from their request and pass it to the search tool.
For example:
- If user says "find TypeScript files", use query "*.ts"
- If user says "find imports of X", use query "import X"
- If user says "find where Y is exported", use query "export Y"

Always use the search tool with the appropriate query parameter.`;

        const response = await agent.invoke({
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
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
            console.info('🤖 Agent: (Search completed successfully)\n');
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
    console.info('  ✅ LLM generates search patterns based on context');
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
runSearchAIAgent().catch(console.error);
