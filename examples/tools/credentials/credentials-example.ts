#!/usr/bin/env node
/**
 * ============================================================================
 * PER-EXECUTION CREDENTIAL OVERRIDE — MULTI-TENANT EXAMPLE
 * ============================================================================
 *
 * PATTERN: Per-call credentials (options.credentials)
 * ─────────────────────────────────────────────────────────────────────────
 * Demonstrates how to supply credentials per `execute()` call instead of
 * relying on environment variables. This is the right pattern for
 * multi-tenant platforms where each user/tenant has their own API keys.
 *
 * Use this pattern when:
 * ✅ Serving multiple tenants from a single process
 * ✅ Credentials come from a database / secrets manager / vault
 * ✅ You must NOT store per-tenant tokens in process.env
 * ✅ You want strict per-call credential isolation
 *
 * Contrast with single-tenant pattern (env vars):
 *   SLACK_BOT_TOKEN=xoxb-xxx matimo execute slack-send-message ...
 *   → works fine for one account, breaks for ten tenants
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * No .env token needed — this example uses placeholder tenant tokens to
 * show the API shape. Real requests will fail (expected). To see real calls
 * succeed, replace the placeholder tokens with real Slack bot tokens.
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   pnpm credentials:example
 *
 * KEY CONCEPTS DEMONSTRATED:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. getRequiredCredentials(toolName) — discover what keys a tool needs
 * 2. execute(name, params, { credentials }) — per-call credential injection
 * 3. Tenant isolation — two tenants, same process, different tokens
 * 4. Graceful partial credentials — credential + env-var fallback strategy
 * 5. Credential manifest — build a map of all tools → required keys at startup
 *
 * ============================================================================
 */

import 'dotenv/config';
import { MatimoInstance } from 'matimo';

// ─── Simulated tenant "database" ─────────────────────────────────────────────
// In a real platform these would come from your DB / vault / secrets manager.
const TENANTS = {
  'tenant-acme': {
    name: 'Acme Corp',
    secrets: {
      // Replace with a real token to see live Slack calls
      SLACK_BOT_TOKEN: process.env.ACME_SLACK_BOT_TOKEN ?? 'xoxb-acme-placeholder-token',
    },
  },
  'tenant-globex': {
    name: 'Globex Inc',
    secrets: {
      SLACK_BOT_TOKEN: process.env.GLOBEX_SLACK_BOT_TOKEN ?? 'xoxb-globex-placeholder-token',
    },
  },
};

