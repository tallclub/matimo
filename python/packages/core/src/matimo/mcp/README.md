# Matimo MCP Core Module

Exposes Matimo tools via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), allowing Claude Desktop, Cursor, Windsurf, and other MCP clients to discover and execute tools.

This module mirrors the TypeScript `@matimo/core/mcp` implementation and maintains full parity with the following capabilities:

- **Auth parameter filtering** - prevents secret tokens from appearing in client schemas
- **Secret pre-resolution** - resolves all credentials once at startup, stores in memory
- **Approval gating** - approval-required tools enforce `_matimo_approved` parameter
- **Skill resources** - exposes Matimo skills as MCP resources (`skills://name`)
- **HTTP transport** - Streamable HTTP with bearer-token auth, CORS, health endpoint
- **Stdio transport** - stdio server for Claude Desktop integration

---

## Architecture

### Module Structure

```
matimo/mcp/
├── __init__.py              # Public exports
├── server.py                # MCPServer class + create_mcp_server() factory
├── tool_converter.py        # Parameter schema conversion with auth filtering
└── README.md                # This file
```

### Layers

```
┌──────────────────────────────────────────────────────────────┐
│  MCP Client Layer: Claude Desktop / Cursor / HTTP Client     │
│  Interface: JSON-RPC 2.0 over stdio or HTTP                 │
└────────────────────────┬─────────────────────────────────────┘
                         │ MCP Protocol
┌────────────────────────▼─────────────────────────────────────┐
│  MCPServer: Handlers + Transport                            │
│  • list_tools() → MCP Tool list                             │
│  • call_tool() → execute + return TextContent               │
│  • list_resources() → skills as MCP resources               │
│  • read_resource() → skill markdown content                 │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│  Matimo Core                                                 │
│  execute() → tool executor + policy engine                  │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│  Tool APIs: Slack / GitHub / Gmail / etc.                   │
│  Execution: HTTP, CLI shells, Python callables              │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Auth Parameter Filtering

**File:** `tool_converter.py`

**Problem:** Tool schemas include secrets (API tokens, keys, passwords) - exposing them to clients is a security risk.

**Solution:** Detect auth parameters and strip them from the MCP schema:

```python
_AUTH_PATTERNS = ["token", "key", "secret", "password", "credential", "auth", "bearer"]

def _is_auth_parameter(name: str) -> bool:
    # Convert camelCase to segments: apiKey → ["api", "key"]
    # Split on _ - . and check each segment
    # Prevents false positives: "monkey" ≠ "key", "author" ≠ "auth"
    ...

def convert_parameters_to_mcp_schema(parameters: dict) -> dict:
    for name, param in parameters.items():
        if _is_auth_parameter(name):  # ← Skip auth params
            continue
        properties[name] = ...
    return schema
```

**Security guarantee:** Clients never receive auth parameter definitions; credentials are injected server-side.

---

### 2. Pre-Resolved Secret Storage

**File:** `server.py`

**Problem:** Per-call secret resolution is inefficient (latency + repeated I/O).

**Solution:** Resolve all auth placeholders at startup, store in memory:

```python
class MCPServer:
    def __init__(self, matimo: Matimo, options: MCPServerOptions):
        self._matimo = matimo
        self._resolved_secrets: dict[str, str] = {}  # In-memory cache
    
    async def start(self):
        # Step 1: Load all tools
        all_tools = self._matimo.list_tools()
        filtered = self._filter_tools(all_tools)
        
        # Step 2: Extract & resolve all auth placeholders once
        await self._seed_environment_secrets(filtered)
        
        # Step 3: Start transport with hydrated secrets
        await self._run_stdio(server)  # or _run_http(server)
```

**Flow:**

```
Tool 1: {SLACK_BOT_TOKEN}
Tool 2: {GITHUB_TOKEN}
Tool 3: {SLACK_BOT_TOKEN}  ← duplicate
    ↓
AllPlaceholders = {SLACK_BOT_TOKEN, GITHUB_TOKEN}
    ↓
Resolver: env → .env → Vault → AWS Secrets Manager
    ↓
_resolved_secrets = {
    SLACK_BOT_TOKEN: "xoxb-...",
    GITHUB_TOKEN: "ghp_...",
    MATIMO_SLACK_BOT_TOKEN: "xoxb-...",  ← also with prefix
    MATIMO_GITHUB_TOKEN: "ghp_...",
}
    ↓
