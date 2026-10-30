/**
 * Runtime-safe public surface for built-in tool files.
 *
 * Keep this entrypoint intentionally narrow to avoid coupling tools to the
 * full package barrel and to reduce circular dependency risk.
 */

export { MatimoError, ErrorCode } from '../errors/matimo-error.js';
export { getGlobalMatimoLogger } from '../logging/index.js';
export { getGlobalApprovalHandler } from '../approval/approval-handler.js';
export { isBlockedUrl } from '../policy/ssrf.js';
export { ssrfHttpAgent, ssrfHttpsAgent, ssrfBeforeRedirect } from '../executors/ssrf-guard.js';
export { resolveToolPath } from '../policy/file-roots.js';
