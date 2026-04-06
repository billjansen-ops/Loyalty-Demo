/**
 * clinician-label.js — Dynamic clinician terminology
 *
 * Replaces hardcoded "Clinician" with tenant-configurable label.
 * Load this script on any page that references clinicians.
 *
 * Usage:
 *   <script src="../../clinician-label.js"></script>
 *   Then call: await ClinicianLabel.init(tenantId);
 *   Or use:   ClinicianLabel.singular  → "Clinician" (or configured value)
 *             ClinicianLabel.plural    → "Clinicians"
 *             ClinicianLabel.apply()   → replaces all visible text on page
 */
window.ClinicianLabel = {
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
        if (data.clinician_label) this.singular = data.clinician_label;
        if (data.clinician_label_plural) this.plural = data.clinician_label_plural;
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
