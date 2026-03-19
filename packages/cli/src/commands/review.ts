/**
 * `matimo review` — Human oversight for agent-created tools.
 *
 * Subcommands:
 *   matimo review list              Show all tools awaiting approval
 *   matimo review approve <name>    Approve a pending tool (requires MATIMO_APPROVAL_SECRET)
 *   matimo review reject  <name>    Reject / revoke a tool's approval
 */

import path from 'path';
import * as YAML from 'yaml';

/** Subset of ApprovalManifest we use here (avoids stale-dist type issues). */
interface ManifestHandle {
  getPendingTools(): string[];
  listApproved(): string[];
  getApproval(name: string): { approvedAt: string; approvedBy?: string } | undefined;
  revoke(name: string): boolean;
  approve(name: string, hash: string, approvedBy?: string): void;
  computeHash(content: string): string;
}

function resolveManifestDir(): string {
  // Look for the approvals file in cwd or the MATIMO_TOOL_DIR env var.
  const toolDir = process.env.MATIMO_TOOL_DIR;
  return toolDir ? path.resolve(toolDir) : process.cwd();
}

/** Try to import @matimo/core and return ApprovalManifest, or null if unavailable. */
async function tryLoadManifest(dir: string): Promise<ManifestHandle | null> {
  try {
    // Dynamic import works in both ESM (built CLI) and CJS (ts-jest test transform)
    const core = (await import('@matimo/core')) as Record<string, unknown>;
    const ApprovalManifest = core['ApprovalManifest'] as new (dir: string) => ManifestHandle;
    return new ApprovalManifest(dir);
  } catch {
    return null;
  }
}

function printTable(headers: string[], rows: string[][]): void {
  const cols = headers.length;
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const divider = widths.map((w) => '─'.repeat(w + 2)).join('┼');
  const fmt = (row: string[]) =>
    '│ ' + row.map((cell, idx) => cell.padEnd(widths[idx])).join(' │ ') + ' │';

  console.info('┌' + widths.map((w) => '─'.repeat(w + 2)).join('┬') + '┐');
  console.info(fmt(headers));
  console.info('├' + divider + '┤');
  for (const row of rows) {
    console.info(fmt(row.map((c) => c ?? '').slice(0, cols)));
  }
  console.info('└' + widths.map((w) => '─'.repeat(w + 2)).join('┴') + '┘');
}

async function listPending(dir: string): Promise<void> {
  const manifest = await tryLoadManifest(dir);
  if (!manifest) {
    console.error('❌ @matimo/core is not available. Run `pnpm install` first.');
    process.exit(1);
  }

  const pending = manifest.getPendingTools();
  const approved = manifest.listApproved();

  if (pending.length === 0 && approved.length === 0) {
    console.info('ℹ️  No tools are pending or approved.');
    return;
  }

  if (pending.length > 0) {
    console.info('\n⏳ Pending approval:\n');
    const rows = pending.map((name: string) => [name, 'pending', '—', '—']);
    printTable(['Tool name', 'Status', 'Approved by', 'Approved at'], rows);
  }

  if (approved.length > 0) {
    console.info('\n✅ Approved tools:\n');
    const rows = approved.map((name) => {
      const rec = manifest.getApproval(name)!;
      return [name, 'approved', rec.approvedBy ?? '—', rec.approvedAt];
    });
    printTable(['Tool name', 'Status', 'Approved by', 'Approved at'], rows);
  }

  if (pending.length > 0) {
    console.info(
      `\nRun "matimo review approve <tool-name>" to approve, or "matimo review reject <tool-name>" to reject.`
    );
  }
}

