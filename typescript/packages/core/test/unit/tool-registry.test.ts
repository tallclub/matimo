import { ToolRegistry } from '../../src/core/tool-registry';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      const tool = {
        name: 'test-tool',
        version: '1.0.0',
        description: 'Test tool',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['test'],
        },
      };

      registry.register(tool);
      expect(registry.get('test-tool')).toBeDefined();
    });

    it('should throw error when registering duplicate tool', () => {
      const tool = {
        name: 'duplicate',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['test'],
        },
      };

      registry.register(tool);
      expect(() => registry.register(tool)).toThrow();
    });

    it('should store tool with all properties', () => {
      const tool = {
        name: 'full-tool',
        version: '1.0.0',
        description: 'Full test tool',
        parameters: {
          param1: {
            type: 'string' as const,
            description: 'Test parameter',
          },
        },
        execution: {
          type: 'command' as const,
          command: 'test',
          args: ['arg1'],
        },
        authentication: {
          type: 'api_key' as const,
          location: 'header' as const,
          name: 'Authorization',
        },
      };

      registry.register(tool);
      const retrieved = registry.get('full-tool');

      expect(retrieved?.name).toBe('full-tool');
      expect(retrieved?.version).toBe('1.0.0');
      expect(retrieved?.parameters).toEqual(tool.parameters);
      expect(retrieved?.authentication).toEqual(tool.authentication);
    });
  });

  describe('get', () => {
    it('should retrieve registered tool', () => {
      const tool = {
        name: 'get-test',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: [],
        },
      };

      registry.register(tool);
      const retrieved = registry.get('get-test');

      expect(retrieved).toBe(tool);
    });

    it('should return undefined for non-existent tool', () => {
      const tool = registry.get('nonexistent');
      expect(tool).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const tool = {
        name: 'CaseTool',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: [],
        },
      };

      registry.register(tool);
      expect(registry.get('CaseTool')).toBeDefined();
      expect(registry.get('casetool')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array for empty registry', () => {
      const tools = registry.getAll();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(0);
    });

    it('should return all registered tools', () => {
      const tool1 = {
        name: 'tool1',
        version: '1.0.0',
        description: 'First',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: [],
        },
      };

      const tool2 = {
        name: 'tool2',
        version: '1.0.0',
        description: 'Second',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: [],
        },
      };

      registry.register(tool1);
      registry.register(tool2);

      const tools = registry.getAll();
      expect(tools.length).toBe(2);
      expect(tools.map((t) => t.name)).toContain('tool1');
      expect(tools.map((t) => t.name)).toContain('tool2');
    });
  });

  describe('clear', () => {
    it('should remove all tools', () => {
      for (let i = 1; i <= 3; i++) {
        registry.register({
          name: `tool${i}`,
          version: '1.0.0',
          description: `Tool ${i}`,
          parameters: {},
          execution: {
            type: 'command' as const,
            command: 'echo',
            args: [],
          },
        });
      }

      expect(registry.getAll().length).toBe(3);

      registry.clear();
      expect(registry.getAll().length).toBe(0);
    });
  });

  describe('count', () => {
    it('should return correct count of tools', () => {
      expect(registry.count()).toBe(0);

      for (let i = 1; i <= 5; i++) {
        registry.register({
          name: `tool${i}`,
          version: '1.0.0',
          description: `Tool ${i}`,
          parameters: {},
          execution: {
            type: 'command' as const,
            command: 'echo',
            args: [],
          },
        });
      }

      expect(registry.count()).toBe(5);
    });

    it('should check if tool exists using has method', () => {
      const tool = {
        name: 'test-has-tool',
        version: '1.0.0',
        description: 'Test tool for has method',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo test',
        },
      };

      expect(registry.has('test-has-tool')).toBe(false);
      registry.register(tool);
      expect(registry.has('test-has-tool')).toBe(true);
      expect(registry.has('nonexistent')).toBe(false);
    });

    it('should search tools by name', () => {
      const tool1 = {
        name: 'search-test-calculator',
        version: '1.0.0',
        description: 'A calculator tool for math',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'calc',
        },
      };

      const tool2 = {
        name: 'search-test-math-helper',
        version: '1.0.0',
        description: 'Helper for calculations',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'helper',
        },
      };

      registry.register(tool1);
      registry.register(tool2);

      // Search by name
      let results = registry.search('calculator');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((t) => t.name === 'search-test-calculator')).toBe(true);

      // Search by description
      results = registry.search('math');
      expect(results.length).toBeGreaterThan(0);

      // Case-insensitive search
      results = registry.search('CALCULATOR');
      expect(results.some((t) => t.name === 'search-test-calculator')).toBe(true);
    });

    it('should get tools by tag', () => {
      const tool1 = {
        name: 'tagged-tool-1',
        version: '1.0.0',
        description: 'Test tool with tags',
        tags: ['search', 'math'],
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'test1',
        },
      };

      const tool2 = {
        name: 'tagged-tool-2',
        version: '1.0.0',
        description: 'Another test tool',
        tags: ['search', 'util'],
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'test2',
        },
      };

      registry.register(tool1);
      registry.register(tool2);

      // Get tools by specific tag
      let taggedTools = registry.getByTag('search');
      expect(taggedTools.length).toBeGreaterThanOrEqual(2);
      expect(taggedTools.some((t) => t.name === 'tagged-tool-1')).toBe(true);
      expect(taggedTools.some((t) => t.name === 'tagged-tool-2')).toBe(true);

      // Get tools by another tag
      taggedTools = registry.getByTag('math');
      expect(taggedTools.some((t) => t.name === 'tagged-tool-1')).toBe(true);

      // Non-existent tag
      taggedTools = registry.getByTag('nonexistent');
      expect(taggedTools.length).toBe(0);
    });

    it('should register multiple tools at once', () => {
      const tools = [
        {
          name: 'batch-tool-1',
          version: '1.0.0',
          description: 'Batch test 1',
          parameters: {},
          execution: {
            type: 'command' as const,
            command: 'cmd1',
          },
        },
        {
          name: 'batch-tool-2',
          version: '1.0.0',
          description: 'Batch test 2',
          parameters: {},
          execution: {
            type: 'command' as const,
            command: 'cmd2',
          },
        },
      ];

      const initialCount = registry.count();
      registry.registerAll(tools);

      expect(registry.count()).toBe(initialCount + 2);
      expect(registry.has('batch-tool-1')).toBe(true);
      expect(registry.has('batch-tool-2')).toBe(true);
    });
  });
});
