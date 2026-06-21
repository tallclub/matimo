import axios from 'axios';
jest.mock('axios');

import fs from 'fs';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import { validateToolDefinition } from '@matimo/core';
import {
  classifyComposioActionRisk,
  resolveRisk,
  loadRiskOverrides,
  mapInputParametersToMatimoParams,
  buildToolDefinition,
  fetchToolkitTools,
  generateToolFile,
  parseArgs,
  type ComposioTool,
} from '../../scripts/generate-tools';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('classifyComposioActionRisk', () => {
  it('classifies GET/LIST/FETCH/SEARCH/READ/FIND actions as low risk', () => {
    expect(classifyComposioActionRisk('JIRA_GET_ISSUE')).toBe('low');
    expect(classifyComposioActionRisk('JIRA_LIST_PROJECTS')).toBe('low');
    expect(classifyComposioActionRisk('LINEAR_SEARCH_ISSUES')).toBe('low');
  });

  it('classifies CREATE/SEND/UPDATE/ADD/UPLOAD/INVITE actions as medium risk', () => {
    expect(classifyComposioActionRisk('LINEAR_CREATE_ISSUE')).toBe('medium');
    expect(classifyComposioActionRisk('GMAIL_SEND_EMAIL')).toBe('medium');
    expect(classifyComposioActionRisk('JIRA_UPDATE_ISSUE')).toBe('medium');
  });

  it('classifies DELETE/REMOVE/ARCHIVE/REVOKE/CANCEL actions as high risk', () => {
    expect(classifyComposioActionRisk('JIRA_DELETE_ISSUE')).toBe('high');
    expect(classifyComposioActionRisk('LINEAR_ARCHIVE_ISSUE')).toBe('high');
    expect(classifyComposioActionRisk('ASANA_REMOVE_TASK')).toBe('high');
  });

  it('defaults ambiguous actions (matching none of the patterns) to medium', () => {
    expect(classifyComposioActionRisk('JIRA_TRANSITION_ISSUE')).toBe('medium');
  });

  it('prioritizes destructive patterns even when a low-risk word is also present', () => {
    expect(classifyComposioActionRisk('JIRA_DELETE_AND_GET_ISSUE')).toBe('high');
  });
});

describe('resolveRisk', () => {
  it('falls back to the heuristic when no override exists', () => {
    expect(resolveRisk('JIRA_GET_ISSUE', {})).toBe('low');
  });

  it('lets an explicit per-action override win over the heuristic', () => {
    expect(resolveRisk('JIRA_GET_ISSUE', { JIRA_GET_ISSUE: 'high' })).toBe('high');
  });
});

describe('loadRiskOverrides', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'composio-overrides-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns an empty object when the overrides file does not exist', () => {
    expect(loadRiskOverrides(path.join(tempDir, 'missing.json'))).toEqual({});
  });

  it('parses overrides from a JSON file', () => {
    const overridesPath = path.join(tempDir, 'overrides.json');
    fs.writeFileSync(overridesPath, JSON.stringify({ JIRA_DELETE_ISSUE_LINK: 'high' }));
    expect(loadRiskOverrides(overridesPath)).toEqual({ JIRA_DELETE_ISSUE_LINK: 'high' });
  });
});

describe('mapInputParametersToMatimoParams', () => {
  it('returns an empty object when there are no input parameters', () => {
    expect(mapInputParametersToMatimoParams(undefined)).toEqual({});
    expect(mapInputParametersToMatimoParams({})).toEqual({});
  });

  it('maps JSON Schema property types to Matimo parameter types', () => {
    const result = mapInputParametersToMatimoParams({
      type: 'object',
      required: ['issue_id'],
      properties: {
        issue_id: { type: 'string', description: 'The issue ID' },
        priority: { type: 'integer', description: 'Priority level', enum: [1, 2, 3], default: 1 },
        is_urgent: { type: 'boolean', description: 'Urgent flag' },
        labels: { type: 'array', description: 'Labels to apply' },
        metadata: { type: 'object', description: 'Arbitrary metadata' },
        nickname: { type: ['string', 'null'] },
      },
    });

    expect(result.issue_id).toEqual({
      type: 'string',
      description: 'The issue ID',
      required: true,
    });
    expect(result.priority).toEqual({
      type: 'number',
      description: 'Priority level',
      enum: [1, 2, 3],
      default: 1,
    });
    expect(result.is_urgent.type).toBe('boolean');
    expect(result.labels.type).toBe('array');
    expect(result.metadata.type).toBe('object');

    // Nullable union resolves to its non-null member; missing description gets a fallback;
    // params absent from `required` are left unmarked.
    expect(result.nickname.type).toBe('string');
    expect(result.nickname.description).toBe('The nickname parameter.');
    expect(result.nickname.required).toBeUndefined();
  });

  it('falls back to string for unrecognized JSON Schema types', () => {
    const result = mapInputParametersToMatimoParams({
      type: 'object',
      properties: {
        weird: { type: 'unknown-type', description: 'A weird field' },
      },
    });

    expect(result.weird.type).toBe('string');
  });
});

