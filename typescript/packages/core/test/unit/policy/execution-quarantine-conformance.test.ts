import fs from 'fs';
import path from 'path';
import { DefaultPolicyEngine } from '../../../src/policy/default-policy';
import { classifyExecutionRisk } from '../../../src/policy/risk-classifier';
import type { PolicyConfig, RiskLevel } from '../../../src/policy/types';
import type { ToolDefinition } from '../../../src/core/schema';

/**
 * Cross-SDK conformance: the same fixture is asserted by
 * python/packages/core/tests/unit/test_execution_quarantine_conformance.py,
 * so both SDKs must quarantine exactly the same tools under the same config.
 */
interface ConformanceCase {
  tool: ToolDefinition;
  executionRisk: RiskLevel;
  expected: Record<string, 'allowed' | 'pending_approval'>;
}

const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../../../conformance/policy/execution-quarantine.json'),
    'utf8'
  )
) as { configs: Record<string, PolicyConfig>; cases: ConformanceCase[] };

describe('execution quarantine conformance', () => {
  describe.each(fixture.cases.map((c) => [c.tool.name, c] as const))('%s', (_name, testCase) => {
    it('classifies execution risk', () => {
      expect(classifyExecutionRisk(testCase.tool)).toBe(testCase.executionRisk);
    });

    it.each(Object.entries(testCase.expected))('under %s → %s', (configName, expected) => {
      const engine = new DefaultPolicyEngine(fixture.configs[configName]);
      const decision = engine.canExecute({}, testCase.tool);
      expect(decision.allowed === true ? 'allowed' : decision.allowed).toBe(expected);
    });
  });
});
