# START CHAT INSTRUCTIONS

**Timestamp:** 20251115_2345

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

## 🚨 Critical Reminders

**BEFORE WRITING ANY CODE:**
- Read the schema (/home/claude/loyalty-demo/learnings/schema_snapshot.sql)
- Understand the molecule system architecture
- Check what tables/fields actually exist
- Never assume - always verify

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

## 🏗️ Current Architecture Context

**Loyalty Platform Features:**
- Multi-tenant, multi-industry molecule system
- Bonus evaluation engine with temporal-first design
- Member management with tier progression
- Activity tracking and display templates
- Admin tools for CSR/program management

**Recent Developments:**
- State molecule with bidirectional text_value/display_label conversion
- Address field optimization (char(2) for state, char(5) for ZIP, char(4) for ZIP+4)
- Enhanced encodeMolecule/decodeMolecule with 4th parameter support
- State dropdown implementation for profile page (needs testing)

**Database:**
- PostgreSQL with multi-tenant isolation
- Molecule-driven configuration system
- Temporal point balance tracking
- Activity detail storage with molecule references

**API Server:**
- Node.js Express server on port 4001
- Molecule encode/decode endpoints
- Member profile CRUD operations
- Bonus evaluation endpoints
- Admin molecule management

Bill has 40+ years experience in loyalty systems and emphasizes data-driven architecture over hardcoded logic. He gets frustrated when you guess instead of checking actual data, and when you don't follow basic software development practices like updating version numbers automatically.
