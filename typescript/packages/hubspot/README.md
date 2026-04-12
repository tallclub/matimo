# @matimo/hubspot - HubSpot Tools for Matimo

HubSpot CRM, marketing, and automation integration tools for Matimo's universal AI tools ecosystem. Manage contacts, companies, deals, tickets, and more through YAML-defined tools that work with any AI framework.

## 📦 Installation

```bash
npm install @matimo/hubspot
# or
pnpm add @matimo/hubspot
```

## 🛠️ Available Tools (50 Total)

| Category      | Count | Description                        |
|---------------|-------|------------------------------------|
| **Contacts**  | 5 tools | Create, read, update, delete, list contacts |
| **Companies** | 5 tools | Create, read, update, delete, list companies |
| **Deals**     | 5 tools | Create, read, update, delete, list deals |
| **Tickets**   | 5 tools | Create, read, update, delete, list tickets |
| **Leads**     | 5 tools | Create, read, update, delete, list leads |
| **Line Items** | 5 tools | Create, read, update, delete, list line items |
| **Invoices**  | 5 tools | Create, read, update, delete, list invoices |
| **Orders**    | 5 tools | Create, read, update, delete, list orders |
| **Products**  | 5 tools | Create, read, update, delete, list products |
| **Custom Objects** | 5 tools | Create, read, update, delete, list custom objects |

### Complete Tool List

**Contacts (5):**
- `hubspot-create-contact` — Create new contact
- `hubspot-get-contact` — Get contact by ID
- `hubspot-update-contact` — Update contact (🔒 requires approval)
- `hubspot-delete-contact` — Delete contact (🔒 requires approval)
- `hubspot-list-contacts` — List all contacts with pagination

**Companies (5):**
- `hubspot-create-company` — Create new company
- `hubspot-get-company` — Get company by ID
- `hubspot-update-company` — Update company (🔒 requires approval)
- `hubspot-delete-company` — Delete company (🔒 requires approval)
- `hubspot-list-companies` — List all companies with pagination

**Deals (5):**
- `hubspot-create-deal` — Create new deal
- `hubspot-get-deal` — Get deal by ID
- `hubspot-update-deal` — Update deal (🔒 requires approval)
- `hubspot-delete-deal` — Delete deal (🔒 requires approval)
- `hubspot-list-deals` — List all deals with pagination

**Tickets (5):**
- `hubspot-create-ticket` — Create new ticket
- `hubspot-get-ticket` — Get ticket by ID
- `hubspot-update-ticket` — Update ticket (🔒 requires approval)
- `hubspot-delete-ticket` — Delete ticket (🔒 requires approval)
- `hubspot-list-tickets` — List all tickets with pagination

**Leads (5):**
- `hubspot-create-lead` — Create new lead
- `hubspot-get-lead` — Get lead by ID
- `hubspot-update-lead` — Update lead (🔒 requires approval)
- `hubspot-delete-lead` — Delete lead (🔒 requires approval)
- `hubspot-list-leads` — List all leads with pagination

**Line Items (5):**
- `hubspot-create-line-item` — Create new line item
- `hubspot-get-line-item` — Get line item by ID
- `hubspot-update-line-item` — Update line item (🔒 requires approval)
- `hubspot-delete-line-item` — Delete line item (🔒 requires approval)
- `hubspot-list-line-items` — List all line items with pagination

**Invoices (5):**
- `hubspot-create-invoice` — Create new invoice
- `hubspot-get-invoice` — Get invoice by ID
- `hubspot-update-invoice` — Update invoice (🔒 requires approval)
- `hubspot-delete-invoice` — Delete invoice (🔒 requires approval)
- `hubspot-list-invoices` — List all invoices with pagination

**Orders (5):**
- `hubspot-create-order` — Create new order
- `hubspot-get-order` — Get order by ID
- `hubspot-update-order` — Update order (🔒 requires approval)
- `hubspot-delete-order` — Delete order (🔒 requires approval)
- `hubspot-list-orders` — List all orders with pagination

**Products (5):**
- `hubspot-create-product` — Create new product
- `hubspot-get-product` — Get product by ID
- `hubspot-update-product` — Update product (🔒 requires approval)
- `hubspot-delete-product` — Delete product (🔒 requires approval)
- `hubspot-list-products` — List all products with pagination

**Custom Objects (5):**
- `hubspot-create-custom-object` — Create new custom object
- `hubspot-get-custom-object` — Get custom object by ID
- `hubspot-update-custom-object` — Update custom object (🔒 requires approval)
- `hubspot-delete-custom-object` — Delete custom object (🔒 requires approval)
- `hubspot-list-custom-objects` — List custom objects with pagination

## ⚡ Quick Start

