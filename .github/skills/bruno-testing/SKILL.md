---
name: bruno-testing
description: Autonomous API testing with Bruno CLI via Matimo. Agents orchestrate collection discovery, execution, reporting, and multi-environment validation without human intervention.
metadata:
  category: "API Testing"
  difficulty: "intermediate"
  domain: "Testing & Quality Assurance"
  languages: ["typescript", "python"]
  user-invokable: false
  invocation: "Referenced by agents orchestrating API test workflows via Matimo"
---

# Bruno Testing via Matimo — Autonomous API Validation

This skill teaches AI agents how to use Matimo's Bruno tools to build autonomous API testing workflows. Agents leverage this to discover collections, execute tests across environments, parse results, and make intelligent decisions about test status.

---

## Part 1: The 7 Bruno Tools (Overview)

All 7 tools either wrap the Bruno CLI or programmatically manage collections. Agents call them via `matimo.execute()`.

| Tool | Type | Purpose | Agent Use Case |
|------|------|---------|-----------------|
| `bruno_list_collections` | CLI | Discover all collections in workspace | Agent finds available test suites |
| `bruno_get_collection_info` | CLI | Introspect collection structure | Agent validates structure before execution |
| `bruno_run_collection` | CLI | Execute collection with environments/data | Agent runs full test suite in CI/CD |
| `bruno_run_request` | CLI | Execute single request for debugging | Agent debugs failed test interactively |
| `bruno_import_openapi` | CLI | Bootstrap collection from OpenAPI spec | Agent auto-generates tests from spec |
| `bruno_create_collection` | CLI | Create new collection scaffold | Agent initializes collection programmatically |
| `bruno_add_request` | Programmatic | Add HTTP request to collection | Agent builds collections step-by-step |

---

## Part 2: Tool Tiers & When to Use

### **Tier 1: Essential (Always Available)**
These 4 tools enable autonomous execution workflows:
- `bruno_list_collections` — Discovery
- `bruno_get_collection_info` — Validation
- `bruno_run_collection` — Execution
- `bruno_run_request` — Debugging

### **Tier 2: Scalable (Bootstrapping)**
These tools enable self-directed collection creation:
- `bruno_import_openapi` — Auto-generate from API spec
- `bruno_create_collection` — New project initialization

### **Tier 3: Advanced (Collection Building)**
This tool enables step-by-step collection construction:
- `bruno_add_request` — Add individual requests programmatically

---

## Part 3: Canonical Agent Workflows

### **Workflow A: Autonomous Collection Execution (MVP)**

```
Agent Input: "Run payment API tests against staging"
  ↓
1. bruno_list_collections(workspace_path)
   → Discover available collections matching "payment"
  ↓
2. bruno_get_collection_info(collection_path)
   → Validate collection has requests & assertions
  ↓
3. bruno_run_collection(
     collection_path,
     environment: "staging",
     bail_on_failure: true
   )
   → Execute all requests; stop on first failure
  ↓
4. Parse results
   - success? → Report: "✅ All payment tests passed in staging"
   - failed? → Extract failures, request details
  ↓
Agent Output: Status + metrics
```

**TypeScript Implementation:**
```typescript
async function runPaymentTests(matimo: MatimoInstance) {
  // Discover
  const collections = await matimo.execute('bruno_list_collections', {
    workspace_path: './collections',
    filter: 'payment'
  });
  
  const paymentCollection = collections[0];
  
  // Validate
  const info = await matimo.execute('bruno_get_collection_info', {
    collection_path: paymentCollection.path
  });
  
  console.log(`Collection has ${info.collection.requests.length} requests`);
  
  // Execute
  const result = await matimo.execute('bruno_run_collection', {
    collection_path: paymentCollection.path,
    environment: 'staging',
    bail_on_failure: true,
    report_path: './reports/payment-staging.json'
  });
  
  if (result.success) {
    console.log(`✅ All ${result.summary.total_requests} tests passed`);
  } else {
    console.log(`❌ ${result.summary.failed} tests failed`);
  }
  
  return result;
}
```

