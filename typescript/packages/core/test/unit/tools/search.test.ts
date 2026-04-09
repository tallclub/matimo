import path from 'path';
import fs from 'fs';
import { ToolLoader } from '../../../src/core/tool-loader';
import type { Parameter } from '../../../src/core/types';

describe('Search Tool', () => {
  const coreToolsPath = path.join(__dirname, '../../../tools');
  let toolLoader: ToolLoader;

  beforeAll(() => {
    toolLoader = new ToolLoader();
  });

  describe('Tool Definition', () => {
    it('should have valid search tool definition file', () => {
      const searchPath = path.join(coreToolsPath, 'search', 'definition.yaml');
      expect(fs.existsSync(searchPath)).toBe(true);
    });

    it('should load search tool with correct metadata', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const searchTool = tools.get('search');

      expect(searchTool).toBeDefined();
      expect(searchTool!.name).toBe('search');
      expect(searchTool!.version).toBe('1.0.0');
      expect(searchTool!.description).toBeDefined();
    });

    it('should have function-type execution', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const searchTool = tools.get('search');

      expect(searchTool!.execution.type).toBe('function');
      expect(searchTool!.execution).toHaveProperty('code');
      expect((searchTool!.execution as Record<string, unknown>).code).toBe('./search.ts');
    });
  });

  describe('Parameters', () => {
    it('should have all required search parameters', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const searchTool = tools.get('search')!;

      expect(searchTool!.parameters).toBeDefined();
      const params = searchTool!.parameters as Record<string, Parameter>;
      expect(params.query).toBeDefined();
      expect(params.directory).toBeDefined();
      expect(params.filePattern).toBeDefined();
      expect(params.isRegex).toBeDefined();
      expect(params.caseSensitive).toBeDefined();
      expect(params.maxResults).toBeDefined();
    });
  });

  describe('Output Schema', () => {
    it('should define output schema', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const searchTool = tools.get('search')!;

      expect(searchTool!.output_schema).toBeDefined();
      expect(searchTool!.output_schema!.properties).toBeDefined();
    });

    it('should have matches and totalMatches fields', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const searchTool = tools.get('search')!;

      const props = searchTool!.output_schema!.properties as Record<string, unknown>;
      expect(props).toHaveProperty('matches');
      expect(props).toHaveProperty('totalMatches');
    });
  });

  describe('Implementation', () => {
    it('should have implementation file', () => {
      const searchImplPath = path.join(coreToolsPath, 'search', 'search.ts');
      expect(fs.existsSync(searchImplPath)).toBe(true);
    });

    it('implementation should use glob library', () => {
      const searchImplPath = path.join(coreToolsPath, 'search', 'search.ts');
      const content = fs.readFileSync(searchImplPath, 'utf-8');

      expect(content).toContain('glob');
    });

    it('implementation should use fs.readFileSync', () => {
      const searchImplPath = path.join(coreToolsPath, 'search', 'search.ts');
      const content = fs.readFileSync(searchImplPath, 'utf-8');

      expect(content).toContain('fs.readFileSync');
    });

    it('implementation should export default async function', () => {
      const searchImplPath = path.join(coreToolsPath, 'search', 'search.ts');
      const content = fs.readFileSync(searchImplPath, 'utf-8');

      expect(content).toContain('export default async function searchTool');
    });

    it('implementation should support regex matching', () => {
      const searchImplPath = path.join(coreToolsPath, 'search', 'search.ts');
      const content = fs.readFileSync(searchImplPath, 'utf-8');

      expect(content).toContain('RegExp');
    });
  });

  describe('Examples', () => {
    it('should include example in tool definition', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const searchTool = tools.get('search')!;

      expect(searchTool!.examples).toBeDefined();
      expect(Array.isArray(searchTool!.examples)).toBe(true);
      expect((searchTool!.examples as Array<unknown>).length).toBeGreaterThan(0);
    });

    it('example should have name and params', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const searchTool = tools.get('search')!;

      const example = (searchTool!.examples as Array<Record<string, unknown>>)[0] as Record<
        string,
        unknown
      >;
      expect(example.name).toBeDefined();
      expect(example.params).toBeDefined();
      expect((example.params as Record<string, unknown>).query).toBeDefined();
    });
  });
});
