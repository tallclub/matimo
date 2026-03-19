import { getGlobalMatimoLogger } from '@matimo/core';

/**
 * matimo_reload_tools — Hot-reload all tools from configured toolPaths.
 *
 * NOTE: This function is a placeholder. The actual reload logic is intercepted
 * and handled directly by MatimoInstance.execute() because reloadTools() is a
 * method on the instance itself (it clears the registry, re-reads YAML from
 * disk, re-validates untrusted tools, etc.). The function executor cannot do
 * this because it doesn't have a reference to the MatimoInstance.
 *
 * If this file is ever reached (e.g., in tests without the interception),
 * it returns an error instructing the caller to use matimo.reloadTools() directly.
 */
export default async function matimoReloadTools(): Promise<{
  success: boolean;
  message: string;
}> {
  const logger = getGlobalMatimoLogger();
  logger.warn(
    'matimo_reload_tools: reached fallback implementation — this should be intercepted by MatimoInstance.execute()',
  );

  return {
    success: false,
    message:
      'Reload must be handled by MatimoInstance. If you see this, the interception in execute() is not active.',
  };
}
