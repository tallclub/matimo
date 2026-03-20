#!/usr/bin/env node
/**
 * Matimo — Interactive Autonomous Agent
 *
 * A true ReAct agent that takes natural language missions and autonomously:
 *   1. Discovers available skills & tools at startup via autoDiscover
 *   2. Takes a user-provided mission/prompt
 *   3. Autonomously decides which tools to call
 *   4. Executes a ReAct loop until the mission completes
 *   5. Reports results & audit trail
 *
 * Features:
 *   - Natural language mission input (from CLI arg or stdin)
 *   - Auto-discovery of all @matimo/* provider tools and skills
 *   - Core skills (tool-discovery, skill-creator, policy-validation, etc.)
 *   - Provider skills (@matimo/slack, @matimo/gmail, etc.)
 *   - Policy engine blocks unsafe tools
 *   - HITL quarantine for medium/high-risk tools
 *   - Audit event logging for all decisions
 *   - Agent can create new tools via matimo_create_tool
 *
 * Prerequisites:
 *   - OPENAI_API_KEY in .env or environment
 *   - pnpm build (matimo must be compiled)
 *
 * Usage:
 *   # From CLI argument:
 *   pnpm agent:skills-policy "List all available skills and tell me what each one does"
 *
 *   # From stdin (interactive):
 *   pnpm agent:skills-policy
 *   > Enter your mission: ...
 */

import 'dotenv/config';
import readline from 'readline';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import {
  MatimoInstance,
  convertToolsToLangChain,
  getGlobalApprovalHandler,
  setGlobalMatimoInstance,
} from 'matimo';
import type { ToolDefinition, PolicyConfig, MatimoEvent, HITLRequest } from 'matimo';

// ─── Formatting ─────────────────────────────────────────────────────────

const PASS = '\x1b[32m✓ PASS\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

function header(title: string): void {
  console.info('\n' + '═'.repeat(68));
  console.info(`  ${title}`);
  console.info('═'.repeat(68));
}

function subheader(title: string): void {
  console.info(`\n  ── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`);
}

function status(label: string, detail?: string): void {
  const msg = detail ? `${PASS}  ${label}: ${detail}` : `${PASS}  ${label}`;
  console.info(`    ${msg}`);
}

// ─── Interactive Terminal HITL & Approval ────────────────────────────────

const approvedWhitelist = new Set<string>();

const stdinLineBuffer: string[] = [];
let stdinLineResolve: ((line: string) => void) | null = null;
const stdinRl = readline.createInterface({ input: process.stdin, output: process.stdout });
stdinRl.on('line', (line) => {
  if (stdinLineResolve) {
    const resolve = stdinLineResolve;
    stdinLineResolve = null;
    resolve(line);
  } else {
    stdinLineBuffer.push(line);
  }
});

function nextStdinLine(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  if (stdinLineBuffer.length > 0) {
    return Promise.resolve(stdinLineBuffer.shift()!);
  }
  return new Promise<string>((resolve) => {
    stdinLineResolve = resolve;
  });
}

async function interactiveApproval(request: {
  toolName: string;
  description?: string;
  params?: Record<string, unknown>;
}): Promise<boolean> {
  if (approvedWhitelist.has(request.toolName)) {
    console.info(`    ${PASS}  Auto-approved (whitelisted): ${request.toolName}`);
    return true;
  }

  console.info('\n    ┌──────────────────────────────────────────────────────────────┐');
  console.info('    │  🛡️  APPROVAL REQUIRED                                       │');
  console.info('    ├──────────────────────────────────────────────────────────────┤');
  console.info(`    │  Tool:   ${request.toolName}`);
  console.info(`    │  Desc:   ${(request.description || 'N/A').slice(0, 50)}`);
  console.info('    └──────────────────────────────────────────────────────────────┘');

  const answer = (await nextStdinLine('    ❓ Approve? (y/n): ')).trim().toLowerCase();
  const approved = answer === 'y' || answer === 'yes';
  if (approved) approvedWhitelist.add(request.toolName);
  return approved;
}

