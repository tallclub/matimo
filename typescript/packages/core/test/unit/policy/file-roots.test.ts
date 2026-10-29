import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveToolPath, getFileRoots, FILE_ROOTS_ENV } from '../../../src/policy/file-roots';
import { ErrorCode } from '../../../src/errors/matimo-error';
import readTool from '../../../tools/read/read';
import editTool from '../../../tools/edit/edit';
import searchTool from '../../../tools/search/search';

describe('MATIMO_FILE_ROOTS confinement', () => {
  let base: string;
  let allowed: string;
  let outside: string;
  const saved = process.env[FILE_ROOTS_ENV];

  beforeEach(() => {
    base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-roots-')));
    allowed = path.join(base, 'allowed');
    outside = path.join(base, 'outside');
    fs.mkdirSync(allowed);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(allowed, 'ok.txt'), 'inside\n');
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'TOP SECRET\n');
    process.env[FILE_ROOTS_ENV] = allowed;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env[FILE_ROOTS_ENV];
    else process.env[FILE_ROOTS_ENV] = saved;
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('is off when unset or blank', () => {
    delete process.env[FILE_ROOTS_ENV];
    expect(getFileRoots()).toBeNull();
    process.env[FILE_ROOTS_ENV] = '   ';
    expect(getFileRoots()).toBeNull();
    expect(resolveToolPath(path.join(outside, 'secret.txt'))).toBe(path.join(outside, 'secret.txt'));
  });

  it('allows paths inside a root, including files that do not exist yet', () => {
    expect(resolveToolPath(path.join(allowed, 'ok.txt'))).toBe(path.join(allowed, 'ok.txt'));
    expect(() => resolveToolPath(path.join(allowed, 'new', 'deep', 'file.txt'))).not.toThrow();
  });

  it.each([
    ['outside the root', () => path.join(outside, 'secret.txt')],
    ['a dot-dot escape', () => path.join(allowed, '..', 'outside', 'secret.txt')],
    ['a sibling sharing the name prefix', () => path.join(base, 'allowed-evil', 'x.txt')],
  ])('refuses %s', (_label, make) => {
    expect(() => resolveToolPath(make())).toThrow(
      expect.objectContaining({ code: ErrorCode.POLICY_DENIED })
    );
  });

  it('refuses a symlink that points outside the root', () => {
    const link = path.join(allowed, 'link.txt');
    try {
      fs.symlinkSync(path.join(outside, 'secret.txt'), link);
    } catch {
      return; // symlinks need privileges on some platforms
    }
    expect(() => resolveToolPath(link)).toThrow(
      expect.objectContaining({ code: ErrorCode.POLICY_DENIED })
    );
  });

  it('supports several roots separated by the platform delimiter', () => {
    process.env[FILE_ROOTS_ENV] = [allowed, outside].join(path.delimiter);
    expect(() => resolveToolPath(path.join(outside, 'secret.txt'))).not.toThrow();
  });

  it('read tool is confined', async () => {
    await expect(readTool({ filePath: path.join(allowed, 'ok.txt') })).resolves.toMatchObject({
      success: true,
    });
    await expect(readTool({ filePath: path.join(outside, 'secret.txt') })).rejects.toMatchObject({
      code: ErrorCode.POLICY_DENIED,
    });
  });

  it('edit tool cannot modify files outside the root', async () => {
    const target = path.join(outside, 'secret.txt');
    await expect(
      editTool({ filePath: target, operation: 'append', content: 'pwned', startLine: 1 } as never)
    ).rejects.toMatchObject({ code: ErrorCode.POLICY_DENIED });
    expect(fs.readFileSync(target, 'utf8')).toBe('TOP SECRET\n');
  });

  it('search tool refuses a directory outside the root', async () => {
    await expect(searchTool({ query: 'SECRET', directory: outside } as never)).rejects.toMatchObject({
      code: ErrorCode.POLICY_DENIED,
    });
  });
});
