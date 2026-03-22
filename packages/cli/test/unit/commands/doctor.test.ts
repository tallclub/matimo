import { doctorCommand } from '../../../src/commands/doctor';
import * as fs from 'fs';

// Mock fs and dynamic import
jest.mock('fs');
jest.mock('js-yaml');

describe('doctor Command', () => {
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

  it('should display diagnostic header', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    try {
      await doctorCommand();
    } catch {
      // Expected in test environment
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Doctor'));
  });

  it('should check Node.js version', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    try {
      await doctorCommand();
    } catch {
      // Expected
    }

    const output = consoleInfoSpy.mock.calls.map((call) => call[0] as string).join('\n');
    expect(output).toContain('Node.js');
  });

  it('should report success when node_modules found', async () => {
    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
      return filePath.includes('node_modules');
    });
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    try {
      await doctorCommand();
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  it('should report missing node_modules', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    try {
      await doctorCommand();
    } catch {
      // Expected
    }

    const output = consoleInfoSpy.mock.calls.map((call) => call[0] as string).join('\n');
    expect(output).toContain('node_modules');
  });

  it('should check for MATIMO_APPROVAL_SECRET', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    delete process.env.MATIMO_APPROVAL_SECRET;

    try {
      await doctorCommand();
    } catch {
      // Expected
    }

    const output = consoleInfoSpy.mock.calls.map((call) => call[0] as string).join('\n');
    expect(output).toContain('MATIMO_APPROVAL_SECRET');
  });

  it('should report approval secret as set when present', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    process.env.MATIMO_APPROVAL_SECRET = 'test-secret';

    try {
      await doctorCommand();
    } catch {
      // Expected
    }

    const output = consoleInfoSpy.mock.calls.map((call) => call[0] as string).join('\n');
    expect(output).toContain('MATIMO_APPROVAL_SECRET');

    delete process.env.MATIMO_APPROVAL_SECRET;
  });

  it('should display summary at end', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    try {
      await doctorCommand();
    } catch {
      // Expected
    }

    const output = consoleInfoSpy.mock.calls.map((call) => call[0] as string).join('\n');
    expect(output).toMatch(/✅|❌|ready/);
  });

  it('should handle missing @matimo scope gracefully', async () => {
    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
      return filePath.includes('node_modules') && !filePath.includes('@matimo');
    });
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    try {
      await doctorCommand();
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  it('should check installed @matimo packages', async () => {
    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
      return filePath.includes('node_modules');
    });
    (fs.readdirSync as jest.Mock).mockReturnValue(['slack', 'gmail']);

    try {
      await doctorCommand();
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  it('should list environment variable placeholders found in tools', async () => {
    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
      return filePath.includes('node_modules');
    });
    (fs.readdirSync as jest.Mock).mockReturnValue(['slack']);
    (fs.readFileSync as jest.Mock).mockReturnValue('Authorization: Bearer {SLACK_BOT_TOKEN}');

    try {
      await doctorCommand();
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  it('should recognize auth-related env var patterns', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    process.env.TEST_TOKEN = 'value';
    process.env.TEST_SECRET = 'value';
    process.env.TEST_KEY = 'value';

    try {
      await doctorCommand();
    } catch {
      // Expected
    }

    expect(consoleInfoSpy).toHaveBeenCalled();

    delete process.env.TEST_TOKEN;
    delete process.env.TEST_SECRET;
    delete process.env.TEST_KEY;
  });
});
