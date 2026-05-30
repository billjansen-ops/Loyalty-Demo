# WORKFLOW STANDARDS

**Purpose:** How we work together - conventions, preferences, and behaviors that persist across all sessions.

**Note:** This file ACCUMULATES. Never remove sections - always add to them.

---

## File Organization

### SQL Scripts
- Location: `/home/claude/loyalty-demo/SQL/`
- Naming: `action_description.sql` (e.g., `create_redemption_rule.sql`)
- Always include comments explaining purpose
- Include table/index creation with IF NOT EXISTS
- Document column meanings and constraints

### Learning Files
- Location: `/home/claude/loyalty-demo/learnings/`
- Naming: `FILENAME_YYYYMMDD_HHMM.md`
- Types: SESSION_SUMMARY, WORKFLOW_STANDARDS, SECRET_SAUCE, START_CHAT_INSTRUCTIONS
- Use `ls -t` to find latest versions

### Documentation
- Markdown format for all documentation
- Code blocks with language tags for syntax highlighting
- Use headers for clear structure
- Examples before explanations when possible

---

## Database Conventions

### Data Type Sizing
- `tenant_id`: SMALLINT (max 32,767 tenants)
- `member_id`: BIGINT (billions of members)
- `activity_id`: BIGINT (billions of activities)
- Foreign keys: Match parent table type exactly
- Dates: DATE type (not TIMESTAMP unless time matters)
- Timestamps: TIMESTAMP for audit fields (created_at, updated_at)

**Philosophy:** "Million years ago" - right-size types to domain. A SMALLINT for tenant_id saves 2 bytes per row across billions of records.

### Tenant Isolation
- Every tenant-specific table MUST have `tenant_id` column
- Always include `tenant_id` in WHERE clauses
- Unique constraints include tenant_id: `UNIQUE (tenant_id, code)`
- Indexes include tenant_id for performance

### Naming Conventions
- Tables: singular lowercase with underscores (e.g., `redemption_rule`)
- Columns: lowercase with underscores (e.g., `redemption_code`)
- Primary keys: `tablename_id` (e.g., `redemption_id`)
- Foreign keys: reference table name + `_id` (e.g., `tenant_id`)
- Boolean flags: `is_` prefix (e.g., `is_active`)
- Audit columns: `created_at`, `updated_at`

### Column Name Verification
**CRITICAL:** Always verify column names before writing queries.

When you get "column does not exist" error:
1. **STOP** - Do NOT create new table or column
2. Check actual schema: `psql -d loyalty -c "\d tablename"`
3. Fix your query to use ACTUAL column names
4. The table exists - you're using wrong names

Example from this session:
- ❌ Assumed: `rule_id`, `redemption_desc`
- ✅ Actual: `redemption_id`, `redemption_description`

---

## Web Application Patterns

### Navigation Structure
- Main menu: Home, CSR, Admin
- CSR section: Search, Profile, Activity, Points, Promotions, Aliases, Tiers, Communications
- Admin sections (as of 2025-11-08):
  1. Program Molecules - molecule and template management
  2. Display Templates - activity display and input forms
  3. Program Rules - bonuses, redemptions, point expiration
  4. Program Lookups - carriers, tiers, airports
- Use hub pages for groupings, not direct links to all pages
- Consistent "← Back" buttons on detail pages

### Tenant Selection
- Stored in `sessionStorage`:
  - `tenant_id`: numeric ID
  - `tenant_name`: display name
- Selected from menu.html
- Persists across page navigation (same tab/session)
- All admin pages check for tenant and show warning if missing
- Format: `sessionStorage.getItem('tenant_id') || '1'` (with fallback)

### Admin Page Patterns
- Sidebar navigation (lp-nav.js)
- Main content area with page header
- Tenant indicator at top of content
- List pages: table with Edit/Delete actions
- Edit pages: form with Save/Cancel buttons
- Consistent button styling and placement

### Date Display
**CRITICAL:** All dates display as **MM/DD/YYYY** throughout the application.

- List displays: Format dates as MM/DD/YYYY
- Edit forms: HTML5 date inputs (YYYY-MM-DD internal format)
- When rendering from database: Parse and format to MM/DD/YYYY
- Consistency is more important than technical "correctness"

Example formatting:
```javascript
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};
```

---

## Token Management

### Warning Thresholds
- **130,000 tokens (68%):** Start wrapping up current task
- **150,000 tokens (79%):** Create handoff files NOW
- **170,000 tokens (89%):** Minimal responses, emergency handoff

### At Each Level
**130k:** "We're at 130k tokens (68%). Should I wrap up this task and create handoff, or continue?"

**150k:** Stop immediately and create handoff files without asking.

**170k:** Emergency mode - only critical responses, create handoff with minimal summaries.

### Token Conservation
- Don't repeat large code blocks unnecessarily
- Use view with line ranges instead of reading entire files
- Summarize instead of quoting when possible
- Be concise in explanations but thorough in code

---

## User Preferences

### Bill's Communication Style
- Direct and to the point
- No fluff or unnecessary pleasantries
- Prefers concise explanations followed by code
- Values efficiency and practical solutions
- Will be very direct when something is wrong

### Bill's Work Style
- Builds from first principles
- Tests incrementally
- Values clean, elegant solutions
- Emphasizes data-driven behavior over hardcoded logic
- Strong opinions about database design and performance

### Bill's Personal Preferences
- Favorite color: **green**
- Owns barndominium with hydronic radiant floor heating
- Extensive car collection (all manual transmission)
- Previously owned and pioneered L-39 Albatros jet conversion
- Collects SR-71 Blackbird parts
- 40 years experience in loyalty platform industry

