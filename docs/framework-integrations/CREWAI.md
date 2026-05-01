# CrewAI Integration

Matimo integrates seamlessly with **CrewAI** for multi-agent orchestration. Convert any Matimo tool to a CrewAI `BaseTool` with a single function call.

- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Single Agent Example](#single-agent-example)
- [Multi-Agent Crew Example](#multi-agent-crew-example)
- [Advanced Patterns](#advanced-patterns)
- [Troubleshooting](#troubleshooting)

---

## Installation

### Requirements

- Python 3.11+
- CrewAI >= 0.80
- Matimo >= 0.1.0

### Install

```bash
# Install matimo with CrewAI support
pip install "matimo[crewai]" matimo-slack
# or with uv
uv add "matimo[crewai]" matimo-slack

# Install CrewAI
pip install crewai
```

---

## Basic Setup

```python
import asyncio
import os
from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai
from crewai import Agent, Task, Crew
from langchain_openai import ChatOpenAI

async def setup():
    # 1. Initialize Matimo
    matimo = await Matimo.init(auto_discover=True)

    # 2. Filter tools (optional — use all or subset)
    slack_tools_def = [
        t for t in matimo.list_tools() 
        if t.name.startswith('slack_')
    ]

    # 3. Convert to CrewAI BaseTool
    crewai_tools = convert_tools_to_crewai(
        slack_tools_def,
        matimo,
        credentials={'SLACK_BOT_TOKEN': os.environ['SLACK_BOT_TOKEN']},
    )

    return matimo, crewai_tools

asyncio.run(setup())
```

---

## Single Agent Example

```python
import asyncio
import os
from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai
from crewai import Agent, Task, Crew
from langchain_openai import ChatOpenAI

async def slack_agent_demo():
    # Initialize
    matimo = await Matimo.init(auto_discover=True)
    
    # Get Slack tools only
    slack_tools_def = [
        t for t in matimo.list_tools()
        if t.name.startswith('slack_')
    ]
    
    # Convert to CrewAI
    tools = convert_tools_to_crewai(
        slack_tools_def,
        matimo,
        credentials={'SLACK_BOT_TOKEN': os.environ['SLACK_BOT_TOKEN']},
    )

    # Create agent
    slack_manager = Agent(
        role='Slack Manager',
        goal='Send messages and manage Slack channels',
        tools=tools,
        llm=ChatOpenAI(model='gpt-4o-mini'),
        verbose=True,
    )

    # Create task
    task = Task(
        description='Send a greeting message to #general channel',
        agent=slack_manager,
        expected_output='Message sent successfully',
    )

    # Run crew (actually runs the agent)
    crew = Crew(agents=[slack_manager], tasks=[task])
    result = crew.kickoff()
    print(f"Result: {result}")

# Run
asyncio.run(slack_agent_demo())
```

---

## Multi-Agent Crew Example

```python
import asyncio
import os
from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai
from crewai import Agent, Task, Crew
from langchain_openai import ChatOpenAI

async def multi_agent_crew():
    # Initialize Matimo
    matimo = await Matimo.init(auto_discover=True)

    # Get tools by provider
    slack_tools = [
        t for t in matimo.list_tools()
        if t.name.startswith('slack_')
    ]
    github_tools = [
        t for t in matimo.list_tools()
        if t.name.startswith('github_')
    ]

    # Convert both
    slack_crewai_tools = convert_tools_to_crewai(
        slack_tools, matimo,
        credentials={'SLACK_BOT_TOKEN': os.environ['SLACK_BOT_TOKEN']},
    )
    github_crewai_tools = convert_tools_to_crewai(
        github_tools, matimo,
        credentials={'GITHUB_TOKEN': os.environ['GITHUB_TOKEN']},
    )

    # Create agents
    slack_manager = Agent(
        role='Slack Communicator',
        goal='Handle all Slack communications',
        tools=slack_crewai_tools,
        llm=ChatOpenAI(model='gpt-4o-mini'),
    )

    github_manager = Agent(
        role='GitHub Coordinator',
        goal='Manage GitHub repositories and issues',
        tools=github_crewai_tools,
        llm=ChatOpenAI(model='gpt-4o-mini'),
    )

    # Create tasks
    slack_task = Task(
        description='Post daily standup to #engineering',
        agent=slack_manager,
        expected_output='Standup posted',
    )

    github_task = Task(
        description='List open issues for the project',
        agent=github_manager,
        expected_output='Issues listed',
    )

    # Run crew with multiple agents
    crew = Crew(
        agents=[slack_manager, github_manager],
        tasks=[slack_task, github_task],
        verbose=True,
    )
    result = crew.kickoff()
    print(f"Crew result: {result}")

asyncio.run(multi_agent_crew())
```

---

## Advanced Patterns

### Pattern 1: Hierarchical Crew (Manager Pattern)

```python
from crewai import Agent, Task, Crew

async def hierarchical_crew():
    matimo = await Matimo.init(auto_discover=True)
    
    # Worker agents
    slack_worker = Agent(
        role='Slack Specialist',
        goal='Execute Slack operations',
        tools=convert_tools_to_crewai([...], matimo),
    )

    github_worker = Agent(
        role='GitHub Specialist',
        goal='Execute GitHub operations',
        tools=convert_tools_to_crewai([...], matimo),
    )

    # Manager agent coordinates workers
    manager = Agent(
        role='Project Manager',
        goal='Coordinate team activities',
        tools=[],  # Manager uses reports, not direct tools
    )

    # Tasks with dependencies
    tasks = [
        Task(description='Check GitHub issues', agent=github_worker),
        Task(description='Post status to Slack', agent=slack_worker),
        Task(description='Summarize progress', agent=manager),
    ]

    crew = Crew(agents=[slack_worker, github_worker, manager], tasks=tasks)
    result = crew.kickoff()
    return result

asyncio.run(hierarchical_crew())
```

### Pattern 2: Sequential vs Parallel Execution

```python
from crewai import Crew, Process

# Sequential (default) — one task at a time
crew_sequential = Crew(
    agents=[agent1, agent2],
    tasks=[task1, task2],  # task2 waits for task1
    process=Process.sequential,  # Default
)

# Hierarchical — manager coordinates workers
crew_hierarchical = Crew(
    agents=[worker1, worker2, manager],
    tasks=[task1, task2, task3],
    process=Process.hierarchical,
    manager_agent=manager,
)

result = crew_sequential.kickoff()
```

### Pattern 3: Custom Credentials Per Agent

```python
import os

async def custom_credentials():
    matimo = await Matimo.init(auto_discover=True)
    
    # Different credentials for different agents
    agent1_tools = convert_tools_to_crewai(
        tools,
        matimo,
        credentials={
            'SLACK_BOT_TOKEN': os.environ.get('SLACK_BOT_TOKEN_PROD'),
        }
    )

    agent2_tools = convert_tools_to_crewai(
        tools,
        matimo,
        credentials={
            'SLACK_BOT_TOKEN': os.environ.get('SLACK_BOT_TOKEN_DEV'),
        }
    )

    # Agents use isolated credentials
    agent1 = Agent(..., tools=agent1_tools)
    agent2 = Agent(..., tools=agent2_tools)
```

---

## Troubleshooting

### Issue: Tools Not Showing in Agent

**Problem**: Agent can't see/use tools in CrewAI.

**Solution**: Verify tools are converted properly:
```python
tools = convert_tools_to_crewai(tool_definitions, matimo)
print(f"✅ Converted {len(tools)} tools")
print([t.name for t in tools])  # Should see tool names
```

### Issue: Credentials Not Working

**Problem**: Tool execution fails with authentication error.

**Solution**: Pass credentials at conversion time:
```python
tools = convert_tools_to_crewai(
    tool_definitions,
    matimo,
    credentials={'SLACK_BOT_TOKEN': os.environ['SLACK_BOT_TOKEN']},
)
```

### Issue: Performance/Timeout

**Problem**: Tools run slow or timeout in Jupyter/async context.

**Solution**: CrewAI uses a shared executor for event loops; ensure Jupyter environment has async support:
```python
# In Jupyter, use asyncio properly
import asyncio
import nest_asyncio

nest_asyncio.apply()  # Allow nested event loops
```

---

## Best Practices

1. **Filter tools by provider** — Don't load all 110+ tools; be specific
   ```python
   slack_tools = [t for t in matimo.list_tools() if 'slack' in t.name]
   ```

2. **Pass credentials at conversion** — Isolate credentials per agent
   ```python
   tools = convert_tools_to_crewai(slack_tools, matimo, credentials={...})
   ```

3. **Use descriptive agent roles** — Help LLM understand tool purpose
   ```python
   Agent(role='Slack Message Sender', goal='Send messages to Slack', ...)
   ```

4. **Set verbose=True for debugging** — See what the agent is doing
   ```python
   crew = Crew(..., verbose=True)
   ```

5. **Monitor tool coverage** — Ensure agent has the tools it needs
   ```python
   print(f"🔧 Agent has {len(agent.tools)} tools")
   ```

---

## See Also

- [LangChain Integration](./LANGCHAIN.md) — Use with LangChain agents
- [Native Python Patterns](../user-guide/SDK_PATTERNS.md#python) — SDK without framework
- [Provider Tools Reference](../tools/) — Full tool documentation
- [API Reference](../api-reference/SDK.md#python) — Python SDK API
