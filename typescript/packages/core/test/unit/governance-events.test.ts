import fs from 'fs';
import os from 'os';
import path from 'path';
import { MatimoInstance } from '../../src/matimo-instance';
import type { MatimoEvent } from '../../src/policy/events';

/**
 * Governance decisions outside a tool's own run are emitted as events:
 * tool:quarantined when a call waits for onHITL, and tool:rejected when a
 * reload re-checks an untrusted tool. Mirrors test_governance_events.py.
 */
describe('governance events', () => {
  let dir: string;

  const writeTool = (parent: string, name: string, yaml: string) => {
    fs.mkdirSync(path.join(parent, name), { recursive: true });
    fs.writeFileSync(path.join(parent, name, 'definition.yaml'), yaml);
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-gov-events-'));
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('emits tool:quarantined before asking onHITL', async () => {
    const tools = path.join(dir, 'tools');
    writeTool(
      tools,
      'get_item',
      "name: get_item\nversion: '1.0.0'\ndescription: Fetch an item\nexecution:\n  type: http\n  method: GET\n  url: 'https://api.example.com/item'\n"
    );
    const events: MatimoEvent[] = [];
    const seenAtHitl: string[] = [];
    const matimo = await MatimoInstance.init({
      toolPaths: [tools],
      logLevel: 'silent',
      approvalDir: dir,
      policyConfig: { enableHITL: true, hitlMinRiskLevel: 'low' },
      onHITL: async () => {
        seenAtHitl.push(...events.map((e) => e.type));
        return false;
      },
      onEvent: (event) => events.push(event),
    });

    await expect(
      matimo.execute('get_item', {}, { context: { environment: 'staging' } })
    ).rejects.toThrow();

    const quarantined = events.find((e) => e.type === 'tool:quarantined');
    expect(quarantined).toEqual({
      type: 'tool:quarantined',
      toolName: 'get_item',
      riskLevel: 'low',
      reason: expect.any(String),
      environment: 'staging',
      timestamp: expect.any(String),
    });
    expect(seenAtHitl).toContain('tool:quarantined');
    expect(events[events.length - 1].type).toBe('tool:quarantine_rejected');
  });

  it('emits tool:rejected when a reload denies an untrusted tool', async () => {
    const untrusted = path.join(dir, 'untrusted');
    writeTool(
      untrusted,
      'shell',
      "name: shell\nversion: '1.0.0'\ndescription: Run ls\nrequires_approval: true\nexecution:\n  type: command\n  command: ls\n"
    );
    const events: MatimoEvent[] = [];
    const matimo = await MatimoInstance.init({
      toolPaths: [untrusted],
      untrustedPaths: [untrusted],
      logLevel: 'silent',
      approvalDir: dir,
      onEvent: (event) => events.push(event),
    });
    events.length = 0;

    const result = await matimo.reloadTools();

    expect(result.rejected).toEqual(['shell']);
    expect(events.find((e) => e.type === 'tool:rejected')).toEqual({
      type: 'tool:rejected',
      toolName: 'shell',
      violations: [{ rule: 'policy-denied', severity: 'high', message: expect.any(String) }],
      timestamp: expect.any(String),
    });
  });
});
