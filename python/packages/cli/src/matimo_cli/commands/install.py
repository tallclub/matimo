"""
``matimo install`` — install Matimo tool packages via pip.

Mirrors: packages/cli/src/commands/install.ts
"""
from __future__ import annotations

import subprocess
import sys


def install_command(tool_names: list[str]) -> None:
    if not tool_names:
        print("❌ Error: Please specify at least one tool to install", file=sys.stderr)
        print("\nUsage: matimo install [tool1] [tool2] …")
        print("Example: matimo install slack gmail stripe")
        sys.exit(1)

    packages = [f"matimo-{name}" for name in tool_names]

    print(f"📦 Installing {', '.join(packages)}…")

    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", *packages],
            stdout=sys.stdout,
            stderr=sys.stderr,
        )
    except subprocess.CalledProcessError:
        print("❌ Installation failed.", file=sys.stderr)
        sys.exit(1)

    print("\n✅ Installation complete!")
    print("\nNext steps:")
    print("  from matimo import Matimo")
    print("  matimo = await Matimo.init(auto_discover=True)")
    print("\n📖 For more info: https://github.com/tallclub/matimo#readme")
