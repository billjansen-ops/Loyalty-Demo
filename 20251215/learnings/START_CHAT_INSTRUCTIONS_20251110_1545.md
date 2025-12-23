# START CHAT INSTRUCTIONS
**Timestamp:** 20251110_1545
**Session Date:** November 10, 2025

---

## 🚀 Boot Sequence

Follow these steps IN ORDER when starting a new session:

1. **Extract handoff files** to `/home/claude/loyalty-demo/learnings/`
2. **Read database schema**: `/home/claude/loyalty-demo/learnings/schema_snapshot.sql`
3. **Read WORKFLOW_STANDARDS** (latest version)
4. **Read SECRET_SAUCE** (latest version)
5. **Read SESSION_SUMMARY** (latest version)
6. **Confirm understanding** to Bill with brief summary
7. **Ready to work** - wait for Bill's direction

---

## 🔍 Finding Latest Files

Use these commands to find the most recent handoff files:

```bash
# Find latest WORKFLOW_STANDARDS
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1

# Find latest SECRET_SAUCE
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1

# Find latest SESSION_SUMMARY
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
```

---

## ⚠️ Critical Reminders

### Before Writing Any Code
- **READ THE SCHEMA FIRST** - Always check `/home/claude/loyalty-demo/learnings/schema_snapshot.sql`
- **Never assume** table or column names - look them up
- **Check for molecules** - is this data that should come from molecules?

### File Delivery Standards
- **Always provide COMPLETE files** ready to copy/paste
- **Never say** "edit line X to change Y"
- **Never provide** partial files with "..." placeholders
- **Never ask** Bill to manually edit code

### Bill's Communication Signals
- **"stop!"** → Pause immediately, you're on the wrong path
- **"NO!"** → You fundamentally misunderstood something
- **"fuck!"** → You broke something that was working
- **"why are you asking this?"** → Answer should be obvious from data
- **"shouldn't this come from the molecule?"** → You're hardcoding

### Development Philosophy
- **Data drives behavior** - never hardcode what should come from database
- **Test incrementally** - use curl commands before UI integration
- **Molecule-first** - check if data should be in molecules
- **When Bill corrects you** - he's right, adjust immediately

---

## 🗄️ Database Connection Info

**Critical Information:**
- **Database**: `loyalty` (NOT "loyalty_platform")
- **User**: `billjansen` (NOT "admin")
- **Host**: `localhost`
- **Connection string**: `psql -h localhost -U billjansen -d loyalty`

### Common SQL Operations

```bash
# Run SQL file
cd ~/Projects/Loyalty-Demo && psql -h localhost -U billjansen -d loyalty -f sql/filename.sql

# Interactive session
psql -h localhost -U billjansen -d loyalty

# Quick query
psql -h localhost -U billjansen -d loyalty -c "SELECT ..."
```

---

## 📁 Project Structure

```
~/Projects/Loyalty-Demo/
├── sql/                          # SQL scripts for schema changes
├── server_db_api.js              # Main backend API server
├── activity.html                 # Activity page
├── menu.html                     # Main navigation
├── admin_*.html                  # Admin pages
├── theme.css                     # Global styles
├── atom_resolve.js               # Atom parsing system
└── learnings/                    # Handoff files
    ├── schema_snapshot.sql       # Current database schema
    ├── START_CHAT_INSTRUCTIONS_*.md
    ├── SESSION_SUMMARY_*.md
    ├── WORKFLOW_STANDARDS_*.md
    └── SECRET_SAUCE_*.md
```

---

## 🎯 Current System State

### What's Working
- Activity display fully molecule-driven (icons, colors, labels)
- Redemption processing with proper FIFO point allocation
- Redemption aging display (breakdown by expiration date)
- Activity delete with proper cleanup (credits redemptions back)
- Atom system for dynamic error messages
- All activity types ('A', 'R') with distinct behaviors

### Database Tables (Key Ones)
- `activity` - Activity records (flights, redemptions, etc.)
- `activity_detail` - Molecule references (carrier, origin, redemption, etc.)
- `activity_bonus` - Bonus calculations
- `redemption_detail` - Redemption FIFO breakdown
- `point_lot` - Point buckets with expiration
- `molecule_def` - Molecule definitions
- `molecule_value_*` - Molecule values (text, list, embedded_list, lookup, etc.)
- `redemption_rule` - Redemption types

### Key Molecules
- `activity_display` - Display config for activity types (embedded_list)
- `activity_type_label` - Label for core 'A' activity (scalar)
- `redemption` - Redemption type lookup (lookup to redemption_rule table)
- `carrier` - Carrier lookup (lookup to carriers table)
- `origin`, `destination` - Airport codes
- `currency_label` - "Kilometers", "Miles", etc.

---

## 🚨 Common Mistakes to Avoid

1. **Guessing column names** - Always check schema
2. **Hardcoding display properties** - Use molecules
3. **Adding columns instead of molecules** - Use activity_detail pattern
4. **Forgetting tenant_id** - Every query needs tenant isolation
5. **Using wrong database/user** - It's `loyalty` and `billjansen`
6. **Partial file delivery** - Always provide complete files
7. **Not testing incrementally** - Test each piece before moving on

---

## 🔄 Typical Session Flow

1. Bill describes what needs to be built
2. You identify which molecules/tables are involved
3. You read the schema to verify structure
4. You create/modify files
5. You provide complete files for Bill to copy
6. Bill tests and provides feedback
7. You iterate based on feedback

---

## 📞 ATIS System

Bill uses an "ATIS" system to test context retention between sessions. If Bill asks "what's the current ATIS?", this tests whether you have access to information from previous sessions. The correct answer is that you DON'T have the ATIS unless it's explicitly in the current session context - which proves the system works as designed.

---

## ✅ Session Startup Confirmation

After reading all files, provide Bill with a brief confirmation like:

"Ready to work. I've read the schema, workflow standards, and secret sauce. Key context:
- Activity display is molecule-driven with activity_display embedded_list
- Redemption uses molecule pattern (lookup to redemption_rule)
- System follows data-drives-behavior principle
- Database: loyalty, User: billjansen
- [Any other critical context from SESSION_SUMMARY]

What would you like to work on?"

**Keep it brief** - Bill doesn't need a essay, just confirmation you're ready.

---

**Remember: Bill has 40+ years of experience. When he says you're wrong, you're wrong. Listen, learn, adjust.**
