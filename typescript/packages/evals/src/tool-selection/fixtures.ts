import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import * as yaml from 'js-yaml';

export interface EvalCase {
  prompt: string;
  expected_required_params?: string[];
  /** Recall band: expected tool must rank within the top K, not strictly top-1. Defaults to 1 (strict). */
  top_k?: number;
}

export interface EvalFixture {
  tool: string;
  cases: EvalCase[];
}

export interface LoadedFixture extends EvalFixture {
  packageName: string;
  fixturePath: string;
}

function isEvalFixture(value: unknown): value is EvalFixture {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.tool === 'string' && Array.isArray(record.cases);
}

/**
 * Load every `*.eval.yaml` fixture co-located under `packages/<provider>/evals/`,
 * mirroring how `packages/<provider>/test/unit/` sits alongside each provider
 * rather than centralizing fixtures away from the tools they cover.
 */
export async function loadFixtures(packagesDir: string): Promise<LoadedFixture[]> {
  const files = await glob('*/evals/*.eval.yaml', { cwd: packagesDir, absolute: true });
  const fixtures: LoadedFixture[] = [];

  for (const file of files.sort()) {
    const parsed = yaml.load(fs.readFileSync(file, 'utf-8'));
    if (!isEvalFixture(parsed)) {
      throw new Error(`Invalid eval fixture (expected { tool, cases[] }): ${file}`);
    }
    const packageName = path.relative(packagesDir, file).split(path.sep)[0];
    fixtures.push({ ...parsed, packageName, fixturePath: file });
  }

  return fixtures;
}
