---
name: slack-intelligence
description: Best practices for extracting signal from Slack channel history — decisions, action items, blockers, and FYIs — and formatting them into structured reports.
---

# Slack Intelligence Skill

Extract meaningful signal from raw Slack message history and produce structured, actionable reports.

## Core Categories to Extract

### 🔴 Blockers
Messages indicating something is stuck, broken, or preventing progress.
Signals: "blocked", "can't", "waiting on", "broken", "issue", "problem", "stuck", "need help", "urgent"

### ✅ Decisions Made
Messages where a conclusion, agreement, or direction was settled.
Signals: "we decided", "going with", "confirmed", "agreed", "approved", "final", "will do", "let's go with"

### 📋 Action Items
Messages assigning tasks or committing to next steps.
Signals: "@mention + verb", "will", "I'll", "you should", "please", "need to", "by [date/time]", "take care of"

### 📢 FYIs / Announcements
Informational messages with no required action.
Signals: "FYI", "heads up", "just so you know", "for your awareness", "update:", "reminder"

## Extraction Rules

1. **Preserve context**: Always include who said what (username) and approximate time.
2. **Don't over-extract**: Only pull genuinely meaningful messages. Skip greetings, reactions, emoji-only messages.
3. **De-duplicate**: If the same topic appears multiple times, consolidate into one item.
4. **Mark urgency**: Flag items that are time-sensitive (mention of deadlines, "today", "ASAP", "urgent").
5. **Thread awareness**: A thread reply often resolves the parent message — note if resolved.

## Report Format

```
## 📊 Channel Intelligence Report
**Channel:** #channel-name  
**Period:** Last N hours  
**Messages Analyzed:** X

---
### 🔴 Blockers (N)
- [URGENT?] @user: <summary> — <timestamp>

### ✅ Decisions Made (N)
- <decision summary> — agreed by @user1, @user2

### 📋 Action Items (N)
- [ ] @assignee: <task> — due <deadline or "unspecified">

### 📢 FYIs (N)
- <summary> — from @user

---
**Signal Score:** X/10 (ratio of meaningful to total messages)
```

## Quality Checklist
- [ ] Every item has an owner or source
- [ ] Blockers are marked urgent if time-sensitive
- [ ] Action items have assignee and task clearly stated
- [ ] Report is scannable in under 2 minutes
- [ ] No hallucinated items — only what was explicitly in the messages
