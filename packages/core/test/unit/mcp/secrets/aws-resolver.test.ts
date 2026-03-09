import { AwsSecretsManagerResolver } from '../../../../src/mcp/secrets/aws-resolver';

// Mock AWS SDK
const mockSend = jest.fn();
jest.mock(
  '@aws-sdk/client-secrets-manager',
  () => {
    return {
      SecretsManagerClient: jest.fn(() => ({
        send: mockSend,
      })),
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
});
