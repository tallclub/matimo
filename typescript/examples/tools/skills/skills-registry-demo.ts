/**
 * ============================================================================
 * SKILLS FROM ANYWHERE — register, mount, select and observe skills
 * ============================================================================
 *
 * Skills don't have to live next to your code:
 *   1. registerSkill()          — push a skill fetched from a database or API
 *   2. addSkillPath() + reloadSkills() — mount another directory at runtime
 *   3. getSkillSections() / getSkillContent({ sections, maxTokens })
 *                               — load only the part of a skill a task needs
 *   4. buildSkillPromptContext() — pick the skills relevant to a request and
 *                               format them for a system prompt
 *   5. defaultSkillWriteDir + the `skill:created` event — decide where an
 *      agent's new skills are written, and hear about each one
 *
 * No API keys needed.
 *
 * Run: pnpm skills:registry
 * ============================================================================
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  MatimoInstance,
  setGlobalMatimoInstance,
  type MatimoEvent,
  type SkillDefinition,
} from '@matimo/core';

/** A skill as it might come back from your own storage. */
const REFUND_SKILL: SkillDefinition = {
  name: 'refund-policy',
  description: 'How to decide and issue customer refunds within policy limits.',
  body: `# Refund policy

## Eligibility
Refund within 30 days of purchase when the item is unused.

## Limits
Agents may refund up to 200 USD. Anything above needs a manager.

## Issuing the refund
Always refund to the original payment method and log the ticket id.
`,
  resources: { scripts: [], references: [], assets: [], other: [] },
  source: 'user',
};

const SHIPPING_SKILL_MD = `---
name: shipping-delays
description: What to tell customers when an order ships late.
---
# Shipping delays

## Apologise and give a date
Apologise once, then give the new delivery date from the carrier.

## Compensation
Offer free shipping on the next order for delays over five days.
`;

const NEW_SKILL_MD = `---
name: escalation-contacts
description: Who to escalate billing, legal and security issues to.
---
# Escalation contacts

## Billing
billing-oncall@example.com
`;

async function main(): Promise<void> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-skills-'));
  const mountedDir = path.join(workDir, 'mounted');
  fs.mkdirSync(path.join(mountedDir, 'shipping-delays'), { recursive: true });
  fs.writeFileSync(path.join(mountedDir, 'shipping-delays', 'SKILL.md'), SHIPPING_SKILL_MD);
  const writeDir = path.join(workDir, 'agent-skills');

  try {
    const matimo = await MatimoInstance.init({
      logLevel: 'silent',
      defaultSkillWriteDir: writeDir,
      onEvent: (event: MatimoEvent) => {
        if (event.type === 'skill:created') {
          console.info(`   📣 skill:created ${event.skillName} (source: ${event.source})`);
        }
      },
      // matimo_create_skill declares requires_approval: true
      onApproval: async (request) => {
        console.info(`   🔒 approving ${request.toolName}`);
        return true;
      },
      autoDiscover: true,
    });
    // Meta-tools such as matimo_create_skill act on the global instance.
    setGlobalMatimoInstance(matimo);

    console.info('\n1. registerSkill(): a skill from your own storage');
    matimo.registerSkill(REFUND_SKILL);
    console.info(`   registered: ${matimo.getSkill('refund-policy')?.name}`);

    console.info('\n2. addSkillPath() + reloadSkills(): mount a directory at runtime');
    matimo.addSkillPath(mountedDir);
    const reloaded = await matimo.reloadSkills();
    // loaded/removed count names added and dropped; registered skills are dropped.
    console.info(
      `   reloadSkills() → ${JSON.stringify(reloaded)}, ${matimo.listSkills().length} skills now`
    );
    console.info(`   shipping-delays loaded: ${Boolean(matimo.getSkill('shipping-delays'))}`);
    // reloadSkills() re-reads skill paths only; registered skills are pushed again.
    matimo.registerSkill(REFUND_SKILL);

    console.info('\n3. Load only what the task needs');
    for (const section of matimo.getSkillSections('refund-policy') ?? []) {
      console.info(`   § ${section.path} (~${section.tokenEstimate} tokens)`);
    }
    const limits = matimo.getSkillContent('refund-policy', {
      sections: ['Limits'],
      includePreamble: false,
    });
    console.info(`   Limits section only:\n${limits}\n`);

    console.info('4. buildSkillPromptContext(): relevant skills for a request');
    // TF-IDF matching: the request should share words with the skill.
    const context = await matimo.buildSkillPromptContext(
      'Can I refund this customer 150 USD, or is that over the limit?',
      { topK: 1 }
    );
    console.info(context.split('\n').slice(0, 6).join('\n'));

    console.info('\n5. An agent creates a skill: defaultSkillWriteDir + skill:created');
    await matimo.execute('matimo_create_skill', {
      name: 'escalation-contacts',
      content: NEW_SKILL_MD,
    });
    console.info(`   written to: ${path.relative(workDir, writeDir)}/`);
    console.info(`   files: ${fs.readdirSync(writeDir).join(', ')}`);
    console.info('');
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
