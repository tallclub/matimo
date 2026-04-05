import { main, showHelp } from '../../src/cli';

// Mock the command functions
jest.mock('../../src/commands/install.ts');
jest.mock('../../src/commands/list.ts');
jest.mock('../../src/commands/search.ts');
jest.mock('../../src/commands/mcp.ts');

const { installCommand } = require('../../src/commands/install.ts');
const { listCommand } = require('../../src/commands/list.ts');
const { searchCommand } = require('../../src/commands/search.ts');
const { mcpCommand } = require('../../src/commands/mcp.ts');

describe('CLI Main', () => {
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
    installCommand.mockResolvedValue(undefined);
    listCommand.mockResolvedValue(undefined);
    searchCommand.mockResolvedValue(undefined);
    mcpCommand.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should display help when no arguments provided', async () => {
    try {
      await main([]);
    } catch {
      // Expected exit
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: matimo'));
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle help command', async () => {
    try {
      await main(['help']);
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Matimo CLI'));
  });

  it('should handle -h flag', async () => {
    try {
      await main(['-h']);
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
  });

  it('should handle --help flag', async () => {
    try {
      await main(['--help']);
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
  });

  it('should handle version command', async () => {
    try {
      await main(['version']);
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('matimo-cli'));
  });

  it('should handle -v flag', async () => {
    try {
      await main(['-v']);
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('matimo-cli'));
  });

  it('should handle --version flag', async () => {
    try {
      await main(['--version']);
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('matimo-cli'));
  });

  it('should route to install command', async () => {
    await main(['install', 'slack']);

    expect(installCommand).toHaveBeenCalledWith(['slack']);
  });

  it('should route to list command', async () => {
    await main(['list']);

    expect(listCommand).toHaveBeenCalled();
  });

  it('should route to search command', async () => {
    await main(['search', 'slack']);

    expect(searchCommand).toHaveBeenCalledWith('slack');
  });

  it('should handle unknown command with error', async () => {
    try {
      await main(['unknown-cmd']);
    } catch {
      // Expected exit
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle command errors gracefully', async () => {
    installCommand.mockRejectedValueOnce(new Error('Installation failed'));

    try {
      await main(['install', 'slack']);
    } catch {
      // Expected exit
    }

    // The error message is split: '❌ Error:' and 'Installation failed'
    const errorCalls = consoleErrorSpy.mock.calls;
    const hasError = errorCalls.some((call) => call.join(' ').includes('Error:'));
    expect(hasError).toBe(true);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle install with multiple packages', async () => {
    await main(['install', 'slack', 'gmail', 'stripe']);

    expect(installCommand).toHaveBeenCalledWith(['slack', 'gmail', 'stripe']);
  });

  it('should handle search with no query', async () => {
    await main(['search']);

    expect(searchCommand).toHaveBeenCalledWith('');
  });

  it('should handle case-insensitive commands', async () => {
    await main(['INSTALL', 'slack']);

    expect(installCommand).toHaveBeenCalledWith(['slack']);
  });

  it('should call showHelp function directly', () => {
    showHelp();

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Tool Package Manager'));
  });

  it('should handle unknown command', async () => {
    try {
      await main(['unknown-command']);
    } catch {
      // Expected exit
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle command exception', async () => {
    const error = new Error('Command failed');
    installCommand.mockRejectedValueOnce(error);

    try {
      await main(['install', 'slack']);
    } catch {
      // Expected
    }

    // consoleError is called with "❌ Error:" and the message
    expect(consoleErrorSpy).toHaveBeenCalled();
    const calls = consoleErrorSpy.mock.calls;
    expect(calls.some((call) => JSON.stringify(call).includes('Command failed'))).toBe(true);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle command exception with non-Error object', async () => {
    const error = 'String error';
    installCommand.mockRejectedValueOnce(error);

    try {
      await main(['install', 'slack']);
    } catch {
      // Expected
    }

    expect(consoleErrorSpy).toHaveBeenCalled();
    const calls = consoleErrorSpy.mock.calls;
    expect(calls.some((call) => JSON.stringify(call).includes('String error'))).toBe(true);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle -h as help flag', async () => {
    try {
      await main(['-h']);
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: matimo'));
  });

  it('should handle --help as help flag', async () => {
    try {
      await main(['--help']);
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: matimo'));
  });

  it('should handle -v as version flag', async () => {
    try {
      await main(['-v']);
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  it('should handle --version as version flag', async () => {
    try {
      await main(['--version']);
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  it('should pass search parameters correctly', async () => {
    await main(['search', 'email']);

    expect(searchCommand).toHaveBeenCalledWith('email');
  });

  it('should handle search with empty query', async () => {
    await main(['search']);

    expect(searchCommand).toHaveBeenCalledWith('');
  });

  it('should route to mcp command', async () => {
    await main(['mcp', '--transport', 'http']);

    expect(mcpCommand).toHaveBeenCalledWith(['--transport', 'http']);
  });

  it('should handle getPackageVersion returning "unknown" when package.json is unreadable', async () => {
    const fsSpy = jest.spyOn(require('fs'), 'readFileSync').mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file');
    });

    try {
      await main(['version']);
    } catch {
      // Expected if process.exit throws
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('vunknown'));
    fsSpy.mockRestore();
  });
});

describe('showVersion', () => {
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    jest.clearAllMocks();
  });
  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  it('should display version when -v flag is used', async () => {
    try {
      await main(['-v']);
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringMatching(/matimo-cli v/));
  });
});
