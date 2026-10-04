import {
  APPROVAL_ELICITATION_SCHEMA,
  approvalElicitationMessage,
  createElicitationApprovalCallback,
  type ElicitingServer,
} from '../../../src/mcp/approval-elicitation';
import { MatimoError } from '../../../src/errors/matimo-error';

function fakeServer(
  capabilities: { elicitation?: unknown } | undefined,
  answer: { action: string; content?: Record<string, unknown> } = { action: 'accept' }
) {
  const elicitInput = jest.fn().mockResolvedValue(answer);
  const server: ElicitingServer = { getClientCapabilities: () => capabilities, elicitInput };
  return { server, elicitInput };
}

const request = { toolName: 'wipe', description: 'Delete a record', params: { id: 42 } };

describe('createElicitationApprovalCallback', () => {
  it.each([
    ['accept + approve', { action: 'accept', content: { approve: true } }, true],
    ['accept + decline box', { action: 'accept', content: { approve: false } }, false],
    ['accept without content', { action: 'accept' }, false],
    ['decline', { action: 'decline' }, false],
    ['cancel', { action: 'cancel' }, false],
  ])('%s → %s', async (_label, answer, expected) => {
    const { server } = fakeServer({ elicitation: {} }, answer);
    await expect(createElicitationApprovalCallback(server)(request)).resolves.toBe(expected);
  });

  it('asks with the approval schema and ties the request to the tool call', async () => {
    const { server, elicitInput } = fakeServer({ elicitation: {} });
    await createElicitationApprovalCallback(server, 'req-1')(request);
    expect(elicitInput).toHaveBeenCalledWith(
      {
        message: approvalElicitationMessage(request),
        requestedSchema: APPROVAL_ELICITATION_SCHEMA,
      },
      { relatedRequestId: 'req-1' }
    );
  });

  it.each([
    ['client without elicitation', fakeServer({}).server],
    ['client without capabilities', fakeServer(undefined).server],
    ['no low-level server', undefined],
  ])('fails with an actionable error for a %s', async (_label, server) => {
    const failure = createElicitationApprovalCallback(server)(request);
    await expect(failure).rejects.toBeInstanceOf(MatimoError);
    await expect(failure).rejects.toThrow(/does not support elicitation/);
  });
});

describe('approvalElicitationMessage', () => {
  it('shows the tool, its description and the arguments', () => {
    const message = approvalElicitationMessage(request);
    expect(message).toContain('"wipe"');
    expect(message).toContain('Delete a record');
    expect(message).toContain('"id": 42');
  });

  it('truncates very long arguments', () => {
    const message = approvalElicitationMessage({
      toolName: 't',
      params: { blob: 'x'.repeat(5000) },
    });
    expect(message).toContain('(truncated)');
    expect(message.length).toBeLessThan(2300);
  });
});
