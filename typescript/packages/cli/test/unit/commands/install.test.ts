import { installCommand } from '../../../src/commands/install';

// Mock execFileSync
jest.mock('child_process');
const { execFileSync } = require('child_process');

describe('Install Command', () => {
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

  it('should show error when no tools specified', async () => {
    try {
      await installCommand([]);
    } catch {
      // Expected exit
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Please specify at least one tool')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should show usage information when no tools', async () => {
    try {
      await installCommand([]);
    } catch {
      // Expected exit
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: matimo install'));
  });

  it('should execute npm install with tool names', async () => {
    execFileSync.mockImplementation(() => {});

    await installCommand(['slack', 'gmail']);

    expect(execFileSync).toHaveBeenCalledWith(
      'npm',
      ['install', '@matimo/slack', '@matimo/gmail'],
      {
        stdio: 'inherit',
      }
    );
  });

  it('should display installation message', async () => {
    execFileSync.mockImplementation(() => {});

    await installCommand(['slack']);

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Installing'));
  });

  it('should display completion message after successful install', async () => {
    execFileSync.mockImplementation(() => {});

    await installCommand(['slack']);

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Installation complete'));
  });

  it('should display next steps after installation', async () => {
    execFileSync.mockImplementation(() => {});

    await installCommand(['slack']);

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Next steps'));
  });

  it('should display ESM-friendly examples in help text', async () => {
    execFileSync.mockImplementation(() => {});

    await installCommand(['slack']);

    // Check for auto-discovery example
    const infoOutput = consoleInfoSpy.mock.calls.map((call) => call[0]).join('\n');
    expect(infoOutput).toContain('autoDiscover: true');

    // Check for createRequire example
    expect(infoOutput).toContain('createRequire');
    expect(infoOutput).toContain('import.meta.url');

    // Check for file URL example
    expect(infoOutput).toContain('fileURLToPath');
    expect(infoOutput).toContain('node_modules/@matimo');
  });

  it('should handle installation errors gracefully', async () => {
    const error = new Error('npm install failed');
    execFileSync.mockImplementation(() => {
      throw error;
    });

    try {
      await installCommand(['slack']);
    } catch {
      // Expected exit
    }

    // The error message is split into two arguments due to console.error format
    const errorCalls = consoleErrorSpy.mock.calls;
    const hasInstallationFailed = errorCalls.some((call) =>
      call.join(' ').includes('Installation failed')
    );
    expect(hasInstallationFailed).toBe(true);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle multiple tools installation', async () => {
    execFileSync.mockImplementation(() => {});

    await installCommand(['slack', 'gmail', 'stripe']);

    expect(execFileSync).toHaveBeenCalledWith(
      'npm',
      ['install', '@matimo/slack', '@matimo/gmail', '@matimo/stripe'],
      { stdio: 'inherit' }
    );
  });
});
