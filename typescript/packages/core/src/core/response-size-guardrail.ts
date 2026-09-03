/**
 * Response Size Guardrail
 *
 * Caps the size of a tool's serialized result before it reaches the caller
 * (direct SDK, LangChain, CrewAI, or MCP) — a tool result with a generous
 * page size (e.g. a Slack channel history or a HubSpot contact list) would
 * otherwise be returned unbounded, silently consuming the calling agent's
 * entire context budget.
 *
 * Precedence: per-tool `output_schema.max_response_size` (YAML) overrides
 * the instance-level `defaultMaxResponseSize` option, which overrides the
 * built-in `DEFAULT_MAX_RESPONSE_SIZE_BYTES` fallback.
 */

import type { ToolDefinition } from './schema.js';

/** Fallback cap (bytes, UTF-8) applied to every tool that doesn't declare its own. */
export const DEFAULT_MAX_RESPONSE_SIZE_BYTES = 262_144; // 256 KB

/**
 * Apply the response-size guardrail to a tool's raw execution result.
 * Returns the result unchanged when it already fits within the effective
 * limit (the common case — this is a cheap size check, not a deep clone).
 */
export function applyResponseSizeGuardrail(
  tool: ToolDefinition,
  result: unknown,
  instanceDefault?: number
): unknown {
  const limit =
    tool.output_schema?.max_response_size ?? instanceDefault ?? DEFAULT_MAX_RESPONSE_SIZE_BYTES;

  if (byteSizeOf(result) <= limit) {
    return result;
  }

  const { value, truncated } = truncateValue(result, limit);

  // Decorate only the outermost object, exactly once, regardless of how
  // deep the actual truncation happened — array/string fields already
  // carry their own inline "...truncated, N of M ..." marker.
  if (truncated && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>), _truncated: true };
  }
  return value;
}

/** Best-effort UTF-8 byte size of a value's JSON serialization. Non-serializable values (circular refs, etc.) are treated as free rather than throwing. */
function byteSizeOf(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? 0 : Buffer.byteLength(json, 'utf-8');
  } catch {
    return 0;
  }
}

function truncateValue(
  value: unknown,
  budgetBytes: number
): { value: unknown; truncated: boolean } {
  if (byteSizeOf(value) <= budgetBytes) {
    return { value, truncated: false };
  }
  if (Array.isArray(value)) {
    return truncateArray(value, budgetBytes);
  }
  if (typeof value === 'string') {
    return truncateString(value, budgetBytes);
  }
  if (value !== null && typeof value === 'object') {
    return truncateObject(value as Record<string, unknown>, budgetBytes);
  }
  // A scalar (number/boolean/null) exceeding the budget can't happen in
  // practice — leave it untouched rather than fabricating a truncated scalar.
  return { value, truncated: false };
}

function truncateArray(
  arr: unknown[],
  budgetBytes: number
): { value: unknown[]; truncated: boolean } {
  if (arr.length === 0) {
    return { value: arr, truncated: false };
  }

  // Estimate average item size from a sample rather than stringifying the
  // whole array — keeps this O(sample) instead of O(items) on huge arrays.
  const sampleSize = Math.min(arr.length, 20);
  let sampleBytes = 0;
  for (let i = 0; i < sampleSize; i++) {
    sampleBytes += byteSizeOf(arr[i]);
  }
  const avgItemBytes = Math.max(1, sampleBytes / sampleSize);
  const markerReserve = 96; // rough overhead for the marker string + surrounding JSON punctuation

  let n = Math.min(
    arr.length,
    Math.max(0, Math.floor((budgetBytes - markerReserve) / avgItemBytes))
  );
  let sliced = arr.slice(0, n);

  // Re-measure once and shrink proportionally if the estimate overshot —
  // bounded to a single extra pass rather than iterating item-by-item.
  const actualBytes = byteSizeOf(sliced);
  if (actualBytes > budgetBytes && n > 0) {
    const ratio = budgetBytes / actualBytes;
    n = Math.max(0, Math.floor(n * ratio));
    sliced = arr.slice(0, n);
  }

  const marker = `...truncated, ${n} of ${arr.length} items shown`;
  return { value: [...sliced, marker], truncated: true };
}

function truncateString(str: string, budgetBytes: number): { value: string; truncated: boolean } {
  const totalLength = str.length;
  const markerFor = (shown: number): string =>
    `...truncated, ${shown} of ${totalLength} characters shown`;
  const reserve = Buffer.byteLength(markerFor(totalLength), 'utf-8');
  const contentBudget = Math.max(0, budgetBytes - reserve);

  // Slice on the raw UTF-8 bytes then decode back — toString('utf-8') drops/
  // replaces any multi-byte character split by the cut, so this never
  // produces invalid UTF-8 even though the cut point is byte-based.
  const buf = Buffer.from(str, 'utf-8');
  const kept = buf.subarray(0, contentBudget).toString('utf-8');

  return { value: kept + markerFor(kept.length), truncated: true };
}

function truncateObject(
  obj: Record<string, unknown>,
  budgetBytes: number
): { value: Record<string, unknown>; truncated: boolean } {
  const entries = Object.entries(obj);
  // Smallest-first: small metadata fields (e.g. an HTTP envelope's
  // `statusCode`/`headers`) survive intact, and whatever budget remains
  // goes to the one field that's actually large (typically `data`).
  const sizedAscending = entries
    .map(([key, value]) => [key, value, byteSizeOf(value)] as const)
    .sort((a, b) => a[2] - b[2]);

  const truncatedByKey: Record<string, unknown> = {};
  let remaining = budgetBytes;
  let anyTruncated = false;

  for (const [key, value, size] of sizedAscending) {
    if (size <= remaining) {
      truncatedByKey[key] = value;
      remaining -= size;
    } else {
      const { value: truncatedValue, truncated } = truncateValue(value, Math.max(remaining, 0));
      truncatedByKey[key] = truncatedValue;
      anyTruncated = anyTruncated || truncated;
      remaining = 0;
    }
  }

  // Restore original key order for predictability.
  const ordered: Record<string, unknown> = {};
  for (const [key] of entries) {
    ordered[key] = truncatedByKey[key];
  }

  return { value: ordered, truncated: anyTruncated };
}
