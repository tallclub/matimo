import path from 'path';
import fs from 'fs';
import { ToolLoader } from '../../../src/core/tool-loader';
import type { Parameter } from '../../../src/core/types';

describe('Web Tool', () => {
  const coreToolsPath = path.join(__dirname, '../../../tools');
  let toolLoader: ToolLoader;

  beforeAll(() => {
    toolLoader = new ToolLoader();
  });

  describe('Tool Definition', () => {
    it('should have valid web tool definition file', () => {
      const webPath = path.join(coreToolsPath, 'web', 'definition.yaml');
      expect(fs.existsSync(webPath)).toBe(true);
    });

    it('should load web tool with correct metadata', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const webTool = tools.get('web');

      expect(webTool).toBeDefined();
      expect(webTool!.name).toBe('web');
      expect(webTool!.version).toBe('1.0.0');
      expect(webTool!.description).toBeDefined();
    });

    it('should have function-type execution', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const webTool = tools.get('web');

      expect(webTool!.execution.type).toBe('function');
      expect(webTool!.execution).toHaveProperty('code');
      expect((webTool!.execution as Record<string, unknown>).code).toBe('./web.ts');
    });
  });

  describe('Parameters', () => {
    it('should have all required web parameters', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const webTool = tools.get('web')!;

      expect(webTool!.parameters).toBeDefined();
      const params = webTool!.parameters as Record<string, Parameter>;
      expect(params.url).toBeDefined();
      expect(params.method).toBeDefined();
      expect(params.headers).toBeDefined();
      expect(params.body).toBeDefined();
      expect(params.timeout).toBeDefined();
      expect(params.followRedirects).toBeDefined();
      expect(params.parseJson).toBeDefined();
    });
  });

  describe('Output Schema', () => {
    it('should define output schema', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const webTool = tools.get('web')!;

      expect(webTool!.output_schema).toBeDefined();
      expect(webTool!.output_schema!.properties).toBeDefined();
    });

    it('should define content, statusCode, headers and url', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const webTool = tools.get('web')!;

      const props = webTool!.output_schema!.properties as Record<string, unknown>;
      expect(props).toHaveProperty('content');
      expect(props).toHaveProperty('statusCode');
      expect(props).toHaveProperty('headers');
      expect(props).toHaveProperty('url');
    });
  });

  describe('Implementation', () => {
    it('should have implementation file', () => {
      const webImplPath = path.join(coreToolsPath, 'web', 'web.ts');
      expect(fs.existsSync(webImplPath)).toBe(true);
    });

    it('implementation should use axios', () => {
      const webImplPath = path.join(coreToolsPath, 'web', 'web.ts');
      const content = fs.readFileSync(webImplPath, 'utf-8');

      expect(content).toContain('axios');
    });

    it('implementation should export default async function', () => {
      const webImplPath = path.join(coreToolsPath, 'web', 'web.ts');
      const content = fs.readFileSync(webImplPath, 'utf-8');

      expect(content).toContain('export default async function webTool');
    });

    it('implementation should handle JSON content type', () => {
      const webImplPath = path.join(coreToolsPath, 'web', 'web.ts');
      const content = fs.readFileSync(webImplPath, 'utf-8');

      expect(content).toContain('application/json');
    });
  });

  describe('Examples', () => {
    it('should include example in tool definition', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const webTool = tools.get('web')!;

      expect(webTool!.examples).toBeDefined();
      expect(Array.isArray(webTool!.examples)).toBe(true);
      expect((webTool!.examples as Array<unknown>).length).toBeGreaterThan(0);
    });

    it('example should have name and params', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const webTool = tools.get('web')!;

      const example = (webTool!.examples as Array<Record<string, unknown>>)[0] as Record<
        string,
        unknown
      >;
      expect(example.name).toBeDefined();
      expect(example.params).toBeDefined();
      expect((example.params as Record<string, unknown>).url).toBeDefined();
    });
  });
});
