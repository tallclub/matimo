# @matimo/postgres — Postgres Tools for Matimo

Secure, approval-aware SQL execution for Postgres databases with built-in protection for destructive operations.

## Features

✨ **Core Capabilities**
- Execute any SQL query (SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, etc.)
- Automatic destructive operation detection
- Approval workflow for dangerous operations
- Flexible connection options (URL or individual parameters)
- Full parameter binding support
- Sequential discovery pattern for safe database exploration

🔒 **Safety & Security**
- Detects destructive SQL: `CREATE`, `DROP`, `ALTER`, `TRUNCATE`, `DELETE`, `UPDATE`, `INSERT`
- Requires explicit approval before executing destructive operations
- Support for both interactive approval (CLI) and automated approval (CI/CD)
- Never exposes database credentials to external systems

---

## Installation

```bash
pnpm add @matimo/postgres
```

---

## Quick Start

### 1. Set Up Database Connection

Choose one approach:

**Option A: Connection String**
```bash
export MATIMO_POSTGRES_URL="postgresql://user:password@localhost:5432/dbname"
```

**Option B: Individual Parameters**
```bash
export MATIMO_POSTGRES_HOST="localhost"
export MATIMO_POSTGRES_PORT="5432"
export MATIMO_POSTGRES_USER="user"
export MATIMO_POSTGRES_PASSWORD="password"
export MATIMO_POSTGRES_DB="dbname"
```

### 2. Use in Code

```typescript
import { MatimoInstance } from '@matimo/core';

// Initialize with auto-discovery
const matimo = await MatimoInstance.init({ autoDiscover: true });

// Execute a safe SELECT query (no approval needed)
const result = await matimo.execute('postgres-execute-sql', {
  sql: 'SELECT * FROM users WHERE id = $1;',
  params: [42]
});

console.log(result.rows);
```

---

## Available Tools

### `postgres-execute-sql`

Execute SQL queries against a Postgres database with automatic approval for destructive operations.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sql` | `string` | ✅ | SQL query to execute. Use `$1`, `$2`, etc. for parameterized queries. |
| `params` | `unknown[]` \| `unknown[][]` | ❌ | Query parameters for parameterized SQL. |

#### Returns

```typescript
{
  success: boolean;
  rows?: any[];          // Returned rows (for SELECT queries)
  rowCount?: number;     // Affected rows (for INSERT/UPDATE/DELETE)
  command?: string;      // SQL command executed
  error?: string;        // Error message (if failed)
}
```

#### Examples

**Safe SELECT (no approval needed)**
```typescript
const result = await matimo.execute('postgres-execute-sql', {
  sql: 'SELECT id, name FROM users LIMIT 10;'
});
```

**Parameterized Query (prevents SQL injection)**
```typescript
const result = await matimo.execute('postgres-execute-sql', {
  sql: 'SELECT * FROM users WHERE name = $1 AND age > $2;',
  params: ['Alice', 25]
});
```

**Destructive Operation (requires approval)**
```typescript
// This will trigger approval workflow
const result = await matimo.execute('postgres-execute-sql', {
  sql: 'UPDATE users SET last_login = NOW() WHERE id = $1;',
  params: [42]
});
// ⚠️ User will be prompted for approval (unless auto-approved)
```

---

## Approval Flow

### Automatic Detection

The tool automatically detects destructive operations:

| Operation | Detected | Auto-Approved | Requires Approval |
|-----------|----------|---------------|-------------------|
| SELECT | ✅ | ✅ Yes | ❌ No |
| INSERT | ✅ | ✅ Yes| ❌ No|
| UPDATE | ✅ | ❌ No | ✅ Yes |
| DELETE | ✅ | ❌ No | ✅ Yes |
| CREATE | ✅ | ❌ No | ✅ Yes |
| DROP | ✅ | ❌ No | ✅ Yes |
| ALTER | ✅ | ❌ No | ✅ Yes |
| TRUNCATE | ✅ | ❌ No | ✅ Yes |

### Approval Methods

#### 1. **Interactive Approval (CLI)**
For interactive terminal environments:

```typescript
import { MatimoInstance, getGlobalApprovalHandler } from '@matimo/core';
import * as readline from 'readline';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const handler = getGlobalApprovalHandler();

