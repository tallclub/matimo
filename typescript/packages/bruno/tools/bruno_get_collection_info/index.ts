import { getGlobalMatimoLogger } from '@matimo/core/runtime';
import { promises as fs } from 'fs';
import * as path from 'path';

const logger = getGlobalMatimoLogger();

interface RequestInfo {
  name: string;
  method: string;
  url: string;
  path: string;
  tags: string[];
  has_tests: boolean;
}

async function scanBruFiles(dir: string, results: RequestInfo[]): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory() && entry !== 'node_modules') {
        await scanBruFiles(fullPath, results);
      } else if (!stat.isDirectory() && entry.endsWith('.bru')) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const methodMatch = content.match(/^(get|post|put|patch|delete|head|options)\s*\{/im);
          const method = methodMatch ? methodMatch[1].toUpperCase() : 'UNKNOWN';
          const nameMatch = content.match(/meta\s*\{[^}]*name:\s*(.+)/i);
          const name = nameMatch ? nameMatch[1].trim() : path.basename(entry, '.bru');
          const urlMatch = content.match(/^\s+url:\s*(.+)$/m);
          const url = urlMatch ? urlMatch[1].trim() : '';
          const tagsMatch = content.match(/tags:\s*\[([^\]]*)\]/);
          const tags = tagsMatch
            ? tagsMatch[1].split(',').map((t) => t.trim()).filter(Boolean)
            : [];
          const hasTests = /\btests\s*\{/.test(content);
          results.push({ name, method, url, path: fullPath, tags, has_tests: hasTests });
        } catch {
          results.push({
            name: path.basename(entry, '.bru'),
            method: 'UNKNOWN',
            url: '',
            path: fullPath,
            tags: [],
            has_tests: false,
          });
        }
      }
    } catch {
      // skip
    }
  }
}

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

    // Verify the path exists before proceeding
    try {
      await fs.stat(absolutePath);
    } catch {
      return {
        success: false,
        collection: undefined,
        errors: [`Collection path not found: ${collectionPath}`],
      };
    }

    try {
      const raw = await fs.readFile(brunoJsonPath, 'utf-8');
      const parsed = JSON.parse(raw) as { name?: string };
      if (parsed.name) collectionName = parsed.name;
    } catch {
      // bruno.json missing — use dirname as name
    }

    const requests: RequestInfo[] = [];
    await scanBruFiles(absolutePath, requests);

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
