/**
 * Loyalty Platform - Shared Header Component
 * Usage: Include this script, then call LPHeader.init({ area: 'csr' })
 *
 * area values and their required roles:
 *   'client-admin' → requireAdmin()
 *   'admin'        → requireAdmin()
 *   'system'       → requireSuperuser()
 *   'csr'          → requireAuth()
 *   anything else  → requireAuth()
 */

const LPHeader = {
  areas: [
    { id: 'csr', label: 'CSR', icon: '👤', href: 'csr_member.html', description: 'Member service' },
    { id: 'client-admin', label: 'Client Admin', icon: '⚙️', href: 'admin.html', description: 'Program configuration' },
    { id: 'admin', label: 'Admin', icon: '🔧', href: 'super_user.html', description: 'System diagnostics' },
    { id: 'member-demo', label: 'Member Demo', icon: '🏠', href: 'index.html', description: 'Public-facing demo' }
  ],

  currentArea: null,

  init(options = {}) {
    this.currentArea = options.area || 'csr';
    this._ensureAuth(() => {
      const area = this.currentArea;
      if (area === 'client-admin') {
        if (!Auth.requireAdmin()) return;
      } else if (area === 'admin') {
        if (!Auth.requireSuperuser()) return;
      } else {
        if (!Auth.requireAuth()) return;
      }
      this.render();
      this.bindEvents();
    });
  },

  // Load auth.js dynamically if not already on the page
  _ensureAuth(callback) {
    if (typeof Auth !== 'undefined') {
      callback();
      return;
    }
    const script = document.createElement('script');
    script.src = 'auth.js';
    script.onload = callback;
    script.onerror = () => { window.location.href = 'login.html'; };
    document.head.appendChild(script);
  },

  render() {
    // Get branding info
    const branding = window.TENANT_BRANDING || {};
    const logoUrl = branding.logo?.url || '';
    const logoAlt = branding.logo?.alt || 'Loyalty Platform';
    const companyName = branding.text?.company_name || 'Loyalty Platform';
    
    // Create header HTML
    const header = document.createElement('header');
    header.className = 'lp-header';
    header.innerHTML = `
      <div class="lp-header-left">
        <button class="lp-app-switcher" id="lpAppSwitcher" title="Switch area">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
            <rect x="1" y="1" width="4" height="4" rx="1"/>
            <rect x="7" y="1" width="4" height="4" rx="1"/>
            <rect x="13" y="1" width="4" height="4" rx="1"/>
            <rect x="1" y="7" width="4" height="4" rx="1"/>
            <rect x="7" y="7" width="4" height="4" rx="1"/>
            <rect x="13" y="7" width="4" height="4" rx="1"/>
            <rect x="1" y="13" width="4" height="4" rx="1"/>
            <rect x="7" y="13" width="4" height="4" rx="1"/>
            <rect x="13" y="13" width="4" height="4" rx="1"/>
          </svg>
        </button>
        ${logoUrl ? `<img src="${logoUrl}" alt="${logoAlt}" class="lp-logo">` : `<span class="lp-brand">${companyName}</span>`}
        <span class="lp-area-divider">|</span>
        <span class="lp-current-area" id="lpCurrentArea">${this.getCurrentAreaLabel()}</span>
      </div>
      
      <!-- Member info container (populated by MemberHeader.initInline) -->
      <div id="member-nav-container" class="lp-header-right"></div>
      
      <!-- App Switcher Dropdown -->
      <div class="lp-app-menu" id="lpAppMenu">
        <div class="lp-app-menu-header">Switch to</div>
        <div class="lp-app-grid">
          ${this.areas.map(area => `
            <a href="${area.href}" class="lp-app-item ${area.id === this.currentArea ? 'active' : ''}">
              <span class="lp-app-icon">${area.icon}</span>
              <span class="lp-app-label">${area.label}</span>
              <span class="lp-app-desc">${area.description}</span>
            </a>
          `).join('')}
          <a href="#" class="lp-app-item" onclick="LPHeader.openAbout(event)">
            <span class="lp-app-icon">ℹ️</span>
            <span class="lp-app-label">About</span>
            <span class="lp-app-desc">Tenant, version &amp; session info</span>
          </a>
        </div>
      </div>

      <!-- About Modal -->
      <div id="lpAboutModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:99999;align-items:center;justify-content:center;">
        <div style="background:white;border-radius:8px;padding:24px;min-width:340px;max-width:480px;box-shadow:0 20px 40px rgba(0,0,0,0.3);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #e5e7eb;padding-bottom:12px;">
            <span style="font-size:16px;font-weight:700;color:#1e293b;">ℹ️ About</span>
            <button onclick="LPHeader.closeAbout()" style="background:none;border:none;font-size:20px;color:#9ca3af;cursor:pointer;">✕</button>
          </div>
          <div id="lpAboutContent" style="font-size:13px;color:#374151;line-height:2;">Loading...</div>
        </div>
      </div>
      
    `;

    // Insert at top of body
    document.body.insertBefore(header, document.body.firstChild);
    
    // Add styles
    this.injectStyles();
  },

  getCurrentAreaLabel() {
    const area = this.areas.find(a => a.id === this.currentArea);
    return area ? area.label : 'Loyalty Platform';
  },

  openAbout(e) {
    if (e) e.preventDefault();
    document.getElementById('lpAppMenu').classList.remove('open');
    const modal = document.getElementById('lpAboutModal');
    modal.style.display = 'flex';

    const API_BASE = window.LP_STATE?.apiBase || window.location.origin;
    const tenantId   = sessionStorage.getItem('tenant_id') || '—';
    const tenantName = sessionStorage.getItem('tenant_name') || '—';
    const session    = JSON.parse(sessionStorage.getItem('lp_session') || '{}');
    const user       = session.userName || session.username || '—';

    fetch(`${API_BASE}/v1/version`)
      .then(r => r.json())
      .then(v => {
        document.getElementById('lpAboutContent').innerHTML = `
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:4px 0;color:#6b7280;width:130px;">Tenant</td><td style="font-weight:600;">${tenantName}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">Tenant ID</td><td style="font-weight:600;">${tenantId}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">User</td><td style="font-weight:600;">${user}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">Server Version</td><td style="font-weight:600;font-family:monospace;">${v.version}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">Database</td><td style="font-weight:600;font-family:monospace;">${v.database || '—'}</td></tr>
          </table>`;
      })
      .catch(() => {
        document.getElementById('lpAboutContent').innerHTML = `
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:4px 0;color:#6b7280;width:130px;">Tenant</td><td style="font-weight:600;">${tenantName}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">Tenant ID</td><td style="font-weight:600;">${tenantId}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">User</td><td style="font-weight:600;">${user}</td></tr>
            <tr><td style="padding:4px 0;color:#ef4444;">Version</td><td style="color:#ef4444;">Server unavailable</td></tr>
          </table>`;
      });
  },

  closeAbout() {
    document.getElementById('lpAboutModal').style.display = 'none';
  },

  bindEvents() {
    // App switcher toggle
    const switcher = document.getElementById('lpAppSwitcher');
    const appMenu = document.getElementById('lpAppMenu');
    
    switcher.addEventListener('click', (e) => {
      e.stopPropagation();
      appMenu.classList.toggle('open');
      document.getElementById('lpTenantMenu').classList.remove('open');
    });

    // Close dropdown on outside click
    document.addEventListener('click', () => {
      appMenu.classList.remove('open');
    });

    // Prevent menu clicks from closing
    appMenu.addEventListener('click', (e) => e.stopPropagation());

    // Update logo/name when branding loads async
    window.addEventListener('brandingLoaded', (e) => {
      const branding = e.detail || {};
      const logoUrl     = branding.logo?.url || '';
      const logoAlt     = branding.logo?.alt || 'Loyalty Platform';
      const companyName = branding.text?.company_name || 'Loyalty Platform';
      const brandEl = document.querySelector('.lp-logo, .lp-brand');
      if (!brandEl) return;
      if (logoUrl) {
        if (brandEl.tagName === 'IMG') {
          brandEl.src = logoUrl;
          brandEl.alt = logoAlt;
        } else {
          const img = document.createElement('img');
          img.src = logoUrl;
          img.alt = logoAlt;
          img.className = 'lp-logo';
          brandEl.replaceWith(img);
        }
      } else {
        if (brandEl.tagName === 'IMG') {
          const span = document.createElement('span');
          span.className = 'lp-brand';
          span.textContent = companyName;
          brandEl.replaceWith(span);
        } else {
          brandEl.textContent = companyName;
        }
      }
    });
  },

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      body {
        padding-top: 48px !important;
      }
      
      .lp-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 48px;
        background: var(--primary, #1e293b);
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        z-index: 1000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .lp-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .lp-header-right {
        display: flex;
        align-items: center;
        margin-left: auto;
      }
      
      .lp-app-switcher {
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.8);
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .lp-app-switcher:hover {
        background: rgba(255,255,255,0.1);
        color: white;
      }
      
      .lp-brand {
        font-weight: 600;
        font-size: 15px;
        color: white;
      }
      
      .lp-logo {
        height: 28px;
        width: auto;
        max-width: 150px;
        object-fit: contain;
      }
      
      .lp-area-divider {
        color: rgba(255,255,255,0.3);
        font-weight: 300;
      }
      
      .lp-current-area {
        font-size: 14px;
        color: rgba(255,255,255,0.9);
      }
      
      /* App Switcher Menu */
      .lp-app-menu {
        position: fixed;
        top: 48px;
        left: 8px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        display: none;
        min-width: 280px;
        z-index: 1001;
      }
      
      .lp-app-menu.open {
        display: block;
      }
      
      .lp-app-menu-header {
        padding: 12px 16px;
        font-size: 12px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid #e2e8f0;
      }
      
      .lp-app-grid {
        padding: 8px;
      }
      
      .lp-app-item {
        display: grid;
        grid-template-columns: 40px 1fr;
        grid-template-rows: auto auto;
        gap: 2px 12px;
        padding: 12px;
        text-decoration: none;
        color: #1e293b;
        border-radius: 6px;
        transition: background 0.15s;
      }
      
      .lp-app-item:hover {
        background: #f1f5f9;
      }
      
      .lp-app-item.active {
        background: #eff6ff;
      }
      
      .lp-app-icon {
        grid-row: span 2;
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .lp-app-label {
        font-weight: 600;
        font-size: 14px;
      }
      
      .lp-app-desc {
        font-size: 12px;
        color: #64748b;
      }
    `;
    document.head.appendChild(style);
  }
};
