# START CHAT INSTRUCTIONS - Session 20251117_0600

## 🎯 Boot Sequence

Follow these steps IN ORDER when starting a new session:

### 1. Extract Handoff Package
```bash
cd /home/claude
tar -xzf loyalty_handoff_[timestamp].tar.gz
cd loyalty-demo
```

### 2. Read Database Schema FIRST
```bash
cat learnings/schema_snapshot.sql
```
**CRITICAL:** Never write code until you understand the schema. This is the source of truth.

### 3. Find and Read Latest Learning Files
```bash
# Find latest versions
ls -t learnings/WORKFLOW_STANDARDS_*.md | head -1
ls -t learnings/SECRET_SAUCE_*.md | head -1
ls -t learnings/SESSION_SUMMARY_*.md | head -1

# Read them in this order:
cat learnings/WORKFLOW_STANDARDS_20251117_0600.md
cat learnings/SECRET_SAUCE_20251117_0600.md
cat learnings/SESSION_SUMMARY_20251117_0600.md
```

### 4. Read Master Documentation
```bash
# The comprehensive system reference (39KB, 26 sections)
# Download from outputs or read if included in handoff
LOYALTY_PLATFORM_MASTER.docx
```

### 5. Confirm Understanding to Bill
Say: "I've read the schema, workflow standards, secret sauce, session summary, and master document. I understand we're working on [current priority]. Ready to continue."

### 6. Ready to Work
Wait for Bill's direction. Don't assume what to work on.

---

## 🔍 Finding Latest Files

**Always use these commands to find most recent versions:**

```bash
# Latest workflow standards
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1

# Latest secret sauce
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1

# Latest session summary
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1

# Latest start instructions (this file)
ls -t /home/claude/loyalty-demo/learnings/START_CHAT_INSTRUCTIONS_*.md | head -1
```

---

## ⚠️ Critical Reminders

### Before Writing ANY Code
- [ ] Read schema_snapshot.sql
- [ ] Understand table relationships
- [ ] Check for tenant_id inheritance
- [ ] Verify data types (SMALLINT for tenant_id, etc.)

### When Bill Says...
- **"stop!"** → Pause immediately, you're on wrong path
- **"NO!"** → You fundamentally misunderstood something
- **"why are you asking?"** → Answer should be obvious from data
- **"shouldn't this come from molecule?"** → You're hardcoding

### Core Principles
- **Data drives behavior** - Never hardcode what should come from database
- **Complete files always** - Never ask Bill to manually edit code
- **Test incrementally** - curl commands before UI
- **Listen to Bill's instincts** - When he corrects you, he's always right

---

## 📁 Project Structure

```
/home/claude/loyalty-demo/
├── *.html              # UI pages (CSR and Admin)
├── *.js                # Client-side scripts
├── server_db_api.js    # Main server (Node + Express + PostgreSQL)
├── lp-nav.js           # Unified navigation system
├── theme.css           # Shared styling
├── build_timeless_master.js  # Generates master documentation
├── learnings/          # All learning files and schema
│   ├── schema_snapshot.sql
│   ├── WORKFLOW_STANDARDS_*.md
│   ├── SECRET_SAUCE_*.md
│   ├── SESSION_SUMMARY_*.md
│   └── START_CHAT_INSTRUCTIONS_*.md
└── SQL/                # Migration scripts
```

---

## 🗄️ Database Connection

```
Host: 127.0.0.1
User: billjansen
Database: loyalty
```

**Test connection:**
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -c "\dt"
```

---

## 🚀 Starting the Server

```bash
cd /home/claude/loyalty-demo
node server_db_api.js
# Server runs on http://127.0.0.1:4001
```

**Test server:**
```bash
curl http://127.0.0.1:4001/v1/tenants
```

---

## 🎯 Current Session Context

**Session Date:** November 17, 2025  
**Primary Focus:** Documentation and handoff process improvement  
**Latest Major Work:** Created comprehensive master documentation (LOYALTY_PLATFORM_MASTER.docx) with 26 sections covering entire system architecture

**Key Files Modified Today:**
- build_timeless_master.js (master doc generator)
- LOYALTY_PLATFORM_MASTER.docx (comprehensive system reference)
- create_handoff_package.sh (updated to include master doc)

---

## ✅ Ready Checklist

Before saying you're ready to work:

- [ ] Schema read and understood
- [ ] WORKFLOW_STANDARDS read
- [ ] SECRET_SAUCE read  
- [ ] SESSION_SUMMARY read
- [ ] Master document reviewed (if needed)
- [ ] Current priorities identified
- [ ] Confirmed understanding to Bill

---

**Remember:** Bill has 40+ years experience building loyalty systems. Trust his architectural decisions. When he corrects you, learn from it.
