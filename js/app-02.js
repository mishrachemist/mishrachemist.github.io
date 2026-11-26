/* ===================== ISO 9001 - VENDOR PERFORMANCE EVALUATION ===================== */
function getVenList() {
  try { return JSON.parse(localStorage.getItem("iso9001_vendor") || "[]"); } catch (e) { return []; }
}
function saveVenList(list) { localStorage.setItem("iso9001_vendor", JSON.stringify(list)); }
function renderVenTable() {
  const list = getVenList();
  const table = document.getElementById("venTable");
  table.innerHTML = "<tr><th>Vendor</th><th>Date</th><th>Quality</th><th>Delivery</th><th>Price</th><th>Overall</th><th>Remarks</th><th></th></tr>";
  const E = htmlEsc;
  list.forEach((r, idx) => {
    const overall = ((r.quality + r.delivery + r.price) / 3).toFixed(1);
    table.innerHTML += `<tr>
      <td>${E(r.vendor)}</td><td>${E(r.date)}</td><td>${E(r.quality)}</td><td>${E(r.delivery)}</td><td>${E(r.price)}</td>
      <td><b>${E(overall)}</b></td><td>${E(r.remarks)}</td>
      <td><button class="secondary" onclick="deleteVenEntry(${idx})" style="padding:4px 8px;font-size:11px;">Remove</button></td>
    </tr>`;
  });
}
function deleteVenEntry(idx) {
  const list = getVenList();
  list.splice(idx, 1);
  saveVenList(list);
  renderVenTable();
}
document.getElementById("venAddBtn").addEventListener("click", () => {
  const vendor = document.getElementById("venName").value.trim();
  const quality = parseFloat(document.getElementById("venQuality").value);
  const delivery = parseFloat(document.getElementById("venDelivery").value);
  const price = parseFloat(document.getElementById("venPrice").value);
  if (!vendor || isNaN(quality) || isNaN(delivery) || isNaN(price)) { alert("Please fill in Vendor Name and all three ratings (1-5)."); return; }
  const list = getVenList();
  list.push({ vendor, date: document.getElementById("venDate").value, quality, delivery, price, remarks: document.getElementById("venRemarks").value.trim() });
  saveVenList(list);
  ["venName", "venDate", "venQuality", "venDelivery", "venPrice", "venRemarks"].forEach(id => document.getElementById(id).value = "");
  renderVenTable();
});
document.getElementById("venPdfBtn").addEventListener("click", () => {
  const list = getVenList();
  if (list.length === 0) { alert("No vendor evaluations to export yet."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  addLogoHeader(doc);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(31, 56, 100);
  doc.text("Vendor / Supplier Performance Evaluation", doc.internal.pageSize.getWidth() / 2, 30, { align: "center" });
  doc.autoTable({
    startY: 45,
    head: [["Vendor", "Date", "Quality", "Delivery", "Price", "Overall", "Remarks"]],
    body: list.map(r => [r.vendor, r.date, r.quality, r.delivery, r.price, ((r.quality + r.delivery + r.price) / 3).toFixed(1), r.remarks]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [31, 56, 100] },
    theme: "grid"
  });
  stampLogoOnAllPages(doc);
  showPdfPreview(doc, "Vendor_Performance_Evaluation.pdf", "Vendor Performance Evaluation");
});

/* ===================== ISO 9001 - PRODUCT TRACEABILITY ===================== */
document.getElementById("traceSearchBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const monthVal = document.getElementById("traceMonth").value; // "YYYY-MM"
  const heatNo = document.getElementById("traceHeatNo").value.trim();
  if (!monthVal || !heatNo) { alert("Please select a month and enter a heat number."); return; }
  statusEl.className = "wait";
  statusEl.textContent = "Searching...";
  try {
    const [y, m] = monthVal.split("-").map(Number);
    const token = await getToken();
    const path = await detectFilePathForMonth(token, y, m - 1);
    if (!path) { statusEl.className = "err"; statusEl.textContent = "Couldn't find that month's file."; return; }
    const wb = await resolveWorkbook(token, path);
    const data = await graphFetch(`${wb}/worksheets('Prod.')/range(address='A1:AH2000')?$select=values`, token);
    const values = data.values;
    let foundRow = null, foundDate = null;
    for (let i = 0; i < values.length; i++) {
      if (typeof values[i][0] === "number") foundDate = excelSerialToISODate(values[i][0]);
      if ((values[i][1] || "").toString().trim() === heatNo) { foundRow = values[i]; break; }
    }
    const wrap = document.getElementById("traceResultWrap");
    if (!foundRow) {
      wrap.innerHTML = `<p style="color:var(--bad);">Heat "${_escH(heatNo)}" not found in ${_escH(monthVal)}.</p>`;
      wrap.classList.remove("hidden");
      statusEl.className = "err";
      statusEl.textContent = "Heat not found.";
      return;
    }
    wrap.innerHTML = `
      <table class="momTable">
        <tr><td><b>Heat No.</b></td><td>${_escH(heatNo)}</td></tr>
        <tr><td><b>Date</b></td><td>${foundDate}</td></tr>
        <tr><td><b>%C</b></td><td>${_escH(fmt(foundRow[2]))}</td></tr>
        <tr><td><b>%Mn</b></td><td>${_escH(fmt(foundRow[3]))}</td></tr>
        <tr><td><b>%Si</b></td><td>${_escH(fmt(foundRow[4]))}</td></tr>
        <tr><td><b>%S</b></td><td>${_escH(fmt(foundRow[5]))}</td></tr>
        <tr><td><b>%P</b></td><td>${_escH(fmt(foundRow[6]))}</td></tr>
        <tr><td><b>Size</b></td><td>${_escH(fmt(foundRow[7]))}</td></tr>
        <tr><td><b>Total Production (MT)</b></td><td>${_escH(fmt(foundRow[27]))}</td></tr>
      </table>`;
    wrap.classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = "Heat found.";
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
});

/* ===================== ISO 9001 - QUALITY OBJECTIVES ===================== */
function getObjTargets() {
  try { return JSON.parse(localStorage.getItem("iso9001_objectives") || "{}"); } catch (e) { return {}; }
}
document.getElementById("objSaveTargetBtn").addEventListener("click", () => {
  const monthVal = document.getElementById("objMonth").value;
  const target = parseFloat(document.getElementById("objTarget").value);
  if (!monthVal || isNaN(target)) { alert("Please select a month and enter a target %."); return; }
  const targets = getObjTargets();
  targets[monthVal] = target;
  localStorage.setItem("iso9001_objectives", JSON.stringify(targets));
  alert(`Target saved for ${monthVal}: Out-of-Spec % under ${target}%`);
});
document.getElementById("objLoadBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const monthVal = document.getElementById("objMonth").value;
  if (!monthVal) { alert("Please select a month."); return; }
  statusEl.className = "wait";
  statusEl.textContent = "Checking this month's quality objective...";
  try {
    const [y, m] = monthVal.split("-").map(Number);
    const token = await getToken();
    const path = await detectFilePathForMonth(token, y, m - 1);
    if (!path) { statusEl.className = "err"; statusEl.textContent = "Couldn't find that month's file."; return; }
    const wb = await resolveWorkbook(token, path);
    const daysInMonth = new Date(y, m, 0).getDate();
    const fromDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const toDate = `${y}-${String(m).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    const { totalHeatsScanned: totalHeats, flaggedHeats } = await scanOutOfSpecHeats("Prod.", fromDate, toDate, null, token);
    const actualPct = totalHeats > 0 ? (flaggedHeats.length / totalHeats * 100) : 0;
    const targets = getObjTargets();
    const target = targets[monthVal];

    const wrap = document.getElementById("objResultWrap");
    let html = `<div class="dashGrid">
      <div class="dashCard"><div class="dashLabel">Total Heats</div><div class="dashValue">${totalHeats}</div></div>
      <div class="dashCard"><div class="dashLabel">Out-of-Spec Heats</div><div class="dashValue">${flaggedHeats.length}</div></div>
      <div class="dashCard"><div class="dashLabel">Actual Out-of-Spec %</div><div class="dashValue">${actualPct.toFixed(2)}%</div></div>`;
    if (target !== undefined) {
      const met = actualPct <= target;
      html += `<div class="dashCard ${met ? "" : "dashOrange"}"><div class="dashLabel">Target</div><div class="dashValue" style="font-size:16px;">${met ? "✅" : "❌"} Under ${target}%</div></div>`;
    }
    html += `</div>`;
    if (target === undefined) html += `<p style="font-size:12.5px;color:var(--muted);margin-top:10px;">No target saved for this month yet - enter one above and click "Save Target".</p>`;
    wrap.innerHTML = html;
    wrap.classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = "Quality objective checked.";
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
});

renderNcrTable();
renderCalTable();
renderVenTable();

// Calibration reminders: a 🔔 notification 7 days before an instrument's
// due date, and again on/after the due date (each only once per due date).
function checkCalibrationReminders() {
  let done = {};
  try { done = JSON.parse(localStorage.getItem("calReminded") || "{}"); } catch (e) { done = {}; }
  const today = new Date(todayISO());
  getCalList().forEach(r => {
    if (!r.dueDate) return;
    const days = Math.round((new Date(r.dueDate) - today) / 86400000);
    const key = `${r.name}|${r.id}|${r.dueDate}`;
    const label = `${r.name}${r.id ? " (" + r.id + ")" : ""}`;
    if (days < 0 || days === 0) {
      if (done[key] !== "due") {
        addNotification(days < 0
          ? `Calibration OVERDUE: ${label} - was due on ${r.dueDate}`
          : `Calibration due TODAY: ${label}`, "🛠️");
        done[key] = "due";
      }
    } else if (days <= 7) {
      if (!done[key]) {
        addNotification(`Calibration due in ${days} day(s): ${label} - due ${r.dueDate}`, "🛠️");
        done[key] = "7d";
      }
    }
  });
  localStorage.setItem("calReminded", JSON.stringify(done));
}

function getNotifications() {
  try { return JSON.parse(localStorage.getItem("notifications") || "[]"); }
  catch (e) { return []; }
}
function addNotification(text, icon) {
  let list = getNotifications();
  list.unshift({ text, icon: icon || "🔔", time: new Date().toISOString(), read: false });
  list = list.slice(0, 30); // keep the last 30
  localStorage.setItem("notifications", JSON.stringify(list));
  updateNotifBadge();
}
function updateNotifBadge() {
  const unread = getNotifications().filter(n => !n.read).length;
  const badge = document.getElementById("notifBadge");
  if (unread > 0) {
    badge.textContent = unread > 9 ? "9+" : unread;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
  // App Icon Badge - if this app is installed to the home screen (Android
  // Chrome and some desktop browsers support this; iOS Safari does not),
  // the unread count also shows as a small number directly on the home
  // screen icon itself, without opening the app - the closest thing to a
  // "live widget" that's achievable for a web app.
  if ("setAppBadge" in navigator) {
    if (unread > 0) navigator.setAppBadge(unread).catch(() => {});
    else navigator.clearAppBadge().catch(() => {});
  }
}
function renderNotifPanel() {
  const list = getNotifications();
  const container = document.getElementById("notifPanelList");
  if (list.length === 0) {
    container.innerHTML = `<div class="notifEmpty">No notifications yet.</div>`;
    return;
  }
  container.innerHTML = list.map(n =>
    `<div class="notifItem">${htmlEsc(n.icon)} ${htmlEsc(n.text)}<div class="notifItemTime">${htmlEsc(formatTimeAgo(n.time))}</div></div>`
  ).join("");
}
setTimeout(() => { try { checkCalibrationReminders(); } catch (e) {} }, 1500);
setInterval(() => { try { checkCalibrationReminders(); } catch (e) {} }, 6 * 3600000);
document.getElementById("notifBellBtn").addEventListener("click", () => {
  renderNotifPanel();
  document.getElementById("notifPanelOverlay").classList.remove("hidden");
  // Opening the panel counts as reading them.
  const list = getNotifications().map(n => ({ ...n, read: true }));
  localStorage.setItem("notifications", JSON.stringify(list));
  updateNotifBadge();
});
document.getElementById("notifCloseBtn").addEventListener("click", () => {
  document.getElementById("notifPanelOverlay").classList.add("hidden");
});
document.getElementById("notifPanelOverlay").addEventListener("click", (e) => {
  if (e.target.id === "notifPanelOverlay") document.getElementById("notifPanelOverlay").classList.add("hidden");
});
updateNotifBadge();

/* ===================== HAPTIC + SUCCESS SOUND ===================== */
function playSuccessSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.3);
  } catch (e) { /* Web Audio unsupported - silently skip */ }
}
// Light haptic tap on any button press, app-wide - simplest way to cover
// every button (nav tiles, sub-navs, form buttons) without touching each handler.
document.addEventListener("click", (e) => {
  // only a real finger tap - not the clicks the app makes itself (phone back / swipe uses those)
  if (e.isTrusted && e.target.closest("button")) vibrateIfEnabled(10);
});

/* ===================== ACHIEVEMENT BADGES ===================== */
const ACHIEVEMENT_MILESTONES = [
  { count: 1, name: "First Update!", emoji: "🥇" },
  { count: 10, name: "Getting the Hang of It", emoji: "🥈" },
  { count: 50, name: "Data Champion", emoji: "🥉" },
  { count: 100, name: "Century Club", emoji: "💯" },
  { count: 500, name: "Legend", emoji: "🏆" }
];

function recordUpdateCount() {
  let count = parseInt(localStorage.getItem("totalUpdateCount") || "0", 10);
  count += 1;
  localStorage.setItem("totalUpdateCount", String(count));
  const milestone = ACHIEVEMENT_MILESTONES.find(m => m.count === count);
  if (milestone) showAchievementBadge(milestone);
}

function showAchievementBadge(milestone) {
  addNotification(`Achievement unlocked: ${milestone.name}`, milestone.emoji);
  if (!SHOW_CELEBRATION_POPUPS) return;
  playSuccessSound();
  vibrateIfEnabled([20, 40, 20]);
  const overlay = document.createElement("div");
  overlay.className = "milestoneOverlay";
  overlay.innerHTML = `
    <div class="milestoneCard">
      <div class="milestoneEmoji">${milestone.emoji}</div>
      <div class="milestoneTitle">${milestone.name}</div>
      <div class="milestoneSub">You've submitted ${milestone.count} update${milestone.count > 1 ? "s" : ""}!</div>
      <button class="primary" id="achievementCloseBtn">Awesome!</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("achievementCloseBtn").addEventListener("click", () => overlay.remove());
  setTimeout(() => { if (document.body.contains(overlay)) overlay.remove(); }, 6000);
}

/* ===================== TIME-BASED GREETING ===================== */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  if (h < 21) return "Good Evening";
  return "Good Night";
}

// A small decorative sky scene (sun/moon + clouds) matching the greeting -
// purely visual flair, positioned as a compact inline icon.
/* ===================== DAY / FESTIVAL STICKER ===================== */
// Real day-of-week stickers (Monday..Sunday) supplied by the user, embedded
// directly as images rather than redrawn in SVG. 26-Nov-2026: the 190 px originals were upscaled 3x
// (EDSR super-resolution) to 570 px, so they stay sharp on a 1080p phone (shown up to 170 CSS px). Index 0=Sunday..6=Saturday
// to match Date.getDay().
const DAY_STICKER_IMAGES = [
  "img/a6414f9f7197.webp", // sunday
  "img/65425dbfa09c.webp", // monday
  "img/ed628f177016.webp", // tuesday
  "img/b1b3600c8976.webp", // wednesday
  "img/5ed7ec0b1d28.webp", // thursday
  "img/9378a7777771.webp", // friday
  "img/785eeb3c28f4.webp", // saturday
];

const FESTIVALS_2026 = [
  { date: "2026-01-01", name: "HAPPY NEW YEAR", image: "img/8a54684334a7.webp" },
  { date: "2026-01-14", name: "MAKAR SANKRANTI", image: "img/834f0f1c385c.webp" },
  { date: "2026-01-26", name: "HAPPY REPUBLIC DAY", image: "img/4bc0710b8818.webp" },
  { date: "2026-03-04", name: "HAPPY HOLI", image: "img/8cdbe2337634.webp" },
  { date: "2026-03-30", name: "EID MUBARAK", image: "img/3dc106e5a3d0.webp" },
  { date: "2026-04-14", name: "HAPPY BAISAKHI", image: "img/711f2e694a88.webp" },
  { date: "2026-05-27", name: "EID AL-ADHA", image: "img/0256d35dd83e.webp" },
  { date: "2026-07-29", name: "GURU PURNIMA", image: "img/d3b5498da15c.webp" },
  { date: "2026-08-15", name: "HAPPY INDEPENDENCE DAY", image: "img/257fbfe2116f.webp" },
  { date: "2026-08-28", name: "RAKSHA BANDHAN", image: "img/e68cd1661c8f.webp" },
  { date: "2026-09-04", name: "HAPPY JANMASHTAMI", image: "img/cbba1facf8c7.webp" },
  { date: "2026-09-14", name: "GANESH CHATURTHI", image: "img/eba3ab89cea3.webp" },
  { date: "2026-10-11", name: "NAVRATRI", image: "img/6ce30da907ea.webp" },
  { date: "2026-10-20", name: "HAPPY DUSSEHRA", image: "img/b272b6794d11.webp" },
  { date: "2026-11-06", name: "HAPPY DHANTERAS", image: "img/3f930d2cf610.webp" },
  { date: "2026-11-08", name: "HAPPY DIWALI", image: "img/b6eb691b3dc9.webp" },
  { date: "2026-11-10", name: "HAPPY BHAI DOOJ", image: "img/0f6a482e5501.webp" },
  { date: "2026-12-25", name: "MERRY CHRISTMAS", image: "img/469a85eda117.webp" }
];

// Builds a festival sticker (an emoji-in-a-blob) in the same painted-brush-
// stroke style as the day images, since there's no supplied artwork for
// festivals specifically.
function buildStickerSVG(color, iconSVG, label) {
  const charWidth = 21;
  const textWidth = label.length * charWidth;
  const w = Math.max(260, textWidth + 90);
  const cx = w / 2;
  return `<svg viewBox="0 0 ${w} 120" width="${Math.min(w, 320)}" height="${Math.min(w, 320) * 120 / w}" style="display:block;overflow:visible;">
    <path d="M8,60 Q2,24 42,17 Q${cx},2 ${w - 42},15 Q${w - 4},30 ${w - 8},58 Q${w - 2},92 ${w - 46},100 Q${cx},116 44,105 Q4,96 4,74 Q0,66 8,60 Z" fill="${color}" opacity="0.9"/>
    <g transform="translate(${cx - textWidth / 2 - 6},34)">${iconSVG}</g>
    <text x="${cx}" y="90" text-anchor="middle" font-family="'Poppins', sans-serif" font-weight="800" font-size="30" fill="#fff" stroke="#1a1a1a" stroke-width="3" paint-order="stroke" style="letter-spacing:.5px;">${label}</text>
    <line x1="${cx - textWidth / 2 + 4}" y1="98" x2="${cx + textWidth / 2 - 4}" y2="98" stroke="#1a1a1a" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`;
}

// Colors matching each day sticker's own background theme, so the date
// badge feels like part of the same set instead of a plain, unrelated
// number.
const DAY_BADGE_COLORS = ["#f0721c", "#f5a623", "#1a8f8a", "#6f3cb5", "#5aa62a", "#d92e63", "#1f6fce"]; // Sun..Sat

// Builds a smooth, irregular "paint splash" blob outline (alternating wide
// and narrow bumps joined with curves) instead of a plain circle, using
// quadratic-bezier-through-midpoints - a simple, reliable way to get a
// closed wavy shape without needing to hand-draw every point.
function buildSplashPath(cx, cy, baseR) {
  const radii = [1.0, 0.68, 1.18, 0.66, 1.22, 0.7, 1.12, 0.65, 1.2, 0.7, 1.1, 0.66, 1.16, 0.74];
  const n = radii.length;
  const pts = radii.map((rf, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [cx + baseR * rf * Math.cos(angle), cy + baseR * rf * Math.sin(angle)];
  });
  let d = `M ${((pts[0][0] + pts[n - 1][0]) / 2).toFixed(1)},${((pts[0][1] + pts[n - 1][1]) / 2).toFixed(1)} `;
  for (let i = 0; i < n; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const midX = (curr[0] + next[0]) / 2;
    const midY = (curr[1] + next[1]) / 2;
    d += `Q ${curr[0].toFixed(1)},${curr[1].toFixed(1)} ${midX.toFixed(1)},${midY.toFixed(1)} `;
  }
  return d + "Z";
}

function buildDateNumberSVG(dayOfMonth, weekdayIndex) {
  const color = DAY_BADGE_COLORS[weekdayIndex];
  const fontSize = dayOfMonth >= 10 ? 28 : 34;
  const splash = buildSplashPath(40, 42, 32);
  return `<svg viewBox="0 0 80 80" width="105" height="105" style="display:block;overflow:visible;">
    <path d="${splash}" fill="${color}" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
    <path d="${splash}" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round"/>
    <text x="40" y="54" text-anchor="middle" font-family="'Baloo 2', 'Poppins', sans-serif" font-weight="800" font-size="${fontSize}" fill="#fff" stroke="#1a1a1a" stroke-width="3.5" paint-order="stroke">${dayOfMonth}</text>
  </svg>`;
}

// the same stickers on their 2027 dates (hindupad.com 2027 list and officeholidays.com India 2027;
// the two Eid dates depend on the moon and can move by a day)
const FESTIVAL_DATES_MORE = {
  "HAPPY NEW YEAR": ["2027-01-01"], "MAKAR SANKRANTI": ["2027-01-15"], "HAPPY REPUBLIC DAY": ["2027-01-26"], "HAPPY HOLI": ["2027-03-22"],
  "EID MUBARAK": ["2027-03-09"], "HAPPY BAISAKHI": ["2027-04-14"], "EID AL-ADHA": ["2027-05-17"], "GURU PURNIMA": ["2027-07-18"],
  "HAPPY INDEPENDENCE DAY": ["2027-08-15"], "RAKSHA BANDHAN": ["2027-08-17"], "HAPPY JANMASHTAMI": ["2027-08-25"], "GANESH CHATURTHI": ["2027-09-04"],
  "NAVRATRI": ["2027-09-30"], "HAPPY DUSSEHRA": ["2027-10-09"], "HAPPY DHANTERAS": ["2027-10-27"], "HAPPY DIWALI": ["2027-10-29"],
  "HAPPY BHAI DOOJ": ["2027-10-31"], "MERRY CHRISTMAS": ["2027-12-25"]
};
function renderDaySticker() {
  const wrap = document.getElementById("dayStickerWrap");
  if (!wrap) return;
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const festival = FESTIVALS_2026.find(f => f.date === iso || (FESTIVAL_DATES_MORE[f.name] || []).includes(iso));
  const dateNumberHTML = buildDateNumberSVG(now.getDate(), now.getDay());
  let dayHTML;
  if (festival) {
    if (festival.image) {
      // Real festival sticker artwork (supplied by the user), same
      // treatment as the day-of-week images.
      dayHTML = "<img " + `src="${festival.image}" alt="" style="max-width:170px;width:100%;height:auto;display:block;margin:0 auto;">`;   // "<img " kept apart so the page pre-loader never mistakes this for a real tag
    } else {
      // No supplied artwork for this one - fall back to a painted-blob
      // sticker with either a small hand-drawn icon or a plain emoji.
      const icon = festival.iconSvg || `<text x="0" y="0" font-size="34" text-anchor="middle">${festival.emoji}</text>`;
      dayHTML = buildStickerSVG(festival.color, icon, festival.name);
    }
  } else {
    dayHTML = "<img " + `src="${DAY_STICKER_IMAGES[now.getDay()]}" alt="" style="max-width:170px;width:100%;height:auto;display:block;margin:0 auto;">`;
  }
  // Day sticker and date-number badge merged into a single glass box,
  // shown side by side inside it.
  // Plain "day card" shown instead of the sticker when a modern icon style is
  // chosen (Menu -> Icon Style); CSS decides which of the two is visible.
  const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayCard = `<div class="dayCard">
    <div class="dcNum"><span class="dcMon">${MN[now.getMonth()].slice(0, 3).toUpperCase()}</span><span class="dcDate">${now.getDate()}</span></div>
    <div class="dcText"><div class="dcWeekday">${WD[now.getDay()]}</div>
      <div class="dcSub">${now.getDate()} ${MN[now.getMonth()]} ${now.getFullYear()}</div>
      ${festival ? `<span class="dcFest">${festival.name}</span>` : ""}</div>
  </div>`;
  wrap.innerHTML = `<span class="glassFrame daySticker" style="gap:10px;">
    <span>${dayHTML}</span>
    <span>${dateNumberHTML}</span>
  </span>` + dayCard;
  if (window.homeProdMeter) window.homeProdMeter();   // ring around the date / corner badge
}

// Tall sky for the side-by-side greeting card: colours follow the time of day,
// sun low on the right (morning / evening), high (afternoon), moon + stars (night).
// ---- Real sun / moon: sunrise & sunset come from Open-Meteo with the weather (saved per day). ----
function smsSunTimes(now) {
  now = now || new Date();
  let rise = "06:00", set = "18:00", real = false;
  try {
    const v = JSON.parse(localStorage.getItem("fxSun") || "null");
    if (v && /^\d\d:\d\d$/.test(v.rise) && /^\d\d:\d\d$/.test(v.set)) { rise = v.rise; set = v.set; real = true; }
  } catch (e) {}
  const at = (hm, dayOff) => { const d = new Date(now); d.setHours(+hm.slice(0, 2), +hm.slice(3, 5), 0, 0); d.setDate(d.getDate() + dayOff); return d; };
  return { rise: at(rise, 0), set: at(set, 0), riseTxt: rise, setTxt: set, real, at };
}
// kind: "day" (sun up) or "night"; f: 0..1 along today's sun (or tonight's moon) arc; pal: sky colours.
function smsSkyState(now) {
  now = now || new Date();
  const s = smsSunTimes(now), t = now.getTime(), R = s.rise.getTime(), S = s.set.getTime(), M = 60000;
  let kind, f;
  if (t >= R && t <= S) { kind = "day"; f = (t - R) / (S - R); }
  else if (t > S) { kind = "night"; const nr = s.at(s.riseTxt, 1).getTime(); f = (t - S) / (nr - S); }
  else { kind = "night"; const ps = s.at(s.setTxt, -1).getTime(); f = (t - ps) / (R - ps); }
  let pal;
  if (t >= R - 40 * M && t < R + 60 * M) pal = "m";          // dawn
  else if (t >= S - 60 * M && t < S + 35 * M) pal = "e";     // sunset / dusk (reddish)
  else pal = kind === "day" ? "a" : "n";
  return { kind, f: Math.max(0, Math.min(1, f)), pal, sun: s };
}
// Moon age as a fraction of the lunar month (0 new, 0.5 full), from the mean synodic month.
function smsMoonPhase(now) {
  const ref = Date.UTC(2000, 0, 6, 18, 14), syn = 29.530588853 * 86400000;
  let p = (((now || new Date()).getTime() - ref) / syn) % 1; if (p < 0) p += 1; return p;
}
// Lit part of the moon as an SVG path, as seen from India (waxing = lit on the right).
function smsMoonLitPath(cx, cy, r, p) {
  cx = +cx; cy = +cy; r = +r;
  const k = Math.cos(2 * Math.PI * p), rx = Math.abs(k) * r, waxing = p < .5, crescent = k > 0;
  const top = `${cx} ${cy - r}`, bot = `${cx} ${cy + r}`;
  const limb = waxing ? 1 : 0, term = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0);
  return `M${top} A${r} ${r} 0 0 ${limb} ${bot} A${rx.toFixed(2)} ${r} 0 0 ${term} ${top}Z`;
}
function greetingTallSkySVG() {
  const st = smsSkyState(), k = st.pal;
  const sky = { m: ["#2f5fc4", "#6aa7e8", "#f6b35b"], a: ["#0f5bb5", "#3f8fe0", "#9fd0f7"],
    e: ["#4b2a8a", "#c2410c", "#f59e0b"], n: ["#081430", "#132a5c", "#24407e"] }[k];
  const cloud = (x, y, sc, op) => `<g transform="translate(${x},${y}) scale(${sc})" opacity="${op}">
      <ellipse cx="0" cy="9" rx="15" ry="7" fill="#eef3fa"/><ellipse cx="11" cy="5" rx="11" ry="7.5" fill="#ffffff"/>
      <ellipse cx="-10" cy="6" rx="9" ry="6" fill="#f4f7fc"/><ellipse cx="22" cy="9" rx="8" ry="5" fill="#e3ebf6"/></g>`;
  // the arc sits in the open sky to the right of the photo, above the name:
  // rises on its left end, highest at mid-day (mid-night for the moon), sets on its right end
  const pos = f => [86 + f * 72, 96 - Math.sin(Math.PI * f) * 58];
  let track = "";
  for (let i = 0; i <= 24; i++) { const [x, y] = pos(i / 24); track += (i ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1); }
  let art = `<path d="${track}" fill="none" stroke="#ffffff" stroke-opacity=".22" stroke-width="1.2" stroke-dasharray="3 4"/>`;
  const [x, y] = pos(st.f);
  if (st.kind === "day") {
    const low = st.f < .12 || st.f > .88, r = low ? 15 : 13;
    if (k === "a") art += cloud(70, 70, 1, .9) + cloud(130, 150, .8, .6);
    else art += cloud(105, 75, .95, .95);
    art += `<circle cx="${x}" cy="${y}" r="${r * 2.2}" fill="url(#tsGlow)"/>
      <circle cx="${x}" cy="${y}" r="${r}" fill="url(${low ? "#tsSunLow" : "#tsSun"})"/>
      <circle cx="${x - r * .33}" cy="${y - r * .35}" r="${r * .3}" fill="#fffbe6" opacity=".7"/>`;
    if (k !== "a") art += `<path d="M60 205 q20 -14 40 -4 q16 -12 34 -2 q14 -8 36 2 v14 h-110z" fill="#ffffff" opacity=".18"/>`;
  } else {
    const so = k === "n" ? .85 : .45;
    const stars = [[20, 30, 1.2], [60, 18, 1], [140, 60, 1.3], [110, 25, .9], [35, 120, 1], [150, 140, .8], [80, 95, .9], [125, 175, 1.1], [92, 48, .8], [12, 78, .9]];
    art += stars.map(([sx, sy, sr]) => `<circle cx="${sx}" cy="${sy}" r="${sr}" fill="#fff" opacity="${so}"/>`).join("");
    const r = 12, p = smsMoonPhase();
    art += `<circle cx="${x}" cy="${y}" r="${r * 2.3}" fill="url(#tsMoonGlow)"/>
      <circle cx="${x}" cy="${y}" r="${r}" fill="#c9d3ec" opacity=".16"/>
      <path d="${smsMoonLitPath(x.toFixed(1), y.toFixed(1), r, p)}" fill="#eef1f8"/>`;
    if (k === "e") art += `<path d="M60 205 q20 -14 40 -4 q16 -12 34 -2 q14 -8 36 2 v14 h-110z" fill="#ffffff" opacity=".14"/>`;
  }
  return `<svg viewBox="0 0 170 210" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="tsBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${sky[0]}"/>
      <stop offset="55%" stop-color="${sky[1]}"/><stop offset="100%" stop-color="${sky[2]}"/></linearGradient>
      <radialGradient id="tsSun" cx="35%" cy="32%" r="70%"><stop offset="0%" stop-color="#fffbe6"/>
      <stop offset="40%" stop-color="#ffd84a"/><stop offset="100%" stop-color="#f59e0b"/></radialGradient>
      <radialGradient id="tsSunLow" cx="35%" cy="32%" r="70%"><stop offset="0%" stop-color="#ffe9b0"/>
      <stop offset="45%" stop-color="#ff9a3c"/><stop offset="100%" stop-color="#e2470f"/></radialGradient>
      <radialGradient id="tsGlow"><stop offset="0%" stop-color="#ffe27a" stop-opacity=".55"/><stop offset="100%" stop-color="#ffe27a" stop-opacity="0"/></radialGradient>
      <radialGradient id="tsMoonGlow"><stop offset="0%" stop-color="#dfe6ff" stop-opacity=".35"/><stop offset="100%" stop-color="#dfe6ff" stop-opacity="0"/></radialGradient></defs>
    <rect width="170" height="210" fill="url(#tsBg)"/>${art}</svg>`;
}

// Line sun / moon for the greeting card in the modern icon styles (Tabler Icons, MIT).
const GREET_LINE_SVG = {"morning": "<path d=\"M3 17h1m16 0h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7m-9.7 5.7a4 4 0 0 1 8 0\"/> <path d=\"M3 21l18 0\"/> <path d=\"M12 9v-6l3 3m-6 0l3 -3\"/>", "afternoon": "<path d=\"M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\"/> <path d=\"M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7\"/>", "evening": "<path d=\"M3 13h1\"/> <path d=\"M20 13h1\"/> <path d=\"M5.6 6.6l.7 .7\"/> <path d=\"M18.4 6.6l-.7 .7\"/> <path d=\"M8 13a4 4 0 1 1 8 0\"/> <path d=\"M3 17h18\"/> <path d=\"M7 20h5\"/> <path d=\"M16 20h1\"/> <path d=\"M12 5v-1\"/>", "night": "<path d=\"M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z\"/> <path d=\"M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2\"/> <path d=\"M19 11h2m-1 -1v2\"/>"};
function greetingLineSVG() {
  // Small sky arc: where the sun is between today's sunrise and sunset (or the moon, with its real phase, at night).
  const st = smsSkyState(), cx = 35, cy = 31, R = 25;
  const pt = f => [cx - R * Math.cos(Math.PI * f), cy - R * Math.sin(Math.PI * f)];
  const [x, y] = pt(st.f);
  let body;
  if (st.kind === "day") {
    let rays = "";
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, c = Math.cos(a), s2 = Math.sin(a);
      rays += `M${(x + c * 6.2).toFixed(1)} ${(y + s2 * 6.2).toFixed(1)}L${(x + c * 8.4).toFixed(1)} ${(y + s2 * 8.4).toFixed(1)}`; }
    body = `<path d="${rays}" stroke-width="1.3"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.3" fill="currentColor" stroke="none"/>`;
  } else {
    body = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" stroke-width="1" stroke-opacity=".55"/>` +
      `<path d="${smsMoonLitPath(x.toFixed(1), y.toFixed(1), 5, smsMoonPhase())}" fill="currentColor" stroke="none"/>`;
  }
  const s0 = st.sun, lbl = st.kind === "day" ? [s0.riseTxt, s0.setTxt] : [s0.setTxt, s0.riseTxt];
  const txt = s0.real ? `<text x="${cx - R}" y="42" text-anchor="middle">${lbl[0]}</text><text x="${cx + R}" y="42" text-anchor="middle">${lbl[1]}</text>` : "";
  return `<svg class="greetLine sunArc" viewBox="0 0 70 46" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `<path d="M3 ${cy}H67" stroke-opacity=".55"/>` +
    `<path d="M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}" stroke-dasharray="2 3" stroke-opacity=".45" stroke-width="1.2"/>` +
    (st.f > 0.01 ? `<path d="M${cx - R} ${cy}A${R} ${R} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" stroke-width="1.6"/>` : "") +
    body + txt + `</svg>`;
}
// Keep the sky moving: redraw the sun / moon every few minutes.
function smsSkyRefresh() {
  const b = document.getElementById("quickInsightsBanner"); if (!b) return;
  const t = b.querySelector(".greetingSkyTall"); if (t) t.innerHTML = greetingTallSkySVG();
  const l = b.querySelector("svg.greetLine"); if (l) l.outerHTML = greetingLineSVG();
}
window.smsSkyRefresh = smsSkyRefresh;
setInterval(smsSkyRefresh, 5 * 60000);

function getGreetingIconSVG(greetingText) {
  const h = new Date().getHours();
  const defs = `
    <defs>
      <radialGradient id="sunGrad" cx="35%" cy="32%" r="68%">
        <stop offset="0%" stop-color="#fffef2"/>
        <stop offset="35%" stop-color="#ffe066"/>
        <stop offset="75%" stop-color="#ffb703"/>
        <stop offset="100%" stop-color="#f4740a"/>
      </radialGradient>
      <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffe066" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#ffe066" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="moonGrad" cx="32%" cy="28%" r="78%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="55%" stop-color="#e4e8f1"/>
        <stop offset="100%" stop-color="#a3acc4"/>
      </radialGradient>
      <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#e8ecf4" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#e8ecf4" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#d3e1ef"/>
      </linearGradient>
      <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="eveGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4a3b6b"/><stop offset="100%" stop-color="#e08a4f"/>
      </linearGradient>
    </defs>`;

  const cloud = (x, y, s, opacity) => `
    <g transform="translate(${x},${y}) scale(${s})" opacity="${opacity}">
      <ellipse cx="0" cy="9" rx="14" ry="6.5" fill="url(#cloudGrad)"/>
      <ellipse cx="10" cy="5.5" rx="10" ry="6" fill="url(#cloudGrad)"/>
      <ellipse cx="-9" cy="6.5" rx="9" ry="5" fill="url(#cloudGrad)"/>
      <ellipse cx="-2" cy="3" rx="12" ry="5" fill="#ffffff" opacity="0.6"/>
    </g>`;

  // A glowing halo behind a bright core, plus a soft highlight offset toward
  // the "light source" corner - gives the sun some roundness instead of a
  // flat disc.
  const sun = (cx, cy, r) => `
    <circle cx="${cx}" cy="${cy}" r="${r * 2.3}" fill="url(#sunGlow)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sunGrad)"/>
    <circle cx="${cx - r * 0.32}" cy="${cy - r * 0.32}" r="${r * 0.32}" fill="#fffef2" opacity="0.6"/>`;

  // Same idea for the moon, plus a few soft grey "craters" (each with its
  // own faint highlight/shadow edge) for texture instead of flat dots.
  const moon = (cx, cy, r) => `
    <circle cx="${cx}" cy="${cy}" r="${r * 2}" fill="url(#moonGlow)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#moonGrad)"/>
    <circle cx="${cx - r * 0.28}" cy="${cy - r * 0.22}" r="${r * 0.22}" fill="#b7bfd4" opacity="0.55"/>
    <circle cx="${cx + r * 0.34}" cy="${cy + r * 0.2}" r="${r * 0.15}" fill="#b7bfd4" opacity="0.5"/>
    <circle cx="${cx + r * 0.05}" cy="${cy - r * 0.42}" r="${r * 0.1}" fill="#b7bfd4" opacity="0.45"/>
    <circle cx="${cx - r * 0.35}" cy="${cy - r * 0.25}" r="${r * 0.08}" fill="#fff" opacity="0.35"/>`;

  // Small stars gently pulse; a couple of brighter ones get a 4-point
  // sparkle shape with a soft glow behind it, like light actually catching
  // the eye rather than a plain dot.
  const star = (x, y, r, sparkle) => {
    const dur = (2 + Math.random() * 2).toFixed(1);
    if (sparkle) {
      return `<g transform="translate(${x},${y})">
        <circle r="${r * 3.2}" fill="url(#starGlow)"/>
        <path d="M0,${-r * 2.4} L${r * 0.55},${-r * 0.55} L${r * 2.4},0 L${r * 0.55},${r * 0.55} L0,${r * 2.4} L${-r * 0.55},${r * 0.55} L${-r * 2.4},0 L${-r * 0.55},${-r * 0.55} Z" fill="#fff">
          <animate attributeName="opacity" values="1;0.55;1" dur="${dur}s" repeatCount="indefinite"/>
        </path>
      </g>`;
    }
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"><animate attributeName="opacity" values="1;0.35;1" dur="${dur}s" repeatCount="indefinite"/></circle>`;
  };

  const textEl = (fill) => `
    <text x="16" y="52" font-family="Poppins, sans-serif" font-size="17" font-weight="700" fill="${fill}" style="text-shadow:0 1px 3px rgba(0,0,0,.4);">${greetingText}</text>`;

  if (h < 12) {
    // Morning: soft blue sky, low golden sun, light clouds
    return `<svg viewBox="0 0 340 65" width="300" height="57" preserveAspectRatio="xMidYMid slice">
      ${defs}
      <rect width="340" height="65" rx="10" fill="#a8d4f0"/>
      ${sun(225, 46, 15)}
      ${cloud(180, 16, 1, 0.95)}
      ${cloud(225, 16, 0.6, 0.7)}
      ${textEl("#0b2545")}
    </svg>`;
  }
  if (h < 17) {
    // Afternoon: bright sky, high bright sun
    return `<svg viewBox="0 0 340 65" width="300" height="57" preserveAspectRatio="xMidYMid slice">
      ${defs}
      <rect width="340" height="65" rx="10" fill="#5eb3f0"/>
      ${sun(225, 18, 14)}
      ${cloud(175, 46, 1, 0.95)}
      ${cloud(225, 44, 0.6, 0.7)}
      ${textEl("#0b2545")}
    </svg>`;
  }
  if (h < 21) {
    // Evening: sunset gradient, low orange sun
    return `<svg viewBox="0 0 340 65" width="300" height="57" preserveAspectRatio="xMidYMid slice">
      ${defs}
      <rect width="340" height="65" rx="10" fill="url(#eveGrad)"/>
      ${sun(222, 48, 15)}
      ${cloud(180, 16, 0.9, 0.85)}
      ${textEl("#fff")}
    </svg>`;
  }
  // Night: dark navy sky, pale moon with craters, stars
  return `<svg viewBox="0 0 340 65" width="300" height="57" preserveAspectRatio="xMidYMid slice">
    ${defs}
    <rect width="340" height="65" rx="10" fill="#0c1a3a"/>
    ${star(12, 10, 1.1, false)}
    ${star(40, 6, 0.9, true)}
    ${star(70, 14, 1, false)}
    ${star(90, 24, 0.8, false)}
    ${star(58, 22, 0.7, false)}
    ${moon(225, 18, 14)}
    ${cloud(175, 46, 0.8, 0.6)}
    ${textEl("#e8ecf4")}
  </svg>`;
}

