import fs from 'fs';
import os from 'os';
import path from 'path';
import { MatimoInstance } from '../../src/matimo-instance';
import type { MatimoEvent } from '../../src/policy/events';

/**
 * tool:executed / tool:execution_failed carry exactly the fields in
 * conformance/events/execution-events.json — the same spec the Python SDK's
 * test_execution_events.py asserts.
 */
const spec = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../../conformance/events/execution-events.json'),
    'utf8'
  )
) as { events: Record<string, { required: string[]; optional: string[] }> };

function expectFieldsMatchSpec(event: MatimoEvent): void {
  const { required, optional } = spec.events[event.type];
  const keys = Object.keys(event);
  expect(keys).toEqual(expect.arrayContaining(required));
  expect(keys.filter((k) => !required.includes(k) && !optional.includes(k))).toEqual([]);
}

describe('execution events', () => {
  let toolDir: string;
  let events: MatimoEvent[];
  let matimo: MatimoInstance;

  const writeFunctionTool = (name: string, risk: string, body: string) => {
    const dir = path.join(toolDir, name);
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, 'definition.yaml'),
      `name: ${name}\nversion: '1.0.0'\nrisk: ${risk}\ndescription: d\nexecution:\n  type: function\n  code: './${name}.js'\n`
    );
    fs.writeFileSync(path.join(dir, `${name}.js`), body);
  };

  beforeAll(async () => {
    toolDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-events-'));
    writeFunctionTool('ok', 'low', 'module.exports = async () => ({ success: true });\n');
    writeFunctionTool(
      'soft_fail',
      'medium',
      'module.exports = async () => ({ success: false });\n'
    );
    // An auth placeholder with no value fails after every gate has passed
    const unauth = path.join(toolDir, 'missing_token');
    fs.mkdirSync(unauth);
    fs.writeFileSync(
      path.join(unauth, 'definition.yaml'),
      "name: missing_token\nversion: '1.0.0'\ndescription: d\nexecution:\n  type: http\n  method: GET\n  url: 'https://api.example.com/x'\n  headers:\n    Authorization: 'Bearer {MATIMO_TEST_UNSET_TOKEN_XYZ}'\n"
    );
    matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      logLevel: 'silent',
      onEvent: (e) => events.push(e),
    });
  });

  beforeEach(() => {
    events = [];
  });

  afterAll(() => fs.rmSync(toolDir, { recursive: true, force: true }));

  it('emits tool:executed for a successful run', async () => {
    await matimo.execute('ok', {}, { context: { agentId: 'agent-1' } });
    const [event] = events.filter((e) => e.type === 'tool:executed');
    expectFieldsMatchSpec(event);
    expect(event).toMatchObject({
      toolName: 'ok',
      agentId: 'agent-1',
      success: true,
      riskLevel: 'low',
    });
  });

  it('reports success: false when the tool returns { success: false }', async () => {
    await matimo.execute('soft_fail', {});
    const [event] = events.filter((e) => e.type === 'tool:executed');
    expectFieldsMatchSpec(event);
    expect(event).toMatchObject({ success: false, riskLevel: 'medium' });
    expect(event).not.toHaveProperty('agentId');
  });

  it('emits tool:execution_failed when the tool throws', async () => {
    await expect(matimo.execute('missing_token', {})).rejects.toThrow();
    const failures = events.filter((e) => e.type === 'tool:execution_failed');
    expect(failures).toHaveLength(1);
    expectFieldsMatchSpec(failures[0]);
    expect(failures[0]).toMatchObject({ toolName: 'missing_token', riskLevel: 'low' });
    expect(typeof (failures[0] as { errorCode: string }).errorCode).toBe('string');
    expect(events.some((e) => e.type === 'tool:executed')).toBe(false);
  });

  it('emits neither when a gate refuses the call', async () => {
    const guarded = await MatimoInstance.init({
      toolPaths: [toolDir],
      logLevel: 'silent',
      policyConfig: { enableHITL: true, hitlMinRiskLevel: 'low' },
      onEvent: (e) => events.push(e),
    });
    await expect(guarded.execute('ok', {})).rejects.toThrow(/quarantined/);
    expect(events.map((e) => e.type)).not.toContain('tool:executed');
    expect(events.map((e) => e.type)).not.toContain('tool:execution_failed');
  });

  it('gives each call its own traceId', async () => {
    await matimo.execute('ok', {});
    await matimo.execute('ok', {});
    const ids = events.filter((e) => e.type === 'tool:executed').map((e) => e.traceId);
    expect(new Set(ids).size).toBe(2);
  });
});
