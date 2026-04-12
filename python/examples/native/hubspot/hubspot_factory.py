#!/usr/bin/env python3
"""
============================================================================
HUBSPOT TOOLS - FACTORY PATTERN EXAMPLE
============================================================================

PATTERN: SDK Factory Pattern
─────────────────────────────────────────────────────────────────────────
Direct tool execution via Matimo - the simplest way to use tools.

Use this pattern when:
✅ Building simple scripts or CLI tools
✅ Direct API calls without abstraction
✅ Quick prototyping
✅ One-off tool execution

SETUP:
─────────────────────────────────────────────────────────────────────────
1. Create .env file:
   MATIMO_HUBSPOT_API_KEY=pat-na1-xxxxxxxxxxxx

2. Get a Service Key:
   - Go to: https://app.hubapi.com/settings/integrations/service-keys
   - Click "Create service key"
   - Select required scopes (contacts, companies, deals, tickets, etc.)
   - Copy the service key

USAGE:
─────────────────────────────────────────────────────────────────────────
  export MATIMO_HUBSPOT_API_KEY=pat-na1-xxxx
  python hubspot_factory.py

AVAILABLE TOOLS (50 TOTAL):
─────────────────────────────────────────────────────────────────────────
Contacts (5): create, get, update, delete, list
Companies (5): create, get, update, delete, list
Deals (5): create, get, update, delete, list
Tickets (5): create, get, update, delete, list
Leads (5): create, get, update, delete, list
Line Items (5): create, get, update, delete, list
Invoices (5): create, get, update, delete, list
Orders (5): create, get, update, delete, list
Products (5): create, get, update, delete, list
Custom Objects (5): create, get, update, delete, list

============================================================================
"""

import asyncio
import os
import sys
import time
from dotenv import load_dotenv
from matimo import Matimo


