# HubSpot Tools Examples

Example directory contains **3 example patterns** showing different ways to use Matimo's HubSpot tools:
1. **Factory Pattern** - Direct SDK execution (simplest)
2. **Decorator Pattern** - Class-based with @tool decorators
3. **LangChain Pattern** - AI-driven with OpenAI agent

All examples are **fully working** and demonstrate real HubSpot operations (contacts, companies, products, invoices, etc.).

## 🚀 Quick Start

### 1. Create a HubSpot Service Key

1. Go to your HubSpot workspace
2. Click **Settings** (gear icon) → **Integrations** → **Service Keys**
3. Click **Create service key**
4. Enter a name like "Matimo Integration"
5. Select required scopes

### 2. Configure Required Scopes

Select these scopes for full functionality:

**Required Scopes:**
```
crm.objects.contacts.read        - Read contacts
crm.objects.contacts.write       - Create/update contacts
crm.objects.companies.read       - Read companies
crm.objects.companies.write      - Create/update companies
crm.objects.products.read        - Read products
crm.objects.products.write       - Create/update products
crm.objects.invoices.read        - Read invoices
crm.objects.invoices.write       - Create/update invoices
crm.objects.deals.read           - Read deals
crm.objects.deals.write          - Create/update deals
crm.objects.leads.read           - Read leads
crm.objects.leads.write          - Create/update leads
crm.objects.line_items.read      - Read line items
crm.objects.line_items.write     - Create/update line items
```

### 3. Copy Your Service Key

Once created, copy the **Service Key** (starts with `pat-na1-` or `pat-eu1-`)

### 4. Set Up Environment

Create a `.env` file in `examples/tools/`:

```env
MATIMO_HUBSPOT_API_KEY=pat-na1-your-service-key-here
OPENAI_API_KEY=sk-your-openai-key-here
```

The `OPENAI_API_KEY` is only required for the LangChain example.

### 5. Run Examples

```bash
# Factory Pattern (simplest, direct API calls)
pnpm hubspot:factory

# Decorator Pattern (class-based OOP approach)
pnpm hubspot:decorator

# LangChain Pattern (AI-driven agent with OpenAI)
pnpm hubspot:langchain
```

## 📚 Examples Overview

### 1. Factory Pattern (`hubspot-factory.ts`)

**Best for:** Scripts, quick tests, CLI tools

**What it does:**
- ✅ Direct tool execution with `matimo.execute()`
- ✅ Creates contacts, companies, products, invoices
- ✅ Lists existing resources
- ✅ Retrieves specific records by ID
- ✅ Simplest implementation

**Run it:**
```bash
pnpm hubspot:factory
```

**Key Code:**
```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });

// Create a contact
const contact = await matimo.execute('hubspot-create-contact', {
  email: 'john@example.com',
  firstname: 'John',
  lastname: 'Doe'
});

// List contacts
const contacts = await matimo.execute('hubspot-list-contacts', {
  limit: 10,
  properties: ['email', 'firstname', 'lastname']
});

// Create a company
const company = await matimo.execute('hubspot-create-company', {
  name: 'Acme Corp',
  domain: 'acme.com'
});
```

**File:** [hubspot-factory.ts](hubspot-factory.ts)

### 2. Decorator Pattern (`hubspot-decorator.ts`)

**Best for:** Object-oriented design, class-based applications

**What it does:**
- ✅ Class methods decorated with `@tool`
- ✅ Automatic tool execution via decorators
- ✅ Multiple operations in organized class
- ✅ Creates contacts, companies, products, invoices
- ✅ OOP-friendly approach

**Run it:**
```bash
pnpm hubspot:decorator
```

**Key Code:**
```typescript
import { setGlobalMatimoInstance, tool } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

class HubSpotAgent {
  @tool('hubspot-create-contact')
  async createContact(email: string, firstname: string, lastname: string) {
    // Decorator auto-executes the tool
  }

  @tool('hubspot-create-company')
  async createCompany(name: string, domain: string) {
    // Also auto-executed
  }

  @tool('hubspot-list-contacts')
  async listContacts(limit: number, properties: string[]) {
    // Decorator handles execution
  }
}

const agent = new HubSpotAgent();
await agent.createContact('john@example.com', 'John', 'Doe');
await agent.createCompany('Acme Corp', 'acme.com');
const contacts = await agent.listContacts(10, ['email', 'firstname', 'lastname']);
```

**File:** [hubspot-decorator.ts](hubspot-decorator.ts)

### 3. LangChain Pattern (`hubspot-langchain.ts`)

**Best for:** AI-driven workflows, autonomous agents, multi-step reasoning

**What it does:**
- ✅ Real AI agent using OpenAI (GPT-4o-mini)
- ✅ LLM decides which tools to use based on natural language
- ✅ LLM generates parameters from context
- ✅ Autonomous tool execution and result processing
- ✅ Natural language conversation with the agent
- ✅ Multi-step workflows with reasoning