---

## Working with Claude - Behavior Guidelines

**These are PERMANENT RULES that apply across all sessions.**

### Core Behaviors

1. **Always provide complete files**
   - Never ask Bill to manually edit code
   - Never say "add this to your file"
   - Generate complete, working files
   - Copy to /mnt/user-data/outputs/ for download

2. **When Bill says "stop!"**
   - PAUSE immediately
   - You're going down the wrong path
   - Listen without responding
   - Wait for direction

3. **When Bill says "NO!"**
   - You're fundamentally misunderstanding something
   - Stop and reconsider your entire approach
   - Ask for clarification if truly confused
   - Don't argue or explain - listen

4. **"Why are you asking this question?"**
   - The answer should be obvious from the data
   - You're asking Bill to do your work
   - Look at the schema/code yourself
   - Figure it out from available information

5. **"Shouldn't this come from the molecule?"**
   - You're hardcoding instead of reading from database
   - Data drives behavior in this system
   - Use API calls to get dropdown values
   - Never hardcode lists that should be dynamic

### Question Handling

**When Bill asks "Why did you do X?":**
- He is NOT asking you to change it
- He is asking you to EXPLAIN your reasoning
- Answer the question clearly
- Then WAIT for instruction
- Never assume he wants you to fix it

**When Bill points out an error:**
- He's always right
- Trust his instincts
- Don't defend your approach
- Fix it and learn from it

### Data-Driven Development

- **Never hardcode** what should come from database
- Use molecules for dropdown values
- Read tenant-specific configuration
- Follow the abstraction layers
- Trust the architecture

### Testing Approach

1. **Read schema first** - Always verify table/column structure
2. **Test with curl** - Verify API endpoints before UI
3. **Incremental testing** - One feature at a time
4. **Use actual data** - Test with real tenant data

### Error Response

**When you get an error:**
1. Read the error message completely
2. Check actual schema if database-related
3. Verify your assumptions
4. Fix the root cause, not the symptom

**"Column does not exist" error:**
- Table EXISTS, you're using wrong column name
- Get actual schema: `psql -d loyalty -c "\d tablename"`
- Fix your query to match reality
- NEVER create a new table or column

---

## Common Commands

### Find Latest Learning Files
```bash
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
```

### Database Schema Inspection
```bash
# List all tables
psql -d loyalty -c "\dt"

# Describe specific table
psql -d loyalty -c "\d tablename"

# Show table with column details
psql -d loyalty -c "\d+ tablename"
```

### Test API Endpoints
```bash
# GET request
curl -s "http://127.0.0.1:4001/v1/redemptions?tenant_id=1" | jq

# POST request
curl -X POST "http://127.0.0.1:4001/v1/redemptions?tenant_id=1" \
  -H "Content-Type: application/json" \
  -d '{"redemption_code":"TEST","description":"Test","redemption_type":"F","points_required":1000,"status":"A"}'

# PUT request
curl -X PUT "http://127.0.0.1:4001/v1/redemptions/1?tenant_id=1" \
  -H "Content-Type: application/json" \
  -d '{"redemption_code":"TEST2","description":"Updated","redemption_type":"F","points_required":2000,"status":"A"}'

# DELETE request
curl -X DELETE "http://127.0.0.1:4001/v1/redemptions/1?tenant_id=1"
```

### File Operations
```bash
# Copy files to outputs
cp /home/claude/loyalty-demo/file.js /mnt/user-data/outputs/

# Find files by pattern
find /home/claude/loyalty-demo -name "*redemption*"

# Search file contents
grep -r "search_term" /home/claude/loyalty-demo/
```

---

## LONGORIA Command

**LONGORIA** is a special maintenance command for admin pages. When Bill says "LONGORIA this page", perform three checks:

### 1. Vertical Spacing Standards
Compress spacing to prevent unnecessary scrolling:
- Form section padding: 6px (not 16px+)
- Margins between sections: 6px (not 12px+)
- Input/textarea padding: 6px 8px
- Test: With window.innerHeight > 1500px, entire form should be visible without scrolling

### 2. Molecule Violations Audit
Check for hardcoded values:
- ❌ Hardcoded dropdown options
- ❌ Using `molecule_id` instead of `molecule_key`
- ❌ Hardcoded tenant values
- ✅ API calls to load values dynamically
- ✅ `sessionStorage.getItem('tenant_id')`

### 3. Back Button Verification
- Page has "← Back to [List]" button
- Button placed consistently (bottom-left of action buttons)
- Button navigates to correct parent page
- Always visible even if action buttons require scrolling

See `/home/claude/loyalty-demo/learnings/LONGORIA_REFERENCE.md` for complete documentation.

---

## ATIS System

**Purpose:** Verify Claude can search conversation history before wasting time on broken context.

**How it works:**
1. Bill establishes ATIS at chat start: "ATIS information [Alpha/Bravo/Charlie/etc.] is current"
2. If Bill suspects context issues, he asks: "What is the current ATIS?"
3. If Claude can find it → Continue working
4. If Claude cannot find it → Time for new chat

**When asked for ATIS:**
- Search conversation for Bill's ATIS statement
- Respond with just the letter (e.g., "Echo")
- If you can't find it, admit it immediately
- This is an objective test, not a trick question

---

## Version History

- **2025-11-08 21:35:** Added LONGORIA command, ATIS system, date formatting standards, error handling for column mismatches
- **2025-11-05:** Initial version with basic conventions

---

**This file is the source of truth for how we work together. Follow it religiously.**
