/* ===================== MARKET HEALTH (Dashboard, owner only) =====================
   The Apps Script web-app link (with its private key) is kept only in this device's
   localStorage - never in this public website code. */
(function () {
  // two dashboards: India (Dashboard 2) and USA - each with its own link saved on this device
  const MKT = {
    ind: { ls: "marketDashUrl", title: "Swing Market Health · India", help: "Paste the <b>India dashboard website link</b> (Google Sheet → 📊 V5 PRO → 🌐 Dashboard 2 website link). It is saved only on this phone / PC, never in the website code." },
    us: { ls: "marketDashUrlUS", title: "Market Health · USA", help: "Paste the <b>USA dashboard website link</b> (Google Sheet → 📊 V5 PRO → 🌐 USA Dashboard website link). It is saved only on this phone / PC, never in the website code." },
    fno: { ls: "marketDashUrlFno", title: "F&O · NSE", help: "Paste the <b>F&amp;O dashboard website link</b> (Google Apps Script web app link that ends with <b>/exec?key=…</b>). It is saved only on this phone / PC, never in the website code." },
    intra: { ls: "marketDashUrlIntra", title: "Intraday · NSE F&O", help: "Paste the <b>Intraday dashboard website link</b> (Google Sheet → 📊 V5 PRO → ⚡ Intraday Dashboard → 🌐 Intraday Dashboard website link — it ends with <b>?view=intra&amp;key=…</b>). It is saved only on this phone / PC, never in the website code." }
  };
  let cur = "ind";
  const lsKey = () => MKT[cur].ls;
  const $ = id => document.getElementById(id);
  const isOwner = () => { try { return !!account && accountRole(account) === "owner"; } catch (e) { return false; } };
  const getUrl = () => { try { return localStorage.getItem(lsKey()) || ""; } catch (e) { return ""; } };
  // Cleans a pasted link: removes spaces/line breaks, the "/u/0/" account part and "<>" around the key.
  const clean = u => String(u || "").replace(/\s+/g, "").replace(/[<>"']/g, "").replace(/\/macros\/u\/\d+\/s\//, "/macros/s/");
  const why = u => {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{30,}\//.test(u)) return "link must start with https://script.google.com/macros/s/AKfy…";
    if (/\/dev(\?|$)/.test(u)) return "this is the /dev (test) link — use the /exec link from Deploy → Manage deployments";
    if (!/\/exec(\?|$)/.test(u)) return "link must contain /exec";
    const m = u.match(/[?&]key=([^&#]*)/);
    if (!m) return "?key=… is missing at the end — add the key from the sheet popup";
    if (!/^[A-Za-z0-9_-]{20,}$/.test(m[1])) return "the key looks incomplete (" + m[1].length + " characters) — copy it again from the sheet popup";
    return "";
  };
  const valid = u => !why(u);
  let loaded = false, loadedUrl = "";
  // F&O: its own screen (js/fno.js, data from NSE through the Android app) instead of a dashboard link
  const fnoMode = on => {
    ["mdWideBtn", "mdFsBtn", "mdSetupBtn", "mdPan"].forEach(id => { const el = $(id); if (el) el.classList.toggle("fnoHide", on); });
    const w = document.querySelector("#section-marketdash .mdWrap"); if (w) w.classList.toggle("hidden", on);
    if (on) { $("mdEmpty").classList.add("hidden"); $("mdSetup").classList.add("hidden"); $("mdLoading").classList.add("hidden"); $("mdSub").textContent = "Option chain · NSE"; if (window.mzFno) window.mzFno.show(); }
    else if (window.mzFno) window.mzFno.hide();
  };
  function load(force) {
    if (cur === "fno") { fnoMode(true); if (force && window.mzFno) window.mzFno.refresh(); return; }
    fnoMode(false);
    const u = getUrl(), f = $("mdFrame");
    if (!(typeof canMarket === "function" ? canMarket() : isOwner())) { f.removeAttribute("src"); $("mdEmpty").textContent = "Owner only."; $("mdEmpty").classList.remove("hidden"); return; }
    if (!u) { f.classList.add("hidden"); f.removeAttribute("src"); loaded = false; loadedUrl = ""; $("mdLoading").classList.add("hidden"); $("mdReload").classList.remove("spin");
      $("mdSub").textContent = "No link yet"; $("mdEmpty").textContent = "No link saved on this device yet — tap ⚙️ and paste the " + (cur === "us" ? "USA" : cur === "intra" ? "Intraday" : cur === "fno" ? "F&O" : "India") + " dashboard link."; $("mdEmpty").classList.remove("hidden"); return; }
    $("mdEmpty").classList.add("hidden"); f.classList.remove("hidden");
    if (force || !loaded || loadedUrl !== u) {
      $("mdLoading").classList.remove("hidden"); f.classList.add("mdHide"); $("mdReload").classList.add("spin");
      $("mdSub").textContent = "Dashboard · loading…";
      // A NEW frame each time: changing an iframe's src adds a step to the phone's back history, so "back"
      // used to reopen the previous dashboard (India -> back -> USA). A fresh frame adds nothing.
      const nf = f.cloneNode(false); nf.removeAttribute("src"); nf.addEventListener("load", onFrameLoad);
      f.replaceWith(nf); nf.src = u; loaded = true; loadedUrl = u;
    }
  }
  function onFrameLoad() {
    if (!$("mdFrame").getAttribute("src")) return;
    $("mdLoading").classList.add("hidden"); $("mdFrame").classList.remove("mdHide"); $("mdReload").classList.remove("spin");
    $("mdSub").textContent = "Dashboard · opened " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  $("mdFrame").addEventListener("load", onFrameLoad);
  // Market tile -> IND MKT / US MKT tiles -> the chosen dashboard
  function openMarket(k) {
    cur = MKT[k] ? k : "ind";
    $("mdTitleTxt").textContent = MKT[cur].title;
    $("mdSetupHelp").innerHTML = MKT[cur].help;
    $("mdSetup").classList.add("hidden"); $("mdMsg").textContent = "";
    document.querySelectorAll("#marketSubNav .navItem").forEach(b => b.classList.toggle("active", b.dataset.submkt === cur));
    $("marketSubNav").classList.add("hidden");
    const mb = $("mainBackBar"); if (mb) mb.classList.add("hidden");
    $("marketSubContent").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
    load(false);
  }
  document.querySelectorAll("#marketSubNav .navItem").forEach(b => b.addEventListener("click", () => openMarket(b.dataset.submkt)));
  $("backToMarketMenuBtn").addEventListener("click", () => {
    if (window.mzFno) window.mzFno.hide();
    { const w = document.querySelector("#section-marketdash .mdWrap"); if (w && w.classList.contains("mdFs")) document.getElementById("mdFsExit").click(); }
    $("marketSubContent").classList.add("hidden");
    $("marketSubNav").classList.remove("hidden");
    const mb = $("mainBackBar"); if (mb) mb.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  $("mdReload").addEventListener("click", () => load(true));
  // ↔ Wide view (remembered on this device, all market dashboards)
  const wideSet = on => {
    const w = document.querySelector("#section-marketdash .mdWrap");
    if (w) { w.classList.toggle("mdWideOn", on); if (!on) w.scrollLeft = 0; }
    $("mdPan").classList.toggle("hidden", !on); $("mdPan").value = 0;
    $("mdWideBtn").setAttribute("aria-pressed", on ? "true" : "false");
    try { localStorage.setItem("mdWide", on ? "1" : "0"); } catch (e) {}
  };
  let wide0 = false; try { wide0 = localStorage.getItem("mdWide") === "1"; } catch (e) {}
  wideSet(wide0);
  $("mdWideBtn").addEventListener("click", () => wideSet($("mdWideBtn").getAttribute("aria-pressed") !== "true"));
  {   // slider = move the wide dashboard sideways (a swipe on the dashboard also works where the phone allows it)
    const w = document.querySelector("#section-marketdash .mdWrap"), pan = $("mdPan");
    const room = () => Math.max(0, w.scrollWidth - w.clientWidth);
    pan.addEventListener("input", () => { w.scrollLeft = room() * pan.value / 1000; });
    w.addEventListener("scroll", () => { const r = room(); pan.value = r ? Math.round(w.scrollLeft / r * 1000) : 0; }, { passive: true });
  }
  // ⛶ Full screen: the dashboard fills the whole screen (browser full screen where allowed, otherwise it covers the page).
  // The dashboards' own ⛶ button asks for the same thing with a message {v5: "fs"}.
  let fsSrc = null;
  const fsWrap = () => document.querySelector("#section-marketdash .mdWrap");
  const fsIsOn = () => { const w = fsWrap(); return !!(w && w.classList.contains("mdFs")); };
  const fsTell = () => { try { if (fsSrc) fsSrc.postMessage({ v5fs: fsIsOn() }, "*"); } catch (e) {} };
  const fsSet = on => {
    const w = fsWrap(); if (!w) return;
    w.classList.toggle("mdFs", on); document.body.classList.toggle("mdFsBody", on);
    $("mdFsExit").classList.toggle("hidden", !on); $("mdFsBtn").setAttribute("aria-pressed", on ? "true" : "false");
    const fe = document.fullscreenElement || document.webkitFullscreenElement;
    if (on && !fe) { try { const r = (w.requestFullscreen || w.webkitRequestFullscreen || function () {}).call(w, { navigationUI: "hide" }); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
    if (!on && fe) { try { const r = (document.exitFullscreen || document.webkitExitFullscreen).call(document); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
    fsTell();
  };
  $("mdFsBtn").addEventListener("click", () => fsSet(!fsIsOn()));
  $("mdFsExit").addEventListener("click", () => fsSet(false));
  const fsChange = () => { if (!(document.fullscreenElement || document.webkitFullscreenElement) && fsIsOn()) fsSet(false); };
  document.addEventListener("fullscreenchange", fsChange); document.addEventListener("webkitfullscreenchange", fsChange);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && fsIsOn()) fsSet(false); });
  window.addEventListener("message", e => {
    if (!/(^https:\/\/[\w.-]+\.googleusercontent\.com$)|(^https:\/\/script\.google\.com$)/.test(e.origin || "")) return;
    const d = e.data; if (!d || d.v5 !== "fs") return;
    fsSrc = e.source;
    if (d.want === "state") fsTell(); else fsSet(typeof d.on === "boolean" ? d.on : !fsIsOn());
  });
  $("mdSetupBtn").addEventListener("click", () => { $("mdUrlIn").value = getUrl(); $("mdSetup").classList.toggle("hidden"); });
  $("mdSave").addEventListener("click", () => {
    const u = clean($("mdUrlIn").value);
    const w = why(u);
    if (w) { $("mdMsg").textContent = "⚠️ " + w; return; }
    try { localStorage.setItem(lsKey(), u); } catch (e) {}
    $("mdMsg").textContent = "✅ Saved"; $("mdSetup").classList.add("hidden"); loaded = false; load(true);
  });
  $("mdClear").addEventListener("click", () => {
    try { localStorage.removeItem(lsKey()); } catch (e) {}
    $("mdUrlIn").value = ""; $("mdFrame").removeAttribute("src"); loaded = false; $("mdMsg").textContent = "Removed from this device"; load(false);
  });
})();