type TenantId = keyof typeof TENANTS;
type Tenant = (typeof TENANTS)[TenantId];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║   Per-Execution Credential Override — Multi-Tenant     ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  // ── 1. Initialize once — no per-tenant init needed ──────────────────────
  console.info('🚀 Initializing Matimo (once for all tenants)…');
  const matimo = await MatimoInstance.init({ autoDiscover: true });
  console.info(`✅ Loaded ${matimo.listTools().length} tools\n`);

  // ── 2. Discover required credential keys at startup ──────────────────────
  // getRequiredCredentials() tells you EXACTLY what keys to put in `credentials`
  // for a given tool — no need to read the YAML.
  console.info('🔑 Building credential manifest for all tools…');
  const credentialManifest: Record<string, string[]> = {};
  for (const tool of matimo.listTools()) {
    const keys = matimo.getRequiredCredentials(tool.name);
    if (keys.length > 0) {
      credentialManifest[tool.name] = keys;
    }
  }

  const toolsWithAuth = Object.keys(credentialManifest).length;
  const toolsNoAuth = matimo.listTools().length - toolsWithAuth;
  console.info(`   ${toolsWithAuth} tools need credentials, ${toolsNoAuth} are public`);
  console.info('   Sample manifest entries:');
  for (const [tool, keys] of Object.entries(credentialManifest).slice(0, 5)) {
    console.info(`     ${tool}: [${keys.join(', ')}]`);
  }
  console.info();

  // ── 3. Per-tenant execution helper ───────────────────────────────────────
  // Collect only the keys the tool needs from the tenant's secrets store.
  async function executeForTenant(
    tenantId: TenantId,
    toolName: string,
    params: Record<string, unknown>
  ) {
    const tenant: Tenant = TENANTS[tenantId];
    const requiredKeys = matimo.getRequiredCredentials(toolName);

    // Build credentials map — only the keys this specific tool needs
    const credentials: Record<string, string> = {};
    const missing: string[] = [];

    for (const key of requiredKeys) {
      const value = tenant.secrets[key as keyof typeof tenant.secrets];
      if (value) {
        credentials[key] = value;
      } else {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      console.warn(
        `   ⚠️  [${tenant.name}] Missing ${missing.length} credential key(s) for '${toolName}'.`
      );
    }

    console.info(
      `   🏢 [${tenant.name}] Executing '${toolName}' with ${Object.keys(credentials).length} credential(s)…`
    );

    try {
      const result = await matimo.execute(toolName, params, { credentials });
      return { tenantId, toolName, success: true, result };
    } catch (err) {
      // Expected for placeholder tokens — real tokens would succeed
      const message = err instanceof Error ? err.message : String(err);
      return { tenantId, toolName, success: false, error: message };
    }
  }

  // ── 4. Demo: same tool, two tenants, fully isolated ──────────────────────
  console.info('════════════════════════════════════════════════════════════');
  console.info('Demo 1: Same tool, two tenants, isolated credentials');
  console.info('════════════════════════════════════════════════════════════\n');

  const channel = process.env.SLACK_CHANNEL_ID ?? 'C0000000000';
  const params = { channel, text: `Hello from multi-tenant demo at ${new Date().toISOString()}` };

  const [acmeResult, globexResult] = await Promise.all([
    executeForTenant('tenant-acme', 'slack-send-message', params),
    executeForTenant('tenant-globex', 'slack-send-message', params),
  ]);

  for (const r of [acmeResult, globexResult]) {
    const icon = r.success ? '✅' : '⚠️ ';
    const tenant = TENANTS[r.tenantId as TenantId].name;
    console.info(
      `   ${icon} [${tenant}] ${r.success ? 'Succeeded' : `Failed (expected with placeholder token): ${r.error?.slice(0, 80)}`}`
    );
  }

  // ── 5. Verify process.env was NOT modified ────────────────────────────────
  console.info('\n════════════════════════════════════════════════════════════');
  console.info('Demo 2: process.env isolation check');
  console.info('════════════════════════════════════════════════════════════\n');

  const envBefore = process.env.SLACK_BOT_TOKEN;
  await executeForTenant('tenant-acme', 'slack-send-message', params);
  const envAfter = process.env.SLACK_BOT_TOKEN;

  if (envBefore === envAfter) {
    console.info('   ✅ process.env.SLACK_BOT_TOKEN unchanged — credentials are call-scoped');
  } else {
    console.error('   ❌ UNEXPECTED: process.env was mutated!');
  }

  // ── 6. Fallback to env vars when credentials not provided ─────────────────
  console.info('\n════════════════════════════════════════════════════════════');
  console.info('Demo 3: Backward compatibility — no credentials → env var fallback');
  console.info('════════════════════════════════════════════════════════════\n');

  // Temporarily set env var to simulate single-tenant / legacy usage
  const wasSet = !!process.env.SLACK_BOT_TOKEN;
  process.env.SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN ?? 'xoxb-env-fallback-token';

  console.info('   Calling execute() without credentials — falls back to process.env…');
  try {
    await matimo.execute('slack-send-message', params);
    console.info('   ✅ Succeeded (env var token was valid)');
  } catch {
    console.info('   ⚠️  Failed at API level (env token is a placeholder — expected)');
  }

  if (!wasSet) delete process.env.SLACK_BOT_TOKEN;

  // ── 7. Credential key lookup reference ───────────────────────────────────
  console.info('\n════════════════════════════════════════════════════════════');
  console.info('Reference: credential keys for Slack tools');
  console.info('════════════════════════════════════════════════════════════\n');

  const slackTools = matimo.listTools().filter((t) => t.name.startsWith('slack'));
  for (const tool of slackTools.slice(0, 5)) {
    const keys = matimo.getRequiredCredentials(tool.name);
    console.info(`   ${tool.name}`);
    console.info(
      `     credentials required: ${keys.length ? `${keys.length} key(s)` : '(none required)'}`
    );
  }
  if (slackTools.length > 5) {
    console.info(`   … and ${slackTools.length - 5} more Slack tools`);
  }

  console.info('\n✅ Example complete.\n');
  console.info('To use real credentials, set per-tenant env vars:');
  console.info('  ACME_SLACK_BOT_TOKEN=xoxb-acme-real-token');
  console.info('  GLOBEX_SLACK_BOT_TOKEN=xoxb-globex-real-token\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
