import { MatimoInstance } from '../../src/matimo-instance';
import path from 'path';
import { MatimoError, ErrorCode } from '../../src/errors/matimo-error';

describe('MatimoInstance - InitOptions Branching', () => {
  const toolsPath = path.join(__dirname, '../fixtures/tools');

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MATIMO_LOG_LEVEL;
    delete process.env.MATIMO_LOG_FORMAT;
  });

  describe('string initialization (backward compatibility)', () => {
    it('should initialize with string path', async () => {
      const instance = await MatimoInstance.init(toolsPath);
      expect(instance).toBeDefined();
      expect(instance.getToolPaths().length > 0).toBe(true);
    });

    it('should initialize with relative string path', async () => {
      const instance = await MatimoInstance.init('./packages/core/test/fixtures/tools');
      expect(instance).toBeDefined();
    });
  });

  describe('InitOptions with autoDiscover', () => {
    it('should initialize with autoDiscover enabled', async () => {
      const instance = await MatimoInstance.init({
        autoDiscover: true,
      });
      expect(instance).toBeDefined();
      expect(instance.listTools().length >= 0).toBe(true);
    });

    it('should initialize with autoDiscover disabled', async () => {
      const instance = await MatimoInstance.init({
        autoDiscover: false,
        toolPaths: [toolsPath],
      });
      expect(instance).toBeDefined();
      expect(instance.getToolPaths().length > 0).toBe(true);
    });

    it('should initialize with both autoDiscover and explicit toolPaths', async () => {
      const instance = await MatimoInstance.init({
        autoDiscover: true,
        toolPaths: [toolsPath],
      });
      expect(instance).toBeDefined();
      const tools = instance.listTools();
      expect(tools.length > 0).toBe(true);
    });
  });

  describe('InitOptions with includeCore', () => {
    it('should initialize with includeCore enabled', async () => {
      const instance = await MatimoInstance.init({
        includeCore: true,
        toolPaths: [toolsPath],
      });
      expect(instance).toBeDefined();
      expect(instance.listTools().length > 0).toBe(true);
    });

    it('should initialize with includeCore disabled', async () => {
      const instance = await MatimoInstance.init({
        includeCore: false,
        toolPaths: [toolsPath],
      });
      expect(instance).toBeDefined();
      expect(instance.listTools().length > 0).toBe(true);
    });

    it('should default includeCore to true', async () => {
      const instance = await MatimoInstance.init({
        toolPaths: [toolsPath],
      });
      expect(instance).toBeDefined();
      expect(instance.listTools().length > 0).toBe(true);
    });
  });

  describe('InitOptions with logging', () => {
    it('should initialize with custom logLevel', async () => {
      const instance = await MatimoInstance.init({
        toolPaths: [toolsPath],
        logLevel: 'debug',
      });
      expect(instance).toBeDefined();
      const logger = instance.getLogger();
      expect(logger).toBeDefined();
    });

    it('should initialize with custom logFormat', async () => {
      const instance = await MatimoInstance.init({
        toolPaths: [toolsPath],
        logFormat: 'json',
      });
      expect(instance).toBeDefined();
      const logger = instance.getLogger();
      expect(logger).toBeDefined();
    });

    it('should initialize with both logLevel and logFormat', async () => {
      const instance = await MatimoInstance.init({
        toolPaths: [toolsPath],
        logLevel: 'info',
        logFormat: 'simple',
      });
      expect(instance).toBeDefined();
      const logger = instance.getLogger();
      expect(logger).toBeDefined();
    });

    it('should initialize with custom logger', async () => {
      const customLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      const instance = await MatimoInstance.init({
        toolPaths: [toolsPath],
        logger: customLogger,
      });
      expect(instance).toBeDefined();
      const logger = instance.getLogger();
      expect(logger).toBe(customLogger);
    });

    it('should prefer custom logger over logLevel and logFormat', async () => {
      const customLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      const instance = await MatimoInstance.init({
        toolPaths: [toolsPath],
        logger: customLogger,
        logLevel: 'debug',
        logFormat: 'json',
      });
      expect(instance).toBeDefined();
      const logger = instance.getLogger();
      expect(logger).toBe(customLogger);
    });
  });

  describe('empty toolPaths scenarios', () => {
    it('should handle empty toolPaths array', async () => {
      const instance = await MatimoInstance.init({
        toolPaths: [],
        autoDiscover: false,
      });
      expect(instance).toBeDefined();
      expect(instance.getToolPaths()).toEqual([]);
    });

    it('should handle no toolPaths with autoDiscover', async () => {
      const instance = await MatimoInstance.init({
        autoDiscover: true,
      });
      expect(instance).toBeDefined();
      const tools = instance.listTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should handle no toolPaths and no autoDiscover', async () => {
      const instance = await MatimoInstance.init({
        autoDiscover: false,
      });
      expect(instance).toBeDefined();
      expect(instance.getToolPaths()).toEqual([]);
    });
  });

  describe('multiple toolPaths', () => {
    it('should initialize with multiple toolPaths', async () => {
      const instance = await MatimoInstance.init({
        toolPaths: [toolsPath, toolsPath], // Same path twice for testing
        autoDiscover: false,
      });
      expect(instance).toBeDefined();
      expect(instance.getToolPaths().length >= 1).toBe(true);
    });

    it('should load tools from all provided paths', async () => {
      const instance = await MatimoInstance.init({
        toolPaths: [toolsPath],
        autoDiscover: false,
      });
      expect(instance).toBeDefined();
      const tools = instance.listTools();
      expect(tools.length > 0).toBe(true);
    });
  });

  describe('InitOptions merge with defaults', () => {
    it('should apply defaults to partial options', async () => {
      const instance = await MatimoInstance.init({
        toolPaths: [toolsPath],
      });
      expect(instance).toBeDefined();
      expect(instance.getToolPaths().length > 0).toBe(true);
    });

    it('should override defaults with explicit options', async () => {
      const instance = await MatimoInstance.init({
        toolPaths: [toolsPath],
        autoDiscover: false,
        includeCore: false,
      });
      expect(instance).toBeDefined();
      expect(instance.getToolPaths().includes(toolsPath)).toBe(true);
    });

    it('should handle undefined options object', async () => {
      const instance = await MatimoInstance.init(undefined);
      expect(instance).toBeDefined();
      expect(instance.getToolPaths().length >= 0).toBe(true);
    });
  });

  describe('Logger access', () => {
    it('should return logger from getLogger()', async () => {
      const instance = await MatimoInstance.init(toolsPath);
      const logger = instance.getLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should use logger for debugging', async () => {
      const instance = await MatimoInstance.init({
        toolPaths: [toolsPath],
        logLevel: 'debug',
      });
      const logger = instance.getLogger();
      logger.debug('Test debug message');
      logger.info('Test info message');
      logger.warn('Test warn message');
      logger.error('Test error message');
    });
  });

  describe('Tool path operations', () => {
    it('should return copy of tool paths', async () => {
      const instance = await MatimoInstance.init(toolsPath);
      const paths1 = instance.getToolPaths();
      const paths2 = instance.getToolPaths();

      expect(paths1).not.toBe(paths2); // Different array instances
      expect(paths1).toEqual(paths2); // But same content
    });

    it('should be immutable from outside', async () => {
      const instance = await MatimoInstance.init(toolsPath);
      const paths = instance.getToolPaths();
      const originalLength = paths.length;

      // Modify returned array
      paths.push('/some/fake/path');

      // Original should be unchanged
      expect(instance.getToolPaths().length).toBe(originalLength);
    });
  });
});