_call_tool() injects as credentials=self._resolved_secrets
```

---

### 3. Approval-Required Tools

**File:** `tool_converter.py`, `server.py`

**Problem:** Destructive tools need client confirmation before execution.

**Solution:** Add `_matimo_approved` boolean parameter to tools with `requires_approval=True`:

```python
def tool_to_mcp_registration(tool: ToolDefinition) -> dict:
    schema = convert_parameters_to_mcp_schema(tool.parameters or {})
    
    if tool.requires_approval:
        schema["properties"]["_matimo_approved"] = {
            "type": "boolean",
            "description": "Set to true to confirm execution of this approval-required tool"
        }
    
    return {
        "title": tool.name,
        "description": tool.description,
        "inputSchema": schema,
    }
```

**Execution gate in `_call_tool()`:**

```python
async def _call_tool(self, name: str, arguments: dict) -> list:
    matimo_approved = arguments.get("_matimo_approved", False)
    clean_args = {k: v for k, v in arguments.items() if k != "_matimo_approved"}
    
    tool_def = self._matimo.get_tool(name)
    
    # Reject if approval required but not granted
    if tool_def and tool_def.requires_approval and not matimo_approved:
        return [TextContent(type="text", text="Approval required. Re-invoke with _matimo_approved: true")]
    
    # The client-supplied flag is a confirmation signal only by default.
    result = await self._matimo.execute(name, clean_args, approved=False)
    return [TextContent(type="text", text=json.dumps(result))]
```

Only set `MCPServerOptions(trust_client_approval=True)` when the transport or
embedding application provides a server-trusted approval signal.

---

### 4. Skill Resources

**File:** `server.py`

**Problem:** Skills (context documents) are hidden from MCP clients unless clients know how to call external tools to fetch them.

**Solution:** Register skills as MCP resources so clients can browse them like files:

```python
def _register_skill_resources(self, server: Any) -> None:
    skills = self._matimo.list_skills()
    
    @server.list_resources()  # MCP: resources/list
    async def handle_list_resources() -> list[Resource]:
        return [
            Resource(
                uri=AnyUrl(f"skills://{s.name}"),
                name=s.name,
                description=s.description,
                mimeType="text/markdown"
            )
            for s in skills
        ]
    
    @server.read_resource()  # MCP: resources/read
    async def handle_read_resource(uri: Any) -> str:
        skill_name = str(uri).removeprefix("skills://")
        return self._matimo.get_skill_content(skill_name)
```

**Result:**

- Clients call `resources/list` → see `skills://slack-messaging`, `skills://github-workflows`, etc.
- Clients call `resources/read` with `skills://slack-messaging` → get full markdown content
- No extra tool calls needed; native resource picker in Claude, Cursor, etc.

---

### 5. HTTP Transport with Security

**File:** `server.py`

**Problem:** Old SSE transport lacked session management, bearer auth, and stateless concurrency support.

**Solution:** Use `StreamableHTTPSessionManager` with pure-ASGI handler:

```python
async def _run_http(self, server: Any) -> None:
    from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
    
    mcp_token = self._options.mcp_token
    session_manager = StreamableHTTPSessionManager(server, stateless=True)
    
    async def asgi_app(scope: Any, receive: Any, send: Any) -> None:
        if scope["type"] == "http":
            path = scope.get("path", "")
            method = scope.get("method", "").upper()
            
            # CORS preflight (no auth check)
            if method == "OPTIONS":
                await send_cors_response(204)
                return
            
            # Bearer token auth (except /health)
            if path != "/health" and mcp_token:
                if not check_bearer_token(scope, mcp_token):
                    await send_json_response(401, {"error": "Unauthorized"})
                    return
            
            # Health check
            if path == "/health":
                await send_json_response(200, {"ok": True, "transport": "http"})
                return
            
            # All other paths → MCP session manager
            await session_manager.handle_request(scope, receive, send)
    
    config = uvicorn.Config(
        asgi_app,
        host="0.0.0.0",
        port=self._options.port,
        log_level="info",
        timeout_keep_alive=65,
    )
    uv_server = uvicorn.Server(config)
    await uv_server.serve()
```

**Features:**

- ✅ **Stateless sessions** - each HTTP request is independent
- ✅ **Bearer token auth** - `Authorization: Bearer {token}`
- ✅ **CORS headers** - `Access-Control-Allow-*`
- ✅ **Health endpoint** - `/health` for health checks
- ✅ **Concurrent clients** - true HTTP/stateless, not SSE
- ✅ **Pure ASGI** - no BaseHTTPMiddleware response-buffering issues

---

## Data Flow: Startup to Execution

### Scenario: Start MCP server in stdio mode with 2 Slack tools

