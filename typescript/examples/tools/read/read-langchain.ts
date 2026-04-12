#!/usr/bin/env node
/**
 * ============================================================================
 * READ TOOL - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide when to read files
 * 3. Generates appropriate file paths and line ranges based on context
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
 *   pnpm read:langchain
 *
 *   # Or from examples/tools directory:
 *   npm run read:langchain
 *
 * ============================================================================
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      console.info('   export MATIMO_APPROVED_PATTERNS="read"');
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
 * Run AI Agent with Read tool
 * The agent receives natural language requests and decides which files to read
 */
async function runReadAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Read Tool AI Agent - LangChain + OpenAI            ║');
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

  // Create a sample file for the agent to read
  const sampleFile = path.join(__dirname, 'sample-code.ts');
  fs.writeFileSync(
    sampleFile,
    `// Sample TypeScript file
interface User {
  id: string;
  name: string;
  email: string;
}

function getUserInfo(userId: string): User {
  // Fetch user from database
  return {
    id: userId,
    name: 'John Doe',
    email: 'john@example.com',
  };
}

function validateEmail(email: string): boolean {
  const pattern = /^[^@]+@[^@]+\\.[^@]+$/;
  return pattern.test(email);
}

export { getUserInfo, validateEmail };
`
  );

  try {
    // Initialize Matimo with auto-discovery
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Configure centralized approval handler
    const approvalHandler = getGlobalApprovalHandler();
    approvalHandler.setApprovalCallback(createApprovalCallback());

    // Get read tool
    console.info('💬 Loading read tool...');
    const matimoTools = matimo.listTools();
    const readTools = matimoTools.filter((t) => t.name === 'read') as ToolDefinition[];
    console.info(`✅ Loaded ${readTools.length} read tool(s)\n`);

    if (readTools.length === 0) {
      console.error('❌ Read tool not found');
      process.exit(1);
    }

    // Convert to LangChain tools using the built-in converter
    const langchainTools = await convertToolsToLangChain(readTools, matimo);

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
        title: 'Example 1: Read function definition',
        request: `Read the getUserInfo function from file ${sampleFile}`,
      },
      {
        title: 'Example 2: Read specific lines',
        request: `Read lines 1-10 from file ${sampleFile} and tell me what interfaces are defined`,
      },
      {
        title: 'Example 3: Read entire file',
        request: `Show me the complete content of file ${sampleFile}`,
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
            console.info('🤖 Agent: (File read successfully)\n');
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
    console.info('  ✅ LLM determines file paths and line ranges');
    console.info('  ✅ Agentic reasoning and decision-making\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    // Clean up
    if (fs.existsSync(sampleFile)) {
      fs.unlinkSync(sampleFile);
    }
  }
}

// Run the AI agent
runReadAIAgent().catch(console.error);
