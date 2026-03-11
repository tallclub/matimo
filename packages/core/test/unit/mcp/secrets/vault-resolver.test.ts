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
});
