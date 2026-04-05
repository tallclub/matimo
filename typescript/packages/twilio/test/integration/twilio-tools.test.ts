import { MatimoInstance } from '../../../core/src/matimo-instance';
import * as path from 'path';

describe('Twilio Tools Integration', () => {
  let matimo: MatimoInstance;

  beforeAll(async () => {
    const toolsPath = path.join(__dirname, '../../tools');
    matimo = await MatimoInstance.init(toolsPath);
  });

  it('should load all 4 Twilio tools', () => {
    const tools = matimo.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('twilio-send-sms');
    expect(toolNames).toContain('twilio-send-mms');
    expect(toolNames).toContain('twilio-get-message');
    expect(toolNames).toContain('twilio-list-messages');

    const twilioTools = toolNames.filter((n) => n.startsWith('twilio-'));
    expect(twilioTools.length).toBe(4);
  });

  it('should have requires_approval NOT set for any Twilio tool', () => {
    const tools = matimo.listTools();
    const twilioTools = tools.filter((t) => t.name.startsWith('twilio-'));

    twilioTools.forEach((tool) => {
      expect(tool.requires_approval).toBeFalsy();
    });
  });

  it('should have valid execution config for all Twilio tools', () => {
    const tools = matimo.listTools();
    const twilioTools = tools.filter((t) => t.name.startsWith('twilio-'));

    twilioTools.forEach((tool) => {
      expect(tool.execution).toBeDefined();
      expect(tool.execution.type).toBe('http');

      const httpExecution = tool.execution as { type: string; method: string; url: string };
      expect(['GET', 'POST']).toContain(httpExecution.method);
      expect(httpExecution.url).toContain('api.twilio.com/2010-04-01/Accounts/');
    });
  });

  it('should have authentication config on all Twilio tools', () => {
    const tools = matimo.listTools();
    const twilioTools = tools.filter((t) => t.name.startsWith('twilio-'));

    twilioTools.forEach((tool) => {
      expect(tool.authentication).toBeDefined();
      expect((tool.authentication as { type: string }).type).toBe('basic');
    });
  });

  it('should have output_schema defined for all Twilio tools', () => {
    const tools = matimo.listTools();
    const twilioTools = tools.filter((t) => t.name.startsWith('twilio-'));

    twilioTools.forEach((tool) => {
      expect(tool.output_schema).toBeDefined();
      if (tool.output_schema) {
        expect(tool.output_schema.type).toBe('object');
        expect(tool.output_schema.properties).toBeDefined();
      }
    });
  });

  it('should have examples defined for all Twilio tools', () => {
    const tools = matimo.listTools();
    const twilioTools = tools.filter((t) => t.name.startsWith('twilio-'));

    twilioTools.forEach((tool) => {
      expect(tool.examples).toBeDefined();
      expect(Array.isArray(tool.examples)).toBe(true);
      expect((tool.examples as unknown[]).length).toBeGreaterThan(0);
    });
  });

  it('twilio-send-sms should have required parameters: account_sid, to, from, body', () => {
    const tool = matimo.listTools().find((t) => t.name === 'twilio-send-sms');
    expect(tool).toBeDefined();

    const params = tool!.parameters as Record<string, { required: boolean }>;
    expect(params.account_sid).toBeDefined();
    expect(params.account_sid.required).toBe(true);
    expect(params.to).toBeDefined();
    expect(params.to.required).toBe(true);
    expect(params.from).toBeDefined();
    expect(params.from.required).toBe(true);
    expect(params.body).toBeDefined();
    expect(params.body.required).toBe(true);
    expect(params.status_callback).toBeDefined();
    expect(params.status_callback.required).toBe(false);
  });

  it('twilio-send-mms should have required parameters: account_sid, to, from, media_url', () => {
    const tool = matimo.listTools().find((t) => t.name === 'twilio-send-mms');
    expect(tool).toBeDefined();

    const params = tool!.parameters as Record<string, { required: boolean }>;
    expect(params.account_sid.required).toBe(true);
    expect(params.to.required).toBe(true);
    expect(params.from.required).toBe(true);
    expect(params.media_url.required).toBe(true);
    expect(params.body.required).toBe(false);
  });

  it('twilio-get-message should have required parameters: account_sid, message_sid', () => {
    const tool = matimo.listTools().find((t) => t.name === 'twilio-get-message');
    expect(tool).toBeDefined();

    const params = tool!.parameters as Record<string, { required: boolean }>;
    expect(params.account_sid.required).toBe(true);
    expect(params.message_sid.required).toBe(true);
  });

  it('twilio-list-messages should have required account_sid and optional filters', () => {
    const tool = matimo.listTools().find((t) => t.name === 'twilio-list-messages');
    expect(tool).toBeDefined();

    const params = tool!.parameters as Record<string, { required: boolean }>;
    expect(params.account_sid.required).toBe(true);
    expect(params.to.required).toBe(false);
    expect(params.from.required).toBe(false);
    expect(params.date_sent.required).toBe(false);
    expect(params.page_size.required).toBe(false);
  });

  it('twilio-send-sms URL should contain account_sid placeholder', () => {
    const tool = matimo.listTools().find((t) => t.name === 'twilio-send-sms');
    expect(tool).toBeDefined();

    const execution = tool!.execution as { url: string };
    expect(execution.url).toContain('{account_sid}');
    expect(execution.url).toBe(
      'https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json'
    );
  });

  it('twilio-get-message URL should contain account_sid and message_sid placeholders', () => {
    const tool = matimo.listTools().find((t) => t.name === 'twilio-get-message');
    expect(tool).toBeDefined();

    const execution = tool!.execution as { url: string };
    expect(execution.url).toContain('{account_sid}');
    expect(execution.url).toContain('{message_sid}');
    expect(execution.url).toBe(
      'https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages/{message_sid}.json'
    );
  });

  it('POST tools should use Content-Type application/x-www-form-urlencoded', () => {
    const postToolNames = ['twilio-send-sms', 'twilio-send-mms'];
    const tools = matimo.listTools();

    postToolNames.forEach((toolName) => {
      const tool = tools.find((t) => t.name === toolName);
      expect(tool).toBeDefined();

      const execution = tool!.execution as {
        method: string;
        headers: Record<string, string>;
      };
      expect(execution.method).toBe('POST');
      expect(execution.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    });
  });

  it('all tools should use native Basic Auth with username_env and password_env', () => {
    const tools = matimo.listTools().filter((t) => t.name.startsWith('twilio-'));

    tools.forEach((tool) => {
      // Native Basic Auth: no hardcoded Authorization header needed
      // HttpExecutor reads username_env/password_env and encodes automatically
      expect(tool.authentication).toBeDefined();
      expect(tool.authentication?.type).toBe('basic');
      expect(tool.authentication?.username_env).toBe('TWILIO_ACCOUNT_SID');
      expect(tool.authentication?.password_env).toBe('TWILIO_AUTH_TOKEN');
    });
  });

  // ── Live API Tests (skipped if no credentials) ────────────────────────────

  it('should execute twilio-list-messages with valid parameters', async () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.info('Skipping live test - TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set');
      return;
    }

    const result = (await matimo.execute('twilio-list-messages', {
      account_sid: accountSid,
      page_size: 5,
    })) as { success: boolean; data: { messages: unknown[]; page_size: number } };

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data.messages)).toBe(true);
  });

  it('should execute twilio-send-sms with valid parameters', async () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const toNumber = process.env.TWILIO_TO_NUMBER;

    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      console.info('Skipping live SMS test - required env vars not set');
      return;
    }

    const result = (await matimo.execute('twilio-send-sms', {
      account_sid: accountSid,
      to: toNumber,
      from: fromNumber,
      body: 'Matimo integration test',
    })) as { success: boolean; data: { sid: string; status: string } };

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.sid).toBeDefined();
    expect(result.data.sid).toMatch(/^(SM|MM)[0-9a-fA-F]{32}$/);
    expect(result.data.status).toBe('queued');
  });

  it('should not expose credentials in error messages', async () => {
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    try {
      // Use invalid account SID to trigger error
      await matimo.execute('twilio-list-messages', {
        account_sid: 'AC00000000000000000000000000000000',
        page_size: 5,
      });
    } catch (error) {
      const errorString = JSON.stringify(error);
      if (authToken) {
        expect(errorString).not.toContain(authToken);
      }
    }
  });
});
