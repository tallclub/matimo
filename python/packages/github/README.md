# matimo-github

> GitHub tools for the [Matimo](https://matimo.dev) AI tools SDK — manage repositories, issues, pull requests, releases, and more.

[![PyPI](https://img.shields.io/pypi/v/matimo-github)](https://pypi.org/project/matimo-github/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://matimo.dev/docs)

---

## Installation

```bash
pip install matimo matimo-github
```

---

## Available Tools (27 Total)

| Category | Tool | Description |
|----------|------|-------------|
| **Repositories** | `get-repository` | Get repository details |
| | `list-repositories` | List repositories for user/org |
| | `create-repository` | Create a new repository |
| | `delete-repository` | Delete a repository |
| | `search-repositories` | Search GitHub repositories |
| **Issues** | `list-issues` | List issues in a repository |
| | `get-issue` | Get a single issue |
| | `create-issue` | Create a new issue |
| | `update-issue` | Update issue title, body, state, labels |
| | `search-issues` | Search issues across GitHub |
| **Pull Requests** | `list-pull-requests` | List PRs in a repository |
| | `create-pull-request` | Open a new pull request |
| | `merge-pull-request` | Merge a pull request |
| **Releases** | `list-releases` | List releases for a repository |
| | `create-release` | Create a new release with tag |
| **Commits** | `list-commits` | List commits on a branch |
| **Collaborators** | `list-collaborators` | List repository collaborators |
| | `add-collaborator` | Add a collaborator |
| **Code Search** | `search-code` | Search code across repositories |
| | `search-users` | Search GitHub users |
| **Security** | `list-code-alerts` | List Dependabot/code scanning alerts |
| | `update-code-alert` | Dismiss or resolve a code alert |

---

## Quick Start

```python
import asyncio
import os
from matimo import Matimo
from matimo_github import get_tools_path

async def main():
    matimo = await Matimo.init(get_tools_path())

    # List open issues
    result = await matimo.execute('list-issues', {
        'owner': 'my-org',
        'repo': 'my-repo',
        'state': 'open',
    })

    # Create an issue
    await matimo.execute('create-issue', {
        'owner': 'my-org',
        'repo': 'my-repo',
        'title': 'Bug: login fails on mobile',
        'body': 'Steps to reproduce...',
    })

asyncio.run(main())
```

---

## Authentication

```bash
export GITHUB_TOKEN="ghp_your-personal-access-token"
```

### Required Scopes

| Operations | Required Scope |
|-----------|---------------|
| Read public repos, issues, PRs | `public_repo` |
| Read private repositories | `repo` |
| Create/update issues, PRs | `repo` |
| Manage collaborators | `repo` + `admin:org` |
| Delete repositories | `delete_repo` |
| Read security alerts | `security_events` |

---

## LangChain Agent Example

```python
from matimo import Matimo
from matimo_github import get_tools_path
from matimo.integrations.langchain import convert_tools_to_langchain
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

matimo = await Matimo.init(get_tools_path())
lc_tools = convert_tools_to_langchain(
    matimo.list_tools(), matimo,
    credentials={'GITHUB_TOKEN': os.environ['GITHUB_TOKEN']},
)
llm = ChatOpenAI(model='gpt-4o-mini')
prompt = ChatPromptTemplate.from_messages([
    ('system', 'You are a GitHub assistant.'),
    ('human', '{input}'),
    ('placeholder', '{agent_scratchpad}'),
])
agent = create_tool_calling_agent(llm, lc_tools, prompt)
executor = AgentExecutor(agent=agent, tools=lc_tools)
result = await executor.ainvoke({'input': 'List all open issues in tallclub/matimo'})
```

---

## Documentation

- [GitHub REST API Reference](https://docs.github.com/en/rest)
- [Python Examples](https://github.com/tallclub/matimo/tree/main/python/examples/native/github)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-github/
- **GitHub:** https://github.com/tallclub/matimo
- **GitHub Docs:** https://docs.github.com/en/rest

