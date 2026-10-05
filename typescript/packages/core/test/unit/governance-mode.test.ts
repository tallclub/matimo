import fs from 'fs';
import os from 'os';
import path from 'path';
import { MatimoInstance } from '../../src/matimo-instance';
import { getGlobalApprovalHandler } from '../../src/approval/approval-handler';
import { DefaultPolicyEngine } from '../../src/policy/default-policy';
import { parsePolicyFile } from '../../src/policy/policy-loader';
import { toolToMcpRegistration } from '../../src/mcp/tool-converter';
import type { PolicyEngine } from '../../src/policy/types';
import type { ToolDefinition } from '../../src/core/schema';

/**
 * governanceMode: 'secure' (default) asks before every call to a DELETE or
 * command tool that doesn't declare requires_approval; 'legacy' restores the
 * pre-0.2.0 default of not asking.
 */
describe('governanceMode', () => {
  let dir: string;
  let toolDir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-governance-'));
    toolDir = path.join(dir, 'tools');
    const echo = path.join(toolDir, 'plain-echo');
    fs.mkdirSync(echo, { recursive: true });
    fs.writeFileSync(
      path.join(echo, 'definition.yaml'),
      "name: plain-echo\nversion: '1.0.0'\ndescription: Echo\nexecution:\n  type: command\n  command: echo\n  args: ['hi']\n"
    );
    getGlobalApprovalHandler().setApprovalCallback(null);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const init = (options: Parameters<typeof MatimoInstance.init>[0] & object = {}) =>
    MatimoInstance.init({ toolPaths: [toolDir], logLevel: 'silent', ...options });

  const writePolicy = (mode: string) => {
    const file = path.join(dir, 'policy.yaml');
    fs.writeFileSync(file, `governanceMode: ${mode}\n`);
    return file;
  };

  it("defaults to 'secure', which asks before running a command tool", async () => {
    const matimo = await init();
    expect(matimo.getGovernanceMode()).toBe('secure');
    await expect(matimo.execute('plain-echo', {})).rejects.toThrow(/requires approval/);
  });

  it("'legacy' runs the command tool without asking", async () => {
    const onApproval = jest.fn(async () => true);
    const matimo = await init({ governanceMode: 'legacy', onApproval });
    expect(matimo.getGovernanceMode()).toBe('legacy');
    await expect(matimo.execute('plain-echo', {})).resolves.toBeDefined();
    expect(onApproval).not.toHaveBeenCalled();
  });

  it('reads the mode from policyConfig', async () => {
    const matimo = await init({ policyConfig: { governanceMode: 'legacy' } });
    expect(matimo.getGovernanceMode()).toBe('legacy');
  });

  it('reads the mode from a policy file', async () => {
    const file = writePolicy('legacy');
    expect(parsePolicyFile(file)).toEqual({ governanceMode: 'legacy' });
    const matimo = await init({ policyFile: file });
    expect(matimo.getGovernanceMode()).toBe('legacy');
  });

  it('rejects an unknown mode in a policy file', () => {
    expect(() => parsePolicyFile(writePolicy('relaxed'))).toThrow();
  });

  it('lets InitOptions override the policy config', async () => {
    const matimo = await init({
      governanceMode: 'secure',
      policyConfig: { governanceMode: 'legacy' },
    });
    expect(matimo.getGovernanceMode()).toBe('secure');
  });

  it('follows the policy config across reloadPolicy()', async () => {
    const matimo = await init({ policyConfig: {} });
    await matimo.reloadPolicy(writePolicy('legacy'));
    expect(matimo.getGovernanceMode()).toBe('legacy');
  });

  it("uses 'secure' with a custom PolicyEngine", async () => {
    const custom: PolicyEngine = {
      canExecute: () => ({ allowed: true }),
      canCreate: () => ({ allowed: true }),
      filterForAgent: (_c, tools) => tools,
    };
    const matimo = await init({ policy: custom });
    expect(matimo.getGovernanceMode()).toBe('secure');
    expect(new DefaultPolicyEngine().getConfig().governanceMode).toBeUndefined();
  });

  describe('MCP clientApproval', () => {
    const deleteTool = {
      name: 'wipe',
      version: '1.0.0',
      description: 'd',
      parameters: {},
      execution: { type: 'http', method: 'DELETE', url: 'https://api.example.com/x' },
    } as unknown as ToolDefinition;

    it.each([
      ['secure', true],
      ['legacy', false],
    ] as const)('%s mode offers _matimo_approved: %s', (governanceMode, offered) => {
      const { inputSchema } = toolToMcpRegistration(deleteTool, {
        clientApproval: true,
        governanceMode,
      });
      expect('_matimo_approved' in inputSchema).toBe(offered);
    });
  });
});
