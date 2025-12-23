# NEXT SESSION QUICK START

## 🔥 DO THIS FIRST

1. **Read the full session summary:** `SESSION_SUMMARY_2025_11_05.md`

2. **Check for schema dump in handoff:**
   ```bash
   ls /mnt/user-data/uploads/*schema* 2>/dev/null
   ```
   
   If no schema files exist → Ask Bill to update handoff script

3. **NEVER write code until you've read the actual database schema**

---

## 🚨 CRITICAL: What Went Wrong This Session

### We Built a Hardcoded tableMap ❌
```javascript
const tableMap = {
  'carriers': { table: 'carriers', column: 'carrier_code', idColumn: 'carrier_id' }
};
```

**This defeats the entire purpose of the molecule system!**

### The Right Approach ✅
Read metadata from molecule_def:
- foreign_table
- foreign_id_column
- foreign_code_column
- foreign_label_column

**These columns don't exist yet in the schema - they need to be added!**

---

## 📋 Priority Task List

### Task 1: Fix Handoff Script 🔥 HIGHEST PRIORITY
The handoff must include:
- `pg_dump --schema-only` output
- Table descriptions (`\d+`)
- Sample data from key tables

**Without this, we're flying blind!**

### Task 2: Add Missing Columns to molecule_def
```sql
ALTER TABLE molecule_def
ADD COLUMN IF NOT EXISTS foreign_table TEXT,
ADD COLUMN IF NOT EXISTS foreign_id_column TEXT,
ADD COLUMN IF NOT EXISTS foreign_code_column TEXT,
ADD COLUMN IF NOT EXISTS foreign_label_column TEXT;
```

### Task 3: Fix encode/decode Functions
Remove hardcoded tableMap, read from molecule_def instead.

### Task 4: Test Everything
Use curl commands to test each molecule type.

---

## 🎓 Key Learnings to Remember

1. **Data drives behavior** - Never hardcode what should come from data
2. **Provide complete files** - Never ask Bill to manually edit code
3. **Listen when Bill says "stop!"** - He's always catching something important
4. **Test incrementally** - Curl commands reveal issues early
5. **Read schema first** - Don't guess what columns exist

---

## 🗣️ Bill's Communication Style

- **"stop!"** = You're going down the wrong path, pause and listen
- **"NO!"** = You're fundamentally misunderstanding something
- **"why are you asking this question"** = The answer should be obvious from the data
- **"shouldn't this come from the molecule?"** = You're hardcoding instead of reading from data

**When you hear these → STOP and reconsider your approach!**

---

## ✅ What's Working

- The overall design (encode/decode functions + text pool) is solid
- Testing approach with curl commands is effective
- Documentation is good
- Bill's 3am insight about the broken model was spot-on

## ❌ What's Broken

- Handoff script doesn't include schema dumps
- molecule_def missing foreign_* columns
- encode/decode functions have hardcoded tableMap
- SQL migration not run yet

---

## 🎯 Success Criteria for Next Session

**DONE when:**
1. ✅ Handoff includes actual schema dumps
2. ✅ molecule_def has all foreign_* columns
3. ✅ encode/decode functions read from molecule_def (no hardcoding)
4. ✅ SQL migration run successfully
5. ✅ All curl tests pass:
   - carrier (lookup)
   - origin (lookup)
   - fare_class (list)
   - flight_number (numeric)
   - confirmation_code (text with deduplication)

---

**Current Token Usage:** 72K / 190K (38%)  
**Status:** Good foundation, needs schema fix  
**Next Priority:** Get actual database schema into handoff
