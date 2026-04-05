import { matimo, MatimoInstance } from '../../src/matimo-instance';
import * as path from 'path';

describe('Matimo Factory Pattern', () => {
  let matimoInstance: MatimoInstance;
  const coreToolsDir = path.join(__dirname, '../../tools');

  beforeAll(async () => {
    matimoInstance = await matimo.init(coreToolsDir);
  });

  describe('Initialization', () => {
    it('should initialize matimo with tools directory', async () => {
      expect(matimoInstance).toBeDefined();
    });

    it('should load tools on initialization', () => {
      const tools = matimoInstance.listTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some((t) => t.name === 'calculator')).toBe(true);
    });
  });

  describe('Tool Discovery', () => {
    it('should list all tools', () => {
      const tools = matimoInstance.listTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should get tool by name', () => {
      const calculator = matimoInstance.getTool('calculator');
      expect(calculator).toBeDefined();
      expect(calculator?.name).toBe('calculator');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = matimoInstance.getTool('nonexistent');
      expect(tool).toBeUndefined();
    });

    it('should search tools by query', () => {
      const results = matimoInstance.searchTools('calculator');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('calculator');
    });

    it('should get tools by tag', () => {
      const mathTools = matimoInstance.getToolsByTag('math');
      expect(Array.isArray(mathTools)).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool by name', async () => {
      const result = (await matimoInstance.execute('calculator', {
        operation: 'add',
        a: 5,
        b: 3,
      })) as Record<string, unknown>;

      expect(result).toBeDefined();
      expect(result.result).toBe(8);
      expect(result.operation).toBe('add');
    });

    it('should throw error for non-existent tool', async () => {
      await expect(matimoInstance.execute('nonexistent-tool', {})).rejects.toThrow();
    });
  });

  describe('Matimo Namespace', () => {
    it('should export matimo namespace', () => {
      expect(matimo).toBeDefined();
      expect(matimo.init).toBeDefined();
    });

    it('should create instance via matimo.init', async () => {
      const instance = await matimo.init(coreToolsDir);
      expect(instance).toBeDefined();
      expect(instance.listTools()).toHaveLength(matimoInstance.listTools().length);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when tool has unsupported execution type', async () => {
      // Create a malformed tool with unsupported execution type
      const malformedTool = {
        name: 'bad-tool-' + Date.now(),
        version: '1.0.0',
        description: 'Tool with unsupported execution type',
        parameters: {},
        execution: {
          type: 'unsupported-type', // Not 'command' or 'http'
          command: 'echo test',
        },
      };

      // Manually register to internal registry and try to get executor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (matimoInstance as any).registry.register(malformedTool);

      // Try to execute - should throw error about unsupported execution type
      await expect(matimoInstance.execute(malformedTool.name, {})).rejects.toThrow(
        'Unsupported execution type'
      );
    });
  });
});
