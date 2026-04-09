import { MatimoInstance } from '../../../core/src/matimo-instance';
import * as path from 'path';

describe('HubSpot Tools Integration', () => {
  let matimo: MatimoInstance;

  beforeAll(async () => {
    const toolsPath = path.join(__dirname, '../../tools');
    matimo = await MatimoInstance.init(toolsPath);
  });

  it('should load all 50 HubSpot tools', () => {
    const tools = matimo.listTools();
    const toolNames = tools.map((t) => t.name);

    // Contact tools
    expect(toolNames).toContain('hubspot-create-contact');
    expect(toolNames).toContain('hubspot-get-contact');
    expect(toolNames).toContain('hubspot-update-contact');
    expect(toolNames).toContain('hubspot-delete-contact');
    expect(toolNames).toContain('hubspot-list-contacts');

    // Company tools
    expect(toolNames).toContain('hubspot-create-company');
    expect(toolNames).toContain('hubspot-get-company');
    expect(toolNames).toContain('hubspot-update-company');
    expect(toolNames).toContain('hubspot-delete-company');
    expect(toolNames).toContain('hubspot-list-companies');

    // Deal tools
    expect(toolNames).toContain('hubspot-create-deal');
    expect(toolNames).toContain('hubspot-get-deal');
    expect(toolNames).toContain('hubspot-update-deal');
    expect(toolNames).toContain('hubspot-delete-deal');
    expect(toolNames).toContain('hubspot-list-deals');

    // Ticket tools
    expect(toolNames).toContain('hubspot-create-ticket');
    expect(toolNames).toContain('hubspot-get-ticket');
    expect(toolNames).toContain('hubspot-update-ticket');
    expect(toolNames).toContain('hubspot-delete-ticket');
    expect(toolNames).toContain('hubspot-list-tickets');

    // Lead tools
    expect(toolNames).toContain('hubspot-create-lead');
    expect(toolNames).toContain('hubspot-get-lead');
    expect(toolNames).toContain('hubspot-update-lead');
    expect(toolNames).toContain('hubspot-delete-lead');
    expect(toolNames).toContain('hubspot-list-leads');

    // Line Item tools
    expect(toolNames).toContain('hubspot-create-line-item');
    expect(toolNames).toContain('hubspot-get-line-item');
    expect(toolNames).toContain('hubspot-update-line-item');
    expect(toolNames).toContain('hubspot-delete-line-item');
    expect(toolNames).toContain('hubspot-list-line-items');

    // Invoice tools
    expect(toolNames).toContain('hubspot-create-invoice');
    expect(toolNames).toContain('hubspot-get-invoice');
    expect(toolNames).toContain('hubspot-update-invoice');
    expect(toolNames).toContain('hubspot-delete-invoice');
    expect(toolNames).toContain('hubspot-list-invoices');

    // Order tools
    expect(toolNames).toContain('hubspot-create-order');
    expect(toolNames).toContain('hubspot-get-order');
    expect(toolNames).toContain('hubspot-update-order');
    expect(toolNames).toContain('hubspot-delete-order');
    expect(toolNames).toContain('hubspot-list-orders');

    // Product tools
    expect(toolNames).toContain('hubspot-create-product');
    expect(toolNames).toContain('hubspot-get-product');
    expect(toolNames).toContain('hubspot-update-product');
    expect(toolNames).toContain('hubspot-delete-product');
    expect(toolNames).toContain('hubspot-list-products');

    // Custom Object tools
    expect(toolNames).toContain('hubspot-create-custom-object');
    expect(toolNames).toContain('hubspot-get-custom-object');
    expect(toolNames).toContain('hubspot-update-custom-object');
    expect(toolNames).toContain('hubspot-delete-custom-object');
    expect(toolNames).toContain('hubspot-list-custom-objects');

    expect(toolNames.length).toBe(50);
  });

  it('should have requires_approval set correctly', () => {
    const tools = matimo.listTools();
    const destructiveTools = [
      'hubspot-update-contact',
      'hubspot-delete-contact',
      'hubspot-update-company',
      'hubspot-delete-company',
      'hubspot-update-deal',
      'hubspot-delete-deal',
      'hubspot-update-ticket',
      'hubspot-delete-ticket',
      'hubspot-update-lead',
      'hubspot-delete-lead',
      'hubspot-update-line-item',
      'hubspot-delete-line-item',
      'hubspot-update-invoice',
      'hubspot-delete-invoice',
      'hubspot-update-order',
      'hubspot-delete-order',
      'hubspot-update-product',
      'hubspot-delete-product',
      'hubspot-update-custom-object',
      'hubspot-delete-custom-object',
    ];

    tools.forEach((tool) => {
      if (destructiveTools.includes(tool.name)) {
        expect(tool.requires_approval).toBe(true);
      }
    });
  });

  it('should execute hubspot-create-contact with valid parameters', async () => {
    const apiKey = process.env.MATIMO_HUBSPOT_API_KEY;
    if (!apiKey) {
      console.info('Skipping integration test - HubSpot API key not set');
      return;
    }
    const result = await matimo.execute('hubspot-create-contact', {
      email: 'integration-test@example.com',
      firstname: 'Integration',
      lastname: 'Test',
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect((result as { data?: { id?: unknown } }).data?.id).toBeDefined();
  });

  it('should throw MatimoError on invalid parameters', async () => {
    const apiKey = process.env.MATIMO_HUBSPOT_API_KEY;
    if (!apiKey) {
      console.info('Skipping - API key not set');
      return;
    }
    try {
      await matimo.execute('hubspot-create-contact', {});
      fail('Should have thrown MatimoError');
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'name' in error && 'code' in error) {
        expect((error as { name: string }).name).toBe('MatimoError');
        expect((error as { code: unknown }).code).toBeDefined();
      } else {
        throw error;
      }
    }
  });

  it('should not expose API keys in error messages', async () => {
    const apiKey = process.env.MATIMO_HUBSPOT_API_KEY;
    if (!apiKey) {
      console.info('Skipping - API key not set');
      return;
    }

    try {
      await matimo.execute('hubspot-create-contact', { email: 'fail@example.com' });
    } catch (error) {
      const errorString = JSON.stringify(error);
      expect(errorString).not.toContain(process.env.MATIMO_HUBSPOT_API_KEY);
    }
  });
});
