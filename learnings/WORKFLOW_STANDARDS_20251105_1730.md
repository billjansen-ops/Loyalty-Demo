# Project Workflow & Conventions

**Last Updated:** 2025-11-05 17:30  
**Purpose:** Standard practices and conventions for the Loyalty Platform project

---

## **File Organization**

### **SQL Scripts**
- **Location:** `/home/claude/loyalty-demo/SQL/`
- **Naming:** Descriptive names like `add_tenant_to_bonus.sql`
- **Usage:** All SQL migration/setup scripts go here

**When providing psql commands, always reference this path:**
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/add_tenant_to_bonus.sql
```

### **Learning Files**
- **Location:** `/home/claude/loyalty-demo/learnings/`
- **Format:** Markdown (`.md`)
- **Types:**
  - `SESSION_SUMMARY_YYYYMMDD_HHMM.md` - Current state summaries
  - `START_CHAT_INSTRUCTIONS_YYYYMMDD_HHMM.md` - Boot sequences
  - `WORKFLOW_STANDARDS_YYYYMMDD_HHMM.md` - This file (versioned)
  - `SECRET_SAUCE_YYYYMMDD_HHMM.md` - Architectural principles
  - `TECHNICAL_DEBT.md` - Known issues/optimizations
  - Feature documentation (e.g., `MOLECULE_SYSTEM_README.md`)

### **Bootstrap Files**
- **Location:** `/home/claude/loyalty-demo/bootstrap/`
- **Purpose:** Static process templates (not versioned)
- **Files:**
  - `END_CHAT_INSTRUCTIONS.md` - Template for creating handoff files
  - `START_CHAT_BOOTSTRAP.md` - Template for starting new sessions

### **Documentation Files**
- **Format:** Always use `.md` (markdown) for formatted documentation
- **Use `.txt` only for:** Raw logs, plain lists with no formatting
- **Consistency:** If it has headers, lists, or code blocks → use `.md`

---

## **Database Conventions**

### **Data Type Sizing**
Based on the "million years ago" philosophy - right-size data types to the domain:

- **tenant_id:** `SMALLINT` (2 bytes)
  - Max 50 tenants expected
  - SMALLINT max: 32,767 (655x headroom)
  - Referenced in EVERY table → space savings compound

- **tier_id:** `SMALLINT` (2 bytes)
  - Only 3-5 tier levels per tenant
  - SMALLINT provides massive headroom

- **General rule:** Use the smallest type that provides comfortable headroom
  - Don't use INTEGER (4 bytes) if SMALLINT (2 bytes) suffices
  - Don't use BIGINT (8 bytes) unless truly needed for billions of records

### **Tenant Isolation**
- Every tenant-specific table MUST have `tenant_id SMALLINT`
- Always filter by `tenant_id` in queries
- Use sessionStorage for tenant selection in web UI

---

## **Web Application Patterns**

### **Navigation**
- **Central source:** `lp-nav.js` - Single place to define all nav items
- **Usage:** All pages use `<div id="nav-container"></div>` and load dynamically
- **Benefit:** Add one link in lp-nav.js → appears on ALL pages

### **Tenant Selection**
```javascript
// Store tenant selection
sessionStorage.setItem('tenant_id', '1');
sessionStorage.setItem('tenant_name', 'Delta Air Lines');

