# @matimo/bruno

Bruno CLI tools for Matimo - Enable AI agents to autonomously manage, execute, and validate API test collections.

## 📦 Installation

```bash
npm install @matimo/bruno
```

## 🚀 Quick Start

### TypeScript / JavaScript

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init('./packages/bruno/tools');

// List all collections in workspace
const collections = await matimo.execute('bruno_list_collections', {
  workspace_path: './collections'
});

// Get collection metadata before running
const info = await matimo.execute('bruno_get_collection_info', {
  collection_path: './collections/payment-api'
});

// Run entire collection
const result = await matimo.execute('bruno_run_collection', {
  collection_path: './collections/payment-api',
  environment: 'staging',
  report_path: './reports/staging-results.json'
});

// Run single request for debugging
const response = await matimo.execute('bruno_run_request', {
  collection_path: './collections/auth',
  request_name: 'Login',
  environment: 'staging'
});

// Bootstrap from OpenAPI spec
const imported = await matimo.execute('bruno_import_openapi', {
  spec_source: 'https://api.example.com/openapi.json',
  output_directory: './collections',
  collection_name: 'Generated API Tests'
});

// Create new collection
const created = await matimo.execute('bruno_create_collection', {
  collection_path: './collections/new-service',
  collection_name: 'New Service Tests'
});

// Add a request to an existing collection
const added = await matimo.execute('bruno_add_request', {
  collection_path: './collections/new-service',
  request_name: 'get-users',
  method: 'GET',
  url: 'https://api.example.com/users'
});
```

## 📋 Available Tools

### 1. `bruno_run_collection`
Execute a Bruno API collection with configurable environments, data files, and reporting.

**Parameters:**
- `collection_path` (required) - Path to collection file or directory
- `environment` - Environment name (dev, staging, prod)
- `env_file` - Path to environment file override
- `data_file` - CSV/JSON data file for data-driven testing
- `iteration_count` - Number of iterations to run
- `delay_ms` - Delay between requests
- `tags` - Comma-separated tags (run requests with ALL tags)
- `exclude_tags` - Comma-separated tags (skip requests with ANY tags)
- `tests_only` - Run only requests with tests/assertions
- `bail_on_failure` - Stop on first failure
- `parallel` - Run requests in parallel
- `sandbox_mode` - JavaScript execution mode ('safe' or 'developer')
- `report_format` - Report format (json, junit, html)
- `report_path` - Path to write report file

**Returns:** Collection execution results, summary, and report path

### 2. `bruno_run_request`
Execute a single request for targeted debugging and validation.

**Parameters:**
- `collection_path` (required) - Collection directory
- `request_name` (required) - Request name to execute
- `environment` - Environment name override
- `env_file` - Environment file override
- `sandbox_mode` - JavaScript execution mode

**Returns:** Request/response details and assertion results

### 3. `bruno_list_collections`
Discover all collections in a workspace.

**Parameters:**
- `workspace_path` (required) - Workspace directory
- `filter` - Filter by collection name (substring)

**Returns:** Array of collection metadata

### 4. `bruno_get_collection_info`
Introspect collection structure before execution.

**Parameters:**
- `collection_path` (required) - Collection path

**Returns:** Collection structure, requests, environments, variables

### 5. `bruno_import_openapi`
Bootstrap a collection from OpenAPI 3.0 specification.

**Parameters:**
- `spec_source` (required) - Path or URL to OpenAPI spec
- `output_directory` (required) - Where to create collection
- `collection_name` - Collection name
- `collection_format` - 'bru' or 'opencollection'
- `group_by` - Group by 'tags' or 'path'
- `insecure` - Skip TLS verification

**Returns:** Collection path and metadata

### 6. `bruno_create_collection`
Create a new empty collection scaffold.

**Parameters:**
- `collection_path` (required) - Collection creation path
- `collection_name` (required) - Collection name

**Returns:** Creation status and path

### 7. `bruno_add_request`
Add a new HTTP request to a Bruno collection programmatically.

**Parameters:**
- `collection_path` (required) - Path to Bruno collection directory
- `request_name` (required) - Request name (becomes .bru filename, alphanumeric + hyphens)
- `method` (required) - HTTP method (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- `url` (required) - Full request URL (can contain {variables})
- `headers` - HTTP headers as key-value pairs
- `body` - Request body (JSON or raw text)
- `tests` - Bruno test script (JavaScript assertions)
- `documentation` - Request documentation/description

**Returns:** Creation status, request path, and request name

## 🔄 Agent Workflows

### Autonomous Test Execution
```
Agent discovers spec → import_openapi → set environment → run_collection → parse results
```

### Multi-Environment Validation
```
list_collections → for each environment: set_env + run_collection → compare results
```

### Targeted Debugging
```
get_collection_info → run_request (single endpoint) → analyze response
```

### Data-Driven Testing
```
run_collection with CSV file → multiple iterations → aggregate metrics
```

## 🔐 Authentication

Tools use environment variables for credentials. Bruno CLI manages environment setup - tools wrap CLI execution.

## 📖 Prerequisites

- **Bruno CLI** installed globally: `npm install -g @usebruno/cli` (or `pnpm install -g @usebruno/cli`)
- **Node.js** 18+ required
- Bruno collections in `.bru` format or OpenAPI specs

## 🤝 Integration

Works with:
- **LangChain** - Convert to StructuredTool
- **CrewAI** - Convert to BaseTool
- **MCP** - Expose via JSON-RPC to Claude / other MCP clients
- **Native** - Direct SDK usage

## 📝 License

MIT
