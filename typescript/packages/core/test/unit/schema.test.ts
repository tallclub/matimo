import {
  ParameterSchema,
  AuthConfigSchema,
  ExecutionConfigSchema,
  OutputSchemaSchema,
  validateToolDefinition,
  validateProviderDefinition,
} from '../../src/core/schema';

describe('Schema Validation', () => {
  describe('ParameterSchema', () => {
    it('should validate a string parameter', () => {
      const param = {
        type: 'string',
        description: 'A string parameter',
      };
      expect(ParameterSchema.parse(param)).toEqual(param);
    });

    it('should validate a number parameter', () => {
      const param = {
        type: 'number',
        description: 'A numeric parameter',
      };
      expect(ParameterSchema.parse(param)).toEqual(param);
    });

    it('should validate a boolean parameter', () => {
      const param = {
        type: 'boolean',
        description: 'A boolean parameter',
      };
      expect(ParameterSchema.parse(param)).toEqual(param);
    });

    it('should validate parameter with enum values', () => {
      const param = {
        type: 'string',
        description: 'Choice parameter',
        enum: ['option1', 'option2', 'option3'],
      };
      expect(ParameterSchema.parse(param)).toEqual(param);
    });

    it('should validate parameter with default value', () => {
      const param = {
        type: 'string',
        description: 'Parameter with default',
        default: 'default_value',
      };
      expect(ParameterSchema.parse(param)).toEqual(param);
    });

    it('should validate parameter with examples', () => {
      const param = {
        type: 'number',
        description: 'Parameter with examples',
        examples: [1, 2, 3],
      };
      expect(ParameterSchema.parse(param)).toEqual(param);
    });

    it('should reject parameter without type', () => {
      const param = {
        description: 'Missing type',
      };
      expect(() => ParameterSchema.parse(param)).toThrow();
    });

    it('should reject parameter without description', () => {
      const param = {
        type: 'string',
      };
      expect(() => ParameterSchema.parse(param)).toThrow();
    });

    // Regression: `items`/`properties` used to be silently stripped by this
    // schema at YAML-load time (not declared on ParameterSchema at all), so
    // e.g. `sections: { type: array, items: { type: string } }` lost its
    // items sub-schema before it ever reached the LangChain/MCP converters.
    // Those converters then fell back to an untyped array, which serializes
    // to a JSON-schema `items` entry with no 'type' key — rejected by
    // OpenAI's function-calling schema validator.
    it('should preserve items on an array parameter', () => {
      const param = {
        type: 'array',
        description: 'Sections to return',
        items: { type: 'string' },
      };
      expect(ParameterSchema.parse(param)).toEqual(param);
    });

    it('should not require a description on a nested items schema', () => {
      const param = {
        type: 'array',
        description: 'Scores',
        items: { type: 'number' },
      };
      expect(() => ParameterSchema.parse(param)).not.toThrow();
    });

    it('should preserve properties on an object parameter', () => {
      const param = {
        type: 'object',
        description: 'A page cover',
        properties: {
          url: { type: 'string' },
        },
      };
      expect(ParameterSchema.parse(param)).toEqual(param);
    });
  });

  describe('AuthConfigSchema', () => {
    it('should validate api_key authentication', () => {
      const auth = {
        type: 'api_key',
        location: 'header',
        name: 'Authorization',
      };
      expect(AuthConfigSchema.parse(auth)).toEqual(auth);
    });

    it('should validate oauth2 authentication', () => {
      const auth = {
        type: 'oauth2',
        provider: 'github',
      };
      expect(AuthConfigSchema.parse(auth)).toEqual(auth);
    });

    it('should validate basic authentication', () => {
      const auth = {
        type: 'basic',
        location: 'header',
      };
      expect(AuthConfigSchema.parse(auth)).toEqual(auth);
    });

    it('should validate bearer authentication', () => {
      const auth = {
        type: 'bearer',
        location: 'header',
      };
      expect(AuthConfigSchema.parse(auth)).toEqual(auth);
    });

    it('should allow optional fields', () => {
      const auth = {
        type: 'api_key',
      };
      expect(AuthConfigSchema.parse(auth)).toEqual(auth);
    });

    it('should validate empty auth config', () => {
      const auth = {};
      expect(AuthConfigSchema.parse(auth)).toEqual(auth);
    });
  });

  describe('ExecutionConfigSchema', () => {
    it('should validate command execution config', () => {
      const exec = {
        type: 'command' as const,
        command: 'node',
        args: ['script.js'],
      };
      expect(ExecutionConfigSchema.parse(exec)).toEqual(exec);
    });

    it('should validate command with timeout', () => {
      const exec = {
        type: 'command' as const,
        command: 'bash',
        args: ['-c', 'echo hello'],
        timeout: 5000,
      };
      expect(ExecutionConfigSchema.parse(exec)).toEqual(exec);
    });

    it('should validate HTTP GET execution', () => {
      const exec = {
        type: 'http' as const,
        method: 'GET',
        url: 'https://api.example.com/data',
      };
      expect(ExecutionConfigSchema.parse(exec)).toEqual(exec);
    });

    it('should validate HTTP POST execution with body', () => {
      const exec = {
        type: 'http' as const,
        method: 'POST',
        url: 'https://api.example.com/create',
        body: { name: 'test' },
      };
      expect(ExecutionConfigSchema.parse(exec)).toEqual(exec);
    });

    it('should validate HTTP with headers', () => {
      const exec = {
        type: 'http' as const,
        method: 'GET',
        url: 'https://api.example.com',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
      };
      expect(ExecutionConfigSchema.parse(exec)).toEqual(exec);
    });

    it('should reject invalid HTTP method', () => {
      const exec = {
        type: 'http' as const,
        method: 'INVALID' as unknown,
        url: 'https://api.example.com',
      };
      expect(() => ExecutionConfigSchema.parse(exec)).toThrow();
    });

    it('should reject command without command field', () => {
      const exec = {
        type: 'command' as const,
        args: ['test'],
      };
      expect(() => ExecutionConfigSchema.parse(exec)).toThrow();
    });
  });

  describe('OutputSchemaSchema', () => {
    it('should validate an output schema with max_response_size', () => {
      const output = { type: 'object', max_response_size: 262_144 };
      expect(OutputSchemaSchema.parse(output)).toEqual(output);
    });

    it('should validate an output schema without max_response_size (optional)', () => {
      const output = { type: 'object' };
      expect(OutputSchemaSchema.parse(output)).toEqual(output);
    });

    it('should reject a non-positive max_response_size', () => {
      expect(() => OutputSchemaSchema.parse({ max_response_size: 0 })).toThrow();
      expect(() => OutputSchemaSchema.parse({ max_response_size: -1 })).toThrow();
    });

    it('should validate a full tool definition with output_schema.max_response_size', () => {
      const tool = {
        name: 'list-items',
        description: 'Lists items',
        version: '1.0.0',
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com/items' },
        output_schema: {
          type: 'object',
          max_response_size: 100_000,
        },
      };
      expect(() => validateToolDefinition(tool)).not.toThrow();
    });
  });

  describe('validateToolDefinition error handling', () => {
    it('should provide detailed error messages for validation failures', () => {
      const { validateToolDefinition } = require('../../src/core/schema');

      const invalidTool = {
        // Missing required 'name' field
        version: '1.0.0',
        parameters: {},
        execution: {
          type: 'command',
          command: 'echo "test"',
        },
      };

      expect(() => validateToolDefinition(invalidTool)).toThrow(/Tool schema validation failed/);
    });

    it('should show which field failed validation', () => {
      const { validateToolDefinition } = require('../../src/core/schema');

      const invalidTool = {
        name: 'test-tool',
        version: '1.0.0',
        parameters: {
          param1: {
            // Missing required 'description' field
            type: 'string',
          },
        },
        execution: {
          type: 'command',
          command: 'echo "test"',
        },
      };

      expect(() => validateToolDefinition(invalidTool)).toThrow(/parameters\.param1.*description/);
    });

    it('should handle multiple validation errors', () => {
      const { validateToolDefinition } = require('../../src/core/schema');

      const invalidTool = {
        // Missing 'name'
        // Missing 'version'
        parameters: {},
        execution: {},
      };

      expect(() => validateToolDefinition(invalidTool)).toThrow();
      // Should mention multiple fields in the error message
    });

    it('should format validation errors with nested path information', () => {
      const invalidTool = {
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        parameters: {
          nested: {
            // Missing required 'type' field
            description: 'A nested parameter',
          },
        },
        execution: {
          type: 'command',
          command: 'test',
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => validateToolDefinition(invalidTool as any)).toThrow(
        /Tool schema validation failed/
      );
    });
  });

  describe('validateProviderDefinition', () => {
    it('should validate a valid provider definition', () => {
      const validProvider = {
        name: 'github-provider',
        type: 'provider',
        version: '1.0.0',
        description: 'GitHub OAuth2 provider',
        provider: {
          name: 'github',
          displayName: 'GitHub',
          endpoints: {
            authorizationUrl: 'https://github.com/login/oauth/authorize',
            tokenUrl: 'https://github.com/login/oauth/access_token',
            revokeUrl: 'https://api.github.com/applications/{client_id}/grants/{token_id}',
          },
          defaultScopes: ['user:email', 'repo'],
          documentation: 'https://docs.github.com/en/developers/apps',
          learnMore: 'https://github.com',
        },
      };

      const result = validateProviderDefinition(validProvider);
      expect(result.name).toBe('github-provider');
      expect(result.provider.name).toBe('github');
    });

    it('should reject provider definition missing required fields', () => {
      const invalidProvider = {
        // Missing 'name', 'type', 'version', 'provider'
      };

      expect(() => validateProviderDefinition(invalidProvider)).toThrow(
        /Provider schema validation failed/
      );
    });

    it('should reject provider with invalid type', () => {
      const invalidProvider = {
        name: 'test-provider',
        type: 'tool',
        version: '1.0.0',
        provider: {
          name: 'test',
          endpoints: {
            authorizationUrl: 'https://example.com/auth',
            tokenUrl: 'https://example.com/token',
          },
        },
      };

      expect(() => validateProviderDefinition(invalidProvider)).toThrow(
        /Provider schema validation failed/
      );
    });

    it('should reject provider with missing endpoints', () => {
      const invalidProvider = {
        name: 'test-provider',
        type: 'provider',
        version: '1.0.0',
        provider: {
          name: 'test',
          // Missing endpoints
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => validateProviderDefinition(invalidProvider as any)).toThrow(
        /Provider schema validation failed/
      );
    });

    it('should reject provider with invalid URL in endpoints', () => {
      const invalidProvider = {
        name: 'test-provider',
        type: 'provider',
        version: '1.0.0',
        provider: {
          name: 'test',
          endpoints: {
            authorizationUrl: 'not-a-valid-url',
            tokenUrl: 'https://example.com/token',
          },
        },
      };

      expect(() => validateProviderDefinition(invalidProvider)).toThrow(
        /Provider schema validation failed/
      );
    });

    it('should allow optional provider fields', () => {
      const minimalProvider = {
        name: 'minimal-provider',
        type: 'provider',
        version: '1.0.0',
        provider: {
          name: 'minimal',
          endpoints: {
            authorizationUrl: 'https://example.com/auth',
            tokenUrl: 'https://example.com/token',
          },
        },
      };

      const result = validateProviderDefinition(minimalProvider);
      expect(result.name).toBe('minimal-provider');
      expect(result.provider.displayName).toBeUndefined();
      expect(result.provider.defaultScopes).toBeUndefined();
    });
  });
});