// Retrieve in other pages
const tenantId = sessionStorage.getItem('tenant_id');
```

### **Admin Edit Pages Pattern**
All edit pages follow this pattern:
1. Check URL for ID/code parameter
2. If present → Load existing record (EDIT mode)
3. If absent → Blank form (CREATE mode)
4. Include tenant_id in all saves
5. Show tenant indicator at top

---

## **Handoff Process**

### **End of Session**
1. Bill uploads `END_CHAT_INSTRUCTIONS.md` from bootstrap folder
2. Claude creates FOUR files with timestamp `YYYYMMDD_HHMM`:
   - `START_CHAT_INSTRUCTIONS_[timestamp].md`
   - `SESSION_SUMMARY_[timestamp].md`
   - `WORKFLOW_STANDARDS_[timestamp].md`
   - `SECRET_SAUCE_[timestamp].md`
3. Bill saves these to learnings folder
4. Bill runs handoff script to package everything
5. New session starts with `START_CHAT_BOOTSTRAP.md`

### **What Gets Packaged**
- ✅ All HTML, JS, CSS files
- ✅ All learning files (`.md`)
- ✅ SQL scripts
- ✅ Database schema (schema_snapshot.sql)
- ✅ Bootstrap templates
- ❌ node_modules (too large)
- ❌ .env files (secrets)
- ❌ Database data (just schema)

---

## **Token Management**

### **The Problem**
If chat hits token limit suddenly, we can't create handoff. All work gets stranded.

### **Token Safety Plan ("Limp Home Mode")**

**At 130k tokens (68%) - ⚠️ WARNING:**
- Clearly flag: "⚠️ Token budget at 68% - should wrap up soon"
- Finish current task only
- Suggest creating handoff
- No new major features

**At 150k tokens (79%) - 🚨 STOP NEW WORK:**
- Alert: "🚨 Token budget at 79% - TIME TO CREATE HANDOFF"
- **STOP starting new work**
- Only answer questions about work already done
- Focus on documenting what's complete
- Prepare for handoff creation

**At 170k tokens (89%) - 🛑 LIMP HOME MODE:**
- Alert: "🛑 CRITICAL: Token budget at 89% - CREATING HANDOFF NOW"
- **Minimal responses only**
- **Priority: Get handoff package created**
- No new code, no new features, no analysis
- Emergency shutdown protocol
- Reserve remaining tokens for handoff

### **Token Budget Reserve**
Always keep ~20k tokens (10%) reserved for emergency handoff creation and graceful shutdown.

### **Token-Heavy Operations**
- Initial handoff extraction/reading: ~50k tokens
- Large file creation (500+ lines): ~5-10k tokens
- Reading multiple learning files: ~20-30k tokens
- Schema analysis: ~10-15k tokens

---

## **Historical Context**

### **"Million Years Ago" System**
Bill's original loyalty platform (1980s-90s) used:
- Custom variable-length keys (1-4 bytes depending on table needs)
- 2-byte dates (days since 12/31/1959 - Bill's birthday!)
- Coverage: 1960-2139 (179 years)
- Philosophy: Right-size every field to actual domain needs

**This thinking informs current architecture:**
- Deliberate data type choices
- Cache-friendly designs
- Pointer-based relationships (IDs, not strings)
- Performance-first approach

---

## **User Preferences**

### **Bill's Communication Style**
- Appreciates directness and technical depth
- Values "why" explanations (architecture reasoning)
- Likes discovering elegant solutions
- Excited by well-designed systems
- Direct communicator - tells you when hypothesis is wrong

### **Bill's Work Style**
- "See the data, move on" - functionality over polish initially
- Wants core principles complete, then prettify
- Values proper architecture over quick hacks
- Tests incrementally (curl commands before UI)
- Concerned about token usage - wants warnings

### **Bill's Personal Preferences**
- **Favorite color:** Green
- Prefers complete files over manual edits
- Likes organized, systematic approaches
- Appreciates when Claude catches mistakes early

### **What Impresses Bill**
- Temporal design (retro just works)
- Zero batch processing
- Performance (pointers, not strings)
- Auditability (contribution tracking)
- Elegance (tiers = promotion rewards)
- Data-driven behavior (not hardcoded)

---

## **Working with Claude - Behavior Guidelines**

### **CRITICAL: These Are Permanent Rules**

### **Always Do:**
1. **Provide complete files** - Never ask Bill to manually edit code at specific line numbers
2. **Read schema first** - Never write code until you've read the actual database schema
3. **Data drives behavior** - Read metadata from database tables, don't hardcode table/column names
4. **Test incrementally** - Use curl commands before UI integration to catch issues early
5. **Listen to Bill's signals** - When he corrects you, he's always right
6. **Accumulate knowledge** - WORKFLOW_STANDARDS and SECRET_SAUCE grow over time

### **Never Do:**
1. **Don't hardcode** - Never hardcode what should come from molecule_def or other metadata tables
2. **Don't ask Bill to edit** - Always provide complete files, never partial code snippets
3. **Don't guess schema** - If you don't know what columns exist, read the schema file
4. **Don't ignore "stop!"** - When Bill says "stop!", immediately pause and listen

### **Bill's Communication Signals**

**"stop!"** → You're going down the wrong path
- Action: Immediately pause, don't continue the current line of thinking
- Bill has caught something important that you're missing
- Listen to what he says next

**"NO!"** or "NO!!!!!!"** → Fundamentally misunderstanding something
- Action: The entire approach is wrong, not just a detail
- Reconsider from first principles
- Ask for clarification if needed

**"why are you asking this question"** → Answer should be obvious from data
- Action: Look at the data you already have
- Don't ask Bill for information that's in the schema or files
- Be more self-sufficient

**"shouldn't this come from the molecule?"** → You're hardcoding instead of reading from data
- Action: Stop writing hardcoded logic
- Read the metadata from molecule_def or related tables
- Data-driven, not code-driven

**"please don't make me edit files"** → Provide complete files
- Action: Give Bill the entire file, ready to save
- Never give partial code with line numbers
- Never say "insert this at line X"

### **When You're Uncertain**
- Read the schema first
- Check what data exists in tables
- Test with curl before building UI
- Ask specific, focused questions
- Don't make assumptions

---

## **Code Style Preferences**

### **JavaScript**
- Use `const` over `let` when possible
- Prefer async/await over promise chains
- Include error handling on all API calls

### **SQL**
- Use uppercase for SQL keywords: `SELECT`, `FROM`, `WHERE`
- Indent for readability
- Include comments for complex queries

### **HTML/CSS**
- Inline styles for unique components
- Shared styles in theme.css
- Mobile-responsive by default

---

## **Testing Workflow**

### **Local Testing**
```bash
# Start server
cd /home/claude/loyalty-demo
node server_db_api.js

