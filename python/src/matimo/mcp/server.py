"""
MCP (Model Context Protocol) server for Matimo.
Mirrors: packages/core/src/mcp/mcp-server.ts

Exposes Matimo tools over the MCP protocol so Claude and other MCP-compatible
clients can discover and call them.

Dependencies: mcp>=1.0  (install with: pip install matimo[mcp])
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from matimo.errors import ErrorCode, MatimoError

if TYPE_CHECKING:
    from matimo.instance import Matimo
    from matimo.mcp.secrets import SecretResolverChain

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

    async def start(self) -> None:
        """Start the MCP server on the configured transport."""
        try:
            from mcp.server import Server  # type: ignore[import]
            from mcp.server.models import InitializationOptions  # type: ignore[import]
            import mcp.types as mcp_types  # type: ignore[import]
        except ImportError:
            raise MatimoError(
                "MCP Python SDK not installed. Install with: pip install matimo[mcp]",
                ErrorCode.EXECUTION_FAILED,
            )

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

        if self._options.transport == "stdio":
            await self._run_stdio(server)
        else:
            await self._run_http(server)

    async def _run_stdio(self, server: Any) -> None:
        """Run as stdio MCP server (for Claude Desktop integration)."""
        from mcp.server.stdio import stdio_server  # type: ignore[import]
        from mcp.server.models import InitializationOptions  # type: ignore[import]
        import mcp.types as mcp_types  # type: ignore[import]

        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="matimo",
                    server_version="0.1.0",
                    capabilities=server.get_capabilities(
                        notification_options=mcp_types.NotificationOptions(),
                        experimental_capabilities={},
                    ),
                ),
            )

    async def _run_http(self, server: Any) -> None:
        """Run as HTTP MCP server (future: SSE transport)."""
        raise MatimoError(
            "HTTP transport is not yet implemented for the Python MCP server",
            ErrorCode.EXECUTION_FAILED,
        )

    def _get_mcp_tools(self) -> list[Any]:
        """Convert Matimo tools to MCP Tool objects."""
        try:
            import mcp.types as mcp_types  # type: ignore[import]
        except ImportError:
            return []

        all_tools = self._matimo.list_tools()
        allowed = self._filter_tools(all_tools)

        mcp_tools = []
        for tool in allowed:
            from matimo.mcp.tool_converter import convert_parameters_to_mcp_schema
            input_schema = convert_parameters_to_mcp_schema(tool.parameters or {})
            mcp_tools.append(
                mcp_types.Tool(
                    name=tool.name,
                    description=tool.description,
                    inputSchema=input_schema,
                )
            )
        return mcp_tools

    async def _call_tool(
        self, name: str, arguments: dict[str, Any]
    ) -> list[Any]:
        """Execute a Matimo tool and return MCP TextContent."""
        try:
            import mcp.types as mcp_types  # type: ignore[import]
        except ImportError:
            return []

        # Resolve secrets if a resolver chain is configured
        credentials: dict[str, str] = {}
        if self._options.secret_resolver is not None:
            tool = self._matimo.get_tool(name)
            if tool:
                from matimo.auth.injection import extract_parameter_placeholders
                placeholders = extract_parameter_placeholders(tool)
                credentials = await self._options.secret_resolver.resolve_all(
                    list(placeholders)
                )

        try:
            result = await self._matimo.execute(name, arguments, credentials=credentials)
            import json
            output = json.dumps(result, indent=2, default=str)
            return [mcp_types.TextContent(type="text", text=output)]
        except MatimoError as exc:
            return [mcp_types.TextContent(
                type="text",
                text=f"Error: {exc.code.value} — {exc}",
            )]

    def _filter_tools(self, tools: list[Any]) -> list[Any]:
        opts = self._options
        if opts.tools:
            tools = [t for t in tools if t.name in opts.tools]
        if opts.exclude_tools:
            tools = [t for t in tools if t.name not in opts.exclude_tools]
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
