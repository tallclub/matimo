"""
Matimo CLI — main command router.

Mirrors: packages/cli/src/cli.ts

Usage::

    matimo install slack gmail
    matimo list
    matimo search slack
    matimo mcp
    matimo mcp setup
    matimo doctor
    matimo review list
"""
from __future__ import annotations

import sys

from matimo_cli.commands.doctor import doctor_command
from matimo_cli.commands.install import install_command
from matimo_cli.commands.list_cmd import list_command
from matimo_cli.commands.mcp import mcp_command
from matimo_cli.commands.review import review_command
from matimo_cli.commands.search import search_command

_VERSION = "0.1.0"  # also update in setup.py and pyproject.toml

_HELP = f"""\
🔨 Matimo CLI — Tool Package Manager  (v{_VERSION})

Usage: matimo [command] [options]

Commands:
  install <tools...>    Install tool packages (pip install matimo-<name>)
  list                  List installed Matimo tool packages
  search <query>        Search for available tools
  mcp                   Start MCP server (Model Context Protocol)
  mcp setup             Generate config for Claude Desktop / Cursor
  doctor                Diagnose your Matimo setup
  review                Review agent-created tools awaiting approval
  help                  Show this help message
  version               Show version information

Examples:
  matimo install slack gmail
  matimo list
  matimo search email
  matimo mcp
  matimo mcp --transport http --port 3000
  matimo mcp setup
  matimo doctor
  matimo review list
  matimo review approve my_tool

Documentation: https://github.com/tallclub/matimo#readme
"""


def main(cli_args: list[str] | None = None) -> None:
    """Main CLI handler — parses commands and routes to handlers."""
    args = cli_args if cli_args is not None else sys.argv[1:]
    command = args[0] if args else None
    params = args[1:] if args else []

    if not command:
        print(_HELP)
        return

    try:
        match command.lower():
            case "install":
                install_command(params)
            case "list":
                list_command()
            case "search":
                search_command(params[0] if params else "")
            case "mcp":
                mcp_command(params)
            case "doctor":
                doctor_command()
            case "review":
                review_command(params)
            case "help" | "-h" | "--help":
                print(_HELP)
            case "version" | "-v" | "--version":
                print(f"matimo-cli v{_VERSION}")
            case _:
                print(f"❌ Unknown command: {command}", file=sys.stderr)
                print('\nRun "matimo help" for available commands')
                sys.exit(1)
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(130)
    except Exception as exc:
        print(f"❌ Error: {exc}", file=sys.stderr)
        sys.exit(1)
