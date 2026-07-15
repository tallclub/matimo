#!/usr/bin/env node
/**
 * ============================================================================
 * EXTRACT_FROM_FILE TOOL - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide when to extract file content
 * 3. Picks the right file and lets the tool auto-detect its format
 * 4. Executes the extract_from_file tool autonomously
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
 *   pnpm extract-from-file:langchain
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
 * Create an interactive approval callback for file extraction operations.
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR FILE EXTRACTION');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);
    if (request.params.filePath) console.info(`   filePath: ${request.params.filePath}`);
    if (request.params.fileUrl) console.info(`   fileUrl: ${request.params.fileUrl}`);

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (no terminal)');
      console.info('\n💡 To enable auto-approval in CI/scripts:');
      console.info('   export MATIMO_AUTO_APPROVE=true');
      console.info('\n' + '='.repeat(70) + '\n');
      return false;
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    return new Promise((resolve) => {
      console.info('\n❓ User Action Required');
      rl.question('   Type "yes" to approve or "no" to reject: ', (answer) => {
        const approved = answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
        console.info(
          approved ? '   ✅ Operation APPROVED by user' : '   ❌ Operation REJECTED by user'
        );
        console.info('='.repeat(70) + '\n');
        rl.close();
        resolve(approved);
      });
    });
  };
}

/**
 * Run AI Agent with the extract_from_file tool.
 * The agent receives natural language requests and decides which file to extract.
 */
async function runExtractFromFileAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║   Extract From File Tool AI Agent - LangChain + OpenAI ║');
  console.info('║   True autonomous agent with LLM reasoning             ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in .env');
    console.info('   Set it: export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  console.info('🤖 Using OpenAI (GPT-4o-mini) as the AI agent\n');

  // Create a sample CSV file for the agent to extract from.
  const sampleFile = path.join(__dirname, 'sample-report.csv');
  fs.writeFileSync(
    sampleFile,
    'quarter,revenue,region\nQ1,120000,EMEA\nQ2,138000,EMEA\nQ3,151000,APAC\n'
  );

  try {
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    const approvalHandler = getGlobalApprovalHandler();
    approvalHandler.setApprovalCallback(createApprovalCallback());

    console.info('💬 Loading extract_from_file tool...');
    const matimoTools = matimo.listTools();
    const extractTools = matimoTools.filter(
      (t) => t.name === 'extract_from_file'
    ) as ToolDefinition[];
    console.info(`✅ Loaded ${extractTools.length} extract_from_file tool(s)\n`);

    if (extractTools.length === 0) {
      console.error('❌ extract_from_file tool not found');
      process.exit(1);
    }

    const langchainTools = await convertToolsToLangChain(extractTools, matimo);

    console.info('🤖 Initializing OpenAI (GPT-4o-mini) LLM...');
    const model = new ChatOpenAI({ modelName: 'gpt-4o-mini', temperature: 0.7 });

    console.info('🔧 Creating agent...\n');
    const agent = await createAgent({
      model,
      tools: langchainTools as any,
    });

    const userRequests = [
      {
        title: 'Example 1: Summarize a CSV report',
        request: `Extract the contents of the CSV file at ${sampleFile} and tell me how many data rows and columns it has`,
      },
      {
        title: 'Example 2: Read raw text',
        request: `Extract the text of the file at ${sampleFile} using the txt format and show me the first line`,
      },
    ];

    console.info('🧪 Running AI Agent Tasks');
    console.info('═'.repeat(60) + '\n');

    for (const task of userRequests) {
      console.info(`${task.title}`);
      console.info('─'.repeat(60));
      console.info(`👤 User: "${task.request}"\n`);

      try {
        const response = await agent.invoke({
          messages: [{ role: 'user', content: task.request }],
        });

        const lastMessage = response.messages[response.messages.length - 1];
        if (lastMessage) {
          const content =
            typeof lastMessage.content === 'string'
              ? lastMessage.content
              : String(lastMessage.content);

          console.info(
            content && content.trim()
              ? `🤖 Agent: ${content}\n`
              : '🤖 Agent: (File extracted successfully)\n'
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.info(`⚠️  Agent error: ${errorMsg}\n`);
      }
    }

    console.info('═'.repeat(60));
    console.info('\n✨ AI Agent Examples Complete!\n');
    console.info('Key Features:');
    console.info('  ✅ Real LLM (OpenAI) decides when to extract file content');
    console.info('  ✅ Natural language requests, not API calls');
    console.info('  ✅ Format auto-detection handled by the tool itself');
    console.info('  ✅ Agentic reasoning and decision-making\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    if (fs.existsSync(sampleFile)) {
      fs.unlinkSync(sampleFile);
    }
  }
}

runExtractFromFileAIAgent().catch(console.error);
