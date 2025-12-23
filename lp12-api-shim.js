// LP12 shim: make localStorage API base available as window.__LP12_API_BASE
(function(){
  try{
    var base = localStorage.getItem('LP12_API_BASE') || '';
    if (typeof window.__LP12_API_BASE === 'undefined' || !window.__LP12_API_BASE) {
      window.__LP12_API_BASE = base;
      console.info('LP12 shim set API base =', base || '(same origin)');
    }
  }catch(e){ console.warn('LP12 shim could not read API base:', e.message); }
})();