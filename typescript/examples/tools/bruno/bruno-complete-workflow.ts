#!/usr/bin/env node
/**
 * ============================================================================
 * BRUNO TOOLS - COMPLETE WORKFLOW EXAMPLE
 * ============================================================================
 *
 * PATTERN: SDK Factory Pattern
 * ─────────────────────────────────────────────────────────────────────────
 * Direct tool execution via MatimoInstance - demonstrates all 7 Bruno tools
 * working together in a comprehensive workflow.
 *
 * Use this pattern when:
 * ✅ Building API testing automation
 * ✅ Creating collections programmatically
 * ✅ Importing OpenAPI specs to test collections
 * ✅ Running test suites autonomously
 * ✅ Demonstrating multi-tool workflows
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Ensure Bruno CLI is installed:
 *    npm install -g @usebruno/cli
 *    or brew install bruno
 *
 * 2. No environment variables required for this example
 *    (uses public JSONPlaceholder API)
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   npm run bruno:complete
 *   # or with custom collections directory:
 *   npm run bruno:complete -- --workspace:./my-collections
 *
 * AVAILABLE TOOLS (7 Total):
 * ─────────────────────────────────────────────────────────────────────────
 * 1. bruno_create_collection
 *    Creates a new Bruno collection at specified path
 *    Returns: { message, collection_path }
 *
 * 2. bruno_add_request
 *    Adds HTTP request to collection (GET/POST/PUT/DELETE/PATCH/HEAD)
 *    Returns: { message, request_path }
 *
 * 3. bruno_get_collection_info
 *    Retrieves metadata about collection and requests
 *    Returns: { collection: { name, path, requests[] } }
 *
 * 4. bruno_run_collection
 *    Executes all requests in collection with tests
 *    Returns: { success, summary: { total, passed, failed, duration } }
 *
 * 5. bruno_run_request
 *    Executes single request from collection
 *    Returns: { success, status, request, response_time }
 *
 * 6. bruno_list_collections
 *    Lists all collections in workspace
 *    Returns: { name, path, request_count }[]
 *
 * 7. bruno_import_openapi
 *    Generates Bruno collection from OpenAPI/Swagger spec
 *    Returns: { collection_name, collection_path, requests_generated }
 *
 * WHAT IT DOES:
 * ─────────────────────────────────────────────────────────────────────────
 * This example runs 6 complete workflows:
 *   1. Create collection & add 4 HTTP requests (GET/POST/PUT/DELETE)
 *   2. Inspect collection structure and metadata
 *   3. Execute full collection with test suite
 *   4. Run single request with detailed results
 *   5. List all available collections
 *   6. Import OpenAPI spec and generate requests
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatimoInstance } from 'matimo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run comprehensive Bruno workflow example
 */
