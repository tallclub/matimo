"""
The ``matimo`` meta-package's ``__init__`` shadows matimo-core's once both are
installed, so ``from matimo import X`` only works for names the meta-package
re-exports. Its ``__all__`` must therefore list every name core exports.
"""
from __future__ import annotations

import ast
from pathlib import Path

_PACKAGES = Path(__file__).resolve().parents[3]


def _all_names(init_file: Path) -> set[str]:
    for node in ast.parse(init_file.read_text()).body:
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == "__all__" for t in node.targets
        ):
            assert isinstance(node.value, ast.List)
            return {e.value for e in node.value.elts if isinstance(e, ast.Constant)}
    raise AssertionError(f"no __all__ in {init_file}")


def test_meta_package_reexports_every_core_name() -> None:
    core = _all_names(_PACKAGES / "core" / "src" / "matimo" / "__init__.py")
    meta = _all_names(_PACKAGES / "matimo" / "src" / "matimo" / "__init__.py")
    assert sorted(core - meta) == []
    assert sorted(meta - core) == []


def test_new_risk_helpers_import_from_matimo() -> None:
    from matimo import classify_execution_risk, meets_risk_threshold

    assert callable(classify_execution_risk)
    assert meets_risk_threshold("high", "medium") is True
