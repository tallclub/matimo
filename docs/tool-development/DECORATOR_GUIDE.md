# Decorator Guide — Calling Tools with `@tool`

`@tool('<tool-name>')` turns a method into a call to an existing Matimo tool. The method body is ignored: calling the method runs `matimo.execute('<tool-name>', params)`, with the same policy, approval and audit checks as any other call.

The decorator **does not define tools**. Tools are still defined in YAML (see [TOOL_SPECIFICATION.md](TOOL_SPECIFICATION.md)); the decorator is a typed, class-based way to call them.

## TypeScript

```typescript
import { MatimoInstance, tool } from '@matimo/core';

class MathAgent {
  constructor(public matimo: MatimoInstance) {}

  @tool('calculator')
  async calculate(operation: string, a: number, b: number): Promise<unknown> {
    return undefined; // never runs; the decorator calls matimo.execute('calculator', …)
  }
}

const matimo = await MatimoInstance.init({ autoDiscover: true });
const agent = new MathAgent(matimo);

console.log(await agent.calculate('add', 5, 3));
// { result: 8, operation: 'add', original_operation: 'add', operands: { a: 5, b: 3 } }
```

### How arguments become parameters

TypeScript maps **positional arguments to the tool's parameters in the order the YAML declares them**. The method's own parameter names are not used.

`calculator` declares `operation`, `a`, `b`, `expression`, `precision`, so `calculate('add', 5, 3)` becomes `{ operation: 'add', a: 5, b: 3 }`. A method declared as `swapped(x, y, op)` and called as `swapped(5, 3, 'add')` would send `{ operation: 5, a: 3, b: 'add' }`. Keep the method's parameters in the YAML's order, and check it with `matimo.getTool(name)?.parameters`.

### Which instance runs the call

1. The object's `matimo` property, if it has one.
2. Otherwise the global instance set with `setGlobalMatimoInstance(matimo)`.
3. Otherwise the call fails with `TOOL_NOT_FOUND` ("Matimo instance not found for @tool(...)").

```typescript
import { MatimoInstance, tool, setGlobalMatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

class Agent {
  @tool('calculator')
  async multiply(operation: string, a: number, b: number): Promise<unknown> {
    return undefined;
  }
}

await new Agent().multiply('multiply', 4, 2); // { result: 8, … }
```

The decorators use the standard (TC39) decorator syntax; no `experimentalDecorators` setting is needed with TypeScript 5.

## Python

```python
from matimo import Matimo
from matimo.decorators import tool, set_global_matimo_instance


class MathAgent:
    def __init__(self, matimo: Matimo) -> None:
        self._matimo = matimo

    @tool("calculator")
    async def calculate(self, operation: str, a: float, b: float): ...


matimo = await Matimo.init(auto_discover=True)
agent = MathAgent(matimo)
print(await agent.calculate("add", 5, 3))
# {'result': 8.0, 'operation': 'add', 'original_operation': 'add', 'operands': {'a': 5.0, 'b': 3.0}}
```

Python maps arguments **by the method's parameter names**: positional arguments take the names from the signature, and keyword arguments are passed as given. So the names must match the tool's parameters, but their order does not matter, and `agent.calculate(operation="multiply", a=4, b=2)` works too.

The instance comes from the object's `_matimo` attribute, else from `set_global_matimo_instance(matimo)`. A sync method is run to completion on an event loop; prefer `async def`.

## Approval and errors

A decorated call is an ordinary `execute()` call:

- If the tool needs approval (`requires_approval: true`, an HTTP `DELETE`, a destructive SQL keyword), the instance's `onApproval` / `on_approval` is asked. With none, the call is refused.
- Policy denials and refused approvals raise `MatimoError`.
- Bad input to a built-in tool returns `{ success: false, error, code }` in TypeScript and raises `EXECUTION_FAILED` in Python.

```typescript
const matimo = await MatimoInstance.init({
  autoDiscover: true,
  onApproval: async (request) => askUser(`Run ${request.toolName}?`),
});
```

## Decorator vs direct `execute()`

| | `@tool` method | `matimo.execute()` |
|---|---|---|
| Call style | `agent.getRepository('octocat', 'hello-world')` | `matimo.execute('github-get-repository', { owner, repo })` |
| Parameter mapping | TS: YAML order; Python: method parameter names | Explicit names |
| Optional parameters in the middle | Awkward (TS) | Easy |
| Best for | Agent classes with a fixed set of tools | Dynamic tool choice, LangChain/MCP, scripts |

Each provider has a runnable example: `typescript/examples/tools/<provider>/<provider>-decorator.ts` and `python/examples/native/<provider>/…_decorator.py` (for example `github-decorator.ts`).

## Testing decorated methods

Test them as you would test `execute()`: mock the HTTP layer and assert the request (see [TESTING.md](TESTING.md)).

```typescript
it('maps arguments in YAML order', async () => {
  const matimo = await MatimoInstance.init({ autoDiscover: true });
  const agent = new MathAgent(matimo);
  await expect(agent.calculate('add', 5, 3)).resolves.toMatchObject({ result: 8 });
});
```

## See Also

- [TOOL_SPECIFICATION.md](TOOL_SPECIFICATION.md) — defining tools in YAML
- [SDK Patterns](../user-guide/SDK_PATTERNS.md) — factory, decorator and framework patterns
- [Approval System](../api-reference/APPROVAL-SYSTEM.md)
