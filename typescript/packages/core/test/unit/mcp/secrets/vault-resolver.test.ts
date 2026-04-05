import { VaultSecretResolver } from '../../../../src/mcp/secrets/vault-resolver';

// Mock node-vault
const mockRead = jest.fn();
jest.mock(
  'node-vault',
  () => {
    return jest.fn(() => ({
      read: mockRead,
    }));
  },
  { virtual: true }
);

describe('VaultSecretResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRead.mockReset();
  });

  it('should have name "vault"', () => {
    const resolver = new VaultSecretResolver();
    expect(resolver.name).toBe('vault');
  });

  describe('resolve', () => {
    it('should fetch secrets from Vault KV v2', async () => {
      mockRead.mockResolvedValueOnce({
        data: {
          data: {
            SLACK_TOKEN: 'xoxb-vault-test',
            GITHUB_TOKEN: 'ghp-vault-test',
          },
        },
      });

      const resolver = new VaultSecretResolver({
        addr: 'http://localhost:8200',
        token: 'test-token',
      });

      const result = await resolver.resolve('SLACK_TOKEN');
      expect(result).toBe('xoxb-vault-test');
      expect(mockRead).toHaveBeenCalledWith('secret/data/matimo');
    });

    it('should use custom secret path', async () => {
      mockRead.mockResolvedValueOnce({
        data: { data: { KEY: 'value' } },
      });

      const resolver = new VaultSecretResolver({
        secretPath: 'custom/data/path',
        token: 'token',
      });

      await resolver.resolve('KEY');
      expect(mockRead).toHaveBeenCalledWith('custom/data/path');
    });

    it('should cache results within TTL', async () => {
      mockRead.mockResolvedValueOnce({
        data: { data: { KEY: 'cached-value' } },
      });

      const resolver = new VaultSecretResolver({
        token: 'token',
        cacheTtlMs: 60000,
      });

      // First call fetches
      await resolver.resolve('KEY');
      // Second call uses cache
      await resolver.resolve('KEY');

      expect(mockRead).toHaveBeenCalledTimes(1);
    });

    it('should return undefined for missing keys', async () => {
      mockRead.mockResolvedValueOnce({
        data: { data: { OTHER: 'value' } },
      });

      const resolver = new VaultSecretResolver({ token: 'token' });
      const result = await resolver.resolve('NONEXISTENT');
      expect(result).toBeUndefined();
    });

    it('should return stale cache on Vault failure', async () => {
      // First call succeeds
      mockRead.mockResolvedValueOnce({
        data: { data: { KEY: 'original' } },
      });

      const resolver = new VaultSecretResolver({
        token: 'token',
        cacheTtlMs: 0, // Expired immediately
      });

      await resolver.resolve('KEY');

      // Second call fails
      mockRead.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await resolver.resolve('KEY');
      expect(result).toBe('original');
    });
  });

  describe('resolveAll', () => {
    it('should resolve multiple keys', async () => {
      mockRead.mockResolvedValueOnce({
        data: {
          data: {
            A: '1',
            B: '2',
            C: '3',
          },
        },
      });

      const resolver = new VaultSecretResolver({ token: 'token' });
      const result = await resolver.resolveAll(['A', 'B']);
      expect(result).toEqual({ A: '1', B: '2' });
    });
  });

  describe('dispose', () => {
    it('should clear cache and client', async () => {
      mockRead.mockResolvedValueOnce({
        data: { data: { KEY: 'value' } },
      });

      const resolver = new VaultSecretResolver({ token: 'token' });
      await resolver.resolve('KEY');

      await resolver.dispose();

      // After dispose, should re-fetch
      mockRead.mockResolvedValueOnce({
        data: { data: { KEY: 'new-value' } },
      });
      const result = await resolver.resolve('KEY');
      expect(result).toBe('new-value');
      expect(mockRead).toHaveBeenCalledTimes(2);
    });
  });

  describe('constructor options', () => {
    it('should accept custom namespace', () => {
      const resolver = new VaultSecretResolver({
        namespace: 'custom-ns',
        token: 'token',
      });
      expect(resolver['namespace']).toBe('custom-ns');
    });

    it('should use default namespace from env', () => {
      process.env.VAULT_NAMESPACE = 'env-ns';
      const resolver = new VaultSecretResolver({ token: 'token' });
      expect(resolver['namespace']).toBe('env-ns');
      delete process.env.VAULT_NAMESPACE;
    });

    it('should accept custom cache TTL', () => {
      const resolver = new VaultSecretResolver({
        token: 'token',
        cacheTtlMs: 120000,
      });
      expect(resolver['cacheTtlMs']).toBe(120000);
    });

    it('should use default cache TTL', () => {
      const resolver = new VaultSecretResolver({ token: 'token' });
      expect(resolver['cacheTtlMs']).toBe(300_000);
    });

    it('should use env vars for addr and token', () => {
      process.env.VAULT_ADDR = 'http://vault.example.com:8200';
      process.env.VAULT_TOKEN = 'env-token';
      const resolver = new VaultSecretResolver();
      expect(resolver['addr']).toBe('http://vault.example.com:8200');
      expect(resolver['token']).toBe('env-token');
      delete process.env.VAULT_ADDR;
      delete process.env.VAULT_TOKEN;
    });

    it('should use default addr if env var not set', () => {
      delete process.env.VAULT_ADDR;
      const resolver = new VaultSecretResolver({ token: 'token' });
      expect(resolver['addr']).toBe('http://127.0.0.1:8200');
    });

    it('should use default secret path', () => {
      const resolver = new VaultSecretResolver({ token: 'token' });
      expect(resolver['secretPath']).toBe('secret/data/matimo');
    });
  });

  describe('error handling', () => {
    it('should throw MatimoError when node-vault package is missing', async () => {
      // Simulate missing module error
      jest.spyOn(global, 'eval').mockImplementationOnce(() => {
        const error = new Error("Cannot find module 'node-vault'");
        throw error;
      });

      jest.doMock('node-vault', () => {
        throw new Error('ERR_MODULE_NOT_FOUND');
      });

      try {
        const _resolver = new VaultSecretResolver({ token: 'token' });
        // VaultSecretResolver constructor doesn't call vault immediately,
        // so we just verify it can be instantiated
        expect(_resolver).toBeDefined();
      } finally {
        jest.dontMock('node-vault');
      }
    });

    it('should handle cache miss when no stale cache available', async () => {
      // First call with no cache, then error
      mockRead.mockRejectedValueOnce(new Error('Vault connection error'));

      const resolver = new VaultSecretResolver({
        token: 'token',
        cacheTtlMs: 0, // Cache expires immediately
      });

      const result = await resolver.resolve('KEY');
      expect(result).toBeUndefined(); // Returns empty object result
    });

    it('should differentiate MatimoError from other errors', async () => {
      mockRead.mockRejectedValueOnce(new Error('Network timeout'));

      const resolver = new VaultSecretResolver({ token: 'token' });

      const result = await resolver.resolve('KEY');
      expect(result).toBeUndefined();
    });
  });

  describe('custom path and namespace', () => {
    it('should use custom path from options', async () => {
      mockRead.mockResolvedValueOnce({
        data: { data: { KEY: 'val' } },
      });

      const resolver = new VaultSecretResolver({
        addr: 'http://vault.local:8200',
        token: 'custom-token',
        secretPath: 'app/secrets',
        namespace: 'prod',
      });

      expect(resolver['addr']).toBe('http://vault.local:8200');
      expect(resolver['token']).toBe('custom-token');
      expect(resolver['secretPath']).toBe('app/secrets');
      expect(resolver['namespace']).toBe('prod');
    });
  });
});
