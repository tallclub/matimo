"""Unit tests for parameter encoding."""
from __future__ import annotations

import base64
import json
import urllib.parse

import pytest

from matimo.encodings.parameter_encoding import apply_parameter_encodings
from matimo.errors import ErrorCode, MatimoError


class TestJsonEncoding:
    def test_dict_values_encoded_to_json_string(self) -> None:
        params = {"to": "test@example.com", "subject": "Hello", "body": "World"}
        encodings = [
            {"source": ["to", "subject"], "target": "combined", "encoding": "json_compact"}
        ]
        result = apply_parameter_encodings(params, encodings)
        assert "combined" in result
        decoded = json.loads(result["combined"])
        assert decoded["to"] == "test@example.com"
        assert decoded["subject"] == "Hello"

    def test_source_params_removed_after_encoding(self) -> None:
        params = {"key1": "val1", "key2": "val2", "keep": "this"}
        encodings = [{"source": ["key1", "key2"], "target": "encoded", "encoding": "json_compact"}]
        result = apply_parameter_encodings(params, encodings)
        assert "key1" not in result
        assert "key2" not in result
        assert "keep" in result

    def test_target_key_set(self) -> None:
        params = {"data": {"nested": True}}
        encodings = [{"source": ["data"], "target": "payload", "encoding": "json_compact"}]
        result = apply_parameter_encodings(params, encodings)
        assert "payload" in result


class TestMimeEncoding:
    def test_mime_base64url_encoded(self) -> None:
        params = {
            "to": "recipient@example.com",
            "subject": "Test Subject",
            "body": "Test body text",
        }
        encodings = [
            {
                "source": ["to", "subject", "body"],
                "target": "raw",
                "encoding": "mime_rfc2822_base64url",
            }
        ]
        result = apply_parameter_encodings(params, encodings)
        assert "raw" in result
        # Should be base64url encoded
        encoded = result["raw"]
        # Add padding if needed
        padding = 4 - len(encoded) % 4
        if padding != 4:
            encoded += "=" * padding
        decoded = base64.urlsafe_b64decode(encoded).decode()
        assert "Test Subject" in decoded

    def test_mime_source_keys_removed(self) -> None:
        params = {"to": "a@b.com", "subject": "S", "body": "B"}
        encodings = [{"source": ["to", "subject", "body"], "target": "raw", "encoding": "mime_rfc2822_base64url"}]
        result = apply_parameter_encodings(params, encodings)
        assert "to" not in result
        assert "raw" in result


class TestUrlEncoding:
    def test_dict_encoded_as_query_string(self) -> None:
        params = {"key1": "value1", "key2": "value 2"}
        encodings = [{"source": ["key1", "key2"], "target": "form_data", "encoding": "url_encoded"}]
        result = apply_parameter_encodings(params, encodings)
        assert "form_data" in result
        parsed = dict(urllib.parse.parse_qsl(result["form_data"]))
        assert parsed["key1"] == "value1"
        assert parsed["key2"] == "value 2"


class TestNoEncoding:
    def test_empty_encodings_passthrough(self) -> None:
        params = {"key": "value", "num": 42}
        result = apply_parameter_encodings(params, [])
        assert result == {"key": "value", "num": 42}

    def test_params_not_in_source_unchanged(self) -> None:
        params = {"encoded_key": "val", "other_param": "untouched"}
        encodings = [{"source": ["encoded_key"], "target": "out", "encoding": "json_compact"}]
        result = apply_parameter_encodings(params, encodings)
        assert result["other_param"] == "untouched"


class TestUnknownEncoding:
    def test_unknown_encoding_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"source": ["key"], "target": "out", "encoding": "unsupported_type"}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER


class TestValidation:
    def test_missing_source_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"target": "out", "encoding": "json_compact"}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER
        assert "source" in str(exc.value)

    def test_empty_source_list_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"source": [], "target": "out", "encoding": "json_compact"}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER
        assert "source" in str(exc.value)

    def test_non_list_source_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"source": "key", "target": "out", "encoding": "json_compact"}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER
        assert "source" in str(exc.value)

    def test_non_string_source_entries_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"source": ["key", 42], "target": "out", "encoding": "json_compact"}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER
        assert "source" in str(exc.value)

    def test_empty_string_source_entries_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"source": ["key", ""], "target": "out", "encoding": "json_compact"}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER
        assert "source" in str(exc.value)

    def test_missing_target_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"source": ["key"], "encoding": "json_compact"}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER
        assert "target" in str(exc.value)

    def test_empty_target_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"source": ["key"], "target": "", "encoding": "json_compact"}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER
        assert "target" in str(exc.value)

    def test_non_string_target_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"source": ["key"], "target": 123, "encoding": "json_compact"}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER
        assert "target" in str(exc.value)

    def test_missing_encoding_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"source": ["key"], "target": "out"}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER
        assert "encoding" in str(exc.value)

    def test_empty_encoding_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"source": ["key"], "target": "out", "encoding": ""}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER
        assert "encoding" in str(exc.value)

    def test_non_string_encoding_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"source": ["key"], "target": "out", "encoding": 42}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER
        assert "encoding" in str(exc.value)

    def test_invalid_options_type_raises(self) -> None:
        params = {"key": "val"}
        encodings = [{"source": ["key"], "target": "out", "encoding": "json_compact", "options": "invalid"}]
        with pytest.raises(MatimoError) as exc:
            apply_parameter_encodings(params, encodings)
        assert exc.value.code == ErrorCode.INVALID_PARAMETER
        assert "options" in str(exc.value)

    def test_valid_options_dict_accepted(self) -> None:
        params = {"key": "val"}
        encodings = [
            {"source": ["key"], "target": "out", "encoding": "json_compact", "options": {"compact": True}}
        ]
        result = apply_parameter_encodings(params, encodings)
        assert "out" in result
