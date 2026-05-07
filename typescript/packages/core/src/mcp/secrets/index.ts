/**
 * Secret Resolvers — public API
 *
 * Re-exports all resolver types, implementations, and the chain factory.
 */

// Types
export type {
  SecretResolver,
  SecretResolverConfig,
  SecretResolverChainConfig,
  EnvResolverConfig,
  DotenvResolverConfig,
  VaultResolverConfig,
  AwsSecretsManagerResolverConfig,
} from './types.js';

// Implementations
export { EnvSecretResolver } from './env-resolver.js';
export { DotenvSecretResolver } from './dotenv-resolver.js';
export { VaultSecretResolver } from './vault-resolver.js';
export type { VaultResolverOptions } from './vault-resolver.js';
export { AwsSecretsManagerResolver } from './aws-resolver.js';
export type { AwsResolverOptions } from './aws-resolver.js';

// Chain
export { SecretResolverChain, createResolverChain } from './resolver-chain.js';
