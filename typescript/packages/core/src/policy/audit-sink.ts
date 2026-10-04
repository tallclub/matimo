/**
 * Audit sinks — durable destinations for Matimo's audit events.
 *
 * `onEvent` hands events to host code; an `AuditSink` is the same stream with
 * a storage contract. `JsonlFileSink` appends one hash-chained JSON line per
 * event, so deleting, reordering or editing any line breaks `verifyAuditLog`.
 *
 * The line format and hashing rules are shared with the Python SDK
 * (conformance/audit/hash-chain.json): a log written by either SDK verifies
 * in the other.
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { MatimoEvent } from './events.js';

/** A destination for audit events. Errors it throws never reach tool execution. */
export interface AuditSink {
  write(event: MatimoEvent): void | Promise<void>;
}

/** One line of a JSONL audit log. */
export interface AuditLogEntry {
  seq: number;
  prevHash: string;
  event: Record<string, unknown>;
  hash: string;
}

export interface AuditLogVerification {
  valid: boolean;
  /** Entries read before verification stopped. */
  entries: number;
  /** 1-based line number of the first bad entry, when invalid. */
  line?: number;
  reason?: string;
}

/** `prevHash` of the first entry in a log. */
export const AUDIT_GENESIS_HASH = '0'.repeat(64);
export const REDACTED = '[REDACTED]';

const SECRET_KEY_PARTS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'credential',
  'cookie',
  'private_key',
  'access_key',
];

/**
 * True for keys that name a secret (`apiKey`, `client_secret`, `X-Auth-Token`…).
 * CamelCase and dashes are normalised to snake_case before matching.
 */
export function isSecretKey(key: string): boolean {
  const normalised = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();
  return SECRET_KEY_PARTS.some((part) => normalised.includes(part));
}

/** Deep copy of `value` with every secret-named key's value replaced by `[REDACTED]`. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, isSecretKey(k) ? REDACTED : redactSecrets(v)])
    );
  }
  return value;
}

/** JSON with object keys sorted at every level and no whitespace. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** sha256(prevHash + canonicalJson({ seq, event })), hex. */
export function hashAuditEntry(seq: number, prevHash: string, event: unknown): string {
  return createHash('sha256')
    .update(prevHash + canonicalJson({ seq, event }))
    .digest('hex');
}

/** Append-only JSONL sink; each line chains to the previous by hash. */
export class JsonlFileSink implements AuditSink {
  readonly filePath: string;
  #seq: number;
  #prevHash: string;

  /**
   * @param filePath - Log file. Created if missing; an existing log is
   *   continued from its last entry. Throws if that entry can't be parsed.
   */
  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    const last = readLastEntry(this.filePath);
    this.#seq = last?.seq ?? 0;
    this.#prevHash = last?.hash ?? AUDIT_GENESIS_HASH;
  }

  write(event: MatimoEvent): void {
    const seq = this.#seq + 1;
    const redacted = redactSecrets(event) as Record<string, unknown>;
    const hash = hashAuditEntry(seq, this.#prevHash, redacted);
    const entry: AuditLogEntry = { seq, prevHash: this.#prevHash, event: redacted, hash };
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.appendFileSync(this.filePath, canonicalJson(entry) + '\n', 'utf8');
    this.#seq = seq;
    this.#prevHash = hash;
  }
}

function readLastEntry(filePath: string): AuditLogEntry | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const lines = fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '');
  if (lines.length === 0) return undefined;
  const entry = JSON.parse(lines[lines.length - 1]) as Partial<AuditLogEntry>;
  if (typeof entry.seq !== 'number' || typeof entry.hash !== 'string') {
    throw new Error(`Audit log ${filePath} ends with a line that is not an audit entry`);
  }
  return entry as AuditLogEntry;
}

/**
 * Check a JSONL audit log: sequence numbers run 1..n, every `prevHash` is the
 * previous line's `hash`, and every `hash` matches its entry.
 */
export function verifyAuditLog(filePath: string): AuditLogVerification {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let prevHash = AUDIT_GENESIS_HASH;
  let entries = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const fail = (reason: string): AuditLogVerification => ({
      valid: false,
      entries,
      line: i + 1,
      reason,
    });
    let entry: AuditLogEntry;
    try {
      entry = JSON.parse(lines[i]) as AuditLogEntry;
    } catch {
      return fail('not valid JSON');
    }
    if (entry.seq !== entries + 1) return fail(`expected seq ${entries + 1}, got ${entry.seq}`);
    if (entry.prevHash !== prevHash) return fail('prevHash does not match the previous entry');
    if (hashAuditEntry(entry.seq, entry.prevHash, entry.event) !== entry.hash) {
      return fail('hash does not match the entry');
    }
    prevHash = entry.hash;
    entries++;
  }
  return { valid: true, entries };
}
