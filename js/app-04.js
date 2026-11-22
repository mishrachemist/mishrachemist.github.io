/* ===================== FINGERPRINT SIGN-IN ===================== */
// When set up, "Sign Out" no longer does a full Microsoft sign-out - it
// just locks the app locally (the MSAL account/token cache stays intact),
// and a fingerprint (or face) unlock brings the person straight back in
// with a fresh silent token, no password re-entry needed. If fingerprint
// isn't set up, Sign Out behaves exactly as before (a real Microsoft
// sign-out).
const FP_SIGNIN_CRED_KEY = "fpSignInCredId";
const FP_LOCAL_LOCK_KEY = "fpLocallyLocked";

// Fingerprint Sign-In is switched OFF (removed from the menu). Any old
// setup saved on this device is cleared, and Sign Out is always a normal
// Microsoft sign-out.
function hasFpSignIn() { return false; }
try { localStorage.removeItem(FP_SIGNIN_CRED_KEY); localStorage.removeItem(FP_LOCAL_LOCK_KEY); } catch (e) {}

function showFpLockedScreen() {
  document.getElementById("app").classList.add("hidden");
  document.getElementById("signedOutMsg").classList.add("hidden");
  document.getElementById("fpLockedMsg").classList.remove("hidden");
  document.getElementById("signInBtn").classList.add("hidden");
  document.getElementById("signOutBtn").classList.add("hidden");
  document.getElementById("fpLockedError").textContent = "";
}

async function tryFpUnlock() {
  const credId = localStorage.getItem(FP_SIGNIN_CRED_KEY);
  if (!credId) return;
  const errEl = document.getElementById("fpLockedError");
  errEl.textContent = "";
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const rawId = Uint8Array.from(atob(credId), c => c.charCodeAt(0));
    await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: rawId, type: "public-key" }],
        userVerification: "required",
        timeout: 30000
      }
    });
    // Fingerprint confirmed - the Microsoft account is still cached from
    // before, so this gets a fresh token silently, with no Microsoft page
    // and no password.
    localStorage.removeItem(FP_LOCAL_LOCK_KEY);
    document.getElementById("fpLockedMsg").classList.add("hidden");
    await getToken();
    showSignedIn();
  } catch (e) {
    errEl.textContent = "Fingerprint not recognised - try again, or sign in with Microsoft.";
  }
}
document.getElementById("fpUnlockBtn").addEventListener("click", tryFpUnlock);

document.getElementById("fpUseMicrosoftInsteadBtn").addEventListener("click", async () => {
  // A genuine full sign-out, then the normal Microsoft sign-in flow.
  localStorage.removeItem(FP_LOCAL_LOCK_KEY);
  try {
    localStorage.removeItem("lastSignedInAccountId");
    await msalInstance.logoutRedirect({ account });
  } catch (e) {
    alert("Sign-out failed: " + e.message);
  }
});

// (The initial "is the app locally locked" check happens inside init(),
// since it needs to run before the cached-account auto-restore, not after.)

async function openFpSignInSetup() {
  const body = document.getElementById("fpSignInSetupBody");
  const hasFp = hasFpSignIn();
  document.getElementById("fpSignInSetupOverlay").classList.remove("hidden");
  body.innerHTML = `<p style="font-size:13px;color:var(--muted);">Checking this device...</p>`;

  // isUserVerifyingPlatformAuthenticatorAvailable checks for actual
  // biometric/PIN hardware on THIS device (fingerprint reader, Windows
  // Hello, Face ID, etc.) - many laptops without a fingerprint reader will
  // fail this check even though window.PublicKeyCredential itself exists,
  // so relying on that alone would offer a setup button that can't work.
  let platformAvailable = false;
  if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
    try { platformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (e) { /* treat as unavailable */ }
  }

  if (!platformAvailable) {
    body.innerHTML = `<p style="font-size:13px;color:var(--muted);">
        This device doesn't have fingerprint, face, or PIN unlock hardware
        available to the browser, so Fingerprint Sign-In can't be set up
        here. "Sign Out" on this device will keep working the normal way -
        a full Microsoft sign-out, then sign in again with your password.
        This is per-device, so setting it up on your phone (if it has
        fingerprint/face unlock) won't be affected.
      </p>
      <button class="secondary" id="fpSetupCloseBtn" style="width:100%;margin-top:10px;">Close</button>`;
  } else {
    body.innerHTML =
      `<p style="font-size:13px;color:${hasFp ? "var(--good)" : "var(--muted)"};font-weight:600;">Fingerprint Sign-In is currently ${hasFp ? "ON" : "OFF"} on this device.</p>` +
      `<button class="secondary" id="fpSetupEnableBtn" style="width:100%;margin-bottom:10px;">${hasFp ? "Redo Fingerprint Setup" : "Set Up Fingerprint Sign-In"}</button>` +
      (hasFp ? `<button class="secondary" id="fpSetupDisableBtn" style="width:100%;margin-bottom:10px;">Turn Off</button>` : "") +
      `<button class="secondary" id="fpSetupCloseBtn" style="width:100%;margin-top:4px;">Close</button>`;
  }
  wireFpSignInSetupButtons();
}

function wireFpSignInSetupButtons() {
  const closeBtn = document.getElementById("fpSetupCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", () => document.getElementById("fpSignInSetupOverlay").classList.add("hidden"));

  const disableBtn = document.getElementById("fpSetupDisableBtn");
  if (disableBtn) disableBtn.addEventListener("click", () => {
    localStorage.removeItem(FP_SIGNIN_CRED_KEY);
    openFpSignInSetup();
  });

  const enableBtn = document.getElementById("fpSetupEnableBtn");
  if (enableBtn) enableBtn.addEventListener("click", async () => {
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Moltrix" },
          user: { id: userId, name: "sms-reports-user", displayName: "Moltrix User" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 30000
        }
      });
      const credIdB64 = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      localStorage.setItem(FP_SIGNIN_CRED_KEY, credIdB64);
      alert("Fingerprint Sign-In enabled - next time you tap \"Sign Out\", you'll be able to get back in with just your fingerprint.");
      openFpSignInSetup();
    } catch (e) {
      alert("Couldn't set up fingerprint sign-in: " + e.message);
    }
  });
}

document.getElementById("calendarLoadBtn").addEventListener("click", loadContributionCalendar);

async function loadContributionCalendar() {
  const statusEl = document.getElementById("status");
  statusEl.className = "wait";
  statusEl.textContent = "Loading the last 12 months of production data...";
  try {
    const token = await getToken();
    const dailyTotals = {}; // { "YYYY-MM-DD": totalProdMT }
    const outOfSpecDays = new Set(); // dates with at least one out-of-spec heat

    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - i, 1));

    // Fetch all 12 months concurrently instead of one at a time - this is
    // the main reason this report used to take so long to load.
    await Promise.all(months.map(async (d) => {
      const path = await detectFilePathForMonth(token, d.getFullYear(), d.getMonth());
      if (!path) return; // that month's file isn't available - its days just stay blank
      const wb = await resolveWorkbook(token, path);
      const data = await graphFetch(`${wb}/worksheets('Prod.')/range(address='A1:AH2000')?$select=values`, token);
      const values = data.values;
      for (let r = 0; r < values.length; r++) {
        if (typeof values[r][0] !== "number") continue;
        const iso = excelSerialToISODate(values[r][0]);
        let dayTotal = 0;
        for (let h = r; h < r + 12 && h < values.length; h++) {
          if (values[h][1] && typeof values[h][27] === "number") dayTotal += values[h][27]; // AB = Total Prod
          if (values[h][1] && checkOutOfSpec(values[h]).length > 0) outOfSpecDays.add(iso);
        }
        dailyTotals[iso] = (dailyTotals[iso] || 0) + dayTotal;
      }
    }));

    // Build a continuous day-by-day grid for the last 365 days.
    const maxVal = Math.max(1, ...Object.values(dailyTotals));
    const colorFor = (v) => {
      if (!v) return "#ebedf0";
      const ratio = v / maxVal;
      if (ratio > 0.75) return "#216e39";
      if (ratio > 0.5) return "#30a14e";
      if (ratio > 0.25) return "#40c463";
      return "#9be9a8";
    };

    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";
    const start = new Date(now);
    start.setDate(start.getDate() - 364);
    // Pad to start on a Sunday, so weeks line up into clean columns.
    const startPad = start.getDay();
    for (let p = 0; p < startPad; p++) {
      const blank = document.createElement("span");
      blank.className = "calendarCell";
      blank.style.background = "transparent";
      grid.appendChild(blank);
    }
    for (let i = 0; i < 365; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const val = dailyTotals[iso] || 0;
      const cell = document.createElement("span");
      cell.className = "calendarCell";
      cell.style.background = colorFor(val);
      let tooltip = `${iso}: ${val.toFixed(1)} MT`;
      if (outOfSpecDays.has(iso)) {
        cell.style.border = "2px solid #e63946";
        tooltip += " ⚠️ Out of spec";
      }
      cell.title = tooltip;
      grid.appendChild(cell);
    }

    document.getElementById("calendarWrap").classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = "Yearly calendar loaded - hover over a square to see that day's production.";
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

