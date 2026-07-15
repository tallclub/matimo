"""Unit tests for the extract_from_file core tool (YAML definition + run() logic).

Mirrors: typescript/packages/core/test/unit/tools/extract-from-file.test.ts
"""
from __future__ import annotations

import importlib.util
import types
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx
import yaml

from matimo.errors import ErrorCode, MatimoError

TOOL_DIR = Path(__file__).parent.parent.parent / "src" / "matimo" / "tools" / "extract_from_file"
DEFINITION_PATH = TOOL_DIR / "definition.yaml"
MODULE_PATH = TOOL_DIR / "extract_from_file.py"


def _load_module() -> types.ModuleType:
    """Import extract_from_file.py directly from disk, mirroring FunctionExecutor's loader."""
    spec = importlib.util.spec_from_file_location("matimo_tool_extract_from_file", MODULE_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def mod() -> types.ModuleType:
    return _load_module()


@pytest.fixture()
def definition() -> dict[str, Any]:
    return yaml.safe_load(DEFINITION_PATH.read_text())  # type: ignore[no-any-return]


# ── YAML definition ──────────────────────────────────────────────────────


class TestDefinition:
    def test_definition_valid(self, definition: dict[str, Any]) -> None:
        assert definition["name"] == "extract_from_file"
        assert definition["version"] == "1.0.0"
        assert "parameters" in definition
        assert definition["execution"]["type"] == "function"
        assert definition["execution"]["code"] == "./extract_from_file.py"
        assert definition["requires_approval"] is True

    def test_parameters(self, definition: dict[str, Any]) -> None:
        params = definition["parameters"]
        assert params["filePath"]["required"] is False
        assert params["fileUrl"]["required"] is False
        assert params["format"]["enum"] == ["auto", "pdf", "docx", "txt", "csv"]
        assert params["format"]["default"] == "auto"
        assert "maxSizeBytes" in params
        assert "timeout" in params
        assert "encoding" in params

    def test_output_schema(self, definition: dict[str, Any]) -> None:
        props = definition["output_schema"]["properties"]
        assert "extracted_text" in props
        assert "format_detected" in props
        assert "metadata" in props

    def test_examples_present(self, definition: dict[str, Any]) -> None:
        assert len(definition["examples"]) > 0

    def test_implementation_file_exists(self) -> None:
        assert MODULE_PATH.exists()

    def test_implementation_exports_run(self) -> None:
        content = MODULE_PATH.read_text()
        assert "async def run(params" in content


# ── Parameter validation ─────────────────────────────────────────────────


class TestParameterValidation:
    pytestmark = pytest.mark.asyncio

    async def test_missing_both_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    async def test_conflicting_params_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"filePath": "./a.txt", "fileUrl": "https://example.com/a.txt"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    async def test_unsupported_format_raises_before_fs_access(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"filePath": "/nonexistent/path.xyz", "format": "xml"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    async def test_error_is_matimo_error_instance(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError):
            await mod.run({})


# ── Local txt extraction ─────────────────────────────────────────────────


class TestLocalTxt:
    pytestmark = pytest.mark.asyncio

    async def test_extracts_text_and_counts(self, mod: types.ModuleType, tmp_path: Path) -> None:
        file_path = tmp_path / "notes.txt"
        file_path.write_text("Hello Matimo world")

        result = await mod.run({"filePath": str(file_path)})

        assert result["success"] is True
        assert result["format_detected"] == "txt"
        assert result["extracted_text"] == "Hello Matimo world"
        assert result["source"] == "filePath"
        assert result["metadata"]["word_count"] == 3
        assert result["metadata"]["char_count"] == 18

    async def test_respects_explicit_encoding(self, mod: types.ModuleType, tmp_path: Path) -> None:
        file_path = tmp_path / "latin.txt"
        file_path.write_bytes("café".encode("latin1"))

        result = await mod.run({"filePath": str(file_path), "encoding": "latin1"})
        assert result["extracted_text"] == "café"


# ── Local csv extraction ─────────────────────────────────────────────────


class TestLocalCsv:
    pytestmark = pytest.mark.asyncio

    async def test_extracts_csv_row_and_column_counts(self, mod: types.ModuleType, tmp_path: Path) -> None:
        file_path = tmp_path / "records.csv"
        file_path.write_text("name,age\nAlice,30\nBob,25\n")

        result = await mod.run({"filePath": str(file_path), "format": "csv"})

        assert result["format_detected"] == "csv"
        assert result["metadata"]["row_count"] == 2
        assert result["metadata"]["column_count"] == 2

    async def test_handles_quoted_fields_with_embedded_commas(
        self, mod: types.ModuleType, tmp_path: Path
    ) -> None:
        file_path = tmp_path / "quoted.csv"
        file_path.write_text('a,b\n"1,2","3\n4"\n')

        result = await mod.run({"filePath": str(file_path), "format": "csv"})
        assert result["metadata"]["row_count"] == 1
        assert result["metadata"]["column_count"] == 2

    async def test_auto_detects_csv_with_no_extension(self, mod: types.ModuleType, tmp_path: Path) -> None:
        file_path = tmp_path / "data-no-ext"
        file_path.write_text("a,b,c\n1,2,3\n")

        result = await mod.run({"filePath": str(file_path)})
        assert result["format_detected"] == "csv"

    async def test_empty_csv_has_zero_rows_and_columns(self, mod: types.ModuleType, tmp_path: Path) -> None:
        file_path = tmp_path / "empty.csv"
        file_path.write_text("")

        result = await mod.run({"filePath": str(file_path)})
        assert result["metadata"]["row_count"] == 0
        assert result["metadata"]["column_count"] == 0


class TestLocalTxtSniff:
    pytestmark = pytest.mark.asyncio

    async def test_auto_detects_txt_with_no_extension_and_no_commas(
        self, mod: types.ModuleType, tmp_path: Path
    ) -> None:
        file_path = tmp_path / "data-no-ext-txt"
        file_path.write_text("just plain words with no commas here")

        result = await mod.run({"filePath": str(file_path)})
        assert result["format_detected"] == "txt"


# ── Local pdf extraction (mocked pypdf) ──────────────────────────────────


class _FakePage:
    def __init__(self, text: str) -> None:
        self._text = text

    def extract_text(self) -> str:
        return self._text


class _FakePdfReader:
    def __init__(self, pages_text: list[str]) -> None:
        self.pages = [_FakePage(t) for t in pages_text]


class TestLocalPdf:
    pytestmark = pytest.mark.asyncio

    async def test_extracts_text_and_page_count(
        self, mod: types.ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            mod, "PdfReader", lambda _stream: _FakePdfReader(["Hello PDF", " world"])
        )

        file_path = tmp_path / "report.pdf"
        file_path.write_bytes(b"%PDF-1.4 fake content")

        result = await mod.run({"filePath": str(file_path)})

        assert result["format_detected"] == "pdf"
        assert result["extracted_text"] == "Hello PDF\n world"
        assert result["metadata"]["page_count"] == 2

    async def test_auto_detects_pdf_via_magic_bytes(
        self, mod: types.ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(mod, "PdfReader", lambda _stream: _FakePdfReader(["Sniffed"]))
        file_path = tmp_path / "no-extension-pdf"
        file_path.write_bytes(b"%PDF-1.7 rest of file")

        result = await mod.run({"filePath": str(file_path)})
        assert result["format_detected"] == "pdf"

    async def test_handles_pages_with_no_extractable_text(
        self, mod: types.ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        class _NoneTextPage:
            def extract_text(self) -> None:
                return None

        class _Reader:
            def __init__(self) -> None:
                self.pages = [_NoneTextPage()]

        monkeypatch.setattr(mod, "PdfReader", lambda _stream: _Reader())
        file_path = tmp_path / "blank.pdf"
        file_path.write_bytes(b"%PDF-1.4")

        result = await mod.run({"filePath": str(file_path)})
        assert result["extracted_text"] == ""


# ── Local docx extraction (mocked python-docx) ───────────────────────────


class _FakeParagraph:
    def __init__(self, text: str) -> None:
        self.text = text


class _FakeDocument:
    def __init__(self, paragraphs_text: list[str]) -> None:
        self.paragraphs = [_FakeParagraph(t) for t in paragraphs_text]


class TestLocalDocx:
    pytestmark = pytest.mark.asyncio

    async def test_extracts_raw_text(
        self, mod: types.ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            mod, "Document", lambda _stream: _FakeDocument(["Hello DOCX", "world"])
        )
        file_path = tmp_path / "proposal.docx"
        file_path.write_bytes(b"PK\x03\x04 fake zip content")

        result = await mod.run({"filePath": str(file_path)})

        assert result["format_detected"] == "docx"
        assert result["extracted_text"] == "Hello DOCX\nworld"
        assert "page_count" not in result["metadata"]

    async def test_auto_detects_docx_via_zip_magic_bytes(
        self, mod: types.ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(mod, "Document", lambda _stream: _FakeDocument(["Sniffed docx"]))
        file_path = tmp_path / "no-extension-docx"
        file_path.write_bytes(bytes([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00]))

        result = await mod.run({"filePath": str(file_path)})
        assert result["format_detected"] == "docx"


# ── Local file error paths ───────────────────────────────────────────────


class TestLocalFileErrors:
    pytestmark = pytest.mark.asyncio

    async def test_file_not_found(self, mod: types.ModuleType, tmp_path: Path) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"filePath": str(tmp_path / "does-not-exist.txt")})
        assert exc_info.value.code == ErrorCode.FILE_NOT_FOUND

    async def test_directory_is_not_a_file(self, mod: types.ModuleType, tmp_path: Path) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"filePath": str(tmp_path)})
        assert exc_info.value.code == ErrorCode.EXECUTION_FAILED

    async def test_oversized_file_rejected(self, mod: types.ModuleType, tmp_path: Path) -> None:
        file_path = tmp_path / "big.txt"
        file_path.write_text("x" * 1000)

        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"filePath": str(file_path), "maxSizeBytes": 10})
        assert exc_info.value.code == ErrorCode.EXECUTION_FAILED

    async def test_tilde_expands_to_home_directory(
        self, mod: types.ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        home_dir = tmp_path / "home"
        home_dir.mkdir()
        monkeypatch.setattr(Path, "home", classmethod(lambda cls: home_dir))
        (home_dir / "note.txt").write_text("from home")

        result = await mod.run({"filePath": "~/note.txt"})
        assert result["sourceLocation"] == str((home_dir / "note.txt").resolve())
        assert result["extracted_text"] == "from home"


# ── Remote fileUrl extraction ────────────────────────────────────────────


class TestRemoteFileUrl:
    pytestmark = pytest.mark.asyncio

    @respx.mock
    async def test_downloads_and_extracts_csv(self, mod: types.ModuleType) -> None:
        respx.get("https://example.com/files/data.csv").mock(
            return_value=httpx.Response(200, content=b"a,b\n1,2\n")
        )

        result = await mod.run({"fileUrl": "https://example.com/files/data.csv"})

        assert result["success"] is True
        assert result["source"] == "fileUrl"
        assert result["format_detected"] == "csv"

    @respx.mock
    async def test_downloads_and_extracts_docx(
        self, mod: types.ModuleType, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(mod, "Document", lambda _stream: _FakeDocument(["Remote docx text"]))
        respx.get("https://example.com/files/report.docx").mock(
            return_value=httpx.Response(200, content=b"PK\x03\x04 remote docx")
        )

        result = await mod.run({"fileUrl": "https://example.com/files/report.docx"})
        assert result["format_detected"] == "docx"
        assert result["extracted_text"] == "Remote docx text"

    async def test_rejects_invalid_url(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"fileUrl": "not-a-url"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    async def test_rejects_unsupported_protocol(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"fileUrl": "ftp://example.com/file.txt"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    async def test_rejects_malformed_ipv6_url(self, mod: types.ModuleType) -> None:
        """urlparse() itself raises ValueError for an unbalanced IPv6 literal."""
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"fileUrl": "http://[::1/bad"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    async def test_blocks_url_with_no_host(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"fileUrl": "http:///nohost"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    @pytest.mark.parametrize(
        "file_url",
        [
            "http://localhost/secret",
            "http://127.0.0.1/secret",
            "http://[::1]/secret",
            "http://169.254.169.254/latest/meta-data",
            "http://10.0.0.5/internal",
            "http://192.168.1.1/internal",
            "http://172.16.0.1/internal",
            "http://172.31.255.255/internal",
        ],
    )
    async def test_blocks_ssrf_targets(self, mod: types.ModuleType, file_url: str) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"fileUrl": file_url})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    @pytest.mark.parametrize(
        "file_url",
        ["http://172.15.0.1/ok.txt", "http://172.32.0.1/ok.txt", "http://8.8.8.8/ok.txt"],
    )
    @respx.mock
    async def test_allows_non_private_targets(self, mod: types.ModuleType, file_url: str) -> None:
        respx.get(file_url).mock(return_value=httpx.Response(200, content=b"hello"))
        result = await mod.run({"fileUrl": file_url, "format": "txt"})
        assert result["success"] is True

    @respx.mock
    async def test_non_2xx_response_raises_network_error(self, mod: types.ModuleType) -> None:
        respx.get("https://example.com/missing.txt").mock(return_value=httpx.Response(404))

        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"fileUrl": "https://example.com/missing.txt"})
        assert exc_info.value.code == ErrorCode.NETWORK_ERROR

    @respx.mock
    async def test_request_exception_raises_network_error(self, mod: types.ModuleType) -> None:
        respx.get("https://example.com/file.txt").mock(side_effect=httpx.ConnectError("boom"))

        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"fileUrl": "https://example.com/file.txt"})
        assert exc_info.value.code == ErrorCode.NETWORK_ERROR

    @respx.mock
    async def test_oversized_download_rejected(self, mod: types.ModuleType) -> None:
        respx.get("https://example.com/big.txt").mock(
            return_value=httpx.Response(200, content=b"x" * 1000)
        )

        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"fileUrl": "https://example.com/big.txt", "maxSizeBytes": 10})
        assert exc_info.value.code == ErrorCode.EXECUTION_FAILED
