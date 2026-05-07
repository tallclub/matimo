/**
 * Dotenv Secret Resolver
 *
 * Reads secrets from a .env file. Does NOT mutate process.env —
 * the resolver chain handles merging and priority.
 * For local development convenience only.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve as resolvePath } from 'path';
import type { SecretResolver } from './types.js';
import { getGlobalMatimoLogger } from '../../logging/index.js';

/**
 * Parse a .env file into key-value pairs.
 * Handles quotes, comments, and empty lines.
 */
function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = line.substring(0, eqIndex).trim();
    let value = line.substring(eqIndex + 1).trim();

    // Remove surrounding quotes (single or double)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

export class DotenvSecretResolver implements SecretResolver {
  readonly name = 'dotenv';
  private cache: Record<string, string> | null = null;
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? resolvePath(process.cwd(), '.env');
  }

  private loadFile(): Record<string, string> {
    if (this.cache !== null) {
      return this.cache;
    }

    if (!existsSync(this.filePath)) {
      const logger = getGlobalMatimoLogger();
      logger.debug(`Dotenv file not found: ${this.filePath}`, { resolver: this.name });
      this.cache = {};
      return this.cache;
    }

    try {
      const content = readFileSync(this.filePath, 'utf-8');
      this.cache = parseDotenv(content);
    } catch (error) {
      const logger = getGlobalMatimoLogger();
      logger.warn(`Failed to read dotenv file: ${this.filePath}`, {
        resolver: this.name,
        error: error instanceof Error ? error.message : String(error),
      });
      this.cache = {};
    }

    return this.cache;
  }

  async resolve(key: string): Promise<string | undefined> {
    const data = this.loadFile();
    // Check both MATIMO_ prefixed and raw key (same logic as env resolver)
    return data[`MATIMO_${key}`] ?? data[key];
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

  /**
   * Return all key-value pairs from the .env file.
   * Used by seedProcessEnv() to eagerly populate process.env.
   */
  getAllEntries(): Record<string, string> {
    return { ...this.loadFile() };
  }
}
