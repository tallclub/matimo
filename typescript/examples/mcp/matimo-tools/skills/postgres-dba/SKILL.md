---
name: postgres-dba
description: "Complete guide for DBA agents managing PostgreSQL databases — query execution, performance tuning, connection monitoring, index health, and VACUUM management. USE THIS SKILL whenever the user asks to inspect, diagnose, optimize, or manage a PostgreSQL database. Triggers include: 'show me slow queries', 'check table bloat', 'what connections are active', 'find unused indexes', 'why is my DB slow', 'run this SQL', or any Postgres health/diagnostic task."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Database"
  difficulty: "intermediate"
  apply-to: "pg_run_query pg_table_stats pg_slow_queries pg_index_health pg_active_connections pg_vacuum_status"
---

# PostgreSQL DBA Skill

A complete skill for DBA agents to monitor, diagnose, and manage PostgreSQL databases using Matimo tools.

## Prerequisites

All tools communicate with PostgreSQL via a REST API wrapper. Ensure:
1. A REST API (PostgREST, custom Express/FastAPI, or Supabase) is running and accessible.
2. Two environment variables are set:
   - `PG_API_URL` — Base URL of the REST API (e.g., `http://localhost:3000`)
   - `PG_API_KEY` — Bearer token for authenticating with the REST API

The API must expose a `POST /query` endpoint accepting `{ sql, database }` and returning `{ rows, rowCount, fields }`.

---

## Tools You Will Use

| Tool | Purpose |
|------|---------|
| `pg_run_query` | Execute arbitrary read-only SQL SELECT statements |
| `pg_table_stats` | Get table size, live/dead row counts, and VACUUM history |
| `pg_slow_queries` | Fetch top slow queries from `pg_stat_statements` |
| `pg_index_health` | Inspect index usage stats and identify unused indexes |
| `pg_active_connections` | Monitor live connections and long-running transactions |
| `pg_vacuum_status` | Check dead tuple counts and autovacuum status per table |

---

## Workflow 1: Health Check (Start Here)

When a user asks "how is my database doing?", run this sequence:

### Step 1 — Active Connections Snapshot
```
pg_active_connections({ state: "all", minDurationSeconds: 0 })
```
Look for: high connection count, `idle in transaction` states, long-running queries (duration > 30s).

### Step 2 — Table Health Overview
```
pg_table_stats({ schema: "public" })
```
Look for: high `dead_rows` relative to `live_rows`, missing recent `last_autovacuum` timestamps.

### Step 3 — VACUUM Pressure Check
```
pg_vacuum_status({ schema: "public", deadTupleThreshold: 5000 })
```
Look for: `dead_pct` above 10%, stale `last_autovacuum` on high-write tables.

### Step 4 — Index Health
```
pg_index_health({ schema: "public", showUnused: true })
```
Look for: large indexes with 0 scans (storage waste and write overhead).

---

## Workflow 2: Performance Debugging

When a user says "the DB is slow":

### Step 1 — Find Long-Running Queries
```
pg_active_connections({ state: "active", minDurationSeconds: 10 })
```
Any query over 10s is suspicious. If `wait_event` is `Lock`, there's contention.

### Step 2 — Pull Slow Query Statistics
```
pg_slow_queries({ limit: 20, minCalls: 5 })
```
Key columns:
- `avg_ms` — Above 100ms warrants investigation.
- `cache_hit_pct` — Below 95% means disk I/O; consider indexes or increasing `shared_buffers`.
- `stddev_ms` — High variance indicates lock waits or table bloat.

### Step 3 — Check Index Coverage
```
pg_index_health({ schema: "public", showUnused: false })
```
Cross-reference slow queries with low-scan indexes.

### Step 4 — Targeted Ad-Hoc Queries
```
pg_run_query({ sql: "SELECT * FROM pg_locks WHERE NOT granted" })
```
Use for any diagnostic SQL not covered by specialist tools. Read-only SELECTs only.

---

## Workflow 3: Bloat and VACUUM Management

### Step 1 — Find Bloated Tables
```
pg_vacuum_status({ schema: "public", deadTupleThreshold: 10000 })
```
Tables with `dead_pct` above 20% and stale `last_autovacuum` need attention.

### Step 2 — Confirm with Table Stats
```
pg_table_stats({ schema: "public", table: "orders" })
```
Large gap between `table_size` and `total_size` indicates index bloat.

### Step 3 — Report to User
Recommend the DBA run directly in psql:
```sql
VACUUM ANALYZE tablename;
-- For severe bloat (locks table, use off-hours):
VACUUM FULL tablename;
```
Do NOT execute these via `pg_run_query` — they are write operations.

---

## Workflow 4: Index Optimization

### Step 1 — List Unused Indexes
```
pg_index_health({ schema: "public", showUnused: true })
```
An index with `scans: 0` has never been used since last `pg_stat_reset()`.

### Step 2 — Confirm Before Recommending Drops
Before recommending `DROP INDEX`:
1. Verify it's not used by a constraint (PRIMARY KEY, UNIQUE).
2. Check if stats were recently reset: `SELECT stats_reset FROM pg_stat_bgwriter`.
3. Always get human DBA confirmation — dropping is irreversible.

Safe drop command:
```sql
DROP INDEX CONCURRENTLY index_name;
```

---

## Common Ad-Hoc Queries via `pg_run_query`

### Check replication lag
```sql
SELECT client_addr, state, (sent_lsn - replay_lsn) AS replication_lag_bytes
FROM pg_stat_replication;
```

### Tables missing primary keys
```sql
SELECT t.table_name FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints c
  ON t.table_name = c.table_name AND c.constraint_type = 'PRIMARY KEY'
WHERE t.table_schema = 'public' AND c.constraint_name IS NULL;
```

### Cache hit rate (target > 99%)
```sql
SELECT round(sum(blks_hit) * 100.0 / sum(blks_hit + blks_read), 2) AS cache_hit_pct
FROM pg_stat_database;
```

### Largest tables by disk usage
```sql
SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) AS size
FROM pg_class WHERE relkind = 'r'
ORDER BY pg_total_relation_size(oid) DESC LIMIT 10;
```

### Find duplicate indexes
```sql
SELECT indrelid::regclass AS table_name, array_agg(indexrelid::regclass) AS duplicate_indexes
FROM pg_index GROUP BY indrelid, indkey HAVING COUNT(*) > 1;
```

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `401 Unauthorized` | Invalid `PG_API_KEY` | Verify env var is set correctly |
| `Connection refused` | REST API not running | Confirm API server is up at `PG_API_URL` |
| `pg_stat_statements not found` | Extension not installed | Run `CREATE EXTENSION pg_stat_statements;` as superuser |
| `permission denied` | Insufficient DB role | Ensure DB user has `pg_monitor` role |
| Empty rows on `pg_slow_queries` | No qualifying queries | Lower `minCalls` or wait for traffic |

---

## Best Practices

1. All tools are read-only. Never use `pg_run_query` for INSERT, UPDATE, DELETE, or DDL.
2. Do not drop indexes without DBA confirmation — always present findings first.
3. Treat `idle in transaction` as urgent — it holds locks and blocks other queries.
4. `VACUUM FULL` locks the table exclusively — prefer `VACUUM ANALYZE` unless bloat is extreme.
5. Run the health check workflow on a daily schedule to catch issues early.