// Set interactive callback
handler.setApprovalCallback(async (request) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(
      `\nApprove ${request.toolName}?\nSQL: ${request.params.sql}\n(yes/no): `,
      answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      }
    );
  });
});

// Approve write operations
await matimo.execute('postgres-execute-sql', {
  sql: 'UPDATE users SET active = true'
});
```

#### 2. **Automatic Approval (CI/CD)**
For automated environments:

```bash
# Enable auto-approval for all operations requiring approval
export MATIMO_AUTO_APPROVE=true
```

#### 3. **Pattern-Based Approval**
Pre-approve specific patterns:

```bash
# Approve only postgres-execute-sql tool
export MATIMO_APPROVED_PATTERNS="postgres-*"
```

---

## Integration Patterns

### Factory Pattern

```typescript
import { MatimoInstance } from '@matimo/core';

async function main() {
  const matimo = await MatimoInstance.init({ autoDiscover: true });
  
  // Step 1: Discover tables
  const tables = await matimo.execute('postgres-execute-sql', {
    sql: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `
  });
  
  console.log('Tables:', tables.rows?.map(r => r.table_name));
}

main();
```

### Decorator Pattern

```typescript
import { MatimoInstance, setGlobalMatimoInstance, tool } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

class DatabaseClient {
  @tool('postgres-execute-sql')
  async queryUsers(minAge: number) {
    // Auto-executes via Matimo
  }

  @tool('postgres-execute-sql')
  async updateUserStatus(userId: number, status: string) {
    // Requires approval (UPDATE operation)
  }
}

const db = new DatabaseClient();
```

### LangChain Integration

```typescript
import { MatimoInstance, convertToolsToLangChain } from '@matimo/core';
import { ChatOpenAI } from '@langchain/openai';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// Convert Postgres tool to LangChain format
const tools = await convertToolsToLangChain(
  [matimo.getTool('postgres-execute-sql')!],
  matimo
);

// LLM can now use SQL execution tool
const agent = await createAgent({
  model: new ChatOpenAI({ modelName: 'gpt-4o-mini' }),
  tools: tools
});
```

---

## Sequential Discovery Pattern

The recommended workflow for safe database exploration:

```
Step 1: Discover Tables (SELECT - no approval)
  ↓
Step 2: Get Table Counts/Structure (SELECT - no approval)
  ↓
Step 3: Execute Destructive Operations (requires approval)
  ↓
Step 4: Use Discovered Data
```

Example implementation:

```typescript
// 1. What tables exist?
const tables = await matimo.execute('postgres-execute-sql', {
  sql: `SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' ORDER BY table_name;`
});

// 2. How much data in each table?
const counts = await matimo.execute('postgres-execute-sql', {
  sql: `SELECT table_name, (SELECT count(*) FROM X) 
        FROM information_schema.tables WHERE table_schema = 'public';`
});

// 3. Now safely operate on discovered tables
if (tables.rows?.length > 0) {
  const tableName = tables.rows[0].table_name;
  
  // This will require approval
  const result = await matimo.execute('postgres-execute-sql', {
    sql: `DELETE FROM ${tableName} WHERE archived = true;`
  });
}
```

---

## Error Handling

```typescript
import { MatimoError, ErrorCode } from '@matimo/core';

try {
  const result = await matimo.execute('postgres-execute-sql', {
    sql: 'SELECT * FROM nonexistent_table;'
  });
} catch (err) {
  if (err instanceof MatimoError) {
    console.error(`Code: ${err.code}`);
    console.error(`Message: ${err.message}`);
    console.error(`Details:`, err.details);
  }
}
```

Common error codes:
- `INVALID_SCHEMA` — Missing required SQL parameter
- `EXECUTION_FAILED` — Query execution error (connection, syntax, etc.)
- `AUTH_FAILED` — Destructive operation not approved

---

## Connection String Format

Standard PostgreSQL connection string format:

```
postgresql://[user[:password]@][host][:port][/database]
```

**Examples:**
```
postgresql://user:password@localhost:5432/mydb
postgresql://localhost/mydb                      # Local with defaults
postgresql://user@localhost                      # Without port
```

---

## Environment Variables

### Connection

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `MATIMO_POSTGRES_URL` | One of these | `postgresql://...` | Full connection string |
| `MATIMO_POSTGRES_HOST` | ✅ (if not URL) | `localhost` | Database host |
| `MATIMO_POSTGRES_PORT` | ❌ | `5432` | Database port (default: 5432) |
| `MATIMO_POSTGRES_USER` | ✅ (if not URL) | `postgres` | Database user |
| `MATIMO_POSTGRES_PASSWORD` | ✅ (if not URL) | `secret` | Database password |
| `MATIMO_POSTGRES_DB` | ✅ (if not URL) | `mydb` | Database name |

### Approval

| Variable | Values | Description |
|----------|--------|-------------|
| `MATIMO_SQL_AUTO_APPROVE` | `true` / `false` | Auto-approve all destructive operations (for CI/CD) |
| `MATIMO_SQL_APPROVED_PATTERNS` | Regex patterns | Comma-separated patterns for pre-approved queries |

---

## Examples

See `examples/tools/postgres/` in the Matimo repository:

- **`postgres-factory.ts`** — Factory pattern with sequential discovery
- **`postgres-decorator.ts`** — Class-based decorator pattern
- **`postgres-langchain.ts`** — AI agent using LangChain (GPT-4o-mini)
- **`postgres-with-approval.ts`** — Interactive approval workflow

Run examples:
```bash
cd examples/tools

# Factory pattern
pnpm postgres:factory

# Decorator pattern
pnpm postgres:decorator

# LangChain AI agent
pnpm postgres:langchain

# Interactive approval flow (requires terminal)
pnpm postgres:approval
```

---

## Troubleshooting

### Connection Refused
**Error:** `connect ECONNREFUSED`

**Solution:**
- Check Postgres is running: `pg_isready -h localhost -p 5432`
- Verify credentials and host
- Ensure database exists: `createdb mydb`

### Authentication Failed
**Error:** `password authentication failed`

**Solution:**
- Check `MATIMO_POSTGRES_USER` and `MATIMO_POSTGRES_PASSWORD`
- Reset password: `ALTER USER postgres WITH PASSWORD 'newpassword';`

### Approval Required Error
**Error:** `Destructive SQL requires approval`

**Solution:**
- Set `MATIMO_SQL_AUTO_APPROVE=true` in CI/CD
- Or use interactive approval: `pnpm postgres:approval`
- Or pre-approve patterns: `export MATIMO_SQL_APPROVED_PATTERNS="DELETE.*,UPDATE.*"`

### Parameter Binding Error
**Error:** `bind message supplies X parameters, but prepared statement requires Y`

**Solution:**
- Use placeholders for all parameters: `$1`, `$2`, etc.
- Match number of `params` to number of placeholders
- Example: `'WHERE id = $1'` with `params: [42]`

---

## Contributing

Found a bug or want to request a feature? 
- [Open an issue](https://github.com/tallclub/matimo/issues)
- [Start a discussion](https://github.com/tallclub/matimo/discussions)

---

## Part of the Matimo Ecosystem

Learn more about Matimo:
- 📖 [Documentation](https://matimo.dev/docs)
- 🔗 [GitHub Repository](https://github.com/tallclub/matimo)
- ⭐ [Star the project](https://github.com/tallclub/matimo)
