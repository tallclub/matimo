import { getGlobalMatimoLogger } from '@matimo/core/runtime';
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { checkBruVersion } from '../bru-utils.js';

const logger = getGlobalMatimoLogger();

/** Count .bru files recursively — compatible with Node 18+. */
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

export default async function execute(params: Record<string, unknown>): Promise<unknown> {
  const specSource = params.spec_source as string;
  const outputDirectory = params.output_directory as string;

  if (!specSource || !outputDirectory) {
    return {
      success: false,
      collection_path: '',
      collection_name: '',
      requests_created: 0,
      message: 'spec_source and output_directory parameters are required',
      errors: ['spec_source and output_directory parameters are required'],
    };
  }

  checkBruVersion();

  const collectionName = (params.collection_name as string) || 'Imported Collection';
  const absoluteOutput = path.resolve(outputDirectory);

  try {
    logger.info(`Importing OpenAPI from: ${specSource} to ${absoluteOutput}`);

    const args: string[] = [
      'import', 'openapi',
      '--source', specSource,
      '--output', absoluteOutput,
      '--collection-name', collectionName,
    ];

    if (params.group_by) args.push('--group-by', params.group_by as string);
    if (params.insecure === true) args.push('--insecure');

    logger.debug(`Executing: bru ${args.join(' ')}`);

    execFileSync('bru', args, { encoding: 'utf-8', stdio: 'pipe' });

    logger.info('OpenAPI import completed');

    // Count generated .bru files using a Node 18-compatible recursive walk
    let requestsCreated = 0;
    try {
      requestsCreated = await countBruFilesRecursively(absoluteOutput);
    } catch {
      // best-effort count
    }

    return {
      success: true,
      collection_path: absoluteOutput,
      collection_name: collectionName,
      requests_created: requestsCreated,
      message: `Collection "${collectionName}" imported from OpenAPI spec`,
      errors: [],
    };
  } catch (error) {
    logger.error(
      `OpenAPI import failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      success: false,
      collection_path: absoluteOutput,
      collection_name: collectionName,
      requests_created: 0,
      message: 'Import failed',
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
