#!/usr/bin/env node

import 'dotenv/config';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { MatimoInstance, convertToolsToLangChain, ToolDefinition } from '@matimo/core';

/**
 * GitHub LangChain Agent Example - TRUE AI AGENT
 * =============================================
 *
 * This is a **real autonomous AI agent** that:
 * 1. Loads GitHub tools via Matimo
 * 2. Converts them to LangChain tool schemas
 * 3. Uses ChatOpenAI (gpt-4o-mini) to reason about requests
 * 4. Autonomously calls GitHub APIs based on AI reasoning
 * 5. Returns natural language responses to user queries
 *
 * This is NOT just a schema converter - it's a working AI agent!
 *
 * Setup:
 * ------
 * 1. GitHub Personal Access Token: https://github.com/settings/tokens
 *    export GITHUB_TOKEN="ghp_xxxx..."
 *
 * 2. OpenAI API Key: https://platform.openai.com/api-keys
 *    export OPENAI_API_KEY="sk-proj-..."
 *
 * 3. Run the agent:
 *    pnpm github:langchain
 *
 * Example User Requests (the AI will understand and execute):
 * -----------------------------------------------------------
 * - "Find popular TypeScript projects"
 * - "What are the latest releases of Node.js?"
 * - "Show me open issues in kubernetes/kubernetes"
 * - "List contributors to the Go language repository"
 * - "Search for async/await patterns in React source code"
 *
 * How it Works:
 * ----------------------------
 * 1. User provides natural language request
 * 2. LLM (OpenAI) reads the GitHub tool definitions
 * 3. LLM decides which tools to call and with what parameters
 * 4. Matimo executes the selected GitHub APIs
 * 5. Results returned to LLM for formatting
 * 6. LLM provides natural language response to user
 *
 * This demonstrates true AI agent autonomy - the LLM decides
 * WHAT tools to use and WHEN, not just executing predetermined actions.
 */

interface AgentTask {
  title: string;
  description: string;
  request: string;
}

async function main() {
  console.info('\n╔════════════════════════════════════════════════════════════╗');
  console.info('║  🤖 GitHub AI Agent (True Autonomous Agent)              ║');
  console.info('║  Powered by OpenAI + LangChain + Matimo                 ║');
  console.info('╚════════════════════════════════════════════════════════════╝\n');

  // Check required environment variables
  const githubToken = process.env.GITHUB_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!githubToken) {
    console.error('\n❌ Error: GITHUB_TOKEN environment variable not set');
    console.info('   Create token: https://github.com/settings/tokens');
    console.info('   Set it: export GITHUB_TOKEN="ghp_xxxx..."\n');
    process.exit(1);
  }

  if (!openaiKey) {
    console.error('\n❌ Error: OPENAI_API_KEY environment variable not set');
    console.info('   Get key: https://platform.openai.com/api-keys');
    console.info('   Set it: export OPENAI_API_KEY="sk-proj-..."\n');
    process.exit(1);
  }

  try {
    console.info('⏳ Initializing AI Agent...\n');

    // Initialize Matimo
    const matimo = await MatimoInstance.init({
      autoDiscover: true,
    });

    // Get all GitHub tools
    const allTools = matimo.listTools();
    const githubTools = allTools.filter((t) => t.name.startsWith('github-'));
    console.info(`✅ Loaded ${githubTools.length} GitHub tools from Matimo\n`);

    // Select safe read-only tools (no create/merge/delete)
    const keyTools = githubTools.filter(
      (t) =>
        !t.name.includes('create-') &&
        !t.name.includes('delete-') &&
        !t.name.includes('update-') &&
        !t.name.includes('merge-') &&
        !t.name.includes('add-')
    );

    console.info(`📚 Using ${keyTools.length} read-only tools (write operations excluded)\n`);

    // Convert to LangChain tool format
    console.info('🔧 Converting tools to LangChain format...\n');
    const langchainTools = await convertToolsToLangChain(keyTools as ToolDefinition[], matimo, {
      GITHUB_TOKEN: githubToken,
    });

    // Initialize OpenAI LLM
    console.info('🤖 Initializing ChatOpenAI (gpt-4o-mini)...\n');
    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      apiKey: openaiKey,
    });

    // Create the agent
    console.info('⚙️  Creating autonomous agent...\n');
    const agent = await createAgent({
      model,
      tools: langchainTools as any[],
    });

    // Define user tasks for the agent to complete
    const userTasks: AgentTask[] = [
      {
        title: 'Search Popular Projects',
        description: 'Find highly-starred TypeScript repositories',
        request: 'Find the top TypeScript repositories with over 1000 stars',
      },
      {
        title: 'Repository Intelligence',
        description: 'Get details about a major open-source project',
        request: 'Get detailed information about the kubernetes/kubernetes repository',
      },
      {
        title: 'Project Activity',
        description: 'Check recent development activity',
        request:
          'List the 5 most recent commits to facebook/react and tell me what they were about',
      },
      {
        title: 'Release Information',
        description: 'Find latest releases of major projects',
        request: 'What are the 3 most recent releases of golang/go?',
      },
    ];

    console.info('🧪 Running GitHub AI Agent Tasks');
    console.info('═'.repeat(60));

    // Execute each task with the AI agent
    for (const task of userTasks) {
      console.info(`\n${task.title}`);
      console.info('─'.repeat(60));
      console.info(`� User: "${task.request}"\n`);

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

    // Print summary
    console.info('═'.repeat(60));
    console.info('✨ GitHub AI Agent Tasks Complete!\n');
    console.info('Key Features:');
    console.info('  ✅ Real LLM (OpenAI) decides which GitHub tools to use');
    console.info('  ✅ Natural language requests, not API calls');
    console.info('  ✅ LLM generates tool parameters based on context');
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
main().catch(console.error);
