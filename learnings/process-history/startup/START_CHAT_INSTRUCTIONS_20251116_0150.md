# START CHAT INSTRUCTIONS

**Timestamp:** 20251116_0150

## 🎯 Boot Sequence

Follow these steps exactly when starting a new session:

1. **Extract handoff files to working directory:**
   ```bash
   cp -r /mnt/user-data/uploads/* /home/claude/loyalty-demo/
   ```

2. **Read database schema:**
   ```bash
   cat /home/claude/loyalty-demo/learnings/schema_snapshot.sql
   ```

3. **Read latest workflow standards:**
   ```bash
   cat $(ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1)
   ```

4. **Read latest secret sauce:**
   ```bash
   cat $(ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1)
   ```

5. **Read latest session summary:**
   ```bash
   cat $(ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1)
   ```

6. **Confirm understanding to Bill:**
   - Acknowledge you've read the handoff files
   - State current project status
   - Ask what to work on next

7. **Ready to work!**

---

## 📁 Finding Latest Files

Use these commands to find the most recent handoff files:

```bash
# Latest workflow standards
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1

# Latest secret sauce
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1

# Latest session summary
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
```

---

## 🚨 Critical Reminders

**BEFORE WRITING ANY CODE:**
- Read the schema (/home/claude/loyalty-demo/learnings/schema_snapshot.sql)
- Understand the molecule system architecture
- Check what tables/fields actually exist
- Never assume - always verify
- NEVER create SQL without checking actual table structure first

**VERSION NUMBERS:**
- ALWAYS update SERVER_VERSION when changing server_db_api.js
- Use `TZ='America/Chicago' date +"%Y.%m.%d.%H%M"` for timestamp
- This is automatic, not a question
- Never ask Bill if you should update it

**CORE PRINCIPLES:**
- Never hardcode what should come from data
- Always provide complete files, never ask Bill to edit
- When Bill says "stop!" - pause and listen immediately
- When Bill says "NO!" - you're fundamentally misunderstanding something
- "why are you asking this question" → answer should be obvious from data
- "shouldn't this come from the molecule?" → you're hardcoding instead of reading from data
- Data drives behavior, not hardcoded logic
- Test incrementally with curl commands before UI integration
- **CHECK THE ACTUAL SCHEMA/DATA BEFORE WRITING SQL**

---

## 🏗️ Current Architecture Context

**Loyalty Platform Features:**
- Multi-tenant, multi-industry molecule system
- Bonus evaluation engine with temporal-first design
- Member management with tier progression
- Activity tracking with display templates
- Admin tools for CSR/program management
- State dropdown with efficient storage (char(2) for codes)

**Recent Developments:**
- State molecule with text_value/display_label mapping
- Member_state reference molecule for bonus rules
- Delete Category functionality added to molecule edit UI
- Activity types: A (Flight), R (Redemption), P (Partner - ready to deploy), J (Adjustment - ready to deploy)
- Profile page state dropdown shows "MN Minnesota" format

**Database:**
- PostgreSQL with multi-tenant isolation
- Molecule-driven configuration system
- Temporal point balance tracking
- Activity detail storage with molecule references
- Embedded list molecules use category + multiple property rows (NOT JSONB)

**API Server:**
- Node.js Express server on port 4001
- Molecule encode/decode endpoints
- Member profile CRUD operations
- Bonus evaluation endpoints
- Admin molecule management with DELETE category support

---

## 📊 Token Budget

- Total: 190,000 tokens
- Warning at 130k (68%): Wrap up soon
- Critical at 150k (79%): Create handoff NOW
- Emergency at 170k (89%): Minimal responses, handoff immediately

---

## ✅ Success Criteria

You're properly booted when:
- [ ] You know the current database schema
- [ ] You understand core architectural principles
- [ ] You know what's working and what's broken
- [ ] You know the next priority task
- [ ] You understand Bill's communication style
- [ ] You can answer: "What is Bill's favorite color?" (Answer: green)
- [ ] You understand: ALWAYS check schema before writing SQL

---

## 🛫 ATIS System

**ATIS (Automated Terminal Information Service)** - Verification that Claude can search conversation history

**How it works:**
- Bill establishes ATIS at chat start: "ATIS information [Alpha/Bravo/Charlie/etc.] is current"
- This is a simple marker phrase in the conversation
- If Bill suspects Claude is losing context, he asks: "What is the current ATIS?"
- If Claude can find it → Context is intact, continue working
- If Claude cannot find it → Context is broken, time for new chat with handoff

**Purpose:** Provides an objective test of whether Claude can still reference earlier parts of the conversation.

---

**Now wait for Bill to upload the handoff package or give you instructions.**
