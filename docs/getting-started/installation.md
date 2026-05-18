# Installation & Setup

## Choose Your SDK

Matimo is available for both **TypeScript/Node.js** and **Python**. Pick the language that matches your project.

| SDK | Package manager | Min version |
|-----|----------------|-------------|
| TypeScript | npm / pnpm | Node.js ≥ 18, pnpm ≥ 8.15 |
| Python | pip / uv | Python ≥ 3.11 |

---

## Python SDK

### Requirements

- **Python**: 3.11 or higher
- **uv** (recommended) or pip

### Option 1: From PyPI (Recommended for Users)

```bash
# Core SDK only
pip install matimo
# or with uv (recommended)
uv add matimo

# With LangChain integration
pip install "matimo[langchain]"
uv add "matimo[langchain]"

# With CrewAI integration
pip install "matimo[crewai]"

# With all optional extras
pip install "matimo[langchain,crewai]"
```

Provider packages are published separately:

```bash
pip install matimo-slack matimo-github matimo-gmail
uv add matimo-slack matimo-github matimo-gmail
```

### Option 2: From Source (Recommended for Contributors)

```bash
# Clone the repository
git clone https://github.com/tallclub/matimo.git
cd matimo/python

# Install all workspace packages with dev dependencies
uv sync --dev

# Run tests to verify installation
uv run -w . pytest packages/core/tests/ -v
```

### Verify Installation

```python
# test_install.py
import asyncio
from matimo import Matimo

async def main():
    matimo = await Matimo.init('./tools')
    print(f"✅ Matimo installed successfully")
    print(f"📦 Loaded {len(matimo.list_tools())} tools")

asyncio.run(main())
```

Run it:

```bash
python test_install.py
# or with uv
uv run python test_install.py
```

### Python Next Steps

- **New Users**: Go to [Quick Start](./QUICK_START.md#python-sdk)
- **Building Tools**: Read [Tool Specification](../tool-development/YAML_TOOLS.md) (YAML format is identical)
- **LangChain / CrewAI**: See [LangChain Integration](../framework-integrations/LANGCHAIN.md)
- **Examples**: See [python/examples/](../../python/examples/)

---

## TypeScript SDK

### Requirements

- **Node.js**: v18.0.0 or higher
- **pnpm**: v8.15.0 or higher (preferred package manager)
- **Git**: For cloning the repository

## Installation Options

### Option 1: From npm (Recommended for Users)

```bash
# Install the complete SDK (includes core + all tools)
npm install matimo
# or with pnpm (recommended)
pnpm add matimo

# OR install individual packages:
pnpm add @matimo/core    # Core SDK only
pnpm add @matimo/slack   # Slack tools
pnpm add @matimo/gmail   # Gmail tools
pnpm add @matimo/cli     # CLI tool management
```

**Note**: Check [npm](https://www.npmjs.com/package/@matimo/core) for the latest stable release. Future releases follow semantic versioning.

### Option 2: From Source (Recommended for Contributors)

```bash
# Clone the repository
git clone https://github.com/tallclub/matimo.git
cd matimo

# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Run tests to verify installation
pnpm test
```

## Verify Installation

```typescript
// test-install.ts - Both imports work:
import { MatimoInstance } from 'matimo'; // From root package
// OR
import { MatimoInstance } from '@matimo/core'; // From core package directly

const matimo = await MatimoInstance.init('./tools');
console.log(`✅ Matimo installed successfully`);
console.log(`📦 Loaded ${matimo.listTools().length} tools`);
```

Run it:

```bash
npx tsx test-install.ts
```

## Next Steps

- **New Users**: Go to [Quick Start](./QUICK_START.md)
- **Want Examples**: See [examples/](../../examples/)
- **Building Tools**: Read [Tool Specification](../tool-development/YAML_TOOLS.md)
- **Using Decorators**: Check [Decorator Guide](../tool-development/DECORATOR_GUIDE.md)

## Troubleshooting Installation

### Python: Version Error

```bash
python --version  # Should be 3.11+
```

If lower, install Python 3.11+ from [python.org](https://python.org) or via pyenv:

```bash
pyenv install 3.11
pyenv global 3.11
```

### Python: uv Installation

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv --version
```

### Python: Import Error After Install

```bash
# Verify the package is installed in the right environment
pip show matimo
# or
uv pip show matimo
```

---

## Troubleshooting Installation (TypeScript)

### Node.js Version Error

```bash
node --version  # Should be v18.0.0 or higher
```

If lower, install Node.js 18+ from [nodejs.org](https://nodejs.org/)

### pnpm Installation

```bash
npm install -g pnpm@8.15.0
pnpm --version  # Should be 8.15.0 or higher
```

### Build Errors

```bash
# Clear and rebuild
pnpm clean
pnpm install
pnpm build
```

If issues persist, check [Troubleshooting Guide](../troubleshooting/FAQ.md)

## System Requirements

### TypeScript SDK

| Component  | Requirement                |
| ---------- | -------------------------- |
| Node.js    | ≥ 18.0.0                   |
| pnpm       | ≥ 8.15.0                   |
| TypeScript | ≥ 5.0 (included)           |
| Disk Space | ~500MB (with node_modules) |
| Memory     | ≥ 512MB for build          |

### Python SDK

| Component  | Requirement      |
| ---------- | ---------------- |
| Python     | ≥ 3.11           |
| uv         | Latest (recommended) |
| Disk Space | ~200MB (with venv) |
| Memory     | ≥ 256MB          |

## IDE Setup

### VS Code (Recommended)

```bash
# Extensions to install
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- ESLint
- Thunder Client (for testing HTTP tools)
```

### WebStorm / IntelliJ

Works out of the box with TypeScript support.

## Environment Variables

### Security Settings

**Embedded Code Execution** (Disabled by Default)

Embedded code in tool YAML is **disabled by default** for security. To enable it:

```bash
# Explicitly opt-in to embedded code execution
# embeddedCodeDisabled = (MATIMO_ALLOW_EMBEDDED_CODE !== 'true')
# If NOT set to 'true' → code is disabled
export MATIMO_ALLOW_EMBEDDED_CODE=true
```

⚠️ **Only enable if you fully trust all tool YAML sources. Never enable in production without careful review.**

See [Security Guide](../user-guide/SECURITY.md) for more details.

## Quick Verification Checklist

- [ ] Node.js v18+ installed
- [ ] pnpm v8.15+ installed
- [ ] Repository cloned
- [ ] `pnpm install` completed
- [ ] `pnpm build` successful
- [ ] `pnpm test` all passing
- [ ] Ready to start! 🚀
