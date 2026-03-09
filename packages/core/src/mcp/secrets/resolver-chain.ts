/**
 * Secret Resolver Chain
 *
 * Tries resolvers in order; first non-undefined value wins per key.
 * Includes a factory function to instantiate resolvers from config objects.
 */

import type { SecretResolver, SecretResolverConfig, SecretResolverChainConfig } from './types';
import { EnvSecretResolver } from './env-resolver';
import { DotenvSecretResolver } from './dotenv-resolver';
import { VaultSecretResolver } from './vault-resolver';
import { AwsSecretsManagerResolver } from './aws-resolver';
import { getGlobalMatimoLogger } from '../../logging';

/**
 * Create a SecretResolver instance from a config object.
 */
function createResolver(config: SecretResolverConfig): SecretResolver {
  switch (config.type) {
    case 'env':
      return new EnvSecretResolver();
    case 'dotenv':
      return new DotenvSecretResolver(config.path);
    case 'vault':
      return new VaultSecretResolver({
        addr: config.addr,
        token: config.token,
        secretPath: config.secretPath,
        namespace: config.namespace,
        cacheTtlMs: config.cacheTtlMs,
      });
    case 'aws':
      return new AwsSecretsManagerResolver({
        region: config.region,
        secretId: config.secretId,
        cacheTtlMs: config.cacheTtlMs,
      });
    default:
      throw new Error(`Unknown secret resolver type: ${(config as Record<string, unknown>).type}`);
  }
}

/**
 * Chain of secret resolvers.
 * Tries each resolver in order; first non-undefined value wins.
 */
export class SecretResolverChain implements SecretResolver {
  readonly name = 'chain';
  private readonly resolvers: SecretResolver[];

  constructor(resolvers: SecretResolver[]) {
    this.resolvers = resolvers;
  }

  async resolve(key: string): Promise<string | undefined> {
    for (const resolver of this.resolvers) {
      try {
        const value = await resolver.resolve(key);
        if (value !== undefined) {
          return value;
        }
      } catch (error) {
        const logger = getGlobalMatimoLogger();
        logger.warn(`Secret resolver '${resolver.name}' failed for key '${key}'`, {
          resolver: resolver.name,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue to next resolver
      }
    }
    return undefined;
  }

  async resolveAll(keys: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const remaining = new Set(keys);

    for (const resolver of this.resolvers) {
      if (remaining.size === 0) break;

      try {
        const resolved = await resolver.resolveAll([...remaining]);
        for (const [key, value] of Object.entries(resolved)) {
          if (!(key in result)) {
            result[key] = value;
            remaining.delete(key);
          }
        }
      } catch (error) {
        const logger = getGlobalMatimoLogger();
        logger.warn(`Secret resolver '${resolver.name}' failed for resolveAll`, {
          resolver: resolver.name,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue to next resolver
      }
    }

    return result;
  }

  async dispose(): Promise<void> {
    for (const resolver of this.resolvers) {
      if (resolver.dispose) {
        await resolver.dispose();
      }
    }
  }

  /** Get the list of resolvers in the chain (for testing/debugging) */
  getResolvers(): ReadonlyArray<SecretResolver> {
    return this.resolvers;
  }

  /**
   * Eagerly load all .env entries into process.env.
   * Only seeds keys that are not already set in process.env.
   * This ensures server config like MATIMO_MCP_TOKEN is available
   * before tool registration and HTTP token checks.
   */
  async seedProcessEnv(): Promise<void> {
    const logger = getGlobalMatimoLogger();
    let seeded = 0;

    for (const resolver of this.resolvers) {
      // Only dotenv resolvers have getAllEntries()
      type WithGetAllEntries = { getAllEntries: () => Record<string, string> };
      if (
        'getAllEntries' in resolver &&
        typeof (resolver as WithGetAllEntries).getAllEntries === 'function'
      ) {
        const entries = (resolver as WithGetAllEntries).getAllEntries();
        for (const [key, value] of Object.entries(entries)) {
          if (!process.env[key]) {
            process.env[key] = value;
            seeded++;
          }
        }
      }
    }

    if (seeded > 0) {
      logger.info(`Seeded ${seeded} env vars from .env file`);
    }
  }
}

/**
 * Create a SecretResolverChain from a config object.
 * If no config is provided, defaults to env-only resolution.
 */
export function createResolverChain(config?: SecretResolverChainConfig): SecretResolverChain {
  if (!config || config.resolvers.length === 0) {
    return new SecretResolverChain([new EnvSecretResolver()]);
  }

  const resolvers = config.resolvers.map(createResolver);
  return new SecretResolverChain(resolvers);
}
