// member-search.js - Single member search component
// Use embedded in a page OR as a modal popup - same code
// LONGORIA compliant: Fixed header, scrollable content, fixed footer

const MemberSearch = {
  callback: null,
  mode: 'embedded', // 'embedded' or 'modal'
  containerId: null,
  apiBase: 'http://localhost:4001',

  // Render into a container (embedded mode)
  embed: function(containerId, callback) {
    this.mode = 'embedded';
    this.containerId = containerId;
    this.callback = callback;
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('MemberSearch: container not found:', containerId);
      return;
    }
    container.innerHTML = this.getEmbeddedHTML();
    this.attachEvents();
  },

  // Open as modal popup
  open: function(callback) {
    this.mode = 'modal';
    this.callback = callback;
    
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
      <div style="background: white; border-radius: 8px; max-width: 700px; width: 90%;
                  max-height: 90vh; display: flex; flex-direction: column;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
        <!-- LONGORIA: Sticky Header -->
        <div style="display: flex; justify-content: space-between; align-items: center;
                    padding: 10px 16px; border-bottom: 1px solid #e5e7eb;
                    background: white; border-radius: 8px 8px 0 0; flex-shrink: 0;">
          <div style="font-size: 16px; font-weight: 600;">🔍 Member Search</div>
          <button id="memberSearchClose" style="padding: 4px 12px; background: #f3f4f6;
                  border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; font-size: 13px;">✕ Close</button>
        </div>
        <!-- LONGORIA: Scrollable Content (buttons are inline in form) -->
        <div style="padding: 12px 16px; overflow-y: auto; flex: 1;">
          ${this.getFormHTML()}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    // Close handlers
    document.getElementById('memberSearchClose').onclick = () => this.close();
    overlay.onclick = (e) => { if (e.target === overlay) this.close(); };
    
    this.attachEvents();
  },

  close: function() {
    const overlay = document.getElementById('memberSearchOverlay');
    if (overlay) overlay.remove();
    const resultsOverlay = document.getElementById('msResultsOverlay');
    if (resultsOverlay) resultsOverlay.remove();
  },

  // Embedded HTML (LONGORIA compliant)
  getEmbeddedHTML: function() {
    return `
      <div id="memberSearchComponent" style="display: flex; flex-direction: column; height: 100%; min-height: 0;">
        <!-- LONGORIA: Scrollable Content -->
        <div style="flex: 1; overflow-y: auto; min-height: 0; padding: 4px;">
          ${this.getFormHTML()}
        </div>
      </div>
    `;
  },

  // Form fields HTML (shared between modal and embedded)
  getFormHTML: function() {
    return `
      <!-- Quick Search -->
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Quick Search</div>
        <div style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">Enter member number for fastest results</div>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="msMemberNumber" placeholder="Member Number"
                 style="flex: 1; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
          <button id="msQuickSearchBtn" style="padding: 8px 16px; background: #0066cc; color: white;
                  border: none; border-radius: 4px; font-weight: 500; cursor: pointer; font-size: 13px; white-space: nowrap;">🔍 Search</button>
        </div>
      </div>

      <div style="text-align: center; color: #9ca3af; margin: 12px 0; font-size: 13px;">— OR —</div>

      <!-- Advanced Search -->
      <div>
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Advanced Search</div>
        <div style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">Search by name or email</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 2px;">Last Name</label>
            <input type="text" id="msLastName" placeholder="e.g., Longoria"
                   style="width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 2px;">First Name</label>
            <input type="text" id="msFirstName" placeholder="e.g., Eva"
                   style="width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: flex-end;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 2px;">Email</label>
            <input type="email" id="msEmail" placeholder="e.g., john@email.com"
                   style="width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
          </div>
          <button id="msAdvSearchBtn" style="padding: 8px 16px; background: #0066cc; color: white;
                  border: none; border-radius: 4px; font-weight: 500; cursor: pointer; font-size: 13px; white-space: nowrap;">🔍 Search</button>
        </div>
      </div>

      <!-- Error Message -->
      <div id="msError" style="display: none; margin-top: 12px; padding: 8px 10px; background: #fef2f2;
           color: #dc2626; border-radius: 4px; font-size: 13px;"></div>
    `;
  },

  attachEvents: function() {
    // Quick Search button
    const quickBtn = document.getElementById('msQuickSearchBtn');
    if (quickBtn) {
      quickBtn.onclick = () => this.doQuickSearch();
    }

    // Advanced Search button
    const advBtn = document.getElementById('msAdvSearchBtn');
    if (advBtn) {
      advBtn.onclick = () => this.doAdvancedSearch();
    }

    // Enter key on member number triggers quick search
    const memberNumEl = document.getElementById('msMemberNumber');
    if (memberNumEl) {
      memberNumEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.doQuickSearch();
        }
      };
    }

    // Enter key on name/email triggers advanced search
    const advInputs = ['msLastName', 'msFirstName', 'msEmail'];
    advInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.doAdvancedSearch();
          }
        };
      }
    });
  },

  doQuickSearch: function() {
    const memberNum = document.getElementById('msMemberNumber').value.trim();
    if (!memberNum) {
      this.showError('Please enter a member number');
      return;
    }
    this.search({ membership_number: memberNum });
  },

  doAdvancedSearch: function() {
    const lname = document.getElementById('msLastName').value.trim();
    const fname = document.getElementById('msFirstName').value.trim();
    const email = document.getElementById('msEmail').value.trim();
    if (!lname && !fname && !email) {
      this.showError('Please enter at least one search criterion');
      return;
    }
    this.search({ lname, fname, email });
  },

  doSearch: function() {
    const memberNum = document.getElementById('msMemberNumber').value.trim();
    const lname = document.getElementById('msLastName').value.trim();
    const fname = document.getElementById('msFirstName').value.trim();
    const email = document.getElementById('msEmail').value.trim();

    this.search({
      membership_number: memberNum,
      lname: lname,
      fname: fname,
      email: email
    });
  },

  search: async function(params) {
    const errorEl = document.getElementById('msError');

    // Clear previous error
    errorEl.style.display = 'none';

    // Validate
    const validation = this.validate(params);
    if (!validation.valid) {
      errorEl.textContent = validation.error;
      errorEl.style.display = 'block';
      return;
    }

    // Build query
    const queryParams = new URLSearchParams();
    if (params.membership_number) queryParams.append('membership_number', params.membership_number);
    if (params.lname) queryParams.append('lname', params.lname);
    if (params.fname) queryParams.append('fname', params.fname);
    if (params.email) queryParams.append('email', params.email);

    try {
      const response = await fetch(`${this.apiBase}/v1/member/search?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Search failed');
      
      const members = await response.json();
      
      if (!Array.isArray(members) || members.length === 0) {
        errorEl.textContent = 'No members found';
        errorEl.style.display = 'block';
        return;
      }

      // Single result - auto-select
      if (members.length === 1) {
        this.selectMember(members[0]);
        return;
      }

      // Multiple results - show in popup modal
      this.showResultsModal(members);

    } catch (err) {
      console.error('Search error:', err);
      errorEl.textContent = 'Search failed. Please try again.';
      errorEl.style.display = 'block';
    }
  },

  showResultsModal: function(members) {
    // Remove existing results modal if any
    const existing = document.getElementById('msResultsOverlay');
    if (existing) existing.remove();

    const self = this;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'msResultsOverlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); display: flex;
      align-items: center; justify-content: center; z-index: 10001;
    `;
    
    const rows = members.map((member, idx) => {
      const name = `${member.fname || ''} ${member.lname || ''}`.trim() || 'Unknown';
      const id = member.membership_number || member.member_id || '';
      return `
        <tr data-idx="${idx}" style="border-bottom: 1px solid #f3f4f6; cursor: pointer;">
          <td style="padding: 10px 12px; font-size: 14px;">${name}</td>
          <td style="padding: 10px 12px; font-size: 14px; font-family: monospace;">${id}</td>
          <td style="padding: 10px 12px; text-align: center;">
            <button class="ms-select-btn" data-idx="${idx}" style="padding: 6px 16px; background: white; color: #333; 
                    border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px; cursor: pointer;">Select</button>
          </td>
        </tr>
      `;
    }).join('');

    overlay.innerHTML = `
      <div style="background: white; border-radius: 8px; max-width: 600px; width: 90%;
                  max-height: 80vh; display: flex; flex-direction: column;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
        <!-- LONGORIA: Sticky Header -->
        <div style="display: flex; justify-content: space-between; align-items: center;
                    padding: 12px 16px; border-bottom: 1px solid #e5e7eb;
                    background: white; border-radius: 8px 8px 0 0; flex-shrink: 0;">
          <div style="font-size: 16px; font-weight: 600;">${members.length} matches — select a member</div>
          <button id="msResultsClose" style="padding: 4px 10px; background: transparent;
                  border: none; cursor: pointer; font-size: 18px; color: #6b7280;">×</button>
        </div>
        <!-- LONGORIA: Scrollable Content -->
        <div style="overflow-y: auto; flex: 1;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 8px 12px; text-align: left; font-size: 12px; font-weight: 500; color: #6b7280;">Member</th>
                <th style="padding: 8px 12px; text-align: left; font-size: 12px; font-weight: 500; color: #6b7280;">ID</th>
                <th style="padding: 8px 12px; width: 80px;"></th>
              </tr>
            </thead>
            <tbody id="msResultsTableBody">${rows}</tbody>
          </table>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Close button
    document.getElementById('msResultsClose').onclick = () => overlay.remove();
    
    // Click outside to close
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    
    // Row hover effects
    const tableRows = overlay.querySelectorAll('tbody tr');
    tableRows.forEach(row => {
      row.onmouseover = () => row.style.background = '#f9fafb';
      row.onmouseout = () => row.style.background = 'white';
    });
    
    // Select buttons
    const selectBtns = overlay.querySelectorAll('.ms-select-btn');
    selectBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        overlay.remove();
        self.selectMember(members[idx]);
      };
    });
    
    // Row click to select
    tableRows.forEach(row => {
      row.onclick = () => {
        const idx = parseInt(row.dataset.idx);
        overlay.remove();
        self.selectMember(members[idx]);
      };
    });
  },

  validate: function(params) {
    if (!params.membership_number && !params.lname && !params.fname && !params.email) {
      return { valid: false, error: 'Enter search criteria.' };
    }
    if (params.fname && (!params.lname || params.lname.length < 2)) {
      return { valid: false, error: 'Enter at least 2 characters of last name when searching by first name.' };
    }
    return { valid: true };
  },

  selectMember: function(member) {
    if (this.mode === 'modal') {
      this.close();
    }
    if (this.callback) {
      this.callback(member);
    }
  }
};

// Global access
window.MemberSearch = MemberSearch;
