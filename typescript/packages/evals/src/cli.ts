#!/usr/bin/env node
/**
 * Thin CLI entrypoint for `pnpm eval:tool-selection`.
 *
 * Kept separate from tool-selection/run-eval.ts (which holds all the
 * testable logic) because `import.meta.url` can't be transpiled to the
 * CommonJS output ts-jest produces — same split as packages/cli/src/bin.ts.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { runToolSelectionEval, printReport, hasFailures } from './tool-selection/run-eval.js';

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const packagesDir = path.resolve(__dirname, '../../');

  const result = await runToolSelectionEval(packagesDir);
  printReport(result);
  process.exit(hasFailures(result) ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
