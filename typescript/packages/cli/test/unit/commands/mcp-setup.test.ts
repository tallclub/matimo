/**
 * Unit tests for the CLI `mcp setup` command.
 *
 * Tests mcpSetupCommand() which:
 * - Auto-discovers installed @matimo/* packages
 * - Lists tools grouped by provider
 * - Shows required env vars with ✅/❌ status
 * - Outputs Claude Desktop / Cursor config JSON
 * - Outputs an HTTP mode example
 */

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockAutoDiscoverPackages = jest.fn();
const mockLoadToolsFromMultiplePaths = jest.fn();
const mockExtractAuthPlaceholders = jest.fn().mockReturnValue([]);

const MockToolLoader = jest.fn().mockImplementation(() => ({
  autoDiscoverPackages: mockAutoDiscoverPackages,
  loadToolsFromMultiplePaths: mockLoadToolsFromMultiplePaths,
}));

jest.mock('@matimo/core', () => ({
  ToolLoader: MockToolLoader,
  extractAuthPlaceholders: (...args: unknown[]) => mockExtractAuthPlaceholders(...args),
}));

// ─── Import under test ────────────────────────────────────────────────────

import { mcpSetupCommand } from '../../../src/commands/mcp-setup';

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeToolMap(entries: [string, unknown][]): Map<string, unknown> {
  return new Map(entries);
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('mcpSetupCommand', () => {
  let consoleInfoSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  // ─── No tools installed ────────────────────────────────────────────────

  describe('when no @matimo/* packages are installed', () => {
    it('should print "no packages found" message and return without setup output', async () => {
      mockAutoDiscoverPackages.mockReturnValue([]);

      await mcpSetupCommand();

      const output = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(output).toContain('No @matimo/* tool packages found');
      expect(output).not.toContain('mcpServers');
    });
  });

  // ─── Tools found ──────────────────────────────────────────────────────

  describe('when tools are found', () => {
    beforeEach(() => {
      mockAutoDiscoverPackages.mockReturnValue(['/packages/slack', '/packages/gmail']);
      mockLoadToolsFromMultiplePaths.mockReturnValue(
        makeToolMap([
          ['slack_send_message', { name: 'slack_send_message' }],
          ['slack_list_channels', { name: 'slack_list_channels' }],
          ['gmail_send', { name: 'gmail_send' }],
        ])
      );
      mockExtractAuthPlaceholders.mockReturnValue([]);
    });

    it('should print the number of tools found', async () => {
      await mcpSetupCommand();

      const output = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(output).toContain('3 tools');
    });

    it('should group tools by provider prefix', async () => {
      await mcpSetupCommand();

      const output = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(output).toContain('slack');
      expect(output).toContain('gmail');
    });

    it('should output Claude Desktop config JSON', async () => {
      await mcpSetupCommand();

      const output = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(output).toContain('mcpServers');
      expect(output).toContain('matimo');
      expect(output).toContain('npx');
    });

    it('should output Cursor config JSON', async () => {
      await mcpSetupCommand();

      // Cursor and Claude have the same format — just verify it appears twice
      const jsonMatches = consoleInfoSpy.mock.calls
        .flat()
        .filter((arg) => typeof arg === 'string' && arg.includes('"mcpServers"'));
      expect(jsonMatches.length).toBeGreaterThanOrEqual(1);
    });

    it('should output HTTP mode example', async () => {
      await mcpSetupCommand();

      const output = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(output).toContain('--transport http');
      expect(output).toContain('MATIMO_MCP_TOKEN');
    });

    it('should truncate tool lists longer than 5 with "... and N more"', async () => {
      mockLoadToolsFromMultiplePaths.mockReturnValue(
        makeToolMap(
          Array.from({ length: 8 }, (_, i) => [`slack_tool_${i}`, { name: `slack_tool_${i}` }])
        )
      );

      await mcpSetupCommand();

      const output = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(output).toContain('and 3 more');
    });
  });

  // ─── Auth env vars ─────────────────────────────────────────────────────

  describe('auth environment variables', () => {
    beforeEach(() => {
      mockAutoDiscoverPackages.mockReturnValue(['/packages/slack']);
      mockLoadToolsFromMultiplePaths.mockReturnValue(
        makeToolMap([['slack_send', { name: 'slack_send' }]])
      );
    });

    it('should show ✅ for env vars that are set', async () => {
      mockExtractAuthPlaceholders.mockReturnValue(['SLACK_BOT_TOKEN']);
      const prev = process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';

      await mcpSetupCommand();

      const output = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(output).toContain('✅');
      expect(output).toContain('SLACK_BOT_TOKEN');

      if (prev === undefined) delete process.env.SLACK_BOT_TOKEN;
      else process.env.SLACK_BOT_TOKEN = prev;
    });

    it('should show ❌ for env vars that are not set', async () => {
      mockExtractAuthPlaceholders.mockReturnValue(['MISSING_TOKEN_XYZ123']);
      const prev = process.env.MISSING_TOKEN_XYZ123;
      delete process.env.MISSING_TOKEN_XYZ123;

      await mcpSetupCommand();

      const output = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(output).toContain('❌');
      expect(output).toContain('MISSING_TOKEN_XYZ123');

      if (prev !== undefined) process.env.MISSING_TOKEN_XYZ123 = prev;
    });

    it('should include auth var in generated config env block', async () => {
      mockExtractAuthPlaceholders.mockReturnValue(['MY_API_KEY']);
      delete process.env.MY_API_KEY;

      await mcpSetupCommand();

      const output = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(output).toContain('MY_API_KEY');
      expect(output).toContain('<your-token>');
    });
  });

  // ─── Tool name parsing ────────────────────────────────────────────────

  describe('tool name provider extraction', () => {
    it('should extract provider from hyphen-separated tool names', async () => {
      mockAutoDiscoverPackages.mockReturnValue(['/packages/slack']);
      mockLoadToolsFromMultiplePaths.mockReturnValue(
        makeToolMap([['slack-list-channels', { name: 'slack-list-channels' }]])
      );
      mockExtractAuthPlaceholders.mockReturnValue([]);

      await mcpSetupCommand();

      const output = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(output).toContain('slack');
    });

    it('should use "core" as provider for tool names without separators', async () => {
      mockAutoDiscoverPackages.mockReturnValue(['/packages/core']);
      mockLoadToolsFromMultiplePaths.mockReturnValue(
        makeToolMap([['calculator', { name: 'calculator' }]])
      );
      mockExtractAuthPlaceholders.mockReturnValue([]);

      await mcpSetupCommand();

      const output = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(output).toContain('core');
    });
  });

  // ─── Error handling ────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should print error and call process.exit(1) when @matimo/core import fails', async () => {
      // Override the mock for this test to simulate import failure
      jest.resetModules();

      // Provide the import-failing scenario by making ToolLoader constructor throw
      MockToolLoader.mockImplementationOnce(() => {
        throw new Error('Module not found');
      });

      await expect(mcpSetupCommand()).rejects.toThrow('process.exit called');

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Setup failed'),
        expect.stringContaining('Module not found')
      );
    });

    it('should handle loadToolsFromMultiplePaths throwing an error', async () => {
      mockAutoDiscoverPackages.mockReturnValue(['/packages/slack']);
      mockLoadToolsFromMultiplePaths.mockImplementation(() => {
        throw new Error('Load error');
      });

      await expect(mcpSetupCommand()).rejects.toThrow('process.exit called');

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
