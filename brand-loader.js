/**
 * brand-loader.js - Tenant Branding System
 * 
 * Include this in any page to apply tenant-specific branding.
 * Loads branding from localStorage first (no flash), then refreshes from API.
 * 
 * Usage: <script src="brand-loader.js"></script>
 * 
 * Expects window.TENANT_ID to be set before this script runs.
 * Falls back to tenant_id from localStorage or defaults to 1.
 * 
 * Branding includes:
 * - Colors: primary, accent (with auto-derived dark/light variants)
 * - Logo: url, alt text
 * - Text: company_name
 */

(function() {
  'use strict';
  
  const CACHE_KEY = 'tenant_branding';
  const CACHE_TENANT_KEY = 'tenant_branding_tenant_id';
  
  // Get tenant ID from window, sessionStorage, or default
  function getTenantId() {
    if (typeof window.TENANT_ID !== 'undefined') {
      return window.TENANT_ID;
    }
    const stored = sessionStorage.getItem('tenant_id');
    return stored ? parseInt(stored) : 1;
  }
  
  // Darken a hex color by a percentage (0-100)
  function darkenColor(hex, percent) {
    if (!hex || hex.charAt(0) !== '#') return hex;
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }
  
  // Lighten a hex color by a percentage (0-100)
  function lightenColor(hex, percent) {
    if (!hex || hex.charAt(0) !== '#') return hex;
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }
  
  // Convert hex to rgba with alpha
  function hexToRgba(hex, alpha) {
    if (!hex || hex.charAt(0) !== '#') return hex;
    const num = parseInt(hex.replace('#', ''), 16);
    const R = num >> 16;
    const G = (num >> 8) & 0x00FF;
    const B = num & 0x0000FF;
    return `rgba(${R}, ${G}, ${B}, ${alpha})`;
  }
  
  // Apply branding to CSS variables and data-brand elements
  function applyBranding(branding) {
    if (!branding) return;
    
    const root = document.documentElement;
    
    // Apply colors if present
    if (branding.colors) {
      const primary = branding.colors.primary;
      const accent = branding.colors.accent;
      
      if (primary) {
        root.style.setProperty('--primary', primary);
        root.style.setProperty('--primary-dark', darkenColor(primary, 15));
        root.style.setProperty('--primary-light', hexToRgba(primary, 0.1));
        root.style.setProperty('--primary-hover', darkenColor(primary, 10));
      }
      
      if (accent) {
        root.style.setProperty('--accent', accent);
        root.style.setProperty('--accent-dark', darkenColor(accent, 15));
        root.style.setProperty('--accent-light', hexToRgba(accent, 0.1));
      }
    }
    
    // Apply text elements via data-brand attributes
    // <span data-brand="company_name"></span>
    document.querySelectorAll('[data-brand]').forEach(el => {
      const key = el.getAttribute('data-brand');
      let value = null;
      
      // Check text.* first, then logo.*, then colors.*
      if (branding.text && branding.text[key]) {
        value = branding.text[key];
      } else if (branding.logo && branding.logo[key]) {
        value = branding.logo[key];
      } else if (branding.colors && branding.colors[key]) {
        value = branding.colors[key];
      }
      
      if (value !== null) {
        if (el.tagName === 'IMG') {
          el.src = value;
        } else {
          el.textContent = value;
        }
      }
    });
    
    // Apply logo if present
    if (branding.logo && branding.logo.url) {
      document.querySelectorAll('[data-brand-logo]').forEach(el => {
        if (el.tagName === 'IMG') {
          el.src = branding.logo.url;
          if (branding.logo.alt) el.alt = branding.logo.alt;
        }
      });
    }

    // Browser tab icon (v134). Every tenant's branding carries a favicon;
    // the platform's 105 pages carried NONE before this, so the tab icon is
    // set here rather than in 105 <head>s. Runs cache-first like the rest of
    // branding, so switching programs updates the tab on the next page load.
    // A page that declares its own icon in markup wins (the brochure does).
    if (branding.logo && branding.logo.favicon) {
      var iconLink = document.querySelector('link[rel~="icon"][data-brand-favicon]');
      if (!iconLink) {
        iconLink = document.querySelector('link[rel~="icon"]');
        // Someone else's hardcoded icon — leave it alone
        if (iconLink && !iconLink.hasAttribute('data-brand-favicon')) iconLink = null;
        else if (!iconLink) {
          iconLink = document.createElement('link');
          iconLink.rel = 'icon';
          iconLink.setAttribute('data-brand-favicon', '');
          document.head.appendChild(iconLink);
        }
      }
      if (iconLink && iconLink.getAttribute('href') !== branding.logo.favicon) {
        iconLink.href = branding.logo.favicon;
      }
    }
    
    // Update page title if company name is set
    if (branding.text && branding.text.company_name) {
      const baseTitle = document.title.replace(/^[^-]+ - /, '');
      document.title = `${branding.text.company_name} - ${baseTitle}`;
    }
    
    // Store for other scripts to access
    window.TENANT_BRANDING = branding;
    
    // Dispatch event for any listeners (both new and legacy)
    window.dispatchEvent(new CustomEvent('brandingLoaded', { detail: branding }));
    document.dispatchEvent(new CustomEvent('branding:ready', { detail: branding }));
  }
  
  // Load branding from cache (synchronous, runs immediately)
  function loadFromCache() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTenant = localStorage.getItem(CACHE_TENANT_KEY);
      const currentTenant = getTenantId();
      
      // Only use cache if it's for the same tenant
      if (cached && cachedTenant === String(currentTenant)) {
        const branding = JSON.parse(cached);
        applyBranding(branding);
        return branding;
      }
    } catch (e) {
      console.warn('Failed to load branding from cache:', e);
    }
    return null;
  }
  
  // Fetch fresh branding from API (async, runs in background)
  async function fetchBranding() {
    const tenantId = getTenantId();
    
    try {
      const response = await fetch(`/v1/tenants/${tenantId}/branding`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const branding = await response.json();
      
      // Cache it
      localStorage.setItem(CACHE_KEY, JSON.stringify(branding));
      localStorage.setItem(CACHE_TENANT_KEY, String(tenantId));
      
      // Apply it
      applyBranding(branding);
      
      return branding;
    } catch (e) {
      console.warn('Failed to fetch branding:', e);
      return null;
    }
  }
  
  // Clear branding cache (call when tenant changes or branding is updated)
  function clearBrandingCache() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TENANT_KEY);
  }
  
  // Get current branding (from cache or window)
  function getBranding() {
    return window.TENANT_BRANDING || {};
  }
  
  // Expose functions globally
  window.BrandLoader = {
    apply: applyBranding,
    fetch: fetchBranding,
    get: getBranding,
    clearCache: clearBrandingCache,
    getTenantId: getTenantId,
    darkenColor: darkenColor,
    lightenColor: lightenColor,
    hexToRgba: hexToRgba
  };
  
  // Legacy compatibility
  window.Branding = {
    get: getBranding,
    apply: applyBranding,
    load: fetchBranding
  };
  
  // Initialize: load from cache immediately, then fetch fresh
  loadFromCache();
  
  // Fetch fresh after DOM is ready (non-blocking)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchBranding);
  } else {
    // DOM already ready, fetch after a tiny delay to not block rendering
    setTimeout(fetchBranding, 10);
  }
  
})();

