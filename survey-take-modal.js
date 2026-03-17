/**
 * survey-take-modal.js — Shared survey take modal component
 * 
 * Usage:
 *   <script src="../../survey-take-modal.js"></script>
 *   Then call: SurveyTakeModal.start(memberSurveyLink, surveyLink, contextLine, apiBase, tenantId, onClose)
 *   Or for PPSI: SurveyTakeModal.startPPSI(membershipNumber, apiBase, tenantId, onClose)
 */

const SurveyTakeModal = (() => {
  let stMemberSurveyLink = null;
  let stSurveyLink = null;
  let stReadonly = false;
  let stQuestions = [];
  let stMemberSurvey = null;
  let stAnswers = {};
  let stContextLine = null;
  let stApiBase = '';
  let stTenantId = 5;
  let stOnClose = null;
  let stPulseRespondentLink = null;
  let injected = false;

  function injectCSS() {
    if (document.getElementById('stModalCSS')) return;
    const style = document.createElement('style');
    style.id = 'stModalCSS';
    style.textContent = `
      .test-modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:10000;align-items:center;justify-content:center}
      .test-modal-overlay.active{display:flex}
      .test-modal{background:white;border-radius:8px;width:600px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 25px -5px rgba(0,0,0,.3)}
      .test-modal-header{padding:12px 16px;border-bottom:1px solid #e5e7eb}
      .test-modal-close{background:none;border:none;font-size:20px;color:#94a3b8;cursor:pointer;float:right}
      .test-modal-close:hover{color:#64748b}
      .test-modal-body{padding:16px}
      .st-category-block{margin-bottom:20px}
      .st-category-header{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;padding:6px 0;border-bottom:2px solid var(--primary,#3b82f6);margin-bottom:10px}
      .st-question-card{background:white;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;margin-bottom:8px;border-left:3px solid #e2e8f0}
      .st-question-card.answered{border-left-color:#22c55e}
      .st-question-card.req-unanswered{border-left-color:#ef4444}
      .st-question-text{font-size:14px;font-weight:500;color:#1e293b;margin-bottom:8px}
      .st-req-mark{color:#ef4444;font-size:11px;margin-left:3px}
      .st-answer-options{display:flex;flex-direction:column;gap:4px}
      .st-answer-option{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:13px}
      .st-answer-option:hover{background:#f1f5f9}
      .st-answer-option input{cursor:pointer;accent-color:var(--primary,#3b82f6)}
      .st-answer-option.selected{background:#eff6ff;font-weight:500}
      .st-answer-text{width:100%;padding:6px 10px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;font-family:inherit;box-sizing:border-box;resize:vertical}
      .st-answer-text:focus{outline:none;border-color:var(--primary,#3b82f6)}
      .st-readonly .st-answer-option{cursor:default}
      .st-readonly .st-answer-option:hover{background:transparent}
      .st-readonly input[type="radio"],.st-readonly input[type="checkbox"]{pointer-events:none}
      .st-readonly .st-answer-text{background:#f9fafb;color:#374151}
      .st-progress-bar-wrap{width:120px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;display:inline-block;vertical-align:middle;margin:0 6px}
      .st-progress-bar-fill{height:100%;background:var(--primary,#3b82f6);border-radius:3px;transition:width .3s}
    `;
    document.head.appendChild(style);
  }

  function injectHTML() {
    if (document.getElementById('surveyTakeModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="test-modal-overlay" id="surveyTakeModal">
        <div class="test-modal" style="max-width:780px;width:95%;max-height:90vh;display:flex;flex-direction:column;">
          <div class="test-modal-header" style="flex-shrink:0;">
            <div>
              <div id="stSurveyTitle" style="font-weight:700;font-size:15px;">Loading...</div>
              <div id="stSurveySubtitle" style="font-size:12px;color:#6b7280;margin-top:2px;"></div>
            </div>
            <button class="test-modal-close" onclick="SurveyTakeModal.close()">✕</button>
          </div>
          <div class="test-modal-body" id="stBody" style="flex:1;overflow-y:auto;padding:16px 20px;">
            <div style="text-align:center;padding:40px;color:#6b7280;">Loading questions...</div>
          </div>
          <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-top:1px solid #e5e7eb;background:#f8fafc;">
            <span id="stProgressInfo" style="font-size:13px;color:#64748b;"></span>
            <div id="stFooterButtons"></div>
          </div>
        </div>
      </div>
    `);
  }

  function ensure() {
    if (!injected) {
      injectCSS();
      injectHTML();
      injected = true;
    }
  }

  function start(memberSurveyLink, surveyLink, contextLine, apiBase, tenantId, onClose, pulseRespondentLink) {
    stApiBase = apiBase;
    stTenantId = tenantId;
    stMemberSurveyLink = memberSurveyLink;
    stSurveyLink = surveyLink;
    stReadonly = false;
    stContextLine = contextLine || null;
    stOnClose = onClose || null;
    stPulseRespondentLink = pulseRespondentLink || null;
    ensure();
    openModal();
  }

  function view(memberSurveyLink, apiBase, tenantId, onClose) {
    stApiBase = apiBase;
    stTenantId = tenantId;
    stMemberSurveyLink = memberSurveyLink;
    stSurveyLink = null;
    stReadonly = true;
    stContextLine = null;
    stOnClose = onClose || null;
    stPulseRespondentLink = null;
    ensure();
    openModal();
  }

  async function startPPSI(membershipNumber, apiBase, tenantId, onClose) {
    stApiBase = apiBase;
    stTenantId = tenantId;
    stOnClose = onClose || null;
    stPulseRespondentLink = null;
    ensure();

    // Start a new PPSI survey for this member
    const PPSI_SURVEY_LINK = 1;
    try {
      const startRes = await fetch(`${apiBase}/v1/members/${membershipNumber}/surveys`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survey_link: PPSI_SURVEY_LINK, tenant_id: tenantId })
      });
      if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.error || 'Failed to start survey');
      }
      const { member_survey_link } = await startRes.json();
      stMemberSurveyLink = member_survey_link;
      stSurveyLink = PPSI_SURVEY_LINK;
      stReadonly = false;
      stContextLine = null;
      openModal();
    } catch (e) {
      alert('Could not start survey: ' + e.message);
    }
  }

  async function openModal() {
    stQuestions = [];
    stMemberSurvey = null;
    stAnswers = {};
    document.getElementById('stSurveyTitle').textContent = 'Loading...';
    document.getElementById('stSurveySubtitle').textContent = '';
    document.getElementById('stBody').innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280;">Loading questions...</div>';
    document.getElementById('stFooterButtons').innerHTML = '';
    document.getElementById('stProgressInfo').innerHTML = '';
    document.getElementById('surveyTakeModal').classList.add('active');

    try {
      const msRes = await fetch(`${stApiBase}/v1/member-surveys/${stMemberSurveyLink}`, { credentials: 'include' });
      if (!msRes.ok) throw new Error('Could not load survey record');
      stMemberSurvey = await msRes.json();
      const sl = stSurveyLink || stMemberSurvey.survey_link;

      const qRes = await fetch(`${stApiBase}/v1/surveys/${sl}/questions?tenant_id=${stTenantId}`, { credentials: 'include' });
      if (!qRes.ok) throw new Error('Could not load questions');
      stQuestions = await qRes.json();

      for (const a of (stMemberSurvey.answers || [])) {
        stAnswers[a.question_link] = a.answer;
      }
      render();
    } catch (e) {
      document.getElementById('stBody').innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444;">Error: ${e.message}</div>`;
    }
  }

  function close() {
    document.getElementById('surveyTakeModal').classList.remove('active');
    if (stOnClose) stOnClose();
  }

  function render() {
    const isCompleted = !!stMemberSurvey.end_ts;
    const effectiveReadonly = stReadonly || isCompleted;

    const statusBadge = isCompleted
      ? '<span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:600;background:#dcfce7;color:#166534;">✓ Completed</span>'
      : '<span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:600;background:#fef3c7;color:#92400e;">In Progress</span>';

    document.getElementById('stSurveyTitle').textContent = stMemberSurvey.survey_name || 'Survey';
    document.getElementById('stSurveySubtitle').innerHTML = `${stMemberSurvey.survey_code || ''} &nbsp;${statusBadge}${stContextLine ? `<div style="margin-top:4px;font-size:13px;color:#1e293b;font-weight:500;">${stContextLine}</div>` : ''}`;

    const catMap = {};
    const categories = [];
    for (const q of stQuestions) {
      if (!catMap[q.category_code]) {
        catMap[q.category_code] = { code: q.category_code, name: q.category_name, questions: [] };
        categories.push(catMap[q.category_code]);
      }
      catMap[q.category_code].questions.push(q);
    }

    const body = document.getElementById('stBody');
    body.className = effectiveReadonly ? 'test-modal-body st-readonly' : 'test-modal-body';
    body.style.cssText = 'flex:1;overflow-y:auto;padding:16px 20px;';
    body.innerHTML = stQuestions.length === 0
      ? '<div style="text-align:center;padding:40px;color:#6b7280;">No questions assigned to this survey.</div>'
      : categories.map(cat => `
          <div class="st-category-block">
            <div class="st-category-header">${cat.name}</div>
            ${cat.questions.map(q => renderQuestion(q, effectiveReadonly)).join('')}
          </div>`).join('') + (effectiveReadonly ? '' : `
          <div class="st-category-block">
            <div class="st-category-header">Comments (Optional)</div>
            <div style="padding:8px 12px;">
              <textarea id="stCommentField" rows="3" placeholder="Add any additional notes or observations..."
                style="width:100%;padding:8px 10px;font-size:14px;border:1px solid #d1d5db;border-radius:6px;resize:vertical;font-family:inherit;"></textarea>
            </div>
          </div>`);

    document.getElementById('stFooterButtons').innerHTML = effectiveReadonly
      ? `<button class="btn btn-secondary btn-sm" onclick="SurveyTakeModal.close()">← Back</button>`
      : `<button class="btn btn-secondary btn-sm" onclick="SurveyTakeModal.close()">Cancel</button>
         <button class="btn btn-primary btn-sm" style="margin-left:8px;" id="stSaveBtn" onclick="SurveyTakeModal.submit()" disabled>Save</button>`;

    if (!effectiveReadonly) updateProgress();
  }

  function renderQuestion(q, ro) {
    const val = stAnswers[q.question_link] || '';
    const isAnswered = val !== '';
    const hasOptions = q.answers && q.answers.length > 0;
    const reqMark = q.is_required ? '<span class="st-req-mark">*</span>' : '';
    let optionsHtml;

    if (hasOptions) {
      optionsHtml = `<div class="st-answer-options">` +
        q.answers.map(a => {
          const chk = String(val) === String(a.answer_value) ? 'checked' : '';
          const sel = String(val) === String(a.answer_value) ? 'selected' : '';
          return `<label class="st-answer-option ${sel}">
            <input type="radio" name="stq_${q.question_link}" value="${a.answer_value}" ${chk}
              onchange="SurveyTakeModal.onRadio(${q.question_link},this)"> ${a.answer_text}
          </label>`;
        }).join('') + `</div>`;
    } else {
      optionsHtml = `<textarea class="st-answer-text" rows="2"
        onchange="SurveyTakeModal.onText(${q.question_link},this)"
        ${ro ? 'readonly' : ''}>${val}</textarea>`;
    }

    const cardClass = isAnswered ? 'answered' : (q.is_required ? 'req-unanswered' : '');
    return `<div class="st-question-card ${cardClass}" id="stqcard_${q.question_link}">
      <div class="st-question-text">${q.question}${reqMark}</div>
      ${optionsHtml}
    </div>`;
  }

  function onRadio(ql, input) {
    stAnswers[ql] = input.value;
    document.querySelectorAll(`input[name="stq_${ql}"]`).forEach(r =>
      r.closest('.st-answer-option').classList.toggle('selected', r.checked));
    refreshCard(ql); updateProgress();
  }

  function onText(ql, ta) {
    stAnswers[ql] = ta.value.trim();
    refreshCard(ql); updateProgress();
  }

  function refreshCard(ql) {
    const q = stQuestions.find(q => q.question_link == ql);
    const card = document.getElementById(`stqcard_${ql}`);
    if (!card || !q) return;
    const answered = !!(stAnswers[ql] && stAnswers[ql] !== '');
    card.classList.toggle('answered', answered);
    card.classList.toggle('req-unanswered', !answered && !!q.is_required);
  }

  function updateProgress() {
    const total = stQuestions.length;
    const answered = stQuestions.filter(q => stAnswers[q.question_link] && stAnswers[q.question_link] !== '').length;
    const req = stQuestions.filter(q => q.is_required).length;
    const reqDone = stQuestions.filter(q => q.is_required && stAnswers[q.question_link] && stAnswers[q.question_link] !== '').length;
    const pct = total ? Math.round(answered / total * 100) : 0;
    document.getElementById('stProgressInfo').innerHTML =
      `${answered}/${total} answered
       <span class="st-progress-bar-wrap"><span class="st-progress-bar-fill" style="width:${pct}%"></span></span>
       ${reqDone}/${req} required`;
    const saveBtn = document.getElementById('stSaveBtn');
    if (saveBtn) saveBtn.disabled = (reqDone < req);
  }

  function collectAnswers() {
    return Object.entries(stAnswers)
      .filter(([, v]) => v !== '')
      .map(([ql, v]) => ({ question_link: parseInt(ql), answer: String(v) }));
  }

  async function submit() {
    const missing = stQuestions.filter(q => q.is_required && (!stAnswers[q.question_link] || stAnswers[q.question_link] === ''));
    if (missing.length) {
      alert(`${missing.length} required question(s) unanswered`);
      return;
    }
    if (!confirm('Submit this survey? This cannot be undone.')) return;
    try {
      const submitBody = { answers: collectAnswers(), submit: true };
      if (stPulseRespondentLink) submitBody.pulse_respondent_link = stPulseRespondentLink;
      const commentEl = document.getElementById('stCommentField');
      if (commentEl && commentEl.value.trim()) submitBody.comment = commentEl.value.trim();
      const res = await fetch(`${stApiBase}/v1/member-surveys/${stMemberSurveyLink}/answers`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitBody)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      alert('Survey submitted successfully.');
      close();
    } catch (e) { alert('Submit failed: ' + e.message); }
  }

  return { start, startPPSI, view, close, onRadio, onText, submit };
})();
