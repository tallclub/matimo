#!/usr/bin/env node
/**
 * ============================================================================
 * NOTION TOOLS - DECORATOR PATTERN EXAMPLE
 * ============================================================================
 *
 * PATTERN: Class Decorator Pattern
 * ─────────────────────────────────────────────────────────────────────────
 * Using @tool() decorators for class-based tool execution.
 *
 * Use this pattern when:
 * ✅ Building class-based agents
 * ✅ Organizing tools by domain (NotionManager, SlackHelper, etc.)
 * ✅ Integrating with frameworks like LangChain, CrewAI
 * ✅ Want method signatures to match tool interfaces
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Set NOTION_API_KEY environment variable
 * 2. Share Notion databases/pages with your integration
 * 3. Global Matimo instance must be set: setGlobalMatimoInstance(matimo)
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export NOTION_API_KEY=secret_xxxx
 *   npm run notion:decorator
 *
 * ============================================================================
 */

import 'dotenv/config';
import { MatimoInstance, setGlobalMatimoInstance, tool } from '@matimo/core';

/**
 * Notion Manager - Class-based interface to Notion tools
 * Each method is decorated with @tool() which auto-executes via Matimo
 *
 * MATIMO DESIGN: Structured Parameters (Objects/Arrays)
 * ──────────────────────────────────────────────────────
 * Note: This example passes structured JavaScript objects and arrays
 * (like { database_id: '123' }, [{ type: 'text', ... }]) directly to methods.
 *
 * The decorator converts these to matimo.execute() calls, and the HTTP executor
 * properly embeds them as JSON in request bodies—they are NOT stringified.
 *
 * This works because:
 * 1. Each parameter is defined in YAML with its type (object, array, string, etc.)
 * 2. The HTTP executor uses this type information to decide how to embed the value
 * 3. For type:object and type:array, values are embedded directly as JSON structures
 * 4. For type:string, values are templated as strings
 *
 * Example YAML parameter definition:
 * ```yaml
 * parameters:
 *   parent:
 *     type: object
 *     description: Parent database or page
 *   rich_text:
 *     type: array
 *     description: Array of rich text objects
 *   markdown:
 *     type: string
 *     description: Markdown content
 *
 * body:
 *   parent: "{parent}"        # Embedded as JSON object
 *   rich_text: "{rich_text}"  # Embedded as JSON array
 *   markdown: "{markdown}"    # Embedded as string
 * ```
 *
 * Result: The API receives proper JSON structures, not stringified "[object Object]".
 */
class NotionManager {
  /**
   * List all databases in the workspace
   * No API knowledge needed - just call it!
   */
  @tool('notion_list_databases')
  async listDatabases(page_size?: number): Promise<any> {
    // Decorator intercepts → auto-executes via matimo.execute()
    throw new Error('Should not be called - decorator handles execution');
  }

  /**
   * Query a database for pages matching optional filters
   * database_id parameter is clear and self-documenting
   */
  @tool('notion_query_database')
  async queryDatabase(
    database_id: string,
    sorts?: Array<Record<string, any>>,
    filter?: Record<string, any>,
    page_size?: number
  ): Promise<any> {
    // Method body ignored - @tool decorator handles execution
    throw new Error('Should not be called - decorator handles execution');
  }

  /**
   * Create a new page with markdown content
   * Simplest way to add content - works with any database
   */
  @tool('notion_create_page')
  async createPage(
    parent: Record<string, string>,
    markdown?: string,
    icon?: Record<string, string>
  ): Promise<any> {
    // Decorator intercepts → auto-executes via matimo.execute()
    throw new Error('Should not be called - decorator handles execution');
  }

  /**
   * Update an existing page (icon, status, etc.)
   */
  @tool('notion_update_page')
  async updatePage(page_id: string, icon?: Record<string, string>): Promise<any> {
    // Method body ignored - @tool decorator handles execution
    throw new Error('Should not be called - decorator handles execution');
  }

  /**
   * Add a comment to a page
   */
  @tool('notion_create_comment')
  async addComment(
    parent: Record<string, string>,
    rich_text?: Array<Record<string, any>>
  ): Promise<any> {
    // Method body ignored - @tool decorator handles execution
    throw new Error('Should not be called - decorator handles execution');
  }
}

/**
 * Demonstration of decorator pattern usage with REAL operations
 */
