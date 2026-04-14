#!/usr/bin/env python3
"""Test script to verify MCP tool listing."""
import json
import sys
import asyncio
import site
import os
from matimo import Matimo
from matimo.mcp.server import MCPServer, MCPServerOptions

async def main():
    workspace_root = '/Users/sajesh/My Work Directory/matimo'
    extra_tools = os.path.join(workspace_root, 'typescript/examples/mcp/matimo-tools')
    
    matimo = await Matimo.init(
        tool_paths=site.getsitepackages() + [extra_tools],
        auto_discover=True
    )
    
    server_opts = MCPServerOptions(transport='stdio')
    mcp_server = MCPServer(matimo, server_opts)
    
    # Manually call the list_tools handler
    tools = mcp_server._get_mcp_tools()
    
    print(f'\n✓ Total tools: {len(tools)}', file=sys.stderr)
    
    # Check for pg_ tools
    pg_tools = [t for t in tools if t.name.startswith('pg_')]
    print(f'✓ PG tools: {len(pg_tools)}', file=sys.stderr)
    
    #Check first few tools
    if tools:
        for i, tool in enumerate(tools[:3]):
            print(f'\nTool {i+1}: {tool.name}', file=sys.stderr)
            print(f'  Description: {tool.description[:50] if tool.description else "None"}', file=sys.stderr)
            print(f'  InputSchema: {bool(tool.inputSchema)}', file=sys.stderr)
    
    # Try to format as JSON to check for serialization issues
    try:
        tool_dicts = [t.model_dump() for t in tools]
        json_str = json.dumps({'tools': tool_dicts[:1]}, indent=2)  # Just first tool
        print('\n✓ JSON serialization OK (sample):', file=sys.stderr)
        print(json_str[:200], file=sys.stderr)
    except Exception as e:
        print(f'\n✗ JSON serialization error: {e}', file=sys.stderr)

if __name__ == '__main__':
    asyncio.run(main())
