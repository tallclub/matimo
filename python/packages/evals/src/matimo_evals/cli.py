"""
Thin CLI entrypoint for `matimo-eval-tool-selection` / `make eval-tool-selection`.

Mirrors: typescript/packages/evals/src/cli.ts
"""

from __future__ import annotations

import sys
from pathlib import Path

from matimo_evals.tool_selection.run_eval import (
    has_failures,
    print_report,
    run_tool_selection_eval,
)


def main() -> None:
    # src/matimo_evals/cli.py -> packages/evals/src/matimo_evals -> packages
    packages_dir = Path(__file__).resolve().parents[3]
    result = run_tool_selection_eval(packages_dir)
    print_report(result)
    sys.exit(1 if has_failures(result) else 0)


if __name__ == "__main__":
    main()
