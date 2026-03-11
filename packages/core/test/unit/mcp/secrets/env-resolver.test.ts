import { EnvSecretResolver } from '../../../../src/mcp/secrets/env-resolver';

describe('EnvSecretResolver', () => {
  let resolver: EnvSecretResolver;
  const originalEnv = process.env;

  beforeEach(() => {
    resolver = new EnvSecretResolver();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should have name "env"', () => {
    expect(resolver.name).toBe('env');
  });

  describe('resolve', () => {
    it('should resolve MATIMO_ prefixed var first', async () => {
      process.env.MATIMO_SLACK_TOKEN = 'matimo-value';
      process.env.SLACK_TOKEN = 'raw-value';

      const result = await resolver.resolve('SLACK_TOKEN');
      expect(result).toBe('matimo-value');
    });

    it('should fall back to raw key if MATIMO_ prefixed not found', async () => {
      delete process.env.MATIMO_SLACK_TOKEN;
      process.env.SLACK_TOKEN = 'raw-value';

      const result = await resolver.resolve('SLACK_TOKEN');
      expect(result).toBe('raw-value');
    });

    it('should return undefined if key not found', async () => {
      delete process.env.MATIMO_NONEXISTENT;
      delete process.env.NONEXISTENT;

      const result = await resolver.resolve('NONEXISTENT');
      expect(result).toBeUndefined();
    });
  });

  describe('resolveAll', () => {
    it('should resolve multiple keys', async () => {
      process.env.SLACK_TOKEN = 'slack-val';
      process.env.GITHUB_TOKEN = 'github-val';

      const result = await resolver.resolveAll(['SLACK_TOKEN', 'GITHUB_TOKEN']);
      expect(result).toEqual({
        SLACK_TOKEN: 'slack-val',
        GITHUB_TOKEN: 'github-val',
      });
    });

    it('should skip missing keys', async () => {
      process.env.SLACK_TOKEN = 'slack-val';
      delete process.env.MISSING_KEY;
      delete process.env.MATIMO_MISSING_KEY;

      const result = await resolver.resolveAll(['SLACK_TOKEN', 'MISSING_KEY']);
      expect(result).toEqual({ SLACK_TOKEN: 'slack-val' });
    });

    it('should return empty object for empty keys array', async () => {
      const result = await resolver.resolveAll([]);
      expect(result).toEqual({});
    });
  });
});
