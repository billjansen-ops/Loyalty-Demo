(async function(){
  const API = window.LP_STATE?.apiBase || window.location.origin;
  try {
    const r = await fetch(API + '/v1/admin/settings/unit_label');
    const { value } = await r.json();
    for (const el of document.querySelectorAll('[data-unit-label]')) {
      el.textContent = value;
    }
  } catch (e) {
    console.error('unit-label load failed', e);
  }
})();
