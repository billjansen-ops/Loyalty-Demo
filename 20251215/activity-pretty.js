(function () {
  const $ = (sel, el = document) => el.querySelector(sel);

  const els = {
    form: $("#searchForm"),
    input: $("#memberId"),
    status: $("#status"),
    tag: $("#memberTag"),
    balancesBody: $("#balancesBody"),
    balancesEmpty: $("#balancesEmpty"),
    activityBody: $("#activityBody"),
    activityHint: $("#activityHint"),
  };

  const API_BASE = (window.__LP12_API_BASE || "").replace(/\/$/, "");

  function fmtInt(n){ if(n===null||n===undefined||isNaN(Number(n))) return ""; return Number(n).toLocaleString(); }
  function safe(v,f=""){ return (v===null||v===undefined)?f:String(v); }
  function setStatus(msg, kind="info"){
    els.status.textContent = msg || "";
    els.status.className = "status " + (msg ? kind : "");
  }
  function setTag(memberId) {
    els.tag.textContent = memberId ? "(" + memberId + ")" : "";
  }

  async function fetchJSON(url){
    const res = await fetch(url, { headers:{ "Accept":"application/json" } });
    if(!res.ok) throw new Error(res.status + " " + res.statusText);
    const txt = await res.text();
    try{ return JSON.parse(txt); }catch(_){ 
      const firstBrace = txt.indexOf("{");
      const lastBrace = txt.lastIndexOf("}");
      if(firstBrace !== -1 && lastBrace !== -1){
        return JSON.parse(txt.slice(firstBrace, lastBrace+1));
      }
      throw new Error("Invalid JSON from server");
    }
  }

  function normalizeBalances(j){
    if(Array.isArray(j)) return j;
    if(j && Array.isArray(j.balances)) return j.balances;
    if(j && j.balances && typeof j.balances === "object"){
      return Object.entries(j.balances).map(([k,v])=>({ point_type: String(k), balance: Number(v)||0 }));
    }
    if(j && typeof j === "object" && j.ok && typeof j.balances === "object"){
      return Object.entries(j.balances).map(([k,v])=>({ point_type: String(k), balance: Number(v)||0 }));
    }
    return [];
  }

  function normalizeActivities(j){
    if(Array.isArray(j)) return j;
    if(j && Array.isArray(j.activities)) return j.activities;
    if(j && Array.isArray(j.rows)) return j.rows;
    return [];
  }

  async function getBalances(id){ const j = await fetchJSON(`${API_BASE}/v1/member/${encodeURIComponent(id)}/balances`); return normalizeBalances(j); }
  async function getActivities(id){ const j = await fetchJSON(`${API_BASE}/v1/member/${encodeURIComponent(id)}/activities?limit=50`); return normalizeActivities(j); }

  function renderBalances(rows){
    els.balancesBody.innerHTML = "";
    if(!rows || rows.length === 0){
      els.balancesEmpty.style.display = "";
      return;
    }
    els.balancesEmpty.style.display = "none";
    for(const r of rows){
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${safe(r.point_type || r.type || r.name)}</td><td class="right">${fmtInt(r.balance)}</td>`;
      els.balancesBody.appendChild(tr);
    }
  }

  function classifyType(a){
    const t = (a.type || a.activity_type || a.kind || "").toString().toLowerCase();
    if (t) return t;
    // Infer from fields
    if (a.flight_no || a.carrier || a.carrier_code || (a.magic_box && JSON.stringify(a.magic_box).match(/flight|carrier/i))) return "flight";
    if (a.redemption || a.redeem_amount) return "redeem";
    if (a.partner) return "partner";
    if (a.adjustment_code || a.adjustment) return "adjustment";
    return "activity";
  }

  function summaryLine(a){
    // Codes only (no city names); miles are NOT part of this line.
    const carrier = a.carrier_code || a.carrier || "";
    const o = a.origin || "";
    const d = a.destination || "";
    const flightNo = a.flight_no || a.flight_number || "";
    const fare = a.fare_class || a.class || "";

    const parts = [];
    const left = ["✈️", carrier && carrier.toUpperCase()].filter(Boolean).join(" ");
    const seg = o && d ? `${o} → ${d}` : (o || d || "");
    if (left) parts.push(`<span class="code">${left}</span>${seg?` — ${seg}`:""}`);
    const sub = [flightNo && `Flight ${flightNo}`, fare && `Class ${fare}`].filter(Boolean).join(" • ");
    if (sub) parts.push(`<span class="muted">${sub}</span>`);

    return parts.join("  ");
  }

  function renderActivities(rows){
    els.activityBody.innerHTML = "";
    if(!rows || rows.length === 0){
      els.activityBody.innerHTML = `<tr><td colspan="4" class="empty">No activity found.</td></tr>`;
      return;
    }
    for(const a of rows){
      const tr = document.createElement("tr");

      // Date (formatted as MM/DD/YYYY)
      const dt = a.activity_date || a.posted_at || a.txn_date || a.date || "";
      let dateStr = safe(dt);
      try {
        const d = new Date(dt);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleDateString(undefined, { year:"numeric", month:"2-digit", day:"2-digit" });
        }
      } catch {}

      const type = classifyType(a);
      const line = summaryLine(a);
      const miles = fmtInt(a.miles_total || a.miles || a.points || 0);

      tr.innerHTML = `<td>${dateStr}</td><td class="air em">${type}</td><td>${line}</td><td class="right">${miles}</td>`;
      els.activityBody.appendChild(tr);
    }
  }

  async function loadMember(id){
    if(!id){ setStatus("Enter a member ID.", "warn"); return; }
    setStatus("Loading…");
    setTag(id);
    try{
      const [balances, acts] = await Promise.all([ getBalances(id), getActivities(id) ]);
      renderBalances(balances);
      renderActivities(acts);
      els.activityHint.textContent = acts && acts.length ? `${acts.length} rows` : "";
      setStatus("");
    }catch(e){
      console.error(e);
      setStatus("Could not load data (check server).", "error");
      renderBalances([]);
      renderActivities([]);
    }
  }

  function gotoMember(id){
    const mid = String(id||"").trim();
    const url = new URL(location.href);
    if(mid){ url.searchParams.set("memberId", mid); } else { url.searchParams.delete("memberId"); }
    history.replaceState(null, "", url.toString());
    loadMember(mid);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if(els.form) els.form.addEventListener("submit", () => gotoMember(els.input.value));
    const mid = new URLSearchParams(location.search).get("memberId") || "";
    if(mid){ if(els.input) els.input.value = mid; loadMember(mid); }
  });
})();