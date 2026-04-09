import path from 'path';
import { MatimoInstance } from '../../../core/src/matimo-instance';
import type { ToolDefinition } from '../../../core/src/core/schema';

describe('Postgres Tools Integration', () => {
  let matimo: MatimoInstance;

  beforeAll(async () => {
    const toolsPath = path.join(__dirname, '..', '..', 'tools');
    matimo = await MatimoInstance.init({ toolPaths: [toolsPath], autoDiscover: false });
  });

  it('loads postgres-execute-sql tool', () => {
    const tools = matimo.listTools();
    const names = tools.map((t: ToolDefinition) => t.name);
    expect(names).toContain('postgres-execute-sql');
  });

  it('executes a simple query when creds present', async () => {
    const envUrl = process.env.MATIMO_POSTGRES_URL;
    if (!envUrl) {
      console.info('Skipping integration test - MATIMO_POSTGRES_URL not set');
      return;
    }

    const res = await matimo.execute('postgres-execute-sql', { sql: 'SELECT 1 as one' });
    expect(res).toBeDefined();
    const result = res as { rowCount?: number };
    expect(result.rowCount).toBeGreaterThanOrEqual(0);
  });
});