async function printTodaySummary() {
  const statusEl = document.getElementById("status");
  statusEl.className = "wait";
  statusEl.textContent = "Preparing yesterday's summary...";
  try {
    const token = await getToken();

    // "Today's Summary" means yesterday's report - if run on the 30th, it
    // should always show the 29th, regardless of whether today's own entry
    // has been made yet.
    const now = new Date();
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const today = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getDate()).padStart(2, "0")}`;

    // Yesterday might fall in the previous month's file (e.g. today is the
    // 1st) - detect the file for whichever month yesterday actually falls in.
    const path = await detectFilePathForMonth(token, yesterdayDate.getFullYear(), yesterdayDate.getMonth());
    if (!path) { statusEl.className = "err"; statusEl.textContent = `Couldn't find the file for ${today}.`; return; }
    const wb = await resolveWorkbook(token, path);
    // The other sheets this summary needs are requested at the same time.
    graphPrefetch([
      `${wb}/worksheets('Daily Stock')/range(address='A1:Q2000')?$select=values,text`,
      `${wb}/worksheets('RM Report')/range(address='A1:W2000')?$select=values`,
      `${wb}/worksheets('${encodeURIComponent(String("Daily Prod Format").replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=values,text`,
      `${wb}/worksheets('${encodeURIComponent(String("Prod.").replace(/'/g, "''"))}')/range(address='A1:AB2000')?$select=values`], token);
    const values = (await graphFetch(`${wb}/worksheets('Prod.')/range(address='A1:AR2000')?$select=values`, token)).values;

    let heatCount = 0, totalProd = 0, hotCharging = 0, bypass = 0, rhf = 0, returnQty = 0;
    let cMin = null, cMax = null, siMin = null, siMax = null, mnMin = null, mnMax = null, pMin = null, pMax = null, sMin = null, sMax = null;
    for (let i = 0; i < values.length; i++) {
      if (typeof values[i][0] === "number" && excelSerialToISODate(values[i][0]) === today) {
        // Walk rows for this date's block until the next date actually
        // starts - a hardcoded row count would bleed into tomorrow's first
        // heat whenever today has fewer than that many heats.
        for (let r = i; r < values.length; r++) {
          const rowDateVal = values[r][0];
          if (typeof rowDateVal === "number" && excelSerialToISODate(rowDateVal) !== today) break;
          const heatNo = values[r][1];
          if (!isRealHeatRow(values[r])) continue;
          heatCount++;
          totalProd += typeof values[r][27] === "number" ? values[r][27] : 0; // AB = Total Prod
          hotCharging += (typeof values[r][20] === "number" ? values[r][20] : 0); // U = HC Qty
          bypass += (typeof values[r][26] === "number" ? values[r][26] : 0); // AA = Bypass Qty
          rhf += (typeof values[r][14] === "number" ? values[r][14] : 0); // O = RHF
          returnQty += (typeof values[r][43] === "number" ? values[r][43] : 0); // AR = Return

          const c = values[r][2], si = values[r][4], mn = values[r][3], p = values[r][6], s = values[r][5];
          if (typeof c === "number") { cMin = cMin === null ? c : Math.min(cMin, c); cMax = cMax === null ? c : Math.max(cMax, c); }
          if (typeof si === "number") { siMin = siMin === null ? si : Math.min(siMin, si); siMax = siMax === null ? si : Math.max(siMax, si); }
          if (typeof mn === "number") { mnMin = mnMin === null ? mn : Math.min(mnMin, mn); mnMax = mnMax === null ? mn : Math.max(mnMax, mn); }
          if (typeof p === "number") { pMin = pMin === null ? p : Math.min(pMin, p); pMax = pMax === null ? p : Math.max(pMax, p); }
          if (typeof s === "number") { sMin = sMin === null ? s : Math.min(sMin, s); sMax = sMax === null ? s : Math.max(sMax, s); }
        }
        break;
      }
    }
    const dispatchTotal = rhf + hotCharging;

    // Total billet stock (all sizes combined) for Opening/Closing.
    const excludedSizes = ["110X6", "110X5.25"];
    const normalizeSize = s => s.toUpperCase().replace(/\s+/g, "");
    const billetSizes = await getBilletStockBySize(wb, today, today, token);
    let stockOpening = 0, stockClosing = 0;
    Object.keys(billetSizes).forEach(sz => {
      if (excludedSizes.includes(normalizeSize(sz))) return;
      const s = billetSizes[sz];
      if (s.openingQty !== null) stockOpening += s.openingQty;
      if (s.latestQty !== null) stockClosing += s.latestQty;
    });

    // Raw material incoming (Lumps/Pellets/Fines, and internal MS Scrap /
    // MS Scrap - Rolling Mill / Steel Melting Scrap) for that same day.
    let rmLumps = 0, rmPellets = 0, rmFines = 0, rmMsScrap = 0, rmMsScrapRM = 0, rmSteelMeltingScrap = 0;
    try {
      const rmData = await graphFetch(`${wb}/worksheets('RM Report')/range(address='A1:W2000')?$select=values`, token);
      rmData.values.forEach(row => {
        if (typeof row[0] === "number" && excelSerialToISODate(row[0]) === today) {
          rmLumps += (typeof row[17] === "number" ? row[17] : 0) + (typeof row[22] === "number" ? row[22] : 0); // R, W
          rmFines += (typeof row[19] === "number" ? row[19] : 0) + (typeof row[21] === "number" ? row[21] : 0); // T, V
          rmPellets += (typeof row[18] === "number" ? row[18] : 0); // S
          rmMsScrap += (typeof row[14] === "number" ? row[14] : 0); // O
          rmMsScrapRM += (typeof row[15] === "number" ? row[15] : 0); // P
          rmSteelMeltingScrap += (typeof row[13] === "number" ? row[13] : 0); // N
        }
      });
    } catch (e) { /* RM Report unavailable - leave raw material figures at 0 */ }

    // Fe(M) for Lumps/Pellets/Fines comes from "Daily Prod Format" - each
    // date's block starts with a "DATE-DD-MM-YYYY" title row, and item rows
    // follow in the fixed RM_ITEMS order (Lumps=idx4, Pellet=idx5, Fines=idx6),
    // so their Fe(M)/Grade cells sit at titleRow+11, +12, +13 in column G
    // (confirmed against an actual block: title row 1161, Lumps row 1172).
    let feLumps = "", fePellets = "", feFines = "";
    try {
      const dpfSheet = "Daily Prod Format";
      const scan = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(dpfSheet).replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=values,text`, token);
      let titleRow = -1;
      for (let i = 0; i < scan.values.length; i++) {
        const v = scan.values[i][0];
        const txt = (scan.text[i][0] || "").toString();
        if (typeof v === "number" && excelSerialToISODate(v) === today) { titleRow = i + 1; break; }
        const m = txt.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
        if (m) {
          const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
          if (iso === today) { titleRow = i + 1; break; }
        }
      }
      if (titleRow !== -1) {
        const feData = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(dpfSheet).replace(/'/g, "''"))}')/range(address='G${titleRow + 11}:G${titleRow + 13}')?$select=values`, token);
        const g = feData.values;
        if (typeof g[0][0] === "number") feLumps = g[0][0].toFixed(3);
        if (typeof g[1][0] === "number") fePellets = g[1][0].toFixed(3);
        if (typeof g[2][0] === "number") feFines = g[2][0].toFixed(3);
      }
    } catch (e) { /* Daily Prod Format unavailable - leave Fe(M) figures blank */ }

    const { flaggedHeats } = await scanOutOfSpecHeats("Prod.", today, today, null, token);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    addLogoHeader(doc);
    const pageW = doc.internal.pageSize.getWidth();
    const BLUE = [173, 199, 232], ORANGE = [252, 213, 180];
    const leftColX = 40, rightColX = 310, colW = 250;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(`DATE ${today.split("-").reverse().join("-")}`, leftColX, 30);

    // ---- LEFT COLUMN ----
    let y = 45;
    doc.autoTable({
      startY: y, margin: { left: leftColX },
      head: [[{ content: "Production", colSpan: 2, styles: { halign: "center", fillColor: BLUE, textColor: 0, fontStyle: "bold" } }]],
      body: [["Total Prod.", totalProd.toFixed(3)], ["No. of Heats", heatCount]],
      styles: { fontSize: 9, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.5 },
      theme: "grid", tableWidth: colW
    });
    y = doc.lastAutoTable.finalY + 10;

    doc.autoTable({
      startY: y, margin: { left: leftColX },
      head: [[{ content: "Chemical Composition", colSpan: 3, styles: { halign: "center", fillColor: BLUE, textColor: 0, fontStyle: "bold" } }],
             ["", "Min", "Max"]],
      body: [
        ["C %", fmt(cMin), fmt(cMax)],
        ["SI %", fmt(siMin), fmt(siMax)],
        ["MN %", fmt(mnMin), fmt(mnMax)],
        ["P %", fmt(pMin), fmt(pMax)],
        ["S %", fmt(sMin), fmt(sMax)]
      ],
      styles: { fontSize: 9, cellPadding: 5, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.5 },
      headStyles: { fontStyle: "bold" },
      columnStyles: { 0: { halign: "left" } },
      theme: "grid", tableWidth: colW
    });
    y = doc.lastAutoTable.finalY + 10;

    doc.autoTable({
      startY: y, margin: { left: leftColX },
      head: [[{ content: "Dispatch", colSpan: 2, styles: { halign: "center", fillColor: BLUE, textColor: 0, fontStyle: "bold" } }]],
      body: [
        ["External", "-"],
        ["Hot Charging", hotCharging.toFixed(3)],
        ["RHF", rhf.toFixed(3)],
        ["Return", returnQty.toFixed(3)],
        ["By pass", bypass.toFixed(3)]
      ],
      styles: { fontSize: 9, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.5 },
      theme: "grid", tableWidth: colW
    });
    y = doc.lastAutoTable.finalY + 10;

    doc.autoTable({
      startY: y, margin: { left: leftColX },
      head: [[{ content: "Stock", colSpan: 2, styles: { halign: "center", fillColor: BLUE, textColor: 0, fontStyle: "bold" } }]],
      body: [
        ["Opening", stockOpening.toFixed(3)],
        ["Production", totalProd.toFixed(3)],
        ["Return", returnQty.toFixed(3)],
        ["Dispatch", dispatchTotal.toFixed(3)],
        ["Closing", stockClosing.toFixed(3)]
      ],
      styles: { fontSize: 9, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.5 },
      theme: "grid", tableWidth: colW
    });

    // ---- RIGHT COLUMN ----
    let ry = 45;
    doc.autoTable({
      startY: ry, margin: { left: rightColX },
      head: [[{ content: "Raw material", colSpan: 1, styles: { halign: "center", fillColor: ORANGE, textColor: 0, fontStyle: "bold" } }]],
      body: [],
      styles: { fontSize: 9, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.5 },
      theme: "grid", tableWidth: colW
    });
    ry = doc.lastAutoTable.finalY + 6;

    doc.autoTable({
      startY: ry, margin: { left: rightColX },
      head: [[{ content: "External", colSpan: 4, styles: { halign: "center", fillColor: ORANGE, textColor: 0, fontStyle: "bold" } }],
             [{ content: "Sponge iron", colSpan: 4, styles: { halign: "center", fillColor: ORANGE, textColor: 0, fontStyle: "bold" } }],
             ["Party", "Item", "Fe(M)", "QTY"]],
      body: [
        ["Internal", "SI Lumps", feLumps, rmLumps.toFixed(3)],
        ["Internal", "SI Pellets", fePellets, rmPellets.toFixed(3)],
        ["Internal", "SI Fines", feFines, rmFines.toFixed(3)],
        ["", "", "", ""],
        [{ content: "Silico manganese", colSpan: 4, styles: { halign: "center", fillColor: ORANGE, textColor: 0, fontStyle: "bold" } }],
        [{ content: "Party", styles: { fontStyle: "bold" } }, { content: "Mn", styles: { fontStyle: "bold" } }, { content: "Si", styles: { fontStyle: "bold" } }, { content: "QTY", styles: { fontStyle: "bold" } }],
        ["", "", "", ""],
        ["", "", "", ""],
        [{ content: "Ramming Mass", colSpan: 4, styles: { halign: "center", fillColor: ORANGE, textColor: 0, fontStyle: "bold" } }],
        [{ content: "Party", styles: { fontStyle: "bold" } }, { content: "V. NO.", styles: { fontStyle: "bold" } }, { content: "Sio2", styles: { fontStyle: "bold" } }, { content: "QTY", styles: { fontStyle: "bold" } }],
        ["", "", "", ""],
        [{ content: "Scrap", colSpan: 4, styles: { halign: "center", fillColor: ORANGE, textColor: 0, fontStyle: "bold" } }],
        ["Steel Melting Scrap", "", "", rmSteelMeltingScrap.toFixed(3)],
        ["MS Scrap", "", "", rmMsScrap.toFixed(3)],
        ["MS Scrap - Rolling Mill", "", "", rmMsScrapRM.toFixed(3)]
      ],
      styles: { fontSize: 8.5, cellPadding: 6, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.5 },
      headStyles: { fontStyle: "bold" },
      columnStyles: { 0: { halign: "left", cellWidth: 100 } },
      theme: "grid", tableWidth: colW
    });

    stampLogoOnAllPages(doc);
    showPdfPreview(doc, `Today_Summary_${today}.pdf`, `Today's Summary (${today})`);
    statusEl.className = "ok";
    statusEl.textContent = "Today's summary is ready - check the preview.";
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("signOutBtn").addEventListener("click", async () => {
  // If Fingerprint Sign-In is set up, "Sign Out" just locks the app locally
  // - the Microsoft account/token cache stays intact, so unlocking with a
  // fingerprint later gets straight back in with no password. Without
  // fingerprint sign-in set up, this is a real, full Microsoft sign-out.
  if (hasFpSignIn()) {
    const ok = confirm("Lock the app? You'll be able to unlock it again with your fingerprint - no need to sign in with Microsoft again.");
    if (!ok) return;
    localStorage.setItem(FP_LOCAL_LOCK_KEY, "1");
    showFpLockedScreen();
    return;
  }
  const ok = confirm("Sign out? You'll need to sign in with Microsoft again to make any updates after this.");
  if (!ok) return;
  try {
    localStorage.removeItem("lastSignedInAccountId");
    await msalInstance.logoutRedirect({ account });
  } catch (e) {
    alert("Sign-out failed: " + e.message);
  }
});

// Team accounts get a read-only token for the owner's organisation (files shared with them).
async function viewerGetToken(force) {
  await teamLoad();
  const authority = teamAuthority();
  if (!force && cachedAccessToken && Date.now() < cachedTokenExpiry - 60000 && sessionStorage.getItem("viewerTokOk") === "1") {
    await teamMapLoad(cachedAccessToken);
    return cachedAccessToken;
  }
  try {
    const res = await msalInstance.acquireTokenSilent({ scopes: VIEWER_SCOPES, account, authority, forceRefresh: !!force });
    cachedAccessToken = res.accessToken;
    cachedTokenExpiry = res.expiresOn ? res.expiresOn.getTime() : Date.now() + 3300000;
    sessionStorage.setItem("viewerTokOk", "1");
    await teamMapLoad(cachedAccessToken);
    return cachedAccessToken;
  } catch (e) {
    if (/team access|shared report list/i.test(e.message || "")) throw e;
    const why = ((e && e.errorCode) ? e.errorCode + ": " : "") + String((e && (e.errorMessage || e.message)) || e).slice(0, 220);
    // one sign-in round per 3 minutes at most (no endless redirect loop)
    const last = parseInt(sessionStorage.getItem("viewerAuthTry") || "0", 10);
    if (Date.now() - last < 180000) {
      const ms = sessionStorage.getItem("msalLastError") || "";
      throw new Error("Couldn't get read access to the shared reports. Open the OneDrive invitation e-mail once, then sign in again." +
        `\n[Details for Durgesh: tenant ${(_team && _team.tid) ? String(_team.tid).slice(0, 8) + "…" : "missing"} · ${ms || why}]`);
    }
    sessionStorage.setItem("viewerAuthTry", String(Date.now()));
    sessionStorage.setItem("viewerTokOk", "1");
    await msalRedirect({ scopes: VIEWER_SCOPES, authority, loginHint: accountEmail(account) });
    return null;
  }
}
/* ----- Microsoft sign-in: safe token renewal -----
   interaction_in_progress came when (a) two parts of the app asked for a token at the same time and both went to
   Microsoft, or (b) an earlier sign-in round was left half-way (app closed on the Microsoft page), which leaves
   MSAL's "interaction in progress" mark behind. Now: one silent renewal at a time, no sign-in round for a network
   failure, and a left-over mark is cleared before a new round. */
let _msalSilentP = null, _mzRedirecting = false;
const MSAL_NET_ERR = /no_network_connectivity|post_request_failed|get_request_failed|endpoints_resolution_error|network_error|failed to fetch|timed?_?out/i;
function msalErrCode(e) { return String((e && (e.errorCode || e.name)) || "") + " " + String((e && (e.errorMessage || e.message)) || e || ""); }
function msalClearStaleInteraction() {
  for (const st of [sessionStorage, localStorage]) {
    try { Object.keys(st).filter(k => /interaction\.status/i.test(k)).forEach(k => st.removeItem(k)); } catch (e) {}
  }
}
async function msalSilent(req) {
  if (_msalSilentP) return _msalSilentP;
  _msalSilentP = (async () => {
    try { return await msalInstance.acquireTokenSilent(req); }
    catch (e) {
      if (!navigator.onLine || MSAL_NET_ERR.test(msalErrCode(e))) {   // network blip: wait and try once more, never a sign-in round
        await new Promise(r => setTimeout(r, 2000));
        try { return await msalInstance.acquireTokenSilent(req); }
        catch (e2) {
          if (!navigator.onLine || MSAL_NET_ERR.test(msalErrCode(e2))) { const x = new Error("No internet connection - please try again."); x.mzNetwork = true; throw x; }
          throw e2;
        }
      }
      throw e;
    }
  })();
  try { return await _msalSilentP; } finally { _msalSilentP = null; }
}
async function msalRedirect(req) {
  if (_mzRedirecting) return null;        // a sign-in round already started in this tab; the page is leaving
  // fingerprint lock still showing: go to Microsoft only after the unlock - leaving the page while locked made the
  // phone ask for the fingerprint a second time when the page came back
  if (document.documentElement.classList.contains("mzLocked") && typeof window.mzLockWait === "function") await window.mzLockWait();
  if (_mzRedirecting) return null;
  _mzRedirecting = true;
  try { window.mzLockLogAdd && window.mzLockLogAdd("Microsoft sign-in round (token renewal)"); } catch (e) {}
  try { await msalInstance.acquireTokenRedirect(req); }
  catch (e) {
    if (!/interaction_in_progress/i.test(msalErrCode(e))) { _mzRedirecting = false; throw e; }
    msalClearStaleInteraction();          // left-over mark from an unfinished round
    try { await msalInstance.acquireTokenRedirect(req); }
    catch (e2) { _mzRedirecting = false; throw new Error("Microsoft sign-in is busy - please close and reopen the app."); }
  }
  return null;
}
async function getToken() {
  await msalReady;
  if (account && !isAllowedAccount(account)) { blockAccount(); throw new Error("Access denied for this account"); }
  if (isViewer()) return viewerGetToken(false);
  if (cachedAccessToken && Date.now() < cachedTokenExpiry - 60000) {
    return cachedAccessToken;
  }
  try {
    const res = await msalSilent({ scopes: graphScopes, account });
    cachedAccessToken = res.accessToken;
    cachedTokenExpiry = res.expiresOn ? res.expiresOn.getTime() : Date.now() + 3300000;
    return cachedAccessToken;
  } catch (e) {
    if (e && e.mzNetwork) throw e;
    await msalRedirect({ scopes: graphScopes, account, loginHint: account ? accountEmail(account) : undefined });
    // page navigates away; nothing more to return here
    return null;
  }
}