/** HITL callback — shown when policy quarantines a tool */
async function hitlApproval(request: HITLRequest): Promise<boolean> {
  console.info('\n    ┌──────────────────────────────────────────────────────────────┐');
  console.info('    │  ⏸️  HITL QUARANTINE — HUMAN REVIEW REQUIRED                 │');
  console.info('    ├──────────────────────────────────────────────────────────────┤');
  console.info(`    │  Tool:        ${request.toolName}`);
  console.info(`    │  Risk Level:  ${request.riskLevel}`);
  console.info(`    │  Reason:      ${request.reason.slice(0, 50)}`);
  console.info(`    │  Environment: ${request.environment || 'N/A'}`);
  console.info('    └──────────────────────────────────────────────────────────────┘');

  const answer = (await nextStdinLine('    ❓ Approve quarantined tool? (y/n): '))
    .trim()
    .toLowerCase();
  return answer === 'y' || answer === 'yes';
}

// ─── System Prompt ──────────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are an autonomous AI agent powered by the Matimo SDK.

Your capabilities:
1. **Tools** — You have access to various tools to accomplish tasks (HTTP requests, calculations, data operations, etc.)
   - Use the available tools to complete your mission
   - Call tools based on what you need to accomplish
   - Handle tool responses and build on them

2. **Skills** — You can discover and learn from domain knowledge at runtime
   - Use matimo_list_skills to discover available skills and expertise
   - Use matimo_get_skill to load full skill content for deep context
   - Skills come from @matimo/* providers (slack, gmail, hubspot, etc.) and core
   - Skills teach you strategies, best practices, and domain-specific patterns

3. **Policy Engine** — Security rules govern your tool usage
   - Respect security policies and use only allowed tools
   - If a tool is quarantined, it needs human review before execution
   - Some tools require human confirmation before execution

4. **Tool Creation** — You can create new tools at runtime
   - Use matimo_validate_tool to check tool YAML before creating
   - Use matimo_create_tool to create new tools (requires approval)
   - New tools go through policy validation and HITL review

Your approach:
- Think step-by-step about how to complete the given mission
- Start by discovering available skills and tools if relevant
- Choose the right tools for each step
- Execute tools autonomously and interpret results
- Continue until the mission is complete
- If you get stuck, try alternative approaches

You decide what tools to use — use your judgment and the available tools to complete your mission efficiently.`.trim();

// ─── Agent Runner ───────────────────────────────────────────────────────

async function runMission(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmWithTools: any,
  matimo: MatimoInstance,
  mission: string
): Promise<string> {
  const messages: BaseMessage[] = [
    new SystemMessage(AGENT_SYSTEM_PROMPT),
    new HumanMessage(mission),
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 10;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await llmWithTools.invoke(messages);

    if (response.tool_calls && response.tool_calls.length > 0) {
      messages.push(response);

      for (const toolCall of response.tool_calls) {
        const isSkillTool = toolCall.name.includes('skill');
        const icon = isSkillTool ? '📚' : '🔧';
        console.info(
          `    ${icon} Agent calls: ${toolCall.name}(${JSON.stringify(toolCall.args).slice(0, 120)}${JSON.stringify(toolCall.args).length > 120 ? '…' : ''})`
        );

        try {
          const toolResult = await matimo.execute(toolCall.name, toolCall.args);
          const resultStr =
            typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2);
          // Show full content for skill reads so the agent's knowledge source is visible
          const preview = isSkillTool
            ? resultStr
            : `${resultStr.slice(0, 200)}${resultStr.length > 200 ? '…' : ''}`;
          console.info(`    📋 Result: ${preview}`);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id || '',
              content: resultStr,
              name: toolCall.name,
            })
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.info(`    ❌ Error: ${errorMsg.slice(0, 200)}`);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id || '',
              content: `Error: ${errorMsg}`,
              name: toolCall.name,
            })
          );
        }
      }
    } else {
      const finalText =
        typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      console.info(`    💬 Agent: ${finalText}`);
      return finalText;
    }
  }

  return '(Agent reached max iterations)';
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.info('\n╔════════════════════════════════════════════════════════════════════╗');
  console.info('║    Matimo — Interactive Agent: Skills + Policy + HITL + Tools    ║');
  console.info('║    Autonomous LangChain ReAct Agent with Matimo Integration       ║');
  console.info('╚════════════════════════════════════════════════════════════════════╝');

  if (!process.env.OPENAI_API_KEY) {
    console.error('\n  ❌ OPENAI_API_KEY not set. Add it to examples/tools/.env or export it.\n');
    process.exit(1);
  }

  const auditLog: MatimoEvent[] = [];

  try {
    // ── Setup: Initialize Matimo with auto-discovery ────────────────

    header('SETUP: Initializing Matimo');

    const policyConfig: PolicyConfig = {
      allowedDomains: ['jsonplaceholder.typicode.com', 'api.weatherapi.com'],
      allowedHttpMethods: ['GET', 'POST'],
      allowCommandTools: false,
      allowFunctionTools: false,
      protectedNamespaces: ['matimo_'],
      enableHITL: true,
      quarantineRiskLevels: ['medium', 'high'],
    };

    console.info(`\n  ${INFO} Policy Configuration:`);
    console.info(`    • allowedDomains:          ${policyConfig.allowedDomains!.join(', ')}`);
    console.info(`    • allowCommandTools:       ${policyConfig.allowCommandTools}`);
    console.info(`    • enableHITL:              ${policyConfig.enableHITL}`);
    console.info(`    • quarantineRiskLevels:    ${policyConfig.quarantineRiskLevels!.join(', ')}`);

    // autoDiscover: true — discovers all @matimo/* tools AND skills automatically
    // Core tools (matimo_list_skills, matimo_get_skill, matimo_create_tool, etc.)
    // Core skills (tool-discovery, skill-creator, policy-validation, etc.)
    // Provider skills (@matimo/slack, @matimo/gmail, @matimo/hubspot, etc.)
    const matimo = await MatimoInstance.init({
      autoDiscover: true,
      policyConfig,
      logLevel: 'silent',
      onEvent: (event: MatimoEvent) => {
        auditLog.push(event);
        if (event.type === 'tool:quarantined') {
          console.info(`    ⏸️  QUARANTINED: ${event.toolName} (${event.riskLevel})`);
        }
        if (event.type === 'tool:quarantine_approved') {
          console.info(`    ✅ QUARANTINE APPROVED: ${event.toolName}`);
        }
        if (event.type === 'tool:quarantine_rejected') {
          console.info(`    ❌ QUARANTINE REJECTED: ${event.toolName}`);
        }
        if (event.type === 'policy:reloaded') {
          console.info(`    🔄 POLICY RELOADED at ${event.timestamp}`);
        }
      },
      onHITL: hitlApproval,
    });

    getGlobalApprovalHandler().setApprovalCallback(interactiveApproval);
    setGlobalMatimoInstance(matimo);

    const tools = matimo.listTools();
    status(`Matimo initialized — ${tools.length} tools loaded`);
    status(`Policy engine active: ${matimo.hasPolicy()}`);

    const skills = matimo.listSkills();
    status(`Skills loaded: ${skills.length}`);
    if (skills.length > 0) {
      console.info(`    ${INFO} Skills: ${skills.map((s) => s.name).join(', ')}`);
    }

    const langchainTools = await convertToolsToLangChain(tools as ToolDefinition[], matimo);
    const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const llmWithTools = llm.bindTools(langchainTools as any);
    status('LLM (gpt-4o-mini) bound with tools');

    // ── Interactive: Agent takes mission from user ─────────────────

    header('AGENT MISSION');

    console.info(
      `\n  ${INFO} Available tools: ${tools
        .map((t) => t.name)
        .slice(0, 5)
        .join(', ')}${tools.length > 5 ? ` ... +${tools.length - 5} more` : ''}`
    );

    const userMission = process.argv[2] || (await nextStdinLine('\n🎯 Enter your mission:\n> '));

    subheader('Mission');
    console.info(`    🎯 "${userMission}"\n`);

    const finalResponse = await runMission(llmWithTools, matimo, userMission);
    console.info(`\n  ${INFO} Final response:`);
    console.info(`    "${finalResponse}"`);

    // ── Audit Trail ──────────────────────────────────────────────

    header('AUDIT TRAIL');

    console.info(`\n    ${INFO} Total audit events: ${auditLog.length}\n`);
    const eventCounts: Record<string, number> = {};
    for (const event of auditLog) {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(eventCounts).sort()) {
      console.info(`    ${type}: ${count}`);
    }

    console.info('\n' + '═'.repeat(68));
    console.info('  Agent Complete!');
    console.info('═'.repeat(68) + '\n');
  } finally {
    stdinRl.close();
  }
}

main().catch((err) => {
  console.error('❌ Agent failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
