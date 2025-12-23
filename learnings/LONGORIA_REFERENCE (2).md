# LONGORIA Command Reference

## What is LONGORIA?

LONGORIA is a special maintenance command used to audit and optimize admin pages in the Loyalty Platform. When Bill says "LONGORIA this page" or "Can you LONGORIA this?", Claude performs a comprehensive three-part check to ensure the page meets quality standards.

## Why "LONGORIA"?

The word "LONGORIA" was specifically chosen because it has **no default meaning**. This is critical for AI assistance because:

- Common words like "compress" or "optimize" have default meanings that could lead to wrong actions if the AI forgets the specific definition
- If Claude forgets what LONGORIA means, it will **ask for clarification** instead of confidently doing the wrong thing
- This prevents false positives where Claude thinks it completed the task but did something completely different

## What LONGORIA Does

LONGORIA performs three distinct checks on admin pages:

### 1. Apply Vertical Spacing Standards

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

### 1b. Scrollable List Pattern

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

### 2. Audit for Molecule Violations

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

### 3. Verify Back Button

Ensure consistent navigation:

- ✅ Page has "← Back to [List/Previous]" button
- ✅ Button is consistently placed (typically bottom-left of action buttons area)
- ✅ Button works correctly (navigates to correct parent page)
- ✅ Back button is always visible (even if action buttons require scrolling)

## When to Use LONGORIA

Use LONGORIA when:
- Updating existing admin pages to current standards
- Bill requests it explicitly
- Creating new admin pages (apply standards proactively)
- Reviewing pages that feel "too tall" or have excessive scrolling
- Auditing pages after adding new features

## Example Usage

```
User: "Can you LONGORIA the admin_carriers.html page?"

Claude: [Performs all three checks]
1. Reduces padding from 16px to 6px throughout
2. Finds hardcoded carrier types, replaces with API call to molecule
3. Verifies back button exists and points to admin_lookups.html

[Provides updated file]
```

## Success Criteria

A page successfully "LONGORIA'd" when:
- ✅ All content fits within 1500px height without scrolling
- ✅ No hardcoded dropdown values remain
- ✅ Tenant information comes from sessionStorage
- ✅ Back button present and functional
- ✅ All spacing follows 6-8px standard

## Notes

- LONGORIA is documented in WORKFLOW_STANDARDS for persistence across Claude sessions
- The standards were established through iterative refinement based on Bill's feedback
- LONGORIA is additive - it improves pages without breaking existing functionality
- All new admin pages should be "LONGORIA-compliant" from creation

---

**Document Version:** 1.1  
**Last Updated:** 2025-11-12  
**Location:** Loyalty Platform Documentation