// For long jobs (all next-day blocks etc.): a token that is still valid for at
// least minMs, renewed silently in the background if needed (no page reload).
async function getTokenFresh(minMs) {
  await msalReady;
  if (isViewer()) return viewerGetToken(false);
  if (cachedAccessToken && Date.now() < cachedTokenExpiry - (minMs || 600000)) return cachedAccessToken;
  try {
    const res = await msalSilent({ scopes: graphScopes, account, forceRefresh: true });
    cachedAccessToken = res.accessToken;
    cachedTokenExpiry = res.expiresOn ? res.expiresOn.getTime() : Date.now() + 3300000;
    return cachedAccessToken;
  } catch (e) { if (e && e.mzNetwork) throw e; return getToken(); }
}
// Called by graphFetch on a 401: renew silently and retry the same request.
async function refreshAccessToken(oldToken) {
  if (isViewer()) { try { return await viewerGetToken(true); } catch (e) { return null; } }
  if (cachedAccessToken && cachedAccessToken !== oldToken && Date.now() < cachedTokenExpiry - 60000) return cachedAccessToken;
  try {
    const res = await msalInstance.acquireTokenSilent({ scopes: graphScopes, account, forceRefresh: true });
    cachedAccessToken = res.accessToken;
    cachedTokenExpiry = res.expiresOn ? res.expiresOn.getTime() : Date.now() + 3300000;
    return cachedAccessToken;
  } catch (e) { return null; }
}

/* ===================== WHATSAPP MESSAGE FORMATS (Get Started → Message Formats) =====================
   The words the WhatsApp parser looks for are kept here, so a changed message format (or another company's format)
   can be taught to Moltrix without new code. The defaults are the words the parser always used. Saved in OneDrive
   (Apps → Moltrix → wa_formats.json), so the phone, the PC and the cloud sync all read the messages the same way. */
const WA_FMT_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/wa_formats.json:/content";
const WA_FMT_DEFAULT = {
  heat: {
    heat: ["heat", "h.no", "h no"],               // the heat number line (the number itself is D.M.N, e.g. 5.11.3)
    date: ["date"],                                // "Date 05/11" line
    chem: ["chemical report"],                     // the chemistry block starts after this line
    el: { C: ["C"], MN: ["Mn"], SI: ["Si"], S: ["S"], P: ["P"] },   // "C% = 0.18"
    hot: ["feed"],                                 // billets sent to the strip mill (hot charging)
    hotout: ["hot out"],
    bypass: ["bypass", "by pass"],                 // billets kept at the CCM
    stripmill: ["strip mill"],                     // "Strip Mill:" block / "For Strip Mill Bypass in CCM"
    remark: ["remark"]                             // reading stops at this line (free text)
  },
  cons: {
    ident: ["consumption"],
    exclude: ["power consumption"],
    date: ["date"],                                // "Date: 05/11/2026"
    mat: { lumps: ["lumps"], fines: ["fines"], pellets: ["pellets", "pellet"], steelMeltingScrap: ["steel melting scrap"],
      magMaterial: ["mag material"], rollingMillScrap: ["rolling mill scrap"], msScrap: ["M.S. Scrap"], ciMixScrap: ["CI Mix Scrap"],
      pigIron: ["pig iron"], overSizeMag: ["over size mag"] }
  },
  rhf: {
    ident: ["billet transferred", "sms to rhf"],   // all of these must be in the message
    own: ["mippl"]                                 // "(MIPPL)" after a line = our own billets; another name = a party
  }
};
const WF_CHEM_NAMES = { C: "Carbon (C)", MN: "Manganese (Mn)", SI: "Silicon (Si)", S: "Sulphur (S)", P: "Phosphorus (P)" };
const WF_MAT_NAMES = { lumps: "Lumps", fines: "Fines", pellets: "Pellets", steelMeltingScrap: "Steel melting scrap", magMaterial: "Mag material",
  rollingMillScrap: "Rolling mill scrap", msScrap: "M.S. scrap", ciMixScrap: "CI mix scrap", pigIron: "Pig iron", overSizeMag: "Over size mag" };
