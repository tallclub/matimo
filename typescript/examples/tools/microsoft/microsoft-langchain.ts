#!/usr/bin/env node
/**
 * ============================================================================
 * MICROSOFT GRAPH TOOLS - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Takes natural language user requests
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide which Microsoft Graph tools to use
 * 3. Generates appropriate parameters based on context
 * 4. Executes tools autonomously (pausing for human approval on high-risk actions)
 * 5. Processes results and responds naturally
 *
 * Use this pattern when:
 * ✅ Building true autonomous AI agents
 * ✅ LLM should decide which tools to use
 * ✅ Complex workflows with LLM reasoning
 * ✅ User gives high-level instructions (not low-level API calls)
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create a .env file:
 *    MICROSOFT_GRAPH_ACCESS_TOKEN=eyJ0eXAiOiJKV1Qi...
 *    OPENAI_API_KEY=sk-xxxxxxxxxxxxx
 *    TEST_EMAIL=you@example.com           # who ms_send_email sends the test email to
 *    TEST_TEAM_ID=...                     # optional — enables the Teams message task
 *    TEST_CHANNEL_ID=...                  # optional — enables the Teams message task
 *
 * APPROVAL:
 * ─────────────────────────────────────────────────────────────────────────
 * `ms_send_email` is `risk: high` + `requires_approval: true` — Matimo routes it
 * through the human-in-the-loop approval flow before the executor ever runs. This
 * example registers an interactive approval callback (you'll be prompted in the
 * terminal), or you can pre-approve for unattended runs:
 *    export MATIMO_AUTO_APPROVE=true
 * or
 *    export MATIMO_APPROVED_PATTERNS="ms_send_email"
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export MICROSOFT_GRAPH_ACCESS_TOKEN=your_token_here
 *   export OPENAI_API_KEY=your_openai_key_here
 *   pnpm microsoft:langchain
 *
 * WHAT IT DOES:
 * ─────────────────────────────────────────────────────────────────────────
 * The agent autonomously:
 * 1. Reads recent inbox messages (ms_get_email)
 * 2. Sends a test email — pausing for your approval first (ms_send_email)
 * 3. Schedules an online calendar event / Teams meeting (ms_create_calendar_event)
 * 4. Posts a message to a Teams channel, if TEST_TEAM_ID/TEST_CHANNEL_ID are set
 *    (ms_send_teams_message)
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
  getGlobalApprovalHandler,
  type ToolDefinition,
  type ApprovalRequest,
} from 'matimo';

/**
 * Interactive approval callback for high-risk Microsoft Graph operations
 * (e.g. ms_send_email, ms_publish_to_sharepoint). Mirrors the generic HITL
 * pattern used in github-with-approval.ts: auto-reject in non-interactive
 * environments, otherwise prompt the user in the terminal.
 */
function createApprovalCallback() {
  return async (request: ApprovalRequest): Promise<boolean> => {
    const isInteractive = process.stdin.isTTY;

    console.info('\n' + '═'.repeat(70));
    console.info('🔒 APPROVAL REQUIRED — HIGH-RISK MICROSOFT GRAPH OPERATION');
    console.info('═'.repeat(70));
    console.info(`📋 Tool: ${request.toolName}`);
    console.info(`📝 Params: ${JSON.stringify(request.params, null, 2)}`);

    if (!isInteractive) {
      console.info('\n❌ REJECTED — non-interactive environment (no terminal)');
      console.info('💡 To approve unattended: export MATIMO_AUTO_APPROVE=true');
      console.info('💡 Or pre-approve this tool: export MATIMO_APPROVED_PATTERNS="ms_send_email"');
      console.info('═'.repeat(70) + '\n');
      return false;
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question('\n❓ Type "yes" to approve or "no" to reject: ', (answer) => {
        const approved =
          answer.trim().toLowerCase() === 'yes' || answer.trim().toLowerCase() === 'y';
        console.info(approved ? '   ✅ Approved by user' : '   ❌ Rejected by user');
        console.info('═'.repeat(70) + '\n');
        rl.close();
        resolve(approved);
      });
    });
  };
}

