# Testing Tools

How to test a Matimo tool definition in both SDKs: validate the YAML, check the definition, run it against mocked HTTP, and test the approval and error paths. Unit tests never call a live API.

| | TypeScript | Python |
|---|---|---|
| Framework | Jest (ts-jest) | pytest + pytest-asyncio |
| HTTP mocking | `jest.mock('axios')` | `respx` |
| Unit tests | `typescript/packages/<provider>/test/unit/` | `python/packages/<provider>/tests/unit/` |

## Tool Validation

```bash
cd typescript && pnpm validate-tools
```

```
✅ .../packages/twilio/tools/twilio-send-sms/definition.yaml (tool)
...
Results: 602 valid, 0 invalid, 0 skipped (no definition.yaml)
```

It checks every `definition.yaml` in the workspace against the Zod schema, and the governance rules: an HTTP `DELETE` tool must declare `requires_approval: true`, and a `type: function` tool must declare `risk:`. Python's `make validate-tools` runs the same checks.

The schema drops keys it does not know (for example `timeout_ms`) instead of failing, so a test that reads the definition is still worth writing.

---

## Definition Tests

Read the YAML and check what matters for this tool. This is the pattern the provider packages use:

```typescript
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

describe('github_get_user definition', () => {
  const def = yaml.load(
    fs.readFileSync(path.join(__dirname, '../../tools/github_get_user/definition.yaml'), 'utf8')
  ) as Record<string, any>;

  it('is a GET to the GitHub API', () => {
    expect(def.execution).toMatchObject({ type: 'http', method: 'GET' });
    expect(def.execution.url).toBe('https://api.github.com/users/{username}');
  });

  it('requires username, with a description', () => {
    expect(def.parameters.username).toMatchObject({ type: 'string', required: true });
    expect(def.parameters.username.description).toBeTruthy();
  });
});
```

---

## Execution Tests (mocked HTTP)

Load the tool into a real `MatimoInstance` so the call goes through the policy, approval and templating code, and mock only the network.

### TypeScript

```typescript
import axios from 'axios';
import path from 'path';
import { MatimoInstance, MatimoError, ErrorCode } from '@matimo/core';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const TOOLS_DIR = path.join(__dirname, '../../tools');

describe('github_get_user', () => {
  let matimo: MatimoInstance;

  beforeAll(async () => {
    matimo = await MatimoInstance.init({ toolPaths: [TOOLS_DIR] });
  });

  beforeEach(() => mockedAxios.request.mockReset());

  it('calls the API with the templated URL', async () => {
    mockedAxios.request.mockResolvedValue({ status: 200, data: { login: 'octocat' }, headers: {} });

    const result = await matimo.execute('github_get_user', { username: 'octocat' });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: 'https://api.github.com/users/octocat' })
    );
    expect(result).toMatchObject({ success: true, statusCode: 200, data: { login: 'octocat' } });
  });

  it('maps HTTP 429 to RATE_LIMIT_EXCEEDED', async () => {
    mockedAxios.request.mockRejectedValue(
      Object.assign(new Error('Too Many Requests'), { response: { status: 429, data: {} } })
    );

    const error = await matimo.execute('github_get_user', { username: 'octocat' }).catch((e) => e);

    expect(error).toBeInstanceOf(MatimoError);
    expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(error.details.retryable).toBe(true);
  });

  it('fails before sending when a URL parameter is missing', async () => {
    await expect(matimo.execute('github_get_user', {})).rejects.toMatchObject({
      code: ErrorCode.INVALID_SCHEMA,
    });
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });
});
```

### Python

An HTTP tool returns the parsed response body in Python (TypeScript wraps it in `{ success, data, statusCode, headers }`).

```python
from pathlib import Path

import httpx
import pytest
import respx

from matimo import ErrorCode, Matimo, MatimoError

TOOLS_DIR = str(Path(__file__).parents[2] / "tools")


@respx.mock
@pytest.mark.asyncio
async def test_get_user_calls_the_api() -> None:
    route = respx.get("https://api.github.com/users/octocat").mock(
        return_value=httpx.Response(200, json={"login": "octocat"})
    )
    matimo = await Matimo.init(TOOLS_DIR)

    result = await matimo.execute("github_get_user", {"username": "octocat"})

    assert route.called
    assert result == {"login": "octocat"}


@respx.mock
@pytest.mark.asyncio
async def test_rate_limit_maps_to_code() -> None:
    respx.get("https://api.github.com/users/octocat").mock(return_value=httpx.Response(429))
    matimo = await Matimo.init(TOOLS_DIR)

    with pytest.raises(MatimoError) as excinfo:
        await matimo.execute("github_get_user", {"username": "octocat"})

    assert excinfo.value.code == ErrorCode.RATE_LIMIT_EXCEEDED
```

