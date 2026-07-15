#!/usr/bin/env node
/**
 * Convert-To-File Tool - Convert JSON/CSV/Markdown/text content into a target
 * file format (PDF, DOCX, CSV, JSON, TXT).
 * Function-type tool: Exports default async function
 *
 * Markdown -> PDF/DOCX rendering deliberately avoids a headless browser
 * (Puppeteer/Playwright): Markdown is tokenized with `marked` and the
 * resulting blocks (headings, paragraphs, bullet lists) are drawn directly
 * with `pdfkit` / assembled with `docx`. This mirrors the lightweight-deps
 * approach `extract_from_file` takes for reading files.
 */

import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { MatimoError, ErrorCode } from '@matimo/core';

type SourceFormat = 'json' | 'csv' | 'markdown' | 'text';
type TargetFormat = 'pdf' | 'docx' | 'csv' | 'json' | 'txt';

const SOURCE_FORMATS: SourceFormat[] = ['json', 'csv', 'markdown', 'text'];
const TARGET_FORMATS: TargetFormat[] = ['pdf', 'docx', 'csv', 'json', 'txt'];
const DEFAULT_MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 10MB (UTF-16 code units)

/** The only source_format -> target_format pairs this tool supports. */
const VALID_COMBOS: [SourceFormat, TargetFormat][] = [
  ['json', 'csv'],
  ['csv', 'json'],
  ['markdown', 'pdf'],
  ['markdown', 'docx'],
  ['text', 'docx'],
  ['text', 'txt'],
];
const VALID_COMBO_KEYS = new Set(VALID_COMBOS.map(([s, t]) => `${s}->${t}`));

const MIME_TYPES: Record<TargetFormat, string> = {
  csv: 'text/csv',
  json: 'application/json',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

interface ConvertToFileParams {
  content: string;
  source_format: SourceFormat;
  target_format: TargetFormat;
  output_path?: string;
  max_content_length?: number;
}

interface ConvertToFileResult {
  success: boolean;
  output_path: string | null;
  file_base64: string | null;
  mime_type: string;
  size_bytes: number;
}

/**
 * Resolve a local file path, expanding a leading ~ to the user's home directory
 * and resolving relative paths against the current working directory.
 * Mirrors the resolution logic used by the `read` / `extract_from_file` core tools.
 */
function resolveLocalPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(process.env.HOME || '/', filePath.slice(1));
  }
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

// ── CSV helpers (hand-rolled, no external dependency — mirrors extract_from_file) ──

/** Minimal RFC 4180-style CSV row parser, returning raw field values per row. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0].length > 0) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0].length > 0) rows.push(row);
  }
  return rows;
}

/** Quote a CSV field only when required (contains a comma, quote, or newline). */
function csvEscapeField(value: string): string {
  if (/["\n\r,]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function serializeCsv(rows: string[][]): string {
  if (rows.length === 0) return '';
  return rows.map((row) => row.map(csvEscapeField).join(',')).join('\r\n') + '\r\n';
}

function stringifyCsvValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

// ── JSON <-> CSV converters ──────────────────────────────────────────────

function jsonToCsv(content: string): Buffer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new MatimoError('Invalid JSON content', ErrorCode.INVALID_PARAMETER, {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  let records: Record<string, unknown>[];
  if (Array.isArray(parsed)) {
    records = parsed.map((item) =>
      item !== null && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : { value: item }
    );
  } else if (parsed !== null && typeof parsed === 'object') {
    records = [parsed as Record<string, unknown>];
  } else {
    throw new MatimoError('Unsupported JSON shape for CSV conversion', ErrorCode.INVALID_PARAMETER, {
      reason: 'JSON content must be an object or an array of objects/values to convert to CSV',
    });
  }

  if (records.length === 0) {
    return Buffer.from('', 'utf8');
  }

  const columns: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  if (columns.length === 0) columns.push('value');

  const rows: string[][] = [columns, ...records.map((record) => columns.map((col) => stringifyCsvValue(record[col])))];

  return Buffer.from(serializeCsv(rows), 'utf8');
}

function csvToJson(content: string): Buffer {
  const rows = parseCsvRows(content);
  if (rows.length === 0) {
    return Buffer.from('[]', 'utf8');
  }

  const [header, ...dataRows] = rows;
  const records = dataRows.map((row) => {
    const record: Record<string, string> = {};
    header.forEach((col, idx) => {
      record[col || `column_${idx + 1}`] = row[idx] ?? '';
    });
    return record;
  });

  return Buffer.from(JSON.stringify(records, null, 2), 'utf8');
}

// ── Markdown tokenization (shared by PDF and DOCX renderers) ────────────

type MdBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string };

interface InlineToken {
  tokens?: InlineToken[];
  text?: string;
  raw?: string;
}

/** Recursively flatten a marked inline token tree into plain text (formatting markers stripped). */
function flattenInline(token: InlineToken): string {
  if (Array.isArray(token.tokens) && token.tokens.length > 0) {
    return token.tokens.map(flattenInline).join('');
  }
  if (typeof token.text === 'string') return token.text;
  if (typeof token.raw === 'string') return token.raw;
  return '';
}

/**
 * Parse Markdown into a flat list of headings/paragraphs/bullets. Intentionally
 * lightweight — no full CommonMark fidelity (tables, nested lists, images are
 * not specially handled), but structure (headings/paragraphs/lists) is never
 * silently dropped: unrecognized block types fall back to plain paragraphs.
 */
function normalizeMarkdown(content: string): MdBlock[] {
  const tokens = marked.lexer(content) as unknown as (InlineToken & {
    type: string;
    depth?: number;
    items?: { tokens: InlineToken[] }[];
  })[];

  const blocks: MdBlock[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        blocks.push({ kind: 'heading', level: token.depth ?? 1, text: flattenInline(token) });
        break;
      case 'paragraph':
        blocks.push({ kind: 'paragraph', text: flattenInline(token) });
        break;
      case 'list':
        for (const item of token.items ?? []) {
          blocks.push({ kind: 'bullet', text: flattenInline({ tokens: item.tokens }) });
        }
        break;
      case 'space':
      case 'hr':
        break;
      default: {
        const text = flattenInline(token);
        if (text.trim().length > 0) {
          blocks.push({ kind: 'paragraph', text });
        }
      }
    }
  }
  return blocks;
}

// ── Markdown -> PDF (pdfkit; no headless browser) ────────────────────────

const PDF_HEADING_SIZES: Record<number, number> = { 1: 24, 2: 20, 3: 17, 4: 15, 5: 13, 6: 12 };

function renderMdBlocksToPdf(blocks: MdBlock[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (blocks.length === 0) {
      doc.font('Helvetica').fontSize(11).text('');
    }

    for (const block of blocks) {
      if (block.kind === 'heading') {
        doc
          .font('Helvetica-Bold')
          .fontSize(PDF_HEADING_SIZES[block.level] ?? 12)
          .text(block.text, { paragraphGap: 8 });
      } else if (block.kind === 'bullet') {
        doc
          .font('Helvetica')
          .fontSize(11)
          .text(`•  ${block.text}`, { indent: 20, paragraphGap: 2 });
      } else {
        doc.font('Helvetica').fontSize(11).text(block.text, { paragraphGap: 6 });
      }
    }

    doc.end();
  });
}

