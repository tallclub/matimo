import { getGlobalMatimoInstance, getGlobalMatimoLogger, type SkillContentOptions } from '@matimo/core';

interface GetSkillContentParams {
  name: string;
  sections?: string[];
  max_tokens?: number;
  include_preamble?: boolean;
  max_depth?: number;
}

interface GetSkillContentResult {
  success: boolean;
  name: string;
  content?: string;
  tokensUsed?: number;
  message: string;
}

/** Rough heuristic: 1 token ≈ 0.75 words (mirrors the core skill-content-parser estimate). */
function estimateTokens(text: string): number {
  if (!text) return 0;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount / 0.75);
}

/**
 * Load only specific sections of a skill — thin wrapper around
 * `MatimoInstance.getSkillContent()`, exposed as an agent-callable
 * meta-tool for token-efficient, selective context loading.
 *
 * @see https://agentskills.io/specification
 */
export default async function matimoGetSkillContent(
  params: GetSkillContentParams,
): Promise<GetSkillContentResult> {
  const logger = getGlobalMatimoLogger();
  const name = (params.name ?? '').trim();

  if (!name) {
    return { success: false, name, message: 'Skill name is required' };
  }

  let instance: ReturnType<typeof getGlobalMatimoInstance> | null;
  try {
    instance = getGlobalMatimoInstance();
  } catch {
    instance = null;
  }

  if (!instance) {
    return {
      success: false,
      name,
      message:
        'No active Matimo instance found. Selective content loading requires an initialized MatimoInstance.',
    };
  }

  const options: SkillContentOptions = {
    sections: params.sections,
    maxTokens: params.max_tokens,
    includePreamble: params.include_preamble,
    maxDepth: params.max_depth,
  };

  const content = instance.getSkillContent(name, options);
  if (content === null) {
    return { success: false, name, message: `Skill "${name}" not found` };
  }

  const tokensUsed = estimateTokens(content);
  logger.debug('matimo_get_skill_content: retrieved', { name, tokensUsed });

  return {
    success: true,
    name,
    content,
    tokensUsed,
    message: `Retrieved content for skill "${name}" (${tokensUsed} tokens).`,
  };
}
