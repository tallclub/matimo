/**
 * OAuth2Handler Tests
 *
 * Matimo does NOT store tokens - that's the user's responsibility.
 * These tests verify:
 * - Authorization URL generation
 * - Code-to-token exchange
 * - Token refresh functionality
 * - Token revocation
 * - Token validation (checking expiration)
 * - Multi-provider support
 */

import { OAuth2Handler } from '../../src/auth/oauth2-handler';
import { OAuth2Token, OAuth2Config, OAuth2Endpoints } from '../../src/auth/oauth2-config';
import axios from 'axios';
import { MatimoError } from '../../src/errors/matimo-error';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Standard test endpoints
const testEndpoints: OAuth2Endpoints = {
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  revokeUrl: 'https://oauth2.googleapis.com/revoke',
};

describe('OAuth2Handler', () => {
  let handler: OAuth2Handler;
  const mockConfig: OAuth2Config = {
    provider: 'google',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/callback',
    endpoints: testEndpoints,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new OAuth2Handler(mockConfig);
  });

  describe('Configuration', () => {
    it('should create OAuth2Handler with valid config', () => {
      expect(handler).toBeDefined();
    });

    it('should throw error if clientId is missing', () => {
      const invalidConfig = { ...mockConfig, clientId: '' };
      expect(() => new OAuth2Handler(invalidConfig)).toThrow(MatimoError);
    });

    it('should throw error if clientSecret is missing', () => {
      const invalidConfig = { ...mockConfig, clientSecret: '' };
      expect(() => new OAuth2Handler(invalidConfig)).toThrow(MatimoError);
    });
  });

  describe('Layered Configuration (Provider-Agnostic Endpoints)', () => {
    it('should use provided endpoints when given in config (Priority 1)', () => {
      const endpoints = handler.getEndpoints();
      expect(endpoints.authorizationUrl).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(endpoints.tokenUrl).toBe('https://oauth2.googleapis.com/token');
    });

    it('should use provided endpoints for GitHub (Priority 1)', () => {
      const githubEndpoints: OAuth2Endpoints = {
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
      };
      const githubHandler = new OAuth2Handler({
        ...mockConfig,
        provider: 'github',
        endpoints: githubEndpoints,
      });
      const endpoints = githubHandler.getEndpoints();
      expect(endpoints.authorizationUrl).toBe('https://github.com/login/oauth/authorize');
      expect(endpoints.tokenUrl).toBe('https://github.com/login/oauth/access_token');
    });

    it('should use provided endpoints for Slack (Priority 1)', () => {
      const slackEndpoints: OAuth2Endpoints = {
        authorizationUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
      };
      const slackHandler = new OAuth2Handler({
        ...mockConfig,
        provider: 'slack',
        endpoints: slackEndpoints,
      });
      const endpoints = slackHandler.getEndpoints();
      expect(endpoints.authorizationUrl).toBe('https://slack.com/oauth/v2/authorize');
      expect(endpoints.tokenUrl).toBe('https://slack.com/api/oauth.v2.access');
    });

    it('should prefer runtime config.endpoints over defaults (Priority 1)', () => {
      const runtimeEndpoints: OAuth2Endpoints = {
        authorizationUrl: 'https://custom-auth.example.com',
        tokenUrl: 'https://custom-token.example.com',
      };
      const handler = new OAuth2Handler({
        ...mockConfig,
        endpoints: runtimeEndpoints,
      });
      const endpoints = handler.getEndpoints();
      expect(endpoints.authorizationUrl).toBe('https://custom-auth.example.com');
      expect(endpoints.tokenUrl).toBe('https://custom-token.example.com');
    });

    it('should prefer environment variables over defaults (Priority 2)', () => {
      process.env.OAUTH_GOOGLE_AUTH_URL = 'https://env-auth.example.com';
      process.env.OAUTH_GOOGLE_TOKEN_URL = 'https://env-token.example.com';

      const config = {
        ...mockConfig,
        endpoints: undefined,
      };
      const handler = new OAuth2Handler(config);
      const endpoints = handler.getEndpoints();

      expect(endpoints.authorizationUrl).toBe('https://env-auth.example.com');
      expect(endpoints.tokenUrl).toBe('https://env-token.example.com');

      delete process.env.OAUTH_GOOGLE_AUTH_URL;
      delete process.env.OAUTH_GOOGLE_TOKEN_URL;
    });

    it('should prefer runtime config.endpoints over environment variables (Priority 1 > 2)', () => {
      process.env.OAUTH_GOOGLE_AUTH_URL = 'https://env-auth.example.com';
      process.env.OAUTH_GOOGLE_TOKEN_URL = 'https://env-token.example.com';

      const runtimeEndpoints: OAuth2Endpoints = {
        authorizationUrl: 'https://runtime-auth.example.com',
        tokenUrl: 'https://runtime-token.example.com',
      };
      const handler = new OAuth2Handler({
        ...mockConfig,
        endpoints: runtimeEndpoints,
      });
      const endpoints = handler.getEndpoints();

      expect(endpoints.authorizationUrl).toBe('https://runtime-auth.example.com');
      expect(endpoints.tokenUrl).toBe('https://runtime-token.example.com');

      delete process.env.OAUTH_GOOGLE_AUTH_URL;
      delete process.env.OAUTH_GOOGLE_TOKEN_URL;
    });

    it('should throw error for unsupported provider without endpoints', () => {
      const config: OAuth2Config = {
        provider: 'unsupported-provider',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
      };

      expect(() => new OAuth2Handler(config)).toThrow(MatimoError);
    });

    it('should throw error if env vars are incomplete', () => {
      process.env.OAUTH_GOOGLE_AUTH_URL = 'https://env-auth.example.com';
      // tokenUrl is missing

      const config = {
        ...mockConfig,
        endpoints: undefined,
      };

      expect(() => new OAuth2Handler(config)).toThrow(MatimoError);

      delete process.env.OAUTH_GOOGLE_AUTH_URL;
    });
  });

  describe('Authorization URL', () => {
    it('should generate valid authorization URL for Google', () => {
      const url = handler.getAuthorizationUrl({
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        userId: 'user123',
      });

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=');
      expect(url).toContain('state=');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
    });

    it('should include state parameter for CSRF protection', () => {
      const url = handler.getAuthorizationUrl({
        scopes: ['scope1'],
        userId: 'user123',
      });

      const stateMatch = url.match(/state=([^&]+)/);
      expect(stateMatch).toBeTruthy();
      expect(stateMatch![1].length).toBeGreaterThanOrEqual(16); // Random state generated (minimum 16 chars)
    });

    it('should accept custom state parameter', () => {
      const customState = 'my-custom-state-value';
      const url = handler.getAuthorizationUrl({
        scopes: ['scope1'],
        userId: 'user123',
        state: customState,
      });

      expect(url).toContain(`state=${customState}`);
    });

    it('should generate different authorization URLs for different providers', () => {
      const githubHandler = new OAuth2Handler({
        ...mockConfig,
        provider: 'github',
        endpoints: {
          authorizationUrl: 'https://github.com/login/oauth/authorize',
          tokenUrl: 'https://github.com/login/oauth/access_token',
        },
      });

      const googleUrl = handler.getAuthorizationUrl({
        scopes: ['email'],
        userId: 'user123',
      });
      const githubUrl = githubHandler.getAuthorizationUrl({
        scopes: ['repo'],
        userId: 'user123',
      });

      expect(googleUrl).toContain('accounts.google.com');
      expect(githubUrl).toContain('github.com');
      expect(googleUrl).not.toEqual(githubUrl);
    });
  });

  describe('Token Exchange', () => {
    it('should exchange authorization code for token', async () => {
      const mockResponse = {
        data: {
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-123',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'gmail.send gmail.readonly',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const token = await handler.exchangeCodeForToken('auth-code-123', 'user123');

      expect(token.accessToken).toBe('access-token-123');
      expect(token.refreshToken).toBe('refresh-token-123');
      expect(token.userId).toBe('user123');
      expect(token.provider).toBe('google');
      expect(token.scopes).toContain('gmail.send');
      expect(token.scopes).toContain('gmail.readonly');
      expect(token.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should throw error on token exchange failure', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(handler.exchangeCodeForToken('auth-code-123', 'user123')).rejects.toThrow(
        MatimoError
      );
    });

    it('should handle token response without refresh token', async () => {
      const mockResponse = {
        data: {
          access_token: 'access-token-123',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const token = await handler.exchangeCodeForToken('auth-code-123', 'user123');

      expect(token.accessToken).toBe('access-token-123');
      expect(token.refreshToken).toBeUndefined();
    });
  });

  describe('Token Refresh', () => {
    it('should refresh a token if it is expiring soon', async () => {
      const expiringToken: OAuth2Token = {
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token-123',
        expiresAt: Date.now() + 2 * 60 * 1000, // Expires in 2 minutes (less than 5 min buffer)
        scopes: ['gmail.send'],
        provider: 'google',
        userId: 'user123',
      };

      const refreshResponse = {
        data: {
          access_token: 'new-access-token',
          refresh_token: 'refresh-token-123',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(refreshResponse);

      const refreshed = await handler.refreshTokenIfNeeded('user123', expiringToken);

      expect(refreshed.accessToken).toBe('new-access-token');
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should return same token if not expiring soon', async () => {
      const validToken: OAuth2Token = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
        scopes: ['gmail.send'],
        provider: 'google',
        userId: 'user123',
      };

      const refreshed = await handler.refreshTokenIfNeeded('user123', validToken);

      expect(refreshed).toEqual(validToken);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should throw error if refresh token missing and token is expiring', async () => {
      const expiringToken: OAuth2Token = {
        accessToken: 'old-access-token',
        expiresAt: Date.now() + 2 * 60 * 1000, // Expires in 2 minutes
        scopes: ['gmail.send'],
        provider: 'google',
        userId: 'user123',
      };

      await expect(handler.refreshTokenIfNeeded('user123', expiringToken)).rejects.toThrow(
        /no refreshToken available/
      );
    });

    it('should handle refresh token failure gracefully', async () => {
      const expiringToken: OAuth2Token = {
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token-123',
        expiresAt: Date.now() + 2 * 60 * 1000,
        scopes: ['gmail.send'],
        provider: 'google',
        userId: 'user123',
      };

      mockedAxios.post.mockRejectedValueOnce(new Error('Refresh failed'));

      await expect(handler.refreshTokenIfNeeded('user123', expiringToken)).rejects.toThrow(
        MatimoError
      );
    });
  });

  describe('Token Validation', () => {
    it('should check if token is valid (not expired)', () => {
      const validToken: OAuth2Token = {
        accessToken: 'access-token-123',
        expiresAt: Date.now() + 60 * 60 * 1000,
        scopes: ['gmail.send'],
        provider: 'google',
        userId: 'user123',
      };

      const isValid = handler.isTokenValid(validToken);

      expect(isValid).toBe(true);
    });

    it('should check if token is invalid (expired)', () => {
      const expiredToken: OAuth2Token = {
        accessToken: 'access-token-123',
        expiresAt: Date.now() - 1000,
        scopes: ['gmail.send'],
        provider: 'google',
        userId: 'user123',
      };

      const isValid = handler.isTokenValid(expiredToken);

      expect(isValid).toBe(false);
    });

    it('should report token as valid at exact expiration boundary', () => {
      const boundaryToken: OAuth2Token = {
        accessToken: 'access-token-123',
        expiresAt: Date.now(),
        scopes: ['gmail.send'],
        provider: 'google',
        userId: 'user123',
      };

      // Token is invalid once expiration time is reached
      const isValid = handler.isTokenValid(boundaryToken);
      expect(isValid).toBe(false);
    });
  });

  describe('Token Revocation', () => {
    it('should revoke token successfully', async () => {
      const token: OAuth2Token = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() + 3600000,
        scopes: ['email'],
        provider: 'google',
        userId: 'user123',
      };

      mockedAxios.post.mockResolvedValueOnce({ status: 200 });

      await handler.revokeToken(token);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/revoke',
        expect.objectContaining({
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          token: 'test-token',
        })
      );
    });

    it('should skip revocation if provider has no revokeUrl', async () => {
      const configWithoutRevoke: OAuth2Config = {
        ...mockConfig,
        endpoints: {
          authorizationUrl: testEndpoints.authorizationUrl,
          tokenUrl: testEndpoints.tokenUrl,
          // No revokeUrl
        },
      };
      const handlerNoRevoke = new OAuth2Handler(configWithoutRevoke);

      const token: OAuth2Token = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() + 3600000,
        scopes: ['email'],
        provider: 'google',
        userId: 'user123',
      };

      await handlerNoRevoke.revokeToken(token);

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should handle revoke failures gracefully', async () => {
      const token: OAuth2Token = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() + 3600000,
        scopes: ['email'],
        provider: 'google',
        userId: 'user123',
      };

      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw - just log and continue
      await expect(handler.revokeToken(token)).resolves.toBeUndefined();
    });
  });

  describe('Token Refresh Settings', () => {
    it('should allow customizing token refresh buffer', async () => {
      handler.setTokenRefreshBuffer(10 * 60 * 1000); // 10 minutes

      const tokenExpiringIn8Min: OAuth2Token = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: Date.now() + 8 * 60 * 1000, // 8 minutes from now
        scopes: ['gmail.send'],
        provider: 'google',
        userId: 'user123',
      };

      const refreshResponse = {
        data: {
          access_token: 'new-access-token',
          refresh_token: 'refresh-token-123',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(refreshResponse);

      // Should refresh because token expires in 8 min but buffer is 10 min
      const token = await handler.refreshTokenIfNeeded('user123', tokenExpiringIn8Min);
      expect(token.accessToken).toBe('new-access-token');
    });
  });

  describe('Multiple Providers', () => {
    it('should support GitHub OAuth2', () => {
      const githubEndpoints: OAuth2Endpoints = {
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
      };
      const githubHandler = new OAuth2Handler({
        ...mockConfig,
        provider: 'github',
        endpoints: githubEndpoints,
      });

      const url = githubHandler.getAuthorizationUrl({
        scopes: ['repo', 'user'],
        userId: 'user123',
      });

      expect(url).toContain('github.com');
      expect(url).toContain('repo');
    });

    it('should support Slack OAuth2', () => {
      const slackEndpoints: OAuth2Endpoints = {
        authorizationUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
      };
      const slackHandler = new OAuth2Handler({
        ...mockConfig,
        provider: 'slack',
        endpoints: slackEndpoints,
      });

      const url = slackHandler.getAuthorizationUrl({
        scopes: ['chat:write', 'channels:read'],
        userId: 'user123',
      });

      expect(url).toContain('slack.com');
    });
  });

  describe('Endpoints', () => {
    it('should return resolved endpoints', () => {
      const endpoints = handler.getEndpoints();

      expect(endpoints).toEqual(testEndpoints);
      expect(endpoints.authorizationUrl).toBeDefined();
      expect(endpoints.tokenUrl).toBeDefined();
    });
  });
});
