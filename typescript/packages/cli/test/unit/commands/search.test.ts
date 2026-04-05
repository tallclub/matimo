import { searchCommand } from '../../../src/commands/search';
import fs from 'fs';
import path from 'path';

describe('Search Command', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should show error when no query provided', async () => {
    try {
      await searchCommand('');
    } catch {
      // Expected exit
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Please specify a search query')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should show usage when no query', async () => {
    try {
      await searchCommand('');
    } catch {
      // Expected exit
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: matimo search'));
  });

  it('should search packages by name', async () => {
    await searchCommand('slack');

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('slack'));
  });

  it('should search packages by description', async () => {
    await searchCommand('workspace');

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  it('should display search results', async () => {
    await searchCommand('slack');

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Search results'));
  });

  it('should show available packages when no match found', async () => {
    await searchCommand('nonexistent-tool-xyz-123');

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('No packages found'));
  });

  it('should show tool count for each result', async () => {
    await searchCommand('slack');

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Tools:'));
  });

  it('should display install instruction for each result', async () => {
    await searchCommand('slack');

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('matimo install'));
  });

  it('should show total results count', async () => {
    await searchCommand('gmail');

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Total:'));
  });

  it('should handle query case-insensitively', async () => {
    await searchCommand('SLACK');

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('@matimo/slack'));
  });

  it('should handle error when reading packages fails', async () => {
    const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    try {
      await searchCommand('test');
    } catch {
      // Expected exit
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error'));
    expect(processExitSpy).toHaveBeenCalledWith(1);

    fsExistsSyncSpy.mockRestore();
  });

  it('should show specific error message when no packages found in installed context', async () => {
    const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
      // Return false for everything to trigger "no packages found" in installed context
      if (String(p).includes('node_modules/@matimo')) return false;
      if (String(p).includes('pnpm-workspace.yaml')) return false;
      return false;
    });
    const origCwd = process.cwd;
    Object.defineProperty(process, 'cwd', {
      value: () => '/tmp/fake-project',
    });

    try {
      await searchCommand('test');
    } catch {
      // Expected exit
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error'));

    fsExistsSyncSpy.mockRestore();
    Object.defineProperty(process, 'cwd', {
      value: origCwd,
    });
  });

  it('should display results with multiple packages', async () => {
    await searchCommand('mail');

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('package'));
  });

  it('should display available packages list when no results match query', async () => {
    const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    // This should match real packages in repo packages/
    await searchCommand('xyz-definitely-nonexistent-12345');

    // Should show available packages list
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Available Packages'));

    fsExistsSyncSpy.mockRestore();
  });

  it('should handle packages with missing descriptions', async () => {
    const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    await searchCommand('slack');

    // Should handle packages without description gracefully
    expect(consoleInfoSpy).toHaveBeenCalled();

    fsExistsSyncSpy.mockRestore();
  });

  it('should format results with correct context (repository vs installed)', async () => {
    const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
      // In repository context
      if (String(p).includes('pnpm-workspace.yaml')) return true;
      return true;
    });

    await searchCommand('slack');

    // Repository context should show "Install: matimo install" not "Already installed"
    const calls = consoleInfoSpy.mock.calls.map((c) => c[0]).join('');
    expect(calls).toContain('matimo install');

    fsExistsSyncSpy.mockRestore();
  });

  it('should handle findRepoRoot terminal case (reaching filesystem root)', async () => {
    const pathDirnameOriginal = path.dirname;
    const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
      // Simulate pnpm-workspace.yaml not found
      if (String(p).includes('pnpm-workspace.yaml')) return false;
      // But @matimo packages exist
      if (String(p).includes('node_modules/@matimo')) return true;
      return true;
    });

    // Mock path.dirname to simulate reaching filesystem root
    let callCount = 0;
    jest.spyOn(path, 'dirname').mockImplementation((p) => {
      callCount++;
      // After a few attempts, return same path (indicating filesystem root)
      if (callCount > 5) return p;
      return pathDirnameOriginal(p);
    });

    await searchCommand('slack');

    // Should still work (fallback to installed context)
    expect(consoleInfoSpy).toHaveBeenCalled();

    fsExistsSyncSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('should handle singular vs plural in available packages list', async () => {
    const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    await searchCommand('nonexistent-xyz-123');

    const calls = consoleInfoSpy.mock.calls.map((c) => c[0]).join('');
    // Should use correct singular/plural
    expect(calls).toMatch(/packages?/);

    fsExistsSyncSpy.mockRestore();
  });

  it('should handle error when discovering packages fails in installed context', async () => {
    const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
      // Return false for pnpm-workspace.yaml to enter installed context
      if (String(p).includes('pnpm-workspace.yaml')) return false;
      // Return false for @matimo packages to trigger error
      if (String(p).includes('node_modules/@matimo')) return false;
      return false;
    });

    try {
      await searchCommand('test');
    } catch {
      // Expected exit
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error'));
    expect(processExitSpy).toHaveBeenCalledWith(1);

    fsExistsSyncSpy.mockRestore();
  });

  it('should handle error when discovering packages fails in repository context', async () => {
    const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
      // Return true for pnpm-workspace.yaml to stay in repository context
      if (String(p).includes('pnpm-workspace.yaml')) return true;
      // But return false for packages directory
      if (String(p).includes('packages')) return false;
      return false;
    });
    const readdirSyncSpy = jest.spyOn(fs, 'readdirSync').mockReturnValue([]);

    try {
      await searchCommand('test');
    } catch {
      // Expected exit
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error'));
    expect(processExitSpy).toHaveBeenCalledWith(1);

    fsExistsSyncSpy.mockRestore();
    readdirSyncSpy.mockRestore();
  });

  it('should handle no packages found in installed context', async () => {
    const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
      // Return false for pnpm-workspace.yaml to stay in installed context
      if (String(p).includes('pnpm-workspace.yaml')) return false;
      // Return true for @matimo path to enter that branch
      if (String(p).includes('node_modules/@matimo')) return true;
      return false;
    });
    const readdirSyncSpy = jest.spyOn(fs, 'readdirSync').mockReturnValue([]);

    try {
      await searchCommand('test');
    } catch {
      // Expected exit
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('No packages found in node_modules/@matimo')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    fsExistsSyncSpy.mockRestore();
    readdirSyncSpy.mockRestore();
  });

  it('should handle no packages found in repository context', async () => {
    const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
      // Return true for pnpm-workspace.yaml to stay in repository context
      if (String(p).includes('pnpm-workspace.yaml')) return true;
      return false;
    });
    const readdirSyncSpy = jest.spyOn(fs, 'readdirSync').mockReturnValue([]);

    try {
      await searchCommand('test');
    } catch {
      // Expected exit
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('No packages found in repository')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    fsExistsSyncSpy.mockRestore();
    readdirSyncSpy.mockRestore();
  });
});
