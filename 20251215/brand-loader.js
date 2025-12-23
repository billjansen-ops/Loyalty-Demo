(() => {
  const API = "http://127.0.0.1:4001/v1/config/branding";
  const defaults = { companyName: "", programName: "", unitLabel: "Points" };
  let cache = { ...defaults };

  async function load() {
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      cache = { ...defaults, ...(data.branding || {}) };
      apply();
    } catch {
      cache = { ...defaults };
      apply();
    }
  }

  function apply() {
    // Title
    if (cache.companyName || cache.programName) {
      document.title = `${cache.companyName} ${cache.programName}`.trim();
    }
    // Any element like: <span data-brand="company"></span>
    document.querySelectorAll("[data-brand]").forEach(el => {
      const key = el.getAttribute("data-brand");
      el.textContent = cache[key] ?? "";
    });
    // Custom hook for pages to consume
    document.dispatchEvent(new CustomEvent("branding:ready", { detail: cache }));
  }

  // Simple accessor others can use
  window.Branding = {
    get: () => ({ ...cache }),
    apply, load
  };

  // Kick off on load
  document.addEventListener("DOMContentLoaded", load);
})();
