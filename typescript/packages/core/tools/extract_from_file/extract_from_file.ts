#!/usr/bin/env node
/**
 * Extract-From-File Tool - Extract text from local/remote PDF, DOCX, TXT, and CSV files
 * Function-type tool: Exports default async function
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { MatimoError, ErrorCode } from '@matimo/core';

type SupportedFormat = 'pdf' | 'docx' | 'txt' | 'csv';
type RequestedFormat = 'auto' | SupportedFormat;

const SUPPORTED_FORMATS: SupportedFormat[] = ['pdf', 'docx', 'txt', 'csv'];
const DEFAULT_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const DEFAULT_TIMEOUT_MS = 30000;

interface ExtractFromFileParams {
  filePath?: string;
  fileUrl?: string;
  format?: RequestedFormat;
  encoding?: string;
  maxSizeBytes?: number;
  timeout?: number;
}

interface ExtractMetadata {
  page_count?: number;
  word_count?: number;
  char_count?: number;
  row_count?: number;
  column_count?: number;
}

interface ExtractFromFileResult {
  success: boolean;
  extracted_text: string;
  format_detected: SupportedFormat;
  source: 'filePath' | 'fileUrl';
  sourceLocation: string;
  size: number;
  metadata: ExtractMetadata;
}

/**
 * Resolve a local file path, expanding a leading ~ to the user's home directory
 * and resolving relative paths against the current working directory.
 * Mirrors the resolution logic used by the `read` core tool.
 */
function resolveLocalPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(process.env.HOME || '/', filePath.slice(1));
  }
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

/**
 * SSRF guard for the fileUrl input. Mirrors isBlockedUrl() in
 * packages/core/src/policy/default-policy.ts so remote fetches applied by this
 * tool are held to the same bar Matimo's policy engine uses for agent-proposed
 * HTTP tools (blocks localhost, loopback, link-local/AWS metadata, and RFC1918
 * private ranges).
 */
function isBlockedUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return true;
  }
  // Node's URL.hostname keeps IPv6 literals bracketed (e.g. "[::1]") — strip
  // the brackets so the comparisons below match the bare address.
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('169.254.') || // link-local / AWS metadata
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/** Detect a supported format from a file name's extension. */
function extensionFormat(name: string): SupportedFormat | undefined {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'pdf';
    case '.docx':
      return 'docx';
    case '.csv':
      return 'csv';
    case '.txt':
      return 'txt';
    default:
      return undefined;
  }
}

/** Sniff a format from magic bytes / content when the extension is missing or ambiguous. */
function sniffFormat(buffer: Buffer): SupportedFormat {
  if (buffer.subarray(0, 4).toString('latin1') === '%PDF') {
    return 'pdf';
  }
  // DOCX (and other Office Open XML files) are ZIP archives: PK\x03\x04
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return 'docx';
  }
  // Heuristic: a comma-delimited first line with 2+ fields looks like CSV.
  const sample = buffer.subarray(0, 2048).toString('utf8');
  const firstLine = sample.split(/\r?\n/, 1)[0] || '';
  if (firstLine.includes(',') && firstLine.split(',').length > 1) {
    return 'csv';
  }
  return 'txt';
}

/** Resolve the effective format: explicit request wins, otherwise auto-detect. */
function detectFormat(requested: RequestedFormat, name: string, buffer: Buffer): SupportedFormat {
  if (requested !== 'auto') {
    return requested;
  }
  return extensionFormat(name) ?? sniffFormat(buffer);
}

/** Approximate word count via whitespace splitting. */
function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Minimal RFC 4180-style CSV analyzer: counts data rows (excluding the header
 * row) and columns, handling quoted fields with embedded commas/newlines.
 * Intentionally lightweight — no external CSV dependency is required.
 */
function analyzeCsv(text: string): { row_count: number; column_count: number } {
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

  const column_count = rows.length > 0 ? rows[0].length : 0;
  const row_count = Math.max(0, rows.length - 1); // exclude header row
  return { row_count, column_count };
}

async function loadLocalFile(
  filePath: string,
  maxSizeBytes: number
): Promise<{ buffer: Buffer; resolvedPath: string }> {
  const resolvedPath = resolveLocalPath(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new MatimoError('File not found', ErrorCode.FILE_NOT_FOUND, { filePath: resolvedPath });
  }

  const stats = fs.statSync(resolvedPath);
  if (!stats.isFile()) {
    throw new MatimoError('Not a file', ErrorCode.EXECUTION_FAILED, {
      filePath: resolvedPath,
      reason: 'Path exists but is not a file',
    });
  }

  if (stats.size > maxSizeBytes) {
    throw new MatimoError('File too large', ErrorCode.EXECUTION_FAILED, {
      filePath: resolvedPath,
      size: stats.size,
      maxSizeBytes,
    });
  }

  return { buffer: fs.readFileSync(resolvedPath), resolvedPath };
}

