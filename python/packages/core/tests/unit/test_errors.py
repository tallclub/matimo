"""Unit tests for errors.py — MatimoError, ErrorCode, and helpers."""
from __future__ import annotations

import httpx

from matimo.errors import (
    ErrorCode,
    MatimoError,
    create_execution_error,
    create_validation_error,
    from_http_error,
)


class TestMatimoError:
    def test_basic_construction(self) -> None:
        err = MatimoError("something broke", ErrorCode.EXECUTION_FAILED)
        assert str(err) == "something broke"
        assert err.code == ErrorCode.EXECUTION_FAILED
        assert err.details == {}

    def test_details_stored(self) -> None:
        err = MatimoError("oops", ErrorCode.TIMEOUT, {"tool": "my_tool"})
        assert err.details["tool"] == "my_tool"

    def test_cause_stored(self) -> None:
        cause = ValueError("root cause")
        err = MatimoError("wrapping", ErrorCode.NETWORK_ERROR, cause=cause)
        assert err.__cause__ is cause

    def test_to_dict_without_cause(self) -> None:
        err = MatimoError("fail", ErrorCode.INVALID_SCHEMA, {"key": "val"})
        d = err.to_dict()
        assert d["name"] == "MatimoError"
        assert d["message"] == "fail"
        assert d["code"] == "INVALID_SCHEMA"
        assert d["details"] == {"key": "val"}
        assert "cause" not in d

    def test_to_dict_with_cause(self) -> None:
        cause = RuntimeError("inner")
        err = MatimoError("outer", ErrorCode.EXECUTION_FAILED, cause=cause)
        d = err.to_dict()
        assert "cause" in d
        assert d["cause"]["type"] == "RuntimeError"
        assert d["cause"]["message"] == "inner"

    def test_repr(self) -> None:
        err = MatimoError("bad request", ErrorCode.VALIDATION_FAILED)
        r = repr(err)
        assert "MatimoError" in r
        assert "VALIDATION_FAILED" in r
        assert "bad request" in r

    def test_is_exception(self) -> None:
        err = MatimoError("x", ErrorCode.UNKNOWN_ERROR)
        assert isinstance(err, Exception)


class TestConvenienceConstructors:
    def test_create_validation_error(self) -> None:
        err = create_validation_error("invalid params", {"param": "x"})
        assert err.code == ErrorCode.VALIDATION_FAILED
        assert err.details["param"] == "x"
        assert "invalid params" in str(err)

    def test_create_validation_error_no_details(self) -> None:
        err = create_validation_error("bad schema")
        assert err.code == ErrorCode.VALIDATION_FAILED
        assert err.details == {}

    def test_create_execution_error(self) -> None:
        err = create_execution_error("tool failed", {"tool": "t"})
        assert err.code == ErrorCode.EXECUTION_FAILED
        assert err.details["tool"] == "t"

    def test_create_execution_error_no_details(self) -> None:
        err = create_execution_error("crashed")
        assert err.code == ErrorCode.EXECUTION_FAILED
        assert err.details == {}


class TestFromHttpError:
    def test_without_response(self) -> None:
        raw = ValueError("connection refused")
        err = from_http_error(raw, "HTTP request failed")
        assert err.code == ErrorCode.EXECUTION_FAILED
        assert "connection refused" in err.details["original_error"]

    def test_with_response_status(self) -> None:
        """Wrap an httpx HTTPStatusError with response details."""
        request = httpx.Request("GET", "https://api.example.com/test")
        response = httpx.Response(404, text="Not Found", request=request)
        exc = httpx.HTTPStatusError(
            "404 Not Found", request=request, response=response
        )
        err = from_http_error(exc)
        assert err.code == ErrorCode.EXECUTION_FAILED
        assert err.details.get("status_code") == 404

    def test_default_message(self) -> None:
        raw = ValueError("timeout")
        err = from_http_error(raw)
        assert err.code == ErrorCode.EXECUTION_FAILED
        assert "timeout" in str(err.details)

    def test_response_text_truncated(self) -> None:
        """response.text is included and truncated to 500 chars."""
        request = httpx.Request("GET", "https://api.example.com/")
        long_body = "x" * 1000
        response = httpx.Response(500, text=long_body, request=request)
        exc = httpx.HTTPStatusError("500", request=request, response=response)
        err = from_http_error(exc)
        body = err.details.get("body", "")
        assert len(body) <= 500
