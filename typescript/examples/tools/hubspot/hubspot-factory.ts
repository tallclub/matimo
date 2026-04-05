#!/usr/bin/env node
/**
 * ============================================================================
 * HUBSPOT TOOLS - FACTORY PATTERN EXAMPLE
 * ============================================================================
 *
 * PATTERN: SDK Factory Pattern
 * ─────────────────────────────────────────────────────────────────────────
 * Direct tool execution via MatimoInstance - the simplest way to use tools.
 *
 * Use this pattern when:
 * ✅ Building simple scripts or CLI tools
 * ✅ Direct API calls without abstraction
 * ✅ Quick prototyping
 * ✅ One-off tool execution
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create .env file:
 *    MATIMO_HUBSPOT_API_KEY=pat-na1-xxxxxxxxxxxx
 *
 * 2. Get a Service Key:
 *    - Go to: https://app.hubapi.com/settings/integrations/service-keys
 *    - Click "Create service key"
 *    - Select required scopes (contacts, companies, deals, tickets, etc.)
 *    - Copy the service key
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export MATIMO_HUBSPOT_API_KEY=pat-na1-xxxx
 *   npm run hubspot:factory
 *
 * AVAILABLE TOOLS (50 TOTAL):
 * ─────────────────────────────────────────────────────────────────────────
 * Contacts (5): create, get, update, delete, list
 * Companies (5): create, get, update, delete, list
 * Deals (5): create, get, update, delete, list
 * Tickets (5): create, get, update, delete, list
 * Leads (5): create, get, update, delete, list
 * Line Items (5): create, get, update, delete, list
 * Invoices (5): create, get, update, delete, list
 * Orders (5): create, get, update, delete, list
 * Products (5): create, get, update, delete, list
 * Custom Objects (5): create, get, update, delete, list
 *
 * ============================================================================
 */

import 'dotenv/config';
import { MatimoInstance } from '@matimo/core';

/**
 * Run factory pattern examples
 */
async function runFactoryPatternExamples() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     HubSpot Tools - Factory Pattern                    ║');
  console.info('║     (Direct execution - simplest approach)             ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  const apiKey = process.env.MATIMO_HUBSPOT_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: MATIMO_HUBSPOT_API_KEY not set in .env');
    console.error('\nSetup Instructions:');
    console.error('1. Create a Service Key in HubSpot:');
    console.error('   Go to: Settings → Integrations → Service Keys');
    console.error('   Click "Create service key"');
    console.error('   Select all required scopes (contacts, companies, deals, etc.)');
    console.error('   Copy the service key\n');
    console.error('2. Create .env file:');
    console.error('   echo "MATIMO_HUBSPOT_API_KEY=pat-na1-xxxx" > .env\n');
    console.error('3. Or set environment variable:');
    console.error('   export MATIMO_HUBSPOT_API_KEY="pat-na1-xxxx"\n');
    console.error(
      '📚 Docs: https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/account-service-keys'
    );
    process.exit(1);
  }

  console.info(`🔑 Service Key is set`);
  console.info('🚀 Initializing Matimo...\n');

  // Initialize Matimo with auto-discovery to find all @matimo/* packages
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  const allTools = matimo.listTools();
  console.info(`✅ Loaded ${allTools.length} total tools\n`);

  // Get HubSpot tools
  const hubspotTools = allTools.filter((t) => t.name.startsWith('hubspot-'));
  console.info(`🔧 Found ${hubspotTools.length} HubSpot tools`);
  console.info(`   - Contacts: 5 tools`);
  console.info(`   - Companies: 5 tools`);
  console.info(`   - Deals: 5 tools`);
  console.info(`   - Tickets: 5 tools`);
  console.info(`   - Leads: 5 tools`);
  console.info(`   - Line Items: 5 tools`);
  console.info(`   - Invoices: 5 tools`);
  console.info(`   - Orders: 5 tools`);
  console.info(`   - Products: 5 tools`);
  console.info(`   - Custom Objects: 5 tools\n`);

  console.info('════════════════════════════════════════════════════════════\n');
  console.info('Running Examples:');
  console.info('════════════════════════════════════════════════════════════\n');

  try {
    // Example 1: Create a contact
    console.info('1️⃣  Creating contact...');
    const createContactResult = await matimo.execute('hubspot-create-contact', {
      email: `factory-test-${Date.now()}@example.com`,
      firstname: 'Factory',
      lastname: 'Test',
    });
    const contactId = (createContactResult as any).data?.id;
    console.info(`   ✅ Contact created: ${contactId}\n`);

    // Example 2: Get the contact
    let contactEmail = '';
    if (contactId) {
      console.info('2️⃣  Retrieving contact...');
      const getContactResult = await matimo.execute('hubspot-get-contact', {
        id: contactId,
        properties: ['email', 'firstname', 'lastname', 'createdate'],
      });
      const contactData = (getContactResult as any).data?.properties || {};
      contactEmail = contactData.email || '';
      console.info(`   ✅ Retrieved contact`);
      console.info(`      Email: ${contactData.email}`);
      console.info(`      Name: ${contactData.firstname} ${contactData.lastname}`);
      console.info(`      Created: ${contactData.createdate}\n`);
    }

    // Example 3: Create a company
    console.info('3️⃣  Creating company...');
    const createCompanyResult = await matimo.execute('hubspot-create-company', {
      name: `Test Company ${Date.now()}`,
      domain: 'example.com',
    });
    const companyId = (createCompanyResult as any).data?.id;
    console.info(`   ✅ Company created: ${companyId}\n`);

    // Example 4: List contacts with pagination
    console.info('4️⃣  Listing contacts (limit 5)...');
    const listContactsResult = await matimo.execute('hubspot-list-contacts', {
      limit: 5,
      properties: ['email', 'firstname', 'lastname'],
    });
    const contactsList = (listContactsResult as any).data?.results || [];
    console.info(`   ✅ Found ${contactsList.length} contacts\n`);

    // Example 5: Create a product
    console.info('5️⃣  Creating product...');
    const createProductResult = await matimo.execute('hubspot-create-product', {
      name: `Test Product ${Date.now()}`,
      description: 'A sample product for testing',
      price: 9999,
    });
    const productId = (createProductResult as any).data?.id;
    console.info(`   ✅ Product created: ${productId}\n`);

    // Example 6: Create an invoice
    console.info('6️⃣  Creating invoice...');
    const createInvoiceResult = await matimo.execute('hubspot-create-invoice', {
      hs_currency: 'USD',
    });
    const invoiceId = (createInvoiceResult as any).data?.id;
    console.info(`   ✅ Invoice created: ${invoiceId}\n`);

    console.info('════════════════════════════════════════════════════════════');
    console.info('✨ Factory Pattern Example Complete!');
    console.info('════════════════════════════════════════════════════════════\n');
    console.info('Summary of actions:');
    console.info(`  • Created contact: ${contactId}`);
    if (contactEmail) {
      console.info(`  • Retrieved contact: ${contactEmail}`);
    }
    console.info(`  • Created company: ${companyId}`);
    console.info(`  • Listed contacts: ${contactsList.length} found`);
    console.info(`  • Created product: ${productId}`);
    console.info(`  • Created invoice: ${invoiceId}\n`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

runFactoryPatternExamples().catch(console.error);
