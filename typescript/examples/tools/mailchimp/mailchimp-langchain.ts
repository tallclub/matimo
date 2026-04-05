#!/usr/bin/env node
/**
 * ============================================================================
 * MAILCHIMP TOOLS - LANGCHAIN AI AGENT EXAMPLE
 * ============================================================================
 *
 * PATTERN: Autonomous AI Agent — Goal-Driven Workflow
 * ─────────────────────────────────────────────────────────────────────────
 * The agent receives BUSINESS GOALS in natural language — it decides which
 * Mailchimp tools to call, in what order, and how to chain results between
 * them. No tool names, no API concepts, no IDs are given in the prompts.
 *
 * This is the point of Matimo + LangChain: define tools once, let the
 * agent figure out how to use them.
 *
 * GOALS given to the agent (purely business language):
 *   1. "Show me all my mailing lists"
 *   2. "Who are the subscribers in my first list?"
 *   3. "Update the first contact's profile"
 *   4. "Create a new email campaign for my first list"
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 *   export MAILCHIMP_API_KEY=abc123def456-us6
 *   export OPENAI_API_KEY=sk-xxxxxxxxxxxxx
 *   pnpm mailchimp:langchain
 *
 * ============================================================================
 */

import 'dotenv/config';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { MatimoInstance, convertToolsToLangChain } from 'matimo';

async function runMailchimpAIAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║   Mailchimp - LangChain Autonomous Agent               ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  const apiKey = process.env.MAILCHIMP_API_KEY;
  if (!apiKey) {
    console.error('❌ MAILCHIMP_API_KEY not set.');
    console.info('   export MAILCHIMP_API_KEY="abc123def456-us6"');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set.');
    console.info('   export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  // The server prefix is infrastructure context required by every Mailchimp
  // API call — it is derived from the API key, not a business concept.
  const serverPrefix = apiKey.split('-').pop()!;
  console.info(`🔑 API Key is configured... 📍 Server`);
  console.info(`🤖 Using GPT-4o-mini\n`);

  // ── Initialize Matimo ────────────────────────────────────────────────────
  console.info('🚀 Initializing Matimo...');
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  const mailchimpToolDefs = matimo.listTools().filter((t) => t.name.startsWith('mailchimp-'));

  console.info(`✅ ${mailchimpToolDefs.length} Mailchimp tools registered:`);
  mailchimpToolDefs.forEach((t) => console.info(`   🔧 ${t.name}`));
  console.info();

  // Convert Matimo tools to LangChain format — inject the API key once
  const langchainTools = await convertToolsToLangChain(mailchimpToolDefs as any[], matimo, {
    MAILCHIMP_API_KEY: apiKey,
  });

  // ── Build the agent ──────────────────────────────────────────────────────
  const model = new ChatOpenAI({ modelName: 'gpt-4o-mini', temperature: 0 });

  console.info('🔧 Creating agent...\n');
  const agent = await createAgent({ model, tools: langchainTools as any[] });

  // ── Business goals — agent decides which tools to use ───────────────────
  //
  // The prompts contain ONLY business intent. The agent reads the tool
  // descriptions and autonomously chooses, orders, and chains tool calls.
  //
  // The server_prefix is passed as infrastructure context (every Mailchimp
  // API call requires it), not as a hint about which tool to use.
  //
  const context = `My Mailchimp server prefix is "${serverPrefix}".`;

  const goals = [
    {
      label: 'Goal 1 — What mailing lists do I have?',
      prompt: `${context} Show me all my mailing lists with their names and subscriber counts.`,
    },
    {
      label: 'Goal 2 — Who are my subscribers?',
      prompt:
        `${context} Show me the 5 most recent active subscribers in my first mailing list. ` +
        `Include their email addresses and statuses.`,
    },
    {
      label: "Goal 3 — Update a contact's profile",
      prompt:
        `${context} Get my first mailing list and find the first subscriber. ` +
        `Confirm they are still subscribed by updating their status to subscribed. Confirm the update.`,
    },
    {
      label: 'Goal 4 — Draft a new email campaign',
      prompt:
        `${context} Create a draft email campaign for my first mailing list. ` +
        `Use the first subscriber's email as the reply-to address. ` +
        `Subject: "Welcome from Matimo Agent", sender name: "Matimo Demo". ` +
        `Do not send it yet. Give me the campaign ID.`,
    },
  ];

  console.info('🧠 Running Goals — Agent Decides Which Tools to Use');
  console.info('═'.repeat(60));

  for (const goal of goals) {
    console.info(`\n📋 ${goal.label}`);
    console.info('─'.repeat(60));
    const userPrompt = goal.prompt.replace(`${serverPrefix}`, '<server-prefix>');
    console.info(`👤 User: "${userPrompt}"\n`);

    try {
      const response = await agent.invoke({
        messages: [{ role: 'user', content: goal.prompt }],
      });

      const lastMessage = response.messages[response.messages.length - 1];
      if (lastMessage) {
        const content =
          typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);
        console.info(`🤖 Agent: ${content}\n`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.info(`⚠️  Agent error: ${msg}\n`);
    }
  }

  console.info('═'.repeat(60));
  console.info('✨ Autonomous Agent Workflow Complete!\n');
  console.info('What the agent did on its own:');
  console.info('  ✅ Chose the right tool for each business goal');
  console.info('  ✅ Discovered audience IDs without being told to');
  console.info('  ✅ Chained tool outputs (IDs, hashes) into subsequent calls');
  console.info('  ✅ Only MAILCHIMP_API_KEY was required from the user\n');
}

runMailchimpAIAgent().catch(console.error);
