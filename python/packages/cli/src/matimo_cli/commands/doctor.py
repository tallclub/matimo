"""
``matimo doctor`` — diagnose Matimo setup.

Mirrors: packages/cli/src/commands/doctor.ts
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

_AUTH_PATTERNS = {"TOKEN", "SECRET", "KEY", "PASSWORD", "CREDENTIAL", "AUTH"}
_PLACEHOLDER_RE = re.compile(r"\{(\w+)\}")


def _is_auth_var(name: str) -> bool:
    upper = name.upper()
    return any(p in upper for p in _AUTH_PATTERNS)


def doctor_command() -> None:
    issues: list[dict[str, str]] = []

    def check(label: str, passed: bool, message: str, severity: str = "error") -> None:
        icon = "✅" if passed else ("❌" if severity == "error" else "⚠️ ")
        print(f"  {icon} {label}")
        if not passed:
            issues.append({"severity": severity, "message": message})
            print(f"     {message}")

    print("\n🩺 Matimo Doctor — Checking your setup…\n")

    # 1. Python version
    print("Python:")
    v = sys.version_info
    check(
        f"Python {v.major}.{v.minor}.{v.micro}",
        v >= (3, 10),
        f"Python 3.10+ required. You are running {v.major}.{v.minor}. Upgrade: https://python.org",
    )
    print()

    # 2. matimo package
    print("matimo SDK:")
    try:
        import importlib.metadata

        matimo_version = importlib.metadata.version("matimo")
        check(f"matimo v{matimo_version}", True, "")
    except importlib.metadata.PackageNotFoundError:
        check("matimo", False, 'matimo package not installed. Run "pip install matimo".')
    print()

    # 3. Installed provider packages
    print("matimo-* packages:")
    try:
        import importlib.metadata as md

        providers = [
            d
            for d in md.distributions()
            if d.metadata["Name"]
            and d.metadata["Name"].startswith("matimo-")
            and d.metadata["Name"] not in ("matimo-cli",)
        ]

        if not providers:
            check(
                "matimo-* providers",
                False,
                'No matimo-* packages installed. Run "matimo install slack" to get started.',
                "warn",
            )
        else:
            for dist in sorted(providers, key=lambda d: d.metadata["Name"]):
                pkg_name = dist.metadata["Name"]
                print(f"  📦 {pkg_name}")

                # Try to find tools directory and scan for auth placeholders
                for dist_file in dist.files or []:
                    str_path = str(dist_file)
                    if "tools/" in str_path and str_path.endswith("definition.yaml"):
                        full_path = Path(str(dist.locate_file(dist_file)))
                        if full_path.is_file():
                            content = full_path.read_text(encoding="utf-8")
                            missing = []
                            for m in _PLACEHOLDER_RE.finditer(content):
                                name = m.group(1)
                                if _is_auth_var(name) and not os.environ.get(name):
                                    missing.append(name)
                            if missing:
                                for v in missing:
                                    print(f"     ❌ Missing env var: {v}")
                                issues.append(
                                    {
                                        "severity": "error",
                                        "message": f"{pkg_name}: missing env vars: {', '.join(missing)}",
                                    }
                                )
                            else:
                                print("     ✅ All required env vars are set")
                print()
    except Exception:
        check("matimo-* scan", False, "Failed to scan installed packages.", "warn")
    print()

    # 4. MATIMO_APPROVAL_SECRET
    print("Policy / Approval:")
    has_secret = bool(os.environ.get("MATIMO_APPROVAL_SECRET"))
    check(
        "MATIMO_APPROVAL_SECRET",
        has_secret,
        "MATIMO_APPROVAL_SECRET is not set. Agent-created tool approvals will use a "
        "random secret (not persistent across restarts). Set it in your .env file.",
        "warn",
    )
    print()

    # 5. Summary
    errors = [i for i in issues if i["severity"] == "error"]
    warnings = [i for i in issues if i["severity"] == "warn"]

    print("─" * 60)
    if not errors and not warnings:
        print("\n✅ Matimo is ready! No issues found.\n")
    else:
        if errors:
            print(f"\n❌ {len(errors)} error(s) found — fix before using Matimo:\n")
            for idx, e in enumerate(errors, 1):
                print(f"  {idx}. {e['message']}")
            print()
        if warnings:
            print(f"⚠️  {len(warnings)} warning(s):\n")
            for idx, w in enumerate(warnings, 1):
                print(f"  {idx}. {w['message']}")
            print()

    if errors:
        sys.exit(1)
