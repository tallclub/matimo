import {
  SecretResolverChain,
  createResolverChain,
} from '../../../../src/mcp/secrets/resolver-chain';
import { EnvSecretResolver } from '../../../../src/mcp/secrets/env-resolver';
import type { SecretResolver } from '../../../../src/mcp/secrets/types';

// Virtual mocks for optional peer dependencies (imported transitively by resolver-chain)
jest.mock('node-vault', () => jest.fn(() => ({ read: jest.fn() })), { virtual: true });
jest.mock(
  '@aws-sdk/client-secrets-manager',
  () => ({
    SecretsManagerClient: jest.fn(() => ({ send: jest.fn() })),
    GetSecretValueCommand: jest.fn(),
  }),
  { virtual: true }
);

describe('SecretResolverChain', () => {
  describe('resolve', () => {
    it('should return first non-undefined value', async () => {
      const resolver1: SecretResolver = {
        name: 'first',
        resolve: jest.fn().mockResolvedValue(undefined),
        resolveAll: jest.fn().mockResolvedValue({}),
      };
      const resolver2: SecretResolver = {
        name: 'second',
        resolve: jest.fn().mockResolvedValue('found-value'),
        resolveAll: jest.fn().mockResolvedValue({}),
      };

      const chain = new SecretResolverChain([resolver1, resolver2]);
      const result = await chain.resolve('KEY');

      expect(result).toBe('found-value');
      expect(resolver1.resolve).toHaveBeenCalledWith('KEY');
      expect(resolver2.resolve).toHaveBeenCalledWith('KEY');
    });

    it('should stop at first resolver that has the key', async () => {
      const resolver1: SecretResolver = {
        name: 'first',
        resolve: jest.fn().mockResolvedValue('first-value'),
        resolveAll: jest.fn().mockResolvedValue({}),
      };
      const resolver2: SecretResolver = {
        name: 'second',
        resolve: jest.fn().mockResolvedValue('second-value'),
        resolveAll: jest.fn().mockResolvedValue({}),
      };

      const chain = new SecretResolverChain([resolver1, resolver2]);
      const result = await chain.resolve('KEY');

      expect(result).toBe('first-value');
      expect(resolver2.resolve).not.toHaveBeenCalled();
    });

    it('should return undefined if no resolver has the key', async () => {
      const resolver: SecretResolver = {
        name: 'empty',
        resolve: jest.fn().mockResolvedValue(undefined),
        resolveAll: jest.fn().mockResolvedValue({}),
      };

      const chain = new SecretResolverChain([resolver]);
      const result = await chain.resolve('MISSING');

      expect(result).toBeUndefined();
    });

    it('should skip failed resolvers and continue', async () => {
      const resolver1: SecretResolver = {
        name: 'failing',
        resolve: jest.fn().mockRejectedValue(new Error('Connection refused')),
        resolveAll: jest.fn().mockResolvedValue({}),
      };
      const resolver2: SecretResolver = {
        name: 'working',
        resolve: jest.fn().mockResolvedValue('fallback-value'),
        resolveAll: jest.fn().mockResolvedValue({}),
      };

      const chain = new SecretResolverChain([resolver1, resolver2]);
      const result = await chain.resolve('KEY');

      expect(result).toBe('fallback-value');
    });

    it('should handle empty resolver array', async () => {
      const chain = new SecretResolverChain([]);
      const result = await chain.resolve('KEY');
      expect(result).toBeUndefined();
    });
  });

  describe('resolveAll', () => {
    it('should merge results from multiple resolvers', async () => {
      const resolver1: SecretResolver = {
        name: 'first',
        resolve: jest.fn(),
        resolveAll: jest.fn().mockResolvedValue({ A: '1' }),
      };
      const resolver2: SecretResolver = {
        name: 'second',
        resolve: jest.fn(),
        resolveAll: jest.fn().mockResolvedValue({ A: '2', B: '2' }),
      };

      const chain = new SecretResolverChain([resolver1, resolver2]);
      const result = await chain.resolveAll(['A', 'B']);

      // First resolver wins for key A
      expect(result).toEqual({ A: '1', B: '2' });
    });

    it('should skip failed resolvers in resolveAll', async () => {
      const resolver1: SecretResolver = {
        name: 'failing',
        resolve: jest.fn(),
        resolveAll: jest.fn().mockRejectedValue(new Error('fail')),
      };
      const resolver2: SecretResolver = {
        name: 'working',
        resolve: jest.fn(),
        resolveAll: jest.fn().mockResolvedValue({ KEY: 'value' }),
      };

      const chain = new SecretResolverChain([resolver1, resolver2]);
      const result = await chain.resolveAll(['KEY']);
      expect(result).toEqual({ KEY: 'value' });
    });
  });

  describe('dispose', () => {
    it('should call dispose on all resolvers that have it', async () => {
      const disposeFn = jest.fn().mockResolvedValue(undefined);
      const resolver1: SecretResolver = {
        name: 'disposable',
        resolve: jest.fn(),
        resolveAll: jest.fn(),
        dispose: disposeFn,
      };
      const resolver2: SecretResolver = {
        name: 'no-dispose',
        resolve: jest.fn(),
        resolveAll: jest.fn(),
      };

      const chain = new SecretResolverChain([resolver1, resolver2]);
      await chain.dispose();

      expect(disposeFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('getResolvers', () => {
    it('should return the resolver list', () => {
      const r1 = new EnvSecretResolver();
      const chain = new SecretResolverChain([r1]);
      expect(chain.getResolvers()).toEqual([r1]);
    });
  });
});

describe('createResolverChain', () => {
  it('should default to env-only when no config provided', () => {
    const chain = createResolverChain();
    const resolvers = chain.getResolvers();
    expect(resolvers).toHaveLength(1);
    expect(resolvers[0].name).toBe('env');
  });

  it('should default to env-only when config has empty resolvers', () => {
    const chain = createResolverChain({ resolvers: [] });
    const resolvers = chain.getResolvers();
    expect(resolvers).toHaveLength(1);
    expect(resolvers[0].name).toBe('env');
  });

  it('should create resolvers from config', () => {
    const chain = createResolverChain({
      resolvers: [{ type: 'env' }, { type: 'dotenv' }],
    });
    const resolvers = chain.getResolvers();
    expect(resolvers).toHaveLength(2);
    expect(resolvers[0].name).toBe('env');
    expect(resolvers[1].name).toBe('dotenv');
  });

  it('should create a vault resolver from config', () => {
    const chain = createResolverChain({
      resolvers: [{ type: 'vault', secretPath: 'secret/data/test', token: 'tok' }],
    });
    expect(chain.getResolvers()[0].name).toBe('vault');
  });

  it('should create an aws resolver from config', () => {
    const chain = createResolverChain({
      resolvers: [{ type: 'aws', secretId: 'my-secret', region: 'us-east-1' }],
    });
    expect(chain.getResolvers()[0].name).toBe('aws-sm');
  });

  it('should throw for unknown resolver type', () => {
    expect(() => createResolverChain({ resolvers: [{ type: 'unknown' as never }] })).toThrow(
      'Unknown secret resolver type'
    );
  });
});

describe('SecretResolverChain.seedProcessEnv', () => {
  const SEED_KEY = '__MATIMO_TEST_SEED_KEY__';
  const EXISTING_KEY = '__MATIMO_TEST_EXISTING_KEY__';

  afterEach(() => {
    delete process.env[SEED_KEY];
    delete process.env[EXISTING_KEY];
  });

  it('should seed process.env from a resolver that has getAllEntries', async () => {
    const mockDotenvResolver = {
      name: 'dotenv',
      resolve: jest.fn().mockResolvedValue(undefined),
      resolveAll: jest.fn().mockResolvedValue({}),
      getAllEntries: jest.fn().mockReturnValue({ [SEED_KEY]: 'seeded-value' }),
    };

    const chain = new SecretResolverChain([
      mockDotenvResolver as unknown as import('../../../../src/mcp/secrets/types').SecretResolver,
    ]);
    await chain.seedProcessEnv();

    expect(process.env[SEED_KEY]).toBe('seeded-value');
  });

  it('should not overwrite keys already present in process.env', async () => {
    process.env[EXISTING_KEY] = 'original';

    const mockDotenvResolver = {
      name: 'dotenv',
      resolve: jest.fn().mockResolvedValue(undefined),
      resolveAll: jest.fn().mockResolvedValue({}),
      getAllEntries: jest.fn().mockReturnValue({ [EXISTING_KEY]: 'should-not-overwrite' }),
    };

    const chain = new SecretResolverChain([
      mockDotenvResolver as unknown as import('../../../../src/mcp/secrets/types').SecretResolver,
    ]);
    await chain.seedProcessEnv();

    expect(process.env[EXISTING_KEY]).toBe('original');
  });

  it('should skip resolvers that do not have getAllEntries', async () => {
    const envResolver: import('../../../../src/mcp/secrets/types').SecretResolver = {
      name: 'env',
      resolve: jest.fn().mockResolvedValue(undefined),
      resolveAll: jest.fn().mockResolvedValue({}),
    };

    const chain = new SecretResolverChain([envResolver]);
    // Should not throw, no env vars seeded
    await expect(chain.seedProcessEnv()).resolves.toBeUndefined();
    expect(process.env[SEED_KEY]).toBeUndefined();
  });

  it('should be a no-op for an empty chain', async () => {
    const chain = new SecretResolverChain([]);
    await expect(chain.seedProcessEnv()).resolves.toBeUndefined();
  });

  it('should seed from multiple dotenv resolvers', async () => {
    const KEY_A = '__MATIMO_TEST_SEED_A__';
    const KEY_B = '__MATIMO_TEST_SEED_B__';

    const resolver1 = {
      name: 'dotenv',
      resolve: jest.fn(),
      resolveAll: jest.fn(),
      getAllEntries: jest.fn().mockReturnValue({ [KEY_A]: 'value-a' }),
    };
    const resolver2 = {
      name: 'dotenv',
      resolve: jest.fn(),
      resolveAll: jest.fn(),
      getAllEntries: jest.fn().mockReturnValue({ [KEY_B]: 'value-b' }),
    };

    const chain = new SecretResolverChain([
      resolver1 as unknown as import('../../../../src/mcp/secrets/types').SecretResolver,
      resolver2 as unknown as import('../../../../src/mcp/secrets/types').SecretResolver,
    ]);
    await chain.seedProcessEnv();

    expect(process.env[KEY_A]).toBe('value-a');
    expect(process.env[KEY_B]).toBe('value-b');

    delete process.env[KEY_A];
    delete process.env[KEY_B];
  });
});