/* ===================== COMMAND PALETTE (Ctrl+K quick search) ===================== */
function getCmdPaletteItems() {
  return Array.from(document.querySelectorAll("#mainSidebar > .navItem")).map(btn => ({
    section: btn.dataset.section,
    label: btn.querySelector(".navLabel").textContent.trim(),
    icon: btn.querySelector(".navIcon").innerHTML // innerHTML so the live calendar icon shows too
  }));
}
function renderCmdResults(query) {
  const items = getCmdPaletteItems().filter(i => i.label.toLowerCase().includes(query.toLowerCase()));
  const container = document.getElementById("cmdPaletteResults");
  container.innerHTML = "";
  items.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "cmdResultItem" + (idx === 0 ? " active" : "");
    div.innerHTML = `<span class="cmdIcon">${item.icon}</span><span>${item.label}</span>`;
    div.addEventListener("click", () => {
      closeCmdPalette();
      document.querySelector(`#mainSidebar > .navItem[data-section="${item.section}"]`).click();
    });
    container.appendChild(div);
  });
}
function openCmdPalette() {
  document.getElementById("cmdPaletteOverlay").classList.remove("hidden");
  const input = document.getElementById("cmdPaletteInput");
  input.value = "";
  renderCmdResults("");
  input.focus();
}
function closeCmdPalette() {
  document.getElementById("cmdPaletteOverlay").classList.add("hidden");
}
document.getElementById("cmdPaletteBtn").addEventListener("click", openCmdPalette);
document.getElementById("cmdPaletteInput").addEventListener("input", (e) => renderCmdResults(e.target.value));
document.getElementById("cmdPaletteInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const active = document.querySelector(".cmdResultItem.active") || document.querySelector(".cmdResultItem");
    if (active) active.click();
  }
});
document.getElementById("cmdPaletteOverlay").addEventListener("click", (e) => {
  if (e.target.id === "cmdPaletteOverlay") closeCmdPalette();
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openCmdPalette();
  }
  if (e.key === "Escape") closeCmdPalette();
});

/* ===================== VOICE SEARCH (Command Palette) ===================== */
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognitionAPI) {
  const recognition = new SpeechRecognitionAPI();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("result", (e) => {
    const spoken = e.results[0][0].transcript;
    document.getElementById("cmdPaletteInput").value = spoken;
    renderCmdResults(spoken);
  });
  recognition.addEventListener("end", () => {
    document.getElementById("cmdVoiceBtn").classList.remove("listening");
  });
  recognition.addEventListener("error", () => {
    document.getElementById("cmdVoiceBtn").classList.remove("listening");
  });

  document.getElementById("cmdVoiceBtn").addEventListener("click", () => {
    document.getElementById("cmdVoiceBtn").classList.add("listening");
    recognition.start();
  });
} else {
  document.getElementById("cmdVoiceBtn").style.display = "none"; // not supported on this browser
}

/* ===================== SERVICE WORKER (PWA) ===================== */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").then(reg => { try { reg.update(); } catch (e) {} }).catch(() => {
      // Non-fatal - the app still works fully without offline caching.
    });
  });
  // A little after opening (and when the app comes back on screen): the worker quietly fetches the newest
  // index.html and saves it as the offline copy - so a slow-network start never keeps an old version.
  // If the page on screen is older, the worker answers "sms-new-version" (one-tap update bar below).
  const refreshShell = () => {
    try {
      if (navigator.onLine === false) return;
      const last = +(localStorage.getItem("shellRefreshAt") || 0);
      if (Date.now() - last < 2 * 60000) return;   // the page now opens from the saved copy - look for a newer one soon after
      navigator.serviceWorker.ready.then(reg => {
        const w = navigator.serviceWorker.controller || reg.active; if (!w) return;
        localStorage.setItem("shellRefreshAt", String(Date.now()));
        w.postMessage({ action: "refreshShell", version: typeof APP_VERSION !== "undefined" ? APP_VERSION : "" });
      }).catch(() => {});
    } catch (e) {}
  };
  window.addEventListener("load", () => setTimeout(refreshShell, 3000));
  window.addEventListener("online", () => setTimeout(refreshShell, 3000));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(refreshShell, 4000); });
  // The page opens instantly from the saved copy; when a newer version has been
  // downloaded in the background, offer a one-tap update.
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "sms-new-version" || document.getElementById("swUpdateBar")) return;
    const bar = document.createElement("button");
    bar.id = "swUpdateBar"; bar.type = "button";
    bar.textContent = "🔄 New version available" + (e.data.version ? " (" + e.data.version + ")" : "") + " - tap to update";
    bar.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:2147483002;" +
      "background:var(--gold,#c9a227);color:#0b2545;border:none;border-radius:999px;padding:10px 18px;" +
      "font-weight:700;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer;";
    bar.addEventListener("click", () => location.reload());
    document.body.appendChild(bar);
  });
}

/* ===================== CONFIG ===================== */
/* After Azure App Registration, paste these 2 values here */
const CLIENT_ID = "0602bf34-628d-4364-97a9-ae6f0f2327ce";
const REDIRECT_URI = window.location.origin + window.location.pathname;

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
    redirectUri: REDIRECT_URI
  },
  cache: { cacheLocation: "localStorage" }
};

const ISI_LOGO = "data:image/png;base64,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";
// Signature is NOT kept in the code any more. After an allowed sign-in it is
// read from the user's OneDrive app folder (Apps/<app>/signature.png);
// upload it once from Menu -> File Location -> "Upload signature".
let SIGNATURE_IMG = "";
/* ===== Company details (Menu > Get Started > Company details) ======================================
   Nothing about any company is kept in this code. Each person enters their own company name, short name,
   address, CM/L licence no. and logo once. It is saved in their own OneDrive (Apps folder: company.json and
   company-logo.png) and remembered on the phone. Reports print only what has been entered here. ===== */
const COMPANY = { name: "", short: "", address: "", cml: "", logo: "", lw: 0, lh: 0, tc: "", tcw: 0, tch: 0 };   // logo = top of every report, tc = Test Certificate letterhead
const COMPANY_JSON_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/company.json:/content";
const COMPANY_LOGO_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/company-logo.png:/content";
const COMPANY_LOGO_ITEM = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/company-logo.png";
const COMPANY_TC_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/company-logo-tc.png:/content";
const COMPANY_TC_ITEM = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/company-logo-tc.png";
function coKey() { try { return "companyProfile:" + (account ? accountEmail(account) : ""); } catch (e) { return "companyProfile:"; } }
function coClean(v, max) { return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }
function coApply(o) {
  o = o || {};
  COMPANY.name = coClean(o.name, 120); COMPANY.short = coClean(o.short, 30);
  COMPANY.address = coClean(o.address, 200); COMPANY.cml = coClean(o.cml, 40);
  const okImg = v => (typeof v === "string" && /^data:image\/(png|jpe?g);base64,/i.test(v) && v.length < 450000) ? v : "";
  COMPANY.logo = okImg(o.logo); COMPANY.lw = COMPANY.logo ? (+o.lw || 0) : 0; COMPANY.lh = COMPANY.logo ? (+o.lh || 0) : 0;
  COMPANY.tc = okImg(o.tc); COMPANY.tcw = COMPANY.tc ? (+o.tcw || 0) : 0; COMPANY.tch = COMPANY.tc ? (+o.tch || 0) : 0;
  if (typeof window.reportLogoRefresh === "function") window.reportLogoRefresh();   // show / hide the "Logo on report" switches
}
function companyLoadLocal() {
  coApply({});
  try { const o = JSON.parse(localStorage.getItem(coKey()) || "null"); if (o) coApply(o); } catch (e) {}
  companyFillForm();
}
function companySaveLocal() { try { localStorage.setItem(coKey(), JSON.stringify(COMPANY)); } catch (e) { /* storage full: reports still work in this session */ } }
async function coFetchImg(url, h) {   // a logo file from OneDrive as a data URL ("" when there is none)
  const r = await fetch(url, { headers: h });
  if (!r.ok) return "";
  const blob = new Blob([await r.arrayBuffer()], { type: "image/png" });
  return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
}
async function companyLoadCloud() {   // this person's OneDrive, so every phone / PC shows the same details
  try {
    const token = await getToken(); if (!token) return;
    const h = { Authorization: "Bearer " + token };
    const r = await fetch(COMPANY_JSON_URL, { headers: h });
    if (!r.ok) return;                  // nothing saved in OneDrive yet - keep what this phone has
    const o = await r.json();
    o.logo = await coFetchImg(COMPANY_LOGO_URL, h);
    o.tc = await coFetchImg(COMPANY_TC_URL, h);
    coApply(o); companySaveLocal(); companyFillForm();
  } catch (e) { console.warn("company details load failed", e); }
}
function coDataUrlToBlob(u) {
  const p = u.split(","), b = atob(p[1]), a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return new Blob([a], { type: "image/png" });
}
async function companySaveCloud() {
  const token = await getToken(); if (!token) throw new Error("not signed in");
  const h = { Authorization: "Bearer " + token };
  let r = await fetch(COMPANY_JSON_URL, { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, h),
    body: JSON.stringify({ name: COMPANY.name, short: COMPANY.short, address: COMPANY.address, cml: COMPANY.cml, lw: COMPANY.lw, lh: COMPANY.lh, tcw: COMPANY.tcw, tch: COMPANY.tch }) });
  if (!r.ok) throw new Error("OneDrive save failed (" + r.status + ")");
  for (const [img, putUrl, itemUrl] of [[COMPANY.logo, COMPANY_LOGO_URL, COMPANY_LOGO_ITEM], [COMPANY.tc, COMPANY_TC_URL, COMPANY_TC_ITEM]]) {
    if (img) {
      r = await fetch(putUrl, { method: "PUT", headers: Object.assign({ "Content-Type": "image/png" }, h), body: coDataUrlToBlob(img) });
      if (!r.ok) throw new Error("Logo save failed (" + r.status + ")");
    } else {
      await fetch(itemUrl, { method: "DELETE", headers: h });   // 404 when there was no logo - fine
    }
  }
}
async function coProcessImage(file) {   // picture -> { url, w, h } (PNG, small enough for the phone and OneDrive)
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Image could not be opened")); i.src = URL.createObjectURL(file); });
  if (!img.naturalWidth || !img.naturalHeight) throw new Error("Image has no size - use a PNG or JPG");
  let sc = Math.min(1, 600 / img.naturalWidth, 300 / img.naturalHeight), url = "", c = null;
  for (let k = 0; k < 6; k++) {          // shrink until it is small enough for the phone and OneDrive
    c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * sc)); c.height = Math.max(1, Math.round(img.naturalHeight * sc));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    url = c.toDataURL("image/png");
    if (url.length < 300000) break;
    sc *= 0.75;
  }
  URL.revokeObjectURL(img.src);
  if (url.length >= 450000) throw new Error("Logo is too detailed - use a simpler / smaller image");
  return { url: url, w: c.width, h: c.height };
}
async function companyLogoFromFile(file, which) {
  const im = await coProcessImage(file);
  if (which === "tc") { COMPANY.tc = im.url; COMPANY.tcw = im.w; COMPANY.tch = im.h; }
  else { COMPANY.logo = im.url; COMPANY.lw = im.w; COMPANY.lh = im.h; }
}
function companyFillForm() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set("coName", COMPANY.name); set("coShort", COMPANY.short); set("coAddress", COMPANY.address); set("coCml", COMPANY.cml);
  companyPreview();
}
function companyPreview() {
  [["coLogoPreview", "coLogoNone", COMPANY.logo], ["coTcPreview", "coTcNone", COMPANY.tc]].forEach(([iid, nid, url]) => {
    const im = document.getElementById(iid), no = document.getElementById(nid);
    if (im) { if (url) { im.src = url; im.style.display = ""; } else { im.removeAttribute("src"); im.style.display = "none"; } }
    if (no) no.style.display = url ? "none" : "";
  });
}
function coStatus(msg, ok) {
  const el = document.getElementById("coStatus"); if (!el) return;
  el.textContent = msg; el.style.color = ok === false ? "#e0584b" : (ok ? "#3fae6a" : "var(--muted)");
}
document.addEventListener("click", async e => {
  const b = e.target && e.target.closest && e.target.closest("#coLogoBtn, #coLogoClear, #coTcBtn, #coTcClear, #coSaveBtn");
  if (!b) return;
  if (b.id === "coLogoBtn") { const inp = document.getElementById("coLogoInput"); if (inp) inp.click(); return; }
  if (b.id === "coTcBtn") { const inp = document.getElementById("coTcInput"); if (inp) inp.click(); return; }
  if (b.id === "coTcClear") { COMPANY.tc = ""; COMPANY.tcw = 0; COMPANY.tch = 0; companyPreview(); coStatus("Test Certificate logo removed. Tap \"Save company details\" to keep this.", null); return; }
  if (b.id === "coLogoClear") { COMPANY.logo = ""; COMPANY.lw = 0; COMPANY.lh = 0; companyPreview(); coStatus("Logo removed. Tap \"Save company details\" to keep this.", null); return; }
  const val = id => { const el = document.getElementById(id); return el ? el.value : ""; };
  coApply({ name: val("coName"), short: val("coShort"), address: val("coAddress"), cml: val("coCml"), logo: COMPANY.logo, lw: COMPANY.lw, lh: COMPANY.lh, tc: COMPANY.tc, tcw: COMPANY.tcw, tch: COMPANY.tch });
  companySaveLocal(); companyFillForm();
  coStatus("Saving ...", null);
  try { await companySaveCloud(); coStatus("✅ Saved. Reports now print these details - and nothing else about the company.", true); }
  catch (err) { coStatus("Saved on this phone. OneDrive save failed: " + (err && err.message ? err.message : err), false); }
});
document.addEventListener("change", async e => {
  const fid = e.target && e.target.id;
  if (fid !== "coLogoInput" && fid !== "coTcInput") return;
  const f = e.target.files && e.target.files[0]; e.target.value = "";
  if (!f) return;
  try { await companyLogoFromFile(f, fid === "coTcInput" ? "tc" : "logo"); companyPreview(); coStatus("Logo ready. Tap \"Save company details\" to keep it.", null); }
  catch (err) { coStatus("Logo could not be used: " + (err && err.message ? err.message : err), false); }
});
/* ---- helpers the reports use ---- */
function coCmlText() { return /^\s*CM\s*\/\s*L/i.test(COMPANY.cml) ? COMPANY.cml : "CM/L- " + COMPANY.cml; }
function coTag(x) { const n = COMPANY.short || COMPANY.name; return (n ? n + "  \u00b7  " : "") + x; }   // "ABC  ·  QAD - SMS"
function coDrawLogo(doc, x, y, maxW, maxH, forTc) {   // forTc: the Test Certificate logo if one was added, else the main logo   // logo fitted inside the box, keeping its shape; prints nothing when there is no logo
  if (!reportLogoOn()) return false;   // "Logo on report" switched off
  const useTc = forTc && COMPANY.tc;
  const img = useTc ? COMPANY.tc : COMPANY.logo, iw = useTc ? COMPANY.tcw : COMPANY.lw, ih = useTc ? COMPANY.tch : COMPANY.lh;
  if (!img) return false;
  try {
    const ratio = (iw && ih) ? iw / ih : maxW / maxH;
    let w = maxW, h = w / ratio; if (h > maxH) { h = maxH; w = h * ratio; }
    doc.addImage(img, /^data:image\/jpe?g/i.test(img) ? "JPEG" : "PNG", x, y, w, h);
    return true;
  } catch (e) { return false; }   // a bad image must never break a report
}
function coFitText(doc, text, x, y, maxW, align) {   // prints the text, shrinking the font if it is wider than maxW; returns the printed width
  const size = doc.getFontSize(); let fs = size;
  while (fs > 6 && doc.getTextWidth(text) > maxW) { fs -= 0.5; doc.setFontSize(fs); }
  const w = doc.getTextWidth(text);
  doc.text(text, x, y, { align: align || "center" });
  doc.setFontSize(size);
  return w;
}

const SIGNATURE_FILE_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/signature.png:/content";
let _sigLoading = null, _sigWarned = false;
function loadSignature(force) {
  if (SIGNATURE_IMG && !force) return Promise.resolve(SIGNATURE_IMG);
  if (_sigLoading) return _sigLoading;
  _sigLoading = (async () => {
    try {
      const token = await getToken(); if (!token) return "";
      const r = await fetch(SIGNATURE_FILE_URL, { headers: { Authorization: "Bearer " + token } });
      if (!r.ok) return "";
      const blob = new Blob([await r.arrayBuffer()], { type: "image/png" });
      SIGNATURE_IMG = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
      return SIGNATURE_IMG;
    } catch (e) { console.warn("signature load failed", e); return ""; }
    finally { _sigLoading = null; }
  })();
  return _sigLoading;
}
function sigMissingWarn() {
  if (_sigWarned) return; _sigWarned = true;
  alert("Signature not found in your OneDrive, so the PDF is made without it.\nMenu (☰) → Get Started → \"✍️ Upload signature\" to upload signature.png once.");
}
async function uploadSignatureFile(file) {
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Image could not be opened")); i.src = URL.createObjectURL(file); });
    const sc = Math.min(1, 400 / img.naturalWidth);
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src);
    const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
    for (let k = 0; k < px.length; k += 4) if (px[k] > 225 && px[k + 1] > 225 && px[k + 2] > 225) px[k + 3] = 0; // white paper -> transparent
    g.putImageData(d, 0, 0);
    const blob = await new Promise(res => c.toBlob(res, "image/png"));
    const token = await getToken(); if (!token) return;
    const r = await fetch(SIGNATURE_FILE_URL, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "image/png" }, body: blob });
    if (!r.ok) throw new Error("OneDrive upload failed (" + r.status + ")");
    SIGNATURE_IMG = c.toDataURL("image/png"); _sigWarned = false;
    alert("✅ Signature saved in your OneDrive (Apps folder). TC / BIS PDFs and SOP prints will now use it.");
  } catch (e) { alert("Signature upload failed: " + (e && e.message ? e.message : e)); }
}
document.addEventListener("click", e => {
  if (e.target.closest && e.target.closest("#navDrawerSignature")) { const inp = document.getElementById("signatureFileInput"); if (inp) inp.click(); }
});
document.addEventListener("change", e => {
  if (e.target && e.target.id === "signatureFileInput") { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) uploadSignatureFile(f); }
});

const graphScopes = ["Files.ReadWrite", "User.Read"];

// If the MSAL script fails to load (e.g. SRI integrity mismatch, CDN blocked,
// or offline), `msal` is undefined. Fail loudly on the page instead of silently.
if (typeof msal === "undefined") {
  let box = document.getElementById("status");
  if (!box) { box = document.createElement("div"); box.style.cssText = "padding:16px;color:#b00020;font-weight:600;"; document.body.prepend(box); }
  box.className = "err";
  box.textContent =
    "Microsoft sign-in library (MSAL) failed to load. Possible reasons: the script's " +
    "integrity/SRI check failed, the CDN is blocked, or there's no internet. " +
    "Reload the page; if it still fails, check your network/CDN.";
  throw new Error("MSAL failed to load (msal is undefined) — SRI mismatch or CDN/network issue.");
}

const msalInstance = new msal.PublicClientApplication(msalConfig);
let account = null;
// Only these Microsoft accounts may use the app (compared in lower case).
const ALLOWED_EMAILS = [];   // the owner's own accounts - filled in from the PRIVATE access server after sign-in (never kept in this public code)
function accountEmail(acc) {
  if (!acc) return "";
  const c = acc.idTokenClaims || {};
  return String(acc.username || c.preferred_username || c.email || "").trim().toLowerCase();
}
// Team members who may only LOOK at reports (no download, share, print, copy or Excel changes).
// Filled in for the owner from the private access server - no e-mail addresses are kept in this public code.
const VIEWER_EMAILS = [];
// accounts that were given access once - "Remove team access" takes it back from OneDrive (list also comes from the access server)
const TEAM_REVOKE_EMAILS = [];
function applyOwnerCfg(cfg) {   // the owner's private lists, sent by the access server only after it verified the owner's Microsoft sign-in
  if (!cfg) return;
  [[ALLOWED_EMAILS, cfg.owners], [VIEWER_EMAILS, cfg.viewers], [TEAM_REVOKE_EMAILS, cfg.revoke]].forEach(([arr, src]) => {
    if (Array.isArray(src)) { arr.length = 0; src.forEach(x => arr.push(String(x).toLowerCase())); }
  });
  try { localStorage.setItem("ownerCfg", JSON.stringify({ owners: ALLOWED_EMAILS, viewers: VIEWER_EMAILS, revoke: TEAM_REVOKE_EMAILS })); } catch (e) {}
  const l = document.getElementById("teamEmailsList"); if (l) l.textContent = TEAM_REVOKE_EMAILS.join(", ");
}
try { const c = JSON.parse(localStorage.getItem("ownerCfg") || "null"); if (c) applyOwnerCfg(c); } catch (e) {}   // owner's device only
// The role (owner / viewer / user) is decided ONLY by the private access server, which asks Microsoft who the
// signed-in person really is. The phone just remembers the answer for a while so the app also opens offline.
const ROLE_CACHE_MS = 7 * 24 * 60 * 60 * 1000;          // 7 days
const ROLE_CACHE_OWNER_MS = 90 * 24 * 60 * 60 * 1000;   // 90 days
const _roleMem = {};
function accountRole(acc) {
  const e = accountEmail(acc);
  if (!e) return "";
  const m = _roleMem[e];
  if (m && Date.now() - m.t < 5000) return m.r;
  let r = "";
  try {
    const o = JSON.parse(localStorage.getItem("roleCache:" + e) || "null");
    if (o && (o.r === "owner" || o.r === "viewer" || o.r === "user") && o.t > 1700000000000 && o.t < Date.now() + 86400000 &&
        (Date.now() - o.t) < (o.r === "owner" ? ROLE_CACHE_OWNER_MS : ROLE_CACHE_MS)) r = o.r;
  } catch (x) {}
  _roleMem[e] = { r: r, t: Date.now() };
  return r;
}
/* ---- Private access server (the owner's Apps Script). Its link is NOT a secret: every call needs a valid
   Microsoft sign-in that Microsoft itself confirms, and the owner tools also need the owner's private key. ---- */
const ACCESS_URL = "https://script.google.com/macros/s/AKfycbwme6XZoDPZAMSd3cg44CI6AnPDTx3hes0EPL3rcyHIaZPtUlpl6TSPb0LCkGjunW94/exec";   // the SMS Access Apps Script web-app URL (…/exec)
function accessUrl() { try { return ACCESS_URL || localStorage.getItem("accessUrl") || ""; } catch (e) { return ACCESS_URL; } }
function isUserMode() { try { return !!account && accountRole(account) === "user"; } catch (e) { return false; } }
// Market tile: every account allowed to sign in to the app (owner, granted users, view-only team) - 24-Nov-2026
// (until then only the owner and a short list of granted e-mails)
function canMarket() { try { return !!account && ["owner", "user", "viewer"].includes(accountRole(account)); } catch (e) { return false; } }
async function refreshMarketAccess() { document.body.classList.toggle("mktAllowed", canMarket()); }
let _authTok = null;
async function authToken(a) {   // a Microsoft token for "User.Read" ONLY (just enough for the server to ask "who is this?")
  if (_authTok && _authTok.id === a.homeAccountId && _authTok.exp - Date.now() > 300000) return _authTok.t;
  const res = await msalInstance.acquireTokenSilent({ scopes: ["User.Read"], account: a, forceRefresh: true });
  _authTok = { id: a.homeAccountId, t: res.accessToken, exp: res.expiresOn ? res.expiresOn.getTime() : Date.now() + 1800000 };
  return _authTok.t;
}
async function authCall(params, acc) {   // POST (so nothing sensitive ever sits in a URL) to the access server
  const url = accessUrl();
  if (!url) throw new Error("access server not set up");
  const a = acc || account;
  if (!a) throw new Error("not signed in");
  const token = await authToken(a);
  const r = await fetch(url, { method: "POST", body: new URLSearchParams(Object.assign({}, params, { token })), cache: "no-store", credentials: "omit" });
  return await r.json();
}
/* ---- ⚙️ Tiles per granted account (26-Nov-2026): the owner un-ticks tiles in Get Started → App Access → ⚙️; the access
   server keeps the list (entry.hide) and hands it to that account in "whoami"; the app then hides those tiles. ---- */
function accessTiles() {
  const EXTRA_TILES = [{ id: "fetch", label: "📥 Fetch WhatsApp (bottom button)" }];   // every tile a granted account could open: the menu's tiles minus owner-only ones (Market is open to all)
  const seen = new Set(), out = [];
  document.querySelectorAll(".navItem[data-section]").forEach(b => {
    const id = b.dataset.section;
    if (seen.has(id) || !/^[a-z0-9]{1,30}$/.test(id) || (b.classList.contains("ownerOnly") && id !== "marketdash")) return;
    seen.add(id);
    const lab = b.querySelector(".navLabel"), ic = b.querySelector(".navIcon");
    // picture icons (ERP, calendar, Sheet, Nifty) get an emoji here
    const icon = ({ erpprod: "🏭", nextday: "📅", msheet: "📗", marketdash: "📈" })[id] || (ic && !ic.querySelector("img,.liveCal") ? ic.textContent.trim() : "");
    const name = String((lab && (lab.dataset.en || lab.textContent)) || id).replace(/\s+/g, " ").trim();
    out.push({ id, label: (icon ? icon + " " : "") + name });
  });
  return out.concat(EXTRA_TILES);
}
function tileHideApply() {
  let hide = [];
  try {
    const r = account ? accountRole(account) : "";
    if (r === "user" || r === "viewer") hide = JSON.parse(localStorage.getItem("tileHide:" + accountEmail(account)) || "[]");
  } catch (e) {}
  hide = (Array.isArray(hide) ? hide : []).filter(t => /^[a-z0-9]{1,30}$/.test(t));
  let st = document.getElementById("tileHideStyle");
  if (!hide.length) { if (st) st.remove(); return; }
  if (!st) { st = document.createElement("style"); st.id = "tileHideStyle"; document.head.appendChild(st); }
  st.textContent = hide.map(t => t === "fetch" ? "#bottomTabFetch,#waFetchBtn{display:none!important}"
    : `.navItem[data-section="${t}"],[data-tab-section="${t}"],#section-${t}{display:none!important}`).join("\n");
  // if the page now open is one of them, go back home
  try { const open = document.querySelector(".sectionPanel:not(.hidden)"); if (open && hide.includes(String(open.id).replace(/^section-/, ""))) { const h = document.querySelector('#bottomTabBar [data-tab-action="home"]'); if (h) h.click(); } } catch (e) {}
}
async function accessWho(acc) {   // "owner" | "viewer" | "user" | "none"; throws when the server can't be reached
  const j = await authCall({ action: "whoami" }, acc);
  if (!j || !j.ok) throw new Error((j && j.error) || "access server error");
  const role = (j.role === "owner" || j.role === "viewer" || j.role === "user") ? j.role : "none";
  const em = accountEmail(acc);
  try {
    if (role === "none") localStorage.removeItem("roleCache:" + em);
    else localStorage.setItem("roleCache:" + em, JSON.stringify({ r: role, t: Date.now() }));
    if (role === "user" || role === "viewer") localStorage.setItem("tileHide:" + em, JSON.stringify(Array.isArray(j.hide) ? j.hide : []));
    else localStorage.removeItem("tileHide:" + em);
    // Market dashboard links the owner shared (26-Nov-2026) - kept on this device, used when it has no link of its own
    if (j.dash && typeof j.dash === "object") localStorage.setItem("mktDashShared", JSON.stringify(j.dash)); else if (role === "none") localStorage.removeItem("mktDashShared");
  } catch (e) {}
  delete _roleMem[em];
  setTimeout(tileHideApply, 0);
  if (role === "owner") { applyOwnerCfg(j.cfg); setTimeout(() => { if (window.mzMktShare) window.mzMktShare(j.dash); }, 0); }
  return role;
}
async function accessCheck(email) { return (await accessWho(account)) !== "none"; }   // true / false; throws when the server can't be reached
const _accessAsked = new Set();
function accessAsk(acc) {
  const email = accountEmail(acc);
  _accessAsked.add(email);
  const msg = document.getElementById("signedOutMsg");
  if (msg) { msg.classList.remove("hidden"); msg.textContent = "Checking access for " + email + " ..."; }
  ["app", "signInBtn"].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add("hidden"); });
  accessWho(acc).then(role => {
    account = acc;
    if (role === "none") { blockAccount("denied"); return; }
    showSignedIn();
    logLoginEvent("Sign-in");
  }).catch(() => { account = acc; blockAccount("nocheck"); });
}
function isAllowedAccount(acc) { return accountRole(acc) !== ""; }
function isViewer() { try { return !!account && accountRole(account) === "viewer"; } catch (e) { return false; } }

/* ===================== VIEW-ONLY PROTECTION (team accounts) ===================== */
// For a viewer account: no download / share / print / copy / save-image, no Excel changes,
// a watermark with their e-mail and time over everything, and the screen goes blank when
// the app is sent to the background. The owner's accounts are never affected.
// Buttons on the pages that save a file straight away (the "Download PDF" buttons only open the
// preview, so they stay; the Download/Share inside the preview are hidden instead).
const VM_BLOCK_RE = /share|📤|📲|print|\(png\)|\(csv\)|\(excel\)|po vs actual|raw data \(|शेयर|प्रिंट/i;
function vmToast(msg) {
  let t = document.getElementById("vmToast");
  if (!t) { t = document.createElement("div"); t.id = "vmToast"; document.body.appendChild(t); }
  t.textContent = msg || "👁️ View only - download, share and print are not allowed for this account";
  t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
}
function vmIsBlockedBtn(el) {
  if (!el || !el.closest) return false;
  const b = el.closest("button, a");
  if (!b) return false;
  if (["pdfDownloadBtn", "pdfShareBtn", "bottomTabFetch"].includes(b.id)) return true;
  if (b.tagName === "A" && b.hasAttribute("download")) return true;
  if (b.closest("#pdfPreviewOverlay, #stickyJpgOverlay") && !/close/i.test(b.id + " " + b.textContent)) return true;
  const txt = (b.dataset.enText || "") + " " + (b.textContent || "") + " " + (b.title || "");
  return VM_BLOCK_RE.test(txt);
}
function vmMarkButtons() {
  if (!document.body.classList.contains("viewerMode")) return;
  document.querySelectorAll("button, a[download]").forEach(b => { if (vmIsBlockedBtn(b)) b.classList.add("vmBlocked"); });
}
function vmWatermark(email) {
  let w = document.getElementById("vmWatermark");
  if (!w) { w = document.createElement("div"); w.id = "vmWatermark"; document.body.appendChild(w); }
  const d = new Date(), pad = n => String(n).padStart(2, "0");
  const stamp = `${email} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const esc = stamp.replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="170"><text x="150" y="95" text-anchor="middle" transform="rotate(-28 150 85)" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="rgba(128,128,128,0.30)">${esc}</text></svg>`;
  w.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}
let _vmTimer = 0;
function applyViewerMode(on) {
  document.body.classList.toggle("viewerMode", !!on);
  if (on) {
    vmWatermark(accountEmail(account));
    clearInterval(_vmTimer); _vmTimer = setInterval(() => vmWatermark(accountEmail(account)), 60000);
    vmMarkButtons();
  } else {
    clearInterval(_vmTimer);
    const w = document.getElementById("vmWatermark"); if (w) w.remove();
    document.querySelectorAll(".vmBlocked").forEach(b => b.classList.remove("vmBlocked"));
  }
}
(function vmGuards() {
  const on = () => document.body && document.body.classList.contains("viewerMode") && isViewer();
  // any download / share / print button, wherever it is
  document.addEventListener("click", e => {
    if (on() && vmIsBlockedBtn(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); vmToast(); }
  }, true);
  // downloads started from code (PDF save, JPG/Excel/CSV download links)
  const dEv = EventTarget.prototype.dispatchEvent;   // file-saver libraries "click" a hidden link this way
  EventTarget.prototype.dispatchEvent = function (ev) {
    if (on() && this instanceof HTMLAnchorElement && ev && ev.type === "click" && (this.hasAttribute("download") || /^blob:|^data:/i.test(this.href || ""))) { vmToast(); return false; }
    return dEv.apply(this, arguments);
  };
  const aClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (on() && (this.hasAttribute("download") || /^blob:|^data:/i.test(this.href || ""))) { vmToast(); return; }
    return aClick.apply(this, arguments);
  };
  if (navigator.share) {
    const sh = navigator.share.bind(navigator);
    navigator.share = function () { if (on()) { vmToast(); return Promise.reject(new Error("View only")); } return sh.apply(null, arguments); };
  }
  const pr = window.print;
  window.print = function () { if (on()) { vmToast(); return; } return pr.apply(window, arguments); };
  const wo = window.open;
  window.open = function (u) { if (on() && /^blob:|^data:/i.test(String(u || ""))) { vmToast(); return null; } return wo.apply(window, arguments); };
  // no long-press "save image", no copy, no drag-out
  ["contextmenu", "copy", "cut", "dragstart"].forEach(ev => document.addEventListener(ev, e => { if (on()) { e.preventDefault(); if (ev !== "dragstart") vmToast(); } }, true));
  document.addEventListener("keydown", e => {
    if (!on()) return;
    const k = (e.key || "").toLowerCase();
    if ((e.ctrlKey || e.metaKey) && ["s", "p", "c"].includes(k)) { e.preventDefault(); vmToast(); }
    if (k === "printscreen") { try { navigator.clipboard.writeText(""); } catch (x) {} vmToast("👁️ Screenshots are not allowed for this account"); }
  }, true);
  // blank screen in the app switcher / when the app goes to the background
  document.addEventListener("visibilitychange", () => {
    if (!on()) return;
    document.body.classList.toggle("vmShield", document.visibilityState === "hidden");
  });
  // no Excel changes: every Microsoft Graph call that would write is stopped here
  const f = window.fetch;
  window.fetch = function (input, init) {
    try {
      if (isViewer() && typeof input === "string" && /^https:\/\/graph\.microsoft\.com\//i.test(input) && _teamMap) {
        input = teamRewriteUrl(input);                      // team: read the owner's shared files
        if (init && typeof init.body === "string" && /\/\$batch$/.test(input.split("?")[0])) init = { ...init, body: teamRewriteBatchBody(init.body) };
      }
      if (isViewer()) {
        const url = String(typeof input === "string" ? input : (input && input.url) || "");
        const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
        if (/^https:\/\/graph\.microsoft\.com\//i.test(url) && method !== "GET") {
          let ok = false;
          if (/\/\$batch$/.test(url.split("?")[0])) {
            try { ok = (JSON.parse(init.body).requests || []).every(r => String(r.method || "GET").toUpperCase() === "GET"); } catch (x) { ok = false; }
          }
          if (!ok) return Promise.reject(new Error("👁️ View-only account - changes to Excel/OneDrive are not allowed"));
        }
      }
    } catch (x) {}
    return window.__mirrorWrap ? window.__mirrorWrap(f, input, init) : f.call(this, input, init);
  };
  // buttons that appear later (reports, popups) are hidden too
  const start = () => new MutationObserver(() => { if (on()) { clearTimeout(start._t); start._t = setTimeout(vmMarkButtons, 80); } })
    .observe(document.body, { childList: true, subtree: true });
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();

/* ===================== TEAM ACCESS (owner shares, team reads) ===================== */
// Owner: "Team Setup" (File Location page) shares the report files VIEW-ONLY with
// VIEWER_EMAILS and writes a small map (which file is where) to the owner's OneDrive.
// The map's address goes into team.json, uploaded once to the website repo.
// Team account: reads team.json + the map, then every "/me/drive/..." request of
// the app is pointed at the owner's shared file instead of the team member's own drive.
const TEAM_GRAPH = "https://graph.microsoft.com/v1.0";
const TEAM_MAP_PATH = "SMS_Team_Map.json";            // in the owner's app folder
const VIEWER_SCOPES = ["Files.Read.All", "User.Read"]; // read files shared with them
let _team = null, _teamLoad = null, _teamMap = null, _teamMapLoad = null;

function teamLoad() {
  if (!_teamLoad) _teamLoad = fetch("./team.json?t=" + Date.now(), { cache: "no-store" })
    .then(r => r.ok ? r.json() : null).then(j => { _team = j; return j; }).catch(() => null);
  return _teamLoad;
}
function teamAuthority() {
  return _team && _team.tid ? "https://login.microsoftonline.com/" + _team.tid : undefined;
}
async function teamMapLoad(token) {
  if (_teamMap) return _teamMap;
  if (!_teamMapLoad) _teamMapLoad = (async () => {
    await teamLoad();
    if (!_team || !_team.driveId || !_team.mapId) throw new Error("Team access is not set up yet (team.json missing) - ask Durgesh to run Team Setup.");
    const r = await fetch(`${TEAM_GRAPH}/drives/${_team.driveId}/items/${_team.mapId}/content`, { headers: { Authorization: "Bearer " + token } });
    if (!r.ok) throw new Error(`Can't open the shared report list (${r.status}) - open the OneDrive invitation e-mail once, then try again.`);
    _teamMap = await r.json();
    return _teamMap;
  })().catch(e => { _teamMapLoad = null; throw e; });
  return _teamMapLoad;
}
function teamFind(path) {
  const items = (_teamMap && _teamMap.items) || [];
  const p = path.toLowerCase();
  let best = null;
  for (const it of items) {
    const ip = it.path.toLowerCase();
    if (p === ip) return { it, rest: "" };
    if (it.folder && p.startsWith(ip + "/") && (!best || ip.length > best.it.path.length)) best = { it, rest: path.slice(it.path.length + 1) };
  }
  return best;
}
// "/me/drive/root:/Desktop/x.xlsx:/workbook/..." -> the owner's shared item
function teamRewriteUrl(url) {
  if (!_teamMap || !_teamMap.driveId) return url;
  const d = _teamMap.driveId;
  const m = /^((?:https:\/\/graph\.microsoft\.com\/v1\.0)?)\/me\/drive\/root:\/([^:?]*)(.*)$/.exec(url);
  if (m) {
    let path;
    try { path = m[2].split("/").map(decodeURIComponent).join("/"); } catch (e) { return url; }
    const hit = teamFind(path);
    if (!hit) return url;
    const tail = m[3] || "";
    if (!hit.rest) return `${m[1]}/drives/${d}/items/${hit.it.id}${tail.startsWith(":") ? tail.slice(1) : tail}`;
    const enc = hit.rest.split("/").map(encodeURIComponent).join("/");
    return `${m[1]}/drives/${d}/items/${hit.it.id}:/${enc}${tail}`;
  }
  return url.replace(/^((?:https:\/\/graph\.microsoft\.com\/v1\.0)?)\/me\/drive\/items\//, `$1/drives/${d}/items/`);
}
function teamRewriteBatchBody(body) {
  try {
    const j = JSON.parse(body);
    (j.requests || []).forEach(r => { if (r && r.url) r.url = teamRewriteUrl(r.url); });
    return JSON.stringify(j);
  } catch (e) { return body; }
}

// ---- owner side ----
function teamCandidatePaths() {
  const paths = new Set(["Desktop/MIPPL"]);
  try { paths.add(INWARD_RM_FILE_PATH); } catch (e) {}
  try { paths.add(DEBIT_NOTE_FILE_PATH); } catch (e) {}
  const v = id => { const el = document.getElementById(id); return el && el.value ? el.value.trim() : ""; };
  [v("ecFilePath"), v("filePath"), localStorage.getItem("fixedFilePath") || ""].forEach(x => { if (x) paths.add(x); });
  ["Party_Wise_Test_Reports.xlsx", "Desktop/Party_Wise_Test_Reports.xlsx"].forEach(x => paths.add(x));
  const now = new Date();
  for (let k = -1; k <= 13; k++) {                       // monthly report files lying on the Desktop
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const mn = ["January","February","March","April","May","June","July","August","September","October","November","December"][d.getMonth()];
    const yy = String(d.getFullYear()).slice(2);
    [`${mn}'${yy}_Reports.xlsx`, `${mn}'${yy}_Report.xlsx`].forEach(n => paths.add(`Desktop/${n}`));
  }
  return [...paths];
}
// One person at a time (one refusal can't block the others); if Microsoft refuses
// the version with an e-mail, it is tried once more without the e-mail.
async function teamInviteOne(token, itemId, email) {
  const body = (send) => JSON.stringify({ recipients: [{ email }], roles: ["read"], requireSignIn: true, sendInvitation: send,
    ...(send ? { message: "Moltrix - view-only access" } : {}) });
  try { await graphFetch(`${TEAM_GRAPH}/me/drive/items/${itemId}/invite`, token, { method: "POST", body: body(true) }); return { ok: true }; }
  catch (e1) {
    try { await graphFetch(`${TEAM_GRAPH}/me/drive/items/${itemId}/invite`, token, { method: "POST", body: body(false) }); return { ok: true, noMail: true }; }
    catch (e2) { return { ok: false, err: String(e2.message || e2).replace(/^Graph API error \((\d+)\):\s*/, "$1 ").slice(0, 110).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]) }; }
  }
}
async function teamInvite(token, itemId) {
  const res = {};
  for (const em of VIEWER_EMAILS) res[em] = await teamInviteOne(token, itemId, em);
  if (!Object.values(res).some(r => r.ok)) throw new Error(Object.entries(res).map(([k, r]) => `${k}: ${r.err}`).join(" | "));
  return res;
}
// The file list lives inside the shared MIPPL folder when there is one, so it is
// shared together with the reports (no separate sharing needed).
async function teamWriteMap(token, map) {
  const folder = (map.items || []).find(it => it.folder && it.path.toLowerCase() === "desktop/mippl");
  const url = folder
    ? `${TEAM_GRAPH}/me/drive/items/${folder.id}:/${TEAM_MAP_PATH}:/content`
    : `${TEAM_GRAPH}/me/drive/special/approot:/${TEAM_MAP_PATH}:/content`;
  const item = await graphFetch(url, token, { method: "PUT", body: JSON.stringify(map, null, 1) });
  item._inShared = !!folder;
  return item;
}
function teamSaveLocal(map) { try { localStorage.setItem("teamMapCache", JSON.stringify(map)); } catch (e) {} }
(function teamSetupUi() {
  const b = document.getElementById("teamRevokeBtn"), l = document.getElementById("teamEmailsList");
  if (l) l.textContent = TEAM_REVOKE_EMAILS.join(", ");
  if (b) b.addEventListener("click", () => { if (confirm("Remove OneDrive access to the report files for:\n" + TEAM_REVOKE_EMAILS.join("\n") + " ?")) runTeamRevoke(); });
})();
// Owner: take back every OneDrive permission given to the team accounts and delete the file list.
async function runTeamRevoke() {
  const out = document.getElementById("teamSetupResult");
  const say = (h) => { if (out) out.innerHTML = h; };
  if (isViewer()) return;
  try {
    const token = await getToken(); if (!token) return;
    say("⏳ Finding the shared files...");
    const targets = TEAM_REVOKE_EMAILS.map(e => e.toLowerCase());
    const got = await Promise.all(teamCandidatePaths().map(pth => tryGetItem(token, pth).then(it => it ? { path: pth, id: it.id, folder: !!it.folder } : null)));
    const items = []; got.forEach(x => { if (x && !items.some(f => f.id === x.id)) items.push(x); });
    const lines = []; let removed = 0;
    for (let i = 0; i < items.length; i++) {
      say(`⏳ Removing access (${i + 1}/${items.length}): ${items[i].path}`);
      let n = 0, fail = "";
      try {
        const perms = await graphFetch(`${TEAM_GRAPH}/me/drive/items/${items[i].id}/permissions`, token, { noCache: true });
        for (const pm of (perms.value || [])) {
          if (pm.inheritedFrom) continue;
          const mails = JSON.stringify([pm.grantedToV2, pm.grantedTo, pm.grantedToIdentitiesV2, pm.grantedToIdentities, pm.invitation]).toLowerCase();
          if (!targets.some(t => mails.includes(t))) continue;
          try { await graphFetch(`${TEAM_GRAPH}/me/drive/items/${items[i].id}/permissions/${pm.id}`, token, { method: "DELETE" }); n++; }
          catch (e) { fail = String(e.message || e).slice(0, 100); }
        }
      } catch (e) { fail = String(e.message || e).slice(0, 100); }
      removed += n;
      lines.push(`${fail ? "❌" : "✅"} ${items[i].path.replace(/</g, "&lt;")} - ${n} removed${fail ? ": " + fail.replace(/</g, "&lt;") : ""}`);
    }
    // the file list (inside MIPPL or in the app folder)
    const mippl = items.find(it => it.folder && it.path.toLowerCase() === "desktop/mippl");
    for (const u of [mippl ? `${TEAM_GRAPH}/me/drive/items/${mippl.id}:/${TEAM_MAP_PATH}` : null, `${TEAM_GRAPH}/me/drive/special/approot:/${TEAM_MAP_PATH}`].filter(Boolean)) {
      try { const it = await graphFetch(u, token, { noCache: true }); await graphFetch(`${TEAM_GRAPH}/me/drive/items/${it.id}`, token, { method: "DELETE" }); lines.push("✅ team file list deleted"); } catch (e) {}
    }
    try { localStorage.removeItem("teamMapCache"); } catch (e) {}
    say(`<div style="margin-bottom:6px;"><b>Team access removed</b> (${removed} permission${removed === 1 ? "" : "s"}) for: ${TEAM_REVOKE_EMAILS.join(", ")}</div>` +
      `<div style="max-height:200px;overflow:auto;font-size:12px;line-height:1.55;">${lines.join("<br>")}</div>`);
  } catch (e) { say(`❌ ${String(e.message || e).replace(/</g, "&lt;")}`); }
}
// A new month file made by "Create Next Month File" is shared with the team automatically.
async function teamAfterNewFile(path, id, token) {
  let map = null;
  try { map = JSON.parse(localStorage.getItem("teamMapCache") || "null"); } catch (e) {}
  if (!map || !map.items || !VIEWER_EMAILS.length) return;
  const inFolder = map.items.some(it => it.folder && path.toLowerCase().startsWith(it.path.toLowerCase() + "/"));
  if (!inFolder) {
    await teamInvite(token, id);
    map.items.push({ path, id, folder: false });
  }
  map.updated = new Date().toISOString();
  await teamWriteMap(token, map);
  teamSaveLocal(map);
}
function blockAccount(reason) {
  const acc = account;
  if (!reason && acc && accountRole(acc) === "" && accessUrl() && !_accessAsked.has(accountEmail(acc))) { accessAsk(acc); return; }
  if (reason === "revoked") { try { localStorage.removeItem("roleCache:" + accountEmail(acc)); delete _roleMem[accountEmail(acc)]; } catch (e) {} }
  try { logLoginEvent("Blocked", acc); } catch (e) {}
  account = null; cachedAccessToken = null; cachedTokenExpiry = 0; SIGNATURE_IMG = "";
  try { localStorage.removeItem("lastSignedInAccountId"); sessionStorage.removeItem("pendingResume"); } catch (e) {}
  const hide = id => { const el = document.getElementById(id); if (el) el.classList.add("hidden"); };
  hide("app"); hide("quickInsightsBanner"); hide("signOutBtn"); hide("navDrawerSignOut");
  const sib = document.getElementById("signInBtn"); if (sib) sib.classList.add("hidden");
  const msg = document.getElementById("signedOutMsg");
  if (msg) {
    const em = accountEmail(acc).replace(/[&<>"']/g, ch => "&#" + ch.charCodeAt(0) + ";");
    msg.classList.remove("hidden");
    msg.innerHTML = '<div style="font-weight:700;color:#b00020;font-size:15px;margin-bottom:8px;">⛔ Access denied</div>' +
      (reason === "viewerApp"
        ? '<div>This team account (<b>' + em + '</b>) can open reports only in the <b>SMS Viewer</b> app on Android (or Safari on iPhone / iPad).</div>'
        : reason === "nocheck" ? '<div>Could not check access for <b>' + em + '</b> (no internet?). Please try again.</div>'
        : reason === "revoked" ? '<div>Access for <b>' + em + '</b> has been removed by the owner.</div>'
        : '<div>This account (<b>' + em + '</b>) is not allowed to use this app. Ask Durgesh Mishra for access.</div>') +
      '<div id="deniedWho" style="font-size:12.5px;margin-top:8px;opacity:.9;"></div>' +
      '<button id="deniedSignOutBtn" type="button" style="margin-top:12px;">Sign out / use another account</button>';
    // which e-mail Microsoft confirms for this sign-in - the access server checks exactly this one
    if (acc && reason !== "nocheck") (async () => {
      try {
        const t = await authToken(acc);
        const r = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", { headers: { Authorization: "Bearer " + t } });
        if (!r.ok) return;
        const j = await r.json(), work = t.split(".").length === 3;
        const upn = String(j.userPrincipalName || "").trim().toLowerCase(), mail = String(j.mail || "").trim().toLowerCase();
        const checked = work ? upn : (mail || upn), esc = x => String(x).replace(/[&<>"']/g, ch => "&#" + ch.charCodeAt(0) + ";");
        const el = document.getElementById("deniedWho"); if (!el || !checked) return;
        el.innerHTML = 'Microsoft confirms this sign-in as: <b>' + esc(checked) + '</b>' +
          (checked !== String(accountEmail(acc)).toLowerCase() ? '<br>⚠️ This is <b>not</b> the e-mail shown above - add <b>' + esc(checked) + '</b> in Get Started → App Access.' : '') +
          '<br><span style="opacity:.75;">(mail: ' + esc(mail || "-") + ' · sign-in name: ' + esc(upn || "-") + ')</span>';
      } catch (e) {}
    })();
    document.getElementById("deniedSignOutBtn").addEventListener("click", () => {
      msalInstance.logoutRedirect({ account: acc }).catch(() => location.reload());
    });
  }
}
let cachedAccessToken = null;
let cachedTokenExpiry = 0;

/* ===================== SIDEBAR NAV ===================== */
document.querySelectorAll("#mainSidebar > .navItem").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#mainSidebar > .navItem").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".sectionPanel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("section-" + btn.dataset.section).classList.remove("hidden");

    // App-like navigation: hide the tab grid (home screen), show this
    // section full-page, and scroll to the top of it.
    document.getElementById("mainSidebar").classList.add("hidden");
    document.getElementById("contentArea").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" });

    // Some sections (Reports, Dashboard, Trend Charts, Production Update)
    // have their own internal icon-grid - always reset each back to its
    // grid view whenever that section is (re-)entered from the main menu.
    const subNavResets = {
      reports: ["reportsSubNav", "reportsSubContent"],
      dashboard: ["dashboardSubNav", "dashboardSubContent"],
      trends: ["trendsSubNav", "trendsSubContent"],
      whatsapp: ["whatsappSubNav", "whatsappSubContent"],
      iso9001: ["iso9001SubNav", "iso9001SubContent"],
      element: ["elementSubNav", "elementSubContent"],
      marketdash: ["marketSubNav", "marketSubContent"],
      stock: ["stockSubNav", "stockSubContent"],
      aop: ["aopSubNav", "aopSubContent"],
      erpprod: ["erpSubNav", "erpSubContent"]
    };
    const reset = subNavResets[btn.dataset.section];
    if (reset) {
      const [subNavId, subContentId] = reset;
      document.querySelectorAll("#" + subNavId + " .navItem").forEach(b => b.classList.remove("active"));
      document.querySelectorAll("#" + subContentId + " .sub-sectionPanel").forEach(p => p.classList.add("hidden"));
      document.getElementById(subContentId).classList.add("hidden");
      document.getElementById(subNavId).classList.remove("hidden");
    }

    // SI Debit Note pulls straight from Outlook, so refresh it automatically
    // every time this section is opened - no manual button press needed to
    // see newly-arrived Debit Note emails.
    if (btn.dataset.section === "debitnote") {
      loadDebitNoteData();
    }
    if (btn.dataset.section === "partyreports") {
      loadPartyReportList();
    }
  });
});

// Home-screen tiles show their name only as a brief 1-second flash - on
// hover (desktop) or the moment a finger touches the tile (mobile, before
// the tap's own click navigates away) - since the tile itself now shows
// only a big icon.
document.querySelectorAll("#mainSidebar > .navItem").forEach(btn => {
  const label = btn.querySelector(".navLabel");
  if (!label) return;
  let hideTimer = null;
  const flashLabel = () => {
    label.classList.add("showTooltip");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => label.classList.remove("showTooltip"), 1000);
  };
  btn.addEventListener("mouseenter", flashLabel);
  btn.addEventListener("touchstart", flashLabel, { passive: true });
  btn.addEventListener("mouseleave", () => {
    clearTimeout(hideTimer);
    label.classList.remove("showTooltip");
  });
});

document.getElementById("backToMenuBtn").addEventListener("click", () => {
  document.getElementById("contentArea").classList.add("hidden");
  document.getElementById("mainSidebar").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
});

