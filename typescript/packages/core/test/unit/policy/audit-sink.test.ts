import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AUDIT_GENESIS_HASH,
  JsonlFileSink,
  canonicalJson,
  hashAuditEntry,
  isSecretKey,
  redactSecrets,
  verifyAuditLog,
} from '../../../src/policy/audit-sink';
import type { AuditSink } from '../../../src/policy/audit-sink';
import type { MatimoEvent } from '../../../src/policy/events';
import { MatimoInstance } from '../../../src/matimo-instance';

/**
 * Hash-chain and redaction rules come from conformance/audit/hash-chain.json,
 * which the Python SDK's test_audit_sink.py asserts too.
 */
const spec = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../../../conformance/audit/hash-chain.json'),
    'utf8'
  )
) as {
  genesisPrevHash: string;
  canonicalJsonExample: { value: unknown; expected: string };
  secretKeys: Record<string, boolean>;
  entries: {
    event: MatimoEvent;
    expected: { seq: number; prevHash: string; event: unknown; hash: string };
  }[];
};

const event = (toolName: string): MatimoEvent => ({
  type: 'tool:execution_denied',
  toolName,
  reason: 'denied',
  timestamp: '2026-09-30T00:00:00.000Z',
});

describe('audit sink', () => {
  let dir: string;
  let logFile: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-audit-'));
    logFile = path.join(dir, 'logs', 'audit.jsonl');
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  describe('conformance', () => {
    it('uses the shared genesis hash', () => {
      expect(AUDIT_GENESIS_HASH).toBe(spec.genesisPrevHash);
    });

    it('serialises canonical JSON as specified', () => {
      expect(canonicalJson(spec.canonicalJsonExample.value)).toBe(
        spec.canonicalJsonExample.expected
      );
    });

    it.each(Object.entries(spec.secretKeys))('isSecretKey(%s) is %s', (key, secret) => {
      expect(isSecretKey(key)).toBe(secret);
    });

    it('writes the specified entries', () => {
      const sink = new JsonlFileSink(logFile);
      spec.entries.forEach((e) => sink.write(e.event));
      const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
      expect(lines.map((l) => JSON.parse(l))).toEqual(spec.entries.map((e) => e.expected));
    });
  });

  it('redacts nested secret keys and drops undefined values', () => {
    expect(
      redactSecrets({ a: [{ password: 'p', keep: 1 }], b: undefined, c: null, token: { x: 1 } })
    ).toEqual({ a: [{ password: '[REDACTED]', keep: 1 }], c: null, token: '[REDACTED]' });
  });

  it('continues the chain of an existing log', () => {
    new JsonlFileSink(logFile).write(event('a'));
    new JsonlFileSink(logFile).write(event('b'));
    const [first, second] = fs
      .readFileSync(logFile, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(second.seq).toBe(2);
    expect(second.prevHash).toBe(first.hash);
    expect(verifyAuditLog(logFile)).toEqual({ valid: true, entries: 2 });
  });

  it('starts a fresh chain for an empty file', () => {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, '\n');
    new JsonlFileSink(logFile).write(event('a'));
    expect(verifyAuditLog(logFile)).toEqual({ valid: true, entries: 1 });
  });

  it('refuses to continue a log whose last line is not an entry', () => {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, '{"hello":"world"}\n');
    expect(() => new JsonlFileSink(logFile)).toThrow(/not an audit entry/);
  });

  describe('verifyAuditLog', () => {
    const writeThree = () => {
      const sink = new JsonlFileSink(logFile);
      ['a', 'b', 'c'].forEach((n) => sink.write(event(n)));
      return fs.readFileSync(logFile, 'utf8').trim().split('\n');
    };

    it('detects an edited event', () => {
      const lines = writeThree();
      lines[1] = lines[1].replace('"toolName":"b"', '"toolName":"z"');
      fs.writeFileSync(logFile, lines.join('\n'));
      expect(verifyAuditLog(logFile)).toEqual({
        valid: false,
        entries: 1,
        line: 2,
        reason: 'hash does not match the entry',
      });
    });

    it('detects a deleted line', () => {
      const lines = writeThree();
      fs.writeFileSync(logFile, [lines[0], lines[2]].join('\n'));
      expect(verifyAuditLog(logFile)).toMatchObject({
        valid: false,
        line: 2,
        reason: 'expected seq 2, got 3',
      });
    });

    it('detects a re-hashed line that breaks the chain', () => {
      const lines = writeThree();
      const forged = JSON.parse(lines[1]);
      forged.prevHash = AUDIT_GENESIS_HASH;
      forged.hash = hashAuditEntry(forged.seq, forged.prevHash, forged.event);
      lines[1] = JSON.stringify(forged);
      fs.writeFileSync(logFile, lines.join('\n'));
      expect(verifyAuditLog(logFile)).toMatchObject({
        valid: false,
        line: 2,
        reason: 'prevHash does not match the previous entry',
      });
    });

    it('detects a line that is not JSON', () => {
      const lines = writeThree();
      lines[2] = 'garbage';
      fs.writeFileSync(logFile, lines.join('\n'));
      expect(verifyAuditLog(logFile)).toMatchObject({
        valid: false,
        entries: 2,
        line: 3,
        reason: 'not valid JSON',
      });
    });
  });

  describe('MatimoInstance.auditSink', () => {
    let toolDir: string;

    beforeEach(() => {
      toolDir = path.join(dir, 'tools', 'ok');
      fs.mkdirSync(toolDir, { recursive: true });
      fs.writeFileSync(
        path.join(toolDir, 'definition.yaml'),
        "name: ok\nversion: '1.0.0'\nrisk: low\ndescription: d\nexecution:\n  type: function\n  code: './ok.js'\n"
      );
      fs.writeFileSync(
        path.join(toolDir, 'ok.js'),
        'module.exports = async () => ({ success: true });\n'
      );
    });

    it('records events alongside onEvent', async () => {
      const seen: MatimoEvent[] = [];
      const matimo = await MatimoInstance.init({
        toolPaths: [path.dirname(toolDir)],
        logLevel: 'silent',
        onEvent: (e) => seen.push(e),
        auditSink: new JsonlFileSink(logFile),
      });
      await matimo.execute('ok', {});
      const logged = fs
        .readFileSync(logFile, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l).event);
      expect(logged.map((e) => e.type)).toEqual(seen.map((e) => e.type));
      expect(logged).toContainEqual(expect.objectContaining({ type: 'tool:executed' }));
      expect(verifyAuditLog(logFile).valid).toBe(true);
    });

    it.each([
      [
        'throws',
        () => {
          throw new Error('disk full');
        },
      ],
      ['rejects', () => Promise.reject(new Error('disk full'))],
    ])('keeps executing when the sink %s', async (_label, write) => {
      const sink: AuditSink = { write };
      const matimo = await MatimoInstance.init({
        toolPaths: [path.dirname(toolDir)],
        logLevel: 'silent',
        auditSink: sink,
      });
      await expect(matimo.execute('ok', {})).resolves.toEqual({ success: true });
      await new Promise((r) => setImmediate(r));
    });
  });
});
