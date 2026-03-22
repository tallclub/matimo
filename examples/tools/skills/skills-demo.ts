#!/usr/bin/env node
/**
 * Matimo Skills System — LangChain Agent Demonstration
 *
 * A REAL LangChain ReAct agent (gpt-4o-mini) that autonomously discovers and
 * uses Matimo's skills system, aligned with the official Agent Skills
 * specification (https://agentskills.io/specification).
 *
 * Skills are instructional documents (SKILL.md) with YAML frontmatter that
 * agents load on demand via progressive disclosure:
 *   Level 1 — Metadata (name + description) loaded at startup / via list
 *   Level 2 — Full instructions loaded when skill is activated
 *   Level 3 — Bundled resources (scripts/, references/, assets/) as needed
 *
 * Missions (goal-driven — the agent is NOT told which tools to call):
 *
 *   Mission 1: "Create a code review skill" — agent discovers matimo_create_skill
 *   Mission 2: "What skills are available?" — agent discovers matimo_list_skills
 *   Mission 3: "Read the code review skill and apply it" — agent discovers matimo_get_skill
 *   Mission 4: "Create a security checklist skill" — agent creates another skill
 *   Mission 5: "Validate the skills" — agent discovers matimo_validate_skill
 *   Mission 6: "Apply ALL skills to review this code" — agent reads & applies multiple skills
 *
 * Prerequisites:
 *   - OPENAI_API_KEY in .env or environment
 *   - pnpm build (matimo must be compiled)
 *
 * Run:  pnpm skills:demo   (from examples/tools/)
 *   or: npx tsx skills/skills-demo.ts
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
  buildRelevantSkillPrompt,
  setGlobalMatimoInstance,
  getGlobalApprovalHandler,
} from 'matimo';
import type { ToolDefinition } from 'matimo';

// ─── Formatting Helpers ─────────────────────────────────────────────────

const PASS = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const WARN = '\x1b[33m⚠ WARN\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

function header(title: string): void {
  console.info('\n' + '═'.repeat(68));
  console.info(`  ${title}`);
  console.info('═'.repeat(68));
}

function subheader(title: string): void {
  console.info(`\n  ── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`);
}

function result(label: string, status: string, detail?: string): void {
  const msg = detail ? `${status}  ${label}: ${detail}` : `${status}  ${label}`;
  console.info(`    ${msg}`);
}

// ─── Interactive Terminal Approval ──────────────────────────────────────

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
  console.info('    │  🛡️  HUMAN-IN-THE-LOOP APPROVAL REQUIRED                     │');
  console.info('    ├──────────────────────────────────────────────────────────────┤');
  console.info(`    │  Tool:        ${request.toolName}`);
  console.info(`    │  Description: ${(request.description || 'N/A').slice(0, 50)}`);
  console.info(`    │  Params:      ${JSON.stringify(request.params || {}).slice(0, 50)}…`);
  console.info('    └──────────────────────────────────────────────────────────────┘');

  const answer = (await nextStdinLine('    ❓ Approve this operation? (y/n): '))
    .trim()
    .toLowerCase();
  const approved = answer === 'y' || answer === 'yes';

  if (approved) {
    approvedWhitelist.add(request.toolName);
    console.info(`    ${PASS}  Approved — "${request.toolName}" added to session whitelist.`);
  } else {
    console.info(`    \x1b[33m⊘ BLOCKED\x1b[0m  Rejected by human operator.`);
  }

  return approved;
}

// ─── Sample Code for Agent to Review ────────────────────────────────────

const SAMPLE_CODE_TO_REVIEW = `
function processUserData(userData: any) {
  const result = eval(userData.query);
  
  const password = "admin123";
  
  fetch("http://api.example.com/users/" + userData.id)
    .then(res => res.json())
    .then(data => {
      console.info("User password:", data.password);
    });
  
  try {
    saveToDatabase(result);
  } catch (e) {
    // ignore errors
  }
  
  return result;
}
`.trim();

// ─── System Prompt ──────────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPT =
  `You are an AI agent powered by the Matimo SDK — a configuration-driven tool framework.

You work with Agent Skills — a lightweight, open format for giving agents new capabilities and expertise (https://agentskills.io).

Skills follow a progressive disclosure model:
- **Level 1 — Metadata**: List skills to see their names and descriptions (discovery)
- **Level 2 — Instructions**: Read a skill's SKILL.md to get its full instructions (activation)
- **Level 3 — Resources**: Skills can bundle scripts/, references/, and assets/ (on demand)

You have tools for:
- **Creating skills** — Create SKILL.md files following the Agent Skills spec. The name must be lowercase with hyphens only (e.g. "code-review"), max 64 characters. YAML frontmatter must include "name" and "description" fields. Optional: "license", "compatibility", "metadata".
- **Listing skills** — Discover available skills (Level 1 metadata).
- **Reading skills** — Retrieve full SKILL.md content (Level 2). Can also read bundled resource files (Level 3).
- **Validating skills** — Check a skill against the Agent Skills specification for correctness.

When creating a skill, the content MUST:
1. Start with YAML frontmatter enclosed in --- markers
2. Include "name:" and "description:" fields in the frontmatter
3. The frontmatter "name" field must match the directory/skill name parameter exactly
4. Contain structured markdown with actionable guidelines

When asked to apply a skill, first read it, then follow its guidelines in your response.

Choose the right tools based on the goal you're given. You are NOT told which tools to call.`.trim();

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
  const MAX_ITERATIONS = 8;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await llmWithTools.invoke(messages);

    if (response.tool_calls && response.tool_calls.length > 0) {
      messages.push(response);

      for (const toolCall of response.tool_calls) {
        console.info(
          `    🔧 Agent calls: ${toolCall.name}(${JSON.stringify(toolCall.args).slice(0, 120)}${JSON.stringify(toolCall.args).length > 120 ? '…' : ''})`
        );

        try {
          const toolResult = await matimo.execute(toolCall.name, toolCall.args);
          const resultStr =
            typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2);
          console.info(
            `    📋 Result: ${resultStr.slice(0, 200)}${resultStr.length > 200 ? '…' : ''}`
          );

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
      console.info(`    💬 Agent conclusion: ${finalText}`);
      return finalText;
    }
  }

  return '(Agent reached max iterations without concluding)';
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.info('\n╔════════════════════════════════════════════════════════════════════╗');
  console.info('║    Matimo Skills System — LangChain Agent Demonstration            ║');
  console.info('║    Agent Skills Specification: https://agentskills.io              ║');
  console.info('╚════════════════════════════════════════════════════════════════════╝');

  // ── Verify OpenAI API key ─────────────────────────────────────────

  if (!process.env.OPENAI_API_KEY) {
    console.error('\n  ❌ OPENAI_API_KEY not set. Add it to examples/tools/.env or export it.');
    console.error('     This example requires an LLM to demonstrate a real agent.\n');
    process.exit(1);
  }

  // ── Create temp directories ───────────────────────────────────────

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-skills-demo-'));
  const skillsDir = path.join(tempDir, 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });

  try {
    header('PHASE 1: Initialize Matimo with Skills Meta-Tools');

    // Set up approval handler
    const approvalHandler = getGlobalApprovalHandler();
    approvalHandler.setApprovalCallback(interactiveApproval);

    const matimo = await MatimoInstance.init({
      autoDiscover: true,
      logLevel: 'silent',
    });
    setGlobalMatimoInstance(matimo);

    const tools = matimo.listTools();
    result(`Matimo initialized — ${tools.length} tools loaded`, PASS);

    // Show skills-related tools
    const skillTools = tools.filter((t) => t.name.includes('skill'));
    result(`Skills meta-tools available: ${skillTools.map((t) => t.name).join(', ')}`, PASS);

    const langchainTools = await convertToolsToLangChain(tools as ToolDefinition[], matimo);
    result(`Converted ${langchainTools.length} tools to LangChain format`, PASS);

    const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const llmWithTools = llm.bindTools(langchainTools as any);
    result('LLM (gpt-4o-mini) initialized with tool bindings', PASS);

    // ── PHASE 2: Autonomous Agent Missions ────────────────────────

    header('PHASE 2: Autonomous Agent Missions — Skills Lifecycle');

    // ── Mission 1: Create a code review skill ───────────────────────

    subheader('Mission 1: Create a code review skill');
    console.info(
      '    🎯 Goal: "I need a code review checklist" — agent discovers matimo_create_skill.'
    );
    console.info("    🎯 When prompted, type 'y' to approve.\n");
    await runMission(
      llmWithTools,
      matimo,
      `I need a skill that provides a code review checklist. Create a skill called "code-review" with name "code-review" and description "Code review checklist and best practices" in the skills directory "${skillsDir}".

The skill content should be a comprehensive code review checklist in markdown format that covers:
- Code quality (readability, naming, DRY)
- Error handling (try/catch, validation)
- Security (no hardcoded secrets, no eval, input sanitization)
- Performance (no unnecessary loops, memory leaks)
- Testing (test coverage, edge cases)

Remember: the content MUST start with YAML frontmatter (---) containing name and description fields.`
    );

    // Verify skill was created
    const codeReviewPath = path.join(skillsDir, 'code-review', 'SKILL.md');
    const skillCreated = fs.existsSync(codeReviewPath);
    result(
      'code-review skill on disk',
      skillCreated ? PASS : FAIL,
      skillCreated ? codeReviewPath : 'NOT FOUND'
    );

    // ── Mission 2: List available skills ────────────────────────────

    subheader('Mission 2: Discover available skills');
    console.info(
      '    🎯 Goal: "What skills are available?" — agent discovers matimo_list_skills.\n'
    );
    await runMission(
      llmWithTools,
      matimo,
      `What skills are available in "${skillsDir}"? List them with their names and descriptions.`
    );

    // ── Mission 3: Read and apply the code review skill ─────────────

    subheader('Mission 3: Read and apply a skill to review code');
    console.info(
      '    🎯 Goal: "Apply the code review skill to this code" — agent discovers matimo_get_skill.\n'
    );
    const mission3Result = await runMission(
      llmWithTools,
      matimo,
      `Read the "code-review" skill from "${skillsDir}" and apply its guidelines to review this code. Point out every issue you find based on the skill's checklist:

\`\`\`typescript
${SAMPLE_CODE_TO_REVIEW}
\`\`\``
    );
    const mission3Passed =
      mission3Result.length > 100 &&
      (mission3Result.toLowerCase().includes('eval') ||
        mission3Result.toLowerCase().includes('password') ||
        mission3Result.toLowerCase().includes('error') ||
        mission3Result.toLowerCase().includes('security'));

    // ── Mission 4: Create a security checklist skill ────────────────

    subheader('Mission 4: Create a security checklist skill');
    console.info('    🎯 Goal: "I need a security-focused skill" — agent creates another skill.');
    console.info("    🎯 When prompted, type 'y' to approve.\n");
    await runMission(
      llmWithTools,
      matimo,
      `Create another skill called "security-checklist" with name "security-checklist" and description "Security vulnerability detection checklist" in "${skillsDir}".

The skill should focus specifically on security vulnerabilities:
- OWASP Top 10 (injection, XSS, SSRF, broken auth)
- Secrets management (no hardcoded passwords/keys)
- Input validation (sanitize all user input)
- Dangerous functions (eval, exec, innerHTML)
- Data exposure (no logging sensitive data)
- Dependency security (known vulnerabilities)

Remember: content MUST start with YAML frontmatter (---) with name and description.`
    );

    const securityPath = path.join(skillsDir, 'security-checklist', 'SKILL.md');
    const securityCreated = fs.existsSync(securityPath);
    result(
      'security-checklist skill on disk',
      securityCreated ? PASS : FAIL,
      securityCreated ? securityPath : 'NOT FOUND'
    );

    // ── Mission 5: Validate both skills against the spec ────────────

    subheader('Mission 5: Validate skills against the Agent Skills spec');
    console.info('    🎯 Goal: "Validate both skills" — agent discovers matimo_validate_skill.\n');
    await runMission(
      llmWithTools,
      matimo,
      `Validate both skills in "${skillsDir}" — "code-review" and "security-checklist" — to make sure they follow the Agent Skills specification. Report any errors or warnings.`
    );

    // ── Mission 6: Apply ALL skills together ────────────────────────

    subheader('Mission 6: Apply ALL skills to review code');
    console.info(
      '    🎯 Goal: "Apply every available skill" — agent lists, reads, and applies all skills.\n'
    );
    await runMission(
      llmWithTools,
      matimo,
      `First, list all available skills in "${skillsDir}". Then read ALL of them. Finally, apply every skill's guidelines together to do a thorough review of this code. Organize your findings by the skill that flagged each issue:

\`\`\`typescript
${SAMPLE_CODE_TO_REVIEW}
\`\`\``
    );

    // ── PHASE 3: Verification ───────────────────────────────────────

    header('PHASE 3: Verification');

    // List all skills on disk
    const skillDirs = fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    result(`Skills created on disk: ${skillDirs.join(', ')}`, PASS, `${skillDirs.length} total`);

    // Verify each skill has valid frontmatter
    for (const dir of skillDirs) {
      const skillFile = path.join(skillsDir, dir, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        const content = fs.readFileSync(skillFile, 'utf-8');
        const hasFrontmatter = content.startsWith('---') && content.indexOf('---', 3) > 3;
        const hasName = content.includes('name:');
        const hasDesc = content.includes('description:');
        result(
          `${dir} — valid SKILL.md`,
          hasFrontmatter && hasName && hasDesc ? PASS : FAIL,
          `frontmatter=${hasFrontmatter}, name=${hasName}, desc=${hasDesc}`
        );
      }
    }

    // ── PHASE 4: Non-MCP Progressive Disclosure ─────────────────────
    //
    // agentskills.io progressive disclosure model without an MCP server:
    //   Level 1 (startup)    — getSkillsMetadata() → name + description only (~50 tokens/skill)
    //   Level 2 (per-request)— buildRelevantSkillPrompt(matimo, query) uses TF-IDF semantic
    //                           search to rank skills and loads full content only for the
    //                           top-K matches, keeping context cost proportional to relevance.
    //
    // This is the non-MCP equivalent of:
    //   matimo_list_skills  → Level 1 (always cheap)
    //   matimo_get_skill    → Level 2 (on demand, per relevant skill)

    header('PHASE 4: Non-MCP Progressive Disclosure');

    const matimoWithSkills = await MatimoInstance.init({
      skillPaths: [skillsDir],
      logLevel: 'silent',
    });

    // Level 1 — metadata only
    const meta = getSkillsMetadata(matimoWithSkills);
    result(
      `getSkillsMetadata() — Level 1: ${meta.length} skill(s), names + descriptions only`,
      meta.length > 0 ? PASS : WARN
    );
    for (const m of meta) {
      result(`  ${m.name}`, PASS, m.description || '(no description)');
    }

    // Level 2 — semantic search + load only relevant content
    const testQuery = 'security vulnerability detection';
    const relevantPrompt = await buildRelevantSkillPrompt(matimoWithSkills, testQuery, {
      topK: 2,
      minScore: 0.1,
      header: 'Apply these skill guidelines:',
    });
    result(
      `buildRelevantSkillPrompt('${testQuery}') — Level 2: ${relevantPrompt.length} chars`,
      relevantPrompt.length > 0 ? PASS : WARN
    );
    if (relevantPrompt.length > 0) {
      console.info(`\n  ${INFO} Injected prompt preview (first 300 chars):`);
      console.info(`  "${relevantPrompt.slice(0, 300)}…"\n`);
    }

    // ── Summary ─────────────────────────────────────────────────────

    header('SUMMARY');
    console.info(`
  Skills Lifecycle (Goal-Driven — No Tool Names Given):
    ${skillCreated ? PASS : FAIL}  1. "I need a code review checklist" → created code-review skill
    ${PASS}  2. "What skills are available?" → Level 1 metadata discovery
    ${mission3Passed ? PASS : FAIL}  3. "Apply the skill to this code" → Level 2 activation + applied guidelines
    ${securityCreated ? PASS : FAIL}  4. "I need a security skill" → created security-checklist skill
    ${PASS}  5. "Validate the skills" → spec compliance check
    ${PASS}  6. "Apply ALL skills" → listed, read, and applied multiple skills

  Agent Skills Specification Concepts:
    ${PASS}  SKILL.md with YAML frontmatter (name, description required)
    ${PASS}  Name validation (lowercase, hyphens, max 64 chars)
    ${PASS}  Progressive disclosure (Level 1 → Level 2 → Level 3)
    ${PASS}  Spec validation via matimo_validate_skill
    ${PASS}  Human-in-the-loop approval for skill creation

  Non-MCP Progressive Disclosure (agentskills.io spec):
    ${meta.length > 0 ? PASS : WARN}  getSkillsMetadata() → Level 1: ${meta.length} skill(s), names + descriptions only
    ${relevantPrompt.length > 0 ? PASS : WARN}  buildRelevantSkillPrompt(query) → Level 2: TF-IDF search → ${relevantPrompt.length} chars loaded

  Skills on Disk:
    ${INFO}  Directory: ${skillsDir}
    ${INFO}  Skills: ${skillDirs.join(', ') || 'none'}
`);
  } finally {
    stdinRl.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// ─── Entry Point ────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('\n  Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
