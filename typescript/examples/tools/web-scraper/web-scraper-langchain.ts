#!/usr/bin/env node
/**
 * ============================================================================
 * WEB_SCRAPER TOOL - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide when to crawl a site
 * 3. Picks the right URL and crawl bounds (maxPages/maxDepth)
 * 4. Executes the web_scraper tool autonomously
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
 *   pnpm web-scraper:langchain
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
 * Create an interactive approval callback for web-crawling operations.
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '='.repeat(70));
    console.info('🔒 APPROVAL REQUIRED FOR WEB CRAWL');
    console.info('='.repeat(70));
    console.info(`\n📋 Tool: ${request.toolName}`);
    console.info(`📝 Description: ${request.description || '(no description provided)'}`);
    console.info(`   url: ${request.params.url}`);

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
 * Run AI Agent with the web_scraper tool.
 * The agent receives natural language requests and decides how to crawl a site.
 */
async function runWebScraperAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║   Web Scraper Tool AI Agent - LangChain + OpenAI        ║');
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

    console.info('💬 Loading web_scraper tool...');
    const matimoTools = matimo.listTools();
    const scraperTools = matimoTools.filter((t) => t.name === 'web_scraper') as ToolDefinition[];
    console.info(`✅ Loaded ${scraperTools.length} web_scraper tool(s)\n`);

    if (scraperTools.length === 0) {
      console.error('❌ web_scraper tool not found');
      process.exit(1);
    }

    const langchainTools = await convertToolsToLangChain(scraperTools, matimo);

    console.info('🤖 Initializing OpenAI (GPT-4o-mini) LLM...');
    const model = new ChatOpenAI({ modelName: 'gpt-4o-mini', temperature: 0.7 });

    console.info('🔧 Creating agent...\n');
    const agent = await createAgent({
      model,
      tools: langchainTools as any,
    });

    const userRequests = [
      {
        title: 'Example 1: Crawl a small site',
        request:
          'Crawl https://example.com with at most 5 pages and a max depth of 1, and tell me how many pages you found and what their titles were',
      },
      {
        title: 'Example 2: Fetch a single page only',
        request:
          'Fetch just the page at https://example.com without following any links and summarize it',
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
              : '🤖 Agent: (Site crawled successfully)\n'
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
    console.info('  ✅ Real LLM (OpenAI) decides how to crawl a site');
    console.info('  ✅ Natural language requests, not API calls');
    console.info('  ✅ Crawl bounds (maxPages/maxDepth) chosen by the agent');
    console.info('  ✅ Agentic reasoning and decision-making\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

runWebScraperAIAgent().catch(console.error);
