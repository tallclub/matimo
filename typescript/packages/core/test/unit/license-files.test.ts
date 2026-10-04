import * as fs from 'fs';
import * as path from 'path';

/**
 * npm and PyPI package only what sits inside a package directory, so each published
 * package keeps its own copy of the root LICENSE. This fails when a copy drifts or is missing.
 */
describe('LICENSE files', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const license = fs.readFileSync(path.join(repoRoot, 'LICENSE'), 'utf8');

  const dirs = [
    path.join(repoRoot, 'typescript'),
    ...fs
      .readdirSync(path.join(repoRoot, 'typescript/packages'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(repoRoot, 'typescript/packages', e.name))
      .filter((d) => fs.existsSync(path.join(d, 'package.json'))),
    ...fs
      .readdirSync(path.join(repoRoot, 'python/packages'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(repoRoot, 'python/packages', e.name))
      .filter((d) => fs.existsSync(path.join(d, 'pyproject.toml'))),
  ];

  it.each(dirs.map((d) => [path.relative(repoRoot, d), d]))(
    '%s has the root LICENSE',
    (_name, dir) => {
      expect(fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8')).toBe(license);
    }
  );
});
