# HTTP Parameter Embedding — Core Matimo Design

> **Core Principle:** "Define once in YAML, embed correctly at execution time"

This guide explains how Matimo's HTTP executor handles different parameter types when embedding them in request bodies.

## Overview

When you define a tool with HTTP execution, parameters can be different data types (string, number, boolean, object, array). The HTTP executor needs to know how to embed each type into the request.

Matimo uses the **parameter type from your YAML definition** to determine how values should be embedded:

| Parameter Type | How It's Embedded  | Example                                  |
| -------------- | ------------------ | ---------------------------------------- |
| `string`       | String templating  | `"Hello World"`                          |
| `number`       | Number conversion  | `42`                                     |
| `boolean`      | Boolean conversion | `true`                                   |
| `object`       | Direct JSON object | `{"id": "123", "type": "db"}`            |
| `array`        | Direct JSON array  | `[{"text": "item1"}, {"text": "item2"}]` |

## Key Principle: Type Information Drives Embedding

The HTTP executor looks at the **parameter's type in your YAML definition** to decide how to embed it. This enables:

- **Complex structured data** — Objects and arrays are sent as proper JSON structures
- **Type safety** — Numbers stay numbers, booleans stay booleans
- **API compatibility** — APIs receive data in the correct format
- **Write once, run anywhere** — Same YAML definition works across all frameworks (factory pattern, decorator pattern, LangChain, etc.)

### Only whole-value placeholders keep their type

Type-aware embedding applies when the placeholder is the entire value, as in `count: '{count}'`. A placeholder inside a longer string (`label: 'item-{count}'`) is always text. In `body` and `headers`, a key whose placeholder was not supplied is left out of the request; a missing placeholder in the `url` is an error (`INVALID_SCHEMA`).

### The two SDKs

Both embed `number` and `boolean` parameters with their YAML type. For objects and arrays, TypeScript goes by the YAML type (`object` / `array`), while Python embeds any dict or list value as JSON whatever the YAML says. Declare the right type and both behave the same.

## How It Works

### Step 1: Define Parameters in YAML

```yaml
parameters:
  parent:
    type: object
    description: Parent database or page
    required: true
  items:
    type: array
    description: Array of items
    required: false
  title:
    type: string
    description: Page title
    required: true
```

### Step 2: Define HTTP Body Template

```yaml
execution:
  type: http
  method: POST
  url: https://api.notion.com/v1/pages
  body:
    parent: '{parent}' # Placeholder for object param
    children: '{items}' # Placeholder for array param
    title: '{title}' # Placeholder for string param
```

### Step 3: Execute from JavaScript

```typescript
const result = await matimo.execute('notion_create_page', {
  parent: { database_id: 'abc123', type: 'database' }, // JavaScript object
  items: [{ type: 'text', text: 'Content' }], // JavaScript array
  title: 'Create This Page', // String
});
```

### Step 4: HTTP Executor Embeds Values

The HTTP executor:

1. Sees `parent: "{parent}"` in the body
2. Checks parameter definition: `parent: { type: 'object' }`
3. Since type is `object`, embeds the value directly as JSON (not stringified!)
4. Sends to API:

```json
{
  "parent": { "database_id": "abc123", "type": "database" },
  "children": [{ "type": "text", "text": "Content" }],
  "title": "Create This Page"
}
```

## What NOT to Do ❌

### Anti-pattern 1: Stringifying objects manually

```typescript
// DON'T do this:
await matimo.execute('notion_create_page', {
  parent: JSON.stringify({ database_id: 'abc123' }), // ❌ Already stringified
  items: JSON.stringify([{ type: 'text' }]), // ❌ Already stringified
});
```

**Why:** The HTTP executor will try to template a string that's already stringified, resulting in double-encoding.

### Anti-pattern 2: Defining objects as type:string in YAML

```yaml
parameters:
  parent:
    type: string # ❌ Wrong type for an object
    description: Parent database
```

**Why:** TypeScript treats it as a string and sends `"[object Object]"` instead of JSON (Python happens to embed it, so the bug shows up in one SDK only).

### Anti-pattern 3: Passing JSON strings from decorators

```typescript
class NotionManager {
  @tool('notion_create_page')
  async createPage(parent: string, title: string) {
    // ❌ Wrong signature
    throw new Error('Should not be called');
  }
}

// This will fail:
await manager.createPage('{"database_id": "123"}', 'Title'); // ❌ String, not object
```

**Why:** The decorator doesn't know you meant this to be an object. Always pass actual objects/arrays.

## Complete Example: Notion Create Page

### YAML Definition

```yaml
name: notion_create_page
description: Create a new page in a Notion database
version: "1.0.0"

parameters:
  parent:
    type: object
    required: true
    description: |
      Where to create the page:
      - { "database_id": "..." }
      - { "page_id": "..." }

  icon:
    type: object
    required: false
    description: Page icon - { type: "emoji", emoji: "🎯" }

  children:
    type: array
    required: false
    description: Array of block objects to add to the page

  markdown:
    type: string
    required: false
    description: Page content in Markdown format

execution:
  type: http
  method: POST
  url: "https://api.notion.com/v1/pages"
  headers:
    Authorization: "Bearer {NOTION_API_KEY}"
    "Notion-Version": "2024-11-28"
    Content-Type: application/json
  body:
    parent: "{parent}"          # ← Object embedded directly as JSON
    icon: "{icon}"              # ← Object embedded directly as JSON
    children: "{children}"      # ← Array embedded directly as JSON
    markdown: "{markdown}"      # ← String templated normally

authentication:
  type: bearer
  location: header
  name: Authorization

output_schema:
  type: object
  properties:
    id:
      type: string
    url:
      type: string
```