async function markdownToPdf(content: string): Promise<Buffer> {
  return renderMdBlocksToPdf(normalizeMarkdown(content));
}

// ── Markdown / text -> DOCX (docx package) ───────────────────────────────

const DOCX_HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

function renderMdBlocksToDocxParagraphs(blocks: MdBlock[]): Paragraph[] {
  if (blocks.length === 0) {
    return [new Paragraph({ text: '' })];
  }
  return blocks.map((block) => {
    if (block.kind === 'heading') {
      const idx = Math.min(Math.max(block.level, 1), 6) - 1;
      return new Paragraph({ text: block.text, heading: DOCX_HEADING_LEVELS[idx] });
    }
    if (block.kind === 'bullet') {
      return new Paragraph({ text: block.text, bullet: { level: 0 } });
    }
    return new Paragraph({ text: block.text });
  });
}

async function markdownToDocx(content: string): Promise<Buffer> {
  const paragraphs = renderMdBlocksToDocxParagraphs(normalizeMarkdown(content));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBuffer(doc);
}

async function textToDocx(content: string): Promise<Buffer> {
  const lines = content.split(/\r?\n/);
  const paragraphs = lines.length > 0 ? lines.map((line) => new Paragraph({ text: line })) : [new Paragraph({ text: '' })];
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBuffer(doc);
}

// ── Main entry point ──────────────────────────────────────────────────────

/**
 * Convert JSON/CSV/Markdown/text content into a target file format.
 */
export default async function convertToFileTool(params: ConvertToFileParams): Promise<ConvertToFileResult> {
  const {
    content,
    source_format,
    target_format,
    output_path,
    max_content_length = DEFAULT_MAX_CONTENT_LENGTH,
  } = params;

  if (typeof content !== 'string' || content.length === 0) {
    throw new MatimoError('Missing required parameter', ErrorCode.INVALID_PARAMETER, {
      reason: 'content is required and must be a non-empty string',
    });
  }

  if (!SOURCE_FORMATS.includes(source_format)) {
    throw new MatimoError('Unsupported source_format', ErrorCode.INVALID_PARAMETER, {
      source_format,
      supported: SOURCE_FORMATS,
    });
  }

  if (!TARGET_FORMATS.includes(target_format)) {
    throw new MatimoError('Unsupported target_format', ErrorCode.INVALID_PARAMETER, {
      target_format,
      supported: TARGET_FORMATS,
    });
  }

  const comboKey = `${source_format}->${target_format}`;
  if (!VALID_COMBO_KEYS.has(comboKey)) {
    throw new MatimoError('Unsupported conversion combination', ErrorCode.INVALID_PARAMETER, {
      source_format,
      target_format,
      valid_combinations: VALID_COMBOS.map(([s, t]) => `${s}->${t}`),
    });
  }

  if (content.length > max_content_length) {
    throw new MatimoError('Content too large', ErrorCode.EXECUTION_FAILED, {
      size: content.length,
      max_content_length,
    });
  }

  let buffer: Buffer;
  switch (comboKey) {
    case 'json->csv':
      buffer = jsonToCsv(content);
      break;
    case 'csv->json':
      buffer = csvToJson(content);
      break;
    case 'markdown->pdf':
      buffer = await markdownToPdf(content);
      break;
    case 'markdown->docx':
      buffer = await markdownToDocx(content);
      break;
    case 'text->docx':
      buffer = await textToDocx(content);
      break;
    case 'text->txt':
      buffer = Buffer.from(content, 'utf8');
      break;
    /* istanbul ignore next -- unreachable: guarded by VALID_COMBO_KEYS above */
    default:
      throw new MatimoError('Unsupported conversion combination', ErrorCode.INVALID_PARAMETER, {
        source_format,
        target_format,
      });
  }

  const mime_type = MIME_TYPES[target_format];

  if (output_path) {
    const resolvedPath = resolveLocalPath(output_path);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, buffer);
    return {
      success: true,
      output_path: resolvedPath,
      file_base64: null,
      mime_type,
      size_bytes: buffer.length,
    };
  }

  return {
    success: true,
    output_path: null,
    file_base64: buffer.toString('base64'),
    mime_type,
    size_bytes: buffer.length,
  };
}
