# matimo-postgres

> PostgreSQL tools for [Matimo](https://matimo.dev) - execute SQL queries safely with policy-gated approval.

[![PyPI](https://img.shields.io/pypi/v/matimo-postgres)](https://pypi.org/project/matimo-postgres/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://docs.matimo.dev)

---

## Installation

```bash
pip install matimo matimo-postgres
```

---

## Available Tools (1 Tool)

| Tool | Description |
|------|-------------|
| `postgres-execute-sql` | Execute a SQL query against a PostgreSQL database |

The tool does not set `requires_approval` itself - if you want destructive operations
(INSERT, UPDATE, DELETE, DROP) to require human approval, gate them yourself via a
[policy file](https://docs.matimo.dev/api-reference/POLICY_AND_LIFECYCLE) or a custom
`PolicyEngine`.

---

## Quick Start

```python
import asyncio
from matimo import Matimo
from matimo_postgres import get_tools_path

async def main():
    matimo = await Matimo.init(get_tools_path())

    # Run a SELECT query
    result = await matimo.execute('postgres-execute-sql', {
        'sql': 'SELECT id, name FROM users LIMIT 10',
    })
    print(result)

asyncio.run(main())
```

### With Interactive Approval (Recommended for Writes)

A query whose `sql` contains a destructive keyword (`DELETE`, `DROP`, `UPDATE`, `INSERT`, `ALTER`, `CREATE`, ...) needs approval. Provide an `on_approval` callback; without one the query is refused:

```python
from matimo import ApprovalRequest


async def ask_user(request: ApprovalRequest) -> bool:
    print(f"\nSQL requires approval:\n{request.params.get('sql')}")
    return input("Run this query? [y/n]: ").strip() == "y"


matimo = await Matimo.init(get_tools_path(), on_approval=ask_user)

# Prompts before executing
await matimo.execute('postgres-execute-sql', {
    'sql': 'DELETE FROM sessions WHERE expired_at < NOW()',
})
```

The keyword match is a substring of the upper-cased query, so a `SELECT created_at ...` also asks (it contains `CREATE`).

---

## Authentication

```bash
export MATIMO_POSTGRES_URL="postgresql://user:password@localhost:5432/mydb"
# or individual params
export MATIMO_POSTGRES_HOST="localhost"
export MATIMO_POSTGRES_PORT="5432"
export MATIMO_POSTGRES_DB="mydb"
export MATIMO_POSTGRES_USER="myuser"
export MATIMO_POSTGRES_PASSWORD="mypassword"
```

**Encrypted connections (TLS)**
```bash
export MATIMO_POSTGRES_SSL="verify-full"   # disable (default), require, verify-ca or verify-full
```
`require` encrypts but does not verify the server certificate. Use `verify-ca` or `verify-full` for any database that is not on the same host. An unknown value is rejected.

---

## Security Notes

- All SQL queries go through Matimo's **content validator** - SSRF and injection patterns are detected
- The tool's YAML does not set `requires_approval`, but the approval handler asks before SQL that writes, changes the schema, or reaches files, the OS or other servers (`COPY`, `pg_read_file`, `lo_export`, `dblink`, `DO`, `CALL`, ...). Without an `on_approval` callback those queries are refused
- Use a **read-only database user** for agent workloads when possible
- Consider a [policy file](https://docs.matimo.dev/api-reference/POLICY_AND_LIFECYCLE) to restrict allowed SQL patterns

---

## Documentation

- [Approval System](https://docs.matimo.dev/api-reference/APPROVAL-SYSTEM)
- [Policy & Lifecycle](https://docs.matimo.dev/api-reference/POLICY_AND_LIFECYCLE)
- [Python Examples](https://github.com/tallclub/matimo/tree/main/python/examples/langchain/postgres)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-postgres/
- **GitHub:** https://github.com/tallclub/matimo

