/* ===================== REFRESH WITHOUT RELOADING / REFRESH KEEPS THE PAGE =====================
   🔄 (top right) refreshes IN PLACE (26-Nov-2026): the short-lived memory of Excel reads is emptied and the page that is
   open is opened again, so its figures are read fresh - no reload, no sign-in wait, no flash of Home. On Home the
   month-production card is read again.
   A real reload (☰ → Refresh, a new version, the app restarting its page) still comes back to the same page: just before
   the page goes away the open tile / inner tile / scroll position are noted in sessionStorage (it lives only as long as
   this tab / app window, so a fresh start of the app still opens Home) and opened again once the app is signed in. */
(function viewRestore() {
  const KEY = "mzView", MAX_AGE = 30 * 60 * 1000, root = document.documentElement;
  const vis = el => !!el && el.getClientRects().length > 0 && !el.closest(".hidden");
  { const st = document.createElement("style"); st.textContent = "html.mzRestoring #mainSidebar,html.mzRestoring #contentArea{visibility:hidden!important}"; document.head.appendChild(st); }
  const done = () => root.classList.remove("mzRestoring");
  function current() {
    const home = document.getElementById("mainSidebar");
    if (!home || vis(home)) return null;   // on Home
    const btn = document.querySelector("#mainSidebar > .navItem.active[data-section]");
    if (!btn) return null;
    const sec = btn.dataset.section, panel = document.getElementById("section-" + sec);
    if (!panel || panel.classList.contains("hidden")) return null;
    const v = { sec, y: Math.round(window.scrollY || 0), t: Date.now() };
    // an inner tile (Reports → Billet Stock, Market → India, Get Started → App Access …) that is open now
    const sub = [...panel.querySelectorAll(".navItem.active")].find(b => [...b.attributes].some(a => /^data-sub[a-z]+$/.test(a.name)));
    if (sub) { const a = [...sub.attributes].find(x => /^data-sub[a-z]+$/.test(x.name)); const nav = sub.closest("[id$='SubNav']");
      const content = nav ? document.getElementById(nav.id.replace(/SubNav$/, "SubContent")) : null;
      if (!content || !content.classList.contains("hidden")) { v.attr = a.name; v.val = a.value; } }
    return v;
  }
  // open tile → inner tile → scroll, with Home / the inner grid kept invisible meanwhile
  function reopen(v, after) {
    const btn = document.querySelector(`#mainSidebar > .navItem[data-section="${v.sec}"]`);
    if (!btn || getComputedStyle(btn).display === "none") { done(); return; }
    root.classList.add("mzRestoring");
    // all in one go (the tile and inner tile open synchronously), so nothing in between is ever painted
    btn.click();
    if (v.attr && /^data-sub[a-z]+$/.test(v.attr)) {
      const panel = document.getElementById("section-" + v.sec);
      const sub = panel && [...panel.querySelectorAll(`[${v.attr}]`)].find(b => b.getAttribute(v.attr) === v.val);
      if (sub) sub.click();
    }
    if (v.y > 0) window.scrollTo({ top: v.y, behavior: "instant" });
    done();
    // a page may jump to the top a moment later while it fills in: put the scroll back for 0.8 s unless the user scrolls
    if (v.y > 0) {
      let user = false; const mine = () => { user = true; };
      ["touchstart", "wheel", "keydown"].forEach(ev => window.addEventListener(ev, mine, { once: true, passive: true }));
      [0, 60, 150, 300, 500, 800].forEach(ms => setTimeout(() => { if (!user && Math.abs(window.scrollY - v.y) > 4) window.scrollTo({ top: v.y, behavior: "instant" }); }, ms));
    }
    if (after) after();
  }

  /* ---- 🔄 refresh in place ---- */
  window.mzSoftRefresh = function () {
    const b = document.getElementById("refreshCornerBtn");
    if (b) { b.classList.add("busy"); setTimeout(() => b.classList.remove("busy"), 700); }
    try { if (typeof graphCacheClear === "function") graphCacheClear(); } catch (e) {}
    try { if (typeof _colBCache !== "undefined") _colBCache.clear(); } catch (e) {}
    try { if (typeof _prodHeatsCache !== "undefined") _prodHeatsCache.clear(); } catch (e) {}
    const v = current();
    if (!v) {   // Home: read the month-production card again
      try { if (window._homeLive) delete window._homeLive.monthProd; localStorage.removeItem("homeMonthProdCache"); } catch (e) {}
      try { if (typeof loadHomeMonthProd === "function") loadHomeMonthProd(); } catch (e) {}
      return;
    }
    reopen(v, () => { if (v.sec === "marketdash") { const r = document.getElementById("mdReload"); if (r && vis(r)) r.click(); } });
  };

  /* ---- a real reload: note the page, open it again afterwards ---- */
  const remember = () => { try { const v = current(); if (v) sessionStorage.setItem(KEY, JSON.stringify(v)); else sessionStorage.removeItem(KEY); } catch (e) {} };
  window.addEventListener("pagehide", remember);
  window.addEventListener("beforeunload", remember);

  let v = null;
  try { v = JSON.parse(sessionStorage.getItem(KEY) || "null"); sessionStorage.removeItem(KEY); } catch (e) { v = null; }
  if (!v || !v.sec || !/^[a-z0-9]{1,30}$/.test(v.sec) || !(Date.now() - v.t < MAX_AGE)) return;
  root.classList.add("mzRestoring");
  const t0 = Date.now();
  const tryOpen = () => {
    if (Date.now() - t0 > 20000) { done(); return; }          // the app never got ready: stay on Home
    const home = document.getElementById("mainSidebar");
    let signed = false; try { signed = typeof account !== "undefined" && !!account; } catch (e) {}
    const locked = root.classList.contains("mzLocked");      // the website's own fingerprint lock is showing
    if (!signed || locked || !home || !home.getClientRects().length || home.closest(".hidden")) { setTimeout(tryOpen, 100); return; }
    reopen(v);
  };
  setTimeout(tryOpen, 100);
})();
