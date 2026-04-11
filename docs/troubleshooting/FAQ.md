# Troubleshooting & FAQ

Common issues and solutions for Matimo v0.1.0-alpha.14 (TypeScript & Python)

## Installation & Setup

### TypeScript Issues

#### Q: Node.js version error

**Error**: `Node version must be 18.0.0 or higher`

**Solution**:

```bash
node --version
# If < v18, install from https://nodejs.org
# Use nvm (Node Version Manager) for easy switching:
nvm install 18
nvm use 18
```

#### Q: pnpm not found

**Error**: `pnpm: command not found`

**Solution**:

```bash
npm install -g pnpm@8.15.0
pnpm --version
```

#### Q: Build fails with TypeScript errors

**Error**: `Found X errors in src/**`

**Solution**:

```bash
# Clear and rebuild
pnpm clean
pnpm install
pnpm build

# If still failing, check TypeScript version
pnpm list typescript
# Should be 5.9.3 or higher
```

### Python Issues

#### Q: Python version too old

**Error**: `ModuleNotFoundError: No module named 'matimo'` or `Python 3.10 or lower detected`

**Solution**:

```bash
python --version
# If < 3.11, upgrade:
# macOS: brew install python@3.11
# Linux: sudo apt install python3.11
# Windows: https://www.python.org/downloads/

# Verify:
python3.11 --version

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate  # or 'venv\Scripts\activate' on Windows
```

#### Q: `pip install matimo` fails

**Error**: `ERROR: Could not find a version that satisfies the requirement`

**Solution**:

```bash
# Make sure you're using Python 3.11+
python --version

# Try with uv (faster):
uv add matimo  # Creates venv automatically

# Or explicit pip:
pip install --upgrade pip
pip install matimo

# For specific version:
pip install matimo==0.1.0a14
```

#### Q: LangChain or CrewAI imports fail

**Error**: `ModuleNotFoundError: No module named 'langchain'` / `ModuleNotFoundError: No module named 'crewai'`

**Solution**:

```bash
# Install with extras:
pip install "matimo-core[langchain]"
#or
pip install "matimo-core[crewai]"

# With uv:
uv add "matimo-core[langchain]"
uv add "matimo-core[crewai]"

# Verify:
python -c "from matimo.integrations.langchain import convert_tools_to_langchain; print('✅ LangChain integration available')"
```

#### Q: Async/await RuntimeError in Jupyter

**Error**: `RuntimeError: asyncio.run() cannot be called from a running event loop`

**Solution**:

```python
# In Jupyter, install nest_asyncio
pip install nest_asyncio

# Then in your notebook:
import nest_asyncio
nest_asyncio.apply()

# Now asyncio.run() works in Jupyter
import asyncio
from matimo import Matimo

matimo = await Matimo.init()  # Works now!
```

#### Q: CrewAI tools not executing

**Error**: `Tool execution timeout` or `Tool not callable`

**Solution**:

```python
# Verify tools are created correctly
tools = convert_tools_to_crewai(tool_definitions, matimo)
print(f"✅ Created {len(tools)} tools")
print([f"{t.name}: {t.description}" for t in tools])  # Verify names

# Ensure matimo.execute() is still available to the tool
# It's captured in the closure, so it should work
```

---

## Security & Embedded Code

### Q: Embedded code execution fails with "disabled" error

**Error**: `Embedded code execution is disabled by default for security`

**Explanation**: Matimo disables inline code execution in tool YAML to prevent Remote Code Execution (RCE) if tool definitions come from untrusted sources.

**Default behavior**:

```typescript
// embeddedCodeDisabled = (MATIMO_ALLOW_EMBEDDED_CODE !== 'true')
// If env var is NOT set → embeddedCodeDisabled = true → throws error ✓
if (embeddedCodeDisabled) {
  throw new MatimoError('Embedded code execution is disabled by default...');
}
```

**Solutions**:

1. **Recommended**: Use external TypeScript files instead:

```yaml
# ✅ Secure: External file
execution:
  type: function
  code: ./handler.ts # Version-controlled, auditable
  timeout: 10000
```

2. **If you must use embedded code** (NOT recommended):

