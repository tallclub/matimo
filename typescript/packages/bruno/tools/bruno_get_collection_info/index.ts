import { getGlobalMatimoLogger } from '@matimo/core';
import { promises as fs } from 'fs';
import * as path from 'path';

const logger = getGlobalMatimoLogger();

export default async function execute(params: Record<string, unknown>): Promise<unknown> {
  const collectionPath = params.collection_path as string;

  if (!collectionPath) {
    return {
      success: false,
      collection: undefined,
      errors: ['collection_path parameter is required'],
    };
  }

  try {
    logger.info(`Getting collection info: ${collectionPath}`);
    const absolutePath = path.resolve(collectionPath);

    const brunoJsonPath = path.join(absolutePath, 'bruno.json');
    let collectionName = path.basename(absolutePath);
    try {
      const raw = await fs.readFile(brunoJsonPath, 'utf-8');
      const parsed = JSON.parse(raw) as { name?: string };
      if (parsed.name) collectionName = parsed.name;
    } catch {
      // bruno.json missing — use dirname as name
    }

    const entries = await fs.readdir(absolutePath);
    const requests: Array<{ name: string; method: string; path: string }> = [];

    for (const entry of entries) {
      if (!entry.endsWith('.bru')) continue;
      const filePath = path.join(absolutePath, entry);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        // Parse method from first block that looks like: get { / post { / etc.
        const methodMatch = content.match(/^(get|post|put|patch|delete|head|options)\s*\{/im);
        const method = methodMatch ? methodMatch[1].toUpperCase() : 'UNKNOWN';
        // Parse name from meta block
        const nameMatch = content.match(/meta\s*\{[^}]*name:\s*(.+)/i);
        const name = nameMatch ? nameMatch[1].trim() : path.basename(entry, '.bru');
        requests.push({ name, method, path: filePath });
      } catch {
        requests.push({ name: path.basename(entry, '.bru'), method: 'UNKNOWN', path: filePath });
      }
    }

    return {
      success: true,
      collection: {
        name: collectionName,
        path: absolutePath,
        requests,
      },
    };
  } catch (error) {
    logger.error(
      `Get collection info failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      success: false,
      collection: undefined,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
