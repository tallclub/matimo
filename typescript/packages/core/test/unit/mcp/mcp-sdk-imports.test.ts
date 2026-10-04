import * as fs from 'fs';
import * as path from 'path';

/**
 * The MCP SDK's export map (`./*` -> `./dist/esm/*`) adds no extension, so a subpath
 * import without `.js` fails under plain Node ESM with ERR_MODULE_NOT_FOUND. Jest and
 * tsx resolve it anyway, which hid the bug until a real install ran the server.
 */
describe('MCP SDK subpath imports', () => {
  it('end in .js in every source file', () => {
    const dir = path.resolve(__dirname, '../../../src/mcp');
    const offenders: string[] = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const source = fs.readFileSync(path.join(dir, file), 'utf8');
      for (const match of source.matchAll(/['"](@modelcontextprotocol\/sdk\/[^'"]+)['"]/g)) {
        if (!match[1].endsWith('.js')) offenders.push(`${file}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
