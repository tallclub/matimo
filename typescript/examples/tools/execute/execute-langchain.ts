#!/usr/bin/env node
/**
 * ============================================================================
 * EXECUTE TOOL - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide when to execute commands
 * 3. Generates appropriate command parameters based on context
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
 *   npm run execute:langchain
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
  ToolDefinition,
  getGlobalApprovalHandler,
  type ApprovalRequest,
} from '@matimo/core';

/**
 * Create an interactive approval callback for command execution
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    // Check both process.stdin.isTTY and if stdin is readable
    const isInteractive = process.stdin.isTTY && process.stdin.readable;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR COMMAND EXECUTION');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);
    console.info(`\n💻 Command Operation:`);
    console.info(`   Command: ${request.params.command}`);
    if (request.params.cwd) {
      console.info(`   Working Dir: ${request.params.cwd}`);
    }

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (stdin not available)');
      console.info('\n💡 To auto-approve in non-interactive environments:');
      console.info('   export MATIMO_AUTO_APPROVE=true');
      console.info('\n💡 Or pre-approve specific patterns:');
      console.info('   export MATIMO_APPROVED_PATTERNS="execute"');
      console.info('\n💡 To test interactively, run from command line:');
      console.info('   npm run execute:langchain');
      console.info('\n' + '='.repeat(70) + '\n');
      return false;
    }

    // Interactive mode: prompt user
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
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
 * The agent receives natural language requests and decides which commands to execute
 */
async function runExecuteAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║    Execute Tool AI Agent - LangChain + OpenAI         ║');
  console.info('║    True autonomous agent with LLM reasoning           ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // Check required environment variables
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in .env');
    console.info('   Set it: export OPENAI_API_KEY="sk-..."');
    console.info('   Get one from: https://platform.openai.com/api-keys');
    process.exit(1);
  }

  console.info('🤖 Using OpenAI (GPT-4o-mini) as the AI agent\n');

  try {
    // Initialize Matimo with auto-discovery
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Get execute tool
    console.info('💬 Loading execute tool...');
    const matimoTools = matimo.listTools();
    const executeTools = matimoTools.filter((t) => t.name === 'execute');
    console.info(`✅ Loaded ${executeTools.length} execute tool(s)\n`);

    if (executeTools.length === 0) {
      console.error('❌ Execute tool not found');
      process.exit(1);
    }

    // Convert to LangChain tools using the built-in converter
    const langchainTools = await convertToolsToLangChain(executeTools as ToolDefinition[], matimo);

    // Set up approval callback for destructive commands
    const approvalHandler = getGlobalApprovalHandler();
    approvalHandler.setApprovalCallback(createApprovalCallback());

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
        title: 'Example 1: Get system information',
        request: 'Show me the current working directory using pwd command',
      },
      {
        title: 'Example 2: List files',
        request: 'List files and directories in the current folder (use ls -la)',
      },
      {
        title: 'Example 3: Create a test file',
        request: 'Create a simple test file named test.txt in /tmp with content "Hello from Agent"',
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
            console.info('🤖 Agent: (Command executed successfully)\n');
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
    console.info('  ✅ LLM generates command parameters based on context');
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
runExecuteAIAgent().catch(console.error);
