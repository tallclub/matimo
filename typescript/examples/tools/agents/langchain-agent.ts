#!/usr/bin/env node
/**
 * Matimo + LangChain Agent - Proper ReAct Agent Pattern
 *
 * This demonstrates a complete agent loop:
 * 1. LLM decides which tool to use based on goal
 * 2. Tool is executed via Matimo
 * 3. Result is fed back to LLM
 * 4. Process repeats until agent reaches conclusion
 *
 * Key advantages:
 * - Shows real agent reasoning loop
 * - Single source of truth (Matimo YAML definitions)
 * - How to integrate Matimo with any LangChain setup
 * - Demonstrates tool selection and execution
 *
 * Run: npm run agent:langchain
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import {
  MatimoInstance,
  convertToolsToLangChain,
  getSkillsMetadata,
  buildRelevantSkillPrompt,
} from 'matimo';
import type { ToolDefinition } from 'matimo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run LangChain ReAct Agent with Matimo Tools
 */
async function runLangChainAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║   Matimo + LangChain Agent (ReAct Pattern)              ║');
  console.info('║   Demonstrates real agent reasoning loop                ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Initialize Matimo
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    const allTools = matimo.listTools();
    console.info(`📦 Loaded ${allTools.length} tools`);

    // Filter tools to OpenAI's 128-tool limit (major providers only)
    const allowedPrefixes = [
      'slack_',
      'gmail_',
      'github_',
      'notion_',
      'execute',
      'read',
      'search',
      'web',
      'edit',
      'postgres_',
      'twilio_',
      'hubspot_',
      'mailchimp_',
    ];
    let matimoTools = allTools.filter((t) => allowedPrefixes.some((p) => t.name.startsWith(p)));
    if (matimoTools.length > 128) {
      matimoTools = matimoTools.slice(0, 128);
    }
    console.info(`📋 Filtered to ${matimoTools.length} tools (OpenAI limit: 128)\n`);

    // ✅ Convert Matimo tools to LangChain tools
    console.info('🔧 Converting Matimo tools to LangChain format...\n');
    const langchainTools = await convertToolsToLangChain(matimoTools as ToolDefinition[], matimo);

    console.info(`✅ Successfully converted ${langchainTools.length} tools!\n`);

    // 📚 Skills — non-MCP progressive disclosure pattern:
    //   Level 1 at startup: inject metadata (name + description) — token-safe, always-on.
    //   Level 2 per-request: call buildRelevantSkillPrompt(matimo, userQuery) during the
    //   ReAct loop to load only the skills that are semantically relevant to that message.
    // See: docs/skills/TFIDF_SEMANTIC_SEARCH.md for the ranking algorithm.
    const skillsMeta = getSkillsMetadata(matimo);
    const skillsMetaBlock =
      skillsMeta.length > 0
        ? `Available skills (use buildRelevantSkillPrompt per query to load content):\n${skillsMeta.map((s) => `  • ${s.name}: ${s.description}`).join('\n')}`
        : '';
    if (skillsMeta.length > 0) {
      console.info(`📚 ${skillsMeta.length} skill(s) discovered (Level 1 metadata)\n`);
    }

    // 🤖 Create GPT-4o LLM with tool binding
    console.info('🧠 Creating GPT-4o LLM with tool binding...\n');
    const llm = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0,
    });

    const llmWithTools = llm.bindTools(langchainTools as any);

    // 🎯 Agent Loop - ReAct Pattern
    console.info('🧪 Starting Agent Loop (ReAct Pattern)\n');
    console.info('═'.repeat(60));

    const userQuery = 'What is 42 plus 58?';
    console.info(`\n❓ User Query: "${userQuery}"\n`);

    // Per-request: load only the skills that are semantically relevant to this specific query.
    // buildRelevantSkillPrompt uses TF-IDF search — no API call, no token waste for unrelated skills.
    const skillContext = await buildRelevantSkillPrompt(matimo, userQuery, { topK: 2 });

    // Prepend Level 1 metadata so the agent knows all skills exist (startup awareness).
    // Then add Level 2 content only for the relevant ones (per-request).
    const messages: BaseMessage[] = [
      ...(skillsMetaBlock ? [new SystemMessage(skillsMetaBlock)] : []),
      ...(skillContext ? [new SystemMessage(skillContext)] : []),
      new HumanMessage(userQuery),
    ];

    let iterationCount = 0;
    const maxIterations = 10;
    let continueLoop = true;

    while (continueLoop && iterationCount < maxIterations) {
      iterationCount++;
      console.info(`\n[Iteration ${iterationCount}]`);
      console.info('─'.repeat(60));

      // Step 1: Call LLM with tools
      console.info('🤔 LLM Thinking...');
      const response = await llmWithTools.invoke(messages);
      console.info(`LLM Response Content: ${response.content || '(no text content)'}`);

      // Step 2: Check if LLM wants to use tools
      if (response.tool_calls && response.tool_calls.length > 0) {
        // Add assistant message to conversation
        messages.push(response);

        // Step 3: Execute each tool call
        for (const toolCall of response.tool_calls) {
          console.info(`\n🔧 Executing Tool: ${toolCall.name}`);
          console.info(`   Input: ${JSON.stringify(toolCall.args)}`);

          try {
            // Execute via Matimo
            const result = await matimo.execute(toolCall.name, toolCall.args);
            console.info(`   ✅ Result: ${JSON.stringify(result)}`);

            // Add tool result to conversation
            messages.push(
              new ToolMessage({
                tool_call_id: toolCall.id || '',
                content: JSON.stringify(result),
                name: toolCall.name,
              })
            );
          } catch (toolError) {
            const msg = toolError instanceof Error ? toolError.message : String(toolError);
            console.info(`   ❌ Error: ${msg}`);

            // Add error to conversation
            messages.push(
              new ToolMessage({
                tool_call_id: toolCall.id || '',
                content: `Error: ${msg}`,
                name: toolCall.name,
              })
            );
          }
        }
      } else {
        // Step 4: No more tools - agent reached conclusion
        console.info('\n✅ Agent Reached Conclusion');
        console.info(`\n📝 Final Response:\n${response.content || '(no response)'}`);
        continueLoop = false;
      }
    }

    if (iterationCount >= maxIterations) {
      console.info('\n⚠️  Max iterations reached');
    }

    console.info('\n' + '═'.repeat(60));
    console.info(`\n✨ Agent Loop Complete (${iterationCount} iterations)\n`);
  } catch (error) {
    console.error('❌ Agent failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the agent
runLangChainAgent().catch(console.error);