**Python Implementation:**
```python
async def run_payment_tests(matimo: Matimo) -> dict:
    # Discover
    collections = await matimo.execute('bruno_list_collections', {
        'workspace_path': './collections',
        'filter': 'payment'
    })
    
    payment_collection = collections['collections'][0]
    
    # Validate
    info = await matimo.execute('bruno_get_collection_info', {
        'collection_path': payment_collection['path']
    })
    
    print(f"Collection has {len(info['collection']['requests'])} requests")
    
    # Execute
    result = await matimo.execute('bruno_run_collection', {
        'collection_path': payment_collection['path'],
        'environment': 'staging',
        'bail_on_failure': True,
        'report_path': './reports/payment-staging.json'
    })
    
    if result['success']:
        print(f"✅ All {result['summary']['total_requests']} tests passed")
    else:
        print(f"❌ {result['summary']['failed']} tests failed")
    
    return result
```

---

### **Workflow B: Multi-Environment Validation**

Run same collection against multiple environments and compare results.

```
For each environment (dev, staging, prod):
  1. bruno_run_collection(env) → capture results
  2. Parse: passed? failed? errors?
  3. Compare across environments

Output: Comparison matrix showing which endpoints behave differently
```

**Implementation Pattern:**
```typescript
async function validateAcrossEnvironments(matimo: MatimoInstance, collectionPath: string) {
  const environments = ['dev', 'staging', 'prod'];
  const results: Record<string, any> = {};
  
  for (const env of environments) {
    results[env] = await matimo.execute('bruno_run_collection', {
      collection_path: collectionPath,
      environment: env,
      report_path: `./reports/${env}-results.json`
    });
  }
  
  // Compare
  const allPassed = Object.values(results).every((r: any) => r.success);
  const diffEnvs = Object.entries(results).filter(([, r]: [string, any]) => !r.success);
  
  if (!allPassed) {
    console.log(`⚠️  API behaves differently in: ${diffEnvs.map(([e]) => e).join(', ')}`);
  }
  
  return results;
}
```

---

### **Workflow C: Targeted Debugging**

Agent discovers a failed test, then runs single request for deep debugging.

```
Agent sees: "Payment processing failed in staging"
  ↓
1. bruno_get_collection_info(collection_path)
   → Find the "Process Payment" request
  ↓
2. bruno_run_request(
     collection_path,
     request_name: "Process Payment",
     environment: "staging"
   )
   → Get full request/response, headers, assertions, status code
  ↓
3. Analyze response:
   - Is endpoint 500? → Backend error
   - Is endpoint 400? → Invalid parameters
   - Assertion failed? → Payload mismatch
  ↓
Agent Output: "Request failed with 400 — missing 'payment_method' parameter"
```

**Implementation Pattern:**
```typescript
async function debugFailedTest(matimo: MatimoInstance) {
  // Get collection info
  const info = await matimo.execute('bruno_get_collection_info', {
    collection_path: './collections/payments'
  });
  
  const failedRequest = info.collection.requests.find(
    (r: any) => r.name === 'Process Payment'
  );
  
  if (!failedRequest) {
    console.log('❌ Request not found');
    return;
  }
  
  // Run single request
  const response = await matimo.execute('bruno_run_request', {
    collection_path: './collections/payments',
    request_name: 'Process Payment',
    environment: 'staging'
  });
  
  // Analyze
  const statusCode = response.response.status;
  if (statusCode === 400) {
    console.log('❌ Invalid request — check parameters');
  } else if (statusCode === 500) {
    console.log('❌ Server error — backend issue');
  } else if (response.assertions.some((a: any) => !a.passed)) {
    console.log('❌ Assertion failed — response mismatch');
  }
  
  console.log('Response body:', response.response.body);
}
```

---

### **Workflow D: Auto-Generate Tests from OpenAPI**

Agent receives API spec URL, bootstraps test collection, then executes it.

```
Agent Input: "Test this API: https://api.example.com/openapi.json"
  ↓
1. bruno_import_openapi(
     spec_source: "https://api.example.com/openapi.json",
     output_directory: "./collections",
     collection_name: "Generated API Tests",
     group_by: "tags"
   )
   → Creates ./collections/Generated\ API\ Tests/ with all endpoints
  ↓
2. bruno_run_collection(
     collection_path: "./collections/Generated API Tests",
     environment: "staging"
   )
   → Execute generated tests
  ↓
3. Parse results:
   - 50 requests generated
   - 45 passed, 5 failed (likely auth/networking issues)
  ↓
Agent Output: "Generated 50 tests from spec. 45 passed, 5 failed due to auth setup needed"
```

