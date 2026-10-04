import fs from 'fs';
import path from 'path';
import { DefaultPolicyEngine } from '../../../src/policy/default-policy';
import type { PolicyContext } from '../../../src/policy/types';
import type { ToolDefinition } from '../../../src/core/schema';

/**
 * Cross-SDK conformance: the same fixture is asserted by
 * python/packages/core/tests/unit/test_execution_gates_conformance.py,
 * so both SDKs must gate draft, deprecated and approval-required tools the
 * same way for every caller environment and role.
 */
interface GateCase {
  tool: ToolDefinition;
  expected: Record<string, 'allowed' | 'denied'>;
}

const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../../../conformance/policy/execution-gates.json'),
    'utf8'
  )
) as { contexts: Record<string, PolicyContext>; cases: GateCase[] };

describe('execution gates conformance', () => {
  describe.each(fixture.cases.map((c) => [c.tool.name, c] as const))('%s', (_name, testCase) => {
    it.each(Object.entries(testCase.expected))('for %s → %s', (contextName, expected) => {
      const decision = new DefaultPolicyEngine().canExecute(
        fixture.contexts[contextName],
        testCase.tool
      );
      expect(decision.allowed === true ? 'allowed' : 'denied').toBe(expected);
    });
  });
});
