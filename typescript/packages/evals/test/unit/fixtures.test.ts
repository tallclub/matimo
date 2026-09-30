import path from 'path';
import fs from 'fs';
import os from 'os';
import { loadFixtures } from '../../src/tool-selection/fixtures';

const FIXTURES_DIR = path.join(__dirname, '../fixtures/packages');

describe('loadFixtures', () => {
  it('loads every *.eval.yaml co-located under packages/*/evals/', async () => {
    const fixtures = await loadFixtures(FIXTURES_DIR);
    const tools = fixtures.map((f) => f.tool).sort();
    expect(tools).toEqual(['demo-get-widget', 'demo-list-widgets', 'demo-send-widget']);
  });

  it('records which package and file path each fixture came from', async () => {
    const fixtures = await loadFixtures(FIXTURES_DIR);
    expect(fixtures.every((f) => f.packageName === 'demo')).toBe(true);
    expect(fixtures.every((f) => f.fixturePath.endsWith('.eval.yaml'))).toBe(true);
  });

  it('rejects a fixture file missing tool/cases', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-evals-fixtures-'));
    const pkgEvalsDir = path.join(dir, 'demo', 'evals');
    fs.mkdirSync(pkgEvalsDir, { recursive: true });
    fs.writeFileSync(path.join(pkgEvalsDir, 'broken.eval.yaml'), 'not_a_tool_field: true\n');

    await expect(loadFixtures(dir)).rejects.toThrow('Invalid eval fixture');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects a fixture file that parses to null', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-evals-fixtures-'));
    const pkgEvalsDir = path.join(dir, 'demo', 'evals');
    fs.mkdirSync(pkgEvalsDir, { recursive: true });
    fs.writeFileSync(path.join(pkgEvalsDir, 'null.eval.yaml'), 'null\n');

    await expect(loadFixtures(dir)).rejects.toThrow('Invalid eval fixture');

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
