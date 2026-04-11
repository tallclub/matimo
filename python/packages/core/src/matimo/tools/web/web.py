"""Web tool — fetch web content from URLs."""
from __future__ import annotations

import time

import httpx


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    url: str = params["url"]
    method: str = params.get("method", "GET").upper()
    headers: dict = params.get("headers", {})  # type: ignore[type-arg]
    body: str | None = params.get("body")
    timeout_ms: int = int(params.get("timeout", 30000))
    parse_json: bool = bool(params.get("parseJson", True))
    follow_redirects: bool = bool(params.get("followRedirects", True))

    merged_headers = {
        "User-Agent": "Matimo/1.0 (AI Agent Tool SDK)",
        "Accept": "application/json, text/plain, text/html, */*",
        **headers,
    }

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(
            follow_redirects=follow_redirects,
            timeout=timeout_ms / 1000.0,
        ) as client:
            req_kwargs: dict = {"headers": merged_headers}  # type: ignore[type-arg]
            if body and method in ("POST", "PUT", "PATCH"):
                req_kwargs["content"] = body
            response = await client.request(method, url, **req_kwargs)

        duration = int((time.monotonic() - start) * 1000)
        content_type = response.headers.get("content-type", "")

        if parse_json and "application/json" in content_type:
            try:
                content = response.json()
            except Exception:
                content = response.text
        else:
            content = response.text

        return {
            "success": response.status_code < 400,
            "url": str(response.url),
            "statusCode": response.status_code,
            "statusText": str(response.status_code),
            "contentType": content_type,
            "content": content,
            "headers": dict(response.headers),
            "size": len(response.content),
            "duration": duration,
        }
    except httpx.TimeoutException:
        duration = int((time.monotonic() - start) * 1000)
        return {
            "success": False,
            "url": url,
            "statusCode": 0,
            "statusText": "Timeout",
            "contentType": "",
            "content": f"Request timed out after {timeout_ms}ms",
            "headers": {},
            "size": 0,
            "duration": duration,
        }
    except Exception as exc:
        duration = int((time.monotonic() - start) * 1000)
        return {
            "success": False,
            "url": url,
            "statusCode": 0,
            "statusText": "Error",
            "contentType": "",
            "content": str(exc),
            "headers": {},
            "size": 0,
            "duration": duration,
        }
