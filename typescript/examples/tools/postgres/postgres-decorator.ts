import 'dotenv/config';
import { MatimoInstance, setGlobalMatimoInstance, tool } from 'matimo';

async function main() {
  console.info('🚀 Postgres Decorator Pattern Example');
  console.info('='.repeat(60));

  try {
    const matimo = await MatimoInstance.init({ autoDiscover: true });
    setGlobalMatimoInstance(matimo);

    console.info('\n📦 Initializing Matimo with decorators...');

    // Class-based database client using Matimo
    class PostgresAgent {
      private matimo: MatimoInstance;

      constructor(matimo: MatimoInstance) {
        this.matimo = matimo;
      }

      // Sequential step 1: Discover tables
      async discoverTables(): Promise<string[]> {
        console.info('\n1️⃣  DISCOVER TABLES (Step 1/3)');
        console.info('-'.repeat(60));
        console.info('SQL: Getting all tables from information_schema...\n');

        const result = await this.matimo.execute('postgres-execute-sql', {
          sql: `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
          `,
        });

        this.handleResult(result as any);

        if (result && (result as any).rows && (result as any).rows.length > 0) {
          return (result as any).rows.map((row: any) => row.table_name);
        }
        return [];
      }

      // Sequential step 2: Get row counts
      async getTableRowCounts(): Promise<void> {
        console.info('\n2️⃣  COUNT RECORDS (Step 2/3)');
        console.info('-'.repeat(60));
        console.info('SQL: Getting record counts for tables...\n');

        // Try pg_stat_user_tables first, fall back to manual counts
        try {
          const result = await this.matimo.execute('postgres-execute-sql', {
            sql: `
              SELECT 
                tablename, 
                n_live_tup as row_count
              FROM pg_stat_user_tables
              WHERE schemaname = 'public'
              ORDER BY n_live_tup DESC;
            `,
          });

          this.handleResult(result);
        } catch (err: any) {
          // Fall back to information_schema method
          console.info('⚠️  Using information_schema for row counts (pg_stat not available)');
          const result = await this.matimo.execute('postgres-execute-sql', {
            sql: `
              SELECT 
                table_name,
                (SELECT count(*) FROM information_schema.columns 
                 WHERE information_schema.columns.table_name = t.table_name) as columns
              FROM information_schema.tables t
              WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
              ORDER BY table_name;
            `,
          });

          this.handleResult(result);
        }
      }

      // Sequential step 3: Analyze first table structure
      async analyzeTableStructure(tableName: string): Promise<void> {
        console.info(`\n3️⃣  ANALYZE TABLE STRUCTURE (Step 3/3)`);
        console.info('-'.repeat(60));
        console.info(`SQL: Getting column structure for table "${tableName}"...\n`);

        const result = await this.matimo.execute('postgres-execute-sql', {
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
          params: [tableName],
        });

        this.handleResult(result);
      }

      // Bonus: Show database health
      async showDatabaseHealth(): Promise<void> {
        console.info('\n📊 DATABASE HEALTH');
        console.info('-'.repeat(60));
        console.info('SQL: Getting database and connection info...\n');

        const result = await this.matimo.execute('postgres-execute-sql', {
          sql: `
            SELECT 
              current_database() as database_name,
              version() as postgres_version,
              now() as current_time,
              (SELECT count(*) FROM pg_stat_activity) as active_connections;
          `,
        });

        this.handleResult(result);
      }

      private handleResult(result: any) {
        if (
          result &&
          typeof result === 'object' &&
          'success' in result &&
          (result as any).success === false
        ) {
          throw new Error((result as any).error || 'Query failed');
        }
        if (result && typeof result === 'object' && 'rows' in result) {
          const rows = (result as any).rows;
          if (rows && Array.isArray(rows)) {
            console.info(`✅ Found ${rows.length} row(s):`);
            rows.forEach((row: any, idx: number) => {
              console.info(`   [${idx + 1}] ${JSON.stringify(row)}`);
            });
          } else {
            console.info('✅ Query executed successfully');
          }
        } else {
          console.info('✅ Query executed successfully');
        }
      }
    }

    const agent = new PostgresAgent(matimo);

    console.info('✅ Agent initialized\n');

    // Execute sequential workflow
    const tables = await agent.discoverTables();

    await agent.getTableRowCounts();

    // Analyze first discovered table if any exist
    if (tables.length > 0) {
      await agent.analyzeTableStructure(tables[0]);
    } else {
      console.info('\n3️⃣  ANALYZE TABLE STRUCTURE (Step 3/3)');
      console.info('-'.repeat(60));
      console.info('⚠️  No tables found to analyze\n');
    }

    // Show additional database health info
    await agent.showDatabaseHealth();

    console.info('\n\n✨ Sequential discovery complete!');
    console.info('='.repeat(60));
    console.info('Pattern: 1) Get tables 2) Count rows 3) Analyze discovered table\n');
  } catch (err: any) {
    console.error('\n❌ Error:');
    const message = err.message || String(err);
    console.error('Message:', message);

    if (message.includes('ECONNREFUSED')) {
      console.error('\n💡 Connection refused - Postgres not running?');
    } else if (message.includes('does not exist')) {
      console.error('\n💡 Database or user does not exist');
    }

    console.error('\nCurrent .env Postgres settings:');
    console.error(`  MATIMO_POSTGRES_HOST=${process.env.MATIMO_POSTGRES_HOST || '(not set)'}`);
    console.error(`  MATIMO_POSTGRES_USER=${process.env.MATIMO_POSTGRES_USER || '(not set)'}`);
    console.error(`  MATIMO_POSTGRES_DB=${process.env.MATIMO_POSTGRES_DB || '(not set)'}`);

    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
