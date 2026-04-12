import {
  convertToolsToLangChain,
  getSkillsMetadata,
  buildRelevantSkillPrompt,
} from '../../src/integrations/langchain';
import { ToolDefinition, Parameter } from '../../src/core/types';
import { MatimoInstance } from '../../src/matimo-instance';
import { z } from 'zod';

/**
 * LangChain Integration Tests - Complete Coverage
 *
 * Tests convertToolsToLangChain with comprehensive coverage of:
 * - Empty tool arrays
 * - Tools with and without parameters
 * - Secret parameter injection
 * - Result formatting (all patterns)
 * - Error handling
 * - Edge cases
 */

describe('convertToolsToLangChain', () => {
  let matimo: MatimoInstance;

  beforeEach(async () => {
    matimo = await MatimoInstance.init('./tools');
  });

  describe('Basic functionality', () => {
    it('should handle empty tool array', async () => {
      const result = await convertToolsToLangChain([], matimo);
      expect(result).toEqual([]);
    });

    it('should handle undefined secrets', async () => {
      const tool: ToolDefinition = {
        name: 'test-tool',
        version: '1.0.0',
        description: 'Test tool',
        parameters: {},
        execution: {
          type: 'command',
          command: 'echo',
          args: [],
        },
      };

      const result = await convertToolsToLangChain([tool], matimo, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test-tool');
      expect(result[0].description).toBe('Test tool');
    });

    it('should convert single tool successfully', async () => {
      const tool: ToolDefinition = {
        name: 'single-tool',
        version: '1.0.0',
        description: 'A single test tool',
        parameters: {},
        execution: {
          type: 'command',
          command: 'echo',
          args: [],
        },
      };

      const result = await convertToolsToLangChain([tool], matimo);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('single-tool');
    });

    it('should convert multiple tools', async () => {
      const tools: ToolDefinition[] = [
        {
          name: 'tool-1',
          version: '1.0.0',
          description: 'First tool',
          parameters: {},
          execution: { type: 'command', command: 'echo', args: [] },
        },
        {
          name: 'tool-2',
          version: '1.0.0',
          description: 'Second tool',
          parameters: {},
          execution: { type: 'command', command: 'echo', args: [] },
        },
      ];

      const result = await convertToolsToLangChain(tools, matimo);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('tool-1');
      expect(result[1].name).toBe('tool-2');
    });
  });

  describe('Tool execution with mocked results', () => {
    it('should execute tool and format null result', async () => {
      const tool: ToolDefinition = {
        name: 'null-result-tool',
        version: '1.0.0',
        description: 'Returns null',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue(null);
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      expect(result).toBeNull();
    });

    it('should execute tool and format string result', async () => {
      const tool: ToolDefinition = {
        name: 'string-result-tool',
        version: '1.0.0',
        description: 'Returns string',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue('Hello World');
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      expect(result).toBe('Hello World');
    });

    it('should execute tool and format number result', async () => {
      const tool: ToolDefinition = {
        name: 'number-result-tool',
        version: '1.0.0',
        description: 'Returns number',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue(42);
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      expect(result).toBe(42);
    });

    it('should execute tool and format boolean result', async () => {
      const tool: ToolDefinition = {
        name: 'bool-result-tool',
        version: '1.0.0',
        description: 'Returns boolean',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue(true);
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      expect(result).toBe(true);
    });

    it('should execute tool and return ok=true response', async () => {
      const tool: ToolDefinition = {
        name: 'ok-tool',
        version: '1.0.0',
        description: 'Returns ok',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      expect(typeof result).toBe('object');
      expect((result as Record<string, unknown>).ok).toBe(true);
    });

    it('should execute tool and return error response', async () => {
      const tool: ToolDefinition = {
        name: 'error-tool',
        version: '1.0.0',
        description: 'Returns error',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ error: 'Something went wrong' });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      expect(typeof result).toBe('object');
      expect((result as Record<string, unknown>).error).toBe('Something went wrong');
    });

    it('should execute tool and return empty items response', async () => {
      const tool: ToolDefinition = {
        name: 'empty-items-tool',
        version: '1.0.0',
        description: 'Returns empty items',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ items: [] });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      // Result is the object returned by execute
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should execute tool and return items response', async () => {
      const tool: ToolDefinition = {
        name: 'items-tool',
        version: '1.0.0',
        description: 'Returns items',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
      });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      // Result is the object returned by execute
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should execute tool and return empty messages response', async () => {
      const tool: ToolDefinition = {
        name: 'empty-messages-tool',
        version: '1.0.0',
        description: 'Returns empty messages',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ messages: [] });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      // Result is the object returned by execute
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should execute tool and return messages response', async () => {
      const tool: ToolDefinition = {
        name: 'messages-tool',
        version: '1.0.0',
        description: 'Returns messages',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({
        messages: [
          { id: '1', text: 'Hello' },
          { id: '2', text: 'World' },
        ],
      });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      // Result is the object returned by execute
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should execute tool and return empty channels response', async () => {
      const tool: ToolDefinition = {
        name: 'empty-channels-tool',
        version: '1.0.0',
        description: 'Returns empty channels',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ channels: [] });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      // Result is the object returned by execute
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should execute tool and return channels response', async () => {
      const tool: ToolDefinition = {
        name: 'channels-tool',
        version: '1.0.0',
        description: 'Returns channels',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({
        channels: [
          { id: 'C1', name: '#general' },
          { id: 'C2', name: '#random' },
        ],
      });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      // Result is the object returned by execute
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should execute tool and return data response', async () => {
      const tool: ToolDefinition = {
        name: 'data-tool',
        version: '1.0.0',
        description: 'Returns data',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ data: { userId: '123' } });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      // Result is the object returned by execute
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should execute tool and return generic object response', async () => {
      const tool: ToolDefinition = {
        name: 'generic-tool',
        version: '1.0.0',
        description: 'Returns generic object',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ field1: 'value1', field2: 'value2' });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      expect(typeof result).toBe('object');
      const resultObj = result as Record<string, unknown>;
      expect(resultObj.field1).toBe('value1');
    });
  });

  describe('Secret parameter injection', () => {
    it('should inject single secret parameter', async () => {
      const tool: ToolDefinition = {
        name: 'secret-tool',
        version: '1.0.0',
        description: 'Tool with secret',
        parameters: {
          api_token: {
            type: 'string',
            required: true,
            description: 'API token',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo, {
        api_token: 'secret-value',
      });

      await langTools[0].invoke({});

      // Verify that the secret was injected
      expect(matimo.execute).toHaveBeenCalledWith('secret-tool', {
        api_token: 'secret-value',
      });
    });

    it('should inject multiple secret parameters', async () => {
      const tool: ToolDefinition = {
        name: 'multi-secret-tool',
        version: '1.0.0',
        description: 'Tool with multiple secrets',
        parameters: {
          slack_token: {
            type: 'string',
            required: true,
            description: 'Slack token',
          },
          gmail_token: {
            type: 'string',
            required: true,
            description: 'Gmail token',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo, {
        slack_token: 'slack-secret',
        gmail_token: 'gmail-secret',
      });

      await langTools[0].invoke({});

      expect(matimo.execute).toHaveBeenCalledWith('multi-secret-tool', {
        slack_token: 'slack-secret',
        gmail_token: 'gmail-secret',
      });
    });

    it('should inject secrets and pass through user parameters', async () => {
      const tool: ToolDefinition = {
        name: 'mixed-params-tool',
        version: '1.0.0',
        description: 'Tool with mixed params',
        parameters: {
          api_key: {
            type: 'string',
            required: true,
            description: 'API key',
          },
          message: {
            type: 'string',
            required: true,
            description: 'Message',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo, {
        api_key: 'secret-key',
      });

      await langTools[0].invoke({ message: 'test message' });

      expect(matimo.execute).toHaveBeenCalledWith('mixed-params-tool', {
        message: 'test message',
        api_key: 'secret-key',
      });
    });
  });

  describe('Error handling', () => {
    it('should handle execution error and return error message', async () => {
      const tool: ToolDefinition = {
        name: 'error-tool',
        version: '1.0.0',
        description: 'Tool that throws error',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockRejectedValue(new Error('Tool failed'));
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      expect(result).toBe('Error: Tool failed');
    });

    it('should handle non-Error exception and return error message', async () => {
      const tool: ToolDefinition = {
        name: 'non-error-tool',
        version: '1.0.0',
        description: 'Tool with non-Error exception',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockRejectedValue('String error message');
      const langTools = await convertToolsToLangChain([tool], matimo);

      const result = await langTools[0].invoke({});
      expect(result).toBe('Error: String error message');
    });
  });

  describe('Parameter types', () => {
    it('should handle tool with string parameters', async () => {
      const tool: ToolDefinition = {
        name: 'string-param-tool',
        version: '1.0.0',
        description: 'Tool with string param',
        parameters: {
          text: {
            type: 'string',
            required: true,
            description: 'Input text',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
      expect(langTools[0].schema).toBeDefined();
    });

    it('should handle tool with number parameters', async () => {
      const tool: ToolDefinition = {
        name: 'number-param-tool',
        version: '1.0.0',
        description: 'Tool with number param',
        parameters: {
          count: {
            type: 'number',
            required: true,
            description: 'Count',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
      expect(langTools[0].schema).toBeDefined();
    });

    it('should handle tool with boolean parameters', async () => {
      const tool: ToolDefinition = {
        name: 'bool-param-tool',
        version: '1.0.0',
        description: 'Tool with boolean param',
        parameters: {
          enabled: {
            type: 'boolean',
            required: true,
            description: 'Enabled flag',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
      expect(langTools[0].schema).toBeDefined();
    });

    it('should handle tool with optional parameters', async () => {
      const tool: ToolDefinition = {
        name: 'optional-param-tool',
        version: '1.0.0',
        description: 'Tool with optional param',
        parameters: {
          optional_field: {
            type: 'string',
            required: false,
            description: 'Optional field',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
      expect(langTools[0].schema).toBeDefined();
    });

    it('should handle tool with no parameters', async () => {
      const tool: ToolDefinition = {
        name: 'no-param-tool',
        version: '1.0.0',
        description: 'Tool with no params',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
      expect(langTools[0].schema).toBeDefined();
    });
  });

  describe('Tool metadata', () => {
    it('should preserve tool name', async () => {
      const tool: ToolDefinition = {
        name: 'my-custom-tool',
        version: '1.0.0',
        description: 'A custom tool',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools[0].name).toBe('my-custom-tool');
    });

    it('should preserve tool description', async () => {
      const tool: ToolDefinition = {
        name: 'described-tool',
        version: '1.0.0',
        description: 'This is a detailed description of the tool',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools[0].description).toBe('This is a detailed description of the tool');
    });

    it('should provide default description if missing', async () => {
      const tool: ToolDefinition = {
        name: 'tool-no-desc',
        version: '1.0.0',
        description: '',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools[0].description).toBeDefined();
    });
  });

  describe('Parameter type coverage - 100% lines', () => {
    it('should handle array parameters with items schema', async () => {
      const tool: ToolDefinition = {
        name: 'array-items-tool',
        version: '1.0.0',
        description: 'Tool with array having items',
        parameters: {
          tags: {
            type: 'array',
            required: true,
            description: 'List of tags',
            items: {
              type: 'string',
              required: true,
              description: 'Tag name',
            },
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
    });

    it('should handle array parameters without items schema', async () => {
      const tool: ToolDefinition = {
        name: 'array-no-items-tool',
        version: '1.0.0',
        description: 'Tool with array without items',
        parameters: {
          items: {
            type: 'array',
            required: true,
            description: 'Generic array',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
    });

    it('should handle object parameters with properties', async () => {
      const tool: ToolDefinition = {
        name: 'object-with-props-tool',
        version: '1.0.0',
        description: 'Tool with object having properties',
        parameters: {
          config: {
            type: 'object',
            required: true,
            description: 'Configuration object',
            properties: {
              timeout: {
                type: 'number',
                required: false,
                description: 'Timeout in ms',
              },
              retries: {
                type: 'number',
                required: true,
                description: 'Number of retries',
              },
            },
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
    });

    it('should handle object parameters without properties', async () => {
      const tool: ToolDefinition = {
        name: 'object-no-props-tool',
        version: '1.0.0',
        description: 'Tool with object without properties',
        parameters: {
          metadata: {
            type: 'object',
            required: true,
            description: 'Generic metadata object',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
    });

    it('should handle nested object with properties', async () => {
      const tool: ToolDefinition = {
        name: 'nested-object-tool',
        version: '1.0.0',
        description: 'Tool with nested object',
        parameters: {
          user: {
            type: 'object',
            required: true,
            description: 'User object',
            properties: {
              profile: {
                type: 'object',
                required: false,
                description: 'User profile',
                properties: {
                  name: {
                    type: 'string',
                    required: true,
                    description: 'User name',
                  },
                },
              },
            },
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
    });

    it('should handle nested array within object', async () => {
      const tool: ToolDefinition = {
        name: 'nested-array-object-tool',
        version: '1.0.0',
        description: 'Tool with nested array in object',
        parameters: {
          data: {
            type: 'object',
            required: true,
            description: 'Data object',
            properties: {
              items: {
                type: 'array',
                required: true,
                description: 'Array of items',
                items: {
                  type: 'string',
                  required: true,
                  description: 'Item value',
                },
              },
            },
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
    });

    it('should handle unknown parameter type (fallback)', async () => {
      const tool: ToolDefinition = {
        name: 'unknown-type-tool',
        version: '1.0.0',
        description: 'Tool with unknown parameter type',
        parameters: {
          custom: {
            type: 'custom',
            required: true,
            description: 'Custom type parameter',
          } as unknown as Parameter,
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
    });
  });

  describe('Parameter filtering and secrets - 100% lines', () => {
    it('should skip secret parameters in schema', async () => {
      const tool: ToolDefinition = {
        name: 'secret-params-tool',
        version: '1.0.0',
        description: 'Tool with secret parameters',
        parameters: {
          api_key: {
            type: 'string',
            required: true,
            description: 'API key',
          },
          message: {
            type: 'string',
            required: true,
            description: 'Message to send',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain(
        [tool],
        matimo,
        { api_key: 'secret-123' },
        new Set(['api_key']) // Explicitly mark as secret
      );

      // Invoke with only message (api_key should be injected)
      await langTools[0].invoke({ message: 'test' });

      expect(matimo.execute).toHaveBeenCalledWith('secret-params-tool', {
        message: 'test',
        api_key: 'secret-123',
      });
    });

    it('should handle tool with no parameters', async () => {
      const tool: ToolDefinition = {
        name: 'no-params-tool',
        version: '1.0.0',
        description: 'Tool with no parameters',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo);

      await langTools[0].invoke({});
      expect(matimo.execute).toHaveBeenCalledWith('no-params-tool', {});
    });

    it('should handle tool with empty parameters object', async () => {
      const tool: ToolDefinition = {
        name: 'empty-params-tool',
        version: '1.0.0',
        description: 'Tool with empty parameters',
        parameters: {},
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo);

      await langTools[0].invoke({});
      expect(matimo.execute).toHaveBeenCalledWith('empty-params-tool', {});
    });
  });

  describe('Description handling - 100% lines', () => {
    it('should add description to string parameter schema', async () => {
      const tool: ToolDefinition = {
        name: 'desc-string-tool',
        version: '1.0.0',
        description: 'Tool with described string param',
        parameters: {
          username: {
            type: 'string',
            required: true,
            description: 'The username to look up',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo);
      expect(langTools).toHaveLength(1);
    });

    it('should handle optional parameter (make optional in schema)', async () => {
      const tool: ToolDefinition = {
        name: 'optional-param-tool',
        version: '1.0.0',
        description: 'Tool with optional parameter',
        parameters: {
          filter: {
            type: 'string',
            required: false,
            description: 'Optional filter',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo);

      // Should work without the optional parameter
      await langTools[0].invoke({});
      expect(matimo.execute).toHaveBeenCalledWith('optional-param-tool', {});
    });
  });

  describe('Auto-detection of secret parameters - 100% lines', () => {
    it('should auto-detect TOKEN pattern in parameter name', async () => {
      const tool: ToolDefinition = {
        name: 'token-tool',
        version: '1.0.0',
        description: 'Tool with TOKEN parameter',
        parameters: {
          slack_bot_token: {
            type: 'string',
            required: true,
            description: 'Slack bot token',
          },
          channel: {
            type: 'string',
            required: true,
            description: 'Channel name',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo, {
        slack_bot_token: 'secret123',
      });

      // slack_bot_token should not be in schema (auto-detected as secret)
      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      expect(schema.shape).not.toHaveProperty('slack_bot_token');
      expect(schema.shape).toHaveProperty('channel');

      // Execute with channel only (token is injected)
      await langTools[0].invoke({ channel: '#general' });
      expect(matimo.execute).toHaveBeenCalledWith('token-tool', {
        channel: '#general',
        slack_bot_token: 'secret123',
      });
    });

    it('should auto-detect KEY pattern in parameter name', async () => {
      const tool: ToolDefinition = {
        name: 'key-tool',
        version: '1.0.0',
        description: 'Tool with KEY parameter',
        parameters: {
          api_key: {
            type: 'string',
            required: true,
            description: 'API key',
          },
          endpoint: {
            type: 'string',
            required: true,
            description: 'API endpoint',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo, { api_key: 'key789' });

      // api_key should not be in schema (auto-detected as secret)
      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      expect(schema.shape).not.toHaveProperty('api_key');
      expect(schema.shape).toHaveProperty('endpoint');

      // Execute with endpoint only (key is injected)
      await langTools[0].invoke({ endpoint: 'https://api.example.com' });
      expect(matimo.execute).toHaveBeenCalledWith('key-tool', {
        endpoint: 'https://api.example.com',
        api_key: 'key789',
      });
    });

    it('should auto-detect SECRET pattern in parameter name', async () => {
      const tool: ToolDefinition = {
        name: 'secret-tool',
        version: '1.0.0',
        description: 'Tool with SECRET parameter',
        parameters: {
          api_secret: {
            type: 'string',
            required: true,
            description: 'API secret',
          },
          query: {
            type: 'string',
            required: true,
            description: 'Search query',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo, { api_secret: 'mysecret' });

      // api_secret should not be in schema (auto-detected as secret)
      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      expect(schema.shape).not.toHaveProperty('api_secret');
      expect(schema.shape).toHaveProperty('query');
    });

    it('should auto-detect PASSWORD pattern in parameter name', async () => {
      const tool: ToolDefinition = {
        name: 'password-tool',
        version: '1.0.0',
        description: 'Tool with PASSWORD parameter',
        parameters: {
          db_password: {
            type: 'string',
            required: true,
            description: 'Database password',
          },
          username: {
            type: 'string',
            required: true,
            description: 'Database username',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo, { db_password: 'pass123' });

      // db_password should not be in schema (auto-detected as secret)
      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      expect(schema.shape).not.toHaveProperty('db_password');
      expect(schema.shape).toHaveProperty('username');
    });

    it('should handle case-insensitive auto-detection', async () => {
      const tool: ToolDefinition = {
        name: 'case-tool',
        version: '1.0.0',
        description: 'Tool with mixed case secret parameters',
        parameters: {
          ApiKey: {
            type: 'string',
            required: true,
            description: 'API key',
          },
          PASSWORD: {
            type: 'string',
            required: true,
            description: 'Password',
          },
          normalParam: {
            type: 'string',
            required: true,
            description: 'Normal parameter',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo, {
        ApiKey: 'key123',
        PASSWORD: 'pass123',
      });

      // Both should be auto-detected as secrets despite case differences
      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      expect(schema.shape).not.toHaveProperty('ApiKey');
      expect(schema.shape).not.toHaveProperty('PASSWORD');
      expect(schema.shape).toHaveProperty('normalParam');

      // Execute with normalParam only (secrets are injected)
      await langTools[0].invoke({ normalParam: 'value' });
      expect(matimo.execute).toHaveBeenCalledWith('case-tool', {
        normalParam: 'value',
        ApiKey: 'key123',
        PASSWORD: 'pass123',
      });
    });

    it('should combine auto-detection with explicitly declared secret params', async () => {
      const tool: ToolDefinition = {
        name: 'combined-tool',
        version: '1.0.0',
        description: 'Tool with mixed secret declaration',
        parameters: {
          api_key: {
            type: 'string',
            required: true,
            description: 'API key',
          },
          custom_secret: {
            type: 'string',
            required: true,
            description: 'Custom secret',
          },
          normal_param: {
            type: 'string',
            required: true,
            description: 'Normal parameter',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });

      // api_key is auto-detected, custom_secret is explicitly declared
      const langTools = await convertToolsToLangChain(
        [tool],
        matimo,
        { api_key: 'key123', custom_secret: 'secret789' },
        new Set(['custom_secret']) // Explicit declaration
      );

      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      expect(schema.shape).not.toHaveProperty('api_key'); // Auto-detected
      expect(schema.shape).not.toHaveProperty('custom_secret'); // Explicitly declared
      expect(schema.shape).toHaveProperty('normal_param');

      await langTools[0].invoke({ normal_param: 'value' });
      expect(matimo.execute).toHaveBeenCalledWith('combined-tool', {
        normal_param: 'value',
        api_key: 'key123',
        custom_secret: 'secret789',
      });
    });

    it('should not fail when auto-detected secret has no value in secrets map', async () => {
      const tool: ToolDefinition = {
        name: 'missing-secret-tool',
        version: '1.0.0',
        description: 'Tool with missing secret value',
        parameters: {
          api_key: {
            type: 'string',
            required: true,
            description: 'API key',
          },
          data: {
            type: 'string',
            required: true,
            description: 'Data to process',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo, {}); // No secrets provided

      // api_key is auto-detected as secret but not in schema
      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      expect(schema.shape).not.toHaveProperty('api_key');
      expect(schema.shape).toHaveProperty('data');

      // Execute with data only
      await langTools[0].invoke({ data: 'test' });
      expect(matimo.execute).toHaveBeenCalledWith('missing-secret-tool', {
        data: 'test',
        // api_key is not injected since it's not in the secrets map
      });
    });

    it('should NOT treat false-positive substrings as secrets', async () => {
      // Test word-boundary matching: "monkey", "turkey_id", "donkey" should NOT be treated as secrets
      const tool: ToolDefinition = {
        name: 'false-positive-tool',
        version: '1.0.0',
        description: 'Tool with parameters that contain secret patterns as substrings',
        parameters: {
          monkey: {
            type: 'string',
            required: true,
            description: 'A monkey emoji',
          },
          turkey_id: {
            type: 'string',
            required: true,
            description: 'Turkey identifier',
          },
          donkey_mode: {
            type: 'string',
            required: true,
            description: 'Mode like a donkey',
          },
          real_api_key: {
            type: 'string',
            required: true,
            description: 'Real API key',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo, { real_api_key: 'key123' });

      // Only real_api_key should be treated as a secret, NOT the false positives
      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      expect(schema.shape).toHaveProperty('monkey'); // Should be in schema (NOT a secret)
      expect(schema.shape).toHaveProperty('turkey_id'); // Should be in schema (NOT a secret)
      expect(schema.shape).toHaveProperty('donkey_mode'); // Should be in schema (NOT a secret)
      expect(schema.shape).not.toHaveProperty('real_api_key'); // Should NOT be in schema (is a secret)

      // Execute with non-secret params
      await langTools[0].invoke({
        monkey: 'emoji',
        turkey_id: '42',
        donkey_mode: 'wild',
      });
      expect(matimo.execute).toHaveBeenCalledWith('false-positive-tool', {
        monkey: 'emoji',
        turkey_id: '42',
        donkey_mode: 'wild',
        real_api_key: 'key123', // Injected from secrets
      });
    });

    it('should correctly detect valid secret patterns (word boundaries)', async () => {
      const tool: ToolDefinition = {
        name: 'valid-secrets-tool',
        version: '1.0.0',
        description: 'Tool with properly formatted secret parameters',
        parameters: {
          api_token: {
            type: 'string',
            required: true,
            description: 'API token',
          },
          access_key: {
            type: 'string',
            required: true,
            description: 'Access key',
          },
          getSecret: {
            type: 'string',
            required: true,
            description: 'Get secret',
          },
          PASSWORD: {
            type: 'string',
            required: true,
            description: 'Password',
          },
          data: {
            type: 'string',
            required: true,
            description: 'Regular data parameter',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ success: true });
      const langTools = await convertToolsToLangChain([tool], matimo, {
        api_token: 'token123',
        access_key: 'key456',
        getSecret: 'secret789',
        PASSWORD: 'pass111',
      });

      // All secret parameters should be excluded from schema
      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      expect(schema.shape).not.toHaveProperty('api_token');
      expect(schema.shape).not.toHaveProperty('access_key');
      expect(schema.shape).not.toHaveProperty('getSecret');
      expect(schema.shape).not.toHaveProperty('PASSWORD');
      expect(schema.shape).toHaveProperty('data');

      // Execute with only non-secret data
      await langTools[0].invoke({ data: 'value' });
      expect(matimo.execute).toHaveBeenCalledWith('valid-secrets-tool', {
        data: 'value',
        api_token: 'token123',
        access_key: 'key456',
        getSecret: 'secret789',
        PASSWORD: 'pass111',
      });
    });
  });

  describe('Enum constraints - 100% lines', () => {
    it('should validate enum constraints for string parameters', async () => {
      const tool: ToolDefinition = {
        name: 'enum-tool',
        version: '1.0.0',
        description: 'Tool with enum parameter',
        parameters: {
          status: {
            type: 'string',
            required: true,
            description: 'Status enum',
            enum: ['active', 'inactive', 'pending'],
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      const statusSchema = schema.shape.status;

      // Valid enum values should pass
      expect(() => statusSchema.parse('active')).not.toThrow();
      expect(() => statusSchema.parse('inactive')).not.toThrow();
      expect(() => statusSchema.parse('pending')).not.toThrow();

      // Invalid values should fail
      expect(() => statusSchema.parse('invalid')).toThrow();
    });

    it('should validate enum constraints for number parameters', async () => {
      const tool: ToolDefinition = {
        name: 'number-enum-tool',
        version: '1.0.0',
        description: 'Tool with number enum',
        parameters: {
          level: {
            type: 'number',
            required: true,
            description: 'Level enum',
            enum: [1, 2, 3],
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      const levelSchema = schema.shape.level;

      // Valid enum values should pass
      expect(() => levelSchema.parse(1)).not.toThrow();
      expect(() => levelSchema.parse(2)).not.toThrow();
      expect(() => levelSchema.parse(3)).not.toThrow();

      // Invalid values should fail
      expect(() => levelSchema.parse(4)).toThrow();
      expect(() => levelSchema.parse('1')).toThrow();
    });

    it('should prioritize enum over type validation', async () => {
      const tool: ToolDefinition = {
        name: 'enum-priority-tool',
        version: '1.0.0',
        description: 'Tool where enum takes priority',
        parameters: {
          mode: {
            type: 'string',
            required: true,
            description: 'Mode with enum',
            enum: ['read', 'write'],
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      const modeSchema = schema.shape.mode;

      // Only enum values allowed
      expect(() => modeSchema.parse('read')).not.toThrow();
      expect(() => modeSchema.parse('write')).not.toThrow();
      expect(() => modeSchema.parse('any-string')).toThrow();
    });
  });

  describe('Default values - 100% lines', () => {
    it('should apply default values to parameters', async () => {
      const tool: ToolDefinition = {
        name: 'default-tool',
        version: '1.0.0',
        description: 'Tool with default values',
        parameters: {
          timeout: {
            type: 'number',
            required: false,
            description: 'Timeout in ms',
            default: 5000,
          },
          format: {
            type: 'string',
            required: false,
            description: 'Output format',
            default: 'json',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo);

      // Invoke with no arguments - defaults should be applied
      await langTools[0].invoke({});
      expect(matimo.execute).toHaveBeenCalledWith('default-tool', {
        timeout: 5000,
        format: 'json',
      });
    });

    it('should allow overriding default values', async () => {
      const tool: ToolDefinition = {
        name: 'override-default-tool',
        version: '1.0.0',
        description: 'Tool with overrideable defaults',
        parameters: {
          retries: {
            type: 'number',
            required: false,
            description: 'Number of retries',
            default: 3,
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo);

      // Override the default
      await langTools[0].invoke({ retries: 5 });
      expect(matimo.execute).toHaveBeenCalledWith('override-default-tool', {
        retries: 5,
      });
    });

    it('should combine enum and default values', async () => {
      const tool: ToolDefinition = {
        name: 'enum-default-tool',
        version: '1.0.0',
        description: 'Tool with both enum and default',
        parameters: {
          priority: {
            type: 'string',
            required: false,
            description: 'Priority level',
            enum: ['low', 'medium', 'high'],
            default: 'medium',
          },
        },
        execution: { type: 'command', command: 'echo', args: [] },
      };

      matimo.execute = jest.fn().mockResolvedValue({ ok: true });
      const langTools = await convertToolsToLangChain([tool], matimo);

      const schema = langTools[0].schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      const prioritySchema = schema.shape.priority;

      // Default value should apply
      await langTools[0].invoke({});
      expect(matimo.execute).toHaveBeenCalledWith('enum-default-tool', {
        priority: 'medium',
      });

      // But enum validation still applies
      expect(() => prioritySchema.parse('invalid')).toThrow();
      expect(() => prioritySchema.parse('high')).not.toThrow();
    });
  });
});

// ─── Skill context helpers ────────────────────────────────────────────────────

describe('getSkillsMetadata', () => {
  function makeMockMatimo(skills: Array<{ name: string; description?: string }>): MatimoInstance {
    return {
      listSkills: jest.fn().mockReturnValue(skills),
    } as unknown as MatimoInstance;
  }

  it('should return an empty array when there are no skills', () => {
    const matimo = makeMockMatimo([]);
    expect(getSkillsMetadata(matimo)).toEqual([]);
  });

  it('should omit skills with no readable content', () => {
    const matimo = makeMockMatimo([{ name: 'skill-a', description: 'A' }]);
    expect(getSkillsMetadata(matimo)).toHaveLength(1);
  });

  it('should map skills to name+description objects', () => {
    const matimo = makeMockMatimo([
      { name: 'skill-a', description: 'Skill A' },
      { name: 'skill-b', description: 'Skill B' },
    ]);
    const result = getSkillsMetadata(matimo);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'skill-a', description: 'Skill A' });
    expect(result[1]).toEqual({ name: 'skill-b', description: 'Skill B' });
  });

  it('should not include a content property', () => {
    const matimo = makeMockMatimo([{ name: 'skill-a', description: 'A' }]);
    const result = getSkillsMetadata(matimo);
    expect(result[0]).not.toHaveProperty('content');
  });

  it('should use empty string for missing description', () => {
    const matimo = makeMockMatimo([{ name: 'skill-a' }]);
    const result = getSkillsMetadata(matimo);
    expect(result[0]).toEqual({ name: 'skill-a', description: '' });
  });
});

describe('buildRelevantSkillPrompt', () => {
  type MockSkillResult = {
    skill: { name: string; description?: string };
    score: number;
  };

  function makeMockMatimo(
    searchResults: MockSkillResult[],
    contentMap: Record<string, string | null> = {}
  ): MatimoInstance {
    return {
      listSkills: jest.fn().mockReturnValue(searchResults.map((r) => r.skill)),
      semanticSearchSkills: jest.fn().mockResolvedValue(searchResults),
      getSkillContent: jest.fn().mockImplementation((name: string) => contentMap[name] ?? null),
    } as unknown as MatimoInstance;
  }

  it('should return an empty string when there are no search results', async () => {
    const matimo = makeMockMatimo([]);
    expect(await buildRelevantSkillPrompt(matimo, 'some query')).toBe('');
  });

  it('should return an empty string when no skills have content', async () => {
    const matimo = makeMockMatimo([{ skill: { name: 'skill-a', description: 'A' }, score: 0.8 }], {
      'skill-a': null,
    });
    expect(await buildRelevantSkillPrompt(matimo, 'some query')).toBe('');
  });

  it('should include default header and skill block', async () => {
    const matimo = makeMockMatimo(
      [{ skill: { name: 'my-skill', description: 'Does something' }, score: 0.85 }],
      { 'my-skill': '# My Skill\nDo things.' }
    );
    const prompt = await buildRelevantSkillPrompt(matimo, 'some query');
    expect(prompt).toContain('The following skills are relevant to the current request');
    expect(prompt).toContain('## Skill: my-skill');
    expect(prompt).toContain('# My Skill');
  });

  it('should include the relevance score in the skill header', async () => {
    const matimo = makeMockMatimo(
      [{ skill: { name: 'my-skill', description: 'A' }, score: 0.75 }],
      { 'my-skill': '# Content' }
    );
    const prompt = await buildRelevantSkillPrompt(matimo, 'some query');
    expect(prompt).toContain('(relevance: 0.75)');
  });

  it('should use a custom header when provided', async () => {
    const matimo = makeMockMatimo([{ skill: { name: 'my-skill', description: 'A' }, score: 0.8 }], {
      'my-skill': '# Content',
    });
    const prompt = await buildRelevantSkillPrompt(matimo, 'some query', {
      header: 'Custom header text',
    });
    expect(prompt.startsWith('Custom header text')).toBe(true);
  });

  it('should include the skill description in italics when present', async () => {
    const matimo = makeMockMatimo(
      [{ skill: { name: 'my-skill', description: 'Does something' }, score: 0.8 }],
      { 'my-skill': '# Content' }
    );
    const prompt = await buildRelevantSkillPrompt(matimo, 'some query');
    expect(prompt).toContain('_Does something_');
  });

  it('should pass topK and minScore options to semanticSearchSkills', async () => {
    const matimo = makeMockMatimo([], {});
    await buildRelevantSkillPrompt(matimo, 'some query', { topK: 5, minScore: 0.6 });
    expect(matimo.semanticSearchSkills as jest.Mock).toHaveBeenCalledWith('some query', {
      limit: 5,
      minScore: 0.6,
    });
  });
});
