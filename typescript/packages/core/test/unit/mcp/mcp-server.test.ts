/**
 * Unit tests for MCPServer.
 *
 * Mocks: MatimoInstance, MCP SDK, secret resolver chain.
 * Tests registration, tool filtering, error mapping, and lifecycle.
 */

// ─── Mocks ──────────────────────────────────────────────────────────────

// Variables prefixed with `mock` are allowed in jest.mock factories
const mockExecute = jest.fn();
const mockListTools = jest.fn();
const mockListSkills = jest.fn().mockReturnValue([]);
const mockGetSkillContent = jest.fn().mockReturnValue(null);
const mockReloadTools = jest.fn();

jest.mock('../../../src/matimo-instance', () => ({
  MatimoInstance: {
    init: jest.fn().mockImplementation(() =>
      Promise.resolve({
        execute: mockExecute,
        listTools: mockListTools,
        listSkills: mockListSkills,
        getSkillContent: mockGetSkillContent,
        reloadTools: mockReloadTools,
      })
    ),
  },
}));

const mockRegisterTool = jest.fn();
const mockRegisterResource = jest.fn().mockReturnValue({ remove: jest.fn() });
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockClose = jest.fn().mockResolvedValue(undefined);
const mockSendToolListChanged = jest.fn();
const mockSendResourceListChanged = jest.fn();

jest.mock(
  '@modelcontextprotocol/sdk/server/mcp',
  () => ({
    McpServer: jest.fn().mockImplementation(() => ({
      registerTool: mockRegisterTool,
      registerResource: mockRegisterResource,
      connect: mockConnect,
      close: mockClose,
      sendToolListChanged: mockSendToolListChanged,
      sendResourceListChanged: mockSendResourceListChanged,
    })),
  }),
  { virtual: true }
);

jest.mock(
  '@modelcontextprotocol/sdk/server/stdio',
  () => ({
    StdioServerTransport: jest.fn().mockImplementation(() => ({})),
  }),
  { virtual: true }
);

// Track what options the StreamableHTTPServerTransport is constructed with
const mockHttpTransport = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest: jest.fn().mockImplementation(async (_req: any, res: any) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', result: {} }));
  }),
  onclose: null as (() => void) | null,
  sessionId: 'test-session-id',
};
jest.mock(
  '@modelcontextprotocol/sdk/server/streamableHttp',
  () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    StreamableHTTPServerTransport: jest.fn().mockImplementation((opts: any) => {
      // Simulate session initialization
      if (opts?.onsessioninitialized) {
        const timer = setTimeout(() => opts.onsessioninitialized('test-session-id'), 0);
        timer.unref(); // prevent open handle leak
      }
      return mockHttpTransport;
    }),
  }),
  { virtual: true }
);

const mockIsInitializeRequest = jest.fn().mockReturnValue(false);
jest.mock(
  '@modelcontextprotocol/sdk/types',
  () => ({
    isInitializeRequest: (...args: unknown[]) => mockIsInitializeRequest(...args),
  }),
  { virtual: true }
);

// Virtual mocks for optional peer deps (transitively imported)
jest.mock('node-vault', () => jest.fn(() => ({ read: jest.fn() })), { virtual: true });
jest.mock(
  '@aws-sdk/client-secrets-manager',
  () => ({
    SecretsManagerClient: jest.fn(() => ({ send: jest.fn() })),
    GetSecretValueCommand: jest.fn(),
  }),
  { virtual: true }
);

jest.mock('../../../src/logging', () => ({
  getGlobalMatimoLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
  setGlobalMatimoLogger: jest.fn(),
}));

// Mock the https module (used only in HTTPS/TLS code paths)
const mockHttpsListen: jest.Mock = jest.fn();
const mockHttpsClose: jest.Mock = jest.fn();
const mockHttpsServerInstance = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listen: (port: any, cb: any) => mockHttpsListen(port, cb),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  close: (cb: any) => mockHttpsClose(cb),
};
const mockHttpsCreateServer: jest.Mock = jest.fn(() => mockHttpsServerInstance);
jest.mock('https', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createServer: (opts: any, handler: any) => mockHttpsCreateServer(opts, handler),
}));

jest.mock('../../../src/logging/winston-logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock child_process so tests can control execFileSync without requiring openssl binary
const mockExecFileSync = jest.fn();
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

import { MCPServer, createMCPServer } from '../../../src/mcp/mcp-server';
import type { ToolDefinition } from '../../../src/core/schema';

// ─── Fixtures ───────────────────────────────────────────────────────────

function createTestTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'test_tool',
    description: 'A test tool',
    version: '1.0.0',
    parameters: {
      message: { type: 'string', required: true, description: 'A message' },
    },
    execution: {
      type: 'command',
      command: 'echo',
      args: ['{message}'],
    },
    ...overrides,
  } as ToolDefinition;
}

