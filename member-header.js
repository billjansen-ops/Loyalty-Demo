/**
 * Member Header Component - Compact Inline Version
 * Embeds member info directly into the nav bar
 */

const MemberHeader = {
  apiBase: 'http://127.0.0.1:4001',
  _tierCache: null,

  /**
   * Render compact inline HTML for nav bar
   */
  renderInline() {
    return `
      <div class="member-inline" id="memberInline">
        <div class="member-inline-item">
          <span class="member-inline-name" id="memberName">Loading...</span>
          <span class="member-inline-id" id="memberIdValue"></span>
        </div>
        <div class="member-inline-tier" id="memberTierContainer">
          <span id="memberTier"></span>
        </div>
        <div class="member-inline-points">
          <span class="points-value" id="memberMiles">0</span>
          <span class="points-label" id="milesLabel">Miles</span>
        </div>
      </div>
    `;
  },

  /**
   * CSS for inline header in nav
   */
  getInlineCSS() {
    return `
      .member-inline {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-left: auto;
      }
      
      .member-inline-item {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        line-height: 1.2;
      }
      
      .member-inline-name {
        color: white;
        font-weight: 600;
        font-size: 14px;
      }
      
      .member-inline-id {
        color: rgba(255,255,255,0.6);
        font-size: 11px;
        font-family: 'Monaco', 'Consolas', monospace;
      }
      
      .member-inline-tier {
        display: flex;
        align-items: center;
      }
      
      .member-inline-points {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        background: rgba(255,255,255,0.15);
        padding: 4px 12px;
        border-radius: 6px;
        line-height: 1.2;
      }
      
      .points-value {
        color: white;
        font-size: 16px;
        font-weight: 700;
      }
      
      .points-label {
        color: rgba(255,255,255,0.7);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    `;
  },

  /**
   * Initialize inline version
   */
  initInline(containerId = 'member-nav-container') {
    if (!document.getElementById('member-inline-styles')) {
      const style = document.createElement('style');
      style.id = 'member-inline-styles';
      style.textContent = this.getInlineCSS();
      document.head.appendChild(style);
    }
    
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = this.renderInline();
    }
  },

  /**
   * Load member data
   */
  async load(memberId, apiBase = null) {
    if (apiBase) this.apiBase = apiBase;
    if (!memberId) return;

    try {
      const tenantId = sessionStorage.getItem('tenant_id') || '1';
      const response = await fetch(`${this.apiBase}/v1/member/${encodeURIComponent(memberId)}/profile?tenant_id=${tenantId}`);
      if (!response.ok) throw new Error('Failed to load member info');
      
      const member = await response.json();
      
      // Name
      let fullName = member.fname || 'Unknown';
      if (member.lname) fullName += ' ' + member.lname;
      
      const nameEl = document.getElementById('memberName');
      if (nameEl) nameEl.textContent = fullName;
      
      const idEl = document.getElementById('memberIdValue');
      if (idEl) idEl.textContent = member.membership_number || member.member_id;
      
      // Tier with styling
      const tierContainer = document.getElementById('memberTierContainer');
      if (member.current_tier && tierContainer) {
        const tierStyle = await this.getTierStyle(member.current_tier, tenantId);
        if (tierStyle) {
          tierContainer.innerHTML = `
            <span style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 4px 10px;
              border-radius: 9999px;
              font-size: 12px;
              font-weight: 600;
              background: ${tierStyle.badge_color};
              color: ${tierStyle.text_color};
            ">
              ${tierStyle.icon ? `<span>${tierStyle.icon}</span>` : ''}
              <span>${member.current_tier}</span>
            </span>
          `;
        } else {
          tierContainer.innerHTML = `<span style="color: white;">${member.current_tier}</span>`;
        }
      }
      
      // Points
      const milesEl = document.getElementById('memberMiles');
      if (milesEl && member.available_miles !== undefined) {
        milesEl.textContent = member.available_miles.toLocaleString();
      }
      
      await this.loadCurrencyLabel();
      
    } catch (error) {
      console.error('MemberHeader: Error loading member info:', error);
    }
  },

  async loadCurrencyLabel() {
    try {
      const tenantId = sessionStorage.getItem('tenant_id') || '1';
      const response = await fetch(`${this.apiBase}/v1/tenants/${tenantId}/labels`);
      if (!response.ok) return;
      
      const labels = await response.json();
      const milesLabelEl = document.getElementById('milesLabel');
      
      if (milesLabelEl && labels.currency_label) {
        milesLabelEl.textContent = labels.currency_label;
      }
    } catch (error) {
      console.error('MemberHeader: Error loading currency label:', error);
    }
  },

  async getTierStyle(tierName, tenantId) {
    try {
      const cacheKey = `tier_styles_${tenantId}`;
      let tiers = this._tierCache?.[cacheKey];
      
      if (!tiers) {
        const response = await fetch(`${this.apiBase}/v1/tiers?tenant_id=${tenantId}`);
        if (!response.ok) return null;
        
        tiers = await response.json();
        if (!this._tierCache) this._tierCache = {};
        this._tierCache[cacheKey] = tiers;
      }
      
      const tier = tiers.find(t => t.tier_description === tierName || t.tier_code === tierName);
      if (tier) {
        return {
          badge_color: tier.badge_color || '#6b7280',
          text_color: tier.text_color || '#ffffff',
          icon: tier.icon || null
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  // Backward compatibility
  init(containerId = 'member-header-container') {
    this.initInline('member-nav-container');
  }
};

window.MemberHeader = MemberHeader;
