"""Unit tests for HttpExecutor (uses respx to mock httpx)."""
from __future__ import annotations

import os

import httpx
import pytest
import respx

from matimo.core.models import (
    AuthConfig,
    AuthType,
    CommandExecution,
    HttpExecution,
    Parameter,
    ParameterEncodingConfig,
    ParameterType,
    ToolDefinition,
)
from matimo.errors import ErrorCode, MatimoError
from matimo.executors.http_executor import HttpExecutor


def _make_http_tool(
    name: str = "test_tool",
    method: str = "GET",
    url: str = "https://api.example.com/test",
    headers: dict | None = None,
    body: dict | None = None,
    query_params: dict | None = None,
    params: dict | None = None,
) -> ToolDefinition:
    return ToolDefinition(
        name=name,
        description="test",
        parameters=params or {},
        execution=HttpExecution(
            type="http",
            method=method,
            url=url,
            headers=headers or {},
            body=body,
            query_params=query_params or {},
        ),
    )


@pytest.fixture()
def executor() -> HttpExecutor:
    return HttpExecutor()


class TestHttpExecutorGetRequests:
    @respx.mock
    async def test_simple_get_success(self, executor: HttpExecutor) -> None:
        respx.get("https://api.example.com/test").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        tool = _make_http_tool()
        result = await executor.execute(tool, {})
        assert result["ok"] is True

    @respx.mock
    async def test_url_template_substitution(self, executor: HttpExecutor) -> None:
        route = respx.get("https://api.example.com/users/42").mock(
            return_value=httpx.Response(200, json={"id": 42})
        )
        tool = _make_http_tool(
            url="https://api.example.com/users/{user_id}",
            params={"user_id": Parameter(type=ParameterType.STRING, description="ID", required=True)},
        )
        result = await executor.execute(tool, {"user_id": "42"})
        assert result["id"] == 42
        assert route.called

    @respx.mock
    async def test_header_template_substitution(self, executor: HttpExecutor) -> None:
        def check_auth(request: httpx.Request) -> httpx.Response:
            assert request.headers["Authorization"] == "Bearer my_token"
            return httpx.Response(200, json={"authenticated": True})

        respx.get("https://api.example.com/test").mock(side_effect=check_auth)
        tool = _make_http_tool(
            headers={"Authorization": "Bearer {token}"},
            params={"token": Parameter(type=ParameterType.STRING, description="token", required=True)},
        )
        result = await executor.execute(tool, {"token": "my_token"})
        assert result["authenticated"] is True


class TestHttpExecutorPostRequests:
    @respx.mock
    async def test_post_with_body(self, executor: HttpExecutor) -> None:
        def check_body(request: httpx.Request) -> httpx.Response:
            import json
            body = json.loads(request.content)
            assert body["channel"] == "#general"
            assert body["text"] == "Hello"
            return httpx.Response(200, json={"ok": True})

        respx.post("https://slack.com/api/chat.postMessage").mock(side_effect=check_body)
        tool = _make_http_tool(
            method="POST",
            url="https://slack.com/api/chat.postMessage",
            headers={"Content-Type": "application/json"},
            body={"channel": "{channel}", "text": "{text}"},
            params={
                "channel": Parameter(type=ParameterType.STRING, description="ch", required=True),
                "text": Parameter(type=ParameterType.STRING, description="txt", required=True),
            },
        )
        result = await executor.execute(tool, {"channel": "#general", "text": "Hello"})
        assert result["ok"] is True

    @respx.mock
    async def test_form_encoded_body(self, executor: HttpExecutor) -> None:
        def check_form(request: httpx.Request) -> httpx.Response:
            assert b"channel=%23general" in request.content
            return httpx.Response(200, json={"ok": True})

        respx.post("https://api.example.com/form").mock(side_effect=check_form)
        tool = _make_http_tool(
            method="POST",
            url="https://api.example.com/form",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            body={"channel": "{channel}"},
            params={"channel": Parameter(type=ParameterType.STRING, description="ch", required=True)},
        )
        await executor.execute(tool, {"channel": "#general"})


