// compliance-items-modal.js - Shared compliance item assignment toggle modal
// Used by: clinic.html, compliance_member.html

const ComplianceItemsModal = {
  _masterItems: null,
  _memberId: null,
  _displayName: '',
  _apiBase: '',
  _tenantId: null,
  _onSuccess: null,

  ITEM_ICONS: { DRUG_TEST_COMP:'🧪', DRUG_TEST_RESULT:'🔬', CHECKIN:'✅', APPOINTMENT:'📅', PROGRAM_STATUS:'📊', MONITORING_ENG:'📱' },

  // Open the modal
  // opts: { memberId, displayName, apiBase, tenantId, currentItems (optional), onSuccess }
  open: async function(opts) {
    this._memberId = opts.memberId;
    this._displayName = opts.displayName || '';
    this._apiBase = opts.apiBase;
    this._tenantId = opts.tenantId;
    this._onSuccess = opts.onSuccess || null;

    // Load master items (cached)
    if (!this._masterItems) {
      try {
        const resp = await fetch(`${opts.apiBase}/v1/compliance/items?tenant_id=${opts.tenantId}`, { credentials: 'include' });
        if (resp.ok) this._masterItems = await resp.json();
      } catch(e) { console.warn('Failed to load master compliance items:', e.message); }
    }
    if (!this._masterItems || !this._masterItems.length) {
      alert('No compliance items configured for this tenant.');
      return;
    }

    // Get current items for this member
    let currentItems = opts.currentItems || [];
    if (!opts.currentItems) {
      try {
        const resp = await fetch(`${opts.apiBase}/v1/compliance/member/${opts.memberId}?tenant_id=${opts.tenantId}`, { credentials: 'include' });
        if (resp.ok) currentItems = await resp.json();
      } catch(e) { console.warn('Failed to load member compliance items:', e.message); }
    }

    const currentIds = new Set(currentItems.map(c => c.compliance_item_id));

    const togglesHtml = this._masterItems.map(ci => {
      const isOn = currentIds.has(ci.compliance_item_id);
      const pct = Math.round(ci.weight * 100);
      const icon = this.ITEM_ICONS[ci.item_code] || '📋';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9">
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600;color:#1e293b">${icon} ${ci.item_name}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px">${pct}% weight</div>
        </div>
        <div style="position:relative;width:44px;height:24px;flex-shrink:0">
          <input type="checkbox" data-item-id="${ci.compliance_item_id}" ${isOn ? 'checked' : ''} style="opacity:0;width:0;height:0;position:absolute">
          <span style="position:absolute;cursor:pointer;inset:0;background:${isOn?'#3b82f6':'#cbd5e1'};border-radius:24px;transition:.2s" onclick="this.previousElementSibling.checked=!this.previousElementSibling.checked;this.style.background=this.previousElementSibling.checked?'#3b82f6':'#cbd5e1';this.querySelector('span').style.transform=this.previousElementSibling.checked?'translateX(20px)':'translateX(0)'"><span style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:white;border-radius:50%;transition:.2s;${isOn?'transform:translateX(20px)':''}"></span></span>
        </div>
      </div>`;
    }).join('');

    const existing = document.getElementById('cimOverlay');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cimOverlay" onclick="if(event.target===this)ComplianceItemsModal.close()">
        <div class="modal" style="width:480px">
          <div class="modal-header">
            <div><h2>⚙️ Compliance Items</h2><div class="modal-tag">${this._displayName}</div></div>
            <button class="modal-close" onclick="ComplianceItemsModal.close()">✕</button>
          </div>
          <div class="modal-body">
            ${togglesHtml}
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;padding:16px 24px;border-top:1px solid #e2e8f0">
            <button class="modal-btn modal-btn-cancel" onclick="ComplianceItemsModal.close()">Cancel</button>
            <button class="modal-btn modal-btn-submit" id="cimSaveBtn" onclick="ComplianceItemsModal._save()">Save</button>
          </div>
        </div>
      </div>`);
  },

  close: function() {
    const el = document.getElementById('cimOverlay');
    if (el) el.remove();
  },

  _save: async function() {
    const btn = document.getElementById('cimSaveBtn');
    btn.disabled = true; btn.textContent = 'Saving...';

    const checkboxes = document.querySelectorAll('#cimOverlay input[type=checkbox]');
    const toAssign = [];
    const toRemove = [];

    checkboxes.forEach(cb => {
      const itemId = parseInt(cb.dataset.itemId);
      if (cb.checked) {
        toAssign.push({ compliance_item_id: itemId });
      } else {
        toRemove.push(itemId);
      }
    });

    try {
      if (toAssign.length > 0) {
        const resp = await fetch(`${this._apiBase}/v1/compliance/member/${this._memberId}/assign?tenant_id=${this._tenantId}`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: toAssign })
        });
        if (!resp.ok) { const d = await resp.json(); throw new Error(d.error || 'Failed'); }
      }
      for (const itemId of toRemove) {
        const delResp = await fetch(`${this._apiBase}/v1/compliance/member/${this._memberId}/assign/${itemId}?tenant_id=${this._tenantId}`, {
          method: 'DELETE', credentials: 'include'
        });
        if (!delResp.ok) console.warn('Compliance item delete failed:', delResp.status);
      }
      this.close();
      if (this._onSuccess) this._onSuccess();
    } catch(err) {
      alert('Error: ' + err.message);
      btn.disabled = false; btn.textContent = 'Save';
    }
  }
};