async def run_factory_pattern_examples():
    print('\n╔════════════════════════════════════════════════════════╗')
    print('║     HubSpot Tools - Factory Pattern                    ║')
    print('║     (Direct execution - simplest approach)             ║')
    print('╚════════════════════════════════════════════════════════╝\n')

    load_dotenv()
    api_key = os.getenv('MATIMO_HUBSPOT_API_KEY')
    if not api_key:
        print('❌ Error: MATIMO_HUBSPOT_API_KEY not set in .env')
        print('\nSetup Instructions:')
        print('1. Create a Service Key in HubSpot:')
        print('   Go to: Settings → Integrations → Service Keys')
        print('   Click "Create service key"')
        print('   Select all required scopes (contacts, companies, deals, etc.)')
        print('   Copy the service key\n')
        print('2. Create .env file:')
        print('   echo "MATIMO_HUBSPOT_API_KEY=pat-na1-xxxx" > .env\n')
        print('3. Or set environment variable:')
        print('   export MATIMO_HUBSPOT_API_KEY="pat-na1-xxxx"\n')
        print('📚 Docs: https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/account-service-keys')
        sys.exit(1)

    print('🔑 Service Key is set')
    print('🚀 Initializing Matimo...\n')

    # Initialize Matimo with auto-discovery to find all matimo provider packages
    matimo = await Matimo.init(auto_discover=True)

    all_tools = matimo.list_tools()
    print(f'✅ Loaded {len(all_tools)} total tools\n')

    # Get HubSpot tools
    hubspot_tools = [t for t in all_tools if t.name.startswith('hubspot-')]
    print(f'🔧 Found {len(hubspot_tools)} HubSpot tools')
    print('   - Contacts: 5 tools')
    print('   - Companies: 5 tools')
    print('   - Deals: 5 tools')
    print('   - Tickets: 5 tools')
    print('   - Leads: 5 tools')
    print('   - Line Items: 5 tools')
    print('   - Invoices: 5 tools')
    print('   - Orders: 5 tools')
    print('   - Products: 5 tools')
    print('   - Custom Objects: 5 tools\n')

    print('════════════════════════════════════════════════════════════\n')
    print('Running Examples:')
    print('════════════════════════════════════════════════════════════\n')

    try:
        # Example 1: Create a contact
        print('1️⃣  Creating contact...')
        timestamp = int(time.time() * 1000)
        create_contact_result = await matimo.execute('hubspot-create-contact', {
            'email': f'factory-test-{timestamp}@example.com',
            'firstname': 'Factory',
            'lastname': 'Test',
        })
        contact_id = None
        if isinstance(create_contact_result, dict):
            contact_id = create_contact_result.get('id')
        print(f'   ✅ Contact created: {contact_id}\n')

        # Example 2: Get the contact
        contact_email = ''
        if contact_id:
            print('2️⃣  Retrieving contact...')
            get_contact_result = await matimo.execute('hubspot-get-contact', {
                'id': contact_id,
                'properties': ['email', 'firstname', 'lastname', 'createdate'],
            })
            contact_data = {}
            if isinstance(get_contact_result, dict):
                contact_data = get_contact_result.get('properties', {})
            contact_email = contact_data.get('email', '')
            print('   ✅ Retrieved contact')
            print(f'      Email: {contact_data.get("email")}')
            print(f'      Name: {contact_data.get("firstname")} {contact_data.get("lastname")}')
            print(f'      Created: {contact_data.get("createdate")}\n')

        # Example 3: Create a company
        print('3️⃣  Creating company...')
        timestamp = int(time.time() * 1000)
        create_company_result = await matimo.execute('hubspot-create-company', {
            'name': f'Test Company {timestamp}',
            'domain': 'example.com',
        })
        company_id = None
        if isinstance(create_company_result, dict):
            company_id = create_company_result.get('id')
        print(f'   ✅ Company created: {company_id}\n')

        # Example 4: List contacts with pagination
        print('4️⃣  Listing contacts (limit 5)...')
        list_contacts_result = await matimo.execute('hubspot-list-contacts', {
            'limit': 5,
            'properties': ['email', 'firstname', 'lastname'],
        })
        contacts_list = []
        if isinstance(list_contacts_result, dict):
            contacts_list = list_contacts_result.get('results', [])
        print(f'   ✅ Found {len(contacts_list)} contacts\n')

        # Example 5: Create a product
        print('5️⃣  Creating product...')
        timestamp = int(time.time() * 1000)
        create_product_result = await matimo.execute('hubspot-create-product', {
            'name': f'Test Product {timestamp}',
            'description': 'A sample product for testing',
            'price': 9999,
        })
        product_id = None
        if isinstance(create_product_result, dict):
            product_id = create_product_result.get('id')
        print(f'   ✅ Product created: {product_id}\n')

        # Example 6: Create an invoice
        print('6️⃣  Creating invoice...')
        create_invoice_result = await matimo.execute('hubspot-create-invoice', {
            'hs_currency': 'USD',
        })
        invoice_id = None
        if isinstance(create_invoice_result, dict):
            invoice_id = create_invoice_result.get('id')
        print(f'   ✅ Invoice created: {invoice_id}\n')

        print('════════════════════════════════════════════════════════════')
        print('✨ Factory Pattern Example Complete!')
        print('════════════════════════════════════════════════════════════\n')
        print('Summary of actions:')
        print(f'  • Created contact: {contact_id}')
        if contact_email:
            print(f'  • Retrieved contact: {contact_email}')
        print(f'  • Created company: {company_id}')
        print(f'  • Listed contacts: {len(contacts_list)} found')
        print(f'  • Created product: {product_id}')
        print(f'  • Created invoice: {invoice_id}\n')

    except Exception as error:
        error_msg = error.args[0] if error.args else str(error)
        print(f'❌ Error: {error_msg}')
        sys.exit(1)


async def main():
    await run_factory_pattern_examples()


if __name__ == '__main__':
    asyncio.run(main())