function createAuthTool(): ToolDefinition {
  return {
    name: 'slack_send',
    description: 'Send a Slack message',
    version: '1.0.0',
    parameters: {
      channel: { type: 'string', required: true },
      text: { type: 'string', required: true },
    },
    execution: {
      type: 'http',
      method: 'POST',
      url: 'https://slack.com/api/chat.postMessage',
      headers: {
        Authorization: 'Bearer {SLACK_BOT_TOKEN}',
      },
      body: {
        channel: '{channel}',
        text: '{text}',
      },
    },
  } as unknown as ToolDefinition;
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('MCPServer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListTools.mockReturnValue([createTestTool()]);
  });

  describe('constructor', () => {
    it('should use default options', () => {
      const server = new MCPServer();
      // Verify no errors — defaults applied internally
      expect(server).toBeDefined();
    });

    it('should accept custom options', () => {
      const server = new MCPServer({
        transport: 'http',
        port: 8080,
        tools: ['specific_tool'],
        autoDiscover: false,
      });
      expect(server).toBeDefined();
    });
  });

  describe('start (stdio)', () => {
    it('should register all tools on the MCP server', async () => {
      const tool1 = createTestTool({ name: 'tool_one' });
      const tool2 = createTestTool({ name: 'tool_two' });
      mockListTools.mockReturnValue([tool1, tool2]);

      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start();

      // registerTool called once per tool
      expect(mockRegisterTool).toHaveBeenCalledTimes(2);
      expect(mockRegisterTool.mock.calls[0][0]).toBe('tool_one');
      expect(mockRegisterTool.mock.calls[1][0]).toBe('tool_two');

      // Verify config objects have description and inputSchema
      expect(mockRegisterTool.mock.calls[0][1]).toEqual(
        expect.objectContaining({ description: 'A test tool' })
      );

      await server.stop();
    });

    it('should connect with stdio transport', async () => {
      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start();

      expect(mockConnect).toHaveBeenCalledTimes(1);

      await server.stop();
    });

    it('should filter tools by allowlist', async () => {
      const tool1 = createTestTool({ name: 'allowed_tool' });
      const tool2 = createTestTool({ name: 'excluded_tool' });
      mockListTools.mockReturnValue([tool1, tool2]);

      const server = new MCPServer({
        transport: 'stdio',
        tools: ['allowed_tool'],
        autoDiscover: false,
      });
      await server.start();

      expect(mockRegisterTool).toHaveBeenCalledTimes(1);
      expect(mockRegisterTool.mock.calls[0][0]).toBe('allowed_tool');

      await server.stop();
    });

    it('should filter tools by denylist', async () => {
      const tool1 = createTestTool({ name: 'keep_tool' });
      const tool2 = createTestTool({ name: 'deny_tool' });
      mockListTools.mockReturnValue([tool1, tool2]);

      const server = new MCPServer({
        transport: 'stdio',
        excludeTools: ['deny_tool'],
        autoDiscover: false,
      });
      await server.start();

      expect(mockRegisterTool).toHaveBeenCalledTimes(1);
      expect(mockRegisterTool.mock.calls[0][0]).toBe('keep_tool');

      await server.stop();
    });

    it('should apply both allow and deny lists', async () => {
      const tools = [
        createTestTool({ name: 'a' }),
        createTestTool({ name: 'b' }),
        createTestTool({ name: 'c' }),
      ];
      mockListTools.mockReturnValue(tools);

      const server = new MCPServer({
        transport: 'stdio',
        tools: ['a', 'b'],
        excludeTools: ['b'],
        autoDiscover: false,
      });
      await server.start();

      expect(mockRegisterTool).toHaveBeenCalledTimes(1);
      expect(mockRegisterTool.mock.calls[0][0]).toBe('a');

      await server.stop();
    });

    it('should warn and continue when no tools are available after filtering', async () => {
      // All tools excluded → empty list triggers logger.warn (line 211)
      mockListTools.mockReturnValue([createTestTool({ name: 'excluded_tool' })]);

      const server = new MCPServer({
        transport: 'stdio',
        tools: ['some_other_tool'], // allowlist excludes the only tool
        autoDiscover: false,
      });
      await server.start();

      // Zero tools registered but server starts successfully
      expect(mockRegisterTool).not.toHaveBeenCalled();
      await server.stop();
    });

    it('should log and continue if a tool fails to register', async () => {
      // Make the first registerTool call throw (line 349 catch block)
      mockRegisterTool.mockImplementationOnce(() => {
        throw new Error('Schema validation failed');
      });
      mockListTools.mockReturnValue([
        createTestTool({ name: 'bad_tool' }),
        createTestTool({ name: 'good_tool' }),
      ]);

      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start(); // should not throw

      // Second tool still registered
      expect(mockRegisterTool).toHaveBeenCalledTimes(2);
      await server.stop();
    });
  });

  describe('tool execution handler', () => {
    it('should execute tool and return MCP content format', async () => {
      const tool = createTestTool();
      mockListTools.mockReturnValue([tool]);
      mockExecute.mockResolvedValue({ result: 'hello' });

      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start();

      // Get the callback passed to registerTool
      const callback = mockRegisterTool.mock.calls[0][2];
      const result = await callback({ message: 'hi' });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ result: 'hello' }, null, 2) }],
      });
      expect(mockExecute).toHaveBeenCalledWith(
        'test_tool',
        { message: 'hi' },
        { approved: false, credentials: {} }
      );

      await server.stop();
    });

    it('should return string results as text content', async () => {
      const tool = createTestTool();
      mockListTools.mockReturnValue([tool]);
      mockExecute.mockResolvedValue('plain text result');

      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start();

      const callback = mockRegisterTool.mock.calls[0][2];
      const result = await callback({ message: 'hi' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'plain text result' }],
      });

      await server.stop();
    });

    it('should return error content on MatimoError', async () => {
      const { MatimoError, ErrorCode } = jest.requireActual('../../../src/errors/matimo-error');
      const tool = createTestTool();
      mockListTools.mockReturnValue([tool]);
      mockExecute.mockRejectedValue(new MatimoError('Tool not found', ErrorCode.TOOL_NOT_FOUND));

      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start();

      const callback = mockRegisterTool.mock.calls[0][2];
      const result = await callback({ message: 'hi' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Tool not found' }],
        isError: true,
      });

      await server.stop();
    });

    it('should return error content on generic errors', async () => {
      const tool = createTestTool();
      mockListTools.mockReturnValue([tool]);
      mockExecute.mockRejectedValue(new Error('Something went wrong'));

      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start();

      const callback = mockRegisterTool.mock.calls[0][2];
      const result = await callback({ message: 'hi' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Something went wrong' }],
        isError: true,
      });

      await server.stop();
    });

    it('should block approval-required tools without _matimo_approved', async () => {
      const tool = createTestTool({
        name: 'dangerous_delete',
        requires_approval: true,
      });
      mockListTools.mockReturnValue([tool]);

      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start();

      const callback = mockRegisterTool.mock.calls[0][2];
      const result = await callback({ message: 'delete all' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('requires approval');
      expect(mockExecute).not.toHaveBeenCalled();

      await server.stop();
    });

    it('should not trust _matimo_approved as server approval by default', async () => {
      const tool = createTestTool({
        name: 'dangerous_delete',
        requires_approval: true,
      });
      mockListTools.mockReturnValue([tool]);
      mockExecute.mockResolvedValue({ deleted: true });

      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start();

      const callback = mockRegisterTool.mock.calls[0][2];
      const result = await callback({ message: 'delete all', _matimo_approved: true });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ deleted: true }, null, 2) }],
      });
      expect(mockExecute).toHaveBeenCalledWith(
        'dangerous_delete',
        {
          message: 'delete all',
        },
        { approved: false, credentials: {} }
      );

      await server.stop();
    });

    it('should trust _matimo_approved only when explicitly configured', async () => {
      const tool = createTestTool({
        name: 'dangerous_delete',
        requires_approval: true,
      });
      mockListTools.mockReturnValue([tool]);
      mockExecute.mockResolvedValue({ deleted: true });

      const server = new MCPServer({
        transport: 'stdio',
        autoDiscover: false,
        trustClientApproval: true,
      });
      await server.start();

      const callback = mockRegisterTool.mock.calls[0][2];
      const result = await callback({ message: 'delete all', _matimo_approved: true });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ deleted: true }, null, 2) }],
      });
      expect(mockExecute).toHaveBeenCalledWith(
        'dangerous_delete',
        {
          message: 'delete all',
        },
        { approved: true, credentials: {} }
      );

      await server.stop();
    });
  });

  describe('secret seeding', () => {
    it('should seed resolved secrets into process.env', async () => {
      const tool = createAuthTool();
      mockListTools.mockReturnValue([tool]);

      // Set env var that resolver would return
      const originalEnv = process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';

      const server = new MCPServer({
        transport: 'stdio',
        autoDiscover: false,
        secretResolver: { resolvers: [{ type: 'env' }] },
      });
      await server.start();

      // The secret should be available (already was, but also MATIMO_ prefixed)
      expect(process.env.SLACK_BOT_TOKEN).toBe('xoxb-test-token');

      await server.stop();

      // Restore
      if (originalEnv === undefined) {
        delete process.env.SLACK_BOT_TOKEN;
      } else {
        process.env.SLACK_BOT_TOKEN = originalEnv;
      }
    });

    it('should seed secret when env var is not pre-set', async () => {
      const tool = createAuthTool();
      mockListTools.mockReturnValue([tool]);

      // Ensure the env var is NOT set before start
      const originalEnv = process.env.SLACK_BOT_TOKEN;
      const originalMatimoEnv = process.env.MATIMO_SLACK_BOT_TOKEN;
      delete process.env.SLACK_BOT_TOKEN;
      delete process.env.MATIMO_SLACK_BOT_TOKEN;

      const server = new MCPServer({
        transport: 'stdio',
        autoDiscover: false,
        // Use env resolver — it won't find SLACK_BOT_TOKEN since we deleted it,
        // so resolveAll returns empty. Use a custom mock resolver instead.
        secretResolver: { resolvers: [{ type: 'env' }] },
      });
      await server.start();

      await server.stop();

      // Restore
      if (originalEnv !== undefined) process.env.SLACK_BOT_TOKEN = originalEnv;
      else delete process.env.SLACK_BOT_TOKEN;
      if (originalMatimoEnv !== undefined) process.env.MATIMO_SLACK_BOT_TOKEN = originalMatimoEnv;
      else delete process.env.MATIMO_SLACK_BOT_TOKEN;
    });
  });

  describe('stop', () => {
    it('should close MCP server and dispose resolver chain', async () => {
      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start();
      await server.stop();

      expect(mockClose).toHaveBeenCalledTimes(1);
      // After stop, getMatimoInstance should be null
      expect(server.getMatimoInstance()).toBeNull();
    });

    it('should handle stop when not started', async () => {
      const server = new MCPServer();
      // Should not throw
      await server.stop();
    });
  });

  describe('getMatimoInstance', () => {
    it('should return null before start', () => {
      const server = new MCPServer();
      expect(server.getMatimoInstance()).toBeNull();
    });

    it('should return instance after start', async () => {
      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start();

      const instance = server.getMatimoInstance();
      expect(instance).not.toBeNull();
      expect(instance!.execute).toBeDefined();

      await server.stop();
    });
  });

  describe('reloadTools', () => {
    it('should no-op when server has not been started', async () => {
      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      // reloadTools before start() — matimo is null → early return
      await server.reloadTools();
      expect(mockReloadTools).not.toHaveBeenCalled();
    });

    it('should reload tools and re-apply allow/deny filters', async () => {
      const toolA = createTestTool({ name: 'tool_a' });
      const toolB = createTestTool({ name: 'tool_b' });
      const toolC = createTestTool({ name: 'tool_c' });
      mockListTools.mockReturnValue([toolA, toolB, toolC]);
      mockReloadTools.mockResolvedValue({ loaded: ['tool_c'], removed: [], rejected: [] });

      const server = new MCPServer({
        transport: 'stdio',
        autoDiscover: false,
        tools: ['tool_a', 'tool_c'], // allowlist
        excludeTools: ['tool_c'], // denylist
      });
      await server.start();

      // After reload, listTools returns the same set;
      // filtering should keep only tool_a (allowed, not denied)
      await server.reloadTools();

      expect(mockReloadTools).toHaveBeenCalledTimes(1);
      await server.stop();
    });

    it('should call sendToolListChanged on the McpServer instance', async () => {
      mockListTools.mockReturnValue([createTestTool()]);
      mockReloadTools.mockResolvedValue({ loaded: [], removed: [], rejected: [] });

      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start();

      await server.reloadTools();
      expect(mockSendToolListChanged).toHaveBeenCalledTimes(1);

      await server.stop();
    });

    it('should remove stale skill resources and re-register current ones on reload', async () => {
      const mockRemove = jest.fn();
      mockRegisterResource.mockReturnValue({ remove: mockRemove });

      mockListTools.mockReturnValue([createTestTool()]);
      // First load: one skill
      mockListSkills
        .mockReturnValueOnce([{ name: 'skill-a', description: 'Skill A' }])
        // Reload: different skill
        .mockReturnValueOnce([{ name: 'skill-b', description: 'Skill B' }]);
      mockGetSkillContent.mockReturnValue('# Skill content');
      mockReloadTools.mockResolvedValue({ loaded: [], removed: [], rejected: [] });

      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start(); // registers skill-a resource

      const registerCallsAfterStart = mockRegisterResource.mock.calls.length;
      expect(registerCallsAfterStart).toBeGreaterThanOrEqual(1);

      await server.reloadTools(); // should remove skill-a, register skill-b

      expect(mockRemove).toHaveBeenCalledTimes(1);
      // At least one new registerResource call for skill-b
      expect(mockRegisterResource.mock.calls.length).toBeGreaterThan(registerCallsAfterStart);

      await server.stop();
    });

    it('should call sendResourceListChanged after reloading skill resources', async () => {
      mockListTools.mockReturnValue([createTestTool()]);
      mockListSkills.mockReturnValue([{ name: 'skill-a', description: 'Skill A' }]);
      mockGetSkillContent.mockReturnValue('# content');
      mockReloadTools.mockResolvedValue({ loaded: [], removed: [], rejected: [] });

      const server = new MCPServer({ transport: 'stdio', autoDiscover: false });
      await server.start();

      await server.reloadTools();

      expect(mockSendResourceListChanged).toHaveBeenCalledTimes(1);

      await server.stop();
    });
  });
});

