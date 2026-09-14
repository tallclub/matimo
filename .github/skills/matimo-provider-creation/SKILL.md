---
name: matimo-provider-creation
description: Create new Matimo provider packages for TypeScript and Python SDKs. Master both execution types (HTTP, command, function), authentication patterns, and test standards. Use Matimo MCP tools for validation and testing.
metadata:
  category: "Tool Development"
  difficulty: "advanced"
  domain: "Provider Implementation"
  languages: ["typescript", "python"]
  user-invokable: false
  invocation: "Referenced by matimo-tool-creator agent for technical guidance"
---

# Matimo Provider Creation — TypeScript & Python

This skill teaches the comprehensive workflow for creating production-grade provider packages in **both TypeScript and Python SDKs** with identical patterns and full Matimo tool integration.

## Quick Reference: Agent Tool Mapping

| Objective | Matimo Tool | Usage |
|-----------|------------|-------|
| **Validate YAML** | `matimo_validate_tool` | Check YAML syntax for any tool definition |
| **Generate Tool YAML** | `matimo_create_tool` | Create draft tool definition with validation |
| **Validate Skill** | `matimo_validate_skill` | Check skill markdown for spec compliance |
| **Create Skill** | `matimo_create_skill` | Generate skill documentation |
| **Reload Tools** | `matimo_reload_tools` | Load new tools into registry |
| **Search Code** | `search` | Find existing patterns/tools to copy from |
| **Execute Commands** | `execute` | Run tests, linting, git commits |
| **Fetch Web Content** | `web` | Retrieve official API documentation |

**Agent Strategy**: When creating tools, use `matimo_create_tool` and `matimo_validate_tool` via MCP to ensure all generated tools meet standards. Never manually create tool YAML without validation.

---

## Part 1: Universal Provider Structure

### TypeScript Provider Package

```
packages/{provider}/                          
├── package.json                              # npm package metadata
├── tsconfig.json                             # TypeScript configuration
├── definition.yaml                           # OAuth provider config (if OAuth2)
├── README.md                                 # Usage guide, examples, auth setup
├── tools/
│   ├── {tool-1}/
│   │   ├── definition.yaml                  # Tool configuration
│   │   └── index.ts                         # Executor (if type: command)
│   └── {tool-2}/
│       ├── definition.yaml
│       └── index.ts
└── test/
    ├── unit/
    │   ├── {tool-1}.test.ts
    │   └── {tool-2}.test.ts
    └── integration/
        └── {provider}-tools.test.ts
```

### Python Provider Package

```
python/packages/{provider}/                  
├── pyproject.toml                           # Python package metadata
├── README.md                                # Usage guide, examples, auth setup
├── src/
│   └── matimo_{provider}/
│       ├── __init__.py
│       ├── definition.yaml                  # OAuth provider config (if OAuth2)
│       └── tools/
│           ├── {tool-1}/
│           │   ├── definition.yaml
│           │   └── executor.py             # Executor (if type: command)
│           └── {tool-2}/
│               ├── definition.yaml
│               └── executor.py
└── tests/
    ├── unit/
    │   ├── test_{tool_1}.py
    │   └── test_{tool_2}.py
    └── integration/
        └── test_{provider}_tools.py
```

**Key Difference**: Python uses `pyproject.toml` instead of `package.json`, but tool definitions and structures are identical.

---

## Part 2: Tool Definition Formats (Identical in Both SDKs)

Both TypeScript and Python use **identical YAML tool definitions**. Only implementation languages differ.

### HTTP Tool (Shared across TS & Python)

```yaml
name: {provider}_{action}                    # Unique across all tools
description: "Clear description from API docs"
version: '1.0.0'
status: stable                               # draft, stable, or deprecated

parameters:
  param_name:
    type: string                             # string, number, boolean, object, array
    required: true
    description: "From official API docs"
    
  optional_param:
    type: number
    required: false
    default: 10

execution:
  type: http                                 # REST API
  method: GET                                # HTTP method
  url: 'https://api.provider.com/v1/resource'
  headers:
    Authorization: 'Bearer {API_KEY}'       # Env var templated
    Content-Type: application/json
  query_params:
    filter: '{filter_param}'                # Parameter templated
  body:                                     # For POST/PUT
    field: '{param_name}'

authentication:
  type: api_key                             # api_key, bearer, basic, oauth2
  location: header                          # header, query, body
  name: Authorization

output_schema:
  type: object
  properties:
    ok:
      type: boolean
    data:
      type: object
  required:
    - ok

error_handling:
  retry: 2
  backoff_type: exponential
  initial_delay_ms: 500

examples:
  - name: "Example 1 from API docs"
    params:
      param_name: "value"
```