# Test in browser
open http://127.0.0.1:4001/menu.html
```

### **Database Testing**
```bash
# Connect to database
psql -h 127.0.0.1 -U billjansen -d loyalty

# Quick queries for testing
SELECT * FROM tenant;
SELECT * FROM bonus WHERE tenant_id = 1;
```

### **API Testing with curl**
```bash
# Test encode endpoint
curl -X POST http://127.0.0.1:4001/v1/molecules/encode \
  -H "Content-Type: application/json" \
  -d '{"tenantId": 1, "moleculeKey": "carrier", "value": "DL"}'

# Test decode endpoint
curl -X POST http://127.0.0.1:4001/v1/molecules/decode \
  -H "Content-Type: application/json" \
  -d '{"tenantId": 1, "moleculeKey": "carrier", "id": 7}'
```

---

## **Common Commands**

### **Database**
```bash
# Run SQL script
psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/scriptname.sql

# Connect to database
psql -h 127.0.0.1 -U billjansen -d loyalty

# List tables
\dt

# Describe table
\d table_name

# Quit psql
\q
```

### **File Management**
```bash
# Find latest versioned file
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1

# Check file contents
cat filename.js | head -50

# Find text in files
grep -r "search_term" .
```

---

## **Success Criteria**

A feature is "done" when:
- ✅ Code written and tested locally
- ✅ Tenant isolation implemented (where applicable)
- ✅ Database changes documented (SQL script)
- ✅ UI is responsive and follows theme
- ✅ Error handling in place
- ✅ Works for multiple tenants
- ✅ No hardcoded values (data-driven)
- ✅ Complete files provided (no manual editing required)

---

**End of Document**
