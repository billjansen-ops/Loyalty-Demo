# START CHAT INSTRUCTIONS - November 5, 2025 17:30

## 🎯 Boot Sequence

Follow these steps in exact order:

### Step 1: Extract Handoff
```bash
cd /home/claude
tar -xzf /mnt/user-data/uploads/loyalty_handoff_*.tar.gz
# If extracted folder name differs, rename to loyalty-demo
mv loyalty_handoff_* loyalty-demo 2>/dev/null || true
```

### Step 2: Read Database Schema
```bash
# View the complete database schema
view /home/claude/loyalty-demo/learnings/schema_snapshot.sql
```

**Critical:** This is a 2,353 line pg_dump. Understand the table structures before writing any code.

### Step 3: Read WORKFLOW_STANDARDS (Latest)
```bash
# Find and read the most recent WORKFLOW_STANDARDS
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1
```

This tells you HOW we work together - conventions, preferences, and behavioral guidelines.

### Step 4: Read SECRET_SAUCE (Latest)
```bash
# Find and read the most recent SECRET_SAUCE
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1
```

This tells you WHY the architecture is designed this way - the core principles and innovations.

### Step 5: Read SESSION_SUMMARY (Latest)
```bash
# Find and read the most recent SESSION_SUMMARY
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
```

This tells you WHERE we are - current state, what's working, what's broken, what's next.

### Step 6: Confirm Understanding
Tell Bill:
"Boot sequence complete. I have read:
- Database schema (schema_snapshot.sql)
- WORKFLOW_STANDARDS_20251105_1730.md
- SECRET_SAUCE_20251105_1730.md  
- SESSION_SUMMARY_20251105_1730.md

[Brief summary of current state and next priorities]

Ready to work."

---

## 🔍 Finding Latest Files

Always use this pattern to find the most recent version of any file:
```bash
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
```

The `-t` flag sorts by modification time (newest first). The `| head -1` takes only the most recent.

---

## 🚨 Critical Reminders - Read This Every Session

### NEVER Write Code Until:
- ✅ You've read the database schema
- ✅ You understand which columns exist in which tables
- ✅ You know the molecule architecture
- ✅ You've read the current SESSION_SUMMARY

### ALWAYS:
- Provide complete files - never ask Bill to manually edit code at specific lines
- Let data drive behavior - read metadata from database tables, don't hardcode
- Test incrementally with curl commands before UI integration
- Listen when Bill says "stop!" - you're going down the wrong path

### NEVER:
- Hardcode table names or column names that should come from molecule_def
- Ask Bill to edit files manually (provide complete files)
- Guess what columns exist (read the schema)
- Ignore Bill when he says "stop!" or "NO!"

---

## 📊 Key File Locations

**Database Schema:**
- `/home/claude/loyalty-demo/learnings/schema_snapshot.sql` (2,353 lines)

**Working Directory:**
- `/home/claude/loyalty-demo/` - All project files

**SQL Scripts:**
- `/home/claude/loyalty-demo/SQL/` - All migration scripts

**Learning Files:**
- `/home/claude/loyalty-demo/learnings/` - All documentation

**Server:**
- `server_db_api.js` - Main API server (Express, port 4001)

---

## 💡 Quick Reference

**Database:** PostgreSQL, host: 127.0.0.1, user: billjansen, db: loyalty

**Key Tables:**
- `molecule_def` - Parent table defining all molecules
- `molecule_value_lookup` - Metadata for lookup-type molecules
- `molecule_value_text`, `_numeric`, `_date`, `_boolean` - Values for scalar molecules
- `molecule_value_ref` - List-type molecule options
- `molecule_text_pool` - Text deduplication
- `activity_detail` - Transactional molecule values
- `activity`, `member`, `bonus`, `carriers`, `airports`, etc.

**Current Focus:** Molecule encode/decode system

---

## 🎯 Success Criteria

You're properly booted when you can answer:
1. What is Bill's favorite color? (green)
2. What are the four core architectural principles?
3. What's currently broken and blocking progress?
4. What's the next priority task?
5. Where is metadata stored for lookup-type molecules? (molecule_value_lookup table)

---

**Now proceed with Step 1 of the boot sequence above.**
