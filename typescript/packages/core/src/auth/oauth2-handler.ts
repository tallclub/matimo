/**
 * OAuth2 Handler
 * Manages OAuth2 authentication flows and token exchange
 */

import axios from 'axios';
import {
  OAuth2Config,
  OAuth2Token,
  OAuth2Endpoints,
  TokenResponse,
  AuthorizationOptions,
} from './oauth2-config';
import { OAuth2ProviderLoader } from './oauth2-provider-loader';
import { MatimoError, ErrorCode } from '../errors/matimo-error';

/**
 * OAuth2Handler - Provider-Agnostic OAuth2 Flow Manager
 *
 * Matimo's OAuth2 Scope:
 * ✅ Help complete OAuth2 authorization with any provider
 * ✅ Exchange authorization codes for tokens
 * ✅ Support automatic token refresh if needed
 * ✅ Work with Google, GitHub, Slack, or any OAuth2 provider
 * ❌ Store tokens (User's responsibility)
 * ❌ Manage token lifecycle (User's responsibility)
 *
 * Pattern: Config → Get Auth URL → Exchange Code → Return Token → User Stores It
 *
 * Usage:
 * ```typescript
 * // 1. Create handler (works for any OAuth2 provider)
 * const oauth2 = new OAuth2Handler({
 *   provider: 'google', // or 'github', 'slack', etc.
 *   clientId: process.env.CLIENT_ID,
 *   clientSecret: process.env.CLIENT_SECRET,
 *   redirectUri: 'http://localhost:3000/callback',
 * });
 *
 * // 2. Generate authorization URL
 * const authUrl = oauth2.getAuthorizationUrl({
 *   userId: 'user-123',
 *   scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
 * });
 * // Send user to authUrl
 *
 * // 3. Exchange authorization code for token
 * const token = await oauth2.exchangeCodeForToken('user-123', authCode);
 * // Token: { accessToken, refreshToken, expiresAt, ... }
 *
 * // 4. User stores token (in DB, file, cache, or wherever they choose)
 * // Matimo does NOT store tokens - that's the user's responsibility
 * await myDatabase.saveToken('user-123', token);
 *
 * // 5. User retrieves token from their storage and passes to tools
 * const stored = await myDatabase.getToken('user-123');
 * await matimo.execute('gmail-send-email', {
 *   to: 'user@example.com',
 *   GMAIL_ACCESS_TOKEN: stored.accessToken, // ← User provides token
 * });
 * ```
 */
export class OAuth2Handler {
  private config: OAuth2Config;
  private tokenRefreshBuffer: number; // Milliseconds before expiration to refresh
  private endpoints: OAuth2Endpoints; // Resolved endpoints (after applying priority logic)
  private providerLoader: OAuth2ProviderLoader;

  /**
   * Constructor
   * @param config - OAuth2 configuration (provider, clientId, clientSecret, redirectUri)
   * @param providerLoader - Optional provider loader (loads from YAML files)
   */
  constructor(config: OAuth2Config, providerLoader?: OAuth2ProviderLoader) {
    if (!config.clientId || !config.clientSecret) {
      throw new MatimoError(
        'OAuth2 clientId and clientSecret are required',
        ErrorCode.AUTH_FAILED,
        { provider: config.provider }
      );
    }

    this.config = config;
    this.tokenRefreshBuffer = 5 * 60 * 1000; // Refresh 5 minutes before expiration
    this.providerLoader = providerLoader || new OAuth2ProviderLoader('tools');

    // Resolve endpoints with priority:
    // 1. Runtime config (highest priority - user provides endpoints directly)
    // 2. Environment variables (deployment config)
    // 3. YAML definition (provider loader - configuration-driven)
    this.endpoints = this.resolveEndpoints(config);
  }

  /**
   * Resolve OAuth2 endpoints with layered configuration
   *
   * Priority (highest to lowest):
   * 1. config.endpoints - user provided at runtime
   * 2. Environment variables: OAUTH_{PROVIDER}_AUTH_URL, OAUTH_{PROVIDER}_TOKEN_URL, etc.
   * 3. YAML definition from provider loader (tools/[provider]/definition.yaml)
   *
   * This design allows:
   * - Runtime override via config
   * - Deployment-time override via env vars
   * - Default configuration from YAML files
   * - Support for infinite providers without code changes
   */
  private resolveEndpoints(config: OAuth2Config): OAuth2Endpoints {
    // Priority 1: Runtime config (user provides endpoints directly)
    if (config.endpoints) {
      return config.endpoints;
    }

    // Priority 2: Environment variables
    const envAuthUrl = process.env[`OAUTH_${config.provider.toUpperCase()}_AUTH_URL`];
    const envTokenUrl = process.env[`OAUTH_${config.provider.toUpperCase()}_TOKEN_URL`];

    if (envAuthUrl || envTokenUrl) {
      if (!envAuthUrl || !envTokenUrl) {
        throw new MatimoError(
          `Incomplete OAuth environment config for ${config.provider}. Both OAUTH_${config.provider.toUpperCase()}_AUTH_URL and OAUTH_${config.provider.toUpperCase()}_TOKEN_URL must be set.`,
          ErrorCode.AUTH_FAILED,
          { provider: config.provider }
        );
      }

      return {
        authorizationUrl: envAuthUrl,
        tokenUrl: envTokenUrl,
        revokeUrl: process.env[`OAUTH_${config.provider.toUpperCase()}_REVOKE_URL`],
      };
    }

    // Priority 3: YAML definition from provider loader
    const yamlEndpoints = this.providerLoader.getProvider(config.provider);
    if (yamlEndpoints) {
      return yamlEndpoints;
    }

    // No endpoints found
    throw new MatimoError(
      `Unsupported OAuth2 provider: ${config.provider}. Provide endpoints via:
      1. config.endpoints (runtime override)
      2. OAUTH_${config.provider.toUpperCase()}_AUTH_URL env var (deployment config)
      3. tools/${config.provider}/definition.yaml (YAML configuration)`,
      ErrorCode.AUTH_FAILED,
      { provider: config.provider }
    );
  }

