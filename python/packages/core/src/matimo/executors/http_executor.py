"""
HTTP executor — makes HTTP requests for 'type: http' tools.
Mirrors: packages/core/src/executors/http-executor.ts
"""
from __future__ import annotations

import base64
import logging
import re
import time
from typing import Any

import httpx

from matimo.core.models import HttpExecution, ToolDefinition
from matimo.encodings.parameter_encoding import apply_parameter_encodings
from matimo.errors import ErrorCode, MatimoError, from_http_error

logger = logging.getLogger("matimo")

_PLACEHOLDER_RE = re.compile(r"\{([^}]+)\}")


class HttpExecutor:
    """
    Executes HTTP tools using httpx.
    Mirrors: HttpExecutor in http-executor.ts

    Security:
    - Credentials are never logged.
    - URL placeholders are validated before request dispatch.
    - Basic auth credentials are base64-encoded per RFC 7617.
    """

    async def execute(
        self,
        tool: ToolDefinition,
        params: dict[str, Any],
        credentials: dict[str, str] | None = None,
    ) -> Any:  # noqa: ANN401
        """
        Execute an HTTP tool.

        Returns Any because tools return parsed JSON (dict/list/str/number) or raw text.

        Raises:
            MatimoError on validation, timeout, or HTTP error.
        """
        exec_cfg = tool.execution
        if not isinstance(exec_cfg, HttpExecution):
            raise MatimoError(
                f"Tool '{tool.name}' is not an HTTP tool",
                ErrorCode.EXECUTION_FAILED,
                {"tool_name": tool.name, "execution_type": exec_cfg.type},
            )

        start = time.monotonic()

        # 1. Apply parameter encodings (e.g. Gmail MIME base64url)
        working_params = dict(params)
        if exec_cfg.parameter_encoding:
            encodings = [e.model_dump() for e in exec_cfg.parameter_encoding]
            working_params = apply_parameter_encodings(working_params, encodings)

        # 2. Build credential lookup: per-call overrides take priority
        creds = dict(credentials or {})

        # 3. Template URL + validate all placeholders are present
        url = self._template(exec_cfg.url, working_params, creds)

        # 4. Template headers
        headers: dict[str, str] = {}
        for k, v in (exec_cfg.headers or {}).items():
            headers[k] = self._template(v, working_params, creds)

        # 5. Handle Basic auth injection
        if tool.authentication and tool.authentication.type and tool.authentication.type.value == "basic":
            headers = self._apply_basic_auth(headers, tool, creds)

        # 6. Build query params — skip optional params that were not provided
        query_params: dict[str, str] = {}
        for k, v in (exec_cfg.query_params or exec_cfg.params or {}).items():
            # If the value is a bare placeholder like "{cursor}", check whether the
            # referenced param is optional and was not supplied — if so, omit it.
            bare_match = re.fullmatch(r"\{([^}]+)\}", str(v)) if v is not None else None
            if bare_match:
                placeholder_name = bare_match.group(1)
                param_def = (tool.parameters or {}).get(placeholder_name)
                is_optional = param_def is not None and not getattr(param_def, "required", True)
                if is_optional and placeholder_name not in (working_params or {}):
                    continue
            try:
                query_params[k] = self._template(v, working_params, creds)
            except MatimoError as exc:
                if exc.code == ErrorCode.INVALID_PARAMETER:
                    # Optional param not provided — omit from query string
                    param_def = (tool.parameters or {}).get(k)
                    is_optional = param_def is None or not getattr(param_def, "required", True)
                    if is_optional:
                        continue
                raise

        # 7. Template body
        body = self._template_object(exec_cfg.body, working_params, creds, tool.parameters)

        # 8. Determine Content-Type and prepare request body
        content_type = headers.get("Content-Type", headers.get("content-type", ""))
        request_content: Any = None
        request_data: Any = None
        request_json: Any = None

        if body is not None:
            if "application/x-www-form-urlencoded" in content_type:
                request_data = body
            else:
                request_json = body

        # 9. Dispatch
        timeout_ms = exec_cfg.timeout or 30_000
        timeout_s = timeout_ms / 1000.0

        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                response = await client.request(
                    method=exec_cfg.method,
                    url=url,
                    headers=headers,
                    params=query_params if query_params else None,
                    json=request_json,
                    data=request_data,
                    content=request_content,
                )
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            duration = time.monotonic() - start
            raise MatimoError(
                f"Tool '{tool.name}' timed out after {duration:.1f}s",
                ErrorCode.TIMEOUT,
                {"tool_name": tool.name, "timeout_ms": timeout_ms},
                cause=exc,
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise from_http_error(exc, f"HTTP error executing tool '{tool.name}'") from exc
        except httpx.RequestError as exc:
            raise MatimoError(
                f"Network error executing tool '{tool.name}': {exc}",
                ErrorCode.NETWORK_ERROR,
                {"tool_name": tool.name},
                cause=exc,
            ) from exc

        # 10. Parse response
        content_type_resp = response.headers.get("content-type", "")
        if "application/json" in content_type_resp:
            return response.json()
        return response.text

    # ------------------------------------------------------------------
    # Templating helpers
    # ------------------------------------------------------------------

    def _template(
        self,
        value: str,
        params: dict[str, Any],
        creds: dict[str, str],
    ) -> str:
        """
        Replace {placeholder} tokens in a string with parameter or credential values.
        Raises MatimoError(INVALID_PARAMETER) if a placeholder has no value.
        """
        def replacer(m: re.Match[str]) -> str:
            name = m.group(1)
            # Params take priority, then env-level credentials
            if name in params:
                return str(params[name])
            if name in creds:
                return creds[name]
            # Fall back to env var of the same name (single-tenant mode)
            import os
            env_val = os.environ.get(name)
            if env_val is not None:
                return env_val
            raise MatimoError(
                f"Missing value for placeholder '{{{name}}}'",
                ErrorCode.INVALID_PARAMETER,
                {"placeholder": name},
            )

        return _PLACEHOLDER_RE.sub(replacer, value)

    def _template_object(
        self,
        obj: object,
        params: dict[str, Any],
        creds: dict[str, str],
        param_definitions: dict[str, Any] | None = None,
    ) -> Any:  # noqa: ANN401
        # Returns the same JSON-like structure (str/dict/list/None) — Any is accurate.
        """Recursively template strings within dicts/lists.

        When a string value is exactly a single placeholder (e.g. ``"{page_size}"``)
        and the corresponding parameter is typed ``number`` or ``boolean`` in the tool
        schema, the substituted value is coerced to the correct Python type so that
        JSON serialisation sends the right type (e.g. ``5`` not ``"5"``).
        Also mirrors the TypeScript behaviour of embedding ``object``/``array``
        parameters directly without stringification.
        """
        if obj is None:
            return None
        if isinstance(obj, str):
            single_match = re.fullmatch(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}", obj)
            if single_match:
                param_name = single_match.group(1)
                param_value = params.get(param_name)
                # Embed object/array parameters directly (no stringification)
                if param_value is not None and isinstance(param_value, (dict, list)):
                    return param_value
                # Coerce to correct primitive type based on schema
                if param_value is not None and param_definitions:
                    param_def = param_definitions.get(param_name)
                    if param_def is not None:
                        param_type = getattr(param_def, "type", None)
                        if param_type == "number":
                            try:
                                float_val = float(param_value)
                                if int(float_val) == float_val:
                                    return int(param_value)
                                return float_val
                            except (ValueError, TypeError):
                                pass
                        elif param_type == "boolean":
                            return param_value in (True, "true", "1", "yes")
            templated = self._template(obj, params, creds)
            return templated
        if isinstance(obj, dict):
            result: dict[str, Any] = {}
            for k, v in obj.items():
                try:
                    templated = self._template_object(v, params, creds, param_definitions)
                    # Skip None and empty nested dicts (mirrors TS: "Only include nested object if it has content")
                    if isinstance(templated, dict) and not templated:
                        continue
                    if templated is None:
                        continue
                    result[k] = templated
                except MatimoError as exc:
                    if exc.code == ErrorCode.INVALID_PARAMETER:
                        param_def = (param_definitions or {}).get(k)
                        is_optional = param_def is None or not getattr(param_def, "required", True)
                        if is_optional:
                            continue
                    raise
            return result
        if isinstance(obj, list):
            return [self._template_object(item, params, creds, param_definitions) for item in obj]
        return obj

    # ------------------------------------------------------------------
    # Auth helpers
    # ------------------------------------------------------------------

    def _apply_basic_auth(
        self,
        headers: dict[str, str],
        tool: ToolDefinition,
        creds: dict[str, str],
    ) -> dict[str, str]:
        """
        Inject HTTP Basic authentication header.
        Reads username/password from per-call credentials or process env.
        SECURITY: credentials are never logged.
        """
        import os

        auth_cfg = tool.authentication
        if auth_cfg is None:
            return headers

        username_env = auth_cfg.username_env or f"{tool.name.upper()}_USERNAME"
        password_env = auth_cfg.password_env or f"{tool.name.upper()}_PASSWORD"

        username = creds.get(username_env) or os.environ.get(username_env, "")
        password = creds.get(password_env) or os.environ.get(password_env, "")

        if not username and not password:
            return headers  # no basic creds available — let request proceed

        token = base64.b64encode(f"{username}:{password}".encode()).decode()
        headers = dict(headers)
        headers["Authorization"] = f"Basic {token}"
        return headers
