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
} from './types';

// Implementations
export { EnvSecretResolver } from './env-resolver';
export { DotenvSecretResolver } from './dotenv-resolver';
export { VaultSecretResolver } from './vault-resolver';
export type { VaultResolverOptions } from './vault-resolver';
export { AwsSecretsManagerResolver } from './aws-resolver';
export type { AwsResolverOptions } from './aws-resolver';

// Chain
export { SecretResolverChain, createResolverChain } from './resolver-chain';
