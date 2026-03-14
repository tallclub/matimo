import { MatimoInstance } from '../../../core/src/matimo-instance';
import * as path from 'path';

describe('Mailchimp Tools Integration', () => {
  let matimo: MatimoInstance;

  beforeAll(async () => {
    const toolsPath = path.join(__dirname, '../../tools');
    matimo = await MatimoInstance.init(toolsPath);
  });

  it('should load all 7 Mailchimp tools', () => {
    const tools = matimo.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('mailchimp-get-lists');
    expect(toolNames).toContain('mailchimp-add-list-member');
    expect(toolNames).toContain('mailchimp-get-list-members');
    expect(toolNames).toContain('mailchimp-update-list-member');
    expect(toolNames).toContain('mailchimp-remove-list-member');
    expect(toolNames).toContain('mailchimp-create-campaign');
    expect(toolNames).toContain('mailchimp-send-campaign');

    const mailchimpTools = toolNames.filter((n) => n.startsWith('mailchimp-'));
    expect(mailchimpTools.length).toBe(7);
  });

  it('should have requires_approval set for destructive tools', () => {
    const tools = matimo.listTools();
    const approvalTools = ['mailchimp-remove-list-member', 'mailchimp-send-campaign'];

    approvalTools.forEach((toolName) => {
      const tool = tools.find((t) => t.name === toolName);
      expect(tool).toBeDefined();
      expect(tool?.requires_approval).toBe(true);
    });
  });

  it('should have requires_approval NOT set for read/create tools', () => {
    const tools = matimo.listTools();
    const safeTools = [
      'mailchimp-get-lists',
      'mailchimp-add-list-member',
      'mailchimp-get-list-members',
      'mailchimp-update-list-member',
      'mailchimp-create-campaign',
    ];

    safeTools.forEach((toolName) => {
      const tool = tools.find((t) => t.name === toolName);
      expect(tool).toBeDefined();
      expect(tool?.requires_approval).toBeFalsy();
    });
  });

  it('should execute mailchimp-get-lists with valid parameters', async () => {
    const apiKey = process.env.MAILCHIMP_API_KEY;
    if (!apiKey) {
      console.info('Skipping live test - MAILCHIMP_API_KEY not set');
      return;
    }

    const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX || apiKey.split('-').pop() || 'us6';

    const result = (await matimo.execute('mailchimp-get-lists', {
      server_prefix: serverPrefix,
      count: 5,
    })) as { success: boolean; data: { lists: unknown[]; total_items: number } };

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data.lists)).toBe(true);
    expect(typeof result.data.total_items).toBe('number');
  });

  it('should execute mailchimp-get-list-members with valid parameters', async () => {
    const apiKey = process.env.MAILCHIMP_API_KEY;
    const listId = process.env.MAILCHIMP_TEST_LIST_ID;
    if (!apiKey || !listId) {
      console.info('Skipping live test - MAILCHIMP_API_KEY or MAILCHIMP_TEST_LIST_ID not set');
      return;
    }

    const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX || apiKey.split('-').pop() || 'us6';

    const result = (await matimo.execute('mailchimp-get-list-members', {
      server_prefix: serverPrefix,
      list_id: listId,
      count: 5,
      offset: 0,
    })) as { success: boolean; data: { members: unknown[]; total_items: number } };

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data.members)).toBe(true);
  });

  it('should execute mailchimp-add-list-member', async () => {
    const apiKey = process.env.MAILCHIMP_API_KEY;
    const listId = process.env.MAILCHIMP_TEST_LIST_ID;
    if (!apiKey || !listId) {
      console.info('Skipping live test - MAILCHIMP_API_KEY or MAILCHIMP_TEST_LIST_ID not set');
      return;
    }

    const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX || apiKey.split('-').pop() || 'us6';
    const testEmail = `matimo-test-${Date.now()}@example.com`;

    const result = (await matimo.execute('mailchimp-add-list-member', {
      server_prefix: serverPrefix,
      list_id: listId,
      email_address: testEmail,
      status: 'subscribed',
      merge_fields: { FNAME: 'Matimo', LNAME: 'Test' },
    })) as { success: boolean; data: { id: string; email_address: string; status: string } };

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data.email_address).toBe(testEmail);
    expect(result.data.status).toBe('subscribed');
    expect(result.data.id).toBeDefined();

    // Cleanup: remove the test member to avoid polluting real Mailchimp audiences
    const subscriberHash = result.data.id;
    const cleanupResult = (await matimo.execute('mailchimp-remove-list-member', {
      server_prefix: serverPrefix,
      list_id: listId,
      subscriber_hash: subscriberHash,
    })) as { success: boolean; statusCode: number };
    expect(cleanupResult.success).toBe(true);
  });

  it('should not expose API key in error output', async () => {
    const apiKey = process.env.MAILCHIMP_API_KEY;
    if (!apiKey) {
      console.info('Skipping live test - MAILCHIMP_API_KEY not set');
      return;
    }
    const serverPrefix = apiKey.split('-').pop() || 'us6';

    try {
      await matimo.execute('mailchimp-get-list-members', {
        server_prefix: serverPrefix,
        list_id: 'invalid_list_id_that_does_not_exist',
        count: 5,
      });
    } catch (error: unknown) {
      const errorString = JSON.stringify(error);
      expect(errorString).not.toContain(apiKey);
      // Error is expected - just verify no key exposure
    }
  }, 15000);
});
