/**
 * AWS Secrets Manager Secret Resolver
 *
 * Reads secrets from AWS Secrets Manager.
 * Lazy-imports @aws-sdk/client-secrets-manager — optional peer dependency.
 * Uses AWS default credential chain (IAM roles, env vars, instance profiles).
 * Implements TTL-based caching to reduce API calls.
 *
 * Required peer dep: @aws-sdk/client-secrets-manager >= 3.0.0
 * Install: pnpm add @aws-sdk/client-secrets-manager
 */

import type { SecretResolver } from './types.js';
import { MatimoError, ErrorCode } from '../../errors/matimo-error.js';
import { getGlobalMatimoLogger } from '../../logging/index.js';

/** Default cache TTL: 5 minutes */
const DEFAULT_CACHE_TTL_MS = 300_000;
/** Default secret ID in AWS Secrets Manager */
const DEFAULT_SECRET_ID = 'matimo/credentials';

export interface AwsResolverOptions {
  region?: string;
  secretId?: string;
  cacheTtlMs?: number;
}

export class AwsSecretsManagerResolver implements SecretResolver {
  readonly name = 'aws-sm';

  private client: unknown = null;
  private readonly region: string;
  private readonly secretId: string;
  private readonly cacheTtlMs: number;

  private cache: Record<string, string> | null = null;
  private cacheTimestamp = 0;

  constructor(options: AwsResolverOptions = {}) {
    this.region = options.region ?? process.env.AWS_REGION ?? 'us-east-1';
    this.secretId = options.secretId ?? DEFAULT_SECRET_ID;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  /**
   * Lazy-import AWS SDK and create client.
   * Throws a clear error if the package is not installed.
   */
  private async getClient(): Promise<{
    send: (command: unknown) => Promise<{ SecretString?: string }>;
  }> {
    if (this.client) {
      return this.client as {
        send: (command: unknown) => Promise<{ SecretString?: string }>;
      };
    }

    try {
      // @ts-ignore — optional peer dependency, may not be installed
      const awsModule = await import('@aws-sdk/client-secrets-manager');
      const { SecretsManagerClient } = awsModule;

      this.client = new SecretsManagerClient({ region: this.region });
      return this.client as {
        send: (command: unknown) => Promise<{ SecretString?: string }>;
      };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('Cannot find module') ||
          error.message.includes('MODULE_NOT_FOUND') ||
          error.message.includes('ERR_MODULE_NOT_FOUND'))
      ) {
        throw new MatimoError(
          '@aws-sdk/client-secrets-manager package is required for AWS Secrets Manager resolution. Install: pnpm add @aws-sdk/client-secrets-manager',
          ErrorCode.AUTH_FAILED,
          { resolver: this.name }
        );
      }
      throw error;
    }
  }

  /**
   * Fetch all secrets from AWS Secrets Manager and cache them.
   * Expects the secret value to be a JSON string of key-value pairs.
   */
  private async fetchSecrets(): Promise<Record<string, string>> {
    const now = Date.now();

    // Return cache if still valid
    if (this.cache && now - this.cacheTimestamp < this.cacheTtlMs) {
      return this.cache;
    }

    const logger = getGlobalMatimoLogger();
    logger.debug('Fetching secrets from AWS Secrets Manager', {
      resolver: this.name,
      secretId: this.secretId,
      region: this.region,
    });

    try {
      const client = await this.getClient();

      // Dynamic import for the command class
      // @ts-ignore — optional peer dependency, may not be installed
      const awsModule = await import('@aws-sdk/client-secrets-manager');
      const { GetSecretValueCommand } = awsModule;

      const response = await client.send(new GetSecretValueCommand({ SecretId: this.secretId }));

      if (!response.SecretString) {
        logger.warn('AWS secret has no SecretString (binary secrets not supported)', {
          resolver: this.name,
          secretId: this.secretId,
        });
        this.cache = {};
        this.cacheTimestamp = now;
        return this.cache;
      }

      // Parse JSON key-value pairs
      try {
        this.cache = JSON.parse(response.SecretString) as Record<string, string>;
      } catch {
        logger.warn('AWS secret is not valid JSON — treating as single value', {
          resolver: this.name,
          secretId: this.secretId,
        });
        // If not JSON, store under the secretId as a single key
        this.cache = { [this.secretId]: response.SecretString };
      }

      this.cacheTimestamp = now;

      logger.debug('AWS Secrets Manager secrets loaded', {
        resolver: this.name,
        keyCount: Object.keys(this.cache).length,
      });

      return this.cache;
    } catch (error) {
      // If it's our own MatimoError (missing package), re-throw
      if (error instanceof MatimoError) {
        throw error;
      }

      logger.warn('AWS Secrets Manager resolver unreachable — falling back to next resolver', {
        resolver: this.name,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return stale cache if available, otherwise empty
      if (this.cache) {
        logger.warn('Using stale AWS Secrets Manager cache', { resolver: this.name });
        return this.cache;
      }

      return {};
    }
  }

  async resolve(key: string): Promise<string | undefined> {
    const secrets = await this.fetchSecrets();
    return secrets[key];
  }

  async resolveAll(keys: string[]): Promise<Record<string, string>> {
    const secrets = await this.fetchSecrets();
    const result: Record<string, string> = {};
    for (const key of keys) {
      if (key in secrets) {
        result[key] = secrets[key];
      }
    }
    return result;
  }

  async dispose(): Promise<void> {
    this.cache = null;
    this.cacheTimestamp = 0;
    this.client = null;
  }
}
