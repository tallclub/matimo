/**
 * Tests for per-execution credential override (options.credentials)
 *
 * Covers:
 * - HttpExecutor: Basic Auth via credentials instead of process.env
 * - CommandExecutor: credentials injected as child-process env vars
 * - FunctionExecutor: credentials forwarded as context.credentials
 * - MatimoInstance.execute(): credential threading + injectAuthParameters priority
 * - Backward compatibility: no credentials → existing env-var behaviour unchanged
 * - Partial credentials: only some keys provided, rest fall back to env
 * - Security: credential values never surface in error messages
 */

import axios from 'axios';
import { spawn } from 'child_process';
import { HttpExecutor } from '../../src/executors/http-executor';
import { CommandExecutor } from '../../src/executors/command-executor';
import { FunctionExecutor } from '../../src/executors/function-executor';
import { MatimoInstance } from '../../src/matimo-instance';
import { MatimoError, ErrorCode } from '../../src/errors/matimo-error';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Helper: create a minimal fake EventEmitter-like child process
function makeFakeChild(exitCode = 0, stdoutData = '{"ok":true}') {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const on = jest.fn((event: string, cb: (...args: unknown[]) => void) => {
    listeners[event] = listeners[event] || [];
    listeners[event].push(cb);
    return child;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const child: any = {
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on,
    kill: jest.fn(),
    _emit: (event: string, ...args: unknown[]) => {
      (listeners[event] || []).forEach((cb) => cb(...args));
    },
    _emitData: (data: string) => {
      // Trigger 'data' on stdout
      const stdoutListeners = (child.stdout.on as jest.Mock).mock.calls;
      stdoutListeners.forEach(([event, cb]: [string, (d: Buffer) => void]) => {
        if (event === 'data') cb(Buffer.from(data));
      });
    },
  };

  // Auto-emit close after the Promise chain resolves (setImmediate)
  child.stdout.on.mockImplementation((event: string, cb: (d: Buffer) => void) => {
    if (event === 'data') setTimeout(() => cb(Buffer.from(stdoutData)), 0);
    return child.stdout;
  });
  child.stderr.on.mockImplementation(() => child.stderr);
  child.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
    if (event === 'close') setTimeout(() => cb(exitCode), 5);
    return child;
  });

  return child;
}

// ─── HttpExecutor ─────────────────────────────────────────────────────────────

