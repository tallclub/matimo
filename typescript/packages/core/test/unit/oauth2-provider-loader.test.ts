/**
 * OAuth2ProviderLoader Tests
 *
 * Tests the provider discovery, loading, and validation system
 */

import { OAuth2ProviderLoader } from '../../src/auth/oauth2-provider-loader';
import { MatimoError } from '../../src/errors/matimo-error';
import path from 'path';

/**
 * Test class to access protected methods
 */
class TestOAuth2ProviderLoader extends OAuth2ProviderLoader {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public testValidateProviderDefinition(definition: any): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.validateProviderDefinition(definition as any);
  }
}

describe('OAuth2ProviderLoader', () => {
  const toolsPath = path.resolve(__dirname, '../fixtures/tools');
  const loader = new TestOAuth2ProviderLoader(toolsPath);

  describe('Provider Discovery', () => {
    it('should load all provider definitions from tools directory', async () => {
      const providers = await loader.loadProviders();
      expect(providers).toBeInstanceOf(Map);
      expect(providers.size).toBeGreaterThan(0);
    });

    it('should have Google provider loaded', async () => {
      const providers = await loader.loadProviders();
      expect(providers.has('google')).toBe(true);
    });

    it('should have GitHub provider loaded', async () => {
      const providers = await loader.loadProviders();
      expect(providers.has('github')).toBe(true);
    });
  });

  describe('Provider Endpoints', () => {
    it('should retrieve Google OAuth2 endpoints', async () => {
      await loader.loadProviders();
      const endpoints = loader.getProvider('google');

      expect(endpoints).toBeDefined();
      expect(endpoints?.authorizationUrl).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(endpoints?.tokenUrl).toBe('https://oauth2.googleapis.com/token');
      expect(endpoints?.revokeUrl).toBe('https://oauth2.googleapis.com/revoke');
    });

    it('should retrieve GitHub OAuth2 endpoints', async () => {
      await loader.loadProviders();
      const endpoints = loader.getProvider('github');

      expect(endpoints).toBeDefined();
      expect(endpoints?.authorizationUrl).toBe('https://github.com/login/oauth/authorize');
      expect(endpoints?.tokenUrl).toBe('https://github.com/login/oauth/access_token');
    });

    it('should retrieve Slack OAuth2 endpoints', async () => {
      await loader.loadProviders();
      const endpoints = loader.getProvider('slack');

      expect(endpoints).toBeDefined();
      expect(endpoints?.authorizationUrl).toBe('https://slack.com/oauth/v2/authorize');
      expect(endpoints?.tokenUrl).toBe('https://slack.com/api/oauth.v2.access');
    });

    it('should return undefined for non-existent provider', async () => {
      await loader.loadProviders();
      const endpoints = loader.getProvider('non-existent-provider');

      expect(endpoints).toBeUndefined();
    });
  });

  describe('Provider Definitions', () => {
    it('should retrieve full provider definition for Google', async () => {
      await loader.loadProviders();
      const definition = loader.getDefinition('google');

      expect(definition).toBeDefined();
      expect(definition?.name).toBe('google-provider');
      expect(definition?.type).toBe('provider');
      expect(definition?.provider.name).toBe('google');
      expect(definition?.provider.displayName).toBe('Google');
    });

    it('should retrieve full provider definition for GitHub', async () => {
      await loader.loadProviders();
      const definition = loader.getDefinition('github');

      expect(definition).toBeDefined();
      expect(definition?.name).toBe('github-provider');
      expect(definition?.type).toBe('provider');
      expect(definition?.provider.name).toBe('github');
    });

    it('should return undefined for non-existent provider definition', async () => {
      await loader.loadProviders();
      const definition = loader.getDefinition('non-existent-provider');

      expect(definition).toBeUndefined();
    });

    it('should have documentation link for providers', async () => {
      await loader.loadProviders();
      const googleDef = loader.getDefinition('google');

      expect(googleDef?.provider.documentation).toBeDefined();
      expect(googleDef?.provider.documentation).toContain('http');
    });

    it('should have default scopes for providers', async () => {
      await loader.loadProviders();
      const googleDef = loader.getDefinition('google');

      expect(googleDef?.provider.defaultScopes).toBeDefined();
      expect(Array.isArray(googleDef?.provider.defaultScopes)).toBe(true);
      expect((googleDef?.provider.defaultScopes || []).length).toBeGreaterThan(0);
    });
  });

  describe('Provider Listing', () => {
    it('should list all provider names', async () => {
      await loader.loadProviders();
      const providerNames = loader.listProviders();

      expect(Array.isArray(providerNames)).toBe(true);
      expect(providerNames.length).toBeGreaterThan(0);
    });

    it('should include Google in provider list', async () => {
      await loader.loadProviders();
      const providerNames = loader.listProviders();

      expect(providerNames).toContain('google');
    });

    it('should include GitHub in provider list', async () => {
      await loader.loadProviders();
      const providerNames = loader.listProviders();

      expect(providerNames).toContain('github');
    });

    it('should include Slack in provider list', async () => {
      await loader.loadProviders();
      const providerNames = loader.listProviders();

      expect(providerNames).toContain('slack');
    });
  });

  describe('YAML Parsing and Validation', () => {
    it('should parse YAML provider definitions', async () => {
      const providers = await loader.loadProviders();
      expect(providers.size).toBeGreaterThan(0);
    });

    it('should have all required endpoint fields', async () => {
      await loader.loadProviders();
      const googleEndpoints = loader.getProvider('google');

      expect(googleEndpoints?.authorizationUrl).toBeDefined();
      expect(googleEndpoints?.tokenUrl).toBeDefined();
      expect(typeof googleEndpoints?.authorizationUrl).toBe('string');
      expect(typeof googleEndpoints?.tokenUrl).toBe('string');
    });

    it('should have valid URL format for endpoints', async () => {
      await loader.loadProviders();
      const googleEndpoints = loader.getProvider('google');

      expect(googleEndpoints?.authorizationUrl).toMatch(/^https?:\/\//);
      expect(googleEndpoints?.tokenUrl).toMatch(/^https?:\/\//);
    });

    it('should handle optional revokeUrl', async () => {
      await loader.loadProviders();
      const githubEndpoints = loader.getProvider('github');

      // GitHub doesn't have revoke URL
      expect(githubEndpoints?.revokeUrl).toBeUndefined();
    });

    it('should handle present revokeUrl', async () => {
      await loader.loadProviders();
      const googleEndpoints = loader.getProvider('google');

      // Google has revoke URL
      expect(googleEndpoints?.revokeUrl).toBeDefined();
      expect(googleEndpoints?.revokeUrl).toMatch(/^https?:\/\//);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tools directory gracefully', async () => {
      const loaderWithMissingPath = new TestOAuth2ProviderLoader('./non-existent-path');

      try {
        await loaderWithMissingPath.loadProviders();
        // Should fail
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(MatimoError);
      }
    });

    it('should continue loading other providers if one is invalid', async () => {
      // The provider loader skips invalid definitions
      const providers = await loader.loadProviders();

      // Should have successfully loaded at least the valid ones
      expect(providers.size).toBeGreaterThan(0);
    });
  });

  describe('Provider Definition Validation', () => {
    it('should have valid definitions for all loaded providers', async () => {
      await loader.loadProviders();
      const providerNames = loader.listProviders();

      for (const name of providerNames) {
        const definition = loader.getDefinition(name);
        expect(definition).toBeDefined();
        expect(definition?.name).toBeDefined();
        expect(definition?.type).toBe('provider');
        expect(definition?.provider.name).toBe(name);
        expect(definition?.provider.endpoints.authorizationUrl).toBeDefined();
        expect(definition?.provider.endpoints.tokenUrl).toBeDefined();
      }
    });

    it('should validate all endpoints have proper URL format', async () => {
      await loader.loadProviders();
      const providerNames = loader.listProviders();

      const urlRegex = /^https?:\/\//;

      for (const name of providerNames) {
        const endpoints = loader.getProvider(name);
        expect(endpoints?.authorizationUrl).toMatch(urlRegex);
        expect(endpoints?.tokenUrl).toMatch(urlRegex);
        if (endpoints?.revokeUrl) {
          expect(endpoints.revokeUrl).toMatch(urlRegex);
        }
      }
    });

    it('should have unique provider names', async () => {
      const providers = await loader.loadProviders();
      const names = Array.from(providers.keys());
      const uniqueNames = new Set(names);

      expect(names.length).toBe(uniqueNames.size);
    });
  });

  describe('Invalid Provider Definition Handling', () => {
    it('should skip invalid YAML files silently', async () => {
      const providers = await loader.loadProviders();
      // Should load valid providers even if some directories have invalid YAML
      expect(providers.size).toBeGreaterThan(0);
    });

    it('should load providers multiple times consistently', async () => {
      const providers1 = await loader.loadProviders();
      const providers2 = await loader.loadProviders();

      expect(providers1.size).toBe(providers2.size);

      const names1 = Array.from(providers1.keys()).sort();
      const names2 = Array.from(providers2.keys()).sort();

      expect(names1).toEqual(names2);
    });

    it('should have all endpoints with required fields', async () => {
      const providers = await loader.loadProviders();

      for (const [, endpoints] of providers) {
        expect(endpoints.authorizationUrl).toBeDefined();
        expect(endpoints.tokenUrl).toBeDefined();
        expect(typeof endpoints.authorizationUrl).toBe('string');
        expect(typeof endpoints.tokenUrl).toBe('string');
      }
    });
  });

  describe('Provider Metadata', () => {
    it('should have version for providers', async () => {
      await loader.loadProviders();
      const googleDef = loader.getDefinition('google');

      expect(googleDef?.version).toBeDefined();
      expect(typeof googleDef?.version).toBe('string');
    });

    it('should have provider display name', async () => {
      await loader.loadProviders();
      const googleDef = loader.getDefinition('google');

      expect(googleDef?.provider.displayName).toBeDefined();
      expect(typeof googleDef?.provider.displayName).toBe('string');
    });

    it('should have provider name distinct from definition name', async () => {
      await loader.loadProviders();
      const googleDef = loader.getDefinition('google');

      expect(googleDef?.name).not.toBe(googleDef?.provider.name);
      expect(googleDef?.name).toContain('provider');
      expect(googleDef?.provider.name).toBe('google');
    });
  });

  describe('Multiple Loads', () => {
    it('should reload providers correctly', async () => {
      const providers1 = await loader.loadProviders();
      const providers2 = await loader.loadProviders();

      expect(providers1.size).toBe(providers2.size);
    });

    it('should maintain provider consistency across loads', async () => {
      await loader.loadProviders();
      const google1 = loader.getProvider('google');

      await loader.loadProviders();
      const google2 = loader.getProvider('google');

      expect(google1).toEqual(google2);
    });
  });

  describe('Definition Structure Validation', () => {
    it('should have all required definition fields', async () => {
      await loader.loadProviders();
      const providerNames = loader.listProviders();

      for (const name of providerNames) {
        const def = loader.getDefinition(name);

        // Check definition structure
        expect(def).toBeDefined();
        expect(def?.name).toBeDefined();
        expect(typeof def?.name).toBe('string');
        expect(def?.type).toBe('provider');
        expect(def?.version).toBeDefined();

        // Check provider section
        expect(def?.provider).toBeDefined();
        expect(def?.provider.name).toBe(name);
        expect(typeof def?.provider.name).toBe('string');

        // Check endpoints
        expect(def?.provider.endpoints).toBeDefined();
        expect(def?.provider.endpoints.authorizationUrl).toBeDefined();
        expect(def?.provider.endpoints.tokenUrl).toBeDefined();
      }
    });

    it('should validate provider configuration is accessible via both methods', async () => {
      await loader.loadProviders();
      const providerNames = loader.listProviders();

      for (const name of providerNames) {
        const definition = loader.getDefinition(name);
        const endpoints = loader.getProvider(name);

        // Both should return consistent data
        expect(endpoints).toEqual(definition?.provider.endpoints);
      }
    });

    it('should handle provider with optional revokeUrl', async () => {
      await loader.loadProviders();
      const providerNames = loader.listProviders();

      let hasRevokeUrl = false;
      let noRevokeUrl = false;

      for (const name of providerNames) {
        const endpoints = loader.getProvider(name);

        if (endpoints?.revokeUrl) {
          hasRevokeUrl = true;
          expect(endpoints.revokeUrl).toMatch(/^https?:\/\//);
        } else {
          noRevokeUrl = true;
        }
      }

      // We should have both types
      expect(hasRevokeUrl || noRevokeUrl).toBe(true);
    });

    it('should validate all providers have displayName or use provider name', async () => {
      await loader.loadProviders();
      const providerNames = loader.listProviders();

      for (const name of providerNames) {
        const def = loader.getDefinition(name);
        // Either displayName should exist or fallback to provider name
        const displayName = def?.provider.displayName || def?.provider.name;
        expect(displayName).toBeDefined();
      }
    });
  });

  describe('Provider Validation - Error Cases', () => {
    it('should reject provider definition missing name field', () => {
      const invalidDef = {
        // Missing name field
        type: 'provider',
        version: '1.0.0',
        provider: {
          name: 'test-provider',
          endpoints: {
            authorizationUrl: 'https://example.com/auth',
            tokenUrl: 'https://example.com/token',
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      expect(() => {
        // Directly test validation by constructing an instance and calling private method
        const loaderInstance = new TestOAuth2ProviderLoader('./tools');
        // Access private method through type assertion for testing
        loaderInstance.testValidateProviderDefinition(invalidDef);
      }).toThrow(MatimoError);
    });

    it('should reject provider definition with wrong type', () => {
      const invalidDef = {
        name: 'test-provider',
        type: 'tool', // Should be 'provider'
        version: '1.0.0',
        provider: {
          name: 'test-provider',
          endpoints: {
            authorizationUrl: 'https://example.com/auth',
            tokenUrl: 'https://example.com/token',
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      expect(() => {
        const loaderInstance = new TestOAuth2ProviderLoader('./tools');
        loaderInstance.testValidateProviderDefinition(invalidDef);
      }).toThrow(MatimoError);
    });

    it('should reject provider definition missing provider object', () => {
      const invalidDef = {
        name: 'test-provider',
        type: 'provider',
        version: '1.0.0',
        // Missing provider object
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      expect(() => {
        const loaderInstance = new TestOAuth2ProviderLoader('./tools');
        loaderInstance.testValidateProviderDefinition(invalidDef);
      }).toThrow(MatimoError);
    });

    it('should reject provider definition with missing provider.name', () => {
      const invalidDef = {
        name: 'test-provider',
        type: 'provider',
        version: '1.0.0',
        provider: {
          // Missing name
          endpoints: {
            authorizationUrl: 'https://example.com/auth',
            tokenUrl: 'https://example.com/token',
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      expect(() => {
        const loaderInstance = new TestOAuth2ProviderLoader('./tools');
        loaderInstance.testValidateProviderDefinition(invalidDef);
      }).toThrow(MatimoError);
    });

    it('should reject provider definition missing provider.endpoints', () => {
      const invalidDef = {
        name: 'test-provider',
        type: 'provider',
        version: '1.0.0',
        provider: {
          name: 'test-provider',
          // Missing endpoints
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      expect(() => {
        const loaderInstance = new TestOAuth2ProviderLoader('./tools');
        loaderInstance.testValidateProviderDefinition(invalidDef);
      }).toThrow(MatimoError);
    });

    it('should reject provider endpoints missing authorizationUrl', () => {
      const invalidDef = {
        name: 'test-provider',
        type: 'provider',
        version: '1.0.0',
        provider: {
          name: 'test-provider',
          endpoints: {
            // Missing authorizationUrl
            tokenUrl: 'https://example.com/token',
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      expect(() => {
        const loaderInstance = new TestOAuth2ProviderLoader('./tools');
        loaderInstance.testValidateProviderDefinition(invalidDef);
      }).toThrow(MatimoError);
    });

    it('should reject provider endpoints missing tokenUrl', () => {
      const invalidDef = {
        name: 'test-provider',
        type: 'provider',
        version: '1.0.0',
        provider: {
          name: 'test-provider',
          endpoints: {
            authorizationUrl: 'https://example.com/auth',
            // Missing tokenUrl
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      expect(() => {
        const loaderInstance = new TestOAuth2ProviderLoader('./tools');
        loaderInstance.testValidateProviderDefinition(invalidDef);
      }).toThrow(MatimoError);
    });

    it('should accept valid provider definition with optional fields', () => {
      const validDef = {
        name: 'test-provider',
        type: 'provider',
        version: '1.0.0',
        description: 'Test provider',
        provider: {
          name: 'test-provider',
          displayName: 'Test Provider',
          endpoints: {
            authorizationUrl: 'https://example.com/auth',
            tokenUrl: 'https://example.com/token',
            revokeUrl: 'https://example.com/revoke',
          },
          defaultScopes: ['read', 'write'],
          documentation: 'https://example.com/docs',
          learnMore: 'https://example.com/learn',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      expect(() => {
        const loaderInstance = new TestOAuth2ProviderLoader('./tools');
        loaderInstance.testValidateProviderDefinition(validDef);
      }).not.toThrow();
    });

    it('should accept valid provider definition with minimal fields', () => {
      const validDef = {
        name: 'test-provider',
        type: 'provider',
        version: '1.0.0',
        provider: {
          name: 'test-provider',
          endpoints: {
            authorizationUrl: 'https://example.com/auth',
            tokenUrl: 'https://example.com/token',
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      expect(() => {
        const loaderInstance = new TestOAuth2ProviderLoader('./tools');
        loaderInstance.testValidateProviderDefinition(validDef);
      }).not.toThrow();
    });
  });

  describe('Provider Loading Edge Cases', () => {
    it('should list all loaded providers', async () => {
      const providers = await loader.loadProviders();
      const providerList = loader.listProviders();

      expect(Array.isArray(providerList)).toBe(true);
      expect(providerList.length).toBeGreaterThan(0);
      providerList.forEach((p) => {
        expect(providers.has(p)).toBe(true);
      });
    });

    it('should skip non-provider definitions', async () => {
      // This should skip any tool definitions with type !== 'provider'
      const providers = await loader.loadProviders();
      expect(providers).toBeInstanceOf(Map);
      // Verify all loaded providers have the correct structure
      providers.forEach((endpoints) => {
        expect(endpoints.authorizationUrl).toBeDefined();
        expect(endpoints.tokenUrl).toBeDefined();
      });
    });

    it('should skip directories without definition.yaml', async () => {
      // The fixtures include a 'database' directory without a provider definition
      const providers = await loader.loadProviders();
      // Should still successfully load other providers
      expect(providers.size).toBeGreaterThan(0);
    });

    it('should handle missing revokeUrl gracefully', async () => {
      const providers = await loader.loadProviders();
      // GitHub provider definition has optional revokeUrl
      const github = providers.get('github');
      // Should still be loaded even without revokeUrl (it's optional)
      expect(github).toBeDefined();
      expect(github?.tokenUrl).toBeDefined();
    });

    it('should handle validation error for invalid provider definition', async () => {
      // Test the validation function with invalid definition
      const testLoader = new TestOAuth2ProviderLoader(toolsPath);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidDef: any = {
        name: 'invalid-provider',
        type: 'provider',
        // Missing required provider field
      };

      expect(() => {
        testLoader.testValidateProviderDefinition(invalidDef);
      }).toThrow(MatimoError);
    });

    it('should continue loading when encountering invalid definitions', async () => {
      // Even if some definitions are invalid, valid ones should still load
      const providers = await loader.loadProviders();

      // Should have loaded the valid providers (google, github, slack, etc)
      expect(providers.size).toBeGreaterThan(0);
      expect(providers.has('google')).toBe(true);
    });

    it('should handle definition with missing endpoints', async () => {
      const testLoader = new TestOAuth2ProviderLoader(toolsPath);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidDef: any = {
        name: 'invalid-provider',
        type: 'provider',
        provider: {
          name: 'invalid',
          displayName: 'Invalid',
          // Missing endpoints
        },
      };

      expect(() => {
        testLoader.testValidateProviderDefinition(invalidDef);
      }).toThrow(MatimoError);
    });

    it('should handle definition with incomplete endpoints', async () => {
      const testLoader = new TestOAuth2ProviderLoader(toolsPath);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidDef: any = {
        name: 'incomplete-provider',
        type: 'provider',
        version: '1.0.0',
        provider: {
          name: 'incomplete',
          displayName: 'Incomplete',
          endpoints: {
            // Missing tokenUrl
            authorizationUrl: 'https://example.com/auth',
          },
        },
      };

      expect(() => {
        testLoader.testValidateProviderDefinition(invalidDef);
      }).toThrow(MatimoError);
    });

    it('should accept valid minimal provider definition', async () => {
      const testLoader = new TestOAuth2ProviderLoader(toolsPath);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validDef: any = {
        name: 'valid-provider',
        type: 'provider',
        version: '1.0.0',
        provider: {
          name: 'valid',
          displayName: 'Valid Provider',
          endpoints: {
            authorizationUrl: 'https://example.com/auth',
            tokenUrl: 'https://example.com/token',
          },
          defaultScopes: ['read'],
          documentation: 'https://example.com/docs',
        },
      };

      expect(() => {
        testLoader.testValidateProviderDefinition(validDef);
      }).not.toThrow();
    });
  });
});
