# Loyalty Platform - Handoff Package
## November 4, 2025 - Afternoon Session

---

## 🎯 Session Summary

**What Worked:** ✅ Dynamic label system fully implemented and working
**What Broke:** ❌ Bonus criteria save function completely broken

---

## ⚠️ CRITICAL - START HERE

**THE BONUS CRITERIA SAVE IS BROKEN!**

Before doing anything else, you must:

1. Read `/learnings/SESSION_20251104_AFTERNOON.md`
2. Revert `server_db_api.js` to working version
3. Understand how rule creation worked before

**DO NOT make changes to bonus code until you fully understand the existing flow!**

---

## ✅ What's Working

### Dynamic Label System
All files installed and working:

**Backend:**
- `GET /v1/tenants/:id/labels` - Returns molecule labels as key/value pairs

**Frontend:**
- `lp-nav.js` - Loads labels, caches them, replaces {tokens} in navigation
- `menu.html` - Calls `LP_NAV.setTenant()` when tenant selected
- `point-summary.html` - Uses `{currency_label}` tokens throughout

**Test it:**
```bash
curl "http://127.0.0.1:4001/v1/tenants/1/labels"
```

Expected: `{"currency_label": "Kilometers"}`

Then visit point-summary page - should show "Kilometers Summary"

---

## ❌ What's Broken

### Bonus Criteria Save

**Error:** `duplicate key value violates unique constraint "rule_pkey"`

**Files affected:**
- `server_db_api.js` - Lines ~1256-1268 (rule creation code)

**What happened:**
1. Tried to change 'FareClass' to 'fare_class' ✓
2. Exposed bug in rule creation for new bonuses
3. Made multiple attempts to fix it
4. Each fix introduced new bug
5. Now completely broken

**Root cause:**
Incomplete understanding of:
- When rules are created vs. reused
- How rule_id sequences work
- The relationship between bonus and rule tables

---

## 📋 Files in This Package

### Core Application Files
- All HTML pages (CSR, Admin, Member)
- All JavaScript (server, navigation, client)
- All CSS (theme, styles)

### Database
- `SQL/` - Migration scripts
- `learnings/schema_snapshot.sql` - Full schema

### Documentation
- `learnings/SESSION_20251104_AFTERNOON.md` - Today's work
- `learnings/SESSION_20251103.md` - Yesterday's foundation
- `learnings/BONUS_ENGINE_GUIDE.md` - How bonuses work
- `learnings/TEST_RIG_ARCHITECTURE.md` - Test harness design
- `learnings/CRITERIA_INTEGRATED.md` - How criteria evaluation works

### Key Architecture Docs
- `BONUS_ENGINE_GUIDE.md` - Core bonus concepts
- `TEST_RIG_ARCHITECTURE.md` - Testing framework
- `MOLECULE_SYSTEM_README.md` - Molecule architecture

---

## 🎯 Next Session Objectives

### Priority 1: Fix Bonus Save (CRITICAL)
1. Review how BILLSTEST criteria were added successfully
2. Understand the rule creation flow
3. Revert to working code
4. Test adding criteria to existing bonus
5. Test adding criteria to new bonus

### Priority 2: Prove Molecules Work
1. Add fare_class = F criterion to CLASSTEST
2. Test rig: class=Y should FAIL ❌
3. Test rig: class=F should PASS ✅
4. This proves molecules work in bonus engine

### Priority 3: Migrate Existing Fields
1. Carrier → molecule-based
2. Origin → molecule-based  
3. Destination → molecule-based
4. Update admin_bonus_edit.html to load from molecule_def

---

## 🗄️ Database State

### Bonuses
```sql
-- BILLSTEST: Working, has 3 criteria
SELECT * FROM bonus WHERE bonus_code = 'BILLSTEST';
SELECT * FROM rule_criteria WHERE rule_id = 1;

-- CLASSTEST: Exists, unclear if has rule_id
SELECT * FROM bonus WHERE bonus_code = 'CLASSTEST';
```

### Molecules
```sql
-- Check what's defined
SELECT molecule_key, context, value_kind FROM molecule_def;

-- Should see:
-- currency_label (tenant, list)
-- fare_class (activity, list)
-- And others...
```

---

## 🔑 Key Concepts

### How Bonuses Work
1. `bonus` table - Header info (code, dates, amount, type)
2. Optional `rule_id` - Links to rule
3. `rule` table - Just a container (rule_id + timestamps)
4. `rule_criteria` table - Actual conditions

### How Criteria Are Added
**For bonus WITH existing rule_id:**
- Just INSERT into rule_criteria with that rule_id

**For bonus WITHOUT rule_id:**
- INSERT INTO rule (creates new rule_id)
- UPDATE bonus SET rule_id
- INSERT INTO rule_criteria

**This is what's broken!**

---

## 📞 For Bill

**Working Features:**
- Label system fully working
- "Kilometers Summary" displays correctly
- Token replacement throughout UI

**Broken:**
- Cannot add criteria to bonuses
- Must fix before continuing molecule migration

**Questions for next session:**
- What is CLASSTEST's current rule_id?
- Should we test with BILLSTEST first (known working)?
- Do you have a backup of working server_db_api.js?

---

## 📦 Installation (When Fixed)

```bash
# Extract package
tar -xzf loyalty_handoff_20251104_afternoon.tar.gz
cd loyalty_handoff_20251104_100728

# Install working files
cp lp-nav.js ~/Projects/Loyalty-Demo/
cp menu.html ~/Projects/Loyalty-Demo/
cp point-summary.html ~/Projects/Loyalty-Demo/
cp admin_molecule_edit.html ~/Projects/Loyalty-Demo/

# DO NOT install server_db_api.js until fixed!
```

---

## 🎓 Lessons Learned

**What went well:**
- Label system is clean, well-architected
- Token replacement pattern is reusable
- Single API call for all labels (efficient)

**What went wrong:**
- Made changes without fully understanding existing code
- Tried to fix bugs incrementally instead of stepping back
- Should have reverted earlier when issues appeared

**For next time:**
- Read documentation FIRST
- Understand before changing
- Test smaller changes
- Keep working version nearby

---

## Token Usage

**Session:** ~85k / 190k (45% used)
**Remaining:** 103k+ (healthy)

---

**Package Created:** November 4, 2025 1:45 PM
**Status:** Label system working ✅ / Bonus save broken ❌
**Priority:** Fix bonus save before any other work
