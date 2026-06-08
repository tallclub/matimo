"""Unit tests for all 9 Microsoft Graph tool YAML definitions and executors.

Mirrors the TypeScript suite (typescript/packages/microsoft/test/unit/microsoft-tools.test.ts):
YAML structural assertions for every tool, then per-tool executor tests with
Microsoft Graph HTTP calls mocked via respx (no live network calls).
"""
from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx
import yaml

from matimo.errors import ErrorCode, MatimoError
from matimo_microsoft.graph_client import GRAPH_BASE_URL
from matimo_microsoft.tools.ms_create_calendar_event.ms_create_calendar_event import (
    run as create_calendar_event,
)
from matimo_microsoft.tools.ms_create_document.ms_create_document import run as create_document
from matimo_microsoft.tools.ms_get_email.ms_get_email import run as get_email
from matimo_microsoft.tools.ms_list_files.ms_list_files import run as list_files
from matimo_microsoft.tools.ms_publish_to_sharepoint.ms_publish_to_sharepoint import (
    run as publish_to_sharepoint,
)
from matimo_microsoft.tools.ms_read_file.ms_read_file import run as read_file
from matimo_microsoft.tools.ms_search_knowledge.ms_search_knowledge import run as search_knowledge
from matimo_microsoft.tools.ms_send_email.ms_send_email import run as send_email
from matimo_microsoft.tools.ms_send_teams_message.ms_send_teams_message import (
    run as send_teams_message,
)

TOOLS_ROOT = Path(__file__).parent.parent.parent / "src" / "matimo_microsoft" / "tools"

TOOL_SPECS: list[dict[str, Any]] = [
    {"name": "ms_search_knowledge", "risk": "low", "requires_approval": False},
    {"name": "ms_read_file", "risk": "low", "requires_approval": False},
    {"name": "ms_list_files", "risk": "low", "requires_approval": False},
    {"name": "ms_get_email", "risk": "low", "requires_approval": False},
    {"name": "ms_send_email", "risk": "high", "requires_approval": True},
    {"name": "ms_send_teams_message", "risk": "medium", "requires_approval": False},
    {"name": "ms_create_document", "risk": "medium", "requires_approval": False},
    {"name": "ms_create_calendar_event", "risk": "medium", "requires_approval": False},
    {"name": "ms_publish_to_sharepoint", "risk": "high", "requires_approval": True},
]

TOOL_NAMES = [spec["name"] for spec in TOOL_SPECS]

CONTEXT: dict[str, Any] = {"MICROSOFT_GRAPH_ACCESS_TOKEN": "test-token"}


async def _expect_matimo_error(coro: Any, code: ErrorCode) -> MatimoError:
    with pytest.raises(MatimoError) as exc_info:
        await coro
    assert exc_info.value.code == code
    return exc_info.value


# ─── YAML definition structural tests ────────────────────────────────────────


@pytest.fixture(params=TOOL_SPECS, ids=[spec["name"] for spec in TOOL_SPECS])
def tool_spec(request: pytest.FixtureRequest) -> dict[str, Any]:
    return dict(request.param)


@pytest.fixture
def tool_definition(tool_spec: dict[str, Any]) -> dict[str, Any]:
    tool_path = TOOLS_ROOT / tool_spec["name"] / "definition.yaml"
    with open(tool_path) as f:
        return yaml.safe_load(f)  # type: ignore[no-any-return]


class TestToolDefinitions:
    def test_has_all_required_yaml_fields(self, tool_spec: dict[str, Any], tool_definition: dict[str, Any]) -> None:
        assert tool_definition.get("name") == tool_spec["name"]
        assert tool_definition.get("description")
        assert tool_definition.get("version")
        assert tool_definition.get("status") == "approved"
        assert "parameters" in tool_definition
        assert "execution" in tool_definition
        assert "output_schema" in tool_definition

    def test_is_a_function_tool_with_colocated_executor(
        self, tool_spec: dict[str, Any], tool_definition: dict[str, Any]
    ) -> None:
        execution = tool_definition.get("execution") or {}
        assert execution.get("type") == "function"
        assert execution.get("code") == f"./{tool_spec['name']}.py"
        executor_path = TOOLS_ROOT / tool_spec["name"] / f"{tool_spec['name']}.py"
        assert executor_path.exists()

    def test_has_expected_risk(self, tool_spec: dict[str, Any], tool_definition: dict[str, Any]) -> None:
        assert tool_definition.get("risk") == tool_spec["risk"]

    def test_has_expected_requires_approval(self, tool_spec: dict[str, Any], tool_definition: dict[str, Any]) -> None:
        assert (tool_definition.get("requires_approval") or False) == tool_spec["requires_approval"]

    def test_uses_microsoft_oauth2_authentication(self, tool_definition: dict[str, Any]) -> None:
        auth = tool_definition.get("authentication") or {}
        assert auth.get("type") == "oauth2"
        assert auth.get("provider") == "microsoft"

    def test_has_at_least_one_example(self, tool_definition: dict[str, Any]) -> None:
        examples = tool_definition.get("examples") or []
        assert isinstance(examples, list)
        assert len(examples) >= 1


