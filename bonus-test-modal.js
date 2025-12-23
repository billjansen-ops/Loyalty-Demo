// bonus-test-modal.js - Reusable modal component for bonus testing

const BonusTestModal = {
  
  // Template renderer instance
  templateRenderer: null,
  
  // Open the modal
  open: function(bonusCode) {
    // Create modal HTML
    const modalHTML = `
      <div id="bonusTestModal" style="
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
          max-width: 900px;
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
              <div>
                <div style="font-size: 20px; font-weight: 600; color: #111827; display: flex; align-items: center; gap: 8px;">
                  🧪 Test Bonus Rule
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                  <span style="font-size: 13px; color: #6b7280;">Testing bonus:</span>
                  <span style="
                    font-size: 14px;
                    font-weight: 600;
                    color: #0066cc;
                    background: #e0f2fe;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-family: 'Monaco', 'Courier New', monospace;
                  ">${bonusCode}</span>
                </div>
              </div>
              <button onclick="BonusTestModal.close()" style="
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
            <div id="bonusTestError" style="
              display: none;
              background: #fef3c7;
              border: 1px solid #fbbf24;
              color: #92400e;
              padding: 12px 16px;
              border-radius: 6px;
              margin-bottom: 16px;
              font-size: 14px;
            "></div>

            <form id="bonusTestForm">
              <div style="
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                padding: 16px;
              ">
                <div id="bonusTestFields"></div>
              </div>

              <div id="bonusTestResult" style="
                display: none;
                margin-top: 16px;
                padding: 16px;
                border-radius: 6px;
                border: 2px solid;
              "></div>
            </form>
          </div>

          <!-- LONGORIA: Sticky Footer -->
          <div style="
            padding: 12px 20px;
            border-top: 1px solid #e5e7eb;
            background: white;
            border-radius: 0 0 8px 8px;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            flex-shrink: 0;
          ">
            <button type="button" onclick="BonusTestModal.close()" style="
              padding: 8px 16px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              background: #f3f4f6;
              color: #374151;
            ">Cancel</button>
            <button type="button" id="bonusTestSubmit" onclick="BonusTestModal.submit()" style="
              padding: 8px 16px;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              background: #0066cc;
              color: white;
            ">🧪 Test Rule!</button>
          </div>
        </div>
      </div>
    `;

    // Inject modal into page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Initialize form
    this.initialize(bonusCode);
  },

  // Initialize the modal content
  initialize: async function(bonusCode) {
    const API_BASE = 'http://localhost:4001';
    const tenantId = sessionStorage.getItem('tenant_id') || '1';

    // Store bonus code
    this.bonusCode = bonusCode;

    // Inject template form styles
    const templateStyle = document.createElement('style');
    templateStyle.textContent = TemplateFormRenderer.getStyles();
    document.head.appendChild(templateStyle);

    // Use dynamic template form renderer
    this.templateRenderer = new TemplateFormRenderer(API_BASE, tenantId);
    const loaded = await this.templateRenderer.loadTemplateByActivityType('A');
    
    if (loaded) {
      document.getElementById('bonusTestFields').innerHTML = 
        this.templateRenderer.renderHTML({ includeMemberId: true, includeActivityDate: true, includeBaseMiles: true });
      await this.templateRenderer.initializeFields();
    } else {
      document.getElementById('bonusTestFields').innerHTML = `
        <div style="padding: 20px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #991b1b;">
          <strong>Activity template not found</strong>
          <p style="margin: 8px 0 0;">No input template configured for activity type 'A'.</p>
        </div>
      `;
      document.getElementById('bonusTestSubmit').disabled = true;
      return;
    }

    // Add search button next to member ID field
    const memberIdInput = document.getElementById('tpl_memberId');
    if (memberIdInput) {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.gap = '8px';
      
      const searchBtn = document.createElement('button');
      searchBtn.type = 'button';
      searchBtn.innerHTML = '🔍';
      searchBtn.title = 'Search for member';
      searchBtn.style.padding = '8px 12px';
      searchBtn.style.border = '1px solid #d1d5db';
      searchBtn.style.borderRadius = '6px';
      searchBtn.style.background = '#f9fafb';
      searchBtn.style.cursor = 'pointer';
      searchBtn.style.fontSize = '16px';
      searchBtn.onclick = () => {
        MemberSearch.open((member) => {
          document.getElementById('tpl_memberId').value = member.membership_number;
        });
      };
      
      memberIdInput.parentNode.insertBefore(wrapper, memberIdInput);
      wrapper.appendChild(memberIdInput);
      wrapper.appendChild(searchBtn);
    }

    // Add form-row styles inline
    const style = document.createElement('style');
    style.textContent = `
      #bonusTestFields .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 8px;
      }
      #bonusTestFields .form-row.full {
        grid-template-columns: 1fr;
      }
      #bonusTestFields .form-group {
        display: flex;
        flex-direction: column;
      }
      #bonusTestFields .form-group label {
        font-size: 13px;
        font-weight: 500;
        color: #374151;
        margin-bottom: 4px;
      }
      #bonusTestFields .form-group input,
      #bonusTestFields .form-group select {
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        background: white;
      }
      #bonusTestFields .form-group input:focus,
      #bonusTestFields .form-group select:focus {
        outline: none;
        border-color: #0066cc;
        box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
      }
    `;
    document.head.appendChild(style);
  },

  // Submit the test
  submit: async function() {
    const API_BASE = 'http://localhost:4001';
    const errorBox = document.getElementById('bonusTestError');
    const resultBox = document.getElementById('bonusTestResult');
    const submitBtn = document.getElementById('bonusTestSubmit');

    // Clear previous results
    errorBox.style.display = 'none';
    resultBox.style.display = 'none';

    // Get form data from template renderer
    const testData = this.templateRenderer.getFormData();

    // Add tenant_id and member_id
    const tenantId = sessionStorage.getItem('tenant_id') || '1';
    testData.tenant_id = tenantId;
    testData.member_id = testData.member_id || document.getElementById('tpl_memberId')?.value;

    // Show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Testing...';

    try {
      const response = await fetch(`${API_BASE}/v1/test-rule/${encodeURIComponent(this.bonusCode)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      // Show result
      if (result.pass) {
        resultBox.style.background = '#f0fdf4';
        resultBox.style.borderColor = '#86efac';
        resultBox.style.color = '#166534';
        resultBox.innerHTML = `
          <div style="display: flex; align-items: center;">
            <span style="font-size: 24px; margin-right: 8px;">✅</span>
            <span style="font-weight: 600;">PASS!</span>
          </div>
          ${result.message ? `<div style="margin-top: 8px; font-size: 13px; opacity: 0.9;">${result.message}</div>` : ''}
        `;
      } else {
        resultBox.style.background = '#fef2f2';
        resultBox.style.borderColor = '#fca5a5';
        resultBox.style.color = '#991b1b';
        resultBox.innerHTML = `
          <div style="display: flex; align-items: center;">
            <span style="font-size: 24px; margin-right: 8px;">❌</span>
            <span style="font-weight: 600;">FAIL</span>
          </div>
          ${result.reason ? `<div style="margin-top: 8px; font-size: 13px; opacity: 0.9;">Reason: ${result.reason}</div>` : ''}
        `;
      }

      resultBox.style.display = 'block';

    } catch (error) {
      errorBox.textContent = 'Error testing rule: ' + error.message;
      errorBox.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '🧪 Test Rule!';
    }
  },

  // Close the modal
  close: function() {
    const modal = document.getElementById('bonusTestModal');
    if (modal) {
      modal.remove();
    }
  }
};
