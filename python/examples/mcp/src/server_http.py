import asyncio
import os
import site
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
    # ── Tool paths: auto-discover installed matimo_* packages ─────────────────
    # By default Matimo will discover tools from site-packages (matimo_* packages).
    # Allow an optional extra path via the MATIMO_EXTRA_TOOLS_PATH environment variable.
    extra_tools = os.environ.get("MATIMO_EXTRA_TOOLS_PATH")
    tool_paths = list(site.getsitepackages())
    if extra_tools:
        tool_paths.append(extra_tools)

    # Port can be configured via MATIMO_SERVER_PORT; default to 3100
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