async function demonstrateDecoratorPattern() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Notion Tools - Decorator Pattern                  ║');
  console.info('║     (Class-based execution with REAL operations)     ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: NOTION_API_KEY not set in .env');
    console.info('   Set it: export NOTION_API_KEY="secret_xxxx"');
    console.info('   Get one from: https://www.notion.so/my-integrations');
    process.exit(1);
  }

  try {
    // Step 1: Initialize Matimo
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Step 2: Set global instance for decorators to use
    console.info('📌 Setting up decorator support...');
    setGlobalMatimoInstance(matimo);

    console.info('✅ NotionManager initialized with decorators\n');

    // Step 3: Create manager instance
    const manager = new NotionManager();

    console.info('════════════════════════════════════════════════════════════\n');
    console.info('Testing @tool() Decorator - Verifying Tool Execution:');
    console.info('════════════════════════════════════════════════════════════\n');

    // Test 1: Verify decorator intercepts and calls matimo.execute()
    console.info('1️⃣  Testing @tool("notion_list_databases") decorator...');
    console.info('    → Calling: manager.listDatabases(10)');
    console.info('    → Decorator should intercept and call matimo.execute()...\n');

    let listResult: any;
    try {
      listResult = await manager.listDatabases(10);
      console.info(`   📨 Raw result received: ${JSON.stringify(listResult).substring(0, 100)}...`);
      const databases = listResult.results || listResult.data?.results || [];
      console.info(`   ✅ Decorator executed tool successfully`);
      console.info(`   📊 Got response with ${databases.length} databases\n`);

      if (databases.length > 0) {
        const foundDatabase = databases[0];
        console.info('2️⃣  Testing @tool("notion_query_database") decorator...');
        console.info(`    → Calling: manager.queryDatabase("${foundDatabase.id}", ...)`);

        const queryResult = await manager.queryDatabase(foundDatabase.id, undefined, undefined, 5);
        const queryPages = queryResult.results || queryResult.data?.results || [];
        console.info(`   ✅ Query decorator executed successfully`);
        console.info(`   📊 Got response with ${queryPages.length} pages\n`);

        // Test 3: Try creating a page
        const timestamp = new Date().toLocaleTimeString();
        console.info('3️⃣  Testing @tool("notion_create_page") decorator...');
        console.info('    → Calling: manager.createPage({...}, markdown, icon)');
        console.info(
          '    → Note: Structured params (objects/arrays) are properly embedded in HTTP body'
        );
        console.info('           as JSON, not stringified—this is handled by HttpExecutor\n');

        try {
          const createResult = await manager.createPage(
            { database_id: foundDatabase.id }, // Object param → embedded as JSON
            `# Decorator Test Page\n\nCreated at ${timestamp}`, // String param
            { type: 'emoji', emoji: '🔧' } // Object param → embedded as JSON
          );
          console.info(`   ✅ Create decorator executed`);
          console.info(`   📨 Got response: ${JSON.stringify(createResult).substring(0, 100)}...`);

          if (createResult.id) {
            console.info(`   ✅ Successfully created page: ${createResult.id}\n`);

            // Try updating
            console.info('4️⃣  Testing @tool("notion_update_page") decorator...');
            try {
              const updateResult = await manager.updatePage(createResult.id, {
                type: 'emoji',
                emoji: '✨',
              });
              console.info(`   ✅ Update decorator executed\n`);
            } catch (e) {
              console.info(`   ⚠️  Update skipped (expected if permission limited): ${e}\n`);
            }

            // Try commenting
            console.info('5️⃣  Testing @tool("notion_create_comment") decorator...');
            console.info('    → Calling: manager.addComment(parent, rich_text_array)');
            console.info(
              '    → Note: Array param is properly embedded as JSON array in HTTP body\n'
            );
            try {
              const commentResult = await manager.addComment(
                { page_id: createResult.id }, // Object param → embedded as JSON
                [
                  // Array param → embedded as JSON array
                  { type: 'text', text: { content: `Added at ${timestamp} via decorator!` } },
                ]
              );
              console.info(`   ✅ Comment decorator executed\n`);
            } catch (e) {
              console.info(`   ⚠️  Comment skipped (expected if permission limited): ${e}\n`);
            }
          }
        } catch (createError) {
          console.info(`   ⚠️  Create failed (expected if permission limited): ${createError}\n`);
        }
      } else {
        console.info('   📌 No databases accessible - cannot test further operations');
        console.info('   📌 Share a Notion database with your integration to test full workflow\n');
      }
    } catch (error) {
      console.error(`   ❌ Decorator test failed: ${error}\n`);
      throw error;
    }

    console.info('════════════════════════════════════════════════════════════\n');
    console.info('✅ Decorator Pattern Verification Complete!');
    console.info('════════════════════════════════════════════════════════════\n');
    console.info('📌 Key Points:');
    console.info('   ✅ @tool() decorator intercepts method calls');
    console.info('   ✅ Decorator calls matimo.execute() with the tool name');
    console.info('   ✅ Method bodies are ignored (not executed)');
    console.info('   ✅ Works seamlessly - developers just call methods!\n');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.message.includes('NOTION_API_KEY')) {
      console.error('\n📌 Set environment variable:');
      console.error('   export NOTION_API_KEY=secret_xxxxx');
    }
    process.exit(1);
  }
}

demonstrateDecoratorPattern().catch(console.error);
