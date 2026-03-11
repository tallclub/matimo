import { z } from 'zod';
import type { Parameter } from '../../../src/core/types';
import type { ToolDefinition } from '../../../src/core/schema';
import {
  parameterToZod,
  convertParametersToMcpSchema,
  toolToMcpRegistration,
  extractAuthPlaceholders,
} from '../../../src/mcp/tool-converter';

describe('parameterToZod', () => {
  it('should convert string parameter', () => {
    const param: Parameter = { type: 'string', required: true, description: 'A channel' };
    const schema = parameterToZod(param) as z.ZodString;
    expect(schema.parse('hello')).toBe('hello');
    expect(() => schema.parse(123)).toThrow();
  });

  it('should convert number parameter', () => {
    const param: Parameter = { type: 'number', required: true, description: 'Count' };
    const schema = parameterToZod(param);
    expect(schema.parse(42)).toBe(42);
    expect(() => schema.parse('not-a-number')).toThrow();
  });

  it('should convert boolean parameter', () => {
    const param: Parameter = { type: 'boolean', required: true, description: 'Flag' };
    const schema = parameterToZod(param);
    expect(schema.parse(true)).toBe(true);
    expect(() => schema.parse('yes')).toThrow();
  });

  it('should convert array parameter with item type', () => {
    const param: Parameter = {
      type: 'array',
      required: true,
      description: 'List of strings',
      items: { type: 'string', required: true, description: 'Item' },
    };
    const schema = parameterToZod(param);
    expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
    expect(() => schema.parse([1, 2])).toThrow();
  });

  it('should convert object parameter with properties', () => {
    const param: Parameter = {
      type: 'object',
      required: true,
      description: 'A person',
      properties: {
        name: { type: 'string', required: true, description: 'Name' },
        age: { type: 'number', required: false, description: 'Age' },
      },
    };
    const schema = parameterToZod(param);
    expect(schema.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });
    expect(schema.parse({ name: 'Alice', age: 30 })).toEqual({ name: 'Alice', age: 30 });
    expect(() => schema.parse({ age: 30 })).toThrow();
  });

  it('should convert object parameter without properties to record', () => {
    const param: Parameter = { type: 'object', required: true, description: 'Any object' };
    const schema = parameterToZod(param);
    expect(schema.parse({ any: 'thing' })).toEqual({ any: 'thing' });
  });

  it('should handle enum constraint', () => {
    const param: Parameter = {
      type: 'string',
      required: true,
      description: 'Op',
      enum: ['add', 'sub', 'mul'],
    };
    const schema = parameterToZod(param);
    expect(schema.parse('add')).toBe('add');
    expect(() => schema.parse('divide')).toThrow();
  });

  it('should handle single-value enum without throwing', () => {
    const param: Parameter = {
      type: 'string',
      required: true,
      description: 'Fixed value',
      enum: ['only'],
    };
    const schema = parameterToZod(param);
    expect(schema.parse('only')).toBe('only');
    expect(() => schema.parse('other')).toThrow();
  });

  it('should apply description metadata', () => {
    const param: Parameter = { type: 'string', required: true, description: 'User name' };
    const schema = parameterToZod(param);
    expect(schema.description).toBe('User name');
  });

  it('should make optional when required is false', () => {
    const param: Parameter = { type: 'string', required: false, description: 'Optional field' };
    const schema = parameterToZod(param);
    // Optional schema should accept undefined
    expect(schema.parse(undefined)).toBeUndefined();
    expect(schema.parse('hello')).toBe('hello');
  });

  it('should apply default value', () => {
    const param: Parameter = {
      type: 'string',
      required: false,
      description: 'With default',
      default: 'world',
    };
    const schema = parameterToZod(param);
    expect(schema.parse(undefined)).toBe('world');
  });

  it('should fallback to unknown for unrecognized type', () => {
    const param = { type: 'foobar' as 'string', required: true, description: 'Unknown' };
    const schema = parameterToZod(param);
    // z.unknown accepts anything
    expect(schema.parse(42)).toBe(42);
    expect(schema.parse('str')).toBe('str');
  });
});

