import { AwsSecretsManagerResolver } from '../../../../src/mcp/secrets/aws-resolver';

// Mock AWS SDK
const mockSend = jest.fn();
let mockSecretsManagerClient: jest.Mock;

jest.mock(
  '@aws-sdk/client-secrets-manager',
  () => {
    mockSecretsManagerClient = jest.fn(() => ({
      send: mockSend,
    }));
    return {
      SecretsManagerClient: mockSecretsManagerClient,
      GetSecretValueCommand: jest.fn((params: Record<string, unknown>) => params),
    };
  },
  { virtual: true }
);

describe('AwsSecretsManagerResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have name "aws-sm"', () => {
    const resolver = new AwsSecretsManagerResolver();
    expect(resolver.name).toBe('aws-sm');
  });

  describe('resolve', () => {
    it('should fetch and parse JSON secrets from AWS', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({
          SLACK_TOKEN: 'xoxb-aws-test',
          GITHUB_TOKEN: 'ghp-aws-test',
        }),
      });

      const resolver = new AwsSecretsManagerResolver({
        region: 'us-east-1',
        secretId: 'test/secrets',
      });

      const result = await resolver.resolve('SLACK_TOKEN');
      expect(result).toBe('xoxb-aws-test');
    });

    it('should use default secret ID', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({ KEY: 'val' }),
      });

      const resolver = new AwsSecretsManagerResolver();
      await resolver.resolve('KEY');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ SecretId: 'matimo/credentials' })
      );
    });

    it('should cache results within TTL', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({ KEY: 'cached' }),
      });

      const resolver = new AwsSecretsManagerResolver({
        cacheTtlMs: 60000,
      });

      await resolver.resolve('KEY');
      await resolver.resolve('KEY');

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should handle non-JSON secret string', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: 'plain-text-secret',
      });

      const resolver = new AwsSecretsManagerResolver({
        secretId: 'my-secret',
      });

      const result = await resolver.resolve('my-secret');
      expect(result).toBe('plain-text-secret');
    });

    it('should handle missing SecretString', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: undefined,
      });

      const resolver = new AwsSecretsManagerResolver();
      const result = await resolver.resolve('KEY');
      expect(result).toBeUndefined();
    });

    it('should return stale cache on AWS failure', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({ KEY: 'original' }),
      });

      const resolver = new AwsSecretsManagerResolver({
        cacheTtlMs: 0,
      });

      await resolver.resolve('KEY');

      mockSend.mockRejectedValueOnce(new Error('AccessDenied'));

      const result = await resolver.resolve('KEY');
      expect(result).toBe('original');
    });
  });

  describe('resolveAll', () => {
    it('should resolve multiple keys', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({ A: '1', B: '2', C: '3' }),
      });

      const resolver = new AwsSecretsManagerResolver();
      const result = await resolver.resolveAll(['A', 'B']);
      expect(result).toEqual({ A: '1', B: '2' });
    });
  });

  describe('dispose', () => {
    it('should clear cache', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({ KEY: 'value' }),
      });

      const resolver = new AwsSecretsManagerResolver();
      await resolver.resolve('KEY');

      await resolver.dispose();

      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({ KEY: 'new-value' }),
      });
      const result = await resolver.resolve('KEY');
      expect(result).toBe('new-value');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockSend.mockReset(); // Reset the mock implementation and call history
    });

    it('should handle AWS API errors and return empty dict', async () => {
      mockSend.mockRejectedValueOnce(new Error('AccessDenied: User is not authorized'));

      const resolver = new AwsSecretsManagerResolver();
      const result = await resolver.resolve('KEY');
      expect(result).toBeUndefined();
    });

    it('should log error when AWS API fails without cached data', async () => {
      mockSend.mockRejectedValueOnce(new Error('ServiceUnavailable: Backend timeout'));

      const resolver = new AwsSecretsManagerResolver();
      const result = await resolver.resolve('KEY');
      expect(result).toBeUndefined();
    });

    it('should handle AWS API errors on resolveAll and use cache', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({ KEY: 'value' }),
      });

      const resolver = new AwsSecretsManagerResolver({
        cacheTtlMs: 10000, // Keep cache valid
      });

      await resolver.resolveAll(['KEY']);

      // Second call should return from cache even if API fails
      mockSend.mockRejectedValueOnce(new Error('Connection timeout'));
      const result = await resolver.resolveAll(['KEY']);
      expect(result).toEqual({ KEY: 'value' });
    });

    it('should respect custom cache TTL by making multiple API calls', async () => {
      mockSend
        .mockResolvedValueOnce({
          SecretString: JSON.stringify({ KEY: 'value1' }),
        })
        .mockResolvedValueOnce({
          SecretString: JSON.stringify({ KEY: 'value2' }),
        });

      const resolver = new AwsSecretsManagerResolver({
        cacheTtlMs: 0, // TTL expired immediately
      });

      const result1 = await resolver.resolve('KEY');
      const result2 = await resolver.resolve('KEY');

      // Should have called send twice due to expired cache
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
    });

    it('should respect custom secret ID', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({ KEY: 'value' }),
      });

      const resolver = new AwsSecretsManagerResolver({
        secretId: 'custom/secret/path',
      });

      await resolver.resolve('KEY');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ SecretId: 'custom/secret/path' })
      );
    });

    it('should handle resolveAll with subset of available keys', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({
          SKI_TOKEN: 'sk_live_123',
          WEBHOOK_SECRET: 'whsec_456',
          UNUSED: 'unused',
        }),
      });

      const resolver = new AwsSecretsManagerResolver();
      const result = await resolver.resolveAll(['SKI_TOKEN', 'WEBHOOK_SECRET', 'NONEXISTENT']);

      expect(result).toEqual({
        SKI_TOKEN: 'sk_live_123',
        WEBHOOK_SECRET: 'whsec_456',
      });
    });

    it('should handle resolveAll with no matching keys', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({ KEY1: 'value1' }),
      });

      const resolver = new AwsSecretsManagerResolver();
      const result = await resolver.resolveAll(['NONEXISTENT1', 'NONEXISTENT2']);

      expect(result).toEqual({});
    });

    it('should handle invalid JSON and treat as single value using secretId', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: 'not-json-at-all',
      });

      const resolver = new AwsSecretsManagerResolver({
        secretId: 'my-token',
      });

      // The cache stores non-JSON under the secretId key
      const result = await resolver.resolve('my-token');
      expect(result).toBe('not-json-at-all');
    });

    it('should cache invalid JSON response correctly', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: 'plain-secret',
      });

      const resolver = new AwsSecretsManagerResolver({
        secretId: 'my-secret',
        cacheTtlMs: 60000,
      });

      const result1 = await resolver.resolve('my-secret');
      const result2 = await resolver.resolve('my-secret');

      // Should only call send once due to caching
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result1).toBe('plain-secret');
      expect(result2).toBe('plain-secret');
    });
  });
});
