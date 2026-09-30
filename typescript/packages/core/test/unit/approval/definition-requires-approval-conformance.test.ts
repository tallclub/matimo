import fs from 'fs';
import path from 'path';
import { definitionRequiresApproval } from '../../../src/approval/approval-handler';
import type { ToolDefinition } from '../../../src/core/schema';

/**
 * Cross-SDK conformance: the same fixture is asserted by
 * python/packages/core/tests/unit/test_definition_requires_approval_conformance.py,
 * so both SDKs ask for per-call approval on exactly the same tool definitions.
 */
interface ConformanceCase {
  name: string;
  tool: Partial<ToolDefinition> & { execution: Record<string, unknown> };
  expected: boolean;
}

const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../../../../conformance/approval/definition-requires-approval.json'
    ),
    'utf8'
  )
) as { cases: ConformanceCase[] };

/** Fill in the fields the fixture leaves out because they don't affect the answer. */
function buildTool(testCase: ConformanceCase): ToolDefinition {
  const execution =
    testCase.tool.execution.type === 'http'
      ? { url: 'https://api.example.com/x', ...testCase.tool.execution }
      : testCase.tool.execution;
  return {
    name: testCase.name,
    version: '1.0.0',
    description: 'conformance case',
    parameters: {},
    ...testCase.tool,
    execution,
  } as ToolDefinition;
}

describe('definitionRequiresApproval conformance', () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (_name, testCase) => {
    expect(definitionRequiresApproval(buildTool(testCase))).toBe(testCase.expected);
  });
});
