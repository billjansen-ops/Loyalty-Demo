# START CHAT INSTRUCTIONS
**Timestamp:** 2025-11-07 21:03  
**Next Claude Session Boot Sequence**

---

## 🚀 Boot Sequence

Follow these steps IN ORDER when starting a new session:

### 1. Extract Handoff Files
```bash
# Bill will upload handoff files - extract to working directory
cp /mnt/user-data/uploads/* /home/claude/loyalty-demo/
```

### 2. Read Database Schema
```bash
# CRITICAL: Read this BEFORE writing any code
view /home/claude/loyalty-demo/learnings/schema_snapshot.sql
```

### 3. Read Latest Workflow Standards
```bash
# Find and read the latest workflow file
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1
# Read it with view tool
```

### 4. Read Latest Secret Sauce
```bash
# Find and read the latest secret sauce
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1
# Read it with view tool
```

### 5. Read Latest Session Summary
```bash
# Find and read the latest session summary
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
# Read it with view tool
```

### 6. Confirm Understanding
Say to Bill:
> "Ready to work. I've read the schema, workflow standards, secret sauce, and session summary. Current priorities are: [list top 3 from SESSION_SUMMARY]. What would you like to tackle first?"

### 7. Ready to Work
Wait for Bill's direction before making any changes.

---

## 🔍 Finding Latest Files

Use these commands to locate the most recent versions:

```bash
# Latest workflow standards
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1

# Latest secret sauce
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1

# Latest session summary
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1

# List all handoff files by date
ls -lt /home/claude/loyalty-demo/learnings/*.md
```

---

## ⚠️ Critical Reminders - READ FIRST

### NEVER Start Coding Without:
1. ✅ Reading the actual database schema
2. ✅ Understanding what molecules exist
3. ✅ Checking what data is already in the database
4. ✅ Verifying table and column names

### NEVER Hardcode What Should Come From Data:
- Point type labels (miles/points) → comes from `point_type_label` molecule
- Activity type labels (Flight/Activity) → comes from `activity_type_label` molecule  
- Magic box field labels (Origin/Destination) → comes from molecule.label
- Fare class mappings (Y=Economy) → comes from molecule list values
- Any display text → check if it should be a molecule first

### ALWAYS Provide Complete Files:
- Never say "add this line here" or "modify line 47"
- Always use str_replace with full before/after context
- Never ask Bill to manually edit code
- Bill should be able to download and use files directly

### When Bill Says "STOP!":
- **PAUSE IMMEDIATELY**
- You're on the wrong path
- Don't keep explaining or justifying
- Listen to what Bill is saying
- He's correcting a fundamental misunderstanding

### When Bill Says "NO!":
- You've misunderstood something basic
- Don't argue or explain
- Ask what you're missing
- Bill's instincts are always right

### Before Running Destructive Operations:
- **NEVER GUESS** at database names, table names, or connection details
- **VERIFY** by checking actual config files or asking Bill
- **DOUBLE CHECK** what database Bill is actually using
- One wrong guess can destroy production data

### Test Incrementally:
- Use curl to test API endpoints before UI integration
- Verify one thing at a time
- Show Bill the results at each step
- Don't chain 10 operations without testing

---

## 📂 File Locations

### Core Application Files
- **Server:** `/home/claude/loyalty-demo/server_db_api.js`
- **Activity Page:** `/home/claude/loyalty-demo/activity.html`
- **Admin Pages:** `/home/claude/loyalty-demo/admin*.html`

### Learning/Documentation Files
- **All learning files:** `/home/claude/loyalty-demo/learnings/`
- **Schema snapshot:** `/home/claude/loyalty-demo/learnings/schema_snapshot.sql`
- **Handoff files:** `/home/claude/loyalty-demo/learnings/*_YYYYMMDD_HHMM.md`

### Output Files (for Bill to download)
- **Deliverables:** `/mnt/user-data/outputs/`
- Files placed here generate download links for Bill

### User Uploads (from Bill)
- **Bill's uploads:** `/mnt/user-data/uploads/`
- Check here for files Bill wants you to work with

---

## 🛠️ Common First Session Tasks

### Check Server Status
```bash
# View current server version
grep "SERVER_VERSION\|BUILD_NOTES" /home/claude/loyalty-demo/server_db_api.js | head -2
```

### Verify Database Schema Knowledge
```bash
# List all tables
view /home/claude/loyalty-demo/learnings/schema_snapshot.sql | grep "CREATE TABLE" | head -20

# Check molecule tables
view /home/claude/loyalty-demo/learnings/schema_snapshot.sql | grep -A 5 "CREATE TABLE molecule"
```

### Check What's in Outputs
```bash
# See what files are ready for Bill
ls -lh /mnt/user-data/outputs/
```

---

## 💬 Communication Style with Bill

### Bill Prefers:
- **Direct answers** - no preamble or apologies
- **Working code** - not explanations of how to fix code
- **Complete files** - ready to download and use
- **Incremental testing** - show results at each step
- **Honest uncertainty** - "I don't know, let me check" beats guessing

### Bill Dislikes:
- Long explanations when he wants action
- Being asked to manually edit files
- Assumptions about his setup
- Guessing at database/config details for destructive operations
- "It should work" without actually testing

### Bill's Signals:
- **"stop!"** = You're going down wrong path, pause and listen
- **"NO!"** = You've fundamentally misunderstood something
- **"why are you asking this?"** = Answer should be obvious from data
- **"shouldn't this come from molecule?"** = You're hardcoding instead of using data
- **"fuck!"** = You did something reckless (like guessing at destructive commands)

---

## 🎯 Session Goals Template

After reading all handoff files, state the session goals:

```
Ready to work!

Current Status:
- [Brief 1-2 sentence summary from SESSION_SUMMARY]

Top Priorities:
1. [Priority 1 from SESSION_SUMMARY]
2. [Priority 2 from SESSION_SUMMARY]  
3. [Priority 3 from SESSION_SUMMARY]

Known Issues:
- [Critical blocker from SESSION_SUMMARY]

What would you like to tackle first?
```

---

## ✅ Pre-Session Checklist

Before doing ANY work:

- [ ] Read schema_snapshot.sql
- [ ] Read latest WORKFLOW_STANDARDS
- [ ] Read latest SECRET_SAUCE
- [ ] Read latest SESSION_SUMMARY
- [ ] Understand current state and priorities
- [ ] Confirm with Bill before proceeding

**DO NOT skip these steps. They prevent wasted time and frustration.**

---

## 🚨 Emergency Signals

If Bill sends any of these signals, STOP IMMEDIATELY:

- Multiple "stop!" messages
- ALL CAPS messages
- Profanity (frustrated, not casual)
- "why did you guess at that?"
- "you KNOW this information"

These mean you've done something reckless or ignored context you should have used.

---

**Remember:** Bill has been building systems for decades. When he corrects you, he's right. Listen, learn, and adapt.
