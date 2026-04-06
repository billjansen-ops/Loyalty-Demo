/**
 * staff-label.js — Dynamic staff terminology
 *
 * Replaces hardcoded "Clinician" with tenant-configurable label.
 * Load this script on any page that references staff roles.
 *
 * Usage:
 *   <script src="../../staff-label.js"></script>
 *   Then call: await StaffLabel.init(tenantId);
 *   Or use:   StaffLabel.singular  → "Clinician" (or configured value)
 *             StaffLabel.plural    → "Clinicians"
 *             StaffLabel.apply()   → replaces all visible text on page
 */
window.StaffLabel = {
  singular: 'Clinician',
  plural: 'Clinicians',
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
    // Only replace if label is NOT "Clinician" (no work needed if default)
    if (this.singular === 'Clinician') return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeValue.includes('Clinician')) {
        node.nodeValue = node.nodeValue
          .replace(/Clinicians/g, this.plural)
          .replace(/Clinician/g, this.singular);
      }
    }

    // Also update placeholders
    document.querySelectorAll('[placeholder]').forEach(el => {
      if (el.placeholder.includes('Clinician')) {
        el.placeholder = el.placeholder
          .replace(/Clinicians/g, this.plural)
          .replace(/Clinician/g, this.singular);
      }
    });

    if (document.title.includes('Clinician')) {
      document.title = document.title
        .replace(/Clinicians/g, this.plural)
        .replace(/Clinician/g, this.singular);
    }
  }
};
