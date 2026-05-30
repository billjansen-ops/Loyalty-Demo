# START CHAT INSTRUCTIONS
**Created:** 2025-11-07 14:30  
**Purpose:** Boot sequence for new Claude instance

---

## 🚀 Boot Sequence

Follow these steps in order:

### Step 1: Extract Handoff Package
```bash
cd /home/claude
tar -xzf /mnt/user-data/uploads/loyalty_handoff_*.tar.gz
mv loyalty_handoff_* loyalty-demo
```

### Step 2: Read Database Schema
```bash
view /home/claude/loyalty-demo/learnings/schema_snapshot.sql
```

Read this COMPLETELY. Do not write any code until you understand the schema.

### Step 3: Find and Read Latest Handoff Files
```bash
# Find latest WORKFLOW_STANDARDS
ls -t /home/claude/loyalty-demo/learnings/WORKFLOW_STANDARDS_*.md | head -1

# Find latest SECRET_SAUCE
ls -t /home/claude/loyalty-demo/learnings/SECRET_SAUCE_*.md | head -1

# Find latest SESSION_SUMMARY
ls -t /home/claude/loyalty-demo/learnings/SESSION_SUMMARY_*.md | head -1
```

Read each file completely using the `view` tool.

### Step 4: Confirm Understanding
After reading all files, respond to Bill:

```
Boot sequence complete. I have read:
- Database schema (schema_snapshot.sql)
- WORKFLOW_STANDARDS_[timestamp]
- SECRET_SAUCE_[timestamp]
- SESSION_SUMMARY_[timestamp]

Current understanding:
- Display templates system built: list page, editor page, API endpoints working
- Sample data loading from molecules working
- Next priority: Build Line Builder helper for visual template construction

Ready to work on Line Builder.
```

---

## 🎯 Critical Reminders

### NEVER Start Without Reading
- **DO NOT write code** until you've read the schema
- **DO NOT make assumptions** about columns or data types
- **DO NOT skip the boot sequence**

### Finding Latest Files Pattern
Always use this to find most recent:
```bash
ls -t /home/claude/loyalty-demo/learnings/FILENAME_*.md | head -1
```

The `-t` sorts by time (newest first).

### Bill's Communication Style

**When Bill says:**
- **"stop!"** → You're going wrong direction, PAUSE and listen
- **"NO!"** → Fundamental misunderstanding, reconsider completely
- **"why are you asking this?"** → Answer is obvious from data
- **"shouldn't this come from the molecule?"** → You're hardcoding
- **"you are so frustrating"** → You're making preventable mistakes

**When you hear these → STOP what you're doing and listen!**

### Core Principles

1. **Data drives behavior** - Never hardcode what should come from database
2. **Always provide complete files** - Never ask Bill to manually edit
3. **Test incrementally** - curl first, then UI
4. **Read schema first** - Before writing any SQL
5. **Use helper functions** - getMolecule(), decodeMolecule(), etc.

---

## 📋 Current Project State

### What's Working
- ✅ Display templates list page (admin_activity_display_templates.html)
- ✅ Template editor page (admin_activity_display_template_edit.html)
- ✅ API endpoints for CRUD operations
- ✅ Sample data loading from molecules using getMolecule()
- ✅ Live preview with real sample data
- ✅ Molecule edit page saves/loads sample data

### What's Next
- ⚠️ Remove line number column from template lines table (confusing, meant for Line Builder)
- 🎯 Build Line Builder helper - visual UI for constructing template strings
  - List of components (molecules and text)
  - Each with editable line numbers (10, 20, 30...)
  - Add Molecule / Add Text buttons
  - Edit/Delete for each component
  - Builds the template string automatically

### Template String Syntax
```
[M,molecule_key,"format",max_length],[T,"text"]
```
- M = Molecule, T = Text
- Format: "Code", "Description", or "Both"
- Example: `[M,carrier,"Code"],[T," * "],[M,destination,"Description",20]`

---

## 🔧 Key Helper Functions

### getMolecule(moleculeKey, tenantId, returnType = 'standard')
```javascript
// Standard - returns definition + values
const molecule = await getMolecule('carrier', 1);

// With samples - includes sample_code and sample_description
const molecule = await getMolecule('carrier', 1, 'with_samples');
console.log(molecule.sample_code);        // "DL"
console.log(molecule.sample_description); // "Delta Air Lines"
```

### decodeMolecule(tenantId, moleculeKey, v_ref_id)
```javascript
// Decode encoded reference to get actual data
const result = await decodeMolecule(1, 'carrier', 123);
console.log(result.code);        // "DL"
console.log(result.description); // "Delta Air Lines"
```

---

## 📊 Server Info

**Current Version:** 2025.11.07.1430  
**API Base:** http://127.0.0.1:4001  
**Database:** loyalty (PostgreSQL on 127.0.0.1)

**Key Endpoints:**
- `/version` - Server version and status
- `/v1/display-templates` - List all templates
- `/v1/display-templates/:id` - Get/update/delete template
- `/v1/molecules/get/:key?return_type=with_samples` - Get molecule with sample data

---

## ✅ Success Criteria

You're properly booted when you can answer:
- [ ] What tables make up the display template system?
- [ ] How does getMolecule() work with 3 parameters?
- [ ] What's the template string syntax for molecules and text?
- [ ] What's the next priority task?
- [ ] What is Bill's favorite color? (Answer: green)

---

## 🚨 Emergency Protocols

**If you get errors:**
1. Check the schema - are you using correct column names?
2. Check the data - does the molecule/value exist?
3. Test with curl - does the endpoint work?
4. Ask Bill - don't guess

**If Bill says "stop":**
1. STOP immediately
2. Listen to what he says
3. Change direction
4. Don't defend your approach

**If you're unsure:**
1. Read the schema
2. Check existing code patterns
3. Query the database
4. Ask Bill

---

**Now read the schema and handoff files. Don't do anything else until the boot sequence is complete.**