```
1. MCPServer(matimo, MCPServerOptions(transport='stdio'))
   ↓
2. await server.start()
   ├─ Suppress logging (clean stdout for JSON-RPC)
   ├─ Import MCP SDK
   ├─ Create MCP Server instance
   ├─ Register @server.list_tools() handler
   ├─ Register @server.call_tool() handler
   ├─ Register @server.list_resources() handler
   ├─ Register @server.read_resource() handler
   ├─ Load all tools: [slack_send_message, slack_post_reaction, ...]
   ├─ Filter by allowlist/denylist: [slack_send_message, slack_post_reaction]
   ├─ Extract auth placeholders: {SLACK_BOT_TOKEN}
   ├─ Resolve via SecretResolverChain: {SLACK_BOT_TOKEN: "xoxb-abc123"}
   ├─ Store in _resolved_secrets
   └─ Connect stdio transport
      ↓
3. Client (Claude Desktop) connects via stdio
   ↓
4. Client calls: tools/list
   ├─ Handler calls _get_mcp_tools()
   ├─ Converts each tool via tool_to_mcp_registration()
   ├─ Strips auth params from inputSchema
   ├─ Returns: [
   │   {
   │     name: "slack_send_message",
   │     description: "Send a message to a Slack channel",
   │     inputSchema: {
   │       type: "object",
   │       properties: {
   │         channel: {type: "string"},
   │         text: {type: "string"}
   │       },
   │       required: ["channel", "text"]
   │       // NOTE: SLACK_BOT_TOKEN is NOT here
   │     }
   │   },
   │   ...
   │ ]
   └─ Client receives tool list
      ↓
5. Client calls: tools/call with {
     name: "slack_send_message",
     arguments: {channel: "#general", text: "Hello"}
   }
   ├─ Handler calls _call_tool("slack_send_message", {...})
   ├─ Checks requires_approval (false for this tool)
   ├─ Gets pre-resolved credentials from _resolved_secrets
   ├─ Calls: matimo.execute(
   │   "slack_send_message",
   │   {channel: "#general", text: "Hello"},
   │   credentials={SLACK_BOT_TOKEN: "xoxb-abc123"},
   │   approved=False
   │ )
   ├─ Matimo injects SLACK_BOT_TOKEN into execution
   ├─ HTTP request to Slack API succeeds
   ├─ Returns: {ok: true, ts: "1234567890.123456"}
   └─ Client receives: TextContent(text: '{"ok": true, "ts": "..."}')
```

---

## Usage: Programmatic Integration

### Stdio Server (Claude Desktop)

```python
from matimo import Matimo
from matimo.mcp.server import MCPServer, MCPServerOptions

async def main():
    # Initialize Matimo
    matimo = await Matimo.init(
        ["./tools"],
        skill_paths=["./skills"],
        auto_discover=True
    )
    
    # Wrap in MCP server
    server = MCPServer(
        matimo,
        MCPServerOptions(
            transport="stdio",
            tools=["slack_*", "github_*"],  # allowlist
            secret_resolver=...  # optional custom resolver
        )
    )
    
    # Start (blocks until Claude Desktop disconnects)
    await server.start()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

### HTTP Server (Remote / Docker)

```python
import asyncio
from matimo.mcp.server import MCPServer, MCPServerOptions

async def main():
    server = MCPServer(
        matimo,
        MCPServerOptions(
            transport="http",
            port=3000,
            mcp_token="secret-bearer-token",  # ← auth
            auto_discover=True
        )
    )
    
    # Blocks until shutdown signal
    await server.start()

asyncio.run(main())
```

### Convenience Factory

```python
from matimo.mcp.server import create_mcp_server

# One-liner: auto-init + wrap in MCP server
server = await create_mcp_server(
    tool_paths=["./tools"],
    options=MCPServerOptions(transport="stdio")
)
```

---

## Configuration Reference

### `MCPServerOptions`

```python
@dataclass
class MCPServerOptions:
    # Transport
    transport: str = "stdio"              # "stdio" or "http"
    port: int = 3100                      # HTTP port (ignored in stdio)
    
    # Tool filtering (supports Unix shell-style wildcard patterns)
    tools: list[str] | None = None        # Allowlist (None = all)
    exclude_tools: list[str] | None = None  # Denylist
    
    # Auth
    secret_resolver: Any | None = None    # SecretResolverChain
    mcp_token: str | None = None          # HTTP Bearer token
    
    # Matimo initialization
    tool_paths: list[str] | None = None
    skill_paths: list[str] | None = None
    auto_discover: bool = False
    
    # Policy / approval
    policy_config: Any | None = None
    untrusted_paths: list[str] | None = None
    approval_secret: str | None = None
    approval_dir: str | None = None
