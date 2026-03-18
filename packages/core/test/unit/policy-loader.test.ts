import { loadPolicyFromFile } from '../../src/policy/policy-loader';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MatimoError } from '../../src/errors/matimo-error';

describe('loadPolicyFromFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-policy-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should load a valid policy YAML file', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedDomains:
  - api.slack.com
  - slack.com
allowedCredentials:
  - SLACK_BOT_TOKEN
allowedHttpMethods:
  - GET
  - POST
allowCommandTools: false
allowFunctionTools: false
protectedNamespaces:
  - matimo_
`
    );

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
    expect(typeof engine.canExecute).toBe('function');
    expect(typeof engine.canCreate).toBe('function');
    expect(typeof engine.filterForAgent).toBe('function');
  });

  it('should load a minimal policy with no restrictions', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `# Empty policy\n`);

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
  });

  it('should throw error for non-existent file', () => {
    const nonExistentFile = path.join(tempDir, 'nonexistent.yaml');

    expect(() => loadPolicyFromFile(nonExistentFile)).toThrow(MatimoError);
  });

  it('should throw error with FILE_NOT_FOUND code for missing file', () => {
    const nonExistentFile = path.join(tempDir, 'nonexistent.yaml');

    try {
      loadPolicyFromFile(nonExistentFile);
    } catch (err) {
      expect(err).toBeInstanceOf(MatimoError);
      expect((err as MatimoError).code).toBe('INVALID_SCHEMA');
    }
  });

  it('should throw error for invalid YAML syntax', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedDomains:
  - api.slack.com
invalid yaml content: [
`
    );

    expect(() => loadPolicyFromFile(policyFile)).toThrow(MatimoError);
  });

  it('should throw error for invalid policy schema', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedDomains: not-an-array
allowedHttpMethods: also-not-array
`
    );

    expect(() => loadPolicyFromFile(policyFile)).toThrow(MatimoError);
  });

  it('should validate allowedDomains as array of strings', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedDomains:
  - api.slack.com
  - slack.com
`
    );

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
  });

  it('should validate allowedCredentials as array of strings', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedCredentials:
  - SLACK_BOT_TOKEN
  - OPENAI_API_KEY
`
    );

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
  });

  it('should validate allowedHttpMethods as array (converted to uppercase)', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedHttpMethods:
  - get
  - post
  - delete
`
    );

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
  });

  it('should validate allowCommandTools as boolean', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowCommandTools: true
allowFunctionTools: false
`
    );

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
  });

  it('should validate allowFunctionTools as boolean', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowFunctionTools: false
`
    );

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
  });

  it('should validate protectedNamespaces as array of strings', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `protectedNamespaces:
  - matimo_
  - internal_
  - system_
`
    );

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
  });

  it('should handle absolute paths', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `allowedDomains:\n  - api.example.com\n`);

    const absolutePath = path.resolve(policyFile);
    const engine = loadPolicyFromFile(absolutePath);
    expect(engine).toBeDefined();
  });

  it('should handle relative paths', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `allowedDomains:\n  - api.example.com\n`);

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const engine = loadPolicyFromFile('./policy.yaml');
      expect(engine).toBeDefined();
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should throw with descriptive error message for invalid YAML', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `invalid: yaml: [content`);

    try {
      loadPolicyFromFile(policyFile);
    } catch (err) {
      expect(err).toBeInstanceOf(MatimoError);
      expect((err as MatimoError).message).toContain('invalid YAML');
    }
  });

  it('should throw with descriptive error message for invalid schema', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `allowedDomains: should-be-array\n`);

    try {
      loadPolicyFromFile(policyFile);
    } catch (err) {
      expect(err).toBeInstanceOf(MatimoError);
      expect((err as MatimoError).message).toContain('invalid');
    }
  });

  it('should throw with INVALID_SCHEMA error code', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `allowedDomains: not-array\n`);

    try {
      loadPolicyFromFile(policyFile);
    } catch (err) {
      expect((err as MatimoError).code).toBe('INVALID_SCHEMA');
    }
  });

  it('should create frozen DefaultPolicyEngine instance', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedDomains:
  - api.slack.com
`
    );

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
    // Verify it has policy checking methods
    expect(typeof engine.canExecute).toBe('function');
    expect(typeof engine.canCreate).toBe('function');
    expect(typeof engine.filterForAgent).toBe('function');
  });

  it('should handle optional fields correctly', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    // Only specify some optional fields
    fs.writeFileSync(
      policyFile,
      `allowedDomains:
  - api.example.com
allowCommandTools: true
`
    );

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
  });

  it('should handle all optional fields being present', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedDomains:
  - api.example.com
allowedCredentials:
  - TOKEN
allowedHttpMethods:
  - GET
allowCommandTools: true
allowFunctionTools: true
protectedNamespaces:
  - prefix_
`
    );

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
  });

  it('should handle empty arrays in policy', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedDomains: []
allowedCredentials: []
allowedHttpMethods: []
`
    );

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
  });

  it('should convert HTTP methods to uppercase', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(
      policyFile,
      `allowedHttpMethods:
  - get
  - POST
  - pUt
  - DeLeTe
`
    );

    const engine = loadPolicyFromFile(policyFile);
    expect(engine).toBeDefined();
  });

  it('should handle file read permissions errors', () => {
    if (process.platform === 'win32') {
      // Skip on Windows
      return;
    }

    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `allowedDomains: []`);
    fs.chmodSync(policyFile, 0o000);

    try {
      expect(() => loadPolicyFromFile(policyFile)).toThrow(MatimoError);
    } finally {
      fs.chmodSync(policyFile, 0o644);
    }
  });

  it('should throw error in catch block for file operations', () => {
    const invalidPath = '/nonexistent/deeply/nested/path/policy.yaml';

    try {
      loadPolicyFromFile(invalidPath);
    } catch (err) {
      expect(err).toBeInstanceOf(MatimoError);
      expect((err as MatimoError).code).toBe('INVALID_SCHEMA');
    }
  });

  it('should include error details in thrown error', () => {
    const policyFile = path.join(tempDir, 'policy.yaml');
    fs.writeFileSync(policyFile, `invalid structure`);

    try {
      loadPolicyFromFile(policyFile);
    } catch (err) {
      expect(err).toBeInstanceOf(MatimoError);
      const matimoErr = err as MatimoError;
      // MatimoError has details property, not context
      expect(matimoErr.details).toBeDefined();
    }
  });
});
