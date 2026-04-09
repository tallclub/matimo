# Matimo Python SDK — Examples

A standalone project demonstrating how to use the [Matimo Python SDK](https://github.com/matimo-ai/matimo/tree/main/python) with every supported integration pattern and provider.

> These examples mirror the TypeScript examples in [`examples/tools/`](../../../examples/tools/) at parity.

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
```

---

## Patterns

Examples are organized into three framework groups:

| Group | Pattern | When to use |
|-------|---------|-------------|
| **native/** | Factory & Decorator | Simple scripts, CLIs, class-based agents — no LLM required |
| **langchain/** | LangChain ReAct | LLM-driven agents — model decides which tools to call |
| **crewai/** | CrewAI | Multi-agent workflows with role-based crews |

---

## Directory Structure

```
examples/
├── pyproject.toml          ← standalone project (declares matimo as a dep)
├── Makefile                ← run any example with `make <target>`
├── .env.example            ← credential template — copy to .env
│
├── native/                 ← Factory & Decorator examples (no LLM needed)
│   ├── slack/
│   │   ├── slack_factory.py
│   │   └── slack_decorator.py
│   ├── github/
│   ├── gmail/
│   ├── postgres/
│   ├── notion/
│   ├── hubspot/
│   ├── mailchimp/
│   └── twilio/
│
├── langchain/              ← LangChain ReAct agent examples
│   ├── agents/
│   │   └── langchain_agent.py   ← generic multi-provider ReAct agent
│   ├── slack/
│   │   └── slack_langchain.py
│   ├── github/
│   │   ├── github_langchain.py
│   │   └── github_with_approval.py   ← human-in-the-loop before mutations
│   ├── gmail/
│   ├── postgres/
│   │   ├── postgres_langchain.py
│   │   └── postgres_with_approval.py ← LLM writes SQL, human approves before exec
│   ├── notion/
│   ├── hubspot/
│   ├── mailchimp/
│   └── twilio/
│
└── crewai/                 ← CrewAI multi-agent examples
    ├── agents/
    │   └── crewai_agent.py      ← generic multi-provider CrewAI crew
    ├── slack/
    ├── github/
    ├── gmail/
    ├── postgres/
    ├── notion/
    ├── hubspot/
    ├── mailchimp/
    └── twilio/
```

---

## All Make Targets

```bash
make help              # Show all available targets

# Generic agents
make agent-langchain   # Multi-provider LangChain ReAct agent
make agent-crewai      # Multi-provider CrewAI crew

# Slack
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

To test the examples against the latest local SDK code (from `../src` and `../providers/`):

```bash
# 1. From this directory, install the local SDK + providers in editable mode
cd ..  # go to python/
uv sync --extra dev  # installs root SDK
uv pip install -e ./src
uv pip install -e ./providers/matimo-*

# 2. Back to examples and install locally
cd examples/
uv sync --extra dev

# 3. Now examples use the development versions
make slack-factory
```

**Note**: The `pyproject.toml` defaults to published versions from PyPI. For local development, use the commands above to override with local editable installs.

---

## Requirements

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (recommended) or pip
- OpenAI API key (for LangChain examples)
- Provider credentials (see `.env.example`)
