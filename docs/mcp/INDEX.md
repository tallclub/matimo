# Matimo MCP Documentation Index

**Welcome to Matimo MCP Setup & Usage Documentation!**

---

## 📖 Main Documentation (Bilingual: TypeScript & Python)

All guides include **equal coverage** of TypeScript and Python implementations.

### 1. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** — Start Here! ⭐
   - **Time**: 5-10 minutes
   - **Best for**: Quick lookup, bookmarking, printing
   - **Includes**: 
     - 3-step quick start
     - Key commands (pnpm + uv)
     - Bilingual code examples
     - Common requests
     - Quick fixes
   
   👉 **Start here if you're in a hurry**

---

### 2. **[SETUP_GUIDE.md](SETUP_GUIDE.md)** — Complete Technical Guide
   - **Time**: 20-30 minutes
   - **Best for**: Full setup, learning, troubleshooting
   - **Includes**:
     - Prerequisites (both SDKs)
     - Step 1: Start MCP server
     - Step 2: Configure VS Code
     - Step 3: Verify setup
     - System architecture (bilingual)
     - Creating first tool (walkthrough)
     - TypeScript vs Python workflow
     - Troubleshooting (both SDKs)
   
   👉 **Read this for complete understanding**

---

### 3. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** — Cheat Sheet
   - **Time**: 5 minutes (reference)
   - **Best for**: During development, quick lookup
   - **Includes**:
     - TS vs Python comparison table
     - File structure (both SDKs)
     - Command quick reference
     - Bilingual code examples
   
   👉 **Keep this open while coding**

---

### 4. **[MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md)** — For Team Leads
   - **Time**: 30-45 minutes
   - **Best for**: Operations, system maintenance
   - **Includes**:
     - System health monitoring (both SDKs)
     - Managing agent
     - Managing skill
     - TypeScript vs Python considerations ⭐
     - Updating standards (both SDKs) ⭐
     - Code review checklist (bilingual)
     - CI/CD integration
   
   👉 **Share with team leads and maintainers**

---

### 5. **[NAVIGATION_MAP.md](NAVIGATION_MAP.md)** — This Navigation Guide
   - **Best for**: Finding the right document for your task
   - **Includes**:
     - Task-based navigation
     - Learning paths (3 levels)
     - FAQ: Where do I start?
     - Quick links to all sections
   
   👉 **Use this to find what you need**

---

## 🎯 Quick Navigation by Task

### Just Starting Out?
1. Read: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (5 min)
2. Read: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Get Started in 3 Steps"
3. Follow: The 3-step setup
4. Create: First tool

### Need Full Setup Instructions?
→ Go to [SETUP_GUIDE.md](SETUP_GUIDE.md)