// ============================================
// GLOBAL 401 INTERCEPTOR
// If any fetch returns 401 (session expired),
// redirect to login page automatically.
// ============================================
(function() {
  const _originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await _originalFetch.apply(this, args);
    if (response.status === 401) {
      const data = await response.clone().json().catch(() => ({}));
      // Match ALL of the platform's "not logged in" wordings, not one:
      // a 401 whose body said 'Login required' used to slip past this,
      // leaving the stale local cache in place for the login page to
      // trust — half of the S166 redirect loop. Credential failures
      // ('Invalid...') deliberately do NOT match: a wrong password on
      // the login form must not flash the session-expired modal.
      // THE one 401 interceptor (S166 consolidation): auth.js used to
      // carry a twin that had drifted (different wordings, different
      // clears) and the drift half-hid a login redirect loop. This copy
      // survives because brand-loader is on every page; auth.js's was
      // deleted. Clear ALL the session keys — stale tenant keys with a
      // dead session are the S163 wrong-tenant hazard.
      if (data.code === 'AUTH_REQUIRED' || /^(authentication|login|session) required|^not authenticated/i.test(data.error || '')) {
        ['lp_session', 'tenant_id', 'tenant_key', 'tenant_name', 'vertical_key']
          .forEach(k => sessionStorage.removeItem(k));
        // Show session expired modal instead of raw redirect — but NEVER
        // on the login page itself: its session-verify probe (S166 loop
        // fix) legitimately 401s there, and the user is already exactly
        // where the modal's button would send them.
        if (window.location.pathname.endsWith('/login.html')) return response;
        if (!document.getElementById('lp-session-expired-modal')) {
          const modal = document.createElement('div');
          modal.id = 'lp-session-expired-modal';
          modal.innerHTML = `
            <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;">
              <div style="background:#fff;border-radius:8px;padding:40px 50px;max-width:420px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
                <div style="font-size:36px;margin-bottom:16px;">🔒</div>
                <h2 style="margin:0 0 12px;font-size:20px;color:#333;">Session Expired</h2>
                <p style="margin:0 0 24px;color:#666;font-size:14px;line-height:1.5;">For your protection, you have been logged out due to inactivity. Please log back in to continue.</p>
                <button onclick="window.location.href='/login.html'" style="background:#2563eb;color:#fff;border:none;padding:12px 32px;border-radius:6px;font-size:15px;cursor:pointer;font-weight:500;">Log In</button>
              </div>
            </div>`;
          document.body.appendChild(modal);
        }
      }
    }
    return response;
  };
})();
