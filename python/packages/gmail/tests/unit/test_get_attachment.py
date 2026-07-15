"""Unit tests for the gmail-get-attachment tool.

Mirrors typescript/packages/gmail/test/unit/get-attachment.test.ts: YAML
structural assertions, then execution tests with the Gmail API HTTP call
mocked via respx (no live network calls).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx
import pytest
import respx
import yaml

from matimo.instance import Matimo

TOOL_DIR = Path(__file__).parent.parent.parent / "src" / "matimo_gmail" / "tools" / "get-attachment"
TOOLS_ROOT = TOOL_DIR.parent

ATTACHMENT_URL = (
    "https://www.googleapis.com/gmail/v1/users/me/messages/"
    "187a65b7f3f2f11e/attachments/ANGjdJ_xyz123"
)


@pytest.fixture()
def definition() -> dict[str, Any]:
    return yaml.safe_load((TOOL_DIR / "definition.yaml").read_text())  # type: ignore[no-any-return]


class TestDefinition:
    def test_has_correct_name_and_version(self, definition: dict[str, Any]) -> None:
        assert definition["name"] == "gmail-get-attachment"
        assert definition["version"]

    def test_has_nonempty_description(self, definition: dict[str, Any]) -> None:
        assert isinstance(definition["description"], str)
        assert len(definition["description"]) > 0

    def test_required_parameters(self, definition: dict[str, Any]) -> None:
        params = definition["parameters"]
        assert params["messageId"]["required"] is True
        assert params["messageId"]["type"] == "string"
        assert params["attachmentId"]["required"] is True
        assert params["attachmentId"]["type"] == "string"

    def test_every_parameter_has_type_and_description(self, definition: dict[str, Any]) -> None:
        for param in definition["parameters"].values():
            assert param["type"] in {"string", "number", "boolean", "object", "array"}
            assert isinstance(param["description"], str)
            assert len(param["description"]) > 0

    def test_is_get_http_execution_against_gmail_api(self, definition: dict[str, Any]) -> None:
        execution = definition["execution"]
        assert execution["type"] == "http"
        assert execution["method"] == "GET"
        assert (
            "googleapis.com/gmail/v1/users/me/messages/{messageId}/attachments/{attachmentId}"
            in execution["url"]
        )

    def test_sends_bearer_authorization_header(self, definition: dict[str, Any]) -> None:
        headers = definition["execution"].get("headers", {})
        assert headers["Authorization"] == "Bearer {GMAIL_ACCESS_TOKEN}"

    def test_uses_oauth2_with_readonly_scope_matching_get_message(
        self, definition: dict[str, Any]
    ) -> None:
        auth = definition["authentication"]
        assert auth["type"] == "oauth2"
        assert auth["provider"] == "google"
        assert "https://www.googleapis.com/auth/gmail.readonly" in auth["scopes"]

    def test_does_not_request_broader_scopes_than_necessary(
        self, definition: dict[str, Any]
    ) -> None:
        assert len(definition["authentication"]["scopes"]) == 1

    def test_output_schema_describes_size_and_data(self, definition: dict[str, Any]) -> None:
        output_schema = definition["output_schema"]
        assert output_schema["type"] == "object"
        props = output_schema["properties"]
        assert "size" in props
        assert "data" in props
        assert "attachmentId" in props

    def test_configures_retry_backoff_error_handling(self, definition: dict[str, Any]) -> None:
        error_handling = definition["error_handling"]
        assert error_handling["retry"] > 0


@pytest.fixture()
def gmail_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GMAIL_ACCESS_TOKEN", "test-access-token")


@pytest.mark.asyncio
class TestExecution:
    @respx.mock
    async def test_fetches_attachment_success(self, gmail_env: None) -> None:
        route = respx.get(ATTACHMENT_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "attachmentId": "ANGjdJ_xyz123",
                    "size": 1024,
                    "data": "aGVsbG8gd29ybGQ",
                },
            )
        )

        matimo = await Matimo.init(str(TOOLS_ROOT))
        result = await matimo.execute(
            "gmail-get-attachment",
            {"messageId": "187a65b7f3f2f11e", "attachmentId": "ANGjdJ_xyz123"},
        )

        assert route.called
        sent_request = route.calls.last.request
        assert sent_request.method == "GET"
        assert sent_request.headers["Authorization"] == "Bearer test-access-token"

        assert result["size"] == 1024
        assert result["data"] == "aGVsbG8gd29ybGQ"
        assert result["attachmentId"] == "ANGjdJ_xyz123"

    @respx.mock
    async def test_propagates_error_when_attachment_not_found(self, gmail_env: None) -> None:
        respx.get(
            "https://www.googleapis.com/gmail/v1/users/me/messages/"
            "missing-message/attachments/missing-attachment"
        ).mock(
            return_value=httpx.Response(
                404, json={"error": {"message": "Attachment not found"}}
            )
        )

        matimo = await Matimo.init(str(TOOLS_ROOT))
        with pytest.raises(Exception):  # noqa: B017 - MatimoError wraps the HTTP failure
            await matimo.execute(
                "gmail-get-attachment",
                {"messageId": "missing-message", "attachmentId": "missing-attachment"},
            )
