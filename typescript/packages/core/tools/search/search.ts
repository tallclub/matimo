#!/usr/bin/env node
/**
 * Search Tool - Search files with native Node.js fs and regex
 * Function-type tool: Exports default async function
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { MatimoError, ErrorCode, getGlobalMatimoLogger } from '@matimo/core';

interface SearchMatch {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchIndex: number;
  context: string[];
}

interface SearchParams {
  query: string;
  directory?: string;
  filePattern?: string;
  isRegex?: boolean;
  caseSensitive?: boolean;
  maxResults?: number;
  contextLines?: number;
  excludePatterns?: string[];
}

interface SearchResult {
  success: boolean;
  query: string;
  directory: string;
  pattern: string;
  matches: SearchMatch[];
  totalMatches: number;
  filesSearched: number;
  duration: number;
  truncated: boolean;
}

/**
 * Search files for pattern matches
 */
export default async function searchTool(params: SearchParams): Promise<SearchResult> {
  const logger = getGlobalMatimoLogger();
  const {
    query,
    directory = '.',
    filePattern = '**/*',
    isRegex = false,
    caseSensitive = false,
    maxResults = 50,
    contextLines = 2,
    excludePatterns = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
  } = params;

  const startTime = Date.now();

  logger.debug('Search tool invoked', {
    query: query.substring(0, 100),
    directory,
    isRegex,
    caseSensitive,
    maxResults,
  });

  // Validate required parameter
  if (!query) {
    logger.error('Search tool: Missing required parameter', {
      reason: 'query is required',
    });
    throw new MatimoError('Missing required parameter', ErrorCode.INVALID_PARAMETER, {
      reason: 'query is required',
    });
  }

  // Resolve directory
  const resolvedDir = directory.startsWith('~')
    ? path.join(process.env.HOME || '/', directory.slice(1))
    : path.isAbsolute(directory)
    ? directory
    : path.resolve(process.cwd(), directory);

  if (!fs.existsSync(resolvedDir)) {
    logger.error('Search tool: Directory not found', {
      directory: resolvedDir,
    });
    throw new MatimoError('Directory not found', ErrorCode.FILE_NOT_FOUND, {
      directory: resolvedDir,
    });
  }

  // Build search pattern
  let searchRegex: RegExp;
  try {
    if (isRegex) {
      searchRegex = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } else {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchRegex = new RegExp(escapedQuery, caseSensitive ? 'g' : 'gi');
    }
  } catch {
    throw new MatimoError('Invalid regex pattern', ErrorCode.INVALID_PARAMETER, {
      pattern: query,
      isRegex,
    });
  }

  // Enforce max results cap
  const safeMaxResults = Math.min(maxResults, 1000);

  // Find files matching pattern
  const globPattern = path.join(resolvedDir, filePattern);
  let files: string[] = [];

  try {
    files = await glob(globPattern, {
      nodir: true,
      absolute: true,
      ignore: excludePatterns,
    });
  } catch {
    throw new MatimoError('Invalid glob pattern', ErrorCode.INVALID_PARAMETER, {
      pattern: filePattern,
      baseDirectory: resolvedDir,
    });
  }

  const matches: SearchMatch[] = [];
  let filesSearched = 0;

  // Search each file
  for (const filePath of files) {
    if (matches.length >= safeMaxResults) break;

    try {

      // Skip binary files
      const stats = fs.statSync(filePath);
      if (stats.size > 5 * 1024 * 1024) continue; // Skip files > 5MB

      filesSearched++;
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        if (matches.length >= safeMaxResults) break;

        const line = lines[lineNum];
        const lineContent = line.trim();
        const match = searchRegex.exec(line);

        if (match) {
          // Get context lines
          const contextStart = Math.max(0, lineNum - contextLines);
          const contextEnd = Math.min(lines.length, lineNum + contextLines + 1);
          const context = lines.slice(contextStart, contextEnd);

          matches.push({
            filePath,
            lineNumber: lineNum + 1,
            lineContent,
            matchIndex: match.index,
            context,
          });

          // Reset regex for next exec
          searchRegex.lastIndex = 0;
        }
      }
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  const result: SearchResult = {
    success: true,
    query,
    directory: resolvedDir,
    pattern: filePattern,
    matches,
    totalMatches: matches.length,
    filesSearched,
    duration: Date.now() - startTime,
    truncated: matches.length >= safeMaxResults && files.length > filesSearched,
  };

  return result;
}
