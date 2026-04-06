"""Matimo hubspot provider — exposes the path to YAML tool definitions."""
from __future__ import annotations

import importlib.resources
from pathlib import Path


def get_tools_path() -> str:
    """Return the absolute path to the bundled hubspot tool definitions."""
    try:
        ref = importlib.resources.files("matimo_hubspot") / "tools"
        return str(ref)
    except Exception:
        return str(Path(__file__).parent / "tools")


__all__ = ["get_tools_path"]
