/**
 * Approval Manifest for Matimo.
 *
 * Manages HMAC-signed approval records for agent-created tools.
 * Prevents agent forgery of approvals via cryptographic verification.
 */

import { createHmac, randomUUID, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getGlobalMatimoLogger } from '../logging';

export interface ApprovalRecord {
  name: string;
  hash: string;
  signature: string;
  approvedAt: string;
  approvedBy?: string;
}

interface ManifestData {
  version: '1';
  approvals: ApprovalRecord[];
  pending?: string[];
}

export class ApprovalManifest {
  private readonly secret: string;
  private readonly manifestPath: string;
  private cache: Map<string, ApprovalRecord> = new Map();
  private pendingSet: Set<string> = new Set();

  /**
   * @param approvalDir - Directory where `.matimo-approvals.json` lives
   * @param secret - HMAC secret. If not provided, reads `MATIMO_APPROVAL_SECRET`
   *   from env. If that's also missing, generates one and logs it.
   */
  constructor(approvalDir: string, secret?: string) {
    this.manifestPath = path.join(approvalDir, '.matimo-approvals.json');

    if (secret) {
      this.secret = secret;
    } else if (process.env.MATIMO_APPROVAL_SECRET) {
      this.secret = process.env.MATIMO_APPROVAL_SECRET;
    } else {
      this.secret = randomUUID();
      const logger = getGlobalMatimoLogger();
      // Create a non-sensitive fingerprint for debugging (first 4 chars only)
      const fingerprint = this.secret.substring(0, 4);
      logger.warn(
        'No MATIMO_APPROVAL_SECRET set. An ephemeral secret was auto-generated ' +
          '(fingerprint: ' +
          fingerprint +
          '...) ' +
          'for this process. Approvals may not persist across restarts. ' +
          'To persist approvals, set MATIMO_APPROVAL_SECRET to a stable, securely ' +
          'generated value in the environment.'
      );
    }

    this.loadFromDisk();
  }

  /**
   * Compute the HMAC signature for a tool approval.
   */
  private sign(toolName: string, yamlHash: string): string {
    return createHmac('sha256', this.secret).update(`${toolName}:${yamlHash}`).digest('hex');
  }

  /**
   * Compute SHA-256 hash of content.
   */
  computeHash(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Verify that an approval record has a valid HMAC signature and
   * the stored hash matches the current YAML content hash.
   */
  isApproved(toolName: string, currentYamlHash: string): boolean {
    const record = this.cache.get(toolName);
    if (!record) return false;

    // Hash mismatch = YAML was modified after approval → revoked
    if (record.hash !== currentYamlHash) return false;

    // Verify HMAC to detect manifest tampering
    const expectedSig = this.sign(toolName, record.hash);
    return record.signature === expectedSig;
  }

  /**
   * Approve a tool. Creates an HMAC-signed record in the manifest.
   */
  approve(toolName: string, yamlHash: string, approvedBy?: string): void {
    const signature = this.sign(toolName, yamlHash);
    const record: ApprovalRecord = {
      name: toolName,
      hash: yamlHash,
      signature,
      approvedAt: new Date().toISOString(),
      approvedBy,
    };
    this.cache.set(toolName, record);
    this.saveToDisk();
  }

  /**
   * Revoke a tool's approval. Removes from both cache and pendingSet
   * to ensure consistent state (tool no longer tracked as approved or pending).
   */
  revoke(toolName: string): boolean {
    const cacheDeleted = this.cache.delete(toolName);
    const pendingDeleted = this.pendingSet.delete(toolName);
    if (cacheDeleted || pendingDeleted) {
      this.saveToDisk();
    }
    return cacheDeleted || pendingDeleted;
  }

  /**
   * Get the approval record for a tool.
   */
  getApproval(toolName: string): ApprovalRecord | undefined {
    return this.cache.get(toolName);
  }

  /**
   * List all approved tool names.
   */
  listApproved(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Mark a tool as pending approval. Called by matimo_create_tool after writing to disk.
   */
  markPending(toolName: string): void {
    this.pendingSet.add(toolName);
    this.saveToDisk();
  }

  /**
   * Return all tool names that have been proposed (written to disk) but not yet approved.
   */
  getPendingTools(): string[] {
    return Array.from(this.pendingSet).filter((name) => !this.cache.has(name));
  }

  /**
   * Load the manifest file from disk.
   */
  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.manifestPath)) return;
      const raw = fs.readFileSync(this.manifestPath, 'utf-8');
      const data: ManifestData = JSON.parse(raw);
      if (data.version !== '1' || !Array.isArray(data.approvals)) return;

      this.cache.clear();
      for (const record of data.approvals) {
        if (record.name && record.hash && record.signature) {
          this.cache.set(record.name, record);
        }
      }

      this.pendingSet.clear();
      if (Array.isArray(data.pending)) {
        for (const name of data.pending) {
          if (typeof name === 'string') this.pendingSet.add(name);
        }
      }
    } catch {
      // Corrupted manifest — start fresh
      const logger = getGlobalMatimoLogger();
      logger.warn('Failed to load approval manifest, starting fresh', {
        path: this.manifestPath,
      });
      this.cache.clear();
      this.pendingSet.clear();
    }
  }

  /**
   * Save current approvals to disk using atomic write pattern.
   * Writes to a temporary file first, then atomically renames it.
   * This prevents data corruption if the process crashes mid-write.
   */
  private saveToDisk(): void {
    const data: ManifestData = {
      version: '1',
      approvals: Array.from(this.cache.values()),
      pending: Array.from(this.pendingSet).filter((name) => !this.cache.has(name)),
    };
    const dir = path.dirname(this.manifestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Atomic write: write to temp file, then rename
    const json = JSON.stringify(data, null, 2);
    const tempPath = path.join(
      dir,
      `${path.basename(this.manifestPath)}.tmp-${process.pid}-${Date.now()}`
    );
    fs.writeFileSync(tempPath, json, 'utf-8');
    fs.renameSync(tempPath, this.manifestPath);
  }
}
