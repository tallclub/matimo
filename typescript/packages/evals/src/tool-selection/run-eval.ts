import { ToolSelectionMatcher } from './tool-selection-matcher.js';
import { loadToolCorpus, toCorpusEntry, LoadedTool } from './tool-corpus.js';
import { loadFixtures } from './fixtures.js';
import {
  scoreCase,
  aggregateScores,
  CaseScore,
  AggregateScore,
} from '../scoring/precision-recall.js';

export interface RequiredParamMismatch {
  tool: string;
  packageName: string;
  fixturePath: string;
  missingFromSchema: string[]; // declared in fixture as required, but not required:true on the tool
}

export interface ToolSelectionEvalResult {
  toolCorpusSize: number;
  fixtureCount: number;
  caseCount: number;
  scores: CaseScore[];
  aggregate: AggregateScore;
  unknownTools: string[]; // fixtures whose `tool:` doesn't match any loaded tool
  paramMismatches: RequiredParamMismatch[];
}

/**
 * Deterministic tool-selection eval: rank every fixture prompt against the
 * full, live tool catalog (glob'd fresh each run, never hand-maintained) and
 * assert each fixture's own tool clears its recall band. Also cross-checks
 * `expected_required_params` against the tool's actual schema — a pure
 * structural check, no matcher involved.
 */
export async function runToolSelectionEval(packagesDir: string): Promise<ToolSelectionEvalResult> {
  const tools = await loadToolCorpus(packagesDir);
  const toolsByName = new Map<string, LoadedTool>(tools.map((t) => [t.definition.name, t]));
  const matcher = new ToolSelectionMatcher(tools.map((t) => toCorpusEntry(t.definition)));

  const fixtures = await loadFixtures(packagesDir);

  const scores: CaseScore[] = [];
  const unknownTools: string[] = [];
  const paramMismatches: RequiredParamMismatch[] = [];

  for (const fixture of fixtures) {
    const tool = toolsByName.get(fixture.tool);
    if (!tool) {
      unknownTools.push(`${fixture.packageName}: ${fixture.tool} (${fixture.fixturePath})`);
      continue;
    }

    const requiredParams = new Set(
      Object.entries(tool.definition.parameters ?? {})
        .filter(([, p]) => p.required)
        .map(([name]) => name)
    );

    for (const evalCase of fixture.cases) {
      const missingFromSchema = (evalCase.expected_required_params ?? []).filter(
        (p) => !requiredParams.has(p)
      );
      if (missingFromSchema.length > 0) {
        paramMismatches.push({
          tool: fixture.tool,
          packageName: fixture.packageName,
          fixturePath: fixture.fixturePath,
          missingFromSchema,
        });
      }

      const ranked = matcher.rank(evalCase.prompt);
      scores.push(scoreCase(evalCase.prompt, fixture.tool, ranked, evalCase.top_k ?? 1));
    }
  }

  return {
    toolCorpusSize: tools.length,
    fixtureCount: fixtures.length,
    caseCount: scores.length,
    scores,
    aggregate: aggregateScores(scores),
    unknownTools,
    paramMismatches,
  };
}

export function printReport(result: ToolSelectionEvalResult): void {
  const { aggregate } = result;
  console.info(`Matimo tool-selection eval — tool-selection & argument correctness\n`);
  console.info(`Tool corpus:  ${result.toolCorpusSize} tools`);
  console.info(`Fixtures:     ${result.fixtureCount}`);
  console.info(`Cases:        ${result.caseCount}`);
  console.info(
    `Precision:    ${(aggregate.precision * 100).toFixed(1)}% (${aggregate.precisionHits}/${aggregate.total} top-1)`
  );
  console.info(
    `Recall:       ${(aggregate.recall * 100).toFixed(1)}% (${aggregate.recallHits}/${aggregate.total} within top-K)\n`
  );

  if (result.unknownTools.length > 0) {
    console.error(
      `❌ ${result.unknownTools.length} fixture(s) reference a tool not found in the corpus:`
    );
    for (const entry of result.unknownTools) console.error(`   - ${entry}`);
    console.error('');
  }

  if (result.paramMismatches.length > 0) {
    console.error(
      `❌ ${result.paramMismatches.length} fixture(s) declare expected_required_params not required in schema:`
    );
    for (const m of result.paramMismatches) {
      console.error(
        `   - ${m.packageName}/${m.tool}: ${m.missingFromSchema.join(', ')} (${m.fixturePath})`
      );
    }
    console.error('');
  }

  if (aggregate.failures.length > 0) {
    console.error(`❌ ${aggregate.failures.length} case(s) missed their recall band:`);
    for (const f of aggregate.failures) {
      console.error(
        `   - "${f.prompt}" → expected "${f.expectedTool}" within top-${f.topK}, ranked #${f.rank === -1 ? '∞' : f.rank}`
      );
    }
    console.error('');
  }

  const ok =
    aggregate.failures.length === 0 &&
    result.unknownTools.length === 0 &&
    result.paramMismatches.length === 0;
  console.info(ok ? '✅ Tool-selection eval passed.' : '❌ Tool-selection eval failed.');
}

/** True when the aggregate result should fail the run (unknown tools, param mismatches, or recall misses). */
export function hasFailures(result: ToolSelectionEvalResult): boolean {
  return (
    result.aggregate.failures.length > 0 ||
    result.unknownTools.length > 0 ||
    result.paramMismatches.length > 0
  );
}
