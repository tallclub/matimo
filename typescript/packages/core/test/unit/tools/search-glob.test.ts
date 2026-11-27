/**
 * Exercises the search tool's real glob walk (file pattern + exclude patterns),
 * so a glob major-version upgrade is covered end to end, not just the YAML.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import searchTool from '../../../tools/search/search';
import { ErrorCode } from '../../../src/errors/matimo-error';

describe('search tool glob walk', () => {
  let base: string;

  beforeEach(() => {
    base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-search-glob-')));
    fs.mkdirSync(path.join(base, 'src', 'nested'), { recursive: true });
    fs.mkdirSync(path.join(base, 'vendor'));
    fs.writeFileSync(path.join(base, 'src', 'a.ts'), 'const NEEDLE = 1;\n');
    fs.writeFileSync(path.join(base, 'src', 'nested', 'b.ts'), 'export const NEEDLE = 2;\n');
    fs.writeFileSync(path.join(base, 'src', 'c.md'), 'NEEDLE in markdown\n');
    fs.writeFileSync(path.join(base, 'vendor', 'd.ts'), 'NEEDLE in vendor\n');
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  const relFiles = (r: { matches: { filePath: string }[] }) =>
    r.matches.map((m) => path.relative(base, m.filePath).split(path.sep).join('/')).sort();

  it('matches files by pattern across nested directories', async () => {
    const result = await searchTool({ query: 'NEEDLE', directory: base, filePattern: '**/*.ts' });
    expect(result.success).toBe(true);
    expect(relFiles(result)).toEqual(['src/a.ts', 'src/nested/b.ts', 'vendor/d.ts']);
  });

  it('honours excludePatterns', async () => {
    const result = await searchTool({
      query: 'NEEDLE',
      directory: base,
      filePattern: '**/*.ts',
      excludePatterns: ['**/vendor/**', '**/nested/**'],
    });
    expect(relFiles(result)).toEqual(['src/a.ts']);
  });

  it('supports brace patterns', async () => {
    const result = await searchTool({
      query: 'NEEDLE',
      directory: base,
      filePattern: 'src/*.{ts,md}',
    });
    expect(relFiles(result)).toEqual(['src/a.ts', 'src/c.md']);
  });

  it('returns no matches when the pattern matches no files', async () => {
    const result = await searchTool({ query: 'NEEDLE', directory: base, filePattern: '**/*.py' });
    expect(result.matches).toEqual([]);
    expect(result.filesSearched).toBe(0);
  });

  it('rejects a missing directory before walking', async () => {
    await expect(
      searchTool({ query: 'NEEDLE', directory: path.join(base, 'nope') })
    ).rejects.toMatchObject({ code: ErrorCode.FILE_NOT_FOUND });
  });
});