  /**
   * Get resolved endpoints (for testing or debugging)
   */
  getEndpoints(): OAuth2Endpoints {
    return this.endpoints;
  }

  /**
   * Generate authorization URL for user to visit
   * @param options - Authorization options (scopes, userId, optional state)
   * @returns Authorization URL
   */
  getAuthorizationUrl(options: AuthorizationOptions): string {
    const state = options.state || this.generateRandomState();

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: options.scopes.join(' '),
      state,
      // Provider-specific parameters
      ...(this.config.provider === 'google' && {
        access_type: 'offline', // Request refresh token
        prompt: 'consent', // Force consent screen
      }),
    });

    return `${this.endpoints.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param code - Authorization code from provider
   * @param userId - User ID to associate token with
   * @returns OAuth2Token with access and optional refresh token
   */
  async exchangeCodeForToken(code: string, userId: string): Promise<OAuth2Token> {
    try {
      const response = await axios.post(this.endpoints.tokenUrl, {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
      });

      const tokenResponse = response.data as TokenResponse;
      const token = this.parseTokenResponse(tokenResponse, userId);

      // Return token - user is responsible for storing it
      return token;
    } catch (error) {
      throw new MatimoError(
        'Failed to exchange authorization code for token',
        ErrorCode.AUTH_FAILED,
        {
          provider: this.config.provider,
          error: (error as Error).message,
        }
      );
    }
  }

  /**
   * Refresh a token if it's expired or expiring soon
   * @param userId - User ID (for context only)
   * @param currentToken - Current OAuth2Token to refresh
   * @returns Refreshed OAuth2Token (same token if not expiring soon)
   */
  async refreshTokenIfNeeded(userId: string, currentToken: OAuth2Token): Promise<OAuth2Token> {
    if (!this.isTokenExpiringSoon(currentToken)) {
      return currentToken; // Token still valid
    }

    if (!currentToken.refreshToken) {
      throw new MatimoError(
        `Cannot refresh token for user: ${userId} - no refreshToken available`,
        ErrorCode.AUTH_FAILED,
        { userId, provider: this.config.provider }
      );
    }

    try {
      const response = await axios.post(this.endpoints.tokenUrl, {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: currentToken.refreshToken,
        grant_type: 'refresh_token',
      });

      const tokenResponse = response.data as TokenResponse;
      const refreshedToken = this.parseTokenResponse(
        tokenResponse,
        userId,
        currentToken.refreshToken
      );

      // Return refreshed token - user is responsible for storing it
      return refreshedToken;
    } catch (error) {
      throw new MatimoError('Failed to refresh token', ErrorCode.AUTH_FAILED, {
        userId,
        provider: this.config.provider,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Revoke a token (logout)
   * @param token - OAuth2Token to revoke
   */
  async revokeToken(token: OAuth2Token): Promise<void> {
    if (!this.endpoints.revokeUrl) {
      // Provider doesn't support revocation
      return;
    }

    try {
      await axios.post(this.endpoints.revokeUrl, {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        token: token.accessToken,
      });
    } catch {
      // Log but don't fail - token may already be revoked
    }
  }

  /**
   * Check if a token is expired or expiring soon (within 5 minute buffer)
   */
  private isTokenExpiringSoon(token: OAuth2Token): boolean {
    const now = Date.now();
    const expiresAt = token.expiresAt;
    return now >= expiresAt - this.tokenRefreshBuffer;
  }

  /**
   * Parse token response from provider
   */
  private parseTokenResponse(
    response: TokenResponse,
    userId: string,
    existingRefreshToken?: string
  ): OAuth2Token {
    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token || existingRefreshToken,
      expiresAt: Date.now() + response.expires_in * 1000,
      scopes: response.scope ? response.scope.split(' ') : [],
      provider: this.config.provider,
      userId,
    };
  }

  /**
   * Generate random state token for CSRF protection
   */
  private generateRandomState(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Check if a token is valid (not expired)
   */
  isTokenValid(token: OAuth2Token): boolean {
    const now = Date.now();
    return now < token.expiresAt;
  }

  /**
   * Set custom token refresh buffer (milliseconds before expiration)
   */
  setTokenRefreshBuffer(milliseconds: number): void {
    this.tokenRefreshBuffer = milliseconds;
  }
}

export default OAuth2Handler;
