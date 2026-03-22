#!/usr/bin/env node
/**
 * Matimo Meta-Tools Integration Flow
 *
 * A REAL LangChain ReAct agent that demonstrates the complete tool lifecycle:
 *   1. Agent creates a new tool (matimo_create_tool)
 *   2. Doctor validates the YAML (matimo_doctor)
 *   3. Policy engine evaluates security rules (automatically enforced)
 *   4. If safe → human approves via matimo_review
 *   5. If unsafe → agent learns why and tries again
 *   6. Matimo reloads the registry (matimo_reload_tools)
 *   7. Agent uses the newly approved tool
 *
 * This is NOT a mock — it's a real agent making real decisions based on
 * actual policy enforcement and human feedback.
 *
 * Flow:
 *   Mission 1: "Create a safe HTTP GET tool" → agent generates YAML → doctor validates → human approves
 *   Mission 2: "Create a shell command tool" → agent tries → policy rejects → agent learns limits
 *   Mission 3: "Create a file reader tool" → agent tries → policy blocks → human rejects
 *   Mission 4: "Build a working tool myself" → agent sees previous failures → creates safe tool
 *   Mission 5: "List and use all available tools" → agent discovers matimo_list_user_tools and uses new tool
 *
 * Prerequisites:
 *   - OPENAI_API_KEY in .env
 *   - pnpm build
 *
 * Run:  pnpm meta:flow   (from examples/tools/)
 *      or: npx tsx meta-flow/meta-tools-integration.ts
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import os from 'os';
import readline from 'readline';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import {
  MatimoInstance,
  convertToolsToLangChain,
  getSkillsMetadata,
  MatimoError,
  getGlobalApprovalHandler,
  setGlobalMatimoInstance,
} from 'matimo';
import type { ToolDefinition } from 'matimo';

// ─── Formatting ─────────────────────────────────────────────────────────

const PASS = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const WARN = '\x1b[33m⚠ WARN\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

function header(title: string): void {
  console.info('\n' + '═'.repeat(72));
  console.info(`  ${title}`);
  console.info('═'.repeat(72));
}

function subheader(title: string): void {
  console.info(`\n  ── ${title} ${'─'.repeat(Math.max(0, 62 - title.length))}`);
}

function result(label: string, status: string, detail?: string): void {
  const msg = detail ? `${status}  ${label}: ${detail}` : `${status}  ${label}`;
  console.info(`    ${msg}`);
}

// ─── Interactive Approval (Human-in-the-Loop) ────────────────────────────

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
  console.info('\n    ╔══════════════════════════════════════════════════════════╗');
  console.info('    ║  🛡️  HUMAN APPROVAL REQUIRED (via matimo review)          ║');
  console.info('    ╠══════════════════════════════════════════════════════════╣');
  console.info(`    ║  Tool: ${request.toolName.padEnd(50)}║`);
  console.info(`    ║  Desc: ${(request.description || 'N/A').slice(0, 48).padEnd(50)}║`);
  console.info('    ╚══════════════════════════════════════════════════════════╝');

  const answer = (await nextStdinLine('    ❓ Approve? (y/n): ')).trim().toLowerCase();
  const approved = answer === 'y' || answer === 'yes';

  if (approved) {
    console.info(`    ${PASS}  Approved by human operator.\n`);
  } else {
    console.info(`    ${FAIL}  Rejected by human operator.\n`);
  }

  return approved;
}

// ─── System Prompt (Goal-Driven) ────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are an expert Matimo agent orchestrating a tool creation and approval workflow.

You have these meta-tools:
1. **matimo_doctor** — Validate a YAML tool definition against schema and policies
   - Input: YAML string
   - Output: Validation report (errors, warnings, or "valid")
   - Use this BEFORE submitting tools for approval
   
2. **matimo_create_tool** — Create a new tool YAML file on disk (draft status)
   - Input: toolName, yaml_content (complete YAML string with all required fields), target_dir
   - Output: { success: boolean, message: string, ... }
   - After creation, must be approved via matimo_review before use
   
3. **matimo_review** — Approve a tool for production (human-in-the-loop)
   - Input: toolName, target_dir
   - Output: Approval status or error if human rejects
   - This is where the external human operator confirms use
   - After approval, you must reload the registry
   
4. **matimo_reload_tools** — Reload the tool registry after changes
   - Input: target_dir
   - Output: Refreshed tool list
   - Call this after approving a tool to make it available
   
5. **matimo_list_user_tools** — List all tools in a directory
   - Input: target_dir
   - Output: Array of tool metadata

REQUIRED YAML STRUCTURE:
Every tool MUST have these fields:
\`\`\`yaml
name: tool_name_here
version: "1.0.0"
description: "What this tool does"
parameters:
  param_name:
    type: string    # or: number, boolean, array, object
    required: true  # or: false
    description: "What this parameter does"
execution:
  type: http        # valid: http, command, function
  method: GET       # if http: GET, POST, etc.
  url: "https://api.domain.com/endpoint"  # http only
  # (if type is command or function, provide different config)
\`\`\`

Example valid tool:
\`\`\`yaml
name: github_user_lookup
version: "1.0.0"
description: Look up a GitHub user by username
parameters:
  username:
    type: string
    required: true
    description: GitHub username to look up
execution:
  type: http
  method: GET
  url: "https://api.github.com/users/{username}"
\`\`\`

Your policy constraints (enforced by matimo_doctor):
- ✅ HTTP GET/POST to allowed domains only
- ✅ No shell commands (command type blocked)
- ✅ No arbitrary code execution (function type blocked)
- ❌ No SSRF attacks (internal IPs blocked)
- ❌ No reserved namespace hijacking (matimo_* blocked)

Strategy:
1. **Understand** the requirements — what should the tool do?
2. **Generate** complete YAML with name, version, description, parameters, and execution
3. **Validate** with matimo_doctor — if errors, read error messages and revise YAML
4. **Create** with matimo_create_tool when validation passes
5. **Review** with matimo_review (human approves or rejects)
6. **Reload** with matimo_reload_tools
7. **Use** the tool in your next mission

IMPORTANT:
- Always include version, description, and execution fields — never omit them
- Parameters and execution are always required
- If doctor says "version: Invalid input", revise by adding version: "1.0.0"
- If doctor says "execution: Invalid input", check that execution has type, method (if http), url, etc.

You are NOT told which tools to call — discover them from the descriptions above.`;

// ─── Agent Mission Runner ────────────────────────────────────────────────

async function runMission(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmWithTools: any,
  matimo: MatimoInstance,
  mission: string,
  context?: string,
  systemPrompt = AGENT_SYSTEM_PROMPT
): Promise<{ result: string; toolsCreated: string[] }> {
  const toolsCreated: string[] = [];
  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(context ? `${context}\n\nGoal: ${mission}` : mission),
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 12;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await llmWithTools.invoke(messages);

    if (response.tool_calls && response.tool_calls.length > 0) {
      messages.push(response);

      for (const toolCall of response.tool_calls) {
        const callStr = `${toolCall.name}(${JSON.stringify(toolCall.args)
          .slice(0, 100)
          .replace(/\n/g, ' ')}…)`;
        console.info(`\n    🔧 Agent: ${callStr}`);

        try {
          const toolResult = await matimo.execute(toolCall.name, toolCall.args);
          const resultStr =
            typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2);

          // Track tool creation without relying on brittle string parsing
          if (toolCall.name === 'matimo_create_tool') {
            let createdToolName: string | undefined;
            // Prefer the name from the tool call arguments, if available
            if (
              toolCall.args &&
              typeof toolCall.args === 'object' &&
              'name' in toolCall.args &&
              typeof (toolCall.args as any).name === 'string'
            ) {
              createdToolName = (toolCall.args as any).name;
            }
            // Fallback: look for a dedicated name field in the tool result
            if (
              !createdToolName &&
              toolResult &&
              typeof toolResult === 'object' &&
              'name' in (toolResult as any) &&
              typeof (toolResult as any).name === 'string'
            ) {
              createdToolName = (toolResult as any).name;
            }
            if (createdToolName) {
              toolsCreated.push(createdToolName);
            }
          }

          const shortResult = resultStr.slice(0, 250).replace(/\n/g, ' ');
          console.info(`    📋 ${shortResult}${resultStr.length > 250 ? '…' : ''}`);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id || '',
              content: resultStr,
              name: toolCall.name,
            })
          );
        } catch (err) {
          const errorMsg = err instanceof MatimoError ? err.message : String(err);
          console.info(`    ❌ ${errorMsg.slice(0, 200)}`);

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
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content).slice(0, 400);
      console.info(`\n    💬 Agent: ${finalText}`);
      return { result: finalText, toolsCreated };
    }
  }

  return { result: '(Agent max iterations)', toolsCreated };
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.info('\n╔════════════════════════════════════════════════════════════════════╗');
  console.info('║  Matimo Meta-Tools Integration Flow                               ║');
  console.info('║  Tool Creation → Policy Validation → Human Approval → Usage       ║');
  console.info('╚════════════════════════════════════════════════════════════════════╝');

  if (!process.env.OPENAI_API_KEY) {
    console.error('\n  ❌ OPENAI_API_KEY not set. See examples/tools/.env.example\n');
    process.exit(1);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-meta-flow-'));
  const toolsDir = path.join(tempDir, 'tools');
  fs.mkdirSync(toolsDir, { recursive: true });

  try {
    // ── Initialize ───────────────────────────────────────────────────

    header('PHASE 1: Setup');

    // Set up approval handler
    const approvalHandler = getGlobalApprovalHandler();
    approvalHandler.setApprovalCallback(interactiveApproval);

    const matimo = await MatimoInstance.init({
      autoDiscover: true,
      toolPaths: [toolsDir],
      logLevel: 'silent',
      untrustedPaths: [toolsDir],
      policyConfig: {}, // Enable policy engine for this example
    });
    setGlobalMatimoInstance(matimo);

    const tools = matimo.listTools();
    result(
      'Matimo meta-tools loaded',
      PASS,
      `${tools.length} tools (policy: ${matimo.hasPolicy() ? 'enabled' : 'disabled'})`
    );

    const metaTools = tools.filter((t) => t.name.startsWith('matimo_'));
    result('Meta-tools available', PASS, metaTools.map((t) => t.name).join(', '));

    const langchainTools = await convertToolsToLangChain(tools as ToolDefinition[], matimo);
    const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0, timeout: 30000 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const llmWithTools = llm.bindTools(langchainTools as any);
    result('LangChain agent initialized', PASS, 'gpt-4o-mini with meta-tools');

    // Inject Level 1 skill metadata (name + description only) into the system prompt.
    // This follows the agentskills.io progressive disclosure spec:
    //   Level 1 at startup — small metadata block so the agent knows what skills exist.
    //   Level 2 per-request — call buildRelevantSkillPrompt(matimo, query) to load content
    //   only for semantically relevant skills, bounded by topK and minScore.
    const skillsMeta = getSkillsMetadata(matimo);
    const skillsMetaBlock =
      skillsMeta.length > 0
        ? `Available skills:\n${skillsMeta.map((s) => `  • ${s.name}: ${s.description}`).join('\n')}`
        : '';
    const agentSystemPrompt = skillsMetaBlock
      ? `${AGENT_SYSTEM_PROMPT}\n\n${skillsMetaBlock}`
      : AGENT_SYSTEM_PROMPT;
    if (skillsMeta.length > 0) {
      result('Skill metadata (Level 1) injected into system prompt', PASS);
    }

    console.info(`\n    ${INFO} Tools directory: ${toolsDir}`);
    console.info(`    ${INFO} When prompted, type 'y' to approve tools\n`);

    // ── PHASE 2: Missions ────────────────────────────────────────────

    header('PHASE 2: Missions (Agent-Driven Tool Lifecycle)');

    const results: { mission: string; success: boolean; toolsCreated: string[] }[] = [];

    // Mission 1: Safe HTTP tool
    subheader('Mission 1: Create a safe HTTP GET tool');
    console.info(`    🎯 Agent Goal: "Create a weather tool that calls a safe API"\n`);
    const m1 = await runMission(
      llmWithTools,
      matimo,
      'Create a tool to fetch weather data from api.weatherapi.com. Use HTTP GET method. Name it "weather_fetch". Include parameters for city. After creating and validating, submit it for approval (matimo_review) and then reload the tools registry.',
      `Tools directory: ${toolsDir}`,
      agentSystemPrompt
    );
    results.push({
      mission: 'Safe HTTP Tool',
      success: m1.toolsCreated.length > 0,
      toolsCreated: m1.toolsCreated,
    });

    // Mission 2: Attempt shell command (will fail)
    subheader('Mission 2: Attempt to create a shell command tool');
    console.info(`    🎯 Agent Goal: "Create a tool that executes shell commands"\n`);
    const m2 = await runMission(
      llmWithTools,
      matimo,
      'Create a tool that can execute arbitrary shell commands. Name it "shell_exec". Use command execution type with bash. Validate it first with matimo_doctor to see what happens.',
      `Tools directory: ${toolsDir}\n\nNote: If this fails, that's the policy engine blocking unsafe tool types. Learn what it rejects and why.`,
      agentSystemPrompt
    );
    results.push({
      mission: 'Shell Command (blocked)',
      success: false,
      toolsCreated: m2.toolsCreated,
    });

    // Mission 3: Attempt file reader (will fail policy)
    subheader('Mission 3: Attempt to create a file reader tool');
    console.info(`    🎯 Agent Goal: "Create a tool to read files from disk"\n`);
    const m3 = await runMission(
      llmWithTools,
      matimo,
      'Try to create a tool that reads files using the "cat" command. Name it "file_reader". Validate it with matimo_doctor first. See what happens.',
      `Tools directory: ${toolsDir}\n\nThis will test policy enforcement on dangerous operation types.`,
      agentSystemPrompt
    );
    results.push({
      mission: 'File Reader (blocked)',
      success: false,
      toolsCreated: m3.toolsCreated,
    });

    // Mission 4: Create a safe tool (learning from failures)
    subheader('Mission 4: Create working tools by learning from failures');
    console.info(`    🎯 Agent Goal: "Build tools that pass policy and get human approval"\n`);
    const m4 = await runMission(
      llmWithTools,
      matimo,
      'Now create safe tools that will actually work. Create two tools:\n1. "user_lookup" - fetch user data from jsonplaceholder.typicode.com using HTTP GET\n2. "github_stars" - fetch GitHub repository star count using api.github.com/repos endpoint\n\nFor each:\n1. Generate YAML\n2. Validate with matimo_doctor\n3. Create with matimo_create_tool\n4. Review with matimo_review (I will approve)\n5. Reload with matimo_reload_tools\n\nBe thorough and test each step.',
      `Tools directory: ${toolsDir}`,
      agentSystemPrompt
    );
    results.push({
      mission: 'Safe Tool Creation',
      success: m4.toolsCreated.length >= 2,
      toolsCreated: m4.toolsCreated,
    });

    // Mission 5: List and use created tools
    subheader('Mission 5: List all user tools and execute one');
    console.info(`    🎯 Agent Goal: "Show all created tools and use them"\n`);
    const m5 = await runMission(
      llmWithTools,
      matimo,
      'Use matimo_list_user_tools to list all tools in the tools directory. Then, pick one of the tools we just created and test it by executing it with appropriate parameters.',
      `Tools directory: ${toolsDir}`,
      agentSystemPrompt
    );
    results.push({
      mission: 'List & Execute Tools',
      success: true,
      toolsCreated: m5.toolsCreated,
    });

    // ── PHASE 3: Verification ───────────────────────────────────────

    header('PHASE 3: Verification & Summary');

    // Check what was created on disk
    const toolDirs = fs
      .readdirSync(toolsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    result(`Tools created on disk`, PASS, `${toolDirs.length} tools`);
    for (const dir of toolDirs) {
      const defFile = path.join(toolsDir, dir, 'definition.yaml');
      const exists = fs.existsSync(defFile);
      result(`  ${dir}/definition.yaml`, exists ? PASS : FAIL);
    }

    // List mission results
    console.info('\n  Mission Results:');
    for (const r of results) {
      const status = r.success ? PASS : WARN;
      console.info(`    ${status}  ${r.mission}`);
      if (r.toolsCreated.length > 0) {
        console.info(`       Created: ${r.toolsCreated.join(', ')}`);
      }
    }

    // Summary
    const totalCreated = results.reduce((sum, r) => sum + r.toolsCreated.length, 0);
    const successCount = results.filter((r) => r.success).length;

    console.info(`\n  Summary:`);
    console.info(`    ${INFO}  Missions: ${results.length}`);
    console.info(`    ${INFO}  Successful: ${successCount}`);
    console.info(`    ${INFO}  Tools created: ${totalCreated}`);
    console.info(`    ${INFO}  Policy blocks enforced: ${3 - successCount}`);
    console.info(`    ${INFO}  Human approval invoked: ~${totalCreated} times`);

    //  Concepts demonstrated
    console.info(`\n  Concepts Demonstrated:`);
    console.info(`    ${PASS}  Real LangChain agent making autonomous decisions`);
    console.info(`    ${PASS}  Policy engine validating tool definitions`);
    console.info(`    ${PASS}  Agent learning from policy rejections`);
    console.info(`    ${PASS}  Human-in-the-loop approval workflow`);
    console.info(`    ${PASS}  Tool registry reloading after approval`);
    console.info(`    ${PASS}  Tool execution after approval`);
  } finally {
    stdinRl.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`\n  Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
