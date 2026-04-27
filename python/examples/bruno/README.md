# Python Bruno Examples

Example directory contains **2 example patterns** showing different ways to use Matimo's Bruno tools:

1. **Complete Workflow** - Direct SDK execution (simplest)
2. **CrewAI Agent** - Autonomous multi-agent orchestration

All examples are **fully working** and demonstrate real API testing operations.

## 🚀 Quick Start

### Prerequisites

```bash
# Install from workspace (ensures using local matimo)
cd python && uv sync
```

No external API keys required - examples use public JSONPlaceholder API.

## 📚 Examples Overview

### 1. Complete Workflow (`complete_workflow.py`)

**Best for:** Direct API testing automation, scripting, quick demonstrations

**What it does:**
- ✅ Creates Bruno collections programmatically
- ✅ Adds 4 HTTP requests (GET/POST/PUT/DELETE)
- ✅ Inspects collection structure
- ✅ Executes full test suite with assertions
- ✅ Runs individual requests
- ✅ Lists available collections
- ✅ Imports from OpenAPI spec

**Run it:**
```bash
uv run python examples/bruno/complete_workflow.py
```

**Customize workspace:**
```bash
uv run python examples/bruno/complete_workflow.py --workspace:./my-collections
```

**Output:**
```
✅ Loaded 7 Bruno tools
1️⃣  WORKFLOW 1: Create Collection & Add Requests
   ✅ GET request added
   ✅ POST request added
   ✅ PUT request added
   ✅ DELETE request added

2️⃣  WORKFLOW 2: Inspect Collection Structure
   ✅ Collection found:
      Name: Sample API Tests
      Requests: 4

...and more
```

### 2. CrewAI Agent (`crewai_agent.py`)

**Best for:** Autonomous agent orchestration, complex workflows, LLM-driven decisions

**What it does:**
- ✅ 3 autonomous agents working together
- ✅ AI decides how to structure collections
- ✅ LLM-driven request generation
- ✅ Multi-step agentic workflows
- ✅ Comprehensive error handling

**Setup:**
```bash
# Set OpenAI API key
export OPENAI_API_KEY="sk-..."
```

**Run it:**
```bash
uv run python examples/bruno/crewai_agent.py
```

**Output:**
```
🤖 Initializing OpenAI LLM...
✅ Loaded 7 Bruno tools

🧠 Agent Tasks:
  1️⃣  Create collection
  2️⃣  Add 4 HTTP requests (GET/POST/PUT/DELETE)
  3️⃣  Inspect collection
  4️⃣  Run full test suite
  5️⃣  Debug single request
  6️⃣  Import from OpenAPI

⏳ Crew is working on tasks...
```

## 🎯 Available Bruno Tools (7 Total)

| Tool | Purpose |
|------|---------|
| `bruno_create_collection` | Creates new collection |
| `bruno_add_request` | Adds HTTP request |
| `bruno_get_collection_info` | Retrieves metadata |
| `bruno_run_collection` | Executes all requests |
| `bruno_run_request` | Executes single request |
| `bruno_list_collections` | Lists collections |
| `bruno_import_openapi` | Imports from OpenAPI spec |

## 📊 Test API

Both examples use **JSONPlaceholder** - a free fake REST API for testing:

```
GET https://jsonplaceholder.typicode.com/todos?_limit=5
POST https://jsonplaceholder.typicode.com/todos
PUT https://jsonplaceholder.typicode.com/todos/1
DELETE https://jsonplaceholder.typicode.com/todos/1
```

## 🔧 Customization

### Change Workspace Directory

```bash
# Complete workflow
uv run python examples/bruno/complete_workflow.py --workspace:./api-tests

# Environment variable
export BRUNO_WORKSPACE=./my-collections
uv run python examples/bruno/complete_workflow.py
```

### Modify Request Parameters

Edit the `requests_data` list in `complete_workflow.py`:

```python
requests_data = [
    {
        "name": "your-request",
        "method": "GET",
        "url": "https://your-api.com/endpoint",
        "headers": {"Authorization": "Bearer token"},
    },
    ...
]
```

## 📦 Structure

```
python/examples/bruno/
├── complete_workflow.py   # Factory pattern example
├── crewai_agent.py       # CrewAI multi-agent example
└── README.md             # This file
```

## ✅ Status

- ✅ **7 Tools Implemented** - All Bruno tools supported
- ✅ **2 Example Patterns** - Factory + CrewAI
- ✅ **Type-Safe** - Full Python type hints
- ✅ **Production Ready** - Tested and working
- ✅ **Local Matimo** - Uses workspace installation

---

**Part of Matimo ecosystem** - Define tools once in YAML, use everywhere! 🎯
