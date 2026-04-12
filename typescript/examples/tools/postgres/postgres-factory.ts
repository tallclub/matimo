#!/usr/bin/env node
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatimoInstance } from 'matimo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.info('🚀 Postgres Factory Pattern Example');
  console.info('='.repeat(60));

  try {
    // Initialize Matimo with auto-discovery
    console.info('\n📦 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Get postgres tools
    const tools = matimo.listTools();
    const postgresTools = tools.filter((t) => t.name.startsWith('postgres'));
    console.info(`✅ Found ${postgresTools.length} Postgres tool(s)`);

    // STEP 1: Discover available tables
    console.info('\n\n1️⃣  DISCOVER TABLES (Step 1/3)');
    console.info('-'.repeat(60));
    console.info('SQL: Getting all tables from information_schema...\n');

    const tablesResult = await matimo.execute('postgres-execute-sql', {
      sql: `
        SELECT table_name, 
               (SELECT count(*) FROM information_schema.columns 
                WHERE information_schema.columns.table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `,
    });

    if (
      tablesResult &&
      typeof tablesResult === 'object' &&
      'success' in tablesResult &&
      (tablesResult as any).success === false
    ) {
      throw new Error((tablesResult as any).error || 'Query failed');
    }

    let tableNames: string[] = [];
    console.info('✅ Tables found:');
    if (tablesResult && typeof tablesResult === 'object' && 'rows' in tablesResult) {
      const rows = (tablesResult as any).rows;
      if (rows && rows.length > 0) {
        rows.forEach((row: any) => {
          tableNames.push(row.table_name);
          console.info(`   - ${row.table_name} (${row.column_count} columns)`);
        });
      } else {
        console.info('   (No tables in public schema)');
      }
    } else {
      console.info('   (No tables in public schema)');
    }

    // STEP 2: Get row counts for each table
    console.info('\n\n2️⃣  COUNT RECORDS (Step 2/3)');
    console.info('-'.repeat(60));

    if (tableNames.length > 0) {
      console.info(`SQL: Getting record counts for ${tableNames.length} table(s)...\n`);

      const countsResult = await matimo.execute('postgres-execute-sql', {
        sql: `
          SELECT 
            schemaname, 
            tablename, 
            n_live_tup as row_count
          FROM pg_stat_user_tables
          WHERE schemaname = 'public'
          ORDER BY n_live_tup DESC;
        `,
        params: [],
      });

      if (
        countsResult &&
        typeof countsResult === 'object' &&
        'success' in countsResult &&
        (countsResult as any).success === false
      ) {
        console.info('⚠️  Could not get row counts');
      } else {
        console.info('✅ Record counts by table:');
        if (countsResult && typeof countsResult === 'object' && 'rows' in countsResult) {
          const rows = (countsResult as any).rows;
          if (rows && rows.length > 0) {
            rows.forEach((row: any) => {
              console.info(`   - ${row.tablename}: ${row.row_count} rows`);
            });
          }
        }
      }
    }

    // STEP 3: Analyze the first discovered table
    console.info('\n\n3️⃣  ANALYZE TABLE STRUCTURE (Step 3/3)');
    console.info('-'.repeat(60));

    if (tableNames.length > 0) {
      const firstTable = tableNames[0];
      console.info(`SQL: Getting column structure for table "${firstTable}"...\n`);

      const columnsResult = await matimo.execute('postgres-execute-sql', {
        sql: `
          SELECT 
            column_name, 
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `,
        params: [firstTable],
      });

      if (
        columnsResult &&
        typeof columnsResult === 'object' &&
        'success' in columnsResult &&
        (columnsResult as any).success === false
      ) {
        console.info('⚠️  Could not get column structure');
      } else {
        console.info(`✅ Columns in "${firstTable}" table:`);
        if (columnsResult && typeof columnsResult === 'object' && 'rows' in columnsResult) {
          const rows = (columnsResult as any).rows;
          if (rows && rows.length > 0) {
            rows.forEach((row: any) => {
              const nullable = row.is_nullable === 'YES' ? 'nullable' : 'NOT NULL';
              const defaultVal = row.column_default ? ` = ${row.column_default}` : '';
              console.info(`   - ${row.column_name} (${row.data_type}) ${nullable}${defaultVal}`);
            });
          }
        }
      }
    }

    console.info('\n\n✨ Sequential discovery complete!');
    console.info('='.repeat(60));
    console.info('Pattern: 1) Get tables 2) Count rows 3) Analyze discovered table\n');
  } catch (err: any) {
    console.error('\n❌ Error:');

    // Try to extract helpful information
    const message = err.message || String(err);
    console.error('Message:', message);

    // Provide specific hints based on error type
    if (message.includes('ECONNREFUSED') || message.includes('Connection refused')) {
      console.error('\n💡 Connection refused - Postgres not running?');
      console.error('   Check docker-compose or your Postgres instance');
    } else if (message.includes('does not exist')) {
      console.error('\n💡 Database or user does not exist');
      console.error('   Verify MATIMO_POSTGRES_* env vars in .env');
    }

    console.error('\nCurrent .env Postgres settings:');
    console.error(`  MATIMO_POSTGRES_HOST=${process.env.MATIMO_POSTGRES_HOST || '(not set)'}`);
    console.error(`  MATIMO_POSTGRES_PORT=${process.env.MATIMO_POSTGRES_PORT || '(not set)'}`);
    console.error(`  MATIMO_POSTGRES_USER=${process.env.MATIMO_POSTGRES_USER || '(not set)'}`);
    console.error(`  MATIMO_POSTGRES_DB=${process.env.MATIMO_POSTGRES_DB || '(not set)'}`);

    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