**Prerequisites:**
- Requires `OPENAI_API_KEY` set in `.env`
- Requires `@langchain/openai` and `langchain` dependencies

**Run it:**
```bash
pnpm hubspot:langchain
```

**Key Code:**
```typescript
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { convertToolsToLangChain } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// Get HubSpot tools
const hubspotTools = matimo.listTools()
  .filter(t => t.name.startsWith('hubspot-'));

// Convert to LangChain format
const langchainTools = await convertToolsToLangChain(
  hubspotTools,
  matimo
);

// Create LLM-powered agent
const model = new ChatOpenAI({ modelName: 'gpt-4o-mini' });
const agent = await createAgent({ model, tools: langchainTools });

// Natural language requests - LLM decides which tools to use
const response = await agent.invoke({
  messages: [{
    role: 'user',
    content: 'Create a new contact named John Smith with email john@example.com'
  }]
});

console.log(response.messages[response.messages.length - 1].content);
```

**Agent Examples:**
```
User: "Create a new contact for John Smith with email john@example.com"
Agent: "I'll create a new contact with that information..." [calls hubspot-create-contact]
Agent: "Done! Created contact with ID 123456"

User: "Add a new company called TechCorp"
Agent: "I'll add TechCorp to the system..." [calls hubspot-create-company]
Agent: "Company TechCorp has been created with ID 789012"

User: "How many contacts do we have?"
Agent: "Let me check..." [calls hubspot-list-contacts]
Agent: "You have 47 contacts in the system"

User: "Create a product called Premium Suite for $299.99"
Agent: "I'll create that product..." [calls hubspot-create-product]
Agent: "Product Premium Suite created with ID 345678"

User: "Generate an invoice"
Agent: "I'll create an invoice..." [calls hubspot-create-invoice]
Agent: "Invoice created with ID 567890"
```

**File:** [hubspot-langchain.ts](hubspot-langchain.ts)

## 🔧 Supported Operations

All examples work with these HubSpot operations:

| Operation | Tool Name | Example |
|-----------|-----------|---------|
| **Create Contact** | `hubspot-create-contact` | Create a new contact |
| **Get Contact** | `hubspot-get-contact` | Retrieve contact details |
| **List Contacts** | `hubspot-list-contacts` | List all contacts |
| **Create Company** | `hubspot-create-company` | Create a new company |
| **Get Company** | `hubspot-get-company` | Retrieve company details |
| **Create Product** | `hubspot-create-product` | Create a new product |
| **Create Invoice** | `hubspot-create-invoice` | Create a new invoice |
| **List Products** | `hubspot-list-products` | List all products |

See [packages/hubspot/README.md](../../packages/hubspot/README.md) for complete tool list and documentation.

## 📖 Full Documentation

For comprehensive documentation, see:

- **Package Docs:** [packages/hubspot/README.md](../../packages/hubspot/README.md)
- **HubSpot API Reference:** https://developers.hubspot.com/docs/api-reference/crm-objects
- **Service Keys Guide:** https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/account-service-keys
- **Matimo Documentation:** [docs/getting-started/](../../docs/getting-started/)

## 🛠️ Troubleshooting

### "MATIMO_HUBSPOT_API_KEY not set"
```bash
# Solution: Set your HubSpot service key
export MATIMO_HUBSPOT_API_KEY="pat-na1-your-key-here"
```

### "Property does not exist"
Your service key might not have the required scopes. Go to HubSpot Settings → Integrations → Service Keys and verify all 14 CRM scopes are enabled.

### "Unauthorized" (401 error)
- Verify your service key is correct (check for typos)
- Verify scopes include the required permissions
- Try rotating the key: Settings → Service Keys → your key → Rotate

### "OpenAI API error" (LangChain example)
```bash
# Solution: Ensure OpenAI API key is set
export OPENAI_API_KEY="sk-your-openai-key-here"

# Get one from: https://platform.openai.com/account/api-keys
```

### "Module not found: @langchain/openai"
```bash
# Solution: Install LangChain dependencies
pnpm install
```

## 🚀 Next Steps

1. **Try each example:**
   - Start with Factory (simplest)
   - Try Decorator (OOP style)
   - Explore LangChain (AI-driven)

2. **Build your own:**
   - Combine patterns as needed
   - Add more HubSpot tools from [full list](../../packages/hubspot/README.md)
   - Integrate with your own application

3. **Advanced:**
   - Use multi-step workflows with LangChain agent
   - Chain multiple HubSpot operations
   - Combine HubSpot tools with other Matimo providers (Slack, Gmail, etc.)

---

**Questions?** See [CONTRIBUTING.md](../../CONTRIBUTING.md) or review the Matimo core documentation.
