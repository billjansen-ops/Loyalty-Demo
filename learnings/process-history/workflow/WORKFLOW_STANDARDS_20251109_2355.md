# WORKFLOW STANDARDS
**Updated:** November 9, 2025 23:55
**Version:** 20251109_2355

This document ACCUMULATES - new sessions add to it, never replace sections.

---

## 📁 File Organization

### Project Structure
```
/home/claude/loyalty-demo/
├── server_db_api.js          # Main API server (4967 lines)
├── atom_resolve.js           # Atom parsing and resolution
├── *.html                    # UI pages (activity, menu, admin, etc.)
├── *.js                      # Client-side JavaScript
├── theme.css                 # Global styles
├── ATOM_CONCEPT.md          # Atom system documentation
└── learnings/               # Handoff files
    ├── schema_snapshot.sql
    ├── START_CHAT_INSTRUCTIONS_*.md
    ├── SESSION_SUMMARY_*.md
    ├── WORKFLOW_STANDARDS_*.md
    └── SECRET_SAUCE_*.md
```

### SQL Scripts
- Location: `/home/claude/loyalty-demo/learnings/`
- Naming: `schema_snapshot.sql`, `migration_*.sql`
- Always include tenant isolation in WHERE clauses

### Learning Files
- Location: `/home/claude/loyalty-demo/learnings/`
- Naming: `[TYPE]_[YYYYMMDD_HHMM].md`
- Find latest: `ls -t /home/claude/loyalty-demo/learnings/[TYPE]_*.md | head -1`

### Documentation Format
- Markdown with clear section headers
- Code blocks with language identifiers
- Examples for every concept
- No assumptions - spell everything out

---

## 🗄️ Database Conventions

### Data Type Sizing (RIGHT-SIZE TO DOMAIN)
```sql
tenant_id           SMALLINT        -- Max 32K tenants, that's enough
member_id           BIGINT          -- Could be 20B members across all tenants
activity_id         BIGINT          -- Unlimited activities
molecule_id         INTEGER         -- Max 2B molecules per tenant
v_ref_id            INTEGER         -- Max 2B values per molecule
point_amount        INTEGER         -- Points fit in 32 bits
redemption_id       INTEGER         -- Max 2B redemption types
lot_id              BIGINT          -- Need big lot space
```

### Tenant Isolation Pattern
**EVERY query must include tenant_id where applicable**

```sql
-- Good
SELECT * FROM molecule_def WHERE tenant_id = $1 AND molecule_key = $2;

-- Bad - missing tenant isolation
SELECT * FROM molecule_def WHERE molecule_key = $1;
```

### Naming Conventions
- Tables: `snake_case`, singular (e.g., `activity`, `member`, `point_lot`)
- Columns: `snake_case` (e.g., `activity_id`, `redemption_rule_id`)
- Indexes: `idx_[table]_[columns]` (e.g., `idx_activity_member_date`)
- Foreign keys: Explicitly named (e.g., `molecule_id` references `molecule_def(molecule_id)`)

### Date Handling
- Storage: `DATE` type (no time component for activity dates)
- Display: `YYYY-MM-DD` format
- Comparison: Use DATE type directly, don't convert to strings
- Temporal queries: Use `>=` and `<` for date ranges

### Pointer-First Design
- Store IDs, not text (e.g., molecule_id not molecule text)
- Decode on read, encode on write
- Text deduplication through molecule_value_text
- Performance through integer joins

---

## 🌐 Web Application Patterns

### Navigation Structure
```
menu.html (top level)
├── Search (search.html)
├── Activity (activity.html?memberId=X)
└── Admin
    ├── Molecules (admin_molecules.html)
    ├── Activity Display Templates (admin_activity_display_templates.html)
    ├── Bonus Admin (admin_bonuses.html)
    └── Redemption Admin (admin_redemptions.html)
```

### Tenant Selection
- Currently hardcoded: `tenant_id = 1`
- TODO: Add tenant selector in menu
- Always pass `tenant_id` in query params

### Admin Page Patterns
- List view with search/filter
- Add/Edit/Delete buttons
- Form validation before submit
- Success/error messages
- Back to list navigation

### API Endpoint Patterns
```
GET    /v1/[resource]              # List
GET    /v1/[resource]/:id          # Get one
POST   /v1/[resource]              # Create
PUT    /v1/[resource]/:id          # Update
DELETE /v1/[resource]/:id          # Delete
```

### Error Handling Pattern
```javascript
try {
  const errorMsg = await getErrorMessage('E003', tenantId);
  return res.status(400).json({ error: errorMsg });
} catch (error) {
  console.error('Error:', error);
  return res.status(500).json({ error: 'Internal server error' });
}
```

