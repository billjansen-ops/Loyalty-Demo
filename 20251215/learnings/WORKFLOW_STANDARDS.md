# Project Workflow & Conventions

**Last Updated:** 2025-11-03  
**Purpose:** Standard practices and conventions for the Loyalty Platform project

---

## **File Organization**

### **SQL Scripts**
- **Location:** `~/Projects/Loyalty-Demo/SQL/`
- **Naming:** Descriptive names like `add_tenant_to_bonus.sql`
- **Usage:** All SQL migration/setup scripts go here

**When providing psql commands, always reference this path:**
```bash
psql -h 127.0.0.1 -U billjansen -d loyalty -f SQL/add_tenant_to_bonus.sql
```

### **Learning Files**
- **Location:** `~/Projects/Loyalty-Demo/learnings/`
- **Format:** Markdown (`.md`)
- **Types:**
  - `SESSION_YYYYMMDD.md` - Daily work summaries
  - `TECHNICAL_DEBT.md` - Known issues/optimizations
  - Feature documentation (e.g., `BUCKET_SYSTEM_COMPLETE.md`)

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
1. Request: "Create a session summary"
2. Claude generates `SESSION_YYYYMMDD.md`
3. Download and save to `learnings/` folder
4. Run handoff script to package everything
5. Upload tarball at start of next session

### **What Gets Packaged**
- ✅ All HTML, JS, CSS files
- ✅ All learning files (`.md`)
- ✅ SQL scripts
- ✅ README files
- ✅ MANIFEST.txt
- ❌ node_modules (too large)
- ❌ .env files (secrets)
- ❌ Database itself (just schema scripts)

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
cd ~/Projects/Loyalty-Demo
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
# Copy downloaded files to project
cp ~/Downloads/filename.html ~/Projects/Loyalty-Demo/

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

---

**End of Document**
