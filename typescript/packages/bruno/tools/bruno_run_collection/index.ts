import { getGlobalMatimoLogger } from '@matimo/core/runtime';
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { checkBruVersion } from '../bru-utils.js';

const logger = getGlobalMatimoLogger();

export default async function execute(params: Record<string, unknown>): Promise<unknown> {
  const collectionPath = params.collection_path as string;

  if (!collectionPath) {
    return {
      success: false,
      summary: { total_requests: 0, passed: 0, failed: 0, execution_time_ms: 0 },
      results: [],
      errors: ['collection_path parameter is required'],
    };
  }

  checkBruVersion();

  const absolutePath = path.resolve(collectionPath);
  const reportPath = path.resolve(
    (params.report_path as string | undefined) ??
      path.join(os.tmpdir(), `bru-report-${Date.now()}.json`)
  );

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
      logger.warn(
        `bru run exited with non-zero status: ${execError instanceof Error ? execError.message : String(execError)}`
      );
    }

    // Read JSON report written by --reporter-json
    let reportData: unknown = {};
    try {
      const raw = await fs.readFile(reportPath, 'utf-8');
      reportData = JSON.parse(raw) as unknown;
    } catch {
      logger.warn('Could not read/parse JSON report');
    }

    const { totalRequests, passed, failed, executionTimeMs, results } = parseReport(reportData);

    return {
      success: exitCode === 0,
      summary: {
        total_requests: totalRequests,
        passed,
        failed,
        execution_time_ms: executionTimeMs,
      },
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
      summary: { total_requests: 0, passed: 0, failed: 0, execution_time_ms: 0 },
      results: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

type Row = Record<string, unknown>;

/**
 * Map a bru JSON report to the schema's summary and results.
 * bru 1.x/2.x write one object `{ summary, results }`. bru 3.x writes an array
 * with one such object per iteration; counts are summed across iterations.
 */
export function parseReport(report: unknown): {
  totalRequests: number;
  passed: number;
  failed: number;
  executionTimeMs: number;
  results: Array<{ name: unknown; success: boolean; status: unknown }>;
} {
  const isRow = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
  const iterations: Row[] = Array.isArray(report)
    ? report.filter(isRow)
    : isRow(report) && Object.keys(report).length > 0
      ? [report]
      : [];
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

  let totalRequests = 0;
  let passed = 0;
  let failed = 0;
  let timeMs = 0;
  const results: Array<{ name: unknown; success: boolean; status: unknown }> = [];
  for (const iteration of iterations) {
    const summary = isRow(iteration.summary) ? iteration.summary : {};
    totalRequests += num(summary.totalRequests);
    passed += num(summary.passedRequests);
    failed += num(summary.failedRequests) + num(summary.errorRequests);
    const rows = (Array.isArray(iteration.results) ? iteration.results : []).filter(isRow);
    // bru 3 has no totalTime; runDuration is per request, in seconds.
    timeMs +=
      'totalTime' in summary
        ? num(summary.totalTime)
        : rows.reduce((sum, r) => sum + num(r.runDuration), 0) * 1000;
    for (const r of rows) {
      const test = isRow(r.test) ? r.test : {};
      results.push({
        name: r.suitename ?? r.suiteName ?? r.name ?? test.filename ?? 'unknown',
        success: r.status === 'pass' || r.passed === true,
        status: (isRow(r.response) ? r.response.status : undefined) ?? 0,
      });
    }
  }
  return { totalRequests, passed, failed, executionTimeMs: Math.round(timeMs), results };
}