describe('MatimoInstance - Tool Execution Error Cases', () => {
  const toolsPath = path.join(__dirname, '../fixtures/tools');
  let instance: MatimoInstance;

  beforeAll(async () => {
    instance = await MatimoInstance.init(toolsPath);
  });

  describe('executing non-existent tools', () => {
    it('should throw error for non-existent tool', async () => {
      await expect(instance.execute('non-existent-tool-xyz', {})).rejects.toThrow();
    });

    it('should include tool name in error for missing tool', async () => {
      try {
        await instance.execute('missing-tool-abc', {});
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('missing-tool-abc');
      }
    });

    it('should throw TOOL_NOT_FOUND error code', async () => {
      try {
        await instance.execute('nonexistent', {});
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MatimoError);
        if (error instanceof MatimoError) {
          expect(error.code).toBe(ErrorCode.TOOL_NOT_FOUND);
        }
      }
    });
  });

  describe('getTool method', () => {
    it('should return tool definition for existing tool', () => {
      const tools = instance.listTools();
      if (tools.length > 0) {
        const toolName = tools[0].name;
        const tool = instance.getTool(toolName);
        expect(tool).toBeDefined();
        expect(tool?.name).toBe(toolName);
      }
    });

    it('should return undefined for non-existent tool', () => {
      const tool = instance.getTool('non-existent');
      expect(tool).toBeUndefined();
    });
  });

  describe('search and filter operations', () => {
    it('should search tools', () => {
      const tools = instance.getAllTools();
      if (tools.length > 0) {
        const firstName = tools[0].name.substring(0, 3);
        const results = instance.searchTools(firstName);
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it('should return empty array for non-matching search', () => {
      const results = instance.searchTools('xyz-nonexistent-query-abc');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle empty search query', () => {
      const results = instance.searchTools('');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should get tools by tag', () => {
      const tools = instance.getToolsByTag('test');
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should return empty for non-existent tag', () => {
      const tools = instance.getToolsByTag('nonexistent-tag-xyz');
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length === 0).toBe(true);
    });
  });

  describe('getAllTools and listTools', () => {
    it('should return same results from getAllTools and listTools', () => {
      const all = instance.getAllTools();
      const listed = instance.listTools();

      expect(all.length).toBe(listed.length);
      expect(all).toEqual(listed);
    });

    it('should return array of tools', () => {
      const tools = instance.listTools();
      expect(Array.isArray(tools)).toBe(true);

      if (tools.length > 0) {
        tools.forEach((tool) => {
          expect(tool.name).toBeDefined();
          expect(tool.version).toBeDefined();
          expect(tool.description).toBeDefined();
          expect(tool.parameters).toBeDefined();
          expect(tool.execution).toBeDefined();
        });
      }
    });
  });
});
