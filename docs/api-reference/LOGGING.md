# Matimo Logger Integration (TypeScript & Python)

## Overview

Matimo provides a structured logging integration for **TypeScript** (backed by **Winston**) and **Python** (backed by stdlib `logging`). The logger:
- ✅ Supports structured logging (JSON format for production)
- ✅ Provides multiple log levels (silent, error, warn, info, debug)
- ✅ Integrates seamlessly with `MatimoInstance` (TypeScript) and `Matimo` (Python)
- ✅ Allows custom logger implementations in both languages
- ✅ Configurable via environment variables or programmatic options
- ✅ Zero impact on existing code (backward compatible)

## Quick Start

### Basic Usage (Default Logger)

```typescript
import { MatimoInstance } from '@matimo/core';

// Initialize with default Winston logger
const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  logLevel: 'info',      // Default: 'info'
  logFormat: 'json'      // Default: 'json' in production, 'simple' in development
});

// Logger is automatically configured and used internally
// Logs will be output to console
```

### Environment Variable Configuration

Set logging options via environment variables. In TypeScript they take precedence over `logLevel` / `logFormat` passed to `init()`; in Python the values passed to `init()` win and the variables are the fallback. Without either, TypeScript logs JSON when `NODE_ENV=production` and simple text otherwise.

```bash
# Set log level
export MATIMO_LOG_LEVEL=debug    # silent, error, warn, info, debug

# Set log format
export MATIMO_LOG_FORMAT=json    # json, simple

# Then initialize (no need to pass config)
const matimo = await MatimoInstance.init({ autoDiscover: true });
```

### Accessing the Logger

```typescript
const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  logLevel: 'debug'
});
const logger = matimo.getLogger();

// Log messages with metadata
logger.info('Processing user request', {
  userId: 'user_123',
  action: 'list_tools',
});

logger.debug('Cache hit', { cacheKey: 'tools_list', ttl: 300 });

logger.warn('Rate limit approaching', {
  requestsRemaining: 5,
  resetTime: new Date().toISOString(),
});

logger.error('Tool execution failed', {
  toolName: 'slack_send_message',
  error: 'Authentication failed',
});
```

## Log Levels

| Level   | Use Case | Included Logs |
|---------|----------|---------------|
| `silent` | Testing environment | Errors only (filtered) |
| `error` | Production alerts | Errors only |
| `warn` | Important issues | Warnings + Errors |
| `info` | Default/general | Info + Warnings + Errors |
| `debug` | Development/troubleshooting | All logs including debug |

## Log Formats

### JSON Format (Production)
```json
{
  "timestamp": "2026-02-16 14:30:45",
  "level": "info",
  "message": "Matimo SDK initialized successfully",
  "toolCount": 25,
  "paths": 2
}
```

**Best for:**
- Cloud logging services (CloudWatch, DataDog, Splunk)
- Log aggregation and analysis
- Machine-readable parsing
- Production environments

### Simple Format (Development)
```
[2026-02-16 14:30:45] [INFO] Matimo SDK initialized successfully
{
  "toolCount": 25,
  "paths": 2
}
```

**Best for:**
- Human-readable output
- Development and debugging
- Console monitoring
- Local testing

## Custom Logger Implementation

Pass your own logger instead of using Winston:

```typescript
import { MatimoInstance, MatimoLogger } from '@matimo/core';

// Your custom logger (e.g., Pino, Bunyan, or any logger)
const customLogger: MatimoLogger = {
  info: (msg, meta) => yourLogger.info(msg, meta),
  warn: (msg, meta) => yourLogger.warn(msg, meta),
  error: (msg, meta) => yourLogger.error(msg, meta),
  debug: (msg, meta) => yourLogger.debug(msg, meta),
};

const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  logger: customLogger,  // Custom logger implementation
});
```

## Production Configuration Example

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({
  autoDiscover: true,     // built-in tools plus installed @matimo/* packages
  toolPaths: ['./tools'], // your own tools
  logLevel: 'info',       // MATIMO_LOG_LEVEL overrides this if set
  logFormat: 'json',      // also the default when NODE_ENV=production
});

// Logs to console in structured JSON format
// Pipe to cloud logging service:
// node app.js | jq . | curl -X POST https://cloudwatch/logs
```

## Global Logger Access

For advanced use cases, access the logger globally:

```typescript
import { getGlobalMatimoLogger, setGlobalMatimoLogger } from '@matimo/core';

// Get the initialized logger
const logger = getGlobalMatimoLogger();
logger.info('Custom log from anywhere', { context: 'global_access' });

// Override the logger (advanced)
setGlobalMatimoLogger(myNewLogger);
```

## Integration with Decorator Pattern

```typescript
import { MatimoInstance, tool, setGlobalMatimoInstance } from '@matimo/core';
import { getGlobalMatimoLogger } from '@matimo/core';

const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  logLevel: 'debug',
});

setGlobalMatimoInstance(matimo);

class MyAgent {
  @tool('slack_send_message')
  async sendSlackMessage(channel: string, text: string) {
    // Access logger
    const logger = getGlobalMatimoLogger();
    logger.debug('Sending Slack message', { channel, textLength: text.length });
    // Decorator handles execution
  }
}
```

## Integration with LangChain

```typescript
import { MatimoInstance, convertToolsToLangChain } from '@matimo/core';

