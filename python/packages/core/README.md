# matimo-core

Core module for the [Matimo](https://matimo.dev) Python SDK.

Write tools once in YAML, use them everywhere — with LangChain, CrewAI, MCP, and more.

## Installation

```bash
pip install matimo-core
# or with extras
pip install "matimo-core[langchain,crewai]"
```

## Quick start

```python
import asyncio
from matimo import Matimo

async def main():
    matimo = await Matimo.init(auto_discover=True)
    result = await matimo.execute('calculator', {'operation': 'add', 'a': 5, 'b': 3})
    print(result)

asyncio.run(main())
```

See the [full documentation](https://matimo.dev/docs) for details.