class TestHttpExecutorErrors:
    @respx.mock
    async def test_4xx_raises_matimo_error(self, executor: HttpExecutor) -> None:
        respx.get("https://api.example.com/test").mock(
            return_value=httpx.Response(404, json={"error": "not found"})
        )
        tool = _make_http_tool()
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @respx.mock
    async def test_5xx_raises_matimo_error(self, executor: HttpExecutor) -> None:
        respx.get("https://api.example.com/test").mock(
            return_value=httpx.Response(500, text="Internal Server Error")
        )
        tool = _make_http_tool()
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @respx.mock
    async def test_network_error_raises_matimo_error(self, executor: HttpExecutor) -> None:
        respx.get("https://api.example.com/test").mock(side_effect=httpx.ConnectError("Connection refused"))
        tool = _make_http_tool()
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code in (ErrorCode.EXECUTION_FAILED, ErrorCode.NETWORK_ERROR)

    @respx.mock
    async def test_non_json_response_returns_text(self, executor: HttpExecutor) -> None:
        respx.get("https://api.example.com/test").mock(
            return_value=httpx.Response(200, text="OK")
        )
        tool = _make_http_tool()
        result = await executor.execute(tool, {})
        # Should return raw text if JSON parsing fails
        assert result == "OK" or isinstance(result, str)


