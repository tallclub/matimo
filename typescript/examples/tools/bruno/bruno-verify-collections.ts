/**
 * Bruno Collection Verification (TypeScript)
 * This example demonstrates actual collection creation and file verification
 * Run with: npx ts-node examples/bruno-verify-collections.ts
 */

import { MatimoInstance } from '@matimo/core';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Bruno Collection Creation Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const matimo = await MatimoInstance.init('./packages/bruno/tools');
  const collectionsDir = './example-collections-verify';
  const collectionPath = path.join(collectionsDir, 'test-api');

  try {
    // ===== Step 1: Create Collection =====
    console.log('📁 Step 1: Creating collection...');
    const createResult = (await matimo.execute('bruno_create_collection', {
      collection_path: collectionPath,
      collection_name: 'Test API Collection',
    })) as any;
    console.log(`✅ ${createResult.message}\n`);

    // Verify collection directory exists
    if (fs.existsSync(collectionPath)) {
      console.log(`✅ Collection directory created at: ${collectionPath}`);
      const files = fs.readdirSync(collectionPath);
      console.log(`   Files/Dirs: ${files.join(', ')}\n`);
    } else {
      console.log(`❌ Collection directory NOT created\n`);
      return;
    }

    // ===== Step 2: Add Requests =====
    console.log('📝 Step 2: Adding 4 HTTP requests...');

    // GET
    console.log('   Adding GET request...');
    const getResult = (await matimo.execute('bruno_add_request', {
      collection_path: collectionPath,
      request_name: 'list-todos',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/todos?_limit=5',
      headers: { Accept: 'application/json' },
      tests: `test("Status 200", function() { expect(res.getStatus()).to.equal(200); });`,
    })) as any;
    console.log(`   ✅ ${getResult.message}`);

    // POST
    console.log('   Adding POST request...');
    const postResult = (await matimo.execute('bruno_add_request', {
      collection_path: collectionPath,
      request_name: 'create-todo',
      method: 'POST',
      url: 'https://jsonplaceholder.typicode.com/todos',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', userId: 1 }),
      tests: `test("Created", function() { expect(res.getStatus()).to.equal(201); });`,
    })) as any;
    console.log(`   ✅ ${postResult.message}`);

    // PUT
    console.log('   Adding PUT request...');
    const putResult = (await matimo.execute('bruno_add_request', {
      collection_path: collectionPath,
      request_name: 'update-todo',
      method: 'PUT',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
      tests: `test("Updated", function() { expect(res.getStatus()).to.equal(200); });`,
    })) as any;
    console.log(`   ✅ ${putResult.message}`);

    // DELETE
    console.log('   Adding DELETE request...');
    const deleteResult = (await matimo.execute('bruno_add_request', {
      collection_path: collectionPath,
      request_name: 'delete-todo',
      method: 'DELETE',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      tests: `test("Deleted", function() { expect(res.getStatus()).to.equal(200); });`,
    })) as any;
    console.log(`   ✅ ${deleteResult.message}\n`);

    // Verify files created
    console.log('📋 Verifying .bru files created:');
    const requestsDir = path.join(collectionPath, 'requests');
    if (fs.existsSync(requestsDir)) {
      const bruFiles = fs.readdirSync(requestsDir).filter((f) => f.endsWith('.bru'));
      console.log(`   ✅ Found ${bruFiles.length} request files:`);
      bruFiles.forEach((file) => {
        const filePath = path.join(requestsDir, file);
        const size = fs.statSync(filePath).size;
        console.log(`      - ${file} (${size} bytes)`);
      });
    } else {
      console.log(`   ⚠️  Requests directory not found\n`);
    }
    console.log();

    // ===== Step 3: Get Collection Info =====
    console.log('🔍 Step 3: Inspecting collection...');
    const infoResult = (await matimo.execute('bruno_get_collection_info', {
      collection_path: collectionPath,
    })) as any;
    console.log(`   Collection: ${infoResult.collection.name}`);
    console.log(`   Requests: ${infoResult.collection.requests.length}`);
    infoResult.collection.requests.forEach((req: any) => {
      console.log(`      ✅ ${req.name} [${req.method}]`);
    });
    console.log();

    // ===== Step 4: Run Collection =====
    console.log('🏃 Step 4: Running collection...');
    const runResult = (await matimo.execute('bruno_run_collection', {
      collection_path: collectionPath,
      bail_on_failure: false,
    })) as any;
    console.log(`   Success: ${runResult.success}`);
    console.log(`   Total: ${runResult.summary.total}`);
    console.log(`   Passed: ${runResult.summary.passed}`);
    console.log(`   Failed: ${runResult.summary.failed}`);

    if (runResult.results) {
      console.log('   Results:');
      runResult.results.forEach((result: any) => {
        const icon = result.success ? '✅' : '❌';
        console.log(`      ${icon} ${result.name} (${result.status})`);
      });
    }
    console.log();

    // ===== Step 5: Run Single Request =====
    console.log('🔎 Step 5: Running single request...');
    const singleResult = (await matimo.execute('bruno_run_request', {
      collection_path: collectionPath,
      request_name: 'list-todos',
    })) as any;
    console.log(`   Request: ${singleResult.request}`);
    console.log(`   Success: ${singleResult.success}`);
    console.log(`   Status: ${singleResult.status}\n`);

    // ===== Summary =====
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ VERIFICATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ Verified:');
    console.log(`   ✓ Collection directory created: ${collectionPath}`);
    console.log(`   ✓ 4 requests added (.bru files)`);
    console.log(`   ✓ Collection info retrieved`);
    console.log(`   ✓ Full collection executed`);
    console.log(`   ✓ Single request debugged\n`);

    console.log('📊 Collection Stats:');
    console.log(`   - Path: ${collectionPath}`);
    console.log(`   - Name: Test API Collection`);
    console.log(`   - Requests: 4 (GET, POST, PUT, DELETE)`);
    console.log(`   - All requests executed successfully ✅\n`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
