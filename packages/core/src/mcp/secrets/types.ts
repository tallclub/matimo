/**
 * Secret Resolver Types for Matimo MCP Server
 *
 * Defines the interface that all secret resolvers implement.
 * Env vars are the default; enterprise teams can plug in Vault, AWS SM, etc.
 */

/**
 * Interface for resolving secrets from any backend.
 *
 * Implementations should be stateless per-call (caching is allowed internally).
 * resolve() returns undefined for missing keys — the chain tries the next resolver.
 */
export interface SecretResolver {
  /** Human-readable name for logging (e.g., 'env', 'vault', 'aws-sm') */
  readonly name: string;

  /**
   * Resolve a single secret by key.
   * @returns The secret value, or undefined if not found in this resolver.
   */
  resolve(key: string): Promise<string | undefined>;

  /**
   * Resolve multiple secrets at once.
   * Default implementation calls resolve() for each key.
   * Backends with batch APIs should override for efficiency.
   */
  resolveAll(keys: string[]): Promise<Record<string, string>>;

  /**
   * Optional cleanup (close connections, flush caches).
   * Called when the MCP server shuts down.
   */
  dispose?(): Promise<void>;
}

// ─── Resolver config discriminated union ───────────────────────────────

export interface EnvResolverConfig {
  type: 'env';
}

export interface DotenvResolverConfig {
  type: 'dotenv';
  /** Path to .env file. Defaults to `process.cwd()/.env` */
  path?: string;
}

export interface VaultResolverConfig {
  type: 'vault';
  /** Vault server URL. Falls back to VAULT_ADDR env var. */
  addr?: string;
  /** Vault authentication token. Falls back to VAULT_TOKEN env var. */
  token?: string;
  /** KV v2 secret path. Default: 'secret/data/matimo' */
  secretPath?: string;
  /** Vault namespace (enterprise). Falls back to VAULT_NAMESPACE env var. */
  namespace?: string;
  /** TTL for cached secrets in ms. Default: 300_000 (5 min) */
  cacheTtlMs?: number;
}

export interface AwsSecretsManagerResolverConfig {
  type: 'aws';
  /** AWS region. Falls back to AWS_REGION env var. Default: 'us-east-1' */
  region?: string;
  /** Secrets Manager secret ID. Default: 'matimo/credentials' */
  secretId?: string;
  /** TTL for cached secrets in ms. Default: 300_000 (5 min) */
  cacheTtlMs?: number;
}

/** Union of all resolver configs */
export type SecretResolverConfig =
  | EnvResolverConfig
  | DotenvResolverConfig
  | VaultResolverConfig
  | AwsSecretsManagerResolverConfig;

/**
 * Configuration for the resolver chain.
 * Resolvers are tried in order; first non-undefined value wins per key.
 */
export interface SecretResolverChainConfig {
  /** Ordered list of resolvers to try. Default: [{ type: 'env' }] */
  resolvers: SecretResolverConfig[];
}
