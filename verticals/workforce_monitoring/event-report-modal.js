// event-report-modal.js - Shared event reporting modal
// Used by: clinic.html, physician_detail.html, physician_portal.html

const EventReportModal = {
  _category: '',
  _memberId: null,
  _displayName: '',
  _apiBase: '',
  _tenantId: null,
  _onSuccess: null,

  // Inject CSS once
  _cssInjected: false,
  _injectCSS: function() {
    if (this._cssInjected) return;
    const style = document.createElement('style');
    style.textContent = `
      .erm-cat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px}
      .erm-cat-btn{background:white;border:2px solid #e2e8f0;border-radius:10px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;font-family:inherit;transition:all .15s}
      .erm-cat-btn:hover{border-color:#cbd5e1;background:#f8fafc}
      .erm-cat-btn.selected{border-color:#3b82f6;background:#eff6ff}
      .erm-cat-icon{font-size:20px}
      .erm-cat-text{font-size:11px;font-weight:700;color:#1e293b;text-align:center;line-height:1.2}
      .erm-sev-row{display:flex;align-items:center;gap:16px;margin-bottom:6px}
      .erm-sev-val{font-size:30px;font-weight:800;width:46px;text-align:center}
      .erm-sev-val.s0{color:#16a34a}.erm-sev-val.s1{color:#ca8a04}.erm-sev-val.s2{color:#ea580c}.erm-sev-val.s3{color:#dc2626}
      .erm-sev-slider{flex:1}
      .erm-sev-slider input[type=range]{width:100%;height:6px;-webkit-appearance:none;appearance:none;background:linear-gradient(to right,#16a34a,#ca8a04,#ea580c,#dc2626);border-radius:3px;outline:none}
      .erm-sev-slider input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:white;border:3px solid #1e293b;box-shadow:0 2px 6px rgba(0,0,0,.15);cursor:pointer}
      .erm-sev-labels{display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;font-weight:600;margin-bottom:20px}
      .erm-notes{width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;color:#1e293b;min-height:56px;resize:vertical;margin-bottom:20px}
    `;
    document.head.appendChild(style);
    this._cssInjected = true;
  },

  CAT_LABELS: {
    adverse_patient: 'Adverse Patient Event',
    call_surge: 'Call Schedule Surge',
    compliance: 'Compliance / Investigation',
    personal: 'Personal Life Disruption',
    treatment: 'Treatment Change',
    other: 'Other'
  },

  CAT_ICONS: {
    adverse_patient: '🏥',
    call_surge: '📞',
    compliance: '📋',
    personal: '🏠',
    treatment: '💊',
    other: '📌'
  },

  // Open the modal
  // opts: { memberId, displayName, apiBase, tenantId, onSuccess }
  open: function(opts) {
    this._injectCSS();
    this._category = '';
    this._memberId = opts.memberId;
    this._displayName = opts.displayName || '';
    this._apiBase = opts.apiBase;
    this._tenantId = opts.tenantId;
    this._onSuccess = opts.onSuccess || null;

    const catButtons = Object.keys(this.CAT_LABELS).map(key =>
      `<button class="erm-cat-btn" data-value="${key}" onclick="EventReportModal._selectCat(this)"><span class="erm-cat-icon">${this.CAT_ICONS[key]}</span><span class="erm-cat-text">${this.CAT_LABELS[key]}</span></button>`
    ).join('');

    const tagText = this._displayName + (opts.memberId ? ` · #${opts.memberId}` : '');

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="ermOverlay" onclick="if(event.target===this)EventReportModal.close()">
        <div class="modal">
          <div class="modal-header">
            <div><h2>⚡ Report Event</h2><div class="modal-tag">${tagText}</div></div>
            <button class="modal-close" onclick="EventReportModal.close()">✕</button>
          </div>
          <div class="modal-body">
            <div class="modal-label">Event type</div>
            <div class="erm-cat-grid">${catButtons}</div>
            <div class="modal-label">Severity</div>
            <div class="erm-sev-row">
              <div class="erm-sev-val s0" id="ermSevVal">0</div>
              <div class="erm-sev-slider">
                <input type="range" min="0" max="3" step="1" value="0" id="ermSevSlider" oninput="EventReportModal._updateSev()">
                <div class="erm-sev-labels"><span>None</span><span>Mild</span><span>Moderate</span><span>Severe</span></div>
              </div>
            </div>
            <div class="modal-label">Notes (optional)</div>
            <textarea class="erm-notes" id="ermNotes" placeholder="Any additional context..."></textarea>
            <div class="modal-actions">
              <button class="modal-btn modal-btn-cancel" onclick="EventReportModal.close()">Cancel</button>
              <button class="modal-btn modal-btn-submit" id="ermSubmitBtn" onclick="EventReportModal._submit()" disabled>Report Event</button>
            </div>
          </div>
        </div>
      </div>`);
  },

  close: function() {
    const el = document.getElementById('ermOverlay');
    if (el) el.remove();
    this._category = '';
    this._memberId = null;
    this._onSuccess = null;
  },

  _selectCat: function(btn) {
    document.querySelectorAll('.erm-cat-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    this._category = btn.dataset.value;
    document.getElementById('ermSubmitBtn').disabled = false;
  },

  _updateSev: function() {
    const v = parseInt(document.getElementById('ermSevSlider').value);
    const el = document.getElementById('ermSevVal');
    el.textContent = v;
    el.className = 'erm-sev-val s' + v;
  },

  _submit: async function() {
    const btn = document.getElementById('ermSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const severity = parseInt(document.getElementById('ermSevSlider').value);
    const notes = document.getElementById('ermNotes').value.trim();
    const activityDate = new Date().toLocaleDateString('en-CA');
    const commentText = this.CAT_LABELS[this._category] + (notes ? ': ' + notes : '');

    try {
      const resp = await fetch(`${this._apiBase}/v1/members/${this._memberId}/accruals`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: this._tenantId,
          activity_date: activityDate,
          base_points: severity,
          ACCRUAL_TYPE: 'EVENT',
          ACTIVITY_COMMENT: commentText
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed');

      const displayName = this._displayName;
      const onSuccess = this._onSuccess;
      this.close();
      alert(`Event recorded for ${displayName}.${severity >= 2 ? ' Care team notified.' : ''}`);
      if (onSuccess) onSuccess();
    } catch (err) {
      alert('Failed: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Report Event';
    }
  }
};