describe('buildToolDefinition', () => {
  const getIssueTool: ComposioTool = {
    slug: 'JIRA_GET_ISSUE',
    name: 'Get Issue',
    description: 'Fetch a Jira issue by ID',
    input_parameters: {
      type: 'object',
      required: ['issue_id'],
      properties: {
        issue_id: { type: 'string', description: 'The issue ID' },
        fields: { type: 'array', description: 'Fields to return' },
      },
    },
  };

  it('produces a schema-valid Matimo tool definition', () => {
    const def = buildToolDefinition('JIRA', getIssueTool, {});
    expect(() => validateToolDefinition(def)).not.toThrow();
  });

  it('derives name, tags and risk from the toolkit and action slug', () => {
    const def = buildToolDefinition('JIRA', getIssueTool, {}) as Record<string, unknown>;
    expect(def.name).toBe('composio_jira_get_issue');
    expect(def.tags).toEqual(['composio', 'jira']);
    expect(def.risk).toBe('low');
  });

  it('applies a risk override over the heuristic', () => {
    const def = buildToolDefinition('JIRA', getIssueTool, { JIRA_GET_ISSUE: 'high' }) as Record<
      string,
      unknown
    >;
    expect(def.risk).toBe('high');
  });

  it('always declares composio_user_id and composio_connected_account_id as required', () => {
    const def = buildToolDefinition('JIRA', getIssueTool, {}) as {
      parameters: Record<string, { type: string; required?: boolean }>;
    };
    expect(def.parameters.composio_user_id).toEqual({
      type: 'string',
      description: 'The Composio entity/user ID for the calling tenant or user.',
      required: true,
    });
    expect(def.parameters.composio_connected_account_id.required).toBe(true);
    expect(def.parameters.issue_id.required).toBe(true);
    expect(def.parameters.fields.required).toBeUndefined();
  });

  it('builds an HTTP POST execution config targeting the per-action execute endpoint', () => {
    const def = buildToolDefinition('JIRA', getIssueTool, {}) as {
      execution: {
        type: string;
        method: string;
        url: string;
        headers: Record<string, string>;
        body: { user_id: string; connected_account_id: string; arguments: Record<string, string> };
      };
      authentication: { type: string; location: string; name: string };
    };

    expect(def.execution.type).toBe('http');
    expect(def.execution.method).toBe('POST');
    expect(def.execution.url).toBe(
      'https://backend.composio.dev/api/v3/tools/execute/JIRA_GET_ISSUE'
    );
    expect(def.execution.headers['x-api-key']).toBe('{COMPOSIO_API_KEY}');
    expect(def.execution.body.user_id).toBe('{composio_user_id}');
    expect(def.execution.body.connected_account_id).toBe('{composio_connected_account_id}');
    expect(def.execution.body.arguments).toEqual({
      _matimo_tool: 'composio_jira_get_issue',
      issue_id: '{issue_id}',
      fields: '{fields}',
    });
    expect(def.authentication).toEqual({ type: 'api_key', location: 'header', name: 'x-api-key' });
  });

  it.each([
    ['LINEAR_CREATE_ISSUE', 'medium'],
    ['LINEAR_DELETE_ISSUE', 'high'],
    ['LINEAR_LIST_ISSUES', 'low'],
    ['LINEAR_TRANSITION_STATE', 'medium'],
  ])(
    'classifies %s as %s risk and stays schema-valid with zero input parameters',
    (slug, expectedRisk) => {
      const def = buildToolDefinition(
        'LINEAR',
        { slug, name: slug, description: `Action ${slug}` },
        {}
      );
      expect(def.risk).toBe(expectedRisk);
      expect(() => validateToolDefinition(def)).not.toThrow();
    }
  );
});