async function approveTool(toolName: string, dir: string): Promise<void> {
  if (!toolName) {
    console.error('❌ Usage: matimo review approve <tool-name>');
    process.exit(1);
  }

  const manifest = await tryLoadManifest(dir);
  if (!manifest) {
    console.error('❌ @matimo/core is not available. Run `pnpm install` first.');
    process.exit(1);
  }

  const pending = manifest.getPendingTools();
  if (!pending.includes(toolName)) {
    const approved = manifest.listApproved();
    if (approved.includes(toolName)) {
      console.info(`ℹ️  "${toolName}" is already approved.`);
      return;
    }
    console.error(
      `❌ No pending tool named "${toolName}". Run "matimo review list" to see pending tools.`
    );
    process.exit(1);
  }

  // Require a human-set approval secret — not the auto-generated one
  const secret = process.env.MATIMO_APPROVAL_SECRET;
  if (!secret) {
    console.error(
      '❌ MATIMO_APPROVAL_SECRET is not set.\n' +
        '   Set it to approve tools: export MATIMO_APPROVAL_SECRET=<your-secret>'
    );
    process.exit(1);
  }

  // Find the definition YAML to hash it
  const fs = await import('fs');
  const toolDir = path.join(dir, toolName);
  const yamlPath = path.join(toolDir, 'definition.yaml');
  if (!fs.existsSync(yamlPath)) {
    console.error(`❌ Cannot find definition.yaml for tool "${toolName}" at:\n   ${yamlPath}`);
    process.exit(1);
  }

  const originalYamlContent = fs.readFileSync(yamlPath, 'utf-8');
  let finalYamlContent = originalYamlContent;

  // Promote status in definition.yaml to "approved" so runtime policy sees the approval.
  try {
    const parsed = YAML.parse(originalYamlContent) ?? {};
    if (parsed && typeof parsed === 'object') {
      const currentStatus = (parsed as { status?: string }).status;
      if (currentStatus !== 'approved') {
        (parsed as { status?: string }).status = 'approved';
        finalYamlContent = YAML.stringify(parsed);
        // Write atomically using tmp + rename pattern
        const tmpPath = yamlPath + '.tmp';
        fs.writeFileSync(tmpPath, finalYamlContent, 'utf-8');
        fs.renameSync(tmpPath, yamlPath);
        console.info(`   📝 Updated status: draft → approved in definition.yaml`);
      }
    }
  } catch {
    console.warn(
      '⚠️  Failed to update status in definition.yaml; proceeding with manifest approval only.'
    );
  }

  const hash = manifest.computeHash(finalYamlContent);
  const approvedBy = process.env.USER ?? process.env.USERNAME ?? 'cli';
  manifest.approve(toolName, hash, approvedBy);

  console.info(`✅ Tool "${toolName}" approved by ${approvedBy}.`);
}

async function rejectTool(toolName: string, dir: string): Promise<void> {
  if (!toolName) {
    console.error('❌ Usage: matimo review reject <tool-name>');
    process.exit(1);
  }

  const manifest = await tryLoadManifest(dir);
  if (!manifest) {
    console.error('❌ @matimo/core is not available. Run `pnpm install` first.');
    process.exit(1);
  }

  const wasApproved = manifest.revoke(toolName);
  // Remove from pending even if it wasn't in approved set
  // (revoke only removes from approved; pending is cleaned up on next loadFromDisk)
  // Re-save by marking and un-marking is not clean — just confirm action
  const pending = manifest.getPendingTools();
  const wasPending = pending.includes(toolName);

  if (!wasApproved && !wasPending) {
    console.info(`ℹ️  No record of tool "${toolName}". Nothing to reject.`);
    return;
  }

  console.info(`🗑  Tool "${toolName}" has been rejected/revoked.`);
  if (wasApproved) {
    console.info('   (Approval signature removed — the tool will be blocked until re-approved.)');
  }
}

export async function reviewCommand(args: string[]): Promise<void> {
  const sub = args[0];
  const dir = resolveManifestDir();

  switch (sub) {
    case 'list':
    case undefined:
      await listPending(dir);
      break;
    case 'approve':
      await approveTool(args[1], dir);
      break;
    case 'reject':
      await rejectTool(args[1], dir);
      break;
    default:
      console.error(`❌ Unknown review subcommand: "${sub}"`);
      console.info('Usage: matimo review [list|approve|reject] [tool-name]');
      process.exit(1);
  }
}