**Implementation Pattern:**
```typescript
async function testNewAPI(matimo: MatimoInstance, specUrl: string) {
  // Import
  console.log('📋 Importing from OpenAPI spec...');
  const imported = await matimo.execute('bruno_import_openapi', {
    spec_source: specUrl,
    output_directory: './collections',
    collection_name: 'Generated API Tests',
    group_by: 'tags'
  });
  
  console.log(`✅ Generated ${imported.requests_created} requests`);
  
  // Execute
  console.log('🚀 Running generated tests...');
  const result = await matimo.execute('bruno_run_collection', {
    collection_path: imported.collection_path,
    environment: 'staging',
    report_path: './reports/generated-tests.json'
  });
  
  // Report
  const passRate = (result.summary.passed / result.summary.total_requests) * 100;
  console.log(`📊 Pass rate: ${passRate.toFixed(1)}%`);
  
  return result;
}
```

---

### **Workflow E: Data-Driven Testing**

Agent runs collection with CSV data file for bulk scenario testing.

```
CSV File (users.csv):
  user_id, email, action
  123, alice@example.com, create
  456, bob@example.com, update
  789, charlie@example.com, delete

Agent:
  bruno_run_collection(
    collection_path,
    data_file: "users.csv",
    iteration_count: 1  // One iteration per CSV row
  )
  
  → Bruno runs collection 3 times, each with different user data
```

**Implementation Pattern:**
```typescript
async function datadrivenTest(matimo: MatimoInstance) {
  const result = await matimo.execute('bruno_run_collection', {
    collection_path: './collections/user-api',
    data_file: './data/users.csv',
    iteration_count: 1,  // One per CSV row
    report_path: './reports/data-driven.json'
  });
  
  console.log(`Executed ${result.summary.total_requests} requests`);
  console.log(`Passed: ${result.summary.passed}`);
  console.log(`Failed: ${result.summary.failed}`);
}
```

---

## Part 4: Parameter Reference

### Common Parameters Across Tools

| Parameter | Type | Purpose | Example |
|-----------|------|---------|---------|
| `collection_path` | string | Path to `.bru` collection or directory | `./collections/payment-api` |
| `environment` | string | Bruno environment name to use | `staging`, `production` |
| `env_file` | string | Override env file path | `./envs/custom.json` |
| `sandbox_mode` | string | JS execution: 'safe' (default) or 'developer' | `safe` |

### Execution Control

| Parameter | Type | Purpose |
|-----------|------|---------|
| `bail_on_failure` | boolean | Stop on first failure |
| `parallel` | boolean | Run requests in parallel |
| `delay_ms` | number | Delay between requests (ms) |
| `tests_only` | boolean | Only run requests with assertions |

### Filtering

| Parameter | Type | Purpose |
|-----------|------|---------|
| `tags` | string | Comma-separated; run requests WITH ALL tags |
| `exclude_tags` | string | Comma-separated; skip requests WITH ANY tags |

### Reporting

| Parameter | Type | Purpose |
|-----------|------|---------|
| `report_path` | string | Where to write JSON report |
| `report_format` | string | `json`, `junit`, or `html` |

---

## Part 5: Result Parsing Pattern

All tools return structured JSON. Common pattern:

```typescript
interface ToolResult {
  success: boolean;
  summary?: { total_requests: number; passed: number; failed: number; execution_time_ms: number };
  errors: string[];
  [key: string]: unknown;
}
```

**Pattern:**
```typescript
const result = await matimo.execute('bruno_run_collection', params);

if (!result.success) {
  console.error('Execution failed:', result.errors);
  return;
}

if (result.summary.failed > 0) {
  console.warn(`⚠️  ${result.summary.failed} tests failed`);
  // Log failures for investigation
}

console.log(`✅ ${result.summary.passed}/${result.summary.total_requests} passed`);
```

---

## Part 6: Error Handling

```typescript
try {
  const result = await matimo.execute('bruno_run_collection', { ... });
  
  if (!result.success) {
    // Tool executed but tests failed
    console.error('Test failures:', result.errors);
  }
} catch (error) {
  // Tool execution itself failed (e.g., bru CLI not installed)
  console.error('Tool execution error:', error);
}
```

**Common Errors:**
- ❌ `bru: command not found` → Bruno CLI not installed
- ❌ `ENOENT: no such file or directory` → Collection path doesn't exist
- ❌ `Execution timed out` → Collection took longer than timeout

