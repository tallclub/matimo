/**
 * Environment Variable Secret Resolver
 *
 * Default resolver — reads secrets from process.env.
 * Checks MATIMO_<KEY> first, then <KEY> directly.
 * This matches the existing injectAuthParameters() behavior.
 */

import type { SecretResolver } from './types';

export class EnvSecretResolver implements SecretResolver {
  readonly name = 'env';

  async resolve(key: string): Promise<string | undefined> {
    // Priority: MATIMO_ prefixed → raw key
    return process.env[`MATIMO_${key}`] ?? process.env[key];
  }

  async resolveAll(keys: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const value = await this.resolve(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }
}
