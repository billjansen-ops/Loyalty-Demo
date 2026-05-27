/**
 * staff-label.js — Dynamic staff terminology
 *
 * Replaces the legacy hardcoded placeholder token "Clinician" / "Clinicians"
 * with whatever the tenant has configured for staff_label / staff_label_plural.
 * Healthcare pages still use "Clinician" / "Clinicians" as their in-markup
 * placeholder token (kept as-is for backward compat — switching the token to
 * something safer like "Staff" would collide with legitimate uses of the word
 * "staff meeting", etc.). Tenants override via the sysparm-backed labels
 * endpoint.
 *
 * Usage:
 *   <script src="../../staff-label.js"></script>
 *   Then call: await StaffLabel.init(tenantId);
 *   Or use:   StaffLabel.singular  → "Staff" (default) or configured value
 *             StaffLabel.plural    → "Staff" (default) or configured value
 *             StaffLabel.apply()   → replaces all visible "Clinician"
 *                                    placeholder tokens on the page with the
 *                                    tenant's configured value.
 *
 * Defaults: "Staff" / "Staff" — generic loyalty-platform terms. Healthcare
 * tenants like wi_php override to "Health Support Staff" / "Health Support
 * Staff" via the /v1/tenants/:id/labels endpoint. Pre-cleanup the defaults
 * were "Clinician" / "Clinicians", which leaked the healthcare framing into
 * every non-configured tenant.
 */
window.StaffLabel = {
  singular: 'Staff',
  plural: 'Staff',
  _loaded: false,

  async init(tenantId) {
    if (this._loaded) return;
    try {
      const apiBase = window.LP_STATE?.apiBase || window.location.origin;
      const resp = await fetch(`${apiBase}/v1/tenants/${tenantId}/labels`, { credentials: 'include' });
      if (resp.ok) {
        const data = await resp.json();
        if (data.staff_label) this.singular = data.staff_label;
        if (data.staff_label_plural) this.plural = data.staff_label_plural;
      }
    } catch (e) { /* use defaults */ }
    this._loaded = true;
    this.apply();
  },

  apply() {
    // "Clinician" / "Clinicians" remain the in-markup placeholder tokens
    // (legacy convention — see comment block above for why we haven't
    // changed it). Healthcare pages have these tokens hardcoded.
    // Replace them on the page with the tenant's configured values.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeValue.includes('Clinician')) {  // lint-allow: legacy in-markup token
        node.nodeValue = node.nodeValue
          .replace(/Clinicians/g, this.plural)     // lint-allow: legacy in-markup token
          .replace(/Clinician/g, this.singular);   // lint-allow: legacy in-markup token
      }
    }

    // Also update placeholders
    document.querySelectorAll('[placeholder]').forEach(el => {
      if (el.placeholder.includes('Clinician')) {  // lint-allow: legacy in-markup token
        el.placeholder = el.placeholder
          .replace(/Clinicians/g, this.plural)     // lint-allow: legacy in-markup token
          .replace(/Clinician/g, this.singular);   // lint-allow: legacy in-markup token
      }
    });

    if (document.title.includes('Clinician')) {    // lint-allow: legacy in-markup token
      document.title = document.title
        .replace(/Clinicians/g, this.plural)       // lint-allow: legacy in-markup token
        .replace(/Clinician/g, this.singular);     // lint-allow: legacy in-markup token
    }
  }
};
