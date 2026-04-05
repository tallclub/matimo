#!/usr/bin/env node
/**
 * Read Tool - Read file contents with line range support
 * Function-type tool: Exports default async function
 */

import fs from 'fs';
import path from 'path';
import { MatimoError, ErrorCode } from '@matimo/core';

interface ReadParams {
  filePath: string;
  startLine?: number;
  endLine?: number;
  encoding?: string;
  maxLines?: number;
}

interface ReadResult {
  success: boolean;
  filePath: string;
  content: string;
  encoding: string;
  readLines: number;
  lineCount?: number;
  linesRequested?: {
    start?: number;
    end?: number;
  };
  size: number;
  mtime: string;
}

/**
 * Read file contents with optional line range
 */
export default async function readTool(params: ReadParams): Promise<ReadResult> {
  const { filePath, startLine, endLine, encoding = 'utf8', maxLines = 10000 } = params;

  // Validate required parameter
  if (!filePath) {
    throw new MatimoError('Missing required parameter', ErrorCode.INVALID_PARAMETER, {
      reason: 'filePath is required',
    });
  }

  // Resolve path
  const resolvedPath = filePath.startsWith('~')
    ? path.join(process.env.HOME || '/', filePath.slice(1))
    : path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  // Check file exists
  if (!fs.existsSync(resolvedPath)) {
    throw new MatimoError('File not found', ErrorCode.FILE_NOT_FOUND, {
      filePath: resolvedPath,
    });
  }

  // Get file stats
  const stats = fs.statSync(resolvedPath);
  if (!stats.isFile()) {
    throw new MatimoError('Not a file', ErrorCode.EXECUTION_FAILED, {
      filePath: resolvedPath,
      reason: 'Path exists but is not a file',
    });
  }

  if (stats.size > 50 * 1024 * 1024) {
    throw new MatimoError('File too large', ErrorCode.EXECUTION_FAILED, {
      filePath: resolvedPath,
      size: stats.size,
      maxSize: 50 * 1024 * 1024,
    });
  }

  // Read file
  const content = fs.readFileSync(resolvedPath, encoding as BufferEncoding);
  const lines = content.split('\n');

  // Check line count
  if (lines.length > maxLines) {
    throw new MatimoError('File exceeds maxLines limit', ErrorCode.EXECUTION_FAILED, {
      filePath: resolvedPath,
      lineCount: lines.length,
      maxLines,
    });
  }

  // Handle line range request
  let readContent = content;
  let readLines = lines.length;
  const linesRequested: { start?: number; end?: number } = {};

  if (startLine !== undefined || endLine !== undefined) {
    const start = Math.max(0, (startLine || 1) - 1); // Convert to 0-based
    const end = Math.min(lines.length, (endLine || lines.length)); // Convert to 0-based exclusive
    readContent = lines.slice(start, end).join('\n');
    readLines = end - start;
    linesRequested.start = startLine;
    linesRequested.end = endLine;
  }

  const result: ReadResult = {
    success: true,
    filePath: resolvedPath,
    content: readContent,
    encoding,
    readLines,
    lineCount: lines.length,
    linesRequested: Object.keys(linesRequested).length > 0 ? linesRequested : undefined,
    size: stats.size,
    mtime: stats.mtime.toISOString(),
  };

  return result;
}
