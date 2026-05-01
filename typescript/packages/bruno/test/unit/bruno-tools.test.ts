/**
 * Unit tests for all 7 Bruno tool executors (TypeScript).
 *
 * YAML definition tests verify schema correctness after removing api_key
 * authentication and default retry=0.
 *
 * Executor tests cover all branches using real tmp dirs for filesystem tools
 * and mocked execFileSync for CLI tools.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

// ─── Mock child_process before executor imports ───────────────────────────────
jest.mock('child_process', () => ({
  execFileSync: jest.fn(),
}));

import { execFileSync } from 'child_process';
const mockExec = execFileSync as jest.MockedFunction<typeof execFileSync>;

// ─── Type helpers ─────────────────────────────────────────────────────────────

type ExecResult = Record<string, unknown>;

type ToolDefinition = {
  name: string;
  description?: string;
  version?: string;
  status?: string;
  parameters?: Record<string, unknown>;
  execution?: { type?: string; command?: string; args?: unknown[]; code?: string };
  output_schema?: Record<string, unknown>;
  authentication?: { type?: string };
  error_handling?: { retry?: number };
  examples?: Array<{ name: string; params: Record<string, unknown> }>;
};

// ─── Paths ───────────────────────────────────────────────────────────────────

const TOOLS_ROOT = path.join(__dirname, '../../tools');
const TOOL_NAMES = [
  'bruno_run_collection',
  'bruno_run_request',
  'bruno_list_collections',
  'bruno_get_collection_info',
  'bruno_import_openapi',
  'bruno_create_collection',
  'bruno_add_request',
];

// ─── Temp directory helpers ───────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-bruno-test-'));
}

function makeBruFile(dir: string, name: string, method = 'GET'): string {
  const filePath = path.join(dir, `${name}.bru`);
  fs.writeFileSync(
    filePath,
    `meta {\n  name: ${name}\n  type: http\n  seq: 1\n}\n\n${method} {\n  url: https://example.com\n  body: none\n  auth: inherit\n}\n`
  );
  return filePath;
}

function makeBrunoJson(dir: string, name: string): void {
  fs.writeFileSync(
    path.join(dir, 'bruno.json'),
    JSON.stringify({ name, version: '1', type: 'collection' })
  );
}

// ─── YAML Definition Tests ────────────────────────────────────────────────────

describe('bruno tool YAML definitions', () => {
  TOOL_NAMES.forEach((toolName) => {
    describe(toolName, () => {
      let def: ToolDefinition;

      beforeAll(() => {
        const toolPath = path.join(TOOLS_ROOT, toolName, 'definition.yaml');
        def = yaml.load(fs.readFileSync(toolPath, 'utf-8')) as ToolDefinition;
      });

      it('has all required YAML fields', () => {
        expect(def.name).toBe(toolName);
        expect(def.description).toBeTruthy();
        expect(def.version).toBeTruthy();
        expect(['stable', 'approved']).toContain(def.status);
        expect(def.parameters).toBeDefined();
        expect(def.execution).toBeDefined();
        expect(def.output_schema).toBeDefined();
      });

      it('has no api_key authentication (CLI tools need none)', () => {
        expect(def.authentication).toBeUndefined();
      });

      it('has no explicit error_handling (default retry=0 is implicit)', () => {
        expect(def.error_handling).toBeUndefined();
      });

      it('has at least one example', () => {
        expect(Array.isArray(def.examples)).toBe(true);
        expect((def.examples ?? []).length).toBeGreaterThanOrEqual(1);
      });

      it('has execution type function with code = index.ts', () => {
        expect(def.execution?.type).toBe('function');
        expect(def.execution?.code).toBe('index.ts');
      });
    });
  });
});

// ─── bruno_create_collection ─────────────────────────────────────────────────

describe('bruno_create_collection executor', () => {
  const execute = require('../../tools/bruno_create_collection/index').default as (
    p: Record<string, unknown>
  ) => Promise<ExecResult>;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates directory and bruno.json', async () => {
    const colPath = path.join(tmpDir, 'my-api');
    const result = await execute({ collection_path: colPath, collection_name: 'My API' });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(fs.existsSync(path.join(colPath, 'bruno.json'))).toBe(true);
    const content = JSON.parse(fs.readFileSync(path.join(colPath, 'bruno.json'), 'utf-8'));
    expect(content.name).toBe('My API');
  });

  it('succeeds when directory already exists', async () => {
    const colPath = path.join(tmpDir, 'existing');
    fs.mkdirSync(colPath);
    const result = await execute({ collection_path: colPath, collection_name: 'Existing' });
    expect(result.success).toBe(true);
  });

  it('creates nested directories', async () => {
    const colPath = path.join(tmpDir, 'a', 'b', 'c');
    const result = await execute({ collection_path: colPath, collection_name: 'Nested' });
    expect(result.success).toBe(true);
    expect(fs.existsSync(colPath)).toBe(true);
  });

  it('returns failure when params are missing', async () => {
    const result = await execute({ collection_name: 'Test' });
    expect(result.success).toBe(false);
    expect((result.errors as string[]).length).toBeGreaterThan(0);
  });

  it('returns failure when collection_name is missing', async () => {
    const result = await execute({ collection_path: path.join(tmpDir, 'col') });
    expect(result.success).toBe(false);
  });

  it('returns failure on write error', async () => {
    // Block the target path with a file so mkdir fails to create it as dir
    const blocker = path.join(tmpDir, 'blocker');
    fs.writeFileSync(blocker, 'block');
    const result = await execute({
      collection_path: path.join(blocker, 'nested'),
      collection_name: 'X',
    });
    expect(result.success).toBe(false);
  });

  it('handles non-Error thrown value in catch (covers String(error) ternary)', async () => {
    const fsMod = require('fs').promises as Record<string, unknown>;
    const spy = jest.spyOn(fsMod as { writeFile: (...args: unknown[]) => unknown }, 'writeFile');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (spy as any).mockImplementation(() => Promise.reject({ message: 'object error, not Error' }));
    const result = await execute({ collection_path: tmpDir, collection_name: 'Fail' });
    expect(result.success).toBe(false);
    spy.mockRestore();
  });
});

// ─── bruno_add_request ───────────────────────────────────────────────────────

describe('bruno_add_request executor', () => {
  const execute = require('../../tools/bruno_add_request/index').default as (
    p: Record<string, unknown>
  ) => Promise<ExecResult>;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a .bru file', async () => {
    const result = await execute({
      collection_path: tmpDir,
      request_name: 'get-users',
      method: 'GET',
      url: 'https://api.example.com/users',
    });
    expect(result.success).toBe(true);
    expect(fs.existsSync(result.request_path as string)).toBe(true);
    const content = fs.readFileSync(result.request_path as string, 'utf-8');
    expect(content).toContain('get');
    expect(content).toContain('https://api.example.com/users');
  });

  it('includes headers when provided', async () => {
    const result = await execute({
      collection_path: tmpDir,
      request_name: 'auth-request',
      method: 'POST',
      url: 'https://api.example.com/login',
      headers: { Authorization: 'Bearer token' },
    });
    expect(result.success).toBe(true);
    const content = fs.readFileSync(result.request_path as string, 'utf-8');
    expect(content).toContain('Authorization');
  });

  it('includes body when provided', async () => {
    const result = await execute({
      collection_path: tmpDir,
      request_name: 'create-item',
      method: 'POST',
      url: 'https://api.example.com/items',
      body: '{"name": "widget"}',
    });
    expect(result.success).toBe(true);
    const content = fs.readFileSync(result.request_path as string, 'utf-8');
    expect(content).toContain('json');
  });

  it('includes tests block when provided', async () => {
    const result = await execute({
      collection_path: tmpDir,
      request_name: 'test-req',
      method: 'GET',
      url: 'https://example.com',
      tests: 'test("ok", function() { expect(res.getStatus()).to.equal(200); });',
    });
    expect(result.success).toBe(true);
    const content = fs.readFileSync(result.request_path as string, 'utf-8');
    expect(content).toContain('tests');
  });

  it('includes docs block when documentation provided', async () => {
    const result = await execute({
      collection_path: tmpDir,
      request_name: 'documented',
      method: 'GET',
      url: 'https://example.com',
      documentation: 'Does something useful',
    });
    expect(result.success).toBe(true);
    const content = fs.readFileSync(result.request_path as string, 'utf-8');
    expect(content).toContain('docs');
  });

  it('returns failure when required params missing', async () => {
    const result = await execute({ collection_path: tmpDir, method: 'GET', url: 'https://x.com' });
    expect(result.success).toBe(false);
  });

  it('returns failure when collection_path missing', async () => {
    const result = await execute({ request_name: 'x', method: 'GET', url: 'https://x.com' });
    expect(result.success).toBe(false);
  });

  it('returns failure on write error', async () => {
    // Create a DIRECTORY at the expected .bru output path (inside requests/) so writeFile fails
    const requestsDir = path.join(tmpDir, 'requests');
    fs.mkdirSync(requestsDir, { recursive: true });
    const blocker = path.join(requestsDir, 'fail-write.bru');
    fs.mkdirSync(blocker);
    const result = await execute({
      collection_path: tmpDir,
      request_name: 'fail-write',
      method: 'GET',
      url: 'https://example.com',
    });
    expect(result.success).toBe(false);
    expect(result.message as string).toContain('Failed to add request');
  });

  it('handles non-Error thrown value in catch (covers String(error) ternary)', async () => {
    const fsMod = require('fs').promises as Record<string, unknown>;
    const spy = jest.spyOn(fsMod as { writeFile: (...args: unknown[]) => unknown }, 'writeFile');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (spy as any).mockImplementation(() => Promise.reject({ message: 'object error, not Error' }));
    const result = await execute({
      collection_path: tmpDir,
      request_name: 'catch-req',
      method: 'GET',
      url: 'https://example.com',
    });
    expect(result.success).toBe(false);
    expect(result.message as string).toContain('Failed to add request');
    spy.mockRestore();
  });
});

// ─── bruno_get_collection_info ───────────────────────────────────────────────

describe('bruno_get_collection_info executor', () => {
  const execute = require('../../tools/bruno_get_collection_info/index').default as (
    p: Record<string, unknown>
  ) => Promise<ExecResult>;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns collection name from bruno.json', async () => {
    makeBrunoJson(tmpDir, 'My API');
    const result = await execute({ collection_path: tmpDir });
    expect(result.success).toBe(true);
    const col = result.collection as Record<string, unknown>;
    expect(col.name).toBe('My API');
  });

  it('falls back to directory name when no bruno.json', async () => {
    const result = await execute({ collection_path: tmpDir });
    expect(result.success).toBe(true);
  });

  it('lists GET requests', async () => {
    makeBruFile(tmpDir, 'list-users', 'GET');
    const result = await execute({ collection_path: tmpDir });
    expect(result.success).toBe(true);
    const col = result.collection as Record<string, unknown>;
    const reqs = col.requests as Array<{ name: string; method: string }>;
    expect(reqs.some((r) => r.method === 'GET')).toBe(true);
  });

  it('detects POST method', async () => {
    makeBruFile(tmpDir, 'create-user', 'POST');
    const result = await execute({ collection_path: tmpDir });
    const reqs = (result.collection as Record<string, unknown>).requests as Array<{
      method: string;
    }>;
    expect(reqs.some((r) => r.method === 'POST')).toBe(true);
  });

  it('detects PUT method', async () => {
    makeBruFile(tmpDir, 'update-user', 'PUT');
    const result = await execute({ collection_path: tmpDir });
    const reqs = (result.collection as Record<string, unknown>).requests as Array<{
      method: string;
    }>;
    expect(reqs.some((r) => r.method === 'PUT')).toBe(true);
  });

  it('detects DELETE method', async () => {
    makeBruFile(tmpDir, 'delete-user', 'DELETE');
    const result = await execute({ collection_path: tmpDir });
    const reqs = (result.collection as Record<string, unknown>).requests as Array<{
      method: string;
    }>;
    expect(reqs.some((r) => r.method === 'DELETE')).toBe(true);
  });

  it('detects PATCH method', async () => {
    makeBruFile(tmpDir, 'patch-user', 'PATCH');
    const result = await execute({ collection_path: tmpDir });
    const reqs = (result.collection as Record<string, unknown>).requests as Array<{
      method: string;
    }>;
    expect(reqs.some((r) => r.method === 'PATCH')).toBe(true);
  });

  it('reads name from meta block', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'my.bru'),
      'meta {\n  name: My Request\n  type: http\n  seq: 1\n}\nget {\n  url: https://x.com\n}'
    );
    const result = await execute({ collection_path: tmpDir });
    const reqs = (result.collection as Record<string, unknown>).requests as Array<{ name: string }>;
    expect(reqs.some((r) => r.name === 'My Request')).toBe(true);
  });

  it('falls back to filename when meta block absent', async () => {
    fs.writeFileSync(path.join(tmpDir, 'fallback.bru'), 'get {\n  url: https://x.com\n}');
    const result = await execute({ collection_path: tmpDir });
    const reqs = (result.collection as Record<string, unknown>).requests as Array<{ name: string }>;
    expect(reqs.some((r) => r.name === 'fallback')).toBe(true);
  });

  it('recovers from unreadable bru file (covers read catch branch)', async () => {
    makeBruFile(tmpDir, 'readable', 'GET');
    makeBruFile(tmpDir, 'unreadable', 'POST');

    const fsMod = require('fs').promises as Record<string, unknown>;
    const origReadFile = (fsMod as { readFile: unknown }).readFile;
    const spy = jest
      .spyOn(fsMod as { readFile: (...args: unknown[]) => unknown }, 'readFile')
      .mockImplementation((...args: unknown[]) => {
        const filePath = args[0] as string;
        if (filePath.endsWith('.bru')) {
          return Promise.reject(new Error('EACCES: permission denied'));
        }

        return (origReadFile as (...a: unknown[]) => unknown)(...args);
      });
    const result = await execute({ collection_path: tmpDir });
    expect(result.success).toBe(true);
    const reqs = (result.collection as Record<string, unknown>).requests as Array<{
      method: string;
    }>;
    // Unreadable .bru files fall back to UNKNOWN method
    expect(reqs.every((r) => r.method === 'UNKNOWN')).toBe(true);
    spy.mockRestore();
  });

  it('returns failure for missing collection_path', async () => {
    const result = await execute({});
    expect(result.success).toBe(false);
  });

  it('returns failure for nonexistent path', async () => {
    const result = await execute({ collection_path: '/nonexistent/collection/path' });
    expect(result.success).toBe(false);
  });
});

// ─── bruno_list_collections ──────────────────────────────────────────────────

describe('bruno_list_collections executor', () => {
  const execute = require('../../tools/bruno_list_collections/index').default as (
    p: Record<string, unknown>
  ) => Promise<unknown>;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeCollection(parent: string, name: string): string {
    const dir = path.join(parent, name);
    fs.mkdirSync(dir, { recursive: true });
    makeBrunoJson(dir, name);
    return dir;
  }

  it('lists all collections', async () => {
    makeCollection(tmpDir, 'api-a');
    makeCollection(tmpDir, 'api-b');
    const result = (await execute({ workspace_path: tmpDir })) as {
      success: boolean;
      collections: unknown[];
    };
    expect(result.success).toBe(true);
    expect(result.collections.length).toBe(2);
  });

  it('filters by name', async () => {
    makeCollection(tmpDir, 'payment-api');
    makeCollection(tmpDir, 'user-service');
    const result = (await execute({ workspace_path: tmpDir, filter: 'payment' })) as {
      success: boolean;
      collections: Array<{ name: string }>;
    };
    expect(result.success).toBe(true);
    expect(result.collections.length).toBe(1);
    expect(result.collections[0].name).toBe('payment-api');
  });

  it('returns empty collections for nonexistent workspace', async () => {
    const result = (await execute({ workspace_path: '/nonexistent/workspace' })) as {
      success: boolean;
      collections: unknown[];
    };
    expect(result.success).toBe(true);
    expect(result.collections.length).toBe(0);
  });

  it('returns failure when workspace_path missing', async () => {
    const result = (await execute({})) as { success: boolean; collections: unknown[] };
    expect(result.success).toBe(false);
    expect(result.collections.length).toBe(0);
  });

  it('recovers from invalid bruno.json (falls back to dirname)', async () => {
    const bad = path.join(tmpDir, 'bad-col');
    fs.mkdirSync(bad);
    fs.writeFileSync(path.join(bad, 'bruno.json'), 'NOT JSON {{{{');
    makeCollection(tmpDir, 'good-col');
    // Executor includes both — bad one uses dirname as collection name
    const result = (await execute({ workspace_path: tmpDir })) as {
      collections: Array<{ name: string }>;
    };
    expect(result.collections.length).toBe(2);
    expect(result.collections.some((r) => r.name === 'good-col')).toBe(true);
    expect(result.collections.some((r) => r.name === 'bad-col')).toBe(true);
  });

  it('includes request_count from .bru files', async () => {
    const col = makeCollection(tmpDir, 'counted');
    makeBruFile(col, 'req1');
    makeBruFile(col, 'req2');
    const result = (await execute({ workspace_path: tmpDir })) as {
      collections: Array<{ request_count: number }>;
    };
    expect(result.collections[0].request_count).toBe(2);
  });

  it('discovers nested collections', async () => {
    const nested = path.join(tmpDir, 'sub');
    fs.mkdirSync(nested, { recursive: true });
    makeCollection(nested, 'inner-col');
    const result = (await execute({ workspace_path: tmpDir })) as { collections: unknown[] };
    expect(result.collections.length).toBe(1);
  });
});

// ─── bruno_run_collection ────────────────────────────────────────────────────

describe('bruno_run_collection executor', () => {
  const execute = require('../../tools/bruno_run_collection/index').default as (
    p: Record<string, unknown>
  ) => Promise<ExecResult>;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    jest.clearAllMocks();
    // Default: execFileSync succeeds silently
    mockExec.mockReturnValue('');
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns success when bru exits zero', async () => {
    const result = await execute({ collection_path: tmpDir });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns failure when collection_path missing', async () => {
    const result = await execute({});
    expect(result.success).toBe(false);
  });

  it('passes --env when environment provided', async () => {
    await execute({ collection_path: tmpDir, environment: 'staging' });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--env');
    expect(args).toContain('staging');
  });

  it('passes --env-file when env_file provided', async () => {
    await execute({ collection_path: tmpDir, env_file: './env/staging.json' });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--env-file');
  });

  it('passes --csv-file-path when data_file provided', async () => {
    await execute({ collection_path: tmpDir, data_file: './data.csv' });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--csv-file-path');
  });

  it('passes --iteration-count', async () => {
    await execute({ collection_path: tmpDir, iteration_count: 3 });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--iteration-count');
    expect(args).toContain('3');
  });

  it('passes --delay', async () => {
    await execute({ collection_path: tmpDir, delay_ms: 500 });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--delay');
  });

  it('passes --tags', async () => {
    await execute({ collection_path: tmpDir, tags: 'smoke' });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--tags');
    expect(args).toContain('smoke');
  });

  it('passes --exclude-tags', async () => {
    await execute({ collection_path: tmpDir, exclude_tags: 'slow' });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--exclude-tags');
  });

  it('passes --tests-only when tests_only=true', async () => {
    await execute({ collection_path: tmpDir, tests_only: true });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--tests-only');
  });

  it('passes --bail when bail_on_failure=true', async () => {
    await execute({ collection_path: tmpDir, bail_on_failure: true });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--bail');
  });

  it('passes --parallel when parallel=true', async () => {
    await execute({ collection_path: tmpDir, parallel: true });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--parallel');
  });

  it('passes --sandbox developer when sandbox_mode=developer', async () => {
    await execute({ collection_path: tmpDir, sandbox_mode: 'developer' });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--sandbox');
    expect(args).toContain('developer');
  });

  it('marks success false when bru throws', async () => {
    (mockExec as jest.Mock).mockImplementation(() => {
      throw new Error('bru failed');
    });
    const result = await execute({ collection_path: tmpDir });
    expect(result.success).toBe(false);
  });

  it('reads report from disk when report is written', async () => {
    // Write a fake JSON report so the executor can parse it
    const reportPattern = /bru-report-/;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockExec as jest.Mock).mockImplementation((...allArgs: any[]) => {
      const args: string[] = allArgs[1] ?? [];
      // Find --reporter-json <path> and write fake data there
      const idx = args.indexOf('--reporter-json');
      if (idx !== -1) {
        const rPath = args[idx + 1];
        fs.writeFileSync(
          rPath,
          JSON.stringify({
            summary: { totalRequests: 3, passedRequests: 2, failedRequests: 1, totalTime: 100 },
            results: [
              { suiteName: 'Test 1', status: 'pass' },
              { name: 'Test 2', passed: false },
            ],
          })
        );
      }
      void reportPattern; // suppress unused warning
      return '';
    });
    const result = await execute({ collection_path: tmpDir });
    expect(result.success).toBe(true);
    const summary = result.summary as Record<string, number>;
    expect(summary.total_requests).toBe(3);
    expect(summary.passed).toBe(2);
  });
});

// ─── bruno_run_request ───────────────────────────────────────────────────────

describe('bruno_run_request executor', () => {
  const execute = require('../../tools/bruno_run_request/index').default as (
    p: Record<string, unknown>
  ) => Promise<ExecResult>;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    jest.clearAllMocks();
    mockExec.mockReturnValue('200 OK');
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns success for valid request', async () => {
    const result = await execute({
      collection_path: tmpDir,
      request_name: 'my-request',
    });
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.errors).toEqual([]);
  });

  it('passes --env when environment provided', async () => {
    await execute({ collection_path: tmpDir, request_name: 'req', environment: 'prod' });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--env');
    expect(args).toContain('prod');
  });

  it('passes --env-file when env_file provided', async () => {
    await execute({ collection_path: tmpDir, request_name: 'req', env_file: './env.json' });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--env-file');
  });

  it('passes --sandbox when sandbox_mode provided', async () => {
    await execute({ collection_path: tmpDir, request_name: 'req', sandbox_mode: 'developer' });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--sandbox');
    expect(args).toContain('developer');
  });

  it('returns failure when params missing', async () => {
    const result = await execute({ collection_path: tmpDir });
    expect(result.success).toBe(false);
  });

  it('marks success false and includes error when bru throws', async () => {
    (mockExec as jest.Mock).mockImplementation(() => {
      throw new Error('connection refused');
    });
    const result = await execute({ collection_path: tmpDir, request_name: 'fail-req' });
    expect(result.success).toBe(false);
    const errors = result.errors as string[];
    expect(errors.some((e) => e.includes('connection refused'))).toBe(true);
  });

  it('extracts status code from output', async () => {
    mockExec.mockReturnValue('Response: 201 Created\n');
    const result = await execute({ collection_path: tmpDir, request_name: 'create-req' });
    expect(result.status).toBe(201);
  });

  it('catches outer errors', async () => {
    // Trigger outer catch by throwing in a way that bypasses inner try
    (mockExec as jest.Mock).mockImplementation(() => {
      throw new Error('outer error');
    });
    const result = await execute({ collection_path: tmpDir, request_name: 'outer-err' });
    expect(result.success).toBe(false);
  });
});

// ─── bruno_import_openapi ────────────────────────────────────────────────────

describe('bruno_import_openapi executor', () => {
  const execute = require('../../tools/bruno_import_openapi/index').default as (
    p: Record<string, unknown>
  ) => Promise<ExecResult>;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    jest.clearAllMocks();
    mockExec.mockReturnValue('');
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns success', async () => {
    const result = await execute({ spec_source: './spec.yaml', output_directory: tmpDir });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('uses custom collection_name', async () => {
    const result = await execute({
      spec_source: './spec.yaml',
      output_directory: tmpDir,
      collection_name: 'My API',
    });
    expect(result.collection_name).toBe('My API');
  });

  it('defaults collection_name to Imported Collection', async () => {
    const result = await execute({ spec_source: './spec.yaml', output_directory: tmpDir });
    expect(result.collection_name).toBe('Imported Collection');
  });

  it('returns failure when required params missing', async () => {
    const result = await execute({ spec_source: './spec.yaml' });
    expect(result.success).toBe(false);
  });

  it('returns failure when bru throws', async () => {
    (mockExec as jest.Mock).mockImplementation(() => {
      throw new Error('invalid spec');
    });
    const result = await execute({ spec_source: './spec.yaml', output_directory: tmpDir });
    expect(result.success).toBe(false);
    const errors = result.errors as string[];
    expect(errors.some((e) => e.includes('invalid spec'))).toBe(true);
  });

  it('passes --group-by when group_by provided', async () => {
    await execute({ spec_source: './spec.yaml', output_directory: tmpDir, group_by: 'path' });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--group-by');
    expect(args).toContain('path');
  });

  it('passes --insecure when insecure=true', async () => {
    await execute({
      spec_source: 'https://api.example.com/openapi.json',
      output_directory: tmpDir,
      insecure: true,
    });
    const args = mockExec.mock.calls[1]?.[1] as string[];
    expect(args).toContain('--insecure');
  });

  it('counts generated bru files', async () => {
    // Write some .bru files to simulate generated output
    makeBruFile(tmpDir, 'get-users');
    makeBruFile(tmpDir, 'create-user');
    const result = await execute({ spec_source: './spec.yaml', output_directory: tmpDir });
    expect(result.requests_created).toBe(2);
  });

  it('handles readdir failure gracefully (best-effort count, requests_created=0)', async () => {
    // Use a regular file as output_directory so readdir throws ENOTDIR
    const filePath = path.join(tmpDir, 'not-a-dir.txt');
    fs.writeFileSync(filePath, 'file content');
    const result = await execute({ spec_source: './spec.yaml', output_directory: filePath });
    expect(result.success).toBe(true);
    expect(result.requests_created).toBe(0);
  });
});

// ─── checkBruVersion ─────────────────────────────────────────────────────────

describe('checkBruVersion', () => {
  const { checkBruVersion } = require('../../tools/bru-utils') as { checkBruVersion: () => void };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not throw when installed version meets the minimum', () => {
    mockExec.mockReturnValue('3.1.3\n');
    expect(() => checkBruVersion()).not.toThrow();
  });

  it('does not throw for exactly the minimum version', () => {
    mockExec.mockReturnValue('1.0.0\n');
    expect(() => checkBruVersion()).not.toThrow();
  });

  it('throws when installed version is below minimum', () => {
    mockExec.mockReturnValue('0.9.0\n');
    expect(() => checkBruVersion()).toThrow(/below.*minimum/i);
  });

  it('throws when bru is not installed (ENOENT)', () => {
    const err = new Error('not found') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    (mockExec as jest.Mock).mockImplementation(() => {
      throw err;
    });
    expect(() => checkBruVersion()).toThrow(/not installed/i);
  });

  it('does not throw when version output cannot be parsed (graceful degradation)', () => {
    mockExec.mockReturnValue('unknown version format\n');
    expect(() => checkBruVersion()).not.toThrow();
  });

  it('does not throw when execFileSync throws a non-ENOENT error', () => {
    (mockExec as jest.Mock).mockImplementation(() => {
      throw new Error('permission denied');
    });
    expect(() => checkBruVersion()).not.toThrow();
  });

  it('includes the installed version and minimum in the error message', () => {
    mockExec.mockReturnValue('0.8.2\n');
    expect(() => checkBruVersion()).toThrow(/0\.8\.2/);
    expect(() => checkBruVersion()).toThrow(/1\.0\.0/);
  });
});
