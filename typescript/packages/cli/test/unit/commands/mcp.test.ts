/**
 * Unit tests for the CLI `mcp` command.
 *
 * Covers:
 * - Argument parsing (transport, port, tools, exclude, secrets, token, flags)
 * - Resolver config construction (env, dotenv, vault, aws, unknown)
 * - MCPServer lifecycle (start, graceful shutdown, error handling)
 * - 'setup' subcommand delegation
 * - HTTP mode console output (URL, token info)
 */

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockServerStart = jest.fn().mockResolvedValue(undefined);
const mockServerStop = jest.fn().mockResolvedValue(undefined);
const mockGetActiveToken = jest.fn().mockReturnValue(null);
let mockMCPServerOptions: Record<string, unknown> = {};

const MockMCPServer = jest.fn().mockImplementation((opts: Record<string, unknown>) => {
  mockMCPServerOptions = opts;
  return {
    start: mockServerStart,
    stop: mockServerStop,
    getActiveToken: mockGetActiveToken,
  };
});

jest.mock('@matimo/core', () => ({
  MCPServer: MockMCPServer,
}));

const mockMcpSetupCommand = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/commands/mcp-setup.js', () => ({
  mcpSetupCommand: mockMcpSetupCommand,
}));

// Virtual mocks for optional peer deps
jest.mock('node-vault', () => jest.fn(() => ({ read: jest.fn() })), { virtual: true });
jest.mock(
  '@aws-sdk/client-secrets-manager',
  () => ({
    SecretsManagerClient: jest.fn(() => ({ send: jest.fn() })),
    GetSecretValueCommand: jest.fn(),
  }),
  { virtual: true }
);

// ─── Import under test ────────────────────────────────────────────────────

import { mcpCommand } from '../../../src/commands/mcp';

// ─── Helpers ──────────────────────────────────────────────────────────────