---

## Part 7: Integration with Other Matimo Features

### With LangChain
```typescript
import { convertToolsToLangChain } from '@matimo/core';

const brunTools = matimo.listTools().filter(t => t.name.startsWith('bruno_'));
const lcTools = convertToolsToLangChain(brunTools, matimo);

// Use in LangChain agent
```

### With CrewAI (Python)
```python
from matimo import Matimo, convert_tools_to_crewai

matimo = await Matimo.init()
bruno_tools = [t for t in matimo.list_tools() if t.name.startswith('bruno_')]
crew_tools = convert_tools_to_crewai(bruno_tools, matimo)
```

### With MCP (Model Context Protocol)
```
Agent via MCP → matimo_run_collection → returns JSON → agent parses → next action
```

---

## Part 8: Best Practices for Agent Workflows

✅ **DO:**
- Use `bruno_list_collections` + `bruno_get_collection_info` before running — agents should validate structure first
- Set `bail_on_failure: true` in CI/CD scenarios — fail fast
- Use `tags` to run only critical tests during development — faster feedback
- Parse `result.errors` to understand failures — don't ignore error array
- Log report path — agents should know where results are stored
- Use `parallel: true` for large collections — speed up execution
- Run `bruno_run_request` for debugging — isolate issues

❌ **DON'T:**
- Skip collection validation — Bruno may error if structure is corrupted
- Use `sandbox_mode: 'developer'` in production — security risk (runs npm packages)
- Ignore `tests_only` parameter — test collections can have many non-test requests
- Assume all runs pass — always check `result.success` and `result.errors`

---

## Part 9: Example: Complete Agent Workflow

```typescript
import { MatimoInstance } from '@matimo/core';

async function autonomousAPITesting(matimo: MatimoInstance) {
  const workspacePath = './api-collections';
  const targetEnv = 'staging';
  
  try {
    // Step 1: Discover collections
    console.log('📋 Discovering collections...');
    const collections = await matimo.execute('bruno_list_collections', {
      workspace_path: workspacePath
    });
    
    if (collections.collections.length === 0) {
      console.log('No collections found');
      return;
    }
    
    // Step 2: For each collection, validate & execute
    for (const collection of collections.collections) {
      console.log(`\n📍 Testing: ${collection.name}`);
      
      // Validate
      const info = await matimo.execute('bruno_get_collection_info', {
        collection_path: collection.path
      });
      
      console.log(`  Requests: ${info.collection.requests.length}`);
      console.log(`  Environments: ${info.collection.environments.length}`);
      
      // Execute
      const result = await matimo.execute('bruno_run_collection', {
        collection_path: collection.path,
        environment: targetEnv,
        bail_on_failure: false,
        report_path: `./reports/${collection.name}-${targetEnv}.json`
      });
      
      // Report
      if (result.success) {
        console.log(`  ✅ ${result.summary.passed}/${result.summary.total_requests} tests passed`);
      } else {
        console.log(`  ❌ ${result.summary.failed} tests failed`);
        console.log(`  Errors:`, result.errors);
        
        // For first failure, debug with single request
        if (result.errors.length > 0) {
          console.log('  🔍 Debugging first failed request...');
          // Could call bruno_run_request here to isolate issue
        }
      }
    }
    
    console.log('\n✨ Autonomous testing complete');
  } catch (error) {
    console.error('Testing workflow failed:', error);
  }
}
```

---

## Part 10: Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `bru: command not found` | Bruno CLI not installed | `pnpm install -g @usebruno/cli` |
| Collection not found | Wrong path | Verify path with `bruno_list_collections` first |
| Tests all fail | Wrong environment | Check available envs with `bruno_get_collection_info` |
| Timeout | Collection too large | Use `tags` to filter requests or increase timeout |
| 0 requests run | Collection has no tests | Check if assertions are active in requests |

---

## Part 11: Security Considerations

⚠️ **Important for Agent Workflows:**

1. **Never use `sandbox_mode: 'developer'` in production** — allows arbitrary npm package execution
2. **Environment variables** — Bruno uses env vars for secrets; ensure agents don't log them
3. **Report files** — Generated JSON reports may contain sensitive data (API keys in requests); restrict access
4. **API Credentials** — Use Bruno's secure environment management, not hardcoded keys

---

This skill enables agents to build autonomous, self-directed API testing workflows while maintaining control and visibility.