---

## Approval Tests

Any tool that needs approval — `requires_approval: true`, an HTTP `DELETE`, or a command tool — should have a test that the call asks, and that nothing is sent when the answer is no. Pass an `onApproval` that records the request; never set `MATIMO_AUTO_APPROVE` in tests.

```typescript
it('asks before deleting and sends nothing when refused', async () => {
  const asked: string[] = [];
  const matimo = await MatimoInstance.init({
    toolPaths: [TOOLS_DIR],
    onApproval: async (request) => {
      asked.push(request.toolName);
      return false;
    },
  });

  await expect(matimo.execute('delete_item', { id: '42' })).rejects.toThrow(
    'Operation rejected by approval handler'
  );
  expect(asked).toEqual(['delete_item']);
  expect(mockedAxios.request).not.toHaveBeenCalled();
});
```

```python
@respx.mock
@pytest.mark.asyncio
async def test_delete_asks_and_sends_nothing_when_refused() -> None:
    route = respx.delete("https://api.example.com/items/42")
    asked: list[str] = []

    async def decline(request: ApprovalRequest) -> bool:
        asked.append(request.tool_name)
        return False

    matimo = await Matimo.init(TOOLS_DIR, on_approval=decline)

    with pytest.raises(MatimoError, match="rejected by approval handler"):
        await matimo.execute("delete_item", {"id": "42"})

    assert asked == ["delete_item"]
    assert not route.called
```

---

## Error Tests

Decide which kind of failure you are testing:

- **Thrown** — Matimo raises a `MatimoError`: unknown tool, policy denial, refused approval, a missing URL parameter, or an HTTP error (401/403 → `AUTH_FAILED`, 429 → `RATE_LIMIT_EXCEEDED`, other non-2xx → `EXECUTION_FAILED`).
- **Returned** — a function tool reports bad input in its result. The built-in calculator returns `{ success: false, error: 'Division by zero', code: 'EXECUTION_FAILED' }` rather than throwing.

```typescript
it('reports bad input in its result', async () => {
  const matimo = await MatimoInstance.init({ autoDiscover: true });
  const result = await matimo.execute('calculator', { operation: 'divide', a: 10, b: 0 });
  expect(result).toMatchObject({ success: false, error: 'Division by zero' });
});
```

Match on `error.code`, not on `toThrow('SOME_CODE')`: `toThrow` with a string checks the message, which does not contain the code.

Matimo does not check parameters against the YAML before a call, so there is no Matimo error for a wrong enum value or type. Test what the API (mocked) or your tool's own code does with it.

---

## Running Tests

```bash
cd typescript
pnpm test                                         # all packages
pnpm test:coverage                                # with coverage thresholds
pnpm test:watch                                   # watch mode
pnpm test -- packages/github/test/unit            # one directory
pnpm test -- -t "github_get_user"                 # tests whose name matches

cd python
make test                                         # all packages
uv run pytest packages/github/tests/unit -q       # one directory
make test-coverage                                # HTML report in htmlcov/
```

## Coverage

`pnpm test:coverage` fails if TypeScript coverage drops below the thresholds in `typescript/jest.config.cjs`: lines 95%, functions 97%, branches 87%, statements 95%. Python has no enforced floor. A new tool should have full unit coverage in both SDKs.

---

## Best Practices

1. **Validate first** — run `pnpm validate-tools` before writing tests.
2. **Mock the network, nothing else** — call `matimo.execute()` so policy, approval and templating are tested too.
3. **Assert the request** — check the method, URL and body sent, not only the result.
4. **Test the approval path** for every tool that writes or deletes.
5. **Test both error kinds** — thrown `MatimoError`s and `{ success: false }` results.
6. **Never call a live API in a test that runs in CI** — `pnpm test` and `make test` run the integration tests too.

## Next Steps

- **Tool Development**: [YAML Tool Specification](./YAML_TOOLS.md)
- **Approval**: [Approval System](../api-reference/APPROVAL-SYSTEM.md)
- **Error Codes**: [Error Reference](../api-reference/ERRORS.md)
- **Examples**: [Code Examples](../../typescript/examples/)
