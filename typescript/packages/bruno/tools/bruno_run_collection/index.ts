import { getGlobalMatimoLogger } from '@matimo/core';
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { checkBruVersion } from '../bru-utils';

const logger = getGlobalMatimoLogger();

export default async function execute(params: Record<string, unknown>): Promise<unknown> {
  const collectionPath = params.collection_path as string;

  if (!collectionPath) {
    return {
      success: false,
      summary: { total: 0, passed: 0, failed: 0, duration: 0 },
      results: [],
      errors: ['collection_path parameter is required'],
    };
  }

  checkBruVersion();

  const absolutePath = path.resolve(collectionPath);
  const reportPath = path.resolve((params.report_path as string | undefined) ?? path.join(os.tmpdir(), `bru-report-${Date.now()}.json`));

  try {
    logger.info(`Running Bruno collection: ${absolutePath}`);

    const args: string[] = ['run', '.', '-r', '--reporter-json', reportPath];

    if (params.environment) args.push('--env', params.environment as string);
    if (params.env_file) args.push('--env-file', params.env_file as string);
    if (params.data_file) args.push('--csv-file-path', params.data_file as string);
    if (params.iteration_count) args.push('--iteration-count', String(params.iteration_count));
    if (params.delay_ms) args.push('--delay', String(params.delay_ms));
    if (params.tags) args.push('--tags', params.tags as string);
    if (params.exclude_tags) args.push('--exclude-tags', params.exclude_tags as string);
    if (params.tests_only === true) args.push('--tests-only');
    if (params.bail_on_failure === true) args.push('--bail');
    if (params.parallel === true) args.push('--parallel');
    args.push('--sandbox', (params.sandbox_mode as string) || 'safe');

    logger.debug(`Executing: bru ${args.join(' ')}`);

    let exitCode = 0;
    try {
      execFileSync('bru', args, { encoding: 'utf-8', stdio: 'pipe', cwd: absolutePath });
    } catch (execError) {
      // bru exits non-zero when tests fail — that's OK, we still read the report
      exitCode = 1;
      logger.warn(`bru run exited with non-zero status: ${execError instanceof Error ? execError.message : String(execError)}`);
    }

    // Read JSON report written by --reporter-json
    let reportData: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(reportPath, 'utf-8');
      reportData = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      logger.warn('Could not read/parse JSON report');
    }

    // Map Bruno report fields to expected shape
    const summaryRaw = (reportData.summary as Record<string, number> | undefined) ?? {};
    const total = (summaryRaw.totalRequests ?? 0) as number;
    const passed = (summaryRaw.passedRequests ?? 0) as number;
    const failed = (summaryRaw.failedRequests ?? 0) as number;
    const duration = (summaryRaw.totalTime ?? 0) as number;

    const rawResults = (reportData.results as unknown[]) ?? [];
    const results = rawResults.map((r) => {
      const req = r as Record<string, unknown>;
      return {
        name: req.suiteName ?? req.name ?? 'unknown',
        success: req.status === 'pass' || req.passed === true,
        status: (req.response as Record<string, unknown> | undefined)?.status ?? 0,
      };
    });

    return {
      success: exitCode === 0,
      summary: { total, passed, failed, duration },
      results,
      report_path: reportPath,
      errors: [],
    };
  } catch (error) {
    logger.error(
      `Collection execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      success: false,
      summary: { total: 0, passed: 0, failed: 0, duration: 0 },
      results: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
