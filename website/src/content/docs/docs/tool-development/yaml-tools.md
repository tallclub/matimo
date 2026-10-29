---
title: "YAML Tool Specification"
description: "Write Matimo tools in YAML: HTTP and command tools, parameters, templates and validation."
---
Complete guide to writing Matimo tools in YAML format.

## Quick Reference

See the [detailed specification](/docs/tool-development/tool-specification/) for complete documentation.

**Quick tool template:**

```yaml
name: my_tool
description: Brief description
version: '1.0.0'

parameters:
  query:
    type: string
    description: What this parameter does
    required: true

execution:
  type: http
  method: GET
  url: 'https://api.example.com/search'
  query_params:
    q: '{query}'

output_schema:
  type: object
  properties:
    result:
      type: string
```

## Key Sections

| Section          | Purpose                             |
| ---------------- | ----------------------------------- |
| `name`              | Unique tool identifier (snake_case, matching its directory) |
| `description`       | One-line description                |
| `version`           | Semantic version (e.g., 1.0.0)      |
| `parameters`        | Tool input parameters               |
| `execution`         | How the tool runs (HTTP, command or function) |
| `output_schema`     | What the tool returns; `max_response_size` caps it |
| `authentication`    | OAuth2/API key config (optional)    |
| `requires_approval` | Ask a human before every call (optional; DELETE and command tools ask by default) |
| `risk`              | low / medium / high / critical (optional; required for function tools) |
| `status`            | draft / approved / deprecated (optional) |
| `error_handling`    | Retry settings (optional; accepted but not yet applied) |

## Full Specification

The complete YAML schema documentation is in [TOOL_SPECIFICATION.md](/docs/tool-development/tool-specification/).

Topics covered:

- Metadata (name, description, version)
- Parameter types and constraints
- Execution modes (HTTP, command, function)
- Governance fields (approval, risk, status)
- Authentication configuration
- Output schema validation and response-size caps
- Error handling settings
- Examples for each type

## Next Steps

- **Full Specification**: [TOOL_SPECIFICATION.md](/docs/tool-development/tool-specification/)
- **Test Your Tool**: [Testing Guide](/docs/tool-development/testing/)
- **Decorator Pattern**: [Decorator Guide](/docs/tool-development/decorator-guide/)
