# matimo-postgres

> PostgreSQL tools for [Matimo](https://matimo.dev) — execute SQL queries safely with policy-gated approval.

[![PyPI](https://img.shields.io/pypi/v/matimo-postgres)](https://pypi.org/project/matimo-postgres/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://matimo.dev/docs)

---

## Installation

```bash
pip install matimo matimo-postgres
```

---

## Available Tools (1 Tool)

| Tool | Description |
|------|-------------|
| `execute-sql` | Execute a SQL query against a PostgreSQL database |

The `execute-sql` tool is marked `requires_approval: true` — destructive operations (INSERT, UPDATE, DELETE, DROP) trigger HITL approval by default.

---

## Quick Start

```python
import asyncio
from matimo import Matimo, InitOptions
from matimo_postgres import get_tools_path

async def main():
    # Auto-approve for read-only usage (CI/CD)
    matimo = await Matimo.init(
        get_tools_path(),
        InitOptions(on_hitl=lambda req: {'approved': True, 'reason': 'auto'}),
    )

    # Run a SELECT query
    result = await matimo.execute('execute-sql', {
        'query': 'SELECT id, name FROM users LIMIT 10',
    })
    print(result)

asyncio.run(main())
```

### With Interactive Approval (Recommended for Writes)

```python
async def ask_user(request) -> dict:
    print(f"\nSQL requires approval:\n{request.params.get('query')}")
    answer = input("Run this query? [y/n]: ").strip()
    return {'approved': answer == 'y', 'reason': 'user reviewed'}

matimo = await Matimo.init(
    get_tools_path(),
    InitOptions(on_hitl=ask_user),
)

# This will prompt before executing
await matimo.execute('execute-sql', {
    'query': 'DELETE FROM sessions WHERE expired_at < NOW()',
})
```

---

## Authentication

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
# or individual params
export POSTGRES_HOST="localhost"
export POSTGRES_PORT="5432"
export POSTGRES_DB="mydb"
export POSTGRES_USER="myuser"
export POSTGRES_PASSWORD="mypassword"
```

---

## Security Notes

- All SQL queries go through Matimo's **content validator** — SSRF and injection patterns are detected
- The tool has `requires_approval: true` — writes trigger approval by default
- Use a **read-only database user** for agent workloads when possible
- Consider a [policy file](https://matimo.dev/docs/api-reference/POLICY_AND_LIFECYCLE) to restrict allowed SQL patterns

---

## Documentation

- [Approval System](https://matimo.dev/docs/api-reference/APPROVAL-SYSTEM)
- [Policy & Lifecycle](https://matimo.dev/docs/api-reference/POLICY_AND_LIFECYCLE)
- [Python Examples](https://github.com/tallclub/matimo/tree/main/python/examples/langchain/postgres)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-postgres/
- **GitHub:** https://github.com/tallclub/matimo

