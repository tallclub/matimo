import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import * as yaml from 'js-yaml';
import { validateToolDefinition, ToolDefinition } from '@matimo/core';
import { ToolCorpusEntry } from './tool-selection-matcher.js';

export interface LoadedTool {
  definition: ToolDefinition;
  packageName: string;
  definitionPath: string;
}

/**
 * Load every tool definition across the workspace — reuses the same glob
 * shape as `scripts/validate-tool.ts` (`packages/<name>/tools/**​/definition.yaml`)
 * so the eval corpus always reflects the real, currently-registered tool
 * catalog, not a hand-maintained subset.
 */
export async function loadToolCorpus(packagesDir: string): Promise<LoadedTool[]> {
  const files = await glob('*/tools/**/definition.yaml', { cwd: packagesDir, absolute: true });
  const loaded: LoadedTool[] = [];

  for (const file of files.sort()) {
    const parsed = yaml.load(fs.readFileSync(file, 'utf-8'));
    // Provider-level definition.yaml (e.g. composio's) is `type: provider`, not a tool — skip it.
    if ((parsed as { type?: string } | null)?.type === 'provider') continue;

    const definition = validateToolDefinition(parsed);
    const packageName = path.relative(packagesDir, file).split(path.sep)[0];
    loaded.push({ definition, packageName, definitionPath: file });
  }

  return loaded;
}

export function toCorpusEntry(tool: ToolDefinition): ToolCorpusEntry {
  const parameterDescriptions = tool.parameters
    ? Object.values(tool.parameters).map((p) => p.description ?? '')
    : [];
  return {
    name: tool.name,
    description: tool.description,
    parameterDescriptions,
  };
}
