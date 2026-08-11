# Security Guide — Matimo Security Standards

Security is a critical aspect of Matimo. This guide covers security best practices, common vulnerabilities, and how to handle sensitive data safely.

## Table of Contents

- [Overview](#overview)
- [Core Principles](#core-principles)
- [Secret Management](#secret-management)
- [Input Validation](#input-validation)
- [Error Handling](#error-handling)
- [Logging Security](#logging-security)
- [Authentication](#authentication)
- [Command Execution](#command-execution)
- [Common Vulnerabilities](#common-vulnerabilities)
- [Security Checklist](#security-checklist)
- [Reporting Security Issues](#reporting-security-issues)

---

## Overview

Matimo runs untrusted code and handles user input across multiple integration points (SDK, MCP Server, REST API, CLI). Security must be enforced at every layer:

1. **Input Validation** — Validate all user inputs against schemas
2. **Secret Management** — Never hardcode secrets, use environment variables
3. **Error Handling** — Don't leak sensitive info in error messages
4. **Logging** — Never log secrets or sensitive data
5. **Command Execution** — Safely escape shell commands
6. **Authentication** — Use secure auth mechanisms (bearer, OAuth2, basic)

---

## Core Principles

### 1. Never Trust User Input

**Rule:** All user input must be validated against expected types and values.

```typescript
// ❌ WRONG: Trust user input
function executeCommand(userInput: string) {
  return execSync(`echo ${userInput}`); // Dangerous!
}

// ✅ CORRECT: Validate input
import { z } from 'zod';

const inputSchema = z.object({
  message: z.string().max(1000),
});

function executeCommand(userInput: unknown) {
  const validated = inputSchema.parse(userInput); // Throws if invalid
  return execSync(`echo "${validated.message}"`); // Escaped
}
```

### 2. Never Hardcode Secrets

**Rule:** Secrets must come from environment variables, never be in code.

```typescript
// ❌ WRONG: Hardcoded secret
const API_KEY = 'sk_live_abc123xyz789';
const token = 'ghp_xxxxxxxxxxxxxxxxxxxx';

// ✅ CORRECT: Environment variable with MATIMO_ prefix
const apiKey = process.env.MATIMO_API_KEY;
if (!apiKey) {
  throw new MatimoError('Missing API key', ErrorCode.AUTH_FAILED);
}

const githubToken = process.env.MATIMO_GITHUB_TOKEN;
if (!githubToken || githubToken.trim().length === 0) {
  throw new MatimoError('Invalid GitHub token', ErrorCode.AUTH_FAILED);
}
```

### 3. Never Log Secrets

**Rule:** Sanitize sensitive data before logging. Never include passwords, tokens, keys, or PII.

```typescript
// ❌ WRONG: Logging secrets
logger.info('Authenticated with token:', apiKey);
logger.info('User password:', password);
logger.info('Request headers:', { Authorization: bearerToken });

// ✅ CORRECT: Redact sensitive data
logger.info('Authentication successful', { hasToken: !!apiKey });
logger.info('User authenticated', { userId: user.id });
logger.info('Request made', { endpoint: url, statusCode: 200 });

// ✅ CORRECT: Sanitize error context
const sanitized = {
  ...errorContext,
  password: '[REDACTED]',
  token: '[REDACTED]',
  apiKey: '[REDACTED]',
};
logger.error('Execution failed', sanitized);
```

### 4. Clear Error Messages

**Rule:** Error messages should be helpful but not leak sensitive information.

```typescript
// ❌ WRONG: Leaks sensitive info
throw new Error(`Failed to authenticate with API key: ${apiKey}`);
throw new Error(`Connection failed: ${connectionString}`);

// ✅ CORRECT: Safe error messages
throw new MatimoError('Authentication failed: invalid credentials', ErrorCode.AUTH_FAILED);

throw new MatimoError('Database connection failed', ErrorCode.EXECUTION_FAILED, {
  service: 'database',
  timeout: 5000,
});
```

---

## Secret Management

### Environment Variable Naming

All Matimo secrets use the `MATIMO_` prefix:

```bash
# API Keys
MATIMO_GITHUB_TOKEN=ghp_xxxx
MATIMO_SLACK_API_KEY=xoxb-xxxx
MATIMO_STRIPE_SECRET=sk_live_xxxx

# OAuth Tokens
MATIMO_OAUTH_TOKEN=access_token_xxxx
MATIMO_OAUTH_REFRESH_TOKEN=refresh_token_xxxx

# Database Credentials
MATIMO_DATABASE_URL=postgres://user:pass@host/db
MATIMO_DATABASE_PASSWORD=secure_password

# API Credentials
MATIMO_API_KEY=api_key_xxxx
MATIMO_API_SECRET=api_secret_xxxx
```

### Retrieving Secrets Safely

```typescript
// ✅ Retrieve and validate
function getSecret(name: string): string {
  const secret = process.env[`MATIMO_${name.toUpperCase()}`];

  if (!secret) {
    throw new MatimoError(`Missing required secret: ${name}`, ErrorCode.AUTH_FAILED);
  }

  if (secret.trim().length === 0) {
    throw new MatimoError(`Invalid secret: ${name} is empty`, ErrorCode.AUTH_FAILED);
  }

  return secret;
}

// Usage
const githubToken = getSecret('github_token');
const slackKey = getSecret('slack_api_key');
```

### Secrets in Tool YAML

Never put secrets in YAML tool definitions:

```yaml
# ❌ WRONG: Hardcoded secret
authentication:
  type: bearer
  token: "ghp_xxxxxxxxxxxxxxxxxxxx"

# ✅ CORRECT: Reference environment variable
authentication:
  type: bearer
  secret_env_var: MATIMO_GITHUB_TOKEN
```

Tool loaders will automatically resolve `secret_env_var` at execution time.

---

## Input Validation

### Parameter Validation

Validate all parameters against the tool's parameter schema:

```typescript
// ✅ Always validate with Zod
const toolSchema = z.object({
  repo: z.string().regex(/^[^/]+\/[^/]+$/),
  issue: z.number().min(1).max(10000),
  labels: z.array(z.string()).optional(),
  body: z.string().max(5000).optional(),
});

function execute(params: unknown) {
  const validated = toolSchema.parse(params); // Throws if invalid
  // Safe to use validated params
  return api.createIssue(validated);
}
```

### Type Validation in YAML

Define validation rules in tool YAML:

```yaml
parameters:
  repo:
    type: string
    description: Repository (owner/repo)
    required: true
    validation:
      pattern: '^[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$'
      minLength: 3
      maxLength: 100

  count:
    type: number
    required: false
    validation:
      min: 1
      max: 100
    default: 10

  email:
    type: string
    validation:
      pattern: "^[^@]+@[^@]+\\.[^@]+$"
      maxLength: 254
```

### Input Constraints

```typescript
// ✅ DO: Define and enforce constraints
const stringConstraints = {
  minLength: 1,
  maxLength: 1000,
  pattern: /^[a-zA-Z0-9_-]+$/, // Alphanumeric, underscore, hyphen only
};

const numberConstraints = {
  min: 0,
  max: 1000,
  isInteger: true,
};

const arrayConstraints = {
  minItems: 0,
  maxItems: 100,
  unique: true,
};

// ❌ DON'T: Accept unbounded input
function process(data: unknown) {
  // Could be huge array, deeply nested, etc.
  return JSON.stringify(data);
}
```

---

## Error Handling

### Structured Error Responses

Always use structured errors with codes and safe context:

```typescript
enum ErrorCode {
  INVALID_SCHEMA = 'INVALID_SCHEMA',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  AUTH_FAILED = 'AUTH_FAILED',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

// ✅ CORRECT: Include code but sanitize context
try {
  const result = await executor.execute(tool, params);
} catch (error) {
  throw new MatimoError('Tool execution failed', ErrorCode.EXECUTION_FAILED, {
    toolName: tool.name,
    parameterCount: Object.keys(params).length,
    // DO NOT include: params, error details, stack traces
  });
}
```

### Never Expose Stack Traces

```typescript
// ❌ WRONG: Exposes implementation details
throw new Error(error.stack);

// ✅ CORRECT: Safe error message
throw new MatimoError('Operation failed', ErrorCode.EXECUTION_FAILED);
```

---

## Logging Security

### What to Log

```typescript
// ✅ SAFE to log:
logger.info('tool_execution', {
  traceId: 'trace-123',
  toolName: 'calculator',
  parameterCount: 2,
  duration: 150,
  statusCode: 200,
  timestamp: '2026-01-30T12:00:00Z',
});

logger.info('authentication', {
  provider: 'github',
  userId: 'user-456',
  hasToken: true, // Not the token itself
  authenticated: true,
});
```

### What NOT to Log

```typescript
// ❌ NEVER log:
- Passwords
- API keys or tokens
- OAuth credentials
- Database passwords
- Personally identifiable information (PII)
- Full request/response bodies with secrets
- Environment variable values
- SSH keys or certificates

// Examples of BAD logging:
logger.info('Token:', apiToken);                          // ❌
logger.info('User:', { password: pwd });                  // ❌
logger.info('DB:', { connectionString });                 // ❌
logger.info('Response:', responseWithAuthHeader);          // ❌
logger.info('Env:', process.env);                         // ❌
```

### Logging Pattern

```typescript
// ✅ Use structured logging with context
logger.info('operation_name', {
  traceId: context.traceId,
  userId: context.userId,
  action: 'description',
  success: true,
  duration: executionTime,
  // Include safe metadata only
  toolName: tool.name,
  paramCount: Object.keys(params).length,
  statusCode: response.status,
});

// ✅ Log errors safely
logger.error('execution_failed', {
  traceId: context.traceId,
  toolName: tool.name,
  errorCode: error.code,
  errorMessage: error.message, // Should not contain secrets
  duration: executionTime,
});
```

---

## Authentication

### Supported Methods

#### 1. API Key (Bearer Token)

```yaml
authentication:
  type: bearer
  secret_env_var: MATIMO_GITHUB_TOKEN
```

Automatically adds: `Authorization: Bearer {token}`

#### 2. API Key (Header)

```yaml
authentication:
  type: api_key
  location: header
  name: X-API-Key
  secret_env_var: MATIMO_API_KEY
```

Automatically adds: `X-API-Key: {key}`

#### 3. Basic Auth

```yaml
authentication:
  type: basic
  secret_env_var: MATIMO_CREDENTIALS
```

Environment variable format: `username:password`

#### 4. OAuth2 (Phase 2+)

```yaml
authentication:
  type: oauth2
  secret_env_var: MATIMO_OAUTH_TOKEN
```

### Third-Party Credentials — Always BYOK

All four methods above share one rule: the credential value always comes
from the deploying application's own environment (`secret_env_var`), never
from a value baked into a tool definition or shipped in a Matimo package.
This isn't only a secrets-hygiene rule — it's also how Matimo keeps every
provider connector on a bring-your-own-key model, so the compliance
relationship with that provider (their Terms of Service, Fair Usage Policy,
data handling) stays directly between the end user and the provider, not
routed through any Matimo-operated account or infrastructure.

`@matimo/composio` is the clearest example: every `composio_*` tool requires
a caller-supplied `COMPOSIO_API_KEY` plus a `composio_connected_account_id`
obtained through Composio's own OAuth flow — see
[`docs/COMPOSIO.md`](./docs/COMPOSIO.md) and
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md). Before adding a new
third-party connector, see
[CONTRIBUTING.md § Third-Party Connectors — Credential Policy](./CONTRIBUTING.md#third-party-connectors--credential-policy-byok).

---

## Command Execution

### Shell Command Escaping

**CRITICAL:** Always escape shell commands to prevent injection:

```typescript
import { execSync } from 'child_process';
import shellEscape from 'shell-escape';

// ❌ DANGEROUS: Command injection vulnerability
function dangerous(userInput: string) {
  return execSync(`git clone ${userInput}`);
}

dangerous('https://repo.git; rm -rf /'); // DISASTER!

// ✅ SAFE: Properly escaped
function safe(userInput: string) {
  const escaped = shellEscape(['git', 'clone', userInput]);
  return execSync(escaped);
}

safe('https://repo.git; rm -rf /'); // Safe - treated as single argument
```

### Template Substitution

```typescript
// ✅ Safe parameter templating
const command = 'curl {url} -H "Authorization: Bearer {token}"';
const escaped = {
  url: shellEscape([userUrl]),
  token: shellEscape([userToken]),
};

const final = command.replace('{url}', escaped.url).replace('{token}', escaped.token);
```

### Environment Variables in Commands

```typescript
// ✅ SAFE: Use environment variables
const env = {
  ...process.env,
  MATIMO_API_KEY: apiKey, // Retrieved from process.env.MATIMO_API_KEY
  MATIMO_TIMEOUT: '5000',
};

execSync('tool-command', { env });

// ❌ WRONG: Don't pass secrets as command arguments
execSync(`tool-command --key=${apiKey}`); // Visible in process list!
```

---

## Common Vulnerabilities

### 1. Command Injection

**Risk:** User input executed as shell command.

```typescript
// ❌ VULNERABLE
execSync(`echo ${userInput}`);

// ✅ FIXED
execSync(`echo "${shellEscape([userInput])}"`);
```

### 2. Secret Leakage

**Risk:** Secrets exposed in logs, errors, or responses.

```typescript
// ❌ VULNERABLE
logger.info('API Key:', apiKey);
throw new Error(`Failed with key: ${apiKey}`);
return { success: true, token: userToken };

// ✅ FIXED
logger.info('API authentication successful');
throw new MatimoError('Authentication failed', ErrorCode.AUTH_FAILED);
return { success: true }; // No token in response
```

### 3. Insecure Deserialization

**Risk:** Executing arbitrary code from untrusted data.

```typescript
// ❌ VULNERABLE: Can execute arbitrary code
eval(userCode);
new Function(userInput)();

// ✅ SAFE: Validate against schema
const validated = toolSchema.parse(userInput);
```

### 4. Missing Input Validation

**Risk:** Invalid data causes unexpected behavior.

```typescript
// ❌ VULNERABLE
function processUser(user: any) {
  return database.save(user); // No validation!
}

// ✅ SAFE
function processUser(user: unknown) {
  const validated = userSchema.parse(user); // Validate with Zod
  return database.save(validated);
}
```

### 5. Timing Attacks

**Risk:** Different response times reveal information.

```typescript
// ❌ VULNERABLE: Early return on wrong char
function checkPassword(input: string, actual: string) {
  for (let i = 0; i < input.length; i++) {
    if (input[i] !== actual[i]) return false; // Fast fail
  }
  return true;
}

// ✅ FIXED: Constant-time comparison (use crypto library)
import { timingSafeEqual } from 'crypto';

function checkPassword(input: string, actual: string) {
  return timingSafeEqual(Buffer.from(input), Buffer.from(actual));
}
```

---

## Security Checklist

### Before Deploying

- [ ] No hardcoded secrets (search for passwords, tokens, keys)
- [ ] All user input validated against schema
- [ ] Sensitive data never logged
- [ ] Error messages don't leak implementation details
- [ ] Shell commands properly escaped
- [ ] Authentication configured (not default credentials)
- [ ] HTTPS enabled for API endpoints
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Dependencies audited (`npm audit`)

### Before Release

- [ ] Security audit completed
- [ ] No known vulnerabilities in dependencies
- [ ] All tests passing
- [ ] Code reviewed by security-aware reviewer
- [ ] Security documentation updated
- [ ] Incident response plan in place
- [ ] Monitoring and logging configured

### Code Review Questions

- [ ] Are all external inputs validated?
- [ ] Are secrets handled correctly (env vars, not hardcoded)?
- [ ] Are error messages safe (no implementation details)?
- [ ] Is sensitive data protected in logs?
- [ ] Are shell commands properly escaped?
- [ ] Is authentication secure?
- [ ] Are there any obvious vulnerabilities?

---

## Reporting Security Issues

**DO NOT** open a public GitHub issue for security vulnerabilities.

### Responsible Disclosure

1. **Email:** security@matimo.dev (or GitHub security advisory)
2. **Information to Include:**
   - Type of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

3. **Response Timeline:**
   - Acknowledgment: 48 hours
   - Initial fix: 7 days
   - Release: 14 days

### Security Updates

Security fixes are released as patch versions (MAJOR.MINOR.PATCH) and announced in:

- GitHub releases
- npm advisories
- Security mailing list

---

## Phase 1 vs Phase 2+ Security

### Phase 1 (Current - Foundation)

✅ **Implemented:**

- Input validation with Zod
- Secret management (env vars, no hardcoding)
- Error handling with safe messages
- Command execution with proper escaping
- Structured logging without secrets
- TypeScript strict mode (no `any`)

### Phase 2+ (Coming)

⏳ **Planned:**

- OAuth2 authentication flow
- Rate limiting and quota tracking
- Request signing and verification
- Encryption at rest
- Audit logging and compliance
- Security scanning in CI/CD
- Penetration testing

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)
- [npm Security Guidelines](https://docs.npmjs.com/cli/v7/using-npm/security)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)

---

## Questions?

- **Security issue?** Report privately to security@matimo.dev
- **Question about security?** Open a [GitHub Discussion](https://github.com/tallclub/matimo/discussions)
- **Found a vulnerability?** Follow responsible disclosure above

**Remember:** Security is everyone's responsibility. When in doubt, ask! 🔒
