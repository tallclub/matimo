import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { validateToolDefinition, getGlobalMatimoLogger } from '@matimo/core';

interface GetToolParams {
  name: string;
  tool_dir?: string;
}

interface GetToolResult {
  found: boolean;
  name?: string;
  yaml_content?: string;
  definition?: Record<string, unknown>;
  message: string;
}

export default async function matimoGetTool(params: GetToolParams): Promise<GetToolResult> {
  const logger = getGlobalMatimoLogger();
  const toolDir = params.tool_dir ?? './matimo-tools';

  const defPath = path.join(toolDir, params.name, 'definition.yaml');
  if (!fs.existsSync(defPath)) {
    logger.warn('matimo_get_tool: tool not found', { name: params.name, path: defPath });
    return { found: false, message: `Tool "${params.name}" not found at ${defPath}` };
  }

  const yamlContent = fs.readFileSync(defPath, 'utf-8');

  let definition: Record<string, unknown>;
  try {
    const parsed = yaml.load(yamlContent);
    const validated = validateToolDefinition(parsed);
    // Omit internal _definitionPath from the returned object
    const { _definitionPath: _, ...rest } = validated as Record<string, unknown>;
    definition = rest;
  } catch (err) {
    return {
      found: true,
      name: params.name,
      yaml_content: yamlContent,
      message: `Tool YAML is invalid: ${(err as Error).message}`,
    };
  }

  logger.debug('matimo_get_tool: retrieved', { name: params.name });

  return {
    found: true,
    name: params.name,
    yaml_content: yamlContent,
    definition,
    message: `Tool "${params.name}" retrieved successfully`,
  };
}
