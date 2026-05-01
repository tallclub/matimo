import { getGlobalMatimoInstance, getGlobalMatimoLogger, validateToolDefinition, classifyRisk } from '@matimo/core';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface SearchParams {
  query: string;
  limit?: number;
}

interface ToolSummary {
  name: string;
  description: string;
  version: string;
  tags: string[];
  riskLevel: string;
}

interface SearchResult {
  results: ToolSummary[];
  total: number;
  query: string;
}

export default async function matimoSearchTools(params: SearchParams): Promise<SearchResult> {
  const logger = getGlobalMatimoLogger();
  const query = params.query ?? '';
  const limit = params.limit ?? 20;

  const toSummary = (tool: { name: string; description: string; version: string; tags?: string[] }): ToolSummary => ({
    name: tool.name,
    description: tool.description,
    version: tool.version,
    tags: tool.tags ?? [],
    riskLevel: classifyRisk(tool as Parameters<typeof classifyRisk>[0]),
  });

  // Prefer registry search via the global instance (has all loaded tools)
  try {
    const instance = getGlobalMatimoInstance();
    const found = instance.searchTools(query).slice(0, limit);
    logger.debug('matimo_search_tools: registry search', { query, count: found.length });
    return {
      results: found.map(toSummary),
      total: found.length,
      query,
    };
  } catch {
    // Global instance not set — fall through to disk-based scan below
    logger.debug('matimo_search_tools: no global instance, falling back to disk scan');
  }

  // Fallback: scan the default tools directory
  const toolDir = './matimo-tools';
  if (!fs.existsSync(toolDir)) {
    return { results: [], total: 0, query };
  }

  const lowerQuery = query.toLowerCase();
  const results: ToolSummary[] = [];

  for (const entry of fs.readdirSync(toolDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const defPath = path.join(toolDir, entry.name, 'definition.yaml');
    if (!fs.existsSync(defPath)) continue;

    try {
      const tool = validateToolDefinition(yaml.load(fs.readFileSync(defPath, 'utf-8')));
      const matches =
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        (tool.tags ?? []).some((t) => t.toLowerCase().includes(lowerQuery));

      if (matches) results.push(toSummary(tool));
    } catch {
      // Skip invalid definitions silently
    }
    if (results.length >= limit) break;
  }

  return { results, total: results.length, query };
}