### During Development (Quick Reference)?
→ Bookmark [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

### Troubleshooting an Issue?
→ Go to [SETUP_GUIDE.md](SETUP_GUIDE.md) § "Troubleshooting"

### Team Lead or Maintainer?
→ Go to [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md)

### Lost? Don't Know Where to Look?
→ Go to [NAVIGATION_MAP.md](NAVIGATION_MAP.md)

---

## 📚 What's Covered (All Bilingual)

✅ **TypeScript & Python Side-by-Side**
- Setup instructions for both SDKs
- Code examples (TS + Py)
- Test patterns (Jest + pytest)
- File structure (both locations)
- Command references (pnpm + uv)

✅ **MCP Server**
- HTTP server on port 3101
- 146+ Matimo tools available via MCP
- Environment configuration
- Health checks

✅ **Agent**
- 200-line orchestrator at `.github/agents/matimo-tool-creator-refactored.agent.md`
- Automatically generates both TS and Py implementations
- Runs tests for both SDKs
- Validates bilingual creation

✅ **Skill**
- 400+ line reusable patterns at `.github/skills/matimo-provider-creation/SKILL.md`
- 8 sections providing patterns for both languages
- § Parts 1-3, 6, 8: Identical for both SDKs
- § Parts 4-5: Language-specific (Jest vs pytest)
- § Part 7: Side-by-side code examples

---

## 🚀 TL;DR — Absolute Quick Start

```bash
# 1. Start MCP server (from Matimo root)
cd python/examples/mcp
uv run python src/server_http.py

# 2. Add to ~/.vscode/settings.json
{
  "github.copilot.chat.mcpServers": {
    "matimo": {
      "command": "python3",
      "args": ["src/server_http.py"],
      "cwd": "${workspaceFolder}/python/examples/mcp"
    }
  }
}

# 3. Reload VS Code (Cmd+Shift+P → "Developer: Reload Window")

# 4. In Copilot Chat:
@agent matimo-tool-creator-refactored
"Create a GitHub tool to list repos"

# Result: Both TypeScript and Python implementations created! ✅
```

---

## 📁 File Structure

```
docs/mcp/                    ← You are here
├── INDEX.md               ← Navigation index (this file)
├── SETUP_GUIDE.md         ← Full technical guide (6,000 words)
├── QUICK_REFERENCE.md     ← Cheat sheet (2,500 words)
├── MAINTENANCE_GUIDE.md   ← Team operations (4,000 words)
└── NAVIGATION_MAP.md      ← Task-based navigation (2,500 words)
```

---

## ✅ How to Use These Guides

**Scenario 1: New Developer (No Matimo Experience)**
1. Read: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (10 min)
2. Read: [SETUP_GUIDE.md](SETUP_GUIDE.md) § "System Architecture" (10 min)
3. Follow: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § "Get Started in 3 Steps" (5 min)
4. Create: First tool (20 min)
5. **Total: 45 minutes to first bilingual tool** ✅

**Scenario 2: TypeScript Developer (No Python Experience)**
1. Read: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (10 min)
2. Read: [SETUP_GUIDE.md](SETUP_GUIDE.md) § "TypeScript vs Python Workflow" (15 min)
3. Create: Tool and compare with auto-generated Python (30 min)
4. Study: Python code patterns (20 min)
5. **Total: 1+ hour to understand bilingual creation** ✅

**Scenario 3: Team Lead Setting Up Monitoring**
1. Read: [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) § "System Health & Monitoring" (15 min)
2. Set up: Health check script (15 min)
3. Set up: Bilingual metrics tracking (15 min)
4. Review: CI/CD section (20 min)
5. **Total: 1 hour to full monitoring** ✅

---

## 🎓 Learning Paths

### Path 1: Beginner (30-45 min) — "I Know One Language"
→ Learn Matimo's bilingual approach

### Path 2: Intermediate (1-2 hours) — "I Want Full Context"
→ Understand both implementations equally

### Path 3: Advanced (3-4 hours) — "I Want to Maintain This"
→ Deep understanding for team leadership

See [NAVIGATION_MAP.md](NAVIGATION_MAP.md) for detailed learning paths.

---

## 🆘 Support Quick Links

| Need | Go to |
|------|-------|
| Setup help | [SETUP_GUIDE.md](SETUP_GUIDE.md) § Step 1-3 |
| Errors/bugs | [SETUP_GUIDE.md](SETUP_GUIDE.md) § Troubleshooting |
| Code examples | [QUICK_REFERENCE.md](QUICK_REFERENCE.md) § Bilingual Code Example |
| Can't find something | [NAVIGATION_MAP.md](NAVIGATION_MAP.md) |
| Team operations | [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) |

---

## 🆚 TypeScript or Python? (Answer: Both!)

**Good news**: You don't have to choose!

When you request a tool, the system automatically:
1. ✅ **Generates YAML** (shared, identical)
2. ✅ **Generates TypeScript** code + Jest tests
3. ✅ **Generates Python** code + pytest tests
4. ✅ **Runs both test suites** (pnpm + uv)
5. ✅ **Reports results** for both

**No need to decide — you get both!** 🎉

---

## 📞 Questions?

- **Where do I start?** → [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **How do I set this up?** → [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **I'm lost.** → [NAVIGATION_MAP.md](NAVIGATION_MAP.md)
- **Something broke.** → [SETUP_GUIDE.md](SETUP_GUIDE.md) § Troubleshooting
- **I need to lead a team.** → [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md)

---

**Last Updated**: April 2026  
**Status**: Production Ready  
**Bilingual**: ✅ TypeScript + Python  
**Total Words**: ~15,000+  
**Coverage**: Complete

Start with [QUICK_REFERENCE.md](QUICK_REFERENCE.md) or [SETUP_GUIDE.md](SETUP_GUIDE.md). Happy tool building! 🚀
