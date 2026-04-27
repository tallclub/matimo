"""Matimo Bruno provider - API testing tools via Bruno CLI."""


def get_tools_path() -> str:
    """Return path to tools directory for Matimo discovery."""
    from pathlib import Path
    return str(Path(__file__).parent / "tools")