describe('mcpCommand', () => {
  let consoleInfoSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;
  let processOnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMCPServerOptions = {};
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    processOnSpy = jest.spyOn(process, 'on').mockImplementation(() => process);
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    processOnSpy.mockRestore();
  });

  // ─── Subcommand routing ─────────────────────────────────────────────────

  describe('setup subcommand', () => {
    it('should delegate to mcpSetupCommand when params[0] === "setup"', async () => {
      await mcpCommand(['setup']);
      expect(mockMcpSetupCommand).toHaveBeenCalledTimes(1);
      expect(MockMCPServer).not.toHaveBeenCalled();
    });
  });

  // ─── Default behaviour ──────────────────────────────────────────────────

  describe('default (stdio) mode', () => {
    it('should start MCPServer with stdio transport by default', async () => {
      await mcpCommand([]);

      expect(MockMCPServer).toHaveBeenCalledTimes(1);
      expect(mockMCPServerOptions.transport).toBe('stdio');
      expect(mockMCPServerOptions.autoDiscover).toBe(true);
      expect(mockServerStart).toHaveBeenCalledTimes(1);
    });

    it('should register SIGINT and SIGTERM handlers', async () => {
      await mcpCommand([]);

      const signals = processOnSpy.mock.calls.map(([sig]) => sig);
      expect(signals).toContain('SIGINT');
      expect(signals).toContain('SIGTERM');
    });

    it('should use default port 3000', async () => {
      await mcpCommand([]);
      expect(mockMCPServerOptions.port).toBe(3000);
    });
  });

  // ─── Transport flag ─────────────────────────────────────────────────────

  describe('--transport', () => {
    it('should set transport to http', async () => {
      await mcpCommand(['--transport', 'http']);
      expect(mockMCPServerOptions.transport).toBe('http');
    });

    it('should set transport to stdio', async () => {
      await mcpCommand(['--transport', 'stdio']);
      expect(mockMCPServerOptions.transport).toBe('stdio');
    });

    it('should accept -t shorthand', async () => {
      await mcpCommand(['-t', 'http']);
      expect(mockMCPServerOptions.transport).toBe('http');
    });

    it('should call process.exit(1) for invalid transport value', async () => {
      await expect(mcpCommand(['--transport', 'grpc'])).rejects.toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ─── Port flag ──────────────────────────────────────────────────────────

  describe('--port', () => {
    it('should set port', async () => {
      await mcpCommand(['--port', '8080']);
      expect(mockMCPServerOptions.port).toBe(8080);
    });

    it('should accept -p shorthand', async () => {
      await mcpCommand(['-p', '4000']);
      expect(mockMCPServerOptions.port).toBe(4000);
    });

    it('should call process.exit(1) for non-numeric port', async () => {
      await expect(mcpCommand(['--port', 'abc'])).rejects.toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ─── Tool filtering ─────────────────────────────────────────────────────

  describe('--tools and --exclude', () => {
    it('should parse --tools as a comma-separated array', async () => {
      await mcpCommand(['--tools', 'slack,github,gmail']);
      expect(mockMCPServerOptions.tools).toEqual(['slack', 'github', 'gmail']);
    });

    it('should parse --exclude as a comma-separated array', async () => {
      await mcpCommand(['--exclude', 'postgres,redis']);
      expect(mockMCPServerOptions.excludeTools).toEqual(['postgres', 'redis']);
    });

    it('should trim whitespace from tool names', async () => {
      await mcpCommand(['--tools', ' slack , github ']);
      expect(mockMCPServerOptions.tools).toEqual(['slack', 'github']);
    });
  });

  // ─── Token flag ─────────────────────────────────────────────────────────

  describe('--token', () => {
    it('should pass explicit bearer token to MCPServer', async () => {
      await mcpCommand(['--token', 'my-secret-token']);
      expect(mockMCPServerOptions.mcpToken).toBe('my-secret-token');
    });
  });

  // ─── Tool paths ─────────────────────────────────────────────────────────

  describe('--tool-paths', () => {
    it('should parse --tool-paths as a comma-separated array', async () => {
      await mcpCommand(['--tool-paths', '/path/a,/path/b']);
      expect(mockMCPServerOptions.toolPaths).toEqual(['/path/a', '/path/b']);
    });
  });

  // ─── HTTPS flags ────────────────────────────────────────────────────────

  describe('TLS flags', () => {
    it('should set https=true with --https', async () => {
      await mcpCommand(['--https']);
      expect(mockMCPServerOptions.https).toBe(true);
    });

    it('should set selfSigned=true and https=true with --self-signed', async () => {
      await mcpCommand(['--self-signed']);
      expect(mockMCPServerOptions.https).toBe(true);
      expect(mockMCPServerOptions.selfSigned).toBe(true);
    });

    it('should set certPath and https=true with --cert', async () => {
      await mcpCommand(['--cert', '/path/to/cert.pem']);
      expect(mockMCPServerOptions.certPath).toBe('/path/to/cert.pem');
      expect(mockMCPServerOptions.https).toBe(true);
    });

    it('should set keyPath with --key', async () => {
      await mcpCommand(['--key', '/path/to/key.pem']);
      expect(mockMCPServerOptions.keyPath).toBe('/path/to/key.pem');
    });
  });

  // ─── Unknown flags ──────────────────────────────────────────────────────

  describe('unknown flags', () => {
    it('should call process.exit(1) for unknown flags', async () => {
      await expect(mcpCommand(['--bogus-flag'])).rejects.toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ─── Resolver config ────────────────────────────────────────────────────

  describe('resolver config (--secrets)', () => {
    it('should default to ["env", "dotenv"] when --secrets not provided', async () => {
      await mcpCommand([]);
      const cfg = mockMCPServerOptions.secretResolver as { resolvers: { type: string }[] };
      expect(cfg.resolvers.map((r) => r.type)).toEqual(['env', 'dotenv']);
    });

    it('should build env resolver', async () => {
      await mcpCommand(['--secrets', 'env']);
      const cfg = mockMCPServerOptions.secretResolver as { resolvers: { type: string }[] };
      expect(cfg.resolvers[0].type).toBe('env');
    });

    it('should build dotenv resolver with optional --env-file', async () => {
      await mcpCommand(['--secrets', 'dotenv', '--env-file', '/custom/.env']);
      const cfg = mockMCPServerOptions.secretResolver as {
        resolvers: { type: string; path?: string }[];
      };
      expect(cfg.resolvers[0].type).toBe('dotenv');
      expect(cfg.resolvers[0].path).toBe('/custom/.env');
    });

    it('should build vault resolver with --vault-path', async () => {
      await mcpCommand(['--secrets', 'vault', '--vault-path', 'secret/data/myapp']);
      const cfg = mockMCPServerOptions.secretResolver as {
        resolvers: { type: string; secretPath?: string }[];
      };
      expect(cfg.resolvers[0].type).toBe('vault');
      expect(cfg.resolvers[0].secretPath).toBe('secret/data/myapp');
    });

    it('should build aws resolver with --aws-secret-id', async () => {
      await mcpCommand(['--secrets', 'aws', '--aws-secret-id', 'prod/myapp/api']);
      const cfg = mockMCPServerOptions.secretResolver as {
        resolvers: { type: string; secretId?: string }[];
      };
      expect(cfg.resolvers[0].type).toBe('aws');
      expect(cfg.resolvers[0].secretId).toBe('prod/myapp/api');
    });

    it('should build multiple resolvers from comma-separated --secrets', async () => {
      await mcpCommand(['--secrets', 'env,dotenv,vault']);
      const cfg = mockMCPServerOptions.secretResolver as { resolvers: { type: string }[] };
      expect(cfg.resolvers.map((r) => r.type)).toEqual(['env', 'dotenv', 'vault']);
    });

    it('should call process.exit(1) for unknown resolver type', async () => {
      await expect(mcpCommand(['--secrets', 'unknown-resolver'])).rejects.toThrow(
        'process.exit called'
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ─── HTTP mode output ───────────────────────────────────────────────────

  describe('HTTP mode console output', () => {
    it('should print server URL and token when transport is http', async () => {
      mockGetActiveToken.mockReturnValue('printed-token');

      await mcpCommand(['--transport', 'http', '--port', '3555', '--token', 'printed-token']);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3555/mcp')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('printed-token'));
    });

    it('should print HTTPS info when --self-signed is used', async () => {
      mockGetActiveToken.mockReturnValue('token');

      await mcpCommand(['--transport', 'http', '--self-signed', '--token', 'token']);

      const allOutput = consoleInfoSpy.mock.calls.flat().join(' ');
      expect(allOutput).toMatch(/HTTPS/i);
    });

    it('should not print HTTP details when transport is stdio', async () => {
      await mcpCommand(['--transport', 'stdio']);

      const allOutput = consoleInfoSpy.mock.calls.flat().join(' ');
      expect(allOutput).not.toMatch(/localhost:\d+\/mcp/);
    });
  });

  // ─── Error handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should call process.exit(1) when server.start() throws', async () => {
      mockServerStart.mockRejectedValueOnce(new Error('Port in use'));

      await expect(mcpCommand([])).rejects.toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start'),
        expect.stringContaining('Port in use')
      );
    });
  });

  // ─── Graceful shutdown handler ───────────────────────────────────────────────

  describe('graceful shutdown handler', () => {
    it('should call server.stop() and process.exit(0) when SIGINT fires', async () => {
      let sigintHandler: () => Promise<void> = async () => {};

      processOnSpy.mockImplementation((signal: string, handler: () => Promise<void>) => {
        if (signal === 'SIGINT') sigintHandler = handler;
        return process;
      });

      // Make process.exit a no-op for the shutdown call
      processExitSpy.mockImplementation(() => undefined as never);

      await mcpCommand([]);

      await sigintHandler();

      expect(mockServerStop).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should log to stderr in stdio mode on shutdown', async () => {
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      let sigintHandler: () => Promise<void> = async () => {};

      processOnSpy.mockImplementation((signal: string, handler: () => Promise<void>) => {
        if (signal === 'SIGINT') sigintHandler = handler;
        return process;
      });
      processExitSpy.mockImplementation(() => undefined as never);

      await mcpCommand(['--transport', 'stdio']);
      await sigintHandler();

      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Shutting down'));
      stderrSpy.mockRestore();
    });

    it('should log to console.info in http mode on shutdown', async () => {
      let sigintHandler: () => Promise<void> = async () => {};

      processOnSpy.mockImplementation((signal: string, handler: () => Promise<void>) => {
        if (signal === 'SIGINT') sigintHandler = handler;
        return process;
      });
      processExitSpy.mockImplementation(() => undefined as never);

      await mcpCommand(['--transport', 'http', '--token', 'tok']);
      await sigintHandler();

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Shutting down'));
    });
  });

  // ─── parseArgs 'setup' positional arg ────────────────────────────────────────

  describe('parseArgs setup positional', () => {
    it('should silently ignore "setup" when it appears after flags (non-first position)', async () => {
      // params[0] is '--transport', not 'setup', so mcpCommand proceeds to parseArgs.
      // parseArgs hits `case 'setup': break;` and continues normally.
      await mcpCommand(['--transport', 'http', '--token', 'tok', 'setup']);
      expect(mockMCPServerOptions.transport).toBe('http');
      expect(MockMCPServer).toHaveBeenCalledTimes(1);
    });
  });

  // ─── HTTPS explicit cert/key output ──────────────────────────────────────────

  describe('HTTPS output variants', () => {
    it('should print plain "HTTPS enabled" when explicit cert/key are provided (non-self-signed)', async () => {
      mockGetActiveToken.mockReturnValue('tok');

      // --https + explicit --cert / --key paths (not --self-signed)
      await mcpCommand([
        '--transport',
        'http',
        '--token',
        'tok',
        '--cert',
        '/path/to/cert.pem',
        '--key',
        '/path/to/key.pem',
      ]);

      const allOutput = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(allOutput).toMatch(/HTTPS enabled/);
      // Should NOT show the self-signed warning
      expect(allOutput).not.toContain('self-signed certificate');
    });

    it('should show auto-generated token hint when no token is set', async () => {
      const prev = process.env.MATIMO_MCP_TOKEN;
      delete process.env.MATIMO_MCP_TOKEN;

      mockGetActiveToken.mockReturnValue('auto-uuid-token');
      // No --token flag and no MATIMO_MCP_TOKEN → isAutoGenerated = true

      await mcpCommand(['--transport', 'http']);

      const allOutput = consoleInfoSpy.mock.calls.flat().join('\n');
      expect(allOutput).toContain('auto-uuid-token');
      expect(allOutput).toMatch(/fixed token|MATIMO_MCP_TOKEN/);

      if (prev !== undefined) process.env.MATIMO_MCP_TOKEN = prev;
    });
  });
});
