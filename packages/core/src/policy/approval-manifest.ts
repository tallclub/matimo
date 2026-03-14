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
}

export class ApprovalManifest {
  private readonly secret: string;
  private readonly manifestPath: string;
  private cache: Map<string, ApprovalRecord> = new Map();

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
      logger.warn(
        `No MATIMO_APPROVAL_SECRET set. Auto-generated: ${this.secret}. ` +
          'Set this as an environment variable to persist approvals across restarts.'
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
   * Revoke a tool's approval.
   */
  revoke(toolName: string): boolean {
    const deleted = this.cache.delete(toolName);
    if (deleted) this.saveToDisk();
    return deleted;
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
    } catch {
      // Corrupted manifest — start fresh
      const logger = getGlobalMatimoLogger();
      logger.warn('Failed to load approval manifest, starting fresh', {
        path: this.manifestPath,
      });
      this.cache.clear();
    }
  }

  /**
   * Save current approvals to disk.
   */
  private saveToDisk(): void {
    const data: ManifestData = {
      version: '1',
      approvals: Array.from(this.cache.values()),
    };
    const dir = path.dirname(this.manifestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.manifestPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
