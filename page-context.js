/**
 * page-context.js — Shared navigation context for all pages
 *
 * Instead of passing member/clinic/program data in URL parameters,
 * pages store context in sessionStorage before navigating and read it on arrival.
 * The destination page fetches display data (names, titles) from the API.
 *
 * Usage:
 *   // Before navigating:
 *   PageContext.navigate('compliance_member.html', { memberId: '34', programId: 13 });
 *
 *   // On the destination page:
 *   const ctx = PageContext.get();
 *   // ctx = { memberId: '34', programId: 13 }
 */

const PageContext = {
  STORAGE_KEY: 'lp_page_context',

  /**
   * Store context and navigate to a page.
   * @param {string} url - The page to navigate to (relative or absolute)
   * @param {object} context - Key/value pairs to store (memberId, programId, partnerId, etc.)
   */
  navigate(url, context) {
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(context || {}));
    window.location.href = url;
  },

  /**
   * Read the stored context. Returns {} if nothing stored.
   * Does NOT clear it — multiple reads are fine (e.g. after refresh).
   */
  get() {
    try {
      return JSON.parse(sessionStorage.getItem(this.STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  },

  /**
   * Update specific fields without wiping the rest.
   * Useful when a page learns new info (e.g. fetches display name from API).
   */
  update(fields) {
    const current = this.get();
    Object.assign(current, fields);
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
  },

  /**
   * Clear the stored context.
   */
  clear() {
    sessionStorage.removeItem(this.STORAGE_KEY);
  },

  /**
   * Get the member terminology label (singular). Cached in sessionStorage.
   * @returns {string} e.g. "Physician", "First Responder"
   */
  memberLabel() {
    return sessionStorage.getItem('lp_member_label') || 'Physician';
  },

  /**
   * Get the member terminology label (plural). Cached in sessionStorage.
   * @returns {string} e.g. "Physicians", "First Responders"
   */
  memberLabelPlural() {
    return sessionStorage.getItem('lp_member_label_plural') || 'Physicians';
  },

  /**
   * Load member labels from tenant config API and cache.
   * Call once after login or on first page load.
   */
  async loadMemberLabels() {
    const apiBase = window.LP_STATE?.apiBase || window.location.origin;
    const tenantId = sessionStorage.getItem('tenant_id');
    if (!tenantId) return;
    try {
      const resp = await fetch(`${apiBase}/v1/tenant/${tenantId}/config`, { credentials: 'include' });
      if (!resp.ok) return;
      const data = await resp.json();
      const labels = data.labels || {};
      if (labels.member_label) sessionStorage.setItem('lp_member_label', labels.member_label);
      if (labels.member_label_plural) sessionStorage.setItem('lp_member_label_plural', labels.member_label_plural);
    } catch (e) { /* non-fatal */ }
  },

  /**
   * Apply member labels to the page. Call after DOM is loaded.
   * Sets window.ML (singular) and window.MLP (plural) globals for JS use.
   * Replaces text in elements with data-ml="singular" or data-ml="plural".
   */
  applyMemberLabels() {
    window.ML = this.memberLabel();
    window.MLP = this.memberLabelPlural();
  },

  /**
   * Fetch member profile from the API and return display-ready fields.
   * Pages should call this instead of relying on URL params for names.
   * @param {string} memberId - membership_number
   * @returns {object} { memberId, displayName, fname, lname, title }
   */
  async fetchMemberProfile(memberId) {
    const apiBase = window.LP_STATE?.apiBase || window.location.origin;
    try {
      const resp = await fetch(`${apiBase}/v1/member/${memberId}/profile`, { credentials: 'include' });
      if (!resp.ok) return { memberId, displayName: `#${memberId}`, fname: '', lname: '', title: '' };
      const p = await resp.json();
      const displayName = `${p.title ? p.title + ' ' : ''}${p.fname} ${p.lname}`.trim();
      return { memberId, displayName, fname: p.fname, lname: p.lname, title: p.title || '' };
    } catch (e) {
      return { memberId, displayName: `#${memberId}`, fname: '', lname: '', title: '' };
    }
  }
};