### Command Tool (TypeScript)

**File: `packages/{provider}/tools/{tool-name}/definition.yaml`**

```yaml
name: {provider}_{action}
description: "Local CLI or file operation"
version: '1.0.0'

parameters:
  input_file:
    type: string
    required: true

execution:
  type: command
  command: 'tsx'                             # TypeScript executor
  timeout_ms: 30000
  args:
    - 'packages/{provider}/tools/{tool-name}/index.ts'
    - '{input_file}'

output_schema:
  type: object
  properties:
    status:
      type: string

examples:
  - name: "Process file"
    params:
      input_file: "/path/to/file.txt"
```

**Corresponding TypeScript implementation:**

**File: `packages/{provider}/tools/{tool-name}/index.ts`**

```typescript
import { getGlobalMatimoLogger } from '@matimo/core';

const logger = getGlobalMatimoLogger();

export async function execute(params: Record<string, unknown>): Promise<unknown> {
  const inputFile = params.input_file as string;
  
  if (!inputFile) {
    throw new Error('input_file parameter required');
  }
  
  try {
    // Your implementation here
    logger.info(`Processing file: ${inputFile}`);
    
    return {
      status: 'success',
      file: inputFile
    };
  } catch (error) {
    logger.error(`Command failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
```

### Command Tool (Python)

**File: `python/packages/{provider}/src/matimo_{provider}/tools/{tool-name}/definition.yaml`**

```yaml
name: {provider}_{action}
description: "Local command or file operation"
version: '1.0.0'

parameters:
  input_file:
    type: string
    required: true

execution:
  type: command
  command: 'python'                          # Python executor
  timeout_ms: 30000
  args:
    - 'python/packages/{provider}/src/matimo_{provider}/tools/{tool-name}/executor.py'
    - '{input_file}'

output_schema:
  type: object
  properties:
    status:
      type: string

examples:
  - name: "Process file"
    params:
      input_file: "/path/to/file.txt"
```

**Corresponding Python implementation:**

**File: `python/packages/{provider}/src/matimo_{provider}/tools/{tool-name}/executor.py`**

```python
import sys
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def execute(input_file: str) -> dict[str, object]:
    """Execute the command tool."""
    if not input_file:
        raise ValueError('input_file parameter required')
    
    try:
        logger.info(f"Processing file: {input_file}")
        
        # Your implementation here
        file_path = Path(input_file)
        
        return {
            "status": "success",
            "file": str(file_path)
        }
    except Exception as e:
        logger.error(f"Command failed: {str(e)}")
        raise

if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise ValueError('input_file argument required')
    
    input_file = sys.argv[1]
    result = execute(input_file)
    print(result)
```

---

## Part 3: Authentication Patterns (Identical)

### Pattern 1: API Key (Header)

**YAML** (both TS & Python):
```yaml
authentication:
  type: api_key
  location: header
  name: Authorization

parameters:
  api_key:
    type: string
    required: false  # Optional in parameters; sourced from env var

execution:
  headers:
    Authorization: 'Bearer {PROVIDER_API_KEY}'  # Env var: MATIMO_{TOOL_NAME}_PROVIDER_API_KEY
```

**Setup**: User sets `export MATIMO_{TOOL_NAME}_PROVIDER_API_KEY="sk_..."` before running.

### Pattern 2: Bearer Token (OAuth2)

**YAML** (both TS & Python):
```yaml
authentication:
  type: oauth2

parameters:
  token:
    type: string
    required: false  # Sourced from OAuth2 flow or env var

execution:
  headers:
    Authorization: 'Bearer {OAUTH_TOKEN}'  # Env var or OAuth2 token
```

### Pattern 3: Basic Auth

**YAML** (both TS & Python):
```yaml
authentication:
  type: basic

execution:
  headers:
    Authorization: 'Basic {BASE64_CREDENTIALS}'  # base64(username:password)
