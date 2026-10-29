"""Optional filesystem confinement for the built-in file tools.

Set MATIMO_FILE_ROOTS to an os.pathsep separated list of directories and the file
tools (read, edit, search, convert_to_file, extract_from_file) refuse any path whose
real location, after resolving symlinks, is outside every root. Unset (the default)
keeps the previous behaviour: no confinement.

Mirrors: packages/core/src/policy/file-roots.ts
"""
from __future__ import annotations

import os
from pathlib import Path

from matimo.errors import ErrorCode, MatimoError

FILE_ROOTS_ENV = "MATIMO_FILE_ROOTS"


def get_file_roots() -> list[Path] | None:
    """The configured roots (symlinks resolved), or None when confinement is off."""
    raw = os.environ.get(FILE_ROOTS_ENV, "")
    roots = [Path(entry.strip()).resolve() for entry in raw.split(os.pathsep) if entry.strip()]
    return roots or None


def enforce_file_roots(resolved: Path) -> Path:
    """Return `resolved` unchanged, or raise POLICY_DENIED if it is outside the roots.

    `resolved` must already be absolute and symlink-resolved (Path.resolve()).
    """
    roots = get_file_roots()
    if roots is None:
        return resolved
    if not any(resolved == root or root in resolved.parents for root in roots):
        raise MatimoError(
            f"Path is outside the allowed file roots ({FILE_ROOTS_ENV})",
            ErrorCode.POLICY_DENIED,
            {"path": str(resolved)},
        )
    return resolved
