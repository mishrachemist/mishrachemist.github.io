/* ===================== GOLD / SILVER RATES (Market screen, owner) =====================
   The cloud sync saves the day's bullion rates to the OneDrive app folder (bullion.json) every hour:
   rates by karat / purity in 6 units, 1 day / week / month / year change, MCX + Comex, headlines and
   10 years of daily rates (24K / 10 g and 999 / kg) for the chart. */
(function bullionRates() {
  const BX_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/bullion.json:/content";
  const $ = id => document.getElementById(id);
  const strip = $("bxStrip"), panel = $("bxPanel"), body = $("bxBody");
  if (!strip || !panel) return;
  let D = null, metal = "gold", chart = null, loadedAt = 0, busy = null;
  const pur = { gold: 24, silver: 999 }, unit = { gold: "g10", silver: "kg" }, range = { gold: "1M", silver: "1M" };
  const UNITS = [["g1", "1 g"], ["g10", "10 g"], ["g100", "100 g"], ["kg", "1 kg"], ["oz", "1 oz"], ["tola", "1 tola"]];
  const RANGES = [["1W", 7], ["1M", 30], ["3M", 91], ["6M", 182], ["1Y", 365], ["3Y", 1096], ["5Y", 1827], ["10Y", 99999]];
  const GOLD_PCT = { 24: "99.99%", 22: "91.67%", 20: "83.33%", 18: "75.00%", 16: "66.67%", 14: "58.33%", 12: "50.00%", 10: "41.67%" };
  const GOLD_NO = { 24: "999", 22: "916", 20: "833", 18: "750", 16: "667", 14: "583", 12: "500", 10: "417" };
  const SILVER_PCT = { 999: "99.99%", 925: "92.50%", 900: "90.00%", 800: "80.00%" };
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const inr = v => "₹" + Math.round(v).toLocaleString("en-IN");
  const usd = v => "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pctTxt = p => (p > 0 ? "▲ +" : p < 0 ? "▼ " : "• ") + Number(p).toFixed(2) + "%";
  const cls = p => p > 0 ? "bxUp" : p < 0 ? "bxDn" : "";
  const rowsOf = m => (D && D[m]) || [];
  const keyOf = m => m === "gold" ? "k" : "p";
  const baseOf = m => rowsOf(m).find(r => r[keyOf(m)] === (m === "gold" ? 24 : 999)) || rowsOf(m)[0];
  const rowOf = m => rowsOf(m).find(r => r[keyOf(m)] === pur[m]) || baseOf(m);
  const histUnit = m => m === "gold" ? "g10" : "kg";
  const purName = (m, r) => m === "gold" ? `${r.k}K (${GOLD_NO[r.k] || ""})` : `${r.p} ${r.name || ""}`;
  const unitName = u => (UNITS.find(x => x[0] === u) || ["", u])[1];
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  function series(m) {   // daily rates of the chosen purity and unit (history is 24K / 10 g and 999 / kg; scaled exactly as the rate table)
    const h = ((D && D.hist && D.hist[m]) || []).slice();
    const b = baseOf(m); if (!b) return [];
    if (h.length && h[h.length - 1][0] < todayISO()) h.push([todayISO(), b[histUnit(m)]]);
    const f = rowOf(m)[unit[m]] / b[histUnit(m)];
    return h.map(([d, v]) => [d, v * f]);
  }
  const ICON = { gold: '<svg viewBox="0 0 44 28"><path d="M8 24 L14 6 H30 L36 24 Z" fill="#f5c542" stroke="#8a6410" stroke-width="2"/><path d="M14 6 H30 L28 10 H16 Z" fill="#ffe28a"/></svg>',
    silver: '<svg viewBox="0 0 44 28"><path d="M8 24 L14 6 H30 L36 24 Z" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/><path d="M14 6 H30 L28 10 H16 Z" fill="#fff"/></svg>' };

  // stacked 1-kilo bars (drawn, no photo)
  function bars(m) {
    const G = m === "gold" ? ["#fff3b0", "#f2c94c", "#b8860b", "#7a5600", "#5a3f00"] : ["#ffffff", "#e5e7eb", "#a3a9b1", "#6b7280", "#4b5058"];
    const t = m === "gold" ? "GOLD" : "SILVER", id = "bxg" + m;
    const bar = (x, y, w, h, rot, label) => `<g transform="translate(${x} ${y}) rotate(${rot})">
      <path d="M0 ${h} L${w * .12} 0 L${w * .88} 0 L${w} ${h} Z" fill="url(#${id}a)" stroke="${G[3]}" stroke-width="1.2"/>
      <path d="M${w * .12} 0 L${w * .88} 0 L${w * .8} ${h * .2} L${w * .2} ${h * .2} Z" fill="url(#${id}b)"/>
      ${label ? `<text x="${w / 2}" y="${h * .5}" text-anchor="middle" font-size="${w * .1}" font-weight="700" fill="${G[3]}" font-family="Georgia,serif">999.9</text>
      <text x="${w / 2}" y="${h * .64}" text-anchor="middle" font-size="${w * .09}" fill="${G[3]}" font-family="Georgia,serif">FINE</text>
      <text x="${w / 2}" y="${h * .8}" text-anchor="middle" font-size="${w * .12}" font-weight="700" fill="${G[3]}" font-family="Georgia,serif">${t}</text>
      <text x="${w / 2}" y="${h * .95}" text-anchor="middle" font-size="${w * .07}" fill="${G[3]}" font-family="Georgia,serif">1 KILO</text>` : ""}</g>`;
    return `<svg class="bxBars" viewBox="0 0 200 150" aria-hidden="true"><defs>
      <linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${G[0]}"/><stop offset=".35" stop-color="${G[1]}"/><stop offset=".75" stop-color="${G[2]}"/><stop offset="1" stop-color="${G[4]}"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${G[0]}"/><stop offset="1" stop-color="${G[1]}"/></linearGradient></defs>
      ${bar(4, 92, 104, 52, -4, false)}${bar(94, 88, 102, 50, 6, false)}${bar(14, 46, 98, 48, -10, false)}${bar(56, 2, 96, 138, 8, true)}</svg>`;
  }
  function upd(m) {   // "Thursday, 19 Nov 2026 07:30 AM" -> "19 NOV 2026, 07:30 IST"
    const s = String((m === "silver" ? D.silverUpdated : D.updated) || D.updated || "");
    const x = /(\d{1,2}) (\w{3}) (\d{4}) (\d{1,2}):(\d{2}) ([AP]M)/.exec(s);
    if (!x) return s.toUpperCase();
    let h = +x[4] % 12 + (x[6] === "PM" ? 12 : 0);
    return `${x[1]} ${x[2].toUpperCase()} ${x[3]}, ${String(h).padStart(2, "0")}:${x[5]} IST`;
  }
  function dayPct(m) {
    const c = D.change && D.change[m] && D.change[m][0];
    if (c && c.pct) return c.pct;
    const l = (D.live || []).find(x => x.name.toLowerCase().startsWith(m) && /MCX/.test(x.name));
    return l ? l.pct : 0;
  }
  function renderStrip() {
    if (!D || !rowsOf("gold").length || !rowsOf("silver").length) { strip.classList.add("hidden"); return; }
    const row = m => {
      const p = dayPct(m), arr = p > 0 ? '<span class="up">▲</span>' : p < 0 ? '<span class="dn">▼</span>' : '<span class="fl">●</span>';
      return `<button type="button" class="bxRow ${m}" data-bx="${m}">
        <div class="bxTop">${bars(m)}<div class="t">${m === "gold" ? "GOLD RATE<small>24 KT · 10 GM</small>" : "SILVER RATE<small>999 · 1 KG</small>"}</div></div>
        <div class="bxPanelBox"><div class="p">${inr(baseOf(m)[histUnit(m)])}</div><div class="l">LIVE PRICE</div>
          <div class="u">${arr} ${esc(upd(m))}</div></div></button>`;
    };
    strip.innerHTML = `<div class="bxBoard">${row("gold")}${row("silver")}</div>`;
    strip.classList.remove("hidden");
  }

  function chartDraw(m) {
    const cv = $("bxChart"); if (!cv || typeof Chart === "undefined") return;
    const all = series(m), days = (RANGES.find(r => r[0] === range[m]) || RANGES[1])[1];
    const from = new Date(Date.now() - days * 86400000), fromISO = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
    const s = days > 90000 ? all : all.filter(x => x[0] >= fromISO);
    if (chart) { try { chart.destroy(); } catch (e) {} chart = null; }
    const st = $("bxStats");
    if (s.length < 2) { if (st) st.innerHTML = "<div>No chart data</div>"; return; }
    const first = s[0][1], last = s[s.length - 1][1], up = last >= first, col = up ? "#16a34a" : "#dc2626";
    const vals = s.map(x => x[1]), hi = Math.max(...vals), lo = Math.min(...vals);
    const ink = getComputedStyle(document.body).getPropertyValue("--muted").trim() || "#5b6b85";
    const g = cv.getContext("2d"), grad = g.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, up ? "rgba(22,163,74,.35)" : "rgba(220,38,38,.35)"); grad.addColorStop(1, "rgba(0,0,0,0)");
    const fmtD = d => { const [y, mo, dd] = d.split("-"); return days > 400 ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+mo - 1]} ${y.slice(2)}` : `${+dd} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+mo - 1]}`; };
    chart = new Chart(g, {
      type: "line",
      data: { labels: s.map(x => x[0]), datasets: [{ data: vals, borderColor: col, backgroundColor: grad, fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 350 }, interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { title: it => fmtD(it[0].label) + " " + it[0].label.slice(0, 4), label: it => inr(it.parsed.y) } } },
        scales: { x: { ticks: { color: ink, maxTicksLimit: 5, maxRotation: 0, callback: function (v) { return fmtD(this.getLabelForValue(v)); } }, grid: { display: false } },
          y: { position: "right", ticks: { color: ink, maxTicksLimit: 5, callback: v => "₹" + Math.round(v).toLocaleString("en-IN") }, grid: { color: "rgba(128,128,128,.15)" } } } }
    });
    if (st) st.innerHTML = `<div>Change<b class="${cls(last - first)}">${pctTxt((last - first) / first * 100)}</b></div><div>High<b>${inr(hi)}</b></div><div>Low<b>${inr(lo)}</b></div>`;
  }

  function render() {
    if (!D) { body.innerHTML = `<div class="bxBox">No rates yet - they come with the next cloud sync.</div>`; return; }
    const m = metal, r = rowOf(m), b = baseOf(m), u = unit[m];
    const ch = (D.change && D.change[m]) || null, dates = (D.change && D.change.dates) || [];
    const third = ["g1", "g10"].includes(u) ? (m === "gold" ? "tola" : "kg") : u;
    const live = (D.live || []).filter(x => x.name.toLowerCase().startsWith(m));
    const purs = rowsOf(m).map(x => x[keyOf(m)]);
    body.innerHTML = `
      <div class="bxHero ${m}">
        <small>${m === "gold" ? "Gold" : "Silver"} ${esc(purName(m, r))} · ${esc(unitName(u))}</small>
        <b>${inr(r[u])}</b>
        <small class="${ch ? cls(ch[0].pct) : ""}" style="opacity:1;font-weight:700">${ch ? pctTxt(ch[0].pct) + " vs " + esc(dates[0] || "1 day ago") : ""}</small>
        <small>As on ${esc(m === "gold" ? D.updated : (D.silverUpdated || D.updated))}</small>
      </div>
      <div class="bxChips" id="bxPur">${purs.map(p => `<button type="button" data-p="${p}" class="${p === pur[m] ? "on" : ""}">${m === "gold" ? p + "K" : p}</button>`).join("")}</div>
      <div class="bxChips" id="bxUnit">${UNITS.map(([k, t]) => `<button type="button" data-u="${k}" class="${k === u ? "on" : ""}">${t}</button>`).join("")}</div>
      <div class="bxBox">
        <h3>📈 ${m === "gold" ? r.k + "K" : r.p} · ${esc(unitName(u))}</h3>
        <div class="bxChips" id="bxRange">${RANGES.map(([k]) => `<button type="button" data-r="${k}" class="${k === range[m] ? "on" : ""}">${k}</button>`).join("")}</div>
        <div class="bxChartWrap"><canvas id="bxChart"></canvas></div>
        <div class="bxStats" id="bxStats"></div>
      </div>
      <div class="bxBox">
        <h3>${m === "gold" ? "🥇 Gold rate by karat" : "🥈 Silver rate by purity"}</h3>
        <table class="bxTbl"><tr><th>${m === "gold" ? "Karat" : "Purity"}</th><th>1 g</th><th>10 g</th><th>${esc(unitName(third))}</th></tr>
          ${rowsOf(m).map(x => `<tr class="${x[keyOf(m)] === pur[m] ? "on" : ""}"><td>${esc(purName(m, x))}</td><td>${inr(x.g1)}</td><td>${inr(x.g10)}</td><td>${inr(x[third])}</td></tr>`).join("")}
        </table>
      </div>
      ${ch ? `<div class="bxBox"><h3>📅 Price change (${m === "gold" ? "24K · 10 g" : "999 · 1 kg"})</h3>
        <table class="bxTbl"><tr><th>Since</th><th>Date</th><th>Price then</th><th>Change</th></tr>
          ${["1 day ago", "1 week ago", "1 month ago", "1 year ago"].map((t, i) => ch[i] ? `<tr><td>${t}</td><td>${esc(dates[i] || "")}</td><td>${inr(ch[i].price)}</td><td class="${cls(ch[i].pct)}">${pctTxt(ch[i].pct)}</td></tr>` : "").join("")}
        </table></div>` : ""}
      ${live.length ? `<div class="bxBox"><h3>⚡ Live market</h3><div class="bxLive">
        ${live.map(x => { const $f = x.unit.startsWith("$") ? usd : inr; return `<div>${esc(x.name)} <span style="opacity:.8">(${esc(x.unit)})</span>
          <b>${$f(x.price)}</b><span class="${cls(x.pct)}" style="font-weight:700">${x.chg > 0 ? "+" : ""}${x.unit.startsWith("$") ? Number(x.chg).toFixed(2) : Math.round(x.chg).toLocaleString("en-IN")} (${pctTxt(x.pct)})</span>
          <div>H ${$f(x.high)} · L ${$f(x.low)}</div><div>Prev ${$f(x.prev)} · ${esc(x.time)}</div></div>`; }).join("")}
      </div></div>` : ""}
      <div class="bxBox"><h3>ℹ️ ${m === "gold" ? "Karat and purity" : "Silver purity"}</h3>
        <table class="bxTbl"><tr><th>${m === "gold" ? "Karat" : "Grade"}</th><th>Purity</th><th>Also called</th></tr>
        ${m === "gold" ? purs.map(k => `<tr><td>${k}K</td><td>${GOLD_PCT[k] || ""}</td><td>Gold ${GOLD_NO[k] || ""}</td></tr>`).join("")
          : rowsOf(m).map(x => `<tr><td>${x.p}</td><td>${SILVER_PCT[x.p] || ""}</td><td>Silver ${esc(x.name || "")}</td></tr>`).join("")}
        </table></div>
      ${(D.news || []).length ? `<div class="bxBox bxNews"><h3>📰 Bullion news</h3>${D.news.map(n => `<div>${/silver/i.test(n.t) ? "🥈" : /gold/i.test(n.t) ? "🥇" : "•"} ${esc(n.t)}<small>${esc(n.d)}</small></div>`).join("")}</div>` : ""}
      <div class="bxFoot">Rates as on ${esc(D.updated || "-")} · saved ${esc(new Date(D.fetchedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }))}. Bullion rates are fixed by the state / city bullion associations; MCX prices differ because of local taxes and logistics. Jewellery adds making charges and GST.</div>`;
    chartDraw(m);
  }

  async function load(force) {
    if (busy) return busy;
    busy = (async () => {
      try {
        if (!D) { try { D = JSON.parse(localStorage.getItem("bxCache") || "null"); } catch (e) { D = null; } if (D) renderStrip(); }
        if (!force && Date.now() - loadedAt < 10 * 60000) return;
        if (typeof account === "undefined" || !account || (typeof isViewer === "function" && isViewer())) return;
        const token = await getToken(); if (!token) return;
        const r = await fetch(BX_URL + "?t=" + Date.now(), { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!j || !Array.isArray(j.gold) || !j.gold.length) return;
        D = j; loadedAt = Date.now();
        try { localStorage.setItem("bxCache", JSON.stringify(D)); } catch (e) {}
        renderStrip();
        if (!panel.classList.contains("hidden")) render();
      } catch (e) { /* keep the last rates */ } finally { busy = null; }
    })();
    return busy;
  }
  function open(m) {
    metal = m;
    $("marketSubNav").classList.add("hidden");
    const mb = $("mainBackBar"); if (mb) mb.classList.add("hidden");
    panel.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
    render(); load(false);
  }
  strip.addEventListener("click", e => { const c = e.target.closest("[data-bx]"); if (c) open(c.dataset.bx); });
  $("bxBack").addEventListener("click", () => {
    panel.classList.add("hidden"); $("marketSubNav").classList.remove("hidden");
    const mb = $("mainBackBar"); if (mb) mb.classList.remove("hidden");
    if (chart) { try { chart.destroy(); } catch (e) {} chart = null; }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  panel.addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.p) { pur[metal] = +t.dataset.p; render(); }
    else if (t.dataset.u) { unit[metal] = t.dataset.u; render(); }
    else if (t.dataset.r) { range[metal] = t.dataset.r; document.querySelectorAll("#bxRange button").forEach(b => b.classList.toggle("on", b === t)); chartDraw(metal); }
  });
  document.querySelectorAll('.navItem[data-section="marketdash"]').forEach(b => b.addEventListener("click", () => load(false)));
  setTimeout(() => load(false), 6000);
  window.bxDebug = { set: j => { D = j; renderStrip(); }, open };
})();
