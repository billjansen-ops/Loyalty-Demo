/**
 * member-label.js — Dynamic member terminology
 *
 * Replaces the legacy hardcoded placeholder token "Physician" / "Physicians"
 * with whatever the tenant has configured for member_label / member_label_plural.
 * Healthcare pages still use "Physician" / "Physicians" as their in-markup
 * placeholder token (kept as-is for backward compat — changing the token to
 * something safer like "Member" would collide with legitimate uses).
 *
 * Usage:
 *   <script src="../../member-label.js"></script>
 *   Then call: await MemberLabel.init(tenantId);
 *   Or use:   MemberLabel.singular  → "Member" (default) or configured value
 *             MemberLabel.plural    → "Members" (default) or configured value
 *             MemberLabel.apply()   → replaces all visible "Physician"
 *                                     placeholder tokens on the page with the
 *                                     tenant's configured value.
 *
 * Defaults: "Member" / "Members" — generic loyalty-platform terms. Healthcare
 * tenants like wi_php override to "Participant" / "Participants" via the
 * /v1/tenants/:id/labels endpoint. Pre-cleanup the defaults were "Physician"
 * / "Physicians", which leaked the healthcare framing into every non-
 * configured tenant. Same fix as staff-label.js (Session 126).
 */
window.MemberLabel = {
  singular: 'Member',
  plural: 'Members',
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
    // "Physician" / "Physicians" remain the in-markup placeholder tokens
    // (legacy convention — see comment block above for why we haven't
    // changed it). Healthcare pages have these tokens hardcoded.
    // Replace them on the page with the tenant's configured values.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeValue.includes('Physician')) {  // lint-allow: legacy in-markup token
        node.nodeValue = node.nodeValue
          .replace(/Physicians/g, this.plural)     // lint-allow: legacy in-markup token
          .replace(/Physician/g, this.singular);   // lint-allow: legacy in-markup token
      }
    }

    // Also update title, placeholders, and values
    document.querySelectorAll('[placeholder]').forEach(el => {
      if (el.placeholder.includes('Physician')) {  // lint-allow: legacy in-markup token
        el.placeholder = el.placeholder
          .replace(/Physicians/g, this.plural)     // lint-allow: legacy in-markup token
          .replace(/Physician/g, this.singular);   // lint-allow: legacy in-markup token
      }
    });

    if (document.title.includes('Physician')) {    // lint-allow: legacy in-markup token
      document.title = document.title
        .replace(/Physicians/g, this.plural)       // lint-allow: legacy in-markup token
        .replace(/Physician/g, this.singular);     // lint-allow: legacy in-markup token
    }
  }
};