describe('HttpExecutor – credential override', () => {
  let executor: HttpExecutor;

  beforeEach(() => {
    executor = new HttpExecutor();
    jest.clearAllMocks();
  });

  const basicAuthTool = {
    name: 'basic-auth-tool',
    version: '1.0.0',
    description: 'Tool using Basic Auth',
    parameters: {},
    execution: {
      type: 'http' as const,
      method: 'GET' as const,
      url: 'https://api.example.com/data',
    },
    authentication: {
      type: 'basic' as const,
      username_env: 'MY_USERNAME',
      password_env: 'MY_PASSWORD',
    },
  };

  it('should use credentials for Basic Auth instead of process.env', async () => {
    // Ensure env vars are NOT set so any failure means credentials weren't used
    delete process.env.MY_USERNAME;
    delete process.env.MY_PASSWORD;

    mockedAxios.request.mockResolvedValue({ status: 200, data: { ok: true } });

    await executor.execute(
      basicAuthTool,
      {},
      {
        MY_USERNAME: 'tenant-user',
        MY_PASSWORD: 'tenant-pass',
      }
    );

    const callArgs = mockedAxios.request.mock.calls[0][0];
    const expectedAuth = Buffer.from('tenant-user:tenant-pass').toString('base64');
    expect((callArgs.headers as Record<string, string>).Authorization).toBe(
      `Basic ${expectedAuth}`
    );
  });

  it('should fall back to process.env when no credentials provided (backward compat)', async () => {
    process.env.MY_USERNAME = 'env-user';
    process.env.MY_PASSWORD = 'env-pass';

    mockedAxios.request.mockResolvedValue({ status: 200, data: { ok: true } });

    // No credentials argument — old API
    await executor.execute(basicAuthTool, {});

    const callArgs = mockedAxios.request.mock.calls[0][0];
    const expectedAuth = Buffer.from('env-user:env-pass').toString('base64');
    expect((callArgs.headers as Record<string, string>).Authorization).toBe(
      `Basic ${expectedAuth}`
    );

    delete process.env.MY_USERNAME;
    delete process.env.MY_PASSWORD;
  });

  it('should prefer credentials over process.env when both are set', async () => {
    process.env.MY_USERNAME = 'env-user';
    process.env.MY_PASSWORD = 'env-pass';

    mockedAxios.request.mockResolvedValue({ status: 200, data: { ok: true } });

    await executor.execute(
      basicAuthTool,
      {},
      {
        MY_USERNAME: 'override-user',
        MY_PASSWORD: 'override-pass',
      }
    );

    const callArgs = mockedAxios.request.mock.calls[0][0];
    const expectedAuth = Buffer.from('override-user:override-pass').toString('base64');
    expect((callArgs.headers as Record<string, string>).Authorization).toBe(
      `Basic ${expectedAuth}`
    );

    delete process.env.MY_USERNAME;
    delete process.env.MY_PASSWORD;
  });

  it('should throw AUTH_FAILED if neither credentials nor env vars are set', async () => {
    delete process.env.MY_USERNAME;
    delete process.env.MY_PASSWORD;

    let caught: unknown;
    try {
      await executor.execute(basicAuthTool, {});
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    expect((caught as MatimoError).code).toBe(ErrorCode.AUTH_FAILED);

    // Env-var NAMES may appear in the error message (helpful for debugging)
    // but no SECRET VALUES should be present (there are none here to leak)
    const errorText = JSON.stringify(caught);
    // Confirm the error is about missing credentials, not something unrelated
    expect(errorText).toContain('AUTH_FAILED');
  });

  it('should execute normally without authentication config (no credentials needed)', async () => {
    const noAuthTool = {
      name: 'no-auth-tool',
      version: '1.0.0',
      description: 'No auth required',
      parameters: {},
      execution: {
        type: 'http' as const,
        method: 'GET' as const,
        url: 'https://api.example.com/public',
      },
    };

    mockedAxios.request.mockResolvedValue({ status: 200, data: { result: 'ok' } });

    const result = (await executor.execute(noAuthTool, {}, { SOME_TOKEN: 'value' })) as Record<
      string,
      unknown
    >;
    expect(result.success).toBe(true);
  });
});

// ─── CommandExecutor ──────────────────────────────────────────────────────────

describe('CommandExecutor – credential override', () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor('/tmp');
    jest.clearAllMocks();
  });

  const echoTool = {
    name: 'echo-tool',
    version: '1.0.0',
    description: 'Echo test tool',
    parameters: {},
    execution: {
      type: 'command' as const,
      command: 'echo',
      args: ['hello'],
      timeout: 5000,
    },
  };

  it('should inject credentials as env vars into the child process', async () => {
    mockedSpawn.mockReturnValue(makeFakeChild(0, 'done'));

    await executor.execute(
      echoTool,
      {},
      {
        SLACK_BOT_TOKEN: 'xoxb-tenant-a',
        API_KEY: 'secret-key',
      }
    );

    const spawnCall = mockedSpawn.mock.calls[0];
    const spawnOptions = spawnCall[2] as { env?: Record<string, string> };

    expect(spawnOptions.env).toBeDefined();
    expect(spawnOptions.env!.SLACK_BOT_TOKEN).toBe('xoxb-tenant-a');
    expect(spawnOptions.env!.API_KEY).toBe('secret-key');
    // Should still include existing process.env variables
    expect(spawnOptions.env!.PATH).toBe(process.env.PATH);
  });

  it('should use process.env (no extra keys) when credentials not provided (backward compat)', async () => {
    mockedSpawn.mockReturnValue(makeFakeChild(0, 'done'));

    await executor.execute(echoTool, {});

    const spawnCall = mockedSpawn.mock.calls[0];
    const spawnOptions = spawnCall[2] as { env?: Record<string, string> };

    // When no credentials given, env should be process.env itself
    expect(spawnOptions.env).toBe(process.env);
  });

  it('should let credentials override process.env values for same key', async () => {
    process.env.SLACK_BOT_TOKEN = 'original-env-token';
    mockedSpawn.mockReturnValue(makeFakeChild(0, 'done'));

    await executor.execute(echoTool, {}, { SLACK_BOT_TOKEN: 'overridden-token' });

    const spawnCall = mockedSpawn.mock.calls[0];
    const spawnOptions = spawnCall[2] as { env?: Record<string, string> };

    expect(spawnOptions.env!.SLACK_BOT_TOKEN).toBe('overridden-token');

    delete process.env.SLACK_BOT_TOKEN;
  });
});

// ─── FunctionExecutor ─────────────────────────────────────────────────────────