```

---

## Part 4: Testing Standards (TypeScript)

**Location**: `packages/{provider}/test/`

### Unit Tests

**File: `packages/{provider}/test/unit/{tool-name}.test.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('{provider}-{tool-name}', () => {
  it('should load valid YAML definition', () => {
    const toolPath = path.join(__dirname, '../../tools/{tool-name}/definition.yaml');
    const content = fs.readFileSync(toolPath, 'utf-8');
    const tool = yaml.load(content);
    
    expect(tool).toBeDefined();
    expect((tool as any).name).toBe('{provider}_{tool_name}');
    expect((tool as any).parameters).toBeDefined();
    expect((tool as any).execution).toBeDefined();
    expect((tool as any).output_schema).toBeDefined();
  });

  it('should have valid authentication config', () => {
    const toolPath = path.join(__dirname, '../../tools/{tool-name}/definition.yaml');
    const content = fs.readFileSync(toolPath, 'utf-8');
    const tool = yaml.load(content) as any;
    
    expect(tool.authentication).toBeDefined();
    expect(['api_key', 'bearer', 'basic', 'oauth2']).toContain(tool.authentication.type);
  });

  it('should have at least 2 examples', () => {
    const toolPath = path.join(__dirname, '../../tools/{tool-name}/definition.yaml');
    const content = fs.readFileSync(toolPath, 'utf-8');
    const tool = yaml.load(content) as any;
    
    expect(tool.examples).toBeDefined();
    expect(Array.isArray(tool.examples)).toBe(true);
    expect(tool.examples.length).toBeGreaterThanOrEqual(2);
  });
});
```

### Integration Tests

**File: `packages/{provider}/test/integration/{provider}-tools.test.ts`**

```typescript
import { MatimoInstance } from '@matimo/core';
import * as path from 'path';

describe('{provider} Tools Integration', () => {
  let matimo: MatimoInstance;

  beforeAll(async () => {
    const toolsPath = path.join(__dirname, '../../tools');
    matimo = await MatimoInstance.init(toolsPath);
  });

  it('should load all tools from {provider}', async () => {
    const tools = matimo.listTools();
    
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some(t => t.name.startsWith('{provider}'))).toBe(true);
  });

  it('should execute tool with valid parameters', async () => {
    // Skip if no credentials
    if (!process.env.MATIMO_{PROVIDER}_API_KEY) {
      this.skip();
    }

    const result = await matimo.execute('{provider}_{tool_name}', {
      param_name: 'test_value'
    });
    
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
  });

  it('should fail gracefully with invalid parameters', async () => {
    await expect(
      matimo.execute('{provider}_{tool_name}', {
        // Missing required parameter
      })
    ).rejects.toThrow();
  });
});
```

---

## Part 5: Testing Standards (Python)

**Location**: `python/packages/{provider}/tests/`

### Unit Tests

**File: `python/packages/{provider}/tests/unit/test_{tool_name}.py`**

```python
import pytest
from pathlib import Path
import yaml

@pytest.fixture
def tool_definition() -> dict:
    """Load tool definition YAML."""
    tool_path = Path(__file__).parent.parent.parent / "src" / "matimo_provider" / "tools" / "{tool_name}" / "definition.yaml"
    with open(tool_path) as f:
        return yaml.safe_load(f)

def test_tool_definition_valid(tool_definition: dict) -> None:
    """Test YAML structure is valid."""
    assert tool_definition is not None
    assert tool_definition.get("name") == "{provider}_{tool_name}"
    assert "parameters" in tool_definition
    assert "execution" in tool_definition
    assert "output_schema" in tool_definition

def test_authentication_config(tool_definition: dict) -> None:
    """Test authentication is properly configured."""
    auth = tool_definition.get("authentication")
    assert auth is not None
    assert auth.get("type") in ["api_key", "bearer", "basic", "oauth2"]

def test_examples_present(tool_definition: dict) -> None:
    """Test examples are documented."""
    examples = tool_definition.get("examples", [])
    assert len(examples) >= 2
    assert all("name" in ex and "params" in ex for ex in examples)
```

### Integration Tests

**File: `python/packages/{provider}/tests/integration/test_{provider}_tools.py`**

```python
import pytest
import os
from matimo import Matimo

