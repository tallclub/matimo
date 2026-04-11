# matimo-hubspot

> HubSpot CRM tools for the [Matimo](https://matimo.dev) AI tools SDK — manage contacts, companies, deals, tickets, and more.

[![PyPI](https://img.shields.io/pypi/v/matimo-hubspot)](https://pypi.org/project/matimo-hubspot/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://matimo.dev/docs)

---

## Installation

```bash
pip install matimo matimo-hubspot
```

---

## Available Tools (50 Total)

Full CRUD coverage across 10 HubSpot object types:

| Object | Create | Get | List | Update | Delete |
|--------|:------:|:---:|:----:|:------:|:------:|
| Contacts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Companies | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deals | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tickets | ✅ | ✅ | ✅ | ✅ | ✅ |
| Leads | ✅ | ✅ | ✅ | ✅ | ✅ |
| Products | ✅ | ✅ | ✅ | ✅ | ✅ |
| Line Items | ✅ | ✅ | ✅ | ✅ | ✅ |
| Orders | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invoices | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom Objects | ✅ | ✅ | ✅ | ✅ | ✅ |

### Tool naming convention: `hubspot-{verb}-{object}`

Examples: `hubspot-create-contact`, `hubspot-list-deals`, `hubspot-update-ticket`, `hubspot-delete-company`

---

## Quick Start

```python
import asyncio
import os
from matimo import Matimo
from matimo_hubspot import get_tools_path

async def main():
    matimo = await Matimo.init(get_tools_path())

    # Create a contact
    contact = await matimo.execute('hubspot-create-contact', {
        'firstname': 'Jane',
        'lastname': 'Smith',
        'email': 'jane@example.com',
        'company': 'Acme Corp',
    })

    # List all deals
    deals = await matimo.execute('hubspot-list-deals', {
        'limit': 20,
    })

    # Update a ticket
    await matimo.execute('hubspot-update-ticket', {
        'ticket_id': '12345',
        'subject': 'Updated subject',
        'hs_pipeline_stage': '4',
    })

asyncio.run(main())
```

---

## Authentication

```bash
export HUBSPOT_ACCESS_TOKEN="pat-na1-your-private-app-token"
```

### Setting Up a HubSpot Private App

1. In HubSpot, go to **Settings** → **Integrations** → **Private Apps**
2. Click **Create a private app**
3. Under **Scopes**, select the CRM scopes you need (see table below)
4. Copy the **Access Token**

### Required Scopes by Object

| Objects | Scopes |
|---------|--------|
| Contacts | `crm.objects.contacts.read`, `crm.objects.contacts.write` |
| Companies | `crm.objects.companies.read`, `crm.objects.companies.write` |
| Deals | `crm.objects.deals.read`, `crm.objects.deals.write` |
| Tickets | `tickets` (read + write) |
| Custom Objects | `crm.objects.custom.read`, `crm.objects.custom.write` |

---

## LangChain CRM Agent Example

```python
from matimo import Matimo
from matimo_hubspot import get_tools_path
from matimo.integrations.langchain import convert_tools_to_langchain
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

matimo = await Matimo.init(get_tools_path())
lc_tools = convert_tools_to_langchain(
    matimo.list_tools(), matimo,
    credentials={'HUBSPOT_ACCESS_TOKEN': os.environ['HUBSPOT_ACCESS_TOKEN']},
)
llm = ChatOpenAI(model='gpt-4o-mini')
prompt = ChatPromptTemplate.from_messages([
    ('system', 'You are a CRM assistant.'),
    ('human', '{input}'),
    ('placeholder', '{agent_scratchpad}'),
])
agent = create_tool_calling_agent(llm, lc_tools, prompt)
executor = AgentExecutor(agent=agent, tools=lc_tools)
result = await executor.ainvoke({'input': 'Find all open deals and summarize pipeline status'})
```

---

## Documentation

- [HubSpot CRM API](https://developers.hubspot.com/docs/api/crm/crm-introduction)
- [Python Examples](https://github.com/tallclub/matimo/tree/main/python/examples/native/hubspot)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-hubspot/
- **GitHub:** https://github.com/tallclub/matimo
- **HubSpot Developer Docs:** https://developers.hubspot.com/