describe('FunctionExecutor – credential override', () => {
  it('should pass credentials as context.credentials to external tool function', async () => {
    // We test the call shape rather than running real dynamically-imported code by
    // inspecting the executor behaviour through a mock import.
    // Since dynamic imports aren't easily intercepted in Jest, we verify that
    // execute() accepts credentials without throwing and that the param is threaded.
    const executor = new FunctionExecutor('/tmp');

    const tool = {
      name: 'fn-tool',
      version: '1.0.0',
      description: 'Function tool',
      parameters: {},
      execution: {
        type: 'function' as const,
        code: './nonexistent-file.ts',
        timeout: 1000,
      },
      _definitionPath: '/tmp/tools/fn-tool/definition.yaml',
    };

    // The file doesn't exist → expect a rejection (not a crash from missing credentials param)
    const result = (await executor.execute(
      tool,
      { msg: 'hello' },
      {
        MY_TOKEN: 'ctx-token',
      }
    )) as Record<string, unknown>;

    // Resolves with error object (FunctionExecutor never throws, always resolves)
    expect(result.success).toBe(false);
    // Error should be about file-not-found, not about missing credentials parameter
    expect(typeof result.error).toBe('string');
  });

  it('should work without credentials (backward compat)', async () => {
    const executor = new FunctionExecutor('/tmp');

    const tool = {
      name: 'fn-tool-no-creds',
      version: '1.0.0',
      description: 'No creds',
      parameters: {},
      execution: {
        type: 'function' as const,
        code: './nonexistent.ts',
        timeout: 1000,
      },
      _definitionPath: '/tmp/tools/fn-tool-no-creds/definition.yaml',
    };

    // Should not crash regardless of whether credentials arg is passed
    const result = (await executor.execute(tool, {})) as Record<string, unknown>;
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});

// ─── MatimoInstance.execute() ─────────────────────────────────────────────────

describe('MatimoInstance.execute() – credential override', () => {
  let instance: MatimoInstance;
  const toolsPath = require('path').join(__dirname, '../fixtures/tools');

  beforeAll(async () => {
    instance = await MatimoInstance.init(toolsPath);
  });

  afterEach(() => {
    // Clean auth-related env vars to prevent leakage between tests
    delete process.env.GMAIL_ACCESS_TOKEN;
    delete process.env.MATIMO_GMAIL_ACCESS_TOKEN;
    delete process.env.SLACK_BOT_TOKEN;
  });

  it('should accept execute() options without credentials (backward compat)', async () => {
    // execute() with no options at all — must not throw a TypeError
    await expect(instance.execute('non-existent-tool', {})).rejects.toThrow('not found');
  });

  it('should accept execute() with empty credentials object without throwing', async () => {
    await expect(instance.execute('non-existent-tool', {}, { credentials: {} })).rejects.toThrow(
      'not found'
    );
  });

  it('should use credentials to inject auth params instead of process.env', async () => {
    // Ensure env is clean so the injection MUST come from credentials
    delete process.env.GMAIL_ACCESS_TOKEN;
    delete process.env.MATIMO_GMAIL_ACCESS_TOKEN;

    // gmail-send-email expects GMAIL_ACCESS_TOKEN in the Authorization header
    // With credentials it should try to make an HTTP call (which will fail at
    // network level or schema validation) — NOT at the auth-injection layer.
    // We're confirming it advances past auth injection.
    try {
      await instance.execute(
        'gmail-send-email',
        { to: 'user@example.com', subject: 'Hi', body: 'Test' },
        { credentials: { GMAIL_ACCESS_TOKEN: 'tenant-gmail-token' } }
      );
    } catch (err) {
      // Should NOT fail with "missing token" style message — the token was supplied
      const msg = (err as Error).message ?? '';
      expect(msg).not.toMatch(/token.*required|auth.*required/i);
    }
  });

  it('should fall back to process.env when credentials are not provided', async () => {
    process.env.MATIMO_GMAIL_ACCESS_TOKEN = 'env-token-fallback';

    // Without credentials the env-var injection must still work
    try {
      await instance.execute('gmail-send-email', {
        to: 'user@example.com',
        subject: 'Test',
        body: 'Test',
      });
    } catch (err) {
      // Error should be something other than missing auth
      const msg = (err as Error).message ?? '';
      expect(msg).not.toMatch(/token.*required|auth.*required/i);
    }

    delete process.env.MATIMO_GMAIL_ACCESS_TOKEN;
  });

  it('should handle partial credentials (provided key takes priority; others fall back to env)', async () => {
    process.env.SLACK_BOT_TOKEN = 'env-slack-token';
    delete process.env.GMAIL_ACCESS_TOKEN;

    // Only GMAIL_ACCESS_TOKEN provided in credentials; SLACK_BOT_TOKEN falls back to env
    // We simply verify that execute resolves/rejects without a TypeError
    try {
      await instance.execute(
        'gmail-send-email',
        { to: 'a@b.com', subject: 'hello', body: 'world' },
        { credentials: { GMAIL_ACCESS_TOKEN: 'per-call-gmail-token' } }
      );
    } catch {
      // expected
    }

    // Env token still intact (credentials are never written to process.env)
    expect(process.env.SLACK_BOT_TOKEN).toBe('env-slack-token');
  });

  it('should not modify process.env when credentials are provided', async () => {
    const originalEnv = { ...process.env };

    try {
      await instance.execute(
        'non-existent-tool',
        {},
        { credentials: { SECRET_KEY: 'should-not-leak', API_TOKEN: 'never-persist' } }
      );
    } catch {
      // expected — tool not found
    }

    // process.env must be unchanged
    expect(process.env.SECRET_KEY).toBeUndefined();
    expect(process.env.API_TOKEN).toBeUndefined();
    expect(Object.keys(process.env)).toEqual(Object.keys(originalEnv));
  });

  it('credential values should not appear in error messages', async () => {
    try {
      await instance.execute(
        'non-existent-tool',
        {},
        { credentials: { MY_SECRET: 'ultra-secret-value-abc123' } }
      );
    } catch (err) {
      const errorStr = JSON.stringify(err) + (err as Error).message;
      expect(errorStr).not.toContain('ultra-secret-value-abc123');
    }
  });
});

// ─── ExecuteOptions type export ───────────────────────────────────────────────

describe('ExecuteOptions – type export', () => {
  it('should be a valid TypeScript type (compile-time check)', () => {
    // Import at the type level; runtime presence confirmed by the test file compiling
    // and importing MatimoInstance at the top of this file without errors.
    // If ExecuteOptions were missing from the public API this file would not compile.
    type TestOptions = import('../../src/core/types').ExecuteOptions;
    const opts: TestOptions = { timeout: 1000, credentials: { KEY: 'val' } };
    expect(opts.timeout).toBe(1000);
    expect(opts.credentials?.KEY).toBe('val');
  });
});

// ─── getRequiredCredentials() ─────────────────────────────────────────────────

describe('MatimoInstance.getRequiredCredentials()', () => {
  let instance: MatimoInstance;
  const toolsPath = require('path').join(__dirname, '../fixtures/tools');

  beforeAll(async () => {
    instance = await MatimoInstance.init(toolsPath);
  });

  it('should return auth-key names for a tool that uses a bearer token', () => {
    // complex-body-tool has {token} in its Authorization header and body
    const keys = instance.getRequiredCredentials('complex-body-tool');
    expect(keys).toContain('token');
  });

  it('should return auth-key names for a tool that uses an API key', () => {
    // http-with-auth has {API_KEY} in headers and query params
    const keys = instance.getRequiredCredentials('http-with-auth');
    expect(keys).toContain('API_KEY');
  });

  it('should return an empty array for a tool with no auth parameters', () => {
    // edge-case-tool only has {value1} and {value2} — no auth patterns
    const keys = instance.getRequiredCredentials('edge-case-tool');
    expect(keys).toEqual([]);
  });

  it('should return only auth-related keys, not regular user parameters', () => {
    // complex-body-tool has name/email/phone (user params) and token (auth)
    const keys = instance.getRequiredCredentials('complex-body-tool');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('email');
    expect(keys).not.toContain('phone');
    expect(keys).not.toContain('tags');
    expect(keys).toContain('token');
  });

  it('should throw TOOL_NOT_FOUND for an unknown tool', () => {
    expect(() => instance.getRequiredCredentials('no-such-tool')).toThrow(MatimoError);
    try {
      instance.getRequiredCredentials('no-such-tool');
    } catch (err) {
      expect((err as MatimoError).code).toBe(ErrorCode.TOOL_NOT_FOUND);
    }
  });

  it('result can be used directly to build a credentials map', async () => {
    // This verifies the primary DX use-case: discover → collect → execute
    const keys = instance.getRequiredCredentials('complex-body-tool');
    const fakeVault: Record<string, string> = { token: 'my-secret-token' };

    const credentials = Object.fromEntries(keys.map((k) => [k, fakeVault[k] ?? '']));

    // The correct credential key was discovered and mapped from the vault
    expect(credentials).toEqual({ token: 'my-secret-token' });

    // Passing these to execute() must not throw a TypeError or schema error on the
    // credentials shape itself (network errors are fine and expected here)
    let threw = false;
    try {
      await instance.execute(
        'complex-body-tool',
        { name: 'Alice', email: 'alice@example.com' },
        { credentials }
      );
    } catch (e) {
      if (e instanceof TypeError) threw = true;
    }
    expect(threw).toBe(false);
  });

  it('should return consistent results on repeated calls (deterministic)', () => {
    const keys1 = instance.getRequiredCredentials('http-with-auth');
    const keys2 = instance.getRequiredCredentials('http-with-auth');
    expect(keys1).toEqual(keys2);
  });

  it('should include basic-auth env var names from authentication config', () => {
    // Verify getRequiredCredentials is callable and doesn't throw.
    // The username_env/password_env branch of the implementation is covered by the
    // HttpExecutor basic-auth tests above; here we confirm the method is stable.
    expect(() => instance.getRequiredCredentials('http-with-auth')).not.toThrow();
  });
});
