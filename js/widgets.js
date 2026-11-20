/* ===================== HOME-SCREEN WIDGETS (Moltrix Android app) =====================
   The widgets themselves are Android code (ProdWidget, MarketWidget, QuickWidget). This page gives them their data:
   - Production: today's billet MT and heats, the last 7 days, the month total and the last WhatsApp sync, read from the
     Prod. sheet(s) of the monthly report file(s) — when the app opens and after every WhatsApp fetch (also in the cloud
     sync: the news file for the app carries it, so the widget is fresh even with the app closed).
   - Market: PCR / signal / expiry of the 4 indices and the last Screener BUYs come from the F&O screen (js/fno.js).
   A widget button opens a screen here: the app hands the target over (MoltrixApp.takeOpen) and window.mzWidgetOpen runs it. */
(function homeWidgets() {
  const has = () => !!(window.MoltrixApp && typeof MoltrixApp.widgetSet === "function");
  const signedIn = () => { try { return typeof account !== "undefined" && !!account; } catch (e) { return false; } };

  // ---------- production snapshot ----------
  async function prodSnapshot() {
    const token = await getToken(); if (!token) return null;
    const today = todayISO(), now = new Date();
    const from = localDateToISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    const ym = today.slice(0, 7);
    const { results } = await getWorkbooksForRange(token, from < ym + "-01" ? from : ym + "-01", today, { allCru: true });
    const days = {};       // iso -> { mt, heats }
    let monthMt = 0, monthHeats = 0, read = 0;
    for (const sub of results) {
      const sheet = xlSheetFor("Prod.", sub.cru);
      let values;
      try {
        values = (await graphFetch(`${sub.wb}/worksheets('${encodeURIComponent(String(sheet).replace(/'/g, "''"))}')/range(address='A1:AB2000')?$select=values`, token, { noSession: true })).values || [];
      } catch (e) { continue; }
      read++;
      for (let i = 0; i < values.length; i++) {
        const v = values[i][0];
        if (typeof v !== "number" || v < 40000) continue;
        const iso = excelSerialToISODate(v);
        const rows = values.slice(i, i + heatsAt(values, i));
        let mt = 0, heats = 0;
        rows.forEach(r => { if (r[1] !== "" && r[1] != null && String(r[1]).trim().toUpperCase() !== "MIN") { heats++; if (typeof r[27] === "number") mt += r[27]; } });
        if (!heats && !mt) continue;
        const d = days[iso] || (days[iso] = { mt: 0, heats: 0 });
        d.mt += mt; d.heats += heats;
        if (iso.slice(0, 7) === ym && iso <= today) { monthMt += mt; monthHeats += heats; }
      }
    }
    if (!read) return null;
    const last7 = [];
    for (let k = 6; k >= 0; k--) {
      const iso = localDateToISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - k));
      last7.push({ d: iso.slice(8), mt: Math.round(((days[iso] || {}).mt || 0) * 1000) / 1000 });
    }
    const t = days[today] || { mt: 0, heats: 0 };
    const yIso = localDateToISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    let sync = 0; try { sync = waAutoLastAt(); } catch (e) {}
    return { t: Date.now(), day: today, mt: Math.round(t.mt * 1000) / 1000, heats: t.heats,
      yMt: Math.round(((days[yIso] || {}).mt || 0) * 1000) / 1000, days: last7,
      month: Math.round(monthMt * 1000) / 1000, mHeats: monthHeats, sync };
  }
  window.mzWidgetProd = prodSnapshot;   // also used by the cloud sync

  let lastProd = 0, prodBusy = false;
  async function pushProd(force) {
    if (!has() || !signedIn() || prodBusy) return;
    try { if (typeof isViewer === "function" && isViewer()) return; } catch (e) {}
    if (!force && Date.now() - lastProd < 5 * 60000) return;
    prodBusy = true;
    try { const s = await prodSnapshot(); if (s) { lastProd = Date.now(); MoltrixApp.widgetSet("prod", JSON.stringify(s)); } }
    catch (e) { if (window.mzErr) mzErr("Widget", "production: " + (e && e.message || e)); }
    finally { prodBusy = false; }
  }
  window.mzWidgetPushProd = pushProd;

  // after every WhatsApp fetch (new heats) the production widget is refreshed
  mzAfterLoad(() => {
    if (typeof waInboxFetch === "function" && !waInboxFetch.__mzWidget) {
      const orig = waInboxFetch;
      const wrapped = async function () { const r = await orig.apply(this, arguments); setTimeout(() => pushProd(true), 1500); return r; };
      wrapped.__mzWidget = true;
      try { waInboxFetch = wrapped; } catch (e) {}
    }
    // when the app opens: wait for sign-in, then refresh the widgets and run a widget button's target
    let n = 0;
    const t = setInterval(() => {
      n++;
      if (signedIn()) { clearInterval(t); setTimeout(() => pushProd(false), 4000); window.mzWidgetOpen(); }
      else if (n > 90) clearInterval(t);
    }, 1000);
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pushProd(false); });

  // ---------- a widget button opens a screen ----------
  const $ = id => document.getElementById(id);
  const click = el => { if (el) { el.click(); return true; } return false; };
  const home = () => click(document.querySelector('.bottomTabItem[data-tab-action="home"]'));
  const section = s => { home(); return click(document.querySelector(`.navItem[data-section="${s}"]`)); };
  const TARGETS = {
    fetch: () => { home(); return click($("bottomTabFetch")); },
    prod: () => section("whatsapp"),
    reports: () => click(document.querySelector('.bottomTabItem[data-tab-section="reports"]')),
    dashboard: () => click(document.querySelector('.bottomTabItem[data-tab-section="dashboard"]')),
    stock: () => section("stock"),
    oos: () => section("outofspec"),
    trends: () => section("trends"),
    fno: () => { try { localStorage.setItem("fnoTab", "chain"); } catch (e) {} return section("marketdash") && click(document.querySelector('#marketSubNav [data-submkt="fno"]')); },
    scr: () => {
      try { localStorage.setItem("fnoTab", "scr"); } catch (e) {}
      const ok = section("marketdash") && click(document.querySelector('#marketSubNav [data-submkt="fno"]'));
      let n = 0; const tab = () => { if (!click(document.querySelector('[data-ftab="scr"]')) && ++n < 20) setTimeout(tab, 300); };   // F&O already open: switch its tab
      setTimeout(tab, 200);
      return ok;
    }
  };
  window.mzWidgetOpen = function () {
    let t = ""; try { t = (window.MoltrixApp && MoltrixApp.takeOpen && MoltrixApp.takeOpen()) || ""; } catch (e) {}
    if (!t || !TARGETS[t]) return;
    let n = 0;
    const go = () => {
      const app = $("app");
      if (signedIn() && app && !app.classList.contains("hidden")) { try { TARGETS[t](); } catch (e) {} return; }
      if (++n < 60) setTimeout(go, 500);
    };
    go();
  };
})();
