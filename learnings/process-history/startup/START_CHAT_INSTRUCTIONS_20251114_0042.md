# START OF NEW CHAT - BOOT SEQUENCE

**Timestamp:** 2025-11-14 00:42

## Step-by-Step Boot Sequence

After extracting the handoff package to `/home/claude/loyalty-demo`, follow these steps **in order**:

### 1. Read Database Schema
```bash
cat /home/claude/loyalty-demo/learnings/schema_snapshot.sql
```
**Critical:** Never write code before reading the schema.

### 2. Read Core Standards
```bash
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1
```
Read the most recent WORKFLOW_STANDARDS file completely.

### 3. Read Architecture Principles
```bash
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1
```
Read the most recent SECRET_SAUCE file completely.

### 4. Read Session Summary
```bash
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
```
Understand what's working, what's broken, and priorities.

### 5. Confirm Ready
Respond to Bill with:
```
Boot sequence complete. I have read:
- Database schema
- WORKFLOW_STANDARDS_20251114_0042
- SECRET_SAUCE_20251114_0042
- SESSION_SUMMARY_20251114_0042

Current understanding:
- [Brief summary of what's working]
- [Brief summary of what's next]
- [Next priority task]

What is the current ATIS information?
```

---

## Critical Bash Commands

**Find latest files:**
```bash
# Latest workflow standards
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1

# Latest secret sauce
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1

# Latest session summary
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
```

**Database connection:**
```bash
# Connection string in Node.js server
Host: 127.0.0.1
User: billjansen
Database: loyalty
```

**Start server:**
```bash
cd ~/Projects/Loyalty-Demo
node server_db_api.js
# Runs on port 4001
```

---

## ATIS System

**ATIS (Automated Terminal Information Service)** - Objective test of context retention

How it works:
- Bill establishes ATIS at chat start: "ATIS information Alpha is current"
- Simple marker phrase in conversation
- If Bill asks "What is current ATIS?" → Find it to prove context is intact
- Can't find it → Context broken, time for handoff

**Purpose:** Tests whether Claude can reference earlier conversation parts before wasting time.

---

## Bill's Communication Style

When Bill says:
- **"stop!"** → You're going wrong, pause and listen
- **"NO!"** → Fundamental misunderstanding
- **"why are you asking this question"** → Answer should be obvious from data
- **"shouldn't this come from the molecule?"** → You're hardcoding instead of reading from data

**When you hear these → STOP and reconsider!**

---

## Key Commands & Shortcuts

**LONGORIA Command:**
When Bill says "LONGORIA this page":
1. Apply vertical spacing standards (6-8px padding)
2. Audit for molecule violations (no hardcoded values)
3. Verify back button exists
4. Apply scrollable list pattern if needed
(See WORKFLOW_STANDARDS for complete details)

**File Locations:**
- User uploads: `/mnt/user-data/uploads`
- Working directory: `/home/claude`
- Final outputs: `/mnt/user-data/outputs`

---

## Never Start Without Reading

- ❌ Don't write code before reading schema
- ❌ Don't make assumptions about columns
- ❌ Don't skip boot sequence
- ✅ Always use `ls -t` to find latest files
- ✅ Read WORKFLOW_STANDARDS completely
- ✅ Read SECRET_SAUCE completely

---

## Token Budget

- Total: 190,000 tokens
- Warning at 130k (68%): Wrap up soon
- Critical at 150k (79%): Create handoff NOW
- Emergency at 170k (89%): Minimal responses, handoff immediately

---

## Success Criteria

You're properly booted when:
- [x] Know current database schema
- [x] Understand core architectural principles
- [x] Know what's working and broken
- [x] Know next priority task
- [x] Understand Bill's communication style
- [x] Can answer: "What is Bill's favorite color?" (green)

**Now ready to work!**
