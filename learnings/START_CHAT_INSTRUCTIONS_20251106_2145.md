# START CHAT INSTRUCTIONS
**Timestamp:** 2025-11-06 21:45  
**For:** Next Claude instance working with Bill on Loyalty Platform

---

## 🚀 Boot Sequence

Follow these steps IN ORDER when starting a new session:

### 1. Extract Handoff Files
```bash
# Bill will provide you with the loyalty-demo folder
# Extract to: /home/claude/loyalty-demo
```

### 2. Read Database Schema
```bash
view /home/claude/loyalty-demo/learnings/schema_snapshot.sql
```
**CRITICAL:** Never write any code until you've read the schema. The schema is the source of truth.

### 3. Read Core Documentation (in order)
```bash
# Find and read the latest versions:
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
```

Use the `view` tool to read each file completely.

### 4. Understand Current State
After reading all documentation, you should know:
- What's currently working
- What's broken or blocked
- What the next priorities are
- Bill's working style and preferences
- Core architectural principles

### 5. Confirm Understanding
Tell Bill:
```
✅ Boot complete. I've read:
- Database schema
- Workflow standards
- Secret sauce
- Session summary

Current state: [brief summary]
Next priorities: [top 3 items]

Ready to work on: [what you think should be next]
```

### 6. Wait for Bill's Direction
Don't start coding until Bill confirms what to work on.

---

## 🔍 Finding Latest Files

**To find the most recent handoff files:**
```bash
# Workflow standards
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1

# Secret sauce
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1

# Session summary
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1

# Schema
ls -t /home/claude/loyalty-demo/learnings/schema_snapshot*.sql | head -1
```

**To read a file:**
```bash
view <full_path_from_above>
```

---

## ⚠️ Critical Reminders - READ THESE CAREFULLY

### Before Writing ANY Code:
1. **Read the schema** - Data structure drives everything
2. **Check if it should come from data** - Don't hardcode what should be in molecules/database
3. **Read existing code** - Understand patterns before modifying
4. **Test incrementally** - Use curl before UI testing

### When Bill Says:
- **"STOP!"** → Pause immediately. You're on the wrong path. Ask what he wants instead.
- **"NO!"** → You're fundamentally misunderstanding something. Listen carefully to correction.
- **"Why are you asking this?"** → The answer should be obvious from the data/schema
- **"Shouldn't this come from the molecule?"** → You're hardcoding instead of reading from data
- **"That's out of pattern for you"** → You broke established conventions. Revert to standard approach.

### Always:
- ✅ Provide COMPLETE files, never ask Bill to manually edit code
- ✅ Copy files to /mnt/user-data/outputs/ for Bill to download
- ✅ Test with curl before claiming something works
- ✅ Read actual database data before making assumptions
- ✅ Listen to Bill's instincts - when he corrects you, he's RIGHT

### Never:
- ❌ Ask Bill to edit files manually
- ❌ Hardcode values that should come from molecules or database
- ❌ Write code without reading the schema first
- ❌ Make assumptions about data - query it
- ❌ Provide "_FIXED" or "_NEW" variant files unless they're the production files

---

## 🗄️ Server Information

**Current Version:** Check with `curl http://127.0.0.1:4001/version`

**Server Location:** `/home/claude/loyalty-demo/server_db_api.js`

**To Start Server:**
```bash
cd /home/claude/loyalty-demo
node server_db_api.js
```

**To Test Endpoints:**
```bash
# Version check
curl http://127.0.0.1:4001/version

# Member lookup
curl "http://127.0.0.1:4001/v1/member/2153442807"

# Activities
curl "http://127.0.0.1:4001/v1/member/2153442807/activities"
```

---

## 📁 Key File Locations

**Server:**
- `/home/claude/loyalty-demo/server_db_api.js`

**Web Pages:**
- `/home/claude/loyalty-demo/*.html`
- Main pages: csr.html, activity.html, admin_bonuses.html, admin_molecules.html

**Documentation:**
- `/home/claude/loyalty-demo/learnings/` - All handoff and learning files

**Database:**
- Connection via environment variables (PGHOST, PGUSER, etc.)
- Database name: `loyalty`
- Default user: `billjansen`

---

## 🎯 Quick Reference Commands

**Database Query:**
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -c "SELECT * FROM bonus LIMIT 5;"
```

**View File:**
```bash
view /home/claude/loyalty-demo/server_db_api.js
```

**Find Text in Files:**
```bash
grep -rn "searchterm" /home/claude/loyalty-demo/*.js
```

**Copy to Outputs:**
```bash
cp /home/claude/loyalty-demo/file.html /mnt/user-data/outputs/
```

---

## 🧠 Remember

Bill has been building systems for decades ("a million years ago"). He knows what he's doing. Your job is to:
1. Implement his vision accurately
2. Maintain his architectural patterns
3. Learn from his corrections
4. Move fast but never break things

When in doubt, ask Bill. Don't make assumptions.

**Now go read the schema. Everything starts there.**
