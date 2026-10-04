"""The Python wheels carry the same SKILL.md files as the TypeScript packages."""

from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[5]
PY_PACKAGES = REPO / "python" / "packages"
TS_PACKAGES = REPO / "typescript" / "packages"


def _pairs() -> list[tuple[str, Path, Path]]:
    pairs: list[tuple[str, Path, Path]] = []
    for ts_skills in sorted(TS_PACKAGES.glob("*/skills")):
        name = ts_skills.parent.name
        if name == "core":
            py_skills = PY_PACKAGES / "core" / "src" / "matimo" / "skills"
        else:
            py_skills = PY_PACKAGES / name / "src" / f"matimo_{name}" / "skills"
        if (PY_PACKAGES / name).is_dir():
            pairs.append((name, ts_skills, py_skills))
    return pairs


@pytest.mark.skipif(not TS_PACKAGES.is_dir(), reason="TypeScript tree not available")
@pytest.mark.parametrize(("name", "ts_skills", "py_skills"), _pairs())
def test_python_skills_match_typescript(name: str, ts_skills: Path, py_skills: Path) -> None:
    ts_files = {p.relative_to(ts_skills): p.read_bytes() for p in ts_skills.rglob("*") if p.is_file()}
    py_files = {p.relative_to(py_skills): p.read_bytes() for p in py_skills.rglob("*") if p.is_file()}
    assert py_files == ts_files, f"{name}: Python skills drifted from typescript/packages/{name}/skills"
