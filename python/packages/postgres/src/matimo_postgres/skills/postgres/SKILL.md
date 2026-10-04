---
name: postgres
description: "Complete guide to all PostgreSQL tools — parameterized queries, schema navigation, data retrieval, and safe database interaction patterns."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Database"
  difficulty: "intermediate"
  apply-to: "postgres-execute-sql"
  tags: "postgres,sql,database,queries"
---

# PostgreSQL

This skill teaches you how to **safely execute SQL queries** against a PostgreSQL database using Matimo tools, with emphasis on parameterized queries, schema awareness, and safe patterns.

## Tools You Will Use

| Tool | Purpose |
|------|---------|
| `postgres-execute-sql` | Execute any SQL statement against a connected Postgres database |

---

## Executing a Query

Use `postgres-execute-sql` to run SQL statements. The tool supports parameterized queries for safety.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | string | SQL statement to execute. Use `$1`, `$2`, etc. for parameterized values |
| `params` | array | Optional array of parameter values (matched by position to `$1`, `$2`, etc.) |
| `schema` | string | Optional schema name for table qualification |

### Critical: Always Use Parameterized Queries

**NEVER** interpolate user-provided values directly into SQL strings. Always use `$1`, `$2` placeholders.

```json
// ✅ SAFE — parameterized
{
  "sql": "SELECT * FROM users WHERE email = $1",
  "params": ["user@example.com"]
}

// ❌ DANGEROUS — SQL injection risk
{
  "sql": "SELECT * FROM users WHERE email = 'user@example.com'"
}
```

This prevents SQL injection attacks regardless of the input content.

---

## Read Operations

### Select with Parameters

```json
{
  "sql": "SELECT id, name, email FROM users WHERE id = $1",
  "params": [42]
}
```

### Select with Multiple Conditions

```json
{
  "sql": "SELECT * FROM orders WHERE status = $1 AND created_at > $2",
  "params": ["pending", "2025-01-01"]
}
```

### Count Records

```json
{
  "sql": "SELECT count(*) as total FROM users WHERE active = $1",
  "params": [true]
}
```

### Pagination Pattern

```json
{
  "sql": "SELECT id, name, email FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
  "params": [20, 0]
}
```

Increment the offset by the limit for each page: `0`, `20`, `40`, `60`...

### Join Queries

```json
{
  "sql": "SELECT u.name, o.total, o.status FROM users u JOIN orders o ON u.id = o.user_id WHERE o.status = $1 ORDER BY o.created_at DESC LIMIT $2",
  "params": ["completed", 10]
}
```

---

## Schema Discovery

### List All Tables

```json
{
  "sql": "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name",
  "params": ["public"]
}
```

### Describe a Table

```json
{
  "sql": "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND table_schema = $2 ORDER BY ordinal_position",
  "params": ["users", "public"]
}
```

### List Indexes

```json
{
  "sql": "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1",
  "params": ["users"]
}
```

### Using Schema Parameter

When working with non-default schemas, use the `schema` parameter:

```json
{
  "sql": "SELECT * FROM customers LIMIT 10",
  "schema": "sales"
}
```

---

## Write Operations

### Insert a Row

```json
{
  "sql": "INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING id",
  "params": ["Alice Smith", "alice@example.com", "admin"]
}
```

Use `RETURNING` to get the inserted row's ID without a second query.

### Update Rows

```json
{
  "sql": "UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email",
  "params": ["newemail@example.com", 42]
}
```

### Delete Rows

```json
{
  "sql": "DELETE FROM sessions WHERE expires_at < NOW() RETURNING id",
  "params": []
}
```

### Upsert (Insert or Update)

```json
{
  "sql": "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value RETURNING key, value",
  "params": ["theme", "dark"]
}
```

---

## Understanding the Response

Every query returns:

```json
{
  "rows": [
    { "id": 1, "name": "Alice", "email": "alice@example.com" },
    { "id": 2, "name": "Bob", "email": "bob@example.com" }
  ],
  "rowCount": 2
}
```

- **`rows`**: Array of result objects (empty for non-SELECT statements)
- **`rowCount`**: Number of rows affected (for INSERT/UPDATE/DELETE) or returned (for SELECT)

---

## Common Workflows

### Workflow: Data Exploration

1. **List tables:** Query `information_schema.tables` to see what's available
2. **Describe schema:** Query `information_schema.columns` for table structure
3. **Sample data:** `SELECT * FROM {table} LIMIT 10` to understand content
4. **Targeted queries:** Build specific queries based on discovered schema

### Workflow: Reporting

1. **Aggregate data:** Use `GROUP BY`, `COUNT`, `SUM`, `AVG`
2. **Date ranges:** Filter with parameterized date values
3. **Multiple queries:** Chain queries to build multi-dimensional reports

```json
{
  "sql": "SELECT status, count(*) as count, sum(total) as revenue FROM orders WHERE created_at >= $1 GROUP BY status ORDER BY count DESC",
  "params": ["2025-01-01"]
}
```

### Workflow: Safe Bulk Operations

Always use transactions for multi-step writes:

```json
{
  "sql": "BEGIN; UPDATE accounts SET balance = balance - $1 WHERE id = $2; UPDATE accounts SET balance = balance + $1 WHERE id = $3; COMMIT;",
  "params": [100.00, 1, 2]
}
```

---

## Best Practices

1. **Always parameterize.** Every dynamic value should use `$1`, `$2`, etc. — no exceptions.
2. **Use LIMIT.** Always add `LIMIT` to SELECT queries to prevent fetching millions of rows.
3. **Use RETURNING.** On INSERT/UPDATE/DELETE, use `RETURNING` to avoid a second SELECT.
4. **Check rowCount.** Verify the expected number of rows were affected before proceeding.
5. **Use specific columns.** Avoid `SELECT *` in production — name the columns you need.
6. **Schema-qualify tables.** Use the `schema` parameter or `schema.table` syntax for clarity.
7. **Timeout awareness.** Queries timeout after 30 seconds — optimize or paginate large queries.

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `ECONNREFUSED` | Database not reachable | Check `MATIMO_POSTGRES_URL` or host/port env vars |
| `password authentication failed` | Bad credentials | Verify `MATIMO_POSTGRES_PASSWORD` env var |
| `relation "X" does not exist` | Table not found | Check table name and schema |
| `column "X" does not exist` | Wrong column name | Query `information_schema.columns` to verify |
| `syntax error at or near` | Invalid SQL | Check query syntax — use a SQL validator |
| `query timeout` | Query too slow | Add indexes, use LIMIT, or optimize the query |

---

## Authentication

PostgreSQL connection supports two modes:

### Option 1: Connection String (Recommended)

Set `MATIMO_POSTGRES_URL`:
```
postgresql://user:password@host:5432/dbname?sslmode=require
```

### Option 2: Separate Environment Variables

| Env Var | Description |
|---------|-------------|
| `MATIMO_POSTGRES_HOST` | Database hostname |
| `MATIMO_POSTGRES_PORT` | Port (default: 5432) |
| `MATIMO_POSTGRES_USER` | Username |
| `MATIMO_POSTGRES_PASSWORD` | Password |
| `MATIMO_POSTGRES_DB` | Database name |

**Never log or expose connection credentials.**
