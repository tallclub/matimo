import { getGlobalMatimoLogger } from '@matimo/core';
import { execFileSync } from 'child_process';
import * as path from 'path';

const logger = getGlobalMatimoLogger();

export default async function execute(params: Record<string, unknown>): Promise<unknown> {
  const collectionPath = params.collection_path as string;
  const requestName = params.request_name as string;

  if (!collectionPath || !requestName) {
    return {
      success: false,
      request: requestName ?? '',
      status: 0,
      response_time: 0,
      errors: ['collection_path and request_name parameters are required'],
    };
  }

  const absolutePath = path.resolve(collectionPath);
  const bruFilename = `${requestName.toLowerCase().replace(/\s+/g, '-')}.bru`;

  try {
    logger.info(`Running request: ${requestName} from ${absolutePath}`);

    const args: string[] = ['run', bruFilename];

    if (params.environment) args.push('--env', params.environment as string);
    if (params.env_file) args.push('--env-file', params.env_file as string);
    args.push('--sandbox', (params.sandbox_mode as string) || 'safe');

    logger.debug(`Executing: bru ${args.join(' ')}`);

    const start = Date.now();
    let success = true;
    let stdout = '';
    try {
      stdout = execFileSync('bru', args, { encoding: 'utf-8', stdio: 'pipe', cwd: absolutePath });
    } catch (execError) {
      success = false;
      stdout = execError instanceof Error ? execError.message : String(execError);
    }
    const responseTime = Date.now() - start;

    // Parse status code from bru run output (e.g. "200 OK")
    const statusMatch = stdout.match(/\b([1-5]\d{2})\b/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : (success ? 200 : 0);

    return {
      success,
      request: requestName,
      status,
      response_time: responseTime,
      errors: success ? [] : [stdout],
    };
  } catch (error) {
    logger.error(
      `Request execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      success: false,
      request: requestName,
      status: 0,
      response_time: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