**Prerequisites:**
1. Create a HubSpot Service Key (see [Authentication](#-authentication) section)
2. Set your API key:
   ```bash
   export MATIMO_HUBSPOT_API_KEY="your-service-key-here"
   ```

**Usage:**

```typescript
import { MatimoInstance } from '@matimo/core';

async function main() {
  // Initialize with auto-discovery to load all @matimo/* packages
  const matimo = await MatimoInstance.init({ autoDiscover: true });
  
  // Create a contact
  const contact = await matimo.execute('hubspot-create-contact', {
    properties: {
      email: 'john@example.com',
      firstname: 'John',
      lastname: 'Doe'
    }
  });
  console.log('Contact created:', (contact as any).id);
  
  // Get contact
  const retrieved = await matimo.execute('hubspot-get-contact', {
    id: (contact as any).id,
    properties: ['firstname', 'lastname', 'email']
  });
  console.log('Retrieved:', retrieved);
}

main();
```

## 🔐 Authentication

HubSpot tools support three authentication methods:

### Option 1: Service Keys (⭐ Recommended — Modern)

**NEW (Feb 2026)** — The modern replacement for legacy private apps. Purpose-built for system-to-system integrations like Matimo.

**When to use:**
- ✅ System-to-system integrations (Matimo, automation, BI tools)
- ✅ Data warehousing and analytics (Tableau, Power BI, etc.)
- ✅ Internal automation and reporting workflows
- ✅ Simplest and most secure approach

**Setup Steps:**
1. Go to your HubSpot account → Settings → Integrations → **Service Keys**
2. Click **Create service key**
3. Enter a name (e.g., "Matimo Integration") and description
4. Select required scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.companies.read`
   - `crm.objects.companies.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.objects.tickets.read`
   - `crm.objects.tickets.write`
   - `crm.objects.leads.read`
   - `crm.objects.leads.write`
   - `crm.objects.line_items.read`
   - `crm.objects.line_items.write`
   - `crm.objects.invoices.read`
   - `crm.objects.invoices.write`
   - `crm.objects.orders.read`
   - `crm.objects.orders.write`
   - `crm.objects.products.read`
   - `crm.objects.products.write`
   - `crm.objects.custom.read`
   - `crm.objects.custom.write`
5. Click **Create** and copy the service key
6. Set environment variable:
   ```bash
   export MATIMO_HUBSPOT_API_KEY="your-service-key-here"
   ```

**Verify the key:**
```bash
# List contacts to verify access
curl -sS -H "Authorization: Bearer $MATIMO_HUBSPOT_API_KEY" \
  "https://api.hubapi.com/crm/v3/objects/contacts?limit=1&archived=false"
```

**Key rotation:**
- View last-used timestamp in HubSpot UI
- Rotate anytime: Settings → Integrations → Service Keys → your key → **Rotate**
- 7-day grace period during rotation
- Survives if creator leaves the account (tied to account, not user)

**Limitations:**
- Does not support webhooks (use private apps or project-based apps instead)

**Resources:**
- [Service Keys Documentation](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/account-service-keys)
- [Service Keys Changelog (Released Feb 10, 2026)](https://developers.hubspot.com/changelog/service-keys)

### Option 2: Private App (Legacy Alternative)

For users with existing private apps or if webhooks are required.

**Setup Steps:**
1. Go to your HubSpot account → Settings → Development → Legacy apps
2. Click **Create legacy app** → select **Private**
3. Name the app (e.g., "Matimo Integration"), add description and logo
4. Go to **Scopes** tab and add required scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.companies.read`
   - `crm.objects.companies.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.objects.tickets.read`
   - `crm.objects.tickets.write`
   - `crm.objects.leads.read`
   - `crm.objects.leads.write`
   - `crm.objects.line_items.read`
   - `crm.objects.line_items.write`
   - `crm.objects.invoices.read`
   - `crm.objects.invoices.write`
   - `crm.objects.orders.read`
   - `crm.objects.orders.write`
   - `crm.objects.products.read`
   - `crm.objects.products.write`
   - `crm.objects.custom.read`
   - `crm.objects.custom.write`
5. Click **Create app** and copy the access token (visible once)
6. Set environment variable:
   ```bash
   export MATIMO_HUBSPOT_API_KEY="your-access-token-here"
   ```

**Verify the token:**
```bash
# List contacts to verify access
curl -sS -H "Authorization: Bearer $MATIMO_HUBSPOT_API_KEY" \
  "https://api.hubapi.com/crm/v3/objects/contacts?limit=1&archived=false"

# Or check token metadata
curl -sS -X POST https://api.hubapi.com/oauth/v2/private-apps/get/access-token-info \
  -H "Content-Type: application/json" \
  -d '{"tokenKey":"'$MATIMO_HUBSPOT_API_KEY'"}'
```

**Token Rotation:**
- If compromised: HubSpot UI → Legacy apps → Your app → Auth → **Rotate**
- Recommended every 6 months for security

**Resources:**
- [Private Apps Documentation](https://developers.hubspot.com/docs/api/private-apps)
- [HubSpot scopes reference](https://developers.hubspot.com/docs/apps/legacy-apps/authentication/scopes)

### Option 3: OAuth2 (For Multi-Account or Marketplace Apps)

Advanced — use OAuth2 for distributing apps to multiple HubSpot accounts or handling per-account access with refresh tokens.

**When to use OAuth:**
- Distributing app to HubSpot App Marketplace
- Managing multiple HubSpot accounts with auto refresh
- Requiring per-user consent flows
- Building public/white-label integrations

**Setup Steps:**
1. Create a public app in HubSpot (Developer Hub → My apps → Create app)
2. Go to **Auth** tab and copy **Client ID** and **Client Secret**
3. Set **Redirect URI** (e.g., `http://localhost:3000/oauth/callback`)
4. Add same scopes as Private App (see above)
5. Build authorization URL and redirect users to HubSpot for approval:
   ```
   https://app.hubspot.com/oauth/authorize?client_id=YOUR_CLIENT_ID&scope=crm.objects.contacts.read%20crm.objects.contacts.write&redirect_uri=YOUR_REDIRECT_URI
   ```
6. Handle redirect → exchange code for access_token + refresh_token
7. Persist refresh_token securely and use access_token with Matimo

**Example OAuth integration (Node.js):**
```typescript
// Exchange code for token
const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.HUBSPOT_CLIENT_ID,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET,
    redirect_uri: process.env.HUBSPOT_REDIRECT_URI,
    code: authorizationCode
  })
});
const { access_token, refresh_token } = await response.json();

// Use access_token with Matimo
process.env.MATIMO_HUBSPOT_API_KEY = access_token;
const matimo = await MatimoInstance.init({ autoDiscover: true });
```

**Resources:**
- [OAuth Documentation](https://developers.hubspot.com/docs/api/working-with-oauth)
- [OAuth Quickstart Guide](https://developers.hubspot.com/docs/apps/legacy-apps/authentication/oauth-quickstart-guide)
- [Token Management API](https://developers.hubspot.com/docs/api-reference/auth-oauth-v1/guide)
- [API Rate Limits](https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines#rate-limits)

**Recommendation:** Start with Private App for testing and single-account use. Switch to OAuth when you need multi-account support.

## 🤖 Integration Examples

**Three integration patterns:**

1. **Factory Pattern** — Direct tool execution (simplest)
   ```bash
   npm run hubspot:factory
   ```
   See [examples/tools/hubspot/hubspot-factory.ts](../examples/tools/hubspot/hubspot-factory.ts)

2. **Decorator Pattern** — Class-based tools
   ```bash
   npm run hubspot:decorator
   ```
   See [examples/tools/hubspot/hubspot-decorator.ts](../examples/tools/hubspot/hubspot-decorator.ts)

3. **LangChain Integration** — AI agent tools
   ```bash
   npm run hubspot:langchain
   ```
   See [examples/tools/hubspot/hubspot-langchain.ts](../examples/tools/hubspot/hubspot-langchain.ts)

## 📖 API Reference

For detailed API documentation:
- [HubSpot CRM API Reference](https://developers.hubspot.com/docs/api-reference/crm-objects)
- [Contacts API](https://developers.hubspot.com/docs/api-reference/crm-objects-contacts)
- [Companies API](https://developers.hubspot.com/docs/api-reference/crm-objects-companies)
- [Deals API](https://developers.hubspot.com/docs/api-reference/crm-objects-deals)
- [Tickets API](https://developers.hubspot.com/docs/api-reference/crm-objects-tickets)

## 🔒 Approval System

Destructive operations (update, delete) require approval before execution. Configure approval handling programmatically:

```typescript
import { ApprovalHandler } from '@matimo/core';

// Set approval callback
ApprovalHandler.setApprovalCallback(async (toolName: string, params: Record<string, unknown>) => {
  console.log(`Approval required for: ${toolName}`);
  console.log('Parameters:', params);
  // Return true to approve, false to deny
  return true;
});

// Optional: Control auto-approval via environment variables
// MATIMO_AUTO_APPROVE=true (approve all)
// MATIMO_APPROVED_PATTERNS=hubspot-update-contact,hubspot-delete-* (approve by pattern)
```

Tools marked with 🔒 will request approval before executing.

## 📊 Tool Status

- ✅ Contacts CRUD — Production ready
- ✅ Companies CRUD — Production ready
- ✅ Deals CRUD — Production ready
- ✅ Tickets CRUD — Production ready
- 🚧 Associations API — Coming soon
- 🚧 Custom objects — Coming soon
- 🚧 Workflows & Automation — Coming soon

## ⚙️ Configuration

All tools support:
- Bearer token authentication
- Request timeouts (default 30s)
- Automatic retry with exponential backoff
- Approval workflow for destructive operations
- Comprehensive error logging

## 🧑‍💻 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

---

**Tag:** CRM  
**Part of the Matimo ecosystem.**
