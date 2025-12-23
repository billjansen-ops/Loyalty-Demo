# Installation Checklist - Session 20251103

## Files to Download and Install

### 1. Session Summary (Required)
**File:** SESSION_20251103.md  
**Destination:** `~/Projects/Loyalty-Demo/learnings/SESSION_20251103.md`

```bash
cp ~/Downloads/SESSION_20251103.md ~/Projects/Loyalty-Demo/learnings/
```

---

### 2. Workflow Standards (Required - New Persistent Learning)
**File:** WORKFLOW_STANDARDS.md  
**Destination:** `~/Projects/Loyalty-Demo/learnings/WORKFLOW_STANDARDS.md`

```bash
cp ~/Downloads/WORKFLOW_STANDARDS.md ~/Projects/Loyalty-Demo/learnings/
```

---

### 3. Fixed Files (Optional - Save for Next Session)

These files have been fixed but bonus save issue not fully resolved. You may want to wait until next session to install them after debugging is complete.

**admin_bonus_edit.html** - All fixes applied but save behavior unclear
**server_db_api.js** - tenant_id handling added but needs verification

**If you want to install anyway:**
```bash
cd ~/Projects/Loyalty-Demo

# Backup current files
cp admin_bonus_edit.html admin_bonus_edit.html.backup
cp server_db_api.js server_db_api.js.backup

# Install new versions
cp ~/Downloads/admin_bonus_edit.html .
cp ~/Downloads/server_db_api.js .

# MUST restart server after server_db_api.js change
# Ctrl+C to stop, then:
node server_db_api.js
```

---

## Create Handoff Package

After installing SESSION_20251103.md and WORKFLOW_STANDARDS.md:

```bash
cd ~/Projects/Loyalty-Demo
# Run your handoff script (whatever command that is)
# This will create loyalty_handoff_TIMESTAMP.tar.gz
```

---

## For Next Session

1. Upload the new handoff package
2. I'll read SESSION_20251103.md and WORKFLOW_STANDARDS.md
3. We'll resolve the bonus save issue first
4. Then move on to expiration rules and mutt config

---

**Most Important:** Make sure SESSION_20251103.md and WORKFLOW_STANDARDS.md are in the learnings/ folder before running handoff!