async function runBrunoCompleteWorkflow() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  let workspaceDir = process.env.BRUNO_WORKSPACE || './example-collections';

  for (const arg of args) {
    if (arg.startsWith('--workspace:')) {
      workspaceDir = arg.split(':')[1];
    } else if (arg.startsWith('--workspace=')) {
      workspaceDir = arg.split('=')[1];
    }
  }

  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║     Bruno Tools - Complete Workflow                    ║');
  console.info('║     (7 tools + 6 workflows)                            ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  console.info(`📁 Workspace Directory: ${workspaceDir}`);
  console.info(`🌐 Test API: JSONPlaceholder (https://jsonplaceholder.typicode.com)\n`);

  try {
    // Initialize Matimo with auto-discovery to find all @matimo/* packages
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });
    const allTools = matimo.listTools();
    console.info(`✅ Loaded ${allTools.length} total tools\n`);

    // Debug: List all providers
    const allProviders = new Set(
      allTools.map((t) => {
        const match = t.name.match(/^([a-z_]+?)_/);
        return match ? match[1] : 'unknown';
      })
    );
    console.info(`📦 Tool providers found: ${Array.from(allProviders).sort().join(', ')}\n`);

    // Get Bruno tools
    const brunoTools = allTools.filter((t) => t.name.startsWith('bruno'));
    console.info(`🔧 Found ${brunoTools.length} Bruno tools:`);
    if (brunoTools.length === 0) {
      console.warn('⚠️  NO BRUNO TOOLS FOUND');
      console.info('   Available tool prefixes:', Array.from(allProviders).sort().join(', '));
    }
    brunoTools.forEach((tool) => {
      console.info(`   • ${tool.name} - ${tool.description?.substring(0, 50)}...`);
    });
    console.info();

    const collectionName = 'Sample API Tests';
    const collectionPath = path.join(workspaceDir, 'sample-api');

    console.info('════════════════════════════════════════════════════════════\n');
    console.info('Running 6 Complete Workflows:');
    console.info('════════════════════════════════════════════════════════════\n');

    // ========================================
    // WORKFLOW 1: Create Collection from Scratch
    // ========================================
    console.info('1️⃣  WORKFLOW 1: Create Collection & Add Requests');
    console.info('─'.repeat(60));

    console.info(`📁 Creating collection at: ${collectionPath}`);
    const createResult = (await matimo.execute('bruno_create_collection', {
      collection_path: collectionPath,
      collection_name: collectionName,
    })) as any;
    console.info(`   ✅ ${createResult.message}\n`);

    // Add GET request
    console.info('📝 Adding GET request: fetch-todos');
    const getResult = (await matimo.execute('bruno_add_request', {
      collection_path: collectionPath,
      request_name: 'fetch-todos',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/todos?_limit=5',
      headers: {
        Accept: 'application/json',
      },
      documentation: 'Fetch list of todos from JSONPlaceholder API',
      tests: `test("Status is 200", function() {
  expect(res.getStatus()).to.equal(200);
});

test("Response is array", function() {
  expect(res.getBody()).to.be.an('array');
});

test("Todo has required fields", function() {
  const todos = res.getBody();
  expect(todos[0]).to.have.all.keys('userId', 'id', 'title', 'completed');
});`,
    })) as any;
    console.info(`   ✅ ${getResult.message}\n`);

    // Add POST request
    console.info('📝 Adding POST request: create-todo');
    const postResult = (await matimo.execute('bruno_add_request', {
      collection_path: collectionPath,
      request_name: 'create-todo',
      method: 'POST',
      url: 'https://jsonplaceholder.typicode.com/todos',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(
        {
          title: 'Buy groceries',
          completed: false,
          userId: 1,
        },
        null,
        2
      ),
      documentation: 'Create a new todo item',
      tests: `test("Status is 201", function() {
  expect(res.getStatus()).to.equal(201);
});

test("Response has id", function() {
  expect(res.getBody().id).to.exist;
});

test("Title matches", function() {
  expect(res.getBody().title).to.equal('Buy groceries');
});`,
    })) as any;
    console.info(`   ✅ ${postResult.message}\n`);

    // Add PUT request
    console.info('📝 Adding PUT request: update-todo');
    const putResult = (await matimo.execute('bruno_add_request', {
      collection_path: collectionPath,
      request_name: 'update-todo',
      method: 'PUT',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        {
          title: 'Updated todo',
          completed: true,
        },
        null,
        2
      ),
      documentation: 'Update an existing todo',
      tests: `test("Status is 200", function() {
  expect(res.getStatus()).to.equal(200);
});

test("Todo updated", function() {
  expect(res.getBody().completed).to.equal(true);
});`,
    })) as any;
    console.info(`   ✅ ${putResult.message}\n`);

    // Add DELETE request
    console.info('📝 Adding DELETE request: delete-todo');
    const deleteResult = (await matimo.execute('bruno_add_request', {
      collection_path: collectionPath,
      request_name: 'delete-todo',
      method: 'DELETE',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      headers: {
        'Content-Type': 'application/json',
      },
      documentation: 'Delete a todo item',
      tests: `test("Status is 200", function() {
  expect(res.getStatus()).to.equal(200);
});`,
    })) as any;
    console.info(`   ✅ ${deleteResult.message}\n`);

    // ========================================
    // WORKFLOW 2: Inspect Collection
    // ========================================
    console.info('\n2️⃣  WORKFLOW 2: Inspect Collection Structure');
    console.info('─'.repeat(60));

    console.info('🔍 Getting collection info...');
    const infoResult = (await matimo.execute('bruno_get_collection_info', {
      collection_path: collectionPath,
    })) as any;
    console.info(`   ✅ Collection found:`);
    console.info(`      Name: ${infoResult.collection.name}`);
    console.info(`      Path: ${infoResult.collection.path}`);
    console.info(`      Requests: ${infoResult.collection.requests.length}`);
    console.info(`      Requests list:`);
    infoResult.collection.requests.forEach((r: any) => {
      console.info(`        • ${r.name} [${r.method}]`);
    });
    console.info();

    // ========================================
    // WORKFLOW 3: Run Collection
    // ========================================
    console.info('3️⃣  WORKFLOW 3: Execute Collection with Tests');
    console.info('─'.repeat(60));

    console.info('🏃 Running collection...');
    const runResult = (await matimo.execute('bruno_run_collection', {
      collection_path: collectionPath,
      bail_on_failure: false,
      report_path: path.join(workspaceDir, 'report.json'),
    })) as any;

    console.info(`   ✅ Collection Execution Summary:`);
    console.info(`      Total: ${runResult.summary.total_requests}`);
    console.info(`      Passed: ${runResult.summary.passed}`);
    console.info(`      Failed: ${runResult.summary.failed}`);
    console.info(`      Duration: ${runResult.summary.execution_time_ms}ms`);
    console.info(`      Success: ${runResult.success ? 'YES ✅' : 'NO ❌'}`);

    if (runResult.results && runResult.results.length > 0) {
      console.info(`\n   📋 Request Results:`);
      runResult.results.forEach((result: any) => {
        const status = result.success ? '✅' : '❌';
        console.info(`      ${status} ${result.name} - Status: ${result.status}`);
      });
    }
    console.info();

    // ========================================
    // WORKFLOW 4: Run Individual Request
    // ========================================
    console.info('4️⃣  WORKFLOW 4: Execute Single Request');
    console.info('─'.repeat(60));

    console.info('🔎 Running single request: fetch-todos');
    const singleResult = (await matimo.execute('bruno_run_request', {
      collection_path: collectionPath,
      request_name: 'fetch-todos',
    })) as any;

    console.info(`   ✅ Request Execution:`);
    console.info(`      Name: ${singleResult.request}`);
    console.info(`      Status: ${singleResult.status}`);
    console.info(`      Success: ${singleResult.success ? 'YES ✅' : 'NO ❌'}`);
    if (singleResult.response_time) {
      console.info(`      Response Time: ${singleResult.response_time}ms`);
    }
    console.info();

    // ========================================
    // WORKFLOW 5: List Collections
    // ========================================
    console.info('5️⃣  WORKFLOW 5: List Available Collections');
    console.info('─'.repeat(60));

    console.info(`🔍 Listing collections in: ${workspaceDir}`);
    const listResult = (await matimo.execute('bruno_list_collections', {
      workspace_path: workspaceDir,
    })) as any;

    console.info(`   ✅ Found ${listResult.collections.length} collection(s):`);
    listResult.collections.forEach((collection: any) => {
      console.info(`      📁 ${collection.name}`);
      console.info(`         Path: ${collection.path}`);
      console.info(`         Requests: ${collection.request_count}`);
    });
    console.info();

    // ========================================
    // WORKFLOW 6: Import OpenAPI
    // ========================================
    console.info('6️⃣  WORKFLOW 6: Import from OpenAPI Spec');
    console.info('─'.repeat(60));

    console.info('📥 Importing from Swagger Petstore OpenAPI...');
    const importResult = (await matimo.execute('bruno_import_openapi', {
      spec_source: 'https://petstore.swagger.io/v2/swagger.json',
      output_directory: path.join(workspaceDir, 'petstore-api'),
      collection_name: 'Petstore API',
      group_by: 'tags',
    })) as any;

    console.info(`   ✅ OpenAPI Import Complete:`);
    console.info(`      Collection: ${importResult.collection_name}`);
    console.info(`      Path: ${importResult.collection_path}`);
    console.info(`      Requests Generated: ${importResult.requests_created}`);
    console.info();

    // ========================================
    // SUMMARY
    // ========================================
    console.info('════════════════════════════════════════════════════════════');
    console.info('✨ ALL WORKFLOWS COMPLETE!');
    console.info('════════════════════════════════════════════════════════════\n');

    console.info('🎯 All 7 Bruno Tools Demonstrated:');
    console.info('  ✅ bruno_create_collection - Created new collection');
    console.info('  ✅ bruno_add_request - Added 4 HTTP requests');
    console.info('  ✅ bruno_get_collection_info - Inspected collection');
    console.info('  ✅ bruno_run_collection - Executed full test suite');
    console.info('  ✅ bruno_run_request - Executed single request');
    console.info('  ✅ bruno_list_collections - Listed available collections');
    console.info('  ✅ bruno_import_openapi - Imported from OpenAPI spec\n');

    console.info('📊 Artifacts Generated:');
    console.info(`  - Collections: ${workspaceDir}/`);
    console.info(`  - Report: ${workspaceDir}/report.json`);
    console.info(`  - Petstore Collection: ${workspaceDir}/petstore-api/\n`);

    console.info('📚 Next Steps:');
    console.info('  1. Open Bruno app and load: ' + workspaceDir);
    console.info('  2. Run requests manually from GUI');
    console.info('  3. View test results and reports');
    console.info('  4. Customize requests and tests\n');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error:', errorMsg);
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

runBrunoCompleteWorkflow().catch(console.error);
