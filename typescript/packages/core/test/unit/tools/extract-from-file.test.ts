import path from 'path';
import fs from 'fs';
import os from 'os';
import axios from 'axios';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { ToolLoader } from '../../../src/core/tool-loader';
import type { Parameter } from '../../../src/core/types';
import { MatimoError, ErrorCode } from '../../../src/errors/matimo-error';
import extractFromFileTool from '../../../tools/extract_from_file/extract_from_file';

jest.mock('axios');
jest.mock('pdf-parse');
jest.mock('mammoth', () => ({
  __esModule: true,
  default: { extractRawText: jest.fn() },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedPdfParse = pdfParse as unknown as jest.Mock;
const mockedMammoth = mammoth as unknown as { extractRawText: jest.Mock };

describe('Extract From File Tool', () => {
  const coreToolsPath = path.join(__dirname, '../../../tools');
  let toolLoader: ToolLoader;
  let tmpDir: string;

  beforeAll(() => {
    toolLoader = new ToolLoader();
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-extract-'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Tool Definition ─────────────────────────────────────────────────────

  describe('Tool Definition', () => {
    it('should have valid extract_from_file tool definition file', () => {
      const defPath = path.join(coreToolsPath, 'extract_from_file', 'definition.yaml');
      expect(fs.existsSync(defPath)).toBe(true);
    });

    it('should load extract_from_file tool with correct metadata', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('extract_from_file');

      expect(tool).toBeDefined();
      expect(tool!.name).toBe('extract_from_file');
      expect(tool!.version).toBe('1.0.0');
      expect(tool!.description).toBeDefined();
      expect(tool!.requires_approval).toBe(true);
    });

    it('should have function-type execution', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('extract_from_file');

      expect(tool!.execution.type).toBe('function');
      expect(tool!.execution).toHaveProperty('code');
      expect((tool!.execution as unknown as Record<string, unknown>).code).toBe(
        './extract_from_file.js'
      );
    });
  });

  describe('Parameters', () => {
    it('should have all expected parameters', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('extract_from_file')!;

      const params = tool!.parameters as Record<string, Parameter>;
      expect(params.filePath).toBeDefined();
      expect(params.fileUrl).toBeDefined();
      expect(params.format).toBeDefined();
      expect(params.format.enum).toEqual(['auto', 'pdf', 'docx', 'txt', 'csv']);
      expect(params.encoding).toBeDefined();
      expect(params.maxSizeBytes).toBeDefined();
      expect(params.timeout).toBeDefined();
    });

    it('should mark filePath and fileUrl as optional (mutually exclusive)', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('extract_from_file')!;
      const params = tool!.parameters as Record<string, Parameter>;

      expect(params.filePath.required).toBe(false);
      expect(params.fileUrl.required).toBe(false);
    });
  });

  describe('Output Schema', () => {
    it('should define output schema', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('extract_from_file')!;

      expect(tool!.output_schema).toBeDefined();
      const props = tool!.output_schema!.properties as unknown as Record<string, unknown>;
      expect(props).toHaveProperty('extracted_text');
      expect(props).toHaveProperty('format_detected');
      expect(props).toHaveProperty('metadata');
    });
  });

  describe('Implementation', () => {
    it('should have implementation file', () => {
      const implPath = path.join(coreToolsPath, 'extract_from_file', 'extract_from_file.ts');
      expect(fs.existsSync(implPath)).toBe(true);
    });

    it('implementation should export default async function', () => {
      const implPath = path.join(coreToolsPath, 'extract_from_file', 'extract_from_file.ts');
      const content = fs.readFileSync(implPath, 'utf-8');
      expect(content).toContain('export default async function extractFromFileTool');
    });
  });

  describe('Examples', () => {
    it('should include examples in tool definition', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('extract_from_file')!;

      expect(tool!.examples).toBeDefined();
      expect(Array.isArray(tool!.examples)).toBe(true);
      expect((tool!.examples as Array<unknown>).length).toBeGreaterThan(0);
    });
  });

  // ── Parameter validation ────────────────────────────────────────────────

  describe('Parameter validation', () => {
    it('throws when neither filePath nor fileUrl is provided', async () => {
      await expect(extractFromFileTool({})).rejects.toMatchObject({
        code: ErrorCode.INVALID_PARAMETER,
      });
    });

    it('throws when both filePath and fileUrl are provided', async () => {
      await expect(
        extractFromFileTool({ filePath: './a.txt', fileUrl: 'https://example.com/a.txt' })
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
    });

    it('throws on unsupported format before touching the filesystem', async () => {
      await expect(
        extractFromFileTool({ filePath: '/nonexistent/path.xyz', format: 'xml' as never })
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
    });
  });

  // ── Local file: txt / csv (real fs, no mocking needed) ─────────────────

  describe('Local txt extraction', () => {
    it('extracts plain text and computes word/char counts', async () => {
      const filePath = path.join(tmpDir, 'notes.txt');
      fs.writeFileSync(filePath, 'Hello Matimo world');

      const result = (await extractFromFileTool({ filePath })) as unknown as Record<
        string,
        unknown
      >;

      expect(result.success).toBe(true);
      expect(result.format_detected).toBe('txt');
      expect(result.extracted_text).toBe('Hello Matimo world');
      expect(result.source).toBe('filePath');
      expect((result.metadata as unknown as Record<string, unknown>).word_count).toBe(3);
      expect((result.metadata as unknown as Record<string, unknown>).char_count).toBe(18);
    });

    it('respects an explicit encoding', async () => {
      const filePath = path.join(tmpDir, 'latin.txt');
      fs.writeFileSync(filePath, Buffer.from('café', 'latin1'));

      const result = (await extractFromFileTool({
        filePath,
        encoding: 'latin1',
      })) as unknown as Record<string, unknown>;

      expect(result.extracted_text).toBe('café');
    });
  });

  describe('Local csv extraction', () => {
    it('extracts csv text and row/column metadata', async () => {
      const filePath = path.join(tmpDir, 'records.csv');
      fs.writeFileSync(filePath, 'name,age\nAlice,30\nBob,25\n');

      const result = (await extractFromFileTool({ filePath, format: 'csv' })) as unknown as Record<
        string,
        unknown
      >;

      expect(result.format_detected).toBe('csv');
      const metadata = result.metadata as unknown as Record<string, unknown>;
      expect(metadata.row_count).toBe(2);
      expect(metadata.column_count).toBe(2);
    });

    it('handles quoted fields with embedded commas and newlines', async () => {
      const filePath = path.join(tmpDir, 'quoted.csv');
      fs.writeFileSync(filePath, 'a,b\n"1,2","3\n4"\n');

      const result = (await extractFromFileTool({ filePath, format: 'csv' })) as unknown as Record<
        string,
        unknown
      >;
      const metadata = result.metadata as unknown as Record<string, unknown>;
      expect(metadata.row_count).toBe(1);
      expect(metadata.column_count).toBe(2);
    });

    it('auto-detects csv from a comma-delimited first line with no extension', async () => {
      const filePath = path.join(tmpDir, 'data-no-ext');
      fs.writeFileSync(filePath, 'a,b,c\n1,2,3\n');

      const result = (await extractFromFileTool({ filePath })) as unknown as Record<
        string,
        unknown
      >;
      expect(result.format_detected).toBe('csv');
    });

    it('falls back to txt for no-extension content with no commas or magic bytes', async () => {
      const filePath = path.join(tmpDir, 'data-no-ext-txt');
      fs.writeFileSync(filePath, 'just plain words with no commas here');

      const result = (await extractFromFileTool({ filePath })) as unknown as Record<
        string,
        unknown
      >;
      expect(result.format_detected).toBe('txt');
    });

    it('returns zero rows/columns for an empty csv', async () => {
      const filePath = path.join(tmpDir, 'empty.csv');
      fs.writeFileSync(filePath, '');

      const result = (await extractFromFileTool({ filePath })) as unknown as Record<
        string,
        unknown
      >;
      const metadata = result.metadata as unknown as Record<string, unknown>;
      expect(metadata.row_count).toBe(0);
      expect(metadata.column_count).toBe(0);
    });
  });

  // ── Local file: pdf / docx (mocked parsers) ─────────────────────────────

  describe('Local pdf extraction', () => {
    it('extracts text and page count via pdf-parse', async () => {
      mockedPdfParse.mockResolvedValue({ text: 'Hello PDF world', numpages: 3 });

      const filePath = path.join(tmpDir, 'report.pdf');
      fs.writeFileSync(filePath, Buffer.from('%PDF-1.4 fake content'));

      const result = (await extractFromFileTool({ filePath })) as unknown as Record<
        string,
        unknown
      >;

      expect(result.format_detected).toBe('pdf');
      expect(result.extracted_text).toBe('Hello PDF world');
      const metadata = result.metadata as unknown as Record<string, unknown>;
      expect(metadata.page_count).toBe(3);
      expect(metadata.word_count).toBe(3);
      expect(mockedPdfParse).toHaveBeenCalledTimes(1);
    });

    it('auto-detects pdf via magic bytes with no extension', async () => {
      mockedPdfParse.mockResolvedValue({ text: 'Sniffed', numpages: 1 });
      const filePath = path.join(tmpDir, 'no-extension-pdf');
      fs.writeFileSync(filePath, Buffer.from('%PDF-1.7 rest of file'));

      const result = (await extractFromFileTool({ filePath })) as unknown as Record<
        string,
        unknown
      >;
      expect(result.format_detected).toBe('pdf');
    });

    it('defaults extracted text to empty string when pdf-parse returns no text', async () => {
      mockedPdfParse.mockResolvedValue({ numpages: 2 });
      const filePath = path.join(tmpDir, 'blank.pdf');
      fs.writeFileSync(filePath, Buffer.from('%PDF-1.4'));

      const result = (await extractFromFileTool({ filePath })) as unknown as Record<
        string,
        unknown
      >;
      expect(result.extracted_text).toBe('');
    });
  });

  describe('Local docx extraction', () => {
    it('extracts raw text via mammoth', async () => {
      mockedMammoth.extractRawText.mockResolvedValue({ value: 'Hello DOCX world' });

      const filePath = path.join(tmpDir, 'proposal.docx');
      fs.writeFileSync(filePath, Buffer.from('PK\x03\x04 fake zip content'));

      const result = (await extractFromFileTool({ filePath })) as unknown as Record<
        string,
        unknown
      >;

      expect(result.format_detected).toBe('docx');
      expect(result.extracted_text).toBe('Hello DOCX world');
      const metadata = result.metadata as unknown as Record<string, unknown>;
      expect(metadata.page_count).toBeUndefined();
      expect(metadata.word_count).toBe(3);
    });

    it('auto-detects docx via zip magic bytes with no extension', async () => {
      mockedMammoth.extractRawText.mockResolvedValue({ value: 'Sniffed docx' });
      const filePath = path.join(tmpDir, 'no-extension-docx');
      fs.writeFileSync(filePath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]));

      const result = (await extractFromFileTool({ filePath })) as unknown as Record<
        string,
        unknown
      >;
      expect(result.format_detected).toBe('docx');
    });
  });

  // ── Local file: error paths ─────────────────────────────────────────────

  describe('Local file error paths', () => {
    it('throws FILE_NOT_FOUND when the file does not exist', async () => {
      await expect(
        extractFromFileTool({ filePath: path.join(tmpDir, 'does-not-exist.txt') })
      ).rejects.toMatchObject({ code: ErrorCode.FILE_NOT_FOUND });
    });

    it('throws EXECUTION_FAILED when the path is a directory', async () => {
      await expect(extractFromFileTool({ filePath: tmpDir })).rejects.toMatchObject({
        code: ErrorCode.EXECUTION_FAILED,
      });
    });

    it('throws EXECUTION_FAILED when the file exceeds maxSizeBytes', async () => {
      const filePath = path.join(tmpDir, 'big.txt');
      fs.writeFileSync(filePath, 'x'.repeat(1000));

      await expect(extractFromFileTool({ filePath, maxSizeBytes: 10 })).rejects.toMatchObject({
        code: ErrorCode.EXECUTION_FAILED,
      });
    });

    it('resolves a leading ~ against the home directory', async () => {
      const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-home-'));
      const originalHome = process.env.HOME;
      process.env.HOME = homeDir;
      try {
        fs.writeFileSync(path.join(homeDir, 'note.txt'), 'from home');
        const result = (await extractFromFileTool({ filePath: '~/note.txt' })) as unknown as Record<
          string,
          unknown
        >;
        expect(result.sourceLocation).toBe(path.join(homeDir, 'note.txt'));
        expect(result.extracted_text).toBe('from home');
      } finally {
        process.env.HOME = originalHome;
        fs.rmSync(homeDir, { recursive: true, force: true });
      }
    });
  });

  // ── Remote file: fileUrl ────────────────────────────────────────────────

  describe('Remote fileUrl extraction', () => {
    it('downloads and extracts a remote csv file', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('a,b\n1,2\n'),
      });

      const result = (await extractFromFileTool({
        fileUrl: 'https://example.com/files/data.csv',
      })) as unknown as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(result.source).toBe('fileUrl');
      expect(result.format_detected).toBe('csv');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com/files/data.csv',
        expect.objectContaining({ responseType: 'arraybuffer' })
      );
    });

    it('downloads and extracts a remote docx file', async () => {
      mockedMammoth.extractRawText.mockResolvedValue({ value: 'Remote docx text' });
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('PK\x03\x04 remote docx'),
      });

      const result = (await extractFromFileTool({
        fileUrl: 'https://example.com/files/report.docx',
      })) as unknown as Record<string, unknown>;

      expect(result.format_detected).toBe('docx');
      expect(result.extracted_text).toBe('Remote docx text');
    });

    it('rejects an invalid URL', async () => {
      await expect(extractFromFileTool({ fileUrl: 'not-a-url' })).rejects.toMatchObject({
        code: ErrorCode.INVALID_PARAMETER,
      });
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('rejects an unsupported protocol', async () => {
      await expect(
        extractFromFileTool({ fileUrl: 'ftp://example.com/file.txt' })
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it.each([
      'http://localhost/secret',
      'http://127.0.0.1/secret',
      'http://[::1]/secret',
      'http://169.254.169.254/latest/meta-data',
      'http://10.0.0.5/internal',
      'http://192.168.1.1/internal',
      'http://172.16.0.1/internal',
      'http://172.31.255.255/internal',
    ])('blocks SSRF target %s', async (fileUrl) => {
      await expect(extractFromFileTool({ fileUrl })).rejects.toMatchObject({
        code: ErrorCode.INVALID_PARAMETER,
      });
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it.each(['http://172.15.0.1/ok', 'http://172.32.0.1/ok', 'http://8.8.8.8/ok'])(
      'allows non-private target %s',
      async (fileUrl) => {
        mockedAxios.get.mockResolvedValue({ status: 200, data: Buffer.from('hello') });
        const result = (await extractFromFileTool({ fileUrl, format: 'txt' })) as unknown as Record<
          string,
          unknown
        >;
        expect(result.success).toBe(true);
      }
    );

    it('throws NETWORK_ERROR on a non-2xx response', async () => {
      mockedAxios.get.mockResolvedValue({ status: 404, data: Buffer.from('') });

      await expect(
        extractFromFileTool({ fileUrl: 'https://example.com/missing.txt' })
      ).rejects.toMatchObject({ code: ErrorCode.NETWORK_ERROR });
    });

    it('throws NETWORK_ERROR when the request itself fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('ECONNRESET'));

      await expect(
        extractFromFileTool({ fileUrl: 'https://example.com/file.txt' })
      ).rejects.toMatchObject({ code: ErrorCode.NETWORK_ERROR });
    });

    it('throws EXECUTION_FAILED when the downloaded file exceeds maxSizeBytes', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, data: Buffer.from('x'.repeat(1000)) });

      await expect(
        extractFromFileTool({ fileUrl: 'https://example.com/big.txt', maxSizeBytes: 10 })
      ).rejects.toMatchObject({ code: ErrorCode.EXECUTION_FAILED });
    });
  });

  // ── Sanity: MatimoError shape ────────────────────────────────────────────

  it('rejected errors are instances of MatimoError', async () => {
    await expect(extractFromFileTool({})).rejects.toBeInstanceOf(MatimoError);
  });
});
