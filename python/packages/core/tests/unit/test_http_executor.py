"""Unit tests for HttpExecutor (uses respx to mock httpx)."""
from __future__ import annotations

import pytest
import respx
import httpx

from matimo.core.models import HttpExecution, Parameter, ParameterType, ToolDefinition
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
    @pytest.mark.asyncio
    async def test_simple_get_success(self, executor: HttpExecutor):
        respx.get("https://api.example.com/test").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        tool = _make_http_tool()
        result = await executor.execute(tool, {})
        assert result["ok"] is True

    @respx.mock
    @pytest.mark.asyncio
    async def test_url_template_substitution(self, executor: HttpExecutor):
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
    @pytest.mark.asyncio
    async def test_header_template_substitution(self, executor: HttpExecutor):
        def check_auth(request: httpx.Request):
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
    @pytest.mark.asyncio
    async def test_post_with_body(self, executor: HttpExecutor):
        def check_body(request: httpx.Request):
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
    @pytest.mark.asyncio
    async def test_form_encoded_body(self, executor: HttpExecutor):
        def check_form(request: httpx.Request):
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
    @pytest.mark.asyncio
    async def test_4xx_raises_matimo_error(self, executor: HttpExecutor):
        respx.get("https://api.example.com/test").mock(
            return_value=httpx.Response(404, json={"error": "not found"})
        )
        tool = _make_http_tool()
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @respx.mock
    @pytest.mark.asyncio
    async def test_5xx_raises_matimo_error(self, executor: HttpExecutor):
        respx.get("https://api.example.com/test").mock(
            return_value=httpx.Response(500, text="Internal Server Error")
        )
        tool = _make_http_tool()
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @respx.mock
    @pytest.mark.asyncio
    async def test_network_error_raises_matimo_error(self, executor: HttpExecutor):
        respx.get("https://api.example.com/test").mock(side_effect=httpx.ConnectError("Connection refused"))
        tool = _make_http_tool()
        with pytest.raises(MatimoError) as exc:
            await executor.execute(tool, {})
        assert exc.value.code in (ErrorCode.EXECUTION_FAILED, ErrorCode.NETWORK_ERROR)

    @respx.mock
    @pytest.mark.asyncio
    async def test_non_json_response_returns_text(self, executor: HttpExecutor):
        respx.get("https://api.example.com/test").mock(
            return_value=httpx.Response(200, text="OK")
        )
        tool = _make_http_tool()
        result = await executor.execute(tool, {})
        # Should return raw text if JSON parsing fails
        assert result == "OK" or isinstance(result, str)
