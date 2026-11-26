/* ===================== REFRESH KEEPS THE PAGE (26-Nov-2026) =====================
   A refresh (🔄 button, pull-down, the app reloading) used to always land on Home. Just before the page goes away the
   page that is open is noted in sessionStorage (it lives only as long as this tab / app window, so a fresh start of the
   app still opens Home); after the reload, once the app is signed in and its tiles are shown, the same tile, the same
   inner tile and the same scroll position are opened again. */
(function viewRestore() {
  const KEY = "mzView", MAX_AGE = 30 * 60 * 1000;
  const vis = el => !!el && el.getClientRects().length > 0 && !el.closest(".hidden");
  function current() {
    const home = document.getElementById("mainSidebar");
    if (!home || vis(home)) return null;   // on Home: nothing to keep
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
  const remember = () => { try { const v = current(); if (v) sessionStorage.setItem(KEY, JSON.stringify(v)); else sessionStorage.removeItem(KEY); } catch (e) {} };
  window.addEventListener("pagehide", remember);
  window.addEventListener("beforeunload", remember);

  let v = null;
  try { v = JSON.parse(sessionStorage.getItem(KEY) || "null"); sessionStorage.removeItem(KEY); } catch (e) { v = null; }
  if (!v || !v.sec || !/^[a-z0-9]{1,30}$/.test(v.sec) || !(Date.now() - v.t < MAX_AGE)) return;
  // no flash of Home (or of the tile's inner grid) while the page is put back: both stay invisible until it is done
  const root = document.documentElement, done = () => root.classList.remove("mzRestoring");
  root.classList.add("mzRestoring");
  { const st = document.createElement("style"); st.textContent = "html.mzRestoring #mainSidebar,html.mzRestoring #contentArea{visibility:hidden!important}"; document.head.appendChild(st); }
  const t0 = Date.now();
  const tryOpen = () => {
    if (Date.now() - t0 > 20000) { done(); return; }          // the app never got ready: stay on Home
    const home = document.getElementById("mainSidebar");
    let signed = false; try { signed = typeof account !== "undefined" && !!account; } catch (e) {}
    const locked = document.documentElement.classList.contains("mzLocked");   // the website's own fingerprint lock is showing
    const btn = document.querySelector(`#mainSidebar > .navItem[data-section="${v.sec}"]`);
    if (!signed || locked || !vis(home) || !btn) { setTimeout(tryOpen, 250); return; }
    if (getComputedStyle(btn).display === "none") { done(); return; }   // that tile is not available to this account any more
    btn.click();
    setTimeout(() => {
      if (v.attr && /^data-sub[a-z]+$/.test(v.attr)) {
        const panel = document.getElementById("section-" + v.sec);
        const sub = panel && [...panel.querySelectorAll(`[${v.attr}]`)].find(b => b.getAttribute(v.attr) === v.val);
        if (sub) sub.click();
      }
      setTimeout(() => { if (v.y > 0) window.scrollTo({ top: v.y, behavior: "instant" }); done(); }, 250);
    }, 120);
  };
  setTimeout(tryOpen, 300);
})();