describe('convertParametersToMcpSchema', () => {
  it('should convert all non-auth parameters', () => {
    const parameters: Record<string, Parameter> = {
      channel: { type: 'string', required: true, description: 'Channel' },
      text: { type: 'string', required: false, description: 'Text' },
    };

    const schema = convertParametersToMcpSchema(parameters);
    expect(Object.keys(schema)).toEqual(['channel', 'text']);
  });

  it('should exclude auth-like parameters (snake_case)', () => {
    const parameters: Record<string, Parameter> = {
      channel: { type: 'string', required: true, description: 'Channel' },
      api_key: { type: 'string', required: true, description: 'Key' },
      auth_token: { type: 'string', required: true, description: 'Token' },
      password: { type: 'string', required: true, description: 'Pass' },
      bearer: { type: 'string', required: true, description: 'Bearer' },
      secret_value: { type: 'string', required: true, description: 'Secret' },
      credential_id: { type: 'string', required: true, description: 'Cred' },
    };

    const schema = convertParametersToMcpSchema(parameters);
    expect(Object.keys(schema)).toEqual(['channel']);
  });

  it('should exclude auth-like parameters (camelCase)', () => {
    const parameters: Record<string, Parameter> = {
      channel: { type: 'string', required: true, description: 'Channel' },
      apiKey: { type: 'string', required: true, description: 'Key' },
      bearerToken: { type: 'string', required: true, description: 'Token' },
      accessToken: { type: 'string', required: true, description: 'Access' },
      clientSecret: { type: 'string', required: true, description: 'Secret' },
    };

    const schema = convertParametersToMcpSchema(parameters);
    expect(Object.keys(schema)).toEqual(['channel']);
  });

  it('should not exclude non-auth parameters that contain auth substrings', () => {
    const parameters: Record<string, Parameter> = {
      monkey: { type: 'string', required: true, description: 'Not a key' },
      author_name: { type: 'string', required: true, description: 'Author' },
      turkey: { type: 'string', required: true, description: 'Not a key' },
    };

    const schema = convertParametersToMcpSchema(parameters);
    expect(Object.keys(schema)).toEqual(['monkey', 'author_name', 'turkey']);
  });

  it('should handle empty parameters', () => {
    const schema = convertParametersToMcpSchema({});
    expect(Object.keys(schema)).toHaveLength(0);
  });
});

describe('toolToMcpRegistration', () => {
  it('should build registration metadata', () => {
    const tool = {
      name: 'slack_send_message',
      description: 'Send a message to Slack',
      version: '1.0.0',
      execution: { type: 'command', command: 'echo' },
      parameters: {
        channel: { type: 'string' as const, required: true, description: 'Channel' },
        text: { type: 'string' as const, required: true, description: 'Message' },
      },
    } as unknown as ToolDefinition;

    const reg = toolToMcpRegistration(tool);
    expect(reg.title).toBe('slack_send_message');
    expect(reg.description).toBe('Send a message to Slack');
    expect(Object.keys(reg.inputSchema)).toEqual(['channel', 'text']);
  });

  it('should use name as description fallback', () => {
    const tool = {
      name: 'echo',
      parameters: {},
    } as unknown as ToolDefinition;

    const reg = toolToMcpRegistration(tool);
    expect(reg.description).toBe('echo');
  });

  it('should handle tool with no parameters', () => {
    const tool = {
      name: 'ping',
      description: 'Health check',
    } as unknown as ToolDefinition;

    const reg = toolToMcpRegistration(tool);
    expect(Object.keys(reg.inputSchema)).toHaveLength(0);
  });
});

describe('extractAuthPlaceholders', () => {
  it('should extract auth placeholders from HTTP headers', () => {
    const tool = {
      name: 'slack_send',
      execution: {
        type: 'http',
        method: 'POST',
        url: 'https://slack.com/api/chat.postMessage',
        headers: {
          Authorization: 'Bearer {SLACK_BOT_TOKEN}',
          'Content-Type': 'application/json',
        },
      },
    } as unknown as ToolDefinition;

    const placeholders = extractAuthPlaceholders(tool);
    expect(placeholders).toContain('SLACK_BOT_TOKEN');
  });

  it('should extract auth placeholders from URL', () => {
    const tool = {
      name: 'api_call',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/data?api_key={API_KEY}',
      },
    } as unknown as ToolDefinition;

    const placeholders = extractAuthPlaceholders(tool);
    expect(placeholders).toContain('API_KEY');
  });

  it('should extract from body', () => {
    const tool = {
      name: 'api_call',
      execution: {
        type: 'http',
        method: 'POST',
        url: 'https://api.example.com/data',
        body: {
          payload: '{data}',
          auth_token: '{SECRET_TOKEN}',
        },
      },
    } as unknown as ToolDefinition;

    const placeholders = extractAuthPlaceholders(tool);
    expect(placeholders).toContain('SECRET_TOKEN');
    // 'data' should not be included — it doesn't match auth patterns
    expect(placeholders).not.toContain('data');
  });

  it('should extract from command args', () => {
    const tool = {
      name: 'cli_tool',
      execution: {
        type: 'command',
        command: 'curl',
        args: ['--header', 'Authorization: Bearer {AUTH_TOKEN}', '{url}'],
      },
    } as unknown as ToolDefinition;

    const placeholders = extractAuthPlaceholders(tool);
    expect(placeholders).toContain('AUTH_TOKEN');
    expect(placeholders).not.toContain('url');
  });

  it('should deduplicate placeholders', () => {
    const tool = {
      name: 'dual_auth',
      execution: {
        type: 'http',
        method: 'POST',
        url: 'https://api.example.com',
        headers: { Authorization: 'Bearer {API_KEY}' },
        body: { key: '{API_KEY}' },
      },
    } as unknown as ToolDefinition;

    const placeholders = extractAuthPlaceholders(tool);
    expect(placeholders.filter((p: string) => p === 'API_KEY')).toHaveLength(1);
  });

  it('should return empty for tool with no auth placeholders', () => {
    const tool = {
      name: 'calculator',
      execution: {
        type: 'command',
        command: 'node',
        args: ['calc.js', '{operation}', '{a}', '{b}'],
      },
    } as unknown as ToolDefinition;

    const placeholders = extractAuthPlaceholders(tool);
    expect(placeholders).toHaveLength(0);
  });
});
