"""
Shared Microsoft Graph helpers for all 'type: function' tools in this package.
Mirrors: typescript/packages/microsoft/tools/graph-client.ts

Conventions (mirrors matimo-slack and matimo-gmail):
- Tools NEVER perform OAuth token exchange. A delegated Graph access token is
  injected at execution time via params['MICROSOFT_GRAPH_ACCESS_TOKEN'] (merged
  from credentials by the function executor) or the MICROSOFT_GRAPH_ACCESS_TOKEN
  environment variable as a fallback.
- Every Graph error is normalized into a MatimoError with the closest matching
  ErrorCode (Matimo has no per-provider error classes — see matimo.errors).
- Unlike the TypeScript executor, Python's MatimoInstance.execute() re-raises
  MatimoError rather than converting it to {success: False} — every failure path
  here raises directly.
"""
from __future__ import annotations

import asyncio
import os
from typing import Any, Literal

import httpx

from matimo.errors import ErrorCode, MatimoError

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"

_RETRYABLE_STATUS_CODES = {429, 500, 503}
_MAX_RETRIES = 3
_INITIAL_BACKOFF_S = 0.5

HttpMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE"]
ResponseType = Literal["json", "bytes"]


def get_access_token(params: dict[str, Any]) -> str:
    """
    Resolve the delegated Graph access token. Matimo never exchanges OAuth codes —
    the token must already be present in the merged params (credentials) or the
    environment.
    """
    token = params.get("MICROSOFT_GRAPH_ACCESS_TOKEN") or os.environ.get(
        "MICROSOFT_GRAPH_ACCESS_TOKEN"
    )

    if not token:
        raise MatimoError(
            "Microsoft Graph access token is missing. Provide it via "
            "credentials.MICROSOFT_GRAPH_ACCESS_TOKEN or the MICROSOFT_GRAPH_ACCESS_TOKEN "
            "environment variable. Matimo never performs the OAuth exchange itself — "
            "connect Microsoft in Nova first.",
            ErrorCode.AUTH_FAILED,
            {"provider": "microsoft", "placeholder": "MICROSOFT_GRAPH_ACCESS_TOKEN"},
        )

    return str(token)


def require_params(params: dict[str, Any], required: list[str], tool_name: str) -> None:
    """
    Validate required parameters BEFORE any network call, mirroring the
    "ValidationError before any API call" requirement. Raises VALIDATION_FAILED.
    """
    missing = [name for name in required if params.get(name) in (None, "")]

    if missing:
        raise MatimoError(
            f"{tool_name}: missing required parameter(s): {', '.join(missing)}",
            ErrorCode.VALIDATION_FAILED,
            {"toolName": tool_name, "missingParams": missing},
        )


def map_graph_error(
    status: int,
    data: Any,
    headers: httpx.Headers | dict[str, str] | None,
    resource_type: str,
) -> MatimoError:
    """
    Map a Microsoft Graph HTTP error response onto a MatimoError using the closest
    matching ErrorCode (Matimo has no CredentialError/NotFoundError/ProviderError
    classes — see matimo.errors):
      401/403 -> AUTH_FAILED         ("Microsoft Graph access denied. Check connection status in Nova.")
      404     -> FILE_NOT_FOUND      (details.resourceType identifies what was missing)
      429     -> RATE_LIMIT_EXCEEDED (details.retryAfterSeconds carries Retry-After)
      500/503 -> EXECUTION_FAILED    (retryable)
      other   -> EXECUTION_FAILED
    """
    graph_error = data.get("error") if isinstance(data, dict) else None
    details: dict[str, Any] = {"statusCode": status, "graphError": graph_error, "resourceType": resource_type}

    if status in (401, 403):
        return MatimoError(
            "Microsoft Graph access denied. Check connection status in Nova.",
            ErrorCode.AUTH_FAILED,
            details,
        )

    if status == 404:
        return MatimoError(f"{resource_type} not found.", ErrorCode.FILE_NOT_FOUND, details)

    if status == 429:
        retry_after_header = None
        if headers is not None:
            retry_after_header = headers.get("retry-after") or headers.get("Retry-After")
        retry_after_seconds = float(retry_after_header) if retry_after_header is not None else None
        return MatimoError(
            "Microsoft Graph rate limit exceeded. Respect Retry-After before retrying.",
            ErrorCode.RATE_LIMIT_EXCEEDED,
            {**details, "retryAfterSeconds": retry_after_seconds},
        )

    if status in (500, 503):
        return MatimoError(
            "Microsoft Graph service is temporarily unavailable. Please retry shortly.",
            ErrorCode.EXECUTION_FAILED,
            details,
        )

    return MatimoError(
        f"Microsoft Graph request failed with status {status}.",
        ErrorCode.EXECUTION_FAILED,
        details,
    )


async def graph_request(
    *,
    method: HttpMethod,
    path: str,
    token: str,
    query: dict[str, Any] | None = None,
    body: Any = None,
    headers: dict[str, str] | None = None,
    resource_type: str = "Resource",
    response_type: ResponseType = "json",
    allow_empty_response: bool = False,
) -> Any:
    """
    Perform an authenticated Microsoft Graph request with retry-on-429/5xx
    (respecting Retry-After, exponential backoff, max 3 retries) and normalized
    MatimoError mapping for every other failure.

    Args:
        path: Path relative to https://graph.microsoft.com/v1.0, e.g. '/me/messages'
        response_type: 'bytes' for binary downloads (e.g. file content)
        allow_empty_response: Treat a 204/empty body as success and return None
            (e.g. publish, sendMail)
    """
    url = f"{GRAPH_BASE_URL}{path}"

    is_json_body = body is not None and not isinstance(body, (bytes, bytearray))
    request_headers: dict[str, str] = {
        "Authorization": f"Bearer {token}",
        **({"Accept": "application/json"} if response_type == "json" else {}),
        **({"Content-Type": "application/json"} if is_json_body else {}),
        **(headers or {}),
    }

    request_kwargs: dict[str, Any] = {}
    if isinstance(body, (bytes, bytearray)):
        request_kwargs["content"] = bytes(body)
    elif body is not None:
        request_kwargs["json"] = body

    filtered_query = {
        key: value
        for key, value in (query or {}).items()
        if value is not None and value != ""
    }

    attempt = 0
    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            try:
                response = await client.request(
                    method,
                    url,
                    params=filtered_query or None,
                    headers=request_headers,
                    **request_kwargs,
                )
            except httpx.HTTPError as exc:
                raise MatimoError(
                    "Microsoft Graph request failed before a response was received (network error).",
                    ErrorCode.NETWORK_ERROR,
                    {"path": path, "originalError": str(exc)},
                    cause=exc,
                ) from exc

            if 200 <= response.status_code < 300:
                if allow_empty_response and (response.status_code == 204 or not response.content):
                    return None
                if response_type == "bytes":
                    return response.content
                if not response.content:
                    return None
                return response.json()

            try:
                error_body: Any = response.json()
            except ValueError:
                error_body = None

            error = map_graph_error(response.status_code, error_body, response.headers, resource_type)

            is_retryable = response.status_code in _RETRYABLE_STATUS_CODES and attempt < _MAX_RETRIES
            if not is_retryable:
                raise error

            retry_after_seconds = error.details.get("retryAfterSeconds") if error.details else None
            delay_s = (
                retry_after_seconds
                if isinstance(retry_after_seconds, (int, float))
                else _INITIAL_BACKOFF_S * (2**attempt)
            )

            attempt += 1
            await asyncio.sleep(delay_s)
