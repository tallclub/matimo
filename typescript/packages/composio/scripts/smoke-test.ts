/**
 * @matimo/composio live smoke test
 *
 * Manual validation script — NOT part of the Jest suite (Jest's testMatch
 * only picks up `*.test.ts` / `__tests__/`). Exercises the generated Jira
 * tools against a real Composio connected account to confirm:
 *
 *   1. A low-risk tool (`composio_jira_get_current_user`) executes
 *      immediately and returns real Jira data.
 *   2. `DefaultPolicyEngine.canCreate()` returns `pending_approval` for a
 *      medium-risk composio tool (`composio_jira_create_issue`) when
 *      `enableHITL: true` and `'medium'` is in `quarantineRiskLevels` and the
 *      context is `prod` — the quarantine decision is driven entirely by the
 *      tool's explicit `risk:` field via `classifyRisk()`. (See the
 *      "Risk Classification" section of ../README.md for why this is a
 *      *discovery-time* check, not an `execute()`-time one, with the default
 *      policy engine.)
 *   3. `classifyRisk()` honors each generated tool's explicit `risk:` field
 *      (and that an overridden `risk` value takes precedence over both the
 *      original explicit value and the HTTP-method-based default).
 *
 * Usage:
 *   set -a && source .env && set +a && \
 *     tsx packages/composio/scripts/smoke-test.ts <connected_account_id>
 *
 * Requires COMPOSIO_API_KEY in the environment and a connected account ID
 * for an ACTIVE Jira connection (see ../README.md for how to create one).
 */

import path from 'path';
import { MatimoInstance, DefaultPolicyEngine, classifyRisk, type ToolDefinition } from '@matimo/core';

const COMPOSIO_USER_ID = 'matimo-test-user';

async function main(): Promise<void> {
  const connectedAccountId = process.argv[2];
  if (!connectedAccountId) {
    console.error('Usage: tsx smoke-test.ts <jira_connected_account_id>');
    process.exit(1);
  }
  if (!process.env.COMPOSIO_API_KEY) {
    console.error('Error: COMPOSIO_API_KEY environment variable is required.');
    process.exit(1);
  }

  const toolsDir = path.join(process.cwd(), 'packages/composio/tools');

  // ── 1. Low-risk tool: executes immediately ────────────────────────────
  console.info('\n=== 1. Low-risk tool (composio_jira_get_current_user) ===');
  {
    const matimo = await MatimoInstance.init({ toolPaths: [toolsDir] });
    const result = await matimo.execute('composio_jira_get_current_user', {
      composio_user_id: COMPOSIO_USER_ID,
      composio_connected_account_id: connectedAccountId,
    });
    console.info(JSON.stringify(result, null, 2));
  }

  // ── 2. Medium-risk tool: quarantined by canCreate() under HITL ─────────
  console.info('\n=== 2. Medium-risk tool (composio_jira_create_issue) quarantine ===');
  {
    const matimo = await MatimoInstance.init({ toolPaths: [toolsDir] });
    const tool = matimo.getRegistry().get('composio_jira_create_issue');
    if (!tool) throw new Error('composio_jira_create_issue not found');

    console.info(`risk: ${tool.risk} -> classifyRisk()=${classifyRisk(tool)}`);

    const policy = new DefaultPolicyEngine({
      enableHITL: true,
      quarantineRiskLevels: ['medium', 'high'],
    });

    // canCreate() runs content validation first; generated composio tools
    // don't set `requires_approval`, which would otherwise be flagged as a
    // hard `[forced-approval]` violation before the risk-based quarantine
    // check is reached. A host that wants discovery-time quarantine for
    // medium/high-risk composio tools should set `requires_approval: true`
    // when registering them as untrusted.
    const decision = policy.canCreate(
      { environment: 'prod' },
      { ...tool, requires_approval: true }
    );
    console.info('canCreate({environment: "prod"}, ...) ->', decision);
  }

  // ── 3. classifyRisk() honors explicit YAML `risk:` field ───────────────
  console.info('\n=== 3. classifyRisk() on generated tool definitions ===');
  {
    const matimo = await MatimoInstance.init({ toolPaths: [toolsDir] });
    const registry = matimo.getRegistry();

    for (const name of [
      'composio_jira_get_current_user', // explicit risk: low  (POST default would be medium)
      'composio_jira_create_issue', // explicit risk: medium (matches POST default)
      'composio_jira_delete_issue', // explicit risk: high   (POST default would be medium)
    ]) {
      const tool = registry.get(name);
      if (!tool) throw new Error(`Tool not found: ${name}`);
      console.info(`${name}: yaml risk=${tool.risk} -> classifyRisk()=${classifyRisk(tool)}`);
    }

    // Override precedence: a cloned definition with `risk` reassigned must
    // win over both its original explicit value and the method-based default.
    const original = registry.get('composio_jira_get_current_user');
    if (!original) throw new Error('composio_jira_get_current_user not found');
    const overridden: ToolDefinition = { ...original, risk: 'high' };
    console.info(
      `composio_jira_get_current_user with risk override 'high' -> classifyRisk()=${classifyRisk(overridden)}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
