/**
 * Matimo MCP Server — public API
 *
 * Usage:
 *   import { MCPServer, createMCPServer } from '@matimo/core/mcp';
 *
 *   // One-liner
 *   const server = await createMCPServer({ transport: 'stdio' });
 *
 *   // Or with full control
 *   const server = new MCPServer({ transport: 'http', port: 3000 });
 *   await server.start();
 */

// MCP Server
export { MCPServer, createMCPServer } from './mcp-server';
export type { MCPServerOptions } from './mcp-server';

// Tool converter
export {
  convertParametersToMcpSchema,
  toolToMcpRegistration,
  extractAuthPlaceholders,
} from './tool-converter';

// Secret resolvers
export {
  // Types
  type SecretResolver,
  type SecretResolverConfig,
  type SecretResolverChainConfig,
  type EnvResolverConfig,
  type DotenvResolverConfig,
  type VaultResolverConfig,
  type AwsSecretsManagerResolverConfig,
  // Implementations
  EnvSecretResolver,
  DotenvSecretResolver,
  VaultSecretResolver,
  type VaultResolverOptions,
  AwsSecretsManagerResolver,
  type AwsResolverOptions,
  // Chain
  SecretResolverChain,
  createResolverChain,
} from './secrets/index';
