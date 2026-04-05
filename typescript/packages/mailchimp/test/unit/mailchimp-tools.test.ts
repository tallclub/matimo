import * as fs from 'fs';
import * as path from 'path';

const toolNames = [
  'mailchimp-get-lists',
  'mailchimp-add-list-member',
  'mailchimp-get-list-members',
  'mailchimp-update-list-member',
  'mailchimp-remove-list-member',
  'mailchimp-create-campaign',
  'mailchimp-send-campaign',
];

describe.each(toolNames.map((name) => [name]))('Tool: %s', (toolName) => {
  let toolDef: Record<string, unknown>;

  beforeAll(() => {
    const toolPath = path.join(__dirname, `../../tools/${toolName}/definition.yaml`);
    const content = fs.readFileSync(toolPath, 'utf8');
    toolDef = require('js-yaml').load(content) as Record<string, unknown>;
  });

  it('should have valid tool definition with required fields', () => {
    expect(toolDef.name).toBe(toolName);
    expect(toolDef.description).toBeDefined();
    expect(typeof toolDef.description).toBe('string');
    expect((toolDef.description as string).trim().length > 0).toBe(true);
    expect(toolDef.version).toBe('1.0.0');
    expect(toolDef.parameters).toBeDefined();
    expect(toolDef.execution).toBeDefined();
    expect(toolDef.output_schema).toBeDefined();
  });

  it('should have valid HTTP execution config', () => {
    const execution = toolDef.execution as { type: string; method?: string; url?: string };
    expect(execution.type).toBe('http');
    expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(execution.method);
    expect(execution.url).toBeDefined();
    expect(typeof execution.url).toBe('string');
    expect((execution.url as string).startsWith('https://')).toBe(true);
    expect(execution.url).toContain('mailchimp.com');
    expect(execution.url).toContain('{server_prefix}');
  });

  it('should have server_prefix as required parameter', () => {
    const params = toolDef.parameters as Record<
      string,
      { type: string; required: boolean; description: string }
    >;
    expect(params.server_prefix).toBeDefined();
    expect(params.server_prefix.type).toBe('string');
    expect(params.server_prefix.required).toBe(true);
  });

  it('should have API key authentication in header', () => {
    const execution = toolDef.execution as {
      headers?: Record<string, string>;
    };
    expect(execution.headers).toBeDefined();
    expect(execution.headers?.Authorization).toContain('{MAILCHIMP_API_KEY}');
  });

  it('should have all parameters with types', () => {
    Object.entries(toolDef.parameters as Record<string, { type: string }>).forEach(
      ([_name, param]) => {
        expect(param.type).toBeDefined();
        expect(['string', 'number', 'boolean', 'object', 'array']).toContain(param.type);
      }
    );
  });

  it('should have output_schema with valid type', () => {
    const outputSchema = toolDef.output_schema as { type: string };
    expect(outputSchema).toBeDefined();
    expect(['object', 'string', 'number', 'boolean', 'array']).toContain(outputSchema.type);
  });

  it('should have authentication section', () => {
    const auth = toolDef.authentication as { type: string; location: string; name: string };
    expect(auth).toBeDefined();
    expect(auth.type).toBe('api_key');
  });

  it('should have error_handling section', () => {
    const errorHandling = toolDef.error_handling as { retry: number; backoff_type: string };
    expect(errorHandling).toBeDefined();
    expect(typeof errorHandling.retry).toBe('number');
    expect(['exponential', 'linear']).toContain(errorHandling.backoff_type);
  });

  it('should have at least one example', () => {
    expect(toolDef.examples).toBeDefined();
    expect(Array.isArray(toolDef.examples)).toBe(true);
    expect((toolDef.examples as Array<unknown>).length > 0).toBe(true);
    (toolDef.examples as Array<Record<string, unknown>>).forEach((example) => {
      expect(example.name).toBeDefined();
      expect(example.params).toBeDefined();
    });
  });
});

describe('mailchimp-remove-list-member', () => {
  let toolDef: Record<string, unknown>;

  beforeAll(() => {
    const toolPath = path.join(
      __dirname,
      '../../tools/mailchimp-remove-list-member/definition.yaml'
    );
    const content = fs.readFileSync(toolPath, 'utf8');
    toolDef = require('js-yaml').load(content) as Record<string, unknown>;
  });

  it('should require approval', () => {
    expect(toolDef.requires_approval).toBe(true);
  });
});

describe('mailchimp-send-campaign', () => {
  let toolDef: Record<string, unknown>;

  beforeAll(() => {
    const toolPath = path.join(__dirname, '../../tools/mailchimp-send-campaign/definition.yaml');
    const content = fs.readFileSync(toolPath, 'utf8');
    toolDef = require('js-yaml').load(content) as Record<string, unknown>;
  });

  it('should require approval', () => {
    expect(toolDef.requires_approval).toBe(true);
  });
});

describe('mailchimp-add-list-member', () => {
  let toolDef: Record<string, unknown>;

  beforeAll(() => {
    const toolPath = path.join(__dirname, '../../tools/mailchimp-add-list-member/definition.yaml');
    const content = fs.readFileSync(toolPath, 'utf8');
    toolDef = require('js-yaml').load(content) as Record<string, unknown>;
  });

  it('should have status enum with valid values', () => {
    const params = toolDef.parameters as Record<string, { type: string; enum?: string[] }>;
    expect(params.status).toBeDefined();
    expect(params.status.enum).toBeDefined();
    expect(params.status.enum).toContain('subscribed');
    expect(params.status.enum).toContain('unsubscribed');
    expect(params.status.enum).toContain('pending');
    expect(params.status.enum).toContain('cleaned');
  });

  it('should have merge_fields as optional object parameter', () => {
    const params = toolDef.parameters as Record<string, { type: string; required: boolean }>;
    expect(params.merge_fields).toBeDefined();
    expect(params.merge_fields.type).toBe('object');
    expect(params.merge_fields.required).toBe(false);
  });
});

describe('mailchimp-create-campaign', () => {
  let toolDef: Record<string, unknown>;

  beforeAll(() => {
    const toolPath = path.join(__dirname, '../../tools/mailchimp-create-campaign/definition.yaml');
    const content = fs.readFileSync(toolPath, 'utf8');
    toolDef = require('js-yaml').load(content) as Record<string, unknown>;
  });

  it('should have type enum with valid campaign types', () => {
    const params = toolDef.parameters as Record<string, { type: string; enum?: string[] }>;
    expect(params.type.enum).toContain('regular');
    expect(params.type.enum).toContain('plaintext');
    expect(params.type.enum).toContain('rss');
    expect(params.type.enum).toContain('variate');
  });
});
