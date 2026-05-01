from pathlib import Path
import asyncio
import os
import sysconfig
import socket
from matimo import Matimo
from matimo.mcp.server import MCPServer, MCPServerOptions


def _is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Return True if the TCP port is already in use on the given host.

    This attempts to bind the socket — if binding fails the port is taken.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return True
    return False


async def main():
    # Ensure we run from the correct directory to discover tools/skills
    # (server script is in src/, but tools are in parent mcp/)
    script_dir = Path(__file__).parent
    examples_mcp_dir = script_dir.parent
    import os
    os.chdir(examples_mcp_dir)
    
    # ── Tool paths: discover matimo provider packages efficiently ──────────────
    # Scan site-packages for matimo_* packages, adding only their tools/ subdirectories.
    # This is much faster than passing the entire site-packages tree to Matimo.
    tool_paths: list[str] = []
    
    # Scan purelib (site-packages) for matimo_* provider packages
    purelib = sysconfig.get_path("purelib")
    if purelib and os.path.exists(purelib):
        for entry in os.listdir(purelib):
            # Match matimo_* packages, exclude .dist-info
            if entry.startswith("matimo_") and not entry.endswith(".dist-info"):
                pkg_tools = os.path.join(purelib, entry, "tools")
                if os.path.exists(pkg_tools):
                    tool_paths.append(pkg_tools)
    
    # Allow optional extra tools directory via environment variable
    extra_tools = os.environ.get("MATIMO_EXTRA_TOOLS_PATH")
    if extra_tools:
        tool_paths.append(extra_tools)

    # Port can be configured via MATIMO_SERVER_PORT; default to 3101
    port = int(os.environ.get("MATIMO_SERVER_PORT", "3101"))
    if _is_port_in_use(port):
        raise RuntimeError(
            f"Port {port} is already in use. Stop the process using it before starting the server, or set MATIMO_SERVER_PORT to a free port."
        )

    # Load tools including from site-packages of the current environment
    matimo = await Matimo.init(
        tool_paths=tool_paths,
        auto_discover=True,
    )

    # Start HTTP server on the configured port
    server = MCPServer(
        matimo,
        MCPServerOptions(
            transport="http",
            port=port,
        ),
    )

    await server.start()


if __name__ == "__main__":
    asyncio.run(main())
