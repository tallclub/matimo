#!/usr/bin/env node
/**
 * ============================================================================
 * @matimo/composio — Decorator Pattern Example
 * ============================================================================
 *
 * PATTERN: @tool class-method decorator with tenant-scoped wrappers
 * ─────────────────────────────────────────────────────────────────────────
 * The @tool decorator transforms class methods into tool dispatchers —
 * calling the method calls matimo.execute() under the hood. For Composio
 * tools, this is particularly powerful: you can build a class per toolkit
 * (or per tenant) that pre-fills composio_user_id and
 * composio_connected_account_id, so the rest of your application code
 * only supplies the actual business parameters.
 *
 * Use this pattern when:
 * ✅ Building multi-tenant apps where each tenant has different connected accounts
 * ✅ You want class-based APIs that hide Composio credential plumbing
 * ✅ Code that reads like domain operations, not raw API calls
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * Same as composio-factory.ts — set COMPOSIO_API_KEY, COMPOSIO_USER_ID,
 * and at least JIRA_CONNECTED_ACCOUNT_ID in your .env file.
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   pnpm composio:decorator
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatimoInstance, setGlobalMatimoInstance, tool } from '@matimo/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOOLS_DIR = path.join(__dirname, '../../../packages/composio/tools');

/**
 * Tenant-scoped Jira agent.
 *
 * Wraps composio_jira_* tools so callers supply only Jira-domain parameters.
 * The Composio credentials (user_id + connected_account_id) are stored once
 * at construction time, keeping application code free of Composio internals.
 *
 * The @tool decorator replaces each method body with a matimo.execute() call,
 * mapping positional method arguments to tool parameter names by position.
 */
class JiraAgent {
  private readonly userId: string;
  private readonly accountId: string;

  constructor(userId: string, accountId: string) {
    this.userId = userId;
    this.accountId = accountId;
  }

  @tool('composio_jira_get_current_user')
  async getCurrentUser(
    composio_user_id: string, // eslint-disable-line @typescript-eslint/no-unused-vars
    composio_connected_account_id: string // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<unknown> {
    // Body replaced by @tool — calls matimo.execute('composio_jira_get_current_user', { composio_user_id, composio_connected_account_id })
    return {};
  }

  @tool('composio_jira_get_issue_types')
  async getIssueTypes(
    composio_user_id: string, // eslint-disable-line @typescript-eslint/no-unused-vars
    composio_connected_account_id: string // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<unknown> {
    // Calls matimo.execute('composio_jira_get_issue_types', { composio_user_id, composio_connected_account_id })
    return {};
  }

  // Convenience wrappers that pre-fill credentials — the caller only provides
  // business parameters. The Composio plumbing is invisible to callers.
  async whoAmI(): Promise<unknown> {
    return this.getCurrentUser(this.userId, this.accountId);
  }

  async issueTypes(): Promise<unknown> {
    return this.getIssueTypes(this.userId, this.accountId);
  }
}

/**
 * Tenant-scoped Google Drive agent.
 */
class DriveAgent {
  private readonly userId: string;
  private readonly accountId: string;

  constructor(userId: string, accountId: string) {
    this.userId = userId;
    this.accountId = accountId;
  }

  @tool('composio_googledrive_list_files')
  async listFiles(
    composio_user_id: string, // eslint-disable-line @typescript-eslint/no-unused-vars
    composio_connected_account_id: string // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<unknown> {
    return {};
  }

  @tool('composio_googledrive_find_file')
  async findFile(
    composio_user_id: string, // eslint-disable-line @typescript-eslint/no-unused-vars
    composio_connected_account_id: string, // eslint-disable-line @typescript-eslint/no-unused-vars
    name: string // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<unknown> {
    return {};
  }

  async myFiles(): Promise<unknown> {
    return this.listFiles(this.userId, this.accountId);
  }

  async findFileByName(name: string): Promise<unknown> {
    return this.findFile(this.userId, this.accountId, name);
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  const userId = process.env.COMPOSIO_USER_ID || '';
  const jiraAccountId = process.env.JIRA_CONNECTED_ACCOUNT_ID || '';
  const driveAccountId = process.env.GOOGLEDRIVE_CONNECTED_ACCOUNT_ID || '';

  if (!apiKey || !userId) {
    console.error('\n❌ COMPOSIO_API_KEY and COMPOSIO_USER_ID are required');
    process.exit(1);
  }

  console.info('\n' + '='.repeat(70));
  console.info('🔌 @matimo/composio — Decorator Pattern');
  console.info('='.repeat(70));

  const matimo = await MatimoInstance.init({ toolPaths: [TOOLS_DIR] });
  setGlobalMatimoInstance(matimo);

  // ── Jira agent ─────────────────────────────────────────────────────────────
  if (jiraAccountId) {
    console.info('\n─── Jira (via JiraAgent class) ──────────────────────────────────');
    const jira = new JiraAgent(userId, jiraAccountId);

    const me = await jira.whoAmI();
    console.info('✅ getCurrentUser:', JSON.stringify(me, null, 2));

    const types = await jira.issueTypes();
    console.info('✅ issue types:', JSON.stringify(types, null, 2));
  } else {
    console.info('\n⚠️  Skipping Jira (JIRA_CONNECTED_ACCOUNT_ID not set)');
  }

  // ── Google Drive agent ─────────────────────────────────────────────────────
  if (driveAccountId) {
    console.info('\n─── Google Drive (via DriveAgent class) ─────────────────────────');
    const drive = new DriveAgent(userId, driveAccountId);

    const files = await drive.myFiles();
    console.info('✅ list files:', JSON.stringify(files, null, 2));
  } else {
    console.info('\n⚠️  Skipping Google Drive (GOOGLEDRIVE_CONNECTED_ACCOUNT_ID not set)');
  }

  console.info('\n' + '='.repeat(70));
  console.info('✅ Done');
  console.info('='.repeat(70) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
