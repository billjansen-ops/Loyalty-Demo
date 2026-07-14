/**
 * refer_participant.js — "Refer participant" workflow (Session 125)
 *
 * Shared across the Insight dashboard + clinic surfaces so the workflow lives in
 * one place (no copy-paste). Opens a small panel, mints a referral code through
 * the general-purpose code engine (POST /v1/codes), and hands the operator a
 * shareable link + QR that points at the Performance Profile front door.
 *
 * The code's context (referral type, affiliation, track) is carried server-side
 * via the `code` table — never in the QR, which stays just base URL + opaque
 * token. The Performance Profile will read that context to pre-fill once that
 * (consumer-side) piece is built; until then the operator still gets a working,
 * tracked, shareable referral link.
 *
 * Requires /qrcode.min.js loaded on the host page (for the QR render).
 * Tenant is resolved from the logged-in session server-side; tenantId is passed
 * only so a superuser testing the page scopes correctly (ignored for normal users).
 *
 * Usage:  <script src="/qrcode.min.js"></script>
 *         <script src="refer_participant.js"></script>
 *         <button onclick="ReferParticipant.open({ tenantId: TENANT_ID })">Refer participant</button>
 */
(function () {
  var REFERRAL_TYPES = ['Self-referral', 'Employer', 'Board-mandated'];
  var TRACKS = [
    { v: '', label: '— optional —' },
    { v: 'stability', label: 'Stability & well-being' },
    { v: 'performance', label: 'Performance & growth' }
  ];

  var injected = false;
  var currentTenant = null;

  function apiBase() {
    return (window.LP_STATE && window.LP_STATE.apiBase) || window.location.origin;
  }

  function el(id) { return document.getElementById(id); }

  function injectOnce() {
    if (injected) return;
    injected = true;

    var css =
      '.rp-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:none;align-items:flex-start;justify-content:center;z-index:1000;overflow-y:auto;padding:6vh 16px}' +
      '.rp-overlay.open{display:flex}' +
      '.rp-modal{background:#fff;border-radius:14px;max-width:440px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.2);font-family:inherit}' +
      '.rp-head{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid #eef2f6}' +
      '.rp-head h3{margin:0;font-size:17px;color:#0f172a}' +
      '.rp-x{background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;line-height:1}' +
      '.rp-body{padding:18px 22px;display:flex;flex-direction:column;gap:14px}' +
      '.rp-field label{display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:5px}' +
      '.rp-field input,.rp-field select{width:100%;padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box}' +
      '.rp-chips{display:flex;gap:8px;flex-wrap:wrap}' +
      '.rp-chip{padding:8px 13px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;font-size:13px;font-weight:600;color:#334155;cursor:pointer}' +
      '.rp-chip.sel{background:#0f766e;border-color:#0f766e;color:#fff}' +
      '.rp-toggle{display:flex;align-items:center;gap:8px;font-size:13px;color:#334155}' +
      '.rp-btn{background:#0f766e;border:1px solid #0f766e;color:#fff;border-radius:8px;padding:10px 14px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}' +
      '.rp-btn.sec{background:#fff;border-color:#cbd5e1;color:#334155}' +
      '.rp-btn:disabled{opacity:.55;cursor:default}' +
      '.rp-msg{font-size:13px;color:#64748b;min-height:16px}' +
      '.rp-msg.err{color:#dc2626}' +
      '.rp-result{display:none;flex-direction:column;gap:12px;align-items:center;text-align:center;border-top:1px solid #eef2f6;padding-top:16px}' +
      '.rp-result.show{display:flex}' +
      '.rp-link{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#0f172a;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;word-break:break-all;width:100%;box-sizing:border-box}' +
      '.rp-qr{width:180px;height:180px}.rp-qr svg{width:100%;height:100%}';

    var html =
      '<div class="rp-overlay" id="rpOverlay">' +
        '<div class="rp-modal">' +
          '<div class="rp-head"><h3>Invite a participant</h3><button class="rp-x" onclick="ReferParticipant._close()">&times;</button></div>' +
          '<div class="rp-body">' +
            '<div class="rp-field"><label>Referral type</label><div class="rp-chips" id="rpTypes"></div></div>' +
            '<div class="rp-field"><label>Affiliation (program / organization)</label><input id="rpAff" placeholder="e.g. Wisconsin PHP"></div>' +
            '<div class="rp-field"><label>Track</label><select id="rpTrack"></select></div>' +
            '<label class="rp-toggle"><input type="checkbox" id="rpSingle"> Single use (one person) — leave off for a reusable link/QR</label>' +
            '<div style="display:flex;gap:10px;justify-content:flex-end;align-items:center">' +
              '<span class="rp-msg" id="rpMsg"></span>' +
              '<button class="rp-btn" id="rpCreate" onclick="ReferParticipant._mint()">Create referral link</button>' +
            '</div>' +
            '<div class="rp-result" id="rpResult">' +
              '<div class="rp-link" id="rpLink"></div>' +
              '<div class="rp-qr" id="rpQr"></div>' +
              '<div style="display:flex;gap:8px">' +
                '<button class="rp-btn sec" onclick="ReferParticipant._copy()">Copy link</button>' +
                '<button class="rp-btn sec" onclick="ReferParticipant._printQr()">Printable QR page</button>' +
                '<button class="rp-btn sec" onclick="ReferParticipant._reset()">New referral</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    // Referral-type chips
    var typeBox = el('rpTypes');
    REFERRAL_TYPES.forEach(function (t, i) {
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'rp-chip' + (i === 0 ? ' sel' : '');
      c.textContent = t;
      c.onclick = function () {
        typeBox.querySelectorAll('.rp-chip').forEach(function (x) { x.classList.remove('sel'); });
        c.classList.add('sel');
      };
      typeBox.appendChild(c);
    });
    // Track options
    var trackSel = el('rpTrack');
    TRACKS.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.v; o.textContent = t.label;
      trackSel.appendChild(o);
    });

    // Close on backdrop click
    el('rpOverlay').addEventListener('click', function (e) {
      if (e.target === el('rpOverlay')) ReferParticipant._close();
    });
  }

  function selectedType() {
    var sel = el('rpTypes').querySelector('.rp-chip.sel');
    return sel ? sel.textContent : REFERRAL_TYPES[0];
  }

  window.ReferParticipant = {
    open: function (opts) {
      opts = opts || {};
      currentTenant = opts.tenantId != null ? opts.tenantId : null;
      injectOnce();
      this._reset();
      el('rpOverlay').classList.add('open');
    },

    _close: function () { el('rpOverlay').classList.remove('open'); },

    _reset: function () {
      el('rpResult').classList.remove('show');
      el('rpMsg').textContent = '';
      el('rpMsg').classList.remove('err');
      el('rpCreate').disabled = false;
      el('rpCreate').style.display = '';
      el('rpAff').value = '';
      el('rpTrack').value = '';
      el('rpSingle').checked = false;
      var chips = el('rpTypes').querySelectorAll('.rp-chip');
      chips.forEach(function (x, i) { x.classList.toggle('sel', i === 0); });
    },

    _mint: async function () {
      var msg = el('rpMsg');
      msg.classList.remove('err');
      msg.textContent = 'Creating…';
      el('rpCreate').disabled = true;

      var context = { referral_type: selectedType() };
      var aff = el('rpAff').value.trim();
      if (aff) context.affiliation = aff;
      var track = el('rpTrack').value;
      if (track) context.track = track;

      var body = { code_type: 'referral', context: context };
      if (el('rpSingle').checked) body.max_uses = 1;

      var url = apiBase() + '/v1/codes' + (currentTenant != null ? '?tenant_id=' + encodeURIComponent(currentTenant) : '');
      try {
        var resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body)
        });
        if (!resp.ok) {
          var detail = '';
          try { detail = (await resp.json()).error; } catch (e) { /* non-JSON error body */ }
          throw new Error(detail || (resp.status + ' ' + resp.statusText));
        }
        var row = await resp.json();
        this._lastCode = row.code;
        this._show(apiBase() + '/p/' + row.code);
      } catch (e) {
        msg.classList.add('err');
        msg.textContent = 'Could not create the link: ' + e.message;
        el('rpCreate').disabled = false;
      }
    },

    _show: function (link) {
      el('rpMsg').textContent = '';
      el('rpCreate').style.display = 'none';
      el('rpLink').textContent = link;
      window._rpLink = link;
      var box = el('rpQr');
      box.innerHTML = '';
      if (typeof qrcode === 'function') {
        var qr = qrcode(0, 'M');
        qr.addData(link);
        qr.make();
        box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
      } else {
        box.textContent = '(QR generator not loaded)';
        console.error('refer_participant: /qrcode.min.js not loaded on this page');
      }
      el('rpResult').classList.add('show');
    },

    _copy: function () {
      var link = window._rpLink || '';
      navigator.clipboard.writeText(link).then(function () {}, function () {
        window.prompt('Copy this link:', link);
      });
    },

    // Printable QR page carrying THIS referral's code (Session 141, Erica
    // defect 3): the standalone QR page targets the /p/ front door with the
    // token, so a scanned referral QR pre-fills exactly like the copied link.
    _printQr: function () {
      if (!this._lastCode) return;
      window.open(apiBase() + '/performance-profile/qr?c=' + encodeURIComponent(this._lastCode), '_blank');
    }
  };
})();
