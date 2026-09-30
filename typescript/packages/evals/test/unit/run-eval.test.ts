import path from 'path';
import { runToolSelectionEval, printReport, hasFailures } from '../../src/tool-selection/run-eval';

const FIXTURES_ROOT = path.join(__dirname, '../fixtures');

describe('runToolSelectionEval', () => {
  it('passes cleanly against a well-formed corpus and fixture set', async () => {
    const result = await runToolSelectionEval(path.join(FIXTURES_ROOT, 'packages'));
    expect(result.toolCorpusSize).toBe(3);
    expect(result.fixtureCount).toBe(3);
    expect(result.caseCount).toBe(3);
    expect(result.unknownTools).toEqual([]);
    expect(result.paramMismatches).toEqual([]);
    expect(result.aggregate.failures).toEqual([]);
    expect(result.aggregate.precision).toBe(1);
  });

  it('flags a fixture whose tool is not in the corpus', async () => {
    const result = await runToolSelectionEval(path.join(FIXTURES_ROOT, 'packages-unknown-tool'));
    expect(result.unknownTools).toHaveLength(1);
    expect(result.unknownTools[0]).toContain('demo-get-widget');
    // Cases for unknown-tool fixtures are skipped, not scored.
    expect(result.caseCount).toBe(0);
  });

  it('flags expected_required_params not actually required on the tool', async () => {
    const result = await runToolSelectionEval(path.join(FIXTURES_ROOT, 'packages-param-mismatch'));
    expect(result.paramMismatches).toHaveLength(1);
    expect(result.paramMismatches[0].missingFromSchema).toEqual(['not_a_real_param']);
  });

  it('flags a case whose expected tool misses its recall band', async () => {
    const result = await runToolSelectionEval(path.join(FIXTURES_ROOT, 'packages-recall-miss'));
    expect(result.aggregate.failures).toHaveLength(1);
    expect(result.aggregate.failures[0].expectedTool).toBe('demo-get-widget');
    expect(result.aggregate.failures[0].rank).not.toBe(1);
  });
});

describe('hasFailures', () => {
  it('is false for a clean result', async () => {
    const result = await runToolSelectionEval(path.join(FIXTURES_ROOT, 'packages'));
    expect(hasFailures(result)).toBe(false);
  });

  it('is true when unknown tools, param mismatches, or recall misses are present', async () => {
    expect(
      hasFailures(await runToolSelectionEval(path.join(FIXTURES_ROOT, 'packages-unknown-tool')))
    ).toBe(true);
    expect(
      hasFailures(await runToolSelectionEval(path.join(FIXTURES_ROOT, 'packages-param-mismatch')))
    ).toBe(true);
    expect(
      hasFailures(await runToolSelectionEval(path.join(FIXTURES_ROOT, 'packages-recall-miss')))
    ).toBe(true);
  });
});

describe('printReport', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('prints a passing summary with no error output', async () => {
    const result = await runToolSelectionEval(path.join(FIXTURES_ROOT, 'packages'));
    printReport(result);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.flat().join('\n')).toContain('Tool-selection eval passed');
  });

  it('prints unknown-tool, param-mismatch, and recall-miss diagnostics', async () => {
    const unknown = await runToolSelectionEval(path.join(FIXTURES_ROOT, 'packages-unknown-tool'));
    printReport(unknown);
    expect(errorSpy.mock.calls.flat().join('\n')).toContain('not found in the corpus');

    errorSpy.mockClear();
    const mismatch = await runToolSelectionEval(
      path.join(FIXTURES_ROOT, 'packages-param-mismatch')
    );
    printReport(mismatch);
    expect(errorSpy.mock.calls.flat().join('\n')).toContain('not required in schema');

    errorSpy.mockClear();
    const recallMiss = await runToolSelectionEval(path.join(FIXTURES_ROOT, 'packages-recall-miss'));
    printReport(recallMiss);
    expect(errorSpy.mock.calls.flat().join('\n')).toContain('missed their recall band');
    expect(logSpy.mock.calls.flat().join('\n')).toContain('Tool-selection eval failed');
  });
});
