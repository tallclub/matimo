import { getGlobalMatimoLogger } from '@matimo/core/runtime';
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { checkBruVersion } from '../bru-utils.js';

const logger = getGlobalMatimoLogger();

/** Search recursively for a .bru file matching the given slug, return path relative to root. */
async function findBruFile(root: string, slug: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch {
    return null;
  }
  if (entries.includes(`${slug}.bru`)) {
    return `${slug}.bru`;
  }
  for (const entry of entries) {
    const fullPath = path.join(root, entry);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory() && entry !== 'node_modules') {
        const found = await findBruFile(fullPath, slug);
        if (found) return path.join(entry, found);
      }
    } catch {
      // skip
    }
  }
  return null;
}

export default async function execute(params: Record<string, unknown>): Promise<unknown> {
  const collectionPath = params.collection_path as string;
  const requestName = params.request_name as string;

  if (!collectionPath || !requestName) {
    return {
      success: false,
      request: requestName ?? '',
      status: 0,
      duration_ms: 0,
      errors: ['collection_path and request_name parameters are required'],
    };
  }

  checkBruVersion();

  const absolutePath = path.resolve(collectionPath);
  const slug = requestName.toLowerCase().replace(/\s+/g, '-');

  try {
    logger.info(`Running request: ${requestName} from ${absolutePath}`);

    // Locate the .bru file (may be in a requests/ subfolder)
    const bruRelPath = (await findBruFile(absolutePath, slug)) ?? `${slug}.bru`;

    const args: string[] = ['run', bruRelPath];

    if (params.environment) args.push('--env', params.environment as string);
    if (params.env_file) args.push('--env-file', params.env_file as string);
    args.push('--sandbox', (params.sandbox_mode as string) || 'safe');

    logger.debug(`Executing: bru ${args.join(' ')}`);

    const start = Date.now();
    let success = true;
    let output = '';
    try {
      output = execFileSync('bru', args, { encoding: 'utf-8', stdio: 'pipe', cwd: absolutePath });
    } catch (execError) {
      success = false;
      // Extract stdout/stderr from the error so assertion failures are visible
      const err = execError as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
      output = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n');
    }
    const durationMs = Date.now() - start;

    // Parse status code from bru run output (e.g. "200 OK")
    const statusMatch = output.match(/\b([1-5]\d{2})\b/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : (success ? 200 : 0);

    return {
      success,
      request: requestName,
      status,
      duration_ms: durationMs,
      errors: success ? [] : [output],
    };
  } catch (error) {
    logger.error(
      `Request execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      success: false,
      request: requestName,
      status: 0,
      duration_ms: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
