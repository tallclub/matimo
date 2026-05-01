"""
MCP (Model Context Protocol) server for Matimo.
Mirrors: packages/core/src/mcp/mcp-server.ts

Exposes Matimo tools over the MCP protocol so Claude and other MCP-compatible
clients can discover and call them.

Dependencies: mcp>=1.0  (install with: pip install matimo[mcp])
"""
from __future__ import annotations

import fnmatch
import json as _json
import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from matimo.errors import ErrorCode, MatimoError

if TYPE_CHECKING:
    from matimo.instance import Matimo

logger = logging.getLogger("matimo")


@dataclass
class MCPServerOptions:
    """
    Configuration for the MCP server.
    Mirrors: MCPServerOptions in mcp-server.ts
    """

    # Transport: 'stdio' (default for Claude Desktop) or 'http'
    transport: str = "stdio"
    port: int = 3100

    # Tool filtering
    tools: list[str] | None = None          # allowlist; None = all
    exclude_tools: list[str] | None = None  # denylist

    # Secret resolution
    secret_resolver: Any | None = None      # SecretResolverChain instance

    # HTTP mode auth token (Bearer)
    mcp_token: str | None = None

    # Matimo instance paths (if creating the server standalone)
    tool_paths: list[str] | None = None
    skill_paths: list[str] | None = None
    auto_discover: bool = False

    # Policy / approval
    policy_config: Any | None = None
    untrusted_paths: list[str] | None = None
    approval_secret: str | None = None
    approval_dir: str | None = None
    # Trust _matimo_approved from MCP tool-call arguments as an out-of-band
    # approval. Defaults to False because MCP arguments are supplied by the
    # client/model and are not a server-side approval signal by themselves.
    trust_client_approval: bool = False


