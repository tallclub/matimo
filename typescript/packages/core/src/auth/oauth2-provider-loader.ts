/**
 * OAuth2ProviderLoader - Loads provider definitions from YAML files
 *
 * Pattern: Configuration-driven providers
 * - Loads provider definitions from tools/[provider]/definition.yaml
 * - Discovers providers with type: provider
 * - Makes endpoints available to OAuth2Handler
 * - Supports infinite providers without code changes
 *
 * Usage:
 * ```typescript
 * const loader = new OAuth2ProviderLoader('./tools');
 * const providers = await loader.loadProviders();
 * const googleEndpoints = providers.get('google');
 * ```
 */

import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import { OAuth2Endpoints } from './oauth2-config';
import { MatimoError, ErrorCode } from '../errors/matimo-error';
import { validateProviderDefinition, type ProviderDefinition } from '../core/schema';

/**
 * OAuth2ProviderLoader - Loads OAuth2 provider configurations from YAML
 *
 * Design Principle:
 * - Configuration-driven: All provider config in YAML files
 * - Discoverable: Automatically finds tools/[provider]/definition.yaml with type: provider
 * - Extensible: Add new providers by adding YAML file, no code changes
 * - Overridable: Users can override via env vars or runtime config
 */
export class OAuth2ProviderLoader {
  private toolsPath: string;
  private providers: Map<string, OAuth2Endpoints> = new Map();
  private definitions: Map<string, ProviderDefinition> = new Map();

  constructor(toolsPath: string) {
    this.toolsPath = toolsPath;
  }

  /**
   * Load all provider definitions from tools directory
   *
   * Discovers tools/[provider]/definition.yaml files with type: provider
   * Validates and stores provider endpoint configurations
   *
   * @returns Map of provider name → OAuth2Endpoints
   * @throws MatimoError if invalid provider definition found
   */
  async loadProviders(): Promise<Map<string, OAuth2Endpoints>> {
    try {
      const entries = await fs.readdir(this.toolsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const definitionPath = path.join(this.toolsPath, entry.name, 'definition.yaml');

        try {
          const content = await fs.readFile(definitionPath, 'utf-8');
          const definition = YAML.parse(content) as ProviderDefinition;

          // Check if this is a provider definition
          if (definition.type === 'provider') {
            this.validateProviderDefinition(definition);
            this.registerProvider(definition);
          }
        } catch {
          // If file doesn't exist or isn't valid YAML, skip silently
          // Not all provider directories will have provider definitions
        }
      }

      return this.providers;
    } catch (error) {
      throw new MatimoError(
        'Failed to load OAuth2 provider definitions',
        ErrorCode.TOOL_NOT_FOUND,
        {
          toolsPath: this.toolsPath,
          error: (error as Error).message,
        }
      );
    }
  }

  /**
   * Get endpoints for a specific provider
   * @param providerName - Name of the provider (e.g., 'google', 'github')
   * @returns OAuth2Endpoints or undefined if provider not found
   */
  getProvider(providerName: string): OAuth2Endpoints | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Get full provider definition
   * @param providerName - Name of the provider
   * @returns ProviderDefinition or undefined if provider not found
   */
  getDefinition(providerName: string): ProviderDefinition | undefined {
    return this.definitions.get(providerName);
  }

  /**
   * List all loaded providers
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Validate provider definition structure using Zod schema
   */
  protected validateProviderDefinition(definition: ProviderDefinition): void {
    try {
      // Use Zod schema validation for consistency with tool validation
      validateProviderDefinition(definition);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MatimoError(`Provider validation failed: ${message}`, ErrorCode.INVALID_SCHEMA);
    }
  }

  /**
   * Register a provider definition
   */
  private registerProvider(definition: ProviderDefinition): void {
    const providerName = definition.provider.name;

    this.providers.set(providerName, definition.provider.endpoints);
    this.definitions.set(providerName, definition);
  }
}
