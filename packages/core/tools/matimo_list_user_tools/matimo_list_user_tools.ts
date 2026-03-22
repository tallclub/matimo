import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
  validateToolDefinition,
  classifyRisk,
  getGlobalMatimoLogger,
} from '@matimo/core';

interface ListParams {
  tool_dir?: string;
  include_drafts?: boolean;
}

interface ToolSummary {
  name: string;
  description: string;
  version: string;
  status: string;
  riskLevel: string;
  tags: string[];
}

interface ListResult {
  tools: ToolSummary[];
  total: number;
}

export default async function matimoListUserTools(
  params: ListParams,
): Promise<ListResult> {
  const logger = getGlobalMatimoLogger();
  const toolDir = params.tool_dir || './matimo-tools';
  const includeDrafts = params.include_drafts !== false;

  const tools: ToolSummary[] = [];

  if (!fs.existsSync(toolDir)) {
    return { tools: [], total: 0 };
  }

  const entries = fs.readdirSync(toolDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const defPath = path.join(toolDir, entry.name, 'definition.yaml');
    if (!fs.existsSync(defPath)) continue;

    try {
      const content = fs.readFileSync(defPath, 'utf-8');
      const parsed = yaml.load(content);
      const tool = validateToolDefinition(parsed);

      const status = tool.status || 'approved';
      if (!includeDrafts && status === 'draft') continue;

      tools.push({
        name: tool.name,
        description: tool.description,
        version: tool.version,
        status,
        riskLevel: classifyRisk(tool),
        tags: tool.tags || [],
      });
    } catch (err) {
      logger.warn('matimo_list_user_tools: failed to parse tool', {
        dir: entry.name,
        error: (err as Error).message,
      });
    }
  }

  return { tools, total: tools.length };
}