```bash
# Only in trusted environments
export MATIMO_ALLOW_EMBEDDED_CODE=true

# Then run your tool
pnpm agent:factory
```

### Q: What's the security risk with embedded code?

**Risk**: `new Function()` executes arbitrary JavaScript with access to:

- `fs` module (file system read/write)
- `path` module (path manipulation)
- `axios` module (network requests)

**If tool YAML comes from untrusted sources**, an attacker could inject malicious code that:

- Steals environment variables (tokens, keys)
- Modifies files
- Makes unauthorized API requests

**Mitigation**:

✅ **DO**:

- Use external .ts files for tool logic
- Review all tool YAML before loading
- Only enable embedded code in fully-trusted environments
- Never commit embedded code to repositories

❌ **DON'T**:

- Load tool YAML from untrusted sources without review
- Enable embedded code in production
- Allow users to upload arbitrary tool definitions
- Store secrets in tool YAML

---

## Tool Execution

### Q: Tool not found error

**Error**: `Tool not found: calculator`

**Solutions**:

1. Verify tool exists:

```bash
pnpm validate-tools
# Lists all loaded tools
```

2. Check tools directory:

```bash
# Ensure tools/calculator/definition.yaml exists
ls -la tools/calculator/definition.yaml
```

3. Verify tool definition:

```bash
pnpm validate-tools
# Shows validation errors if YAML is invalid
```

### Q: Invalid parameters error

**Error**: `Tool validation failed: Missing required parameter: operation`

**Solutions**:

1. Check tool parameters:

```typescript
const tool = matimoInstance.getTool('calculator');
console.log(tool.parameters); // See required fields
```

2. Verify your input matches schema:

```typescript
// ❌ Wrong
await m.execute('calculator', { value: 5 });

// ✅ Correct
await m.execute('calculator', {
  operation: 'add',
  a: 5,
  b: 3,
});
```

3. Check tool spec:

```bash
cat tools/calculator/definition.yaml | grep -A 20 "parameters:"
```

### Q: HTTP tool returns 401 Unauthorized

**Error**: `HTTP 401: Unauthorized`

**Common causes**:

1. Missing OAuth token:

```bash
# Set required tokens
export GMAIL_ACCESS_TOKEN=your_token
export GITHUB_TOKEN=your_token
```

2. Expired token:

```typescript
// Token needs refresh
const newToken = await oauth2Handler.refreshTokenIfNeeded(userId, currentToken);
```

3. Wrong token format:

```typescript
// Verify token is Bearer token, not full "Bearer token"
const token = process.env.GMAIL_ACCESS_TOKEN;
// Should be: "ya29.abc123..." not "Bearer ya29.abc123..."
```

### Q: Command executor fails

**Error**: `Command not found: node` or shell command fails

**Solutions**:

1. Verify command exists:

```bash
which node
which python
```

2. Check working directory:

```yaml
execution:
  type: command
  command: ./script.sh
  cwd: /path/to/directory # Ensure this exists
```

3. Test command manually:

```bash
# Test the exact command
node calculator.js --op add 5 3
```

---

## OAuth2 & Authentication

### Q: OAuth token missing error

**Error**: `Missing OAuth token for provider: google`

**Solutions**:

1. Set environment variables:

```bash
export GMAIL_ACCESS_TOKEN=ya29.your_token_here
export GITHUB_TOKEN=ghp_your_token_here
export SLACK_TOKEN=xoxb-your_token_here
```

2. Verify token is set:

```typescript
console.log(process.env.GMAIL_ACCESS_TOKEN);
// Should print your token, not undefined
```

3. Check tool authentication config:

```yaml
authentication:
  type: oauth2
  provider: google # Must match provider definition
```

### Q: OAuth provider configuration not found

**Error**: `Provider definition not found: github`

**Solutions**:

1. Verify provider YAML exists:

```bash
ls tools/github/definition.yaml
# Should exist and contain: type: provider
```

2. Check provider name:

```bash
pnpm validate-tools
# Lists all loaded providers
```

3. Verify provider YAML format:

```bash
cat tools/github/definition.yaml | head -5
# Should show: type: provider
```

### Q: Bearer token format issue

**Error**: `Invalid authorization header`

**Solutions**:

1. Use correct token format:

