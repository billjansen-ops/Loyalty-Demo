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
    { id: 'csr', label: 'CSR', icon: '👤', href: '/csr_member.html', description: 'Member service' },
    { id: 'client-admin', label: 'Client Admin', icon: '⚙️', href: '/admin.html', description: 'Program configuration' },
    { id: 'admin', label: 'Admin', icon: '🔧', href: '/super_user.html', description: 'System diagnostics' },
    { id: 'menu', label: 'Menu', icon: '📋', href: '/menu.html', description: 'All admin pages' },
    { id: 'tenant', label: '{{TENANT}}', icon: '🏢', href: 'dashboard.html', description: '{{TENANT}} tools' }
  ],

  currentArea: null,

  init(options = {}) {
    this.currentArea = options.area || 'csr';
    this.subtitle = options.subtitle || null;
    this.showBell = options.showBell || false;
    this.programId = options.programId || null;
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
    script.src = '/auth.js';
    script.onload = callback;
    script.onerror = () => { window.location.href = '/login.html'; };
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
        ${this.subtitle ? `<span class="lp-area-divider">|</span><span class="lp-header-subtitle" id="lpHeaderSubtitle" style="font-size:13px;color:rgba(255,255,255,0.7);font-weight:400">${this.subtitle}</span>` : '<span class="lp-header-subtitle" id="lpHeaderSubtitle" style="font-size:13px;color:rgba(255,255,255,0.7);font-weight:400;display:none"></span>'}
      </div>
      
      <!-- Notification bell (clinic-scoped pages only) -->
      <div class="lp-notify-area" style="${this.showBell ? '' : 'display:none'}">
        <button class="lp-notify-bell" id="lpNotifyBell" title="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span class="lp-notify-badge" id="lpNotifyBadge" style="display:none">0</span>
        </button>
        <!-- Notification dropdown -->
        <div class="lp-notify-panel" id="lpNotifyPanel">
          <div class="lp-notify-panel-header">
            <span>Notifications</span>
            <button class="lp-notify-mark-all" id="lpNotifyMarkAll" title="Mark all read">Mark all read</button>
          </div>
          <div class="lp-notify-list" id="lpNotifyList">
            <div class="lp-notify-empty">No notifications</div>
          </div>
        </div>
      </div>

      <!-- Member info container (populated by MemberHeader.initInline) -->
      <div id="member-nav-container" class="lp-header-right"></div>
      
      <!-- App Switcher Dropdown -->
      <div class="lp-app-menu" id="lpAppMenu">
        <div class="lp-app-menu-header">Switch to</div>
        <div class="lp-app-grid">
          ${this.areas.filter(area => {
            const role = Auth.getRole();
            if (area.id === 'admin') return role === 'superuser';
            if (area.id === 'client-admin') return role === 'superuser';
            if (area.id === 'csr') return role === 'superuser';
            if (area.id === 'tenant') return Auth.getTenantId() != null;
            return true;
          }).map(area => {
            const label = area.label.replace('{{TENANT}}', branding.text?.company_name || 'Tenant');
            const desc = area.description.replace('{{TENANT}}', branding.text?.company_name || 'Tenant');
            return `
            <a href="${area.href}" data-area-id="${area.id}" class="lp-app-item ${area.id === this.currentArea ? 'active' : ''}">
              <span class="lp-app-icon">${area.icon}</span>
              <span class="lp-app-label">${label}</span>
              <span class="lp-app-desc">${desc}</span>
            </a>
          `}).join('')}
          <a href="#" class="lp-app-item" onclick="LPHeader.openAbout(event)">
            <span class="lp-app-icon">ℹ️</span>
            <span class="lp-app-label">About</span>
            <span class="lp-app-desc">Tenant, version &amp; session info</span>
          </a>
          <a href="#" class="lp-app-item" onclick="LPHeader.logout(event)" style="border-top:1px solid #e2e8f0;margin-top:4px;padding-top:12px;">
            <span class="lp-app-icon">🚪</span>
            <span class="lp-app-label">Log Out</span>
            <span class="lp-app-desc">End your session</span>
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
    if (!area) return 'Loyalty Platform';
    const branding = window.TENANT_BRANDING || {};
    return area.label.replace('{{TENANT}}', branding.text?.company_name || 'Tenant');
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
            <tr><td style="padding:4px 0;color:#6b7280;">DB Version</td><td style="font-weight:600;font-family:monospace;">${v.db_version || '—'}</td></tr>
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

  logout(e) {
    if (e) e.preventDefault();
    if (typeof Auth !== 'undefined' && Auth.logout) {
      Auth.logout();
    } else {
      sessionStorage.clear();
      window.location.href = '/login.html';
    }
  },

  // ── Notification helpers ──

  _notifyApiBase() {
    return window.LP_STATE?.apiBase || window.location.origin;
  },

  async fetchNotifications() {
    try {
      const r = await fetch(`${this._notifyApiBase()}/v1/notifications?limit=30`, { credentials: 'include' });
      if (!r.ok) return;
      const data = await r.json();
      this._renderNotifications(data);
    } catch(e) { /* silent */ }
  },

  _renderNotifications(data) {
    const badge = document.getElementById('lpNotifyBadge');
    const list = document.getElementById('lpNotifyList');
    if (!badge || !list) return;

    // Badge — urgent (pulsing) when critical unread notifications exist
    const bell = document.getElementById('lpNotifyBell');
    if (data.unread_count > 0) {
      badge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
      badge.style.display = 'flex';
      if (data.has_critical) {
        bell?.classList.add('lp-notify-bell-critical');
        badge.classList.add('lp-notify-badge-pulse');
      } else {
        bell?.classList.remove('lp-notify-bell-critical');
        badge.classList.remove('lp-notify-badge-pulse');
      }
    } else {
      badge.style.display = 'none';
      bell?.classList.remove('lp-notify-bell-critical');
      badge.classList.remove('lp-notify-badge-pulse');
    }

    // List
    if (!data.notifications || data.notifications.length === 0) {
      list.innerHTML = '<div class="lp-notify-empty">No notifications</div>';
      return;
    }

    list.innerHTML = data.notifications.map(n => `
      <div class="lp-notify-item ${n.is_read ? '' : 'unread'} ${n.severity === 'critical' ? 'critical' : ''}"
           data-id="${n.notification_id}"
           data-page="${n.source_page || ''}"
           data-source-link="${n.source_link || ''}"
           data-member-link="${n.member_link || ''}"
           data-event-type="${n.event_type || ''}"
           onclick="LPHeader.clickNotification(this)">
        <div class="lp-notify-severity ${n.severity}"></div>
        <div class="lp-notify-content">
          <div class="lp-notify-title">${this._esc(n.title)}</div>
          ${n.body ? `<div class="lp-notify-body">${this._esc(n.body)}</div>` : ''}
          <div class="lp-notify-time">${this._timeAgo(n.created_at)}</div>
        </div>
      </div>
    `).join('');
  },

  _esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  _timeAgo(ts) {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
    return new Date(ts).toLocaleDateString();
  },

  async clickNotification(el) {
    const id = el.dataset.id;
    const page = el.dataset.page;
    const sourceLink = el.dataset.sourceLink;

    // Mark read
    if (el.classList.contains('unread')) {
      el.classList.remove('unread');
      // Update badge immediately client-side
      const badge = document.getElementById('lpNotifyBadge');
      if (badge) {
        const current = parseInt(badge.textContent, 10) || 0;
        if (current <= 1) {
          badge.style.display = 'none';
          const bell = document.getElementById('lpNotifyBell');
          bell?.classList.remove('lp-notify-bell-critical');
          badge.classList.remove('lp-notify-badge-pulse');
        } else {
          badge.textContent = current - 1;
        }
      }
      fetch(`${this._notifyApiBase()}/v1/notifications/${id}/read`, {
        method: 'PATCH', credentials: 'include'
      }).catch(e => console.warn('Notification mark-read error:', e.message));
    }

    // Navigate — set PageContext if going to physician_detail
    if (page) {
      if (page.includes('physician_detail') && sourceLink && typeof PageContext !== 'undefined') {
        PageContext.navigate(page, { memberId: sourceLink });
      } else {
        window.location.href = page;
      }
    }
  },

  async markAllRead() {
    try {
      // Update badge and items immediately client-side
      const badge = document.getElementById('lpNotifyBadge');
      if (badge) {
        badge.style.display = 'none';
        const bell = document.getElementById('lpNotifyBell');
        bell?.classList.remove('lp-notify-bell-critical');
        badge.classList.remove('lp-notify-badge-pulse');
      }
      document.querySelectorAll('.lp-notify-item.unread').forEach(el => el.classList.remove('unread'));

      await fetch(`${this._notifyApiBase()}/v1/notifications/read-all`, {
        method: 'PATCH', credentials: 'include'
      });
    } catch(e) { console.warn('Mark all read error:', e.message); }
  },

  bindEvents() {
    // Update tenant label in dropdown when branding loads (handles tenant switch)
    window.addEventListener('brandingLoaded', () => {
      const branding = window.TENANT_BRANDING || {};
      const name = branding.text?.company_name || 'Tenant';
      document.querySelectorAll('[data-area-id="tenant"] .lp-app-label').forEach(el => { el.textContent = name; });
      document.querySelectorAll('[data-area-id="tenant"] .lp-app-desc').forEach(el => { el.textContent = name + ' tools'; });
      // Update header bar label if tenant is the current area
      const headerLabel = document.getElementById('lpHeaderLabel');
      if (headerLabel && this.currentArea === 'tenant') {
        headerLabel.textContent = name;
      }
    });
    // App switcher toggle
    const switcher = document.getElementById('lpAppSwitcher');
    const appMenu = document.getElementById('lpAppMenu');
    const notifyBell = document.getElementById('lpNotifyBell');
    const notifyPanel = document.getElementById('lpNotifyPanel');
    const markAllBtn = document.getElementById('lpNotifyMarkAll');

    switcher.addEventListener('click', (e) => {
      e.stopPropagation();
      appMenu.classList.toggle('open');
      notifyPanel.classList.remove('open');
      document.getElementById('lpTenantMenu')?.classList.remove('open');
    });

    // Notification bell toggle
    notifyBell.addEventListener('click', (e) => {
      e.stopPropagation();
      notifyPanel.classList.toggle('open');
      appMenu.classList.remove('open');
      document.getElementById('lpTenantMenu')?.classList.remove('open');
      if (notifyPanel.classList.contains('open')) {
        this.fetchNotifications();
      }
    });

    // Mark all read
    markAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.markAllRead();
    });

    // Prevent panel clicks from closing
    notifyPanel.addEventListener('click', (e) => e.stopPropagation());

    // Close dropdown on outside click
    document.addEventListener('click', () => {
      appMenu.classList.remove('open');
      notifyPanel.classList.remove('open');
    });

    // Prevent menu clicks from closing
    appMenu.addEventListener('click', (e) => e.stopPropagation());

    // Fetch notifications on page load
    this.fetchNotifications();

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

      /* Notification Bell */
      .lp-notify-area {
        position: relative;
        margin-left: auto;
        margin-right: 8px;
      }

      .lp-notify-bell {
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.8);
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }

      .lp-notify-bell:hover {
        background: rgba(255,255,255,0.1);
        color: white;
      }

      .lp-notify-badge {
        position: absolute;
        top: 2px;
        right: 2px;
        background: #ef4444;
        color: white;
        font-size: 10px;
        font-weight: 700;
        min-width: 16px;
        height: 16px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        line-height: 1;
      }

      /* Critical/urgent bell — pulses when unread critical notifications exist */
      .lp-notify-bell-critical {
        color: #fbbf24 !important;
        animation: bellSwing 1s ease-in-out 3;
      }
      .lp-notify-badge-pulse {
        animation: badgePulse 1.5s ease-in-out infinite;
        background: #dc2626;
        box-shadow: 0 0 8px rgba(220, 38, 38, 0.6);
      }
      @keyframes bellSwing {
        0%, 100% { transform: rotate(0deg); }
        15% { transform: rotate(12deg); }
        30% { transform: rotate(-10deg); }
        45% { transform: rotate(8deg); }
        60% { transform: rotate(-6deg); }
        75% { transform: rotate(3deg); }
      }
      @keyframes badgePulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 6px rgba(220, 38, 38, 0.5); }
        50% { transform: scale(1.15); box-shadow: 0 0 12px rgba(220, 38, 38, 0.8); }
      }

      /* Critical notification items in dropdown */
      .lp-notify-item.critical.unread {
        background: #fef2f2;
        border-left: 3px solid #dc2626;
      }

      /* Notification Panel */
      .lp-notify-panel {
        position: fixed;
        top: 48px;
        right: 8px;
        width: 360px;
        max-height: 480px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        display: none;
        z-index: 1001;
        overflow: hidden;
      }

      .lp-notify-panel.open {
        display: flex;
        flex-direction: column;
      }

      .lp-notify-panel-header {
        padding: 12px 16px;
        font-size: 13px;
        font-weight: 700;
        color: #1e293b;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      }

      .lp-notify-mark-all {
        background: none;
        border: none;
        color: #3b82f6;
        font-size: 12px;
        cursor: pointer;
        font-weight: 500;
      }

      .lp-notify-mark-all:hover { text-decoration: underline; }

      .lp-notify-list {
        overflow-y: auto;
        flex: 1;
      }

      .lp-notify-item {
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
        cursor: pointer;
        transition: background 0.15s;
        display: flex;
        gap: 10px;
      }

      .lp-notify-item:hover { background: #f8fafc; }
      .lp-notify-item.unread { background: #eff6ff; }
      .lp-notify-item.unread:hover { background: #dbeafe; }

      .lp-notify-severity {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
        margin-top: 5px;
      }

      .lp-notify-severity.critical { background: #ef4444; }
      .lp-notify-severity.warning { background: #f59e0b; }
      .lp-notify-severity.info { background: #3b82f6; }

      .lp-notify-content { flex: 1; min-width: 0; }

      .lp-notify-title {
        font-size: 13px;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .lp-notify-body {
        font-size: 12px;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .lp-notify-time {
        font-size: 11px;
        color: #94a3b8;
        margin-top: 3px;
      }

      .lp-notify-empty {
        padding: 40px 16px;
        text-align: center;
        color: #94a3b8;
        font-size: 13px;
      }
    `;
    document.head.appendChild(style);
  }
};
