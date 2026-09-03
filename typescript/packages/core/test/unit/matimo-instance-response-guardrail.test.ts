import { MatimoInstance } from '../../src/matimo-instance';
import path from 'path';
import axios from 'axios';

// Confirms the response-size guardrail (Fix 3) fires inside
// MatimoInstance.execute() itself — the single choke point every execution
// path (direct SDK, LangChain, CrewAI, MCP) funnels through — rather than
// being MCP-specific or executor-specific.
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MatimoInstance - response size guardrail', () => {
  const toolsPath = path.join(__dirname, '../fixtures/tools');

  it('truncates an oversized HTTP tool result using the instance-level defaultMaxResponseSize', async () => {
    const instance = await MatimoInstance.init({
      toolPaths: [toolsPath],
      defaultMaxResponseSize: 2_000,
    });

    const hugeItems = Array.from({ length: 5000 }, (_, i) => ({
      id: i,
      blob: 'x'.repeat(80),
    }));
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      data: hugeItems,
      headers: {},
    });

    const result = (await instance.execute('edge-case-tool', {
      value1: 'a',
      value2: 'b',
    })) as { data: unknown[]; _truncated?: boolean };

    expect(result._truncated).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeLessThan(hugeItems.length + 1);
  });

  it('leaves a small HTTP tool result unchanged', async () => {
    const instance = await MatimoInstance.init({
      toolPaths: [toolsPath],
      defaultMaxResponseSize: 2_000,
    });

    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { small: true },
      headers: {},
    });

    const result = (await instance.execute('edge-case-tool', {
      value1: 'a',
      value2: 'b',
    })) as { data: unknown; _truncated?: boolean };

    expect(result._truncated).toBeUndefined();
    expect(result.data).toEqual({ small: true });
  });
});