### JavaScript Usage (Factory Pattern)

```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });

const result = await matimo.execute('notion_create_page', {
  parent: { database_id: 'a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822b' },
  icon: { type: 'emoji', emoji: '🔧' },
  children: [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: 'Page content here' },
          },
        ],
      },
    },
  ],
  markdown: '# My Page\n\nSome content',
});

console.log('Created page:', result.data.id);
```

### TypeScript with Decorator Pattern

```typescript
import { MatimoInstance, setGlobalMatimoInstance, tool } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

class NotionManager {
  @tool('notion_create_page')
  async createPage(
    parent: Record<string, string>, // Object type
    markdown?: string, // String type
    icon?: Record<string, string> // Object type
  ): Promise<any> {
    throw new Error('Should not be called');
  }
}

const manager = new NotionManager();
const result = await manager.createPage(
  { database_id: 'a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822b' },
  '# My Page',
  { type: 'emoji', emoji: '🔧' }
);

console.log('Created page:', result.id);
```

## Deep Dive: How the HTTP Executor Works

### The Embedding Algorithm

When the HTTP executor processes a body with placeholders:

```typescript
// Input body from YAML:
body: {
  parent: "{parent}",
  children: "{children}",
  title: "{title}"
}

// Input parameters from JavaScript:
params: {
  parent: { database_id: "123" },
  children: [{ type: "text" }],
  title: "My Page"
}

// Parameter definitions from YAML:
paramDefinitions: {
  parent: { type: "object" },
  children: { type: "array" },
  title: { type: "string" }
}

// Processing:
1. Find key "parent" with value "{parent}"
2. Extract placeholder: parent
3. Get param value: { database_id: "123" }
4. Check paramDefinitions["parent"].type === "object"
5. Since it's object/array: EMBED DIRECTLY (don't stringify)
6. Result: { parent: { database_id: "123" } }

7. Find key "children" with value "{children}"
8. Extract placeholder: children
9. Get param value: [{ type: "text" }]
10. Check paramDefinitions["children"].type === "array"
11. Since it's array: EMBED DIRECTLY
12. Result: { children: [{ type: "text" }] }

13. Find key "title" with value "{title}"
14. Extract placeholder: title
15. Get param value: "My Page"
16. Check paramDefinitions["title"].type === "string"
17. Since it's string: Do normal templating
18. Result: { title: "My Page" }
```

### Why This Matters

**Without type information**, the executor would fall back to string templating for all values:

```typescript
// Without using type information:
result = {
  parent: '[object Object]', // ❌ Stringified!
  children: '[object Object]', // ❌ Stringified!
  title: 'My Page',
};
```

**With type information**, everything works correctly:

```typescript
// With type information:
result = {
  parent: { database_id: '123' }, // ✅ Proper JSON
  children: [{ type: 'text' }], // ✅ Proper JSON
  title: 'My Page', // ✅ String
};
```

## Best Practices

### ✅ DO

- **Define parameter types accurately** in YAML
- **Pass JavaScript objects/arrays directly** from your code
- **Trust the executor** — don't stringify manually
- **Use descriptive examples** in your tool's documentation

### ❌ DON'T

- Don't manually stringify objects/arrays
- Don't use `type: string` for objects or arrays
- Don't pass JSON strings when you should pass objects
- Don't assume objects/arrays will be stringified

## Troubleshooting

### I'm getting "[object Object]" in my API request

**Cause:** Parameter type is wrong or not set.

**Solution:** Check your YAML parameter definition:

```yaml
parameters:
  parent:
    type: object  # ✅ Correct
    type: string  # ❌ Wrong!
```

### My API is receiving nested objects as strings

**Cause:** You manually stringified before passing to execute().

**Solution:** Pass objects directly:

```typescript
// ❌ Wrong
await matimo.execute('my_tool', {
  data: JSON.stringify({ nested: { value: 123 } }),
});

// ✅ Correct
await matimo.execute('my_tool', {
  data: { nested: { value: 123 } },
});
```

### The parameter embedding isn't working for my custom tool

**Cause:** The YAML might not have `paramDefinitions` passed to the HTTP executor.

**Solution:** Ensure the tool definition includes the `parameters` section with proper types.

## Real-World APIs

Here are common APIs that need structured parameters:

| API         | Parameter Type     | Example                                       |
| ----------- | ------------------ | --------------------------------------------- |
| **Notion**  | Objects and arrays | `{ database_id: "..." }`, `[{ type: "..." }]` |
| **GitHub**  | Objects            | `{ owner: "...", repo: "..." }`               |
| **Slack**   | Objects            | `{ channel_id: "...", user_id: "..." }`       |
| **MongoDB** | Objects and arrays | `{ filter: { ... } }`, `[{ $set: { ... } }]`  |
| **OpenAI**  | Objects and arrays | `{ messages: [...] }`, `{ tools: [...] }`     |

## See Also

- [Tool Specification](./TOOL_SPECIFICATION.md) — Complete YAML schema reference
- [HTTP Execution](./TOOL_SPECIFICATION.md#type-http) — HTTP-specific configuration
- [Decorator Guide](./DECORATOR_GUIDE.md) — Using decorators with structured parameters