```bash
# ✅ Correct: Just the token
export GMAIL_ACCESS_TOKEN=ya29.abc123

# ❌ Wrong: Don't include "Bearer"
export GMAIL_ACCESS_TOKEN="Bearer ya29.abc123"
```

2. Verify token is actually a token:

```bash
echo $GMAIL_ACCESS_TOKEN | wc -c
# Should be > 20 characters
```

---

## Validation Errors

### Q: Schema validation failed

**Error**: `Tool schema validation failed: • execution: Required`

**Solutions**:

1. Check required fields in tool YAML:

```yaml
# ✅ All required fields
name: my-tool
version: 1.0.0
description: Tool description
parameters: {}
execution:
  type: http
  method: GET
  url: https://api.example.com
```

2. Run validation:

```bash
pnpm validate-tools
# Shows exact field errors
```

### Q: Invalid execution type

**Error**: `Invalid execution type: webhook`

**Solutions**:
Supported execution types are:

- ✅ `command` - Shell commands
- ✅ `http` - HTTP requests

Unsupported (coming in future releases):

- 🔜 `webhook` - v0.3.0
- 🔜 `grpc` - Future
- 🔜 `database` - Future

---

## Testing & Development

### Q: Tests fail locally

**Error**: Tests pass in CI but fail locally

**Solutions**:

1. Clear cache and reinstall:

```bash
pnpm clean
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

2. Run specific test:

```bash
pnpm test -- --testNamePattern="oauth2"
```

3. Debug test:

```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand
# Then open chrome://inspect
```

### Q: Linting errors

**Error**: `ESLint errors found`

**Solution**:

```bash
# Fix automatically
pnpm lint:fix

# Then format
pnpm format
```

---

## Performance Issues

### Q: Tool execution is slow

**Possible causes**:

1. Network latency (HTTP tools)
2. OAuth token refresh overhead
3. Tool parameter validation

**Solutions**:

```typescript
// Time tool execution
console.time('tool-execution');
const result = await m.execute('gmail-send-email', params);
console.timeEnd('tool-execution');

// Optimize: Cache tools
const tool = m.getTool('gmail-send-email');
const result = await executor.execute(tool, params);
```

### Q: High memory usage

**Solutions**:

```typescript
// Don't load all tools if not needed
const tools = m.listTools();
const filtered = tools.filter((t) => t.tags.includes('gmail'));

// Or use specific tool
const tool = m.getTool('gmail-send-email');
```

---

## v0.1.0-alpha.11 Features & Roadmap

### ✅ Available Now (as of February 27, 2026)

- ✅ **Core SDK** - MatimoInstance, tool execution, discovery
- ✅ **CLI** - `matimo` command for tool management
- ✅ **LangChain Integration** - Full schema conversion with enum/default support
- ✅ **OAuth2** - Provider-agnostic authentication
- ✅ **Native Basic Auth** - Automatic base64 encoding with username/password env vars
- ✅ **Form-Encoded Requests** - Automatic URLSearchParams conversion for `application/x-www-form-urlencoded`
- ✅ **Provider Packages** - Slack (16+ tools), Gmail (5 tools), GitHub (12+ tools), HubSpot (50+ tools), Notion (8 tools), Twilio (4 tools), Mailchimp (7 tools), Postgres (4+ tools)
- ✅ **Structured Error Handling** - MatimoError with cause chaining
- ✅ **HTTP Executor Enhancements** - Parameter embedding for objects/arrays, form encoding, type conversion
- ✅ **Multiple Executors** - Command, HTTP, Function
- ✅ **Auto-Discovery** - Automatic tool loading from `node_modules`
- ✅ **Test Coverage** - 100% line coverage for HTTP executor
- ✅ **Type Safety** - Full TypeScript support with Zod validation

### 🔜 Coming Soon

- 🔜 **MCP Server** - Claude/LLM integration (v0.2.0)
- 🔜 **REST API** - HTTP API (v0.3.0)
- 🔜 **Python SDK** - Python support (v0.3.0)
- 🔜 **Docker** - Containerization (v0.3.0)
- 🔜 **Rate Limiting** - Token bucket (v0.2.0)
- 🔜 **Health Monitoring** - Schema drift detection (v0.2.0)

See [Roadmap](../ROADMAP.md) for details on future features and planned releases.

---

## LangChain Integration Issues

### Q: LangChain tool schema validation fails

**Error**: `Invalid input` or schema validation error when invoking LangChain tool

**Solutions**:

1. Check enum parameter handling:

```typescript
// If tool has enum constraints, they're now properly validated
const tool = m.getTool('my-tool');
console.log(tool.parameters.status.enum); // Check allowed values

