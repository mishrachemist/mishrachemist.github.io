/* ===== Phone back (swipe from the screen edge / back button) = go back one step inside the app.
   Order: close drawer / pop-up / Kashvi / tile edit -> leave a sub-page -> leave a section to Home.
   On Home, back closes the app like any other app. ===== */
(function phoneBack() {
  const SKIP = new Set(["navDrawer", "navDrawerBackdrop", "themeWipe", "offlineBanner", "askFabBubble", "homeEditBar", "bottomTabBar", "kashviPanel"]);
  const CLOSE_TXT = /^(✕|×|✖|x|close|cancel|बंद|रद्द|ok|got it)/i;
  const shown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  function closeBtnOf(ov) {
    const btns = Array.from(ov.querySelectorAll("button")).filter(shown);
    return btns.find(b => /close|cancel/i.test(b.id)) || btns.find(b => CLOSE_TXT.test((b.textContent || "").trim())) || null;
  }
  function topOverlay() {
    const vw = innerWidth, vh = innerHeight; let best = null, bz = -Infinity;
    for (const el of document.body.children) {
      if (SKIP.has(el.id) || el.tagName === "SCRIPT" || !shown(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < vw * vh * 0.3) continue;
      const named = /overlay/i.test(el.id + " " + el.className);
      const btn = closeBtnOf(el);
      if (!named && !btn) continue;   // e.g. sign-in screen: never closed by back
      const z = parseInt(cs.zIndex, 10) || 0;
      if (z >= bz) { bz = z; best = { el, btn }; }
    }
    return best;
  }
  function subBack() {   // an open sub-page (Reports -> Strip Mill etc.) -> its own back button
    const subs = Array.from(document.querySelectorAll('[id$="SubContent"], #bxPanel')).filter(shown);   // bxPanel: gold / silver details
    if (!subs.length) return null;
    const sub = subs[subs.length - 1];
    return sub.querySelector(".backBar .backBtn");
  }
  // one step back; with doIt=false only says whether there is a step to go back
  function step(doIt) {
    const drawer = document.getElementById("navDrawer");
    if (drawer && !drawer.classList.contains("closed")) {
      if (doIt) document.getElementById("navDrawerBackdrop").click();
      return true;
    }
    const kv = document.getElementById("kashviPanel");
    if (kv && shown(kv)) { if (doIt && typeof closeKashvi === "function") closeKashvi(); return true; }
    const sb = document.getElementById("mainSidebar");
    if (sb && sb.classList.contains("homeEditing")) {
      if (doIt) { const d = document.getElementById("homeEditDone"); if (d) d.click(); }
      return true;
    }
    const ov = topOverlay();
    if (ov) {
      if (doIt) { if (ov.btn) ov.btn.click(); else ov.el.click(); }
      return true;
    }
    const sbk = subBack();
    if (sbk) { if (doIt) sbk.click(); return true; }
    const ca = document.getElementById("contentArea");
    if (ca && !ca.classList.contains("hidden") && sb && sb.classList.contains("hidden")) {
      if (doIt) document.getElementById("backToMenuBtn").click();
      return true;
    }
    return false;
  }
  // Keep exactly one extra history entry ("guard") while we are away from Home, so the phone's back
  // comes to the app first; at Home we sit on the base entry, so back leaves the app.
  // Chrome ignores (skips) history entries added WITHOUT a tap, so after a back we never add a new
  // entry - we step forward onto the same guard entry again (history.forward() adds nothing).
  let atGuard = false, fwdGuard = false, quiet = 0;
  try { if (history.state && history.state.smsGuard) atGuard = true; else history.replaceState({ smsBase: 1 }, ""); } catch (e) {}
  function sync() {
    if (quiet || document.hidden) return;
    let deep = false;
    try { deep = step(false); } catch (e) { return; }
    try {
      if (deep && !atGuard) {
        if (fwdGuard) { quiet++; history.forward(); }
        else {
          const ua = navigator.userActivation;
          if (!ua || ua.isActive) { history.pushState({ smsGuard: 1 }, ""); atGuard = true; }
        }
      } else if (!deep && atGuard) { quiet++; history.back(); }
    } catch (e) {}
  }
  window.addEventListener("popstate", ev => {
    const onGuard = !!(ev.state && ev.state.smsGuard);
    if (onGuard) { atGuard = true; if (quiet) quiet--; return; }   // came forward onto the guard
    atGuard = false; fwdGuard = true;
    if (quiet) { quiet--; return; }   // our own silent back (went Home by a button)
    try { step(true); } catch (e) {}
    setTimeout(sync, 60);   // still not Home -> forward onto the guard again
  });
  document.addEventListener("click", () => setTimeout(sync, 120), true);
  setInterval(sync, 1000);   // pop-ups that open by themselves (PDF ready, celebrations...)
  window.appBackStep = () => step(true);
})();
