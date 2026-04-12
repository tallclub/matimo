import path from 'path';
import fs from 'fs';
import { ToolLoader } from '../../../src/core/tool-loader';
import type { Parameter } from '../../../src/core/types';

describe('Edit Tool', () => {
  const coreToolsPath = path.join(__dirname, '../../../tools');
  let toolLoader: ToolLoader;

  beforeAll(() => {
    toolLoader = new ToolLoader();
  });

  describe('Tool Definition', () => {
    it('should have valid edit tool definition file', () => {
      const editPath = path.join(coreToolsPath, 'edit', 'definition.yaml');
      expect(fs.existsSync(editPath)).toBe(true);
    });

    it('should load edit tool with correct metadata', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const editTool = tools.get('edit');

      expect(editTool).toBeDefined();
      expect(editTool!.name).toBe('edit');
      expect(editTool!.version).toBe('1.0.0');
      expect(editTool!.description).toBeDefined();
    });

    it('should have function-type execution', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const editTool = tools.get('edit');

      expect(editTool!.execution.type).toBe('function');
      expect(editTool!.execution).toHaveProperty('code');
      expect((editTool!.execution as Record<string, unknown>).code).toBe('./edit.ts');
    });
  });

  describe('Parameters', () => {
    it('should have all required edit parameters', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const editTool = tools.get('edit')!;

      expect(editTool!.parameters).toBeDefined();
      const params = editTool!.parameters as Record<string, Parameter>;
      expect(params.filePath).toBeDefined();
      expect(params.operation).toBeDefined();
      expect(params.startLine).toBeDefined();
      expect(params.endLine).toBeDefined();
      expect(params.content).toBeDefined();
      expect(params.backup).toBeDefined();
    });
  });

  describe('Output Schema', () => {
    it('should define output schema', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const editTool = tools.get('edit')!;

      expect(editTool!.output_schema).toBeDefined();
      expect(editTool!.output_schema!.properties).toBeDefined();
    });

    it('should have success and previousContent fields', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const editTool = tools.get('edit')!;

      const props = editTool!.output_schema!.properties as Record<string, unknown>;
      expect(props).toHaveProperty('success');
      expect(props).toHaveProperty('previousContent');
      expect(props).toHaveProperty('linesAffected');
    });
  });

  describe('Implementation', () => {
    it('should have implementation file', () => {
      const editImplPath = path.join(coreToolsPath, 'edit', 'edit.ts');
      expect(fs.existsSync(editImplPath)).toBe(true);
    });

    it('implementation should use fs.writeFileSync', () => {
      const editImplPath = path.join(coreToolsPath, 'edit', 'edit.ts');
      const content = fs.readFileSync(editImplPath, 'utf-8');

      expect(content).toContain('fs.writeFileSync');
    });

    it('implementation should export default async function', () => {
      const editImplPath = path.join(coreToolsPath, 'edit', 'edit.ts');
      const content = fs.readFileSync(editImplPath, 'utf-8');

      expect(content).toContain('export default async function editTool');
    });

    it('implementation should support backup functionality', () => {
      const editImplPath = path.join(coreToolsPath, 'edit', 'edit.ts');
      const content = fs.readFileSync(editImplPath, 'utf-8');

      expect(content).toContain('backup');
    });
  });

  describe('Examples', () => {
    it('should include example in tool definition', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const editTool = tools.get('edit')!;

      expect(editTool!.examples).toBeDefined();
      expect(Array.isArray(editTool!.examples)).toBe(true);
      expect((editTool!.examples as Array<unknown>).length).toBeGreaterThan(0);
    });

    it('example should have name and params', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const editTool = tools.get('edit')!;

      const example = (editTool!.examples as Array<Record<string, unknown>>)[0] as Record<
        string,
        unknown
      >;
      expect(example.name).toBeDefined();
      expect(example.params).toBeDefined();
      const exampleParams = example.params as Record<string, unknown>;
      expect(exampleParams.filePath).toBeDefined();
      expect(exampleParams.operation).toBeDefined();
    });
  });
});