describe('fetchToolkitTools', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('follows next_cursor pagination until exhausted', async () => {
    mockedAxios.get = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          items: [{ slug: 'JIRA_GET_ISSUE', name: 'Get Issue' }],
          next_cursor: 'page-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ slug: 'JIRA_CREATE_ISSUE', name: 'Create Issue' }],
          next_cursor: null,
        },
      });

    const tools = await fetchToolkitTools('JIRA', 'test-key');

    expect(tools.map((t) => t.slug)).toEqual(['JIRA_GET_ISSUE', 'JIRA_CREATE_ISSUE']);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);

    const [firstUrl, firstConfig] = mockedAxios.get.mock.calls[0];
    expect(firstUrl).toBe('https://backend.composio.dev/api/v3/tools');
    expect(firstConfig).toMatchObject({
      headers: { 'x-api-key': 'test-key' },
      params: { toolkit_slug: 'jira', limit: 100 },
    });

    const [, secondConfig] = mockedAxios.get.mock.calls[1];
    expect(secondConfig).toMatchObject({ params: { cursor: 'page-2' } });
  });

  it('returns an empty array when the response has no items', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce({ data: {} });
    const tools = await fetchToolkitTools('JIRA', 'test-key');
    expect(tools).toEqual([]);
  });
});

describe('generateToolFile', () => {
  let tempDir: string;
  const getIssueTool: ComposioTool = {
    slug: 'JIRA_GET_ISSUE',
    name: 'Get Issue',
    description: 'Fetch a Jira issue by ID',
    input_parameters: {
      type: 'object',
      required: ['issue_id'],
      properties: {
        issue_id: { type: 'string', description: 'The issue ID' },
      },
    },
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'composio-gen-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes a schema-valid YAML definition file', () => {
    const result = generateToolFile('JIRA', getIssueTool, {}, tempDir, false);
    expect(result).toEqual({ outcome: 'created', name: 'composio_jira_get_issue' });

    const filePath = path.join(tempDir, 'composio_jira_get_issue', 'definition.yaml');
    expect(fs.existsSync(filePath)).toBe(true);

    const parsed = yaml.load(fs.readFileSync(filePath, 'utf-8'));
    expect(() => validateToolDefinition(parsed)).not.toThrow();
    expect((parsed as Record<string, unknown>).name).toBe('composio_jira_get_issue');
  });

  it('is idempotent: skips an existing file unless forceRefresh is set', () => {
    generateToolFile('JIRA', getIssueTool, {}, tempDir, false);

    const filePath = path.join(tempDir, 'composio_jira_get_issue', 'definition.yaml');
    fs.writeFileSync(filePath, 'sentinel: true\n');

    const skipped = generateToolFile('JIRA', getIssueTool, {}, tempDir, false);
    expect(skipped.outcome).toBe('skipped');
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('sentinel: true\n');

    const refreshed = generateToolFile('JIRA', getIssueTool, {}, tempDir, true);
    expect(refreshed.outcome).toBe('created');
    expect(fs.readFileSync(filePath, 'utf-8')).not.toBe('sentinel: true\n');
  });

  it('reports an invalid outcome and does not write a file when schema validation fails', () => {
    jest.isolateModules(() => {
      jest.doMock('@matimo/core', () => ({
        ...jest.requireActual('@matimo/core'),
        validateToolDefinition: jest.fn().mockImplementation(() => {
          throw new Error('boom');
        }),
      }));

      // Re-require with the mocked validator in place for this isolated module registry.
      const isolated = jest.requireActual(
        '../../scripts/generate-tools'
      ) as typeof import('../../scripts/generate-tools');
      const result = isolated.generateToolFile('JIRA', getIssueTool, {}, tempDir, false);

      expect(result.outcome).toBe('invalid');
      expect(result.error).toBe('boom');
      expect(fs.existsSync(path.join(tempDir, 'composio_jira_get_issue'))).toBe(false);
    });
  });
});

describe('parseArgs', () => {
  it('parses a comma-separated --toolkits flag, trimming and upper-casing slugs', () => {
    expect(parseArgs(['--toolkits=jira, linear,ASANA'])).toEqual({
      toolkits: ['JIRA', 'LINEAR', 'ASANA'],
      forceRefresh: false,
    });
  });

  it('detects the --force-refresh flag', () => {
    expect(parseArgs(['--toolkits=JIRA', '--force-refresh'])).toEqual({
      toolkits: ['JIRA'],
      forceRefresh: true,
    });
  });

  it('returns an empty toolkits array when --toolkits is not provided', () => {
    expect(parseArgs([])).toEqual({ toolkits: [], forceRefresh: false });
  });
});
