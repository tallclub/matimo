import path from 'path';
import fs from 'fs';
import os from 'os';
import { ToolLoader } from '../../../src/core/tool-loader';
import type { Parameter } from '../../../src/core/types';
import { MatimoError, ErrorCode } from '../../../src/errors/matimo-error';
import convertToFileTool from '../../../tools/convert_to_file/convert_to_file';

describe('Convert To File Tool', () => {
  const coreToolsPath = path.join(__dirname, '../../../tools');
  let toolLoader: ToolLoader;
  let tmpDir: string;

  beforeAll(() => {
    toolLoader = new ToolLoader();
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-convert-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Tool Definition ─────────────────────────────────────────────────────

  describe('Tool Definition', () => {
    it('should have valid convert_to_file tool definition file', () => {
      const defPath = path.join(coreToolsPath, 'convert_to_file', 'definition.yaml');
      expect(fs.existsSync(defPath)).toBe(true);
    });

    it('should load convert_to_file tool with correct metadata', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('convert_to_file');

      expect(tool).toBeDefined();
      expect(tool!.name).toBe('convert_to_file');
      expect(tool!.version).toBe('1.0.0');
      expect(tool!.description).toBeDefined();
      expect(tool!.requires_approval).toBe(true);
    });

    it('should have function-type execution', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('convert_to_file');

      expect(tool!.execution.type).toBe('function');
      expect(tool!.execution).toHaveProperty('code');
      expect((tool!.execution as unknown as Record<string, unknown>).code).toBe(
        './convert_to_file.js'
      );
    });
  });

  describe('Parameters', () => {
    it('should have all expected parameters', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('convert_to_file')!;

      const params = tool!.parameters as Record<string, Parameter>;
      expect(params.content).toBeDefined();
      expect(params.content.required).toBe(true);
      expect(params.source_format).toBeDefined();
      expect(params.source_format.enum).toEqual(['json', 'csv', 'markdown', 'text']);
      expect(params.source_format.required).toBe(true);
      expect(params.target_format).toBeDefined();
      expect(params.target_format.enum).toEqual(['pdf', 'docx', 'csv', 'json', 'txt']);
      expect(params.target_format.required).toBe(true);
      expect(params.output_path).toBeDefined();
      expect(params.output_path.required).toBe(false);
      expect(params.max_content_length).toBeDefined();
      expect(params.max_content_length.required).toBe(false);
      expect(params.max_content_length.default).toBe(10485760);
    });
  });

  describe('Output Schema', () => {
    it('should define output schema', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('convert_to_file')!;

      expect(tool!.output_schema).toBeDefined();
      const props = tool!.output_schema!.properties as unknown as Record<string, unknown>;
      expect(props).toHaveProperty('output_path');
      expect(props).toHaveProperty('file_base64');
      expect(props).toHaveProperty('mime_type');
      expect(props).toHaveProperty('size_bytes');
    });
  });

  describe('Implementation', () => {
    it('should have implementation file', () => {
      const implPath = path.join(coreToolsPath, 'convert_to_file', 'convert_to_file.ts');
      expect(fs.existsSync(implPath)).toBe(true);
    });

    it('implementation should export default async function', () => {
      const implPath = path.join(coreToolsPath, 'convert_to_file', 'convert_to_file.ts');
      const content = fs.readFileSync(implPath, 'utf-8');
      expect(content).toContain('export default async function convertToFileTool');
    });
  });

  describe('Examples', () => {
    it('should include examples in tool definition', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('convert_to_file')!;

      expect(tool!.examples).toBeDefined();
      expect(Array.isArray(tool!.examples)).toBe(true);
      expect((tool!.examples as Array<unknown>).length).toBeGreaterThan(0);
    });
  });

  // ── Parameter validation ────────────────────────────────────────────────

  describe('Parameter validation', () => {
    it('throws when content is missing', async () => {
      await expect(
        convertToFileTool({ source_format: 'json', target_format: 'csv' } as never)
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
    });

    it('throws when content is an empty string', async () => {
      await expect(
        convertToFileTool({ content: '', source_format: 'json', target_format: 'csv' })
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
    });

    it('throws on unsupported source_format', async () => {
      await expect(
        convertToFileTool({ content: 'x', source_format: 'pdf' as never, target_format: 'csv' })
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
    });

    it('throws on unsupported target_format', async () => {
      await expect(
        convertToFileTool({ content: 'x', source_format: 'json', target_format: 'xml' as never })
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
    });

    it('throws on an unsupported source/target combination and lists valid combinations', async () => {
      await expect(
        convertToFileTool({ content: '{}', source_format: 'json', target_format: 'pdf' })
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_PARAMETER,
        details: expect.objectContaining({
          valid_combinations: [
            'json->csv',
            'csv->json',
            'markdown->pdf',
            'markdown->docx',
            'text->docx',
            'text->txt',
          ],
        }),
      });
    });

    it.each([
      ['csv', 'pdf'],
      ['csv', 'docx'],
      ['csv', 'txt'],
      ['markdown', 'csv'],
      ['markdown', 'json'],
      ['markdown', 'txt'],
      ['text', 'csv'],
      ['text', 'json'],
      ['text', 'pdf'],
    ])('rejects unsupported combo %s -> %s', async (source_format, target_format) => {
      await expect(
        convertToFileTool({
          content: 'x',
          source_format: source_format as never,
          target_format: target_format as never,
        })
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
    });

    it('throws EXECUTION_FAILED when content exceeds max_content_length', async () => {
      await expect(
        convertToFileTool({
          content: '[{"a":1}]',
          source_format: 'json',
          target_format: 'csv',
          max_content_length: 5,
        })
      ).rejects.toMatchObject({ code: ErrorCode.EXECUTION_FAILED });
    });

    it('rejected errors are instances of MatimoError', async () => {
      await expect(
        convertToFileTool({ content: '', source_format: 'json', target_format: 'csv' })
      ).rejects.toBeInstanceOf(MatimoError);
    });
  });

  // ── json -> csv ──────────────────────────────────────────────────────────

  describe('json -> csv', () => {
    it('converts an array of uniform objects to csv', async () => {
      const content = JSON.stringify([
        { name: 'Ada', role: 'Mathematician' },
        { name: 'Alan', role: 'Computer Scientist' },
      ]);
      const result = (await convertToFileTool({
        content,
        source_format: 'json',
        target_format: 'csv',
      })) as unknown as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(result.mime_type).toBe('text/csv');
      expect(result.output_path).toBeNull();
      const csv = Buffer.from(result.file_base64 as string, 'base64').toString('utf8');
      expect(csv).toBe('name,role\r\nAda,Mathematician\r\nAlan,Computer Scientist\r\n');
    });

    it('unions keys across records with missing columns filled as empty', async () => {
      const content = JSON.stringify([{ a: 1 }, { a: 2, b: 'extra' }]);
      const result = (await convertToFileTool({
        content,
        source_format: 'json',
        target_format: 'csv',
      })) as unknown as Record<string, unknown>;
      const csv = Buffer.from(result.file_base64 as string, 'base64').toString('utf8');
      expect(csv).toBe('a,b\r\n1,\r\n2,extra\r\n');
    });

    it('quotes fields containing commas, quotes, or newlines', async () => {
      const content = JSON.stringify([
        { note: 'has, a comma', quote: 'He said "hi"', multi: 'line1\nline2' },
      ]);
      const result = (await convertToFileTool({
        content,
        source_format: 'json',
        target_format: 'csv',
      })) as unknown as Record<string, unknown>;
      const csv = Buffer.from(result.file_base64 as string, 'base64').toString('utf8');
      expect(csv).toContain('"has, a comma"');
      expect(csv).toContain('"He said ""hi"""');
      expect(csv).toContain('"line1\nline2"');
    });

    it('wraps a single JSON object as a one-row csv', async () => {
      const content = JSON.stringify({ x: 1, y: 2 });
      const result = (await convertToFileTool({
        content,
        source_format: 'json',
        target_format: 'csv',
      })) as unknown as Record<string, unknown>;
      const csv = Buffer.from(result.file_base64 as string, 'base64').toString('utf8');
      expect(csv).toBe('x,y\r\n1,2\r\n');
    });

    it('wraps an array of primitives under a "value" column', async () => {
      const content = JSON.stringify([1, 2, 3]);
      const result = (await convertToFileTool({
        content,
        source_format: 'json',
        target_format: 'csv',
      })) as unknown as Record<string, unknown>;
      const csv = Buffer.from(result.file_base64 as string, 'base64').toString('utf8');
      expect(csv).toBe('value\r\n1\r\n2\r\n3\r\n');
    });

    it('produces an empty file for an empty JSON array', async () => {
      const result = (await convertToFileTool({
        content: '[]',
        source_format: 'json',
        target_format: 'csv',
      })) as unknown as Record<string, unknown>;
      expect(result.size_bytes).toBe(0);
    });

    it('falls back to a single "value" column when every record is an empty object', async () => {
      const result = (await convertToFileTool({
        content: '[{}]',
        source_format: 'json',
        target_format: 'csv',
      })) as unknown as Record<string, unknown>;
      const csv = Buffer.from(result.file_base64 as string, 'base64').toString('utf8');
      expect(csv).toBe('value\r\n\r\n');
    });

    it('stringifies nested object/array values as JSON within a cell', async () => {
      const content = JSON.stringify([{ tags: ['a', 'b'], meta: { nested: true } }]);
      const result = (await convertToFileTool({
        content,
        source_format: 'json',
        target_format: 'csv',
      })) as unknown as Record<string, unknown>;
      const csv = Buffer.from(result.file_base64 as string, 'base64').toString('utf8');
      // Values are JSON-stringified then CSV-escaped (they contain commas/quotes).
      expect(csv).toContain('"[""a"",""b""]"');
      expect(csv).toContain('"{""nested"":true}"');
    });

    it('throws INVALID_PARAMETER on malformed JSON', async () => {
      await expect(
        convertToFileTool({
          content: '{not valid json',
          source_format: 'json',
          target_format: 'csv',
        })
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
    });

    it('throws INVALID_PARAMETER when JSON is a bare scalar', async () => {
      await expect(
        convertToFileTool({
          content: '"just a string"',
          source_format: 'json',
          target_format: 'csv',
        })
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
    });
  });

  // ── csv -> json ──────────────────────────────────────────────────────────

  describe('csv -> json', () => {
    it('converts csv rows into an array of objects', async () => {
      const content = 'name,role\nAda,Mathematician\nAlan,Computer Scientist\n';
      const result = (await convertToFileTool({
        content,
        source_format: 'csv',
        target_format: 'json',
      })) as unknown as Record<string, unknown>;

      expect(result.mime_type).toBe('application/json');
      const parsed = JSON.parse(
        Buffer.from(result.file_base64 as string, 'base64').toString('utf8')
      );
      expect(parsed).toEqual([
        { name: 'Ada', role: 'Mathematician' },
        { name: 'Alan', role: 'Computer Scientist' },
      ]);
    });

    it('handles quoted fields with embedded commas and newlines', async () => {
      const content = 'a,b\n"1,2","3\n4"\n';
      const result = (await convertToFileTool({
        content,
        source_format: 'csv',
        target_format: 'json',
      })) as unknown as Record<string, unknown>;
      const parsed = JSON.parse(
        Buffer.from(result.file_base64 as string, 'base64').toString('utf8')
      );
      expect(parsed).toEqual([{ a: '1,2', b: '3\n4' }]);
    });

    it('returns an empty array for csv content with no parsable rows', async () => {
      // content must be non-empty (see Parameter validation), so a lone
      // newline is used to exercise the "zero data rows" branch.
      const result = (await convertToFileTool({
        content: '\n',
        source_format: 'csv',
        target_format: 'json',
      })) as unknown as Record<string, unknown>;
      const parsed = JSON.parse(
        Buffer.from(result.file_base64 as string, 'base64').toString('utf8')
      );
      expect(parsed).toEqual([]);
    });

    it('returns an empty array for a header-only csv', async () => {
      const result = (await convertToFileTool({
        content: 'a,b,c\n',
        source_format: 'csv',
        target_format: 'json',
      })) as unknown as Record<string, unknown>;
      const parsed = JSON.parse(
        Buffer.from(result.file_base64 as string, 'base64').toString('utf8')
      );
      expect(parsed).toEqual([]);
    });

    it('falls back to generated column names for blank header cells', async () => {
      const content = 'a,,c\n1,2,3\n';
      const result = (await convertToFileTool({
        content,
        source_format: 'csv',
        target_format: 'json',
      })) as unknown as Record<string, unknown>;
      const parsed = JSON.parse(
        Buffer.from(result.file_base64 as string, 'base64').toString('utf8')
      );
      expect(parsed).toEqual([{ a: '1', column_2: '2', c: '3' }]);
    });

    it('fills missing trailing fields with empty strings when a row is short', async () => {
      const content = 'a,b,c\n1\n';
      const result = (await convertToFileTool({
        content,
        source_format: 'csv',
        target_format: 'json',
      })) as unknown as Record<string, unknown>;
      const parsed = JSON.parse(
        Buffer.from(result.file_base64 as string, 'base64').toString('utf8')
      );
      expect(parsed).toEqual([{ a: '1', b: '', c: '' }]);
    });
  });

  // ── markdown -> pdf ──────────────────────────────────────────────────────

  describe('markdown -> pdf', () => {
    it('renders headings, paragraphs, and bullet lists into a pdf', async () => {
      const content =
        '# Title\n\nA paragraph with **bold** text.\n\n- item one\n- item two\n\n## Sub\n\nAnother paragraph.';
      const result = (await convertToFileTool({
        content,
        source_format: 'markdown',
        target_format: 'pdf',
      })) as unknown as Record<string, unknown>;

      expect(result.mime_type).toBe('application/pdf');
      expect(result.output_path).toBeNull();
      const buffer = Buffer.from(result.file_base64 as string, 'base64');
      expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
      expect(result.size_bytes as number).toBeGreaterThan(0);
    });

    it('renders an empty pdf for markdown with no recognizable blocks', async () => {
      // A lone newline lexes to a single "space" token, which normalizeMarkdown
      // discards, leaving zero blocks — exercises the empty-blocks fallback.
      const result = (await convertToFileTool({
        content: '\n',
        source_format: 'markdown',
        target_format: 'pdf',
      })) as unknown as Record<string, unknown>;
      const buffer = Buffer.from(result.file_base64 as string, 'base64');
      expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
    });

    it('falls back unknown block types (e.g. blockquote, html) to a plain paragraph instead of dropping them', async () => {
      const content = '> a blockquote line';
      const result = (await convertToFileTool({
        content,
        source_format: 'markdown',
        target_format: 'pdf',
      })) as unknown as Record<string, unknown>;
      const buffer = Buffer.from(result.file_base64 as string, 'base64');
      expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
      expect(result.size_bytes as number).toBeGreaterThan(0);
    });

    it('flattens an html comment block to non-empty paragraph text rather than dropping it', async () => {
      const result = (await convertToFileTool({
        content: '<!-- just a comment -->',
        source_format: 'markdown',
        target_format: 'pdf',
      })) as unknown as Record<string, unknown>;
      const buffer = Buffer.from(result.file_base64 as string, 'base64');
      expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
      expect(result.size_bytes as number).toBeGreaterThan(0);
    });
  });

  // ── markdown -> docx ─────────────────────────────────────────────────────

  describe('markdown -> docx', () => {
    it('renders headings, paragraphs, and bullet lists into a docx', async () => {
      const content = '# Title\n\nA paragraph.\n\n- item one\n- item two';
      const result = (await convertToFileTool({
        content,
        source_format: 'markdown',
        target_format: 'docx',
      })) as unknown as Record<string, unknown>;

      expect(result.mime_type).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      const buffer = Buffer.from(result.file_base64 as string, 'base64');
      expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    });

    it('handles markdown with no recognizable blocks by producing a minimal valid docx', async () => {
      const result = (await convertToFileTool({
        content: '\n',
        source_format: 'markdown',
        target_format: 'docx',
      })) as unknown as Record<string, unknown>;
      const buffer = Buffer.from(result.file_base64 as string, 'base64');
      expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    });
  });

  // ── text -> docx / text -> txt ───────────────────────────────────────────

  describe('text -> docx', () => {
    it('wraps plain text (one paragraph per line) into a docx', async () => {
      const result = (await convertToFileTool({
        content: 'line one\nline two',
        source_format: 'text',
        target_format: 'docx',
      })) as unknown as Record<string, unknown>;

      const buffer = Buffer.from(result.file_base64 as string, 'base64');
      expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    });
  });

  describe('text -> txt', () => {
    it('returns the content unchanged as a txt file', async () => {
      const content = 'Meeting notes: ship the release on Friday.';
      const result = (await convertToFileTool({
        content,
        source_format: 'text',
        target_format: 'txt',
      })) as unknown as Record<string, unknown>;

      expect(result.mime_type).toBe('text/plain');
      expect(Buffer.from(result.file_base64 as string, 'base64').toString('utf8')).toBe(content);
    });
  });

  // ── output_path: write to disk vs base64 ────────────────────────────────

  describe('output_path handling', () => {
    it('writes the generated file to output_path and returns null file_base64', async () => {
      const outPath = path.join(tmpDir, 'out.csv');
      const result = (await convertToFileTool({
        content: '[{"a":1}]',
        source_format: 'json',
        target_format: 'csv',
        output_path: outPath,
      })) as unknown as Record<string, unknown>;

      expect(result.output_path).toBe(outPath);
      expect(result.file_base64).toBeNull();
      expect(fs.existsSync(outPath)).toBe(true);
      expect(fs.readFileSync(outPath, 'utf8')).toBe('a\r\n1\r\n');
    });

    it('creates missing parent directories before writing', async () => {
      const outPath = path.join(tmpDir, 'nested', 'deeper', 'out.json');
      const result = (await convertToFileTool({
        content: 'a,b\n1,2\n',
        source_format: 'csv',
        target_format: 'json',
        output_path: outPath,
      })) as unknown as Record<string, unknown>;

      expect(fs.existsSync(outPath)).toBe(true);
      expect(result.output_path).toBe(outPath);
    });

    it('resolves a leading ~ against the home directory', async () => {
      const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-convert-home-'));
      const originalHome = process.env.HOME;
      process.env.HOME = homeDir;
      try {
        const result = (await convertToFileTool({
          content: 'hello world',
          source_format: 'text',
          target_format: 'txt',
          output_path: '~/notes.txt',
        })) as unknown as Record<string, unknown>;

        expect(result.output_path).toBe(path.join(homeDir, 'notes.txt'));
        expect(fs.readFileSync(path.join(homeDir, 'notes.txt'), 'utf8')).toBe('hello world');
      } finally {
        process.env.HOME = originalHome;
        fs.rmSync(homeDir, { recursive: true, force: true });
      }
    });

    it('returns file_base64 (not a written file) when output_path is omitted', async () => {
      const result = (await convertToFileTool({
        content: 'hello',
        source_format: 'text',
        target_format: 'txt',
      })) as unknown as Record<string, unknown>;

      expect(result.output_path).toBeNull();
      expect(typeof result.file_base64).toBe('string');
    });
  });
});
