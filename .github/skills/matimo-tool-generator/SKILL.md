---
name: matimo-tool-generator
description: Coding agents use this skill to work on the Matimo repository with Matimo's own MCP tools — validating tool and skill definitions, finding patterns, and running checks — and to know which meta-tools are for runtime agents instead.
metadata:
  category: "Tool Development"
  difficulty: "advanced"
  domain: "Matimo SDK Maintenance"
  user-invokable: "true"
  invocation: "When user asks to create tools, skills, or extend Matimo — use this skill + Matimo MCP tools"
---

# Working on Matimo with Matimo's MCP Tools

This skill is for **coding agents changing this repository** (adding tools, skills or provider packages) while connected to Matimo's MCP server — usually the Python example server, `python/examples/mcp/src/server_http.py`, at `http://localhost:3101/mcp`. Setup: `docs/mcp/SETUP_GUIDE.md`.

## Two kinds of tool, two workflows

| You are adding… | Write it as | Check it with |
|-----------------|-------------|---------------|
| A tool or skill **in this repo** (a provider package, a core tool) | Files in the package directory, reviewed in a pull request | `matimo_validate_tool`, `matimo_validate_skill`, `pnpm validate-tools`, tests |
| A tool an agent needs **at runtime**, in a user's deployment | `matimo_create_tool` → a draft in `./matimo-tools/<name>/` | `matimo_approve_tool` by a human, then `matimo_reload_tools` |

Never use `matimo_create_tool` for the repo. It forces `status: draft` and `requires_approval: true`, and a draft runs only for the `admin` role.

## The MCP tools you will use

| Tool | Input | Output | Asks the user? |
|------|-------|--------|----------------|
| `matimo_validate_tool` | `yaml_content` | `{ valid, schemaErrors, policyViolations, riskLevel }` | No |
| `matimo_validate_skill` | `name`, `skills_dir` | validation report | No |
| `matimo_list_skills`, `matimo_get_skill`, `matimo_search_skills` | `name` / `query` | skill metadata or content | No |
| `matimo_search_tools`, `matimo_get_tool` | `query` / `name` | loaded tools, a tool's YAML | No |
| `search`, `read` | `query`, `directory` / `filePath` | matching files / file content | Yes |
| `edit` | `filePath`, `operation`, `content` | result | Yes |
| `execute` | `command` | stdout, stderr, exit code | Yes |
| `matimo_reload_tools` | — | `{ loaded, removed, revalidated, rejected }` | Yes |

"Asks the user" means the tool declares `requires_approval: true`; the server asks the person in the MCP client (an elicitation prompt) before it runs. Say what you are about to do before calling one. If the user declines, do not retry the same call.

`matimo_validate_tool` applies the rules for agent-created tools. For a repo tool, fix every `schemaErrors` entry; a `policyViolations` entry such as `blocked-http-method` on a legitimate DELETE tool is expected. `pnpm validate-tools` is the authority for the repo.

## Adding a tool to a provider package

```
1. Read the API docs; read an existing tool in the package (search, read)
2. Write typescript/packages/<provider>/tools/<tool>/definition.yaml
   and the same YAML in python/packages/<provider>/src/matimo_<provider>/tools/<tool>/
3. matimo_validate_tool(yaml_content) → fix schema errors
4. Write unit tests with mocked HTTP in both SDKs (docs/tool-development/TESTING.md)
5. execute: cd typescript && pnpm validate-tools && pnpm lint && pnpm test -- packages/<provider>
   execute: cd python && uv run ruff check packages/<provider> && uv run pytest packages/<provider>
6. Add the examples listed in CLAUDE.md
```

Governance fields: `requires_approval: true` on DELETE and other destructive calls; `risk:` on every function tool. Leave `status` unset.

For a whole new provider, follow `.github/skills/matimo-provider-creation/SKILL.md`.

## Adding a skill

1. Write `typescript/packages/<provider>/skills/<provider>/SKILL.md` (frontmatter `name` and `description`, then Markdown).
2. `matimo_validate_skill(name: "<provider>", skills_dir: "typescript/packages/<provider>/skills")`.
3. Check every tool name and input the skill mentions against the tool definitions.

`matimo_create_skill` writes to `./matimo-tools/skills` unless given `target_dir`, and asks the user first; writing the file directly is simpler for the repo.

## Seeing your change through the server

The server loads tools when it starts. Restart it, or call `matimo_reload_tools` (the user approves), then `matimo_search_tools` to confirm the new tool is listed.

## Rules

- Every input, field and path you write must exist in the code; check `typescript/packages/core/src/core/schema.ts` and the meta-tool definitions in `typescript/packages/core/tools/`.
- TypeScript and Python change together.
- Never set `MATIMO_AUTO_APPROVE` to get past an approval prompt.
- Never call a live API in a unit test.
