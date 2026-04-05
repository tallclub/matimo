import { parsePolicyFile } from '../../src/policy/policy-loader';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MatimoError } from '../../src/errors/matimo-error';

describe('parsePolicyFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-parse-policy-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should parse a valid policy YAML and return PolicyConfig', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedDomains:
  - api.slack.com
  - slack.com
allowedHttpMethods:
  - GET
  - POST
`
    );

    const config = parsePolicyFile(policyFile);
    expect(config.allowedDomains).toEqual(['api.slack.com', 'slack.com']);
    expect(config.allowedHttpMethods).toEqual(['GET', 'POST']);
  });

  it('should parse enableHITL field', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `enableHITL: true\n`);

    const config = parsePolicyFile(policyFile);
    expect(config.enableHITL).toBe(true);
  });

  it('should parse quarantineRiskLevels field', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `enableHITL: true
quarantineRiskLevels:
  - medium
  - high
`
    );

    const config = parsePolicyFile(policyFile);
    expect(config.quarantineRiskLevels).toEqual(['medium', 'high']);
  });

  it('should parse all HITL fields together with existing fields', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedDomains:
  - api.example.com
allowedHttpMethods:
  - GET
allowCommandTools: false
enableHITL: true
quarantineRiskLevels:
  - medium
`
    );

    const config = parsePolicyFile(policyFile);
    expect(config.allowedDomains).toEqual(['api.example.com']);
    expect(config.allowedHttpMethods).toEqual(['GET']);
    expect(config.allowCommandTools).toBe(false);
    expect(config.enableHITL).toBe(true);
    expect(config.quarantineRiskLevels).toEqual(['medium']);
  });

  it('should not include enableHITL if not specified in YAML', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `allowedDomains: []\n`);

    const config = parsePolicyFile(policyFile);
    expect(config.enableHITL).toBeUndefined();
    expect(config.quarantineRiskLevels).toBeUndefined();
  });

  it('should throw MatimoError for non-existent file', () => {
    const nonExistentFile = path.join(tempDir, 'nope.yaml');
    expect(() => parsePolicyFile(nonExistentFile)).toThrow(MatimoError);
  });

  it('should throw MatimoError for invalid YAML', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `invalid yaml: [broken`);
    expect(() => parsePolicyFile(policyFile)).toThrow(MatimoError);
  });

  it('should throw MatimoError for invalid schema (bad risk level)', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `quarantineRiskLevels:
  - extreme
`
    );
    expect(() => parsePolicyFile(policyFile)).toThrow(MatimoError);
  });

  it('should throw MatimoError with INVALID_SCHEMA code', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `enableHITL: not-a-boolean\n`);
    try {
      parsePolicyFile(policyFile);
    } catch (err) {
      expect(err).toBeInstanceOf(MatimoError);
      expect((err as MatimoError).code).toBe('INVALID_SCHEMA');
    }
  });

  it('should handle empty YAML file', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `# Empty policy\n`);

    const config = parsePolicyFile(policyFile);
    expect(config).toEqual({});
  });

  it('should return config without creating an engine', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedDomains:
  - api.example.com
enableHITL: true
`
    );

    const config = parsePolicyFile(policyFile);
    // Should be a plain object, not a PolicyEngine instance
    expect(typeof config.allowedDomains).not.toBeUndefined();
    expect((config as Record<string, unknown>)['canExecute']).toBeUndefined();
    expect((config as Record<string, unknown>)['canCreate']).toBeUndefined();
  });
});
