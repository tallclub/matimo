/**
 * OAuth2 Configuration Types - PROVIDER-AGNOSTIC + YAML-DRIVEN
 *
 * Matimo supports OAuth2 for any provider via YAML configuration.
 * Provider definitions are loaded from tools/[provider]/definition.yaml files.
 *
 * Matimo's Responsibility:
 * - Help obtain tokens via standard OAuth2 flow
 * - Support automatic token refresh
 * - Work with Google, GitHub, Slack, or any OAuth2 provider
 * - Load provider configs from YAML (no hardcoded endpoints)
 *
 * User's Responsibility:
 * - Store tokens (DB, file, cache, wherever you want)
 * - Retrieve and pass tokens to Matimo tools
 *
 * Adding a New Provider (e.g., Microsoft Teams):
 * 1. Create: tools/microsoft/definition.yaml
 * 2. Add provider section with OAuth endpoints
 * 3. Done! OAuth2Handler automatically recognizes it.
 *
 * Configuration Priority (highest to lowest):
 * 1. config.endpoints - Runtime override (user provides directly)
 * 2. OAUTH_PROVIDER_AUTH_URL env var - Deployment override
 * 3. YAML definition (tools/[provider]/definition.yaml) - Default from config
 */

/**
 * Supported OAuth2 providers
 *
 * Type is string (not enum) because providers are discovered from YAML.
 * Tools define which provider they use via authentication.provider field.
 */
export type OAuth2Provider = string;

/**
 * OAuth2 token - Returned by OAuth2Handler
 *
 * This is what you get after successful authorization.
 * Store this in your DB/file/cache (Matimo doesn't store it).
 * Pass accessToken to any Matimo tool that needs OAuth.
 */
export interface OAuth2Token {
  accessToken: string; // Use this: await matimo.execute(tool, { OAUTH_TOKEN: accessToken })
  refreshToken?: string; // Optional: for refresh flow
  expiresAt: number; // Unix timestamp in milliseconds
  scopes: string[]; // What this token can access
  provider: OAuth2Provider; // Which provider issued it
  userId: string; // Associated user ID
}

/**
 * OAuth2 configuration - PROVIDER-AGNOSTIC + YAML-DRIVEN
 *
 * Same interface works for Google, GitHub, Slack, or any OAuth2 provider.
 * Provider endpoints come from YAML definitions (tools/[provider]/definition.yaml).
 * Users can override endpoints without touching code.
 *
 * Configuration Priority:
 * 1. endpoints property (runtime override - user provides directly)
 * 2. OAUTH_PROVIDER_AUTH_URL environment variable (deployment config)
 * 3. YAML definition from tools/[provider]/definition.yaml (default configuration)
 */
export interface OAuth2Config {
  provider: OAuth2Provider; // Provider name (e.g., 'google', 'github')
  clientId: string; // From OAuth2 provider console
  clientSecret: string; // From OAuth2 provider console
  redirectUri: string; // Callback URL after authorization
  endpoints?: OAuth2Endpoints; // Optional: override YAML or env vars (highest priority)
}

/**
 * Authorization request options
 */
export interface AuthorizationOptions {
  scopes: string[];
  userId: string;
  state?: string;
}

/**
 * Token exchange response from OAuth2 provider
 */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // Seconds
  token_type: string;
  scope?: string;
}

/**
 * OAuth2 endpoints for a provider
 */
export interface OAuth2Endpoints {
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
}

/**
 * NOTE: Provider endpoints are loaded from YAML files, not hardcoded here.
 * See: tools/[provider]/definition.yaml for provider configurations
 *
 * This enables:
 * - Infinite provider support
 * - Configuration-driven design
 * - Easy provider additions without code changes
 * - Centralized endpoint management
 */