const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  logLevel: 'info',
  logFormat: 'json',
});

// Convert tools to LangChain schema (logger already integrated)
const langchainTools = convertToolsToLangChain(
  matimo.listTools(),
  matimo
);

// Tools will log execution details automatically
```

## Testing with Logger

Tests use a silent logger to prevent spam:

```bash
# Run tests (logger automatically silenced during tests)
pnpm test

# To see logs during test debugging
LOG_LEVEL=debug pnpm test -- --verbose
```

## Performance Notes

- **Winston overhead**: < 1ms per log call (negligible for production)
- **JSON format** slightly slower than simple format (use for production logging services)
- **Silent mode** (testing): Zero overhead, no-op logger
- **Structured logs** enable fast filtering/indexing in cloud services

## Troubleshooting

### Logs Not Appearing

```bash
# Check log level
export MATIMO_LOG_LEVEL=info  # Must be info or lower

# Check if logger is initialized
const logger = matimo.getLogger();
logger.info('Test log');  // This should appear
```

### Too Much Output

```bash
# Reduce log level
export MATIMO_LOG_LEVEL=error  # Only errors
```

### JSON Format Issues

```bash
# Ensure JSON logs are being piped to a log aggregator
node myapp.js | jq '.'  # Parse and pretty-print JSON logs
```

## API Reference

### `MatimoLogger` Interface
```typescript
interface MatimoLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}
```

### `LoggerConfig` Options
```typescript
interface LoggerConfig {
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';
  logFormat?: 'json' | 'simple';
  logger?: MatimoLogger;  // Custom logger
}
```

### `InitOptions` (Extended)
```typescript
interface InitOptions extends LoggerConfig {
  toolPaths?: string[];
  autoDiscover?: boolean;
  includeCore?: boolean;
  // ... plus all LoggerConfig options
}
```

## Python SDK Logging

The Python SDK mirrors the TypeScript logging API, backed by stdlib `logging` instead of Winston.

### Basic Usage

```python
from matimo import Matimo
from matimo.logging import setup_logger, get_global_matimo_logger

# Configure and initialize
matimo = await Matimo.init(auto_discover=True, log_level='info', log_format='json')

# Access the logger; metadata goes in keyword arguments
logger = get_global_matimo_logger()
logger.info('Processing request', user='u123')
logger.debug('Cache hit', key='tools_list')
logger.warn('Rate limit near', remaining=5)
logger.error('Tool failed', tool='slack_send')
```

### Environment Variables

The same env vars control the Python SDK, as a fallback when `init()` / `setup_logger()` get no value:

```bash
export MATIMO_LOG_LEVEL=debug   # silent | error | warn | info | debug
export MATIMO_LOG_FORMAT=json   # json | simple
```

### `setup_logger()` Options

```python
from matimo.logging import setup_logger

logger = setup_logger(level='info', log_format='json')
```

### Custom Logger

Python logs through the standard-library logger named `matimo` (with `propagate = False`). To send Matimo's logs somewhere else, add a handler to it after `init()`:

```python
import logging

matimo = await Matimo.init(auto_discover=True)
logging.getLogger("matimo").addHandler(my_handler)
```

`Matimo.init()` has no `logger=` argument; each `init()` or `setup_logger()` call re-applies the level and formatter to the handlers on `matimo`.

### Global Logger Access

```python
from matimo.logging import get_global_matimo_logger, set_global_matimo_logger

logger = get_global_matimo_logger()
logger.info('Global log from anywhere')

set_global_matimo_logger(my_custom_logger)
```

### Silent Mode (Testing)

```python
matimo = await Matimo.init(auto_discover=True, log_level='silent')
# or use MATIMO_LOG_LEVEL=silent pytest ...
```

### MatimoLogger Interface (Python)

`MatimoLogger` is a thin wrapper around a stdlib `logging.Logger`; metadata is passed as keyword arguments:

```python
class MatimoLogger:
    def __init__(self, logger: logging.Logger) -> None: ...
    def info(self, message: str, **meta: object) -> None: ...
    def warn(self, message: str, **meta: object) -> None: ...
    def error(self, message: str, **meta: object) -> None: ...
    def debug(self, message: str, **meta: object) -> None: ...
    def is_silent(self) -> bool: ...
```

### Log Output Formats

**JSON** (same schema as TypeScript):
```json
{"timestamp": "2026-04-01 14:30:00", "level": "info", "message": "SDK initialized", "toolCount": 25}
```

**Simple**:
```
[2026-04-01 14:30:00] [INFO] SDK initialized
```

> See [`python/examples/native/logger_example.py`](../../python/examples/native/logger_example.py) for a full Python logging demo.
> Run with: `cd python && make logger-example`

---

## Next Steps

- Use `logLevel: 'debug'` during development for detailed insights
- Switch to `logLevel: 'info'` and `logFormat: 'json'` for production
- Forward JSON logs to your cloud logging service
- Monitor log output for performance insights
