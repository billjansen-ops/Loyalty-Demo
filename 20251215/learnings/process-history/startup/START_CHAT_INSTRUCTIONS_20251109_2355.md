# START CHAT INSTRUCTIONS
**Created:** November 9, 2025 11:55 PM
**For:** Next Claude session on Loyalty Platform IV

---

## 🎯 Boot Sequence

Follow these steps IN ORDER when starting a new session:

1. **Extract handoff files** to `/home/claude/loyalty-demo/learnings/`
2. **Read the database schema**: `/home/claude/loyalty-demo/learnings/schema_snapshot.sql`
3. **Read WORKFLOW_STANDARDS** (find latest):
   ```bash
   ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1
   ```
4. **Read SECRET_SAUCE** (find latest):
   ```bash
   ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1
   ```
5. **Read SESSION_SUMMARY** (find latest):
   ```bash
   ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
   ```
6. **Confirm understanding** to Bill: "Ready. I've read the schema, workflow standards, secret sauce, and session summary."
7. **Wait for Bill's direction** - don't start coding until he tells you what to work on

---

## 🔍 Finding Latest Files

Use these exact commands:

```bash
# Find latest workflow standards
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1

# Find latest secret sauce
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1

# Find latest session summary
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1

# Find latest schema
ls -t /home/claude/loyalty-demo/learnings/schema_snapshot.sql | head -1
```

---

## ⚠️ CRITICAL REMINDERS

### Before Writing ANY Code:
1. **Read the actual database schema** - don't assume structure
2. **Check if it should come from data** - molecules, lookups, etc.
3. **Never hardcode** what should come from the database
4. **Provide complete files** - never ask Bill to manually edit code
5. **Test incrementally** - use curl commands before UI integration

### When Bill Says:
- **"stop!"** → Pause immediately, you're on the wrong path
- **"NO!"** → You're fundamentally misunderstanding something
- **"why are you asking this?"** → Answer should be obvious from data
- **"shouldn't this come from the molecule?"** → You're hardcoding instead of using data
- **"focus!"** → You're overcomplicating or missing the point

### Core Philosophy:
- **Data drives behavior** - not hardcoded logic
- **Everything is pointers** - for performance
- **Temporal-first** - dates and time windows are primary
- **Industry-agnostic** - molecules make it universal

---

## 🗂️ Project Structure

```
/home/claude/loyalty-demo/
├── server_db_api.js          # Main API server
├── *.html                     # UI pages
├── *.js                       # Client-side JavaScript
├── theme.css                  # Global styles
└── learnings/                 # Handoff files and documentation
    ├── schema_snapshot.sql
    ├── START_CHAT_INSTRUCTIONS_*.md
    ├── SESSION_SUMMARY_*.md
    ├── WORKFLOW_STANDARDS_*.md
    └── SECRET_SAUCE_*.md
```

---

## 🚀 Quick Reference

### Server Control
```bash
# Start server
cd /home/claude/loyalty-demo
node server_db_api.js

# Server will show:
# Listening on: http://127.0.0.1:4001
# Database: CONNECTED
```

### Database Access
```bash
# Connect to database
psql -h localhost -U admin -d loyalty_platform

# Common queries
SELECT * FROM tenant;
SELECT * FROM molecule_def WHERE tenant_id = 1;
SELECT * FROM activity WHERE member_id = '2153442807' ORDER BY activity_date DESC LIMIT 10;
```

### Testing Endpoints
```bash
# Test member search
curl "http://127.0.0.1:4001/v1/members?q=2153442807"

# Test activities
curl "http://127.0.0.1:4001/v1/member/2153442807/activities?tenant_id=1"

# Test error messages
curl "http://127.0.0.1:4001/v1/errors/E003?tenant_id=1"
```

---

## 📋 Current System Status

### ✅ Working Systems
- Member search and CSR console
- Activity display with flights and redemptions
- Redemption processing with FIFO point allocation
- Bonus engine
- Error message system with atom resolution
- Display templates with molecule-driven rendering
- Point summary (buckets)
- Tier history

### 🚧 In Progress
- Redemption magic_box details (needs redemption_rule_id column in activity table)

### 🎯 Key Innovations
- **Atom System**: Dynamic text substitution with `{{M,molecule_key,field,length,case}}` syntax
- **Error Message System**: All errors (E001, E002, E003) use `getErrorMessage()` helper with atom resolution
- **LONGORIA Protocol**: UI spacing and consistency standards (6-8px spacing)
- **Molecule Architecture**: Industry-agnostic data-driven configuration

---

## 💡 Bill's Background

- 40+ years software architecture experience
- Built loyalty systems "million years ago" with custom optimizations
- Focuses on: right-sized data types, pointer-based designs, performance
- Communication style: direct, gets frustrated with repetitive questions
- When he says something is wrong, he's right - listen and adjust

---

## 🎬 Ready to Start?

Once you've read all the files and understand the system state, tell Bill:

"Ready. I've read the schema, workflow standards, secret sauce, and session summary. What would you like to work on?"

Then wait for his direction.
