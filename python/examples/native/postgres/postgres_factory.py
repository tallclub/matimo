#!/usr/bin/env python3
import asyncio
import os
import sys
from dotenv import load_dotenv
from matimo import Matimo

# Load environment variables from .env
load_dotenv()


async def main():
    print('🚀 Postgres Factory Pattern Example')
    print('=' * 60)

    try:
        # Initialize Matimo with auto-discovery
        print('\n📦 Initializing Matimo...')
        matimo = await Matimo.init(auto_discover=True)

        # Get postgres tools
        tools = matimo.list_tools()
        postgres_tools = [t for t in tools if t.name.startswith('postgres')]
        print(f'✅ Found {len(postgres_tools)} Postgres tool(s)')

        # STEP 1: Discover available tables
        print('\n\n1️⃣  DISCOVER TABLES (Step 1/3)')
        print('-' * 60)
        print('SQL: Getting all tables from information_schema...\n')

        tables_result = await matimo.execute('postgres-execute-sql', {
            'sql': '''
                SELECT table_name, 
                       (SELECT count(*) FROM information_schema.columns 
                        WHERE information_schema.columns.table_name = t.table_name) as column_count
                FROM information_schema.tables t
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            '''
        })

        if isinstance(tables_result, dict) and tables_result.get('success') is False:
            raise Exception(tables_result.get('error', 'Query failed'))

        table_names = []
        print('✅ Tables found:')
        if isinstance(tables_result, dict) and 'rows' in tables_result:
            rows = tables_result.get('rows', [])
            if rows:
                for row in rows:
                    table_names.append(row.get('table_name'))
                    print(f"   - {row.get('table_name')} ({row.get('column_count')} columns)")
            else:
                print('   (No tables in public schema)')
        else:
            print('   (No tables in public schema)')

        # STEP 2: Get row counts for each table
        print('\n\n2️⃣  COUNT RECORDS (Step 2/3)')
        print('-' * 60)

        if table_names:
            print(f'SQL: Getting record counts for {len(table_names)} table(s)...\n')

            counts_result = await matimo.execute('postgres-execute-sql', {
                'sql': '''
                    SELECT 
                        schemaname, 
                        tablename, 
                        n_live_tup as row_count
                    FROM pg_stat_user_tables
                    WHERE schemaname = 'public'
                    ORDER BY n_live_tup DESC;
                ''',
                'params': []
            })

            if isinstance(counts_result, dict) and counts_result.get('success') is False:
                print('⚠️  Could not get row counts')
            else:
                print('✅ Record counts by table:')
                if isinstance(counts_result, dict) and 'rows' in counts_result:
                    rows = counts_result.get('rows', [])
                    if rows:
                        for row in rows:
                            print(f"   - {row.get('tablename')}: {row.get('row_count')} rows")

        # STEP 3: Analyze the first discovered table
        print('\n\n3️⃣  ANALYZE TABLE STRUCTURE (Step 3/3)')
        print('-' * 60)

        if table_names:
            first_table = table_names[0]
            print(f'SQL: Getting column structure for table "{first_table}"...\n')

            columns_result = await matimo.execute('postgres-execute-sql', {
                'sql': '''
                    SELECT 
                        column_name, 
                        data_type,
                        is_nullable,
                        column_default
                    FROM information_schema.columns 
                    WHERE table_name = %s
                    ORDER BY ordinal_position;
                ''',
                'params': [first_table]
            })

            if isinstance(columns_result, dict) and columns_result.get('success') is False:
                print('⚠️  Could not get column structure')
            else:
                print(f'✅ Columns in "{first_table}" table:')
                if isinstance(columns_result, dict) and 'rows' in columns_result:
                    rows = columns_result.get('rows', [])
                    if rows:
                        for row in rows:
                            nullable = 'nullable' if row.get('is_nullable') == 'YES' else 'NOT NULL'
                            default_val = f" = {row.get('column_default')}" if row.get('column_default') else ''
                            print(f"   - {row.get('column_name')} ({row.get('data_type')}) {nullable}{default_val}")

        print('\n\n✨ Sequential discovery complete!')
        print('=' * 60)
        print('Pattern: 1) Get tables 2) Count rows 3) Analyze discovered table\n')

    except Exception as err:
        print('\n❌ Error:')

        # Try to extract helpful information
        message = str(err)
        print('Message:', message)

        # Provide specific hints based on error type
        if 'ECONNREFUSED' in message or 'Connection refused' in message:
            print('\n💡 Connection refused - Postgres not running?')
            print('   Check docker-compose or your Postgres instance')
        elif 'does not exist' in message:
            print('\n💡 Database or user does not exist')
            print('   Verify MATIMO_POSTGRES_* env vars in .env')

        print('\nCurrent .env Postgres settings:')
        print(f"  MATIMO_POSTGRES_HOST={os.getenv('MATIMO_POSTGRES_HOST') or '(not set)'}")
        print(f"  MATIMO_POSTGRES_PORT={os.getenv('MATIMO_POSTGRES_PORT') or '(not set)'}")
        print(f"  MATIMO_POSTGRES_USER={os.getenv('MATIMO_POSTGRES_USER') or '(not set)'}")
        print(f"  MATIMO_POSTGRES_DB={os.getenv('MATIMO_POSTGRES_DB') or '(not set)'}")

        sys.exit(1)


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as err:
        print('Fatal error:', err)
        sys.exit(1)
