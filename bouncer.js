/**
 * bouncer.js — Access control gate for page entry points
 *
 * Every clinical/admin page calls Bouncer.check() on load.
 * Today: always allows access (returns true).
 * Future: calls server endpoint with user session + action,
 *         redirects to access-denied page if unauthorized.
 *
 * Usage:
 *   <script src="bouncer.js"></script>
 *   <script>Bouncer.check('clinic');</script>
 *
 * Actions: dashboard, clinic, physician_detail, csr, action_queue,
 *          admin, protocol_cards, compliance
 */

const Bouncer = {

  /**
   * Check if the current user is allowed to access this page.
   * @param {string} action - The door being entered (e.g., 'clinic', 'csr')
   * @returns {boolean} true if allowed
   */
  check(action) {
    // Phase 1: everyone gets in
    return true;

    // Phase 2 (SSO/RBAC): uncomment to enforce
    // return this._serverCheck(action);
  },

  /**
   * Future: server-side access check.
   * Calls /v1/access/check, redirects if denied.
   */
  async _serverCheck(action) {
    try {
      const apiBase = window.LP_STATE?.apiBase || window.location.origin;
      const resp = await fetch(`${apiBase}/v1/access/check?action=${encodeURIComponent(action)}`, {
        credentials: 'include'
      });
      if (!resp.ok) {
        this._deny(action);
        return false;
      }
      const data = await resp.json();
      if (!data.allowed) {
        this._deny(action);
        return false;
      }
      return true;
    } catch (e) {
      // Network error — deny by default when enforcement is active
      this._deny(action);
      return false;
    }
  },

  /**
   * Redirect to access denied page.
   */
  _deny(action) {
    console.warn(`Bouncer: access denied for action '${action}'`);
    window.location.href = 'access_denied.html';
  }
};
