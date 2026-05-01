import { getGlobalMatimoLogger } from '@matimo/core';
import { promises as fs } from 'fs';
import * as path from 'path';

const logger = getGlobalMatimoLogger();

async function countBruFilesRecursively(dir: string): Promise<number> {
  let count = 0;
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory() && entry !== 'node_modules') {
        count += await countBruFilesRecursively(fullPath);
      } else if (!stat.isDirectory() && entry.endsWith('.bru')) {
        count++;
      }
    } catch {
      // skip
    }
  }
  return count;
}

async function findCollections(
  dir: string
): Promise<Array<{ name: string; path: string; request_count: number }>> {
  const results: Array<{ name: string; path: string; request_count: number }> = [];
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return results;
  }

  if (entries.includes('bruno.json')) {
    const brunoJsonPath = path.join(dir, 'bruno.json');
    let name = path.basename(dir);
    try {
      const raw = await fs.readFile(brunoJsonPath, 'utf-8');
      const parsed = JSON.parse(raw) as { name?: string };
      if (parsed.name) name = parsed.name;
    } catch {
      // use dirname
    }
    // Count .bru files recursively so nested requests are included
    const requestCount = await countBruFilesRecursively(dir);
    results.push({ name, path: dir, request_count: requestCount });
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory() && entry !== 'node_modules') {
        const nested = await findCollections(fullPath);
        results.push(...nested);
      }
    } catch {
      // skip
    }
  }

  return results;
}

export default async function execute(params: Record<string, unknown>): Promise<unknown> {
  const workspacePath = params.workspace_path as string;

  if (!workspacePath) {
    return { success: false, collections: [], errors: ['workspace_path parameter is required'] };
  }

  try {
    logger.info(`Listing collections in: ${workspacePath}`);
    const absolutePath = path.resolve(workspacePath);
    let collections = await findCollections(absolutePath);

    if (params.filter) {
      const filter = (params.filter as string).toLowerCase();
      collections = collections.filter((c) => c.name.toLowerCase().includes(filter));
    }

    return { success: true, collections };
  } catch (error) {
    logger.error(
      `List collections failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      success: false,
      collections: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
