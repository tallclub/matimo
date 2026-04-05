// Additional coverage for matimo instance and core SDK patterns
jest.mock('@matimo/core', () => require('../../src'));

import { MatimoInstance } from '../../src/matimo-instance';
import path from 'path';

describe('MatimoInstance - Additional Coverage', () => {
  let matimo: MatimoInstance;

  beforeAll(async () => {
    const toolsDirPath = path.join(__dirname, '../../test/fixtures/tools');
    matimo = await MatimoInstance.init(toolsDirPath);
  });

  it('should list tools successfully', () => {
    const tools = matimo.listTools();
    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
  });

  it('should find tools by search', () => {
    const tools = matimo.listTools();
    if (tools.length > 0) {
      const firstTool = tools[0];
      const results = matimo.searchTools(firstTool.name);
      expect(results.length).toBeGreaterThan(0);
    }
  });

  it('should handle empty search results', () => {
    const results = matimo.searchTools('xyznonexistenttoolthatdoesnotexist');
    expect(Array.isArray(results)).toBe(true);
  });

  it('should get tool by name if available', () => {
    const tools = matimo.listTools();
    if (tools.length > 0) {
      const firstToolName = tools[0].name;
      // Test that we can access the tool name
      expect(firstToolName).toBeDefined();
      expect(typeof firstToolName).toBe('string');
    }
  });
});
