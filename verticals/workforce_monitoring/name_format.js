/**
 * name_format.js — THE credential display rule (Session 143).
 *
 * One rule, used by every surface that shows a person's name with their
 * credentials: "Jane Smith, MD, PhD" — credentials after the name,
 * comma-separated, in the order they were assigned. No honorifics
 * (Mr./Ms./Mrs.) unless a state ever requires them — per Tom and Erica
 * (Erica signs "Erica Larson, D.O.").
 *
 * The server supplies `credentials` as an array of display labels
 * (wellness roster, intake queue) or via
 * GET /v1/members/:id/molecule-rows/CREDENTIAL (the chart).
 *
 * Usage:  <script src="name_format.js"></script>
 *         NameCred.format('Jane', 'Smith', ['MD'])      → "Jane Smith, MD"
 *         NameCred.withCreds('Jane Smith', ['MD','PhD']) → "Jane Smith, MD, PhD"
 */
(function () {
  window.NameCred = {
    // First/last name + credential labels → the display string.
    format: function (fname, lname, credentials) {
      var name = (String(fname || '') + ' ' + String(lname || '')).trim();
      return this.withCreds(name, credentials);
    },
    // An already-assembled name + credential labels.
    withCreds: function (name, credentials) {
      var n = String(name || '').trim();
      if (Array.isArray(credentials) && credentials.length) {
        n += ', ' + credentials.join(', ');
      }
      return n;
    }
  };
})();
