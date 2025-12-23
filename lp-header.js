/**
 * Loyalty Platform - Shared Header Component
 * Usage: Include this script, then call LPHeader.init({ area: 'csr' })
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
    this.render();
    this.bindEvents();
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
  },

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
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