async function loadRemoteFile(
  fileUrl: string,
  maxSizeBytes: number,
  timeout: number
): Promise<{ buffer: Buffer; resolvedUrl: string }> {
  let parsed: URL;
  try {
    parsed = new URL(fileUrl);
  } catch {
    throw new MatimoError('Invalid URL', ErrorCode.INVALID_PARAMETER, {
      fileUrl,
      reason: 'fileUrl must be a valid http or https URL',
    });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new MatimoError('Unsupported URL protocol', ErrorCode.INVALID_PARAMETER, {
      fileUrl,
      protocol: parsed.protocol,
      reason: 'Only http and https URLs are supported',
    });
  }

  if (isBlockedUrl(fileUrl)) {
    throw new MatimoError(
      'URL targets a blocked internal/metadata address',
      ErrorCode.INVALID_PARAMETER,
      { fileUrl }
    );
  }

  let response;
  try {
    response = await axios.get<ArrayBuffer>(fileUrl, {
      responseType: 'arraybuffer',
      timeout,
      maxContentLength: maxSizeBytes,
      maxBodyLength: maxSizeBytes,
      headers: { 'User-Agent': 'Matimo/1.0 (AI Agent Tool SDK)' },
      validateStatus: () => true,
    });
  } catch (error) {
    throw new MatimoError('HTTP request failed', ErrorCode.NETWORK_ERROR, {
      fileUrl,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }

  if (response.status < 200 || response.status >= 300) {
    throw new MatimoError('Failed to fetch fileUrl', ErrorCode.NETWORK_ERROR, {
      fileUrl,
      statusCode: response.status,
    });
  }

  const buffer = Buffer.from(response.data);
  if (buffer.length > maxSizeBytes) {
    throw new MatimoError('File too large', ErrorCode.EXECUTION_FAILED, {
      fileUrl,
      size: buffer.length,
      maxSizeBytes,
    });
  }

  return { buffer, resolvedUrl: fileUrl };
}

async function extractPdf(buffer: Buffer): Promise<{ text: string; metadata: ExtractMetadata }> {
  const result = await pdfParse(buffer);
  const text = result.text ?? '';
  return {
    text,
    metadata: { page_count: result.numpages, word_count: countWords(text), char_count: text.length },
  };
}

async function extractDocx(buffer: Buffer): Promise<{ text: string; metadata: ExtractMetadata }> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value ?? '';
  return { text, metadata: { word_count: countWords(text), char_count: text.length } };
}

function extractTxt(buffer: Buffer, encoding: string): { text: string; metadata: ExtractMetadata } {
  const text = buffer.toString(encoding as BufferEncoding);
  return { text, metadata: { word_count: countWords(text), char_count: text.length } };
}

function extractCsv(buffer: Buffer, encoding: string): { text: string; metadata: ExtractMetadata } {
  const text = buffer.toString(encoding as BufferEncoding);
  const { row_count, column_count } = analyzeCsv(text);
  return {
    text,
    metadata: { word_count: countWords(text), char_count: text.length, row_count, column_count },
  };
}

/**
 * Extract text content from a local or remote PDF, DOCX, TXT, or CSV file.
 */
export default async function extractFromFileTool(
  params: ExtractFromFileParams
): Promise<ExtractFromFileResult> {
  const {
    filePath,
    fileUrl,
    format = 'auto',
    encoding = 'utf8',
    maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
    timeout = DEFAULT_TIMEOUT_MS,
  } = params;

  if (!filePath && !fileUrl) {
    throw new MatimoError('Missing required parameter', ErrorCode.INVALID_PARAMETER, {
      reason: 'Provide either filePath or fileUrl',
    });
  }
  if (filePath && fileUrl) {
    throw new MatimoError('Conflicting parameters', ErrorCode.INVALID_PARAMETER, {
      reason: 'Provide exactly one of filePath or fileUrl, not both',
    });
  }

  if (format !== 'auto' && !SUPPORTED_FORMATS.includes(format)) {
    throw new MatimoError('Unsupported format', ErrorCode.INVALID_PARAMETER, {
      format,
      supported: ['auto', ...SUPPORTED_FORMATS],
    });
  }

  let buffer: Buffer;
  let source: 'filePath' | 'fileUrl';
  let sourceLocation: string;
  let nameForDetection: string;

  if (filePath) {
    const loaded = await loadLocalFile(filePath, maxSizeBytes);
    buffer = loaded.buffer;
    source = 'filePath';
    sourceLocation = loaded.resolvedPath;
    nameForDetection = loaded.resolvedPath;
  } else {
    const loaded = await loadRemoteFile(fileUrl as string, maxSizeBytes, timeout);
    buffer = loaded.buffer;
    source = 'fileUrl';
    sourceLocation = loaded.resolvedUrl;
    nameForDetection = new URL(loaded.resolvedUrl).pathname;
  }

  const formatDetected = detectFormat(format, nameForDetection, buffer);

  let extracted: { text: string; metadata: ExtractMetadata };
  switch (formatDetected) {
    case 'pdf':
      extracted = await extractPdf(buffer);
      break;
    case 'docx':
      extracted = await extractDocx(buffer);
      break;
    case 'csv':
      extracted = extractCsv(buffer, encoding);
      break;
    case 'txt':
      extracted = extractTxt(buffer, encoding);
      break;
  }

  return {
    success: true,
    extracted_text: extracted.text,
    format_detected: formatDetected,
    source,
    sourceLocation,
    size: buffer.length,
    metadata: extracted.metadata,
  };
}
