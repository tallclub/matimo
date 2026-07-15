#!/usr/bin/env node
/**
 * ============================================================================
 * CONVERT_TO_FILE TOOL - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide when to convert content
 * 3. Picks the right source/target format pair
 * 4. Executes the convert_to_file tool autonomously
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
 *   pnpm convert-to-file:langchain
 *
 * ============================================================================
 */

import 'dotenv/config';
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
 * Create an interactive approval callback for file conversion operations.
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR FILE CONVERSION');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`   ${request.params.source_format} -> ${request.params.target_format}`);

    if (!isInteractive) {
      console.info('\n❌ REJECTED - Non-interactive environment (no terminal)');
      console.info('\n💡 To enable auto-approval in CI/scripts:');
      console.info('   export MATIMO_AUTO_APPROVE=true');
      console.info('\n' + '='.repeat(70) + '\n');
      return false;
    }

    console.info('   ✅ Auto-approved (see MATIMO_AUTO_APPROVE)');
    console.info('='.repeat(70) + '\n');
    return true;
  };
}

/**
 * Run AI Agent with the convert_to_file tool.
 * The agent receives natural language requests and decides which conversion to run.
 */
async function runConvertToFileAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║   Convert To File Tool AI Agent - LangChain + OpenAI    ║');
  console.info('║   True autonomous agent with LLM reasoning              ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in .env');
    console.info('   Set it: export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  console.info('🤖 Using OpenAI (GPT-4o-mini) as the AI agent\n');

  try {
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    const approvalHandler = getGlobalApprovalHandler();
    approvalHandler.setApprovalCallback(createApprovalCallback());

    console.info('💬 Loading convert_to_file tool...');
    const matimoTools = matimo.listTools();
    const convertTools = matimoTools.filter(
      (t) => t.name === 'convert_to_file'
    ) as ToolDefinition[];
    console.info(`✅ Loaded ${convertTools.length} convert_to_file tool(s)\n`);

    if (convertTools.length === 0) {
      console.error('❌ convert_to_file tool not found');
      process.exit(1);
    }

    const langchainTools = await convertToolsToLangChain(convertTools, matimo);

    console.info('🤖 Initializing OpenAI (GPT-4o-mini) LLM...');
    const model = new ChatOpenAI({ modelName: 'gpt-4o-mini', temperature: 0.7 });

    console.info('🔧 Creating agent...\n');
    const agent = await createAgent({
      model,
      tools: langchainTools as any,
    });

    const userRequests = [
      {
        title: 'Example 1: Turn JSON records into CSV',
        request:
          'Convert this JSON content to CSV using convert_to_file: ' +
          '[{"name":"Ada","role":"Mathematician"},{"name":"Alan","role":"Computer Scientist"}]. ' +
          'source_format is json and target_format is csv. Tell me the resulting MIME type.',
      },
      {
        title: 'Example 2: Render Markdown notes as a Word document',
        request:
          'Convert this Markdown content to a DOCX file using convert_to_file: ' +
          '"# Meeting Notes\\n\\n- Decision one\\n- Decision two". ' +
          'source_format is markdown and target_format is docx. Tell me the size in bytes of the result.',
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
              : '🤖 Agent: (File converted successfully)\n'
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
    console.info('  ✅ Real LLM (OpenAI) decides when to convert content');
    console.info('  ✅ Natural language requests, not API calls');
    console.info('  ✅ Markdown -> PDF/DOCX rendering with no headless browser');
    console.info('  ✅ Agentic reasoning and decision-making\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

runConvertToFileAIAgent().catch(console.error);
