import { DotenvSecretResolver } from '../../../../src/mcp/secrets/dotenv-resolver';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('DotenvSecretResolver', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `matimo-test-dotenv-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  it('should have name "dotenv"', () => {
    const resolver = new DotenvSecretResolver();
    expect(resolver.name).toBe('dotenv');
  });

  describe('resolve', () => {
    it('should read values from .env file', async () => {
      const envFile = join(tempDir, '.env');
      writeFileSync(envFile, 'SLACK_TOKEN=xoxb-test-123\nGITHUB_TOKEN=ghp_test\n');

      const resolver = new DotenvSecretResolver(envFile);
      expect(await resolver.resolve('SLACK_TOKEN')).toBe('xoxb-test-123');
      expect(await resolver.resolve('GITHUB_TOKEN')).toBe('ghp_test');
    });

    it('should handle MATIMO_ prefixed keys', async () => {
      const envFile = join(tempDir, '.env');
      writeFileSync(envFile, 'MATIMO_API_KEY=prefixed-val\nAPI_KEY=raw-val\n');

      const resolver = new DotenvSecretResolver(envFile);
      // MATIMO_ prefix should be tried first
      expect(await resolver.resolve('API_KEY')).toBe('prefixed-val');
    });

    it('should handle quoted values', async () => {
      const envFile = join(tempDir, '.env');
      writeFileSync(envFile, 'KEY1="double-quoted"\nKEY2=\'single-quoted\'\n');

      const resolver = new DotenvSecretResolver(envFile);
      expect(await resolver.resolve('KEY1')).toBe('double-quoted');
      expect(await resolver.resolve('KEY2')).toBe('single-quoted');
    });

    it('should skip comments and empty lines', async () => {
      const envFile = join(tempDir, '.env');
      writeFileSync(envFile, '# This is a comment\n\nSLACK_TOKEN=value\n# Another comment\n');

      const resolver = new DotenvSecretResolver(envFile);
      expect(await resolver.resolve('SLACK_TOKEN')).toBe('value');
    });

    it('should return undefined for missing keys', async () => {
      const envFile = join(tempDir, '.env');
      writeFileSync(envFile, 'EXISTING=value\n');

      const resolver = new DotenvSecretResolver(envFile);
      expect(await resolver.resolve('NONEXISTENT')).toBeUndefined();
    });

    it('should handle missing file gracefully', async () => {
      const resolver = new DotenvSecretResolver(join(tempDir, 'nonexistent.env'));
      expect(await resolver.resolve('ANY_KEY')).toBeUndefined();
    });

    it('should handle read errors gracefully when dotenv path is a directory', async () => {
      const resolver = new DotenvSecretResolver(tempDir);
      expect(await resolver.resolve('ANY_KEY')).toBeUndefined();
    });

    it('should cache file after first read', async () => {
      const envFile = join(tempDir, '.env');
      writeFileSync(envFile, 'KEY=original\n');

      const resolver = new DotenvSecretResolver(envFile);
      expect(await resolver.resolve('KEY')).toBe('original');

      // Modify file (shouldn't affect cached result)
      writeFileSync(envFile, 'KEY=modified\n');
      expect(await resolver.resolve('KEY')).toBe('original');
    });
  });

  describe('resolveAll', () => {
    it('should resolve multiple keys', async () => {
      const envFile = join(tempDir, '.env');
      writeFileSync(envFile, 'A=1\nB=2\nC=3\n');

      const resolver = new DotenvSecretResolver(envFile);
      const result = await resolver.resolveAll(['A', 'B', 'MISSING']);
      expect(result).toEqual({ A: '1', B: '2' });
    });
  });

  describe('getAllEntries', () => {
    it('should return all key-value pairs from the .env file', () => {
      const envFile = join(tempDir, '.env');
      writeFileSync(envFile, 'FOO=bar\nBAZ=qux\nNUM=42\n');

      const resolver = new DotenvSecretResolver(envFile);
      expect(resolver.getAllEntries()).toEqual({ FOO: 'bar', BAZ: 'qux', NUM: '42' });
    });

    it('should return empty object when .env file does not exist', () => {
      const resolver = new DotenvSecretResolver(join(tempDir, 'missing.env'));
      expect(resolver.getAllEntries()).toEqual({});
    });

    it('should return a copy — mutating the result does not affect internal cache', () => {
      const envFile = join(tempDir, '.env');
      writeFileSync(envFile, 'KEY=value\n');

      const resolver = new DotenvSecretResolver(envFile);
      const entries1 = resolver.getAllEntries();
      entries1['INJECTED'] = 'mutated';

      const entries2 = resolver.getAllEntries();
      expect(entries2['INJECTED']).toBeUndefined();
    });

    it('should include both plain and MATIMO_-prefixed keys', () => {
      const envFile = join(tempDir, '.env');
      writeFileSync(envFile, 'MATIMO_API_KEY=prefixed\nRAW_KEY=raw\n');

      const resolver = new DotenvSecretResolver(envFile);
      const entries = resolver.getAllEntries();
      expect(entries['MATIMO_API_KEY']).toBe('prefixed');
      expect(entries['RAW_KEY']).toBe('raw');
    });

    it('should return consistent results on repeated calls (uses cache)', () => {
      const envFile = join(tempDir, '.env');
      writeFileSync(envFile, 'A=1\n');

      const resolver = new DotenvSecretResolver(envFile);
      const first = resolver.getAllEntries();

      // Modify the file — cache should serve original content
      writeFileSync(envFile, 'A=modified\n');
      const second = resolver.getAllEntries();

      expect(first).toEqual({ A: '1' });
      expect(second).toEqual({ A: '1' }); // cache hit, not re-read
    });
  });
});