function waFmtMerge(o) {   // saved settings over the defaults (a missing / empty list keeps the default)
  const d = JSON.parse(JSON.stringify(WA_FMT_DEFAULT));
  const list = v => Array.isArray(v) ? v.map(x => String(x || "").trim()).filter(Boolean) : null;
  const put = (dst, src) => { if (!src || typeof src !== "object") return;
    Object.keys(dst).forEach(k => { if (Array.isArray(dst[k])) { const l = list(src[k]); if (l && l.length) dst[k] = l; } else if (dst[k] && typeof dst[k] === "object") put(dst[k], src[k]); }); };
  if (o && typeof o === "object") ["heat", "cons", "rhf"].forEach(g => put(d[g], o[g]));
  return d;
}
let WA_FMT = (() => { try { return waFmtMerge(JSON.parse(localStorage.getItem("waFormats") || "null")); } catch (e) { return waFmtMerge(null); } })();
let _waFmtP = null;
function waFmtLoad(force) {
  if (_waFmtP && !force) return _waFmtP;
  _waFmtP = (async () => {
    try {
      if (!account || (typeof isViewer === "function" && isViewer())) return false;
      const token = await getToken(); if (!token) return false;
      const r = await fetch(WA_FMT_URL, { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      if (r.status === 404) { WA_FMT = waFmtMerge(null); try { localStorage.removeItem("waFormats"); } catch (e) {} return true; }
      if (!r.ok) { _waFmtP = null; return false; }
      const o = await r.json();
      WA_FMT = waFmtMerge(o); try { localStorage.setItem("waFormats", JSON.stringify(o)); } catch (e) {}
      return true;
    } catch (e) { _waFmtP = null; return false; }
  })();
  return _waFmtP;
}
// matching helpers
function wfSquash(t) {   // "Billets  Transfered" ~ "billet transferred": lower case, no spaces / dots, plural s and double letters dropped
  return String(t || "").toLowerCase().split(/[^a-z0-9]+/).map(w => w.length > 3 ? w.replace(/s$/, "") : w).join("").replace(/(.)\1+/g, "$1");
}
function wfHas(text, words, loose) {
  const low = String(text || "").toLowerCase(), sq = loose ? wfSquash(text) : "";
  return (words || []).some(w => { w = String(w || "").trim().toLowerCase(); if (!w) return false;
    if (low.includes(w)) return true; if (!loose) return false; const s = wfSquash(w); return s.length >= 3 && sq.includes(s); });
}
function wfAll(text, words) { const l = (words || []).filter(w => String(w || "").trim()); return l.length > 0 && l.every(w => wfHas(text, [w], true)); }
function wfStarts(line, words) { const low = String(line || "").trim().toLowerCase(); return (words || []).some(w => { w = String(w || "").trim().toLowerCase(); return !!w && low.startsWith(w); }); }
// a word as a regex piece: "M.S. Scrap" -> M\.?\s*S\.?\s*\s*Scrap (dots optional, any spaces)
function wfRe(w) {
  const s = String(w || "").trim();
  const body = s.replace(/[.*+?^${}()|[\]\\]/g, m => m === "." ? "\\.?\\s*" : "\\" + m).replace(/\s+/g, "\\s*");
  return (/^\w/.test(s) ? "\\b" : "") + body;
}
function wfAlt(words) { return (words || []).filter(w => String(w || "").trim()).slice().sort((a, b) => b.length - a.length).map(wfRe).join("|") || "(?!)"; }

/* ---------- Get Started → 💬 Message Formats: the form, try-a-message, save ---------- */
(function () {
  const FIELDS = [
    { g: "Heat message (billets + chemistry)", rows: [
      ["heat.heat", "Heat number line has", "the number itself is written D.M.N, e.g. 5.11.3"],
      ["heat.date", "Date line starts with", "e.g. \"Date 05/11\""],
      ["heat.chem", "Chemistry block starts after", ""],
      ["heat.el.C", WF_CHEM_NAMES.C, "written like  C% = 0.18"], ["heat.el.MN", WF_CHEM_NAMES.MN, ""], ["heat.el.SI", WF_CHEM_NAMES.SI, ""],
      ["heat.el.S", WF_CHEM_NAMES.S, ""], ["heat.el.P", WF_CHEM_NAMES.P, ""],
      ["heat.hot", "Billets sent to the strip mill (hot charging)", "block heading"],
      ["heat.bypass", "Billets kept at the CCM (bypass)", "block heading"],
      ["heat.stripmill", "Strip mill", "\"Strip Mill:\" block, or with the bypass word: strip mill bypass"],
      ["heat.hotout", "Hot out", "block heading"],
      ["heat.remark", "Stop reading at", "free-text line, e.g. a remark"] ] },
    { g: "Raw material consumption message", rows: [
      ["cons.ident", "Message has the word", ""], ["cons.exclude", "But not when it has", "e.g. power consumption (KWH)"],
      ["cons.date", "Date line starts with", "date written dd/mm/yyyy"] ].concat(
      Object.keys(WF_MAT_NAMES).map(k => ["cons.mat." + k, WF_MAT_NAMES[k], k === "lumps" ? "written like  Lumps = 120.5" : ""])) },
    { g: "Billet transfer to RHF message", rows: [
      ["rhf.ident", "Message has ALL of these", "e.g. billets transferred ... SMS to RHF"],
      ["rhf.own", "Our own company (name in brackets)", "lines like  120 pcs 160×6m (MIPPL); another name = a party"] ] }
  ];
  const get = (o, path) => path.split(".").reduce((a, k) => a && a[k], o);
  const set = (o, path, v) => { const ks = path.split("."); let a = o; ks.slice(0, -1).forEach(k => { a = a[k] = a[k] || {}; }); a[ks[ks.length - 1]] = v; };
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const idOf = path => "wf_" + path.replace(/\./g, "_");
  const form = document.getElementById("wfForm");
  if (!form) return;
  function render(fmt) {
    form.innerHTML = FIELDS.map((grp, gi) => `<details ${gi === 0 ? "open" : ""} style="margin:10px 0;border:1px solid var(--border,#ddd);border-radius:10px;padding:8px 10px;">
      <summary style="cursor:pointer;font-weight:700;">${esc(grp.g)}</summary>
      ${grp.rows.map(([path, lab, hint]) => `<label for="${idOf(path)}" style="margin-top:10px;">${esc(lab)}${hint ? ` <span style="font-weight:400;opacity:.7;font-size:12px;">- ${esc(hint)}</span>` : ""}</label>
        <input type="text" id="${idOf(path)}" value="${esc((get(fmt, path) || []).join(", "))}" autocomplete="off" spellcheck="false">`).join("")}
    </details>`).join("");
  }
  function read() {
    const o = {};
    FIELDS.forEach(grp => grp.rows.forEach(([path]) => {
      const el = document.getElementById(idOf(path));
      set(o, path, String(el ? el.value : "").split(",").map(x => x.trim()).filter(Boolean));
    }));
    return waFmtMerge(o);   // an emptied box falls back to its default
  }
  const status = (t, cls) => { const s = document.getElementById("wfStatus"); if (s) { s.className = cls || ""; s.textContent = t || ""; } };
  async function open() {
    status("Loading the saved formats…", "wait");
    await waFmtLoad(true);
    render(WA_FMT); status("");
    const sv = document.getElementById("wfSaveBtn"); if (sv) sv.disabled = typeof isViewer === "function" && isViewer();
  }
  const tile = document.querySelector('#getStartedSubNav [data-subgs="msgformats"]');
  if (tile) tile.addEventListener("click", open);
  render(WA_FMT);

  // ---- try a message with the words in the boxes (not saved yet) ----
  const num = v => v == null ? "-" : String(v);
  const tbl = rows => `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px;">${rows.map(r =>
    `<tr>${r.map((c, i) => `<td style="border:1px solid var(--border,#ddd);padding:4px 6px;${i === 0 ? "font-weight:600;" : "text-align:center;"}">${c}</td>`).join("")}</tr>`).join("")}</table>`;
  function readMsg(text) {
    if (isRhfTransferMessage(text)) {
      const P = parseRhfTransferMessage(text);
      if (P.error) return `<b>🚚 Billet transfer to RHF</b> - but: ${esc(P.error)}`;
      const own = Object.keys(P.own).map(sz => [`Own ${sz}`, num(P.own[sz][3]), num(P.own[sz][4]), num(P.own[sz][5]), num(P.own[sz][6])]);
      const party = Object.keys(P.party).map(k => { const [n, sz] = k.split("|"); return [esc(n) + " " + sz, P.party[k] + " pcs", "", "", ""]; });
      return `<b>🚚 Billet transfer to RHF</b> · date ${esc(P.dateISO)}` + tbl([["", "3 M", "4 M", "5 M", "6 M"]].concat(own, party)) +
        (P.bad.length ? `<div style="color:#c0392b;">Not taken: ${P.bad.map(esc).join("; ")}</div>` : "");
    }
    if (isConsumptionMessage(text)) {
      const P = parseConsumptionMessage(text);
      const rows = Object.keys(WF_MAT_NAMES).map(k => [WF_MAT_NAMES[k], P.values[k] == null ? "<span style='opacity:.5'>not found</span>" : esc(P.values[k])]);
      return `<b>⛏️ Raw material consumption</b> · date ${P.iso ? esc(P.iso) : "<span style='color:#c0392b'>not found</span>"}` + tbl(rows);
    }
    const saveHint = heatDateHint; heatDateHint = null;
    const P = parseMessage(text); heatDateHint = saveHint;
    if (!P.heatKey && P.heatIssue) return `<b>🔥 Heat message</b> - but: ${esc(P.heatIssue)}`;
    if (!P.heatKey) return `<b>Not recognised</b> - this message would be skipped (no heat number, and not a consumption / RHF transfer message).`;
    const L = (o, got) => got ? [num(o[3]), num(o[4]), num(o[5]), num(o[6])] : ["-", "-", "-", "-"];
    const chemRow = ["C", "MN", "SI", "S", "P"].map(k => `${WF_CHEM_NAMES[k].replace(/ \(.*/, "")}: <b>${P.chem[k] == null ? "-" : esc(P.chem[k])}</b>`).join(" · ");
    return `<b>🔥 Heat ${esc(P.heatKey)}</b>${P.furnace ? " · furnace " + esc(P.furnace) : ""} · size ${esc(P.sz)}${P.dateLine ? ` · date ${P.dateLine.date}/${P.dateLine.month}` : ""}` +
      (P.heatFixedFrom ? `<div style="font-size:12px;opacity:.8;">heat number rebuilt from "${esc(P.heatFixedFrom)}"</div>` : "") +
      tbl([["Billets (pcs)", "3 M", "4 M", "5 M", "6 M", "Total stated"],
        ["Strip mill (hot charging)"].concat(L(P.hot, P.gotHot), [num(P.hotTotalStated)]),
        ["Bypass (CCM)"].concat(L(P.byp, P.gotByp), [num(P.bypTotalStated)]),
        ["130 × 130 (of a 160 heat)"].concat(L(P.grp130, P.got130), [num(P.grp130TotalStated)]),
        ["Hot out"].concat(L(P.hotout, P.gotHotOut), [num(P.hotoutTotalStated)])]) +
      `<div style="margin-top:6px;font-size:13px;">Chemistry - ${chemRow}</div>`;
  }
  document.getElementById("wfTestBtn").addEventListener("click", () => {
    const text = String(document.getElementById("wfTestBox").value || "").trim(), out = document.getElementById("wfTestOut");
    if (!text) { out.innerHTML = "Paste a WhatsApp message first."; return; }
    const keep = WA_FMT;
    try { WA_FMT = read(); out.innerHTML = readMsg(text); }
    catch (e) { out.innerHTML = "Could not read it: " + esc(e.message || e); }
    finally { WA_FMT = keep; }
  });
  document.getElementById("wfResetBtn").addEventListener("click", () => {
    if (!confirm("Put the default words back in the boxes? (Saved only when you press Save.)")) return;
    render(WA_FMT_DEFAULT); status("Default words in the boxes - press 💾 Save to use them.", "wait");
  });
  document.getElementById("wfSaveBtn").addEventListener("click", async () => {
    if (typeof isViewer === "function" && isViewer()) return;
    const o = read();
    status("Saving…", "wait");
    try {
      const token = await getToken(); if (!token) throw new Error("not signed in");
      const r = await fetch(WA_FMT_URL, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(o, null, 1) });
      if (!r.ok) throw new Error("OneDrive " + r.status);
      WA_FMT = waFmtMerge(o); _waFmtP = Promise.resolve(true);
      try { localStorage.setItem("waFormats", JSON.stringify(o)); } catch (e) {}
      status("✅ Saved in OneDrive (Apps → Moltrix → wa_formats.json). The next WhatsApp fetch reads the messages with these words - on every device and in the cloud sync.", "ok");
    } catch (e) { status("Not saved: " + (e.message || e), "err"); }
  });
})();

/* ===================== EXCEL LAYOUT (Get Started → 📦 Excel Formats) =====================
   Where the WhatsApp entries are written: file name, sheet names and columns. The defaults are this app's own
   formats. Saved in OneDrive (Apps → Moltrix → xl_layout.json), so the phone, the PC and the cloud sync all write
   to the same cells. Only the WhatsApp → Excel entries use it (heat billets + chemistry, consumption, RHF transfer);
   reports and dashboards still read this app's own formats. */
const XL_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/xl_layout.json:/content";
const XL_DEFAULT = {
  file: { name: "{Month}'{YY}_Reports.xlsx", folder: "Desktop", crucibles: 1 },
  heat: { sheet: "Prod.", heatCol: "B", sectionCol: "H", C: "C", MN: "D", SI: "E", S: "F", P: "G",
    hot: "P", bypass: "V", b130: "J", hotout: "AC", total: "AB" },
  cons: { sheet: "RM Report", dateCol: "A", lumps: "AI", fines: "AJ", pellets: "AK", steelMeltingScrap: "AL", magMaterial: "AM",
    rollingMillScrap: "AN", msScrap: "AO", ciMixScrap: "AP", pigIron: "AQ", overSizeMag: "AR" },
  rhf: { sheet: "Prod.", dateCol: "A", col: "J", row130: 13, row160: 14,
    pSheet: "Billet Stock Format", pAsOnCol: "A", pPartyCol: "B", pSizeCol: "C", pQtyCol: "E" }
};
const XL_COLS = new Set(["heatCol", "sectionCol", "C", "MN", "SI", "S", "P", "hot", "bypass", "b130", "hotout", "total", "dateCol", "col",
  "lumps", "fines", "pellets", "steelMeltingScrap", "magMaterial", "rollingMillScrap", "msScrap", "ciMixScrap", "pigIron", "overSizeMag",
  "pAsOnCol", "pPartyCol", "pSizeCol", "pQtyCol"]);
const XL_ROWS = new Set(["row130", "row160"]);
// columns a company's own format may not have: "-" = not in the file, nothing is written there
const XL_SKIP = new Set(["sectionCol", "C", "MN", "SI", "S", "P", "hot", "bypass", "b130", "hotout", "total", "col",
  "lumps", "fines", "pellets", "steelMeltingScrap", "magMaterial", "rollingMillScrap", "msScrap", "ciMixScrap", "pigIron", "overSizeMag", "pQtyCol"]);
const XL_CRU = "ABCDEFGHIJ".split("");   // up to 10 crucibles (A … J)
const XL_CRU_MAX = 10;
function xlMerge(o) {   // saved settings over the defaults; a wrong / empty value keeps the default
  const d = JSON.parse(JSON.stringify(XL_DEFAULT));
  if (!o || typeof o !== "object") return d;
  Object.keys(d).forEach(g => {
    const src = o[g]; if (!src || typeof src !== "object") return;
    Object.keys(d[g]).forEach(k => {
      let v = src[k]; if (v == null) return;
      if (k === "crucibles") { v = parseInt(v, 10); if (v >= 1 && v <= XL_CRU_MAX) d[g][k] = v; }
      else if (XL_COLS.has(k)) { v = String(v).trim().toUpperCase(); if (/^[A-Z]{1,3}$/.test(v) || (v === "-" && XL_SKIP.has(k))) d[g][k] = v; }
      else if (XL_ROWS.has(k)) { v = parseInt(v, 10); if (v >= 0 && v <= 200) d[g][k] = v; }
      else { v = String(v).trim(); if (v) d[g][k] = v; }
    });
  });
  return d;
}
let XL = (() => { try { return xlMerge(JSON.parse(localStorage.getItem("xlLayout") || "null")); } catch (e) { return xlMerge(null); } })();
let _xlP = null;
function xlIsDefaultFile() { return XL.file.name === XL_DEFAULT.file.name && XL.file.folder === XL_DEFAULT.file.folder; }
// crucibles: one monthly file; crucible A uses the sheets Prod. / Strip Mill / BIS Doc, crucible B / C their copies
// "Prod. B", "Strip Mill B", "BIS Doc B" … [""] = one crucible, as before
function xlCrus() { const n = (XL && XL.file && XL.file.crucibles) || 1; return n > 1 ? XL_CRU.slice(0, n) : [""]; }
function xlSheetFor(base, cru) { cru = xlCruOk(cru); return cru && cru !== "A" ? `${base} ${cru}` : base; }
function xlCruOk(c) { const l = xlCrus(); return l[0] ? (l.includes(String(c || "").toUpperCase()) ? String(c).toUpperCase() : "A") : ""; }
function xlApply() {   // things that show the layout
  const sn = document.getElementById("sheetName"); if (sn) sn.value = XL.heat.sheet;
  if (typeof xlCruUi === "function") xlCruUi();
  if (typeof _filePathCache !== "undefined") _filePathCache.clear();
  if (typeof _colBCache !== "undefined") _colBCache.clear();
}
function xlFmtLoad(force) {
  if (_xlP && !force) return _xlP;
  _xlP = (async () => {
    try {
      if (!account || (typeof isViewer === "function" && isViewer())) return false;
      const token = await getToken(); if (!token) return false;
      const r = await fetch(XL_URL + "?t=" + Date.now(), { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      if (r.status === 404) { XL = xlMerge(null); try { localStorage.removeItem("xlLayout"); } catch (e) {} xlApply(); return true; }
      if (!r.ok) { _xlP = null; return false; }
      const o = await r.json();
      XL = xlMerge(o); try { localStorage.setItem("xlLayout", JSON.stringify(o)); } catch (e) {}
      xlApply();
      return true;
    } catch (e) { _xlP = null; return false; }
  })();
  return _xlP;
}
// Asked before the formats are put on a OneDrive: which month's file, and how many crucibles (1-10, one monthly file with a
// Prod. / Strip Mill / BIS Doc sheet for each). Returns { y, m0, n } or false (cancelled). The count is saved in the layout.
function xlFmtDialog(cur) {
  return new Promise(res => {
    const now = new Date(), ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let who = ""; try { who = account ? accountEmail(account) : ""; } catch (e) {}
    const d = document.createElement("div");
    d.id = "xlFmtDlg";
    d.style.cssText = "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;";
    d.innerHTML = `<div style="background:var(--card,#fffaf2);color:var(--ink,#16233d);width:100%;max-width:380px;border-radius:16px;padding:18px 18px 16px;box-shadow:0 12px 34px rgba(0,0,0,.35);">
      <div style="font-weight:800;font-size:17px;margin-bottom:${who ? 2 : 12}px;">📦 Put formats on the Desktop</div>${who ? `<div style="font-size:12.5px;opacity:.75;margin-bottom:12px;word-break:break-all;">${String(who).replace(/[&<>"']/g, "")}</div>` : ""}
      <label for="xlDlgMonth" style="margin:0 0 4px;">Month</label>
      <input type="month" id="xlDlgMonth" value="${ym}" style="margin:0 0 12px;">
      <label for="xlDlgCru" style="margin:0 0 4px;">Number of crucibles</label>
      <select id="xlDlgCru" style="margin:0 0 16px;">${XL_CRU.map((c, i) => `<option value="${i + 1}" ${i + 1 === cur ? "selected" : ""}>${i + 1}${i ? ` (A - ${c})` : " (A)"}</option>`).join("")}</select>
      <div style="display:flex;gap:10px;"><button type="button" class="secondary" id="xlDlgNo" style="flex:1;margin:0;">Cancel</button>
        <button type="button" class="primary" id="xlDlgOk" style="flex:1;margin:0;">OK</button></div></div>`;
    document.body.appendChild(d);
    const done = v => { d.remove(); res(v); };
    d.querySelector("#xlDlgNo").onclick = () => done(false);
    d.addEventListener("click", e => { if (e.target === d) done(false); });
    d.querySelector("#xlDlgOk").onclick = () => {
      const m = /^(\d{4})-(\d{2})$/.exec(d.querySelector("#xlDlgMonth").value || "");
      if (!m) { d.querySelector("#xlDlgMonth").focus(); return; }
      done({ y: +m[1], m0: +m[2] - 1, n: +d.querySelector("#xlDlgCru").value });
    };
  });
}
async function xlSaveCrucibles(n) {
  if (n === (XL.file.crucibles || 1)) return true;
  const L = JSON.parse(JSON.stringify(XL)); L.file.crucibles = n;
  const token = await getToken(); if (!token) return false;
  const r = await fetch(XL_URL, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(L, null, 1) });
  if (!r.ok) { alert("Could not save the crucible count (OneDrive " + r.status + ")."); return false; }
  XL = xlMerge(L); _xlP = Promise.resolve(true);
  try { localStorage.setItem("xlLayout", JSON.stringify(L)); } catch (e) {}
  xlApply();
  const f = document.getElementById("xl_file_crucibles"); if (f) f.value = String(n);
  return true;
}
async function xlAskCrucibles() {
  await xlFmtLoad(true);
  const a = await xlFmtDialog(XL.file.crucibles || 1);
  if (!a) return false;
  if (!(await xlSaveCrucibles(a.n))) return false;
  return a;
}
function xlShift(col, n) { return colLetter(colLetterToIndex(col) + n); }      // "P", 3 -> "S"
function xlFileName(year, month0) {                                            // "{Month}'{YY}_Reports.xlsx" -> "November'26_Reports.xlsx"
  const M = MONTH_ABBR[month0], mm = String(month0 + 1);
  return XL.file.name.replace(/\{Month\}/g, M).replace(/\{Mon\}/g, M.slice(0, 3)).replace(/\{MM\}/g, mm.padStart(2, "0"))
    .replace(/\{M\}/g, mm).replace(/\{YYYY\}/g, String(year)).replace(/\{YY\}/g, String(year).slice(2));
}
const xlSheetUrl = (wb, sheet) => `${wb}/worksheets('${encodeURIComponent(String(sheet).replace(/'/g, "''"))}')`;
function xlCruUi() {   // the "Crucible" pickers next to the dashboards: shown only with 2-3 crucibles
  const crus = xlCrus();
  document.querySelectorAll(".xlCruPick").forEach(sel => {
    const keep = sel.value;
    sel.innerHTML = crus.map(c => `<option value="${c}">Crucible ${c}</option>`).join("");
    sel.value = crus.includes(keep) ? keep : crus[0];
    const wrap = sel.closest(".xlCruWrap"); if (wrap) wrap.style.display = crus[0] ? "" : "none";
  });
}
const xlCruPicked = (id) => { const el = document.getElementById(id); return xlCruOk(el && el.value); };
// a small "CRUCIBLE B" mark at the top-right of the current PDF page (only with 2-3 crucibles)
function xlCruStamp(doc, cru) {
  if (!cru) return;
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(180, 40, 40);
  doc.text(`CRUCIBLE ${cru}`, w - 20, 16, { align: "right" });
  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
}

/* ---- crucible template, made in the browser from formats/Template.xlsx (XML level, keeps all styling) ----
   Crucible A keeps the sheets Prod. / Strip Mill / BIS Doc; B … J get copies "Prod. B", "Strip Mill B", "BIS Doc B" …
   The plant sheets (Daily Stock, Daily Prod Format, Monthly Prod) add up all crucibles. */
function xlLoadZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = "./jszip.min.js"; s.onload = () => res(window.JSZip); s.onerror = () => rej(new Error("zip tool did not load")); document.head.appendChild(s); });
}
async function xlBuildCruTemplate(buf, n, JSZipLib) {
  const Z = JSZipLib || await xlLoadZip();
  const zip = await Z.loadAsync(buf);
  const crus = XL_CRU.slice(0, n), PERIOD = 18, NOF = { createFolders: false };
  const COPY = ["Prod.", "Strip Mill", "BIS Doc"], PLANT = ["Daily Stock", "Daily Prod Format", "Monthly Prod"];
  const un = t => t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[e.toLowerCase()]);
  const enc = t => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rd = p => zip.file(p).async("string");
  let wbx = await rd("xl/workbook.xml"), rels = await rd("xl/_rels/workbook.xml.rels"), ct = await rd("[Content_Types].xml");
  const sstXml = zip.file("xl/sharedStrings.xml") ? await rd("xl/sharedStrings.xml") : "";
  const sst = [...sstXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => un([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join("")));
  const partOf = name => {   // sheet name -> "xl/worksheets/sheetN.xml"
    const m = new RegExp(`<sheet [^>]*name="${enc(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*r:id="(rId\\d+)"`).exec(wbx);
    if (!m) throw new Error(`sheet "${name}" not in the Template`);
    const t = new RegExp(`<Relationship [^>]*Id="${m[1]}"[^>]*Target="([^"]+)"`).exec(rels) || new RegExp(`<Relationship [^>]*Target="([^"]+)"[^>]*Id="${m[1]}"`).exec(rels);
    return "xl/" + t[1].replace(/^\/?xl\//, "");
  };
  const setCellText = (xml, ref, text) => {
    const t = enc(text);
    const m = new RegExp(`<c r="${ref}"((?: [a-z]+="[^"]*")*)\\s*(/>|>[\\s\\S]*?</c>)`).exec(xml);
    if (m) { const attrs = m[1].replace(/ t="[^"]*"/, ""); return xml.slice(0, m.index) + `<c r="${ref}"${attrs} t="inlineStr"><is><t xml:space="preserve">${t}</t></is></c>` + xml.slice(m.index + m[0].length); }
    const row = +ref.replace(/[A-Z]+/, "");
    const rm = new RegExp(`<row r="${row}"[^>]*?(/>|>)`).exec(xml);
    if (!rm) throw new Error(`row ${row} missing`);
    const cell = `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${t}</t></is></c>`;
    if (rm[1] === "/>") return xml.slice(0, rm.index) + rm[0].slice(0, -2) + ">" + cell + "</row>" + xml.slice(rm.index + rm[0].length);
    return xml.slice(0, rm.index + rm[0].length) + cell + xml.slice(rm.index + rm[0].length);
  };
  const cellText = (xml, ref) => {
    const m = new RegExp(`<c r="${ref}"((?: [a-z]+="[^"]*")*)\\s*(?:/>|>([\\s\\S]*?)</c>)`).exec(xml);
    if (!m || !m[2]) return "";
    const v = /<v>([\s\S]*?)<\/v>/.exec(m[2]);
    if (/ t="s"/.test(m[1]) && v) return sst[+v[1]];
    const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(m[2]);
    return t ? un(t[1]) : (v ? v[1] : "");
  };
  const mapF = (xml, fn) => xml.replace(/(<f\b[^>]*?(?<!\/)>)([\s\S]*?)(<\/f>)/g, (all, a, body, b) => { const f = un(body), nf = fn(f); return nf !== f ? a + enc(nf) + b : all; });
  const mark = (xml, cru, sheet) => {
    if (sheet === "Prod.") {
      xml = setCellText(xml, "A1", `CRUCIBLE ${cru}`);
      for (let r = 4; r < 16; r++) { const v = cellText(xml, `B${r}`).trim(); if (/^\d{1,2}\.\d{1,2}\.\d{1,2}$/.test(v)) xml = setCellText(xml, `B${r}`, `F-${cru}-${v}`); }
    } else if (sheet === "Strip Mill") xml = setCellText(xml, "A1", cellText(xml, "A1").replace(/\s+$/, "") + ` - CRUCIBLE ${cru}`);
    else if (sheet === "BIS Doc" && xml.includes('r="N2"')) xml = setCellText(xml, "N2", `CRUCIBLE ${cru}`);
    return xml;
  };
  const REF = /(?<!['\w])Prod\.!(\$?)([A-Z]{1,3})(\$?)(\d+)(?![:\d(])/g;
  const plant = f => {
    let f2 = f.replace(REF, (all, d1, col, d2, row) => {
      row = +row; const ref = `${d1}${col}${d2}${row}`;
      const refs = ["Prod.!" + ref].concat(crus.slice(1).map(c => `'Prod. ${c}'!${ref}`));
      const off = (row - 1) % PERIOD;
      if (col === "A") return all;
      if (/^[CDEFG]$/.test(col) && off === 15) { const parts = refs.map(r => `IF(N(${r})>0,${r},9E+99)`).join(","); return `IF(MIN(${parts})=9E+99,0,MIN(${parts}))`; }
      if (/^[CDEFG]$/.test(col) && off === 16) return "MAX(" + refs.map(r => `N(${r})`).join(",") + ")";
      return "(" + refs.map(r => `N(${r})`).join("+") + ")";
    });
    f2 = f2.replace(/IF\(INDIRECT\("Prod\.!([A-Z]{1,3})" & (\(ROW\(\)-\d+\)\*\d+\+\d+)\)<>0, INDIRECT\("Prod\.!\1" & \2\), 0\)/g, (all, col, expr) =>
      col === "A" ? all : "(" + ["Prod."].concat(crus.slice(1).map(c => `'Prod. ${c}'`)).map(s => `N(INDIRECT("${s}!${col}" & ${expr}))`).join("+") + ")");
    return f2;
  };
  const src = {};
  for (const sh of COPY) { const p = partOf(sh); src[sh] = mark(await rd(p), "A", sh); zip.file(p, src[sh], NOF); }
  for (const sh of PLANT) { const p = partOf(sh); zip.file(p, mapF(await rd(p), plant), NOF); }
  const ids = [...wbx.matchAll(/sheetId="(\d+)"/g)].map(m => +m[1]);
  let nextSheet = Math.max(...[...rels.matchAll(/worksheets\/sheet(\d+)\.xml/g)].map(m => +m[1])) + 1;
  let nextRid = Math.max(...[...rels.matchAll(/Id="rId(\d+)"/g)].map(m => +m[1])) + 1;
  let added = "";
  for (const c of crus.slice(1)) for (const sh of COPY) {
    let x = src[sh].replace(/tabSelected="1"/g, 'tabSelected="0"');
    x = mapF(x, f => f.replace(/(?<!['\w])Prod\.!/g, `'Prod. ${c}'!`));
    x = x.split("CRUCIBLE A").join(`CRUCIBLE ${c}`).split("F-A-").join(`F-${c}-`);
    const p = `xl/worksheets/sheet${nextSheet}.xml`;
    zip.file(p, x, NOF);
    rels = rels.replace("</Relationships>", `<Relationship Id="rId${nextRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${nextSheet}.xml"/></Relationships>`);
    ct = ct.replace("</Types>", `<Override PartName="/${p}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
    ids.push(Math.max(...ids) + 1);
    added += `<sheet name="${enc(sh + " " + c)}" sheetId="${ids[ids.length - 1]}" r:id="rId${nextRid}"/>`;
    nextSheet++; nextRid++;
  }
  wbx = wbx.replace("</sheets>", added + "</sheets>");
  rels = rels.replace(/<Relationship [^>]*calcChain[^>]*\/>/g, "");      // Excel rebuilds the calculation chain and recalculates on open
  ct = ct.replace(/<Override PartName="\/xl\/calcChain.xml"[^>]*\/>/g, "");
  zip.remove("xl/calcChain.xml");
  wbx = wbx.replace(/<calcPr([^>]*?)\/>/, (m, a) => "<calcPr" + a.replace(/ fullCalcOnLoad="[^"]*"/, "") + ' fullCalcOnLoad="1"/>');
  zip.file("xl/workbook.xml", wbx, NOF); zip.file("xl/_rels/workbook.xml.rels", rels, NOF); zip.file("[Content_Types].xml", ct, NOF);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

/* ---------- Get Started → 📦 Excel Formats: the layout form, check, save ---------- */
(function () {
  const C = (k, lab) => [k, lab, "col"];
  const FIELDS = [
    { g: "Monthly file", key: "file", rows: [
      ["name", "File name", "text", "{Month} = November, {Mon} = Nov, {MM} = 11, {YYYY} = 2026, {YY} = 26"],
      ["folder", "Folder in OneDrive", "text", "e.g. Desktop or Desktop/Reports"],
      ["crucibles", "Number of crucibles (1 to 10)", "cru", "crucible B, C … J use the sheets \"Prod. B\", \"Strip Mill B\", \"BIS Doc B\" …"] ] },
    { g: "Heat sheet (billets + chemistry)", key: "heat", rows: [
      ["sheet", "Sheet name", "text"], C("heatCol", "Heat number column"), C("sectionCol", "Section (160 / 130) column"),
      C("C", WF_CHEM_NAMES.C), C("MN", WF_CHEM_NAMES.MN), C("SI", WF_CHEM_NAMES.SI), C("S", WF_CHEM_NAMES.S), C("P", WF_CHEM_NAMES.P),
      ["hot", "Hot charging 3 M (4 M, 5 M, 6 M next to it)", "col"], ["bypass", "Bypass 3 M (4 M, 5 M, 6 M next to it)", "col"],
      ["b130", "130 × 130 of a 160 heat, 3 M (4-6 M next to it)", "col"], ["hotout", "Hot out 3 M (4 M, 5 M, 6 M next to it)", "col"],
      ["total", "Total production column (marked red on a mismatch)", "col"] ] },
    { g: "Raw material consumption", key: "cons", rows: [
      ["sheet", "Sheet name", "text"], C("dateCol", "Date column") ].concat(Object.keys(WF_MAT_NAMES).map(k => C(k, WF_MAT_NAMES[k]))) },
    { g: "Billet transfer to RHF", key: "rhf", rows: [
      ["sheet", "Own billets: sheet name", "text"], C("dateCol", "Own billets: date column"),
      ["col", "Own billets: 3 M column (4-6 M next to it)", "col"],
      ["row130", "Own 130: rows below the date row", "row"], ["row160", "Own 160: rows below the date row", "row"],
      ["pSheet", "Party billets: sheet name", "text"], C("pAsOnCol", "Party: \"As on dd.mm.yyyy\" column"),
      C("pPartyCol", "Party name column"), C("pSizeCol", "Size column"), C("pQtyCol", "Pieces column (reduced by a formula)") ] }
  ];
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const idOf = (g, k) => `xl_${g}_${k}`;
  const form = document.getElementById("xlForm");
  if (!form) return;
  function render(L) {
    form.innerHTML = FIELDS.map((grp, gi) => `<details ${gi === 0 ? "open" : ""} style="margin:10px 0;border:1px solid var(--border,#ddd);border-radius:10px;padding:8px 10px;">
      <summary style="cursor:pointer;font-weight:700;">${esc(grp.g)}</summary>
      ${grp.rows.map(([k, lab, kind, hint]) => kind === "text"
        ? `<label for="${idOf(grp.key, k)}" style="margin-top:10px;">${esc(lab)}${hint ? ` <span style="font-weight:400;opacity:.7;font-size:12px;">- ${esc(hint)}</span>` : ""}</label>
        <input type="text" id="${idOf(grp.key, k)}" value="${esc(L[grp.key][k])}" autocomplete="off" spellcheck="false">`
        : kind === "cru"
        ? `<div style="display:flex;align-items:center;gap:10px;margin-top:10px;"><label for="${idOf(grp.key, k)}" style="flex:1;margin:0;font-size:13px;font-weight:700;">${esc(lab)}${hint ? `<br><span style="font-weight:400;opacity:.7;font-size:12px;">${esc(hint)}</span>` : ""}</label>
        <select id="${idOf(grp.key, k)}" style="width:70px;margin:0;">${XL_CRU.map((c, i) => i + 1).map(n => `<option value="${n}" ${+L[grp.key][k] === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>`
        : `<div style="display:flex;align-items:center;gap:10px;margin-top:8px;"><label for="${idOf(grp.key, k)}" style="flex:1;margin:0;font-size:13px;">${esc(lab)}</label>
        <input type="${kind === "row" ? "number" : "text"}" id="${idOf(grp.key, k)}" value="${esc(L[grp.key][k])}" autocomplete="off" spellcheck="false"
          ${kind === "col" ? 'maxlength="3" style="text-transform:uppercase;width:70px;margin:0;text-align:center;"' : 'min="0" max="200" style="width:70px;margin:0;text-align:center;"'}></div>`).join("")}
    </details>`).join("");
  }
  function read() {
    const o = {}, bad = [];
    FIELDS.forEach(grp => { o[grp.key] = {}; grp.rows.forEach(([k, lab, kind]) => {
      const el = document.getElementById(idOf(grp.key, k)); const v = String(el ? el.value : "").trim();
      if (kind === "col" && v && !/^[A-Za-z]{1,3}$/.test(v) && !(v === "-" && XL_SKIP.has(k))) bad.push(`${grp.g} → ${lab}: "${v}" is not a column letter${XL_SKIP.has(k) ? ' ("-" = not in my file)' : ""}`);
      o[grp.key][k] = v;
    }); });
    return { o, L: xlMerge(o), bad };
  }
  const status = (t, cls) => { const s = document.getElementById("xlStatus"); if (s) { s.className = cls || ""; s.style.whiteSpace = "pre-line"; s.textContent = t || ""; } };
  async function open() {
    status("Loading…", "wait");
    await xlFmtLoad(true);
    render(XL); status("");
    const sv = document.getElementById("xlSaveBtn"); if (sv) sv.disabled = typeof isViewer === "function" && isViewer();
  }
  const tile = document.querySelector('#getStartedSubNav [data-subgs="formats"]');
  if (tile) tile.addEventListener("click", open);
  document.querySelectorAll(".xlTab").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".xlTab").forEach(x => x.classList.toggle("on", x === b));
    document.getElementById("xlTabMx").classList.toggle("hidden", b.dataset.xltab !== "mx");
    document.getElementById("xlTabOwn").classList.toggle("hidden", b.dataset.xltab !== "own");
  }));
  render(XL);
  xlCruUi();

  // ---- check this month's file against the boxes (not saved yet) ----
  document.getElementById("xlCheckBtn").addEventListener("click", async () => {
    const { L, bad } = read();
    if (bad.length) { status(bad.join("\n"), "err"); return; }
    status("Checking…", "wait");
    const keep = XL; XL = L; _filePathCache.clear();
    try {
      const token = await getToken(); if (!token) return;
      const now = new Date(), y = now.getFullYear(), m0 = now.getMonth();
      const crus = xlCrus();
      const path = await detectFilePathForMonth(token, y, m0);
      if (!path) { status(`❌ File not found: ${L.file.folder}/${xlFileName(y, m0)}`, "err"); return; }
      const wb = await resolveWorkbook(token, path);
      const ws = await graphFetch(`${wb}/worksheets?$select=name`, token, { noCache: true });
      const names = (ws.value || []).map(x => x.name);
      const out = [`✅ File: ${path}`];
      const need = [["Heat sheet", L.heat.sheet], ["Consumption sheet", L.cons.sheet], ["RHF own billets sheet", L.rhf.sheet], ["RHF party sheet", L.rhf.pSheet]];
      crus.slice(1).forEach(c => [L.heat.sheet, "Strip Mill", "BIS Doc"].forEach(b => need.push([`Crucible ${c}`, `${b} ${c}`])));
      need.forEach(([lab, sh]) => out.push(names.includes(sh) ? `✅ ${lab}: ${sh}` : `❌ ${lab}: "${sh}" not in the file`));
      if (names.includes(L.heat.sheet)) {   // first heat number found in the heat column
        const col = await graphFetch(`${xlSheetUrl(wb, L.heat.sheet)}/range(address='${L.heat.heatCol}1:${L.heat.heatCol}400')?$select=text`, token, { noCache: true });
        const first = (col.text || []).map(r => String(r[0] || "").trim()).find(t => normalizeHeatKey(t));
        out.push(first ? `✅ Heat numbers in column ${L.heat.heatCol} (first: ${first})` : `❌ No heat number (like 5.11.3) in column ${L.heat.heatCol}`);
      }
      if (names.includes(L.cons.sheet)) {
        const col = await graphFetch(`${xlSheetUrl(wb, L.cons.sheet)}/range(address='${L.cons.dateCol}1:${L.cons.dateCol}400')?$select=values`, token, { noCache: true });
        const n = (col.values || []).filter(r => typeof r[0] === "number" && r[0] > 40000 && r[0] < 80000).length;
        out.push(n ? `✅ ${n} dates in column ${L.cons.dateCol} of ${L.cons.sheet}` : `❌ No dates in column ${L.cons.dateCol} of ${L.cons.sheet}`);
      }
      status(out.join("\n"), out.some(t => t.startsWith("❌")) ? "err" : "ok");
    } catch (e) { status("Could not check: " + (e.message || e), "err"); }
    finally { XL = keep; _filePathCache.clear(); }
  });
  document.getElementById("xlResetBtn").addEventListener("click", () => {
    if (!confirm("Put this app's own layout back in the boxes? (Saved only when you press Save.)")) return;
    render(XL_DEFAULT); status("Default layout in the boxes - press 💾 Save to use it.", "wait");
  });
  document.getElementById("xlSaveBtn").addEventListener("click", async () => {
    if (typeof isViewer === "function" && isViewer()) return;
    const { L, bad } = read();
    if (bad.length) { status(bad.join("\n"), "err"); return; }
    status("Saving…", "wait");
    try {
      const token = await getToken(); if (!token) throw new Error("not signed in");
      const r = await fetch(XL_URL, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(L, null, 1) });
      if (!r.ok) throw new Error("OneDrive " + r.status);
      XL = L; _xlP = Promise.resolve(true);
      try { localStorage.setItem("xlLayout", JSON.stringify(L)); } catch (e) {}
      xlApply(); render(XL);
      xlCruUi();
      status("✅ Saved (OneDrive → Apps → Moltrix → xl_layout.json). The next WhatsApp entries go to these cells - on every device and in the cloud sync." +
        (xlCrus()[0] ? `\n${xlCrus().length} crucibles in one file: ${xlCrus().map(c => xlSheetFor(XL.heat.sheet, c)).join(", ")} (and Strip Mill / BIS Doc the same way). Heat messages need ${xlCrus().map(c => "F-" + c).join(" / ")} before the heat no.` : ""), "ok");
    } catch (e) { status("Not saved: " + (e.message || e), "err"); }
  });
  /* ---- ⬆️ Upload your format: read the company's own Excel, fill what can be recognised, ask the rest ---- */
  const GRAPH = "https://graph.microsoft.com/v1.0/me/drive";
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const colL = i => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const norm = t => String(t == null ? "" : t).toLowerCase().replace(/[%().:\-_/\\]/g, " ").replace(/\s+/g, " ").trim();
  // sheet -> grid of shown texts (first 400 rows, 120 columns), merged headers spread over their cells
  function grids(wbx) {
    const out = {};
    wbx.SheetNames.forEach(n => {
      const ws = wbx.Sheets[n]; if (!ws || !ws["!ref"]) { out[n] = []; return; }
      const R = XLSX.utils.decode_range(ws["!ref"]), g = [];
      const r2 = Math.min(R.e.r, 399), c2 = Math.min(R.e.c, 119);
      for (let r = 0; r <= r2; r++) { const row = []; for (let c = 0; c <= c2; c++) { const cell = ws[XLSX.utils.encode_cell({ r, c })]; row.push(cell ? String(cell.w != null ? cell.w : cell.v).trim() : ""); } g.push(row); }
      out[n] = g;
    });
    return out;
  }
  const HEAT_RX = /^\s*(?:F\s*-?\s*[A-J]\s*-\s*)?\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*\d{1,3}\s*$/i;
  const isDate = t => /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(t) || /^\d{1,2}[- ][A-Za-z]{3}[- ]\d{2,4}$/.test(t) || /^\d{4}-\d{2}-\d{2}/.test(t);
  // best column of a sheet by a cell test -> { c, n, r0 (first row) }
  function bestCol(g, test) {
    const cnt = {}, first = {};
    g.forEach((row, r) => row.forEach((t, c) => { if (t && test(t)) { cnt[c] = (cnt[c] || 0) + 1; if (first[c] == null) first[c] = r; } }));
    let best = null; Object.keys(cnt).forEach(c => { if (!best || cnt[c] > best.n) best = { c: +c, n: cnt[c], r0: first[c] }; });
    return best;
  }
  // header column whose text matches rx, searched in the rows above the first data row
  function hdrCol(g, r0, rx, not) {
    for (let r = Math.max(0, r0 - 1); r >= Math.max(0, r0 - 10); r--) {
      const row = g[r] || [];
      for (let c = 0; c < row.length; c++) { const t = norm(row[c]); if (t && rx.test(t) && !(not && not.test(t))) return c; }
    }
    return -1;
  }
  const HEAT_HDR = { sectionCol: /^(section|size|billet size)\b/, C: /^(c|carbon)$/, MN: /^(mn|manganese)$/, SI: /^(si|silicon)$/, S: /^(s|sulphur|sulfur)$/,
    P: /^(p|phosphorus|phosphorous)$/, hot: /hot ?charg/, bypass: /^by ?pass|^bypass/, b130: /130 ?[x×*] ?130/, hotout: /hot ?out/, total: /^total( prod| production)?\b/ };
  const MAT_HDR = { lumps: /lump/, fines: /fine/, pellets: /pellet/, steelMeltingScrap: /steel melting|sms scrap|melting scrap/, magMaterial: /^mag ?mat|magnetic material/,
    rollingMillScrap: /rolling ?mill|rm scrap/, msScrap: /^m ?s ?scrap|ms scrap/, ciMixScrap: /c ?i ?mix|ci scrap|cast iron/, pigIron: /pig ?iron/, overSizeMag: /over ?size/ };
  function detect(G, fileName) {
    const names = Object.keys(G), L = JSON.parse(JSON.stringify(XL_DEFAULT)), found = {};
    const set = (g, k, v) => { L[g][k] = v; found[g + "." + k] = true; };
    // heat sheet + column: most heat numbers (5.11.3 / F-A-5.11.3)
    let H = null;
    names.forEach(n => { const b = bestCol(G[n], t => HEAT_RX.test(t)); if (b && (!H || b.n > H.n)) H = Object.assign(b, { sheet: n }); });
    if (H) {
      set("heat", "sheet", H.sheet); set("heat", "heatCol", colL(H.c));
      Object.keys(HEAT_HDR).forEach(k => { const c = hdrCol(G[H.sheet], H.r0, HEAT_HDR[k], k === "bypass" ? /strip/ : null); if (c >= 0 && c !== H.c) set("heat", k, colL(c)); });
      // crucible sheets already in the file: "<heat sheet> B", "<heat sheet> C" …
      let n = 1; while (n < XL_CRU_MAX && names.includes(`${H.sheet} ${XL_CRU[n]}`)) n++;
      L.file.crucibles = n;
    }
    // consumption sheet: most material headers
    let Cn = null;
    names.forEach(n => {
      const g = G[n], hits = {};
      g.slice(0, 40).forEach(row => row.forEach((t, c) => { const s = norm(t); if (!s) return; Object.keys(MAT_HDR).forEach(k => { if (hits[k] == null && MAT_HDR[k].test(s)) hits[k] = c; }); }));
      const k = Object.keys(hits).length; if (k >= 2 && (!Cn || k > Cn.k)) Cn = { sheet: n, hits, k };
    });
    if (Cn) {
      set("cons", "sheet", Cn.sheet);
      Object.keys(Cn.hits).forEach(k => set("cons", k, colL(Cn.hits[k])));
      const d = bestCol(G[Cn.sheet], isDate); if (d) set("cons", "dateCol", colL(d.c));
    }
    // RHF: only when the file has the same sheets as this app's format
    const bs = names.find(n => /billet stock/i.test(n));
    if (bs) set("rhf", "pSheet", bs); else { L.rhf.pQtyCol = "-"; found["rhf.pQtyCol"] = true; }
    if (!H || !names.includes(L.rhf.sheet)) { L.rhf.col = "-"; found["rhf.col"] = true; }
    // monthly file name from the uploaded name: "November'26_Reports.xlsx" -> "{Month}'{YY}_Reports.xlsx"
    let pat = fileName.replace(/\.xls[xm]?$/i, ".xlsx"), y = null, m0 = null;
    MONTHS.forEach((M, i) => {
      if (new RegExp(M, "i").test(pat)) { pat = pat.replace(new RegExp(M, "i"), "{Month}"); m0 = i; }
      else if (m0 == null && new RegExp(`(^|[^a-z])${M.slice(0, 3)}([^a-z]|$)`, "i").test(pat)) { pat = pat.replace(new RegExp(`(^|[^A-Za-z])${M.slice(0, 3)}(?=[^A-Za-z]|$)`, "i"), `$1{Mon}`); m0 = i; }
    });
    let ym = /(20\d\d)/.exec(pat); if (ym) { y = +ym[1]; pat = pat.replace(ym[1], "{YYYY}"); }
    else if (m0 != null && (ym = /(?:\{Month\}|\{Mon\})[^0-9]{0,2}(\d\d)(?!\d)/.exec(pat))) { y = 2000 + +ym[1]; pat = pat.replace(new RegExp(`(\\{Month\\}|\\{Mon\\})([^0-9]{0,2})${ym[1]}`), "$1$2{YY}"); }
    L.file.name = pat; L.file.folder = "Desktop";
    return { L, found, y, m0, grids: G };
  }
  // what is asked: every field that was not recognised (the boxes below show everything for a final look)
  const ASK = [["heat", "sheet", "Heat sheet (billets + chemistry)", "sheet"], ["heat", "heatCol", "Heat number column", "col"]]
    .concat(FIELDS[1].rows.filter(r => r[2] === "col" && r[0] !== "heatCol").map(r => ["heat", r[0], r[1], "col"]))
    .concat([["cons", "sheet", "Raw material consumption sheet", "sheet"], ["cons", "dateCol", "Consumption: date column", "col"]])
    .concat(Object.keys(WF_MAT_NAMES).map(k => ["cons", k, "Consumption: " + WF_MAT_NAMES[k], "col"]));
  let UP = null;   // { buf, name, det }
  const upSay = (t, cls) => { const s = document.getElementById("xlUpStatus"); if (s) { s.className = cls || ""; s.style.whiteSpace = "pre-line"; s.textContent = t || ""; } };
  function colOptions(sheet, g, cur, skip) {
    const G = UP.det.grids[sheet] || [], w = Math.max(0, ...G.slice(0, 60).map(r => r.length));
    const label = c => { for (let r = 0; r < Math.min(G.length, 30); r++) { const t = (G[r] || [])[c]; if (t && !HEAT_RX.test(t) && !isDate(t) && isNaN(+t)) return t.length > 22 ? t.slice(0, 22) + "…" : t; } return ""; };
    let o = `<option value="">— choose —</option>` + (skip ? `<option value="-" ${cur === "-" ? "selected" : ""}>Not in my file</option>` : "");
    for (let c = 0; c < Math.max(w, 1); c++) { const L = colL(c), lb = label(c); o += `<option value="${L}" ${cur === L ? "selected" : ""}>${L}${lb ? " · " + esc(lb) : ""}</option>`; }
    return o;
  }
  function renderQ() {
    const d = UP.det, L = d.L, box = document.getElementById("xlUpQ");
    const sheets = Object.keys(d.grids);
    const now = new Date(), ym = `${d.y || now.getFullYear()}-${String((d.m0 != null ? d.m0 : now.getMonth()) + 1).padStart(2, "0")}`;
    const ask = ASK.filter(([g, k]) => !d.found[g + "." + k]);
    const row = (id, lab, ctl) => `<div style="display:flex;align-items:center;gap:10px;margin-top:8px;"><label for="${id}" style="flex:1;margin:0;font-size:13px;">${esc(lab)}</label>${ctl}</div>`;
    box.innerHTML = `<div style="border:1px solid var(--border,#ddd);border-radius:10px;padding:10px;margin-top:10px;">
      <div style="font-weight:700;">${esc(UP.name)}</div>
      ${row("xlUpName", "Monthly file name", `<input type="text" id="xlUpName" value="${esc(L.file.name)}" style="flex:1.4;margin:0;" spellcheck="false">`)}
      ${row("xlUpFolder", "Folder in OneDrive", `<input type="text" id="xlUpFolder" value="${esc(L.file.folder)}" style="flex:1.4;margin:0;" spellcheck="false">`)}
      ${row("xlUpMonth", "This file is for", `<input type="month" id="xlUpMonth" value="${ym}" style="flex:1.4;margin:0;">`)}
      ${row("xlUpCru", "Number of crucibles", `<select id="xlUpCru" style="width:80px;margin:0;">${XL_CRU.map((c, i) => `<option value="${i + 1}" ${i + 1 === L.file.crucibles ? "selected" : ""}>${i + 1}</option>`).join("")}</select>`)}
      ${ask.length ? `<div style="font-weight:700;margin-top:14px;">❓ ${ask.length} not recognised</div>` : `<div style="margin-top:12px;">✅ All recognised</div>`}
      ${ask.map(([g, k, lab, kind]) => kind === "sheet"
        ? row(`xlUpQ_${g}_${k}`, lab, `<select id="xlUpQ_${g}_${k}" data-g="${g}" data-k="${k}" class="xlUpSheet" style="flex:1.4;margin:0;"><option value="">— choose —</option>${sheets.map(n => `<option ${n === L[g][k] ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`)
        : row(`xlUpQ_${g}_${k}`, lab, `<select id="xlUpQ_${g}_${k}" data-g="${g}" data-k="${k}" class="xlUpCol" style="flex:1.4;margin:0;">${colOptions(L[g].sheet, g, d.found[g + "." + k] ? L[g][k] : "", XL_SKIP.has(k))}</select>`)).join("")}
      <div class="btnRow" style="margin-top:12px;"><button class="primary" id="xlUpSave" type="button">💾 Save and put the file on OneDrive</button></div></div>`;
    box.querySelectorAll(".xlUpSheet").forEach(s => s.addEventListener("change", () => {   // a sheet chosen: refill that group's column lists
      L[s.dataset.g].sheet = s.value;
      box.querySelectorAll(`.xlUpCol[data-g="${s.dataset.g}"]`).forEach(c => { c.innerHTML = colOptions(s.value, s.dataset.g, c.value, XL_SKIP.has(c.dataset.k)); });
    }));
    document.getElementById("xlUpSave").addEventListener("click", upSave);
  }
  async function upSave() {
    const d = UP.det, L = JSON.parse(JSON.stringify(d.L)), miss = [];
    L.file.name = document.getElementById("xlUpName").value.trim();
    L.file.folder = document.getElementById("xlUpFolder").value.trim().replace(/^\/+|\/+$/g, "") || "Desktop";
    L.file.crucibles = +document.getElementById("xlUpCru").value || 1;
    document.querySelectorAll("#xlUpQ select[data-g]").forEach(s => { if (s.value) L[s.dataset.g][s.dataset.k] = s.value; else miss.push(s.parentNode.querySelector("label").textContent); });
    if (!/\.xls[xm]$/i.test(L.file.name)) miss.push("Monthly file name (…xlsx)");
    const m = /^(\d{4})-(\d{2})$/.exec(document.getElementById("xlUpMonth").value || ""); if (!m) miss.push("This file is for (month)");
    if (miss.length) { upSay("Please answer:\n• " + miss.join("\n• "), "err"); return; }
    const y = +m[1], m0 = +m[2] - 1;
    const tok = (s, t) => s.replace(/\{Month\}/g, MONTHS[m0]).replace(/\{Mon\}/g, MONTHS[m0].slice(0, 3)).replace(/\{MM\}/g, String(m0 + 1).padStart(2, "0")).replace(/\{YYYY\}/g, String(y)).replace(/\{YY\}/g, String(y).slice(2));
    const fileName = tok(L.file.name);
    const LL = xlMerge(L);
    upSay("Saving…", "wait");
    try {
      const token = await getToken(); if (!token) throw new Error("not signed in");
      const r = await fetch(XL_URL, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(LL, null, 1) });
      if (!r.ok) throw new Error("layout not saved (OneDrive " + r.status + ")");
      XL = LL; _xlP = Promise.resolve(true); _filePathCache.clear();
      try { localStorage.setItem("xlLayout", JSON.stringify(LL)); } catch (e) {}
      xlApply(); render(XL); xlCruUi();
      const path = `${LL.file.folder}/${fileName}`, enc = path.split("/").map(encodeURIComponent).join("/");
      let msg = "✅ Layout saved - WhatsApp entries now go into your format.";
      if (await tryGetItem(token, path)) msg += `\n⏭️ ${path} - already on OneDrive (not replaced)`;
      else {
        const up = await fetch(`${GRAPH}/root:/${enc}:/content?@microsoft.graph.conflictBehavior=fail`, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/octet-stream" }, body: UP.buf });
        msg += up.ok ? `\n✅ ${path} put on OneDrive` : `\n❌ ${path} - not uploaded (${up.status})`;
      }
      if (xlCrus()[0]) msg += `\n${xlCrus().length} crucibles: sheets ${xlCrus().map(c => xlSheetFor(LL.heat.sheet, c)).join(", ")}`;
      upSay(msg, "ok");
    } catch (e) { upSay("Not saved: " + (e.message || e), "err"); }
  }
  const upBtn = document.getElementById("xlUpBtn"), upIn = document.getElementById("xlUpInput");
  if (upBtn && upIn) {
    upBtn.addEventListener("click", () => { if (!(typeof isViewer === "function" && isViewer())) upIn.click(); });
    upIn.addEventListener("change", async () => {
      const f = upIn.files && upIn.files[0]; upIn.value = ""; if (!f) return;
      if (!/\.xls[xm]$/i.test(f.name)) { upSay("Please choose an Excel file (.xlsx / .xlsm).", "err"); return; }
      upSay("Reading…", "wait"); document.getElementById("xlUpQ").innerHTML = "";
      try {
        const buf = await f.arrayBuffer();
        if (typeof XLSX === "undefined") throw new Error("Excel reader not loaded - check the internet and try again");
        const wbx = XLSX.read(buf, { type: "array", sheetRows: 400 });
        UP = { buf, name: f.name, det: detect(grids(wbx), f.name) };
        renderQ(); upSay("");
      } catch (e) { upSay("Could not read the file: " + (e.message || e), "err"); }
    });
  }
  window.xlUpDebug = { detect, grids };
})();

/* ===================== MESSAGE PARSER (same logic as VBA macro) ===================== */
// Date hint for rebuilding a heat number that was typed without its dots.
// Set by the WhatsApp fetch to the message's received time (approximate,
// so the day before/after are also tried). When null, the "Select date"
// box is used as an exact date, else today as an approximate date.
// "01.10.06" / "1.10.6" / "1-10-6" -> "1.10.6" (numbers only, no leading zeros)
function normalizeHeatKey(v) {
  // "5.11.3" -> "5.11.3"; with two furnaces the cell is "F-A-5.11.3" / "F-B-5.11.3" -> "A:5.11.3" / "B:5.11.3"
  const m = /^\s*(?:F\s*-?\s*([A-J])\s*-\s*)?0*(\d{1,2})\s*[.\-\/]\s*0*(\d{1,2})\s*[.\-\/]\s*0*(\d{1,2})\s*$/i.exec(String(v === null || v === undefined ? "" : v));
  return m ? `${m[1] ? m[1].toUpperCase() + ":" : ""}${+m[2]}.${+m[3]}.${+m[4]}` : null;
}
// furnace named in a message: "F-A", "F-B", "Furnace A", "Furnace-2" ... ("" = not said)
function furnaceOf(msg) {
  const t = String(msg || "");
  const m = /\bF\s*-\s*([A-J])\b/i.exec(t) || /\b(?:furnace|crucible)\s*[-:#]?\s*([A-J]|10|[1-9])\b/i.exec(t);
  if (!m) return "";
  const f = m[1].toUpperCase();
  return /^\d+$/.test(f) ? "ABCDEFGHIJ"[+f - 1] : f;     // furnace 1 = A … furnace 10 = J
}

let heatDateHint = null; // { date: Date, exact: boolean, received?: boolean }
const PROD_DAY_START_HOUR = 8; // production day starts at 8 AM
const HIGH_HEAT_FROM = 10;            // heats 10+ can spill past 8 AM
const HIGH_HEAT_MORNING_UNTIL = 12;   // last heat can come 7-10 AM; 10+ before 12 noon without a reference = ask

function recoverHeatKey(lines, dateLine) {
  // 1) find the heat line and the digits written after "Heat no" / "H.no"
  let raw = null, srcLine = null;
  for (const l of lines) {
    const ln = l.trim();
    const m = /(?:\bheat\b\s*(?:no|number)?|\bh\s*\.?\s*no)\s*\.?\s*[:\-=.]*\s*([\d][\d.\s]*)/i.exec(ln);
    if (m) { raw = m[1].trim().replace(/\.+$/, ""); srcLine = ln; break; }
  }
  if (!raw) return null;
  const S = raw.split(/[.\s]+/).filter(Boolean).join("");
  if (!/^\d+$/.test(S) || S.length > 8) return null;

  // 2) candidate dates
  const cands = []; // { d, m, strong }
  const addDate = (dt, strong) => cands.push({ d: dt.getDate(), m: dt.getMonth() + 1, strong });
  if (dateLine && dateLine.date && dateLine.month) cands.push({ d: dateLine.date, m: dateLine.month, strong: true });
  let hint = heatDateHint;
  if (!hint && typeof document !== "undefined") {
    const box = document.getElementById("msgDate");
    if (box && box.value) {
      const [y, mo, d] = box.value.split("-").map(Number);
      hint = { date: new Date(y, mo - 1, d), exact: true };
    }
  }
  if (!hint) hint = { date: new Date(), exact: false };
  if (hint.exact) addDate(hint.date, true);
  else [-1, 0, 1].forEach(off => addDate(new Date(hint.date.getTime() + off * 86400000), false));

  // 3a) only the serial was written ("H.no 1") - needs a sure date.
  // For a fetched WhatsApp message the received time gives the production
  // day: a production day starts at 8 AM (heat 1's message never comes
  // before 8 AM), so a message received before 8 AM belongs to the
  // previous day's heats.
  if (S.length <= 2) {
    const strong = cands.filter(c => c.strong);
    const serial = parseInt(S, 10);
    if (!strong.length && hint && hint.received) {
      // (i) Sequence rule: compare with the last heat number seen in the
      // WhatsApp messages (within ~30 h). Same or higher serial = same
      // production day (e.g. 11 after 10); lower serial = next day
      // (e.g. 1 after 12). This keeps a late "H.no 11" from yesterday
      // from landing on today.
      let last = null;
      try { last = JSON.parse(localStorage.getItem("waLastHeat") || "null"); } catch (e) {}
      const age = last ? hint.date.getTime() - last.t : -1;
      if (last && age >= 0 && age <= 30 * 3600000) {
        const base = new Date(last.y, last.m - 1, last.d);
        if (serial < last.n) base.setDate(base.getDate() + 1);
        strong.push({ d: base.getDate(), m: base.getMonth() + 1, strong: true, how: "seq" });
      } else {
        // (ii) No recent heat to compare with: 8 AM rule. But a high serial
        // (10+) received in the morning could be yesterday's late heat -
        // don't guess, ask for a correction.
        const hr = hint.date.getHours();
        if (serial >= HIGH_HEAT_FROM && hr >= PROD_DAY_START_HOUR && hr < HIGH_HEAT_MORNING_UNTIL) {
          return { issue: `Heat no. "${srcLine}" has no date and came in the morning - can't tell if it is today's or yesterday's heat ${serial}. Please correct it to D.M.N` };
        }
        const prod = new Date(hint.date.getTime() - PROD_DAY_START_HOUR * 3600000);
        strong.push({ d: prod.getDate(), m: prod.getMonth() + 1, strong: true });
      }
    }
    const keys = [...new Set(strong.map(c => `${c.d}.${c.m}`))];
    if (keys.length === 1 && serial > 0) {
      return { key: `${keys[0]}.${serial}`, from: srcLine };
    }
    return { issue: `Heat no. "${srcLine}" has no date. Add a Date line or pick a date, or correct it to D.M.N` };
  }

  // 3b) dots missing ("01.1001", "011001", "29.95") - match against the dates
  const pad = n => String(n).padStart(2, "0");
  const keys = new Set();
  for (const c of cands) {
    for (const D of new Set([String(c.d), pad(c.d)])) {
      for (const M of new Set([String(c.m), pad(c.m)])) {
        const pre = D + M;
        if (S.startsWith(pre)) {
          const rest = S.slice(pre.length);
          if (rest.length >= 1 && rest.length <= 2 && parseInt(rest, 10) > 0) {
            keys.add(`${c.d}.${c.m}.${parseInt(rest, 10)}`);
          }
        }
      }
    }
  }
  if (keys.size === 1) return { key: [...keys][0], from: srcLine };
  return { issue: `Heat no. "${srcLine}" could not be read reliably. Please correct it to D.M.N` };
}

function parseMessage(msg) {
  const F = WA_FMT.heat;   // the words of the message format (Get Started → Message Formats)
  const lines = msg.split(/\r?\n/);
  let heatKey = "";
  let dateLine = null; // { date, month, year } parsed from a "Date DD/MM" or "Date DD/MM/YYYY" line, if present
  let section = "";
  let sz = 160;
  let hotSz = null;   // size of the "FEEDED STRIP Mill" (hot charging) section = the heat's size
  let curSz = null;   // size of the section block being read now ("Section 160x160" / "130x130")
  let firstSz = null; // first section size in the message (used when there is no feeded block)
  let inChem = false;

  const hot = { 3:0,4:0,5:0,6:0 };
  const byp = { 3:0,4:0,5:0,6:0 };
  const grp130 = { 3:0,4:0,5:0,6:0 };
  const hotout = { 3:0,4:0,5:0,6:0 };
  let gotHot=false, gotByp=false, got130=false, gotHotOut=false;
  // The "TOTAL PCS=NN" line under each section, if present, is the person's
  // own stated total for that section - kept separately so it can be
  // cross-checked against the sum of the individual "Xmtr=Y" lines above it.
  let hotTotalStated=null, bypTotalStated=null, grp130TotalStated=null, hotoutTotalStated=null;

  const chem = { C:null, MN:null, SI:null, S:null, P:null };

  const reHeat = /(\d{1,2})\.(\d{1,2})\.(\d{1,2})/;
  const reDateLine = new RegExp("(?:" + wfAlt(F.date) + ")\\s*[:\\-=]?\\s*(\\d{1,2})[\\/\\-.](\\d{1,2})(?:[\\/\\-.](\\d{2,4}))?", "i");
  const reAssign = /(\d)\s*mtr\s*=\s*(\d+)/gi;
  const reCompact = /(\d+)\s*[x\u00d7]\s*(\d)\s*m\b/gi;
  const elMap = {};   // label (lower case) -> C / MN / SI / S / P
  Object.keys(F.el).forEach(k => F.el[k].forEach(w => { elMap[String(w).trim().toLowerCase()] = k; }));
  const reChem = new RegExp("(?:^|[^A-Za-z])(" + wfAlt(Object.keys(elMap)) + ")\\s*%?\\s*[=:]\\s*([\\d.]+)", "gi");
  const elOf = t => { const l = String(t).trim().toLowerCase(); return elMap[l] || elMap[Object.keys(elMap).find(w => wfSquash(w) === wfSquash(l))] || ""; };
  const reStripHead = new RegExp("^(?:" + wfAlt(F.stripmill) + ")\\s*:?$", "i");
  const reTotalPcs = /total\s*pcs\s*=\s*(\d+)/i;
  // short format: "160×160MM=02pcs4mtr" (size = pieces + length)
  const reSizePcs = /(\d{3})\s*[x\u00d7*]\s*\d{3}\s*(?:mm)?\s*[=:\-]\s*(\d+)\s*pcs?\s*(\d)\s*m(?:tr?s?|eters?|etres?)?\b/gi;

  for (let raw of lines) {
    const ln = raw.trim();
    if (!ln) continue;
    const low = ln.toLowerCase();

    // Remarks are free-text notes (not structured data) and can coincidentally
    // contain words like "bypass" or patterns like "3x4m" that would otherwise
    // be misread as billet entries. Stop parsing once we hit one.
    if (wfStarts(ln, F.remark)) break;

    if (!dateLine && wfHas(ln, F.date)) {
      const dm = reDateLine.exec(ln);
      if (dm) {
        let year = dm[3] ? parseInt(dm[3], 10) : null;
        if (year !== null && year < 100) year += 2000;
        dateLine = { date: parseInt(dm[1], 10), month: parseInt(dm[2], 10), year };
      }
    }

    if (!heatKey && wfHas(ln, F.heat)) {
      const m = reHeat.exec(ln);
      reHeat.lastIndex = 0;
      if (m) heatKey = `${parseInt(m[1])}.${parseInt(m[2])}.${parseInt(m[3])}`;
    }

    if (wfHas(ln, F.chem)) { inChem = true; continue; }

    if (inChem) {
      let m;
      reChem.lastIndex = 0;
      while ((m = reChem.exec(ln)) !== null) {
        const lbl = elOf(m[1]);
        const v = parseFloat(m[2]);
        if (lbl && lbl in chem) chem[lbl] = v;
      }
      continue;
    }

    if (wfHas(ln, F.hotout)) section = "HOTOUT";
    else if (wfHas(ln, F.hot)) section = "HOT";
    // short format: "No of Billets" block = kept at CCM (bypass), "STRIP MILL" block = sent to the strip mill (hot charging)
    else if (/^no\.?\s*of\s*billets?\b/i.test(ln)) section = "BYPASS";
    else if (reStripHead.test(ln)) section = "HOT";
    // "For STRIP MILL BYPASS IN CCM" is its own distinct category (kept in
    // grp130) - checked before the generic "bypass"/"by pass" match below,
    // which is specifically "BY PASS Billet of CCM", so the two don't get
    // merged into one total.
    else if (wfHas(ln, F.stripmill) && wfHas(ln, F.bypass)) section = "STRIPBYP";
    else if (wfHas(ln, F.bypass)) section = "BYPASS";

    if (ln.includes("160")) { sz = 160; curSz = 160; }
    else if (ln.includes("130")) { sz = 130; curSz = 130; }
    if (firstSz === null && curSz !== null) firstSz = curSz;
    if (section === "HOT" && hotSz === null && curSz !== null && /section|\d{3}\s*[x\u00d7]\s*\d{3}/i.test(ln)) hotSz = curSz;

    const totalM = reTotalPcs.exec(ln);
    if (totalM) {
      const stated = parseInt(totalM[1], 10);
      const d = dest();
      // a heat can have two blocks going to the same columns (e.g. "BY PASS 160" + "STRIP MILL BYPASS 160"):
      // their stated totals add up
      if (d === "HOT") hotTotalStated = (hotTotalStated || 0) + stated;
      else if (d === "BYPASS") bypTotalStated = (bypTotalStated || 0) + stated;
      else if (d === "GRP130") grp130TotalStated = (grp130TotalStated || 0) + stated;
      else if (d === "HOTOUT") hotoutTotalStated = (hotoutTotalStated || 0) + stated;
    }

    let m;
    reAssign.lastIndex = 0;
    while ((m = reAssign.exec(ln)) !== null) {
      addCount(parseInt(m[1]), parseInt(m[2]));
    }
    reCompact.lastIndex = 0;
    while ((m = reCompact.exec(ln)) !== null) {
      addCount(parseInt(m[2]), parseInt(m[1]));
    }
    reSizePcs.lastIndex = 0;
    while ((m = reSizePcs.exec(ln)) !== null) addCount(parseInt(m[3], 10), parseInt(m[2], 10));
  }

  // Where a block's pcs go (as entered manually in the Prod. sheet):
  //   160 heat: bypass / strip-mill-bypass of SECTION 130x130 -> "130 X 130" columns (J-M)
  //   otherwise (same size as the heat): bypass + strip-mill-bypass -> BYPASS columns (V-Y), added together
  function dest() {
    const heatSz = hotSz !== null ? hotSz : firstSz;
    if (section === "BYPASS" || section === "STRIPBYP") return (curSz === 130 && heatSz === 160) ? "GRP130" : "BYPASS";
    return section;
  }
  function addCount(lenM, cnt) {
    if (lenM < 3 || lenM > 6) return;
    const section = dest();
    if (section === "HOT") { hot[lenM] += cnt; gotHot = true; }
    else if (section === "BYPASS") { byp[lenM] += cnt; gotByp = true; }
    else if (section === "GRP130") { grp130[lenM] += cnt; got130 = true; }
    else if (section === "HOTOUT") { hotout[lenM] += cnt; gotHotOut = true; }
  }

  // Heat number written without the proper "D.M.N" dots (e.g. "H.no 1",
  // "01.1001") - try to rebuild it from a known date. Only for messages that
  // actually carry billet or chemistry data, so photo captions like
  // "Heat no-5" are still skipped.
  let heatFixedFrom = null, heatIssue = null;
  const hasData = gotHot || gotByp || got130 || gotHotOut || Object.values(chem).some(v => v !== null);
  if (!heatKey && hasData) {
    const fx = recoverHeatKey(lines, dateLine);
    if (fx && fx.key) { heatKey = fx.key; heatFixedFrom = fx.from; }
    else if (fx && fx.issue) heatIssue = fx.issue;
  }

  if (hotSz !== null) sz = hotSz;
  const furnace = furnaceOf(msg);
  return { heatKey, furnace, dateLine, hot, byp, grp130, hotout, gotHot, gotByp, got130, gotHotOut, chem, hotTotalStated, bypTotalStated, grp130TotalStated, hotoutTotalStated, sz, heatFixedFrom, heatIssue };
}

/* ===================== GRAPH / EXCEL CALLS ===================== */
// Excel workbook sessions (Microsoft's recommended way for many calls on one
// file: much faster and far fewer "Excel is busy" errors than calls without a
// session). Every workbook the app talks to gets a session automatically: the
// first call starts one in the background (that call does not wait for it),
// later calls - also inside a $batch - carry its id. A session that sat idle
// for 4 minutes is replaced (Excel drops idle sessions after ~5 min). Long
// jobs (next-day blocks etc.) open theirs up front with wbSessionOpen().
const _wbSessions = new Map(); // wb -> { id, lastUsed, pending, failedAt }
const WB_SESSION_IDLE_MS = 4 * 60000;
function wbOfUrl(url) {
  const m = /^(https:\/\/graph\.microsoft\.com\/v1\.0\/me\/drive\/items\/[^\/]+\/workbook)(\/|$)/.exec(String(url));
  return m ? m[1] : null;
}
async function wbSessionStart(wb, token) {
  const st = _wbSessions.get(wb) || {};
  if (st.pending) return st.pending;
  st.pending = (async () => {
    try {
      const res = await fetch(`${wb}/createSession`, { method: "POST",
        headers: { "Authorization": "Bearer " + (cachedAccessToken || token), "Content-Type": "application/json" },
        body: JSON.stringify({ persistChanges: true }) });
      const j = res.ok ? await res.json() : null;
      if (j && j.id) { st.id = j.id; st.lastUsed = Date.now(); st.failedAt = 0; }
      else { st.id = null; st.failedAt = Date.now(); }
    } catch (e) { st.id = null; st.failedAt = Date.now(); }
    finally { st.pending = null; }
    return !!st.id;
  })();
  _wbSessions.set(wb, st);
  return st.pending;
}
function wbSessionHeader(url, token) {
  const wb = wbOfUrl(url);
  if (!wb || /\/(createSession|closeSession)$/.test(String(url).split("?")[0])) return {};
  const st = _wbSessions.get(wb);
  if (st && st.id && Date.now() - st.lastUsed < WB_SESSION_IDLE_MS) {
    st.lastUsed = Date.now();
    return { "workbook-session-id": st.id };
  }
  if (st && st.id) st.id = null;  // idle too long - Excel has probably dropped it
  if (token && !(st && st.pending) && !(st && st.failedAt && Date.now() - st.failedAt < 120000)) {
    wbSessionStart(wb, token);    // background - this call goes without a session
  }
  return {};
}
function wbSessionDrop(url) {
  const st = _wbSessions.get(wbOfUrl(url));
  if (st) { st.id = null; st.failedAt = Date.now() - 90000; } // try a new one ~30 s later
}
function wbHasSession(wb) { const st = _wbSessions.get(wb); return !!(st && st.id); }
// Long jobs: wait for the session before starting.
async function wbSessionOpen(wb, token) {
  const st = _wbSessions.get(wb);
  if (st && st.id && Date.now() - st.lastUsed < WB_SESSION_IDLE_MS) return true;
  if (st) { st.id = null; st.failedAt = 0; }
  return wbSessionStart(wb, token);
}
async function wbSessionClose() { /* sessions are kept for the next action; Excel closes idle ones itself */ }

// Short-lived memory of GET results: the same range asked for again within
// 15 s (e.g. one report reading the Prod. sheet in two places, or a request
// already on its way) is answered from memory instead of Excel. Any write
// clears it, and reads of formulas are never kept (they come before writes).
const _getCache = new Map(); // url -> { t, p }
const GET_CACHE_MS = 15000;
function graphCacheClear() { _getCache.clear(); }
function cloneData(d) {
  try { return typeof structuredClone === "function" ? structuredClone(d) : JSON.parse(JSON.stringify(d)); }
  catch (e) { return JSON.parse(JSON.stringify(d)); }
}
// Start several independent reads at once; the code that needs them later
// gets the result from memory (or waits for the read already on its way).
function graphPrefetch(urls, token) {
  urls.forEach(u => { graphFetch(u, token).catch(() => {}); });
}
// Many reads (e.g. one block per date of a PDF) in a few $batch calls; the
// results go into the memory above, so the code reading them one by one
// afterwards gets them at once.
async function graphPrefetchBatch(urls, token) {
  const todo = [...new Set(urls)].filter(u => { const h = _getCache.get(u); return !(h && Date.now() - h.t < GET_CACHE_MS); });
  if (todo.length < 2) return;
  try {
    const got = await graphBatchRead(token, todo.map(url => ({ url })));
    const now = Date.now();
    todo.forEach((u, i) => { if (got[i] && got[i].body) _getCache.set(u, { t: now + 45000, p: Promise.resolve(got[i].body) }); }); // kept ~60 s
  } catch (e) { /* the normal one-by-one reads will run instead */ }
}

async function graphFetch(url, token, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const cacheable = method === "GET" && !/formulas/i.test(url) && !options.noCache;
  if (cacheable) {
    const hit = _getCache.get(url);
    if (hit && Date.now() - hit.t < GET_CACHE_MS) return hit.p.then(cloneData);
    const p = graphFetchRaw(url, token, options);
    _getCache.set(url, { t: Date.now(), p });
    p.catch(() => { if (_getCache.get(url) && _getCache.get(url).p === p) _getCache.delete(url); });
    return p.then(cloneData);
  }
  if (method !== "GET" && !options.readOnly) graphCacheClear();
  const { readOnly, noCache, ...opts } = options;
  return graphFetchRaw(url, token, opts);
}

async function graphFetchRaw(url, token, options = {}) {
  const RETRYABLE_STATUSES = [429, 502, 503, 504];
  const MAX_RETRIES = 3;
  let renewed = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    // noSession: quick read-only look (home screen) - no Excel session is opened, so the file is not held open
    const sessHdr = options.noSession ? {} : wbSessionHeader(url, token);
    try {
      res = await fetch(url, {
        ...options,
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json",
          ...sessHdr,
          ...(options.headers || {})
        }
      });
    } catch (networkErr) {
      // Network hiccup (dropped connection etc.) - retry the same way as a transient server error.
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      throw networkErr;
    }

    if (res.ok) {
      return res.status === 204 ? null : res.json();
    }

    // Sign-in token ran out during a long job - renew it silently and retry.
    if (res.status === 401 && !renewed) {
      renewed = true;
      const nt = await refreshAccessToken(token);
      if (nt) { token = nt; attempt--; continue; }
    }

    if (RETRYABLE_STATUSES.includes(res.status) && attempt < MAX_RETRIES) {
      // Transient issue (e.g. "MaxRequestDurationExceeded" 504, or Excel
      // Online momentarily busy) - wait (as long as Excel asks, max 10 s),
      // then retry automatically instead of failing the whole action.
      const ra = parseFloat(res.headers.get("Retry-After") || "");
      const wait = ra > 0 ? Math.min(ra, 10) * 1000 : 1000 * (attempt + 1);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    const text = await res.text();
    // Excel session timed out / lost - carry on without a session.
    if (sessHdr["workbook-session-id"] && /session/i.test(text) && attempt < MAX_RETRIES) {
      wbSessionDrop(url);
      attempt--;
      continue;
    }
    // Short, readable message instead of the raw JSON (shown everywhere:
    // RHF, Update Excel, Fetch summary, reports...).
    const friendly = shortError(text);
    throw new Error(/locked|busy|not responding|expired/i.test(friendly)
      ? friendly
      : `Graph API error (${res.status}): ${friendly}`);
  }
}

const _workbookCache = new Map();
// Caches column B (used to find a heat's row) per workbook+sheet, so a
// batch of several heats submitted together doesn't re-fetch the same
// ~3000-row column for every single heat. Cleared whenever new rows are
// added to a sheet (e.g. Create Next Day Block) so it can't go stale.
const _colBCache = new Map();

async function resolveWorkbook(token, filePath) {
  if (_workbookCache.has(filePath)) return _workbookCache.get(filePath);
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const base = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:`;
  const item = await graphFetch(base, token);
  const wb = `https://graph.microsoft.com/v1.0/me/drive/items/${item.id}/workbook`;
  _workbookCache.set(filePath, wb);
  return wb;
}

