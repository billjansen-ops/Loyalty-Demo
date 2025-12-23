# Project Workflow & Conventions

**Last Updated:** 2025-11-15 (Emergency handoff - see SESSION_SUMMARY for gap info)  
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

### **Schema Changes and Documentation**

**CRITICAL RULE:** When database schema changes, documentation MUST be updated immediately.

**Process for Schema Changes:**
1. **Make the schema change** (ALTER TABLE, etc.)
2. **Update schema_snapshot.sql** if it exists
3. **Identify affected documentation** - Search for references to changed tables/columns:
   ```bash
   grep -r "table_name\|column_name" learnings/*.md
   ```
4. **Update all affected docs** - Fix any examples, queries, or explanations
5. **Verify consistency** - Ensure no outdated examples remain

**Common Documentation Files That May Need Updates:**
- `MOLECULE_ACTIVITY_COMPLETE.md` - Activity and molecule examples
- `SECRET_SAUCE_*.md` - Core architecture descriptions  
- `SESSION_*.md` - Recent session summaries
- Any feature-specific docs (e.g., `BUCKET_SYSTEM_COMPLETE.md`)

**Why This Matters:**
- Outdated docs cause bugs when developers (or AI) follow old examples
- Documentation is a form of code - it must stay in sync with reality
- Better to delete a doc than leave it dangerously incorrect

**Example Issue Today (2025-11-11):**
- `MOLECULE_ACTIVITY_COMPLETE.md` showed: `INSERT INTO activity_detail (activity_id, k, v_ref_id, raw)`
- Actual schema: `activity_detail (activity_id, molecule_id, v_ref_id)` 
- Result: Two bugs in production code copying from outdated docs

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

## **LONGORIA Standards**

### **What is LONGORIA?**

LONGORIA is a special maintenance command used to audit and optimize admin pages. When Bill says "LONGORIA this page" or "Can you LONGORIA this?", Claude performs a comprehensive three-part check to ensure the page meets quality standards.

**Why "LONGORIA"?** The word was specifically chosen because it has **no default meaning**. This prevents Claude from confidently doing the wrong thing if it forgets - instead, it will ask for clarification.

### **What LONGORIA Does**

LONGORIA performs three distinct checks on admin pages:

#### **1. Apply Vertical Spacing Standards**

Compress all vertical spacing to prevent unnecessary scrolling:

```
Form section padding:     6px (not 16px+)
Margins between sections: 6px (not 12px+)
Input/textarea padding:   6px 8px
Textarea min-height:      40px (not 60px+)
Value editor padding:     8px (not 16px+)
Empty state padding:      15px 10px (not 30px+)
Table cell padding:       6px 8px (not 10px+)
Table header padding:     6px 8px
Action buttons margin:    8px (not 12px+)
Icon-only buttons:        4px 8px padding, font-size 14px
```

**Action Button Standards:**
- **Default to icon-only buttons** for common actions in tables/lists
- Edit: ✏️ (pen icon)
- Delete: 🗑️ (trash icon)
- Test/Verify: ✅ (checkmark icon)
- Add title attributes for tooltips on hover
- Use text buttons only for primary page actions or when context needs clarity

**Test Criteria:** With window.innerHeight > 1500px, entire form including action buttons should be visible without scrolling.

#### **1b. Scrollable List Pattern**

For admin pages with data tables that could exceed viewport height, implement contained scrolling:

**HTML Structure:**
```html
<div class="table-container">
  <div class="table-header">
    <h2>Title</h2>
    <button>+ Add</button>
  </div>
  
  <div class="table-scroll-wrapper">
    <table>
      <thead><!-- Headers here --></thead>
      <tbody><!-- Data rows here --></tbody>
    </table>
  </div>
</div>
```

**CSS Requirements:**
```css
.table-scroll-wrapper {
  max-height: calc(100vh - 320px);  /* Adjust offset based on page header height */
  overflow-y: auto;
}

th {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #f9fafb;  /* CRITICAL: Solid background so data scrolls UNDER headers */
  border-bottom: 2px solid #e5e7eb;  /* Visual separation */
}
```

**Key Principles:**
- ✅ Page header and filters stay fixed (no whole-page scrolling)
- ✅ Table headers remain visible while data scrolls underneath
- ✅ Headers MUST have solid background (not transparent)
- ✅ Headers need high z-index (100+) to stay on top
- ✅ Bottom border on headers for clear visual separation
- ✅ Adjust `calc()` offset value based on actual header/filter height
- ✅ Icon-only action buttons in table rows (✏️ 🗑️)

**Test Criteria:** 
- Table fits entirely within viewport (no whole-page scrolling)
- Headers remain readable while scrolling (data goes under, not through)
- Works with both few rows (no scroll) and many rows (scrolls internally)

#### **2. Audit for Molecule Violations**

Check the page for hardcoded values that should be data-driven:

**Look for:**
- ❌ Hardcoded dropdown options (should load from molecule API)
- ❌ Using `molecule_id` in URLs/calls (should use `molecule_key`)
- ❌ Hardcoded labels that should come from database
- ❌ Direct SQL queries to molecule tables (should use helper functions)
- ❌ Hardcoded tenant values like `const tenantId = 1;`

**Replace with:**
- ✅ API calls to load values dynamically from molecules
- ✅ `sessionStorage.getItem('tenant_id')` for tenant context
- ✅ Dynamic label loading from tenant configuration

#### **3. Verify Back Button**

Ensure consistent navigation:

- ✅ Page has "← Back to [List/Previous]" button
- ✅ Button is consistently placed (typically bottom-left of action buttons area)
- ✅ Button works correctly (navigates to correct parent page)
- ✅ Back button is always visible (even if action buttons require scrolling)

### **When to Use LONGORIA**

Use LONGORIA when:
- Updating existing admin pages to current standards
- Bill requests it explicitly
- Creating new admin pages (apply standards proactively)
- Reviewing pages that feel "too tall" or have excessive scrolling
- Auditing pages after adding new features

### **Success Criteria**

A page successfully "LONGORIA'd" when:
- ✅ All content fits within 1500px height without scrolling (or uses scrollable list pattern)
- ✅ No hardcoded dropdown values remain
- ✅ Tenant information comes from sessionStorage
- ✅ Back button present and functional
- ✅ All spacing follows 6-8px standard
- ✅ Icon-only buttons used for table actions

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
- ✅ **Documentation updated** (if schema changed, update all affected .md files)
- ✅ UI is responsive and follows theme
- ✅ Error handling in place
- ✅ Works for multiple tenants

---

## **Session Handoff Checklist**

Before ending a session, verify:
- ✅ All changed files copied to `/mnt/user-data/outputs/`
- ✅ Schema changes have SQL migration scripts
- ✅ **Documentation updated** if schema changed (check MOLECULE_*, SECRET_SAUCE_*, etc.)
- ✅ Session summary created (SESSION_YYYYMMDD_HHMM.md)
- ✅ Known issues documented in TECHNICAL_DEBT.md (if any)
- ✅ Clear "Next Steps" for following session

---

**End of Document**