---

## ⚡ Token Management

### Warning Thresholds
- **130,000 tokens**: Start wrapping up current task
- **150,000 tokens**: Finish current feature, prepare handoff
- **170,000 tokens**: Create handoff files immediately
- **180,000 tokens**: Emergency - create minimal handoff

### Actions at Each Level

#### At 130k:
- Finish current logical unit of work
- Don't start new major features
- Begin thinking about handoff structure

#### At 150k:
- Complete current feature
- Test and document what you built
- Start drafting handoff files mentally

#### At 170k:
- Stop new work
- Create all four handoff files
- Ensure nothing is left in incomplete state

#### At 180k:
- Emergency mode
- Create abbreviated handoff files
- Mark incomplete work clearly

---

## 👤 User Preferences

### Bill's Communication Style
- **Direct and to the point** - no fluff
- **Gets frustrated with**:
  - Asking questions when answer should be obvious from data
  - Hardcoding things that should come from molecules
  - Not reading the actual database schema
  - Repetitive questions about the same topic
  - Over-explaining or being verbose

- **Appreciates**:
  - Complete working files (never "edit this line")
  - Testing things incrementally
  - Listening when he corrects you
  - Understanding his domain expertise
  - Getting it right the first time

### Bill's Work Style
- **Iterative development**: Build small pieces, test, then add more
- **Data-driven**: Everything should come from database, not hardcoded
- **Performance-focused**: Right-size data types, use pointers, avoid waste
- **Quality over speed**: Would rather wait for it done right than fast and wrong

### Bill's Personal Preferences
- **Favorite color**: Green (use for positive actions, "add" operations)
- **Visual preferences**: Clean, minimal interfaces with good spacing
- **Naming**: Uses LONGORIA protocol for consistent UI spacing

### Bill's Background
- **40+ years** in software architecture
- Built loyalty systems "million years ago" with custom optimizations
- L-39 Albatros jet owner (pioneered engine conversion)
- Remarkable car collection (all manual transmissions)
- SR-71 Blackbird parts collection
- Lives in barndominium with advanced systems

---

## 🤖 Working with Claude - Behavior Guidelines

**THESE ARE PERMANENT RULES - NEVER VIOLATE THEM**

### File Delivery
- ✅ **ALWAYS provide complete files** ready to copy/paste
- ❌ **NEVER say** "edit line X to change Y"
- ❌ **NEVER provide** partial files with "..." placeholders
- ❌ **NEVER ask** Bill to manually edit code

### Listening to Bill
- **"stop!"** → Pause immediately, you're on wrong path, think about what's wrong
- **"NO!"** → You fundamentally misunderstood something, ask what you missed
- **"fuck!"** → You broke something that was working, revert immediately
- **"why are you asking this?"** → Answer should be obvious from data/context
- **"shouldn't this come from the molecule?"** → You're hardcoding instead of using data
- **"focus!"** → You're overcomplicating or missing the point

### Data-Driven Development
- ✅ **ALWAYS check** if something should come from molecules
- ✅ **ALWAYS read** the actual database schema before coding
- ✅ **ALWAYS think** "is this data or logic?"
- ❌ **NEVER hardcode** labels, messages, or configuration
- ❌ **NEVER assume** database structure without checking

### Testing Approach
- Test with curl commands before UI integration
- Test one piece at a time
- Test error cases, not just happy path
- Verify database state after operations
- Check console for errors

### Code Quality
- Provide complete, working files
- Include all necessary imports
- Handle errors properly
- Use async/await correctly
- Comment complex logic
- Follow existing patterns

### Problem-Solving
- When Bill corrects you, he's right - adjust immediately
- Don't argue or explain why you did it wrong
- Don't repeat the same mistake
- Learn from each correction
- Ask clarifying questions before building, not after breaking

---

## 💻 Common Commands

### Server Management
```bash
# Start server
cd /home/claude/loyalty-demo
node server_db_api.js

# Stop server
Ctrl+C

# Check if server is running
ps aux | grep node

# View server logs
tail -f /home/claude/loyalty-demo/server.log  # if logging to file
```

### Database Commands
```bash
# Connect to database
psql -h localhost -U admin -d loyalty_platform

# Common queries
\dt                                    # List tables
\d activity                           # Describe table
SELECT version();                     # PostgreSQL version
```

### Testing Endpoints
```bash
# Test member activities
curl "http://127.0.0.1:4001/v1/member/2153442807/activities?tenant_id=1"

# Test error message
curl "http://127.0.0.1:4001/v1/errors/E003?tenant_id=1"

# Test molecule
curl "http://127.0.0.1:4001/v1/molecules/get/currency_label?tenant_id=1"

# Process redemption
curl -X POST http://127.0.0.1:4001/v1/redemptions/process \
  -H "Content-Type: application/json" \
  -d '{"member_id":"2153442807","tenant_id":1,"redemption_rule_id":1,"point_amount":10000,"redemption_date":"2025-11-10"}'
```

