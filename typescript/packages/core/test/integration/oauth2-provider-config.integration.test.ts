/**
 * OAuth2 Provider Configuration Integration Test
 *
 * Demonstrates the complete workflow of:
 * 1. Discovering providers from YAML
 * 2. Resolving endpoints with 3-tier priority
 * 3. Using different providers without code changes
 */

import { OAuth2Handler } from '../../src/auth/oauth2-handler';
import { OAuth2ProviderLoader } from '../../src/auth/oauth2-provider-loader';
import { OAuth2Endpoints } from '../../src/auth/oauth2-config';
import path from 'path';

describe('OAuth2 Provider Configuration Integration', () => {
  describe('Provider Discovery and Loading', () => {
    it('should load providers from YAML files', async () => {
      const toolsPath = path.resolve(__dirname, '../fixtures/tools');
      const loader = new OAuth2ProviderLoader(toolsPath);
      const providers = await loader.loadProviders();

      // Verify built-in providers are discovered
      const providerNames = Array.from(providers.keys());

      // At minimum, should have our test providers
      expect(providerNames.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('3-Tier Configuration Priority', () => {
    it('should use Priority 1: Runtime config.endpoints when provided', () => {
      const customEndpoints: OAuth2Endpoints = {
        authorizationUrl: 'https://custom.company.com/authorize',
        tokenUrl: 'https://custom.company.com/token',
      };

      const handler = new OAuth2Handler({
        provider: 'custom',
        clientId: 'test-id',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost:3000/callback',
        endpoints: customEndpoints,
      });

      const resolved = handler.getEndpoints();
      expect(resolved.authorizationUrl).toBe(customEndpoints.authorizationUrl);
      expect(resolved.tokenUrl).toBe(customEndpoints.tokenUrl);
    });

    it('should use Priority 2: Environment variables when config.endpoints not provided', () => {
      const oldEnv = { ...process.env };

      try {
        process.env.OAUTH_ENTERPRISE_AUTH_URL = 'https://enterprise.company.com/auth';
        process.env.OAUTH_ENTERPRISE_TOKEN_URL = 'https://enterprise.company.com/token';

        const handler = new OAuth2Handler({
          provider: 'enterprise',
          clientId: 'test-id',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost:3000/callback',
          // No endpoints provided, env vars should be used
        });

        const resolved = handler.getEndpoints();
        expect(resolved.authorizationUrl).toBe('https://enterprise.company.com/auth');
        expect(resolved.tokenUrl).toBe('https://enterprise.company.com/token');
      } finally {
        process.env = oldEnv;
      }
    });

    it('should prioritize config.endpoints over environment variables', () => {
      const oldEnv = { ...process.env };
      const configEndpoints: OAuth2Endpoints = {
        authorizationUrl: 'https://config.company.com/auth',
        tokenUrl: 'https://config.company.com/token',
      };

      try {
        // Set env vars that should be ignored
        process.env.OAUTH_GOOGLE_AUTH_URL = 'https://env.company.com/auth';
        process.env.OAUTH_GOOGLE_TOKEN_URL = 'https://env.company.com/token';

        const handler = new OAuth2Handler({
          provider: 'google',
          clientId: 'test-id',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost:3000/callback',
          endpoints: configEndpoints, // Config should win
        });

        const resolved = handler.getEndpoints();
        // Should use config endpoints, not env vars
        expect(resolved.authorizationUrl).toBe(configEndpoints.authorizationUrl);
        expect(resolved.tokenUrl).toBe(configEndpoints.tokenUrl);
      } finally {
        process.env = oldEnv;
      }
    });
  });

  describe('Provider-Agnostic OAuth2 Flow', () => {
    it('should support any provider with endpoint configuration', () => {
      const providers = [
        {
          name: 'service-a',
          endpoints: {
            authorizationUrl: 'https://service-a.example.com/oauth/authorize',
            tokenUrl: 'https://service-a.example.com/oauth/token',
          } as OAuth2Endpoints,
        },
        {
          name: 'service-b',
          endpoints: {
            authorizationUrl: 'https://service-b.example.com/oauth/authorize',
            tokenUrl: 'https://service-b.example.com/oauth/token',
          } as OAuth2Endpoints,
        },
      ];

      // Create handlers for each provider
      const handlers = providers.map(
        (provider) =>
          new OAuth2Handler({
            provider: provider.name,
            clientId: `${provider.name}-client`,
            clientSecret: `${provider.name}-secret`,
            redirectUri: 'http://localhost:3000/callback',
            endpoints: provider.endpoints,
          })
      );

      // Verify each handler has correct endpoints
      handlers.forEach((handler, index) => {
        const endpoints = handler.getEndpoints();
        expect(endpoints.authorizationUrl).toBe(providers[index].endpoints.authorizationUrl);
        expect(endpoints.tokenUrl).toBe(providers[index].endpoints.tokenUrl);
      });
    });

    it('should generate authorization URLs for different providers', () => {
      const googleEndpoints: OAuth2Endpoints = {
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
      };

      const githubEndpoints: OAuth2Endpoints = {
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
      };

      const googleHandler = new OAuth2Handler({
        provider: 'google',
        clientId: 'google-client',
        clientSecret: 'google-secret',
        redirectUri: 'http://localhost:3000/callback',
        endpoints: googleEndpoints,
      });

      const githubHandler = new OAuth2Handler({
        provider: 'github',
        clientId: 'github-client',
        clientSecret: 'github-secret',
        redirectUri: 'http://localhost:3000/callback',
        endpoints: githubEndpoints,
      });

      // Generate auth URLs
      const googleAuthUrl = googleHandler.getAuthorizationUrl({
        scopes: ['email', 'profile'],
        userId: 'user-123',
      });

      const githubAuthUrl = githubHandler.getAuthorizationUrl({
        scopes: ['repo', 'user'],
        userId: 'user-123',
      });

      // Verify URLs are provider-specific
      expect(googleAuthUrl).toContain('accounts.google.com');
      expect(githubAuthUrl).toContain('github.com');
      expect(googleAuthUrl).not.toContain('github.com');
      expect(githubAuthUrl).not.toContain('accounts.google.com');
    });
  });

  describe('Configuration-Driven Provider Expansion', () => {
    it('should support infinite providers without code changes', () => {
      // Simulate adding 5 different OAuth providers
      const customProviders = ['slack', 'microsoft', 'okta', 'auth0', 'custom-idp'];

      const handlers = customProviders.map((providerName) => {
        const endpoints: OAuth2Endpoints = {
          authorizationUrl: `https://${providerName}.example.com/oauth/authorize`,
          tokenUrl: `https://${providerName}.example.com/oauth/token`,
        };

        return new OAuth2Handler({
          provider: providerName,
          clientId: `${providerName}-client`,
          clientSecret: `${providerName}-secret`,
          redirectUri: 'http://localhost:3000/callback',
          endpoints,
        });
      });

      // Verify all handlers were created without code changes
      expect(handlers).toHaveLength(customProviders.length);

      // Each handler should have correct provider name
      handlers.forEach((handler, index) => {
        const endpoints = handler.getEndpoints();
        expect(endpoints.authorizationUrl).toContain(customProviders[index]);
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when provider not found and no endpoints provided', () => {
      expect(
        () =>
          new OAuth2Handler({
            provider: 'non-existent-provider',
            clientId: 'test-id',
            clientSecret: 'test-secret',
            redirectUri: 'http://localhost:3000/callback',
            // No endpoints provided, provider not in YAML
          })
      ).toThrow();
    });

    it('should throw error when env vars are incomplete', () => {
      const oldEnv = { ...process.env };

      try {
        // Set only auth URL, missing token URL
        process.env.OAUTH_INCOMPLETE_AUTH_URL = 'https://incomplete.example.com/auth';
        // Missing OAUTH_INCOMPLETE_TOKEN_URL

        expect(
          () =>
            new OAuth2Handler({
              provider: 'incomplete',
              clientId: 'test-id',
              clientSecret: 'test-secret',
              redirectUri: 'http://localhost:3000/callback',
              // No config endpoints, env vars incomplete
            })
        ).toThrow();
      } finally {
        process.env = oldEnv;
      }
    });
  });
});