@pytest.fixture
async def matimo_instance() -> Matimo:
    """Initialize Matimo with provider tools."""
    tools_path = os.path.join(
        os.path.dirname(__file__),
        "../../src/matimo_provider/tools"
    )
    return await Matimo.init(tools_path)

@pytest.mark.asyncio
async def test_tools_load(matimo_instance: Matimo) -> None:
    """Test all tools load successfully."""
    tools = matimo_instance.list_tools()
    
    assert len(tools) > 0
    assert any(t.name.startswith("{provider}") for t in tools)

@pytest.mark.asyncio
async def test_execute_with_valid_params(matimo_instance: Matimo) -> None:
    """Test tool execution with valid parameters."""
    if not os.getenv("MATIMO_{PROVIDER}_API_KEY"):
        pytest.skip("No credentials available")
    
    result = await matimo_instance.execute(
        "{provider}_{tool_name}",
        {"param_name": "test_value"}
    )
    
    assert result is not None
    assert result.get("ok") is True

@pytest.mark.asyncio
async def test_execute_fails_gracefully(matimo_instance: Matimo) -> None:
    """Test tool fails gracefully with invalid parameters."""
    with pytest.raises(Exception):
        await matimo_instance.execute(
            "{provider}_{tool_name}",
            {}  # Missing required parameter
        )
```

---

## Part 6: Matimo Tool Usage in Workflows

### Using `matimo_validate_tool` for Quick Checks

**Objective**: Validate a tool YAML before saving to disk

```bash
# Agent calls via MCP:
POST http://0.0.0.0:3101/messages

{
  "method": "call_tool",
  "params": {
    "name": "matimo_validate_tool",
    "arguments": {
      "name": "{provider}-get-user"  # Tool directory name
    }
  }
}

# Returns:
{
  "valid": true,
  "issues": [],
  "message": "Tool is valid per Matimo specification"
}
```

### Using `matimo_create_tool` for Scaffolding

**Objective**: Generate a tool YAML with built-in validation

```bash
POST http://0.0.0.0:3101/messages

{
  "method": "call_tool",
  "params": {
    "name": "matimo_create_tool",
    "arguments": {
      "name": "provider-get-user",
      "yaml_content": "name: provider_get_user\n...",
      "justification": "Enable querying user profiles",
      "proposed_by": "Agent"
    }
  }
}

# Returns:
{
  "success": true,
  "path": "packages/{provider}/tools/provider-get-user/definition.yaml",
  "message": "Tool 'provider-get-user' created successfully"
}
```

### Using `matimo_reload_tools` After Creating

**Objective**: Load new tools into tool registry

```bash
POST http://0.0.0.0:3101/messages

{
  "method": "call_tool",
  "params": {
    "name": "matimo_reload_tools",
    "arguments": {}
  }
}

# Returns:
{
  "loaded": 128,
  "removed": 0,
  "revalidated": 0,
  "rejected": 0,
  "message": "Tools reloaded successfully"
}
```

### Using `execute` for Testing

**Objective**: Run test suite after creating tools

```bash
POST http://0.0.0.0:3101/messages

{
  "method": "call_tool",
  "params": {
    "name": "execute",
    "arguments": {
      "command": "cd typescript && pnpm test --testNamePattern='{provider}' --coverage"
    }
  }
}

# Returns test output with coverage metrics
```

---

## Part 7: Side-by-Side Pattern Examples

### HTTP Tool: TypeScript vs Python (Identical YAML)

**Shared definition:** `packages/provider/tools/get-user/definition.yaml` (TypeScript) or `python/packages/provider/src/matimo_provider/tools/get-user/definition.yaml` (Python)

```yaml
name: provider_get_user
description: Retrieve user information from Provider API
version: '1.0.0'

parameters:
  user_id:
    type: string
    required: true
    description: Unique user identifier

execution:
  type: http
  method: GET
  url: 'https://api.provider.com/users/{user_id}'
  headers:
    Authorization: 'Bearer {PROVIDER_API_TOKEN}'

authentication:
  type: bearer

output_schema:
  type: object
  properties:
    id:
      type: string
    name:
      type: string
    email:
      type: string

examples:
  - name: Get specific user
    params:
      user_id: "user123"
