import matimoValidateTool from '../../../tools/matimo_validate_tool/matimo_validate_tool';

describe('matimo_validate_tool', () => {
  it('should validate a correct HTTP tool definition', async () => {
    const yaml = `
name: test_tool
version: '1.0.0'
description: 'A test HTTP tool'
requires_approval: true
status: draft
parameters:
  query:
    type: string
    required: true
    description: 'Search query'
execution:
  type: http
  method: GET
  url: 'https://api.example.com/search?q={query}'
`;

    const result = await matimoValidateTool({ yaml_content: yaml });
    expect(result.valid).toBe(true);
    expect(result.schemaErrors).toHaveLength(0);
    expect(result.riskLevel).toBe('high'); // requires_approval: true → high risk
  });

  it('should return schema errors for invalid YAML', async () => {
    const result = await matimoValidateTool({ yaml_content: ': : invalid yaml : [' });
    expect(result.valid).toBe(false);
    expect(result.schemaErrors.length).toBeGreaterThan(0);
  });

  it('should return schema errors for missing required fields', async () => {
    const yaml = `
name: incomplete
description: 'Missing version and execution'
`;
    const result = await matimoValidateTool({ yaml_content: yaml });
    expect(result.valid).toBe(false);
    expect(result.schemaErrors.length).toBeGreaterThan(0);
  });

  it('should detect policy violations for SSRF URLs', async () => {
    const yaml = `
name: ssrf_tool
version: '1.0.0'
description: 'SSRF tool'
execution:
  type: http
  method: GET
  url: 'http://169.254.169.254/latest/meta-data'
`;

    const result = await matimoValidateTool({ yaml_content: yaml });
    expect(result.valid).toBe(false);
    expect(result.policyViolations.some((v: { rule: string }) => v.rule === 'no-ssrf')).toBe(true);
  });

  it('should classify function tools as critical risk', async () => {
    const yaml = `
name: func_tool
version: '1.0.0'
description: 'Function tool'
execution:
  type: function
  code: './func.ts'
`;

    const result = await matimoValidateTool({ yaml_content: yaml });
    expect(result.riskLevel).toBe('critical');
    // Should also have policy violation for function execution from untrusted
    expect(
      result.policyViolations.some((v: { rule: string }) => v.rule === 'no-function-execution')
    ).toBe(true);
  });

  it('should classify HTTP POST tools as medium risk', async () => {
    const yaml = `
name: post_tool
version: '1.0.0'
description: 'POST tool'
execution:
  type: http
  method: POST
  url: 'https://api.example.com/data'
  body:
    key: value
`;

    const result = await matimoValidateTool({ yaml_content: yaml });
    expect(result.riskLevel).toBe('medium');
  });

  it('should detect forced-approval violation for untrusted tools without requires_approval', async () => {
    const yaml = `
name: no_approval_tool
version: '1.0.0'
description: 'Tool without approval'
requires_approval: false
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`;

    const result = await matimoValidateTool({ yaml_content: yaml });
    expect(
      result.policyViolations.some((v: { rule: string }) => v.rule === 'forced-approval')
    ).toBe(true);
  });
});
