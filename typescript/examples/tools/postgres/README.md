# Postgres Tool Examples

These examples demonstrate how to use the Matimo Postgres execute-sql tool with different patterns and approval flows.

## ⚡ Quick Setup



## Prerequisites

Before running any examples, you need a Postgres database instance. You can either: 

### Option 1: Docker (Recommended - One Command)

```bash
docker run --name postgres-matimo -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

### Option 2: Local Installation

**macOS with Homebrew:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install postgresql
sudo systemctl start postgresql
```

### Configure Connection String

The examples use these environment variables from `.env`:

```bash
MATIMO_POSTGRES_HOST=localhost
MATIMO_POSTGRES_PORT=5432
MATIMO_POSTGRES_USER=your_user_name
MATIMO_POSTGRES_PASSWORD=your_db_password
MATIMO_POSTGRES_DB=your_db_name
```

Or use a full connection string:

```bash
MATIMO_POSTGRES_URL="your connection string"
```

---

## Running the Examples

### 1. Factory Pattern (Simple Usage)

```bash
pnpm tsx examples/tools/postgres/postgres-factory.ts
or
pnpm postgres:factory
```

Basic example showing how to initialize Matimo and execute a tool.

### 2. Decorator Pattern (Class-Based)

```bash
pnpm tsx examples/tools/postgres/postgres-decorator.ts
or
pnpm postgres:decorator
```

Example using the `@tool` decorator for a class-based approach.

### 3. LangChain Integration

```bash
pnpm tsx examples/tools/postgres/postgres-langchain.ts
or
pnpm postgres:langchain
```

Example converting Postgres tools to LangChain-compatible schemas.

### 4. Real Database with Approval Flow (Interactive)

```bash
pnpm tsx examples/tools/postgres/postgres-with-approval.ts
or
pnpm postgres:approval
```

**Most comprehensive example** that demonstrates:
- ✅ Non-destructive queries (SELECT) - no approval needed
- ✅ Destructive queries (INSERT, UPDATE, DELETE) - interactive approval
- ✅ Interactive approval callback that asks for user confirmation
- ✅ Auto-approval mode for CI/automated environments
- ✅ Error handling and proper feedback

This example **requires a real Postgres connection** and will:
1. Ask for permission before executing destructive SQL operations
2. Show actual query results
3. Demonstrate approval rejection workflow

**Example session:**
```
🚀 Postgres Tool Example with Approval Flow
==================================================

1️⃣  Non-destructive query (SELECT - no approval needed)
--------------------------------------------------
✅ Query executed successfully
Result: { command: 'SELECT', rowCount: 1, rows: [{...}] }

2️⃣  Destructive query (INSERT - requires approval)
--------------------------------------------------
⚠️  Approval Required for WRITE operation:
SQL: INSERT INTO test_table ...
Do you approve? (yes/no): yes
Result: ✅ APPROVED
✅ INSERT approved and executed successfully
```

## Approval Modes

### Interactive Mode (Default)

In interactive mode, the tool will prompt you before executing destructive SQL:

```bash
pnpm tsx examples/tools/postgres/postgres-with-approval.ts
```

### CI/Automated Mode

For automated environments or CI pipelines, enable auto-approval:

```bash
export MATIMO_SQL_AUTO_APPROVE=true
pnpm tsx examples/tools/postgres/postgres-with-approval.ts
```

### Permanent Approval Patterns

Define SQL patterns that are permanently approved:

```bash
export MATIMO_SQL_APPROVED_PATTERNS="DELETE FROM logs|DROP TABLE test_.*|TRUNCATE.*"
pnpm tsx examples/tools/postgres/postgres-with-approval.ts
```

## Destructive SQL Detection

The Postgres tool automatically detects and requires approval for these operations:
- `CREATE` - Create tables, indexes, etc.
- `DROP` - Drop tables, indexes, etc.
- `ALTER` - Alter tables, columns, etc.
- `TRUNCATE` - Truncate tables
- `DELETE` - Delete rows
- `UPDATE` - Update rows

**SELECT, INSERT (without parameter templating), and other read-only operations are not flagged as destructive.**

## Troubleshooting

### "Connection refused" Error

Make sure Postgres is running:

```bash
# Check if running
psql -U postgres -c "SELECT version();"

# Or start Docker container
docker run --name postgres-matimo -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

### "Permission denied" for CREATE TABLE

Use a superuser or ensure the user has CREATE permissions:

```sql
ALTER USER username CREATEDB;
```

### Questions?

Check the [Matimo documentation](https://github.com/tallclub/matimo/docs) or [GitHub issues](https://github.com/tallclub/matimo/issues).