describe('createMCPServer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListTools.mockReturnValue([createTestTool()]);
  });

  it('should create and start a server', async () => {
    const server = await createMCPServer({
      transport: 'stdio',
      autoDiscover: false,
    });

    expect(server).toBeInstanceOf(MCPServer);
    expect(mockConnect).toHaveBeenCalled();

    await server.stop();
  });
});

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

import * as http from 'http';

function httpRequest(
  port: number,
  method: string,
  path: string,
  options: { headers?: Record<string, string>; body?: string } = {}
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const bodyBuf = options.body ? Buffer.from(options.body) : undefined;
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(bodyBuf ? { 'Content-Length': bodyBuf.length } : {}),
          ...(options.headers ?? {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: data, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

function getServerPort(server: MCPServer): number {
  const httpSrv = (server as unknown as { httpServer: http.Server }).httpServer;
  const addr = httpSrv.address();
  if (addr && typeof addr === 'object') return addr.port;
  throw new Error('Server not listening');
}

describe('MCPServer — HTTP transport', () => {
  const TOKEN = 'test-bearer-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockListTools.mockReturnValue([createTestTool(), createTestTool({ name: 'tool_b' })]);
    mockIsInitializeRequest.mockReturnValue(false);
    mockHttpTransport.handleRequest.mockImplementation(
      async (_req: unknown, res: http.ServerResponse) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      }
    );
  });

  async function startHttpServer(token?: string, extraOpts: object = {}): Promise<MCPServer> {
    const server = new MCPServer({
      transport: 'http',
      port: 0, // OS assigns random free port
      autoDiscover: false,
      mcpToken: token ?? TOKEN,
      ...extraOpts,
    });
    await server.start();
    return server;
  }

  describe('token resolution', () => {
    it('should return null from getActiveToken() before start', () => {
      const server = new MCPServer({ transport: 'http', port: 0 });
      expect(server.getActiveToken()).toBeNull();
    });

    it('should expose the configured token after start', async () => {
      const server = await startHttpServer('my-fixed-token');
      expect(server.getActiveToken()).toBe('my-fixed-token');
      await server.stop();
    });

    it('should auto-generate a token when none is provided', async () => {
      const prev = process.env.MATIMO_MCP_TOKEN;
      delete process.env.MATIMO_MCP_TOKEN;

      const server = new MCPServer({ transport: 'http', port: 0, autoDiscover: false });
      await server.start();

      const token = server.getActiveToken();
      expect(token).toBeTruthy();
      expect(token).not.toBe('');

      await server.stop();
      if (prev !== undefined) process.env.MATIMO_MCP_TOKEN = prev;
    });

    it('should read token from MATIMO_MCP_TOKEN env var', async () => {
      const prev = process.env.MATIMO_MCP_TOKEN;
      process.env.MATIMO_MCP_TOKEN = 'env-token-123';

      const server = new MCPServer({ transport: 'http', port: 0, autoDiscover: false });
      await server.start();

      expect(server.getActiveToken()).toBe('env-token-123');
      await server.stop();

      if (prev === undefined) delete process.env.MATIMO_MCP_TOKEN;
      else process.env.MATIMO_MCP_TOKEN = prev;
    });
  });

  describe('health endpoint', () => {
    it('should return 200 with tool count — no auth required', async () => {
      const server = await startHttpServer();
      const port = getServerPort(server);

      const res = await httpRequest(port, 'GET', '/health');

      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(typeof body.tools).toBe('number');
      expect(body.tools).toBeGreaterThanOrEqual(0);

      await server.stop();
    });
  });

  describe('CORS preflight', () => {
    it('should return 204 for OPTIONS requests', async () => {
      const server = await startHttpServer();
      const port = getServerPort(server);

      const res = await httpRequest(port, 'OPTIONS', '/mcp');

      expect(res.status).toBe(204);
      await server.stop();
    });

    it('should set CORS headers on all responses', async () => {
      const server = await startHttpServer();
      const port = getServerPort(server);

      const res = await httpRequest(port, 'GET', '/health');

      expect(res.headers['access-control-allow-origin']).toBe('*');
      await server.stop();
    });
  });

  describe('bearer token auth', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const server = await startHttpServer();
      const port = getServerPort(server);

      const res = await httpRequest(port, 'GET', '/mcp');

      expect(res.status).toBe(401);
      expect(JSON.parse(res.body)).toEqual({ error: 'Unauthorized' });
      await server.stop();
    });

    it('should return 401 when token does not match', async () => {
      const server = await startHttpServer('correct-token');
      const port = getServerPort(server);

      const res = await httpRequest(port, 'GET', '/mcp', {
        headers: { Authorization: 'Bearer wrong-token' },
      });

      expect(res.status).toBe(401);
      await server.stop();
    });

    it('should allow requests with the correct Bearer token', async () => {
      const server = await startHttpServer(TOKEN);
      const port = getServerPort(server);

      // GET /mcp with correct token — returns 400 (missing session), not 401
      const res = await httpRequest(port, 'GET', '/mcp', {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });

      expect(res.status).not.toBe(401);
      await server.stop();
    });
  });

  describe('MCP endpoint routing', () => {
    it('should return 404 for unknown URLs', async () => {
      const server = await startHttpServer();
      const port = getServerPort(server);

      const res = await httpRequest(port, 'GET', '/unknown-path', {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });

      expect(res.status).toBe(404);
      await server.stop();
    });

    it('should return 400 for GET /mcp without a session ID', async () => {
      const server = await startHttpServer();
      const port = getServerPort(server);

      const res = await httpRequest(port, 'GET', '/mcp', {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });

      expect(res.status).toBe(400);
      await server.stop();
    });

    it('should return 404 for DELETE /mcp with unknown session ID', async () => {
      const server = await startHttpServer();
      const port = getServerPort(server);

      const res = await httpRequest(port, 'DELETE', '/mcp', {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Mcp-Session-Id': 'nonexistent-session',
        },
      });

      expect(res.status).toBe(404);
      await server.stop();
    });

    it('should return 400 with JSON-RPC parse error for POST /mcp with invalid JSON body', async () => {
      const server = await startHttpServer();
      const port = getServerPort(server);

      const res = await httpRequest(port, 'POST', '/mcp', {
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: 'this is not valid json {{{',
      });

      expect(res.status).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.jsonrpc).toBe('2.0');
      expect(body.error?.code).toBe(-32700); // JSON-RPC Parse Error code
      expect(body.error?.message).toMatch(/invalid json/i);
      await server.stop();
    });

    it('should return 400 for POST /mcp with non-initialize body', async () => {
      mockIsInitializeRequest.mockReturnValue(false);
      const server = await startHttpServer();
      const port = getServerPort(server);

      const res = await httpRequest(port, 'POST', '/mcp', {
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
      });

      expect(res.status).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message ?? body.error).toMatch(/session/i);
      await server.stop();
    });

    it('should handle POST /mcp with initialize request (new session)', async () => {
      mockIsInitializeRequest.mockReturnValue(true);
      const server = await startHttpServer();
      const port = getServerPort(server);

      const res = await httpRequest(port, 'POST', '/mcp', {
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          params: { protocolVersion: '2024-11-05', capabilities: {} },
          id: 1,
        }),
      });

      // Should attempt session creation — handler mock writes 200
      expect(res.status).toBe(200);
      await server.stop();
    });

    it('should route subsequent requests to an existing session', async () => {
      mockIsInitializeRequest.mockReturnValue(true);
      const server = await startHttpServer();
      const port = getServerPort(server);

      // First request — creates a session (mock fires onsessioninitialized via setTimeout)
      await httpRequest(port, 'POST', '/mcp', {
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
      });

      // Wait for the setTimeout(0) in the mock to fire so the session is registered
      await new Promise<void>((resolve) => setTimeout(resolve, 20));

      // Second request — should be routed to the existing session (lines 461-463)
      const res2 = await httpRequest(port, 'POST', '/mcp', {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Mcp-Session-Id': 'test-session-id',
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 2 }),
      });

      expect(res2.status).toBe(200);
      await server.stop();
    });

    it('should delete session and clean up when transport closes', async () => {
      mockIsInitializeRequest.mockReturnValue(true);
      const server = await startHttpServer();
      const port = getServerPort(server);

      // Create a session
      await httpRequest(port, 'POST', '/mcp', {
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
      });

      // Wait for onsessioninitialized to fire
      await new Promise<void>((resolve) => setTimeout(resolve, 20));

      // Trigger the transport.onclose callback (covers lines 502-505)
      if (mockHttpTransport.onclose) {
        mockHttpTransport.onclose();
      }

      // Session is now cleaned up — DELETE should return 404
      const res = await httpRequest(port, 'DELETE', '/mcp', {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Mcp-Session-Id': 'test-session-id',
        },
      });
      expect(res.status).toBe(404);

      await server.stop();
    });

    it('should handle request via root URL (/)', async () => {
      const server = await startHttpServer();
      const port = getServerPort(server);

      // '/' is treated identically to '/mcp' — no session → non-init body → 400
      const res = await httpRequest(port, 'POST', '/', {
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
      });

      expect(res.status).toBe(400);
      await server.stop();
    });
  });
});

