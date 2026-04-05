/**
 * Tool Integrity Tracker.
 *
 * Tracks SHA-256 hashes of tool YAML content to detect modifications.
 * Used during hot-reload to decide whether re-validation is needed.
 */

import { createHash } from 'crypto';

export interface IntegrityRecord {
  hash: string;
  source: 'trusted' | 'untrusted';
  validatedAt: Date;
}

export type IntegrityAction =
  | { action: 'keep'; reason: 'unchanged' }
  | { action: 'revalidate'; reason: 'content-modified' }
  | { action: 'revalidate'; reason: 'source-changed' }
  | { action: 'validate'; reason: 'new-tool' };

export class ToolIntegrityTracker {
  private readonly records: Map<string, IntegrityRecord> = new Map();

  /**
   * Compute SHA-256 hash of content.
   */
  computeHash(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Called when a tool is loaded. Compares the content hash and source with the stored
   * record and returns what action the caller should take.
   * If the tool moved between trusted/untrusted paths, revalidate is required even if content unchanged.
   */
  onToolLoaded(
    toolName: string,
    yamlContent: string,
    source: 'trusted' | 'untrusted'
  ): IntegrityAction {
    const hash = this.computeHash(yamlContent);
    const existing = this.records.get(toolName);

    if (!existing) {
      return { action: 'validate', reason: 'new-tool' };
    }

    // Check if source changed (trusted ↔ untrusted): must revalidate for policy enforcement
    if (existing.source !== source) {
      return { action: 'revalidate', reason: 'source-changed' };
    }

    if (existing.hash === hash) {
      return { action: 'keep', reason: 'unchanged' };
    }

    return { action: 'revalidate', reason: 'content-modified' };
  }

  /**
   * Record a tool's hash after successful validation/loading.
   */
  record(toolName: string, yamlContent: string, source: 'trusted' | 'untrusted'): void {
    this.records.set(toolName, {
      hash: this.computeHash(yamlContent),
      source,
      validatedAt: new Date(),
    });
  }

  /**
   * Get the stored record for a tool.
   */
  getRecord(toolName: string): IntegrityRecord | undefined {
    return this.records.get(toolName);
  }

  /**
   * Get the stored hash for a tool.
   */
  getHash(toolName: string): string | undefined {
    return this.records.get(toolName)?.hash;
  }

  /**
   * Remove a tool entry (e.g. when it's been removed from disk).
   */
  removeEntry(toolName: string): boolean {
    return this.records.delete(toolName);
  }

  /**
   * Clear all records. Used when doing a full reset.
   */
  clear(): void {
    this.records.clear();
  }

  /**
   * Get the number of tracked tools.
   */
  get size(): number {
    return this.records.size;
  }
}
