"""
ms_publish_to_sharepoint
  Create:  POST /sites/{site-id}/pages
           https://learn.microsoft.com/en-us/graph/api/sitepage-create
  Publish: POST /sites/{site-id}/pages/{page-id}/microsoft.graph.sitePage/publish
           https://learn.microsoft.com/en-us/graph/api/sitepage-publish
Mirrors: typescript/packages/microsoft/tools/ms_publish_to_sharepoint/ms_publish_to_sharepoint.ts

Site pages always store web part bodies as HTML, so plain-text content is
HTML-escaped and wrapped in a single <p> before being placed in a textWebPart.
"""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

from matimo.errors import ErrorCode, MatimoError
from matimo_microsoft.graph_client import get_access_token, graph_request, require_params

_VALID_CONTENT_TYPES = ["html", "text"]

_HTML_ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
}


def _escape_html(text: str) -> str:
    return re.sub(r"[&<>\"']", lambda m: _HTML_ESCAPES[m.group(0)], text)


def _derive_file_name(title: str) -> str:
    slug = re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", title.lower().strip()))
    return f"{slug or 'page'}.aspx"


async def run(params: dict[str, Any]) -> dict[str, Any]:
    require_params(params, ["site_id", "title", "content"], "ms_publish_to_sharepoint")

    site_id = str(params["site_id"])
    title = str(params["title"])

    content_type_param = params.get("content_type")
    content_type = "html" if content_type_param is None else str(content_type_param)
    if content_type not in _VALID_CONTENT_TYPES:
        raise MatimoError(
            f"ms_publish_to_sharepoint: 'content_type' must be one of {', '.join(_VALID_CONTENT_TYPES)} "
            f"(received '{content_type}')",
            ErrorCode.VALIDATION_FAILED,
            {"content_type": content_type_param},
        )

    raw_content = str(params["content"])
    inner_html = f"<p>{_escape_html(raw_content)}</p>" if content_type == "text" else raw_content

    publish_param = params.get("publish")
    should_publish = True if publish_param is None else publish_param is True

    token = get_access_token(params)

    page = await graph_request(
        method="POST",
        path=f"/sites/{quote(site_id, safe='')}/pages",
        token=token,
        resource_type="SharePoint site",
        body={
            "@odata.type": "#microsoft.graph.sitePage",
            "name": _derive_file_name(title),
            "title": title,
            "pageLayout": "article",
            "canvasLayout": {
                "horizontalSections": [
                    {
                        "layout": "oneColumn",
                        "id": "1",
                        "emphasis": "none",
                        "columns": [
                            {
                                "id": "1",
                                "width": 12,
                                "webparts": [
                                    {
                                        "@odata.type": "#microsoft.graph.textWebPart",
                                        "innerHtml": inner_html,
                                    }
                                ],
                            }
                        ],
                    }
                ]
            },
        },
    )
    page = page if isinstance(page, dict) else {}

    page_id = page.get("id")
    if not page_id:
        raise MatimoError(
            "ms_publish_to_sharepoint: Microsoft Graph did not return an ID for the created page.",
            ErrorCode.EXECUTION_FAILED,
            {"page": page},
        )

    if should_publish:
        await graph_request(
            method="POST",
            path=f"/sites/{quote(site_id, safe='')}/pages/{quote(page_id, safe='')}/microsoft.graph.sitePage/publish",
            token=token,
            resource_type="SharePoint page",
            allow_empty_response=True,
        )

    return {
        "success": True,
        "page_id": page_id,
        "web_url": page.get("webUrl") or "",
        "published": should_publish,
    }
