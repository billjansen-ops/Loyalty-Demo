// member-search-modal.js - Reusable modal component for member search

const MemberSearchModal = {
  callback: null,

  // Open the modal with optional callback
  open: function(callback) {
    this.callback = callback || null;
    
    // Create modal HTML
    const modalHTML = `
      <div id="memberSearchModal" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
      ">
        <div style="
          background: white;
          border-radius: 4px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          max-width: 900px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        ">
          <!-- Header -->
          <div style="
            padding: 10px 16px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
          ">
            <div style="font-size: 18px; font-weight: 600; color: #111827;">
              🔍 Member Search
            </div>
            <button onclick="MemberSearchModal.close()" style="
              background: none;
              border: none;
              font-size: 24px;
              color: #9ca3af;
              cursor: pointer;
              padding: 0;
              width: 28px;
              height: 28px;
            ">×</button>
          </div>

          <!-- Content - 2x2 Grid -->
          <div style="flex: 1; overflow-y: auto; padding: 16px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              
              <!-- 1. Member Number -->
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px;">
                <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 6px 0;">🎫 Member Number</h3>
                <p style="font-size: 12px; color: #6b7280; margin: 0 0 6px 0;">Fastest lookup - exact match</p>
                <form id="msFormMemberNumber">
                  <div style="margin-bottom: 6px;">
                    <label style="display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">Member Number</label>
                    <input type="text" id="msMemberNumber" placeholder="e.g., DL847293" style="
                      width: 100%; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;
                    ">
                  </div>
                  <button type="submit" style="
                    width: 100%; padding: 6px 10px; background: var(--primary); color: white; border: none; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                  ">🔍 Search</button>
                </form>
                <div id="msErrorMemberNumber" style="display: none; margin-top: 6px; padding: 6px 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; color: #991b1b; font-size: 13px;"></div>
              </div>
              
              <!-- 2. Email -->
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px;">
                <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 6px 0;">📧 Email Address</h3>
                <p style="font-size: 12px; color: #6b7280; margin: 0 0 6px 0;">Search by email prefix</p>
                <form id="msFormEmail">
                  <div style="margin-bottom: 6px;">
                    <label style="display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">Email</label>
                    <input type="email" id="msEmail" placeholder="e.g., john@" style="
                      width: 100%; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;
                    ">
                  </div>
                  <button type="submit" style="
                    width: 100%; padding: 6px 10px; background: var(--primary); color: white; border: none; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                  ">🔍 Search</button>
                </form>
                <div id="msErrorEmail" style="display: none; margin-top: 6px; padding: 6px 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; color: #991b1b; font-size: 13px;"></div>
              </div>
              
              <!-- 3. Phone -->
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px;">
                <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 6px 0;">📞 Phone Number</h3>
                <p style="font-size: 12px; color: #6b7280; margin: 0 0 6px 0;">Search by phone prefix</p>
                <form id="msFormPhone">
                  <div style="margin-bottom: 6px;">
                    <label style="display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">Phone</label>
                    <input type="tel" id="msPhone" placeholder="e.g., 612-555" style="
                      width: 100%; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;
                    ">
                  </div>
                  <button type="submit" style="
                    width: 100%; padding: 6px 10px; background: var(--primary); color: white; border: none; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                  ">🔍 Search</button>
                </form>
                <div id="msErrorPhone" style="display: none; margin-top: 6px; padding: 6px 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; color: #991b1b; font-size: 13px;"></div>
              </div>
              
              <!-- 4. Name -->
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px;">
                <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 6px 0;">👤 Name Search</h3>
                <p style="font-size: 12px; color: #6b7280; margin: 0 0 6px 0;">Last name required (3+ chars if first name given)</p>
                <form id="msFormName">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 6px;">
                    <div>
                      <label style="display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">Last Name *</label>
                      <input type="text" id="msLastName" placeholder="e.g., Smith" style="
                        width: 100%; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;
                      ">
                    </div>
                    <div>
                      <label style="display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">First Name</label>
                      <input type="text" id="msFirstName" placeholder="e.g., John" style="
                        width: 100%; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; box-sizing: border-box;
                      ">
                    </div>
                  </div>
                  <button type="submit" style="
                    width: 100%; padding: 6px 10px; background: var(--primary); color: white; border: none; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                  ">🔍 Search</button>
                </form>
                <div id="msErrorName" style="display: none; margin-top: 6px; padding: 6px 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; color: #991b1b; font-size: 13px;"></div>
              </div>
              
            </div>
          </div>
        </div>
      </div>
      
      <!-- Results Modal -->
      <div id="msResultsModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10001; align-items: center; justify-content: center;">
        <div style="background: white; border-radius: 8px; width: 95%; max-width: 900px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
          <div style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%);">
            <h3 id="msResultsHeader" style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">Search Results</h3>
            <button onclick="MemberSearchModal.closeResults()" style="background: none; border: none; font-size: 24px; color: #9ca3af; cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: background 0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">×</button>
          </div>
          <div style="flex: 1; overflow-y: auto; padding: 8px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead style="background: #f9fafb; position: sticky; top: 0;">
                <tr>
                  <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Member</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Number</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Location</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Tier</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;"></th>
                </tr>
              </thead>
              <tbody id="msResultsBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Inject modal into page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Attach event listeners
    this.attachEvents();
    
    // Focus first field
    document.getElementById('msMemberNumber').focus();
  },

  attachEvents: function() {
    const self = this;
    const API_BASE = window.LP_STATE?.apiBase || 'http://localhost:4001';
    
    // 1. Member Number
    document.getElementById('msFormMemberNumber').addEventListener('submit', async (e) => {
      e.preventDefault();
      self.clearErrors();
      const value = document.getElementById('msMemberNumber').value.trim();
      const validation = MemberSearchAPI.validate({ membership_number: value }, 'membership_number');
      if (!validation.valid) {
        self.showError('MemberNumber', validation.error);
        return;
      }
      const results = await MemberSearchAPI.search({ membership_number: value }, API_BASE);
      self.handleResults(results, 'MemberNumber');
    });
    
    // 2. Email
    document.getElementById('msFormEmail').addEventListener('submit', async (e) => {
      e.preventDefault();
      self.clearErrors();
      const value = document.getElementById('msEmail').value.trim();
      const validation = MemberSearchAPI.validate({ email: value }, 'email');
      if (!validation.valid) {
        self.showError('Email', validation.error);
        return;
      }
      const results = await MemberSearchAPI.search({ email: value }, API_BASE);
      self.handleResults(results, 'Email');
    });
    
    // 3. Phone
    document.getElementById('msFormPhone').addEventListener('submit', async (e) => {
      e.preventDefault();
      self.clearErrors();
      const value = document.getElementById('msPhone').value.trim();
      const validation = MemberSearchAPI.validate({ phone: value }, 'phone');
      if (!validation.valid) {
        self.showError('Phone', validation.error);
        return;
      }
      const results = await MemberSearchAPI.search({ phone: value }, API_BASE);
      self.handleResults(results, 'Phone');
    });
    
    // 4. Name
    document.getElementById('msFormName').addEventListener('submit', async (e) => {
      e.preventDefault();
      self.clearErrors();
      const lname = document.getElementById('msLastName').value.trim();
      const fname = document.getElementById('msFirstName').value.trim();
      const validation = MemberSearchAPI.validate({ lname, fname }, 'name');
      if (!validation.valid) {
        self.showError('Name', validation.error);
        return;
      }
      const results = await MemberSearchAPI.search({ lname, fname }, API_BASE);
      self.handleResults(results, 'Name');
    });
    
    // Close on escape
    document.addEventListener('keydown', this.escHandler);
  },

  escHandler: function(e) {
    if (e.key === 'Escape') {
      MemberSearchModal.closeResults();
      MemberSearchModal.close();
    }
  },

  clearErrors: function() {
    ['MemberNumber', 'Email', 'Phone', 'Name'].forEach(id => {
      const el = document.getElementById('msError' + id);
      if (el) el.style.display = 'none';
    });
  },

  showError: function(cardId, message) {
    const el = document.getElementById('msError' + cardId);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  },

  handleResults: function(results, cardId) {
    if (results === null) {
      this.showError(cardId, 'Search failed. Please try again.');
      return;
    }
    
    if (results.length === 0) {
      this.showError(cardId, 'No members found.');
      return;
    }
    
    if (results.length === 1) {
      this.selectMember(results[0]);
      return;
    }
    
    // Multiple results - show results modal
    this.showResults(results);
  },

  showResults: function(results) {
    const tbody = document.getElementById('msResultsBody');
    
    // Tier badge colors
    const tierColors = {
      'BASE': { bg: '#f3f4f6', text: '#6b7280' },
      'SILVER': { bg: '#e5e7eb', text: '#374151' },
      'GOLD': { bg: '#fef3c7', text: '#92400e' },
      'PLATINUM': { bg: '#dbeafe', text: '#1e40af' },
      'DIAMOND': { bg: '#ede9fe', text: '#5b21b6' }
    };
    
    tbody.innerHTML = results.map(m => {
      const name = `${m.fname || ''} ${m.lname || ''}`.trim() || '—';
      const initials = `${(m.fname || '?')[0]}${(m.lname || '?')[0]}`.toUpperCase();
      const num = m.membership_number || '—';
      const email = m.email || '';
      const phone = m.phone || '';
      const location = [m.city, m.state].filter(Boolean).join(', ') || '—';
      const tierName = m.tier_name || 'Base';
      const tierCode = (m.tier_code || 'BASE').toUpperCase();
      const tierStyle = tierColors[tierCode] || tierColors['BASE'];
      
      return `
        <tr onclick="MemberSearchModal.selectMemberFromRow(this)" data-member='${JSON.stringify(m).replace(/'/g, "&#39;")}' style="cursor: pointer; transition: background 0.15s ease;" onmouseover="this.style.background='linear-gradient(90deg, #f0f9ff 0%, #e0f2fe 100%)'" onmouseout="this.style.background='white'">
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 14px; flex-shrink: 0; box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);">
                ${initials}
              </div>
              <div>
                <div style="font-weight: 600; color: #111827; font-size: 14px;">${name}</div>
                ${email ? `<div style="font-size: 12px; color: #6b7280; margin-top: 1px;">${email}</div>` : ''}
                ${phone ? `<div style="font-size: 12px; color: #9ca3af;">${phone}</div>` : ''}
              </div>
            </div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">
            <span style="font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 13px; color: #374151; background: #f9fafb; padding: 4px 8px; border-radius: 4px; border: 1px solid #e5e7eb;">${num}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">
            <span style="color: #6b7280; font-size: 13px;">${location}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">
            <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ${tierStyle.bg}; color: ${tierStyle.text};">${tierName}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">
            <button style="padding: 6px 14px; background: var(--primary); color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.15); transition: transform 0.1s, box-shadow 0.1s;" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.15)'">Select</button>
          </td>
        </tr>
      `;
    }).join('');
    
    document.getElementById('msResultsHeader').textContent = `${results.length} members found — select one`;
    document.getElementById('msResultsModal').style.display = 'flex';
  },

  selectMemberFromRow: function(row) {
    const member = JSON.parse(row.dataset.member);
    this.selectMember(member);
  },

  selectMember: function(member) {
    if (this.callback) {
      this.callback({
        membership_number: member.membership_number || '',
        id: member.membership_number || '',
        fname: member.fname || '',
        lname: member.lname || '',
        email: member.email || ''
      });
    }
    this.closeResults();
    this.close();
  },

  closeResults: function() {
    const modal = document.getElementById('msResultsModal');
    if (modal) modal.style.display = 'none';
  },

  close: function() {
    const modal = document.getElementById('memberSearchModal');
    if (modal) modal.remove();
    document.removeEventListener('keydown', this.escHandler);
    this.callback = null;
  }
};
