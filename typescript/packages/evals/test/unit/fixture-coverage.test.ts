import path from 'path';
import { loadToolCorpus } from '../../src/tool-selection/tool-corpus';
import { loadFixtures } from '../../src/tool-selection/fixtures';

// The real, live workspace catalog — not test/fixtures — since this test's whole
// point is confirming coverage of the actual tools shipping in this repo.
const PACKAGES_DIR = path.join(__dirname, '../../../');

/**
 * Composio's ~450 auto-routed tools are excluded from the coverage
 * requirement for now — hand-authoring fixtures for all of them is tracked
 * as a follow-up, not done in this pass. Every hand-authored provider
 * package must have 100% fixture coverage, mirroring the add-tool skill's
 * 100%-unit-coverage mandate.
 */
const EXCLUDED_PACKAGES = new Set(['composio']);

describe('fixture coverage', () => {
  it('has an eval fixture for every hand-authored tool', async () => {
    const tools = await loadToolCorpus(PACKAGES_DIR);
    const fixtures = await loadFixtures(PACKAGES_DIR);
    const fixturedToolNames = new Set(fixtures.map((f) => f.tool));

    const missing = tools
      .filter((t) => !EXCLUDED_PACKAGES.has(t.packageName))
      .filter((t) => !fixturedToolNames.has(t.definition.name))
      .map((t) => `${t.packageName}/${t.definition.name}`)
      .sort();

    expect(missing).toEqual([]);
  });

  it('does not silently exclude everything (sanity check on the exclusion list)', async () => {
    const tools = await loadToolCorpus(PACKAGES_DIR);
    const nonExcludedTools = tools.filter((t) => !EXCLUDED_PACKAGES.has(t.packageName));
    const composioTools = tools.filter((t) => t.packageName === 'composio');

    // If either of these is ever 0, the exclusion list (or the corpus glob) is broken.
    expect(nonExcludedTools.length).toBeGreaterThan(0);
    expect(composioTools.length).toBeGreaterThan(0);
  });
});
