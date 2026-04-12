"""
``matimo list`` — list installed Matimo tool packages.

Mirrors: packages/cli/src/commands/list.ts
"""
from __future__ import annotations

import importlib.metadata
import sys


def list_command() -> None:
    """List all installed matimo-* packages."""
    try:
        packages = [
            dist
            for dist in importlib.metadata.distributions()
            if dist.metadata["Name"]
            and dist.metadata["Name"].startswith("matimo-")
            and dist.metadata["Name"] != "matimo-cli"
        ]

        if not packages:
            print("⚠️  No Matimo tool packages installed yet")
            print("\nInstall some tools:")
            print("  matimo install slack gmail")
            return

        print("📦 Installed Matimo Packages:\n")

        for dist in sorted(packages, key=lambda d: d.metadata["Name"]):
            name = dist.metadata["Name"]
            version = dist.metadata["Version"]
            summary = dist.metadata.get("Summary", "")
            print(f"  📍 {name}  (v{version})")
            if summary:
                print(f"     {summary}")
            print()

        print(f"Total: {len(packages)} package{'s' if len(packages) != 1 else ''} installed")

    except Exception as exc:
        print(f"❌ Error listing tools: {exc}", file=sys.stderr)
        sys.exit(1)
