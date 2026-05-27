// compliance-entry-modal.js - Shared compliance entry flow
// Used by: clinic.html, compliance_member.html
// Flow: Item Picker → Status Picker → Confirm → Submit

const ComplianceEntryModal = {
  _items: [],
  _selectedItem: null,
  _selectedStatus: null,
  _memberId: null,
  _displayName: '',
  _apiBase: '',
  _tenantId: null,
  _onSuccess: null,

  ITEM_ICONS: { DRUG_TEST_COMP:'🧪', DRUG_TEST_RESULT:'🔬', CHECKIN:'✅', APPOINTMENT:'📅', PROGRAM_STATUS:'📊', MONITORING_ENG:'📱' },
  SCORE_COLORS: { 0:'#16a34a', 1:'#ca8a04', 2:'#ea580c', 3:'#dc2626' },
  CADENCE_LABELS: { daily:'Daily', weekly:'Weekly', monthly:'Monthly', quarterly:'Quarterly', yearly:'Yearly', custom:'Custom' },

  // Start the entry flow
  // opts: { memberId, displayName, apiBase, tenantId, items, onSuccess }
  // If items not provided, will fetch them
  open: async function(opts) {
    this._memberId = opts.memberId;
    this._displayName = opts.displayName || '';
    this._apiBase = opts.apiBase;
    this._tenantId = opts.tenantId;
    this._onSuccess = opts.onSuccess || null;
    this._selectedItem = null;
    this._selectedStatus = null;

    if (opts.items) {
      this._items = opts.items;
    } else {
      try {
        const res = await fetch(`${opts.apiBase}/v1/compliance/member/${opts.memberId}?tenant_id=${opts.tenantId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load compliance items');
        this._items = await res.json();
      } catch(err) { alert('Error: ' + err.message); return; }
    }

    if (!this._items.length) {
      alert(`No active compliance items for ${this._displayName}`);
      return;
    }

    // If a specific item was pre-selected, skip the picker
    if (opts.preSelectedItemId) {
      this._selectedItem = this._items.find(i => i.member_compliance_id === opts.preSelectedItemId);
      if (this._selectedItem) {
        this._showStatusPicker();
        return;
      }
    }

    this._showItemPicker();
  },

  _showItemPicker: function() {
    const mn = this._displayName;
    const memberId = this._memberId;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cemPickerOverlay" onclick="if(event.target===this)ComplianceEntryModal._closePickerModal()">
        <div class="modal" style="max-width:500px;">
          <div class="modal-header">
            <div><h2>📋 Add Entry</h2><div class="modal-tag">${mn} · #${memberId}</div></div>
            <button class="modal-close" onclick="ComplianceEntryModal._closePickerModal()">✕</button>
          </div>
          <div style="padding:0;">
            <table style="width:100%;border-collapse:collapse;">
              <tbody>
                ${this._items.map(item => `
                  <tr style="border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="ComplianceEntryModal._pickItem(${item.member_compliance_id})" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                    <td style="padding:12px 16px;">
                      <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:18px;">${this.ITEM_ICONS[item.item_code] || '📋'}</span>
                        <div>
                          <div style="font-size:14px;font-weight:600;color:#1e293b;">${item.item_name}</div>
                          <div style="font-size:11px;color:#94a3b8;">${this.CADENCE_LABELS[item.cadence_type || item.cadence] || item.cadence_type || item.cadence} · ${Math.round(item.weight * 100)}%</div>
                        </div>
                      </div>
                    </td>
                    <td style="padding:12px 16px;text-align:right;color:#94a3b8;font-size:16px;">›</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`);
  },

  _closePickerModal: function() { const el = document.getElementById('cemPickerOverlay'); if (el) el.remove(); },

  _pickItem: function(memberComplianceId) {
    this._selectedItem = this._items.find(i => i.member_compliance_id === memberComplianceId);
    if (!this._selectedItem) return;
    this._closePickerModal();
    this._showStatusPicker();
  },

  _showStatusPicker: function() {
    const mn = this._displayName;
    const memberId = this._memberId;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cemStatusOverlay" onclick="if(event.target===this)ComplianceEntryModal._closeStatusModal()">
        <div class="modal" style="max-width:480px;">
          <div class="modal-header">
            <div><h2>📋 ${this._selectedItem.item_name}</h2><div class="modal-tag">${mn} · #${memberId}</div></div>
            <button class="modal-close" onclick="ComplianceEntryModal._closeStatusModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="modal-label">Select Result</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${this._selectedItem.statuses.map(s => `
                <button class="erm-cat-btn" style="flex-direction:row;padding:12px 16px;justify-content:space-between;align-items:center;" onclick="ComplianceEntryModal._pickStatus(${s.status_id})">
                  <span style="font-size:14px;font-weight:600;color:#1e293b;">${s.status_code.replace(/_/g,' ')}</span>
                  <span style="display:flex;align-items:center;gap:8px;">
                    ${s.is_sentinel ? '<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#fee2e2;color:#991b1b;">SENTINEL</span>' : ''}
                    <span style="font-size:16px;font-weight:800;color:${this.SCORE_COLORS[s.score] || '#64748b'};">${s.score}</span>
                  </span>
                </button>`).join('')}
            </div>
          </div>
        </div>
      </div>`);
  },

  _closeStatusModal: function() { const el = document.getElementById('cemStatusOverlay'); if (el) el.remove(); },

  _pickStatus: function(statusId) {
    this._selectedStatus = this._selectedItem.statuses.find(s => s.status_id === statusId);
    if (!this._selectedStatus) return;
    this._closeStatusModal();
    this._showConfirm();
  },

  _showConfirm: function() {
    const mn = this._displayName;
    const memberId = this._memberId;
    const sc = this.SCORE_COLORS[this._selectedStatus.score] || '#64748b';
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cemConfirmOverlay" onclick="if(event.target===this)ComplianceEntryModal._closeConfirmModal()">
        <div class="modal" style="max-width:440px;">
          <div class="modal-header">
            <div><h2>📋 Confirm Entry</h2></div>
            <button class="modal-close" onclick="ComplianceEntryModal._closeConfirmModal()">✕</button>
          </div>
          <div class="modal-body" style="padding:24px;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
              <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-bottom:8px;">Physician</div>
              <div style="font-size:16px;font-weight:700;color:#1e293b;">${mn}</div>
              <div style="font-size:12px;color:#64748b;">#${memberId}</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
              <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-bottom:8px;">Compliance Item</div>
              <div style="font-size:16px;font-weight:700;color:#1e293b;">${this._selectedItem.item_name}</div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
              <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-bottom:8px;">Result</div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="font-size:16px;font-weight:700;color:#1e293b;">${this._selectedStatus.status_code.replace(/_/g,' ')}</div>
                <div style="display:flex;align-items:center;gap:8px;">
                  ${this._selectedStatus.is_sentinel ? '<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#fee2e2;color:#991b1b;">SENTINEL</span>' : ''}
                  <span style="font-size:24px;font-weight:800;color:${sc};">${this._selectedStatus.score}</span>
                </div>
              </div>
            </div>
            <div style="margin-bottom:20px;">
              <div class="modal-label">Notes (optional)</div>
              <textarea class="erm-notes" id="cemNotes" placeholder="Any additional context..."></textarea>
            </div>
            <div class="modal-actions" style="justify-content:center;">
              <button class="modal-btn modal-btn-cancel" onclick="ComplianceEntryModal._closeConfirmModal()">Cancel</button>
              <button class="modal-btn modal-btn-submit" id="cemSubmitBtn" onclick="ComplianceEntryModal._submit()">Submit</button>
            </div>
          </div>
        </div>
      </div>`);
  },

  _closeConfirmModal: function() { const el = document.getElementById('cemConfirmOverlay'); if (el) el.remove(); },

  _submit: async function() {
    const btn = document.getElementById('cemSubmitBtn');
    btn.disabled = true; btn.textContent = 'Submitting...';
    const notes = document.getElementById('cemNotes').value.trim();
    try {
      const resp = await fetch(`${this._apiBase}/v1/compliance/entry`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: this._tenantId,
          membership_number: String(this._memberId),
          member_compliance_id: this._selectedItem.member_compliance_id,
          status_id: this._selectedStatus.status_id,
          notes: notes || null
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed');
      this._closeConfirmModal();
      const sentinelMsg = data.is_sentinel ? '\n⚠️ SENTINEL EVENT — Immediate escalation triggered.' : '';
      alert(`Compliance recorded: ${this._selectedItem.item_name} → ${this._selectedStatus.status_code.replace(/_/g,' ')} (score ${data.score})${sentinelMsg}`);
      if (this._onSuccess) this._onSuccess();
    } catch(err) { alert('Failed: ' + err.message); btn.disabled = false; btn.textContent = 'Submit'; }
  }
};
