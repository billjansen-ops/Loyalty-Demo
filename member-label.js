/**
 * member-label.js — Dynamic member terminology
 *
 * Replaces hardcoded "Physician" with tenant-configurable label.
 * Load this script on any page that references members.
 *
 * Usage:
 *   <script src="../../member-label.js"></script>
 *   Then call: await MemberLabel.init(tenantId);
 *   Or use:   MemberLabel.singular  → "Physician" (or configured value)
 *             MemberLabel.plural    → "Physicians"
 *             MemberLabel.apply()   → replaces all visible text on page
 */
window.MemberLabel = {
  singular: 'Physician',
  plural: 'Physicians',
  _loaded: false,

  async init(tenantId) {
    if (this._loaded) return;
    try {
      const apiBase = window.LP_STATE?.apiBase || window.location.origin;
      const resp = await fetch(`${apiBase}/v1/tenants/${tenantId}/labels`, { credentials: 'include' });
      if (resp.ok) {
        const data = await resp.json();
        if (data.member_label) this.singular = data.member_label;
        if (data.member_label_plural) this.plural = data.member_label_plural;
      }
    } catch (e) { /* use defaults */ }
    this._loaded = true;
    this.apply();
  },

  apply() {
    // Only replace if label is NOT "Physician" (no work needed if default)
    if (this.singular === 'Physician') return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeValue.includes('Physician')) {
        node.nodeValue = node.nodeValue
          .replace(/Physicians/g, this.plural)
          .replace(/Physician/g, this.singular);
      }
    }

    // Also update title, placeholders, and values
    document.querySelectorAll('[placeholder]').forEach(el => {
      if (el.placeholder.includes('Physician')) {
        el.placeholder = el.placeholder
          .replace(/Physicians/g, this.plural)
          .replace(/Physician/g, this.singular);
      }
    });

    if (document.title.includes('Physician')) {
      document.title = document.title
        .replace(/Physicians/g, this.plural)
        .replace(/Physician/g, this.singular);
    }
  }
};
