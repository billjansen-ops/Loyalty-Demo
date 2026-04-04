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
      if (data.code === 'AUTH_REQUIRED' || data.error === 'Authentication required') {
        sessionStorage.removeItem('lp_session');
        // Show session expired modal instead of raw redirect
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
