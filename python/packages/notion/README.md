# matimo-notion

> Notion tools for [Matimo](https://matimo.dev) — create pages, query databases, search, and manage content.

[![PyPI](https://img.shields.io/pypi/v/matimo-notion)](https://pypi.org/project/matimo-notion/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://matimo.dev/docs)

---

## Installation

```bash
pip install matimo matimo-notion
```

---

## Available Tools (7 Total)

| Tool | Description |
|------|-------------|
| `notion_search` | Search pages and databases across a workspace |
| `notion_list_databases` | List databases the integration has access to |
| `notion_query_database` | Query a database with optional filters and sorts |
| `notion_create_page` | Create a new page (in a database or as a child page) |
| `notion_update_page` | Update page properties or archive/restore a page |
| `notion_create_comment` | Add a comment to a page or discussion thread |
| `notion_get_user` | Get user profile by ID or get the bot user |

---

## Quick Start

```python
import asyncio
from matimo import Matimo
from matimo_notion import get_tools_path

async def main():
    matimo = await Matimo.init(get_tools_path())

    # Search for pages/databases
    results = await matimo.execute('notion_search', {
        'query': 'Product Roadmap',
    })

    # Query a database
    rows = await matimo.execute('notion_query_database', {
        'database_id': 'your-database-id',
        'filter': {'property': 'Status', 'select': {'equals': 'In Progress'}},
    })

    # Create a page in a database
    await matimo.execute('notion_create_page', {
        'parent_id': 'your-database-id',
        'title': 'New Task',
        'properties': {'Status': {'select': {'name': 'Todo'}}},
    })

asyncio.run(main())
```

---

## Authentication

```bash
export NOTION_API_KEY="secret_your-integration-token"
```

### Setting Up a Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration**
2. Set capabilities: Read content, Update content, Insert content
3. Copy the **Internal Integration Secret**
4. Share the pages/databases you want to access with your integration

---

## Documentation

- [Notion API Reference](https://developers.notion.com/reference)
- [Python Examples](https://github.com/tallclub/matimo/tree/main/python/examples/native/notion)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-notion/
- **GitHub:** https://github.com/tallclub/matimo
- **Notion API Docs:** https://developers.notion.com/

