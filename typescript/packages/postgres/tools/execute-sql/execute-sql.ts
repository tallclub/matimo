import { Client } from 'pg';
import { MatimoError, ErrorCode } from '@matimo/core';

export default async function (input: Record<string, unknown>) {
  const sql = (input.sql as string) || '';
  const params = (input.params as unknown) as unknown[] | undefined;

  if (!sql || sql.trim().length === 0) {
    throw new MatimoError('Missing SQL statement', ErrorCode.EXECUTION_FAILED, {
      toolName: 'postgres-execute-sql',
    });
  }

  // Build connection string from either MATIMO_POSTGRES_URL or separate env vars
  const envUrl = process.env.MATIMO_POSTGRES_URL;
  let connectionString: string | undefined = envUrl;

  if (!connectionString) {
    const host = process.env.MATIMO_POSTGRES_HOST;
    const port = process.env.MATIMO_POSTGRES_PORT || '5432';
    const user = process.env.MATIMO_POSTGRES_USER;
    const password = process.env.MATIMO_POSTGRES_PASSWORD;
    const database = process.env.MATIMO_POSTGRES_DB;

    if (host && user && password && database) {
      // Build a simple connection string. Do not log secrets.
      connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
        password
      )}@${host}:${port}/${database}`;
    }
  }

  if (!connectionString) {
    throw new MatimoError(
      'Postgres connection information not provided. Set MATIMO_POSTGRES_URL or MATIMO_POSTGRES_HOST/PORT/USER/PASSWORD/DB',
      ErrorCode.EXECUTION_FAILED,
      { toolName: 'postgres-execute-sql' }
    );
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query(sql, (params ?? []) as unknown[]);
    return { rows: result.rows, rowCount: result.rowCount };
  } catch (err) {
    // Extract meaningful error message
    const originalError = String((err as Record<string, unknown>).message || err);
    const details: Record<string, unknown> = {
      originalMessage: originalError,
    };
    // Check if it's a connection error vs query error
    if (originalError.includes('ECONNREFUSED')) {
      details.hint = 'Connection refused - is Postgres running at the configured host/port?';
    } else if (originalError.includes('role') && originalError.includes('does not exist')) {
      details.hint = 'Database user does not exist - check MATIMO_POSTGRES_USER env var';
    } else if (originalError.includes('database') && originalError.includes('does not exist')) {
      details.hint = 'Database does not exist - check MATIMO_POSTGRES_DB env var';
    }
    // Wrap errors to avoid leaking secrets
    throw new MatimoError(`Postgres query failed: ${originalError}`, ErrorCode.EXECUTION_FAILED, {
      toolName: 'postgres-execute-sql',
      details,
    });
  } finally {
    await client.end().catch(() => {
      // Ignore connection close errors
    });
  }
}
