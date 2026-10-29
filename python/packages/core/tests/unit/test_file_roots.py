"""MATIMO_FILE_ROOTS confinement for the built-in file tools."""
from __future__ import annotations

from pathlib import Path

import pytest

from matimo.errors import ErrorCode, MatimoError
from matimo.policy.file_roots import enforce_file_roots, get_file_roots
from matimo.tools.edit.edit import run as edit_run
from matimo.tools.read.read import run as read_run
from matimo.tools.search.search import run as search_run


@pytest.fixture
def sandbox(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, Path]:
    allowed = tmp_path / "allowed"
    outside = tmp_path / "outside"
    allowed.mkdir()
    outside.mkdir()
    (allowed / "ok.txt").write_text("inside\n", encoding="utf-8")
    (outside / "secret.txt").write_text("TOP SECRET\n", encoding="utf-8")
    monkeypatch.setenv("MATIMO_FILE_ROOTS", str(allowed))
    return allowed, outside


def test_unset_means_no_confinement(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("MATIMO_FILE_ROOTS", raising=False)
    assert get_file_roots() is None
    assert enforce_file_roots(tmp_path.resolve()) == tmp_path.resolve()


def test_blank_value_means_no_confinement(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATIMO_FILE_ROOTS", "  ")
    assert get_file_roots() is None


@pytest.mark.asyncio
async def test_read_allows_inside_and_blocks_outside(sandbox: tuple[Path, Path]) -> None:
    allowed, outside = sandbox
    ok = await read_run({"filePath": str(allowed / "ok.txt")})
    assert "inside" in ok["content"]
    with pytest.raises(MatimoError) as exc:
        await read_run({"filePath": str(outside / "secret.txt")})
    assert exc.value.code == ErrorCode.POLICY_DENIED


@pytest.mark.asyncio
async def test_dotdot_escape_is_blocked(sandbox: tuple[Path, Path]) -> None:
    allowed, _ = sandbox
    with pytest.raises(MatimoError):
        await read_run({"filePath": str(allowed / ".." / "outside" / "secret.txt")})


@pytest.mark.asyncio
async def test_sibling_with_shared_prefix_is_blocked(
    sandbox: tuple[Path, Path], tmp_path: Path
) -> None:
    sibling = tmp_path / "allowed-evil"
    sibling.mkdir()
    (sibling / "x.txt").write_text("x", encoding="utf-8")
    with pytest.raises(MatimoError):
        await read_run({"filePath": str(sibling / "x.txt")})


@pytest.mark.asyncio
async def test_symlink_out_of_root_is_blocked(sandbox: tuple[Path, Path]) -> None:
    allowed, outside = sandbox
    link = allowed / "link.txt"
    try:
        link.symlink_to(outside / "secret.txt")
    except (OSError, NotImplementedError):
        pytest.skip("symlinks not permitted on this platform")
    with pytest.raises(MatimoError):
        await read_run({"filePath": str(link)})


@pytest.mark.asyncio
async def test_edit_cannot_write_outside(sandbox: tuple[Path, Path]) -> None:
    _, outside = sandbox
    target = outside / "secret.txt"
    with pytest.raises(MatimoError):
        await edit_run({"filePath": str(target), "operation": "append", "content": "pwned", "startLine": 1})
    assert target.read_text(encoding="utf-8") == "TOP SECRET\n"


@pytest.mark.asyncio
async def test_search_cannot_start_outside_and_skips_escaping_symlinks(
    sandbox: tuple[Path, Path],
) -> None:
    allowed, outside = sandbox
    with pytest.raises(MatimoError):
        await search_run({"query": "SECRET", "directory": str(outside)})
    try:
        (allowed / "link.txt").symlink_to(outside / "secret.txt")
    except (OSError, NotImplementedError):
        pytest.skip("symlinks not permitted on this platform")
    result = await search_run({"query": "SECRET", "directory": str(allowed)})
    assert "TOP SECRET" not in str(result)
