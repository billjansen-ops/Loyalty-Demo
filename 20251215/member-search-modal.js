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
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          max-width: 700px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        ">
          <!-- LONGORIA: Sticky Header -->
          <div style="
            padding: 16px 20px;
            border-bottom: 1px solid #e5e7eb;
            background: white;
            border-radius: 8px 8px 0 0;
            flex-shrink: 0;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 20px; font-weight: 600; color: #111827;">
                🔍 Member Search
              </div>
              <button onclick="MemberSearchModal.close()" style="
                padding: 6px 14px;
                background: #f3f4f6;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                color: #374151;
                cursor: pointer;
              ">✕ Close</button>
            </div>
          </div>

          <!-- LONGORIA: Scrollable Content -->
          <div style="
            flex: 1;
            overflow-y: auto;
            padding: 20px;
          ">
            <!-- Quick Search by Member ID -->
            <div style="margin-bottom: 20px;">
              <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Quick Search</div>
              <div style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">
                Enter member number for fastest results
              </div>
              <form id="memberSearchQuick" style="display: flex; gap: 8px;">
                <input 
                  type="text" 
                  id="memberSearchId"
                  placeholder="Member Number"
                  style="
                    flex: 1;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                  "
                />
                <button type="submit" style="
                  padding: 8px 16px;
                  background: #0066cc;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  font-size: 14px;
                  font-weight: 600;
                  cursor: pointer;
                ">Search</button>
              </form>
            </div>

            <div style="
              margin: 20px 0;
              text-align: center;
              font-size: 12px;
              color: #9ca3af;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            ">— OR —</div>

            <!-- Advanced Search -->
            <div style="margin-bottom: 20px;">
              <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Advanced Search</div>
              <div style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">
                Search by name, email, or phone
              </div>
              <form id="memberSearchAdvanced">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                  <div>
                    <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px;">
                      First Name
                    </label>
                    <input 
                      type="text" 
                      id="memberSearchFirst"
                      style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                      "
                    />
                  </div>
                  <div>
                    <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px;">
                      Last Name
                    </label>
                    <input 
                      type="text" 
                      id="memberSearchLast"
                      style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                      "
                    />
                  </div>
                </div>
                <div style="margin-bottom: 12px;">
                  <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px;">
                    Email
                  </label>
                  <input 
                    type="email" 
                    id="memberSearchEmail"
                    placeholder="e.g., john@email.com"
                    style="
                      width: 100%;
                      padding: 8px 12px;
                      border: 1px solid #d1d5db;
                      border-radius: 6px;
                      font-size: 14px;
                    "
                  />
                </div>
                <button type="submit" style="
                  width: 100%;
                  padding: 8px 16px;
                  background: #0066cc;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  font-size: 14px;
                  font-weight: 600;
                  cursor: pointer;
                ">Search</button>
              </form>
            </div>

            <!-- Results -->
            <div id="memberSearchResults" style="display: none; margin-top: 20px;">
              <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;" id="memberSearchResultsHeader"></div>
              <div style="
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                overflow: hidden;
              ">
                <table style="width: 100%; border-collapse: collapse;">
                  <thead style="background: #f9fafb;">
                    <tr>
                      <th style="padding: 8px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                        Member
                      </th>
                      <th style="padding: 8px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                        ID
                      </th>
                      <th style="padding: 8px 12px; text-align: center; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                        
                      </th>
                    </tr>
                  </thead>
                  <tbody id="memberSearchResultsBody"></tbody>
                </table>
              </div>
            </div>

            <div id="memberSearchError" style="
              display: none;
              background: #fef2f2;
              border: 1px solid #fca5a5;
              color: #991b1b;
              padding: 12px 16px;
              border-radius: 6px;
              margin-top: 16px;
              font-size: 14px;
            "></div>
          </div>
        </div>
      </div>
    `;

    // Inject modal into page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Attach event listeners
    this.attachEvents();
  },

  // Attach event listeners
  attachEvents: function() {
    document.getElementById('memberSearchQuick').addEventListener('submit', (e) => {
      e.preventDefault();
      const memberId = document.getElementById('memberSearchId').value.trim();
      if (memberId) {
        this.search({ id: memberId });
      }
    });

    document.getElementById('memberSearchAdvanced').addEventListener('submit', (e) => {
      e.preventDefault();
      const firstName = document.getElementById('memberSearchFirst').value.trim();
      const lastName = document.getElementById('memberSearchLast').value.trim();
      const email = document.getElementById('memberSearchEmail').value.trim();
      
      // Search will handle validation via shared API
      this.search({ first: firstName, last: lastName, email });
    });
  },

  // Perform search
  search: async function(query) {
    const API_BASE = 'http://localhost:4001';
    const errorBox = document.getElementById('memberSearchError');
    const resultsBox = document.getElementById('memberSearchResults');
    const resultsBody = document.getElementById('memberSearchResultsBody');
    const resultsHeader = document.getElementById('memberSearchResultsHeader');

    // Clear previous results
    errorBox.style.display = 'none';
    resultsBox.style.display = 'none';
    resultsBody.innerHTML = '';

    // Determine search type for validation
    let searchType = null;
    if (query.id) searchType = 'membership_number';
    else if (query.email) searchType = 'email';
    else if (query.last) searchType = 'name';

    // Validate using shared API
    const validation = MemberSearchAPI.validate({
      lname: query.last,
      fname: query.first,
      email: query.email,
      membership_number: query.id
    }, searchType);
    
    if (!validation.valid) {
      errorBox.textContent = validation.error;
      errorBox.style.display = 'block';
      return;
    }

    try {
      const results = await MemberSearchAPI.search({
        lname: query.last,
        fname: query.first,
        email: query.email,
        membership_number: query.id
      }, API_BASE);
      
      if (results === null) {
        throw new Error('Search failed');
      }

      if (results.length === 0) {
        errorBox.textContent = 'No members found';
        errorBox.style.display = 'block';
        return;
      }

      // If exactly 1 member found, auto-select and close
      if (results.length === 1) {
        this.selectMember(results[0]);
        return;
      }

      // Multiple members found - display results
      resultsHeader.textContent = `Found ${results.length} members`;
      
      results.forEach(member => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #f3f4f6';
        row.style.cursor = 'pointer';
        row.style.transition = 'background 0.15s';
        row.onmouseover = () => row.style.background = '#f9fafb';
        row.onmouseout = () => row.style.background = 'white';
        row.onclick = () => this.selectMember(member);

        const name = `${member.fname || ''} ${member.lname || ''}`.trim() || 'Unknown';
        const memberNumber = member.membership_number || '';

        row.innerHTML = `
          <td style="padding: 10px 12px; font-size: 14px;">${name}</td>
          <td style="padding: 10px 12px; font-size: 14px; font-family: monospace;">${memberNumber}</td>
          <td style="padding: 10px 12px; text-align: center;">
            <button style="
              padding: 4px 12px;
              background: #0066cc;
              color: white;
              border: none;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
            ">Select</button>
          </td>
        `;

        resultsBody.appendChild(row);
      });

      resultsBox.style.display = 'block';

    } catch (error) {
      errorBox.textContent = 'Error searching members: ' + error.message;
      errorBox.style.display = 'block';
    }
  },

  // Select a member
  selectMember: function(member) {
    const membershipNumber = member.membership_number || '';
    
    if (this.callback) {
      // Call the callback with member info
      this.callback({
        membership_number: membershipNumber,
        first: member.fname || '',
        last: member.lname || '',
        email: member.email || ''
      });
    } else {
      // Default CSR flow - navigate to activity page
      if (window.LP_NAV && window.LP_NAV.setCurrentMember) {
        window.LP_NAV.setCurrentMember({
          id: membershipNumber,
          first: member.fname || '',
          last: member.lname || ''
        });
        window.LP_NAV.navigateTo('activity.html', { id: membershipNumber });
      }
    }

    this.close();
  },

  // Close the modal
  close: function() {
    const modal = document.getElementById('memberSearchModal');
    if (modal) {
      modal.remove();
    }
    this.callback = null;
  }
};
