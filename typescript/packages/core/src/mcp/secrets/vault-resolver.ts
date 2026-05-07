/**
 * HashiCorp Vault Secret Resolver
 *
 * Reads secrets from Vault KV v2 engine.
 * Lazy-imports node-vault — optional peer dependency.
 * Implements TTL-based caching to support rotation without process restart.
 *
 * Required peer dep: node-vault >= 0.10.0
 * Install: pnpm add node-vault
 */

import type { SecretResolver } from './types.js';
import { MatimoError, ErrorCode } from '../../errors/matimo-error.js';
import { getGlobalMatimoLogger } from '../../logging/index.js';

/** Default cache TTL: 5 minutes */
const DEFAULT_CACHE_TTL_MS = 300_000;
/** Default KV v2 secret path */
const DEFAULT_SECRET_PATH = 'secret/data/matimo';

interface VaultClient {
  read(path: string): Promise<{ data: { data: Record<string, string> } }>;
}

export interface VaultResolverOptions {
  addr?: string;
  token?: string;
  secretPath?: string;
  namespace?: string;
  cacheTtlMs?: number;
}

export class VaultSecretResolver implements SecretResolver {
  readonly name = 'vault';

  private client: VaultClient | null = null;
  private readonly addr: string;
  private readonly token: string;
  private readonly secretPath: string;
  private readonly namespace?: string;
  private readonly cacheTtlMs: number;

  private cache: Record<string, string> | null = null;
  private cacheTimestamp = 0;

  constructor(options: VaultResolverOptions = {}) {
    this.addr = options.addr ?? process.env.VAULT_ADDR ?? 'http://127.0.0.1:8200';
    this.token = options.token ?? process.env.VAULT_TOKEN ?? '';
    this.secretPath = options.secretPath ?? DEFAULT_SECRET_PATH;
    this.namespace = options.namespace ?? process.env.VAULT_NAMESPACE;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  /**
   * Lazy-import node-vault and create client.
   * Throws a clear error if the package is not installed.
   */
  private async getClient(): Promise<VaultClient> {
    if (this.client) {
      return this.client;
    }

    try {
      // Dynamic import — only loaded when Vault resolver is actually used
      // @ts-ignore — optional peer dependency, may not be installed
      const vaultModule = await import('node-vault');
      const vaultFactory = vaultModule.default ?? vaultModule;

      const clientOptions: Record<string, unknown> = {
        apiVersion: 'v1',
        endpoint: this.addr,
        token: this.token,
      };

      if (this.namespace) {
        clientOptions.namespace = this.namespace;
      }

      this.client = vaultFactory(clientOptions) as VaultClient;
      return this.client;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('Cannot find module') ||
          error.message.includes('MODULE_NOT_FOUND') ||
          error.message.includes('ERR_MODULE_NOT_FOUND'))
      ) {
        throw new MatimoError(
          'node-vault package is required for Vault secret resolution. Install: pnpm add node-vault',
          ErrorCode.AUTH_FAILED,
          { resolver: this.name }
        );
      }
      throw error;
    }
  }

  /**
   * Fetch all secrets from Vault and cache them.
   */
  private async fetchSecrets(): Promise<Record<string, string>> {
    const now = Date.now();

    // Return cache if still valid
    if (this.cache && now - this.cacheTimestamp < this.cacheTtlMs) {
      return this.cache;
    }

    const logger = getGlobalMatimoLogger();
    logger.debug('Fetching secrets from Vault', {
      resolver: this.name,
      path: this.secretPath,
      addr: this.addr,
    });

    try {
      const client = await this.getClient();
      const result = await client.read(this.secretPath);

      // KV v2 returns data.data (first data is metadata wrapper)
      this.cache = result.data.data;
      this.cacheTimestamp = now;

      logger.debug('Vault secrets loaded', {
        resolver: this.name,
        keyCount: Object.keys(this.cache).length,
      });

      return this.cache;
    } catch (error) {
      // If it's our own MatimoError (missing package), re-throw
      if (error instanceof MatimoError) {
        throw error;
      }

      logger.warn('Vault resolver unreachable — falling back to next resolver', {
        resolver: this.name,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return stale cache if available, otherwise empty
      if (this.cache) {
        logger.warn('Using stale Vault cache', { resolver: this.name });
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
