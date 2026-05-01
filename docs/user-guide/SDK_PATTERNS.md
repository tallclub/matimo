# SDK Usage Patterns

Learn the three main ways to use Matimo SDK, from simplest to most powerful. Both **TypeScript** and **Python** SDKs support all three patterns.

- [Python SDK Patterns](#python-sdk)
- [TypeScript SDK Patterns](#typescript-sdk)

---

## Python SDK

### Pattern 1: Factory Pattern

The simplest way — initialise once, call `execute()` anywhere.

#### Basic Setup

```python
import asyncio
from matimo import Matimo

async def main():
    matimo = await Matimo.init('./tools')
    # or auto-discover installed provider packages:
    # matimo = await Matimo.init(auto_discover=True)
```

#### Execute a Tool

```python
result = await matimo.execute('calculator', {
    'operation': 'add',
    'a': 5,
    'b': 3,
})
print(result)  # {'result': 8}
```

#### Discover Tools

```python
# List all tools
all_tools = matimo.list_tools()
print(f"Loaded {len(all_tools)} tools")

# Get a specific tool
tool = matimo.get_tool('calculator')
print(f"Tool: {tool.name} - {tool.description}")

# Search tools
results = matimo.search_tools('slack')
for t in results:
    print(f"Found: {t.name}")
```

#### Handle Errors

```python
from matimo.errors import MatimoError, ErrorCode

try:
    result = await matimo.execute('slack_send_channel_message', {
        'channel': '#general',
        'text': 'Hello',
    })
except MatimoError as e:
    if e.code == ErrorCode.TOOL_NOT_FOUND:
        print(f"Tool not available: {e.message}")
    elif e.code == ErrorCode.VALIDATION_FAILED:
        print(f"Bad parameters: {e.context}")
    elif e.code == ErrorCode.EXECUTION_FAILED:
        print(f"Tool error: {e.context}")
```

#### Multi-Tenant: Per-Call Credentials

```python
# Pass credentials per call instead of environment variables
result = await matimo.execute(
    'slack_send_channel_message',
    {'channel': '#general', 'text': 'Hello'},
    credentials={'SLACK_BOT_TOKEN': user_token},
)
```

#### Complete Example

```python
import asyncio
from matimo import Matimo

async def main():
    # 1. Initialise
    matimo = await Matimo.init('./tools')

    # 2. List available tools
    tools = matimo.list_tools()
    print(f"📦 Loaded {len(tools)} tools")

    # 3. Execute tool
    result = await matimo.execute('slack_send_channel_message', {
        'channel': '#general',
        'text': 'Hello from Matimo!',
    })
    print('✅ Message sent:', result)

asyncio.run(main())
```

**Best for:** Scripts, CLI tools, async backends, cron jobs, webhooks

---

### Pattern 2: Decorator Pattern

Ideal for class-based agents — bind tools directly to method signatures.

#### Basic Setup

```python
from matimo import Matimo
from matimo.decorators import tool, set_global_matimo_instance

async def setup():
    matimo = await Matimo.init('./tools')
    # Make instance available to all @tool decorators
    set_global_matimo_instance(matimo)
    return matimo
```

#### Define Methods with @tool

```python
class EmailBot:
    @tool('slack_send_channel_message')
    async def send_message(self, channel: str, text: str):
        ...  # Body is ignored — decorator executes the tool

    @tool('slack_list_channels')
    async def list_channels(self):
        ...
```

#### How the Decorator Works

```
1. Call: bot.send_message('#general', 'Hello!')
2. Decorator maps positional/keyword args to tool params:
       → {'channel': '#general', 'text': 'Hello!'}
3. Calls: await matimo.execute('slack_send_channel_message', {...})
4. Returns result to caller
```

#### Advanced: Multi-Tool Orchestration

```python
from matimo import Matimo
from matimo.decorators import tool, set_global_matimo_instance

class SmartAssistant:
    @tool('calculator')
    async def calculate(self, operation: str, a: float, b: float):
        ...

    @tool('slack_send_channel_message')
    async def notify_slack(self, channel: str, text: str):
        ...

    # Orchestration method — not decorated
    async def run_daily_report(self, channel: str):
        result = await self.calculate('add', 100, 50)
        await self.notify_slack(channel, f"Daily total: {result['result']}")

# Usage
async def main():
    matimo = await Matimo.init('./tools')
    set_global_matimo_instance(matimo)

    assistant = SmartAssistant()
    await assistant.run_daily_report('#reports')
```

**Best for:** Class-based agents, frameworks using method dispatch

---

### Pattern 3: LangChain / Framework Integration

Convert Matimo tools to LangChain `StructuredTool` objects in one call.

```python
import asyncio
from matimo import Matimo
from matimo.integrations.langchain import convert_tools_to_langchain
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

async def main():
    # 1. Load Matimo tools
    matimo = await Matimo.init(auto_discover=True)

    # 2. Convert to LangChain (one line)
    lc_tools = convert_tools_to_langchain(
        matimo.list_tools(),
        matimo,
        credentials={'SLACK_BOT_TOKEN': os.environ['SLACK_BOT_TOKEN']},
    )

    # 3. Build LangChain agent
    llm = ChatOpenAI(model='gpt-4o-mini')
    prompt = ChatPromptTemplate.from_messages([
        ('system', 'You are a helpful assistant.'),
        ('human', '{input}'),
        ('placeholder', '{agent_scratchpad}'),
    ])
    agent = create_tool_calling_agent(llm, lc_tools, prompt)
    executor = AgentExecutor(agent=agent, tools=lc_tools)

    result = await executor.ainvoke({'input': 'List all Slack channels'})
    print(result['output'])

asyncio.run(main())
```

**Install:**

```bash
pip install "matimo[langchain]" langchain-openai
```

**Best for:** AI agents with automatic tool selection (LangChain, CrewAI)

See [LangChain Integration Guide](../framework-integrations/LANGCHAIN.md) for the full reference.

---

## TypeScript SDK

## Pattern 1: Factory Pattern (Recommended for Simple Use Cases)

The factory pattern is the simplest and most ergonomic way to use Matimo.

### Basic Setup

```typescript
import { MatimoInstance } from 'matimo';

// Initialize once
const matimo = await MatimoInstance.init('./tools');
```

### Execute a Tool

```typescript
const result = await matimo.execute('calculator', {
  operation: 'add',
  a: 5,
  b: 3,
});

console.log(result); // { result: 8 }
```

### Discover Tools

```typescript
// List all tools
const allTools = matimo.listTools();
console.log(`Loaded ${allTools.length} tools`);

// Get specific tool
const tool = matimo.getTool('calculator');
console.log(`Tool: ${tool.name} - ${tool.description}`);

// Search tools
const results = matimo.searchTools('email');
results.forEach((t) => console.log(`Found: ${t.name}`));
```

### Handle Errors

```typescript
try {
  const result = await matimo.execute('calculator', {
    operation: 'divide',
    a: 10,
    b: 0, // ⚠️ Will fail
  });
} catch (error) {
  if (error.code === 'TOOL_NOT_FOUND') {
    console.error('Tool not available:', error.message);
  } else if (error.code === 'INVALID_PARAMETERS') {
    console.error('Bad parameters:', error.details);
  } else if (error.code === 'EXECUTION_FAILED') {
    console.error('Tool error:', error.details);
  }
}
```

### Complete Example

```typescript
import { MatimoInstance } from 'matimo';

async function main() {
  try {
    // 1. Initialize
    const matimo = await MatimoInstance.init('./tools');

    // 2. List available tools
    const tools = matimo.listTools();
    console.log(`📦 Loaded ${tools.length} tools`);

    // 3. Execute tool
    const result = await matimo.execute('slack-send-message', {
      channel: '#general',
      text: 'Hello from Matimo!',
    });

    console.log('✅ Message sent:', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
```

**Best for:** Scripts, CLI tools, backend services, cron jobs, webhooks

---

## Pattern 2: Decorator Pattern (Recommended for Class-Based Code)

The decorator pattern is ideal for class-based agents and applications with automatic method-to-tool binding.

### Basic Setup

```typescript
import { tool, MatimoInstance, setGlobalMatimoInstance } from 'matimo';

// Initialize Matimo
const matimo = await MatimoInstance.init('./tools');

// Set global instance for decorators to use
setGlobalMatimoInstance(matimo);

// Create agent class
class EmailBot {
  @tool('slack-send-message')
  async sendMessage(channel: string, text: string) {
    // Decorator intercepts this call
    // Arguments map to tool parameters: channel, text
    // Method body is optional - decorator does the execution
  }

  @tool('slack-list-channels')
  async listChannels() {
    // Decorator handles execution
    // Returns the tool result directly
  }
}

// Use it
const bot = new EmailBot();

// When you call bot.sendMessage(), the decorator:
// 1. Maps arguments to parameters: { channel: '#general', text: '...' }
// 2. Calls matimo.execute('slack_send_channel_message', {...})
// 3. Returns the result
await bot.sendMessage('#general', 'Hello from decorator!');
const channels = await bot.listChannels();
```

### How @tool Decorator Works

**Step 1:** Define method with @tool decorator

```typescript
@tool('slack-send-message')
async sendMessage(channel: string, text: string) {
  // Method body is optional (decorator replaces execution)
}
```

**Step 2:** Call the method naturally

```typescript
await bot.sendMessage('#general', 'Hello!');
```

**Step 3:** Decorator intercepts and executes

```
1. Intercept call: sendMessage('#general', 'Hello!')
2. Map args to params: { channel: '#general', text: 'Hello!' }
3. Call matimo.execute('slack_send_channel_message', {...})
4. Return result to caller
```

### Advanced: Multi-Tool Orchestration

```typescript
import { tool, MatimoInstance, setGlobalMatimoInstance } from 'matimo';

class SmartAssistant {
  constructor(private matimo: MatimoInstance) {}

  @tool('calculator')
  async calculate(operation: string, a: number, b: number) {
    // Decorated method for math
  }

  @tool('slack-send-message')
  async notifySlack(channel: string, text: string) {
    // Decorated method for Slack
  }

  // Custom orchestration method (not decorated)
  async runDailyReport(channel: string) {
    // Custom logic using decorated tools
    const result = await this.calculate('add', 100, 50);
    await this.notifySlack(channel, `Daily calculation complete: ${result}`);
  }
}

// Usage
const matimo = await MatimoInstance.init('./tools');
setGlobalMatimoInstance(matimo);

const assistant = new SmartAssistant(matimo);
await assistant.runDailyReport('#reports');
```

**Best for:** Class-based agents, object-oriented design, multi-tool orchestration

---

## Pattern 3: LangChain Integration (Recommended for AI Agents)

For intelligent tool orchestration where the LLM automatically decides which tool to use.

### Basic Setup with convertToolsToLangChain

```typescript
import { MatimoInstance, convertToolsToLangChain } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain/agents';

// 1. Load Matimo tools
const matimo = await MatimoInstance.init('./tools');

// 2. Convert to LangChain format (one line!)
const langchainTools = await convertToolsToLangChain(matimo.listTools(), matimo, {
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
});

// 3. Create LangChain agent
const agent = await createAgent({
  model: new ChatOpenAI({ modelName: 'gpt-4o-mini' }),
  tools: langchainTools,
});

// 4. Run agent
const result = await agent.invoke({
  input: 'Send a Slack message to #general saying "Hello!"',
});

console.log(result.output);
```

### Complete LangChain Example

```typescript
import { MatimoInstance, convertToolsToLangChain } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain/agents';

async function runSlackAgent() {
  // Initialize
  const matimo = await MatimoInstance.init('./tools');

  // Get Slack tools only
  const slackTools = matimo.listTools().filter((t) => t.name.startsWith('slack-') || t.name.startsWith('slack_'));

  console.log(`📦 Loaded ${slackTools.length} Slack tools`);

  // Convert to LangChain
  const langchainTools = await convertToolsToLangChain(slackTools, matimo, {
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN!,
  });

  // Create agent
  const agent = await createAgent({
    model: new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
    }),
    tools: langchainTools,
  });

  // Example queries
  const queries = [
    'List all Slack channels',
    'Send a message to #general saying hello',
    'Get user info for john',
  ];

  for (const query of queries) {
    console.log(`\n📝 User: "${query}"`);
    const result = await agent.invoke({ input: query });
    console.log(`🤖 Agent: ${result.output}`);
  }
}

runSlackAgent().catch(console.error);
```

**Best for:** AI agents with automatic tool selection, natural language interfaces, intelligent workflows

---

## Comparison: All Three Patterns

| Feature              | Factory           | Decorator           | LangChain       |
| -------------------- | ----------------- | ------------------- | --------------- |
| **Simplicity**       | ⭐⭐⭐ Simple     | ⭐⭐ Medium         | ⭐⭐ Medium     |
| **Best For**         | Scripts, backends | Classes, multi-tool | AI agents       |
| **Tool Selection**   | Manual (code)     | Manual (code)       | Automatic (LLM) |
| **Type Safety**      | Good              | Excellent           | Good            |
| **Framework**        | Any               | Class-based         | LangChain+      |
| **Learning Curve**   | Low               | Medium              | Medium          |
| **Production Ready** | ✅ Yes            | ✅ Yes              | ✅ Yes          |

---

## Real-World Examples

### Example 1: Backend API (Factory)

```typescript
// Express.js route handler
import express from 'express';
import { MatimoInstance } from 'matimo';

const app = express();
const matimo = await MatimoInstance.init('./tools');

app.post('/api/send-slack', async (req, res) => {
  try {
    const result = await matimo.execute('slack-send-message', {
      channel: req.body.channel,
      text: req.body.text,
    });
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000);
```

### Example 2: Class-Based Service (Decorator)

```typescript
// NestJS-style service
import { tool, MatimoInstance, setGlobalMatimoInstance } from 'matimo';

export class NotificationService {
  @tool('slack-send-message')
  async sendSlack(channel: string, message: string) {}

  @tool('gmail-send-email')
  async sendEmail(to: string, subject: string, body: string) {}

  async notifyUser(userId: string, message: string) {
    // Use decorated methods naturally
    await this.sendSlack('#notifications', `User ${userId}: ${message}`);
    await this.sendEmail('admin@example.com', 'Notification', message);
  }
}

// Usage
const matimo = await MatimoInstance.init('./tools');
setGlobalMatimoInstance(matimo);
const service = new NotificationService();
await service.notifyUser('user123', 'Important update');
```

### Example 3: AI Agent (LangChain)

```typescript
// ChatGPT-powered agent
import { MatimoInstance, convertToolsToLangChain } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain/agents';

const matimo = await MatimoInstance.init('./tools');

const tools = await convertToolsToLangChain(matimo.listTools(), matimo);

const agent = await createAgent({
  model: new ChatOpenAI(),
  tools,
});

// Agent automatically picks tools based on user intent
const result = await agent.invoke({
  input: 'Send an email and post to Slack about the Q4 report',
});
```

---

## Error Handling Best Practices

```typescript
import { MatimoError, ErrorCode } from 'matimo';

try {
  const result = await matimo.execute('calculator', {
    operation: 'add',
    a: 5,
    b: 3,
  });
} catch (error) {
  if (error instanceof MatimoError) {
    // Handle Matimo-specific errors
    switch (error.code) {
      case ErrorCode.TOOL_NOT_FOUND:
        console.error(`Tool "${error.details.toolName}" not found`);
        break;
      case ErrorCode.INVALID_PARAMETER:
        console.error(`Invalid parameters:`, error.details);
        break;
      case ErrorCode.EXECUTION_FAILED:
        console.error(`Execution failed:`, error.details);
        break;
      case ErrorCode.AUTH_FAILED:
        console.error(`Authentication failed:`, error.message);
        break;
      default:
        console.error(`Unknown error:`, error.message);
    }
  } else {
    // Handle unexpected errors
    console.error('Unexpected error:', error);
  }
}
```

---

## Debugging Tips

### Log Available Tools

```typescript
const matimo = await MatimoInstance.init('./tools');
const tools = matimo.listTools();

console.log('Available tools:');
tools.forEach((t) => {
  console.log(`  - ${t.name}: ${t.description}`);
  console.log(`    Parameters:`, Object.keys(t.parameters || {}));
});
```

### Validate Tool Before Executing

```typescript
const toolName = 'calculator';
const tool = matimo.getTool(toolName);

if (!tool) {
  console.error(`Tool "${toolName}" not found`);
  return;
}

console.log('Tool definition:', tool);
```

### Enable Detailed Error Messages

```typescript
try {
  await matimo.execute('tool-name', params);
} catch (error) {
  console.error('Full error:', JSON.stringify(error, null, 2));
}
```

---

## Next Steps

- **[Framework Integrations](../framework-integrations/LANGCHAIN.md)** — LangChain details & examples
- **[Tool Discovery Guide](./TOOL_DISCOVERY.md)** — Finding and managing tools
- **[API Reference](../api-reference/SDK.md)** — Complete SDK documentation
- **[Examples](../../examples/)** — Working code for all patterns

See [examples/tools/](../../examples/tools/) for complete, runnable examples.
