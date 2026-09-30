import path from 'path';
import { loadToolCorpus, toCorpusEntry } from '../../src/tool-selection/tool-corpus';

const FIXTURES_DIR = path.join(__dirname, '../fixtures/packages');

describe('loadToolCorpus', () => {
  it('loads and validates every definition.yaml under packages/*/tools/', async () => {
    const tools = await loadToolCorpus(FIXTURES_DIR);
    const names = tools.map((t) => t.definition.name).sort();
    expect(names).toEqual(['demo-get-widget', 'demo-list-widgets', 'demo-send-widget']);
  });

  it('records which package each tool came from', async () => {
    const tools = await loadToolCorpus(FIXTURES_DIR);
    expect(tools.every((t) => t.packageName === 'demo')).toBe(true);
  });

  it('skips provider-level definition.yaml files (type: provider)', async () => {
    const tools = await loadToolCorpus(path.join(__dirname, '../fixtures/packages-provider-skip'));
    expect(tools.map((t) => t.definition.name)).toEqual(['demo-get-widget']);
  });
});

describe('toCorpusEntry', () => {
  it('flattens name, description, and parameter descriptions', async () => {
    const [tool] = await loadToolCorpus(FIXTURES_DIR);
    const entry = toCorpusEntry(tool.definition);
    expect(entry.name).toBe(tool.definition.name);
    expect(entry.description).toBe(tool.definition.description);
    expect(entry.parameterDescriptions.length).toBeGreaterThan(0);
  });

  it('handles a tool with no parameters', () => {
    const entry = toCorpusEntry({
      name: 'no-params-tool',
      description: 'A tool with no parameters.',
      version: '1.0.0',
      execution: { type: 'http', method: 'GET', url: 'https://example.com' },
    });
    expect(entry.parameterDescriptions).toEqual([]);
  });
});
