"""Unit tests for the shared Microsoft Graph helper module (graph_client.py)."""
from __future__ import annotations

import os
from typing import Any

import httpx
import pytest
import respx

from matimo.errors import ErrorCode, MatimoError
from matimo_microsoft.graph_client import (
    GRAPH_BASE_URL,
    get_access_token,
    graph_request,
    map_graph_error,
    require_params,
)

@pytest.fixture(autouse=True)
def _clear_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MICROSOFT_GRAPH_ACCESS_TOKEN", raising=False)


def test_graph_base_url_points_at_v1() -> None:
    assert GRAPH_BASE_URL == "https://graph.microsoft.com/v1.0"


class TestGetAccessToken:
    def test_reads_token_from_params_first(self) -> None:
        token = get_access_token({"MICROSOFT_GRAPH_ACCESS_TOKEN": "ctx-token"})
        assert token == "ctx-token"

    def test_falls_back_to_environment_variable(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("MICROSOFT_GRAPH_ACCESS_TOKEN", "env-token")
        assert get_access_token({}) == "env-token"

    def test_prefers_params_over_environment_variable(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("MICROSOFT_GRAPH_ACCESS_TOKEN", "env-token")
        token = get_access_token({"MICROSOFT_GRAPH_ACCESS_TOKEN": "ctx-token"})
        assert token == "ctx-token"

    def test_raises_auth_failed_when_no_token_available(self) -> None:
        with pytest.raises(MatimoError) as exc_info:
            get_access_token({})
        assert exc_info.value.code == ErrorCode.AUTH_FAILED
        assert "MICROSOFT_GRAPH_ACCESS_TOKEN" in str(exc_info.value)

    def test_raises_auth_failed_when_token_is_empty_string(self) -> None:
        with pytest.raises(MatimoError) as exc_info:
            get_access_token({"MICROSOFT_GRAPH_ACCESS_TOKEN": ""})
        assert exc_info.value.code == ErrorCode.AUTH_FAILED


class TestRequireParams:
    def test_does_not_raise_when_all_required_params_present(self) -> None:
        require_params({"a": "1", "b": 2}, ["a", "b"], "tool")

    def test_raises_validation_failed_listing_every_missing_param(self) -> None:
        with pytest.raises(MatimoError) as exc_info:
            require_params({"a": "1", "b": "", "c": None}, ["a", "b", "c", "d"], "my_tool")
        error = exc_info.value
        assert error.code == ErrorCode.VALIDATION_FAILED
        assert "my_tool" in str(error)
        assert "b, c, d" in str(error)
        assert error.details["missingParams"] == ["b", "c", "d"]


class TestMapGraphError:
    def test_maps_401_and_403_to_auth_failed(self) -> None:
        assert map_graph_error(401, {}, None, "Resource").code == ErrorCode.AUTH_FAILED
        assert map_graph_error(403, {}, None, "Resource").code == ErrorCode.AUTH_FAILED

    def test_maps_404_to_file_not_found_with_resource_type_in_message(self) -> None:
        error = map_graph_error(404, {}, None, "Drive item")
        assert error.code == ErrorCode.FILE_NOT_FOUND
        assert "Drive item" in str(error)

    def test_maps_429_to_rate_limit_exceeded_and_captures_retry_after(self) -> None:
        error = map_graph_error(429, {}, httpx.Headers({"Retry-After": "30"}), "Resource")
        assert error.code == ErrorCode.RATE_LIMIT_EXCEEDED
        assert error.details["retryAfterSeconds"] == 30.0

    def test_maps_429_without_retry_after_header(self) -> None:
        error = map_graph_error(429, {}, None, "Resource")
        assert error.code == ErrorCode.RATE_LIMIT_EXCEEDED
        assert error.details["retryAfterSeconds"] is None

    def test_maps_429_with_http_date_retry_after_falls_back_to_none(self) -> None:
        # RFC 9110 §10.2.3 allows Retry-After to be an HTTP-date instead of
        # delta-seconds — must not raise ValueError out of error mapping.
        error = map_graph_error(
            429, {}, httpx.Headers({"Retry-After": "Fri, 31 Dec 1999 23:59:59 GMT"}), "Resource"
        )
        assert error.code == ErrorCode.RATE_LIMIT_EXCEEDED
        assert error.details["retryAfterSeconds"] is None

    def test_maps_500_and_503_to_execution_failed(self) -> None:
        assert map_graph_error(500, {}, None, "Resource").code == ErrorCode.EXECUTION_FAILED
        assert map_graph_error(503, {}, None, "Resource").code == ErrorCode.EXECUTION_FAILED

    def test_maps_other_status_codes_to_execution_failed(self) -> None:
        error = map_graph_error(418, {}, None, "Resource")
        assert error.code == ErrorCode.EXECUTION_FAILED
        assert "418" in str(error)

    def test_includes_graph_error_body_in_details(self) -> None:
        error = map_graph_error(
            400, {"error": {"code": "BadRequest", "message": "oops"}}, None, "Resource"
        )
        assert error.details["graphError"] == {"code": "BadRequest", "message": "oops"}


class TestGraphRequest:
    pytestmark = pytest.mark.asyncio

    @respx.mock
    async def test_successful_json_get(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/me/messages").mock(
            return_value=httpx.Response(200, json={"value": []})
        )
        result = await graph_request(method="GET", path="/me/messages", token="tok")
        assert result == {"value": []}

    @respx.mock
    async def test_sends_bearer_token_and_accept_header(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["authorization"] = request.headers.get("authorization")
            captured["accept"] = request.headers.get("accept")
            return httpx.Response(200, json={"ok": True})

        respx.get(f"{GRAPH_BASE_URL}/me").mock(side_effect=handler)
        await graph_request(method="GET", path="/me", token="my-token")
        assert captured["authorization"] == "Bearer my-token"
        assert captured["accept"] == "application/json"

    @respx.mock
    async def test_sends_json_content_type_for_dict_body(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["content_type"] = request.headers.get("content-type")
            captured["body"] = request.content
            return httpx.Response(201, json={"id": "x"})

        respx.post(f"{GRAPH_BASE_URL}/me/events").mock(side_effect=handler)
        await graph_request(method="POST", path="/me/events", token="tok", body={"subject": "hi"})
        assert captured["content_type"] == "application/json"
        assert b'"subject":"hi"' in captured["body"] or b'"subject": "hi"' in captured["body"]

    @respx.mock
    async def test_sends_raw_bytes_without_json_content_type(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["content_type"] = request.headers.get("content-type")
            captured["body"] = request.content
            return httpx.Response(201, json={"id": "x"})

        respx.put(f"{GRAPH_BASE_URL}/drives/d/items/i:/f.txt:/content").mock(side_effect=handler)
        await graph_request(
            method="PUT",
            path="/drives/d/items/i:/f.txt:/content",
            token="tok",
            body=b"raw-bytes",
            headers={"Content-Type": "application/octet-stream"},
        )
        assert captured["content_type"] == "application/octet-stream"
        assert captured["body"] == b"raw-bytes"

    @respx.mock
    async def test_returns_raw_bytes_for_bytes_response_type(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/drives/d/items/i/content").mock(
            return_value=httpx.Response(200, content=b"file-bytes")
        )
        result = await graph_request(
            method="GET",
            path="/drives/d/items/i/content",
            token="tok",
            response_type="bytes",
        )
        assert result == b"file-bytes"

    @respx.mock
    async def test_allow_empty_response_returns_none_on_204(self) -> None:
        respx.post(f"{GRAPH_BASE_URL}/me/messages/x/send").mock(return_value=httpx.Response(202))
        result = await graph_request(
            method="POST",
            path="/me/messages/x/send",
            token="tok",
            allow_empty_response=True,
        )
        assert result is None

    @respx.mock
    async def test_filters_out_empty_query_params(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["query"] = dict(request.url.params)
            return httpx.Response(200, json={"value": []})

        respx.get(f"{GRAPH_BASE_URL}/me/messages").mock(side_effect=handler)
        await graph_request(
            method="GET",
            path="/me/messages",
            token="tok",
            query={"$top": 5, "$filter": None, "$search": ""},
        )
        assert captured["query"] == {"$top": "5"}

    @respx.mock
    async def test_raises_network_error_on_transport_failure(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/me").mock(side_effect=httpx.ConnectError("boom"))
        with pytest.raises(MatimoError) as exc_info:
            await graph_request(method="GET", path="/me", token="tok")
        assert exc_info.value.code == ErrorCode.NETWORK_ERROR

    @respx.mock
    async def test_raises_mapped_error_for_non_retryable_status(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/me").mock(
            return_value=httpx.Response(404, json={"error": {"code": "NotFound"}})
        )
        with pytest.raises(MatimoError) as exc_info:
            await graph_request(method="GET", path="/me", token="tok", resource_type="Profile")
        assert exc_info.value.code == ErrorCode.FILE_NOT_FOUND
        assert "Profile" in str(exc_info.value)

    @respx.mock
    async def test_treats_non_json_error_body_as_no_graph_error(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/me").mock(
            return_value=httpx.Response(404, content=b"<html>not json</html>", headers={"Content-Type": "text/html"})
        )
        with pytest.raises(MatimoError) as exc_info:
            await graph_request(method="GET", path="/me", token="tok")
        assert exc_info.value.code == ErrorCode.FILE_NOT_FOUND
        assert exc_info.value.details["graphError"] is None

    @respx.mock
    async def test_retries_on_429_then_succeeds(self, monkeypatch: pytest.MonkeyPatch) -> None:
        sleeps: list[float] = []

        async def fake_sleep(seconds: float) -> None:
            sleeps.append(seconds)

        monkeypatch.setattr("matimo_microsoft.graph_client.asyncio.sleep", fake_sleep)

        route = respx.get(f"{GRAPH_BASE_URL}/me/messages")
        route.side_effect = [
            httpx.Response(429, headers={"Retry-After": "2"}, json={"error": {"code": "TooManyRequests"}}),
            httpx.Response(200, json={"value": []}),
        ]
        result = await graph_request(method="GET", path="/me/messages", token="tok")
        assert result == {"value": []}
        assert route.call_count == 2
        assert sleeps == [2.0]

    @respx.mock
    async def test_retries_on_5xx_with_exponential_backoff(self, monkeypatch: pytest.MonkeyPatch) -> None:
        sleeps: list[float] = []

        async def fake_sleep(seconds: float) -> None:
            sleeps.append(seconds)

        monkeypatch.setattr("matimo_microsoft.graph_client.asyncio.sleep", fake_sleep)

        route = respx.get(f"{GRAPH_BASE_URL}/me/messages")
        route.side_effect = [
            httpx.Response(503, json={"error": {"code": "ServiceUnavailable"}}),
            httpx.Response(503, json={"error": {"code": "ServiceUnavailable"}}),
            httpx.Response(200, json={"value": []}),
        ]
        result = await graph_request(method="GET", path="/me/messages", token="tok")
        assert result == {"value": []}
        assert route.call_count == 3
        assert sleeps == [0.5, 1.0]

    @respx.mock
    async def test_gives_up_after_max_retries(self, monkeypatch: pytest.MonkeyPatch) -> None:
        async def fake_sleep(_seconds: float) -> None:
            return None

        monkeypatch.setattr("matimo_microsoft.graph_client.asyncio.sleep", fake_sleep)

        respx.get(f"{GRAPH_BASE_URL}/me/messages").mock(
            return_value=httpx.Response(503, json={"error": {"code": "ServiceUnavailable"}})
        )
        with pytest.raises(MatimoError) as exc_info:
            await graph_request(method="GET", path="/me/messages", token="tok")
        assert exc_info.value.code == ErrorCode.EXECUTION_FAILED

    @respx.mock
    async def test_returns_none_for_empty_success_body_without_allow_empty_response(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/me/photo").mock(return_value=httpx.Response(200, content=b""))
        result = await graph_request(method="GET", path="/me/photo", token="tok")
        assert result is None


def test_environment_variable_name_documented(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sanity check that the env var name used by get_access_token matches os.environ access."""
    monkeypatch.setenv("MICROSOFT_GRAPH_ACCESS_TOKEN", "from-env")
    assert os.environ["MICROSOFT_GRAPH_ACCESS_TOKEN"] == get_access_token({})


class TestGetToolsPath:
    def test_returns_a_directory_containing_tool_definitions(self) -> None:
        from matimo_microsoft import get_tools_path

        tools_path = get_tools_path()
        assert os.path.isdir(tools_path)
        assert "tools" in tools_path
        assert os.path.isfile(os.path.join(tools_path, "ms_search_knowledge", "definition.yaml"))

    def test_falls_back_to_filesystem_path_when_resources_lookup_fails(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import importlib.resources

        import matimo_microsoft

        def boom(_name: str) -> Any:
            raise ModuleNotFoundError("simulated resource lookup failure")

        monkeypatch.setattr(importlib.resources, "files", boom)

        tools_path = matimo_microsoft.get_tools_path()
        assert tools_path.endswith("tools")
        assert os.path.isdir(tools_path)
