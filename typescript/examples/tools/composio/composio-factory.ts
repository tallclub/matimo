#!/usr/bin/env node
/**
 * ============================================================================
 * @matimo/composio — SDK Factory Pattern Example
 * ============================================================================
 *
 * PATTERN: Direct tool execution via MatimoInstance
 * ─────────────────────────────────────────────────────────────────────────
 * The simplest way to call Composio-backed tools. One line per tool call —
 * no classes, no LLM, no abstraction layer.
 *
 * @matimo/composio wraps Composio's 250+ integrations (Jira, Google Drive,
 * Microsoft Teams, Outlook, SharePoint, and more) with Matimo's policy
 * engine, risk classification, and human-in-the-loop approval layer.
 *
 * Use this pattern when:
 * ✅ Writing scripts, one-off data pipelines, or CLI tools
 * ✅ You know exactly which tool to call and with what parameters
 * ✅ Quick prototyping against a real Composio connected account
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Obtain a Composio API key at https://app.composio.dev
 *    and connect your accounts (Jira, Google Drive, etc.) via the dashboard.
 *
 * 2. Create a .env file at the root of typescript/examples/tools/:
 *    COMPOSIO_API_KEY=your-composio-project-api-key
 *    COMPOSIO_USER_ID=your-tenant-user-id
 *    JIRA_CONNECTED_ACCOUNT_ID=ca_xxxxxxxxxx
 *    GOOGLEDRIVE_CONNECTED_ACCOUNT_ID=ca_xxxxxxxxxx
 *    MICROSOFT_TEAMS_CONNECTED_ACCOUNT_ID=ca_xxxxxxxxxx
 *
 *    Connected account IDs are shown in the Composio dashboard under
 *    Connections → <toolkit> → Connected Account ID.
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   pnpm composio:factory
 *
 * TOOLS DEMONSTRATED:
 * ─────────────────────────────────────────────────────────────────────────
 * • composio_jira_get_current_user        (risk: low)
 * • composio_googledrive_list_files       (risk: low)
 * • composio_googlecalendar_list_calendars (risk: low)
 * • composio_microsoft_teams_teams_list   (risk: low)
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatimoInstance } from '@matimo/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tools are loaded from the @matimo/composio package directory.
// @matimo/composio intentionally lives in typescript/packages/ (3rd-party
// integration) rather than the root workspace, so tools are loaded by path.
const TOOLS_DIR = path.join(__dirname, '../../../packages/composio/tools');

const COMPOSIO_USER_ID = process.env.COMPOSIO_USER_ID || '';
const JIRA_ACCOUNT_ID = process.env.JIRA_CONNECTED_ACCOUNT_ID || '';
const DRIVE_ACCOUNT_ID = process.env.GOOGLEDRIVE_CONNECTED_ACCOUNT_ID || '';
const CALENDAR_ACCOUNT_ID = process.env.GOOGLECALENDAR_CONNECTED_ACCOUNT_ID || '';
const TEAMS_ACCOUNT_ID = process.env.MICROSOFT_TEAMS_CONNECTED_ACCOUNT_ID || '';

function checkEnv(): void {
  const missing = [
    !process.env.COMPOSIO_API_KEY && 'COMPOSIO_API_KEY',
    !COMPOSIO_USER_ID && 'COMPOSIO_USER_ID',
  ].filter(Boolean);

  if (missing.length) {
    console.error(`\n❌ Missing required env vars: ${missing.join(', ')}`);
    console.info('\n📖 Set them in typescript/examples/tools/.env (see file header for details)');
    process.exit(1);
  }
}

function printResult(label: string, result: unknown): void {
  console.info(`\n✅ ${label}`);
  console.info(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  checkEnv();

  console.info('\n' + '='.repeat(70));
  console.info('🔌 @matimo/composio — Factory Pattern');
  console.info('='.repeat(70));

  const matimo = await MatimoInstance.init({ toolPaths: [TOOLS_DIR] });

  const allTools = matimo.getRegistry().getAll();
  const composioTools = allTools.filter((t) => t.name.startsWith('composio_'));
  console.info(
    `\n📦 Loaded ${allTools.length} tools total — ${composioTools.length} composio_* tools across ${new Set(composioTools.map((t) => t.name.split('_')[1])).size} toolkits`
  );

  // ── 1. Jira: get the currently authenticated user ──────────────────────────
  if (JIRA_ACCOUNT_ID) {
    console.info('\n─── Jira ───────────────────────────────────────────────────────');
    const jiraUser = await matimo.execute('composio_jira_get_current_user', {
      composio_user_id: COMPOSIO_USER_ID,
      composio_connected_account_id: JIRA_ACCOUNT_ID,
    });
    printResult('composio_jira_get_current_user', jiraUser);
  } else {
    console.info('\n⚠️  Skipping Jira (JIRA_CONNECTED_ACCOUNT_ID not set)');
  }

  // ── 2. Google Drive: list files in root ────────────────────────────────────
  if (DRIVE_ACCOUNT_ID) {
    console.info('\n─── Google Drive ────────────────────────────────────────────────');
    const driveFiles = await matimo.execute('composio_googledrive_list_files', {
      composio_user_id: COMPOSIO_USER_ID,
      composio_connected_account_id: DRIVE_ACCOUNT_ID,
    });
    printResult('composio_googledrive_list_files', driveFiles);
  } else {
    console.info('\n⚠️  Skipping Google Drive (GOOGLEDRIVE_CONNECTED_ACCOUNT_ID not set)');
  }

  // ── 3. Google Calendar: list all calendars ─────────────────────────────────
  if (CALENDAR_ACCOUNT_ID) {
    console.info('\n─── Google Calendar ─────────────────────────────────────────────');
    const calendars = await matimo.execute('composio_googlecalendar_list_calendars', {
      composio_user_id: COMPOSIO_USER_ID,
      composio_connected_account_id: CALENDAR_ACCOUNT_ID,
    });
    printResult('composio_googlecalendar_list_calendars', calendars);
  } else {
    console.info('\n⚠️  Skipping Google Calendar (GOOGLECALENDAR_CONNECTED_ACCOUNT_ID not set)');
  }

  // ── 4. Microsoft Teams: list all teams ────────────────────────────────────
  if (TEAMS_ACCOUNT_ID) {
    console.info('\n─── Microsoft Teams ─────────────────────────────────────────────');
    const teams = await matimo.execute('composio_microsoft_teams_teams_list', {
      composio_user_id: COMPOSIO_USER_ID,
      composio_connected_account_id: TEAMS_ACCOUNT_ID,
    });
    printResult('composio_microsoft_teams_teams_list', teams);
  } else {
    console.info('\n⚠️  Skipping Microsoft Teams (MICROSOFT_TEAMS_CONNECTED_ACCOUNT_ID not set)');
  }

  console.info('\n' + '='.repeat(70));
  console.info('✅ Done — all configured toolkits exercised');
  console.info('='.repeat(70) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
