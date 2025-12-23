(function(){
  const $ = s => document.querySelector(s);
  const el = {
    rows: $("#rows"),
    tAccrued: $("#tAccrued"),
    tRedeemed: $("#tRedeemed"),
    tExpired: $("#tExpired"),
    tAvailable: $("#tAvailable"),
    memberTag: $("#memberTag")
  };

  const API = (window.__LP12_API_BASE || "").replace(/\/$/, "");

  function fmtInt(n){ if(n==null || isNaN(+n)) return "0"; return Number(n).toLocaleString(); }
  function fmtDate(d){
    const SENTINEL = "9999-12-31";
    if (!d || d >= SENTINEL) return "—";
    try{
      const dt = new Date(d + "T00:00:00");
      if (!isNaN(dt)) return dt.toLocaleDateString(undefined,{year:"numeric",month:"2-digit",day:"2-digit"});
    }catch{}
    return d;
  }
  function isExpired(dateStr, todayStr){
    const SENTINEL = "9999-12-31";
    if (!dateStr || dateStr >= SENTINEL) return false;
    try{
      const dt = new Date(dateStr + "T23:59:59");
      const t  = new Date(todayStr + "T23:59:59");
      return dt.getTime() < t.getTime();
    }catch{ return false; }
  }

  async function jget(url){
    const r = await fetch(url, { headers:{ "Accept":"application/json" }});
    if(!r.ok) throw new Error(r.status+" "+r.statusText);
    const txt = await r.text();
    try{ return JSON.parse(txt); }catch(_){
      const a=txt.indexOf("{"), b=txt.lastIndexOf("}");
      if(a>-1 && b>-1) return JSON.parse(txt.slice(a,b+1));
      throw new Error("Invalid JSON");
    }
  }

  async function render(){
    const url = new URL(location.href);
    const memberId = url.searchParams.get("memberId") || "2153442807";

    const data = await jget(`${API}/v1/member/${encodeURIComponent(memberId)}/buckets`);
    const today = data.today || new Date().toISOString().slice(0,10);
    el.memberTag.textContent = `(${data.member_id || memberId})`;

    el.rows.innerHTML = "";
    let tA=0, tR=0, tX=0, tV=0;

    const rows = (data.buckets || []).slice().sort((a,b)=> (a.expiry_date > b.expiry_date ? 1 : -1));
    for (const b of rows){
      const accrued = Number(b.accrued || 0);
      const redeemed = Number(b.redeemed || 0);
      const leftover = Math.max(0, accrued - redeemed);
      const expired = isExpired(b.expiry_date, today) ? leftover : 0;
      const available = isExpired(b.expiry_date, today) ? 0 : leftover;

      tA += accrued;
      tR += redeemed;
      tX += expired;
      tV += available;

      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${fmtDate(b.expiry_date)}</td>
                      <td class="right">${fmtInt(accrued)}</td>
                      <td class="right">${fmtInt(redeemed)}</td>
                      <td class="right">${fmtInt(expired)}</td>
                      <td class="right">${fmtInt(available)}</td>`;
      el.rows.appendChild(tr);
    }

    el.tAccrued.textContent = fmtInt(tA);
    el.tRedeemed.textContent = fmtInt(tR);
    el.tExpired.textContent = fmtInt(tX);
    el.tAvailable.textContent = fmtInt(tV);
  }

  document.addEventListener("DOMContentLoaded", () => {
    render().catch(e => {
      console.error(e);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" class="muted">Could not load data.</td>`;
      const rows = document.querySelector("#rows");
      rows.innerHTML = "";
      rows.appendChild(tr);
    });
  });
})();