class TestHttpExecutorEdgeCases:
    async def test_non_http_tool_raises(self, executor: HttpExecutor) -> None:
        """Passing a command tool to HttpExecutor raises EXECUTION_FAILED."""
        tool = ToolDefinition(
            name="cmd",
            description="test",
            execution=CommandExecution(type="command", command="echo"),
        )
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @respx.mock
    async def test_parameter_encoding_applied(self, executor: HttpExecutor) -> None:
        """When parameter_encoding is set, encodings are applied before dispatch."""
        respx.post("https://api.example.com/send").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        tool = ToolDefinition(
            name="test_encode",
            description="test",
            parameters={"payload": Parameter(type=ParameterType.OBJECT, description="p", required=True)},
            execution=HttpExecution(
                type="http",
                method="POST",
                url="https://api.example.com/send",
                body={"data": "{encoded_payload}"},
                parameter_encoding=[
                    ParameterEncodingConfig(
                        source=["payload"],
                        target="encoded_payload",
                        encoding="json_compact",
                    )
                ],
            ),
        )
        result = await executor.execute(tool, {"payload": {"key": "value"}})
        assert result["ok"] is True

    @respx.mock
    async def test_optional_query_param_omitted(self, executor: HttpExecutor) -> None:
        """Optional query params with missing value should be skipped."""
        respx.get(url__startswith="https://api.example.com/items").mock(
            return_value=httpx.Response(200, json={"items": []})
        )
        tool = ToolDefinition(
            name="list_items",
            description="test",
            parameters={
                "cursor": Parameter(type=ParameterType.STRING, description="cursor", required=False)
            },
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://api.example.com/items",
                query_params={"cursor": "{cursor}"},
            ),
        )
        # No cursor provided — optional param should be skipped (not raise)
        result = await executor.execute(tool, {})
        assert result == {"items": []}

    @respx.mock
    async def test_basic_auth_injected(self, executor: HttpExecutor) -> None:
        """Basic auth credentials should be base64-injected into Authorization header."""
        def check_auth(request: httpx.Request) -> httpx.Response:
            import base64
            expected = "Basic " + base64.b64encode(b"user:pass").decode()
            assert request.headers.get("Authorization") == expected
            return httpx.Response(200, json={"ok": True})

        respx.get("https://api.example.com/secure").mock(side_effect=check_auth)
        tool = ToolDefinition(
            name="secure_tool",
            description="test",
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://api.example.com/secure",
            ),
            authentication=AuthConfig(
                type=AuthType.BASIC,
                username_env="MY_USERNAME",
                password_env="MY_PASSWORD",
            ),
        )
        import unittest.mock
        with unittest.mock.patch.dict(os.environ, {"MY_USERNAME": "user", "MY_PASSWORD": "pass"}):
            result = await executor.execute(tool, {})
        assert result["ok"] is True

    @respx.mock
    async def test_timeout_raises_matimo_error(self, executor: HttpExecutor) -> None:
        """httpx.TimeoutException should be wrapped as TIMEOUT MatimoError."""
        respx.get("https://api.example.com/slow").mock(
            side_effect=httpx.TimeoutException("timed out")
        )
        tool = ToolDefinition(
            name="slow_tool",
            description="test",
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://api.example.com/slow",
                timeout=100,
            ),
        )
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.TIMEOUT

    @respx.mock
    async def test_env_var_template_fallback(self, executor: HttpExecutor) -> None:
        """Template placeholders without explicit values fall back to env vars."""
        respx.get("https://api.example.com/test").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        tool = _make_http_tool(
            headers={"Authorization": "Bearer {MY_API_TOKEN}"},
        )
        import unittest.mock
        with unittest.mock.patch.dict(os.environ, {"MY_API_TOKEN": "env_token"}):
            result = await executor.execute(tool, {})
        assert result["ok"] is True

    def test_apply_basic_auth_with_credentials(self, executor: HttpExecutor) -> None:
        """_apply_basic_auth reads from creds dict when env var not set."""
        import base64
        tool = ToolDefinition(
            name="t",
            description="t",
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
            authentication=AuthConfig(
                type=AuthType.BASIC,
                username_env="U",
                password_env="P",
            ),
        )
        result = executor._apply_basic_auth({}, tool, {"U": "alice", "P": "secret"})
        expected = "Basic " + base64.b64encode(b"alice:secret").decode()
        assert result["Authorization"] == expected

    def test_apply_basic_auth_no_credentials_returns_unchanged(
        self, executor: HttpExecutor
    ) -> None:
        """_apply_basic_auth returns headers unchanged when no credentials found."""
        tool = ToolDefinition(
            name="t",
            description="t",
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
            authentication=AuthConfig(type=AuthType.BASIC),
        )
        import unittest.mock
        with unittest.mock.patch.dict(os.environ, {}, clear=True):
            result = executor._apply_basic_auth({"X-Foo": "bar"}, tool, {})
        assert "Authorization" not in result
        assert result["X-Foo"] == "bar"

    def test_apply_basic_auth_none_auth_cfg_returns_unchanged(
        self, executor: HttpExecutor
    ) -> None:
        """Cover line 229: _apply_basic_auth returns headers when auth_cfg is None."""
        tool = ToolDefinition(
            name="t",
            description="t",
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
        )  # authentication is None by default
        result = executor._apply_basic_auth({"X-Foo": "bar"}, tool, {})
        assert result == {"X-Foo": "bar"}

    @respx.mock
    async def test_creds_used_for_template_placeholder(
        self, executor: HttpExecutor
    ) -> None:
        """Cover line 178: _template uses creds[name] when name not in params."""
        respx.get("https://api.example.com/items").mock(
            return_value=httpx.Response(200, json={"items": []})
        )
        tool = _make_http_tool(
            url="https://api.example.com/{path}",
            params={"path": Parameter(type=ParameterType.STRING, required=True)},
        )
        # Pass path via credentials (not params) → covers line 178
        result = await executor.execute(tool, {}, credentials={"path": "items"})
        assert result == {"items": []}

    @respx.mock
    async def test_missing_placeholder_raises_invalid_parameter(
        self, executor: HttpExecutor
    ) -> None:
        """Cover line 184: _template raises INVALID_PARAMETER when placeholder missing."""
        respx.get(url__startswith="https://api.example.com").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        tool = _make_http_tool(url="https://api.example.com/{MISSING_KEY}")
        with pytest.raises(MatimoError) as exc_info:
            await executor.execute(tool, {})  # no value provided
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    @respx.mock
    async def test_list_body_templated(self, executor: HttpExecutor) -> None:
        """Cover lines 206-208: _template_object handles list and non-string values."""
        respx.post("https://api.example.com/batch").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        tool = ToolDefinition(
            name="batch_tool",
            description="test",
            parameters={"item": Parameter(type=ParameterType.STRING, required=True)},
            execution=HttpExecution(
                type="http",
                method="POST",
                url="https://api.example.com/batch",
                body={"items": ["{item}", 42]},  # list + non-string → covers 206-208
            ),
        )
        result = await executor.execute(tool, {"item": "hello"})
        assert result["ok"] is True

    @respx.mock
    async def test_optional_query_param_try_except_skips(
        self, executor: HttpExecutor
    ) -> None:
        """Cover lines 92-101: try/except when complex query param template fails."""
        respx.get(url__startswith="https://api.example.com/items").mock(
            return_value=httpx.Response(200, json={"items": []})
        )
        tool = ToolDefinition(
            name="list_items",
            description="test",
            parameters={
                "max_size": Parameter(type=ParameterType.STRING, required=False),
            },
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://api.example.com/items",
                # Complex template (not bare placeholder) with an optional param
                query_params={"limit": "max-{max_size}"},
            ),
        )
        # max_size not provided and it's optional — should be omitted via try/except
        result = await executor.execute(tool, {})
        assert result == {"items": []}

    @respx.mock
    async def test_required_query_param_complex_template_raises(
        self, executor: HttpExecutor
    ) -> None:
        """Cover line 101: raise when required query param can't be templated."""
        respx.get(url__startswith="https://api.example.com/items").mock(
            return_value=httpx.Response(200, json={"items": []})
        )
        tool = ToolDefinition(
            name="list_items",
            description="test",
            parameters={
                # Query param key 'max_size' is required
                "max_size": Parameter(type=ParameterType.STRING, required=True),
            },
            execution=HttpExecution(
                type="http",
                method="GET",
                url="https://api.example.com/items",
                # Complex template referencing an unrelated key that's missing
                query_params={"max_size": "max-{other_missing_key}"},
            ),
        )
        with pytest.raises(MatimoError) as exc_info:
            await executor.execute(tool, {"max_size": "5"})
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER


class TestTemplateObjectTypeCoverage:
    """Cover lines 218, 225-231, 233, 243, 245, 247-253 in _template_object."""

    def _make_executor(self) -> HttpExecutor:
        return HttpExecutor()

    def _make_param_def(self, param_type: str) -> object:
        return Parameter(type=ParameterType(param_type), required=False)

    def test_template_object_none_returns_none(self) -> None:
        """Line 218: None obj → None."""
        ex = self._make_executor()
        assert ex._template_object(None, {}, None, None) is None  # type: ignore[arg-type]

    def test_template_object_embed_dict_param(self) -> None:
        """Lines 217-219: single placeholder whose value is a dict → embedded directly."""
        ex = self._make_executor()
        payload = {"key": "val"}
        result = ex._template_object("{data}", {"data": payload}, None, None)  # type: ignore[arg-type]
        assert result is payload

    def test_template_object_embed_list_param(self) -> None:
        """Lines 217-219: single placeholder whose value is a list → embedded directly."""
        ex = self._make_executor()
        items = [1, 2, 3]
        result = ex._template_object("{items}", {"items": items}, None, None)  # type: ignore[arg-type]
        assert result is items

    def test_template_object_number_coerce_int(self) -> None:
        """Lines 225-231: number param with whole-number value → int."""
        ex = self._make_executor()
        param_defs = {"page_size": self._make_param_def("number")}
        result = ex._template_object("{page_size}", {"page_size": "10"}, None, param_defs)  # type: ignore[arg-type]
        assert result == 10
        assert isinstance(result, int)

    def test_template_object_number_coerce_float(self) -> None:
        """Lines 225-231: number param with decimal value → float."""
        ex = self._make_executor()
        param_defs = {"ratio": self._make_param_def("number")}
        result = ex._template_object("{ratio}", {"ratio": "3.14"}, None, param_defs)  # type: ignore[arg-type]
        assert abs(result - 3.14) < 0.001
        assert isinstance(result, float)

    def test_template_object_number_coerce_invalid_falls_through(self) -> None:
        """Lines 229-231: number param with non-numeric string → falls through to string template."""
        ex = self._make_executor()
        param_defs = {"count": self._make_param_def("number")}
        result = ex._template_object("{count}", {"count": "abc"}, None, param_defs)  # type: ignore[arg-type]
        assert result == "abc"  # no coercion, raw substitution

    def test_template_object_boolean_coerce_true_string(self) -> None:
        """Line 233: boolean param 'true' → True."""
        ex = self._make_executor()
        param_defs = {"active": self._make_param_def("boolean")}
        result = ex._template_object("{active}", {"active": "true"}, None, param_defs)  # type: ignore[arg-type]
        assert result is True

    def test_template_object_boolean_coerce_false_string(self) -> None:
        """Line 233: boolean param 'false' string → False."""
        ex = self._make_executor()
        param_defs = {"active": self._make_param_def("boolean")}
        result = ex._template_object("{active}", {"active": "false"}, None, param_defs)  # type: ignore[arg-type]
        assert result is False

    def test_template_object_boolean_coerce_python_true(self) -> None:
        """Line 233: boolean param Python True → True."""
        ex = self._make_executor()
        param_defs = {"flag": self._make_param_def("boolean")}
        result = ex._template_object("{flag}", {"flag": True}, None, param_defs)  # type: ignore[arg-type]
        assert result is True

    def test_template_object_dict_skips_empty_nested(self) -> None:
        """Lines 243, 245: empty nested dict is skipped; None nested value is skipped."""
        ex = self._make_executor()
        # Nested dict with a placeholder that resolves to None → skipped
        obj = {"outer": {"inner": "{missing}"}}
        result = ex._template_object(obj, {}, {}, None)  # type: ignore[arg-type]
        # 'outer' key should be absent because inner resolved to empty dict
        assert result == {}

    def test_template_object_dict_skips_none_value(self) -> None:
        """Line 245: dict value that templates to None is skipped."""
        ex = self._make_executor()
        # To hit the `templated is None` branch we pass a raw None as a non-string value.
        result = ex._template_object({"key": None}, {}, {}, None)  # type: ignore[arg-type]
        assert result == {}

    def test_template_object_dict_optional_invalid_param_skipped(self) -> None:
        """Lines 247-253: optional param in dict that raises INVALID_PARAMETER is skipped."""
        from unittest.mock import patch

        ex = self._make_executor()
        param_defs = {"opt": Parameter(type=ParameterType.STRING, required=False)}
        obj = {"opt": "{opt}"}

        # Patch _template_object on a nested call to raise INVALID_PARAMETER
        original = ex._template_object

        call_count = 0

        def patched(
            v: object,  # noqa: ANN001
            p: object,  # noqa: ANN001
            c: object,  # noqa: ANN001
            pd: object,  # noqa: ANN001
        ) -> object:  # noqa: ANN202
            nonlocal call_count
            call_count += 1
            if call_count > 1:  # inner recursive call → raise
                raise MatimoError("missing", ErrorCode.INVALID_PARAMETER)
            return original(v, p, c, pd)

        with patch.object(ex, "_template_object", side_effect=patched):
            result = ex._template_object(obj, {}, None, param_defs)  # type: ignore[arg-type]
        assert result == {}  # optional key was skipped

    def test_template_object_dict_required_invalid_param_raises(self) -> None:
        """Lines 247-253: required param raising INVALID_PARAMETER is re-raised."""
        from unittest.mock import patch

        ex = self._make_executor()
        param_defs = {"req": Parameter(type=ParameterType.STRING, required=True)}
        obj = {"req": "{req}"}

        original = ex._template_object
        call_count = 0

        def patched(
            v: object,  # noqa: ANN001
            p: object,  # noqa: ANN001
            c: object,  # noqa: ANN001
            pd: object,  # noqa: ANN001
        ) -> object:  # noqa: ANN202
            nonlocal call_count
            call_count += 1
            if call_count > 1:
                raise MatimoError("missing", ErrorCode.INVALID_PARAMETER)
            return original(v, p, c, pd)

        with patch.object(ex, "_template_object", side_effect=patched):
            with pytest.raises(MatimoError) as exc_info:
                ex._template_object(obj, {}, None, param_defs)  # type: ignore[arg-type]
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER
