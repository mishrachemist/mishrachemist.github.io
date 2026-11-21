/* ===================== REPORTS SUB-NAV (icon grid inside Reports tab) ===================== */
document.querySelectorAll("#reportsSubNav .navItem").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#reportsSubNav .navItem").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".sub-sectionPanel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("subreport-" + btn.dataset.subreport).classList.remove("hidden");

    document.getElementById("reportsSubNav").classList.add("hidden");
    document.getElementById("mainBackBar").classList.add("hidden");
    document.getElementById("reportsSubContent").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
  });
});

document.getElementById("backToReportsMenuBtn").addEventListener("click", () => {
  document.getElementById("reportsSubContent").classList.add("hidden");
  document.getElementById("reportsSubNav").classList.remove("hidden");
  document.getElementById("mainBackBar").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
});

/* ===== Market: a different slogan on the sticky note every day ===== */
const MK_SLOGANS = [
  "शेयर बाजार में सबसे जोरदार थप्पड़ उम्मीद मारती है।",
  "बाजार धैर्य वालों को पैसा देता है, जल्दबाज़ों से वसूलता है।",
  "स्टॉप-लॉस वो बीमा है, जिसका प्रीमियम कभी महँगा नहीं होता।",
  "नुकसान छोटा रखो, मुनाफ़े को दौड़ने दो।",
  "बाजार को भविष्यवाणी नहीं, तैयारी चाहिए।",
  "डर में बेचना और लालच में खरीदना - दोनों महँगे पड़ते हैं।",
  "जो पोज़िशन नींद उड़ा दे, उसका साइज़ बड़ा है।",
  "टिप पर खरीदा शेयर अक्सर सबक बनकर बिकता है।",
  "एवरेजिंग से पहले पूछो - गलती सुधार रहे हो या बढ़ा रहे हो?",
  "हर दिन ट्रेड करना ज़रूरी नहीं, पैसा बचाना भी कमाना है।",
  "योजना बनाओ, फिर सिर्फ़ योजना पर ट्रेड करो।",
  "बाजार हमेशा सही होता है, हमारी राय नहीं।",
  "कैश भी एक पोज़िशन है।",
  "पहले पूँजी बचाओ, मुनाफ़ा अपने आप आएगा।",
  "बदले का ट्रेड नुकसान को दोगुना करने का सबसे छोटा रास्ता है।",
  "जहाँ भीड़ ज़्यादा, वहाँ सावधानी ज़्यादा।",
  "अच्छा शेयर भी गलत भाव पर बुरा सौदा है।",
  "एंट्री से पहले एग्ज़िट तय करो।",
  "बाजार कल भी खुलेगा - मौके खत्म नहीं होते, पूँजी खत्म हो जाती है।",
  "ज़्यादा ट्रेड, ज़्यादा ब्रोकरेज, कम मुनाफ़ा।",
  "जिस शेयर से प्यार हो जाए, वही सबसे ज़्यादा रुलाता है।",
  "गिरते चाकू को पकड़ने की जल्दी मत करो।",
  "रिस्क उतना ही लो, जितना हारकर भी मुस्कुरा सको।",
  "बाजार में राय नहीं, अनुशासन कमाता है।",
  "हर हरी कैंडल सोना नहीं होती।",
  "ट्रेडिंग डायरी लिखो - गलती दोबारा नहीं होगी।",
  "मुनाफ़ा बुक करना भी एक हुनर है।",
  "जो चार्ट पर नहीं दिखता, वो दिल से मत देखो।",
  "छोटे-छोटे सही फ़ैसले, लंबा सफ़र।",
  "बाजार से लड़ो मत, उसके साथ चलो।",
  "उधार के पैसे से ट्रेड, नींद और पैसा दोनों ले जाता है।"
];
function mkSloganShow() {
  const t = document.getElementById("mkNoteText"), d = document.getElementById("mkNoteDay");
  if (!t) return;
  const now = new Date();
  const day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);   // changes at local midnight
  t.textContent = MK_SLOGANS[((day % MK_SLOGANS.length) + MK_SLOGANS.length) % MK_SLOGANS.length];
  if (d) d.textContent = "आज का मंत्र · " + now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
mkSloganShow();
document.querySelectorAll('.navItem[data-section="marketdash"]').forEach(b => b.addEventListener("click", mkSloganShow));
document.addEventListener("visibilitychange", () => { if (!document.hidden) mkSloganShow(); });

/* ===================== AOP SUB-NAV (AOP / AOP vs Indent / Next FY AOP) ===================== */
document.querySelectorAll("#aopSubNav .navItem").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#aopSubNav .navItem").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#aopSubContent .sub-sectionPanel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("subaop-" + btn.dataset.subaop).classList.remove("hidden");
    document.getElementById("aopSubNav").classList.add("hidden");
    document.getElementById("mainBackBar").classList.add("hidden");
    document.getElementById("aopSubContent").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
  });
});
document.getElementById("backToAopMenuBtn").addEventListener("click", () => {
  document.getElementById("aopSubContent").classList.add("hidden");
  document.getElementById("aopSubNav").classList.remove("hidden");
  document.getElementById("mainBackBar").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
});

/* ===================== STOCK SUB-NAV (Raw Material Stock / Physical Stock Verification) ===================== */
document.querySelectorAll("#stockSubNav .navItem").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#stockSubNav .navItem").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#stockSubContent .sub-sectionPanel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("substock-" + btn.dataset.substock).classList.remove("hidden");
    document.getElementById("stockSubNav").classList.add("hidden");
    document.getElementById("mainBackBar").classList.add("hidden");
    document.getElementById("stockSubContent").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
  });
});
document.getElementById("backToStockMenuBtn").addEventListener("click", () => {
  document.getElementById("stockSubContent").classList.add("hidden");
  document.getElementById("stockSubNav").classList.remove("hidden");
  document.getElementById("mainBackBar").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
});

/* ===================== DASHBOARD SUB-NAV ===================== */
document.querySelectorAll("#dashboardSubNav .navItem").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#dashboardSubNav .navItem").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#section-dashboard .sub-sectionPanel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("subdash-" + btn.dataset.subdash).classList.remove("hidden");
    document.getElementById("dashboardSubNav").classList.add("hidden");
    document.getElementById("mainBackBar").classList.add("hidden");
    document.getElementById("dashboardSubContent").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
  });
});
document.getElementById("backToDashboardMenuBtn").addEventListener("click", () => {
  document.getElementById("dashboardSubContent").classList.add("hidden");
  document.getElementById("dashboardSubNav").classList.remove("hidden");
  document.getElementById("mainBackBar").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
});

/* ===================== GET STARTED SUB-NAV (tiles) ===================== */
function gsShowTiles() {   // Get Started always opens on its tiles
  const sc = document.getElementById("getStartedSubContent"), sn = document.getElementById("getStartedSubNav");
  if (!sc || !sn) return;
  sn.querySelectorAll(".navItem").forEach(b => b.classList.remove("active"));
  sc.querySelectorAll(".sub-sectionPanel").forEach(p => p.classList.add("hidden"));
  sc.classList.add("hidden"); sn.classList.remove("hidden");
  const cap = document.getElementById("getStartedCaption"); if (cap) cap.classList.remove("hidden");
  const mb = document.getElementById("mainBackBar"); if (mb) mb.classList.remove("hidden");
}
document.querySelectorAll("#getStartedSubNav .navItem").forEach(btn => {
  btn.addEventListener("click", () => {
    const pane = document.getElementById("subgs-" + btn.dataset.subgs); if (!pane) return;
    document.querySelectorAll("#getStartedSubNav .navItem").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#getStartedSubContent .sub-sectionPanel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active"); pane.classList.remove("hidden");
    document.getElementById("getStartedSubNav").classList.add("hidden");
    const cap = document.getElementById("getStartedCaption"); if (cap) cap.classList.add("hidden");
    document.getElementById("mainBackBar").classList.add("hidden");
    document.getElementById("getStartedSubContent").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
  });
});
document.getElementById("backToGetStartedMenuBtn").addEventListener("click", gsShowTiles);

/* ===================== ERP SUB-NAV (ERP Prod Download / ERP Entry) ===================== */
function openErpSub(key) {
  document.querySelectorAll("#erpSubNav .navItem").forEach(b => b.classList.toggle("active", b.dataset.suberp === key));
  document.querySelectorAll("#section-erpprod .sub-sectionPanel").forEach(p => p.classList.add("hidden"));
  document.getElementById("suberp-" + key).classList.remove("hidden");
  document.getElementById("erpSubNav").classList.add("hidden");
  document.getElementById("mainBackBar").classList.add("hidden");
  document.getElementById("erpSubContent").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
}
document.querySelectorAll("#erpSubNav .navItem").forEach(btn => btn.addEventListener("click", () => openErpSub(btn.dataset.suberp)));
document.getElementById("backToErpMenuBtn").addEventListener("click", () => {
  document.getElementById("erpSubContent").classList.add("hidden");
  document.getElementById("erpSubNav").classList.remove("hidden");
  document.getElementById("mainBackBar").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
});

/* ===================== TREND CHARTS SUB-NAV ===================== */
document.querySelectorAll("#trendsSubNav .navItem").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#trendsSubNav .navItem").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#section-trends .sub-sectionPanel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("subtrend-" + btn.dataset.subtrend).classList.remove("hidden");
    document.getElementById("trendsSubNav").classList.add("hidden");
    document.getElementById("mainBackBar").classList.add("hidden");
    document.getElementById("trendsSubContent").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
  });
});
document.getElementById("backToTrendsMenuBtn").addEventListener("click", () => {
  document.getElementById("trendsSubContent").classList.add("hidden");
  document.getElementById("trendsSubNav").classList.remove("hidden");
  document.getElementById("mainBackBar").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
});

/* ===================== PRODUCTION UPDATE SUB-NAV ===================== */
document.querySelectorAll("#whatsappSubNav .navItem").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#whatsappSubNav .navItem").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#section-whatsapp .sub-sectionPanel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("subwhatsapp-" + btn.dataset.subwhatsapp).classList.remove("hidden");
    document.getElementById("whatsappSubNav").classList.add("hidden");
    document.getElementById("mainBackBar").classList.add("hidden");
    document.getElementById("whatsappSubContent").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
  });
});
document.getElementById("backToWhatsappMenuBtn").addEventListener("click", () => {
  document.getElementById("whatsappSubContent").classList.add("hidden");
  document.getElementById("whatsappSubNav").classList.remove("hidden");
  document.getElementById("mainBackBar").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
});

/* ===================== ELEMENT SUB-NAV ===================== */
document.querySelectorAll("#elementSubNav .navItem").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#elementSubNav .navItem").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#section-element .sub-sectionPanel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("subelem-" + btn.dataset.subelem).classList.remove("hidden");
    document.getElementById("elementSubNav").classList.add("hidden");
    document.getElementById("mainBackBar").classList.add("hidden");
    document.getElementById("elementSubContent").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
    if (btn.dataset.subelem === "ptable" && window.ptStart) window.ptStart();
    if (btn.dataset.subelem === "safety" && window.spStart) window.spStart();
    if (btn.dataset.subelem === "sds" && window.sdsStart) window.sdsStart();
  });
});
document.getElementById("backToElementMenuBtn").addEventListener("click", () => {
  document.getElementById("elementSubContent").classList.add("hidden");
  document.getElementById("elementSubNav").classList.remove("hidden");
  document.getElementById("mainBackBar").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
});

/* ===================== ISO 9001 SUB-NAV ===================== */
document.querySelectorAll("#iso9001SubNav .navItem").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#iso9001SubNav .navItem").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#section-iso9001 .sub-sectionPanel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("subiso-" + btn.dataset.subiso).classList.remove("hidden");
    document.getElementById("iso9001SubNav").classList.add("hidden");
    document.getElementById("mainBackBar").classList.add("hidden");
    document.getElementById("iso9001SubContent").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
    // Refresh whichever list is being shown, in case it was updated elsewhere.
    if (btn.dataset.subiso === "ncr") renderNcrTable();
    if (btn.dataset.subiso === "calibration") { renderCalTable(); calCloudSync(); calDraftOffer(); }
    if (btn.dataset.subiso === "vendor") renderVenTable();
  });
});
document.getElementById("backToIso9001MenuBtn").addEventListener("click", () => {
  document.getElementById("iso9001SubContent").classList.add("hidden");
  document.getElementById("iso9001SubNav").classList.remove("hidden");
  document.getElementById("mainBackBar").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
});

/* ===================== PDF PREVIEW MODAL ===================== */
let currentPdfDoc = null;
let currentPdfFilename = "";

/* ===================== TASK COMPLETION POPUP ===================== */
// Long Graph/Excel error JSON -> one short readable line.
function shortError(err) {
  const t = String(err || "");
  if (/EditModeCannotAcquireLock|accessConflict|is editing this workbook/i.test(t))
    return "Excel file is open on the PC (locked) - close it and try again";
  if (/\b429\b|TooManyRequests|throttl/i.test(t)) return "Excel is busy (too many requests) - try again in a minute";
  if (/\b(502|503|504)\b|ServiceUnavailable|GatewayTimeout/i.test(t)) return "Excel service not responding - try again";
  if (/\b401\b|InvalidAuthenticationToken|expired/i.test(t)) return "Sign-in expired - sign in again";
  if (/\b404\b|itemNotFound/i.test(t)) return "File or sheet not found";
  if (/Failed to fetch|NetworkError|network/i.test(t)) return "No internet / network problem";
  const m = /"message"\s*:\s*"([^"]{1,120})/.exec(t);
  const short = (m ? m[1] : t).replace(/\s+/g, " ").trim();
  return short.length > 120 ? short.slice(0, 117) + "..." : short;
}

function showCompletionPopup(message) {
  let overlay = document.getElementById("completionOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "completionOverlay";
    overlay.className = "pdfOverlay";
    overlay.innerHTML = `
      <div class="pdfModal" style="height:auto;max-height:85vh;max-width:480px;display:flex;flex-direction:column;">
        <div class="pdfModalHead" style="flex-shrink:0;">
          <span>✅ Task Complete</span>
          <div><button class="secondary" id="completionCloseBtn">Close</button></div>
        </div>
        <div id="completionBody" style="padding:20px;white-space:pre-wrap;font-size:14px;color:var(--ink);overflow-y:auto;min-height:0;"></div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById("completionCloseBtn").addEventListener("click", () => {
      overlay.classList.add("hidden");
    });
    // tap on the dark area outside the box also closes it
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.add("hidden"); });
  }
  document.getElementById("completionBody").textContent = message;
  overlay.classList.remove("hidden");
}

let lastReportRows = null;
let lastReportHeaders = null;

// Phones (Android Chrome / the installed app) have no built-in PDF viewer
// inside a page, so an <iframe> only shows a grey box with a meaningless
// name (the "AAAAAAAA..." text). There the pages are drawn as pictures with
// pdf.js instead. Desktop browsers keep the normal PDF viewer.
/* ===================== date / month picker in the app's own theme (phones) =====================
   The phone's own date dialog (Android teal) ignores the app theme: on touch screens a tap on a date or month box opens
   this calendar instead, coloured from the theme variables (--navy, --gold, --card, --ink). The box keeps type="date" /
   "month", so every value stays yyyy-mm-dd / yyyy-mm for the rest of the app. */
(function () {
  const touch = !!window.MZ_NATIVE || (window.matchMedia && matchMedia("(pointer: coarse)").matches);
  if (!touch) return;
  const css = document.createElement("style");
  css.textContent = `
  .mzDpOv{position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}
  .mzDp{width:100%;max-width:360px;background:var(--card,#fff);color:var(--ink,#16233d);border-radius:18px;overflow:hidden;box-shadow:0 14px 40px rgba(0,0,0,.35);font-family:inherit}
  .mzDp button{width:auto;min-width:0;flex:0 0 auto;text-transform:none;letter-spacing:normal}
  .mzDp .mzDpD{width:100%}
  .mzDpHd{background:var(--navy,#0b2545);color:var(--navy-text,#fff);padding:16px 20px 14px}
  .mzDpYr{font-size:15px;font-weight:700;opacity:.8;background:none;border:0;color:inherit;padding:0;margin:0;cursor:pointer}
  .mzDpBig{font-size:30px;font-weight:800;line-height:1.15;margin-top:2px}
  .mzDpNav{display:flex;align-items:center;justify-content:space-between;padding:10px 10px 4px}
  .mzDpNav button{background:none;border:0;color:var(--ink,#16233d);width:44px;height:44px;border-radius:50%;font-size:22px;margin:0;padding:0;box-shadow:none;cursor:pointer}
  .mzDpNav button:active{background:rgba(127,127,127,.15)}
  .mzDpNav .mzDpTitle{width:auto;height:auto;border-radius:10px;font-weight:700;font-size:16px;white-space:nowrap;background:none;border:0;color:var(--ink,#16233d);margin:0;padding:6px 10px;box-shadow:none;cursor:pointer}
  .mzDpGrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));padding:0 10px 6px;gap:2px}
  .mzDpGrid.m{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:6px 14px 10px}
  .mzDpWd{text-align:center;font-size:12.5px;font-weight:700;color:var(--muted,#5b6b85);padding:6px 0}
  .mzDpD{height:42px;border:0;background:none;color:var(--ink,#16233d);border-radius:50%;font-size:15px;margin:0;padding:0;box-shadow:none;cursor:pointer;font-family:inherit}
  .mzDpGrid.m .mzDpD{border-radius:12px;height:46px;font-weight:600}
  .mzDpD:disabled{opacity:.3;cursor:default}
  .mzDpD.today{box-shadow:inset 0 0 0 2px var(--gold,#c9a227)}
  .mzDpD.sel{background:var(--gold,#c9a227);color:#fff;font-weight:800}
  .mzDpFt{display:flex;align-items:center;gap:6px;padding:6px 12px 12px}
  .mzDpFt button{background:none;border:0;color:var(--gold,#c9a227);font-weight:800;font-size:15px;padding:10px 12px;margin:0;box-shadow:none;cursor:pointer;min-height:44px}
  .mzDpFt .sp{flex:1}`;
  document.head.appendChild(css);
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const pad = n => String(n).padStart(2, "0");
  const isPick = el => el && el.tagName === "INPUT" && (el.type === "date" || el.type === "month") && !el.disabled && !el.readOnly;
  let lastOpen = 0;

  function open(el) {
    if (Date.now() - lastOpen < 600 || document.querySelector(".mzDpOv")) return;
    lastOpen = Date.now();
    const month = el.type === "month";
    const now = new Date(), today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    let v = el.value || "";
    let sel = month ? (/^\d{4}-\d{2}$/.test(v) ? v : "") : (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
    let y = sel ? +sel.slice(0, 4) : now.getFullYear(), m = sel ? +sel.slice(5, 7) - 1 : now.getMonth();
    let view = month ? "months" : "days";
    const min = el.min || "", max = el.max || "";
    const ov = document.createElement("div"); ov.className = "mzDpOv";
    ov.innerHTML = `<div class="mzDp" role="dialog" aria-modal="true"><div class="mzDpHd"><button type="button" class="mzDpYr"></button><div class="mzDpBig"></div></div>
      <div class="mzDpNav"><button type="button" data-k="prev" aria-label="Previous">‹</button><button type="button" class="mzDpTitle" data-k="title"></button><button type="button" data-k="next" aria-label="Next">›</button></div>
      <div class="mzDpBody"></div>
      <div class="mzDpFt">${el.required ? "" : '<button type="button" data-k="clear">CLEAR</button>'}<span class="sp"></span><button type="button" data-k="cancel">CANCEL</button><button type="button" data-k="set">SET</button></div></div>`;
    const $ = q => ov.querySelector(q);
    const okDay = d => (!min || d >= min) && (!max || d <= max);
    const okMon = k => (!min || k >= min.slice(0, 7)) && (!max || k <= max.slice(0, 7));
    function draw() {
      const sy = sel ? +sel.slice(0, 4) : y;
      $(".mzDpYr").textContent = String(sy);
      if (month) $(".mzDpBig").textContent = sel ? `${MON[+sel.slice(5, 7) - 1]} ${sel.slice(0, 4)}` : "—";
      else if (sel) { const d = new Date(+sel.slice(0, 4), +sel.slice(5, 7) - 1, +sel.slice(8, 10)); $(".mzDpBig").textContent = `${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()].slice(0, 3)}`; }
      else $(".mzDpBig").textContent = "—";
      const body = $(".mzDpBody");
      if (view === "days") {
        $(".mzDpTitle").textContent = `${MON[m]} ${y}`;
        const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
        let h = '<div class="mzDpGrid">' + ["S", "M", "T", "W", "T", "F", "S"].map(w => `<div class="mzDpWd">${w}</div>`).join("");
        for (let i = 0; i < first; i++) h += "<div></div>";
        for (let d = 1; d <= days; d++) {
          const k = `${y}-${pad(m + 1)}-${pad(d)}`;
          h += `<button type="button" class="mzDpD${k === sel ? " sel" : ""}${k === today ? " today" : ""}" data-d="${k}" ${okDay(k) ? "" : "disabled"}>${d}</button>`;
        }
        body.innerHTML = h + "</div>";
      } else if (view === "months") {
        $(".mzDpTitle").textContent = String(y);
        body.innerHTML = '<div class="mzDpGrid m">' + MON.map((n, i) => { const k = `${y}-${pad(i + 1)}`, cur = month ? sel : sel.slice(0, 7);
          return `<button type="button" class="mzDpD${k === cur ? " sel" : ""}${k === today.slice(0, 7) ? " today" : ""}" data-m="${i}" ${okMon(k) ? "" : "disabled"}>${n.slice(0, 3)}</button>`; }).join("") + "</div>";
      } else {   // years
        const y0 = y - (y % 12);
        $(".mzDpTitle").textContent = `${y0} – ${y0 + 11}`;
        body.innerHTML = '<div class="mzDpGrid m">' + Array.from({ length: 12 }, (_, i) => y0 + i).map(Y =>
          `<button type="button" class="mzDpD${Y === +(sel || today).slice(0, 4) ? " sel" : ""}" data-y="${Y}">${Y}</button>`).join("") + "</div>";
      }
    }
    const close = () => { ov.remove(); try { el.blur(); } catch (e) {} };
    const apply = val => {
      if (el.value !== val) {
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      close();
    };
    ov.addEventListener("click", e => {
      if (e.target === ov) return close();
      const b = e.target.closest("button"); if (!b) return;
      const k = b.dataset.k;
      if (b.dataset.d) { sel = b.dataset.d; draw(); return; }
      if (b.dataset.m != null) { m = +b.dataset.m; if (month) { sel = `${y}-${pad(m + 1)}`; draw(); } else { view = "days"; draw(); } return; }
      if (b.dataset.y) { y = +b.dataset.y; view = "months"; draw(); return; }
      if (b.classList.contains("mzDpYr")) { view = "years"; draw(); return; }
      if (k === "title") { view = view === "days" ? "months" : view === "months" ? "years" : "years"; draw(); return; }
      if (k === "prev" || k === "next") {
        const s = k === "prev" ? -1 : 1;
        if (view === "days") { m += s; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } }
        else if (view === "months") y += s; else y += 12 * s;
        draw(); return;
      }
      if (k === "cancel") return close();
      if (k === "clear") return apply("");
      if (k === "set") return sel ? apply(sel) : close();
    });
    draw();
    document.body.appendChild(ov);
  }
  // a tap on the box opens this calendar instead of the phone's dialog
  let t0 = null;   // only a tap opens it - not a scroll that ends on a date box
  document.addEventListener("touchstart", e => { const t = e.touches[0]; t0 = t ? { x: t.clientX, y: t.clientY } : null; }, { capture: true, passive: true });
  document.addEventListener("touchend", e => {
    const el = e.target; if (!isPick(el)) return;
    const t = e.changedTouches[0];
    if (t0 && t && Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > 10) return;
    e.preventDefault(); open(el);
  }, { capture: true, passive: false });
  document.addEventListener("click", e => { const el = e.target; if (!isPick(el)) return; e.preventDefault(); e.stopPropagation(); open(el); }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape") { const o = document.querySelector(".mzDpOv"); if (o) o.remove(); } });
  window.mzDatePickerOpen = open;
})();

/* ===================== script files (e.g. Moltrix_Hourly_Sync.gs): shown with a Copy button instead of a download ===================== */
// a phone has no app that opens a .gs file - the code is shown here and copied to paste into Apps Script
document.addEventListener("click", async e => {
  const a = e.target.closest && e.target.closest("a.codeCopyLink"); if (!a) return;
  e.preventDefault();
  let txt = "";
  try { const r = await fetch(a.getAttribute("href"), { cache: "no-store" }); if (!r.ok) throw new Error(r.status); txt = await r.text(); }
  catch (err) { alert("Could not load the file (" + (err.message || err) + ")."); return; }
  const name = a.getAttribute("href").split("/").pop();
  const ov = document.createElement("div"); ov.className = "pdfOverlay";
  ov.innerHTML = `<div class="pdfModal" style="height:auto;max-height:90vh;max-width:720px;display:flex;flex-direction:column;">
    <div class="pdfModalHead" style="flex-shrink:0;"><span></span><div style="display:flex;gap:8px;"><button class="primary" type="button" data-k="copy">📋 Copy</button><button class="secondary" type="button" data-k="close">Close</button></div></div>
    <pre style="margin:0;padding:12px;overflow:auto;min-height:0;font-size:11.5px;line-height:1.45;white-space:pre;user-select:text;-webkit-user-select:text;"></pre></div>`;
  ov.querySelector(".pdfModalHead span").textContent = name;
  ov.querySelector("pre").textContent = txt;
  const close = () => ov.remove();
  ov.addEventListener("click", ev => { if (ev.target === ov) close(); });
  ov.querySelector('[data-k="close"]').addEventListener("click", close);
  ov.querySelector('[data-k="copy"]').addEventListener("click", async ev => {
    const b = ev.currentTarget; let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch (x) {}
    if (!ok) { const t = document.createElement("textarea"); t.value = txt; t.style.cssText = "position:fixed;left:-9999px;top:0"; document.body.appendChild(t); t.select(); try { ok = document.execCommand("copy"); } catch (x) {} t.remove(); }
    b.textContent = ok ? "✅ Copied" : "Select and copy by hand"; setTimeout(() => { b.textContent = "📋 Copy"; }, 2500);
  });
  document.body.appendChild(ov);
});

/* ===================== REPORT ZOOM (only the report, never the whole page) ===================== */
// Pinch or double-tap zooms just the report image inside the preview; the page itself stays put.
function reportZoomLock(on) {
  const m = document.querySelector('meta[name="viewport"]');
  if (!m) return;
  if (!m.dataset.orig) m.dataset.orig = m.getAttribute("content");
  m.setAttribute("content", on ? "width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no" : m.dataset.orig);
}
function reportZoomSet(box, z, mx, my) {
  const old = parseFloat(box.style.getPropertyValue("--rz")) || 1;
  z = Math.max(1, Math.min(5, z));
  if (mx == null) { mx = box.clientWidth / 2; my = box.clientHeight / 2; }
  const cx = box.scrollLeft + mx, cy = box.scrollTop + my, r = z / old;
  box.style.setProperty("--rz", z.toFixed(3));
  box.classList.toggle("rzOn", z > 1.01);
  box.scrollLeft = cx * r - mx; box.scrollTop = cy * r - my;
  const pill = box.parentElement && box.parentElement.querySelector(":scope > .rzPill");
  if (pill) { pill.textContent = `🔍 ${Math.round(z * 100)}%  ·  tap to reset`; pill.classList.toggle("show", z > 1.01); }
}
function reportZoomReset(box) { if (box) { box.style.setProperty("--rz", "1"); box.classList.remove("rzOn"); box.scrollLeft = 0; box.scrollTop = 0; const pill = box.parentElement && box.parentElement.querySelector(":scope > .rzPill"); if (pill) pill.classList.remove("show"); } }
function enableReportZoom(box) {
  if (!box || box.dataset.rzReady) return;
  box.dataset.rzReady = "1";
  box.classList.add("reportZoom");
  const pill = document.createElement("button");
  pill.type = "button"; pill.className = "rzPill";
  pill.addEventListener("click", () => reportZoomReset(box));
  box.parentElement.appendChild(pill);
  let pinch = null, lastTap = 0, raf = 0, pending = null;
  const rel = (t) => { const r = box.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  box.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      const p1 = rel(a), p2 = rel(b);
      pinch = { d0: dist(a, b), z0: parseFloat(box.style.getPropertyValue("--rz")) || 1, mx: (p1[0] + p2[0]) / 2, my: (p1[1] + p2[1]) / 2 };
      e.preventDefault();
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap < 300) {               // double-tap: zoom in to 2.5x there, or back to fit
        const [mx, my] = rel(e.touches[0]);
        const z = parseFloat(box.style.getPropertyValue("--rz")) || 1;
        reportZoomSet(box, z > 1.01 ? 1 : 2.5, mx, my);
        e.preventDefault(); lastTap = 0;
      } else lastTap = now;
    }
  }, { passive: false });
  box.addEventListener("touchmove", e => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = e.touches;
    pending = pinch.z0 * dist(a, b) / pinch.d0;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (pinch && pending) reportZoomSet(box, pending, pinch.mx, pinch.my); });
  }, { passive: false });
  box.addEventListener("touchend", e => { if (e.touches.length < 2) pinch = null; });
  // desktop: Ctrl + mouse wheel zooms the report only
  box.addEventListener("wheel", e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const r = box.getBoundingClientRect();
    const z = parseFloat(box.style.getPropertyValue("--rz")) || 1;
    reportZoomSet(box, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
}

function needsImagePdfPreview() {
  if (typeof isViewer === "function" && isViewer()) return true;   // view-only: no browser PDF viewer (it has its own Download/Print)
  if (navigator.pdfViewerEnabled === false) return true;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
let _pdfjsLoading = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsLoading) return _pdfjsLoading;
  _pdfjsLoading = new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
    sc.integrity = "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e"; sc.crossOrigin = "anonymous";
    sc.onload = () => {
      if (!window.pdfjsLib) { reject(new Error("pdf.js not available")); return; }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    sc.onerror = () => { _pdfjsLoading = null; reject(new Error("Couldn't load the PDF viewer (no internet?)")); };
    document.head.appendChild(sc);
  });
  return _pdfjsLoading;
}
let _pdfRenderToken = 0;
async function renderPdfPagesAsImages(doc, filename) {
  const box = document.getElementById("pdfPages");
  const myToken = ++_pdfRenderToken;
  box.innerHTML = `<div class="pdfPagesMsg">Loading preview...</div>`;
  try {
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(doc.output("arraybuffer")) }).promise;
    if (myToken !== _pdfRenderToken) return; // a newer preview started
    box.innerHTML = "";
    const width = Math.min(box.clientWidth - 20, 900) || 360;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      if (myToken !== _pdfRenderToken) return;
      const base = page.getViewport({ scale: 1 });
      const scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, 2.5);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      box.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    }
  } catch (e) {
    if (myToken !== _pdfRenderToken) return;
    box.innerHTML = `<div class="pdfPagesMsg">📄 <b>${htmlEsc(filename)}</b><br>Preview couldn't be shown here (${htmlEsc(e.message)}).<br>Use <b>Download</b> or <b>📲 Share</b> to open it.</div>`;
  }
}

function showPdfPreview(doc, filename, title) {
  addVerificationStamp(doc);
  currentPdfDoc = doc;
  currentPdfFilename = filename;
  document.getElementById("pdfModalTitle").textContent = title || "PDF Preview";
  const frame = document.getElementById("pdfFrame");
  const pages = document.getElementById("pdfPages");
  document.getElementById("pdfPreviewOverlay").classList.remove("hidden");
  enableReportZoom(pages); reportZoomReset(pages); reportZoomLock(true);
  if (needsImagePdfPreview()) {
    frame.classList.add("hidden");
    frame.removeAttribute("src");
    pages.classList.remove("hidden");
    renderPdfPagesAsImages(doc, filename);
  } else {
    pages.classList.add("hidden");
    frame.classList.remove("hidden");
    frame.src = doc.output("datauristring", { filename });
  }
}

// Adds a small "Verified by" stamp to the bottom of every page, on every
// report - a single central place so no individual report generator needs
// to remember to add it.
// Owner -> "Durgesh Mishra"; a granted user -> their own Microsoft account name (or the part of the e-mail before @)
function reportPersonName() {
  try {
    if (typeof isUserMode === "function" && isUserMode() && account) {
      const n = String(account.name || "").trim();
      return n || String(accountEmail(account) || "").split("@")[0] || "User";
    }
  } catch (e) {}
  return "Durgesh Mishra";
}
function addVerificationStamp(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  const stampDate = new Date().toLocaleDateString("en-GB");
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(`Verified by ${reportPersonName()} - ${stampDate}`, pageW / 2, pageH - 12, { align: "center" });
  }
}

document.getElementById("pdfCloseBtn").addEventListener("click", () => {
  document.getElementById("pdfPreviewOverlay").classList.add("hidden");
  reportZoomLock(false);
  document.getElementById("pdfFrame").src = "";
  _pdfRenderToken++;
  document.getElementById("pdfPages").innerHTML = "";
});

document.getElementById("pdfDownloadBtn").addEventListener("click", () => {
  if (currentPdfDoc) currentPdfDoc.save(currentPdfFilename);
});

document.getElementById("pdfShareBtn").addEventListener("click", async () => {
  if (!currentPdfDoc) return;
  try {
    const blob = currentPdfDoc.output("blob");
    const file = new File([blob], currentPdfFilename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: currentPdfFilename });
    } else {
      alert("Direct sharing isn't supported in this browser. Please use Download, then share the file manually via WhatsApp.");
    }
  } catch (e) {
    if (e.name !== "AbortError") alert("Share failed: " + e.message);
  }
});

/* ===================== AUTH ===================== */
// MSAL v2/v3 REQUIRES initialize() before any other API call.
// This promise gates every auth operation so nothing runs too early.
const msalReady = msalInstance.initialize();

// Surface auth errors on the page instead of hiding them in the console.
function showAuthError(msg) {
  const el = document.getElementById("status");
  if (el) {
    el.className = "err";
    el.textContent = msg;
  }
  console.error(msg);
}

// MSAL cannot work when the page is opened directly from disk (file://),
// because window.location.origin is "null" and no redirect URI can match.
const isFileProtocol = window.location.protocol === "file:";

async function init() {
  if (isFileProtocol) {
    showAuthError(
      "This page was opened directly from a file (file://). Microsoft sign-in only works when the page is served from a server. " +
      "Open a terminal in the folder and run:  python -m http.server 8000  — then open: http://localhost:8000/index.html"
    );
    return;
  }
  await msalReady;
  const resp = await msalInstance.handleRedirectPromise().catch(e => {
    console.error(e);
    // keep Microsoft's own reason (e.g. AADSTS50020) so a team-account problem can be shown on screen
    try { sessionStorage.setItem("msalLastError", ((e && e.errorCode) ? e.errorCode + ": " : "") + String((e && (e.errorMessage || e.message)) || e).slice(0, 300)); } catch (x) {}
    return null;
  });
  if (!resp) msalClearStaleInteraction();   // no sign-in answer in this page load -> any "in progress" mark is left over
  if (resp && resp.account) {
    account = resp.account;
    if (!isAllowedAccount(account)) { blockAccount(); return; }
    if (window.mzLockRecovered) try { window.mzLockRecovered(account); } catch (e) {}
    if (resp.accessToken) {
      cachedAccessToken = resp.accessToken;
      cachedTokenExpiry = resp.expiresOn ? resp.expiresOn.getTime() : Date.now() + 3300000;
    }
    showSignedIn();
    logLoginEvent("Sign-in");
    resumePendingAction();
    return;
  }
  // Only restore the specific account this browser last explicitly signed
  // in as (matched by homeAccountId) - never blindly grab getAllAccounts()[0],
  // since MSAL's cache can hold leftover accounts from other logins on this
  // device, and picking "whichever is first" caused silent sign-in as the
  // wrong person. If nothing matches, just show the Sign In button.
  const lastAccountId = localStorage.getItem("lastSignedInAccountId");
  if (lastAccountId) {
    const matched = msalInstance.getAllAccounts().find(a => a.homeAccountId === lastAccountId);
    if (matched) {
      account = matched;
      if (!isAllowedAccount(account)) { blockAccount(); return; }
      // If Fingerprint Sign-In is set up and the app was locally locked
      // (last action was "Sign Out"), show the lock screen instead of
      // going straight into the app - even though the Microsoft account is
      // still cached and would otherwise auto-restore silently here.
      // Fingerprint Sign-In has been removed - always go straight in.
      showSignedIn();
      logLoginEvent("App open");
    } else {
      localStorage.removeItem("lastSignedInAccountId");
    }
  }
}

/* ---- Login record: every sign-in (and first app-open of the day) goes to the
   "Logins" sheet of the WA Inbox Apps Script (action=login, separate key). ---- */
function loginDeviceLabel() {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iPhone/iPad" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const app = window.MZ_NATIVE || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ? " (app)" : "";
  return `${os} · ${br}${app} · ${screen.width}x${screen.height}`;
}
function logLoginEvent(event, accArg) {   // the access server writes the log itself, using the e-mail Microsoft confirmed (nothing to forge)
  try {
    const acct = accArg || account;   // a blocked sign-in passes its account (the global one is cleared at once)
    if (!acct || !accessUrl()) return;
    if (event === "App open") { // only once per day per account
      const k = "loginLogDay:" + (acct.homeAccountId || accountEmail(acct));
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(k) === today) return;
      localStorage.setItem(k, today);
    }
    loginGeo().then(g => authCall({ action: "log", event, device: loginDeviceLabel(), ip: g.ip, loc: g.loc }, acct)).catch(() => {});
  } catch (e) { console.warn("login log failed", e); }
}
// Public IP + approximate place (city / state / country + internet provider) from GeoJS (free, no key).
// Mobile data often shows the operator's city, not the exact place. Kept 30 min per tab; if it fails the log still goes.
async function loginGeo() {
  try { const c = JSON.parse(sessionStorage.getItem("loginGeo") || "null"); if (c && Date.now() - c.t < 30 * 60000) return c; } catch (e) {}
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch("https://get.geojs.io/v1/ip/geo.json", { cache: "no-store", credentials: "omit", signal: ctl.signal });
    clearTimeout(tm);
    const j = await r.json();
    const place = [j.city, j.region, j.country].filter(Boolean).join(", ");
    const g = { ip: String(j.ip || "").slice(0, 45), loc: (place + (j.organization_name ? " · " + j.organization_name : "")).slice(0, 120), t: Date.now() };
    try { sessionStorage.setItem("loginGeo", JSON.stringify(g)); } catch (e) {}
    return g;
  } catch (e) { return { ip: "", loc: "" }; }
}

function resumePendingAction() {
  const raw = sessionStorage.getItem("pendingResume");
  if (!raw) return;
  sessionStorage.removeItem("pendingResume");
  try {
    const data = JSON.parse(raw);
    if (data.action === "updateExcel") {
      document.getElementById("filePath").value = data.filePath || "";
      document.getElementById("sheetName").value = data.sheetName || "";
      document.getElementById("msgBox").value = data.msgBox || "";
      if (data.section) document.getElementById("msgSection").value = data.section;
      if (data.msgDate) document.getElementById("msgDate").value = data.msgDate;
      const statusEl = document.getElementById("status");
      statusEl.className = "wait";
      statusEl.textContent = "Re-updating the message after sign-in refresh...";
      updateExcel();
    }
  } catch (e) {
    console.error("resumePendingAction failed", e);
  }
}
mzAfterLoad(() => init().catch(e => showAuthError("init failed: " + (e && e.message ? e.message : e)))
  .finally(() => document.documentElement.classList.remove("restoringLogin")));   // after every part of the app has loaded

document.getElementById("signInBtn").addEventListener("click", async () => {
  if (isFileProtocol) {
    showAuthError(
      "Cannot sign in over file://. Serve the page from a server instead: python -m http.server 8000 → http://localhost:8000/index.html"
    );
    return;
  }
  try {
    await msalReady;
    // loginRedirect only — popup was removed earlier because it caused
    // nested-popup errors in this project.
    await msalInstance.loginRedirect({ scopes: graphScopes, prompt: "select_account" });
    // page navigates away; nothing after this runs
  } catch (e) {
    // errorCode (e.g. redirect_uri_mismatch, unauthorized_client) pinpoints the Azure cause.
    const code = e && e.errorCode ? " [" + e.errorCode + "]" : "";
    showAuthError("Sign-in failed" + code + ": " + (e && e.errorMessage ? e.errorMessage : (e && e.message ? e.message : e)));
  }
});

function inViewerApp() {
  try { return !!(window.SMSViewer && window.SMSViewer.isViewerApp && window.SMSViewer.isViewerApp()); } catch (e) { return false; }
}
// iPhone / iPad: there is no Viewer app (iOS can't block screenshots anyway), so team
// accounts may use Safari there - still view-only, with the name watermark.
function isAppleMobile() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}
function showSignedIn() {
  if (!isAllowedAccount(account)) { blockAccount(); return; }
  // Team (view-only) accounts may open reports only inside the "SMS Viewer" Android app,
  // where screenshots and screen recording are blocked by Android.
  if (isViewer() && !inViewerApp() && !isAppleMobile()) { blockAccount("viewerApp"); return; }
  applyViewerMode(isViewer());
  document.body.classList.toggle("userMode", isUserMode());
  refreshMarketAccess();
  companyLoadLocal();   // company details for the reports (Get Started > Company details)
  if (!isViewer()) setTimeout(() => { companyLoadCloud(); erpConfigLoad(); waFmtLoad(); }, 1500);
  if (isUserMode()) {
    if (typeof closeKashvi === "function") closeKashvi();
    const em = accountEmail(account);
    accessCheck(em).then(ok => { if (!ok && account && accountEmail(account) === em) blockAccount("revoked"); }).catch(() => {});   // taken back?
    setTimeout(() => { if (typeof fmtFirstRunOffer === "function") fmtFirstRunOffer(); }, 4000);
  }
  if (!isUserMode()) {   // refresh role + owner lists from the private server: later, and at most every 6 hours, so start-up stays fast
    try {
      const rk = "roleCheckedAt:" + accountEmail(account);
      if (Date.now() - (+localStorage.getItem(rk) || 0) > 6 * 3600 * 1000) {
        const acc0 = account;
        setTimeout(() => { accessWho(acc0).then(() => { try { localStorage.setItem(rk, String(Date.now())); } catch (e) {} }).catch(() => {}); }, 8000);
      }
    } catch (e) {}
  }
  if (isViewer()) { teamLoad(); getToken().catch(e => { const st = document.getElementById("status"); if (st) { st.className = "err"; st.textContent = e.message; } }); }
  else setTimeout(() => loadSignature(), 0);
  setTimeout(() => waCloudPull(), 0);   // WhatsApp Inbox status from OneDrive (same on every device)
  document.getElementById("signedOutMsg").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("signInBtn").classList.add("hidden");
  document.getElementById("signOutBtn").classList.remove("hidden");
  document.getElementById("navDrawerSignOut").classList.remove("hidden");
  if (account.homeAccountId) localStorage.setItem("lastSignedInAccountId", account.homeAccountId);

  renderDaySticker();

  // Home screen banner shows a MIPPL-style greeting card: sky-scene
  // background (sun/clouds by day, moon/stars by night), an uploadable
  // profile photo, time-of-day greeting + name, and role.
  const banner = document.getElementById("quickInsightsBanner");
  const savedPhoto = localStorage.getItem("customProfilePhoto");
  const headerImgSrc = savedPhoto || "img/0d420fa9e375.svg";   // no photo of his own yet: a plain avatar
  const escH = t => String(t).replace(/[&<>"']/g, ch => "&#" + ch.charCodeAt(0) + ";");
  const gName = (isViewer() || isUserMode()) ? escH(String(account.name || accountEmail(account).split("@")[0]).toUpperCase()) : "DURGESH MISHRA";
  const gRole = isViewer() ? "👁️ Team · View only" : isUserMode() ? escH(accountEmail(account)) : "Manager, QAD-SMS";
  if (isViewer() || isUserMode()) { const dn = document.getElementById("navDrawerName"); if (dn) dn.textContent = String(account.name || accountEmail(account)).toUpperCase(); }
  banner.innerHTML =
    '<div class="greetingCardInner">' +
      '<div class="greetingSkyBg">' + getGreetingIconSVG("") + '</div>' +
      '<div class="greetingSkyTall">' + greetingTallSkySVG() + '</div>' +
      '<img class="greetingAvatar" id="greetingAvatar" src="' + headerImgSrc + '" alt="Durgesh Mishra" title="Tap to change photo">' +
      '<input type="file" id="greetingAvatarInput" accept="image/*" class="hidden">' +
      '<div class="greetingTextWrap">' +
        '<div class="greetingHello">' + getGreeting() + '</div>' +
        '<div class="greetingName">' + gName + '</div>' +
        '<div class="greetingRole">' + gRole + '</div>' +
      '</div>' +
      greetingLineSVG() +
    '</div>';
  banner.classList.remove("hidden");
  // Tap the avatar to pick and store a personal photo (kept locally on this
  // device); it also updates the hamburger drawer's avatar to match.
  const greetingAvatarEl = document.getElementById("greetingAvatar");
  const greetingAvatarInput = document.getElementById("greetingAvatarInput");
  if (greetingAvatarEl && greetingAvatarInput) {
    greetingAvatarEl.addEventListener("click", () => greetingAvatarInput.click());
    greetingAvatarInput.addEventListener("change", () => {
      const file = greetingAvatarInput.files && greetingAvatarInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        localStorage.setItem("customProfilePhoto", dataUrl);
        greetingAvatarEl.src = dataUrl;
        const drawerAvatar = document.getElementById("navDrawerAvatar");
        if (drawerAvatar) drawerAvatar.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  checkTodayOutOfSpec(); // background, non-blocking - lights up the red dot if needed
  loadHomeMonthProd();   // only when the "Cards" icon style is on
  setTimeout(maybeShowChangelog, 800); // slight delay so it doesn't collide with the sign-in transition
  // ISO 9001 pack: no automatic reminder (popup / notification) - turned off on request; prepare it from ISO 9001 → Monthly ISO Pack
}

/* ===================== QUICK INSIGHTS (home screen banner) ===================== */
// Sums Total Production (AB column) directly from the Prod. sheet's daily
// entries - more reliable than FC Report's summary figure, which is a
// separate cell that doesn't always recalculate immediately after a new
// day's entry is made.
async function getMonthProductionFromProdSheet(wb, token, noSession) {
  try {
    const data = await graphFetch(`${wb}/worksheets('Prod.')/range(address='A1:AB2000')?$select=values`, token, noSession ? { noSession: true } : {});
    let total = 0;
    data.values.forEach(row => {
      if (row[1] && typeof row[27] === "number") total += row[27]; // AB = Total Prod, per heat row
    });
    return total;
  } catch (e) {
    return 0;
  }
}

/* ===================== STATUS INDICATOR (Out of Spec red dot) ===================== */
async function checkTodayOutOfSpec() {
  try {
    const token = await getToken();
    const today = todayISO();
    const { flaggedHeats } = await scanOutOfSpecHeats("Prod.", today, today, null, token, { noSession: true });
    document.getElementById("outOfSpecDot").classList.toggle("hidden", flaggedHeats.length === 0);
    window._homeLive = Object.assign(window._homeLive || {}, { offSpec: flaggedHeats.length });
    updateNavSubs();

    // Only notify once per day for this, even if the app is reopened
    // several times - avoids spamming the same alert repeatedly.
    if (flaggedHeats.length > 0 && localStorage.getItem("lastOutOfSpecNotifiedDate") !== today) {
      addNotification(`${flaggedHeats.length} heat(s) out of spec today`, "⚠️");
      localStorage.setItem("lastOutOfSpecNotifiedDate", today);
    }
  } catch (e) {
    // Non-critical - dot just stays hidden if this fails for any reason.
  }
}
/* ===================== INWARD QC (Lumps/Pellets/Fines) ===================== */
// Rewritten from scratch (previous version kept mis-locating columns) to
// find every needed column by matching its header text in Table1's own
// header row, instead of assuming a fixed position - this is the part that
// kept going wrong before.
const INWARD_RM_FILE_PATH = "Desktop/Inward Raw Material Data.xlsx";

function normalizeColName(s) {
  return (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Logical field name -> normalized header text to look for.
const INWARD_RM_COLS = {
  partyName: "partyname",
  itemName: "itemname",
  grnDate: "grndate",
  vehicleNo: "vehicleno",
  reachedQty: "reachedqty",
  plus150: "150mm",
  plus20: "20mm",
  minus1: "1mm",
  minus25: "25mm",
  minus4: "4mm",
  c: "c",
  fem: "fem",
  mn: "mn",
  nmag: "nmag",
  p: "p",
  s: "s",
  si: "si",
  minLimit: "minlimit"
};

// Reads "Inward Raw Material Data.xlsx"'s Table1 (wherever it actually
// lives - resolved via the Table object itself, not a fixed worksheet
// name), and finds every needed column by matching its header text. If a
// column can't be found by name, `col[field]` is -1 so the caller can
// report a clear error instead of silently reading the wrong cell.
// Reads "Inward Raw Material Data.xlsx"'s "Sheet1" tab - the file has two
// tabs, "Table1" (an old/stale example table) and "Sheet1" (where the real
// daily data is actually entered) - and finds every needed column by
// matching its header text. If a column can't be found by name, `col[field]`
// is -1 so the caller can report a clear error instead of silently reading
// the wrong cell.
// Reads "Inward Raw Material Data.xlsx"'s "Table1" tab - the file has two
// worksheet tabs, "Table1" (where the real daily data is entered - this is
// a literal worksheet tab name, not an Excel structured-Table object) and
// "Sheet1" (an old/unrelated layout) - and finds every needed column by
// matching its header text. If a column can't be found by name, `col[field]`
// is -1 so the caller can report a clear error instead of silently reading
// the wrong cell.
async function readInwardRmTable1(token) {
  const wb = await resolveWorkbook(token, INWARD_RM_FILE_PATH);
  const data = await graphFetch(
    `${wb}/worksheets('Table1')/range(address='A1:Z6000')?$select=values,text`,
    token
  );
  const mapHeader = (r) => {
    const h = (r || []).map(normalizeColName);
    const m = {};
    for (const key in INWARD_RM_COLS) m[key] = h.indexOf(INWARD_RM_COLS[key]);
    return m;
  };
  const isHeaderRow = (r) => {
    const h = (r || []).map(normalizeColName);
    return h.includes("partyname") && h.includes("itemname");
  };
  const col = mapHeader(data.values[0]);
  // Columns are found by their header TEXT, not by position. If a header
  // row is repeated further down (e.g. a new block pasted with its own
  // headers, possibly with an extra/moved column), every row below it is
  // read using THAT header - so "Mn" is always read from the Mn column.
  const rowCol = [];
  const headerRows = [0];
  let active = col;
  for (let i = 0; i < data.values.length; i++) {
    if (i > 0 && isHeaderRow(data.values[i])) {
      active = mapHeader(data.values[i]);
      headerRows.push(i);
    }
    rowCol[i] = active;
  }
  const isHeader = (i) => headerRows.includes(i);
  return { data, col, rowCol, isHeader };
}

// Rows whose key test value (Mn% for Silico Manganese, Fe(M)% for Fines /
// Lumps) is blank or 0 usually mean the row's data sits under the wrong
// headers (shifted columns) - collect them so the report can warn.
function inwardRmSuspectRow(bucketKey, row, c) {
  const v = row[bucketKey === "SILICO MANGANES" ? c.mn : c.fem];
  const n = typeof v === "number" ? v : parseFloat(v);
  return !(n > 0);
}

function inwardRmMissingColsError(col) {
  const missing = Object.keys(col).filter(k => col[k] === -1);
  if (!missing.length) return null;
  return `Couldn't find these columns in Table1's header row: ${missing.join(", ")}. Check the exact column headers in the Excel file.`;
}

// GRN Date is normally a real Excel date serial number. Falls back to
// parsing "M/D/YYYY" text (US-style month/day/year - confirmed from real
// data, e.g. "4/22/2024") if the cell was entered as plain text instead.
function inwardRmDateToISO(value, textValue) {
  if (typeof value === "number") return excelSerialToISODate(value);
  const s = (textValue !== undefined ? textValue : value || "").toString().trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const month = parseInt(m[1], 10), day = parseInt(m[2], 10), year = parseInt(m[3], 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (m) {
    const day = parseInt(m[1], 10), month = parseInt(m[2], 10), year = parseInt(m[3], 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

// Item Name is matched by keyword rather than an exact string, because the
// actual text in Excel isn't always the same length (e.g. "SILICO
// MANGANES" instead of the full "SILICO MANGANESE").
function classifyInwardItem(name) {
  const n = (name || "").toString().trim().toUpperCase();
  if (n.includes("MANGAN")) return "SILICO MANGANES";
  if (n.includes("FIN")) return "SPONGE IRON FIN";
  if (n.includes("LUMP") || n.includes("LUM")) return "SPONGE IRON LUM";
  return null;
}

// PO (Purchase Order) spec targets. Only Mn% (Silico Manganese) and Fe(M)%
// (Fines/Lumps) vary and are entered directly in Excel's "Min Limit"
// column - everything else stays fixed here.
const SILICO_PO = { sizeRange: "25 mm to 150 mm", overSize: 10, underSize: 10, mn: 60, si: 14, c: 3, p: 0.35, s: 0.03 };
const LUMPS_PO = { sizeRange: "4 mm to 20 mm", overSize: 10, underSize: 10, fem: 79, p: 0.11, s: 0.05, nmag: 1 };
const FINES_PO = { sizeRange: "1 mm to 4 mm", underSize: 50, p: 0.075, s: 0.1, nmag: 1 };

document.getElementById("inwardQcPdfBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const fromVal = document.getElementById("inwardQcFromMonth").value; // "YYYY-MM"
  const toVal = document.getElementById("inwardQcToMonth").value;
  if (!fromVal || !toVal) { alert("Please select both From Month and To Month."); return; }
  statusEl.className = "wait";
  statusEl.textContent = "Reading Inward Raw Material data...";
  try {
    const token = await getToken();
    const fromDate = `${fromVal}-01`;
    const [ty, tm] = toVal.split("-").map(Number);
    const toDate = `${toVal}-${String(new Date(ty, tm, 0).getDate()).padStart(2, "0")}`;

    const { data, col: col0, rowCol, isHeader } = await readInwardRmTable1(token);
    const colErr = inwardRmMissingColsError(col0);
    if (colErr) { statusEl.className = "err"; statusEl.textContent = colErr; return; }

    const buckets = { "SPONGE IRON LUM": [], "SPONGE IRON FIN": [], "SILICO MANGANES": [] };
    const suspects = [];
    const num = (v) => typeof v === "number" ? v : (parseFloat(v) || null);
    for (let i = 1; i < data.values.length; i++) { // skip header row
      if (isHeader(i)) continue; // a repeated header row further down
      const row = data.values[i];
      const rowText = data.text[i];
      const col = rowCol[i];
      const bucketKey = classifyInwardItem(row[col.itemName]);
      if (!bucketKey) continue; // not one of the 3 materials we care about
      const iso = inwardRmDateToISO(row[col.grnDate], rowText[col.grnDate]);
      if (!iso || iso < fromDate || iso > toDate) continue;
      if (inwardRmSuspectRow(bucketKey, row, col)) suspects.push(`Excel row ${i + 1} (${rowText[col.grnDate] || ""}, ${row[col.vehicleNo] || ""})`);
      buckets[bucketKey].push({
        plus150: num(row[col.plus150]),
        plus20: num(row[col.plus20]),
        minus1: num(row[col.minus1]),
        minus25: num(row[col.minus25]),
        minus4: num(row[col.minus4]),
        c: num(row[col.c]),
        fem: num(row[col.fem]),
        mn: num(row[col.mn]),
        nmag: num(row[col.nmag]),
        p: num(row[col.p]),
        s: num(row[col.s]),
        si: num(row[col.si]),
        minLimit: num(row[col.minLimit]) // the PO target entered directly in Excel - may be blank
      });
    }
    // Average only the cells that actually have a value. A blank cell
    // (sample not tested / not entered yet) must NOT count as 0 - that
    // pulled the averages down (same as Excel's AVERAGE, which skips blanks).
    const avg = (list, key) => {
      const vals = list.map(r => r[key]).filter(v => v !== null && v !== undefined && !isNaN(v));
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    };
    const fmtVal = (v) => v === null ? "" : v.toFixed(3);

    const siList = buckets["SILICO MANGANES"], lumList = buckets["SPONGE IRON LUM"];

    // Fines: automatically split into one group per distinct Min Limit
    // (Fe(M)% PO target) actually present in the selected month/date range -
    // e.g. if 70, 72, 73 and 74 all appear, that's 4 columns; if only 2
    // distinct values appear, that's 2. Values are rounded to 2 decimals
    // only to collapse floating-point noise from Excel, not to merge
    // genuinely different specs together.
    const finRecords = buckets["SPONGE IRON FIN"];
    const roundLimit = (v) => Math.round(v * 100) / 100;
    const distinctFinLimits = Array.from(new Set(finRecords.filter(r => r.minLimit !== null).map(r => roundLimit(r.minLimit)))).sort((a, b) => b - a);
    const finGroups = distinctFinLimits.length ? distinctFinLimits : [null];
    const finBuckets = finGroups.map(limit => ({
      limit,
      records: limit === null ? finRecords : finRecords.filter(r => r.minLimit !== null && roundLimit(r.minLimit) === limit)
    }));

    const NAVY = [31, 56, 100], GOLD = [201, 162, 39];
    const rangeLabel = fromVal === toVal ? `${MONTH_ABBR[Number(fromVal.split("-")[1]) - 1]} ${fromVal.split("-")[0]}` : `${fromDate.split("-").reverse().join("-")} to ${toDate.split("-").reverse().join("-")}`;

    const blankFin = () => finBuckets.flatMap(() => ["", ""]);

    const headers = ["Test", "UOM", "Silico Manganese", "", ...finBuckets.flatMap((g, i) => [finBuckets.length > 1 ? `SI Fines - Type ${i + 1}` : "SI Fines", ""]), "SI Lumps", ""];
    const subHeaders = ["", "", "PO", "Actual", ...finBuckets.flatMap(() => ["PO", "Actual"]), "PO", "Actual"];

    const specRows = [
      ["Size Range", "MM", SILICO_PO.sizeRange, "", ...finBuckets.flatMap(() => [FINES_PO.sizeRange, ""]), LUMPS_PO.sizeRange, ""],
      ["Over Size", "%", SILICO_PO.overSize, fmtVal(avg(siList, "plus150")), ...blankFin(), LUMPS_PO.overSize, fmtVal(avg(lumList, "plus20"))],
      ["Under Size", "%", SILICO_PO.underSize, fmtVal(avg(siList, "minus25")), ...finBuckets.flatMap(g => [FINES_PO.underSize, fmtVal(avg(g.records, "minus1"))]), LUMPS_PO.underSize, fmtVal(avg(lumList, "minus4"))],
      ["Moisture", "%", "", "", ...blankFin(), "", ""],
      ["Mn", "%", SILICO_PO.mn, fmtVal(avg(siList, "mn")), ...blankFin(), "", ""],
      ["Si", "%", SILICO_PO.si, fmtVal(avg(siList, "si")), ...blankFin(), "", ""],
      ["C", "%", SILICO_PO.c, fmtVal(avg(siList, "c")), ...blankFin(), "", ""],
      ["P", "%", SILICO_PO.p, fmtVal(avg(siList, "p")), ...finBuckets.flatMap(g => [FINES_PO.p, fmtVal(avg(g.records, "p"))]), LUMPS_PO.p, fmtVal(avg(lumList, "p"))],
      ["S", "%", SILICO_PO.s, fmtVal(avg(siList, "s")), ...finBuckets.flatMap(g => [FINES_PO.s, fmtVal(avg(g.records, "s"))]), LUMPS_PO.s, fmtVal(avg(lumList, "s"))],
      ["Fe(M)", "%", "", "", ...finBuckets.flatMap(g => [g.limit !== null ? g.limit : "", fmtVal(avg(g.records, "fem"))]), LUMPS_PO.fem, fmtVal(avg(lumList, "fem"))],
      ["N.Mag", "%", "", "", ...finBuckets.flatMap(g => [FINES_PO.nmag, fmtVal(avg(g.records, "nmag"))]), LUMPS_PO.nmag, fmtVal(avg(lumList, "nmag"))]
    ];

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    addLogoHeader(doc);
    const pageW = doc.internal.pageSize.getWidth();

    // White header band so the company logo stays visible (navy hid it)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(3);
    doc.line(0, 60, pageW, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(31, 56, 100);
    doc.text("Inward Raw Material - PO vs Actual", pageW / 2, 28, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(150, 118, 20);
    doc.text(rangeLabel, pageW / 2, 46, { align: "center" });

    doc.autoTable({
      startY: 72,
      head: [headers, subHeaders],
      body: specRows,
      styles: { fontSize: 8.5, cellPadding: 4, halign: "center" },
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 8.5 },
      alternateRowStyles: { fillColor: [244, 248, 253] },
      columnStyles: { 0: { halign: "left" }, 1: { halign: "left" } },
      theme: "grid",
      margin: { left: 30, right: 30 }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      addLogoHeader(doc);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`SMS/QAD${COMPANY.name ? " - " + COMPANY.name : ""}  |  Page ${p} of ${pageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });
    }

    doc.save(`Inward_RM_PO_vs_Actual_${rangeLabel.replace(/\s+/g, "_")}.pdf`);
    statusEl.className = "ok";
    statusEl.textContent = `PO vs Actual report ready for ${rangeLabel}.`;
    if (suspects.length) {
      statusEl.className = "err";
      statusEl.textContent += `\n\n⚠️ ${suspects.length} row(s) have Mn% / Fe(M)% blank or 0 - their values may be under the wrong column headers in Excel. Please check:\n` +
        suspects.slice(0, 15).join("\n") + (suspects.length > 15 ? `\n...and ${suspects.length - 15} more` : "");
    }
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
});

document.getElementById("inwardRmRawPdfBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const fromVal = document.getElementById("inwardQcFromMonth").value; // "YYYY-MM"
  const toVal = document.getElementById("inwardQcToMonth").value;
  if (!fromVal || !toVal) { alert("Please select both From Month and To Month."); return; }
  statusEl.className = "wait";
  statusEl.textContent = "Reading raw Inward Raw Material data...";
  try {
    const token = await getToken();
    const fromDate = `${fromVal}-01`;
    const [ty, tm] = toVal.split("-").map(Number);
    const toDate = `${toVal}-${String(new Date(ty, tm, 0).getDate()).padStart(2, "0")}`;

    const { data, col: col0, rowCol, isHeader } = await readInwardRmTable1(token);
    const colErr = inwardRmMissingColsError(col0);
    if (colErr) { statusEl.className = "err"; statusEl.textContent = colErr; return; }

    const materials = [
      { key: "SPONGE IRON LUM", label: "SI Lumps" },
      { key: "SPONGE IRON FIN", label: "SI Fines" },
      { key: "SILICO MANGANES", label: "Silico Manganese" }
    ];
    const NAVY = [31, 56, 100], GOLD = [201, 162, 39];
    const rangeLabel = fromVal === toVal ? `${MONTH_ABBR[Number(fromVal.split("-")[1]) - 1]} ${fromVal.split("-")[0]}` : `${fromDate.split("-").reverse().join("-")} to ${toDate.split("-").reverse().join("-")}`;

    // Column order shown in the PDF (logical field name -> display header).
    const displayCols = [
      ["partyName", "Party Name"],
      ["itemName", "Item Name"],
      ["grnDate", "GRN Date"],
      ["minLimit", "MIN Limit"],
      ["vehicleNo", "Vehicle NO"],
      ["reachedQty", "Reached Qty"],
      ["plus150", "+150mm"],
      ["plus20", "+20MM%"],
      ["minus1", "-1MM%"],
      ["minus25", "-25mm"],
      ["minus4", "-4MM%"],
      ["c", "C%"],
      ["fem", "Fe(M)%"],
      ["mn", "Mn%"],
      ["nmag", "N.Mag%"],
      ["p", "P%"],
      ["s", "S%"],
      ["si", "Si"]
    ];

    let totalDownloaded = 0;
    for (const mat of materials) {
      const rows = [];
      for (let i = 1; i < data.values.length; i++) {
        if (isHeader(i)) continue;
        const row = data.values[i];
        const rowText = data.text[i];
        const col = rowCol[i];
        if (classifyInwardItem(row[col.itemName]) !== mat.key) continue;
        const iso = inwardRmDateToISO(row[col.grnDate], rowText[col.grnDate]);
        if (!iso || iso < fromDate || iso > toDate) continue;
        rows.push(displayCols.map(([field]) => {
          const idx = col[field];
          const v = row[idx];
          if (v === null || v === undefined || v === "") return "";
          if (field === "grnDate") return rowText[idx] || v; // GRN Date - show as entered
          return typeof v === "number" ? v.toFixed(3) : v.toString();
        }));
      }

      const headers = displayCols.map(([, label]) => label);

      // Drop columns that are blank/zero for every record of this material
      // (e.g. Fe(M)% for Silico Manganese, or Mn% for Lumps and Fines) -
      // the first 3 identifying columns (Party Name, Item Name, GRN Date)
      // always stay. Skipped entirely when there are no records, so the
      // "No records" placeholder still shows the full column set.
      const keepCol = headers.map((_, colPos) => {
        if (colPos < 3 || rows.length === 0) return true;
        return rows.some(r => {
          const cell = (r[colPos] || "").toString().trim();
          if (cell === "") return false;
          const n = Number(cell);
          return isNaN(n) || n !== 0;
        });
      });
      const matHeaders = headers.filter((_, i) => keepCol[i]);
      const matRows = rows.map(r => r.filter((_, i) => keepCol[i]));

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      addLogoHeader(doc);
      const pageW = doc.internal.pageSize.getWidth();

      // White header band so the company logo stays visible (navy hid it)
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(3);
      doc.line(0, 60, pageW, 60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(31, 56, 100);
      doc.text(`${mat.label} - Raw Data`, pageW / 2, 28, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(150, 118, 20);
      doc.text(rangeLabel, pageW / 2, 46, { align: "center" });

      doc.autoTable({
        startY: 72,
        head: [matHeaders],
        body: matRows.length ? matRows : [["No records", ...Array(matHeaders.length - 1).fill("")]],
        styles: { fontSize: 6, cellPadding: 2.5, halign: "center" },
        headStyles: { fillColor: NAVY, textColor: 255, fontSize: 6 },
        alternateRowStyles: { fillColor: [244, 248, 253] },
        columnStyles: { 0: { halign: "left" }, 1: { halign: "left" } },
        theme: "grid",
        margin: { left: 18, right: 18 }
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        addLogoHeader(doc);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(`SMS/QAD${COMPANY.name ? " - " + COMPANY.name : ""}  |  Page ${p} of ${pageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });
      }

      doc.save(`${mat.label.replace(/\s+/g, "_")}_Raw_Data_${rangeLabel.replace(/\s+/g, "_")}.pdf`);
      totalDownloaded += rows.length;
    }

    statusEl.className = "ok";
    statusEl.textContent = `3 raw-data PDFs downloaded for ${rangeLabel} (${totalDownloaded} total record(s)).`;
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
});

/* ===================== SI Mn Reports → Monthly weighted average (Lumps / Fines / Silico Manganese) ===================== */
// Same data as the Quarter report (Inward Raw Material Data.xlsx → Table1). For each month:
// total weight = sum of Reached Qty of every vehicle; average of a test = sum(weight x result) / sum(weight)
// over the vehicles that have that result (a blank result is left out, it is not taken as 0).
const SIMN_ITEMS = {
  "SPONGE IRON LUM": { label: "SI Lumps", tests: [["plus20", "+20 mm %"], ["minus4", "-4 mm %"], ["fem", "Fe(M) %"], ["p", "P %"], ["s", "S %"], ["nmag", "N.Mag %"], ["c", "C %"]] },
  "SPONGE IRON FIN": { label: "SI Fines", tests: [["minus1", "-1 mm %"], ["fem", "Fe(M) %"], ["p", "P %"], ["s", "S %"], ["nmag", "N.Mag %"], ["c", "C %"]] },
  "SILICO MANGANES": { label: "Silico Manganese", tests: [["plus150", "+150 mm %"], ["minus25", "-25 mm %"], ["mn", "Mn %"], ["si", "Si %"], ["c", "C %"], ["p", "P %"], ["s", "S %"]] }
};
(function simnModule() {
  const $ = id => document.getElementById(id);
  if (!$("simnSubNav")) return;
  // inner tiles
  document.querySelectorAll("#simnSubNav .navItem").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".simnPanel").forEach(p => p.classList.add("hidden"));
    $("simn-" + b.dataset.simn).classList.remove("hidden");
    $("simnSubNav").classList.add("hidden"); $("simnContent").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });
  }));
  $("simnBackBtn").addEventListener("click", () => { $("simnContent").classList.add("hidden"); $("simnSubNav").classList.remove("hidden"); window.scrollTo({ top: 0, behavior: "instant" }); });
  document.querySelectorAll('#reportsSubNav .navItem[data-subreport="simn"]').forEach(b => b.addEventListener("click", () => { $("simnContent").classList.add("hidden"); $("simnSubNav").classList.remove("hidden"); }));
  // default months: this FY so far
  (() => { const d = new Date(), y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!$("simnFromMonth").value) $("simnFromMonth").value = `${y}-04`; if (!$("simnToMonth").value) $("simnToMonth").value = m; })();

  let last = null;
  async function build() {
    const st = $("status"), key = $("simnItem").value, item = SIMN_ITEMS[key];
    const fromVal = $("simnFromMonth").value, toVal = $("simnToMonth").value;
    if (!fromVal || !toVal) { alert("Please select both From Month and To Month."); return null; }
    if (fromVal > toVal) { alert("From Month is after To Month."); return null; }
    st.className = "wait"; st.textContent = "Reading Inward Raw Material data...";
    const token = await getToken();
    const fromDate = `${fromVal}-01`, [ty, tm] = toVal.split("-").map(Number);
    const toDate = `${toVal}-${String(new Date(ty, tm, 0).getDate()).padStart(2, "0")}`;
    const { data, col: col0, rowCol, isHeader } = await readInwardRmTable1(token);
    const colErr = inwardRmMissingColsError(col0); if (colErr) throw new Error(colErr);
    const num = v => typeof v === "number" ? v : (v === null || v === undefined || String(v).trim() === "" ? null : (isFinite(+v) ? +v : null));
    const months = new Map(), noWt = [];
    // every month of the range, so a month with no vehicles still shows
    for (let d = new Date(+fromVal.slice(0, 4), +fromVal.slice(5) - 1, 1); ; d.setMonth(d.getMonth() + 1)) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; if (k > toVal) break;
      months.set(k, { n: 0, wt: 0, sw: {}, swv: {}, cnt: {} });
    }
    for (let i = 1; i < data.values.length; i++) {
      if (isHeader(i)) continue;
      const row = data.values[i], txt = data.text[i], c = rowCol[i];
      if (classifyInwardItem(row[c.itemName]) !== key) continue;
      const iso = inwardRmDateToISO(row[c.grnDate], txt[c.grnDate]);
      if (!iso || iso < fromDate || iso > toDate) continue;
      const m = months.get(iso.slice(0, 7)); if (!m) continue;
      const w = num(row[c.reachedQty]);
      m.n++;
      if (!(w > 0)) { noWt.push(`Excel row ${i + 1} (${txt[c.grnDate] || ""}, ${row[c.vehicleNo] || ""})`); continue; }
      m.wt += w;
      item.tests.forEach(([f]) => { const v = num(row[c[f]]); if (v === null) return; m.sw[f] = (m.sw[f] || 0) + w; m.swv[f] = (m.swv[f] || 0) + w * v; m.cnt[f] = (m.cnt[f] || 0) + 1; });
    }
    // whole range = same formula over all vehicles
    const tot = { n: 0, wt: 0, sw: {}, swv: {}, cnt: {} };
    months.forEach(m => { tot.n += m.n; tot.wt += m.wt; item.tests.forEach(([f]) => { if (m.sw[f]) { tot.sw[f] = (tot.sw[f] || 0) + m.sw[f]; tot.swv[f] = (tot.swv[f] || 0) + m.swv[f]; tot.cnt[f] = (tot.cnt[f] || 0) + m.cnt[f]; } }); });
    // drop tests with no result at all in the range
    const tests = item.tests.filter(([f]) => tot.sw[f] > 0);
    const avg = (m, f) => m.sw[f] > 0 ? m.swv[f] / m.sw[f] : null;
    const label = k => `${MONTH_ABBR[+k.slice(5) - 1]} ${k.slice(0, 4)}`;
    const rangeLabel = fromVal === toVal ? label(fromVal) : `${label(fromVal)} to ${label(toVal)}`;
    last = { key, item, tests, months, tot, avg, label, rangeLabel, noWt, fromVal, toVal };
    st.className = noWt.length ? "err" : "ok";
    st.textContent = `${item.label}: ${tot.n} vehicle(s), ${tot.wt.toFixed(3)} MT, ${rangeLabel}.` +
      (noWt.length ? `\n⚠️ ${noWt.length} vehicle(s) have no Reached Qty, so they are not in the weight or the averages:\n` + noWt.slice(0, 15).join("\n") + (noWt.length > 15 ? `\n...and ${noWt.length - 15} more` : "") : "");
    return last;
  }
  const f3 = v => v === null || v === undefined ? "" : v.toFixed(3);
  function rowsOf(r) {
    const out = [];
    r.months.forEach((m, k) => out.push([r.label(k), m.n, f3(m.wt), ...r.tests.map(([f]) => f3(r.avg(m, f)))]));
    out.push([r.fromVal === r.toVal ? "Total" : "Total / weighted avg", r.tot.n, f3(r.tot.wt), ...r.tests.map(([f]) => f3(r.avg(r.tot, f)))]);
    return out;
  }
  $("simnPdfBtn").addEventListener("click", async () => {
    const st = $("status");
    try {
      const r = await build(); if (!r) return;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: r.tests.length > 6 ? "landscape" : "portrait", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth(), NAVY = [31, 56, 100], GOLD = [201, 162, 39];
      addLogoHeader(doc);
      doc.setDrawColor(...GOLD); doc.setLineWidth(3); doc.line(0, 60, pageW, 60);
      doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...NAVY);
      doc.text(`${r.item.label} - Monthly Weight & Average`, pageW / 2, 28, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(150, 118, 20);
      doc.text(r.rangeLabel, pageW / 2, 46, { align: "center" });
      const body = rowsOf(r);
      doc.autoTable({
        startY: 72, head: [["Month", "Vehicles", "Total weight (MT)", ...r.tests.map(([, l]) => l)]], body,
        styles: { fontSize: 9, cellPadding: 5, halign: "center" }, headStyles: { fillColor: NAVY, textColor: 255, fontSize: 9 },
        alternateRowStyles: { fillColor: [244, 248, 253] }, columnStyles: { 0: { halign: "left", fontStyle: "bold" } }, theme: "grid", margin: { left: 30, right: 30 },
        didParseCell: d => { if (d.section === "body" && d.row.index === body.length - 1) { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [248, 241, 218]; } }
      });
      let y = doc.lastAutoTable.finalY + 16;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
      doc.splitTextToSize("Average = sum of (vehicle weight x result) / sum of weight of the vehicles that have that result. Total weight = Reached Qty of all vehicles in the month. Source: Inward Raw Material Data.xlsx (Table1).", pageW - 60).forEach(l => { doc.text(l, 30, y); y += 11; });
      const n = doc.internal.getNumberOfPages();
      for (let p = 1; p <= n; p++) { doc.setPage(p); addLogoHeader(doc); doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(140, 140, 140);
        doc.text(`SMS/QAD${COMPANY.name ? " - " + COMPANY.name : ""}  |  Page ${p} of ${n}`, pageW / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" }); }
      doc.save(`${r.item.label.replace(/\s+/g, "_")}_Monthly_Avg_${r.rangeLabel.replace(/\s+/g, "_")}.pdf`);
    } catch (e) { st.className = "err"; st.textContent = "Error: " + e.message; }
  });
  $("simnXlsxBtn").addEventListener("click", async () => {
    const st = $("status");
    try {
      const r = await build(); if (!r) return;
      const aoa = [[`${r.item.label} - Monthly Weight & Average (${r.rangeLabel})`], [], ["Month", "Vehicles", "Total weight (MT)", ...r.tests.map(([, l]) => l)]]
        .concat(rowsOf(r).map(row => row.map((v, i) => i === 0 ? v : (v === "" ? "" : +v))), [[], ["Average = sum of (vehicle weight x result) / sum of weight of the vehicles that have that result."]]);
      const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = [{ wch: 20 }, { wch: 9 }, { wch: 16 }, ...r.tests.map(() => ({ wch: 11 }))];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, r.item.label.slice(0, 31));
      XLSX.writeFile(wb, `${r.item.label.replace(/\s+/g, "_")}_Monthly_Avg_${r.rangeLabel.replace(/\s+/g, "_")}.xlsx`);
    } catch (e) { st.className = "err"; st.textContent = "Error: " + e.message; }
  });
  window._simnTest = { build, rowsOf };
})();

/* ===================== SMART SUMMARY (plain-language monthly recap) ===================== */
async function getMissedDaysInMonth(token, year, month0) {
  const path = await detectFilePathForMonth(token, year, month0);
  if (!path) return null; // whole file missing - can't tell
  const wb = await resolveWorkbook(token, path);
  const data = await graphFetch(`${wb}/worksheets('Prod.')/range(address='A1:A2000')?$select=values`, token);
  const foundDates = new Set();
  data.values.forEach(row => {
    if (typeof row[0] === "number") foundDates.add(excelSerialToISODate(row[0]));
  });
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month0;
  const lastDayToCheck = isCurrentMonth ? now.getDate() : daysInMonth;
  let missed = 0;
  for (let d = 1; d <= lastDayToCheck; d++) {
    const iso = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (!foundDates.has(iso)) missed++;
  }
  return missed;
}

document.getElementById("smartSummaryBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const monthVal = document.getElementById("smartSummaryMonth").value; // "YYYY-MM"
  if (!monthVal) { alert("Please select a month first."); return; }
  statusEl.className = "wait";
  statusEl.textContent = "Putting the summary together...";
  document.getElementById("smartSummaryWrap").classList.add("hidden");
  try {
    const token = await getToken();
    const [y, m] = monthVal.split("-").map(Number);
    const thisMonth0 = m - 1;
    const thisLabel = `${MONTH_ABBR[thisMonth0]} ${y}`;

    const thisPath = await detectFilePathForMonth(token, y, thisMonth0);
    if (!thisPath) { statusEl.className = "err"; statusEl.textContent = `Couldn't find a file for ${thisLabel}.`; return; }
    const thisWb = await resolveWorkbook(token, thisPath);
    const thisTotal = await getMonthProductionFromProdSheet(thisWb, token);

    let prevY = y, prevM0 = thisMonth0 - 1;
    if (prevM0 < 0) { prevM0 = 11; prevY = y - 1; }
    const prevLabel = `${MONTH_ABBR[prevM0]} ${prevY}`;
    const prevPath = await detectFilePathForMonth(token, prevY, prevM0);
    let prevTotal = null;
    if (prevPath) {
      const prevWb = await resolveWorkbook(token, prevPath);
      prevTotal = await getMonthProductionFromProdSheet(prevWb, token);
    }

    const missedDays = await getMissedDaysInMonth(token, y, thisMonth0);

    let text = `In ${thisLabel}, production totalled ${thisTotal ? thisTotal.toFixed(0) : "0"} MT`;
    if (prevTotal) {
      const pct = ((thisTotal - prevTotal) / prevTotal) * 100;
      const dir = pct >= 0 ? "up" : "down";
      text += `, ${dir} ${Math.abs(pct).toFixed(1)}% compared to ${prevLabel} (${prevTotal.toFixed(0)} MT)`;
    } else {
      text += ` (no comparable data found for ${prevLabel})`;
    }
    text += ". ";
    if (missedDays === null) {
      text += "Couldn't check for missed days this month.";
    } else if (missedDays === 0) {
      text += "Every day so far had an entry - no missed days. 👍";
    } else {
      text += `${missedDays} day(s) so far had no production entry recorded.`;
    }

    document.getElementById("smartSummaryText").textContent = text;
    document.getElementById("smartSummaryWrap").classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = "Summary ready.";
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
});

/* ===================== WHAT-IF SIMULATOR (rough raw-material mix estimator) ===================== */
// Yield% per material = its own Fe(M)% plus a fixed offset (Lumps/Fines:
// +2, Pellets: +1) - Fe(M)% for these three comes from this month's
// "Daily Prod Format" sheet (I3=Lumps, I2=Fines, I1=Pellets), starting as
// placeholder figures until "Load This Month's Fe(M)%" is pressed.
// Everything else uses a fixed yield% regardless of Fe(M)%.
let whatifFemPct = { lumps: 74, fines: 69.5, pellets: 80 };
const WHATIF_FIXED_YIELDS = {
  steelMeltingScrap: 0.93,
  magMaterial: 0.69,
  msScrapRM: 0.94,
  msScrap: 0.98,
  ciMixScrap: 0.90,
  pigIron: 0.94,
  overSizeMag: 0.70
};
let whatifYields = {
  lumps: (whatifFemPct.lumps + 2) / 100,
  fines: (whatifFemPct.fines + 2) / 100,
  pellets: (whatifFemPct.pellets + 1) / 100,
  ...WHATIF_FIXED_YIELDS
};

document.getElementById("whatifLoadYieldsBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  statusEl.className = "wait";
  statusEl.textContent = "Fetching this month's Fe(M)% from Daily Prod Format...";
  try {
    const token = await getToken();
    const now = new Date();
    const path = await detectFilePathForMonth(token, now.getFullYear(), now.getMonth());
    if (!path) { statusEl.className = "err"; statusEl.textContent = "Couldn't find this month's file."; return; }
    const wb = await resolveWorkbook(token, path);
    const data = await graphFetch(`${wb}/worksheets('Daily Prod Format')/range(address='I1:I3')?$select=values`, token);
    const [pelletsFem, finesFem, lumpsFem] = data.values.map(r => r[0]);

    if (typeof lumpsFem === "number") whatifFemPct.lumps = lumpsFem;
    if (typeof finesFem === "number") whatifFemPct.fines = finesFem;
    if (typeof pelletsFem === "number") whatifFemPct.pellets = pelletsFem;
    whatifYields = {
      lumps: (whatifFemPct.lumps + 2) / 100,
      fines: (whatifFemPct.fines + 2) / 100,
      pellets: (whatifFemPct.pellets + 1) / 100,
      ...WHATIF_FIXED_YIELDS
    };

    document.getElementById("whatifYieldSourceInfo").textContent =
      `Fe(M)% (Daily Prod Format): Lumps=${typeof lumpsFem === "number" ? lumpsFem.toFixed(2) : "not found"}%, ` +
      `Fines=${typeof finesFem === "number" ? finesFem.toFixed(2) : "not found"}%, ` +
      `Pellets=${typeof pelletsFem === "number" ? pelletsFem.toFixed(2) : "not found"}% - yields updated below.`;
    updateWhatifSimulator();
    statusEl.className = "ok";
    statusEl.textContent = "Yields updated from this month's Fe(M)% data.";
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
});

const WHATIF_MATERIALS = ["lumps", "fines", "pellets", "steelMeltingScrap", "magMaterial", "msScrapRM", "msScrap", "ciMixScrap", "pigIron", "overSizeMag"];
const WHATIF_ID = {
  lumps: "Lumps", fines: "Fines", pellets: "Pellets",
  steelMeltingScrap: "SteelMeltingScrap", magMaterial: "MagMaterial",
  msScrapRM: "MsScrapRM", msScrap: "MsScrap", ciMixScrap: "CiMixScrap",
  pigIron: "PigIron", overSizeMag: "OverSizeMag"
};

function updateWhatifSimulator() {
  const weights = {};
  WHATIF_MATERIALS.forEach(key => {
    weights[key] = parseFloat(document.getElementById(`whatif${WHATIF_ID[key]}Wt`).value) || 0;
  });
  const charge = WHATIF_MATERIALS.reduce((s, key) => s + weights[key], 0);

  document.getElementById("whatifChargeTotal").textContent = charge.toFixed(1);
  WHATIF_MATERIALS.forEach(key => {
    const pct = charge ? ((weights[key] / charge) * 100).toFixed(1) : "0.0";
    document.getElementById(`whatif${WHATIF_ID[key]}Pct`).textContent = `(${pct}%)`;
  });

  const output = WHATIF_MATERIALS.reduce((s, key) => s + weights[key] * whatifYields[key], 0);

  const femContributors = ["lumps", "fines", "pellets"]; // only these have a known Fe(M)%
  const weightedFem = charge ? (
    femContributors.reduce((s, key) => s + weights[key] * (whatifFemPct[key] / 100), 0) / charge
  ) : 0;

  document.getElementById("whatifYieldOut").textContent = charge ? ((output / charge) * 100).toFixed(1) + "%" : "-";
  document.getElementById("whatifOutputOut").textContent = output.toFixed(1) + " MT";
  document.getElementById("whatifFemOut").textContent = (weightedFem * 100).toFixed(1) + "%";
}
WHATIF_MATERIALS.forEach(key => {
  document.getElementById(`whatif${WHATIF_ID[key]}Wt`).addEventListener("input", updateWhatifSimulator);
});
updateWhatifSimulator();

/* ===================== ASK YOUR DATA (rule-based lookup, not a general chatbot) ===================== */
let _askChatTarget = "askDataChat"; // which chat box messages go to
// ---- Kashvi voice: replies are also spoken (browser's own text-to-speech,
// high pitch so it sounds like a little girl). 🔊 button in the chat header
// turns it on/off (remembered on this device). Works offline, no extra cost.
let _kvVoice = null;
function kvVoiceOn() { try { return localStorage.getItem("kashviVoice") !== "off"; } catch (e) { return true; } }
function kvSettings() {
  // natural Google voice: no pitch change (old "bachchi" settings are ignored)
  try { return Object.assign({ voice: "", pitch: 1.0, rate: 1.0 }, JSON.parse(localStorage.getItem("kashviVoiceCfg2") || "{}"), { pitch: 1.0 }); }
  catch (e) { return { voice: "", pitch: 1.0, rate: 1.0 }; }
}
function kvPickVoice() {
  if (!window.speechSynthesis) return null;
  const vs = speechSynthesis.getVoices() || [];
  const want = kvSettings().voice;
  if (want) { const v = vs.find(x => x.name === want); if (v) { _kvVoice = v; return v; } }
  const g = v => /google/i.test(v.name) || v.localService === false;
  _kvVoice = vs.find(v => /en[-_]IN/i.test(v.lang) && g(v)) || vs.find(v => /hi[-_]IN/i.test(v.lang) && g(v)) ||
    vs.find(v => /en[-_]IN/i.test(v.lang)) || vs.find(v => /hi[-_]IN/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang) && g(v)) || null;
  return _kvVoice;
}
if (window.speechSynthesis) { kvPickVoice(); speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", kvPickVoice); }
function kvSpeechText(t) {
  let s = String(t || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/\bMT\b/g, " metric ton").replace(/%/g, " percent").replace(/\s*[|•·]\s*/g, ", ")
    .replace(/\n+/g, ". ").replace(/\s{2,}/g, " ").trim();
  if (s.length > 420) { const cut = s.lastIndexOf(". ", 420); s = s.slice(0, cut > 150 ? cut + 1 : 420) + " See the rest on the screen."; }
  return s;
}
function kvSpeak(text, cfg, force) {
  if (!window.speechSynthesis || (!force && !kvVoiceOn())) return;
  const t = force ? text : kvSpeechText(text);
  if (!t) return;
  try {
    speechSynthesis.cancel();
    const c = cfg || kvSettings();
    const u = new SpeechSynthesisUtterance(t);
    const vs = speechSynthesis.getVoices() || [];
    const v = (c.voice && vs.find(x => x.name === c.voice)) || _kvVoice || kvPickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-IN";
    u.pitch = 1.0; u.rate = +c.rate || 1.0; u.volume = 1;
    speechSynthesis.speak(u);
  } catch (e) { console.warn("Kashvi voice failed", e); }
}
function kvStopSpeaking() { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} }
(function kvVoiceBtn() {
  const b = document.getElementById("kashviVoiceBtn");
  if (!b) return;
  const paint = () => { b.textContent = kvVoiceOn() ? "🔊" : "🔇"; };
  paint();
  b.addEventListener("click", () => {
    const on = !kvVoiceOn();
    try { localStorage.setItem("kashviVoice", on ? "on" : "off"); } catch (e) {}
    paint();
    if (on) kvSpeak("I will speak the answers too."); else kvStopSpeaking();
  });
})();

// ---- Voice chooser (🎙️ in the Kashvi header): every voice installed on THIS
// phone, with ready-made "bachchi" presets, pitch/speed sliders and a sample.
(function kvVoicePicker() {
  const btn = document.getElementById("kashviVoiceSet"), panel = document.getElementById("kvVoicePanel");
  if (!btn || !panel || !window.speechSynthesis) { if (btn) btn.style.display = "none"; return; }
  const sel = document.getElementById("kvvVoice"), pitch = document.getElementById("kvvPitch"), rate = document.getElementById("kvvRate");
  const pv = document.getElementById("kvvPitchV"), rv = document.getElementById("kvvRateV"), note = document.getElementById("kvvNote");
  const PRESETS = [
    ["👧 Choti bachchi", 2.0, 1.1], ["🧒 Bachchi", 1.8, 1.02], ["🙂 Bachchi (dheere)", 1.6, 0.9],
    ["👩 Ladki", 1.3, 1.0], ["🗣️ Normal", 1.0, 1.0], ["😄 Masti", 2.0, 1.25]
  ];
  const sample = v => /^hi/i.test((v && v.lang) || "")
    ? "नमस्ते, मैं काश्वी हूँ। कल का प्रोडक्शन तीन सौ सत्तर मीट्रिक टन था, और बारह हीट बनी।"
    : "Hi, I am Kashvi. Yesterday's production was three hundred seventy metric ton, with twelve heats.";
  const isG = v => /google/i.test(v.name) || v.localService === false;
  const voices = () => (speechSynthesis.getVoices() || []).filter(v => /^(en|hi)/i.test(v.lang))
    .sort((a, b) => (isG(b) - isG(a)) || (/IN/i.test(b.lang) - /IN/i.test(a.lang)) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  const fill = () => {
    const cur = kvSettings().voice || (_kvVoice && _kvVoice.name) || "";
    const list = voices();
    sel.innerHTML = list.map(v => `<option value="${v.name.replace(/"/g, "&quot;")}">${v.name} (${v.lang})</option>`).join("") ||
      '<option value="">(no English / Hindi voice found on this phone)</option>';
    if (cur) sel.value = cur;
    note.textContent = `${list.length} voice(s) found on this phone (Google voices at the top). ` +
      "For a better voice: phone Settings → Text-to-speech → Google engine ⚙️ → Install voice data → English (India) / हिन्दी → download Voice I, II, III, IV, then open the app again.";
  };
  const show = () => { pv.textContent = (+pitch.value).toFixed(1); rv.textContent = (+rate.value).toFixed(2); };
  const cfg = () => ({ voice: sel.value, pitch: 1, rate: +rate.value });
  const curVoice = () => (speechSynthesis.getVoices() || []).find(v => v.name === sel.value);
  const play = () => kvSpeak(sample(curVoice()), cfg(), true);
  sel.addEventListener("change", play);
  pitch.addEventListener("input", show); rate.addEventListener("input", show);
  pitch.addEventListener("change", play); rate.addEventListener("change", play);
  document.getElementById("kvvPlay").addEventListener("click", play);
  document.getElementById("kvvSave").addEventListener("click", () => {
    try { localStorage.setItem("kashviVoiceCfg2", JSON.stringify(cfg())); localStorage.setItem("kashviVoice", "on"); } catch (e) {}
    _kvVoice = curVoice() || _kvVoice;
    const vb = document.getElementById("kashviVoiceBtn"); if (vb) vb.textContent = "🔊";
    panel.classList.add("hidden");
    kvSpeak(/^hi/i.test((_kvVoice && _kvVoice.lang) || "") ? "ठीक है, अब मैं इसी आवाज़ में बोलूँगी।" : "Okay! Ab main isi aawaz me bolungi.", cfg(), true);
  });
  btn.addEventListener("click", () => {
    const opening = panel.classList.contains("hidden");
    panel.classList.toggle("hidden");
    if (opening) { const c = kvSettings(); fill(); pitch.value = c.pitch; rate.value = c.rate; show(); }
    else kvStopSpeaking();
  });
  if (speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged", () => { if (!panel.classList.contains("hidden")) fill(); });
})();

function askDataAppendMessage(text, fromUser) {
  const chat = document.getElementById(_askChatTarget);
  const bubble = document.createElement("div");
  bubble.style.cssText = "margin-bottom:10px; padding:10px 14px; border-radius:10px; max-width:85%; font-size:14px; line-height:1.5; " +
    (fromUser
      ? "background:var(--navy); color:var(--navy-text); margin-left:auto;"
      : "background:rgba(0,0,0,.06); color:var(--ink);");
  bubble.style.whiteSpace = "pre-wrap";
  bubble.textContent = text;
  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
  if (_askChatTarget === "kashviChat") {
    if (fromUser) kvStopSpeaking();
    else if (!/^(Thinking|Looking)\.\.\.$/.test(text) && !/^📄 Making/.test(text)) {
      // greeting: speak only its first line
      kvSpeak(/^Hi, I am Kashvi/.test(text) ? text.split("\n")[0] : text);
    }
  }
  return bubble;
}

async function getProdMetricForRange(token, year, month0, fromDay, toDay, metricKey) {
  const path = await detectFilePathForMonth(token, year, month0);
  if (!path) return null;
  const wb = await resolveWorkbook(token, path);
  const values = (await graphFetch(`${wb}/worksheets('Prod.')/range(address='A1:AB2000')?$select=values`, token)).values;
  const colMap = { c: 2, mn: 3, si: 4, s: 5, p: 6, production: 27, rolled: 20 }; // rolled = Hot Charging qty (col U)
  const col = colMap[metricKey];
  let sum = 0, count = 0;
  for (let i = 0; i < values.length; i++) {
    const dv = values[i][0];
    if (typeof dv !== "number") continue;
    const iso = excelSerialToISODate(dv);
    const [dy, dm, dd] = iso.split("-").map(Number);
    if (dy !== year || (dm - 1) !== month0 || dd < fromDay || dd > toDay) continue;
    if (!values[i][1]) continue; // no heat no. - blank row
    const v = values[i][col];
    if (typeof v === "number") { sum += v; count++; }
  }
  if (count === 0) return null;
  return metricKey === "production" ? sum : (sum / count);
}

async function handleAskDataQuestion(question) {
  const q = question.toLowerCase();
  const now = new Date();
  let year = now.getFullYear(), month0 = now.getMonth();
  let fromDay = 1, toDay = new Date(year, month0 + 1, 0).getDate();
  let periodLabel = `${MONTH_ABBR[month0]} ${year} so far`;

  if (q.includes("yesterday") || q.includes("kal")) {
    const y2 = new Date(now); y2.setDate(y2.getDate() - 1);
    year = y2.getFullYear(); month0 = y2.getMonth(); fromDay = toDay = y2.getDate();
    periodLabel = `${y2.getDate()} ${MONTH_ABBR[month0]} ${year}`;
  } else if (q.includes("today") || q.includes("aaj")) {
    fromDay = toDay = now.getDate();
    periodLabel = `today (${now.getDate()} ${MONTH_ABBR[month0]})`;
  } else if (q.includes("last month") || q.includes("pichhle") || q.includes("pichle")) {
    month0 -= 1;
    if (month0 < 0) { month0 = 11; year -= 1; }
    fromDay = 1; toDay = new Date(year, month0 + 1, 0).getDate();
    periodLabel = `${MONTH_ABBR[month0]} ${year}`;
  } else if (q.includes("this month") || q.includes("is mahine") || q.includes("is maheene")) {
    periodLabel = `${MONTH_ABBR[month0]} ${year} so far`;
  }

  let metricKey = null, metricLabel = null;
  if (q.includes("fe(m)") || q.includes("fem") || q.includes("iron")) {
    return "Fe(M)% is only tracked for incoming raw materials (see Quarter Reports), not per steel heat - try asking about production, C%, Mn%, Si%, P%, or S% instead.";
  } else if (q.includes("mn") || q.includes("manganese")) {
    metricKey = "mn"; metricLabel = "average Mn%";
  } else if (q.includes("carbon") || q.includes("c%")) {
    metricKey = "c"; metricLabel = "average C%";
  } else if (q.includes("silicon") || q.includes("si%")) {
    metricKey = "si"; metricLabel = "average Si%";
  } else if (q.includes("sulphur") || q.includes("sulfur") || q.includes("s%")) {
    metricKey = "s"; metricLabel = "average S%";
  } else if (q.includes("phosphorus") || q.includes("p%")) {
    metricKey = "p"; metricLabel = "average P%";
  } else if (q.includes("production") || q.includes("output") || q.includes("utpadan")) {
    metricKey = "production"; metricLabel = "total production";
  } else {
    return "I didn't catch a metric in that question. Try mentioning production, C%, Mn%, Si%, P%, or S%, along with today/yesterday/this month/last month.";
  }

  const token = await getToken();
  const result = await getProdMetricForRange(token, year, month0, fromDay, toDay, metricKey);
  if (result === null) return `Couldn't find any data for ${periodLabel}.`;
  const unit = metricKey === "production" ? "MT" : "%";
  const decimals = metricKey === "production" ? 0 : 3;
  return `${metricLabel} for ${periodLabel}: ${result.toFixed(decimals)} ${unit}`;
}

document.getElementById("askDataSendBtn").addEventListener("click", async () => {
  const input = document.getElementById("askDataInput");
  const question = input.value.trim();
  if (!question) return;
  askDataAppendMessage(question, true);
  input.value = "";
  const thinkingBubble = askDataAppendMessage("Thinking...", false);
  try {
    const answer = await handleAskDataQuestion(question);
    thinkingBubble.remove();
    askDataAppendMessage(answer, false);
  } catch (e) {
    thinkingBubble.remove();
    askDataAppendMessage("Error: " + e.message, false);
  }
});
document.getElementById("askDataInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("askDataSendBtn").click();
});

