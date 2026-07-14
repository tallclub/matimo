"""Unit tests for the convert_to_file core tool (YAML definition + run() logic).

Mirrors: typescript/packages/core/test/unit/tools/convert-to-file.test.ts
"""
from __future__ import annotations

import base64
import importlib.util
import json
import types
from pathlib import Path
from typing import Any

import pytest
import yaml

from matimo.errors import ErrorCode, MatimoError

TOOL_DIR = Path(__file__).parent.parent.parent / "src" / "matimo" / "tools" / "convert_to_file"
DEFINITION_PATH = TOOL_DIR / "definition.yaml"
MODULE_PATH = TOOL_DIR / "convert_to_file.py"


def _load_module() -> types.ModuleType:
    """Import convert_to_file.py directly from disk, mirroring FunctionExecutor's loader."""
    spec = importlib.util.spec_from_file_location("matimo_tool_convert_to_file", MODULE_PATH)
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


def _b64_text(result: dict[str, Any]) -> str:
    return base64.b64decode(result["file_base64"]).decode("utf-8")


# ── YAML definition ──────────────────────────────────────────────────────


class TestDefinition:
    def test_definition_valid(self, definition: dict[str, Any]) -> None:
        assert definition["name"] == "convert_to_file"
        assert definition["version"] == "1.0.0"
        assert "parameters" in definition
        assert definition["execution"]["type"] == "function"
        assert definition["execution"]["code"] == "./convert_to_file.py"
        assert definition["requires_approval"] is True

    def test_parameters(self, definition: dict[str, Any]) -> None:
        params = definition["parameters"]
        assert params["content"]["required"] is True
        assert params["source_format"]["required"] is True
        assert params["source_format"]["enum"] == ["json", "csv", "markdown", "text"]
        assert params["target_format"]["required"] is True
        assert params["target_format"]["enum"] == ["pdf", "docx", "csv", "json", "txt"]
        assert params["output_path"]["required"] is False
        assert params["max_content_length"]["required"] is False
        assert params["max_content_length"]["default"] == 10485760

    def test_output_schema(self, definition: dict[str, Any]) -> None:
        props = definition["output_schema"]["properties"]
        assert "output_path" in props
        assert "file_base64" in props
        assert "mime_type" in props
        assert "size_bytes" in props

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

    async def test_missing_content_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"source_format": "json", "target_format": "csv"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    async def test_empty_content_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"content": "", "source_format": "json", "target_format": "csv"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    async def test_unsupported_source_format_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"content": "x", "source_format": "pdf", "target_format": "csv"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    async def test_unsupported_target_format_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"content": "x", "source_format": "json", "target_format": "xml"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    async def test_unsupported_combo_lists_valid_combinations(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"content": "{}", "source_format": "json", "target_format": "pdf"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER
        assert exc_info.value.details["valid_combinations"] == [
            "json->csv",
            "csv->json",
            "markdown->pdf",
            "markdown->docx",
            "text->docx",
            "text->txt",
        ]

    @pytest.mark.parametrize(
        ("source_format", "target_format"),
        [
            ("csv", "pdf"),
            ("csv", "docx"),
            ("csv", "txt"),
            ("markdown", "csv"),
            ("markdown", "json"),
            ("markdown", "txt"),
            ("text", "csv"),
            ("text", "json"),
            ("text", "pdf"),
        ],
    )
    async def test_rejects_unsupported_combo(
        self, mod: types.ModuleType, source_format: str, target_format: str
    ) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"content": "x", "source_format": source_format, "target_format": target_format})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    async def test_oversized_content_rejected(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run(
                {
                    "content": '[{"a":1}]',
                    "source_format": "json",
                    "target_format": "csv",
                    "max_content_length": 5,
                }
            )
        assert exc_info.value.code == ErrorCode.EXECUTION_FAILED

    async def test_error_is_matimo_error_instance(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError):
            await mod.run({"content": "", "source_format": "json", "target_format": "csv"})


# ── json -> csv ───────────────────────────────────────────────────────────


class TestJsonToCsv:
    pytestmark = pytest.mark.asyncio

    async def test_converts_array_of_uniform_objects(self, mod: types.ModuleType) -> None:
        content = json.dumps(
            [{"name": "Ada", "role": "Mathematician"}, {"name": "Alan", "role": "Computer Scientist"}]
        )
        result = await mod.run({"content": content, "source_format": "json", "target_format": "csv"})

        assert result["success"] is True
        assert result["mime_type"] == "text/csv"
        assert result["output_path"] is None
        assert _b64_text(result) == "name,role\r\nAda,Mathematician\r\nAlan,Computer Scientist\r\n"

    async def test_unions_keys_with_missing_columns_filled_empty(self, mod: types.ModuleType) -> None:
        content = json.dumps([{"a": 1}, {"a": 2, "b": "extra"}])
        result = await mod.run({"content": content, "source_format": "json", "target_format": "csv"})
        assert _b64_text(result) == "a,b\r\n1,\r\n2,extra\r\n"

    async def test_quotes_fields_with_special_characters(self, mod: types.ModuleType) -> None:
        content = json.dumps(
            [{"note": "has, a comma", "quote": 'He said "hi"', "multi": "line1\nline2"}]
        )
        result = await mod.run({"content": content, "source_format": "json", "target_format": "csv"})
        csv_text = _b64_text(result)
        assert '"has, a comma"' in csv_text
        assert '"He said ""hi"""' in csv_text
        assert '"line1\nline2"' in csv_text

    async def test_wraps_single_object_as_one_row(self, mod: types.ModuleType) -> None:
        content = json.dumps({"x": 1, "y": 2})
        result = await mod.run({"content": content, "source_format": "json", "target_format": "csv"})
        assert _b64_text(result) == "x,y\r\n1,2\r\n"

    async def test_wraps_array_of_primitives_under_value_column(self, mod: types.ModuleType) -> None:
        content = json.dumps([1, 2, 3])
        result = await mod.run({"content": content, "source_format": "json", "target_format": "csv"})
        assert _b64_text(result) == "value\r\n1\r\n2\r\n3\r\n"

    async def test_empty_json_array_produces_empty_file(self, mod: types.ModuleType) -> None:
        result = await mod.run({"content": "[]", "source_format": "json", "target_format": "csv"})
        assert result["size_bytes"] == 0

    async def test_falls_back_to_value_column_when_every_record_is_empty(
        self, mod: types.ModuleType
    ) -> None:
        result = await mod.run({"content": "[{}]", "source_format": "json", "target_format": "csv"})
        # Python's stdlib csv.writer quotes a lone empty field to disambiguate
        # it from a genuinely blank line (unlike the TypeScript executor's
        # hand-rolled serializer, which leaves it unquoted) — both are valid
        # RFC 4180 CSV and round-trip to the same value via a CSV reader.
        assert _b64_text(result) == 'value\r\n""\r\n'

    async def test_stringifies_nested_values_as_json(self, mod: types.ModuleType) -> None:
        content = json.dumps([{"tags": ["a", "b"], "meta": {"nested": True}}])
        result = await mod.run({"content": content, "source_format": "json", "target_format": "csv"})
        csv_text = _b64_text(result)
        assert '"[""a"", ""b""]"' in csv_text or '"[""a"",""b""]"' in csv_text
        assert '""nested""' in csv_text

    async def test_malformed_json_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"content": "{not valid json", "source_format": "json", "target_format": "csv"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    async def test_bare_scalar_json_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError) as exc_info:
            await mod.run({"content": '"just a string"', "source_format": "json", "target_format": "csv"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER


# ── csv -> json ───────────────────────────────────────────────────────────


class TestCsvToJson:
    pytestmark = pytest.mark.asyncio

    async def test_converts_csv_rows_to_objects(self, mod: types.ModuleType) -> None:
        content = "name,role\nAda,Mathematician\nAlan,Computer Scientist\n"
        result = await mod.run({"content": content, "source_format": "csv", "target_format": "json"})

        assert result["mime_type"] == "application/json"
        parsed = json.loads(_b64_text(result))
        assert parsed == [
            {"name": "Ada", "role": "Mathematician"},
            {"name": "Alan", "role": "Computer Scientist"},
        ]

    async def test_handles_quoted_fields_with_commas_and_newlines(self, mod: types.ModuleType) -> None:
        content = 'a,b\n"1,2","3\n4"\n'
        result = await mod.run({"content": content, "source_format": "csv", "target_format": "json"})
        parsed = json.loads(_b64_text(result))
        assert parsed == [{"a": "1,2", "b": "3\n4"}]

    async def test_no_parsable_rows_returns_empty_array(self, mod: types.ModuleType) -> None:
        # content must be non-empty (see Parameter validation), so a lone
        # newline is used to exercise the "zero data rows" branch.
        result = await mod.run({"content": "\n", "source_format": "csv", "target_format": "json"})
        parsed = json.loads(_b64_text(result))
        assert parsed == []

    async def test_header_only_returns_empty_array(self, mod: types.ModuleType) -> None:
        result = await mod.run({"content": "a,b,c\n", "source_format": "csv", "target_format": "json"})
        parsed = json.loads(_b64_text(result))
        assert parsed == []

    async def test_blank_header_cells_get_generated_names(self, mod: types.ModuleType) -> None:
        content = "a,,c\n1,2,3\n"
        result = await mod.run({"content": content, "source_format": "csv", "target_format": "json"})
        parsed = json.loads(_b64_text(result))
        assert parsed == [{"a": "1", "column_2": "2", "c": "3"}]

    async def test_short_row_fills_missing_fields_empty(self, mod: types.ModuleType) -> None:
        content = "a,b,c\n1\n"
        result = await mod.run({"content": content, "source_format": "csv", "target_format": "json"})
        parsed = json.loads(_b64_text(result))
        assert parsed == [{"a": "1", "b": "", "c": ""}]


# ── markdown -> pdf ──────────────────────────────────────────────────────


class TestMarkdownToPdf:
    pytestmark = pytest.mark.asyncio

    async def test_renders_headings_paragraphs_and_bullets(self, mod: types.ModuleType) -> None:
        content = (
            "# Title\n\nA paragraph with **bold** text.\n\n"
            "- item one\n- item two\n\n## Sub\n\nAnother paragraph."
        )
        result = await mod.run({"content": content, "source_format": "markdown", "target_format": "pdf"})

        assert result["mime_type"] == "application/pdf"
        assert result["output_path"] is None
        data = base64.b64decode(result["file_base64"])
        assert data[:4] == b"%PDF"
        assert result["size_bytes"] > 0

    async def test_renders_empty_pdf_for_no_recognizable_blocks(self, mod: types.ModuleType) -> None:
        # A lone newline parses to a single "blank_line" node, which
        # _normalize_markdown discards, leaving zero blocks — exercises the
        # empty-blocks fallback in _markdown_to_pdf.
        result = await mod.run({"content": "\n", "source_format": "markdown", "target_format": "pdf"})
        data = base64.b64decode(result["file_base64"])
        assert data[:4] == b"%PDF"

    async def test_unknown_block_falls_back_to_paragraph(self, mod: types.ModuleType) -> None:
        result = await mod.run(
            {"content": "> a blockquote line", "source_format": "markdown", "target_format": "pdf"}
        )
        data = base64.b64decode(result["file_base64"])
        assert data[:4] == b"%PDF"
        assert result["size_bytes"] > 0

    async def test_html_comment_block_flattens_to_non_empty_paragraph(
        self, mod: types.ModuleType
    ) -> None:
        result = await mod.run(
            {"content": "<!-- just a comment -->", "source_format": "markdown", "target_format": "pdf"}
        )
        data = base64.b64decode(result["file_base64"])
        assert data[:4] == b"%PDF"
        assert result["size_bytes"] > 0


# ── markdown -> docx ─────────────────────────────────────────────────────


class TestMarkdownToDocx:
    pytestmark = pytest.mark.asyncio

    async def test_renders_headings_paragraphs_and_bullets(self, mod: types.ModuleType) -> None:
        content = "# Title\n\nA paragraph.\n\n- item one\n- item two"
        result = await mod.run({"content": content, "source_format": "markdown", "target_format": "docx"})

        assert (
            result["mime_type"]
            == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        data = base64.b64decode(result["file_base64"])
        assert data[:4] == b"PK\x03\x04"

    async def test_empty_markdown_produces_minimal_valid_docx(self, mod: types.ModuleType) -> None:
        result = await mod.run({"content": "\n", "source_format": "markdown", "target_format": "docx"})
        data = base64.b64decode(result["file_base64"])
        assert data[:4] == b"PK\x03\x04"


# ── text -> docx / text -> txt ──────────────────────────────────────────


class TestTextToDocx:
    pytestmark = pytest.mark.asyncio

    async def test_wraps_plain_text_lines_into_docx(self, mod: types.ModuleType) -> None:
        result = await mod.run(
            {"content": "line one\nline two", "source_format": "text", "target_format": "docx"}
        )
        data = base64.b64decode(result["file_base64"])
        assert data[:4] == b"PK\x03\x04"


class TestTextToTxt:
    pytestmark = pytest.mark.asyncio

    async def test_returns_content_unchanged(self, mod: types.ModuleType) -> None:
        content = "Meeting notes: ship the release on Friday."
        result = await mod.run({"content": content, "source_format": "text", "target_format": "txt"})

        assert result["mime_type"] == "text/plain"
        assert _b64_text(result) == content


# ── output_path handling ─────────────────────────────────────────────────


class TestOutputPathHandling:
    pytestmark = pytest.mark.asyncio

    async def test_writes_file_and_returns_null_base64(
        self, mod: types.ModuleType, tmp_path: Path
    ) -> None:
        out_path = tmp_path / "out.csv"
        result = await mod.run(
            {
                "content": '[{"a":1}]',
                "source_format": "json",
                "target_format": "csv",
                "output_path": str(out_path),
            }
        )

        assert result["output_path"] == str(out_path)
        assert result["file_base64"] is None
        assert out_path.exists()
        # read_bytes (not read_text) to avoid universal-newline translation
        # masking the actual \r\n line endings written to disk.
        assert out_path.read_bytes() == b"a\r\n1\r\n"

    async def test_creates_missing_parent_directories(
        self, mod: types.ModuleType, tmp_path: Path
    ) -> None:
        out_path = tmp_path / "nested" / "deeper" / "out.json"
        result = await mod.run(
            {
                "content": "a,b\n1,2\n",
                "source_format": "csv",
                "target_format": "json",
                "output_path": str(out_path),
            }
        )

        assert out_path.exists()
        assert result["output_path"] == str(out_path)

    async def test_tilde_expands_to_home_directory(
        self, mod: types.ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        home_dir = tmp_path / "home"
        home_dir.mkdir()
        monkeypatch.setattr(Path, "home", classmethod(lambda cls: home_dir))

        result = await mod.run(
            {
                "content": "hello world",
                "source_format": "text",
                "target_format": "txt",
                "output_path": "~/notes.txt",
            }
        )

        expected_path = (home_dir / "notes.txt").resolve()
        assert result["output_path"] == str(expected_path)
        assert expected_path.read_text() == "hello world"

    async def test_returns_base64_when_output_path_omitted(self, mod: types.ModuleType) -> None:
        result = await mod.run({"content": "hello", "source_format": "text", "target_format": "txt"})

        assert result["output_path"] is None
        assert isinstance(result["file_base64"], str)


# ── Internal helpers (direct unit coverage for defensive branches) ────────


class TestInternalHelpers:
    def test_serialize_csv_of_empty_rows_returns_empty_string(self, mod: types.ModuleType) -> None:
        assert mod._serialize_csv([]) == ""

    def test_flatten_inline_uses_text_when_no_raw_present(self, mod: types.ModuleType) -> None:
        assert mod._flatten_inline({"text": "plain text only"}) == "plain text only"

    def test_flatten_inline_returns_empty_string_for_unrecognized_node(
        self, mod: types.ModuleType
    ) -> None:
        assert mod._flatten_inline({"type": "linebreak"}) == ""
