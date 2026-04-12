#!/usr/bin/env node
/**
 * Edit Tool - Edit files with insert/replace/delete/append operations
 * Function-type tool: Exports default async function
 */

import fs from 'fs';
import path from 'path';
import { MatimoError, ErrorCode } from '@matimo/core';

interface EditParams {
  filePath: string;
  operation: string;
  content?: string;
  startLine: number;
  endLine?: number;
  backup?: boolean;
}

interface EditResult {
  success: boolean;
  filePath: string;
  operation: string;
  linesAffected: number;
  backupCreated: boolean;
  backupPath?: string;
  previousContent?: string;
  newLineCount: number;
  duration: number;
}

/**
 * Edit file with insert/replace/delete/append operations
 */
export default async function editTool(params: EditParams): Promise<EditResult> {
  const { filePath, operation, content = '', startLine, endLine, backup = true } = params;
  const startTime = Date.now();

  // Validate required parameters
  if (!filePath) {
    throw new MatimoError('Missing required parameter', ErrorCode.INVALID_PARAMETER, {
      reason: 'filePath is required',
    });
  }

  if (!operation) {
    throw new MatimoError('Missing required parameter', ErrorCode.INVALID_PARAMETER, {
      reason: 'operation is required',
    });
  }

  if (startLine === undefined) {
    throw new MatimoError('Missing required parameter', ErrorCode.INVALID_PARAMETER, {
      reason: 'startLine is required',
    });
  }

  // Resolve path
  const resolvedPath = filePath.startsWith('~')
    ? path.join(process.env.HOME || '/', filePath.slice(1))
    : path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  // Validate file exists
  if (!fs.existsSync(resolvedPath)) {
    throw new MatimoError('File not found', ErrorCode.FILE_NOT_FOUND, {
      filePath: resolvedPath,
    });
  }

  // Approval is handled by MatimoInstance based on 'requires_approval' in YAML

  // Read original content
  const originalContent = fs.readFileSync(resolvedPath, 'utf8');
  const lines = originalContent.split('\n');

  const result: EditResult = {
    success: false,
    filePath: resolvedPath,
    operation,
    linesAffected: 0,
    backupCreated: false,
    newLineCount: 0,
    duration: 0,
  };

  const newLines: string[] = [...lines];
  let backupPath: string | undefined;
  let previousContent: string | undefined;

  // Create backup if requested
  if (backup) {
    backupPath = `${resolvedPath}.backup`;
    fs.writeFileSync(backupPath, originalContent, 'utf8');
    result.backupCreated = true;
    result.backupPath = backupPath;
  }

  // Validate line numbers (1-based)
  if (startLine < 1) {
    throw new MatimoError('Invalid line number', ErrorCode.INVALID_PARAMETER, {
      startLine,
      reason: 'startLine must be >= 1',
    });
  }

  // Convert to 0-based indexing
  const startIdx = startLine - 1;
  const endIdx = endLine ? endLine - 1 : startIdx;

  switch (operation) {
    case 'insert': {
      // Insert before startLine
      if (startIdx > newLines.length) {
        throw new MatimoError('Invalid line range', ErrorCode.INVALID_PARAMETER, {
          startLine,
          reason: `startLine ${startLine} is beyond file length ${newLines.length}`,
        });
      }
      const contentLines = content.split('\n');
      newLines.splice(startIdx, 0, ...contentLines);
      result.linesAffected = contentLines.length;
      break;
    }

    case 'replace': {
      // Replace lines from startLine to endLine
      if (startIdx >= newLines.length || endIdx >= newLines.length) {
        throw new MatimoError('Invalid line range', ErrorCode.INVALID_PARAMETER, {
          startLine,
          endLine,
          fileLineCount: newLines.length,
          reason: `Line range ${startLine}-${endLine} out of bounds`,
        });
      }
      previousContent = newLines.slice(startIdx, endIdx + 1).join('\n');
      const contentLines = content.split('\n');
      newLines.splice(startIdx, endIdx - startIdx + 1, ...contentLines);
      result.linesAffected = endIdx - startIdx + 1;
      result.previousContent = previousContent;
      break;
    }

    case 'delete': {
      // Delete lines from startLine to endLine
      if (startIdx >= newLines.length || endIdx >= newLines.length) {
        throw new MatimoError('Invalid line range', ErrorCode.INVALID_PARAMETER, {
          startLine,
          endLine,
          fileLineCount: newLines.length,
          reason: `Line range ${startLine}-${endLine} out of bounds`,
        });
      }
      previousContent = newLines.slice(startIdx, endIdx + 1).join('\n');
      newLines.splice(startIdx, endIdx - startIdx + 1);
      result.linesAffected = endIdx - startIdx + 1;
      result.previousContent = previousContent;
      break;
    }

    case 'append': {
      // Append to end of file
      const contentLines = content.split('\n');
      newLines.push(...contentLines);
      result.linesAffected = contentLines.length;
      break;
    }

    default: {
      throw new MatimoError('Unknown operation', ErrorCode.INVALID_PARAMETER, {
        operation,
        supportedOperations: ['insert', 'replace', 'delete', 'append'],
      });
    }
  }

  // Write new content
  const newContent = newLines.join('\n');
  fs.writeFileSync(resolvedPath, newContent, 'utf8');

  result.success = true;
  result.newLineCount = newLines.length;
  result.duration = Date.now() - startTime;

  return result;
}
