/**
 * ============================================================================
 * AUDIT LOG — tamper-evident record of every governed tool call
 * ============================================================================
 *
 * Every governance decision and every tool run is emitted as an event. Pass
 * `onEvent` to watch them live, and `auditSink` to keep them. The built-in
 * `JsonlFileSink` writes one JSON line per event, each chained to the
 * previous by SHA-256, so `verifyAuditLog()` reports the first line that was
 * edited, deleted or reordered. The Python SDK writes the same format: a log
 * written by either SDK verifies in the other.
 *
 * This example:
 *   1. Runs a successful call          → tool:executed (success: true)
 *   2. Runs a call that throws         → tool:execution_failed
 *   3. Approves one call, declines one → tool:approval_granted / _denied
 *   4. Verifies the log, then edits one line and verifies again
 *   5. Reopens the log: a new sink continues the same hash chain
 *
 * No API keys needed. Calls the public JSONPlaceholder test API.
 *
 * Run: pnpm policy:audit
 * ============================================================================
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  MatimoInstance,
  JsonlFileSink,
  verifyAuditLog,
  redactSecrets,
  type ApprovalRequest,
  type MatimoEvent,
} from '@matimo/core';

const __filename = fileURLToPath(import.meta.url);

const GET_POST_YAML = `name: get_post
version: '1.0.0'
description: Fetch one post from the JSONPlaceholder test API
parameters:
  id:
    type: number
    description: Post id
    required: true
execution:
  type: http
  method: GET
  url: 'https://jsonplaceholder.typicode.com/posts/{id}'
`;

/** Approves reads, declines everything else, so both outcomes are logged. */
async function approveReadsOnly(request: ApprovalRequest): Promise<boolean> {
  const approved = request.toolName === 'read';
  console.info(`   🔒 ${request.toolName} needs approval → ${approved ? 'approved' : 'declined'}`);
  return approved;
}

function describe(event: MatimoEvent): string {
  switch (event.type) {
    case 'tool:executed':
      return `${event.toolName} success=${event.success} ${event.durationMs}ms risk=${event.riskLevel}`;
    case 'tool:execution_failed':
      return `${event.toolName} ${event.errorCode}: ${event.error}`;
    case 'tool:approval_granted':
      return event.toolName;
    case 'tool:approval_denied':
      return `${event.toolName}: ${event.reason}`;
    default:
      return '';
  }
}

async function main(): Promise<void> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-audit-'));
  const toolsDir = path.join(workDir, 'tools');
  fs.mkdirSync(path.join(toolsDir, 'get_post'), { recursive: true });
  fs.writeFileSync(path.join(toolsDir, 'get_post', 'definition.yaml'), GET_POST_YAML);
  const logFile = path.join(workDir, 'audit.jsonl');

  try {
    console.info('\n📝 Audit log:', logFile, '\n');

    const matimo = await MatimoInstance.init({
      autoDiscover: true,
      toolPaths: [toolsDir],
      logLevel: 'silent',
      auditSink: new JsonlFileSink(logFile),
      onEvent: (event) => console.info(`   📣 ${event.type.padEnd(22)} ${describe(event)}`),
      onApproval: approveReadsOnly,
    });

    console.info('1. A successful call');
    await matimo.execute('get_post', { id: 1 });

    console.info('\n2. A call that throws (HTTP 404)');
    await matimo.execute('get_post', { id: 0 }).catch(() => undefined);

    console.info('\n3. One call approved, one declined');
    await matimo.execute('read', { filePath: __filename, startLine: 1, endLine: 3 });
    await matimo
      .execute('edit', {
        filePath: path.join(workDir, 'notes.txt'),
        operation: 'append',
        content: 'x',
        startLine: 1,
      })
      .catch(() => undefined);

    console.info('\n4. Verify the log');
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    console.info(`   First line: ${lines[0].slice(0, 150)}…`);
    console.info(`   ${JSON.stringify(verifyAuditLog(logFile))}`);

    const edited = [...lines];
    edited[1] = edited[1].replace('"tool:execution_failed"', '"tool:executed"');
    const tamperedFile = path.join(workDir, 'tampered.jsonl');
    fs.writeFileSync(tamperedFile, edited.join('\n') + '\n');
    console.info(`   After editing line 2: ${JSON.stringify(verifyAuditLog(tamperedFile))}`);

    console.info('\n5. Reopen the log: a new sink continues the chain');
    const next = await MatimoInstance.init({
      toolPaths: [toolsDir],
      logLevel: 'silent',
      auditSink: new JsonlFileSink(logFile),
    });
    await next.execute('get_post', { id: 2 });
    console.info(`   ${JSON.stringify(verifyAuditLog(logFile))}`);

    console.info('\n6. Values under secret-named keys never reach the log');
    const redacted = redactSecrets({
      user: 'ada',
      apiKey: 'sk-live-123',
      headers: { Authorization: 'Bearer x' },
    });
    console.info(`   ${JSON.stringify(redacted)}`);
    console.info('');
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
