// member-search.js - Modal search component
// Pops up over current page, find member, close

const MemberSearch = {
  callback: null,
  apiBase: 'http://localhost:4001',

  // Open search modal
  open: function(callback) {
    this.callback = callback;
    this.apiBase = window.LP_STATE?.apiBase || 'http://localhost:4001';
    
    // Remove existing modal if any
    const existing = document.getElementById('memberSearchOverlay');
    if (existing) existing.remove();
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'memberSearchOverlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); display: flex;
      align-items: center; justify-content: center; z-index: 10000;
    `;
    overlay.innerHTML = `
      <div style="background: white; border-radius: 8px; max-width: 500px; width: 90%;
                  max-height: 90vh; display: flex; flex-direction: column;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
        <div style="display: flex; justify-content: space-between; align-items: center;
                    padding: 12px 16px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;">
          <div style="font-size: 16px; font-weight: 600;">Find Member</div>
          <button id="memberSearchClose" style="padding: 4px 8px; background: none;
                  border: none; cursor: pointer; font-size: 18px; color: #6b7280;">✕</button>
        </div>
        <div style="padding: 16px; overflow-y: auto;">
          ${this.getFormHTML()}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    // Close handlers
    document.getElementById('memberSearchClose').onclick = () => this.close();
    overlay.onclick = (e) => { if (e.target === overlay) this.close(); };
    document.addEventListener('keydown', this.escHandler);
    
    this.attachEvents();
    
    // Focus first field
    document.getElementById('msMemberNumber').focus();
  },

  escHandler: function(e) {
    if (e.key === 'Escape') MemberSearch.close();
  },

  close: function() {
    const overlay = document.getElementById('memberSearchOverlay');
    if (overlay) overlay.remove();
    const resultsOverlay = document.getElementById('msResultsOverlay');
    if (resultsOverlay) resultsOverlay.remove();
    document.removeEventListener('keydown', this.escHandler);
  },

  getFormHTML: function() {
    return `
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">Member Number</label>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="msMemberNumber" placeholder="e.g., DL847293"
                 style="flex: 1; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;">
          <button id="msSearchNum" style="padding: 8px 16px; background: #2563eb; color: white;
                  border: none; border-radius: 4px; font-weight: 500; cursor: pointer; font-size: 13px;">Search</button>
        </div>
      </div>

      <div style="text-align: center; color: #9ca3af; font-size: 12px; margin: 12px 0;">— or search by —</div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
        <div>
          <label style="display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">First Name</label>
          <input type="text" id="msFirstName" placeholder="John"
                 style="width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </div>
        <div>
          <label style="display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">Last Name</label>
          <input type="text" id="msLastName" placeholder="Smith"
                 style="width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
        <div>
          <label style="display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">Email</label>
          <input type="email" id="msEmail" placeholder="john@example.com"
                 style="width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </div>
        <div>
          <label style="display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">Phone</label>
          <input type="tel" id="msPhone" placeholder="612-555-1234"
                 style="width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </div>
      </div>

      <button id="msSearchAdv" style="width: 100%; padding: 10px; background: #f3f4f6; color: #374151;
              border: 1px solid #d1d5db; border-radius: 4px; font-weight: 500; cursor: pointer; font-size: 13px;">Search</button>

      <div id="msError" style="display: none; margin-top: 10px; padding: 8px 10px; background: #fef2f2;
           color: #dc2626; border-radius: 4px; font-size: 13px;"></div>
    `;
  },

  attachEvents: function() {
    const self = this;
    
    // Member number search
    document.getElementById('msSearchNum').onclick = () => self.searchByNumber();
    document.getElementById('msMemberNumber').onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); self.searchByNumber(); }
    };
    
    // Advanced search
    document.getElementById('msSearchAdv').onclick = () => self.searchAdvanced();
    ['msFirstName', 'msLastName', 'msEmail', 'msPhone'].forEach(id => {
      document.getElementById(id).onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); self.searchAdvanced(); }
      };
    });
  },

  searchByNumber: function() {
    const num = document.getElementById('msMemberNumber').value.trim();
    if (!num) {
      this.showError('Please enter a member number');
      return;
    }
    this.doSearch({ membership_number: num });
  },

  searchAdvanced: function() {
    const fname = document.getElementById('msFirstName').value.trim();
    const lname = document.getElementById('msLastName').value.trim();
    const email = document.getElementById('msEmail').value.trim();
    const phone = document.getElementById('msPhone').value.trim();
    
    if (!fname && !lname && !email && !phone) {
      this.showError('Please enter at least one search field');
      return;
    }
    
    this.doSearch({ fname, lname, email, phone });
  },

  doSearch: async function(params) {
    this.clearError();
    
    // Get tenant_id from LP_STATE or sessionStorage
    const tenantId = window.LP_STATE?.tenantId || sessionStorage.getItem('tenant_id') || 1;
    
    const queryParams = new URLSearchParams();
    queryParams.append('tenant_id', tenantId);
    if (params.membership_number) queryParams.append('membership_number', params.membership_number);
    if (params.fname) queryParams.append('fname', params.fname);
    if (params.lname) queryParams.append('lname', params.lname);
    if (params.email) queryParams.append('email', params.email);
    if (params.phone) queryParams.append('phone', params.phone);

    try {
      const response = await fetch(`${this.apiBase}/v1/member/search?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Search failed');
      
      const members = await response.json();
      
      if (!Array.isArray(members) || members.length === 0) {
        this.showError('No members found');
        return;
      }

      if (members.length === 1) {
        this.selectMember(members[0]);
        return;
      }

      this.showResults(members);

    } catch (err) {
      console.error('Search error:', err);
      this.showError('Search failed. Please try again.');
    }
  },

  showResults: function(members) {
    const existing = document.getElementById('msResultsOverlay');
    if (existing) existing.remove();

    const self = this;
    
    const overlay = document.createElement('div');
    overlay.id = 'msResultsOverlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); display: flex;
      align-items: center; justify-content: center; z-index: 10001;
    `;
    
    const rows = members.map((m, idx) => {
      const name = `${m.fname || ''} ${m.lname || ''}`.trim() || '—';
      const num = m.membership_number || '—';
      const email = m.email || '—';
      return `
        <tr data-idx="${idx}" style="border-bottom: 1px solid #f3f4f6; cursor: pointer;">
          <td style="padding: 10px 12px; font-size: 14px;">${name}</td>
          <td style="padding: 10px 12px; font-size: 14px; font-family: monospace;">${num}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">${email}</td>
        </tr>
      `;
    }).join('');

    overlay.innerHTML = `
      <div style="background: white; border-radius: 8px; max-width: 600px; width: 90%;
                  max-height: 80vh; display: flex; flex-direction: column;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
        <div style="display: flex; justify-content: space-between; align-items: center;
                    padding: 12px 16px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;">
          <div style="font-size: 14px; font-weight: 600;">${members.length} members found</div>
          <button id="msResultsClose" style="padding: 4px 8px; background: none;
                  border: none; cursor: pointer; font-size: 18px; color: #6b7280;">✕</button>
        </div>
        <div style="overflow-y: auto; flex: 1;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Name</th>
                <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Member #</th>
                <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Email</th>
              </tr>
            </thead>
            <tbody id="msResultsBody">${rows}</tbody>
          </table>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('msResultsClose').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    
    // Row hover and click
    const tableRows = overlay.querySelectorAll('tbody tr');
    tableRows.forEach(row => {
      row.onmouseover = () => row.style.background = '#f9fafb';
      row.onmouseout = () => row.style.background = 'white';
      row.onclick = () => {
        const idx = parseInt(row.dataset.idx);
        overlay.remove();
        self.selectMember(members[idx]);
      };
    });
  },

  selectMember: function(member) {
    this.close();
    if (this.callback) {
      this.callback(member);
    }
  },

  showError: function(msg) {
    const el = document.getElementById('msError');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  },

  clearError: function() {
    const el = document.getElementById('msError');
    if (el) el.style.display = 'none';
  }
};

window.MemberSearch = MemberSearch;