async function runMicrosoftAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Microsoft Graph AI Agent - LangChain + OpenAI     ║');
  console.info('║     Autonomous mail, calendar & Teams workflows       ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  const accessToken = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('❌ Error: MICROSOFT_GRAPH_ACCESS_TOKEN not set in .env');
    console.info('   Get a token via the Entra admin center or Graph Explorer:');
    console.info('   https://developer.microsoft.com/en-us/graph/graph-explorer');
    process.exit(1);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in .env');
    console.info('   Get one from: https://platform.openai.com/api-keys');
    process.exit(1);
  }

  const userEmail = process.env.TEST_EMAIL || '<signed-in-user>@example.com';
  const teamId = process.env.TEST_TEAM_ID || '';
  const channelId = process.env.TEST_CHANNEL_ID || '';

  console.info(`📧 Test recipient: ${userEmail}`);
  console.info(`🤖 Using OpenAI (GPT-4o-mini) as the AI agent\n`);

  try {
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Register the interactive approval callback so the agent can still
    // execute ms_send_email (requires_approval: true) — it'll pause and
    // prompt in the terminal rather than throwing AUTH/approval errors.
    const autoApprove = process.env.MATIMO_AUTO_APPROVE === 'true';
    const approvedPatterns = process.env.MATIMO_APPROVED_PATTERNS;
    if (!autoApprove && !approvedPatterns) {
      getGlobalApprovalHandler().setApprovalCallback(createApprovalCallback());
      console.info(
        '🔐 Interactive approval enabled — you will be prompted before ms_send_email runs.'
      );
    } else if (autoApprove) {
      console.info('🔐 MATIMO_AUTO_APPROVE=true — high-risk operations will be auto-approved.');
    } else {
      console.info(
        `🔐 MATIMO_APPROVED_PATTERNS="${approvedPatterns}" — matching operations auto-approved.`
      );
    }

    console.info('\n📬 Loading Microsoft Graph tools...');
    const matimoTools = matimo.listTools();
    const msToolNames = [
      'ms_get_email',
      'ms_send_email',
      'ms_create_calendar_event',
      'ms_send_teams_message',
    ];
    const msTools = matimoTools.filter((t) => msToolNames.includes(t.name));
    console.info(
      `✅ Loaded ${msTools.length} Microsoft Graph tools: ${msTools.map((t) => t.name).join(', ')}\n`
    );

    const langchainTools = await convertToolsToLangChain(msTools as ToolDefinition[], matimo, {
      MICROSOFT_GRAPH_ACCESS_TOKEN: accessToken,
    });

    console.info('🤖 Initializing OpenAI (GPT-4o-mini) LLM...');
    const model = new ChatOpenAI({ modelName: 'gpt-4o-mini', temperature: 0.3 });

    console.info('🔧 Creating agent...\n');
    const agent = await createAgent({
      model,
      tools: langchainTools as any[],
    });

    const userRequests: Array<{ title: string; request: string }> = [
      {
        title: 'Example 1: Check recent inbox messages',
        request:
          'How many unread emails do I have right now? List the subjects of up to 3 of them.',
      },
      {
        title: 'Example 2: Send a test email (requires approval)',
        request: `Send an email to ${userEmail} with subject "Hello from the Matimo AI Agent" and a short, friendly body explaining this message was sent autonomously by an AI agent using Matimo's Microsoft Graph tools.`,
      },
      {
        title: 'Example 3: Schedule an online meeting',
        request:
          'Create a 30-minute online Teams meeting titled "Matimo LangChain Agent — Sync" starting at 2026-06-17T10:00:00 and ending at 2026-06-17T10:30:00, in the UTC timezone.',
      },
    ];

    if (teamId && channelId) {
      userRequests.push({
        title: 'Example 4: Post a Teams channel message',
        request: `Post a message to the Microsoft Teams channel with channel_id "${channelId}" in team "${teamId}" saying "Hello from the Matimo LangChain agent! 👋 This message was posted autonomously."`,
      });
    }

    console.info('🧪 Running AI Agent Tasks');
    console.info('═'.repeat(60));

    for (const task of userRequests) {
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
            console.info('🤖 Agent:', lastMessage.content, '\n');
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.info(`⚠️  Agent error: ${errorMsg}\n`);
      }
    }

    if (!teamId || !channelId) {
      console.info(
        '⊘ Skipped Teams channel message — set TEST_TEAM_ID and TEST_CHANNEL_ID to enable it.\n'
      );
    }

    console.info('═'.repeat(60));
    console.info('✨ AI Agent Examples Complete!\n');
    console.info('Key Features:');
    console.info('  ✅ Real LLM (OpenAI) decides which tools to use');
    console.info('  ✅ Natural language requests, not API calls');
    console.info('  ✅ Human-in-the-loop approval for high-risk actions (ms_send_email)');
    console.info('  ✅ Agentic reasoning across mail, calendar, and Teams\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runMicrosoftAIAgent().catch(console.error);
