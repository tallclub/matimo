# Matimo MCP Documentation Navigation Map

**For**: Everyone on the team  
**Purpose**: Find the right guide for your task  
**Updated**: April 2026  
**Status**: All guides include TypeScript + Python equally

---

## 🎯 I Want To... (Task-Based Navigation)

### 🚀 Quick Start (Both TypeScript & Python)

| I want to... | Read this | Time |
|---|---|---|
| **Setup in 5 minutes** | [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Get Started in 3 Steps" | 5 min |
| **Configure VS Code** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Step 2: Configure VS Code" | 5 min |
| **Create first tool** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Creating Your First Tool" | 20 min |
| **See TypeScript example** | [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Code Example" | 10 min |
| **See Python example** | [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Code Example" | 10 min |

### 🔧 Detailed Setup (Bilingual)

| I want to... | Read this | Time |
|---|---|---|
| **Full setup (both SDKs)** | [SETUP_GUIDE.md](SETUP_GUIDE.md) | 30 min |
| **Verify my setup works** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Step 3: Verify Setup" | 5 min |
| **Fix TypeScript issues** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Troubleshooting" | 10 min |
| **Fix Python issues** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Troubleshooting" | 10 min |
| **Compare TS vs Py** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "TypeScript vs Python Workflow" | 15 min |
| **Understand bilingual system** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Creating Your First Tool" | 15 min |

### 📚 Learning (Both Languages)

| I want to... | Read this | Time |
|---|---|---|
| **Understand system architecture** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "System Architecture" | 10 min |
| **See how agent works** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Understanding the System" | 15 min |
| **Learn TypeScript patterns** | [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Code Example (TypeScript)" | 10 min |
| **Learn Python patterns** | [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Code Example (Python)" | 10 min |
| **Understand MCP server** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Understanding the System, Layer 3" | 10 min |
| **See workflow example** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Workflow Examples" | 15 min |

### 🎛️ Creating Tools (Both Implementations)

| I want to... | Read this | Time |
|---|---|---|
| **Create simple tool** | [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Simple Tool" | 5 min |
| **Create tool (step-by-step)** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Creating Your First Tool" | 20 min |
| **Create tool with validation** | [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Tool with Validation" | 10 min |
| **Create tool with OAuth2** | [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Tool with Complex Auth" | 15 min |
| **Review code patterns (TS)** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "TypeScript vs Python Workflow" | 10 min |
| **Review code patterns (Py)** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "TypeScript vs Python Workflow" | 10 min |
| **Review test patterns (TS)** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "TypeScript vs Python Workflow" | 10 min |
| **Review test patterns (Py)** | [SETUP_GUIDE.md](SETUP_GUIDE.md) § "TypeScript vs Python Workflow" | 10 min |

### 👥 Team Leads & Maintainers

| I want to... | Read this | Time |
|---|---|---|
| **Monitor system health** | [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "System Health & Monitoring" | 10 min |
| **Monitor TS + Py parity** | [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "TypeScript vs Python Considerations" | 10 min |
| **Manage the agent** | [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "Managing the Agent" | 15 min |
| **Update skill (TS)** | [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "Managing the Skill" | 15 min |
| **Update skill (Py)** | [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "Managing the Skill" | 15 min |
| **Update both SDKs** | [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "Updating Standards (Both SDKs)" | 20 min |
| **Add new MCP tool** | [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "Adding Matimo Tools" | 30 min |
| **Code review (bilingual)** | [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "Code Review Checklist (Both SDKs)" | 10 min |
| **Track metrics** | [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "Team Best Practices" | 10 min |
| **Ensure TS/Py parity** | [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "TypeScript vs Python Considerations" | 15 min |

---

## 📂 Documentation Structure

```
docs/mcp/
├── SETUP_GUIDE.md ..................... Full technical guide (bilingual) ✅
│   ├─ Quick Start (5 min)
│   ├─ System Architecture (bilingual)
│   ├─ Prerequisites (both SDKs)
│   ├─ Step 1-3 (setup for both)
│   ├─ Understanding System (bilingual)
│   ├─ Creating First Tool (both implementations)
│   ├─ TypeScript vs Python Workflow ⭐
│   └─ Troubleshooting (both SDKs)
│
├── QUICK_REFERENCE.md ................ Cheat sheet (bilingual) ✅
│   ├─ 3-Step Quick Start (both)
│   ├─ System Overview
│   ├─ Key Commands (TS + Py)
│   ├─ File Structure (both SDKs)
│   ├─ Common Requests
│   ├─ TS vs Py Comparison Table ⭐
│   ├─ Bilingual Code Examples ⭐
│   └─ Quick Fixes (both SDKs)
│
├── MAINTENANCE_GUIDE.md .............. For team leads (bilingual) ✅
│   ├─ System Health Monitoring
│   ├─ Managing Agent
│   ├─ Managing Skill
│   ├─ TypeScript vs Python Considerations ⭐
│   ├─ Adding Matimo Tools
│   ├─ Updating Standards (Both SDKs) ⭐
│   ├─ Team Best Practices (bilingual)
│   ├─ Performance Optimization
│   ├─ CI/CD Integration (both SDKs)
│   └─ Troubleshooting (both SDKs)
│
└── NAVIGATION_MAP.md ................. You are here
    └─ Navigation guide + cross-references
```

⭐ = Special attention to TypeScript + Python parity

---

## 👤 Choose Your Path

### For **Developers (Any SDK)**

**Path 1: Just get started (20 minutes)**
1. Read: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) "Get Started in 3 Steps"
2. Read: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) "Common Requests"
3. Create your first tool (both TS + Py implementations automatically)

**Path 2: Learn the system (1 hour)**
1. Read: [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
2. Read: [SETUP_GUIDE.md](SETUP_GUIDE.md) § "System Architecture"
3. Read: [SETUP_GUIDE.md](SETUP_GUIDE.md) § "TypeScript vs Python Workflow"
4. Create first tool + compare output (both implementations)

**Path 3: Master both SDKs (2-3 hours)**
1. Read: [SETUP_GUIDE.md](SETUP_GUIDE.md) (complete)
2. Create 5 tools with different patterns
3. Review both TypeScript and Python implementations
4. Compare test patterns between Jest (TS) and pytest (Py)
5. Study Skill patterns for both languages

---

### For **Team Leads/Architects**

**Path 1: Understand the system (30 minutes)**
1. Read: [SETUP_GUIDE.md](SETUP_GUIDE.md) § "System Architecture"
2. Read: [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Understanding the System"
3. Skim: [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md)

**Path 2: Set up monitoring (1 hour)**
1. Read: [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "System Health & Monitoring"
2. Set up health check script
3. Set up bilingual metrics tracking
4. Integrate with team dashboard

**Path 3: Full system mastery (3-4 hours)**
1. Read: [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) (complete)
2. Focus on: "TypeScript vs Python Considerations" ⭐
3. Focus on: "Updating Standards (Both SDKs)" ⭐
4. Plan quarterly reviews for both SDKs

---

### For **New Team Members**

**Day 1 (2 hours)**
1. Read: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (10 min)
2. Read: [SETUP_GUIDE.md](SETUP_GUIDE.md) § "System Architecture" (15 min)
3. Setup: MCP server + VS Code (15 min)
4. Create: First tool (receives both TS + Py implementations automatically!)
5. Review: Generated TypeScript code (15 min)
6. Review: Generated Python code (15 min)

**Day 2-3**
1. Read: [SETUP_GUIDE.md](SETUP_GUIDE.md) (complete)
2. Read: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "TS vs Python Workflow"
3. Create: 3-5 more tools
4. Compare: TS vs Py implementations for same tool
5. Study: Skill patterns for both languages

---

## 🔗 Quick Links

### Setup & Reference
- [SETUP_GUIDE.md](SETUP_GUIDE.md) — Complete technical guide (bilingual)
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) — 2-minute cheat sheet (bookmark/print)
- [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) — For teams & operations

### Learning Resources
- [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Understanding the System" — Architecture
- [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Creating Your First Tool" — Walkthrough
- [SETUP_GUIDE.md](SETUP_GUIDE.md) § "TypeScript vs Python Workflow" — Comparison
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Bilingual Code Example" — Real code
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "TS vs Python at a Glance" — Quick comparison

### TypeScript Specific
- [SETUP_GUIDE.md](SETUP_GUIDE.md) § "TypeScript vs Python Workflow" § "TypeScript Testing"
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "TypeScript Executor"
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "TypeScript Tests (Jest)"
- [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "Code Review Checklist" § "TypeScript Implementation"

### Python Specific
- [SETUP_GUIDE.md](SETUP_GUIDE.md) § "TypeScript vs Python Workflow" § "Python Testing"
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Python Executor"
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Python Tests (pytest)"
- [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "Code Review Checklist" § "Python Implementation"

### Bilingual & Operations
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "TS vs Python at a Glance" — Feature comparison
- [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Creating Your First Tool" — Both implementations automatically
- [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "TypeScript vs Python Considerations" — Coverage, testing, linting parity

---

## ❓ FAQ: "I'm Lost, Where Do I Start?"

| Situation | Do this |
|-----------|---------|
| **Complete TypeScript beginner** | 1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) 2. Start MCP server 3. Create first tool |
| **Python developer, new to Matimo** | 1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) 2. See Python examples 3. Create first tool |
| **Know both TS & Py, new to MCP** | 1. [SETUP_GUIDE.md](SETUP_GUIDE.md) § "System Architecture" 2. Create tool 3. Compare outputs |
| **Setting up team environment** | 1. [SETUP_GUIDE.md](SETUP_GUIDE.md) 2. [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) 3. Setup monitoring |
| **Encountered issue (TS or Py)** | Go: [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Troubleshooting" |
| **Need to maintain system** | Go: [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) |
| **Want TS + Py code examples** | Go: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Bilingual Code Example" |
| **Comparing implementation approaches** | Go: [SETUP_GUIDE.md](SETUP_GUIDE.md) § "TypeScript vs Python Workflow" |

---

## ⏱️ Time Estimates

| Activity | Time |
|----------|------|
| 🟢 Quick start (both SDKs) | 15-20 min |
| 🟡 Full setup (TS + Py) | 45-60 min |
| 🟡 Create one bilingual tool | 25-30 min |
| 🟠 Learn full system (both SDKs) | 2-3 hours |
| 🟠 Setup monitoring (bilingual) | 1-2 hours |
| 🔴 Full mastery (team lead, both SDKs) | 4-8 hours |

---

## ✅ Success Checklist

After reading docs, verify you can:

- [ ] Describe system in 3 sentences (Agent + Skill + MCP tools work bilingual)
- [ ] Start MCP server (same for both SDKs)
- [ ] Configure VS Code (same config for both)
- [ ] Request tool that creates BOTH TypeScript AND Python
- [ ] Describe agent workflow (5 steps, creates both implementations)
- [ ] Locate generated TypeScript files
- [ ] Locate generated Python files
- [ ] Run TypeScript tests (pnpm test)
- [ ] Run Python tests (uv run pytest)
- [ ] Explain why YAML is shared (§ Parts 1-2)
- [ ] Explain test pattern differences (Jest vs pytest but equal coverage)
- [ ] Find answer to any question in docs

---

## 🎓 Recommended Reading Order

**For everyone**:
1. This file (navigation map) — 2 min
2. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) — 10 min
3. **Choose your SDK(s)**

**Then pick your path** (see above)

---

## 📞 Support Flow

```
Question about...              Go to...
────────────────────────────────────────────
Getting started                QUICK_REFERENCE.md
Setup instructions            SETUP_GUIDE.md § "Step 1-3"
How system works              SETUP_GUIDE.md § "Understanding the System"
TypeScript implementation     SETUP_GUIDE.md § "TypeScript vs Python Workflow"
Python implementation         SETUP_GUIDE.md § "TypeScript vs Python Workflow"
Code patterns (TS)            QUICK_REFERENCE.md § "TypeScript Executor"
Code patterns (Py)            QUICK_REFERENCE.md § "Python Executor"
Test patterns (TS)            QUICK_REFERENCE.md § "TypeScript Tests"
Test patterns (Py)            QUICK_REFERENCE.md § "Python Tests"
Common issues                 SETUP_GUIDE.md § "Troubleshooting"
Team monitoring               MAINTENANCE_GUIDE.md § "System Health"
Bilingual parity              MAINTENANCE_GUIDE.md § "TS vs Python Considerations"
```

---

## 🚀 Quick Start Command

```bash
# Read this (2 min)
cat QUICK_REFERENCE.md

# Then request your first tool (both implementations):
# In VS Code Copilot Chat:

@agent matimo-tool-creator-refactored
"Create a GitHub tool to list repositories"

# Result:
# ✅ TypeScript: packages/github/tools/list_repos/ + tests
# ✅ Python: python/packages/github/tools/list_repos/ + tests
# ✅ Both passing tests
# ✅ Both reviewed + validated
```

---

**Last Updated**: April 2026  
**Status**: Production Ready  
**Bilingual**: ✅ TypeScript + Python Equal Support  
**Location**: `docs/mcp/` directory