```

#### Tool Filtering with Wildcard Patterns

The `tools` and `exclude_tools` options support **Unix shell-style wildcard patterns**:

```python
# Match patterns
tools = [
    "slack_*",                    # All Slack tools
    "github_create_*",            # All GitHub create_* tools
    "notion_database_*",          # All Notion database tools
    "gmail_send",                 # Exact match (no wildcards)
]

# Exclude patterns
exclude_tools = [
    "*_deprecated",               # Any tool ending with _deprecated
    "test_*",                     # Any test tools
    "internal_*",                 # Any internal tools
]
```

**Pattern syntax:**
- `*` - matches any sequence of characters
- `?` - matches any single character
- `[seq]` - matches any character in `seq`
- `[!seq]` - matches any character not in `seq`

If a tool name matches both `tools` (allowlist) and `exclude_tools` (denylist), it is **excluded** (denylist takes precedence).

---

## Comparison with TypeScript

| Feature | TypeScript | Python | Status |
|---------|-----------|--------|--------|
| Auth param filtering | ✅ `isAuthParameter()` | ✅ `_is_auth_parameter()` | Parity |
| `_matimo_approved` | ✅ `toolToMcpRegistration()` | ✅ `tool_to_mcp_registration()` | Parity |
| Pre-resolved secrets | ✅ `seedEnvironmentSecrets()` | ✅ `_seed_environment_secrets()` | Parity |
| Skill resources | ✅ `registerSkillResources()` | ✅ `_register_skill_resources()` | Parity |
| HTTP transport | ✅ `StreamableHTTPServerTransport` + sessions | ✅ `StreamableHTTPSessionManager` + stateless | Parity |
| Stdio logging suppression | ✅ `logLevel: 'silent'` | ✅ `logging.setLevel(CRITICAL+1)` | Parity |
| Test coverage | 95%+ | 95%+ | Parity |

---

## Testing

### Run MCP tests

```bash
cd python

# All MCP tests (83 tests)
uv run pytest packages/core/tests/unit/test_mcp_* -v

# tool_converter tests
uv run pytest packages/core/tests/unit/test_mcp_tool_converter.py -v

# server tests
uv run pytest packages/core/tests/unit/test_mcp_server.py -v
```

### Key test scenarios

- ✅ Auth parameter detection (camelCase, kebab-case, snake_case)
- ✅ Auth parameters stripped from MCP schema
- ✅ `_matimo_approved` added for approval-required tools
- ✅ Pre-resolved secrets used in `_call_tool()`
- ✅ Secrets fall back to per-call resolution if not pre-resolved
- ✅ Approval gate rejects unapproved calls
- ✅ `_matimo_approved` stripped from tool args
- ✅ Skill resources registered and readable

---

## Security Notes

1. **Credentials never logged** - `_resolved_secrets` is internal; never logged or printed
2. **Auth params stripped from schema** - clients cannot infer secret names
3. **Credentials stored in memory only** - never written to process.env or disk
4. **Secrets per-call injection** - only passed to `matimo.execute()`, not to clients
5. **Bearer token for HTTP** - required in `Authorization` header for HTTP transport
6. **Approval gating** - destructive tools require explicit `_matimo_approved=true`, then server-side approval still applies by default

---

## Troubleshooting

### Issue: "MCP Python SDK not installed"

**Error:** `MatimoError(EXECUTION_FAILED): MCP Python SDK not installed...`

**Solution:**

```bash
pip install matimo[mcp]
# or
pip install mcp>=1.0
```

### Issue: "Auth token mismatch" in HTTP mode

**Error:** `401 Unauthorized`

**Solution:**

```bash
export MATIMO_MCP_TOKEN="your-secret-token"
# or pass to MCPServerOptions(mcp_token="...")
```

### Issue: Stdio mode corrupt output

**Error:** JSON-RPC parse errors, malformed messages

**Cause:** Logging to stdout interferes with JSON-RPC protocol

**Solution:** Already fixed - `start()` suppresses matimo logger in stdio mode

---

## Related Documentation

- [Matimo MCP Overview](../../docs/MCP.md)
- [Matimo Core Architecture](../../docs/architecture/)
- [Auth & Secret Management](../../docs/user-guide/secrets.md)
- [Tool Development Guide](../../docs/tool-development/)
- [MCP Specification](https://modelcontextprotocol.io/)