# ─── ms_search_knowledge ──────────────────────────────────────────────────────


class TestSearchKnowledge:
    pytestmark = pytest.mark.asyncio

    async def test_validation_failed_when_query_missing(self) -> None:
        await _expect_matimo_error(search_knowledge({**CONTEXT}), ErrorCode.VALIDATION_FAILED)

    async def test_rejects_invalid_entity_types_before_calling_graph(self) -> None:
        await _expect_matimo_error(
            search_knowledge({**CONTEXT, "query": "q", "entity_types": ["bogus"]}),
            ErrorCode.VALIDATION_FAILED,
        )

    @pytest.mark.parametrize("top", [0, 100])
    async def test_rejects_out_of_range_top_values(self, top: int) -> None:
        await _expect_matimo_error(
            search_knowledge({**CONTEXT, "query": "q", "top": top}), ErrorCode.VALIDATION_FAILED
        )

    async def test_rejects_non_numeric_top_values(self) -> None:
        await _expect_matimo_error(
            search_knowledge({**CONTEXT, "query": "q", "top": "lots"}), ErrorCode.VALIDATION_FAILED
        )

    @respx.mock
    async def test_searches_with_default_entity_types_and_transforms_hits(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            import json

            captured["body"] = json.loads(request.content)
            return httpx.Response(
                200,
                json={
                    "value": [
                        {
                            "hitsContainers": [
                                {
                                    "total": 2,
                                    "hits": [
                                        {
                                            "hitId": "h1",
                                            "rank": 1,
                                            "summary": "Quarterly summary",
                                            "resource": {
                                                "id": "item1",
                                                "name": "Q3-budget.xlsx",
                                                "webUrl": "https://contoso.sharepoint.com/Q3-budget.xlsx",
                                                "lastModifiedDateTime": "2026-05-01T00:00:00Z",
                                            },
                                        }
                                    ],
                                }
                            ]
                        }
                    ]
                },
            )

        respx.post(f"{GRAPH_BASE_URL}/search/query").mock(side_effect=handler)

        result = await search_knowledge({**CONTEXT, "query": "budget"})

        assert result["success"] is True
        assert result["total_count"] == 2
        assert result["results"] == [
            {
                "id": "item1",
                "name": "Q3-budget.xlsx",
                "summary": "Quarterly summary",
                "web_url": "https://contoso.sharepoint.com/Q3-budget.xlsx",
                "last_modified": "2026-05-01T00:00:00Z",
                "score": 1,
            }
        ]
        body = captured["body"]["requests"][0]
        assert body["entityTypes"] == ["driveItem", "listItem", "site"]
        assert body["query"]["queryString"] == "budget"

    @respx.mock
    async def test_folds_site_id_and_drive_id_into_query_string(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            import json

            captured["body"] = json.loads(request.content)
            return httpx.Response(200, json={"value": [{"hitsContainers": [{"total": 0, "hits": []}]}]})

        respx.post(f"{GRAPH_BASE_URL}/search/query").mock(side_effect=handler)

        await search_knowledge({**CONTEXT, "query": "onboarding", "site_id": "site-1", "drive_id": "drive-1"})

        body = captured["body"]["requests"][0]
        assert body["query"]["queryString"] == "onboarding site-1 drive-1"

    @respx.mock
    async def test_falls_back_to_empty_results_when_no_hits_container(self) -> None:
        respx.post(f"{GRAPH_BASE_URL}/search/query").mock(return_value=httpx.Response(200, json={"value": []}))

        result = await search_knowledge({**CONTEXT, "query": "q"})
        assert result["results"] == []
        assert result["total_count"] == 0

    async def test_auth_failed_when_no_token(self) -> None:
        await _expect_matimo_error(search_knowledge({"query": "q"}), ErrorCode.AUTH_FAILED)


# ─── ms_read_file ─────────────────────────────────────────────────────────────


class TestReadFile:
    pytestmark = pytest.mark.asyncio

    async def test_validation_failed_when_required_params_missing(self) -> None:
        await _expect_matimo_error(read_file({**CONTEXT, "drive_id": "d1"}), ErrorCode.VALIDATION_FAILED)

    @respx.mock
    async def test_decodes_plain_text_content_as_utf8(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/drives/d1/items/i1").mock(
            return_value=httpx.Response(200, json={"name": "notes.txt", "size": 11, "file": {"mimeType": "text/plain"}})
        )
        respx.get(f"{GRAPH_BASE_URL}/drives/d1/items/i1/content").mock(
            return_value=httpx.Response(200, content=b"hello world")
        )

        result = await read_file({**CONTEXT, "drive_id": "d1", "item_id": "i1"})

        assert result["success"] is True
        assert result["content"] == "hello world"
        assert result["name"] == "notes.txt"
        assert result["mime_type"] == "text/plain"
        assert result["size_bytes"] == 11
        assert "warning" not in result

    @respx.mock
    async def test_decodes_application_json_content_as_text(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/drives/d1/items/i1").mock(
            return_value=httpx.Response(
                200, json={"name": "data.json", "size": 13, "file": {"mimeType": "application/json"}}
            )
        )
        respx.get(f"{GRAPH_BASE_URL}/drives/d1/items/i1/content").mock(
            return_value=httpx.Response(200, content=b'{"ok":true}')
        )

        result = await read_file({**CONTEXT, "drive_id": "d1", "item_id": "i1"})
        assert result["content"] == '{"ok":true}'

    @respx.mock
    async def test_returns_warning_for_rich_documents(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/drives/d1/items/i1").mock(
            return_value=httpx.Response(
                200, json={"name": "report.pdf", "size": 2048, "file": {"mimeType": "application/pdf"}}
            )
        )
        respx.get(f"{GRAPH_BASE_URL}/drives/d1/items/i1/content").mock(
            return_value=httpx.Response(200, content=b"%PDF-1.4")
        )

        result = await read_file({**CONTEXT, "drive_id": "d1", "item_id": "i1"})
        assert result["content"] == ""
        assert "PDF document" in result["warning"]

    @respx.mock
    async def test_returns_generic_warning_for_unsupported_binary(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/drives/d1/items/i1").mock(
            return_value=httpx.Response(
                200, json={"name": "image.png", "size": 4096, "file": {"mimeType": "image/png"}}
            )
        )
        respx.get(f"{GRAPH_BASE_URL}/drives/d1/items/i1/content").mock(
            return_value=httpx.Response(200, content=b"\x89PNG")
        )

        result = await read_file({**CONTEXT, "drive_id": "d1", "item_id": "i1"})
        assert result["content"] == ""
        assert result["warning"] == "Binary file — text extraction not supported"

    @respx.mock
    async def test_maps_404_to_file_not_found(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/drives/d1/items/missing").mock(
            return_value=httpx.Response(404, json={"error": {"code": "itemNotFound"}})
        )

        await _expect_matimo_error(
            read_file({**CONTEXT, "drive_id": "d1", "item_id": "missing"}), ErrorCode.FILE_NOT_FOUND
        )


# ─── ms_list_files ────────────────────────────────────────────────────────────


class TestListFiles:
    pytestmark = pytest.mark.asyncio

    async def test_validation_failed_when_drive_id_missing(self) -> None:
        await _expect_matimo_error(list_files({**CONTEXT}), ErrorCode.VALIDATION_FAILED)

    @pytest.mark.parametrize("top", [0, 200])
    async def test_rejects_out_of_range_top(self, top: int) -> None:
        await _expect_matimo_error(
            list_files({**CONTEXT, "drive_id": "d1", "top": top}), ErrorCode.VALIDATION_FAILED
        )

    async def test_rejects_non_numeric_top(self) -> None:
        await _expect_matimo_error(
            list_files({**CONTEXT, "drive_id": "d1", "top": "lots"}), ErrorCode.VALIDATION_FAILED
        )

    @respx.mock
    async def test_defaults_item_id_to_root_and_lists_children(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["url"] = str(request.url)
            return httpx.Response(
                200,
                json={
                    "value": [
                        {
                            "id": "f1",
                            "name": "Reports",
                            "folder": {"childCount": 3},
                            "size": 0,
                            "lastModifiedDateTime": "2026-01-01T00:00:00Z",
                            "webUrl": "https://contoso.sharepoint.com/Reports",
                        },
                        {
                            "id": "f2",
                            "name": "notes.txt",
                            "file": {"mimeType": "text/plain"},
                            "size": 24,
                            "lastModifiedDateTime": "2026-01-02T00:00:00Z",
                            "webUrl": "https://contoso.sharepoint.com/notes.txt",
                        },
                    ]
                },
            )

        respx.get(f"{GRAPH_BASE_URL}/drives/d1/items/root/children").mock(side_effect=handler)

        result = await list_files({**CONTEXT, "drive_id": "d1"})

        assert "/drives/d1/items/root/children" in captured["url"]
        assert result["items"] == [
            {
                "id": "f1",
                "name": "Reports",
                "type": "folder",
                "size_bytes": 0,
                "last_modified": "2026-01-01T00:00:00Z",
                "web_url": "https://contoso.sharepoint.com/Reports",
            },
            {
                "id": "f2",
                "name": "notes.txt",
                "type": "file",
                "size_bytes": 24,
                "last_modified": "2026-01-02T00:00:00Z",
                "web_url": "https://contoso.sharepoint.com/notes.txt",
                "mime_type": "text/plain",
            },
        ]

    @respx.mock
    async def test_uses_provided_item_id(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/drives/d1/items/folder-123/children").mock(
            return_value=httpx.Response(200, json={"value": []})
        )
        result = await list_files({**CONTEXT, "drive_id": "d1", "item_id": "folder-123"})
        assert result["items"] == []


# ─── ms_get_email ─────────────────────────────────────────────────────────────


class TestGetEmail:
    pytestmark = pytest.mark.asyncio

    @pytest.mark.parametrize("top", [0, 51])
    async def test_rejects_out_of_range_top(self, top: int) -> None:
        await _expect_matimo_error(get_email({**CONTEXT, "top": top}), ErrorCode.VALIDATION_FAILED)

    async def test_rejects_non_numeric_top(self) -> None:
        await _expect_matimo_error(get_email({**CONTEXT, "top": "lots"}), ErrorCode.VALIDATION_FAILED)

    @respx.mock
    async def test_lists_messages_from_default_mailbox(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["url"] = str(request.url)
            return httpx.Response(
                200,
                json={
                    "value": [
                        {
                            "id": "m1",
                            "subject": "Welcome",
                            "from": {"emailAddress": {"name": "Alice", "address": "alice@contoso.com"}},
                            "receivedDateTime": "2026-05-01T00:00:00Z",
                            "isRead": False,
                            "bodyPreview": "Hi there",
                            "hasAttachments": True,
                        }
                    ]
                },
            )

        respx.get(f"{GRAPH_BASE_URL}/me/messages").mock(side_effect=handler)

        result = await get_email({**CONTEXT})

        assert "/me/messages" in captured["url"]
        assert result["messages"] == [
            {
                "id": "m1",
                "subject": "Welcome",
                "from": "Alice <alice@contoso.com>",
                "received_at": "2026-05-01T00:00:00Z",
                "is_read": False,
                "body_preview": "Hi there",
                "has_attachments": True,
            }
        ]

    @respx.mock
    async def test_uses_folder_scoped_path_and_filter_search_query_params(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["url"] = str(request.url)
            captured["query"] = dict(request.url.params)
            return httpx.Response(200, json={"value": []})

        respx.get(f"{GRAPH_BASE_URL}/me/mailFolders/inbox/messages").mock(side_effect=handler)

        await get_email(
            {**CONTEXT, "folder_id": "inbox", "filter": "isRead eq false", "search": "invoice"}
        )

        assert "/me/mailFolders/inbox/messages" in captured["url"]
        assert captured["query"]["$filter"] == "isRead eq false"
        assert captured["query"]["$search"] == "invoice"

    @respx.mock
    async def test_handles_message_with_no_sender(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/me/messages").mock(
            return_value=httpx.Response(
                200,
                json={
                    "value": [
                        {
                            "id": "m2",
                            "subject": "No sender",
                            "receivedDateTime": "2026-05-02T00:00:00Z",
                            "isRead": True,
                            "bodyPreview": "",
                            "hasAttachments": False,
                        }
                    ]
                },
            )
        )

        result = await get_email({**CONTEXT})
        assert result["messages"][0]["from"] == ""

    @respx.mock
    async def test_formats_sender_with_only_name_or_only_address(self) -> None:
        respx.get(f"{GRAPH_BASE_URL}/me/messages").mock(
            return_value=httpx.Response(
                200,
                json={
                    "value": [
                        {
                            "id": "m3",
                            "subject": "Name only",
                            "from": {"emailAddress": {"name": "Carol"}},
                            "receivedDateTime": "",
                            "isRead": False,
                            "bodyPreview": "",
                            "hasAttachments": False,
                        },
                        {
                            "id": "m4",
                            "subject": "Address only",
                            "from": {"emailAddress": {"address": "dave@contoso.com"}},
                            "receivedDateTime": "",
                            "isRead": False,
                            "bodyPreview": "",
                            "hasAttachments": False,
                        },
                    ]
                },
            )
        )

        result = await get_email({**CONTEXT})
        assert result["messages"][0]["from"] == "Carol"
        assert result["messages"][1]["from"] == "dave@contoso.com"


# ─── ms_send_email ────────────────────────────────────────────────────────────


class TestSendEmail:
    pytestmark = pytest.mark.asyncio

    async def test_validation_failed_when_required_params_missing(self) -> None:
        await _expect_matimo_error(send_email({**CONTEXT}), ErrorCode.VALIDATION_FAILED)

    async def test_validation_failed_when_to_is_not_a_list(self) -> None:
        error = await _expect_matimo_error(
            send_email({**CONTEXT, "to": "not-a-list", "subject": "Hi", "body": "Hello"}),
            ErrorCode.VALIDATION_FAILED,
        )
        assert error.details["field"] == "to"

    async def test_validation_failed_when_to_is_empty(self) -> None:
        await _expect_matimo_error(
            send_email({**CONTEXT, "to": [], "subject": "Hi", "body": "Hello"}),
            ErrorCode.VALIDATION_FAILED,
        )

    async def test_validation_failed_for_invalid_body_type(self) -> None:
        await _expect_matimo_error(
            send_email(
                {**CONTEXT, "to": ["a@b.com"], "subject": "Hi", "body": "Hello", "body_type": "markdown"}
            ),
            ErrorCode.VALIDATION_FAILED,
        )

    @respx.mock
    async def test_creates_draft_then_sends_it(self) -> None:
        draft_route = respx.post(f"{GRAPH_BASE_URL}/me/messages").mock(
            return_value=httpx.Response(201, json={"id": "draft-123"})
        )
        send_route = respx.post(f"{GRAPH_BASE_URL}/me/messages/draft-123/send").mock(
            return_value=httpx.Response(202)
        )

        result = await send_email(
            {
                **CONTEXT,
                "to": ["alice@contoso.com"],
                "cc": ["bob@contoso.com"],
                "bcc": ["eve@contoso.com"],
                "subject": "Weekly status",
                "body": "Here is the summary",
            }
        )

        assert result == {"success": True, "sent": True, "message_id": "draft-123"}
        assert draft_route.called
        assert send_route.called

        import json

        draft_body = json.loads(draft_route.calls[0].request.content)
        assert draft_body["toRecipients"] == [{"emailAddress": {"address": "alice@contoso.com"}}]
        assert draft_body["ccRecipients"] == [{"emailAddress": {"address": "bob@contoso.com"}}]
        assert draft_body["bccRecipients"] == [{"emailAddress": {"address": "eve@contoso.com"}}]
        assert draft_body["body"]["contentType"] == "Text"

    @respx.mock
    async def test_raises_execution_failed_when_draft_has_no_id(self) -> None:
        respx.post(f"{GRAPH_BASE_URL}/me/messages").mock(return_value=httpx.Response(201, json={}))

        await _expect_matimo_error(
            send_email({**CONTEXT, "to": ["alice@contoso.com"], "subject": "Hi", "body": "Hello"}),
            ErrorCode.EXECUTION_FAILED,
        )

    async def test_auth_failed_when_no_token(self) -> None:
        await _expect_matimo_error(
            send_email({"to": ["alice@contoso.com"], "subject": "Hi", "body": "Hello"}),
            ErrorCode.AUTH_FAILED,
        )


# ─── ms_send_teams_message ────────────────────────────────────────────────────


class TestSendTeamsMessage:
    pytestmark = pytest.mark.asyncio

    async def test_validation_failed_when_required_params_missing(self) -> None:
        await _expect_matimo_error(send_teams_message({**CONTEXT}), ErrorCode.VALIDATION_FAILED)

    async def test_validation_failed_for_invalid_content_type(self) -> None:
        await _expect_matimo_error(
            send_teams_message(
                {**CONTEXT, "team_id": "t1", "channel_id": "c1", "text": "hi", "content_type": "markdown"}
            ),
            ErrorCode.VALIDATION_FAILED,
        )

    @respx.mock
    async def test_posts_a_new_channel_message(self) -> None:
        route = respx.post(f"{GRAPH_BASE_URL}/teams/t1/channels/c1/messages").mock(
            return_value=httpx.Response(
                201, json={"id": "msg-1", "webUrl": "https://teams.microsoft.com/msg-1", "createdDateTime": "2026-05-01T00:00:00Z"}
            )
        )

        result = await send_teams_message({**CONTEXT, "team_id": "t1", "channel_id": "c1", "text": "Hello team"})

        assert result == {
            "success": True,
            "message_id": "msg-1",
            "web_url": "https://teams.microsoft.com/msg-1",
            "created_at": "2026-05-01T00:00:00Z",
        }
        assert route.called

    @respx.mock
    async def test_posts_a_threaded_reply_when_reply_to_message_id_given(self) -> None:
        route = respx.post(f"{GRAPH_BASE_URL}/teams/t1/channels/c1/messages/parent-1/replies").mock(
            return_value=httpx.Response(201, json={"id": "reply-1", "webUrl": "", "createdDateTime": ""})
        )

        result = await send_teams_message(
            {**CONTEXT, "team_id": "t1", "channel_id": "c1", "text": "Reply", "reply_to_message_id": "parent-1"}
        )

        assert result["message_id"] == "reply-1"
        assert route.called


# ─── ms_create_document ───────────────────────────────────────────────────────


class TestCreateDocument:
    pytestmark = pytest.mark.asyncio

    async def test_validation_failed_when_required_params_missing(self) -> None:
        await _expect_matimo_error(create_document({**CONTEXT}), ErrorCode.VALIDATION_FAILED)

    async def test_validation_failed_for_invalid_encoding(self) -> None:
        await _expect_matimo_error(
            create_document(
                {**CONTEXT, "drive_id": "d1", "filename": "f.txt", "content": "hi", "content_encoding": "binary"}
            ),
            ErrorCode.VALIDATION_FAILED,
        )

    async def test_validation_failed_for_invalid_conflict_behaviour(self) -> None:
        await _expect_matimo_error(
            create_document(
                {
                    **CONTEXT,
                    "drive_id": "d1",
                    "filename": "f.txt",
                    "content": "hi",
                    "conflict_behaviour": "overwrite",
                }
            ),
            ErrorCode.VALIDATION_FAILED,
        )

    async def test_validation_failed_when_content_exceeds_size_limit(self) -> None:
        too_big = "a" * (4 * 1024 * 1024 + 1)
        error = await _expect_matimo_error(
            create_document({**CONTEXT, "drive_id": "d1", "filename": "f.txt", "content": too_big}),
            ErrorCode.VALIDATION_FAILED,
        )
        assert error.details["sizeBytes"] == len(too_big)

    @respx.mock
    async def test_uploads_text_content_with_octet_stream_header(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["content_type"] = request.headers.get("content-type")
            captured["body"] = request.content
            captured["query"] = dict(request.url.params)
            return httpx.Response(
                201,
                json={"id": "item-1", "name": "f.txt", "webUrl": "https://contoso.sharepoint.com/f.txt", "size": 5},
            )

        respx.put(f"{GRAPH_BASE_URL}/drives/d1/items/root:/f.txt:/content").mock(side_effect=handler)

        result = await create_document({**CONTEXT, "drive_id": "d1", "filename": "f.txt", "content": "hello"})

        assert result == {
            "success": True,
            "item_id": "item-1",
            "name": "f.txt",
            "web_url": "https://contoso.sharepoint.com/f.txt",
            "size_bytes": 5,
        }
        assert captured["content_type"] == "application/octet-stream"
        assert captured["body"] == b"hello"
        assert captured["query"]["@microsoft.graph.conflictBehavior"] == "replace"

    @respx.mock
    async def test_uploads_base64_content_decoded_to_raw_bytes(self) -> None:
        captured: dict[str, Any] = {}
        encoded = base64.b64encode(b"binary-payload").decode("ascii")

        def handler(request: httpx.Request) -> httpx.Response:
            captured["body"] = request.content
            return httpx.Response(201, json={"id": "item-2", "name": "f.bin", "webUrl": "", "size": 14})

        respx.put(f"{GRAPH_BASE_URL}/drives/d1/items/root:/f.bin:/content").mock(side_effect=handler)

        await create_document(
            {**CONTEXT, "drive_id": "d1", "filename": "f.bin", "content": encoded, "content_encoding": "base64"}
        )

        assert captured["body"] == b"binary-payload"

    @respx.mock
    async def test_lenient_base64_decoding_never_raises_on_malformed_input(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["body"] = request.content
            return httpx.Response(201, json={"id": "item-3", "name": "f.bin", "webUrl": "", "size": 0})

        respx.put(f"{GRAPH_BASE_URL}/drives/d1/items/root:/f.bin:/content").mock(side_effect=handler)

        await create_document(
            {**CONTEXT, "drive_id": "d1", "filename": "f.bin", "content": "!!!not-base64!!!", "content_encoding": "base64"}
        )

        assert isinstance(captured["body"], bytes)


# ─── ms_create_calendar_event ─────────────────────────────────────────────────


class TestCreateCalendarEvent:
    pytestmark = pytest.mark.asyncio

    async def test_validation_failed_when_required_params_missing(self) -> None:
        await _expect_matimo_error(create_calendar_event({**CONTEXT}), ErrorCode.VALIDATION_FAILED)

    async def test_validation_failed_when_attendees_is_not_a_list_of_strings(self) -> None:
        await _expect_matimo_error(
            create_calendar_event(
                {
                    **CONTEXT,
                    "subject": "Sync",
                    "start": "2026-06-01T10:00:00",
                    "end": "2026-06-01T11:00:00",
                    "attendees": "not-a-list",
                }
            ),
            ErrorCode.VALIDATION_FAILED,
        )

    @respx.mock
    async def test_creates_a_basic_event(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            import json

            captured["body"] = json.loads(request.content)
            return httpx.Response(
                201, json={"id": "evt-1", "webLink": "https://outlook.office.com/evt-1"}
            )

        respx.post(f"{GRAPH_BASE_URL}/me/events").mock(side_effect=handler)

        result = await create_calendar_event(
            {**CONTEXT, "subject": "Sync", "start": "2026-06-01T10:00:00", "end": "2026-06-01T11:00:00"}
        )

        assert result == {"success": True, "event_id": "evt-1", "web_link": "https://outlook.office.com/evt-1"}
        body = captured["body"]
        assert body["start"] == {"dateTime": "2026-06-01T10:00:00", "timeZone": "UTC"}
        assert "attendees" not in body
        assert body["isOnlineMeeting"] is False
        assert "join_url" not in result

    @respx.mock
    async def test_creates_an_online_meeting_with_attendees_and_returns_join_url(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            import json

            captured["body"] = json.loads(request.content)
            return httpx.Response(
                201,
                json={
                    "id": "evt-2",
                    "webLink": "https://outlook.office.com/evt-2",
                    "onlineMeeting": {"joinUrl": "https://teams.microsoft.com/meet/evt-2"},
                },
            )

        respx.post(f"{GRAPH_BASE_URL}/me/events").mock(side_effect=handler)

        result = await create_calendar_event(
            {
                **CONTEXT,
                "subject": "Planning",
                "start": "2026-06-02T09:00:00",
                "end": "2026-06-02T10:00:00",
                "attendees": ["alice@contoso.com"],
                "is_online_meeting": True,
                "location": "Conference Room",
                "body": "Agenda inside",
            }
        )

        assert result["join_url"] == "https://teams.microsoft.com/meet/evt-2"
        body = captured["body"]
        assert body["attendees"] == [{"emailAddress": {"address": "alice@contoso.com"}, "type": "required"}]
        assert body["isOnlineMeeting"] is True
        assert body["onlineMeetingProvider"] == "teamsForBusiness"
        assert body["location"] == {"displayName": "Conference Room"}
        assert body["body"] == {"contentType": "Text", "content": "Agenda inside"}


# ─── ms_publish_to_sharepoint ─────────────────────────────────────────────────


class TestPublishToSharepoint:
    pytestmark = pytest.mark.asyncio

    async def test_validation_failed_when_required_params_missing(self) -> None:
        await _expect_matimo_error(publish_to_sharepoint({**CONTEXT}), ErrorCode.VALIDATION_FAILED)

    async def test_validation_failed_for_invalid_content_type(self) -> None:
        await _expect_matimo_error(
            publish_to_sharepoint(
                {**CONTEXT, "site_id": "s1", "title": "Hello", "content": "World", "content_type": "markdown"}
            ),
            ErrorCode.VALIDATION_FAILED,
        )

    @respx.mock
    async def test_creates_and_publishes_a_page_with_html_escaped_text_content(self) -> None:
        captured: dict[str, Any] = {}

        def create_handler(request: httpx.Request) -> httpx.Response:
            import json

            captured["create_body"] = json.loads(request.content)
            return httpx.Response(
                201, json={"id": "page-1", "webUrl": "https://contoso.sharepoint.com/pages/hello.aspx"}
            )

        create_route = respx.post(f"{GRAPH_BASE_URL}/sites/s1/pages").mock(side_effect=create_handler)
        publish_route = respx.post(
            f"{GRAPH_BASE_URL}/sites/s1/pages/page-1/microsoft.graph.sitePage/publish"
        ).mock(return_value=httpx.Response(204))

        result = await publish_to_sharepoint(
            {**CONTEXT, "site_id": "s1", "title": "Hello & <World>", "content": "Body & text", "content_type": "text"}
        )

        assert result == {
            "success": True,
            "page_id": "page-1",
            "web_url": "https://contoso.sharepoint.com/pages/hello.aspx",
            "published": True,
        }
        assert create_route.called
        assert publish_route.called

        web_part = captured["create_body"]["canvasLayout"]["horizontalSections"][0]["columns"][0]["webparts"][0]
        assert web_part["innerHtml"] == "<p>Body &amp; text</p>"
        assert captured["create_body"]["name"] == "hello-world.aspx"

    @respx.mock
    async def test_skips_publish_call_when_publish_is_false(self) -> None:
        respx.post(f"{GRAPH_BASE_URL}/sites/s1/pages").mock(
            return_value=httpx.Response(201, json={"id": "page-2", "webUrl": ""})
        )
        publish_route = respx.post(
            f"{GRAPH_BASE_URL}/sites/s1/pages/page-2/microsoft.graph.sitePage/publish"
        ).mock(return_value=httpx.Response(204))

        result = await publish_to_sharepoint(
            {**CONTEXT, "site_id": "s1", "title": "Draft", "content": "<p>Raw HTML</p>", "publish": False}
        )

        assert result["published"] is False
        assert not publish_route.called

    @respx.mock
    async def test_raises_execution_failed_when_page_has_no_id(self) -> None:
        respx.post(f"{GRAPH_BASE_URL}/sites/s1/pages").mock(return_value=httpx.Response(201, json={}))

        await _expect_matimo_error(
            publish_to_sharepoint({**CONTEXT, "site_id": "s1", "title": "Hello", "content": "World"}),
            ErrorCode.EXECUTION_FAILED,
        )

    async def test_auth_failed_when_no_token(self) -> None:
        await _expect_matimo_error(
            publish_to_sharepoint({"site_id": "s1", "title": "Hello", "content": "World"}),
            ErrorCode.AUTH_FAILED,
        )


def test_tool_names_cover_all_nine_tools() -> None:
    assert len(TOOL_NAMES) == 9
    assert len(set(TOOL_NAMES)) == 9