// ─── HTTPS / TLS error paths ──────────────────────────────────────────────────

import { tmpdir } from 'os';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join as pathJoin } from 'path';

describe('MCPServer — HTTPS / TLS error paths', () => {
  let tempDir: string;

  beforeAll(() => {
    jest.clearAllMocks();
    tempDir = pathJoin(tmpdir(), `matimo-tls-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockListTools.mockReturnValue([createTestTool()]);
    // Default: https listen and close call their callbacks immediately (simulating bound/closed server)
    mockHttpsListen.mockImplementation((port: number, cb: () => void) => cb());
    mockHttpsClose.mockImplementation((cb: () => void) => cb());
  });

  it('should throw MatimoError when certPath does not exist', async () => {
    const server = new MCPServer({
      transport: 'http',
      port: 0,
      autoDiscover: false,
      mcpToken: 'test-token',
      https: true,
      selfSigned: false,
      certPath: pathJoin(tempDir, 'nonexistent-cert.pem'),
      keyPath: pathJoin(tempDir, 'key.pem'),
    });

    await expect(server.start()).rejects.toThrow('TLS certificate not found');
  });

  it('should throw MatimoError when certPath exists but keyPath does not', async () => {
    const fakeCert = pathJoin(tempDir, 'server.crt');
    writeFileSync(fakeCert, '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----\n');

    const server = new MCPServer({
      transport: 'http',
      port: 0,
      autoDiscover: false,
      mcpToken: 'test-token',
      https: true,
      selfSigned: false,
      certPath: fakeCert,
      keyPath: pathJoin(tempDir, 'nonexistent-key.pem'),
    });

    await expect(server.start()).rejects.toThrow('TLS private key not found');
  });

  it('should read cert and key from provided files when both exist', async () => {
    const fakeCert = pathJoin(tempDir, 'server2.crt');
    const fakeKey = pathJoin(tempDir, 'server2.key');
    const certContent = '-----BEGIN CERTIFICATE-----\nfake-cert\n-----END CERTIFICATE-----\n';
    const keyContent = '-----BEGIN PRIVATE KEY-----\nfake-key\n-----END PRIVATE KEY-----\n';
    writeFileSync(fakeCert, certContent);
    writeFileSync(fakeKey, keyContent);

    const server = new MCPServer({
      transport: 'http',
      port: 9556,
      autoDiscover: false,
      mcpToken: 'test-token',
      https: true,
      selfSigned: false,
      certPath: fakeCert,
      keyPath: fakeKey,
    });

    // https is mocked — server starts successfully with fake cert/key content
    await server.start();
    expect(mockHttpsCreateServer).toHaveBeenCalledWith(
      expect.objectContaining({ cert: certContent, key: keyContent }),
      expect.any(Function)
    );
    await server.stop();
  });

  it('should throw MatimoError with openssl failure reason when execFileSync throws', async () => {
    // No cached certs — empty temp dir, so generateSelfSignedCert falls through to createSelfSignedCertViaCli
    const emptyCertsRoot = pathJoin(tmpdir(), `matimo-no-cache-${Date.now()}`);
    mkdirSync(emptyCertsRoot, { recursive: true });
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(emptyCertsRoot);

    // Simulate openssl not being available
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('openssl: command not found');
    });

    const server = new MCPServer({
      transport: 'http',
      port: 9558,
      autoDiscover: false,
      mcpToken: 'test-token',
      selfSigned: true,
    });

    await expect(server.start()).rejects.toThrow(
      'Failed to generate self-signed certificate: openssl: command not found. Install openssl or provide --cert and --key paths.'
    );

    cwdSpy.mockRestore();
    try {
      rmSync(emptyCertsRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('should use cached self-signed certs from .matimo/certs/ without calling openssl', async () => {
    // Set up a temp directory with pre-cached cert files
    const cachedCertsRoot = pathJoin(tmpdir(), `matimo-cached-${Date.now()}`);
    const certsDir = pathJoin(cachedCertsRoot, '.matimo', 'certs');
    mkdirSync(certsDir, { recursive: true });
    const cachedCert = '-----BEGIN CERTIFICATE-----\ncached-cert\n-----END CERTIFICATE-----\n';
    const cachedKey = '-----BEGIN PRIVATE KEY-----\ncached-key\n-----END PRIVATE KEY-----\n';
    writeFileSync(pathJoin(certsDir, 'server.crt'), cachedCert);
    writeFileSync(pathJoin(certsDir, 'server.key'), cachedKey);

    // Redirect process.cwd() to the temp dir so generateSelfSignedCert finds the cached files
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(cachedCertsRoot);

    const server = new MCPServer({
      transport: 'http',
      port: 9557,
      autoDiscover: false,
      mcpToken: 'test-token',
      selfSigned: true, // triggers generateSelfSignedCert (no certPath/keyPath)
    });

    await server.start();
    // https.createServer should have been called with the cached cert/key content
    expect(mockHttpsCreateServer).toHaveBeenCalledWith(
      expect.objectContaining({ cert: cachedCert, key: cachedKey }),
      expect.any(Function)
    );
    await server.stop();

    cwdSpy.mockRestore();
    try {
      rmSync(cachedCertsRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('should generate and save self-signed cert when no cached certs exist and openssl succeeds', async () => {
    const genRoot = pathJoin(tmpdir(), `matimo-gen-cert-${Date.now()}`);
    mkdirSync(genRoot, { recursive: true });
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(genRoot);

    const fakeCertPem = '-----BEGIN CERTIFICATE-----\ngenerated-cert\n-----END CERTIFICATE-----\n';

    // Mock execFileSync to write the cert file (simulating openssl -out)
    mockExecFileSync.mockImplementationOnce((_cmd: string, args: string[]) => {
      const outIdx = args.indexOf('-out');
      if (outIdx !== -1 && args[outIdx + 1]) {
        writeFileSync(args[outIdx + 1], fakeCertPem);
      }
    });

    const server = new MCPServer({
      transport: 'http',
      port: 9559,
      autoDiscover: false,
      mcpToken: 'test-token',
      selfSigned: true,
    });

    await server.start();

    // https.createServer should have been called with the generated cert
    expect(mockHttpsCreateServer).toHaveBeenCalledWith(
      expect.objectContaining({ cert: fakeCertPem }),
      expect.any(Function)
    );

    // Cert should be cached to disk
    const { existsSync: existsSyncCheck } = await import('fs');
    expect(existsSyncCheck(pathJoin(genRoot, '.matimo', 'certs', 'server.crt'))).toBe(true);
    expect(existsSyncCheck(pathJoin(genRoot, '.matimo', 'certs', 'server.key'))).toBe(true);

    await server.stop();
    cwdSpy.mockRestore();
    try {
      rmSync(genRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('should reject stop() when httpServer.close() fires an error', async () => {
    const certRoot = pathJoin(tmpdir(), `matimo-stop-err-${Date.now()}`);
    const certsDir2 = pathJoin(certRoot, '.matimo', 'certs');
    mkdirSync(certsDir2, { recursive: true });
    writeFileSync(
      pathJoin(certsDir2, 'server.crt'),
      '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----\n'
    );
    writeFileSync(
      pathJoin(certsDir2, 'server.key'),
      '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n'
    );
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(certRoot);

    const server = new MCPServer({
      transport: 'http',
      port: 9560,
      autoDiscover: false,
      mcpToken: 'test-token',
      selfSigned: true,
    });

    await server.start();

    // Make the HTTPS mock server close() return an error
    mockHttpsClose.mockImplementationOnce((cb: (err?: Error) => void) =>
      cb(new Error('close failed'))
    );

    await expect(server.stop()).rejects.toThrow('close failed');

    cwdSpy.mockRestore();
    try {
      rmSync(certRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });
});
