# Unified Navigation System - Single Source of Truth

## What We Built

A **single lp-nav.js file** that handles navigation for BOTH CSR and Admin pages. One file to rule them all!

## The Problem We Solved

**Before:** Each admin page had navigation hardcoded. To add "Bonuses" to the nav, we'd have to update 7+ files manually. Error-prone and tedious.

**After:** Navigation defined ONCE in lp-nav.js. Change it once, updates everywhere automatically.

## How It Works

### 1. lp-nav.js (Single Source)
```javascript
const NAV_CONFIGS = {
  admin: [
    { icon: '📊', label: 'Overview', href: 'admin.html' },
    { icon: '🎁', label: 'Bonuses', href: 'admin_bonuses.html' },
    { icon: '✈️', label: 'Carriers', href: 'admin_carriers.html' },
    { icon: '⭐', label: 'Tiers', href: 'admin_tiers.html' },
    { icon: '🌍', label: 'Airports', href: 'admin_airports.html' }
  ]
}
```

### 2. Every Admin Page
```html
<!-- Old way (BAD): -->
<nav class="nav">
  <div class="nav-section-title">Client Admin</div>
  <a href="admin.html" class="nav-item">...</a>
  <!-- Repeat 20 lines of HTML -->
</nav>

<!-- New way (GOOD): -->
<nav class="nav" id="nav-container"></nav>
<!-- lp-nav.js injects the HTML automatically -->
```

### 3. Detection Logic
lp-nav.js automatically detects page type:
- Filename starts with `admin` → Loads admin nav
- Filename is `csr.html`, `activity.html`, etc. → Loads CSR nav
- Automatically sets active page highlighting

## Files Updated

All these now use dynamic nav:
1. ✅ admin.html
2. ✅ admin_bonuses.html
3. ✅ admin_bonus_edit.html
4. ✅ admin_tiers.html
5. ✅ admin_tier_edit.html
6. ✅ admin_airports.html
7. ✅ admin_airport_edit.html

## To Add a New Nav Item

**Before (BAD):** Edit 7+ HTML files manually

**After (GOOD):** Edit ONE line in lp-nav.js:
```javascript
const NAV_CONFIGS = {
  admin: [
    { icon: '📊', label: 'Overview', href: 'admin.html' },
    { icon: '🎁', label: 'Bonuses', href: 'admin_bonuses.html' },
    // ADD ONE LINE HERE:
    { icon: '🎯', label: 'Promotions', href: 'admin_promotions.html' },
    // ...rest of items
  ]
}
```

Save file. Done. All pages updated automatically!

## Benefits

✅ **DRY Principle** - Don't Repeat Yourself  
✅ **Single Source of Truth** - One place to maintain  
✅ **Automatic Active States** - Current page auto-highlighted  
✅ **Consistent Navigation** - No more out-of-sync pages  
✅ **Easy to Extend** - Add CSR nav items the same way  

## Future: CSR Navigation

When we build more CSR pages, just add to the config:
```javascript
const NAV_CONFIGS = {
  csr: [
    { icon: '🔍', label: 'Search', href: 'csr.html' },
    { icon: '📊', label: 'Activity', href: 'activity.html', needsMemberId: true },
    { icon: '💰', label: 'Balances', href: 'balances.html', needsMemberId: true }
  ]
}
```

The `needsMemberId: true` flag tells lp-nav.js to append `?memberId=XXX` automatically!

## Installation

Just copy lp-nav.js once:
```bash
cp ~/Downloads/lp-nav.js ~/Projects/Loyalty-Demo/
```

Then copy all the updated admin pages. They're now wired to use it.

## This is Best Practice! 🎯

**Component-based thinking in vanilla JS.** Modern frameworks like React do this with components. We're doing it the smart way with plain JavaScript.
