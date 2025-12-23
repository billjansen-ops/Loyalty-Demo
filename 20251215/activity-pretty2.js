// LP12 Stage 2B — Member Activity (autorun + footer build tag + optional API base)
// Console marker to confirm correct script version:
console.info("LP12 activity-pretty.js loaded (stage2b)");

(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const els = {
    form: $("#searchForm"),
    input: $("#memberId"),
    balancesBody: $("#balancesBody"),
    balancesEmpty: $("#balancesEmpty"),
    activityBody: $("#activityBody"),
    activityHint: $("#activityHint"),
  };

  // Configureable API base (e.g., 'http://127.0.0.1:4001').
  // By default it's empty => same origin.
  const API_BASE = (window.__LP12_API_BASE || "").replace(/\/$/, "");

  const SAMPLE = {
    balances: { member_id: "SAMPLE", balances: [
      { point_type: "Base Miles", balance: 12450 },
      { point_type: "Tier Credits", balance: 3200 }
    ]},
    activities: [
      { activity_date: "2025-10-24", type: "Flight", carrier: "Delta Air Lines", carrier_code: "DL",
        flight_number: "104", class: "F", origin: "MSP — Minneapolis", destination: "LGA — New York LaGuardia",
        flight_miles: 1008, bonuses: [{ name: "First Class Bonus", miles: 504 }], miles_total: 1508,
        title: "DL — MSP → LGA", note: "LaGuardia" },
      { activity_date: "2025-09-02", type: "Partner", title: "Marriott — Stay Credit",
        note: "Reservation 7HF3D • 3 nights • NYC", miles_total: 1250 },
      { activity_date: "2025-08-18", type: "Adjustment", title: "Manual Adjustment — Policy Exception",
        note: "CSR: JSantana • Case #88421", miles_total: 500 },
      { activity_date: "2025-08-01", type: "Promotion", title: "Summer Sprint — Qualifying Activity",
        note: "Cycle 1 • Progress 2/3", miles_total: 750 }
    ]
  };

  function fmtInt(n){ if(n===null||n===undefined||isNaN(Number(n))) return ""; return Number(n).toLocaleString(); }
  function safeText(v,f=""){ return (v===null||v===undefined)?f:String(v); }
  function parseDate(d){ try{const dt=new Date(d); if(!isNaN(dt.getTime())) return dt.toLocaleDateString();}catch{} return safeText(d); }

  async function fetchJSON(url){
    const res = await fetch(url, { headers:{ "Accept":"application/json" } });
    if(!res.ok) throw new Error(res.status+" "+res.statusText);
    return res.json();
  }
  async function getBalances(id){ return fetchJSON(`${API_BASE}/v1/members/${encodeURIComponent(id)}/balance`); }
  async function getActivities(id){
    const url = `${API_BASE}/v1/members/${encodeURIComponent(id)}/activities?limit=50`;
    const res = await fetch(url, { headers:{ "Accept":"application/json" } });
    if(!res.ok) throw new Error("activities_unavailable");
    const data = await res.json();
    return Array.isArray(data)?data:(data.activities||[]);
  }

  function typeIconLabel(type){
    switch(String(type).toLowerCase()){
      case "flight": return { icon:"✈️", label:"Flight"};
      case "partner": return { icon:"🤝", label:"Partner"};
      case "adjustment": return { icon:"💳", label:"Adjustment"};
      case "promotion": return { icon:"🎁", label:"Promotion"};
      default: return { icon:"•", label: safeText(type,"Activity") };
    }
  }

  function normalizeActivity(a){
    const date = a.activity_date || a.date || a.post_date || a.created_at || "";
    const type = a.type || a.activity_type || "Activity";
    const milesTotal = a.total_miles ?? a.miles_total ?? a.points_total ?? a.miles ?? a.points ?? null;

    const carrier = a.carrier || a.airline || a.carrier_code || "";
    const flightNo = a.flight_number || a.flight || "";
    const cls = a.class || a.fare_class || a.cabin || "";
    const origin = a.origin || a.from || "";
    const destination = a.destination || a.to || "";
    const toName = a.destination_name || a.to_name || "";
    const flightMiles = a.flight_miles ?? a.base_miles ?? null;

    const title = a.title || (carrier && origin && destination ? `${carrier} — ${origin} → ${destination}` : type);
    const sub = (flightNo || cls || toName) ? [flightNo?`Flight ${flightNo}`:null, cls?`Class ${cls}`:null, toName||null].filter(Boolean).join(" • ") : (a.note||"");

    return { date, type, title, sub, milesTotal, expand:{ carrier, flightNo, cls, origin, destination, flightMiles, bonuses: a.bonuses||[] } };
  }

  function renderBalances(data){
    const rows = (data && Array.isArray(data.balances)) ? data.balances : [];
    if(!rows.length){ document.getElementById("balancesBody").innerHTML=""; document.getElementById("balancesEmpty").style.display=""; return; }
    document.getElementById("balancesEmpty").style.display="none";
    document.getElementById("balancesBody").innerHTML = rows.map(r=>`<div class="balance-pill"><div class="pill-pt">${safeText(r.point_type,"—")}</div><div class="pill-num">${fmtInt(r.balance)}</div></div>`).join("");
  }

  function renderActivities(list){
    const elsActBody = document.getElementById("activityBody");
    const elsHint = document.getElementById("activityHint");
    if(!list.length){ elsActBody.innerHTML=""; elsHint.style.display=""; elsHint.textContent="No recent activity."; return; }
    elsHint.style.display="none";
    const html = list.map((raw,idx)=>{
      const a = normalizeActivity(raw);
      const id = `act_${idx}`;
      const date = parseDate(a.date);
      const miles = fmtInt(a.milesTotal);
      const tl = typeIconLabel(a.type);
      const detailsSub = a.sub ? `<div class='sub'>${safeText(a.sub)}</div>` : "";

      const flightBits=[];
      if(a.expand.origin) flightBits.push(`<div class="label">Origin:</div><div class="value">${safeText(a.expand.origin)}</div>`);
      if(a.expand.destination) flightBits.push(`<div class="label">Destination:</div><div class="value">${safeText(a.expand.destination)}</div>`);
      if(a.expand.flightMiles!=null) flightBits.push(`<div class="label">Flight Miles:</div><div class="value">${fmtInt(a.expand.flightMiles)}</div>`);
      if(a.expand.cls) flightBits.push(`<div class="label">Base Fare Class:</div><div class="value">${safeText(a.expand.cls)}</div>`);

      const bonuses=(a.expand.bonuses||[]).map(b=>{
        if(b && typeof b==="object"){ const name=b.name||b.title||"Bonus"; const val=b.miles??b.points??b.value??""; return `<div class="pill">${safeText(name)} ${val?`+${fmtInt(val)} mi`:""}</div>`; }
        return `<div class="pill">${safeText(b)}</div>`;
      }).join("");

      const totalLine=(a.milesTotal!=null)?`<div class="line total"><div>Total Added:</div><div>${fmtInt(a.milesTotal)}</div></div>`:"";

      return `
      <div class="row grid-4 hoverable" id="${id}">
        <div class="cell date tright">${safeText(date)}</div>
        <div class="cell type tcenter"><span class="icon">${tl.icon}</span><span>${tl.label}</span></div>
        <div class="cell">
          <div class="details">
            <div>
              <div class="route">${safeText(a.title)}</div>
              ${detailsSub}
            </div>
            <button class="info-btn" data-toggle="${id}" aria-expanded="false">
              <span class="chev">▸</span><span class="info-label">More Info</span>
            </button>
          </div>
        </div>
        <div class="cell miles tright">${miles||""}</div>
      </div>
      <div class="expander" id="${id}_exp">
        <div class="card">
          <h3>${safeText(a.title)}</h3>
          <div class="subhead">${a.expand.carrier ? safeText(a.expand.carrier)+(a.expand.cls?` • ${safeText(a.expand.cls)}`:"") : (a.type||"")}</div>
          ${flightBits.length?`<div class="grid">${flightBits.join("")}</div>`:""}
          ${bonuses?`<div class="rule"></div><div><strong>Bonuses</strong></div><div class="pills">${bonuses}</div>`:""}
          ${totalLine?`<div class="rule"></div><div class="summary">${totalLine}</div>`:""}
          <div class="footer">
            <a href="javascript:void(0)">View Receipt</a>
            <a href="javascript:void(0)">Adjust Miles</a>
            <a href="javascript:void(0)" class="collapse" data-toggle="${id}">Collapse</a>
          </div>
        </div>
      </div>`;
    }).join("");
    elsActBody.innerHTML = html;

    $$(".info-btn", elsActBody).forEach(btn=>{
      const id = btn.getAttribute("data-toggle");
      const row = document.getElementById(id);
      const exp = document.getElementById(id+"_exp");
      const chev = btn.querySelector(".chev");
      const label = btn.querySelector(".info-label");
      const setState = (expanded)=>{
        btn.setAttribute("aria-expanded", expanded?"true":"false");
        if(expanded){ row.classList.add("expanded"); chev.textContent="▾"; label.textContent="Collapse"; setTimeout(()=>exp.scrollIntoView({behavior:"smooth", block:"nearest"}),50); }
        else { row.classList.remove("expanded"); chev.textContent="▸"; label.textContent="More Info"; }
      };
      btn.addEventListener("click", e=>{
        e.preventDefault();
        const isOpen = row.classList.contains("expanded");
        $$(".row.expanded", elsActBody).forEach(openRow=>{
          if(openRow.id!==id){ const openBtn = elsActBody.querySelector(`.info-btn[data-toggle="${openRow.id}"]`); if(openBtn&&openBtn!==btn) openBtn.click(); }
        });
        setState(!isOpen);
      });
    });
    $$(".collapse", elsActBody).forEach(a=>{
      const id=a.getAttribute("data-toggle");
      const btn=document.querySelector(`.info-btn[data-toggle="${id}"]`);
      if(btn){ a.addEventListener("click", e=>{ e.preventDefault(); btn.click(); }); }
    });
  }

  async function handleSearch(memberId){
    document.getElementById("activityBody").innerHTML=""; document.getElementById("activityHint").style.display="none";
    document.getElementById("balancesBody").innerHTML=""; document.getElementById("balancesEmpty").style.display="none";
    let usedFallback=false;

    try { const live=await getBalances(memberId); console.info("✅ Using live API data for balances."); renderBalances(live); }
    catch(e){ console.warn("⚠️ Using local sample data for balances (API unavailable)."); usedFallback=true; renderBalances(SAMPLE.balances); }

    try { const acts=await getActivities(memberId); console.info("✅ Using live API data for activities."); renderActivities(acts); }
    catch(e){ console.warn("⚠️ Using local sample data for activities (API unavailable)."); usedFallback=true; renderActivities(SAMPLE.activities); }

    if(usedFallback){ document.getElementById("activityHint").style.display=""; document.getElementById("activityHint").textContent="Showing sample data (API unavailable)."; }
    else { document.getElementById("activityHint").style.display="none"; }
  }

  // Wire search button
  els.form.addEventListener("submit", e=>{ e.preventDefault(); const id=els.input.value.trim(); if(!id) return; handleSearch(id); });

  // Auto-run when memberId query param is present
  const qp = new URLSearchParams(location.search);
  const qid = qp.get("memberId") || qp.get("member_id") || qp.get("id");
  if (qid) {
    els.input.value = qid;
    handleSearch(qid);
  }
})();
;(function(){
  function normalizeActivity(a){
    const points = a?.points ?? a?.point_amount ?? a?.pointAmount ?? 0;
    const description = a?.description ?? a?.subtype ?? a?.adjustment_code ?? a?.kind ?? "";
    return { ...a, points, description };
  }
  function normalizeActivities(payload){
    const list = Array.isArray(payload)
      ? payload
      : (payload && Array.isArray(payload.activities))
          ? payload.activities
          : [];
    return list.map(normalizeActivity);
  }
  if (typeof window !== "undefined" && window.fetch) {
    const origFetch = window.fetch.bind(window);
    window.fetch = async function(...args){
      const res = await origFetch(...args);
      try {
        const url = (args[0] && args[0].toString()) || "";
        if (url.includes("/v1/member/") && url.includes("/activities") || url.endsWith("/v1/activities")) {
          const clone = res.clone();
          const data = await clone.json().catch(()=>null);
          if (data) {
            const norm = normalizeActivities(data);
            const body = JSON.stringify({ ok: true, activities: norm });
            return new Response(body, { status: res.status, headers: { "Content-Type": "application/json" }});
          }
        }
      } catch(_) {}
      return res;
    };
  }
})();
;(function(){
  function normalizeActivity(a){
    const points = a?.points ?? a?.point_amount ?? a?.pointAmount ?? 0;
    const description = a?.description ?? a?.subtype ?? a?.adjustment_code ?? a?.kind ?? "";
    return { ...a, points, description };
  }
  function normalizeActivities(payload){
    const list = Array.isArray(payload)
      ? payload
      : (payload && Array.isArray(payload.activities))
          ? payload.activities
          : [];
    return list.map(normalizeActivity);
  }
  if (typeof window !== "undefined") {
    const prev = window.renderActivities;
    if (typeof prev === "function") {
      window.renderActivities = function(data){ return prev(normalizeActivities(data)); };
    }
    window.__normalizeActivities = normalizeActivities;
  }
})();