// Pass only allowed values
await langTool.invoke({ status: 'active' }); // ✅
```

2. Verify default values are set:

```typescript
// Tools with default values should apply them automatically
await langTool.invoke({}); // Defaults injected
```

3. Check secret parameter detection:

```typescript
// Parameters with "token", "key", "secret", "password" are auto-hidden
// Only real secret patterns are filtered (not "monkey", "turkey_id", etc.)
const schema = langTool.schema;
console.log(Object.keys(schema.shape)); // Won't include api_key, but will include data
```

---

## Parameter Validation Issues

### Q: Enum parameter rejected valid value

**Error**: `Invalid option: expected one of "active"|"inactive"`

**Solutions**:

1. Verify parameter has enum defined:

```yaml
parameters:
  status:
    type: string
    enum: ['active', 'inactive', 'pending']
```

2. Pass exact value:

```typescript
// ✅ Correct
await m.execute('tool', { status: 'active' });

// ❌ Wrong
await m.execute('tool', { status: 'ACTIVE' }); // Case sensitive
```

### Q: Default value not applied

**Error**: Tool requires parameter but default wasn't used

**Solutions**:

1. Mark parameter as optional if default provided:

```yaml
parameters:
  timeout:
    type: number
    required: false # Important!
    default: 5000
```

2. Verify default is valid type:

```yaml
# ✅ Correct
default: 5000

# ❌ Wrong (must match type)
default: "5000" # for number type
```

---

## File Path & URL Issues

### Q: Function executor fails with "Cannot find module"

**Error**: `Error: Cannot find module 'file:///path/to/tool.ts'`

**Solutions**:

1. Uses proper file URLs (Windows compatibility fixed):

```typescript
// Now uses pathToFileURL() for robust URL construction
// Handles spaces, special chars, and Windows paths automatically
```

2. Verify file exists:

```bash
ls -la tools/provider/tool-name/tool-name.ts
# Should exist and be readable
```

3. Use relative paths in tool definition:

```yaml
execution:
  type: function
  code: ./tool-name.ts # Relative to tool directory
```

---

## Secret Detection Issues

### Q: Parameter incorrectly treated as secret

**Error**: Parameter missing from LangChain schema (e.g., "monkey", "turkey_id")

**Root Cause**: Old substring matching was too loose

**Solution**: Now uses word-boundary matching:

```typescript
// ❌ Old: Contains "key" substring → treated as secret
// "monkey", "turkey_id", "donkey" → incorrectly hidden

// ✅ New: Word-boundary matching
// "monkey" → NOT a secret ("key" is substring)
// "api_key" → IS a secret ("_key" is word boundary)
// "getSecret" → IS a secret ("Secret" is word boundary)
```

**Verify parameter detection**:

```typescript
const langTools = await convertToolsToLangChain([tool], matimo, { api_key: 'secret' });

const schema = langTools[0].schema;
console.log(Object.keys(schema.shape));
// Should include: monkey, turkey_id, data
// Should exclude: api_key, real_secret
```

---

Still stuck? Try:

1. **GitHub Issues**: [Search issues](https://github.com/tallclub/matimo/issues)
2. **GitHub Discussions**: [Ask questions](https://github.com/tallclub/matimo/discussions)
3. **Documentation**: [Full docs](../)
4. **Examples**: [See examples](../../examples/)

---

## Report a Bug

Found a bug? Help us fix it:

```bash
# 1. Check if issue exists
# Go to https://github.com/tallclub/matimo/issues

# 2. If not, create new issue with:
# - Matimo version: (run: npm list matimo)
# - Node.js version: (run: node --version)
# - Steps to reproduce
# - Expected vs actual behavior
# - Error message/stack trace
```

Thank you for helping improve Matimo! 🙏
