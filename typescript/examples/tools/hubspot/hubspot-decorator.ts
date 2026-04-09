#!/usr/bin/env node
/**
 * ============================================================================
 * HUBSPOT TOOLS - DECORATOR PATTERN EXAMPLE
 * ============================================================================
 *
 * PATTERN: Class Decorator Pattern
 * ─────────────────────────────────────────────────────────────────────────
 * Tool execution via @tool decorators - class-based approach.
 *
 * Use this pattern when:
 * ✅ Building agents with class-based structure
 * ✅ Encapsulating tool logic in methods
 * ✅ Integration with LangChain or CrewAI
 * ✅ Domain-specific agent classes
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create .env file:
 *    MATIMO_HUBSPOT_API_KEY=pat-na1-xxxxxxxxxxxx
 *
 * 2. Get a Service Key:
 *    - Go to: https://app.hubapi.com/settings/integrations/service-keys
 *    - Click "Create service key"
 *    - Select required scopes
 *    - Copy the service key
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export MATIMO_HUBSPOT_API_KEY=pat-na1-xxxx
 *   npm run hubspot:decorator
 *
 * ============================================================================
 */

import 'dotenv/config';
import { MatimoInstance, setGlobalMatimoInstance, tool } from '@matimo/core';

/**
 * Run decorator pattern examples
 */
async function runDecoratorPatternExamples() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     HubSpot Tools - Decorator Pattern                  ║');
  console.info('║     (Class-based approach with decorators)             ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  const apiKey = process.env.MATIMO_HUBSPOT_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: MATIMO_HUBSPOT_API_KEY not set in .env');
    console.error('\nSetup Instructions:');
    console.error('1. Create a Service Key in HubSpot');
    console.error('2. Set environment variable: export MATIMO_HUBSPOT_API_KEY="pat-na1-xxxx"');
    console.error('3. Or create .env: echo "MATIMO_HUBSPOT_API_KEY=pat-na1-xxxx" > .env');
    process.exit(1);
  }

  console.info(`🔑 Service Key is set`);
  console.info('🚀 Initializing Matimo...\n');

  // Initialize Matimo with auto-discovery
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  // Set global instance for decorators
  setGlobalMatimoInstance(matimo);

  const allTools = matimo.listTools();
  console.info(`✅ Loaded ${allTools.length} total tools\n`);

  const hubspotTools = allTools.filter((t) => t.name.startsWith('hubspot-'));
  console.info(`🔧 Found ${hubspotTools.length} HubSpot tools\n`);

  class HubSpotAgent {
    @tool('hubspot-create-contact')
    async createContact(email: string, firstname?: string, lastname?: string): Promise<unknown> {
      // Decorator auto-executes via matimo
      return undefined;
    }

    @tool('hubspot-get-contact')
    async getContact(id: string, properties?: string[]): Promise<unknown> {
      // Decorator auto-executes via matimo
      return undefined;
    }

    @tool('hubspot-create-company')
    async createCompany(name: string, domain?: string): Promise<unknown> {
      // Decorator auto-executes via matimo
      return undefined;
    }

    @tool('hubspot-list-contacts')
    async listContacts(limit?: number, after?: string, properties?: string[]): Promise<unknown> {
      // Decorator auto-executes via matimo
      return undefined;
    }

    @tool('hubspot-create-product')
    async createProduct(name: string, description?: string, price?: number): Promise<unknown> {
      // Decorator auto-executes via matimo
      return undefined;
    }

    @tool('hubspot-create-invoice')
    async createInvoice(hs_currency?: string): Promise<unknown> {
      // Decorator auto-executes via matimo
      return undefined;
    }
  }

  console.info('════════════════════════════════════════════════════════════\n');
  console.info('Running Decorator Pattern Examples:');
  console.info('════════════════════════════════════════════════════════════\n');

  try {
    const agent = new HubSpotAgent();

    // Example 1: Create contact via decorator
    console.info('1️⃣  Creating contact via decorator...');
    const contact = await agent.createContact(
      `decorator-test-${Date.now()}@example.com`,
      'Decorator',
      'Test'
    );
    const contactId = (contact as any).data?.id;
    console.info(`   ✅ Contact created: ${contactId}\n`);

    // Example 2: Get contact via decorator
    if (contactId) {
      console.info('2️⃣  Retrieving contact via decorator...');
      const contactData = await agent.getContact(contactId, ['email', 'firstname', 'lastname']);
      const props = (contactData as any).data?.properties || {};
      console.info(`   ✅ Retrieved contact: ${props.email}\n`);
    }

    // Example 3: Create company via decorator
    console.info('3️⃣  Creating company via decorator...');
    const company = await agent.createCompany(`Company ${Date.now()}`, 'example.com');
    const companyId = (company as any).data?.id;
    console.info(`   ✅ Company created: ${companyId}\n`);

    // Example 4: List contacts via decorator
    console.info('4️⃣  Listing contacts via decorator...');
    const contactsList = await agent.listContacts(5, undefined, ['email', 'firstname', 'lastname']);
    const count = ((contactsList as any).data?.results || []).length;
    console.info(`   ✅ Found ${count} contacts\n`);

    // Example 5: Create product via decorator
    console.info('5️⃣  Creating product via decorator...');
    const product = await agent.createProduct(
      `Product ${Date.now()}`,
      'Created via decorator pattern',
      19999
    );
    const productId = (product as any).data?.id;
    console.info(`   ✅ Product created: ${productId}\n`);

    // Example 6: Create invoice via decorator
    console.info('6️⃣  Creating invoice via decorator...');
    const invoice = await agent.createInvoice('USD');
    const invoiceId = (invoice as any).data?.id;
    console.info(`   ✅ Invoice created: ${invoiceId}\n`);

    console.info('════════════════════════════════════════════════════════════');
    console.info('✨ Decorator Pattern Example Complete!');
    console.info('════════════════════════════════════════════════════════════\n');
    console.info('Summary of agent actions:');
    console.info(`  • Created contact: ${contactId}`);
    console.info(`  • Retrieved contact: ${contactId}`);
    console.info(`  • Created company: ${companyId}`);
    console.info(`  • Found contacts: ${count}`);
    console.info(`  • Created product: ${productId}`);
    console.info(`  • Created invoice: ${invoiceId}\n`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

runDecoratorPatternExamples().catch(console.error);
