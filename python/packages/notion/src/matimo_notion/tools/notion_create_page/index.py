"""
notion_create_page — Creates a new page in a Notion database or as a child page.
Mirrors: typescript/packages/notion/tools/notion_create_page/index.ts
"""
from __future__ import annotations

import os
import re
from typing import Any

import httpx

from matimo.errors import ErrorCode, MatimoError

_NOTION_VERSION = "2022-06-28"
_NOTION_PAGES_URL = "https://api.notion.com/v1/pages"
_NOTION_DATABASES_URL = "https://api.notion.com/v1/databases"


def _markdown_to_children(md: str) -> list[dict]:
    """Convert markdown text to Notion block children (headings + paragraphs)."""
    blocks: list[dict] = []
    for part in re.split(r"\n\n+", md):
        part = part.strip()
        if not part:
            continue
        if part.startswith("### "):
            blocks.append({
                "object": "block", "type": "heading_3",
                "heading_3": {"rich_text": [{"type": "text", "text": {"content": part[4:]}}]},
            })
        elif part.startswith("## "):
            blocks.append({
                "object": "block", "type": "heading_2",
                "heading_2": {"rich_text": [{"type": "text", "text": {"content": part[3:]}}]},
            })
        elif part.startswith("# "):
            blocks.append({
                "object": "block", "type": "heading_1",
                "heading_1": {"rich_text": [{"type": "text", "text": {"content": part[2:]}}]},
            })
        else:
            blocks.append({
                "object": "block", "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": part}}]},
            })
    return blocks


async def run(params: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ.get("NOTION_API_KEY")
    if not api_key:
        raise MatimoError(
            "NOTION_API_KEY not set",
            ErrorCode.AUTH_FAILED,
            {"env_var": "NOTION_API_KEY"},
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Notion-Version": _NOTION_VERSION,
        "Content-Type": "application/json",
    }

    parent: dict | None = params.get("parent")
    properties: dict | None = params.get("properties")
    icon: dict | None = params.get("icon")
    cover: dict | None = params.get("cover")
    children: list | None = params.get("children")
    markdown: str | None = params.get("markdown")
    template: dict | None = params.get("template")
    position: dict | None = params.get("position")

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Auto-discover a database if parent not provided
        if not parent:
            resp = await client.get(_NOTION_DATABASES_URL, headers=headers, params={"page_size": 1})
            if resp.status_code != 200:
                raise MatimoError(
                    f"Failed to auto-discover database: {resp.text}",
                    ErrorCode.EXECUTION_FAILED,
                )
            databases = resp.json().get("results", [])
            if not databases:
                raise MatimoError(
                    "No databases found in workspace. Create a database first or provide `parent` parameter.",
                    ErrorCode.EXECUTION_FAILED,
                )
            parent = {"database_id": databases[0]["id"]}

        # Validate: children and markdown are mutually exclusive
        has_children = isinstance(children, list) and len(children) > 0
        has_markdown = isinstance(markdown, str) and markdown.strip()

        if has_children and has_markdown:
            raise MatimoError(
                "Provide either `children` or `markdown`, not both",
                ErrorCode.VALIDATION_FAILED,
                {"children": len(children), "markdown": len(markdown)},
            )

        if template and has_children:
            raise MatimoError(
                "`template` cannot be used together with `children`.",
                ErrorCode.VALIDATION_FAILED,
            )

        # Convert markdown → children if needed
        if not has_children and has_markdown:
            children = _markdown_to_children(markdown)

        is_database_parent = isinstance(parent, dict) and "database_id" in parent

        # Build base request body
        body: dict[str, Any] = {"parent": parent}
        if properties:
            body["properties"] = properties
        if icon:
            body["icon"] = icon
        if cover:
            body["cover"] = cover
        if children:
            body["children"] = children
        if template:
            body["template"] = template
        if position:
            body["position"] = position

        # When creating in a database without explicit properties, try common title field names
        title_candidates = None
        if is_database_parent and not properties and has_markdown:
            first_line = re.sub(r"^#+\s*", "", markdown.split("\n")[0]).strip() or "New Page"
            title_candidates = ["Name", "Title", "title", "name"]

        if title_candidates:
            last_error: dict | None = None
            for candidate in title_candidates:
                candidate_props = {
                    candidate: {"title": [{"text": {"content": first_line}}]}
                }
                try_body = {**body, "properties": candidate_props}
                resp = await client.post(_NOTION_PAGES_URL, headers=headers, json=try_body)
                if resp.status_code == 200:
                    return {"success": True, "status_code": resp.status_code, "data": resp.json()}
                err_data = resp.json()
                msg = err_data.get("message", "")
                if "is not a property that exists" in msg:
                    last_error = err_data
                    continue
                # Non-recoverable error
                return {"success": False, "status_code": resp.status_code, "error": err_data}

            return {"success": False, "status_code": 0, "error": last_error or "All title candidates failed"}

        # Single request
        resp = await client.post(_NOTION_PAGES_URL, headers=headers, json=body)
        if resp.status_code == 200:
            return {"success": True, "status_code": resp.status_code, "data": resp.json()}

        err_data = resp.json()
        raise MatimoError(
            err_data.get("message", "Notion API error"),
            ErrorCode.EXECUTION_FAILED,
            {
                "status": resp.status_code,
                "code": err_data.get("code"),
                "request_id": err_data.get("request_id"),
            },
        )