### File Operations
```bash
# Find latest handoff files
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1

# Copy to outputs
cp file.js /mnt/user-data/outputs/

# View file with line numbers
cat -n file.js

# Search for pattern
grep -n "pattern" file.js
```

---

## 📐 LONGORIA Protocol (UI Consistency)

### Spacing Standards
- **Between sections**: 12-16px
- **Within sections**: 6-8px
- **Form field gaps**: 8-12px
- **Button spacing**: 8px horizontal, 4px vertical

### Visual Hierarchy
- **Page title**: 24px, bold
- **Section headers**: 16-18px, semi-bold
- **Card headers**: 14-16px, semi-bold
- **Body text**: 13-14px
- **Helper text**: 12px, muted color

### Color Coding
- **Green** (#059669): Positive actions, additions, success
- **Red** (#dc2626): Negative actions, deletions, redemptions, errors
- **Blue** (#2563eb): Primary actions, navigation
- **Gray** (#6b7280): Secondary actions, muted text

### Component Patterns
- Cards: `background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);`
- Buttons: `padding: 6px 14px; border-radius: 6px; font-size: 13px;`
- Inputs: `padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px;`

---

## 🎨 Code Style Guidelines

### JavaScript
- Use `const` and `let`, never `var`
- Async/await over promises
- Destructuring for clarity
- Template literals for strings
- Arrow functions for callbacks

### SQL
- UPPERCASE keywords
- Lowercase table/column names
- Indent subqueries
- Always use parameterized queries ($1, $2)
- Never concatenate user input into SQL

### HTML
- Semantic tags (header, nav, main, section)
- Proper indentation (2 spaces)
- Close all tags
- Use data attributes for JS hooks

### Error Messages
- Use atom syntax for dynamic parts
- Clear, actionable messages
- No technical jargon for users
- Include context (what failed, why)

---

## 🔍 Debugging Strategies

### When Something Breaks
1. Check browser console for errors
2. Check server console for errors
3. Verify server is running latest code
4. Check database state
5. Test with curl to isolate UI vs API
6. Verify file synchronization between environments

### Common Issues
- **"Column does not exist"** → Schema out of sync, check actual database
- **"Cannot read property of undefined"** → Missing null check, data not loaded
- **"Module not found"** → Import path wrong or file not copied
- **Display showing raw values** → Magic box not building, check server code

### Testing Checklist
- [ ] Browser console clean (no errors)
- [ ] Server console clean (no errors)
- [ ] Database queries execute successfully
- [ ] UI displays expected data
- [ ] Error cases handled gracefully
- [ ] Data persists across page reload

---

## 📚 Reference Patterns

### Helper Function Pattern
```javascript
// Always create helper functions for common operations
async function getErrorMessage(errorCode, tenantId) {
  const errorMolecule = await getMolecule('error_messages', tenantId);
  const errorEntry = errorMolecule.values.find(v => v.value === errorCode);
  if (errorEntry) {
    return await resolveAtoms(errorEntry.label, { tenantId, getMolecule });
  }
  return null;
}
```

### Molecule Access Pattern
```javascript
// Centralized molecule fetching
async function getMolecule(moleculeKey, tenantId) {
  const query = `
    SELECT md.*, mvt.text_value, mvs.scalar_value
    FROM molecule_def md
    LEFT JOIN molecule_value_text mvt ON ...
    WHERE md.tenant_id = $1 AND md.molecule_key = $2
  `;
  const result = await dbClient.query(query, [tenantId, moleculeKey]);
  return parseMoleculeResult(result.rows);
}
```

### Atom Resolution Pattern
```javascript
// Use atoms for dynamic text
const template = "Insufficient {{M,currency_label,value,,L}} for this Redemption";
const resolved = await resolveAtoms(template, { 
  tenantId, 
  getMolecule,
  dbClient 
});
// Result: "Insufficient kilometers for this Redemption"
```

---

## 🎯 Session End Checklist

Before ending a session:
- [ ] All code is tested and working
- [ ] No broken functionality
- [ ] Files copied to outputs folder
- [ ] Handoff files created (if >150k tokens)
- [ ] Database state is consistent
- [ ] No uncommitted changes
- [ ] Bill knows what's working and what's not

---

**Remember: Bill has 40+ years of experience. When he says something is wrong, it's wrong. Listen, learn, adjust.**
