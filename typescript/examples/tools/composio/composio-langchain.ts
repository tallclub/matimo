#!/usr/bin/env node
/**
 * ============================================================================
 * @matimo/composio — LangChain AI Agent Example
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain
 * ─────────────────────────────────────────────────────────────────────────
 * A real LangChain agent that selects and calls composio tools autonomously
 * based on natural language instructions. The LLM decides which composio
 * tool to call and what parameters to use — your code just describes the
 * task and supplies the connected account credentials.
 *
 * Use this pattern when:
 * ✅ Building agents that should decide which toolkit to use
 * ✅ Complex multi-step workflows across Jira + Drive + Calendar
 * ✅ Users give high-level instructions, not specific API calls
 *
 * ⚠️  TOOL COUNT — LangChain has a hard limit of 128 tools per call.
 * @matimo/composio currently ships 449 tools across 14 toolkits. This
 * example filters to a curated subset before binding to the LLM. In
 * production, bind only the toolkits relevant to the agent's task.
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Set in .env:
 *    COMPOSIO_API_KEY=...
 *    COMPOSIO_USER_ID=...
 *    OPENAI_API_KEY=sk-...
 *    JIRA_CONNECTED_ACCOUNT_ID=ca_...    (optional, enables Jira tasks)
 *    GOOGLEDRIVE_CONNECTED_ACCOUNT_ID=ca_...  (optional, enables Drive tasks)
 *    GOOGLECALENDAR_CONNECTED_ACCOUNT_ID=ca_... (optional, enables Calendar tasks)
 *    GMAIL_CONNECTED_ACCOUNT_ID=ca_...   (optional, enables Gmail tasks)
 *
 * 2. Run:
 *    pnpm composio:langchain
 *
 * WHAT THE AGENT DOES:
 * ─────────────────────────────────────────────────────────────────────────
 * Given a task like "Find my unresolved Jira issues, check my upcoming
 * calendar events, and summarize my unread Gmail", the agent will:
 *   1. Call composio_jira_search_issues with JQL for unresolved issues
 *   2. Call composio_googlecalendar_events_list for upcoming events
 *   3. Call composio_gmail_fetch_emails for unread messages
 *   4. Synthesise the results into a natural language response
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';
import { MatimoInstance, convertToolsToLangChain, type ToolDefinition } from '@matimo/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.join(__dirname, '../../../packages/composio/tools');

const COMPOSIO_USER_ID = process.env.COMPOSIO_USER_ID || '';
const JIRA_ACCOUNT_ID = process.env.JIRA_CONNECTED_ACCOUNT_ID || '';
const DRIVE_ACCOUNT_ID = process.env.GOOGLEDRIVE_CONNECTED_ACCOUNT_ID || '';
const CALENDAR_ACCOUNT_ID = process.env.GOOGLECALENDAR_CONNECTED_ACCOUNT_ID || '';
const GMAIL_ACCOUNT_ID = process.env.GMAIL_CONNECTED_ACCOUNT_ID || '';

async function main(): Promise<void> {
  if (!process.env.COMPOSIO_API_KEY || !COMPOSIO_USER_ID) {
    console.error('\n❌ COMPOSIO_API_KEY and COMPOSIO_USER_ID are required');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('\n❌ OPENAI_API_KEY is required for LangChain agent');
    process.exit(1);
  }

  console.info('\n' + '='.repeat(70));
  console.info('🤖 @matimo/composio — LangChain Agent');
  console.info('='.repeat(70));

  const matimo = await MatimoInstance.init({ toolPaths: [TOOLS_DIR] });
  const allComposioTools = matimo
    .getRegistry()
    .getAll()
    .filter((t) => t.name.startsWith('composio_'));
  console.info(`\n📦 ${allComposioTools.length} composio tools loaded`);

  // Filter to only the toolkits relevant to this agent.
  // With 342+ composio tools, binding all of them to LangChain exceeds the
  // OpenAI 128-tool limit — always curate the set to what the agent needs.
  const ENABLED_TOOLKITS = new Set<string>();
  if (JIRA_ACCOUNT_ID) ENABLED_TOOLKITS.add('jira');
  if (DRIVE_ACCOUNT_ID) ENABLED_TOOLKITS.add('googledrive');
  if (CALENDAR_ACCOUNT_ID) ENABLED_TOOLKITS.add('googlecalendar');
  if (GMAIL_ACCOUNT_ID) ENABLED_TOOLKITS.add('gmail');

  if (ENABLED_TOOLKITS.size === 0) {
    console.error('\n❌ No connected accounts configured — set at least one of:');
    console.error('   JIRA_CONNECTED_ACCOUNT_ID, GOOGLEDRIVE_CONNECTED_ACCOUNT_ID,');
    console.error('   GOOGLECALENDAR_CONNECTED_ACCOUNT_ID, GMAIL_CONNECTED_ACCOUNT_ID');
    process.exit(1);
  }

  const selectedTools = allComposioTools.filter((t) => {
    const toolkit = t.name.split('_')[1]; // composio_<toolkit>_<action>
    return ENABLED_TOOLKITS.has(toolkit ?? '');
  });
  console.info(
    `📎 Binding ${selectedTools.length} tools for toolkits: ${[...ENABLED_TOOLKITS].join(', ')}`
  );

  // Pre-fill the Composio credentials that every tool requires so the LLM
  // does not need to know about composio_user_id / composio_connected_account_id.
  // Matimo's parameter injection resolves these at execute time.
  const accountIdFor: Record<string, string> = {
    jira: JIRA_ACCOUNT_ID,
    googledrive: DRIVE_ACCOUNT_ID,
    googlecalendar: CALENDAR_ACCOUNT_ID,
    gmail: GMAIL_ACCOUNT_ID,
  };

  // convertToolsToLangChain(tools, matimoInstance, envVarsToInject)
  // COMPOSIO_API_KEY is resolved automatically from process.env by Matimo's
  // auth-parameter injection (it's used as `x-api-key` in the tool headers).
  const langchainTools = await convertToolsToLangChain(selectedTools as ToolDefinition[], matimo, {
    COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY!,
  });

  const llm = new ChatOpenAI({ modelName: 'gpt-4o-mini', temperature: 0 });

  // composio_user_id and composio_connected_account_id are tool parameters that
  // the LLM must supply on every call. Tell the agent what values to use via
  // the task description — in production you'd inject these via a system prompt.
  const userContext = `Use composio_user_id="${COMPOSIO_USER_ID}" and the appropriate connected_account_id for each toolkit: ${Object.entries(
    accountIdFor
  )
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}="${v}"`)
    .join(', ')}.`;

  const taskParts: string[] = [];
  if (JIRA_ACCOUNT_ID)
    taskParts.push(
      'find unresolved Jira issues using JQL: statusCategory != Done AND assignee = currentUser()'
    );
  if (CALENDAR_ACCOUNT_ID) taskParts.push('list upcoming Google Calendar events for today');
  if (DRIVE_ACCOUNT_ID) taskParts.push('list recent files in Google Drive');
  if (GMAIL_ACCOUNT_ID) taskParts.push('fetch my 5 most recent Gmail messages');
  const task = `${userContext} Then: ${taskParts.join(', then ')}`;

  console.info(`\n🎯 Task: "${taskParts.join(', then ')}"`);
  console.info('\n' + '─'.repeat(70));

  const agent = await createAgent({ model: llm, tools: langchainTools as any[] });
  const response = await agent.invoke({
    messages: [{ role: 'user', content: task }],
  });

  console.info('\n' + '─'.repeat(70));
  console.info('\n📝 Agent response:');
  const lastMessage = response.messages[response.messages.length - 1];
  if (lastMessage) {
    console.info(
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content, null, 2)
    );
  }
  console.info('\n' + '='.repeat(70) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
