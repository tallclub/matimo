# Maintaining the Copilot Provider Workflow

For maintainers of the contributor workflow in [SETUP_GUIDE.md](SETUP_GUIDE.md): the Copilot agent, the skills it reads, and the MCP server it calls. The rule is simple — these files describe the SDK, so when the SDK changes, they change in the same pull request.

## The Pieces

| File | Role |
|------|------|
| `.github/agents/matimo-tool-creator-refactored.agent.md` | The Copilot agent: workflow, tool list, delivery checklist |
| `.github/skills/matimo-provider-creation/SKILL.md` | Package layout, YAML formats, auth patterns, tests, README template |
| `.github/skills/tool-creation/SKILL.md` | Repository copy of the core `tool-creation` skill |
| `typescript/packages/core/skills/tool-creation/SKILL.md` | The core skill shipped to every agent; the copy above mirrors it |
| `python/examples/mcp/src/server_http.py` | The MCP server the agent connects to (port 3101) |
| `docs/mcp/*.md` | These guides |

## When to Update What

| Change in the SDK | Update |
|-------------------|--------|
| A meta-tool's name, inputs or `requires_approval` | The agent's quick-reference table and frontmatter `tools:` list; [QUICK_REFERENCE.md](QUICK_REFERENCE.md) |
| The YAML schema (`typescript/packages/core/src/core/schema.ts`) | Provider skill Part 2; both `tool-creation` skills |
| Credential injection or auth handling | Provider skill Part 3; `tool-creation` § Credentials |
| Governance rules in `validate-tools` | Provider skill Part 2 "Governance"; the agent's Step 2 |
| Package layout (new file, new build step) | Provider skill Part 1; QUICK_REFERENCE "Where Files Go" |
| Test conventions | Provider skill Parts 4–5; [TESTING.md](../tool-development/TESTING.md) |
| The example server's port, path or env vars | SETUP_GUIDE Steps 1–2; QUICK_REFERENCE "Start" |

Keep the two `tool-creation` skills identical below the frontmatter:

```bash
diff <(sed '1,/^---$/d' typescript/packages/core/skills/tool-creation/SKILL.md) \
     <(sed '1,/^---$/d' .github/skills/tool-creation/SKILL.md)
```

The only difference should be the note in the repository copy saying it is a copy.

## Checking a Change

1. **Facts against code.** Every tool input, field name, path and command in the agent and skills must exist. Check meta-tool inputs in `typescript/packages/core/tools/<tool>/definition.yaml`.
2. **Validate the skills.** With the server running, call `matimo_validate_skill` on each changed skill, or run the core skill tests: `cd typescript && pnpm test -- -t skill`.
3. **Try the agent.** Ask it to build a two-tool package against a public API with no auth, then run:
   ```bash
   cd typescript && pnpm validate-tools && pnpm test -- packages/<provider>
   cd python && uv run pytest packages/<provider>
   ```
   Discard the package afterwards.
4. **Check the approvals.** Each `execute`, `edit`, `read` or `search` call should prompt you in VS Code.

## Known Limits

- `matimo_validate_tool` applies the rules for *agent-created* tools, so it reports `blocked-http-method` for legitimate DELETE provider tools. `pnpm validate-tools` is the authority for provider packages.
- Python packages ship the same SKILL.md as the TypeScript package, copied into `src/matimo_<name>/skills/`; edit both together (a test fails when they drift).
- The example server sets no bearer token and binds to all interfaces; keep it on a trusted machine.
- The agent's `tools:` list names the server `matimo-python-mcp-server`; a different name in `.vscode/mcp.json` hides every Matimo tool from it.

## See Also

- [SETUP_GUIDE.md](SETUP_GUIDE.md) · [QUICK_REFERENCE.md](QUICK_REFERENCE.md) · [NAVIGATION_MAP.md](NAVIGATION_MAP.md)
- [ADDING_TOOLS.md](../tool-development/ADDING_TOOLS.md) — the manual workflow
- [META_TOOLS.md](../api-reference/META_TOOLS.md) — meta-tool reference
