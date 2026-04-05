"""
``matimo search`` — search for available Matimo tool packages.

Mirrors: packages/cli/src/commands/search.ts
"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml


def search_command(query: str) -> None:
    if not query:
        print("❌ Error: Please specify a search query", file=sys.stderr)
        print("\nUsage: matimo search <query>")
        print("Example: matimo search slack")
        sys.exit(1)

    # Try to find packages in the repo first, then fall back to installed
    repo_root = _find_repo_root(Path.cwd())
    available: list[dict[str, object]] = []
    context: str

    if repo_root is not None:
        packages_dir = repo_root / "python" / "providers"
        if packages_dir.is_dir():
            context = "repository"
            available = _scan_directory(packages_dir)
        else:
            packages_dir = repo_root / "packages"
            if packages_dir.is_dir():
                context = "repository"
                available = _scan_directory(packages_dir, skip={"core", "cli"})
            else:
                context = "installed"
                available = _scan_installed()
    else:
        context = "installed"
        available = _scan_installed()

    if not available:
        print("❌ No Matimo packages found.", file=sys.stderr)
        print("Install packages: pip install matimo-slack")
        sys.exit(1)

    q = query.lower()
    results = [
        p
        for p in available
        if q in str(p["name"]).lower() or q in str(p.get("description", "")).lower()
    ]

    if not results:
        print(f'❌ No packages found matching "{query}"')
        print(f"\n📦 Available Packages (from {context}):")
        for p in available:
            print(f"  • {p['name']} ({p['tools']} tools)")
        return

    print(f'🔍 Search results for "{query}" ({context}):\n')
    for p in results:
        print(f"✅ {p['name']}")
        print(f"   {p.get('description', '')}")
        print(f"   Tools: {p['tools']}")
        if context == "installed":
            print("   Already installed")
        else:
            name_part = str(p["name"]).replace("matimo-", "")
            print(f"   Install: matimo install {name_part}")
        print()

    print(f"Total: {len(results)} package{'s' if len(results) != 1 else ''} found")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _find_repo_root(start: Path) -> Path | None:
    current = start
    while current != current.parent:
        if (current / "pnpm-workspace.yaml").is_file() or (current / "pyproject.toml").is_file():
            if (current / "python").is_dir() or (current / "packages").is_dir():
                return current
        current = current.parent
    return None


def _scan_directory(
    packages_dir: Path,
    skip: set[str] | None = None,
) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    skip = skip or set()

    for entry in sorted(packages_dir.iterdir()):
        if not entry.is_dir() or entry.name in skip or entry.name.startswith("."):
            continue

        tools_dir = entry / "tools"
        tool_count = 0
        if tools_dir.is_dir():
            tool_count = sum(1 for t in tools_dir.iterdir() if t.is_dir())

        # Try to extract description from pyproject.toml
        desc = ""
        pyproject = entry / "pyproject.toml"
        if pyproject.is_file():
            try:
                import tomllib

                data = tomllib.loads(pyproject.read_text(encoding="utf-8"))
                desc = data.get("project", {}).get("description", "")
            except Exception:
                pass

        name = entry.name
        results.append({"name": name, "description": desc, "tools": tool_count})

    return results


def _scan_installed() -> list[dict[str, object]]:
    import importlib.metadata

    results: list[dict[str, object]] = []
    for dist in importlib.metadata.distributions():
        pkg_name = dist.metadata["Name"]
        if pkg_name and pkg_name.startswith("matimo-") and pkg_name != "matimo-cli":
            results.append(
                {
                    "name": pkg_name,
                    "description": dist.metadata.get("Summary", ""),
                    "tools": 0,
                }
            )
    return results
