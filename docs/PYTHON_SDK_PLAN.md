# Matimo Python SDK — Complete Implementation Plan & Architecture

> **✅ STATUS: COMPLETED** (Released in v0.1.0 - May 1, 2026)
>
> This document served as the implementation specification for the Matimo Python SDK.  
> **The Python SDK is now stable and production-ready.** This document is preserved for historical reference.
>
> **For current Python SDK documentation, see:**
> - [Quick Start Guide](./getting-started/QUICK_START.md#python-sdk)
> - [Python Examples](../python/examples/)
> - [Python SDK README](../python/README.md)
> - [LangChain Integration](./framework-integrations/LANGCHAIN.md#python-langchain-integration)
> - [CrewAI Integration](./framework-integrations/CREWAI.md)

---

## Historical Context

This document was created during the alpha phase (pre-v0.1.0-alpha.14) as an AI-agent-ready specification for implementing the entire Python SDK from scratch. It provided complete architectural guidance, ensuring feature parity with the TypeScript SDK.

**Key milestones achieved:**
- ✅ v0.1.0-alpha.14 (Apr 10, 2026): Python SDK official launch — 995 tests, 96.89% coverage
- ✅ v0.1.0 stable (May 1, 2026): Production-ready GA release
- ✅ Full TypeScript/Python feature parity
- ✅ LangChain, CrewAI, and MCP integrations
- ✅ All 10 provider packages published to PyPI

---

# Original Planning Document

> **Original Purpose:** This document is an AI-agent-ready, implementation-complete specification.
> An AI agent should be able to read this file and implement the entire Python SDK from scratch.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Architecture Overview](#2-architecture-overview)
3. [Package Layout](#3-package-layout)
4. [Data Models (Pydantic)](#4-data-models-pydantic)
5. [YAML Loader](#5-yaml-loader)
6. [Tool Registry](#6-tool-registry)
7. [Executors](#7-executors)
8. [Auth Injection](#8-auth-injection)
9. [Approval System](#9-approval-system)
10. [Parameter Encoding](#10-parameter-encoding)
11. [LangChain Integration](#11-langchain-integration)
12. [CrewAI Integration](#12-crewai-integration)
13. [Matimo Instance (Main Entry Point)](#13-matimo-instance-main-entry-point)
14. [Auto-Discovery](#14-auto-discovery)
15. [Error Handling](#15-error-handling)
16. [Logging](#16-logging)
17. [Provider Packages (pip)](#17-provider-packages-pip)
18. [Tests](#18-tests)
19. [Examples](#19-examples)
20. [CI / CD / Publishing](#20-ci--cd--publishing)
21. [Implementation Order](#21-implementation-order)
22. [Reference: TypeScript ↔ Python Mapping](#22-reference-typescript--python-mapping)

---

## 1. Design Principles

| Principle | Detail |
|---|---|
| **YAML is the single source of truth** | Python SDK reads the SAME `definition.yaml` files in `packages/{provider}/tools/`. No tool logic is duplicated. |
| **API parity with TypeScript SDK** | Class names, method names, and patterns mirror the TS SDK so developers feel at home in both languages. |
| **Thin runtime** | The Python SDK should be ~400-500 lines of core code. All intelligence lives in YAML. |
| **Zero Node.js dependency** | Python executes HTTP and command tools natively. Function-type tools use `.py` files (dual-file convention: `.ts` for TS SDK, `.py` for Python SDK coexisting in the same tool directory). The Python SDK never shells out to Node. |
| **Lazy framework imports** | `langchain`, `crewai`, etc. are optional deps. Import them lazily to avoid hard dependencies. |
| **Async-first, sync-friendly** | Public API is async (`await m.execute(...)`) with a sync convenience wrapper. |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  YAML Tool Definitions (SINGLE SOURCE OF TRUTH)         │
│  packages/{provider}/tools/{tool}/definition.yaml       │
│  ← Shared between TypeScript and Python SDKs            │
└─────────────┬───────────────────────┬───────────────────┘
              │                       │
    ┌─────────▼─────────┐   ┌────────▼────────┐
    │  TypeScript SDK    │   │  Python SDK     │ ← THIS DOCUMENT
    │  @matimo/core      │   │  matimo (PyPI)  │
    │  (existing)        │   │  (new)          │
    └─────────┬─────────┘   └────────┬────────┘
              │                       │
    Same execution model:             │
    - HttpExecutor                    ├─ HttpExecutor     → httpx
    - CommandExecutor                 ├─ CommandExecutor  → subprocess
    - FunctionExecutor                └─ FunctionExecutor → importlib (.py only, zero Node.js)
```

### Data Flow

```
Matimo.init(auto_discover=True)
    │
    ├─ ToolLoader.auto_discover_packages()
    │   └─ Scans site-packages/matimo_*/tools/ for YAML
    │
    ├─ ToolLoader.load_tools_from_directory(path)
    │   ├─ Find all definition.yaml files recursively
    │   ├─ Parse YAML → dict
    │   └─ Validate with Pydantic → ToolDefinition
    │
    ├─ ToolRegistry.register_all(tools)
    │   └─ Store in dict[name → ToolDefinition]
    │
    └─ Return Matimo instance

m.execute("slack_send_channel_message", {"channel": "#general", "text": "hi"})
    │
    ├─ Registry.get("slack_send_channel_message") → ToolDefinition
    │
    ├─ ApprovalHandler.check(tool, params)
    │   └─ YAML requires_approval + destructive keyword scan
    │
    ├─ inject_auth_parameters(tool, params)
    │   └─ Scan {placeholders} → look up MATIMO_* env vars
    │
    ├─ Get executor by tool.execution.type
    │   ├─ "http"     → HttpExecutor.execute(tool, params)
    │   ├─ "command"  → CommandExecutor.execute(tool, params)
    │   └─ "function" → FunctionExecutor.execute(tool, params)
    │
    └─ Return result dict
```

---

## 3. Package Layout

```
packages/python/                          ← NEW directory in monorepo
├── pyproject.toml                        ← Package metadata, deps, build config
├── README.md                             ← PyPI README
├── LICENSE                               ← Same MIT license
├── src/
│   └── matimo/                           ← importable as `from matimo import Matimo`
│       ├── __init__.py                   ← Public API exports
│       ├── instance.py                   ← Matimo class (main entry point)
│       ├── core/
│       │   ├── __init__.py
│       │   ├── models.py                 ← Pydantic models (ToolDefinition, Parameter, etc.)
│       │   ├── loader.py                 ← YAML loader + validation
│       │   └── registry.py              ← In-memory tool registry
│       ├── executors/
│       │   ├── __init__.py
│       │   ├── http_executor.py          ← httpx-based HTTP executor
│       │   ├── command_executor.py       ← subprocess-based command executor
│       │   └── function_executor.py      ← importlib-based function executor (Python-native only)
│       ├── auth/
│       │   ├── __init__.py
│       │   └── injection.py              ← Auth parameter injection from env vars
│       ├── approval/
│       │   ├── __init__.py
│       │   └── handler.py                ← Approval system (mirrors TS ApprovalHandler)
│       ├── encodings/
│       │   ├── __init__.py
│       │   └── parameter_encoding.py     ← Parameter encoding (MIME, JSON, URL)
│       ├── integrations/
│       │   ├── __init__.py
│       │   ├── langchain.py              ← LangChain tool conversion
│       │   └── crewai.py                 ← CrewAI tool conversion
│       ├── errors.py                     ← MatimoError, ErrorCode
│       └── logging.py                    ← Logger setup
├── tests/
│   ├── conftest.py                       ← Shared fixtures (paths to YAML tools)
│   ├── test_models.py                    ← Pydantic model unit tests
│   ├── test_loader.py                    ← YAML loading tests
│   ├── test_registry.py                 ← Registry tests
│   ├── test_http_executor.py             ← HTTP executor tests (mocked)
│   ├── test_command_executor.py          ← Command executor tests
│   ├── test_function_executor.py         ← Function executor tests
│   ├── test_auth_injection.py            ← Auth injection tests
│   ├── test_approval.py                  ← Approval handler tests
│   ├── test_langchain.py                 ← LangChain integration tests
│   ├── test_instance.py                  ← End-to-end Matimo instance tests
│   └── fixtures/                         ← Test YAML fixtures (symlink or copy)
│       ├── slack_send_channel_message/
│       │   └── definition.yaml
│       ├── calculator/
│       │   └── definition.yaml
│       └── search/
│           └── definition.yaml
└── examples/
    ├── factory_example.py                ← Direct execution pattern
    ├── langchain_slack_agent.py          ← Full LangChain agent managing Slack
    ├── langchain_github_agent.py         ← Full LangChain agent managing GitHub issues
    ├── crewai_project_manager.py         ← Full CrewAI multi-agent example
    └── async_fastapi_example.py          ← Async FastAPI endpoint exposing tools
```

---

## 4. Data Models (Pydantic)

Exact mirror of `packages/core/src/core/schema.ts` and `packages/core/src/core/types.ts`.

### File: `src/matimo/core/models.py`

```python
"""
Pydantic v2 models for Matimo tool definitions.
Mirrors: packages/core/src/core/schema.ts (Zod schemas)
Mirrors: packages/core/src/core/types.ts (TypeScript interfaces)
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class Parameter(BaseModel):
    """Tool parameter definition. Mirrors TS Parameter interface."""
    type: Literal["string", "number", "boolean", "array", "object"]
    description: str
    required: Optional[bool] = None
    enum: Optional[list[Any]] = None
    default: Optional[Any] = None
    examples: Optional[list[Any]] = None
    example: Optional[Any] = None  # Alternate single-example field used in some YAMLs
    items: Optional[Parameter] = None           # For array type
    properties: Optional[dict[str, Parameter]] = None  # For object type


class AuthConfig(BaseModel):
    """Authentication configuration. Mirrors TS AuthConfig."""
    type: Optional[Literal["api_key", "basic", "bearer", "oauth2", "custom", "none"]] = None
    location: Optional[Literal["header", "query", "body"]] = None
    name: Optional[str] = None
    provider: Optional[str] = None
    required: Optional[bool] = None
    scheme: Optional[str] = None


class ParameterEncodingConfig(BaseModel):
    """Parameter encoding configuration from YAML."""
    source: list[str]
    target: str
    encoding: str
    options: Optional[dict[str, Any]] = None


class HttpExecution(BaseModel):
    """HTTP execution config. Mirrors TS HttpExecution."""
    type: Literal["http"]
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"]
    url: str
    headers: Optional[dict[str, str]] = None
    body: Optional[Any] = None
    query_params: Optional[dict[str, str]] = None
    parameter_encoding: Optional[list[ParameterEncodingConfig]] = None
    timeout: Optional[int] = None  # milliseconds


class CommandExecution(BaseModel):
    """Command execution config. Mirrors TS CommandExecution."""
    type: Literal["command"]
    command: str
    args: Optional[list[str]] = None
    cwd: Optional[str] = None
    shell: Optional[bool] = None
    timeout: Optional[int] = None  # milliseconds
    env: Optional[dict[str, str]] = None


class FunctionExecution(BaseModel):
    """Function execution config. Mirrors TS FunctionExecution."""
    type: Literal["function"]
    code: str  # File path (./tool.ts, ./tool.py) or embedded code
    timeout: Optional[int] = None  # milliseconds


# Discriminated union: use execution.type to pick the right model
ExecutionConfig = HttpExecution | CommandExecution | FunctionExecution


class OutputSchema(BaseModel):
    """Output schema for response validation."""
    type: Optional[str] = None
    properties: Optional[dict[str, Any]] = None
    required: Optional[list[str]] = None
    description: Optional[str] = None


class ErrorHandling(BaseModel):
    """Error handling configuration."""
    retry: Optional[int] = None
    backoff_type: Optional[Literal["linear", "exponential"]] = None
    initial_delay_ms: Optional[int] = None
    max_delay_ms: Optional[int] = None


class RateLimiting(BaseModel):
    """Rate limiting configuration."""
    enabled: Optional[bool] = None
    requests_per_minute: Optional[int] = None
    burst_size: Optional[int] = None
    quota_per_hour: Optional[int] = None


class ToolExample(BaseModel):
    """Example invocation for a tool."""
    name: str
    params: dict[str, Any]
    description: Optional[str] = None


class ToolDefinition(BaseModel):
    """
    Complete tool definition. Mirrors TS ToolDefinition.
    This is the core model that every YAML file validates against.
    """
    name: str
    description: str
    version: str
    parameters: Optional[dict[str, Parameter]] = None
    execution: HttpExecution | CommandExecution | FunctionExecution = Field(
        ..., discriminator="type"
    )
    authentication: Optional[AuthConfig] = None
    output_schema: Optional[OutputSchema] = None
    error_handling: Optional[ErrorHandling] = None
    rate_limiting: Optional[RateLimiting] = None
    requires_approval: Optional[bool] = None
    examples: Optional[list[ToolExample]] = None
    deprecated: Optional[bool] = None
    tags: Optional[list[str]] = None
    deprecation_message: Optional[str] = None
    notes: Optional[Any] = None  # Free-form notes field used in some YAMLs

    # Internal: set by loader after validation
    _definition_path: Optional[str] = None

    class Config:
        extra = "allow"  # Allow extra fields (notes, etc.) without failing validation
```

### Key design notes for the implementing agent:
- Use `Field(..., discriminator="type")` for the execution union so Pydantic picks the right model based on `execution.type`.
- Set `extra = "allow"` on `ToolDefinition` because real YAML files contain fields like `notes:` not in the core schema.
- The `_definition_path` field is set programmatically after loading, not from YAML.
- `Parameter` is self-referential (items, properties) — Pydantic v2 handles this with `from __future__ import annotations`.

---

## 5. YAML Loader

Mirrors: `packages/core/src/core/tool-loader.ts` (ToolLoader class).

### File: `src/matimo/core/loader.py`

**Class: `ToolLoader`**

| Method | Signature | Behavior |
|---|---|---|
| `load_tool_from_file` | `(file_path: str) → ToolDefinition` | Read YAML/JSON, parse, validate with Pydantic, set `_definition_path`. Raise `MatimoError(INVALID_SCHEMA)` on failure. |
| `load_tools_from_directory` | `(dir_path: str) → dict[str, ToolDefinition]` | Recursively find `definition.yaml` / `definition.yml` / `definition.json` / `tool.yaml`. Load each. Skip files that fail validation (may be provider definitions). Return `{name: ToolDefinition}`. |
| `load_tools_from_multiple_paths` | `(paths: list[str]) → dict[str, ToolDefinition]` | Call `load_tools_from_directory` for each path. Later paths override earlier. |
| `auto_discover_packages` | `() → list[str]` | Find tool directories from installed `matimo-*` packages (see [Auto-Discovery](#14-auto-discovery)). Also scan workspace `packages/*/tools/`. Cache result. |

**Implementation details:**
```python
import yaml  # PyYAML
from pathlib import Path
from matimo.core.models import ToolDefinition
from matimo.errors import MatimoError, ErrorCode

class ToolLoader:
    _discovered_cache: list[str] | None = None

    def load_tool_from_file(self, file_path: str) -> ToolDefinition:
        path = Path(file_path)
        if not path.exists():
            raise MatimoError(f"Tool file not found: {file_path}", ErrorCode.FILE_NOT_FOUND)

        content = path.read_text(encoding="utf-8")

        if path.suffix in (".yaml", ".yml"):
            parsed = yaml.safe_load(content)
        elif path.suffix == ".json":
            import json
            parsed = json.loads(content)
        else:
            raise MatimoError(f"Unsupported format: {path.suffix}", ErrorCode.INVALID_SCHEMA)

        try:
            tool = ToolDefinition.model_validate(parsed)
        except Exception as e:
            raise MatimoError(
                f"Invalid tool definition in {file_path}:\n{e}",
                ErrorCode.INVALID_SCHEMA,
            )

        tool._definition_path = str(path.resolve())
        return tool

    def load_tools_from_directory(self, dir_path: str) -> dict[str, ToolDefinition]:
        tools: dict[str, ToolDefinition] = {}
        root = Path(dir_path)
        if not root.exists():
            raise MatimoError(f"Directory not found: {dir_path}", ErrorCode.FILE_NOT_FOUND)

        for yaml_file in root.rglob("definition.*"):
            if yaml_file.suffix not in (".yaml", ".yml", ".json"):
                continue
            try:
                tool = self.load_tool_from_file(str(yaml_file))
                if tool.name not in tools:
                    tools[tool.name] = tool
            except MatimoError:
                continue  # Skip invalid files silently (may be provider defs)
        return tools

    # ... auto_discover_packages, load_tools_from_multiple_paths
```

---

## 6. Tool Registry

Mirrors: `packages/core/src/core/tool-registry.ts` (ToolRegistry class).

### File: `src/matimo/core/registry.py`

**Class: `ToolRegistry`**

| Method | Signature | Behavior |
|---|---|---|
| `register` | `(tool: ToolDefinition)` | Add to `_tools` dict. Raise on duplicate. Index by tags. |
| `register_all` | `(tools: list[ToolDefinition])` | Register each. |
| `get` | `(name: str) → ToolDefinition \| None` | Lookup by name. |
| `has` | `(name: str) → bool` | Check existence. |
| `get_all` | `() → list[ToolDefinition]` | Return all tools. |
| `get_by_tag` | `(tag: str) → list[ToolDefinition]` | Lookup by tag. |
| `search` | `(query: str) → list[ToolDefinition]` | Case-insensitive search on name and description. |
| `count` | `() → int` | Return count. |
| `clear` | `()` | Clear all. |

```python
class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}
        self._tags: dict[str, set[str]] = {}  # tag → set of tool names

    def register(self, tool: ToolDefinition) -> None:
        if tool.name in self._tools:
            raise MatimoError(f"Tool '{tool.name}' already registered", ErrorCode.TOOL_NOT_FOUND)
        self._tools[tool.name] = tool
        for tag in (tool.tags or []):
            self._tags.setdefault(tag, set()).add(tool.name)

    def search(self, query: str) -> list[ToolDefinition]:
        q = query.lower()
        return [t for t in self._tools.values()
                if q in t.name.lower() or q in t.description.lower()]
    # ... rest follows same pattern
```

---

## 7. Executors

Each executor mirrors its TypeScript counterpart. All executors implement the same interface:

```python
class BaseExecutor(Protocol):
    async def execute(self, tool: ToolDefinition, params: dict[str, Any]) -> Any: ...
```

### 7.1 HttpExecutor

**Mirrors:** `packages/core/src/executors/http-executor.ts`
**File:** `src/matimo/executors/http_executor.py`
**Dependency:** `httpx` (async HTTP client)

```python
import httpx
import re
from matimo.core.models import ToolDefinition, HttpExecution
from matimo.errors import MatimoError, ErrorCode

class HttpExecutor:
    async def execute(self, tool: ToolDefinition, params: dict[str, Any]) -> dict[str, Any]:
        exec_config: HttpExecution = tool.execution  # type: ignore

        # 1. Apply parameter encodings if present
        final_params = apply_parameter_encodings(params, exec_config.parameter_encoding or [])

        # 2. Validate URL parameters are provided
        self._validate_url_params(exec_config.url, final_params)

        # 3. Template URL
        url = self._template_string(exec_config.url, final_params)

        # 4. Build query string (only non-empty values)
        if exec_config.query_params:
            qs = self._build_query_string(exec_config.query_params, final_params)
            if qs:
                url += "?" + qs

        # 5. Template headers
        headers = self._template_object(exec_config.headers or {}, final_params, tool.parameters)

        # 6. Template body (handle object/array embedding like TS templateObject)
        body = None
        if exec_config.body and isinstance(exec_config.body, dict):
            body = self._template_object(exec_config.body, final_params, tool.parameters)
        elif exec_config.body is not None:
            body = exec_config.body

        # 7. Make request
        timeout_s = (exec_config.timeout or 30000) / 1000  # ms → seconds
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            response = await client.request(
                method=exec_config.method,
                url=url,
                headers=headers,
                json=body if body else None,
            )

        success = 200 <= response.status_code < 300
        return {
            "success": success,
            "data": response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text,
            "statusCode": response.status_code,
            "headers": dict(response.headers),
        }

    def _template_string(self, s: str, params: dict[str, Any]) -> str:
        """Replace {placeholder} with param values."""
        for key, value in params.items():
            s = s.replace(f"{{{key}}}", str(value))
        return s

    def _is_unfilled_placeholder(self, s: str) -> bool:
        """Check if string is an unfilled {placeholder}."""
        return bool(re.match(r"^\{[a-zA-Z_][a-zA-Z0-9_]*\}$", s))

    def _validate_url_params(self, url: str, params: dict[str, Any]) -> None:
        """Ensure all URL {placeholders} have values."""
        for match in re.finditer(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}", url):
            param_name = match.group(1)
            if param_name not in params or params[param_name] is None:
                raise MatimoError(
                    f"Required URL parameter '{param_name}' is missing",
                    ErrorCode.INVALID_SCHEMA,
                )

    def _build_query_string(self, query_params: dict[str, str], params: dict[str, Any]) -> str:
        """Build query string, skipping unfilled placeholders."""
        from urllib.parse import urlencode
        parts = {}
        for key, template in query_params.items():
            value = self._template_string(template, params)
            if value and not value.startswith("{"):
                parts[key] = value
        return urlencode(parts)

    def _template_object(
        self,
        obj: dict[str, Any],
        params: dict[str, Any],
        param_defs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Template an object (headers, body), handling:
        - String placeholders → string replacement
        - Object/array placeholders → direct embedding (not stringification)
        - Nested objects → recursive templating
        - Unfilled placeholders → omitted from result

        CRITICAL: This mirrors the TS HttpExecutor.templateObject() behavior exactly.
        """
        result = {}
        for key, value in obj.items():
            if isinstance(value, str):
                # Check if this is exactly a placeholder like "{parent}"
                match = re.match(r"^\{([a-zA-Z_][a-zA-Z0-9_]*)\}$", value)
                if match:
                    param_name = match.group(1)
                    param_value = params.get(param_name)
                    # If parameter is object or array type, embed directly
                    if param_value is not None and param_defs and param_name in param_defs:
                        param_type = param_defs[param_name].type if hasattr(param_defs[param_name], 'type') else None
                        if param_type in ("object", "array"):
                            result[key] = param_value
                            continue

                templated = self._template_string(value, params)
                if templated and not self._is_unfilled_placeholder(templated):
                    # Type coercion based on parameter schema
                    if match and param_defs:
                        pn = match.group(1)
                        if pn in param_defs:
                            pt = param_defs[pn].type if hasattr(param_defs[pn], 'type') else None
                            if pt == "number":
                                try:
                                    result[key] = float(templated) if "." in templated else int(templated)
                                    continue
                                except ValueError:
                                    pass
                            elif pt == "boolean":
                                result[key] = templated.lower() in ("true", "1", "yes")
                                continue
                    result[key] = templated
            elif isinstance(value, dict):
                nested = self._template_object(value, params, param_defs)
                if nested:
                    result[key] = nested
            elif isinstance(value, list):
                templated_list = []
                for item in value:
                    if isinstance(item, str):
                        t = self._template_string(item, params)
                        if t and not self._is_unfilled_placeholder(t):
                            templated_list.append(t)
                    elif isinstance(item, dict):
                        t = self._template_object(item, params, param_defs)
                        if t:
                            templated_list.append(t)
                    else:
                        templated_list.append(item)
                if templated_list:
                    result[key] = templated_list
            elif value is not None:
                result[key] = value
        return result
```

### 7.2 CommandExecutor

**Mirrors:** `packages/core/src/executors/command-executor.ts`
**File:** `src/matimo/executors/command_executor.py`
**Dependency:** `subprocess` (stdlib)

```python
import subprocess
import time
import re
from matimo.core.models import ToolDefinition, CommandExecution

class CommandExecutor:
    def __init__(self, cwd: str | None = None):
        self.cwd = cwd

    async def execute(self, tool: ToolDefinition, params: dict[str, Any]) -> dict[str, Any]:
        exec_config: CommandExecution = tool.execution  # type: ignore
        timeout_s = (exec_config.timeout or 30000) / 1000

        command = self._template_string(exec_config.command, params)
        args = [self._template_string(a, params) for a in (exec_config.args or [])]

        start = time.monotonic()
        try:
            result = subprocess.run(
                [command, *args],
                capture_output=True,
                text=True,
                timeout=timeout_s,
                cwd=exec_config.cwd or self.cwd,
            )
            duration = int((time.monotonic() - start) * 1000)
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
                "exitCode": result.returncode,
                "duration": duration,
            }
        except subprocess.TimeoutExpired:
            duration = int((time.monotonic() - start) * 1000)
            return {"success": False, "error": "timeout", "exitCode": -1, "duration": duration}
        except Exception as e:
            duration = int((time.monotonic() - start) * 1000)
            return {"success": False, "error": str(e), "exitCode": -1, "duration": duration}

    def _template_string(self, s: str, params: dict[str, Any]) -> str:
        for key, value in params.items():
            s = s.replace(f"{{{key}}}", str(value))
        return s
```

### 7.3 FunctionExecutor (Python-Native Only — Zero Node.js)

**Mirrors:** `packages/core/src/executors/function-executor.ts`
**File:** `src/matimo/executors/function_executor.py`
**Dependency:** `importlib` (stdlib)

> **Design Decision:** The Python SDK only executes `.py` files. It never shells out to Node.js.
> Tool authors who want function-type tools to work in both SDKs use the **dual-file convention**:
> place both a `.ts` file (for the TS SDK) and a `.py` file (for the Python SDK) alongside the
> YAML definition. The Python SDK auto-resolves `.ts` → `.py` transparently.

#### Dual-File Convention

```
packages/core/tools/search/
├── definition.yaml        # code: './search.ts'  (TS SDK reads this)
├── search.ts              # TypeScript implementation
└── search.py              # Python implementation (same interface)
```

The Python SDK resolves `code: './search.ts'` → `'./search.py'` automatically. If no `.py` sibling
exists, it raises a clear error telling the developer to create one.

#### Python function contract

Every `.py` tool file must export a `run()` function (sync or async):

```python
# packages/core/tools/search/search.py
def run(params: dict) -> dict:
    """Matches the same params/output as search.ts."""
    query = params["query"]
    # ... do the work ...
    return {"results": [...], "total": 42}

# Or async:
async def run(params: dict) -> dict:
    ...
```

#### Implementation

```python
import importlib.util
import asyncio
import inspect
from pathlib import Path
from matimo.core.models import ToolDefinition, FunctionExecution
from matimo.errors import MatimoError, ErrorCode

class FunctionExecutor:
    def __init__(self, tools_path: str = ""):
        self.tools_path = tools_path

    async def execute(self, tool: ToolDefinition, params: dict[str, Any]) -> Any:
        exec_config: FunctionExecution = tool.execution  # type: ignore
        code = exec_config.code
        timeout_s = (exec_config.timeout or 30000) / 1000

        # Resolve the .py file path (handles dual-file convention)
        py_path = self._resolve_python_file(tool, code)
        return await self._execute_python_file(tool, py_path, params, timeout_s)

    def _resolve_python_file(self, tool: ToolDefinition, code_ref: str) -> Path:
        """
        Resolve a code reference to an actual .py file.

        Rules:
        1. If code_ref ends with '.py' → use directly
        2. If code_ref ends with '.ts' or '.js' → swap extension to '.py' (dual-file convention)
        3. If code_ref starts with './' and has no extension → try '.py'
        4. Embedded code strings → reject (not supported)
        """
        if tool._definition_path:
            base_dir = Path(tool._definition_path).parent
        else:
            base_dir = Path(self.tools_path)

        ref = Path(code_ref)

        # Rule 1: Already a .py file
        if ref.suffix == ".py":
            resolved = (base_dir / ref).resolve()
            if not resolved.exists():
                raise MatimoError(
                    f"Python function file not found: {resolved}",
                    ErrorCode.FILE_NOT_FOUND,
                )
            return resolved

        # Rule 2: .ts or .js → swap to .py
        if ref.suffix in (".ts", ".js"):
            py_ref = ref.with_suffix(".py")
            resolved = (base_dir / py_ref).resolve()
            if not resolved.exists():
                ts_path = (base_dir / ref).resolve()
                raise MatimoError(
                    f"Python SDK requires a .py file for function tools.\n"
                    f"YAML references '{code_ref}' but no Python equivalent found.\n"
                    f"Expected: {resolved}\n"
                    f"Create a Python version alongside the TypeScript file:\n"
                    f"  {ts_path.parent}/{py_ref.name}\n\n"
                    f"The .py file should export a 'run(params: dict) -> dict' function "
                    f"with the same input/output as {ref.name}.",
                    ErrorCode.FILE_NOT_FOUND,
                )
            return resolved

        # Rule 3: No extension → try .py
        if not ref.suffix:
            py_ref = ref.with_suffix(".py")
            resolved = (base_dir / py_ref).resolve()
            if resolved.exists():
                return resolved

        # Rule 4: Embedded code or unrecognized
        raise MatimoError(
            f"Unsupported function code reference: '{code_ref}'.\n"
            f"The Python SDK only supports .py files for function-type tools.\n"
            f"Embedded code execution is not supported.",
            ErrorCode.EXECUTION_FAILED,
        )

    async def _execute_python_file(
        self, tool: ToolDefinition, py_path: Path, params: dict, timeout: float
    ) -> Any:
        """Import and call a Python function from a .py file."""
        # Dynamic import
        spec = importlib.util.spec_from_file_location(tool.name, str(py_path))
        if not spec or not spec.loader:
            raise MatimoError(f"Cannot load module: {py_path}", ErrorCode.EXECUTION_FAILED)

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Find the callable: run() or default
        fn = getattr(module, "run", None) or getattr(module, "default", None)
        if not fn or not callable(fn):
            raise MatimoError(
                f"Module {py_path} must export a 'run(params)' function.\n"
                f"Example:\n"
                f"  def run(params: dict) -> dict:\n"
                f"      return {{\"result\": ...}}",
                ErrorCode.EXECUTION_FAILED,
            )

        # Call with timeout
        if inspect.iscoroutinefunction(fn):
            return await asyncio.wait_for(fn(params), timeout=timeout)
        else:
            return fn(params)
```

#### What about existing .ts-only function tools?

When a Python user installs `matimo-slack` (pip), all 16 Slack tools are `type: http` — they work
immediately with zero Node.js. The only function-type tools are in `packages/core/tools/`
(calculator, search, etc.) which are developer utilities.

**Migration path for function tools:**

| Scenario | Action |
|---|---|
| HTTP tools (Slack, GitHub, Gmail, HubSpot, etc.) | **No action** — work out of the box in Python |
| Command tools (postgres, etc.) | **No action** — subprocess works natively |
| Function tools with `.ts` only | Add a `.py` sibling implementing `run(params) -> dict` |
| Function tools with `.py` already | **No action** — works directly |

For the core function tools, add these Python siblings:

```
packages/core/tools/calculator/calculator.py
packages/core/tools/search/search.py
packages/core/tools/edit/edit.py
packages/core/tools/execute/execute.py
packages/core/tools/read/read.py
packages/core/tools/web/web.py
```

Each is a thin Python equivalent (~20-50 lines) of the TypeScript file.

---

## 8. Auth Injection

Mirrors: `MatimoInstance.injectAuthParameters()` and `MatimoInstance.extractParameterPlaceholders()` in `packages/core/src/matimo-instance.ts` (lines 310-445).

### File: `src/matimo/auth/injection.py`

```python
import os
import re
from matimo.core.models import ToolDefinition

# Patterns that indicate a parameter is auth-related
AUTH_PATTERNS = ["token", "key", "secret", "password", "credential", "auth", "bearer", "api_key"]

def inject_auth_parameters(tool: ToolDefinition, params: dict[str, Any]) -> dict[str, Any]:
    """
    Auto-inject authentication parameters from environment variables.
    Scans execution config for {placeholders}, identifies auth-like parameter names,
    and loads values from MATIMO_<PARAM> or <PARAM> env vars.
    """
    result = dict(params)
    referenced = extract_parameter_placeholders(tool)

    for param_name in referenced:
        if param_name in result:
            continue  # User already provided it

        lower = param_name.lower()
        is_auth = any(pattern in lower for pattern in AUTH_PATTERNS)
        if not is_auth:
            continue

        # Try MATIMO_ prefix first, then direct name
        env_value = os.environ.get(f"MATIMO_{param_name}") or os.environ.get(param_name)
        if env_value:
            result[param_name] = env_value

    return result


def extract_parameter_placeholders(tool: ToolDefinition) -> set[str]:
    """Extract all {placeholder} names from execution config (url, headers, body, query_params)."""
    params: set[str] = set()
    placeholder_re = re.compile(r"\{([^}]+)\}")
    execution = tool.execution

    # Scan URL
    if hasattr(execution, "url") and execution.url:
        params.update(m.group(1) for m in placeholder_re.finditer(execution.url))

    # Scan headers
    if hasattr(execution, "headers") and execution.headers:
        for v in execution.headers.values():
            params.update(m.group(1) for m in placeholder_re.finditer(v))

    # Scan body (recursive)
    if hasattr(execution, "body") and execution.body:
        _scan_object(execution.body, params, placeholder_re)

    # Scan query_params
    if hasattr(execution, "query_params") and execution.query_params:
        for v in execution.query_params.values():
            params.update(m.group(1) for m in placeholder_re.finditer(v))

    return params


def _scan_object(obj: Any, params: set[str], regex: re.Pattern) -> None:
    """Recursively scan an object for {placeholders}."""
    if isinstance(obj, str):
        params.update(m.group(1) for m in regex.finditer(obj))
    elif isinstance(obj, dict):
        for v in obj.values():
            _scan_object(v, params, regex)
    elif isinstance(obj, list):
        for item in obj:
            _scan_object(item, params, regex)
```

---

## 9. Approval System

Mirrors: `packages/core/src/approval/approval-handler.ts`

### File: `src/matimo/approval/handler.py`

```python
import os
import re
import fnmatch
from typing import Callable, Awaitable
from matimo.core.models import ToolDefinition
from matimo.errors import MatimoError, ErrorCode

ApprovalCallback = Callable[["ApprovalRequest"], Awaitable[bool]]

class ApprovalRequest:
    def __init__(self, tool_name: str, description: str | None, params: dict):
        self.tool_name = tool_name
        self.description = description
        self.params = params

DEFAULT_DESTRUCTIVE_KEYWORDS = [
    "CREATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "UPDATE", "INSERT",
    "UPSERT", "REPLACE", "MERGE", "GRANT", "REVOKE", "EDIT", "WRITE",
    "APPEND", "REMOVE", "RENAME", "SHUTDOWN", "EXECUTE", "EXEC",
]

class ApprovalHandler:
    def __init__(self):
        self.auto_approve = os.environ.get("MATIMO_AUTO_APPROVE") == "true"
        patterns_env = os.environ.get("MATIMO_APPROVED_PATTERNS", "")
        self.approved_patterns = {p.strip() for p in patterns_env.split(",") if p.strip()}
        self.callback: ApprovalCallback | None = None
        self.destructive_keywords = list(DEFAULT_DESTRUCTIVE_KEYWORDS)

    def requires_approval(self, yaml_flag: bool | None, content: str | None = None) -> bool:
        if yaml_flag is True:
            return True
        if content:
            upper = content.upper()
            return any(kw in upper for kw in self.destructive_keywords)
        return False

    def is_pre_approved(self, tool_name: str) -> bool:
        if self.auto_approve:
            return True
        return any(fnmatch.fnmatch(tool_name, p) for p in self.approved_patterns)

    async def request_approval(self, request: ApprovalRequest) -> None:
        if not self.callback:
            raise MatimoError(
                f"Destructive operation requires approval: {request.tool_name}",
                ErrorCode.EXECUTION_FAILED,
            )
        approved = await self.callback(request)
        if not approved:
            raise MatimoError(f"Operation rejected: {request.tool_name}", ErrorCode.EXECUTION_FAILED)

# Global singleton
_global_handler: ApprovalHandler | None = None

def get_global_approval_handler() -> ApprovalHandler:
    global _global_handler
    if _global_handler is None:
        _global_handler = ApprovalHandler()
    return _global_handler
```

---

## 10. Parameter Encoding

Mirrors: `packages/core/src/encodings/parameter-encoding.ts`

### File: `src/matimo/encodings/parameter_encoding.py`

Support the three encoding types from TS:
1. `mime_rfc2822_base64url` — For Gmail API (to, subject, body → base64url MIME message)
2. `json_compact` — JSON.stringify equivalent
3. `url_encoded` — URL encode parameters

```python
import base64
import json
from urllib.parse import urlencode
from matimo.errors import MatimoError, ErrorCode

def apply_parameter_encodings(params: dict, encodings: list) -> dict:
    result = dict(params)
    for config in encodings:
        source_values = {k: params[k] for k in config.source if k in params}
        encoded = _encode(source_values, config.encoding, config.options)
        result[config.target] = encoded
    return result

def _encode(values: dict, encoding: str, options: dict | None = None) -> str:
    if encoding == "mime_rfc2822_base64url":
        return _encode_mime_rfc2822(values)
    elif encoding == "json_compact":
        return json.dumps(values, separators=(",", ":"))
    elif encoding == "url_encoded":
        return urlencode({k: str(v) for k, v in values.items()})
    else:
        raise MatimoError(f"Unknown encoding: {encoding}", ErrorCode.INVALID_PARAMETER)

def _encode_mime_rfc2822(values: dict) -> str:
    to = values.get("to", "")
    subject = values.get("subject", "")
    body = values.get("body", "")
    is_html = values.get("isHtml") or values.get("is_html") or False
    content_type = "text/html" if is_html else "text/plain"

    parts = [f"To: {to}", f"Subject: {subject}", f"Content-Type: {content_type}; charset=utf-8", "", body]
    cc = values.get("cc")
    bcc = values.get("bcc")
    if cc:
        parts.insert(2, f"Cc: {cc}")
    if bcc:
        parts.insert(2 + (1 if cc else 0), f"Bcc: {bcc}")

    mime = "\r\n".join(parts)
    return base64.urlsafe_b64encode(mime.encode("utf-8")).decode("ascii").rstrip("=")
```

---

## 11. LangChain Integration

Mirrors: `packages/core/src/integrations/langchain.ts`

### File: `src/matimo/integrations/langchain.py`

```python
"""
LangChain integration — converts Matimo tools to LangChain tools.
Lazy-imports langchain to avoid hard dependency.
"""
from __future__ import annotations
import re
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from matimo.instance import Matimo
    from matimo.core.models import ToolDefinition, Parameter

SECRET_PATTERNS = re.compile(
    r"(?:^|_)(TOKEN|KEY|SECRET|PASSWORD)(?:_|$)|"
    r"[a-z](Token|Key|Secret|Password)",
)

def is_secret_parameter(name: str) -> bool:
    return bool(SECRET_PATTERNS.search(name))


def parameter_to_pydantic_field(param: "Parameter") -> tuple[type, Any]:
    """Convert a Matimo Parameter to a (type, Field) tuple for pydantic model creation."""
    from pydantic import Field

    type_map = {"string": str, "number": float, "boolean": bool, "array": list, "object": dict}
    py_type = type_map.get(param.type, Any)
    default = ... if param.required else (param.default if param.default is not None else None)
    return (py_type, Field(default=default, description=param.description))


def convert_tools_to_langchain(
    tools: list["ToolDefinition"],
    matimo: "Matimo",
    secrets: dict[str, str] | None = None,
) -> list:
    """
    Convert Matimo tools → LangChain BaseTool instances.

    Usage:
        from matimo import Matimo, convert_tools_to_langchain
        m = Matimo.init(auto_discover=True)
        lc_tools = convert_tools_to_langchain(m.list_tools(), m, {"SLACK_BOT_TOKEN": "xoxb-..."})
    """
    try:
        from langchain_core.tools import StructuredTool
        from pydantic import create_model, Field
    except ImportError:
        raise ImportError(
            "LangChain not installed. Install: pip install langchain-core langchain"
        )

    secrets = secrets or {}
    # Detect secret param names
    detected_secrets = set(secrets.keys())
    for tool in tools:
        for pname in (tool.parameters or {}):
            if is_secret_parameter(pname):
                detected_secrets.add(pname)

    lc_tools = []
    for tool in tools:
        # Build input schema (exclude secrets)
        fields = {}
        for pname, param in (tool.parameters or {}).items():
            if pname in detected_secrets:
                continue
            py_type, field = parameter_to_pydantic_field(param)
            fields[pname] = (py_type, field)

        InputModel = create_model(f"{tool.name}_Input", **fields) if fields else None

        # Build the execution function
        tool_name = tool.name

        def make_fn(tn: str):
            async def _run(**kwargs: Any) -> Any:
                params = dict(kwargs)
                for sp in detected_secrets:
                    if sp in secrets:
                        params[sp] = secrets[sp]
                try:
                    return await matimo.execute(tn, params)
                except Exception as e:
                    return f"Error: {e}"
            return _run

        fn = make_fn(tool_name)

        lc_tool = StructuredTool.from_function(
            coroutine=fn,
            name=tool.name,
            description=tool.description or tool.name,
            args_schema=InputModel,
        )
        lc_tools.append(lc_tool)

    return lc_tools
```

---

## 12. CrewAI Integration

### File: `src/matimo/integrations/crewai.py`

Same pattern — wrap Matimo tools as CrewAI `BaseTool` subclasses.

```python
def convert_tools_to_crewai(tools, matimo, secrets=None):
    """Convert Matimo tools to CrewAI tools."""
    try:
        from crewai.tools import BaseTool as CrewTool
    except ImportError:
        raise ImportError("CrewAI not installed. Install: pip install crewai")

    # Similar pattern to LangChain — create subclass per tool
    # with _run() that calls matimo.execute()
    ...
```

---

## 13. Matimo Instance (Main Entry Point)

Mirrors: `packages/core/src/matimo-instance.ts` (MatimoInstance class).

### File: `src/matimo/instance.py`

```python
"""
Matimo — Main entry point for the Python SDK.
Mirrors: packages/core/src/matimo-instance.ts
"""
from __future__ import annotations
import asyncio
from pathlib import Path
from typing import Any

from matimo.core.loader import ToolLoader
from matimo.core.registry import ToolRegistry
from matimo.core.models import ToolDefinition
from matimo.executors.http_executor import HttpExecutor
from matimo.executors.command_executor import CommandExecutor
from matimo.executors.function_executor import FunctionExecutor
from matimo.auth.injection import inject_auth_parameters
from matimo.approval.handler import get_global_approval_handler
from matimo.errors import MatimoError, ErrorCode
import logging

logger = logging.getLogger("matimo")


class Matimo:
    """
    Matimo SDK — Universal AI tool execution.
    API mirrors MatimoInstance from the TypeScript SDK.
    """

    def __init__(self, tool_paths: list[str]):
        self._tool_paths = tool_paths
        self._loader = ToolLoader()
        self._registry = ToolRegistry()
        cwd = str(Path(tool_paths[0]).parent) if tool_paths else None
        self._http_executor = HttpExecutor()
        self._command_executor = CommandExecutor(cwd=cwd)
        self._function_executor = FunctionExecutor(tool_paths[0] if tool_paths else "")
        self._approval = get_global_approval_handler()

    @classmethod
    def init(
        cls,
        tool_paths: list[str] | str | None = None,
        auto_discover: bool = False,
    ) -> "Matimo":
        """
        Initialize Matimo with tool paths or auto-discovery.

        Usage:
            m = Matimo.init(auto_discover=True)
            m = Matimo.init("./tools")
            m = Matimo.init(tool_paths=["./packages/slack/tools", "./packages/gmail/tools"])
        """
        paths: list[str] = []

        if isinstance(tool_paths, str):
            paths = [tool_paths]
        elif isinstance(tool_paths, list):
            paths = list(tool_paths)

        if auto_discover:
            loader = ToolLoader()
            paths.extend(loader.auto_discover_packages())

        instance = cls(paths)

        # Load tools from all paths
        all_tools = instance._loader.load_tools_from_multiple_paths(paths)
        instance._registry.register_all(list(all_tools.values()))

        logger.info(f"Matimo initialized: {len(all_tools)} tools from {len(paths)} paths")
        return instance

    async def execute(self, tool_name: str, params: dict[str, Any]) -> Any:
        """Execute a tool by name with parameters."""
        tool = self._registry.get(tool_name)
        if not tool:
            available = [t.name for t in self._registry.get_all()]
            raise MatimoError(
                f"Tool '{tool_name}' not found", ErrorCode.TOOL_NOT_FOUND,
                details={"available": available},
            )

        # Approval check
        exec_type = tool.execution.type
        scan_content = None
        if exec_type == "command" and isinstance(params.get("command"), str):
            scan_content = params["command"]
        elif isinstance(params.get("sql"), str):
            scan_content = params["sql"]

        if self._approval.requires_approval(tool.requires_approval, scan_content):
            if not self._approval.is_pre_approved(tool_name):
                from matimo.approval.handler import ApprovalRequest
                await self._approval.request_approval(
                    ApprovalRequest(tool_name, tool.description, params)
                )

        # Auth injection
        final_params = inject_auth_parameters(tool, params)

        # Route to executor
        executor = self._get_executor(tool)
        return await executor.execute(tool, final_params)

    def execute_sync(self, tool_name: str, params: dict[str, Any]) -> Any:
        """Synchronous wrapper for execute()."""
        return asyncio.run(self.execute(tool_name, params))

    def list_tools(self) -> list[ToolDefinition]:
        return self._registry.get_all()

    def get_tool(self, name: str) -> ToolDefinition | None:
        return self._registry.get(name)

    def search_tools(self, query: str) -> list[ToolDefinition]:
        return self._registry.search(query)

    def get_tools_by_tag(self, tag: str) -> list[ToolDefinition]:
        return self._registry.get_by_tag(tag)

    def _get_executor(self, tool: ToolDefinition):
        match tool.execution.type:
            case "http":
                return self._http_executor
            case "command":
                return self._command_executor
            case "function":
                return self._function_executor
            case _:
                raise MatimoError(
                    f"Unsupported execution type: {tool.execution.type}",
                    ErrorCode.EXECUTION_FAILED,
                )
```

---

## 14. Auto-Discovery

### How pip packages expose tools

Each provider pip package (e.g., `matimo-slack`) uses a Python entry point to advertise its tool directory.

**`pyproject.toml` for `matimo-slack`:**
```toml
[project]
name = "matimo-slack"
version = "0.1.0"
description = "Slack tools for Matimo"
requires-python = ">=3.11"
dependencies = ["matimo"]

[project.entry-points."matimo.providers"]
slack = "matimo_slack:get_tools_path"
```

**`matimo_slack/__init__.py`:**
```python
from pathlib import Path

def get_tools_path() -> str:
    return str(Path(__file__).parent / "tools")
```

**`matimo_slack/tools/`** — contains the YAML files (copied from `packages/slack/tools/` at build time).

### Discovery in `ToolLoader.auto_discover_packages()`:

```python
from importlib.metadata import entry_points

def auto_discover_packages(self) -> list[str]:
    if self._discovered_cache is not None:
        return self._discovered_cache

    paths = []

    # 1. Discover via entry points (pip-installed packages)
    eps = entry_points()
    matimo_eps = eps.get("matimo.providers", [])
    for ep in matimo_eps:
        try:
            fn = ep.load()
            tool_path = fn()
            if Path(tool_path).exists():
                paths.append(tool_path)
        except Exception:
            continue

    # 2. Discover workspace packages (for development)
    cwd = Path.cwd()
    for i in range(15):
        packages_dir = cwd / "packages"
        if packages_dir.exists():
            for pkg_dir in packages_dir.iterdir():
                tools_dir = pkg_dir / "tools"
                if tools_dir.is_dir():
                    paths.append(str(tools_dir))
            break
        cwd = cwd.parent

    self._discovered_cache = paths
    return paths
```

---

## 15. Error Handling

Mirrors: `packages/core/src/errors/matimo-error.ts`

### File: `src/matimo/errors.py`

```python
from enum import Enum

class ErrorCode(str, Enum):
    INVALID_SCHEMA = "INVALID_SCHEMA"
    EXECUTION_FAILED = "EXECUTION_FAILED"
    AUTH_FAILED = "AUTH_FAILED"
    TOOL_NOT_FOUND = "TOOL_NOT_FOUND"
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    TIMEOUT = "TIMEOUT"
    NETWORK_ERROR = "NETWORK_ERROR"
    INVALID_PARAMETER = "INVALID_PARAMETER"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


class MatimoError(Exception):
    def __init__(self, message: str, code: ErrorCode, details: dict | None = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}

    def to_dict(self) -> dict:
        return {
            "name": "MatimoError",
            "message": str(self),
            "code": self.code.value,
            "details": self.details,
        }
```

---

## 16. Logging

### File: `src/matimo/logging.py`

Use stdlib `logging`. Mirror the TS `MATIMO_LOG_LEVEL` env var.

```python
import os, logging

def setup_logger() -> logging.Logger:
    logger = logging.getLogger("matimo")
    level = os.environ.get("MATIMO_LOG_LEVEL", "INFO").upper()
    logger.setLevel(getattr(logging, level, logging.INFO))
    if not logger.handlers:
        handler = logging.StreamHandler()
        fmt = os.environ.get("MATIMO_LOG_FORMAT", "simple")
        if fmt == "json":
            # Use a JSON formatter or simple dict output
            handler.setFormatter(logging.Formatter('{"level":"%(levelname)s","msg":"%(message)s"}'))
        else:
            handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] matimo: %(message)s"))
        logger.addHandler(handler)
    return logger
```

---

## 17. Provider Packages (pip)

Each provider is a tiny pip package that ships ONLY the YAML tools directory.

### Build process (for CI / release script):

```bash
# For each provider (slack, gmail, github, hubspot, notion, postgres):
# 1. Create a temporary package directory
# 2. Copy tools/ directory from packages/{provider}/tools/
# 3. Add pyproject.toml and __init__.py
# 4. Publish to PyPI

# Structure after build:
matimo-slack/
├── pyproject.toml
├── src/
│   └── matimo_slack/
│       ├── __init__.py          # get_tools_path()
│       └── tools/               # COPIED from packages/slack/tools/
│           ├── slack_send_channel_message/
│           │   └── definition.yaml
│           └── ... (all tool YAMLs)
```

### Template `pyproject.toml` for providers:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "matimo-{provider}"
version = "0.1.0"
description = "{Provider} tools for Matimo"
requires-python = ">=3.11"
dependencies = ["matimo>=0.1.0"]
license = {text = "MIT"}
keywords = ["matimo", "ai-tools", "{provider}"]

[project.entry-points."matimo.providers"]
{provider} = "matimo_{provider}:get_tools_path"
```

---

## 18. Tests

### Dependencies (dev):

```
pytest
pytest-asyncio
httpx          # Already a runtime dep
respx          # Mock httpx requests
pyyaml         # Already a runtime dep
pydantic       # Already a runtime dep
```

### Test plan:

| Test file | What it tests | Key assertions |
|---|---|---|
| `test_models.py` | Pydantic model validation | Valid YAML parses correctly; invalid YAML raises ValidationError; all fields round-trip |
| `test_loader.py` | YAML loading from files/dirs | Loads real YAML from `packages/slack/tools/`; handles missing files; skips invalid |
| `test_registry.py` | Tool registration, search, tags | Register, get, search, get_by_tag, duplicate rejection |
| `test_http_executor.py` | HTTP request templating and execution | Template URL/headers/body; validate URL params; handle object/array embedding; mock HTTP responses |
| `test_command_executor.py` | Subprocess execution | Template args; handle timeouts; capture stdout/stderr |
| `test_function_executor.py` | Python file import + execution | Load `.py` module; call async/sync functions; handle missing files; verify `.ts` → `.py` resolution; clear error when `.py` sibling missing |
| `test_auth_injection.py` | Env var auth injection | Detect auth params from URL/headers/body placeholders; inject from env |
| `test_approval.py` | Approval handler | YAML flag detection; keyword scanning; pre-approval; callback invocation |
| `test_langchain.py` | LangChain conversion | Convert tools to StructuredTool; secret detection; schema generation |
| `test_instance.py` | End-to-end `Matimo.init()` + `execute()` | Load real YAML; execute mocked HTTP tool; verify result shape |

### Fixture strategy:

- **Symlink or copy** real YAML files from `packages/*/tools/` into `tests/fixtures/`
- This ensures Python tests validate against the SAME YAML the TS SDK uses

### Running tests:

```bash
cd packages/python
pip install -e ".[dev]"
pytest tests/ -v
```

---

## 19. Examples

### 19.1 `examples/factory_example.py` — Direct Tool Execution

```python
"""Simplest usage — direct tool execution without any AI framework."""
import asyncio
import os
from matimo import Matimo


async def main():
    # Initialize — auto-discovers all installed matimo-* packages (pip)
    m = Matimo.init(auto_discover=True)
    print(f"Loaded {len(m.list_tools())} tools")

    # Show all available tools
    for tool in m.list_tools():
        print(f"  - {tool.name}: {tool.description}")

    # Direct execution: send a Slack message
    result = await m.execute("slack_send_channel_message", {
        "channel": "#general",
        "text": "Hello from Matimo Python SDK!",
    })
    print("Send message result:", result)

    # Direct execution: list GitHub issues
    result = await m.execute("github-list-issues", {
        "owner": "tallclub",
        "repo": "matimo",
        "state": "open",
        "per_page": 5,
    })
    print(f"Open issues: {len(result.get('data', []))}")

    # Search for tools by keyword
    slack_tools = m.search_tools("slack")
    print(f"\nFound {len(slack_tools)} Slack tools:")
    for t in slack_tools:
        print(f"  - {t.name}")


if __name__ == "__main__":
    asyncio.run(main())
```

### 19.2 `examples/langchain_slack_agent.py` — Full LangChain Slack Agent

```python
"""
Full LangChain agent that manages Slack using Matimo tools.

This agent can:
- List channels and find the right one
- Read channel history and thread replies
- Send messages and reply to threads
- Search messages across the workspace
- Add reactions, upload files, manage topics

Setup:
    pip install matimo matimo-slack langchain langchain-openai
    export OPENAI_API_KEY="sk-..."
    export SLACK_BOT_TOKEN="xoxb-..."
"""
import asyncio
import os

from matimo import Matimo, convert_tools_to_langchain

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage


SYSTEM_PROMPT = """You are a Slack workspace assistant with full access to Slack tools.

Capabilities:
- List and search channels
- Read channel history and thread replies
- Send messages to channels and DMs
- Reply to specific threads
- Search messages across the workspace
- Add reactions to messages
- Upload files to channels
- Set channel topics
- Get user information

Rules:
- Always confirm what you're about to do before sending messages.
- When listing channels, show the top 10 by default.
- When reading history, show the last 5 messages by default.
- Format output clearly for the user.
"""


async def main():
    # 1. Initialize Matimo with auto-discovery
    m = Matimo.init(auto_discover=True)

    # 2. Filter to Slack tools only
    slack_tools = [t for t in m.list_tools() if "slack" in t.name.lower()]
    print(f"Loaded {len(slack_tools)} Slack tools:")
    for t in slack_tools:
        print(f"  - {t.name}: {t.description}")

    # 3. Convert to LangChain tools (secrets injected automatically)
    lc_tools = convert_tools_to_langchain(
        tools=slack_tools,
        matimo=m,
        secrets={
            "SLACK_BOT_TOKEN": os.environ["SLACK_BOT_TOKEN"],
        },
    )

    # 4. Build the agent
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    agent = create_tool_calling_agent(llm, lc_tools, prompt)
    executor = AgentExecutor(
        agent=agent,
        tools=lc_tools,
        verbose=True,
        max_iterations=10,
        handle_parsing_errors=True,
    )

    # 5. Interactive loop — the agent handles multi-step tasks autonomously
    print("\n=== Slack Agent Ready ===")
    print("Try: 'List all channels', 'Search for messages about deployment',")
    print("     'Send hello to #general', 'What's the topic of #engineering?'")
    print("Type 'quit' to exit.\n")

    chat_history = []
    while True:
        user_input = input("You: ").strip()
        if user_input.lower() in ("quit", "exit", "q"):
            break

        result = await executor.ainvoke({
            "input": user_input,
            "chat_history": chat_history,
        })

        output = result["output"]
        print(f"\nAgent: {output}\n")

        # Keep conversation history
        chat_history.append(HumanMessage(content=user_input))
        chat_history.append(HumanMessage(content=output))  # Simplified


if __name__ == "__main__":
    asyncio.run(main())
```

### 19.3 `examples/langchain_github_agent.py` — Full LangChain GitHub Agent

```python
"""
Full LangChain agent that manages GitHub repositories using Matimo tools.

This agent can:
- List and search repositories
- Create, update, and list issues
- Create and list pull requests
- Search code across repositories
- Manage releases and collaborators
- List commits and code scanning alerts

Setup:
    pip install matimo matimo-github langchain langchain-openai
    export OPENAI_API_KEY="sk-..."
    export GITHUB_TOKEN="ghp_..."
"""
import asyncio
import os

from matimo import Matimo, convert_tools_to_langchain

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder


SYSTEM_PROMPT = """You are a GitHub project manager assistant.

Capabilities:
- Search and explore repositories
- Full issue management: create, list, update, search issues
- Pull request management: create and list PRs
- Code search across repos
- Release management: create releases, list releases
- Collaborator management
- Commit history browsing
- Code scanning alert management

Rules:
- Always specify owner and repo when working with a specific repository.
- When creating issues or PRs, confirm the details with the user first.
- Show results in a clean, formatted way.
- When listing items, default to 10 results unless told otherwise.
- For destructive operations (delete repo, etc.), always warn the user.
"""


async def main():
    # 1. Initialize Matimo with GitHub tools
    m = Matimo.init(auto_discover=True)

    # 2. Filter to GitHub tools
    github_tools = [t for t in m.list_tools() if "github" in t.name.lower()]
    print(f"Loaded {len(github_tools)} GitHub tools:")
    for t in github_tools:
        approval = " [REQUIRES APPROVAL]" if t.requires_approval else ""
        print(f"  - {t.name}{approval}: {t.description}")

    # 3. Convert to LangChain tools
    lc_tools = convert_tools_to_langchain(
        tools=github_tools,
        matimo=m,
        secrets={
            "GITHUB_TOKEN": os.environ["GITHUB_TOKEN"],
        },
    )

    # 4. Build the agent
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    agent = create_tool_calling_agent(llm, lc_tools, prompt)
    executor = AgentExecutor(
        agent=agent,
        tools=lc_tools,
        verbose=True,
        max_iterations=15,
        handle_parsing_errors=True,
    )

    # 5. Run a multi-step scenario
    print("\n=== GitHub Agent Ready ===")
    print("Try: 'List open issues in tallclub/matimo',")
    print("     'Search for repos about AI agents',")
    print("     'Create an issue for adding Python docs in tallclub/matimo'")
    print("Type 'quit' to exit.\n")

    chat_history = []
    while True:
        user_input = input("You: ").strip()
        if user_input.lower() in ("quit", "exit", "q"):
            break

        result = await executor.ainvoke({
            "input": user_input,
            "chat_history": chat_history,
        })
        print(f"\nAgent: {result['output']}\n")


if __name__ == "__main__":
    asyncio.run(main())
```

### 19.4 `examples/crewai_project_manager.py` — Full CrewAI Multi-Agent Example

```python
"""
CrewAI multi-agent system using Matimo tools.

Three agents collaborate to manage a project:
1. GitHub Agent — reads issues, PRs, and codebase
2. Slack Agent — communicates status to team channels
3. Report Agent — synthesizes findings into a report

Setup:
    pip install matimo matimo-slack matimo-github crewai crewai-tools langchain-openai
    export OPENAI_API_KEY="sk-..."
    export SLACK_BOT_TOKEN="xoxb-..."
    export GITHUB_TOKEN="ghp_..."
"""
import os

from matimo import Matimo, convert_tools_to_langchain

from crewai import Agent, Task, Crew, Process
from crewai.tools import BaseTool
from typing import Any


class MatimoCrewTool(BaseTool):
    """Adapter that wraps a single Matimo tool as a CrewAI tool."""
    matimo_instance: Any = None
    tool_name: str = ""
    secrets: dict = {}

    def _run(self, **kwargs: Any) -> str:
        import asyncio
        params = dict(kwargs)
        params.update(self.secrets)
        try:
            result = asyncio.run(self.matimo_instance.execute(self.tool_name, params))
            import json
            return json.dumps(result, indent=2, default=str)
        except Exception as e:
            return f"Error executing {self.tool_name}: {e}"


def build_crewai_tools(matimo: Matimo, prefix: str, secrets: dict) -> list[BaseTool]:
    """Convert Matimo tools matching a prefix into CrewAI tools."""
    tools = []
    for tool_def in matimo.list_tools():
        if prefix in tool_def.name.lower():
            crew_tool = MatimoCrewTool(
                name=tool_def.name,
                description=tool_def.description or tool_def.name,
                matimo_instance=matimo,
                tool_name=tool_def.name,
                secrets=secrets,
            )
            tools.append(crew_tool)
    return tools


def main():
    # 1. Initialize Matimo with all providers
    m = Matimo.init(auto_discover=True)
    print(f"Loaded {len(m.list_tools())} total tools")

    # 2. Build tool sets per agent
    github_tools = build_crewai_tools(m, "github", {
        "GITHUB_TOKEN": os.environ["GITHUB_TOKEN"],
    })
    slack_tools = build_crewai_tools(m, "slack", {
        "SLACK_BOT_TOKEN": os.environ["SLACK_BOT_TOKEN"],
    })

    print(f"GitHub tools: {len(github_tools)}, Slack tools: {len(slack_tools)}")

    # 3. Define agents
    github_agent = Agent(
        role="GitHub Project Analyst",
        goal="Analyze the state of the GitHub repository — open issues, recent PRs, "
             "code alerts, and overall health.",
        backstory="You are a senior developer who monitors repository health. "
                  "You read issues, check PRs, and look for code quality alerts.",
        tools=github_tools,
        verbose=True,
        allow_delegation=False,
    )

    slack_agent = Agent(
        role="Team Communication Manager",
        goal="Post clear, well-formatted project status updates to the team Slack channel.",
        backstory="You are a project coordinator who keeps the team informed via Slack. "
                  "You take reports from other agents and format them for humans.",
        tools=slack_tools,
        verbose=True,
        allow_delegation=False,
    )

    report_agent = Agent(
        role="Weekly Report Writer",
        goal="Synthesize information from the GitHub analyst into a concise weekly report.",
        backstory="You are a technical writer who creates clear, actionable project reports "
                  "from raw data. You highlight blockers, progress, and next steps.",
        tools=[],  # No tools — pure reasoning
        verbose=True,
        allow_delegation=False,
    )

    # 4. Define tasks
    analyze_task = Task(
        description=(
            "Analyze the tallclub/matimo repository:\n"
            "1. List all open issues (max 10)\n"
            "2. List recent pull requests (max 5)\n"
            "3. Check for any code scanning alerts\n"
            "4. Summarize the repo's current state"
        ),
        expected_output="A structured summary with: issue count, PR count, alert count, "
                        "and key highlights.",
        agent=github_agent,
    )

    report_task = Task(
        description=(
            "Using the GitHub analysis, write a weekly project status report with:\n"
            "- Summary (2-3 sentences)\n"
            "- Open Issues: count and top priorities\n"
            "- Pull Requests: count and status\n"
            "- Alerts: any security or code quality issues\n"
            "- Recommended next steps"
        ),
        expected_output="A formatted weekly report ready to post to Slack.",
        agent=report_agent,
        context=[analyze_task],
    )

    post_task = Task(
        description=(
            "Post the weekly report to the #engineering Slack channel.\n"
            "Format it nicely with Slack markdown (bold, bullet points, etc.)."
        ),
        expected_output="Confirmation that the report was posted to Slack.",
        agent=slack_agent,
        context=[report_task],
    )

    # 5. Create and run the crew
    crew = Crew(
        agents=[github_agent, report_agent, slack_agent],
        tasks=[analyze_task, report_task, post_task],
        process=Process.sequential,
        verbose=True,
    )

    print("\n=== Starting CrewAI Project Manager ===")
    result = crew.kickoff()
    print(f"\n=== Crew Result ===\n{result}")


if __name__ == "__main__":
    main()
```

### 19.5 `examples/async_fastapi_example.py` — Async FastAPI Tool Server

```python
"""
Expose Matimo tools as a REST API using FastAPI.

This creates endpoints for:
- GET /tools — list all available tools
- POST /execute/{tool_name} — execute a tool with JSON parameters
- GET /tools/search?q=slack — search tools by keyword

Setup:
    pip install matimo matimo-slack matimo-github fastapi uvicorn
    export SLACK_BOT_TOKEN="xoxb-..."
    export GITHUB_TOKEN="ghp_..."

Run:
    uvicorn examples.async_fastapi_example:app --reload
"""
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from matimo import Matimo


# Global Matimo instance
_matimo: Matimo | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Matimo on startup."""
    global _matimo
    _matimo = Matimo.init(auto_discover=True)
    print(f"Matimo initialized with {len(_matimo.list_tools())} tools")
    yield


app = FastAPI(
    title="Matimo Tool Server",
    description="REST API for executing Matimo AI tools",
    version="0.1.0",
    lifespan=lifespan,
)


class ExecuteRequest(BaseModel):
    params: dict[str, Any]


class ToolInfo(BaseModel):
    name: str
    description: str
    version: str
    execution_type: str
    requires_approval: bool
    parameters: dict[str, Any] | None


@app.get("/tools", response_model=list[ToolInfo])
async def list_tools():
    """List all available tools."""
    return [
        ToolInfo(
            name=t.name,
            description=t.description,
            version=t.version,
            execution_type=t.execution.type,
            requires_approval=t.requires_approval or False,
            parameters={n: p.model_dump() for n, p in (t.parameters or {}).items()},
        )
        for t in _matimo.list_tools()
    ]


@app.get("/tools/search")
async def search_tools(q: str):
    """Search tools by keyword."""
    results = _matimo.search_tools(q)
    return [{"name": t.name, "description": t.description} for t in results]


@app.post("/execute/{tool_name}")
async def execute_tool(tool_name: str, request: ExecuteRequest):
    """Execute a tool by name."""
    tool = _matimo.get_tool(tool_name)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")

    try:
        result = await _matimo.execute(tool_name, request.params)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "tools_loaded": len(_matimo.list_tools())}
```

---

## 20. CI / CD / Publishing

### GitHub Actions workflow:

```yaml
# .github/workflows/python-sdk.yml
name: Python SDK
on:
  push:
    paths: ["packages/python/**"]
  pull_request:
    paths: ["packages/python/**"]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.11", "3.12", "3.13"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      - run: |
          cd packages/python
          pip install -e ".[dev]"
          pytest tests/ -v --tb=short
      - run: |
          cd packages/python
          ruff check src/
          mypy src/matimo/ --ignore-missing-imports

  publish:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: |
          pip install build twine
          cd packages/python
          python -m build
          twine upload dist/* --username __token__ --password ${{ secrets.PYPI_TOKEN }}
```

### `pyproject.toml` (core package):

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "matimo"
version = "0.1.0"
description = "Universal AI agent tools SDK — define once in YAML, use everywhere"
readme = "README.md"
license = {text = "MIT"}
requires-python = ">=3.11"
keywords = ["ai", "agents", "tools", "langchain", "crewai", "yaml", "sdk"]
classifiers = [
    "Development Status :: 3 - Alpha",
    "Intended Audience :: Developers",
    "Topic :: Software Development :: Libraries",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Programming Language :: Python :: 3.13",
]

dependencies = [
    "pydantic>=2.0",
    "pyyaml>=6.0",
    "httpx>=0.27",
]

[project.optional-dependencies]
langchain = ["langchain-core>=0.3", "langchain>=0.3"]
crewai = ["crewai>=0.80"]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "respx>=0.21",
    "ruff>=0.8",
    "mypy>=1.13",
]

[tool.hatch.build.targets.wheel]
packages = ["src/matimo"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
target-version = "py311"
line-length = 100

[tool.mypy]
python_version = "3.11"
strict = true
```

---

## 21. Implementation Order

An AI agent should implement files in this exact order to minimize unresolved dependencies:

| Step | File(s) | Depends on | Test file |
|---|---|---|---|
| 1 | `src/matimo/errors.py` | Nothing | `test_models.py` (partial) |
| 2 | `src/matimo/core/models.py` | `errors.py` | `test_models.py` |
| 3 | `src/matimo/core/loader.py` | `models.py`, `errors.py` | `test_loader.py` |
| 4 | `src/matimo/core/registry.py` | `models.py`, `errors.py` | `test_registry.py` |
| 5 | `src/matimo/encodings/parameter_encoding.py` | `errors.py` | (tested via http_executor) |
| 6 | `src/matimo/executors/http_executor.py` | `models.py`, `errors.py`, `encodings` | `test_http_executor.py` |
| 7 | `src/matimo/executors/command_executor.py` | `models.py`, `errors.py` | `test_command_executor.py` |
| 8 | `src/matimo/executors/function_executor.py` | `models.py`, `errors.py` | `test_function_executor.py` |
| 8b | Python siblings for core function tools | Step 8 | (validated by test_function_executor) |
| 9 | `src/matimo/auth/injection.py` | `models.py` | `test_auth_injection.py` |
| 10 | `src/matimo/approval/handler.py` | `errors.py` | `test_approval.py` |
| 11 | `src/matimo/logging.py` | Nothing | (used by instance) |
| 12 | `src/matimo/instance.py` | ALL above | `test_instance.py` |
| 13 | `src/matimo/integrations/langchain.py` | `models.py`, `instance.py` | `test_langchain.py` |
| 14 | `src/matimo/integrations/crewai.py` | `models.py`, `instance.py` | (optional) |
| 15 | `src/matimo/__init__.py` | ALL above | — |
| 16 | `pyproject.toml` | — | — |
| 17 | Test fixtures | Real YAML from `packages/*/tools/` | — |
| 18 | Examples | ALL above | — |
| 19 | CI workflow | — | — |

---

## 22. Reference: TypeScript ↔ Python Mapping

| TypeScript (existing) | Python (new) | Notes |
|---|---|---|
| `MatimoInstance` | `Matimo` | Shorter name for Python convention |
| `MatimoInstance.init()` | `Matimo.init()` | `@classmethod`, sync (loader is sync) |
| `matimo.execute(name, params)` | `await m.execute(name, params)` | Async; also `m.execute_sync()` |
| `matimo.listTools()` | `m.list_tools()` | snake_case |
| `matimo.getTool(name)` | `m.get_tool(name)` | |
| `matimo.searchTools(q)` | `m.search_tools(q)` | |
| `matimo.getToolsByTag(t)` | `m.get_tools_by_tag(t)` | |
| `ToolLoader` | `ToolLoader` | Same name |
| `ToolRegistry` | `ToolRegistry` | Same name |
| `HttpExecutor` | `HttpExecutor` | Uses `httpx` instead of `axios` |
| `CommandExecutor` | `CommandExecutor` | Uses `subprocess` instead of `spawn` |
| `FunctionExecutor` | `FunctionExecutor` | Uses `importlib`; `.py` only, auto-resolves `.ts` → `.py` via dual-file convention |
| `convertToolsToLangChain()` | `convert_tools_to_langchain()` | snake_case |
| `setGlobalMatimoInstance()` | Not needed | Python uses module-level instance |
| `@tool('name')` decorator | Not ported | Use LangChain/CrewAI native decorators |
| `MatimoError` | `MatimoError` | Same name, same error codes |
| `ErrorCode` enum | `ErrorCode` enum | Same values |
| Zod schemas | Pydantic models | Same validation, different library |
| `ToolDefinition` (Zod) | `ToolDefinition` (Pydantic) | Same fields |
| `Parameter` (Zod) | `Parameter` (Pydantic) | Same fields |
| `ExecutionConfig` (discriminated union) | `HttpExecution \| CommandExecution \| FunctionExecution` | Pydantic discriminator |
| `js-yaml` | `PyYAML` | Same YAML parsing |
| `axios` | `httpx` | Same HTTP semantics |
| `child_process.spawn` | `subprocess.run` | Same process execution |
| `winston` | `logging` (stdlib) | Simpler for Python |

---

## Summary

- **YAML is shared**: Zero tool definition duplication
- **Zero Node.js dependency**: Python SDK is fully native — HTTP via httpx, commands via subprocess, functions via importlib
- **Dual-file convention**: Function tools coexist as `.ts` + `.py` in same directory; Python SDK auto-resolves
- **~400-500 lines** of core Python code: loader + registry + 3 executors + auth + instance
- **Same API surface**: Matimo.init(), .execute(), .list_tools(), convert_tools_to_langchain()
- **Same error codes**: MatimoError with identical ErrorCode enum
- **Same auto-discovery**: Entry points replace node_modules scanning
- **Live agent examples**: Full LangChain (Slack + GitHub) and CrewAI (multi-agent) examples with real tools
- **Test against real YAML**: Fixtures point to existing `packages/*/tools/` definitions
- **Implementation order**: 19 steps, each with clear dependencies and test files