class MCPServer:
    """
    Wraps a Matimo instance and exposes its tools via the MCP protocol.

    Usage:
        matimo = await Matimo.init('./tools')
        server = MCPServer(matimo, MCPServerOptions(transport='stdio'))
        await server.start()

    Requires: pip install matimo[mcp]
    """

    def __init__(
        self,
        matimo: Matimo,
        options: MCPServerOptions | None = None,
    ) -> None:
        self._matimo = matimo
        self._options = options or MCPServerOptions()
        self._server: Any = None
        # Resolved auth secrets held in memory — never written to process.env.
        # Populated by _seed_environment_secrets() during start().
        self._resolved_secrets: dict[str, str] = {}

    async def start(self) -> None:
        """Start the MCP server on the configured transport."""
        # Suppress logging in stdio mode — JSON-RPC protocol requires clean stdout/stderr.
        # Mirrors the TypeScript behaviour: setGlobalMatimoLogger(createLogger({ logLevel: 'silent' }))
        if self._options.transport == "stdio":
            logging.getLogger("matimo").setLevel(logging.CRITICAL + 1)

        try:
            import mcp.types as mcp_types  # type: ignore[import]
            from mcp.server import Server  # type: ignore[import]
            from mcp.server.models import InitializationOptions  # type: ignore[import]  # noqa: F401
        except ImportError as exc:
            raise MatimoError(
                "MCP Python SDK not installed. Install with: pip install matimo[mcp]",
                ErrorCode.EXECUTION_FAILED,
            ) from exc

        server = Server("matimo")
        self._server = server

        # Register tools/list handler
        @server.list_tools()  # type: ignore[misc]
        async def handle_list_tools() -> list[mcp_types.Tool]:
            return self._get_mcp_tools()

        # Register tools/call handler
        @server.call_tool()  # type: ignore[misc]
        async def handle_call_tool(
            name: str, arguments: dict[str, Any]
        ) -> list[mcp_types.TextContent]:
            return await self._call_tool(name, arguments)

        # Register skill resources (skills://name) so MCP clients can read them.
        # Mirrors registerSkillResources() in mcp-server.ts.
        self._register_skill_resources(server)

        # Pre-resolve all auth secrets once at startup.
        # Mirrors seedEnvironmentSecrets() in mcp-server.ts.
        all_tools = self._matimo.list_tools()
        filtered = self._filter_tools(all_tools)
        await self._seed_environment_secrets(filtered)

        if self._options.transport == "stdio":
            await self._run_stdio(server)
        else:
            await self._run_http(server)

    async def _run_stdio(self, server: Any) -> None:  # noqa: ANN401
        """Run as stdio MCP server (for Claude Desktop integration).

        server: Any because the MCP Server type is from an optional dependency (mcp).
        """
        from mcp.server import NotificationOptions  # type: ignore[import]
        from mcp.server.models import InitializationOptions  # type: ignore[import]
        from mcp.server.stdio import stdio_server  # type: ignore[import]

        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="matimo",
                    server_version="0.1.0",
                    capabilities=server.get_capabilities(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                ),
            )

    async def _run_http(self, server: Any) -> None:  # noqa: ANN401
        """Run as Streamable HTTP MCP server transport with bearer-token auth.

        server: Any because the MCP Server type is from an optional dependency (mcp).

        Mirrors connectHttp() + bearer-token auth in mcp-server.ts.
        """
        import uvicorn
        from mcp.server.streamable_http_manager import (  # type: ignore[import]
            StreamableHTTPSessionManager,
        )

        mcp_token = self._options.mcp_token
        session_manager = StreamableHTTPSessionManager(server, stateless=True)

        # Pure-ASGI handler: no Starlette required for the routing layer, which
        # avoids BaseHTTPMiddleware's response-buffering issue with SSE streams.
        async def asgi_app(scope: Any, receive: Any, send: Any) -> None:  # noqa: ANN401
            if scope["type"] == "lifespan":
                msg = await receive()
                if msg["type"] == "lifespan.startup":
                    ctx = session_manager.run()
                    scope["_matimo_sm_ctx"] = ctx
                    await ctx.__aenter__()
                    await send({"type": "lifespan.startup.complete"})
                    await receive()  # wait for lifespan.shutdown
                    await ctx.__aexit__(None, None, None)
                    await send({"type": "lifespan.shutdown.complete"})
                return

            if scope["type"] != "http":
                return

            path: str = scope.get("path", "")
            method: str = scope.get("method", "").upper()

            # CORS preflight — respond without auth check
            if method == "OPTIONS":
                await send({
                    "type": "http.response.start",
                    "status": 204,
                    "headers": [
                        (b"access-control-allow-origin", b"*"),
                        (b"access-control-allow-methods", b"GET, POST, DELETE, OPTIONS"),
                        (b"access-control-allow-headers",
                         b"Content-Type, Authorization, Mcp-Session-Id"),
                        (b"access-control-max-age", b"86400"),
                    ],
                })
                await send({"type": "http.response.body", "body": b"", "more_body": False})
                return

            # Bearer token auth (health endpoint is exempt)
            if path != "/health" and mcp_token:
                headers = {
                    k.lower(): v.decode("latin-1")
                    for k, v in scope.get("headers", [])
                }
                auth = headers.get("authorization", "")
                if auth != f"Bearer {mcp_token}":
                    body = _json.dumps({"error": "Unauthorized"}).encode()
                    await send({
                        "type": "http.response.start",
                        "status": 401,
                        "headers": [
                            (b"content-type", b"application/json"),
                            (b"content-length", str(len(body)).encode()),
                            (b"access-control-allow-origin", b"*"),
                        ],
                    })
                    await send({"type": "http.response.body", "body": body, "more_body": False})
                    return

            # Health check endpoint
            if path == "/health":
                body = _json.dumps({"ok": True, "transport": "http"}).encode()
                await send({
                    "type": "http.response.start",
                    "status": 200,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"access-control-allow-origin", b"*"),
                    ],
                })
                await send({"type": "http.response.body", "body": body, "more_body": False})
                return

            # All other requests — forward to MCP session manager
            await session_manager.handle_request(scope, receive, send)

        config = uvicorn.Config(
            asgi_app,
            host="0.0.0.0",  # noqa: S104
            port=self._options.port,
            log_level="info",
            timeout_keep_alive=65,
        )
        uv_server = uvicorn.Server(config)
        await uv_server.serve()

    def _get_mcp_tools(self) -> list[Any]:
        """Convert Matimo tools to MCP Tool objects, filtering auth parameters."""
        try:
            import mcp.types as mcp_types  # type: ignore[import]
        except ImportError:
            return []

        all_tools = self._matimo.list_tools()
        allowed = self._filter_tools(all_tools)

        mcp_tools = []
        for tool in allowed:
            from matimo.mcp.tool_converter import tool_to_mcp_registration
            registration = tool_to_mcp_registration(tool)
            mcp_tools.append(
                mcp_types.Tool(
                    name=tool.name,
                    description=registration["description"],
                    inputSchema=registration["inputSchema"],
                )
            )

        return mcp_tools

    async def _call_tool(
        self, name: str, arguments: dict[str, Any]
    ) -> list[Any]:
        """Execute a Matimo tool and return MCP TextContent.

        Handles _matimo_approved for approval-required tools, mirrors
        the TypeScript _callTool() in mcp-server.ts.
        """
        try:
            import mcp.types as mcp_types  # type: ignore[import]
        except ImportError:
            return []

        # Extract _matimo_approved before forwarding to execute. By default this
        # client-supplied flag is only a confirmation prompt signal; it must not
        # bypass server-side approval checks.
        matimo_approved: object = arguments.get("_matimo_approved", False)
        clean_args = {k: v for k, v in arguments.items() if k != "_matimo_approved"}

        # Get tool definition once — used for approval check and fallback secrets.
        tool_def = self._matimo.get_tool(name)

        # Approval gate: rejection mirrors TypeScript behaviour (throw before execute)
        if tool_def and getattr(tool_def, "requires_approval", False) and not matimo_approved:
            msg = (
                f"Tool '{name}' requires approval. This is a destructive operation. "
                "Re-invoke with parameter _matimo_approved: true to confirm execution."
            )
            return [mcp_types.TextContent(type="text", text=msg)]

        # Credentials: prefer pre-resolved secrets from startup (_seed_environment_secrets).
        # Fall back to per-call resolution for backward-compat / direct calls (e.g. tests).
        credentials: dict[str, str] = dict(self._resolved_secrets)
        if not credentials and self._options.secret_resolver is not None and tool_def:
            from matimo.auth.injection import extract_parameter_placeholders
            placeholders = extract_parameter_placeholders(tool_def)
            if placeholders:
                credentials = await self._options.secret_resolver.resolve_all(
                    list(placeholders)
                )

        try:
            result = await self._matimo.execute(
                name,
                clean_args,
                credentials=credentials or None,
                approved=(
                    self._options.trust_client_approval
                    and bool(tool_def and getattr(tool_def, "requires_approval", False))
                    and matimo_approved is True
                ),
            )
            output = _json.dumps(result, indent=2, default=str)
            return [mcp_types.TextContent(type="text", text=output)]
        except MatimoError as exc:
            return [mcp_types.TextContent(
                type="text",
                text=f"Error: {exc.code.value} — {exc}",
            )]

    async def _seed_environment_secrets(self, tools: list[Any]) -> None:
        """Resolve all auth placeholders for the filtered tool list at startup.

        Resolved secrets are stored in ``self._resolved_secrets`` (never in
        process.env) and injected as per-call credentials in _call_tool().

        Mirrors seedEnvironmentSecrets() in mcp-server.ts.
        """
        if self._options.secret_resolver is None:
            return

        from matimo.auth.injection import extract_parameter_placeholders

        all_placeholders: set[str] = set()
        for tool in tools:
            all_placeholders.update(extract_parameter_placeholders(tool))

        if not all_placeholders:
            return

        resolved = await self._options.secret_resolver.resolve_all(list(all_placeholders))
        for key, value in resolved.items():
            self._resolved_secrets[key] = value
            # Also store with MATIMO_ prefix for env-var compatibility
            self._resolved_secrets[f"MATIMO_{key}"] = value

    def _register_skill_resources(self, server: Any) -> None:  # noqa: ANN401
        """Register Matimo skills as MCP resources (skills://name).

        Mirrors registerSkillResources() in mcp-server.ts, allowing MCP clients
        (Claude Desktop, Cursor, etc.) to attach skill context from the resource
        picker without extra tool calls.

        server: Any because the MCP Server type is from an optional dependency (mcp).
        """
        try:
            import mcp.types as mcp_types  # type: ignore[import]
        except ImportError:
            return

        skills = self._matimo.list_skills()
        if not skills:
            return

        @server.list_resources()  # type: ignore[misc]
        async def handle_list_resources() -> list[mcp_types.Resource]:
            from pydantic import AnyUrl  # type: ignore[import]
            return [
                mcp_types.Resource(
                    uri=AnyUrl(f"skills://{s.name}"),
                    name=s.name,
                    description=getattr(s, "description", None),
                    mimeType="text/markdown",
                )
                for s in skills
            ]

        @server.read_resource()  # type: ignore[misc]
        async def handle_read_resource(uri: Any) -> str:  # noqa: ANN401
            skill_name = str(uri).removeprefix("skills://")
            content = self._matimo.get_skill_content(skill_name)
            return content or f'Skill "{skill_name}" content unavailable'

    def _filter_tools(self, tools: list[Any]) -> list[Any]:
        """
        Filter tools by allowlist and denylist, supporting Unix shell-style wildcard patterns.
        
        Patterns:
        - '*' matches any sequence of characters (e.g., 'slack_*' matches all slack tools)
        - '?' matches any single character
        - '[seq]' matches any character in seq
        - '[!seq]' matches any character not in seq
        
        Examples:
            tools=['slack_*', 'github_create_issue']  # exact names + patterns
            exclude_tools=['*_deprecated', 'test_*']
        """
        opts = self._options
        
        if opts.tools:
            filtered = []
            for t in tools:
                for pattern in opts.tools:
                    if fnmatch.fnmatch(t.name, pattern):
                        filtered.append(t)
                        break
            tools = filtered
        
        if opts.exclude_tools:
            filtered = []
            for t in tools:
                excluded = False
                for pattern in opts.exclude_tools:
                    if fnmatch.fnmatch(t.name, pattern):
                        excluded = True
                        break
                if not excluded:
                    filtered.append(t)
            tools = filtered
        
        return tools


async def create_mcp_server(
    tool_paths: list[str] | None = None,
    options: MCPServerOptions | None = None,
) -> MCPServer:
    """
    Convenience factory: initialise a Matimo instance and wrap it in an MCPServer.

    Usage:
        server = await create_mcp_server(['./tools'])
        await server.start()
    """
    from matimo.instance import Matimo

    opts = options or MCPServerOptions()
    paths = tool_paths or opts.tool_paths or []
    matimo = await Matimo.init(
        paths,
        auto_discover=opts.auto_discover,
        policy_config=opts.policy_config,
    )
    return MCPServer(matimo, opts)