```

Both TypeScript and Python use this **exact same YAML**. The execution is handled by their respective HTTP executors already built into `@matimo/core` and `matimo` Python SDK.

### Command Tool Implementation

**TypeScript**: `packages/provider/tools/transform-data/index.ts`
```typescript
export async function execute(params: Record<string, unknown>): Promise<unknown> {
  const inputData = params.input_data as string;
  // Transform logic
  return { transformed: true, data: inputData };
}
```

**Python**: `python/packages/provider/src/matimo_provider/tools/transform-data/executor.py`
```python
def execute(input_data: str) -> dict[str, object]:
    """Transform data."""
    # Transform logic (identical algorithm)
    return {"transformed": True, "data": input_data}
```

---

## Part 8: README Template (Both SDKs)

**Location**: `packages/{provider}/README.md` (TS) or `python/packages/{provider}/README.md` (Python)

```markdown
# @matimo/{provider} — {Provider} Tools for Matimo

{Provider} integration for Matimo SDK. Perform actions like list users, create resources, send notifications.

## Installation

### TypeScript
\`\`\`bash
npm install @matimo/{provider}
# or
pnpm add @matimo/{provider}
\`\`\`

### Python
\`\`\`bash
pip install matimo-{provider}
# or
uv add matimo-{provider}
\`\`\`

## Available Tools

| Tool | Method | Purpose |
|------|--------|---------|
| `{provider}_get_user` | GET | Retrieve user profile |
| `{provider}_create_resource` | POST | Create new resource |

## Quick Start

### TypeScript
\`\`\`typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init('./tools', { autoDiscover: true });

const user = await matimo.execute('{provider}_get_user', { user_id: '123' });
console.log(user);
\`\`\`

### Python
\`\`\`python
from matimo import Matimo

matimo = await Matimo.init('./tools', InitOptions(auto_discover=True))

user = await matimo.execute('{provider}_get_user', {'user_id': '123'})
print(user)
\`\`\`

## Authentication

Set your {Provider} API key:

\`\`\`bash
export MATIMO_{PROVIDER}_API_KEY="your_api_key_here"
\`\`\`

## Examples

### LangChain Integration

**TypeScript**:
\`\`\`typescript
import { MatimoInstance, convertToolsToLangChain } from '@matimo/core';

const matimo = await MatimoInstance.init('./tools', { autoDiscover: true });
const tools = convertToolsToLangChain(matimo.listTools(), matimo);

// Use with LangChain agents
\`\`\`

**Python**:
\`\`\`python
from matimo import Matimo, convert_tools_to_langchain

matimo = await Matimo.init('./tools', InitOptions(auto_discover=True))
tools = convert_tools_to_langchain(matimo.list_tools(), matimo)

# Use with LangChain agents
\`\`\`

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md)

## License

MIT — Part of the Matimo SDK
```

---

## Agents: Decision Tree

When an agent asks you questions, use this tree:

```
Q: "Should I generate tool YAML manually or use matimo_create_tool?"
→ Always use matimo_create_tool via MCP. It validates automatically.

Q: "Is Python different from TypeScript?"
→ Tool definitions (YAML) are identical.
→ Only implementation code differs (index.ts vs executor.py).
→ Both use the same HTTP/command executors from their SDKs.

Q: "How do I validate a tool?"
→ For YAML syntax: Use matimo_validate_tool via MCP
→ For code quality: TypeScript → pnpm lint/test, Python → uv run pytest

Q: "Should I run tests after creating tools?"
→ YES. Always run unit + integration tests before delivery.
→ TypeScript: pnpm test
→ Python: uv run pytest

Q: "Which Matimo tool should I use?"
→ Creating tool YAML? → matimo_create_tool
→ Validating existing tool? → matimo_validate_tool
→ Need to search patterns? → search
→ Running tests? → execute
→ Creating skill docs? → matimo_create_skill
```

---

## Key Principles

✅ **Patterns are identical** across TS and Python — only language differs
✅ **Always use Matimo tools** for validation (matimo_validate_tool, etc.)
✅ **Test thoroughly** — unit + integration tests mandatory
✅ **Reference existing tools** before creating new ones (Slack, Gmail examples)
✅ **YAML first** — define once, execute everywhere
✅ **No secrets in code** — all auth via environment variables and templating
