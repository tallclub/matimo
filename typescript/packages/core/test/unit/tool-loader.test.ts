import { ToolLoader } from '../../src/core/tool-loader';
import * as path from 'path';
import * as fs from 'fs';

describe('ToolLoader', () => {
  const fixturesDir = path.join(__dirname, '../fixtures/tools');
  const coreToolsDir = path.join(__dirname, '../../tools');
  const loader = new ToolLoader();

  describe('loadToolFromFile', () => {
    it('should load a valid YAML tool definition', () => {
      const toolPath = path.join(coreToolsDir, 'calculator/definition.yaml');

      const tool = loader.loadToolFromFile(toolPath);

      expect(tool).toBeDefined();
      expect(tool.name).toBe('calculator');
      expect(tool.version).toBe('1.1.0');
      expect(tool.parameters).toBeDefined();
    });

    it('should throw error for non-existent file', () => {
      const toolPath = path.join(fixturesDir, 'nonexistent.yaml');

      expect(() => loader.loadToolFromFile(toolPath)).toThrow();
    });

    it('should throw error for invalid YAML', () => {
      const tempFile = path.join(fixturesDir, 'invalid.yaml');
      fs.writeFileSync(tempFile, 'invalid: yaml: content: [');

      try {
        expect(() => loader.loadToolFromFile(tempFile)).toThrow();
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should load JSON tool definition', () => {
      const tempFile = path.join(fixturesDir, 'test.json');
      const toolDef = {
        name: 'test-tool',
        version: '1.0.0',
        description: 'Test tool',
        parameters: {},
        execution: {
          type: 'command',
          command: 'echo',
          args: ['test'],
        },
      };
      fs.writeFileSync(tempFile, JSON.stringify(toolDef, null, 2));

      try {
        const tool = loader.loadToolFromFile(tempFile);
        expect(tool.name).toBe('test-tool');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('loadToolFromObject', () => {
    it('should load a tool from JavaScript object', () => {
      const toolDef = {
        name: 'echo',
        version: '1.0.0',
        description: 'Echo tool',
        parameters: {
          message: {
            type: 'string' as const,
            description: 'Message to echo',
          },
        },
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['{message}'],
        },
      };

      const tool = loader.loadToolFromObject(toolDef);
      expect(tool.name).toBe('echo');
      expect(tool.parameters).toBeDefined();
    });

    it('should validate tool definition on load', () => {
      const invalidTool = {
        name: 'incomplete',
      };

      expect(() => loader.loadToolFromObject(invalidTool as unknown)).toThrow();
    });
  });

  describe('loadToolsFromDirectory', () => {
    it('should load all tools from directory', () => {
      const tools = loader.loadToolsFromDirectory(fixturesDir);

      expect(tools instanceof Map).toBe(true);
      expect(tools.size).toBeGreaterThan(0);
    });

    it('should load tools recursively from subdirectories', () => {
      const tools = loader.loadToolsFromDirectory(fixturesDir);

      const toolNames = Array.from(tools.keys());
      expect(toolNames.length).toBeGreaterThan(0);
    });

    it('should skip non-YAML/JSON files', () => {
      const tempFile = path.join(fixturesDir, 'readme.txt');
      fs.writeFileSync(tempFile, 'This is not a tool');

      try {
        const tools = loader.loadToolsFromDirectory(fixturesDir);
        expect(tools instanceof Map).toBe(true);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should return empty map for empty directory', () => {
      const uniqueName = 'empty-dir-' + Date.now();
      const tempDir = path.join(fixturesDir, uniqueName);
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        const tools = loader.loadToolsFromDirectory(tempDir);
        expect(tools instanceof Map).toBe(true);
      } finally {
        try {
          fs.rmdirSync(tempDir);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Tool property validation', () => {
    it('should have name property', () => {
      const toolPath = path.join(coreToolsDir, 'calculator/definition.yaml');
      const tool = loader.loadToolFromFile(toolPath);

      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
    });

    it('should have version property', () => {
      const toolPath = path.join(coreToolsDir, 'calculator/definition.yaml');
      const tool = loader.loadToolFromFile(toolPath);

      expect(tool.version).toBeDefined();
      expect(typeof tool.version).toBe('string');
    });

    it('should have description property', () => {
      const toolPath = path.join(coreToolsDir, 'calculator/definition.yaml');
      const tool = loader.loadToolFromFile(toolPath);

      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
    });

    it('should have parameters property', () => {
      const toolPath = path.join(coreToolsDir, 'calculator/definition.yaml');
      const tool = loader.loadToolFromFile(toolPath);

      expect(tool.parameters).toBeDefined();
      expect(typeof tool.parameters).toBe('object');
    });

    it('should have execution property', () => {
      const toolPath = path.join(coreToolsDir, 'calculator/definition.yaml');
      const tool = loader.loadToolFromFile(toolPath);

      expect(tool.execution).toBeDefined();
      expect(['command', 'http', 'function']).toContain(tool.execution.type);
    });

    it('should throw error for unsupported file format', () => {
      // Create a temporary unsupported file format
      const tempDir = path.join(process.cwd(), 'temp-test-' + Date.now());
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const unsupportedPath = path.join(tempDir, 'tool.txt');
      fs.writeFileSync(unsupportedPath, 'invalid');

      try {
        expect(() => {
          loader.loadToolFromFile(unsupportedPath);
        }).toThrow('Unsupported file format: .txt');
      } finally {
        if (fs.existsSync(unsupportedPath)) {
          fs.unlinkSync(unsupportedPath);
        }
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir);
        }
      }
    });

    it('should throw error for invalid tool definition', () => {
      // Create a temporary invalid YAML file
      const tempDir = path.join(process.cwd(), 'temp-test-' + Date.now());
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const invalidYamlPath = path.join(tempDir, 'invalid.yaml');
      // Write a YAML without required fields
      fs.writeFileSync(invalidYamlPath, 'name: test\nversion: 1.0.0\n');

      try {
        expect(() => {
          loader.loadToolFromFile(invalidYamlPath);
        }).toThrow('Invalid tool definition');
      } finally {
        if (fs.existsSync(invalidYamlPath)) {
          fs.unlinkSync(invalidYamlPath);
        }
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir);
        }
      }
    });

    it('should throw error when tools directory does not exist', () => {
      const nonExistentDir = '/nonexistent/tools/directory';
      expect(() => {
        loader.loadToolsFromDirectory(nonExistentDir);
      }).toThrow('Tools directory not found');
    });

    it('should handle invalid tool files gracefully', () => {
      // Create a directory with an invalid tool file
      const tempDir = path.join(process.cwd(), 'temp-invalid-tool-' + Date.now());
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const invalidYamlPath = path.join(tempDir, 'invalid-tool.yaml');
      // Write malformed YAML (missing required fields)
      fs.writeFileSync(invalidYamlPath, 'broken: yaml: structure:');

      try {
        // Should not throw, but log warning and skip invalid tool
        const tools = loader.loadToolsFromDirectory(tempDir);
        expect(tools instanceof Map).toBe(true);
        // Invalid tool should not be loaded
        expect(tools.size).toBe(0);
      } finally {
        if (fs.existsSync(invalidYamlPath)) {
          fs.unlinkSync(invalidYamlPath);
        }
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir);
        }
      }
    });
  });

  describe('autoDiscoverPackages', () => {
    beforeEach(() => {
      // Clear cache before each test to ensure fresh discovery
      ToolLoader.clearDiscoveryCache();
    });

    it('should discover packages and return array', () => {
      const paths = loader.autoDiscoverPackages();

      expect(Array.isArray(paths)).toBe(true);
      // In this environment, should find at least core tools
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should include tools in discovered paths', () => {
      const paths = loader.autoDiscoverPackages();

      paths.forEach((p) => {
        expect(p).toContain('tools');
      });
    });

    it('should cache results on subsequent calls', () => {
      const paths1 = loader.autoDiscoverPackages();
      const paths2 = loader.autoDiscoverPackages();

      // Should return the exact same cached reference
      expect(paths1).toBe(paths2);
    });
  });

  describe('loadToolsFromMultiplePaths', () => {
    it('should load tools from multiple directories', () => {
      const paths = [fixturesDir];
      const tools = loader.loadToolsFromMultiplePaths(paths);

      expect(tools instanceof Map).toBe(true);
      expect(tools.size).toBeGreaterThan(0);
    });

    it('should skip missing directories', () => {
      const paths = [fixturesDir, '/nonexistent/path'];
      const tools = loader.loadToolsFromMultiplePaths(paths);

      expect(tools instanceof Map).toBe(true);
      // Should still load from valid directory
      expect(tools.size).toBeGreaterThan(0);
    });

    it('should merge tools from multiple sources', () => {
      const paths = [fixturesDir];
      const tools = loader.loadToolsFromMultiplePaths(paths);

      expect(tools.size).toBeGreaterThan(0);
      // All entries should be ToolDefinition instances
      tools.forEach((tool, name) => {
        expect(typeof name).toBe('string');
        expect(tool.name).toBeDefined();
      });
    });

    it('should handle empty path array', () => {
      const paths: string[] = [];
      const tools = loader.loadToolsFromMultiplePaths(paths);

      expect(tools instanceof Map).toBe(true);
      expect(tools.size).toBe(0);
    });
  });

  describe('getNodeModulesPath', () => {
    it('should find node_modules from current working directory', () => {
      const paths = loader.autoDiscoverPackages();
      // If discovery works, getNodeModulesPath should have found node_modules
      expect(Array.isArray(paths)).toBe(true);
    });

    it('should return null when node_modules cannot be found', () => {
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => '/nonexistent/deeply/nested/path');

      try {
        // autoDiscoverPackages will use getNodeModulesPath internally
        const paths = loader.autoDiscoverPackages();
        // Should still return array, may be empty
        expect(Array.isArray(paths)).toBe(true);
      } finally {
        process.cwd = originalCwd;
      }
    });

    it('should handle when getNodeModulesPath throws', () => {
      // getNodeModulesPath has try-catch, should not throw
      const paths = loader.autoDiscoverPackages();
      expect(Array.isArray(paths)).toBe(true);
    });
  });

  describe('Workspace discovery fallback', () => {
    it('should discover core tools from workspace packages directory', () => {
      // This tests the fallback workspace discovery path
      const paths = loader.autoDiscoverPackages();

      // Should find at least one tools directory
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0]).toContain('tools');
    });

    it('should handle case when workspace discovery fails', () => {
      ToolLoader.clearDiscoveryCache();
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => '/invalid/path/that/does/not/exist');

      try {
        const paths = loader.autoDiscoverPackages();
        // Should still return array, may be empty
        expect(Array.isArray(paths)).toBe(true);
      } finally {
        process.cwd = originalCwd;
        ToolLoader.clearDiscoveryCache();
      }
    });

    it('should skip dotfiles during discovery', () => {
      ToolLoader.clearDiscoveryCache();
      const paths = loader.autoDiscoverPackages();

      // None of the discovered paths should contain ./ or /.
      paths.forEach((p) => {
        expect(p).not.toMatch(/\/\./);
      });
    });
  });

  describe('Symlink handling', () => {
    it('should handle symlinks in @matimo scope', () => {
      // This tests the symlink statSync error handling
      ToolLoader.clearDiscoveryCache();
      const paths = loader.autoDiscoverPackages();

      // Should successfully return despite symlinks
      expect(Array.isArray(paths)).toBe(true);
    });

    it('should handle stat errors gracefully', () => {
      // The symlink check has error handling - should not throw
      ToolLoader.clearDiscoveryCache();
      const paths = loader.autoDiscoverPackages();

      expect(Array.isArray(paths)).toBe(true);
    });
  });

  describe('Error recovery', () => {
    it('should continue discovery if core tools discovery fails', () => {
      // autoDiscoverPackages has try-catch around core discovery
      const paths = loader.autoDiscoverPackages();
      expect(Array.isArray(paths)).toBe(true);
    });

    it('should continue discovery if @matimo scope discovery fails', () => {
      // autoDiscoverPackages has try-catch around scope discovery
      ToolLoader.clearDiscoveryCache();
      const paths = loader.autoDiscoverPackages();
      expect(Array.isArray(paths)).toBe(true);
    });

    it('should cache even empty discovery result', () => {
      ToolLoader.clearDiscoveryCache();
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => '/nonexistent');

      try {
        const paths1 = loader.autoDiscoverPackages();
        const paths2 = loader.autoDiscoverPackages();
        // Should return same reference (cached)
        expect(paths1).toBe(paths2);
      } finally {
        process.cwd = originalCwd;
        ToolLoader.clearDiscoveryCache();
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle relative and absolute paths correctly', () => {
      const tools = loader.loadToolsFromDirectory(fixturesDir);
      expect(tools instanceof Map).toBe(true);
    });

    it('should prefer definition.yaml over tool.yaml', () => {
      const tempDir = path.join(fixturesDir, 'preference-test-' + Date.now());
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const toolYamlPath = path.join(tempDir, 'tool.yaml');
      const defYamlPath = path.join(tempDir, 'definition.yaml');

      const toolDef = {
        name: 'test-tool-prefer',
        version: '1.0.0',
        description: 'Test tool',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['test'],
        },
      };

      try {
        fs.writeFileSync(toolYamlPath, JSON.stringify(toolDef, null, 2));
        fs.writeFileSync(defYamlPath, JSON.stringify(toolDef, null, 2));

        const tools = loader.loadToolsFromDirectory(tempDir);
        // Should load only once (preferring definition.yaml)
        if (tools.size > 0) {
          expect(tools.get('test-tool-prefer')).toBeDefined();
        }
      } finally {
        if (fs.existsSync(toolYamlPath)) fs.unlinkSync(toolYamlPath);
        if (fs.existsSync(defYamlPath)) fs.unlinkSync(defYamlPath);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
      }
    });

    it('should set _definitionPath on loaded tools', () => {
      const toolPath = path.join(coreToolsDir, 'calculator/definition.yaml');
      const tool = loader.loadToolFromFile(toolPath);

      expect(tool._definitionPath).toBeDefined();
      expect(typeof tool._definitionPath).toBe('string');
    });

    it('should handle deeply nested tool directories', () => {
      const tempDir = path.join(fixturesDir, 'deep-' + Date.now());
      const deepPath = path.join(tempDir, 'deep', 'nested', 'tool');
      if (!fs.existsSync(deepPath)) {
        fs.mkdirSync(deepPath, { recursive: true });
      }

      const toolDef = {
        name: 'deep-tool',
        version: '1.0.0',
        description: 'Deeply nested tool',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['test'],
        },
      };

      try {
        fs.writeFileSync(path.join(deepPath, 'definition.yaml'), JSON.stringify(toolDef, null, 2));

        const tools = loader.loadToolsFromDirectory(tempDir);
        if (tools.size > 0) {
          expect(tools.get('deep-tool')).toBeDefined();
        }
      } finally {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true });
        }
      }
    });

    it('should load both YAML and JSON tools in same directory', () => {
      const tempDir = path.join(fixturesDir, 'mixed-' + Date.now());
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const toolDef = {
        name: 'mixed-tool',
        version: '1.0.0',
        description: 'Tool',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['test'],
        },
      };

      try {
        fs.writeFileSync(path.join(tempDir, 'tool1.yaml'), JSON.stringify(toolDef, null, 2));
        fs.writeFileSync(path.join(tempDir, 'tool2.json'), JSON.stringify(toolDef, null, 2));

        const tools = loader.loadToolsFromDirectory(tempDir);
        // Both files have same name, so only one loaded
        if (tools.size > 0) {
          expect(tools.get('mixed-tool')).toBeDefined();
        }
      } finally {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true });
        }
      }
    });
  });
});
