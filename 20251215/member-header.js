/**
 * Member Header Component - Reusable across all CSR pages
 * 
 * Displays member info: Name, ID, Tier, Available Miles
 * Compact, consistent styling across the platform
 */

const MemberHeader = {
  apiBase: 'http://127.0.0.1:4001',

  /**
   * Render the member header HTML
   * @returns {string} HTML string
   */
  renderHTML() {
    return `
      <div class="member-header">
        <div class="member-header-content">
          <div class="member-info-item">
            <span class="member-info-label">Member</span>
            <span class="member-info-value" id="memberName">Loading...</span>
          </div>
          <div class="member-info-item">
            <span class="member-info-label">Member ID</span>
            <span class="member-info-value" id="memberIdValue">—</span>
          </div>
          <div class="member-info-item">
            <span class="member-info-label">Tier</span>
            <span class="member-info-value" id="memberTier">—</span>
          </div>
          <div class="member-info-item">
            <span class="member-info-label" id="milesLabel">Available Miles</span>
            <span class="member-info-value" id="memberMiles">0</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Get default CSS for the member header
   * @returns {string} CSS string
   */
  getCSS() {
    return `
      <style>
        .member-header {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          padding: 16px 32px;
          border-bottom: 3px solid #1e40af;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .member-header-content {
          display: flex;
          gap: 48px;
          align-items: center;
          max-width: 1400px;
        }
        
        .member-info-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .member-info-label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .member-info-value {
          color: white;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
      </style>
    `;
  },

  /**
   * Initialize member header - inject CSS and HTML
   * @param {string} containerId - ID of container element to inject HTML into
   */
  init(containerId = 'member-header-container') {
    // Inject CSS if not already present
    if (!document.getElementById('member-header-styles')) {
      const style = document.createElement('style');
      style.id = 'member-header-styles';
      style.textContent = this.getCSS().replace(/<\/?style>/g, '');
      document.head.appendChild(style);
    }
    
    // Inject HTML
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = this.renderHTML();
    } else {
      console.error(`MemberHeader: Container #${containerId} not found`);
    }
  },

  /**
   * Load and display member information
   * @param {string} memberId - Member ID
   * @param {string} apiBase - Optional API base URL
   */
  async load(memberId, apiBase = null) {
    if (apiBase) this.apiBase = apiBase;
    
    if (!memberId) {
      console.error('MemberHeader: No member ID provided');
      return;
    }

    try {
      // Load member info (using profile endpoint)
      const tenantId = sessionStorage.getItem('tenant_id') || '1';
      const response = await fetch(`${this.apiBase}/v1/member/${encodeURIComponent(memberId)}/profile?tenant_id=${tenantId}`);
      if (!response.ok) throw new Error('Failed to load member info');
      
      const member = await response.json();
      
      // Update display - construct full name from parts
      let fullName = '';
      if (member.fname) {
        fullName = member.fname;
        if (member.lname) {
          fullName += ' ' + member.lname;
        }
      } else {
        fullName = 'Unknown Member';
      }
      
      document.getElementById('memberName').textContent = fullName;
      document.getElementById('memberIdValue').textContent = member.membership_number || member.member_id;
      
      // Tier
      const tierEl = document.getElementById('memberTier');
      if (member.current_tier) {
        tierEl.textContent = member.current_tier;
      } else {
        tierEl.textContent = 'Base';
      }
      
      // Miles
      const milesEl = document.getElementById('memberMiles');
      if (member.available_miles !== undefined) {
        milesEl.textContent = member.available_miles.toLocaleString();
      }
      
      // Update miles label with tenant-specific currency (with "Available" prefix)
      await this.loadCurrencyLabel();
      
    } catch (error) {
      console.error('MemberHeader: Error loading member info:', error);
      document.getElementById('memberName').textContent = 'Error loading member';
    }
  },

  /**
   * Load tenant-specific currency label
   */
  async loadCurrencyLabel() {
    try {
      const tenantId = sessionStorage.getItem('tenant_id') || '1';
      const response = await fetch(`${this.apiBase}/v1/tenants/${tenantId}/labels`);
      if (!response.ok) return;
      
      const labels = await response.json();
      const milesLabelEl = document.getElementById('milesLabel');
      
      if (milesLabelEl && labels.currency_label) {
        milesLabelEl.textContent = `Available ${labels.currency_label}`;
      }
    } catch (error) {
      console.error('MemberHeader: Error loading currency label:', error);
    }
  }
};

// Make it available globally
window.MemberHeader = MemberHeader;
