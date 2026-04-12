# Matimo Python SDK — Examples

A standalone project demonstrating how to use the [Matimo Python SDK](https://github.com/tallclub/matimo/tree/main/python) with every supported integration pattern and provider.

> These examples mirror the TypeScript examples in [`typescript/examples/tools/`](../../typescript/examples/tools/) at full parity — plus Python-native advanced demos for policy, skills, meta-tools, and logging.

---

## Quick Start

```bash
# 1. Copy credentials template
cp .env.example .env
# Fill in your API keys in .env

# 2. Install dependencies
make install
# (requires uv — https://docs.astral.sh/uv/getting-started/installation/)

# 3. Run your first example
make slack-factory

# 4. Run an advanced native demo (needs OPENAI_API_KEY)
make policy-demo
make skills-demo
make meta-flow
make logger-example    # No API key needed
```

---

## Patterns

Examples are organized into three framework groups plus a set of advanced native demos:

| Group | Pattern | When to use |
|-------|---------|-------------|
| **native/** | Factory & Decorator | Simple scripts, CLIs, class-based agents — no LLM required |
| **native/policy/**, **native/skills/**, **native/meta_flow/** | Advanced LangChain ReAct demos | Full-featured policy, skills, and meta-tool lifecycle walkthroughs |
| **langchain/** | LangChain ReAct | LLM-driven agents — model decides which tools to call |
| **crewai/** | CrewAI | Multi-agent workflows with role-based crews |

---

## Directory Structure

```
examples/
├── pyproject.toml              ← standalone project (declares matimo as a dep)
├── Makefile                    ← run any example with `make <target>`
├── .env.example                ← credential template — copy to .env
│
├── native/                     ← Factory, Decorator, and advanced agent demos
│   │
│   ├── logger_example.py       ← Structured logging (no API key needed) ✅
│   │
│   ├── agents/
│   │   ├── factory_pattern_agent.py     ← LLM agent — factory pattern
│   │   └── decorator_pattern_agent.py   ← LLM agent — decorator pattern
│   │
│   ├── credentials/
│   │   └── credentials_example.py       ← Per-call credential overrides
│   │
│   ├── policy/
│   │   └── policy_demo.py      ← 11-mission policy + HITL lifecycle demo ✅
│   │       # Covers: PolicyEngine, risk classification, draft/deprecated/blocked
│   │       # tools, content validator, approval workflows, hot-reload atomicity,
│   │       # programmatic policy checks, access control
│   │
│   ├── skills/
│   │   └── skills_demo.py      ← 6-mission skills lifecycle demo ✅
│   │       # Covers: create SKILL.md via agent, list/read skills, apply guidelines,
│   │       # validate skills, get_skills_metadata(), semantic_search_skills(),
│   │       # build_relevant_skill_prompt() — progressive disclosure L1/L2
│   │
│   ├── meta_flow/
│   │   └── meta_tools_integration.py   ← 5-mission meta-tools lifecycle demo ✅
│   │       # Covers: matimo_create_tool, matimo_validate_tool, matimo_approve_tool,
│   │       # matimo_reload_tools, matimo_list_user_tools, matimo_get_tool_status,
│   │       # policy-blocked tools (shell/file-reader), full tool lifecycle end-to-end
│   │
│   ├── execute/
│   │   ├── execute_factory.py           ← Execute tools — factory pattern
│   │   └── execute_decorator.py         ← Execute tools — decorator pattern
│   │
│   ├── read/
│   │   ├── read_factory.py              ← File read tool
│   │   └── read_decorator.py
│   │
│   ├── edit/
│   │   ├── edit_factory.py              ← File edit tool
│   │   └── edit_decorator.py
│   │
│   ├── search/
│   │   ├── search_factory.py            ← Search tool
│   │   └── search_decorator.py
│   │
│   ├── web/
│   │   ├── web_factory.py               ← Web fetch tool
│   │   └── web_decorator.py
│   │
│   ├── slack/
│   │   ├── slack_factory.py
│   │   └── slack_decorator.py
│   │
│   ├── github/
│   │   ├── github_factory.py
│   │   └── github_decorator.py
│   │
│   ├── gmail/
│   │   ├── gmail_factory.py
│   │   └── gmail_decorator.py
│   │
│   ├── notion/
│   │   ├── notion_factory.py
│   │   └── notion_decorator.py
│   │
│   ├── hubspot/
│   │   ├── hubspot_factory.py
│   │   └── hubspot_decorator.py
│   │
│   ├── mailchimp/
│   │   ├── mailchimp_factory.py
│   │   └── mailchimp_decorator.py
│   │
│   ├── postgres/
│   │   ├── postgres_factory.py
│   │   └── postgres_decorator.py
│   │
│   └── twilio/
│       ├── twilio_factory.py
│       └── twilio_decorator.py
│
├── langchain/              ← LangChain ReAct agent examples
│   ├── agents/
│   │   ├── langchain_agent.py             ← Generic multi-provider ReAct agent
│   │   └── langchain_skills_policy_agent.py  ← L1+L2 skills + policy-aware creation
│   ├── slack/
│   │   └── slack_langchain.py
│   ├── github/
│   │   ├── github_langchain.py
│   │   └── github_with_approval.py        ← HITL before mutations
│   ├── gmail/
│   │   └── gmail_langchain.py
│   ├── postgres/
│   │   ├── postgres_langchain.py
│   │   └── postgres_with_approval.py      ← LLM writes SQL, human approves
│   ├── notion/
│   │   └── notion_langchain.py
│   ├── hubspot/
│   │   └── hubspot_langchain.py
│   ├── mailchimp/
│   │   └── mailchimp_langchain.py
│   ├── twilio/
│   │   └── twilio_langchain.py
│   ├── read/
│   │   └── read_langchain.py
│   ├── search/
│   │   └── search_langchain.py
│   ├── execute/
│   │   └── execute_langchain.py
│   ├── edit/
│   │   └── edit_langchain.py
│   └── web/
│       └── web_langchain.py
│
└── crewai/                 ← CrewAI multi-agent examples
    ├── agents/
    │   ├── crewai_agent.py           ← Single-agent CrewAI with Matimo tools
    │   └── multi_agent_crew.py       ← Multi-agent crew orchestration
    ├── slack/
    │   └── slack_crewai.py
    ├── github/
    │   └── github_crewai.py
    ├── gmail/
    │   └── gmail_crewai.py
    ├── notion/
    │   └── notion_crewai.py
    ├── hubspot/
    │   └── hubspot_crewai.py
    ├── mailchimp/
    │   └── mailchimp_crewai.py
    ├── postgres/
    │   └── postgres_crewai.py
    └── twilio/
        └── twilio_crewai.py
```

---

## Advanced Native Demos

These three demos (plus the logger) are full-featured walkthroughs designed to be studied end-to-end. They use real LangChain ReAct loops — not mocks — and verify each step programmatically.

### `native/policy/policy_demo.py` — Policy Engine & HITL Lifecycle

11 missions covering the complete policy lifecycle:

| Mission | What it shows |
|---------|--------------|
| 1 | Auto-approve safe HTTP tool — `weather_fetch` created and reloaded |
| 2 | Domain restriction — tool blocked by `allowed_domains` policy config |
| 3 | Content validation — SSRF-blocked URL pattern caught by `content-validator` |
| 4 | Default policy — deprecated tool always blocked |
| 5 | Risk classification — `classify_risk()` returns `high` for shell + network tools |
| 6 | Full lifecycle with calculator — create → approve → reload → execute |
| 7 | Draft tool allowed outside production environment |
| 8 | Draft tool blocked in `environment="prod"` |
| 9 | Policy tier query — `get_tier_for_tool()` returns `approval-required` |
| 10 | Hot-reload atomicity — malformed YAML triggers rollback; good tools survive |
| 11 | Approval state tracking — `tool_status` reports `approved` vs `pending` |

Phase 3 closes with programmatic checks (no agent): `DefaultPolicyEngine`, `classify_risk()`, `validate_tool_content()`, approval manifest inspection.

### `native/skills/skills_demo.py` — Skills Lifecycle

6 missions + Phase 4 progressive disclosure:

| Mission | What it shows |
|---------|--------------|
| 1 | Agent creates `code-review` SKILL.md via `matimo_create_skill` |
| 2 | Agent lists available skills via `matimo_list_skills` |
| 3 | Agent reads skill + applies code-review guidelines to a Python snippet |
| 4 | Agent creates `security-checklist` skill |
| 5 | Agent validates both skills via `matimo_validate_skill` |
| 6 | Agent applies all available skills to a combined review |

Phase 4 (no agent): `Matimo.init(skill_paths=[...])` → `get_skills_metadata()` (Level 1) → `semantic_search_skills()` (TF-IDF ranked) → `build_relevant_skill_prompt()` (Level 2, ready-to-inject string).

### `native/meta_flow/meta_tools_integration.py` — Meta-Tools Lifecycle

5 missions covering the full tool creation lifecycle:

| Mission | What it shows |
|---------|--------------|
| 1 | `weather_fetch` — safe HTTP GET: doctor → create → review → reload → execute |
| 2 | `shell_exec` — command type blocked by policy (expect WARN) |
| 3 | `file_reader` — `cat` command blocked by policy (expect WARN) |
| 4 | `user_lookup` + `github_stars` — two safe tools, full lifecycle |
| 5 | List all created tools, execute one |

Phase 3 closes with disk verification (`definition.yaml` exists per tool) and a mission results table.

### `native/logger_example.py` — Structured Logging

No API key needed. 6 sections:

```
1. Simple text format  → setup_logger(level='debug', log_format='simple')
2. JSON format         → setup_logger(level='info', log_format='json')
3. Global singleton    → get_global_matimo_logger() / set_global_matimo_logger()
4. SDK logger          → Matimo.init(log_level='debug') → matimo._logger
5. Level filtering     → setup_logger(level='warn')  [debug/info suppressed]
6. Silent mode         → setup_logger(level='silent') [for tests]
```

---

## All Make Targets

```bash
make help              # Show all available targets

# ── Advanced Native Demos (requires OPENAI_API_KEY) ──
make policy-demo       # Policy + HITL lifecycle (11 missions)
make skills-demo       # Skills lifecycle + progressive disclosure (6 missions)
make meta-flow         # Meta-tools lifecycle (5 missions)
make logger-example    # Structured logging (no API key needed)

# ── Generic Framework Agents ──
make agent-langchain   # Multi-provider LangChain ReAct agent
make agent-crewai      # Multi-provider CrewAI crew

# ── Slack ──
make slack-factory
make slack-decorator
make slack-langchain
make slack-crewai

# GitHub
make github-factory
make github-decorator
make github-langchain
make github-approval   # Human-in-the-loop (LangChain)
make github-crewai

# Gmail
make gmail-factory
make gmail-decorator
make gmail-langchain
make gmail-crewai

# PostgreSQL
make postgres-factory
make postgres-decorator
make postgres-langchain
make postgres-approval  # Human-in-the-loop (LangChain)
make postgres-crewai

# Notion
make notion-factory
make notion-decorator
make notion-langchain
make notion-crewai

# HubSpot
make hubspot-factory
make hubspot-decorator
make hubspot-langchain
make hubspot-crewai

# Mailchimp
make mailchimp-factory
make mailchimp-decorator
make mailchimp-langchain
make mailchimp-crewai

# Twilio
make twilio-factory
make twilio-decorator
make twilio-langchain
make twilio-crewai
```

---

## Local Development Setup

To test the examples against the latest local SDK code, use the uv workspace:

```bash
# From the repo root python/ directory
cd /path/to/matimo/python

# Install entire workspace (SDK + all packages + examples)
uv sync --all-extras --dev

# Run any example directly via the workspace context
cd examples/native
uv run -w ../.. python policy/policy_demo.py
uv run -w ../.. python skills/skills_demo.py
uv run -w ../.. python meta_flow/meta_tools_integration.py
uv run -w ../.. python logger_example.py

# Or use the Makefile targets from python/
make policy-demo
make skills-demo
make meta-flow
make logger-example
```

**Important**: Always run examples via `uv run -w ../..` (pointing to `python/`) so the workspace resolver picks up all local packages. Do **not** run with the system Python directly.

---

## Requirements

| Requirement | Version |
|-------------|---------|
| Python | 3.11+ |
| uv | latest (https://docs.astral.sh/uv/) |
| OPENAI_API_KEY | Required for all LangChain/agent demos |
| Provider credentials | See `.env.example` for per-provider vars |

The `pyproject.toml` in `examples/` declares matimo as a workspace dependency. When run via `uv run -w ../..`, it resolves against the local source automatically — no manual editable installs needed.
