// document-detail-modal.js — shared Document Repository UI (Session 147)
// Used by: physician_detail.html (Documents card) and documents.html (the
// program Documents page). Two doors:
//   DocumentDetailModal.open({ link, apiBase, tenantId, onChange })
//   DocumentDetailModal.openUpload({ apiBase, tenantId, memberNumber?, memberName?, allowPersonPick?, onDone })
// The card is the entity; the member's primary id is the LINK — the
// membership number appears only at the API door (the endpoints resolve
// number → link) and in the display.

const DocumentDetailModal = {
  _apiBase: '',
  _tenantId: null,
  _onChange: null,
  _doc: null,
  _types: null,      // taxonomy cache (per open)
  _roster: null,     // person pick-list cache (per open)
  _editingPerson: false,

  STATUS_STYLE: {
    R: { label: 'Received',   bg: '#e0f2fe', fg: '#0369a1' },
    I: { label: 'In review',  bg: '#fef3c7', fg: '#92400e' },
    F: { label: 'Filed',      bg: '#dcfce7', fg: '#166534' },
    S: { label: 'Superseded', bg: '#e2e8f0', fg: '#475569' }
  },

  FORMATS: ['pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'txt', 'docx'],

  _cssInjected: false,
  _injectCSS: function() {
    if (this._cssInjected) return;
    const style = document.createElement('style');
    style.textContent = `
      .ddm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999}
      .ddm-modal{background:white;border-radius:16px;width:600px;max-width:92vw;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.2);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
      .ddm-header{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:14px 20px;border-bottom:1px solid #e2e8f0}
      .ddm-title{font-size:16px;font-weight:700;margin:0;color:#1e293b;line-height:1.3}
      .ddm-sub{font-size:12px;color:#94a3b8;margin-top:3px}
      .ddm-close{border:none;background:none;font-size:18px;cursor:pointer;color:#94a3b8;flex-shrink:0}
      .ddm-body{padding:14px 20px;overflow-y:auto}
      .ddm-chip{display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px;white-space:nowrap}
      .ddm-banner{padding:10px 14px;border-radius:8px;font-size:12px;line-height:1.5;margin-bottom:12px}
      .ddm-banner.frozen{background:#f1f5f9;border:1px solid #cbd5e1;color:#475569}
      .ddm-banner.hold{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
      .ddm-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
      .ddm-label{color:#64748b;font-weight:600;flex-shrink:0}
      .ddm-value{color:#1e293b;font-weight:600;text-align:right;min-width:0}
      .ddm-value select,.ddm-value input[type=date],.ddm-value input[type=text]{padding:5px 8px;font-size:12px;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;color:#1e293b;max-width:260px}
      .ddm-mini{font-size:11px;color:#94a3b8}
      .ddm-btn{padding:7px 14px;border-radius:8px;border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
      .ddm-btn-neutral{background:#f1f5f9;color:#475569}
      .ddm-btn-blue{background:#3b82f6;color:white}
      .ddm-btn-green{background:#16a34a;color:white}
      .ddm-btn-link{background:none;border:none;color:#3b82f6;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;padding:0}
      .ddm-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
      .ddm-field{margin-bottom:12px}
      .ddm-field-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#64748b;margin-bottom:5px}
      .ddm-field input[type=text],.ddm-field input[type=date],.ddm-field select{width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;color:#1e293b;box-sizing:border-box}
      .ddm-filepick{display:flex;align-items:center;gap:10px;padding:14px;border:2px dashed #cbd5e1;border-radius:10px;background:#f8fafc;cursor:pointer;font-size:13px;color:#64748b}
      .ddm-filepick:hover{border-color:#94a3b8}
      .ddm-error{color:#991b1b;font-size:12px;margin-top:8px;display:none}
    `;
    document.head.appendChild(style);
    this._cssInjected = true;
  },

  _esc: function(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  _role: function() {
    try { return JSON.parse(sessionStorage.getItem('lp_session'))?.role || null; }
    catch (e) { return null; }
  },
  _isAdmin: function() { return ['admin', 'superuser'].includes(this._role()); },

  _sizeLabel: function(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  },

  _fetchJSON: async function(path, opts) {
    const resp = await fetch(`${this._apiBase}${path}`, Object.assign({ credentials: 'include' }, opts || {}));
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `${path} → ${resp.status}`);
    return data;
  },

  _loadTypes: async function() {
    if (this._types) return this._types;
    const data = await this._fetchJSON(`/v1/document-types?tenant_id=${this._tenantId}`);
    this._types = data.types || [];
    return this._types;
  },

  _loadRoster: async function() {
    if (this._roster) return this._roster;
    const data = await this._fetchJSON(`/v1/wellness/members?tenant_id=${this._tenantId}`);
    this._roster = (data.members || [])
      .map(m => ({ number: String(m.membership_number), name: `${m.fname} ${m.lname}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return this._roster;
  },

  // ── The document card ─────────────────────────────────────────────

  open: async function(opts) {
    this._injectCSS();
    this._apiBase = opts.apiBase;
    this._tenantId = opts.tenantId;
    this._onChange = opts.onChange || null;
    this._doc = null;
    this._types = null;
    this._roster = null;
    this._editingPerson = false;
    this._showOverlay('<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px">Loading…</div>');
    try {
      const [card] = await Promise.all([
        this._fetchJSON(`/v1/documents/${opts.link}?tenant_id=${this._tenantId}`),
        this._loadTypes()
      ]);
      this._doc = card.document;
      this._render();
    } catch (e) {
      this._showOverlay(`<div style="padding:30px;text-align:center;font-size:13px;color:#991b1b">The document could not be loaded.<br><span class="ddm-mini">${this._esc(e.message)}</span><div style="margin-top:14px"><button class="ddm-btn ddm-btn-neutral" onclick="DocumentDetailModal.close()">Close</button></div></div>`);
    }
  },

  _showOverlay: function(innerHTML) {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'ddm-overlay';
    overlay.id = 'ddmOverlay';
    overlay.onclick = (e) => { if (e.target === overlay) this.close(); };
    overlay.innerHTML = `<div class="ddm-modal">${innerHTML}</div>`;
    document.body.appendChild(overlay);
  },

  close: function() {
    document.getElementById('ddmOverlay')?.remove();
  },

  _patch: async function(body) {
    try {
      const data = await this._fetchJSON(`/v1/documents/${this._doc.link}?tenant_id=${this._tenantId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      this._doc = data.document;
      this._editingPerson = false;
      this._render();
      if (this._onChange) this._onChange();
    } catch (e) {
      alert('Save failed: ' + e.message);
      this._render();
    }
  },

  _render: function() {
    const d = this._doc;
    const esc = this._esc.bind(this);
    const st = this.STATUS_STYLE[d.status] || { label: d.status, bg: '#e2e8f0', fg: '#475569' };
    const frozen = d.status === 'S';
    const admin = this._isAdmin();

    const row = (label, valueHTML) =>
      `<div class="ddm-row"><span class="ddm-label">${label}</span><span class="ddm-value">${valueHTML}</span></div>`;

    // Person — display + change/assign (not editable on a frozen version)
    let personHTML;
    if (this._editingPerson) {
      const options = ['<option value="">— no person (program document) —</option>']
        .concat((this._roster || []).map(p =>
          `<option value="${esc(p.number)}" ${d.member_number === p.number ? 'selected' : ''}>${esc(p.name)} · #${esc(p.number)}</option>`));
      personHTML = `<select id="ddmPersonSel">${options.join('')}</select>
        <button class="ddm-btn-link" style="margin-left:6px" onclick="DocumentDetailModal._savePerson()">Save</button>
        <button class="ddm-btn-link" style="margin-left:6px;color:#94a3b8" onclick="DocumentDetailModal._editingPerson=false;DocumentDetailModal._render()">Cancel</button>`;
    } else if (d.member_name) {
      personHTML = `${esc(d.member_name)} <span class="ddm-mini">#${esc(d.member_number)}</span>` +
        (frozen ? '' : ` <button class="ddm-btn-link" style="margin-left:6px" onclick="DocumentDetailModal._startPersonEdit()">Change</button>`);
    } else {
      personHTML = `<span class="ddm-mini">No person — program-level</span>` +
        (frozen ? '' : ` <button class="ddm-btn-link" style="margin-left:6px" onclick="DocumentDetailModal._startPersonEdit()">Assign</button>`);
    }

    // Type — pick-list commits on change
    let typeHTML;
    if (frozen) {
      typeHTML = d.type_name ? esc(d.type_name) : '<span class="ddm-mini">Unclassified</span>';
    } else {
      const options = ['<option value="">— unclassified —</option>']
        .concat((this._types || []).map(t =>
          `<option value="${esc(t.type_code)}" ${d.type_code === t.type_code ? 'selected' : ''}>${esc(t.type_name)}</option>`));
      typeHTML = `<select onchange="DocumentDetailModal._patch({ type_code: this.value || null })">${options.join('')}</select>`;
    }

    // Document date — the date ON the document (received date is stamped at upload)
    const dateHTML = frozen
      ? (d.document_date || '<span class="ddm-mini">Not set</span>')
      : `<input type="date" value="${esc(d.document_date || '')}" onchange="DocumentDetailModal._patch({ document_date: this.value || null })">`;

    // Status actions
    let statusButtons = '';
    if (!frozen) {
      if (d.status === 'R') statusButtons =
        `<button class="ddm-btn ddm-btn-blue" onclick="DocumentDetailModal._patch({ status: 'I' })">Start review</button>
         <button class="ddm-btn ddm-btn-green" onclick="DocumentDetailModal._patch({ status: 'F' })">Mark filed</button>`;
      else if (d.status === 'I') statusButtons =
        `<button class="ddm-btn ddm-btn-green" onclick="DocumentDetailModal._patch({ status: 'F' })">Mark filed</button>`;
      else if (d.status === 'F') statusButtons =
        `<button class="ddm-btn ddm-btn-neutral" onclick="DocumentDetailModal._patch({ status: 'I' })">Reopen review</button>`;
    }

    // Legal hold + retention — admin-only controls, visible to everyone
    const holdHTML = admin && !frozen
      ? `<label style="cursor:pointer;font-weight:600"><input type="checkbox" ${d.legal_hold ? 'checked' : ''} onchange="DocumentDetailModal._patch({ legal_hold: this.checked })" style="vertical-align:-2px"> ${d.legal_hold ? 'On — exempt from retention deletion' : 'Off'}</label>`
      : (d.legal_hold ? 'On — exempt from retention deletion' : 'Off');
    const retentionHTML = admin && !frozen
      ? `<input type="text" value="${esc(d.retention_class || '')}" placeholder="e.g. clinical-7yr" onchange="DocumentDetailModal._patch({ retention_class: this.value || null })">`
      : (d.retention_class ? esc(d.retention_class) : '<span class="ddm-mini">Not set</span>');

    const linkedHTML = d.linked_table
      ? `${esc(d.linked_table)} record ${esc(d.linked_link)}` +
        (frozen ? '' : ` <button class="ddm-btn-link" style="margin-left:6px" onclick="if(confirm('Remove the link to this record? The document itself is unchanged.'))DocumentDetailModal._patch({ linked_table: null, linked_link: null })">Unlink</button>`)
      : '<span class="ddm-mini">None</span>';

    const banners = [];
    if (frozen) banners.push(`<div class="ddm-banner frozen">This version was superseded by a newer file — it is kept for the record and cannot be changed. <span id="ddmNewerSlot"></span></div>`);
    if (d.legal_hold) banners.push(`<div class="ddm-banner hold">⚖️ Legal hold — this document is exempt from any retention deletion until the hold is lifted.</div>`);

    const versionHTML = `v${d.version}` + (d.supersedes_link
      ? ` <button class="ddm-btn-link" style="margin-left:6px" onclick="DocumentDetailModal.open({ link: ${d.supersedes_link}, apiBase: DocumentDetailModal._apiBase, tenantId: DocumentDetailModal._tenantId, onChange: DocumentDetailModal._onChange })">View previous version</button>`
      : '');

    const titleHTML = frozen ? esc(d.title)
      : `<input type="text" value="${esc(d.title)}" maxlength="200" style="max-width:none;flex:1;font-weight:700;font-size:15px"
           onchange="if(this.value.trim())DocumentDetailModal._patch({ title: this.value.trim() })">`;

    this._showOverlay(`
      <div class="ddm-header">
        <div style="flex:1;min-width:0">
          <div class="ddm-title" style="display:flex;align-items:center;gap:8px">📄 ${titleHTML}</div>
          <div class="ddm-sub">
            <span class="ddm-chip" style="background:${st.bg};color:${st.fg}">${st.label}</span>
            <span style="margin-left:8px">${esc(d.file_format.toUpperCase())} · ${this._sizeLabel(d.size_bytes)} · received ${esc(d.received_date || '')}</span>
          </div>
        </div>
        <button class="ddm-close" onclick="DocumentDetailModal.close()">✕</button>
      </div>
      <div class="ddm-body">
        ${banners.join('')}
        ${row('Person', personHTML)}
        ${row('Document type', typeHTML)}
        ${row('Date on the document', dateHTML)}
        ${row('Received', `${esc(d.received_date || '')} <span class="ddm-mini">via ${esc(d.source_channel)}${d.uploaded_by_name ? ' · ' + esc(d.uploaded_by_name) : ''}</span>`)}
        ${row('Version', versionHTML)}
        ${row('Linked record', linkedHTML)}
        ${row('Legal hold', holdHTML)}
        ${row('Retention class', retentionHTML)}
        <div class="ddm-mini" style="margin-top:8px" title="${esc(d.checksum)}">Integrity checksum ${esc((d.checksum || '').substring(0, 16))}… — verified on every download</div>
        <div class="ddm-actions">
          ${statusButtons}
          ${frozen ? '' : `<button class="ddm-btn ddm-btn-neutral" onclick="DocumentDetailModal._pickReplacement()">Replace file…</button>`}
          <button class="ddm-btn ddm-btn-blue" onclick="window.open('${this._apiBase}/v1/documents/${d.link}/file?tenant_id=${this._tenantId}', '_blank')">⬇ Download</button>
          <button class="ddm-btn ddm-btn-neutral" onclick="DocumentDetailModal.close()">Close</button>
        </div>
      </div>
    `);

    if (frozen) this._findNewerVersion();
  },

  _startPersonEdit: async function() {
    try {
      await this._loadRoster();
      this._editingPerson = true;
      this._render();
    } catch (e) { alert('The person list could not be loaded: ' + e.message); }
  },

  _savePerson: function() {
    const v = document.getElementById('ddmPersonSel').value;
    this._patch({ member_number: v || null });
  },

  // On a superseded card, find the version that replaced it so the banner
  // can jump forward along the chain, not just back.
  _findNewerVersion: async function() {
    try {
      const data = await this._fetchJSON(`/v1/documents?tenant_id=${this._tenantId}&include_superseded=1`);
      const newer = (data.documents || []).find(x => x.supersedes_link === this._doc.link);
      const slot = document.getElementById('ddmNewerSlot');
      if (newer && slot) {
        slot.innerHTML = `<button class="ddm-btn-link" onclick="DocumentDetailModal.open({ link: ${newer.link}, apiBase: DocumentDetailModal._apiBase, tenantId: DocumentDetailModal._tenantId, onChange: DocumentDetailModal._onChange })">Open the current version (v${newer.version})</button>`;
      }
    } catch (e) { console.error('Newer-version lookup failed:', e.message); }
  },

  // ── File handling (shared by replace + upload) ────────────────────

  _readFile: function(file) {
    return new Promise((resolve, reject) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!this.FORMATS.includes(ext)) {
        reject(new Error(`"${file.name}" is a .${ext} file — the repository accepts: ${this.FORMATS.join(', ')}`));
        return;
      }
      // Mirrors the server's default cap (10 MB, sysparm-tunable) so the
      // refusal happens before a doomed upload (S148 audit: client said 14,
      // server said 10 — the mismatch let a 12 MB file upload and fail).
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error(`"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB — too large to upload until the production file storage is connected`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ base64: String(reader.result).split(',')[1], format: ext, name: file.name });
      reader.onerror = () => reject(new Error(`"${file.name}" could not be read`));
      reader.readAsDataURL(file);
    });
  },

  _pickFile: function(onPicked) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = this.FORMATS.map(f => '.' + f).join(',');
    input.onchange = async () => {
      if (!input.files.length) return;
      try { onPicked(await this._readFile(input.files[0])); }
      catch (e) { alert(e.message); }
    };
    input.click();
  },

  _pickReplacement: function() {
    this._pickFile(async (f) => {
      if (!confirm(`Replace the file with "${f.name}"? The current version is kept and marked superseded — nothing is deleted.`)) return;
      try {
        const data = await this._fetchJSON(`/v1/documents/${this._doc.link}/replace?tenant_id=${this._tenantId}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_base64: f.base64, file_format: f.format })
        });
        this._doc = data.document;   // the NEW version's card
        this._render();
        if (this._onChange) this._onChange();
      } catch (e) { alert('Replace failed: ' + e.message); }
    });
  },

  // ── The upload dialog ─────────────────────────────────────────────

  _pendingFile: null,

  openUpload: async function(opts) {
    this._injectCSS();
    this._apiBase = opts.apiBase;
    this._tenantId = opts.tenantId;
    this._types = null;
    this._roster = null;
    this._pendingFile = null;
    this._uploadOpts = opts;
    try {
      await this._loadTypes();
      if (opts.allowPersonPick) await this._loadRoster();
    } catch (e) { alert('The upload form could not be prepared: ' + e.message); return; }
    this._renderUpload();
  },

  _renderUpload: function() {
    const esc = this._esc.bind(this);
    const o = this._uploadOpts;
    const f = this._pendingFile;

    const typeOptions = ['<option value="">— classify later —</option>']
      .concat((this._types || []).map(t => `<option value="${esc(t.type_code)}">${esc(t.type_name)}</option>`));

    let personField = '';
    if (o.memberNumber) {
      personField = `<div class="ddm-field"><div class="ddm-field-label">Person</div>
        <div style="font-size:13px;font-weight:600;color:#1e293b;padding:8px 10px;background:#f8fafc;border-radius:8px">${esc(o.memberName || '')} <span class="ddm-mini">#${esc(o.memberNumber)}</span></div></div>`;
    } else if (o.allowPersonPick) {
      const options = ['<option value="">— no person (program document) —</option>']
        .concat((this._roster || []).map(p => `<option value="${esc(p.number)}">${esc(p.name)} · #${esc(p.number)}</option>`));
      personField = `<div class="ddm-field"><div class="ddm-field-label">Person (optional)</div>
        <select id="ddmUpPerson">${options.join('')}</select></div>`;
    }

    this._showOverlay(`
      <div class="ddm-header">
        <div><div class="ddm-title">📤 Add a document</div>
        <div class="ddm-sub">The file is kept exactly as uploaded — replacements supersede, nothing is ever deleted.</div></div>
        <button class="ddm-close" onclick="DocumentDetailModal.close()">✕</button>
      </div>
      <div class="ddm-body">
        <div class="ddm-field">
          <div class="ddm-filepick" onclick="DocumentDetailModal._pickUploadFile()">
            ${f ? `📄 <b>${esc(f.name)}</b> <span class="ddm-mini">(${f.format.toUpperCase()} — click to choose a different file)</span>`
                : '📎 Click to choose a file <span class="ddm-mini">— pdf, image, txt, or docx</span>'}
          </div>
        </div>
        <div class="ddm-field"><div class="ddm-field-label">Title</div>
          <input type="text" id="ddmUpTitle" maxlength="200" placeholder="What is this document?" value="${f ? esc(f.name.replace(/\.[^.]+$/, '')) : ''}"></div>
        ${personField}
        <div class="ddm-field"><div class="ddm-field-label">Document type</div>
          <select id="ddmUpType">${typeOptions.join('')}</select></div>
        <div class="ddm-field"><div class="ddm-field-label">Date on the document (optional)</div>
          <input type="date" id="ddmUpDate"></div>
        <div class="ddm-error" id="ddmUpError"></div>
        <div class="ddm-actions">
          <button class="ddm-btn ddm-btn-neutral" onclick="DocumentDetailModal.close()">Cancel</button>
          <button class="ddm-btn ddm-btn-blue" onclick="DocumentDetailModal._submitUpload()">Upload</button>
        </div>
      </div>
    `);
  },

  _pickUploadFile: function() {
    // Re-render loses unsaved field values — carry them across the re-render.
    const keep = {
      title: document.getElementById('ddmUpTitle')?.value,
      type: document.getElementById('ddmUpType')?.value,
      date: document.getElementById('ddmUpDate')?.value,
      person: document.getElementById('ddmUpPerson')?.value
    };
    this._pickFile((f) => {
      this._pendingFile = f;
      this._renderUpload();
      if (keep.title) document.getElementById('ddmUpTitle').value = keep.title;
      if (keep.type) document.getElementById('ddmUpType').value = keep.type;
      if (keep.date) document.getElementById('ddmUpDate').value = keep.date;
      if (keep.person && document.getElementById('ddmUpPerson')) document.getElementById('ddmUpPerson').value = keep.person;
    });
  },

  _submitUpload: async function() {
    const err = document.getElementById('ddmUpError');
    err.style.display = 'none';
    const showErr = (msg) => { err.textContent = msg; err.style.display = 'block'; };

    if (!this._pendingFile) { showErr('Choose a file first.'); return; }
    const title = document.getElementById('ddmUpTitle').value.trim();
    if (!title) { showErr('Give the document a title.'); return; }

    const o = this._uploadOpts;
    const body = {
      title,
      file_base64: this._pendingFile.base64,
      file_format: this._pendingFile.format,
      source_channel: 'upload'
    };
    const memberNumber = o.memberNumber || document.getElementById('ddmUpPerson')?.value;
    if (memberNumber) body.member_number = memberNumber;
    const typeCode = document.getElementById('ddmUpType').value;
    if (typeCode) body.type_code = typeCode;
    const docDate = document.getElementById('ddmUpDate').value;
    if (docDate) body.document_date = docDate;

    try {
      const data = await this._fetchJSON(`/v1/documents?tenant_id=${this._tenantId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      this.close();
      if (o.onDone) o.onDone(data.document);
    } catch (e) { showErr('Upload failed: ' + e.message); }
  }
};
