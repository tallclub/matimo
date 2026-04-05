import path from 'path';
import fs from 'fs';
import { ToolLoader } from '../../../src/core/tool-loader';
import type { Parameter } from '../../../src/core/types';

describe('Read Tool', () => {
  const coreToolsPath = path.join(__dirname, '../../../tools');
  let toolLoader: ToolLoader;

  beforeAll(() => {
    toolLoader = new ToolLoader();
  });

  describe('Tool Definition', () => {
    it('should have valid read tool definition file', () => {
      const readPath = path.join(coreToolsPath, 'read', 'definition.yaml');
      expect(fs.existsSync(readPath)).toBe(true);
    });

    it('should load read tool with correct metadata', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const readTool = tools.get('read');

      expect(readTool).toBeDefined();
      expect(readTool!.name).toBe('read');
      expect(readTool!.version).toBe('1.0.0');
      expect(readTool!.description).toBeDefined();
    });

    it('should have function-type execution', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const readTool = tools.get('read');

      expect(readTool!.execution.type).toBe('function');
      expect(readTool!.execution).toHaveProperty('code');
      expect((readTool!.execution as Record<string, unknown>).code).toBe('./read.ts');
    });
  });

  describe('Parameters', () => {
    it('should have all required read parameters', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const readTool = tools.get('read')!;

      expect(readTool!.parameters).toBeDefined();
      const params = readTool!.parameters as Record<string, Parameter>;
      expect(params.filePath).toBeDefined();
      expect(params.startLine).toBeDefined();
      expect(params.endLine).toBeDefined();
      expect(params.encoding).toBeDefined();
    });
  });

  describe('Output Schema', () => {
    it('should define output schema', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const readTool = tools.get('read')!;

      expect(readTool!.output_schema).toBeDefined();
      expect(readTool!.output_schema!.properties).toBeDefined();
    });

    it('should define content, filePath and lineCount in output schema', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const readTool = tools.get('read')!;

      const props = readTool!.output_schema!.properties as Record<string, unknown>;
      expect(props).toHaveProperty('content');
      expect(props).toHaveProperty('filePath');
      expect(props).toHaveProperty('lineCount');
    });
  });

  describe('Implementation', () => {
    it('should have implementation file', () => {
      const readImplPath = path.join(coreToolsPath, 'read', 'read.ts');
      expect(fs.existsSync(readImplPath)).toBe(true);
    });

    it('implementation should use fs.readFileSync', () => {
      const readImplPath = path.join(coreToolsPath, 'read', 'read.ts');
      const content = fs.readFileSync(readImplPath, 'utf-8');

      expect(content).toContain('fs.readFileSync');
    });

    it('implementation should export default async function', () => {
      const readImplPath = path.join(coreToolsPath, 'read', 'read.ts');
      const content = fs.readFileSync(readImplPath, 'utf-8');

      expect(content).toContain('export default async function readTool');
    });

    it('implementation should handle BufferEncoding', () => {
      const readImplPath = path.join(coreToolsPath, 'read', 'read.ts');
      const content = fs.readFileSync(readImplPath, 'utf-8');

      expect(content).toContain('BufferEncoding');
    });
  });

  describe('Examples', () => {
    it('should include example in tool definition', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const readTool = tools.get('read')!;

      expect(readTool!.examples).toBeDefined();
      expect(Array.isArray(readTool!.examples)).toBe(true);
      expect((readTool!.examples as Array<unknown>).length).toBeGreaterThan(0);
    });

    it('example should have name and params', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const readTool = tools.get('read')!;

      const example = (readTool!.examples as Array<Record<string, unknown>>)[0] as Record<
        string,
        unknown
      >;
      expect(example.name).toBeDefined();
      expect(example.params).toBeDefined();
      expect((example.params as Record<string, unknown>).filePath).toBeDefined();
    });
  });
});
