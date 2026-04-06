#!/usr/bin/env python3
"""
Validate all YAML tool definitions in python/packages/.
Mirrors: typescript/scripts/validate-tool.ts
"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml
from pydantic import ValidationError

# Add core src to path so we can import matimo models
REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT / "packages" / "core" / "src"))

from matimo.core.models import ProviderDefinition, ToolDefinition  # noqa: E402

PACKAGES_DIR = REPO_ROOT / "packages"

valid = 0
invalid = 0
skipped = 0


def validate_file(path: Path) -> bool:
    """Validate a single definition.yaml and print the result."""
    global valid, invalid
    try:
        raw = yaml.safe_load(path.read_text())
        if not isinstance(raw, dict):
            raise ValueError("YAML root must be a mapping")

        if raw.get("type") == "provider":
            ProviderDefinition.model_validate(raw)
            label = "provider"
        else:
            ToolDefinition.model_validate(raw)
            label = "tool"

        rel = path.relative_to(REPO_ROOT)
        print(f"  ✅  {rel}  ({label})")
        valid += 1
        return True
    except (ValidationError, ValueError, yaml.YAMLError) as exc:
        rel = path.relative_to(REPO_ROOT)
        print(f"  ❌  {rel}\n      {exc}", file=sys.stderr)
        invalid += 1
        return False


def walk(directory: Path) -> None:
    """Recursively find and validate every definition.yaml."""
    for item in sorted(directory.iterdir()):
        if item.is_dir():
            definition = item / "definition.yaml"
            if definition.exists():
                validate_file(definition)
            else:
                walk(item)


def main() -> None:
    print("\nValidating Matimo Python tool definitions…\n")

    if not PACKAGES_DIR.exists():
        print("packages/ directory not found — nothing to validate.")
        sys.exit(0)

    walk(PACKAGES_DIR)

    print(f"\n{'─' * 50}")
    print(f"  Valid    : {valid}")
    print(f"  Invalid  : {invalid}")
    print(f"  Skipped  : {skipped}")
    print(f"{'─' * 50}\n")

    if invalid:
        print(f"❌  {invalid} tool(s) failed validation.", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"✅  All {valid} tool(s) valid.")


if __name__ == "__main__":
    main()
