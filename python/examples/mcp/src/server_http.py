import asyncio
import os
import site
from matimo import Matimo
from matimo.mcp.server import MCPServer, MCPServerOptions

async def main():
    # ── Tool paths: auto-discover installed matimo_* packages ─────────────────
    # In an independent project, Matimo looks in site-packages/matimo_*/tools
    workspace_root = "/Users/sajesh/My Work Directory/matimo"
    extra_tools = os.path.join(workspace_root, "typescript/examples/mcp/matimo-tools")
    
    # Simple port cleanup: kill anything on port 3100 before starting
    import subprocess
    try:
        subprocess.run("lsof -t -i:3100 | xargs kill -9", shell=True, stderr=subprocess.DEVNULL)
    except Exception:
        pass

    # Load tools including from site-packages of the current environment
    matimo = await Matimo.init(
        tool_paths=site.getsitepackages() + [extra_tools], 
        auto_discover=True
    )
    
    # Start HTTP server on port 3100
    server = MCPServer(
        matimo,
        MCPServerOptions(
            transport="http",
            port=3100
        )
    )
    
    # print("Starting Matimo HTTP/SSE MCP Server on http://localhost:3100")
    # print("Endpoints:")
    # print("  - SSE:  http://localhost:3100/sse")
    # print("  - POST: http://localhost:3100/messages")
    
    await server.start()

if __name__ == "__main__":
    asyncio.run(main())
