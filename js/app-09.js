/* ===================== RHF BILLETS ENTRY ===================== */
// 130 -> MAX row (title+16, H column shows "130"), columns J=3mtr, K=4mtr
// 160 -> Total row (title+17, H column shows "160"), columns J=3mtr, K=4mtr
const RHF_ROW_OFFSET = { "130": 16, "160": 17 };

async function submitRHF() {
  const statusEl = document.getElementById("status");
  const manualFilePath = document.getElementById("filePath").value.trim();
  const sheetName = document.getElementById("sheetName").value.trim();
  const dateVal = document.getElementById("rhfDate").value;
  const section = document.getElementById("rhfSectionSelect").value;
  const RHF_COL = { 3: "J", 4: "K", 5: "L", 6: "M" };
  const data = {
    6: document.getElementById("rhfPcs6").value.trim(),
    5: document.getElementById("rhfPcs5").value.trim(),
    4: document.getElementById("rhfPcs4").value.trim(),
    3: document.getElementById("rhfPcs3").value.trim()
  };

  if (!dateVal) {
    statusEl.className = "err";
    statusEl.textContent = "Please select a date first.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "RHF billets entry in progress...";

  try {
    const token = await getToken();

    // Auto-detect the correct month's file from the picked date, the same
    // way the main production message submission does - otherwise this
    // silently keeps using whatever file happens to be in the File
    // Location box (e.g. still August's file after the month has rolled
    // over to September), which fails with a 404 "itemNotFound".
    const [py, pm] = dateVal.split("-").map(Number);
    statusEl.textContent = `Locating the file for ${MONTH_ABBR[pm - 1]} ${py}...`;
    const autoPath = await detectFilePathForMonth(token, py, pm - 1);
    let filePath = autoPath || manualFilePath;
    if (!filePath) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't automatically find the file for ${MONTH_ABBR[pm - 1]} ${py} - is it on your OneDrive? (Menu → Get Started → Put formats on the Desktop)`;
      return;
    }

    statusEl.textContent = "RHF billets entry in progress...";
    const wb = await resolveWorkbook(token, filePath);

    const colA = await graphFetch(
      `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:A600')?$select=values`,
      token
    );
    const values = colA.values;
    let dataStart = -1;
    for (let i = 0; i < values.length; i++) {
      const v = values[i][0];
      if (typeof v === "number" && excelSerialToISODate(v) === dateVal) {
        dataStart = i + 1;
        break;
      }
    }

    if (dataStart === -1) {
      statusEl.className = "err";
      statusEl.textContent = "Block for this date not found in the sheet.";
      return;
    }

    const titleRow = dataStart - 3;
    const r = titleRow + RHF_ROW_OFFSET[section] + ((await prodHeatsFor(wb, token, sheetName)) - 12);
    let log = "";

    // Cells are collected and written in ONE call (patchCells) instead of one call each.
    const _pieces = [];
    const patchRange = async (_wb, _sheet, addr, values) => { _pieces.push({ addr, values }); };
    for (const len of [6, 5, 4, 3]) {
      if (data[len] !== "") {
        const col = RHF_COL[len];
        await patchRange(wb, sheetName, `${col}${r}:${col}${r}`, [[parseFloat(data[len])]], token);
        log += `[${section}] ${len}Mtr pcs = ${data[len]} (${col}${r})\n`;
      }
    }

    await patchCells(wb, sheetName, rowPiecesToCells(_pieces), token);
    if (log === "") {
      statusEl.className = "err";
      statusEl.textContent = "Please fill in at least one cell.";
      return;
    }

    statusEl.className = "ok";
    statusEl.textContent = `RHF (${dateVal}) updated:\n${log}`;
    showCompletionPopup(`RHF (${dateVal}) updated:\n${log}`);

    ["rhfPcs6", "rhfPcs5", "rhfPcs4", "rhfPcs3"]
      .forEach(id => document.getElementById(id).value = "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("rhfBtn").addEventListener("click", submitRHF);

/* ===================== RAW MATERIAL / SCRAP ENTRY ===================== */
const RM_ITEMS = [
  "Raw Slag", "Slag Jam", "Mag. Material", "BILLET END CUT", "LUMPS", "PELLET",
  "FINES", "OUT SIDE FINES", "OUT SIDE LUMPS", "SCRAP", "MS SCRAP",
  "MS SCRAP-ROLLING MILL", "SUPER HEAVY", "HEAVY", "COMMERCIAL",
  "LIGHT COMMERCIAL", "C I SCRAP", "DUST"
];

// Finds the date-block title row in a sheet whose date cell may be a real
// Excel date value OR a text string like "DATE-06-07-2026" (handled inline
// inside submitRawMaterial below).

let rmCurrentIdx = 0;
let rmCollectedEntries = []; // { idx, name, qty, grade } - accumulated locally, written to Excel only on final Submit

function rmUpdateDisplay() {
  const isLast = rmCurrentIdx === RM_ITEMS.length - 1;
  document.getElementById("rmProgressLabel").textContent = `Item ${rmCurrentIdx + 1} of ${RM_ITEMS.length}`;
  document.getElementById("rmCurrentItemName").textContent = RM_ITEMS[rmCurrentIdx];
  document.getElementById("rmQtyInput").value = "";
  document.getElementById("rmGradeInput").value = "";
  document.getElementById("rmBtn").textContent = isLast ? "Submit All" : "Next";
}
rmUpdateDisplay();

function rmStoreCurrentEntry() {
  const qty = document.getElementById("rmQtyInput").value.trim();
  const grade = document.getElementById("rmGradeInput").value.trim();
  if (qty !== "" || grade !== "") {
    // Replace any earlier entry for this same item (e.g. if the user went
    // back via Restart and re-entered it) rather than duplicating it.
    rmCollectedEntries = rmCollectedEntries.filter(e => e.idx !== rmCurrentIdx);
    rmCollectedEntries.push({ idx: rmCurrentIdx, name: RM_ITEMS[rmCurrentIdx], qty, grade });
  }
}

function rmAdvance() {
  if (rmCurrentIdx < RM_ITEMS.length - 1) {
    rmCurrentIdx++;
    rmUpdateDisplay();
  } else {
    document.getElementById("rmProgressLabel").textContent = "Last item - press Submit All to save";
  }
}

document.getElementById("rmSkipBtn").addEventListener("click", rmAdvance);
document.getElementById("rmRestartBtn").addEventListener("click", () => {
  rmCurrentIdx = 0;
  rmCollectedEntries = [];
  rmUpdateDisplay();
});

async function submitRawMaterial() {
  const statusEl = document.getElementById("status");
  const isLast = rmCurrentIdx === RM_ITEMS.length - 1;

  // Store whatever's currently on screen before either advancing or submitting.
  rmStoreCurrentEntry();

  if (!isLast) {
    rmAdvance();
    return;
  }

  // Last item - this click means "Submit All": write every collected entry
  // to Excel in one go.
  const manualFilePath = document.getElementById("filePath").value.trim();
  const sheetName = document.getElementById("rmSheetName").value.trim();
  const dateVal = document.getElementById("rmDate").value; // "YYYY-MM-DD"

  if (!dateVal) {
    statusEl.className = "err";
    statusEl.textContent = "Please select a date first.";
    return;
  }
  if (rmCollectedEntries.length === 0) {
    statusEl.className = "err";
    statusEl.textContent = "No items were filled in - nothing to submit.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = `Saving ${rmCollectedEntries.length} item(s)...`;

  try {
    const token = await getToken();

    // Auto-detect the correct month's file from the picked date (same fix
    // as RHF Billets Entry / Hot Out Entry) - otherwise this keeps using
    // whatever file happens to be in the File Location box, which fails
    // with a 404 once the month rolls over.
    const [rmy, rmm] = dateVal.split("-").map(Number);
    statusEl.textContent = `Locating the file for ${MONTH_ABBR[rmm - 1]} ${rmy}...`;
    const rmAutoPath = await detectFilePathForMonth(token, rmy, rmm - 1);
    const filePath = rmAutoPath || manualFilePath;
    if (!filePath) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't automatically find the file for ${MONTH_ABBR[rmm - 1]} ${rmy} - is it on your OneDrive? (Menu → Get Started → Put formats on the Desktop)`;
      return;
    }

    statusEl.textContent = `Saving ${rmCollectedEntries.length} item(s)...`;
    const wb = await resolveWorkbook(token, filePath);

    const scan = await graphFetch(
      `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=values,text`,
      token
    );
    const [y, m, d] = dateVal.split("-");
    const ddmm1 = `${d}-${m}-${y}`;
    const ddmm2 = `${parseInt(d)}-${parseInt(m)}-${y}`;

    let titleRow = -1;
    for (let i = 0; i < scan.values.length; i++) {
      const v = scan.values[i][0];
      const txt = (scan.text[i][0] || "").toString();
      if (typeof v === "number" && excelSerialToISODate(v) === dateVal) { titleRow = i + 1; break; }
      if (txt.includes(ddmm1) || txt.includes(ddmm2)) { titleRow = i + 1; break; }
    }

    if (titleRow === -1) {
      statusEl.className = "err";
      statusEl.textContent = "Block for this date not found in the sheet.";
      return;
    }

    let log = "";
    // Cells are collected and written in ONE call (patchCells) instead of one call each.
    const _pieces = [];
    const patchRange = async (_wb, _sheet, addr, values) => { _pieces.push({ addr, values }); };
    for (const entry of rmCollectedEntries) {
      const r = titleRow + 3 + entry.idx;
      let entryLog = `${entry.name}: `;
      if (entry.qty !== "") {
        await patchRange(wb, sheetName, `F${r}:F${r}`, [[parseFloat(entry.qty)]], token);
        entryLog += `Qty=${entry.qty} `;
      }
      if (entry.grade !== "") {
        await patchRange(wb, sheetName, `G${r}:G${r}`, [[parseFloat(entry.grade)]], token);
        entryLog += `Grade=${entry.grade} `;
      }
      log += entryLog + `(row ${r})\n`;
      statusEl.textContent = `Saving... (${entry.name})`;
    }

    await patchCells(wb, sheetName, rowPiecesToCells(_pieces), token);
    statusEl.className = "ok";
    statusEl.textContent = `Raw Material (${dateVal}) - ${rmCollectedEntries.length} item(s) saved:\n${log}`;
    showCompletionPopup(`Raw Material (${dateVal}) - ${rmCollectedEntries.length} item(s) saved:\n${log}`);

    rmCurrentIdx = 0;
    rmCollectedEntries = [];
    rmUpdateDisplay();

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("rmBtn").addEventListener("click", submitRawMaterial);
/* ---- Raw Material / Scrap: fill from a photo / screenshot of the RM table ---- */
// Reads the table grid (lines) from the picture, OCRs each cell with Tesseract.js
// (loaded only when needed), shows the values for checking, then writes Qty (F) and
// Fe(M) / Grade (G) to the rows whose item name matches in that date's block.
const RM_OCR_LIB = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
let rmOcrRows = [];
function rmNorm(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function rmLev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function rmLoadOcr() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = RM_OCR_LIB; s.integrity = "sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F"; s.crossOrigin = "anonymous"; s.onload = res; s.onerror = () => rej(new Error("OCR library could not load (internet needed)")); document.head.appendChild(s); });
}
function rmFileToCanvas(file) {
  return new Promise((res, rej) => {
    const img = new Image(); img.onload = () => {
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0); URL.revokeObjectURL(img.src); res(c);
    }; img.onerror = () => rej(new Error("Image could not be opened")); img.src = URL.createObjectURL(file);
  });
}
// grid lines = rows / columns where most pixels are dark
function rmFindGrid(cv) {
  const W = cv.width, H = cv.height, px = cv.getContext("2d").getImageData(0, 0, W, H).data;
  const g = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = (0.299 * px[4 * i] + 0.587 * px[4 * i + 1] + 0.114 * px[4 * i + 2]) < 110 ? 1 : 0;
  const rowF = [], colF = [];
  for (let y = 0; y < H; y++) { let s = 0; for (let x = 0; x < W; x++) s += g[y * W + x]; rowF.push(s / W); }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = 0; y < H; y++) s += g[y * W + x]; colF.push(s / H); }
  const group = (arr, th) => { const out = []; arr.forEach((v, i) => { if (v > th) { const l = out[out.length - 1]; if (l && i - l[1] <= 2) l[1] = i; else out.push([i, i]); } }); return out; };
  const hl = group(rowF, 0.5), vl = group(colF, 0.5);
  const spans = (l) => { const o = []; for (let i = 0; i < l.length - 1; i++) if (l[i + 1][0] - l[i][1] > 6) o.push([l[i][1] + 1, l[i + 1][0]]); return o; };
  return { rows: spans(hl), cols: spans(vl), gray: g, W };
}
// crop one cell, scale 4x, black text on white (works on coloured cell backgrounds too)
function rmCellCanvas(src, x0, y0, x1, y1) {
  x0 += 2; y0 += 2; x1 -= 2; y1 -= 1;
  const w = x1 - x0, h = y1 - y0; if (w < 4 || h < 4) return null;
  const d = src.getContext("2d").getImageData(x0, y0, w, h).data, lum = [];
  for (let i = 0; i < w * h; i++) lum.push(0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]);
  const bg = lum.slice().sort((a, b) => a - b)[Math.floor(lum.length / 2)];
  const ink = lum.filter(v => v < bg - 60).length;
  if (ink < 6) return { empty: true };
  // scale the grey cell up smoothly first, then threshold (sharper digits than thresholding first)
  const S = 4, pad = 20, t = document.createElement("canvas"); t.width = w; t.height = h;
  const tx = t.getContext("2d"), id = tx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { id.data[4 * i] = id.data[4 * i + 1] = id.data[4 * i + 2] = lum[i]; id.data[4 * i + 3] = 255; }
  tx.putImageData(id, 0, 0);
  const c = document.createElement("canvas"); c.width = w * S + 2 * pad; c.height = h * S + 2 * pad;
  const cx = c.getContext("2d"); cx.fillStyle = "rgb(" + bg + "," + bg + "," + bg + ")"; cx.fillRect(0, 0, c.width, c.height);
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = "high"; cx.drawImage(t, pad, pad, w * S, h * S);
  const big = cx.getImageData(0, 0, c.width, c.height), bd = big.data;
  for (let i = 0; i < bd.length; i += 4) { const v = bd[i] < bg - 60 ? 0 : 255; bd[i] = bd[i + 1] = bd[i + 2] = v; }
  cx.putImageData(big, 0, 0);
  return { canvas: c };
}
async function rmReadPhoto(file) {
  const st = document.getElementById("rmPhotoStatus");
  st.textContent = "Loading OCR (first time ~10 MB)...";
  await rmLoadOcr();
  const src = await rmFileToCanvas(file);
  const grid = rmFindGrid(src);
  if (grid.rows.length < 3 || grid.cols.length < 2) throw new Error("Table lines not found. Send a clear screenshot of the table (straight, with cell borders).");
  const worker = await Tesseract.createWorker("eng");
  const out = [];
  try {
    for (let r = 0; r < grid.rows.length; r++) {
      st.textContent = `Reading row ${r + 1} of ${grid.rows.length}...`;
      const [y0, y1] = grid.rows[r], cells = [];
      for (let c = 0; c < Math.min(3, grid.cols.length); c++) {
        const [x0, x1] = grid.cols[c], cc = rmCellCanvas(src, x0, y0, x1, y1);
        if (!cc || cc.empty) { cells.push(""); continue; }
        await worker.setParameters(c === 0 ? { tessedit_pageseg_mode: "7", tessedit_char_whitelist: "" }
          : { tessedit_pageseg_mode: "7", tessedit_char_whitelist: "0123456789." });
        const { data } = await worker.recognize(cc.canvas);
        cells.push(String(data.text || "").replace(/\s+/g, " ").trim());
      }
      out.push(cells);
    }
  } finally { await worker.terminate(); }
  return out;
}
// OCR label -> official item name (exact first, then closest within 3 edits)
const RM_PHOTO_NAMES = ["Raw Slag", "Slag Jam", "Mag. Material", "BILLET END CUT", "PIG IRON", "OVER SIZE MAG", "LUMPS", "PELLET",
  "FINES", "OUT SIDE FINES", "OUT SIDE LUMPS", "SCRAP", "MS SCRAP", "MS SCRAP-ROLLING MILL", "SUPER HEAVY", "HEAVY", "COMMERCIAL",
  "LIGHT COMMERCIAL", "C I SCRAP", "DUST"];
function rmMatchName(label) {
  const n = rmNorm(label); if (!n || /TOTAL/.test(n)) return null;
  let best = null, bd = 99;
  for (const nm of RM_PHOTO_NAMES) { const d = rmLev(n, rmNorm(nm)); if (d < bd) { bd = d; best = nm; } }
  return bd <= Math.max(1, Math.floor(rmNorm(best).length / 4)) ? best : null;
}
function rmNum(s) { const m = /\d+(?:\.\d+)?/.exec(String(s || "")); return m ? m[0] : ""; }
function rmRenderReview() {
  const box = document.getElementById("rmPhotoReview");
  if (!rmOcrRows.length) { box.innerHTML = ""; return; }
  const td = "border:1px solid rgba(128,128,128,.45);padding:3px 4px;";
  box.innerHTML = `<div style="font-size:12px;color:var(--muted);margin:6px 0">Check every value against the photo and correct if needed. Empty boxes are not written (cells stay as they are).</div>
    <div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:13px;width:100%"><tr><th style="${td}">Item</th><th style="${td}">Qty (MT)</th><th style="${td}">Fe(M) / Grade</th></tr>` +
    rmOcrRows.map((r, i) => `<tr><td style="${td}">${_escH(r.name || "❓ " + r.raw)}</td>
      <td style="${td}"><input data-i="${i}" data-k="qty" class="rmPhIn" value="${_escH(r.qty)}" style="width:90px;padding:4px" inputmode="decimal"></td>
      <td style="${td}"><input data-i="${i}" data-k="grade" class="rmPhIn" value="${_escH(r.grade)}" style="width:70px;padding:4px" inputmode="decimal">${r.note ? `<div style="font-size:11px;color:#c0392b">${_escH(r.note)}</div>` : ""}</td></tr>`).join("") +
    `</table></div><div class="btnRow"><button class="primary" id="rmPhotoSave" type="button">✅ Save to sheet</button><button class="secondary" id="rmPhotoCancel" type="button">Cancel</button></div>`;
  box.querySelectorAll(".rmPhIn").forEach(el => el.addEventListener("input", () => { rmOcrRows[+el.dataset.i][el.dataset.k] = el.value.trim(); }));
  document.getElementById("rmPhotoCancel").onclick = () => { rmOcrRows = []; rmRenderReview(); document.getElementById("rmPhotoStatus").textContent = ""; };
  document.getElementById("rmPhotoSave").onclick = rmSavePhotoRows;
}
async function rmSavePhotoRows() {
  const statusEl = document.getElementById("status");
  const dateVal = document.getElementById("rmDate").value;
  const sheetName = document.getElementById("rmSheetName").value.trim();
  if (!dateVal) { alert("Please select the date first."); return; }
  const rows = rmOcrRows.filter(r => r.name && (r.qty !== "" || r.grade !== ""));
  const bad = rows.find(r => (r.qty !== "" && isNaN(parseFloat(r.qty))) || (r.grade !== "" && isNaN(parseFloat(r.grade))));
  if (bad) { alert(`${bad.name}: value is not a number.`); return; }
  if (!rows.length) { alert("Nothing to save."); return; }
  statusEl.className = "wait"; statusEl.textContent = `Saving ${rows.length} item(s) from photo...`;
  try {
    const token = await getToken();
    const [y, m, d] = dateVal.split("-");
    const path = await detectFilePathForMonth(token, +y, +m - 1) || document.getElementById("filePath").value.trim();
    if (!path) throw new Error(`file for ${MONTH_ABBR[+m - 1]} ${y} not found`);
    const wb = await resolveWorkbook(token, path);
    const scan = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:G2000')?$select=values,text`, token);
    const ddmm1 = `${d}-${m}-${y}`, ddmm2 = `${parseInt(d)}-${parseInt(m)}-${y}`;
    let titleRow = -1;
    for (let i = 0; i < scan.values.length; i++) {
      const v = scan.values[i][0], txt = String(scan.text[i][0] || "");
      if ((typeof v === "number" && excelSerialToISODate(v) === dateVal) || txt.includes(ddmm1) || txt.includes(ddmm2)) { titleRow = i + 1; break; }
    }
    if (titleRow === -1) throw new Error("Block for this date not found in the sheet.");
    // item rows of this block: look for the item name in columns A-E of the next 40 rows
    const rowOf = {};
    for (let i = titleRow; i < Math.min(scan.values.length, titleRow + 40); i++) {
      for (let c = 0; c < 5; c++) { const k = rmNorm(scan.text[i][c]); if (k && !(k in rowOf)) rowOf[k] = i + 1; }
    }
    // Cells are collected and written in ONE call (patchCells) instead of one call each.
    const _pieces = [];
    const patchRange = async (_wb, _sheet, addr, values) => { _pieces.push({ addr, values }); };
    let log = "", miss = [];
    for (const r of rows) {
      const row = rowOf[rmNorm(r.name)];
      if (!row) { miss.push(r.name); continue; }
      if (r.qty !== "") await patchRange(wb, sheetName, `F${row}:F${row}`, [[parseFloat(r.qty)]], token);
      if (r.grade !== "") await patchRange(wb, sheetName, `G${row}:G${row}`, [[parseFloat(r.grade)]], token);
      log += `${r.name}: ${r.qty !== "" ? "Qty=" + r.qty + " " : ""}${r.grade !== "" ? "Fe(M)=" + r.grade + " " : ""}(row ${row})\n`;
    }
    await patchCells(wb, sheetName, rowPiecesToCells(_pieces), token);
    if (miss.length) log += `⚠️ Not found in the sheet block (not written): ${miss.join(", ")}\n`;
    statusEl.className = miss.length ? "err" : "ok";
    statusEl.textContent = `Raw Material from photo (${dateVal}):\n${log}`;
    showCompletionPopup(`Raw Material from photo (${dateVal}):\n${log}`);
    if (!miss.length) { rmOcrRows = []; rmRenderReview(); document.getElementById("rmPhotoStatus").textContent = ""; }
  } catch (e) { statusEl.className = "err"; statusEl.textContent = "Error: " + e.message; }
}
mzAfterLoad(() => {
  const inp = document.getElementById("rmPhotoInput"); if (!inp) return;
  inp.addEventListener("change", async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const st = document.getElementById("rmPhotoStatus");
    try {
      const cells = await rmReadPhoto(f);
      rmOcrRows = cells.map(c => {
        const name = rmMatchName(c[0]); let qty = rmNum(c[1]), grade = rmNum(c[2]), note = "";
        if (grade !== "" && parseFloat(grade) > 100) { note = `${grade} ignored (not a %; e.g. TOTAL RM)`; grade = ""; }
        if (qty !== "" && !/^\d+\.\d{3}$/.test(qty)) note = (note ? note + "; " : "") + "check Qty (usually 3 decimals)";
        return { raw: c[0], name, qty, grade, note };
      }).filter(r => r.name || r.qty || r.grade);
      const unk = rmOcrRows.filter(r => !r.name).length;
      st.textContent = `Read ${rmOcrRows.length} row(s) from the photo.` + (unk ? ` ${unk} item name(s) not recognised (❓) - they will not be saved.` : "");
      rmRenderReview();
    } catch (e) { st.textContent = "❌ " + e.message; }
    inp.value = "";
  });
});
/* ===================== CREATE NEXT DAY BLOCK (Prod. sheet) ===================== */
const PROD_BLOCK_PERIOD = 18;   // one furnace (12 heats); two furnaces (F-A + F-B, 24 heats) = 30 - read from the sheet

// Heat no.: "5.11.3" (one furnace) or "F-A-5.11.3" / "F-B-5.11.3" (two furnaces)
const HEAT_NO_RE = /^\s*(?:F\s*-?\s*([A-J])\s*-\s*)?0*(\d{1,2})\s*\.\s*0*(\d{1,2})\s*\.\s*0*(\d{1,2})\s*$/i;
// heat rows of the Prod. day block that starts at values[i] (rows read from column A, so B = index 1):
// the "MIN" row comes right after the last heat row
function heatsAt(values, i) {
  for (let k = 1; k <= 40 && i + k < values.length; k++) {
    if (String(((values[i + k] || [])[1]) ?? "").trim().toUpperCase() === "MIN") return k;
  }
  return 12;
}
const _prodHeatsCache = new Map();
async function prodHeatsFor(wb, token, sheetName) {
  const name = sheetName || (document.getElementById("sheetName").value.trim() || "Prod.");
  const key = `${wb}|${name}`;
  if (_prodHeatsCache.has(key)) return _prodHeatsCache.get(key);
  let heats = 12;
  try {
    const r = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(name).replace(/'/g, "''"))}')/range(address='A1:B80')?$select=values`, token);
    const v = r.values || [];
    const first = v.findIndex(x => typeof x[0] === "number" && x[0] > 40000);
    if (first >= 0) heats = heatsAt(v, first);
  } catch (e) { /* not readable - one furnace */ }
  _prodHeatsCache.set(key, heats);
  return heats;
}
// heat no. of heat row idx (1-based) of a day
function heatLabel(d, m, idx, heats, cru) {
  if (cru) return `F-${cru}-${d}.${m}.${idx}`;                       // crucible's own file (2-3 crucibles)
  if (heats > 12) return `${idx <= 12 ? "F-A" : "F-B"}-${d}.${m}.${idx <= 12 ? idx : idx - 12}`;
  return `${d}.${m}.${idx}`;
}
// crucible letter of a block from its first heat no. ("F-B-5.11.1" -> "B"; plain or two-furnace sheet -> "")
async function cruOfBlock(wb, token, sheetName, row, heats) {
  if (!xlCrus()[0] || heats > 12) return "";
  try {
    const r = await graphFetch(`${xlSheetUrl(wb, sheetName)}/range(address='B${row}')?$select=text`, token);
    const m = /^\s*F\s*-\s*([A-J])\s*-/i.exec(String(((r.text || [])[0] || [])[0] || ""));
    return m ? m[1].toUpperCase() : "";
  } catch (e) { return ""; }
}

// Shifts relative row references inside a formula by rowDelta rows.
// $-anchored (absolute) row references are left untouched.
// A trailing "(" after the match means it's a function name, not a cell ref.
function shiftFormulaRows(formula, rowDelta) {
  if (typeof formula !== "string" || !formula.startsWith("=")) return formula;
  return formula.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)(?!\()/g, (match, colAbs, col, rowAbs, row) => {
    if (rowAbs === "$") return match;
    return colAbs + col + rowAbs + (parseInt(row) + rowDelta);
  });
}

// Column indices (0-based) for the A:AH range used by the Prod. sheet block
// (Next Day Block creation is strictly limited to A:AH - nothing beyond is touched).
const COL = {
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12,
  N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24,
  Z: 25, AA: 26, AB: 27, AC: 28, AD: 29, AE: 30, AF: 31, AG: 32, AH: 33
};

function classifyCell(rowOffset, colIdx, heats = 12) {
  // RHF entry cells (J,K,L,M) on the MAX row (130) and Total row (160) - fresh/blank
  if ((rowOffset === heats + 4 || rowOffset === heats + 5) && colIdx >= COL.J && colIdx <= COL.M) {
    return "BLANK";
  }
  // Title / header rows - copy as-is
  if (rowOffset <= 2) return "COPY";
  // heat data rows (12, or 24 with two furnaces)
  if (rowOffset >= 3 && rowOffset <= heats + 2) {
    if (colIdx === COL.A) return rowOffset === 3 ? "DATE" : "BLANK";
    if (colIdx === COL.B) return "HEATNO";
    if (colIdx >= COL.C && colIdx <= COL.H) return "BLANK";      // analysis + size
    if (colIdx >= COL.J && colIdx <= COL.M) return "BLANK";      // 130x130 (unused)
    if (colIdx >= COL.P && colIdx <= COL.S) return "BLANK";      // hot charging
    if (colIdx >= COL.V && colIdx <= COL.Y) return "BLANK";      // bypass
    if (colIdx >= COL.AC && colIdx <= COL.AF) return "BLANK";    // hot out (per-heat, from WhatsApp message)
    return "COPY"; // I (helper), N/O, T/U, Z/AA, AB, AG/AH - formulas
  }
  // MIN row (15), MAX row (16), Total row (17) - copy thresholds/labels/formulas as-is
  return "COPY";
}

/* ===================== NEXT DAY BLOCK: COPY FROM THE SHEET ITSELF ===================== */
// Every sheet's next-day block is now made like a copy-paste of the previous
// day's block, done through the Graph API:
//  - formulas (relative rows shifted) + number formats come from the
//    previous block;
//  - background colour and font colour/bold/italic are READ cell by cell
//    from the previous block and written to the same cell of the new block
//    (no hard-coded colours any more);
//  - any cell in the new block's area that ALREADY has data or a formula is
//    left completely untouched (no value, no format change).
// Graph has no "copy range with formats" command, so formats are read with
// batched requests (20 per call) - a block takes a little longer than before.

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function colLetter(n) { // 0 -> A, 25 -> Z, 26 -> AA
  let s = ""; n = n + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Runs many Graph requests with only a few in flight at a time (Excel
// rejects too many parallel edits on one workbook). Each request is retried
// on failure. Returns results in the same order: { status, body }.
async function graphBatch(token, reqs, onProgress, concurrency) {
  const out = new Array(reqs.length);
  const limit = concurrency || 3;
  let next = 0, done = 0, failedFinal = 0;
  const runOne = async (i) => {
    const r = reqs[i];
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const body = await graphFetch(r.url, token, r.body !== undefined
          ? { method: r.method || "GET", body: JSON.stringify(r.body) }
          : { method: r.method || "GET" });
        out[i] = { status: 200, body };
        return;
      } catch (e) {
        await new Promise(res => setTimeout(res, 1200 * (attempt + 1)));
      }
    }
    failedFinal++;
  };
  const worker = async () => {
    while (next < reqs.length) {
      const i = next++;
      await runOne(i);
      done++;
      if (onProgress && (done % 10 === 0 || done === reqs.length)) onProgress(done, reqs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, reqs.length) }, worker));
  if (failedFinal) throw new Error(`${failedFinal} Excel request(s) failed after retries - run "🎨 Fix Colours of Last Block" to finish the colours.`);
  return out;
}

// Fast WRITES for formatting: up to 20 requests in one $batch call, 2 calls
// at a time (instead of one HTTP call per write). A write that fails because
// Excel was busy (429/409/5xx) is tried again on its own; a write Excel
// rejects (e.g. part of a merged cell) is NOT retried again and again - it is
// noted and shown at the end, the rest of the block carries on.
let _nextDayWarn = [];
let _nextDayWrites = 0;   // number of formatting writes (shown in the summary)
// Microsoft's advice for Excel: one write after the other on a workbook (parallel
// writes are what cause "Excel is busy / too many requests"). So the 20 writes
// of a $batch are chained with dependsOn (Excel runs them in order) and one
// $batch is sent at a time - still only one HTTP call per 20 writes.
async function graphBatchWrite(token, reqs, onProgress) {
  const chunks = [];
  for (let k = 0; k < reqs.length; k += 20) chunks.push(reqs.map((r, i) => i).slice(k, k + 20));
  const retry = [], bad = [];
  let next = 0, done = 0;
  _nextDayWrites += reqs.length;
  const errMsg = b => (b && b.error && (b.error.message || b.error.code)) || "";
  const worker = async () => {
    while (next < chunks.length) {
      const chunk = chunks[next++];
      const body = { requests: chunk.map((i, k) => {
        const q = { id: String(i), method: reqs[i].method || "PATCH",
          url: reqs[i].url.replace(GRAPH_BASE, ""), headers: { "Content-Type": "application/json", ...wbSessionHeader(reqs[i].url, token) }, body: reqs[i].body || {} };
        if (k > 0) q.dependsOn = [String(chunk[k - 1])];
        return q;
      }) };
      try {
        const resp = await graphFetch(`${GRAPH_BASE}/$batch`, token, { method: "POST", body: JSON.stringify(body) });
        const seen = new Set();
        (resp.responses || []).forEach(r => {
          const i = parseInt(r.id, 10); seen.add(i);
          if (r.status >= 200 && r.status < 300) return;
          // 424 = not run because an earlier write of the chain failed -> try again on its own
          if (r.status === 429 || r.status === 409 || r.status === 424 || r.status >= 500 || /session/i.test(errMsg(r.body))) retry.push(i);
          else bad.push({ i, msg: `${r.status} ${errMsg(r.body)}` });
        });
        chunk.forEach(i => { if (!seen.has(i)) retry.push(i); });
      } catch (e) { chunk.forEach(i => retry.push(i)); }
      done += chunk.length;
      if (onProgress) onProgress(Math.min(done, reqs.length), reqs.length);
    }
  };
  await worker();
  retry.sort((a, b) => a - b);
  for (const i of retry) {
    const r = reqs[i];
    try { await graphFetch(r.url, token, { method: r.method || "PATCH", body: JSON.stringify(r.body || {}) }); }
    catch (e) { bad.push({ i, msg: e && e.message ? e.message : String(e) }); }
  }
  return bad.map(b => {
    const a = (reqs[b.i].url.match(/address='([^']+)'/) || [])[1] || "";
    const what = (reqs[b.i].url.match(/format\/(\w+)/) || [])[1] || "";
    return `${a} ${what}: ${String(b.msg).slice(0, 120)}`;
  });
}

// Fast READS: sends up to 20 GET requests in one $batch call, a couple of
// batches at a time. Anything that fails inside a batch is retried on its
// own through graphBatch(). Only used for reading (reads don't lock the
// workbook); writes still go through graphBatch() a few at a time.
async function graphBatchRead(token, reqs, onProgress) {
  const out = new Array(reqs.length);
  const retry = [];
  const chunks = [];
  for (let k = 0; k < reqs.length; k += 20) chunks.push(reqs.map((r, i) => i).slice(k, k + 20));
  let next = 0, done = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const chunk = chunks[next++];
      const body = { requests: chunk.map(i => ({ id: String(i), method: "GET", url: reqs[i].url.replace(GRAPH_BASE, ""), headers: wbSessionHeader(reqs[i].url, token) })) };
      try {
        const resp = await graphFetch(`${GRAPH_BASE}/$batch`, token, { method: "POST", body: JSON.stringify(body), readOnly: true });
        const seen = new Set();
        (resp.responses || []).forEach(r => {
          const i = parseInt(r.id, 10);
          seen.add(i);
          if (r.status >= 200 && r.status < 300 && r.body) out[i] = { status: r.status, body: r.body };
          else retry.push(i);
        });
        chunk.forEach(i => { if (!seen.has(i)) retry.push(i); });
      } catch (e) {
        chunk.forEach(i => retry.push(i));
      }
      done += chunk.length;
      if (onProgress) onProgress(Math.min(done, reqs.length), reqs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, chunks.length) }, worker));
  if (retry.length) {
    const again = await graphBatch(token, retry.map(i => reqs[i]), null, 3);
    retry.forEach((i, k) => { out[i] = again[k]; });
  }
  return out;
}

// Copies background + font (colour/bold/italic) cell by cell from the block
// at srcTop to the block at destTop. skipCell(r, c) -> true leaves a cell alone.
// Speed-ups:
//  - the colour layout read from the sheet is remembered on this device per
//    sheet, so the next day's block skips the slow "reading" step
//    (useCache). "Fix Colours of Last Block" always reads fresh from the
//    sheet and refreshes this memory - use it after changing colours in Excel.
//  - neighbouring cells with the same colour (across a row AND down the
//    rows) are written as one rectangle, so far fewer writes are needed.
// Reads the background + font of every cell of a block (relative to
// srcTop). Uses the remembered layout of this sheet when useCache is true.
// The colour / border layout read from a sheet is kept in OneDrive (Apps
// folder -> nextday_layout.json) as well as on this device, so the slow
// "reading colours / borders" step is done once for ALL devices - not once
// per phone / PC. "Fix Colours of Last Block" reads fresh and updates it.
const NEXTDAY_LAYOUT_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/nextday_layout.json:/content";
let _layoutCloud = null, _layoutDirty = false;
async function layoutCloudLoad(token) {
  if (_layoutCloud) return;
  try {
    const r = await fetch(NEXTDAY_LAYOUT_URL + "?t=" + Date.now(), { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
    _layoutCloud = r.ok ? (await r.json()) || {} : {};
  } catch (e) { _layoutCloud = {}; }
}
function layoutGet(key) {
  if (_layoutCloud && _layoutCloud[key]) {
    try { localStorage.setItem(key, JSON.stringify(_layoutCloud[key])); } catch (e) {}
    return _layoutCloud[key];
  }
  let v = null;
  try { v = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { v = null; }
  if (v && _layoutCloud) { _layoutCloud[key] = v; _layoutDirty = true; } // share this device's copy
  return v;
}
function layoutSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  if (_layoutCloud) { _layoutCloud[key] = val; _layoutDirty = true; }
}
async function layoutCloudSave(token) {
  if (!_layoutCloud || !_layoutDirty) return;
  try {
    const t = await getTokenFresh(120000) || token;
    const r = await fetch(NEXTDAY_LAYOUT_URL, { method: "PUT",
      headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(_layoutCloud) });
    if (r.ok) _layoutDirty = false;
  } catch (e) { console.warn("layout upload failed", e); }
}
// Start / end of a long block job: OneDrive layout + Excel session.
async function nextDayJobStart(wb, token) {
  _nextDayWrites = 0;
  if (!_layoutDirty) _layoutCloud = null;   // read the latest copy from OneDrive
  await Promise.all([layoutCloudLoad(token), wbSessionOpen(wb, token)]);
}
async function nextDayJobEnd(token) {
  await Promise.all([layoutCloudSave(token), wbSessionClose(token)]);
}

// Most common value of a cell map (used as the "base" written to the whole
// block in ONE write; only the cells that differ are written after it).
function mostCommon(list) {
  const n = new Map(); let best = null, bn = 0;
  list.forEach(v => { const k = n.get(v) + 1 || 1; n.set(v, k); if (k > bn) { bn = k; best = v; } });
  return best;
}

async function readBlockFormats({ wb, sheetName, token, srcTop, nRows, lastColIdx, skipCell, label, useCache, colOff = 0 }) {
  const statusEl = document.getElementById("status");
  const sh = `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')`;
  const cacheKey = `nextDayFmt:${sheetName}:${nRows}:${lastColIdx}` + (colOff ? `:c${colOff}` : "");
  const skip = (r, c) => !!(skipCell && skipCell(r, c));

  let fmt = null;
  if (useCache && !_layoutCloud) await layoutCloudLoad(token);   // shared layout from OneDrive (all devices)
  if (useCache) fmt = layoutGet(cacheKey);
  if (!fmt) {
    const cells = [];
    for (let r = 0; r < nRows; r++) for (let c = 0; c <= lastColIdx; c++) if (!skip(r, c)) cells.push({ r, c });
    const reads = [];
    cells.forEach(({ r, c }) => {
      const a = `${colLetter(colOff + c)}${srcTop + r}`;
      reads.push({ url: `${sh}/range(address='${a}')/format/fill` });
      reads.push({ url: `${sh}/range(address='${a}')/format/font` });
    });
    const got = await graphBatchRead(token, reads, (d, t) => {
      if (statusEl) statusEl.textContent = `${label}: reading colours from the sheet... (${d}/${t})`;
    });
    fmt = {};
    cells.forEach(({ r, c }, k) => {
      const fill = got[2 * k] && got[2 * k].body ? got[2 * k].body : {};
      const font = got[2 * k + 1] && got[2 * k + 1].body ? got[2 * k + 1].body : {};
      fmt[`${r},${c}`] = {
        fill: (fill.color || "#FFFFFF").toUpperCase(),
        font: { color: font.color || "#000000", bold: !!font.bold, italic: !!font.italic }
      };
    });
    // remember only a complete layout (nothing skipped)
    if (cells.length === nRows * (lastColIdx + 1) && got.every(g => g && g.body)) { layoutSet(cacheKey, fmt); layoutCloudSave(token); }
  }
  return fmt;
}

async function copyBlockFormats({ wb, sheetName, token, srcTop, destTop, nRows, lastColIdx, skipCell, label, useCache, colOff = 0 }) {
  const statusEl = document.getElementById("status");
  const sh = `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')`;
  const skip = (r, c) => !!(skipCell && skipCell(r, c));
  const fmt = await readBlockFormats({ wb, sheetName, token, srcTop, nRows, lastColIdx, skipCell, label, useCache, colOff });

  // Build rectangles of identical value: first runs along each row, then
  // stack identical runs (same columns, same value) from consecutive rows.
  // base: when no cell of the new block is skipped, the most common colour /
  // font is written to the whole block at once and only the other cells after it.
  let anySkip = false;
  for (let r = 0; r < nRows && !anySkip; r++) for (let c = 0; c <= lastColIdx; c++) if (skip(r, c) || !fmt[`${r},${c}`]) { anySkip = true; break; }
  const all = [];
  for (let r = 0; r < nRows; r++) for (let c = 0; c <= lastColIdx; c++) if (fmt[`${r},${c}`]) all.push(fmt[`${r},${c}`]);
  const baseFill = anySkip ? null : mostCommon(all.map(f => f.fill));
  const baseFont = anySkip ? null : mostCommon(all.map(f => JSON.stringify(f.font)));
  const rects = (valueOf, base) => {
    const runs = [];
    const want = (r, c) => !skip(r, c) && fmt[`${r},${c}`] && valueOf(fmt[`${r},${c}`]) !== base;
    for (let r = 0; r < nRows; r++) {
      let c = 0;
      while (c <= lastColIdx) {
        if (!want(r, c)) { c++; continue; }
        const v = valueOf(fmt[`${r},${c}`]);
        let e = c;
        while (e + 1 <= lastColIdx && want(r, e + 1) && valueOf(fmt[`${r},${e + 1}`]) === v) e++;
        runs.push({ r1: r, r2: r, c1: c, c2: e, v });
        c = e + 1;
      }
    }
    const open = new Map(); // "c1-c2-v" -> rect still growing
    const out = [];
    runs.forEach(run => {
      const k = `${run.c1}-${run.c2}-${run.v}`;
      const prev = open.get(k);
      if (prev && prev.r2 === run.r1 - 1) { prev.r2 = run.r1; }
      else { const rect = { ...run }; open.set(k, rect); out.push(rect); }
    });
    return out;
  };
  const addr = (q) => `${colLetter(colOff + q.c1)}${destTop + q.r1}:${colLetter(colOff + q.c2)}${destTop + q.r2}`;

  const baseW = [], writes = [];
  const fillW = (a, v) => v === "#FFFFFF"
    ? { method: "POST", url: `${sh}/range(address='${a}')/format/fill/clear`, body: {} }
    : { method: "PATCH", url: `${sh}/range(address='${a}')/format/fill`, body: { color: v } };
  const whole = `${colLetter(colOff)}${destTop}:${colLetter(colOff + lastColIdx)}${destTop + nRows - 1}`;
  if (baseFill !== null) baseW.push(fillW(whole, baseFill));
  if (baseFont !== null) baseW.push({ method: "PATCH", url: `${sh}/range(address='${whole}')/format/font`, body: JSON.parse(baseFont) });
  rects(f => f.fill, baseFill).forEach(q => writes.push(fillW(addr(q), q.v)));
  rects(f => JSON.stringify(f.font), baseFont).forEach(q => {
    writes.push({ method: "PATCH", url: `${sh}/range(address='${addr(q)}')/format/font`, body: JSON.parse(q.v) });
  });
  // base first (finished, incl. retries), then the cells that differ
  const n = baseW.length + writes.length;
  const bad = (await graphBatchWrite(token, baseW)).concat(await graphBatchWrite(token, writes, (d) => {
    statusEl.textContent = `${label}: applying colours to the new block... (${baseW.length + d}/${n})`;
  }));
  bad.forEach(m => _nextDayWarn.push(`${label} colour ${m}`));
}

// Copies cell borders (thin / medium / thick / none, style + colour) from
// the block at srcTop to the block at destTop, exactly as they are in the
// previous day's block - no fixed "thin everywhere" rule any more.
// Every cell's 4 edges are read; each line between two cells gets one value
// (the heavier of the two sides); equal lines are joined into rectangles so
// only a few writes are needed. Inside lines, the bottom and the left edge of
// the new block are cleared first (wrong borders from earlier runs go away);
// the top/right edge are only added to, so the block above / columns to the
// right are never touched.
const _BW = { None: 0, Hairline: 1, Thin: 2, Medium: 3, Thick: 4 };
async function copyBlockBorders({ wb, sheetName, token, srcTop, destTop, nRows, lastColIdx, label, useCache, colOff = 0 }) {
  const statusEl = document.getElementById("status");
  const sh = `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')`;
  const nCols = lastColIdx + 1;
  const cacheKey = `nextDayBdr:v1:${sheetName}:${nRows}:${lastColIdx}` + (colOff ? `:c${colOff}` : "");
  const cached = useCache ? layoutGet(cacheKey) : null;
  let H, V;
  if (cached && cached.H && cached.V) { H = cached.H; V = cached.V; } else {
  const reads = [];
  for (let r = 0; r < nRows; r++) for (let c = 0; c < nCols; c++)
    reads.push({ url: `${sh}/range(address='${colLetter(colOff + c)}${srcTop + r}')/format/borders` });
  const got = await graphBatchRead(token, reads, (d, t) => {
    if (statusEl) statusEl.textContent = `${label}: reading borders... (${d}/${t})`;
  });
  const cell = (r, c) => {
    const g = got[r * nCols + c];
    const o = {};
    ((g && g.body && g.body.value) || []).forEach(b => { o[b.sideIndex] = b; });
    return o;
  };
  const C = [];
  for (let r = 0; r < nRows; r++) { C.push([]); for (let c = 0; c < nCols; c++) C[r].push(cell(r, c)); }
  const keyOf = b => (!b || !b.style || b.style === "None") ? "" : `${b.style}|${b.weight || "Thin"}|${(b.color || "#000000").toUpperCase()}`;
  const pick = (a, b) => { // heavier of two sides
    const ka = keyOf(a), kb = keyOf(b);
    if (!ka) return kb; if (!kb) return ka;
    return (_BW[b.weight] || 0) > (_BW[a.weight] || 0) ? kb : ka;
  };
  // H[b][c]: line above row b (b = 0..nRows); V[b][r]: line left of col b (b = 0..nCols)
  H = []; V = [];
  for (let b = 0; b <= nRows; b++) { H.push([]); for (let c = 0; c < nCols; c++)
    H[b].push(pick(b > 0 ? C[b - 1][c].EdgeBottom : null, b < nRows ? C[b][c].EdgeTop : null)); }
  for (let b = 0; b <= nCols; b++) { V.push([]); for (let r = 0; r < nRows; r++)
    V[b].push(pick(b > 0 ? C[r][b - 1].EdgeRight : null, b < nCols ? C[r][b].EdgeLeft : null)); }
  // remember this sheet's border layout only when every cell was read
  if (got.every(g => g && g.body)) layoutSet(cacheKey, { H, V });
  }
  // runs along each line, then stack identical runs from consecutive lines
  const rects = (L, len) => {
    const open = new Map(), out = [];
    L.forEach((line, b) => {
      let i = 0;
      while (i < len) {
        const k = line[i]; if (!k) { i++; continue; }
        let e = i; while (e + 1 < len && line[e + 1] === k) e++;
        const id = `${i}-${e}-${k}`, prev = open.get(id);
        if (prev && prev.b2 === b - 1) prev.b2 = b; else { const q = { b1: b, b2: b, i1: i, i2: e, k }; open.set(id, q); out.push(q); }
        i = e + 1;
      }
    });
    return out;
  };
  // Base: the most common inside line (usually thin black) is written to the
  // whole block in one go; bottom / left edge are cleared. After that only the
  // lines that differ from the base are written ("NONE" = must be no line).
  // Top edge and right edge are only added to (block above / columns to the
  // right are never touched).
  const inner = (L, n) => { const a = []; for (let b = 1; b < n; b++) a.push(...L[b]); return a; };
  const domH = nRows > 1 ? mostCommon(inner(H, nRows)) : "";
  const domV = nCols > 1 ? mostCommon(inner(V, nCols)) : "";
  const diff = (L, n, dom) => L.map((line, b) => {
    const baseK = (b === 0 || b === n) ? "" : dom;
    return line.map(k => (k === baseK) ? "" : (k || "NONE"));
  });
  const baseW = [], writes = [];
  const lastCol = colLetter(colOff + lastColIdx), destBottom = destTop + nRows - 1;
  const body = k => { if (!k || k === "NONE") return { style: "None" }; const [style, weight, color] = k.split("|"); return { style, weight, color }; };
  const whole = `${colLetter(colOff)}${destTop}:${lastCol}${destBottom}`;
  [["InsideHorizontal", domH], ["InsideVertical", domV], ["EdgeBottom", ""], ["EdgeLeft", ""]].forEach(([side, k]) => baseW.push({ method: "PATCH",
    url: `${sh}/range(address='${whole}')/format/borders('${side}')`, body: body(k) }));
  const add = (addr, side, k) => writes.push({ method: "PATCH", url: `${sh}/range(address='${addr}')/format/borders('${side}')`, body: body(k) });
  const lines = [];
  rects(diff(H, nRows, domH), nCols).forEach(q => {
    const c1 = colLetter(colOff + q.i1), c2 = colLetter(colOff + q.i2);
    if (q.b1 === q.b2) {
      if (q.b1 < nRows) lines.push([`${c1}${destTop + q.b1}:${c2}${destTop + q.b1}`, "EdgeTop", q.k]);
      else lines.push([`${c1}${destBottom}:${c2}${destBottom}`, "EdgeBottom", q.k]);
    } else {
      const a = `${c1}${destTop + q.b1}:${c2}${destTop + q.b2 - 1}`;
      lines.push([a, "EdgeTop", q.k], [a, "EdgeBottom", q.k]);
      if (q.b2 - q.b1 > 1) lines.push([a, "InsideHorizontal", q.k]);
    }
  });
  rects(diff(V, nCols, domV), nRows).forEach(q => {
    const r1 = destTop + q.i1, r2 = destTop + q.i2;
    if (q.b1 === q.b2) {
      if (q.b1 < nCols) lines.push([`${colLetter(colOff + q.b1)}${r1}:${colLetter(colOff + q.b1)}${r2}`, "EdgeLeft", q.k]);
      else lines.push([`${lastCol}${r1}:${lastCol}${r2}`, "EdgeRight", q.k]);
    } else {
      const a = `${colLetter(colOff + q.b1)}${r1}:${colLetter(colOff + q.b2 - 1)}${r2}`;
      lines.push([a, "EdgeLeft", q.k], [a, "EdgeRight", q.k]);
      if (q.b2 - q.b1 > 1) lines.push([a, "InsideVertical", q.k]);
    }
  });
  // each line piece is written exactly once, so after the base the order doesn't matter
  lines.forEach(([a, side, k]) => add(a, side, k));
  const n = baseW.length + writes.length;
  const bad = (await graphBatchWrite(token, baseW)).concat(await graphBatchWrite(token, writes, (d) => {
    if (statusEl) statusEl.textContent = `${label}: applying borders... (${baseW.length + d}/${n})`;
  }));
  bad.forEach(m => _nextDayWarn.push(`${label} border ${m}`));
  return n;
}

// override(rowOffset, colIdx) -> undefined (copy from previous block),
// { blank: true } (leave empty), or { value: X } (write X).
async function cloneNextDayBlock({ wb, sheetName, token, srcTop, destTop, nRows, lastColIdx, override, label, collapseConst, colOff = 0, copyAlign = false }) {
  const statusEl = document.getElementById("status");
  const sh = `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')`;
  const firstCol = colLetter(colOff), lastCol = colLetter(colOff + lastColIdx);   // colOff: block that does not start in column A
  const srcAddr = `${firstCol}${srcTop}:${lastCol}${srcTop + nRows - 1}`;
  const destAddr = `${firstCol}${destTop}:${lastCol}${destTop + nRows - 1}`;
  const rowDelta = destTop - srcTop;

  const [src, dest] = await Promise.all([   // two reads at once (reads don't clash)
    graphFetch(`${sh}/range(address='${srcAddr}')?$select=formulas,numberFormat,values`, token),
    graphFetch(`${sh}/range(address='${destAddr}')?$select=formulas,values`, token)]);

  const filled = (r, c) => {
    const f = dest.formulas[r] ? dest.formulas[r][c] : "";
    const v = dest.values[r] ? dest.values[r][c] : "";
    return (f !== "" && f !== null && f !== undefined) || (v !== "" && v !== null && v !== undefined);
  };

  const formulas = [], numFmt = [];
  let skipped = 0;
  for (let r = 0; r < nRows; r++) {
    const fr = [], nr = [];
    for (let c = 0; c <= lastColIdx; c++) {
      if (filled(r, c)) { fr.push(null); nr.push(null); skipped++; continue; }
      nr.push(src.numberFormat[r][c]);
      const ov = override ? override(r, c, src.formulas[r][c]) : undefined;
      if (ov && ov.blank) fr.push(null);
      else if (ov && "value" in ov) fr.push(ov.value);
      else {
        const v = src.formulas[r][c];
        // "=322+7+5" style numbers-only formula (e.g. stock pcs with Hot Out
        // additions) -> carry the result as a plain number
        if (collapseConst && collapseConst(r, c) && typeof v === "string" && /^=[\d\s+\-*\/.()]+$/.test(v) && typeof src.values[r][c] === "number") fr.push(src.values[r][c]);
        else fr.push(v === "" || v === null ? null : shiftFormulaRows(v, rowDelta));
      }
    }
    formulas.push(fr); numFmt.push(nr);
  }
  await graphFetch(`${sh}/range(address='${destAddr}')`, token,
    { method: "PATCH", body: JSON.stringify({ numberFormat: numFmt, formulas }) });

  // ---- copy background + font from the previous block, cell by cell ----
  await copyBlockFormats({ wb, sheetName, token, srcTop, destTop, nRows, lastColIdx, label, useCache: true, colOff,
    skipCell: (r, c) => filled(r, c) });
  await copyBlockBorders({ wb, sheetName, token, srcTop, destTop, nRows, lastColIdx, label, useCache: true, colOff });
  if (copyAlign) {   // alignment / wrap, cell by cell (only cells that are not "General")
    const reads = [];
    for (let r = 0; r < nRows; r++) for (let c = 0; c <= lastColIdx; c++)
      reads.push({ url: `${sh}/range(address='${colLetter(colOff + c)}${srcTop + r}')/format?$select=horizontalAlignment,verticalAlignment,wrapText` });
    const got = await graphBatchRead(token, reads, (d, t) => { if (statusEl) statusEl.textContent = `${label}: reading alignment... (${d}/${t})`; });
    const writes = [];
    got.forEach((g, k) => {
      const b = g && g.body; if (!b) return;
      const r = Math.floor(k / (lastColIdx + 1)), c = k % (lastColIdx + 1);
      if (filled(r, c)) return;
      const o = {};
      if (b.horizontalAlignment && b.horizontalAlignment !== "General") o.horizontalAlignment = b.horizontalAlignment;
      if (b.verticalAlignment && b.verticalAlignment !== "Bottom") o.verticalAlignment = b.verticalAlignment;
      if (b.wrapText) o.wrapText = true;
      if (Object.keys(o).length) writes.push({ method: "PATCH", url: `${sh}/range(address='${colLetter(colOff + c)}${destTop + r}')/format`, body: o });
    });
    const bad = await graphBatchWrite(token, writes, (d) => { if (statusEl) statusEl.textContent = `${label}: alignment... (${d}/${writes.length})`; });
    bad.forEach(m => _nextDayWarn.push(`${label} alignment ${m}`));
  }

  return { skipped };
}

/* Automatic next-day blocks: while it runs, no sheet may create a block AFTER this date (sheets that already
   have tomorrow's block are left alone). Empty = no limit (the manual buttons). */
let _ndLimitISO = "";
function ndGuard(nextISO, label) {
  if (_ndLimitISO && nextISO > _ndLimitISO) { const e = new Error(`${label}: already has the ${_ndLimitISO.split("-").reverse().join(".")} block`); e.upToDate = true; throw e; }
}
const ndISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
async function createNextDayProdFromSheet(wb, token, sheetOverride) {
  const sheetName = sheetOverride || document.getElementById("sheetName").value.trim();
  const scanM = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='M1:M2000')?$select=text`, token);
  let lastTitleRow = -1;
  for (let i = 0; i < scanM.text.length; i++) {
    if (/total prod sheet/i.test(scanM.text[i][0] || "")) lastTitleRow = i + 1;
  }
  if (lastTitleRow === -1) throw new Error("Prod.: no existing block found (couldn't find 'TOTAL PROD SHEET' text in column M).");
  const colA = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A${lastTitleRow + 3}:A${lastTitleRow + 3}')?$select=values`, token);
  const lastSerial = colA.values[0][0];
  if (typeof lastSerial !== "number") throw new Error("Prod.: couldn't read the date of the last block.");
  const nextSerial = lastSerial + 1;
  const nextISO = excelSerialToISODate(nextSerial);
  ndGuard(nextISO, "Prod.");
  const [ny, nm, nd] = nextISO.split("-").map(x => parseInt(x));
  const heats = await prodHeatsFor(wb, token, sheetName), PERIOD = heats + 6;
  const newTitleRow = lastTitleRow + PERIOD;
  const cru = await cruOfBlock(wb, token, sheetName, lastTitleRow + 3, heats);

  const r = await cloneNextDayBlock({
    wb, sheetName, token, label: "Prod.",
    srcTop: lastTitleRow, destTop: newTitleRow, nRows: PERIOD, lastColIdx: COL.AH,
    override: (ro, c) => {
      const a = classifyCell(ro, c, heats);
      if (a === "BLANK") return { blank: true };
      if (a === "DATE") return { value: nextSerial };
      if (a === "HEATNO") return { value: heatLabel(nd, nm, ro - 2, heats, cru) };
      return undefined;
    }
  });
  // borders are copied from the previous block inside cloneNextDayBlock
  _colBCache.delete(`${wb}|${sheetName}`);
  return { sheetName, nextISO, newTitleRow, skipped: r.skipped };
}

async function createNextDayStripMillFromSheet(wb, token, sheetOverride) {
  const sheetName = sheetOverride || document.getElementById("stripSheetName").value.trim() || "Strip Mill";
  const heats = await prodHeatsFor(wb, token), PERIOD = heats + 6;   // same heat rows as Prod.
  const colA = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=values`, token);
  let lastDataRow = -1, lastSerial = null;
  for (let i = 0; i < colA.values.length; i++) {
    const v = colA.values[i][0];
    if (typeof v === "number") { lastDataRow = i + 1; lastSerial = v; }
  }
  if (lastDataRow === -1) throw new Error("Strip Mill: no existing date found.");
  const lastTitleRow = lastDataRow - 3;
  const newTitleRow = lastTitleRow + PERIOD;
  const nextSerial = lastSerial + 1;
  const nextISO = excelSerialToISODate(nextSerial);
  ndGuard(nextISO, "Strip Mill");
  const [ny, nm, nd] = nextISO.split("-").map(x => parseInt(x));
  const cru = await cruOfBlock(wb, token, sheetName, lastDataRow, heats);

  // Analysis (C:G) and 130x130 (I:L) cells of the 12 heat rows: a FORMULA is carried on to the
  // new block (rows shifted); a typed number is left blank for the new day. If the last block
  // has no formula in a cell (e.g. it was made before this fix), the 3 blocks before it are
  // checked and the formula found there is used.
  const tops = [0, 1, 2, 3].map(k => lastTitleRow - k * PERIOD).filter(t => t >= 1);
  const older = await Promise.all(tops.map(t =>
    graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='C${t}:L${t + PERIOD - 1}')?$select=formulas`, token)
      .then(x => x.formulas).catch(() => null)));
  const formulaFor = (ro, c) => {
    for (let k = 0; k < tops.length; k++) {
      const f = older[k] && older[k][ro] ? older[k][ro][c - 2] : "";
      if (typeof f === "string" && f.startsWith("=")) return shiftFormulaRows(f, newTitleRow - tops[k]);
    }
    return null;
  };

  const r = await cloneNextDayBlock({
    wb, sheetName, token, label: "Strip Mill",
    srcTop: lastTitleRow, destTop: newTitleRow, nRows: PERIOD, lastColIdx: 20, // A:U
    override: (ro, c) => {
      if (ro >= heats + 3 && ro <= heats + 5 && c >= 2 && c <= 6) {      // RHF rows: analysis formulas too
        const f = formulaFor(ro, c);
        return f ? { value: f } : undefined;
      }
      if (ro < 3 || ro > heats + 2) return undefined;
      if (c === 0) return ro === 3 ? { value: nextSerial } : { blank: true };
      if (c === 1) return { value: heatLabel(nd, nm, ro - 2, heats, cru) };
      if ((c >= 2 && c <= 6) || (c >= 8 && c <= 11)) {   // C:G analysis, I:L
        const f = formulaFor(ro, c);
        return f ? { value: f } : { blank: true };
      }
      return undefined;
    }
  });
  return { sheetName, nextISO, newTitleRow, skipped: r.skipped };
}

async function createNextDayBilletStockFromSheet(wb, token) {
  const sheetName = document.getElementById("stockSheetName").value.trim() || "Billet Stock Format";
  const PERIOD = 32;
  const scanA = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=text`, token);
  let asOnRow = -1, lastDateText = "";
  for (let i = 0; i < scanA.text.length; i++) {
    const t = (scanA.text[i][0] || "").toString();
    if (/as on/i.test(t)) { asOnRow = i + 1; lastDateText = t; }
  }
  if (asOnRow === -1) throw new Error("Billet Stock Format: no existing 'As on' date found.");
  const lastTitleRow = asOnRow - 1;
  const m = lastDateText.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (!m) throw new Error(`Billet Stock Format: couldn't parse the date text ("${lastDateText}").`);
  const nextDate = new Date(new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])).getTime() + 86400000);
  const nextDateText = `As on ${String(nextDate.getDate()).padStart(2, "0")}.${String(nextDate.getMonth() + 1).padStart(2, "0")}.${nextDate.getFullYear()}`;
  ndGuard(ndISO(nextDate), "Billet Stock Format");
  const newTitleRow = lastTitleRow + PERIOD;

  const r = await cloneNextDayBlock({
    wb, sheetName, token, label: "Billet Stock Format",
    srcTop: lastTitleRow, destTop: newTitleRow, nRows: PERIOD, lastColIdx: 8, // A:I
    override: (ro, c) => {
      if (ro === 1 && c === 0) return { value: nextDateText };
      return undefined; // E (pcs) now carried from the previous day (Hot Out "+pcs" added on top)
    },
    collapseConst: (ro, c) => c === 4 && ro >= 6 && ro <= 23
  });
  // the small summary block on the right (X:AA, same rows): copied like the main block - formulas shifted to the
  // new day's rows, typed numbers kept as they are, colours / borders / alignment the same; its "As on" date moves on
  let small = null;
  try {
    small = await cloneNextDayBlock({
      wb, sheetName, token, label: "Billet Stock Format (X:AA)",
      srcTop: lastTitleRow, destTop: newTitleRow, nRows: PERIOD, colOff: 23, lastColIdx: 3, copyAlign: true,   // X:AA
      override: (ro, c, src) => (typeof src === "string" && !src.startsWith("=") && /as\s*on\s*\d{1,2}[.\/]\d{1,2}[.\/]\d{4}/i.test(src))
        ? { value: src.replace(/\d{1,2}[.\/]\d{1,2}[.\/]\d{4}/, nextDateText.replace(/^As on\s*/i, "")) } : undefined
    });
  } catch (e) { _nextDayWarn.push(`Billet Stock Format X:AA block: ${e.message}`); }
  return { sheetName, nextDateText, newTitleRow, skipped: r.skipped + (small ? small.skipped : 0) };
}

// Daily Stock: the date line of a block is one merged cell across A:S.
async function mergeDailyStockDateRow(wb, sheetName, titleRow, token) {
  await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A${titleRow}:S${titleRow}')/merge`, token,
    { method: "POST", body: JSON.stringify({ across: false }) });
}
async function createNextDayDailyStockFromSheet(wb, token) {
  const sheetName = "Daily Stock";
  const PERIOD = 18;
  const scanA = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=values,formulas`, token);
  let lastTitleRow = -1, lastSerial = null, wasFormula = false;
  for (let i = 0; i < scanA.values.length; i++) {
    const v = scanA.values[i][0];
    if (typeof v === "number" && v > 40000) {
      lastTitleRow = i + 1; lastSerial = v;
      wasFormula = typeof scanA.formulas[i][0] === "string" && scanA.formulas[i][0].startsWith("=");
    }
  }
  if (lastTitleRow === -1) throw new Error("Daily Stock: no existing date found.");
  ndGuard(excelSerialToISODate(lastSerial + 1), "Daily Stock");
  const newTitleRow = lastTitleRow + PERIOD;

  const r = await cloneNextDayBlock({
    wb, sheetName, token, label: "Daily Stock",
    srcTop: lastTitleRow, destTop: newTitleRow, nRows: PERIOD, lastColIdx: 18, // A:S
    override: (ro, c) => (ro === 0 && c === 0 && !wasFormula) ? { value: lastSerial + 1 } : undefined
  });
  await mergeDailyStockDateRow(wb, sheetName, newTitleRow, token);
  return { sheetName, nextISO: excelSerialToISODate(lastSerial + 1), newTitleRow, skipped: r.skipped };
}

async function createNextDayDailyProdFormatFromSheet(wb, token) {
  const sheetName = document.getElementById("rmSheetName").value.trim() || "Daily Prod Format";
  const PERIOD = 40;
  const scanA = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=text`, token);
  let lastTitleRow = -1, lastDateText = "";
  for (let i = 0; i < scanA.text.length; i++) {
    const t = (scanA.text[i][0] || "").toString();
    if (/date-\d/i.test(t)) { lastTitleRow = i + 1; lastDateText = t; }
  }
  if (lastTitleRow === -1) throw new Error("Daily Prod Format: no existing 'DATE-...' text found.");
  const m = lastDateText.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (!m) throw new Error(`Daily Prod Format: couldn't parse the date text ("${lastDateText}").`);
  const nextDate = new Date(new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])).getTime() + 86400000);
  const nextDateText = `DATE-${String(nextDate.getDate()).padStart(2, "0")}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${nextDate.getFullYear()}`;
  ndGuard(ndISO(nextDate), "Daily Prod Format");
  const newTitleRow = lastTitleRow + PERIOD;

  const r = await cloneNextDayBlock({
    wb, sheetName, token, label: "Daily Prod Format",
    srcTop: lastTitleRow, destTop: newTitleRow, nRows: PERIOD, lastColIdx: 8, // A:I
    override: (ro, c) => {
      if (ro === 0 && c === 0) return { value: nextDateText };
      if ((c === 5 || c === 6) && ro >= 3 && ro <= 20) return { blank: true }; // F,G entry
      return undefined;
    }
  });
  return { sheetName, nextDateText, newTitleRow, skipped: r.skipped };
}

// Finds the latest block of a sheet (same rules as the create functions).
async function locateLastBlock(choice, wb, token) {
  const get = async (sheet, addr, sel) =>
    graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheet).replace(/'/g, "''"))}')/range(address='${addr}')?$select=${sel}`, token);
  if (choice === "prod") {
    const sheetName = document.getElementById("sheetName").value.trim();
    const scan = await get(sheetName, "M1:M2000", "text");
    let top = -1;
    scan.text.forEach((r, i) => { if (/total prod sheet/i.test(r[0] || "")) top = i + 1; });
    return { sheetName, top, period: (await prodHeatsFor(wb, token, sheetName)) + 6, lastColIdx: COL.AH };
  }
  if (choice === "stripmill") {
    const sheetName = document.getElementById("stripSheetName").value.trim() || "Strip Mill";
    const scan = await get(sheetName, "A1:A2000", "values");
    let row = -1;
    scan.values.forEach((r, i) => { if (typeof r[0] === "number") row = i + 1; });
    return { sheetName, top: row === -1 ? -1 : row - 3, period: (await prodHeatsFor(wb, token)) + 6, lastColIdx: 20 };
  }
  if (choice === "billetstock") {
    const sheetName = document.getElementById("stockSheetName").value.trim() || "Billet Stock Format";
    const scan = await get(sheetName, "A1:A2000", "text");
    let row = -1;
    scan.text.forEach((r, i) => { if (/as on/i.test(String(r[0] || ""))) row = i + 1; });
    return { sheetName, top: row === -1 ? -1 : row - 1, period: 32, lastColIdx: 8 };
  }
  if (choice === "dailystock") {
    const sheetName = "Daily Stock";
    const scan = await get(sheetName, "A1:A2000", "values");
    let top = -1;
    scan.values.forEach((r, i) => { if (typeof r[0] === "number" && r[0] > 40000) top = i + 1; });
    return { sheetName, top, period: 18, lastColIdx: 18 };
  }
  // dailyprodformat
  const sheetName = document.getElementById("rmSheetName").value.trim() || "Daily Prod Format";
  const scan = await get(sheetName, "A1:A2000", "text");
  let top = -1;
  scan.text.forEach((r, i) => { if (/date-\d/i.test(String(r[0] || ""))) top = i + 1; });
  return { sheetName, top, period: 40, lastColIdx: 8 };
}

async function fixColoursOfLastBlock() {
  const statusEl = document.getElementById("status");
  const choice = document.getElementById("nextDaySheetSelect").value;
  const label = NEXT_DAY_SHEET_LABELS[choice];
  statusEl.className = "wait";
  statusEl.textContent = `${label}: finding the latest block...`;
  let token = null, started = false;
  try {
    token = await getTokenFresh(20 * 60000);
    const today = new Date();
    const autoPath = await detectFilePathForMonth(token, today.getFullYear(), today.getMonth());
    const filePath = autoPath || document.getElementById("filePath").value.trim();
    if (!filePath) throw new Error("Couldn't find this month's file.");
    const wb = await resolveWorkbook(token, filePath);
    await nextDayJobStart(wb, token); started = true;
    const b = await locateLastBlock(choice, wb, token);
    _nextDayWarn = [];
    if (b.top === -1 || b.top - b.period < 1) throw new Error(`${label}: couldn't find the latest block and the one before it.`);
    await copyBlockFormats({ wb, sheetName: b.sheetName, token, label,
      srcTop: b.top - b.period, destTop: b.top, nRows: b.period, lastColIdx: b.lastColIdx });
    await copyBlockBorders({ wb, sheetName: b.sheetName, token, label, useCache: false,
      srcTop: b.top - b.period, destTop: b.top, nRows: b.period, lastColIdx: b.lastColIdx });
    if (choice === "dailystock") await mergeDailyStockDateRow(wb, b.sheetName, b.top, token);
    const msg = `✅ ${label} (${b.sheetName}): colours and borders of the block at row ${b.top} copied from the previous day's block.` +
      (_nextDayWarn.length ? `\n⚠️ ${_nextDayWarn.length} write(s) Excel did not accept:\n` + _nextDayWarn.slice(0, 5).join("\n") : "");
    statusEl.className = "ok";
    statusEl.textContent = msg;
    showCompletionPopup(msg);
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  } finally {
    if (started) await nextDayJobEnd(token);
  }
}

/* ===================== CREATE NEXT MONTH FILE ===================== */
// Copies the blank template (the October'26 blank format kept on OneDrive)
// to "<Month>'<YY>_Reports.xlsx" for the chosen month, then changes every
// month written in it - real dates, text dates ("As on 01.10.2026",
// "DATE-01-10-2026", "30/9/2026"), heat numbers ("1.10.1"), month words
// ("OCT'26", "Opening stock of September", "MIPPL/2026-27/OCT-0001") - by the
// same number of months. Formulas are never touched. A date that doesn't
// exist in the new month (e.g. 31st in a 30-day month) is left blank; a
// "last day of a month" date stays the last day ("30/9" -> "31/10").
// Sheets in NEXT_MONTH_SKIP_SHEETS are copied as they are.
const NEXT_MONTH_SKIP_SHEETS = ["SCRAP", "CALCULATION", "Durgesh", "M2M"];
const NM_MON3 = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function nmDaysIn(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
function nmShiftYM(y, m0, off) { const t = y * 12 + m0 + off; return { y: Math.floor(t / 12), m0: ((t % 12) + 12) % 12 }; }
// Shift a calendar date by `off` months. Dates of the template's own month
// (the daily rows): a day that doesn't exist in the new month -> null (blank).
// Dates of OTHER months (e.g. "30/9/2026" = previous month's last day):
// a month-end stays a month-end.
let _nmTpl = null;
function nmShiftDate(y, m0, d, off) {
  const t = nmShiftYM(y, m0, off);
  const ownMonth = _nmTpl && y === _nmTpl.y && m0 === _nmTpl.m0;
  if (!ownMonth && d === nmDaysIn(y, m0)) return { y: t.y, m0: t.m0, d: nmDaysIn(t.y, t.m0) };
  if (d > nmDaysIn(t.y, t.m0)) return null;
  return { y: t.y, m0: t.m0, d };
}
function nmSerialToYMD(v) {
  const dt = new Date(Math.round((v - 25569) * 86400000));
  return { y: dt.getUTCFullYear(), m0: dt.getUTCMonth(), d: dt.getUTCDate() };
}
function nmYMDToSerial(y, m0, d) { return Date.UTC(y, m0, d) / 86400000 + 25569; }
function nmCase(src, word) { // keep UPPER / Title / lower style
  if (src === src.toUpperCase()) return word.toUpperCase();
  if (src[0] === src[0].toUpperCase()) return word[0].toUpperCase() + word.slice(1).toLowerCase();
  return word.toLowerCase();
}
function nmIsDateFormat(fmt) {
  const f = String(fmt || "").replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").toLowerCase();
  return /d/.test(f) && /y/.test(f) || /m{3,}/.test(f) && /y/.test(f);
}

// Returns { value } when the cell must change ("" = blank it), else null.
function nmTransformCell(value, numFmt, off, tpl) {
  _nmTpl = tpl;
  if (typeof value === "number") {
    if (value > 30000 && value < 80000 && nmIsDateFormat(numFmt)) {
      const a = nmSerialToYMD(value);
      const b = nmShiftDate(a.y, a.m0, a.d, off);
      return { value: b ? nmYMDToSerial(b.y, b.m0, b.d) : "" };
    }
    return null;
  }
  if (typeof value !== "string" || value === "" || value.startsWith("=")) return null;
  let s = value, blank = false;

  // heat number "D.M.N" of the template month (whole cell)
  const hm = /^(\s*(?:F-[A-J]-)?)(\d{1,2})\.(\d{1,2})\.(\d{1,2})(\s*)$/i.exec(s);   // also F-A-1.11.3 (two furnaces / crucible files)
  if (hm && +hm[3] === tpl.m0 + 1) {
    const b = nmShiftDate(tpl.y, tpl.m0, +hm[2], off);
    if (!b) return { value: "" };
    return { value: `${hm[1]}${b.d}.${b.m0 + 1}.${hm[4]}${hm[5]}` };
  }

  // numeric dates with a 4-digit year: 01.10.2026, 01-10-2026, 30/9/2026
  s = s.replace(/(\d{1,2})([.\-\/])(\d{1,2})\2(\d{4})/g, (all, d, sep, m, y) => {
    const b = nmShiftDate(+y, +m - 1, +d, off);
    if (!b) { blank = true; return all; }
    const dd = d.length === 2 ? String(b.d).padStart(2, "0") : String(b.d);
    const mm = m.length === 2 ? String(b.m0 + 1).padStart(2, "0") : String(b.m0 + 1);
    return `${dd}${sep}${mm}${sep}${b.y}`;
  });
  if (blank) return { value: "" };

  // full month names (with an optional year right after)
  s = s.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b(?:(\s*['\-]\s*|\s+)(20\d{2}|\d{2})(?!\d))?/gi, (all, name, sep, yr) => {
    const m0 = MONTH_ABBR.findIndex(x => x.toLowerCase() === name.toLowerCase());
    let y = yr ? (yr.length === 2 ? 2000 + +yr : +yr) : tpl.y;
    const t = nmShiftYM(y, m0, off);
    const ny = yr ? (yr.length === 2 ? String(t.y).slice(2) : String(t.y)) : "";
    return nmCase(name, MONTH_ABBR[t.m0]) + (sep || "") + ny;
  });

  // 3-letter months as a separate word: OCT'26, Oct-2026, OCT-0001
  s = s.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b(?:(['\-\s])(20\d{2}|\d{2})(?!\d))?/gi, (all, name, sep, yr) => {
    const m0 = NM_MON3.indexOf(name.slice(0, 3).toUpperCase());
    let y = yr ? (yr.length === 2 ? 2000 + +yr : +yr) : tpl.y;
    const t = nmShiftYM(y, m0, off);
    const ny = yr ? (yr.length === 2 ? String(t.y).slice(2) : String(t.y)) : "";
    return nmCase(name, NM_MON3[t.m0]) + (sep || "") + ny;
  });

  // financial year inside document numbers: MIPPL/2026-27/...
  if (/MIPPL\//i.test(s)) {
    const t = nmShiftYM(tpl.y, tpl.m0, off);
    const fy1 = t.m0 >= 3 ? t.y : t.y - 1;
    s = s.replace(/(MIPPL\/)(\d{4})-(\d{2})(\/)/i, (a, p, y1, y2, q) => `${p}${fy1}-${String(fy1 + 1).slice(2)}${q}`);
  }
  return s === value ? null : { value: s };
}

// Copies the previous month's last Daily Stock report into the new file's
// first Daily Stock report (rows 4-14 under the date in A1).
async function nmCarryDailyStock(token, prevPath, newWb) {
  const SHEET = "Daily Stock";
  const prevWb = await resolveWorkbook(token, prevPath);
  const ps = `${prevWb}/worksheets('${encodeURIComponent(String(SHEET).replace(/'/g, "''"))}')`;
  const colA = await graphFetch(`${ps}/range(address='A1:A2000')?$select=values`, token);
  let top = -1, topDate = 0;
  colA.values.forEach((r, i) => {
    const v = r[0];
    if (typeof v === "number" && v > 40000 && v >= topDate) { top = i + 1; topDate = v; }
  });
  if (top === -1) throw new Error(`no dated report found in ${prevPath.split("/").pop()}`);
  const src = await graphFetch(`${ps}/range(address='A${top + 3}:Q${top + 13}')?$select=values`, token);

  const ns = `${newWb}/worksheets('${encodeURIComponent(String(SHEET).replace(/'/g, "''"))}')`;
  const dst = await graphFetch(`${ns}/range(address='A4:A14')?$select=values`, token);
  const norm = (x) => String(x === null || x === undefined ? "" : x).toUpperCase().replace(/\s+/g, "");
  const bySize = {};
  src.values.forEach(r => { if (norm(r[0])) bySize[norm(r[0])] = r; });

  const N = [], Q = [];
  let matched = 0;
  dst.values.forEach(r => {
    const s = bySize[norm(r[0])];
    if (!s) { N.push([null]); Q.push([null]); return; }
    const pcs = typeof s[13] === "number" ? Math.round(s[13]) : (s[13] === "" ? null : Math.round(parseFloat(s[13])) || 0);
    const wt = typeof s[16] === "number" ? Math.round(s[16] * 1000) / 1000 : (s[16] === "" ? null : Math.round((parseFloat(s[16]) || 0) * 1000) / 1000);
    N.push([pcs]); Q.push([wt]);
    matched++;
  });
  await graphFetch(`${ns}/range(address='N4:N14')`, token, { method: "PATCH", body: JSON.stringify({ values: N }) });
  await graphFetch(`${ns}/range(address='Q4:Q14')`, token, { method: "PATCH", body: JSON.stringify({ values: Q }) });
  return `📦 Daily Stock opening: ${matched} size(s) copied from the ${excelSerialToISODate(topDate)} report (pcs as whole numbers, ERP weight to 3 decimals).`;
}

async function createNextMonthFile() { return createNextMonthFileFor(""); }
async function createNextMonthFileFor(cru, quiet) {
  const statusEl = document.getElementById("status");
  const tplPath = document.getElementById("nmTemplatePath").value.trim();
  const target = document.getElementById("nmTargetMonth").value; // "YYYY-MM"
  if (!tplPath || !target) { statusEl.className = "err"; statusEl.textContent = "Please fill the template path and the month."; return; }
  localStorage.setItem("nmTemplatePath", tplPath);
  const [ty, tm] = target.split("-").map(Number);
  const tm0 = tm - 1;
  const newName = xlFileName(ty, tm0, cru);
  statusEl.className = "wait";
  statusEl.textContent = `Checking the template and target folder...`;
  try {
    const token = await getToken();

    // 1. Don't overwrite an existing month file
    _filePathCache.clear();
    const existing = await detectFilePathForMonth(token, ty, tm0);
    if (existing) throw new Error(`${existing} already exists - nothing changed.`);

    // 2. Template + its month (from Prod.!A4)
    const tplItem = await tryGetItem(token, tplPath);
    if (!tplItem) throw new Error(`Template not found: ${tplPath}`);
    const tplWb = `${GRAPH_BASE}/me/drive/items/${tplItem.id}/workbook`;
    const a4 = await graphFetch(`${tplWb}/worksheets('Prod.')/range(address='A4')?$select=values`, token);
    if (typeof a4.values[0][0] !== "number") throw new Error("Couldn't read the template's month from Prod.!A4.");
    const tplD = nmSerialToYMD(a4.values[0][0]);
    const tpl = { y: tplD.y, m0: tplD.m0 };
    const off = (ty * 12 + tm0) - (tpl.y * 12 + tpl.m0);

    // 3. Folder: same as the previous month's file, else the template's folder
    const prev = nmShiftYM(ty, tm0, -1);
    const prevPath = await detectFilePathForMonth(token, prev.y, prev.m0);
    const folderPath = (prevPath || (!xlIsDefaultFile() ? XL.file.folder.replace(/^\/+|\/+$/g, "") + "/x" : tplPath)).split("/").slice(0, -1).join("/");
    const folderItem = await tryGetItem(token, folderPath);
    if (!folderItem) throw new Error(`Folder not found: ${folderPath}`);

    // 4. Copy the template (Graph copy runs in the background - wait for it)
    statusEl.textContent = `Creating ${newName} from the template...`;
    const copyRes = await fetch(`${GRAPH_BASE}/me/drive/items/${tplItem.id}/copy`, {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, parentReference: { id: folderItem.id } })
    });
    if (copyRes.status !== 202) throw new Error(`Copy failed (${copyRes.status}): ${await copyRes.text()}`);
    const monitor = copyRes.headers.get("Location");
    let newId = null;
    // Wait for the copy: ask the copy monitor, and if the browser can't read
    // it, simply check whether the new file has appeared in the folder.
    for (let i = 0; i < 60 && !newId; i++) {
      await new Promise(r => setTimeout(r, 2000));
      statusEl.textContent = `Creating ${newName} from the template... (${(i + 1) * 2}s)`;
      let monitorOk = false;
      if (monitor) {
        try {
          const st = await (await fetch(monitor)).json();
          monitorOk = true;
          if (st.status === "completed" && st.resourceId) newId = st.resourceId;
          else if (st.status === "failed") throw new Error("OneDrive reported the copy as failed.");
        } catch (e) { if (/reported the copy as failed/.test(e.message)) throw e; }
      }
      if (!newId && !monitorOk) {
        const it = await tryGetItem(token, `${folderPath}/${newName}`);
        if (it) newId = it.id;
      }
    }
    if (!newId) throw new Error("The copy is taking too long - check OneDrive in a minute and try again.");
    const wb = `${GRAPH_BASE}/me/drive/items/${newId}/workbook`;

    // 5. Change the month everywhere (sheet by sheet)
    const sheets = await graphFetch(`${wb}/worksheets?$select=name`, token);
    let changed = 0, blanked = 0;
    for (const ws of sheets.value) {
      if (NEXT_MONTH_SKIP_SHEETS.some(n => n.toLowerCase() === ws.name.toLowerCase())) continue;
      statusEl.textContent = `${newName}: updating month in "${ws.name}"...`;
      const sh = `${wb}/worksheets('${encodeURIComponent(String(ws.name).replace(/'/g, "''"))}')`;
      const ur = await graphFetch(`${sh}/usedRange(valuesOnly=true)?$select=address,values,formulas,numberFormat`, token);
      if (!ur || !ur.values) continue;
      const grid = ur.values.map(r => r.map(() => null));
      let any = false;
      for (let r = 0; r < ur.values.length; r++) {
        for (let c = 0; c < ur.values[r].length; c++) {
          const f = ur.formulas[r][c];
          if (typeof f === "string" && f.startsWith("=")) continue; // never touch formulas
          const res = nmTransformCell(ur.values[r][c], ur.numberFormat[r][c], off, tpl);
          if (res) { grid[r][c] = res.value; any = true; changed++; if (res.value === "") blanked++; }
        }
      }
      if (any) {
        const addr = String(ur.address).split("!").pop();
        await graphFetch(`${sh}/range(address='${addr}')`, token, { method: "PATCH", body: JSON.stringify({ values: grid }) });
      }
    }
    _filePathCache.clear();
    teamAfterNewFile(`${folderPath}/${newName}`, newId, token).catch(() => {});   // team sees the new month too

    const cruNote = "";

    // 6. Daily Stock opening = previous month's LAST Daily Stock report:
    //    MANUAL STOCK pcs (col N, whole numbers) and ERP STOCK weight
    //    (col Q, 3 decimals), matched size by size (col A).
    let stockNote = "";
    if (prevPath) {
      statusEl.textContent = `${newName}: copying the last Daily Stock of ${MONTH_ABBR[prev.m0]}...`;
      try {
        stockNote = await nmCarryDailyStock(token, prevPath, wb);
      } catch (e) {
        stockNote = `⚠️ Daily Stock opening not copied: ${e.message}`;
      }
    } else {
      stockNote = `⚠️ Daily Stock opening not copied: ${MONTH_ABBR[prev.m0]}'s file not found.`;
    }

    const msg = `✅ ${newName} created in ${folderPath}\n${changed} cell(s) changed to ${MONTH_ABBR[tm0]} ${ty}` +
      (blanked ? `, ${blanked} left blank (dates that don't exist in ${MONTH_ABBR[tm0]})` : "") +
      `.\nNot changed: ${NEXT_MONTH_SKIP_SHEETS.join(", ")}.` +
      (stockNote ? `\n${stockNote}` : "") + (cruNote ? `\n${cruNote}` : "");
    statusEl.className = "ok";
    statusEl.textContent = msg;
    if (!quiet) showCompletionPopup(msg);
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

const NEXT_DAY_SHEET_LABELS = {
  prod: "Prod.",
  stripmill: "Strip Mill",
  billetstock: "Billet Stock Format",
  dailyprodformat: "Daily Prod Format",
  dailystock: "Daily Stock"
};

// ---- "Which date's block was made" notice (phone notification + headline) ----
function blockDateText(r) { // r.nextISO "2026-10-15" | r.nextDateText "As on 15.10.2026" / "DATE-15-10-2026"
  if (r && r.nextISO) { const [y, m, d] = r.nextISO.split("-"); return `${d}.${m}.${y}`; }
  const m = String((r && r.nextDateText) || "").match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
  return m ? `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}.${m[3]}` : "";
}
function askNotifyPermission() { // call on a button tap (browsers allow the question only then)
  if (window.MZ_NATIVE) { try { MoltrixApp.askNotify(); } catch (e) {} return; }
  try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch (e) {}
}
async function phoneNotify(title, body) {
  try { if (navigator.vibrate) navigator.vibrate([150, 80, 150]); } catch (e) {}
  if (window.MZ_NATIVE) { try { MoltrixApp.notify(title, body); } catch (e) {} return; }
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg && reg.showNotification) await reg.showNotification(title, { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "nextDayBlocks" });
    else new Notification(title, { body, icon: "icons/icon-192.png" });
  } catch (e) { console.warn("notification failed", e); }
}

async function createNextDayBlock() {
  const statusEl = document.getElementById("status");
  const manualFilePath = document.getElementById("filePath").value.trim();
  const choice = document.getElementById("nextDaySheetSelect").value;
  const label = NEXT_DAY_SHEET_LABELS[choice];

  statusEl.className = "wait";
  statusEl.textContent = `${label}’s next-day block is being prepared...`;
  askNotifyPermission();

  let token = null, started = false;
  try {
    token = await getTokenFresh(20 * 60000);

    // Auto-detect the current month's file (same fix as RHF Billets Entry /
    // Hot Out Entry / RM-Scrap Entry) - this feature always continues from
    // today's active file, so "today" is the right month to look for,
    // rather than whatever file happens to be in the File Location box.
    const today = new Date();
    statusEl.textContent = `Locating this month's file...`;
    const autoPath = await detectFilePathForMonth(token, today.getFullYear(), today.getMonth());
    const filePath = autoPath || manualFilePath;
    if (!filePath) {
      statusEl.className = "err";
      statusEl.textContent = "Couldn't automatically find this month's file - is it on your OneDrive? (Menu → Get Started → Put formats on the Desktop)";
      return;
    }

    statusEl.textContent = `${label}’s next-day block is being prepared...`;
    const wb = await resolveWorkbook(token, filePath);
    await nextDayJobStart(wb, token); started = true;

    let r, msg; _nextDayWarn = []; const t0 = Date.now();
    const crusN = xlCrus();
    const moreCru = async (fn, what) => {   // 2-3 crucibles: the same sheet of crucible B / C ("Prod. B" …)
      const base = what === "Prod." ? (document.getElementById("sheetName").value.trim() || XL.heat.sheet) : (document.getElementById("stripSheetName").value.trim() || "Strip Mill");
      const out = [];
      for (const c of crusN.slice(1)) {
        try {
          const rc = await fn(wb, token, xlSheetFor(base, c));
          out.push(`✅ Crucible ${c} · ${what}: ${rc.nextISO}, row ${rc.newTitleRow}`);
        } catch (e) { out.push(`❌ Crucible ${c} · ${what}: ${e.message}`); }
      }
      return out.length ? "\n" + out.join("\n") : "";
    };
    if (choice === "prod") {
      r = await createNextDayProdFromSheet(wb, token);
      msg = `✅ ${crusN[0] ? "Crucible A · " : ""}Prod. (${r.sheetName}): ${r.nextISO}, row ${r.newTitleRow}` + await moreCru(createNextDayProdFromSheet, "Prod.");
    } else if (choice === "stripmill") {
      r = await createNextDayStripMillFromSheet(wb, token);
      msg = `✅ ${crusN[0] ? "Crucible A · " : ""}Strip Mill (${r.sheetName}): ${r.nextISO}, row ${r.newTitleRow}` + await moreCru(createNextDayStripMillFromSheet, "Strip Mill");
    } else if (choice === "billetstock") {
      r = await createNextDayBilletStockFromSheet(wb, token);
      msg = `✅ Billet Stock Format (${r.sheetName}): ${r.nextDateText}, row ${r.newTitleRow}`;
    } else if (choice === "dailyprodformat") {
      r = await createNextDayDailyProdFormatFromSheet(wb, token);
      msg = `✅ Daily Prod Format (${r.sheetName}): ${r.nextDateText}, row ${r.newTitleRow}`;
    } else if (choice === "dailystock") {
      r = await createNextDayDailyStockFromSheet(wb, token);
      msg = `✅ Daily Stock (${r.sheetName}): ${r.nextISO}, row ${r.newTitleRow}`;
    }
    if (r && r.skipped) msg += `\nℹ️ ${r.skipped} cell(s) in that area already had data - left untouched.`;
    msg += `\nFormulas, number formats, colours and borders copied from the previous day's block. (${Math.round((Date.now() - t0) / 1000)} s, ${_nextDayWrites} writes${wbHasSession(wb) ? ", Excel session" : ""})`;
    if (_nextDayWarn.length) msg += `\n⚠️ ${_nextDayWarn.length} formatting write(s) Excel did not accept:\n` + _nextDayWarn.slice(0, 5).join("\n");

    const dt = blockDateText(r);
    if (dt) msg = `📅 ${dt} block made\n\n` + msg;
    if (dt) { try { localStorage.setItem("lastBlockDate", dt); } catch (e) {} updateNavSubs(); }
    statusEl.className = "ok";
    statusEl.textContent = msg;
    showCompletionPopup(msg);
    phoneNotify(`📅 ${dt || "Next day"} block made`, `${label} - row ${r && r.newTitleRow}`);

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  } finally {
    if (started) await nextDayJobEnd(token);
  }
}

document.getElementById("nextDayBtn").addEventListener("click", createNextDayBlock);

// One click: next-day block in every sheet, one after the other. A failure in
// one sheet does not stop the others; the summary shows each sheet's result.
async function createAllNextDayBlocks(ev, opts) {
  const auto = !!(opts && opts.auto);   // automatic daily run: no question, never past opts.limitISO
  const statusEl = document.getElementById("status");
  const btn = document.getElementById("nextDayAllBtn");
  if (!auto && !confirm("Create the next day's block in ALL sheets (Prod., Strip Mill, Billet Stock Format, Daily Prod Format, Daily Stock)?")) return;
  if (btn) btn.disabled = true;
  statusEl.className = "wait";
  if (!auto) askNotifyPermission();
  _ndLimitISO = auto ? (opts.limitISO || "") : "";
  const result = { created: [], fails: 0, upToDate: 0, error: "" };
  let token = null, started = false;
  try {
    token = await getTokenFresh(30 * 60000);   // valid for the whole job
    const today = new Date();
    statusEl.textContent = "Locating this month's file...";
    const autoPath = await detectFilePathForMonth(token, today.getFullYear(), today.getMonth());
    const filePath = autoPath || document.getElementById("filePath").value.trim();
    if (!filePath) throw new Error("Couldn't automatically find this month's file - is it on your OneDrive? (Menu → Get Started → Put formats on the Desktop)");
    const wb = await resolveWorkbook(token, filePath);
    statusEl.textContent = "Opening the Excel file...";
    await nextDayJobStart(wb, token); started = true;
    const crus = xlCrus(), cruPre = c => c ? `Crucible ${c} · ` : "";
    const jobs = [
      ["prod", cruPre(crus[0]) + "Prod.", () => createNextDayProdFromSheet(wb, token), r => `${r.nextISO}, row ${r.newTitleRow}`, wb],
      ["stripmill", cruPre(crus[0]) + "Strip Mill", () => createNextDayStripMillFromSheet(wb, token), r => `${r.nextISO}, row ${r.newTitleRow}`, wb],
      ["billetstock", "Billet Stock Format", () => createNextDayBilletStockFromSheet(wb, token), r => `${r.nextDateText}, row ${r.newTitleRow}`, wb],
      ["dailyprodformat", "Daily Prod Format", () => createNextDayDailyProdFormatFromSheet(wb, token), r => `${r.nextDateText}, row ${r.newTitleRow}`, wb],
      ["dailystock", "Daily Stock", () => createNextDayDailyStockFromSheet(wb, token), r => `${r.nextISO}, row ${r.newTitleRow}`, wb]
    ];
    const lines = []; let fails = 0; const t0 = Date.now(); const warnAll = []; const dates = new Set();
    // 2-3 crucibles: their Prod. B / Strip Mill B … sheets too (same file)
    const prodBase = document.getElementById("sheetName").value.trim() || XL.heat.sheet;
    const stripBase = document.getElementById("stripSheetName").value.trim() || "Strip Mill";
    crus.slice(1).forEach((c, k) => {
      jobs.splice(2 + 2 * k, 0,
        ["prod", cruPre(c) + "Prod.", () => createNextDayProdFromSheet(wb, token, xlSheetFor(prodBase, c)), r => `${r.nextISO}, row ${r.newTitleRow}`, wb],
        ["stripmill", cruPre(c) + "Strip Mill", () => createNextDayStripMillFromSheet(wb, token, xlSheetFor(stripBase, c)), r => `${r.nextISO}, row ${r.newTitleRow}`, wb]);
    });
    let curWb = wb;
    for (let i = 0; i < jobs.length; i++) {
      const [, label, run, fmt, jobWb] = jobs[i];
      if (jobWb !== curWb) {   // next crucible's file: close the Excel session of the last one, open this one
        try { await nextDayJobEnd(token); } catch (e) {}
        token = await getTokenFresh(10 * 60000);
        await nextDayJobStart(jobWb, token); curWb = jobWb;
      }
      statusEl.className = "wait";
      statusEl.textContent = `(${i + 1}/${jobs.length}) ${label}: next-day block is being prepared...\n` + lines.join("\n");
      _nextDayWarn = [];
      const tj = Date.now(), w0 = _nextDayWrites;
      try {
        token = await getTokenFresh(10 * 60000);
        const r = await run();
        const dt = blockDateText(r); if (dt) { dates.add(dt); const [d, m, y] = dt.split("."); result.created.push(`${y}-${m}-${d}`); }
        lines.push(`✅ ${label} (${r.sheetName}): ${fmt(r)}` + (r.skipped ? ` - ${r.skipped} cell(s) already had data, left untouched` : "") +
          (_nextDayWarn.length ? ` - ⚠️ ${_nextDayWarn.length} formatting write(s) not accepted` : "") +
          ` [${Math.round((Date.now() - tj) / 1000)} s, ${_nextDayWrites - w0} writes]`);
      } catch (e) {
        if (e && e.upToDate) { result.upToDate++; lines.push(`➖ ${e.message} - left as it is`); }
        else { fails++; lines.push(`❌ ${label}: ${e.message} [${Math.round((Date.now() - tj) / 1000)} s]`); }
      }
      warnAll.push(..._nextDayWarn);
    }
    const dHead = dates.size ? `📅 ${[...dates].join(", ")} block made` : "";
    if (dates.size) { try { localStorage.setItem("lastBlockDate", [...dates].sort().pop()); } catch (e) {} updateNavSubs(); }
    result.fails = fails;
    const msg = (auto ? "🤖 Automatic daily blocks\n" : "") + (dHead ? dHead + "\n" : "") + (fails ? `⚠️ ${jobs.length - fails} of ${jobs.length} sheets done.` : result.upToDate ? `✅ ${jobs.length - result.upToDate} created, ${result.upToDate} already there.` : `✅ All ${jobs.length} next-day blocks created.`) + "\n\n" + lines.join("\n") +
      (fails ? "\n\nFor a failed sheet, pick it in the Sheet list above and use 'Create Next Day Block' after checking it." : "\nFormulas, number formats, colours and borders copied from the previous day's blocks.") +
      `\n⏱ ${Math.round((Date.now() - t0) / 1000)} s` + (wbHasSession(wb) ? " (Excel session)" : " (no Excel session)") +
      (warnAll.length ? "\n\nNot accepted by Excel (first 5):\n" + warnAll.slice(0, 5).join("\n") : "");
    statusEl.className = fails ? "err" : "ok";
    statusEl.textContent = msg;
    if (!auto || result.created.length || fails) {
      showCompletionPopup(msg);
      phoneNotify((auto ? "🤖 " : "") + (dHead || "Next day blocks"), fails ? `${jobs.length - fails} of ${jobs.length} sheets done - ${fails} failed - open the app to check` : `All ${jobs.length} sheets done`);
    }
  } catch (e) {
    result.error = e.message;
    statusEl.className = "err"; statusEl.textContent = (auto ? "🤖 Automatic daily blocks - " : "") + "Error: " + e.message;
    if (auto) phoneNotify("🤖 Next day blocks NOT created", e.message);
  } finally {
    _ndLimitISO = "";
    if (btn) btn.disabled = false;
    if (started) await nextDayJobEnd(token);
  }
  return result;
}
document.getElementById("nextDayAllBtn").addEventListener("click", createAllNextDayBlocks);
document.getElementById("fixColoursBtn").addEventListener("click", fixColoursOfLastBlock);
document.getElementById("nextMonthBtn").addEventListener("click", createNextMonthFile);

// Live calendar icon: today's month and date, refreshed when the day changes.
(function liveCalendarIcon() {
  let shown = "";
  const paint = () => {
    const d = new Date();
    const key = d.toDateString();
    if (key === shown) return;
    shown = key;
    const mon = d.toLocaleString("en-US", { month: "short" });
    document.querySelectorAll(".liveCal").forEach(el => {
      el.querySelector(".liveCalMon").textContent = mon;
      el.querySelector(".liveCalDay").textContent = d.getDate();
      el.setAttribute("title", d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
    });
  };
  paint();
  setInterval(paint, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) paint(); });
})();
(() => {
  const p = localStorage.getItem("nmTemplatePath");
  document.getElementById("nmTemplatePath").value = p || "Desktop/MIPPL/Production Sheet/Template.xlsx";
  const d = new Date(); const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  document.getElementById("nmTargetMonth").value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
})();

/* ---- 7 QC Tools analysis ---- */
let ecParetoChartInstance = null, ecHistogramChartInstance = null, ecControlChartInstance = null,
    ecScatterChartInstance = null, ecStratChartInstance = null, ecMonthTrendChartInstance = null,
    ecPrimeVsCrackChartInstance = null;
let ecExportData = null;

// Parses "DD-MM-YYYY" (or "DD/MM/YYYY") text dates into a comparable ISO string.
function pipeMillDateToISO(raw) {
  if (raw == null) return null;
  if (typeof raw === "number") return excelSerialToISODate(raw); // in case it's ever a real date value
  const s = raw.toString().trim();
  const m = s.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

async function loadEdgeCrackAnalysis() {
  const statusEl = document.getElementById("status");
  const filePath = document.getElementById("ecFilePath").value.trim();
  const sheetName = document.getElementById("ecSheetName").value.trim();
  const fromDate = document.getElementById("ecFromDate").value;
  const toDate = document.getElementById("ecToDate").value;

  if (!fromDate || !toDate) {
    statusEl.className = "err";
    statusEl.textContent = "Please select both From Date and To Date.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Reading the Strip Coils Edge Crack Data file...";

  try {
    const token = await getToken();
    const wb = await resolveWorkbook(token, filePath);

    const data = await graphFetch(
      `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A2:K500')?$select=values`,
      token
    );

    // Each row is one calendar month's Edge Crack summary, already split
    // across three areas: Strip Mill, Buildup, and Tube Mill.
    ecLastAllRows = [];
    const allRows = ecLastAllRows;
    for (const row of data.values) {
      if (!row[0]) continue;
      const iso = pipeMillDateToISO(row[0]);
      if (!iso) continue;
      const monthKey = iso.slice(0, 7); // "YYYY-MM"
      if (monthKey < fromDate.slice(0, 7) || monthKey > toDate.slice(0, 7)) continue;

      allRows.push({
        month: monthKey, reason: row[1] || "",
        stripMillWT: Number(row[2]) || 0, stripWTPct: Number(row[3]) || 0,
        buildupWT: Number(row[4]) || 0, buildupWTPct: Number(row[5]) || 0,
        tubeMillWT: Number(row[6]) || 0, tubeWTPct: Number(row[7]) || 0,
        grandTotal: Number(row[8]) || 0, grandWTPct: Number(row[9]) || 0,
        totalStrip: Number(row[10]) || 0
      });
    }

    if (allRows.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = "No data found for this date range in the file.";
      return;
    }

    allRows.sort((a, b) => a.month.localeCompare(b.month));
    document.getElementById("ecAnalysisWrap").classList.remove("hidden");

    // Summary: Edge Crack (Grand Total) against Total Strip produced
    const totalStripSum = allRows.reduce((s, r) => s + r.totalStrip, 0);
    const totalCrack = allRows.reduce((s, r) => s + r.grandTotal, 0);
    const crackRejPct = totalStripSum > 0 ? (totalCrack / totalStripSum * 100) : 0;
    document.getElementById("ecTotalPrime").textContent = totalStripSum.toFixed(2);
    document.getElementById("ecTotalCrack").textContent = totalCrack.toFixed(2);
    document.getElementById("ecCrackRejPct").textContent = crackRejPct.toFixed(3) + "%";

    // Total Strip (production) vs Edge Crack Grand Total, per month
    if (ecPrimeVsCrackChartInstance) ecPrimeVsCrackChartInstance.destroy();
    ecPrimeVsCrackChartInstance = new Chart(document.getElementById("ecPrimeVsCrackChart").getContext("2d"), {
      type: "bar",
      data: {
        labels: allRows.map(r => r.month),
        datasets: [
          { label: "Total Strip (production)", data: allRows.map(r => r.totalStrip), backgroundColor: "#1e6b3c" },
          { label: "Edge Crack - Grand Total (rejected)", data: allRows.map(r => r.grandTotal), backgroundColor: "#a3271c" }
        ]
      },
      options: {
        responsive: true, devicePixelRatio: 2,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } }
      }
    });

    // Category Breakdown Dashboard (Strip Mill / Buildup / Tube Mill)
    const catTotals = {
      "Strip Mill": allRows.reduce((s, r) => s + r.stripMillWT, 0),
      "Buildup": allRows.reduce((s, r) => s + r.buildupWT, 0),
      "Tube Mill": allRows.reduce((s, r) => s + r.tubeMillWT, 0)
    };
    document.getElementById("ecBreakupStrip").textContent = catTotals["Strip Mill"].toFixed(2);
    document.getElementById("ecBreakupBuildup").textContent = catTotals["Buildup"].toFixed(2);
    document.getElementById("ecBreakupTube").textContent = catTotals["Tube Mill"].toFixed(2);

    // 1. Check Sheet
    const csTable = document.getElementById("ecCheckSheetTable");
    csTable.innerHTML = "<tr><th>Month</th><th>Strip Mill WT</th><th>Buildup WT</th><th>Tube Mill WT</th><th>Grand Total</th><th>Grand WT%</th><th>Total Strip</th></tr>";
    const E = htmlEsc;
    csTable.innerHTML += allRows.map(r =>
      `<tr><td>${E(r.month)}</td><td>${E(r.stripMillWT)}</td><td>${E(r.buildupWT)}</td><td>${E(r.tubeMillWT)}</td><td>${E(r.grandTotal)}</td><td>${E(r.grandWTPct)}%</td><td>${r.totalStrip.toFixed(0)}</td></tr>`).join("");

    // 2. Pareto Chart (by month, ranked by Grand Total - which months contribute most)
    const paretoEntries = allRows.map(r => [r.month, r.grandTotal]).sort((a, b) => b[1] - a[1]);
    const paretoTotal = paretoEntries.reduce((s, e) => s + e[1], 0);
    let cum = 0;
    const cumPct = paretoEntries.map(e => { cum += e[1]; return paretoTotal ? (cum / paretoTotal * 100) : 0; });

    if (ecParetoChartInstance) ecParetoChartInstance.destroy();
    ecParetoChartInstance = new Chart(document.getElementById("ecParetoChart").getContext("2d"), {
      data: {
        labels: paretoEntries.map(e => e[0]),
        datasets: [
          { type: "bar", label: "Edge Crack (total)", data: paretoEntries.map(e => e[1]), backgroundColor: "#1f3864", yAxisID: "y" },
          { type: "line", label: "Cumulative %", data: cumPct, borderColor: "#c9a227", yAxisID: "y1", tension: 0.2 }
        ]
      },
      options: {
        responsive: true, devicePixelRatio: 2,
        scales: { y: { beginAtZero: true, position: "left" }, y1: { beginAtZero: true, max: 100, position: "right", grid: { drawOnChartArea: false } } }
      }
    });

    // 3. Histogram (Grand WT% distribution across months)
    const values = allRows.map(r => r.grandWTPct);
    const maxV = Math.max(...values, 0.001);
    const bucketCount = 8;
    const bucketSize = maxV / bucketCount;
    const buckets = new Array(bucketCount).fill(0);
    values.forEach(v => {
      const idx = Math.min(bucketCount - 1, Math.floor(v / bucketSize));
      buckets[idx]++;
    });
    if (ecHistogramChartInstance) ecHistogramChartInstance.destroy();
    ecHistogramChartInstance = new Chart(document.getElementById("ecHistogramChart").getContext("2d"), {
      type: "bar",
      data: {
        labels: buckets.map((_, i) => `${(i * bucketSize).toFixed(2)}-${((i + 1) * bucketSize).toFixed(2)}%`),
        datasets: [{ label: "Number of months", data: buckets, backgroundColor: "#9dc3e6" }]
      },
      options: { responsive: true, devicePixelRatio: 2, plugins: { legend: { display: false } } }
    });

    // 4. Control Chart (Grand WT% over time, with UCL/LCL)
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const sd = Math.sqrt(variance);
    const ucl = mean + 3 * sd, lcl = Math.max(0, mean - 3 * sd);
    if (ecControlChartInstance) ecControlChartInstance.destroy();
    ecControlChartInstance = new Chart(document.getElementById("ecControlChart").getContext("2d"), {
      type: "line",
      data: {
        labels: allRows.map(r => r.month),
        datasets: [
          { label: "Grand WT%", data: values, borderColor: "#1f3864", tension: 0.2 },
          { label: "Mean", data: values.map(() => mean), borderColor: "#1e6b3c", borderDash: [4, 4], pointRadius: 0 },
          { label: "UCL", data: values.map(() => ucl), borderColor: "#a3271c", borderDash: [6, 4], pointRadius: 0 },
          { label: "LCL", data: values.map(() => lcl), borderColor: "#a3271c", borderDash: [6, 4], pointRadius: 0 }
        ]
      },
      options: { responsive: true, devicePixelRatio: 2, plugins: { legend: { position: "bottom" } } }
    });

    // 5. Scatter Diagram (Total Strip produced vs Edge Crack Grand Total - does crack scale with volume?)
    if (ecScatterChartInstance) ecScatterChartInstance.destroy();
    ecScatterChartInstance = new Chart(document.getElementById("ecScatterChart").getContext("2d"), {
      type: "scatter",
      data: {
        datasets: [{
          label: "Total Strip vs Edge Crack",
          data: allRows.map(r => ({ x: r.totalStrip, y: r.grandTotal })),
          backgroundColor: "#c9a227"
        }]
      },
      options: {
        responsive: true, devicePixelRatio: 2,
        scales: { x: { title: { display: true, text: "Total Strip (production)" } }, y: { title: { display: true, text: "Edge Crack - Grand Total" } } }
      }
    });

    // 6. Stratification (by category: Strip Mill vs Buildup vs Tube Mill)
    const byHeatType = catTotals; // category totals, used by the breakdown dashboard chart
    if (ecStratChartInstance) ecStratChartInstance.destroy();
    ecStratChartInstance = new Chart(document.getElementById("ecStratChart").getContext("2d"), {
      type: "bar",
      data: {
        labels: Object.keys(byHeatType),
        datasets: [{ label: "Edge Crack (total)", data: Object.values(byHeatType), backgroundColor: ["#c9a227", "#1f3864", "#9dc3e6"] }]
      },
      options: { responsive: true, devicePixelRatio: 2, plugins: { legend: { display: false } } }
    });

    // 7. Month-wise Trend (Grand Total per month, to see if rejection is rising or falling)
    const byMonth = {};
    allRows.forEach(r => { byMonth[r.month] = r.grandTotal; });
    const monthKeys = allRows.map(r => r.month);
    if (ecMonthTrendChartInstance) ecMonthTrendChartInstance.destroy();
    ecMonthTrendChartInstance = new Chart(document.getElementById("ecMonthTrendChart").getContext("2d"), {
      type: "bar",
      data: {
        labels: monthKeys,
        datasets: [{ label: "Edge Crack - Grand Total (monthly)", data: monthKeys.map(k => byMonth[k]), backgroundColor: "#a3271c" }]
      },
      options: { responsive: true, devicePixelRatio: 2, plugins: { legend: { display: false } } }
    });

    // Stash everything for the Excel export
    ecExportData = {
      fromDate, toDate, allRows, totalPrime: totalStripSum, totalCrack, crackRejPct,
      paretoEntries, cumPct,
      histogramLabels: buckets.map((_, i) => `${(i * bucketSize).toFixed(2)}-${((i + 1) * bucketSize).toFixed(2)}%`), buckets,
      controlDates: allRows.map(r => r.month), controlValues: values, mean, ucl, lcl,
      scatterData: allRows.map(r => ({ x: r.totalStrip, y: r.grandTotal })),
      byHeatType, byMonth
    };

    statusEl.className = "ok";
    statusEl.textContent = `Analysis loaded: ${allRows.length} month(s) from ${fromDate} to ${toDate}.`;

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("ecLoadBtn").addEventListener("click", loadEdgeCrackAnalysis);

/* ---- Quick period-select presets ---- */
function setEcDateRange(from, to) {
  document.getElementById("ecFromDate").value = from;
  document.getElementById("ecToDate").value = to;
}
function pad2(n) { return String(n).padStart(2, "0"); }
function isoDate(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; } // m is 1-based

// Default the FY input to the current financial year's starting year (FY runs April-March).
(function initEcFyYear() {
  const now = new Date();
  const currentFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // getMonth() 3 = April
  document.getElementById("ecFyYear").value = currentFyStart;
})();

document.getElementById("ecApplyMonth").addEventListener("click", () => {
  const val = document.getElementById("ecMonthPicker").value; // "YYYY-MM"
  if (!val) { alert("Please pick a month first."); return; }
  const [y, m] = val.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  setEcDateRange(isoDate(y, m, 1), isoDate(y, m, lastDay));
});

// Financial-year quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
// (Q4 falls in the calendar year AFTER the FY's starting year.)
function setEcFyQuarter(startMonth1based, monthsInFyYearAfterStart) {
  const fyStart = parseInt(document.getElementById("ecFyYear").value, 10);
  if (!fyStart) { alert("Please enter a Financial Year first."); return; }
  const startYear = fyStart + (startMonth1based < 4 ? 1 : 0); // Jan-Mar belongs to the following calendar year
  const endMonth = startMonth1based + 2;
  const endYear = fyStart + (endMonth < 4 ? 1 : 0);
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  setEcDateRange(isoDate(startYear, startMonth1based, 1), isoDate(endYear, endMonth, lastDay));
}

document.getElementById("ecApplyQuarter").addEventListener("click", () => {
  const choice = document.getElementById("ecQuarterSelect").value;
  if (choice === "q1") setEcFyQuarter(4);       // Apr-Jun
  else if (choice === "q2") setEcFyQuarter(7);  // Jul-Sep
  else if (choice === "q3") setEcFyQuarter(10); // Oct-Dec
  else if (choice === "q4") setEcFyQuarter(1);  // Jan-Mar (next calendar year)
  else if (choice === "fy") {
    const fyStart = parseInt(document.getElementById("ecFyYear").value, 10);
    if (!fyStart) { alert("Please enter a Financial Year first."); return; }
    setEcDateRange(isoDate(fyStart, 4, 1), isoDate(fyStart + 1, 3, 31));
  }
});

/* ---- CSV export of the loaded data ---- */
let ecLastAllRows = null;

document.getElementById("ecCsvBtn").addEventListener("click", () => {
  if (!ecLastAllRows || ecLastAllRows.length === 0) {
    alert("Load an analysis first.");
    return;
  }
  const headers = ["Month", "Strip Mill WT", "Strip WT%", "Buildup WT", "Buildup WT%", "Tube Mill WT", "Tube WT%", "Grand Total", "Grand WT%", "Total Strip"];
  const escapeCsv = v => {
    const s = (v === null || v === undefined) ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escapeCsv).join(",")];
  ecLastAllRows.forEach(r => {
    lines.push([r.month, r.stripMillWT, r.stripWTPct, r.buildupWT, r.buildupWTPct, r.tubeMillWT, r.tubeWTPct, r.grandTotal, r.grandWTPct, r.totalStrip].map(escapeCsv).join(","));
  });
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const from = document.getElementById("ecFromDate").value;
  const to = document.getElementById("ecToDate").value;
  a.download = `Edge_Crack_Data_${from}_to_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("ecExcelBtn").addEventListener("click", () => {
  if (!ecExportData) {
    alert("Load an analysis first.");
    return;
  }
  const d = ecExportData;
  const wb = XLSX.utils.book_new();

  // ---- Summary sheet ----
  const summaryData = [
    ["Edge Crack - 7 QC Tools Analysis"],
    [`Period: ${d.fromDate} to ${d.toDate}`],
    [],
    ["Total Strip (production)", d.totalPrime.toFixed(2)],
    ["Total Edge Crack (Grand Total)", d.totalCrack.toFixed(2)],
    ["Edge Crack Rejection %", d.crackRejPct.toFixed(3) + "%"],
    ["Mean (Grand WT%)", d.mean.toFixed(3)],
    ["UCL (Mean + 3 SD)", d.ucl.toFixed(3)],
    ["LCL (Mean - 3 SD)", d.lcl.toFixed(3)]
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // ---- Check Sheet (raw data) ----
  const checkSheetRows = [["Month", "Strip Mill WT", "Strip WT%", "Buildup WT", "Buildup WT%", "Tube Mill WT", "Tube WT%", "Grand Total", "Grand WT%", "Total Strip"]];
  d.allRows.forEach(r => {
    checkSheetRows.push([r.month, r.stripMillWT, r.stripWTPct, r.buildupWT, r.buildupWTPct, r.tubeMillWT, r.tubeWTPct, r.grandTotal, r.grandWTPct, r.totalStrip]);
  });
  const wsCheck = XLSX.utils.aoa_to_sheet(checkSheetRows);
  wsCheck["!cols"] = checkSheetRows[0].map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, wsCheck, "Check Sheet");

  // ---- Pareto Chart data ----
  const paretoRows = [["Month", "Edge Crack (total)", "Cumulative %"]];
  d.paretoEntries.forEach((e, i) => paretoRows.push([e[0], e[1].toFixed(3), d.cumPct[i].toFixed(1) + "%"]));
  const wsPareto = XLSX.utils.aoa_to_sheet(paretoRows);
  wsPareto["!cols"] = [{ wch: 18 }, { wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsPareto, "Pareto Chart");

  // ---- Histogram data ----
  const histRows = [["Grand WT% Range", "Number of Months"]];
  d.histogramLabels.forEach((label, i) => histRows.push([label, d.buckets[i]]));
  const wsHist = XLSX.utils.aoa_to_sheet(histRows);
  wsHist["!cols"] = [{ wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsHist, "Histogram");

  // ---- Control Chart data ----
  const ctrlRows = [["Month", "Grand WT%", "Mean", "UCL", "LCL"]];
  d.controlDates.forEach((date, i) => ctrlRows.push([date, d.controlValues[i], d.mean.toFixed(3), d.ucl.toFixed(3), d.lcl.toFixed(3)]));
  const wsCtrl = XLSX.utils.aoa_to_sheet(ctrlRows);
  wsCtrl["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsCtrl, "Control Chart");

  // ---- Scatter Diagram data ----
  const scatterRows = [["Total Strip", "Edge Crack - Grand Total"]];
  d.scatterData.forEach(p => scatterRows.push([p.x, p.y]));
  const wsScatter = XLSX.utils.aoa_to_sheet(scatterRows);
  wsScatter["!cols"] = [{ wch: 18 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsScatter, "Scatter Diagram");

  // ---- Stratification data ----
  const stratRows = [["Category", "Edge Crack (total)"]];
  Object.entries(d.byHeatType).forEach(([k, v]) => stratRows.push([k, v.toFixed(3)]));
  const wsStrat = XLSX.utils.aoa_to_sheet(stratRows);
  wsStrat["!cols"] = [{ wch: 16 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsStrat, "Category Breakdown");

  // ---- Month-wise Trend data ----
  const trendRows = [["Month", "Edge Crack - Grand Total"]];
  Object.keys(d.byMonth).sort().forEach(m => trendRows.push([m, d.byMonth[m].toFixed(3)]));
  const wsTrend = XLSX.utils.aoa_to_sheet(trendRows);
  wsTrend["!cols"] = [{ wch: 12 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsTrend, "Month-wise Trend");

  // ---- Fishbone notes ----
  const fbRows = [["Category", "Notes / Likely Causes"]];
  document.querySelectorAll(".fishboneCat").forEach(cat => {
    fbRows.push([cat.querySelector("b").textContent, cat.querySelector("textarea").value || ""]);
  });
  const wsFb = XLSX.utils.aoa_to_sheet(fbRows);
  wsFb["!cols"] = [{ wch: 16 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsFb, "Fishbone Notes");

  XLSX.writeFile(wb, `Edge_Crack_QC_Analysis_${d.fromDate}_to_${d.toDate}.xlsx`);
});

function svgToPngDataUrl(svgEl) {
  return new Promise((resolve, reject) => {
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1800;
      canvas.height = 760;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

document.getElementById("ecPdfBtn").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  addLogoHeader(doc);
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Edge Crack - 7 QC Tools Analysis", pageW / 2, 30, { align: "center" });

  const charts = [
    [ecPrimeVsCrackChartInstance, "Total Strip vs Edge Crack"],
    [ecStratChartInstance, "Dashboard: Category Breakdown (Strip Mill / Buildup / Tube Mill)"],
    [ecParetoChartInstance, "2. Pareto Chart"],
    [ecHistogramChartInstance, "3. Histogram"],
    [ecControlChartInstance, "4. Control Chart"],
    [ecScatterChartInstance, "5. Scatter Diagram"],
    [ecMonthTrendChartInstance, "6. Month-wise Trend"]
  ];
  charts.forEach(([chart, title], i) => {
    if (!chart) return;
    if (i > 0 || true) doc.addPage();
    doc.setFontSize(14);
    doc.text(title, pageW / 2, 30, { align: "center" });
    const img = chart.toBase64Image();
    doc.addImage(img, "PNG", 40, 50, pageW - 80, (pageW - 80) * (chart.canvas.height / chart.canvas.width));
  });

  doc.addPage();
  doc.setFontSize(14);
  doc.text("7. Cause & Effect (Fishbone) Diagram", pageW / 2, 30, { align: "center" });

  const fishboneImg = await svgToPngDataUrl(document.getElementById("fishboneSvg"));
  const fbW = pageW - 80;
  const fbH = fbW * (380 / 900);
  doc.addImage(fishboneImg, "PNG", 40, 45, fbW, fbH);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let y = 55 + fbH + 20;
  document.querySelectorAll(".fishboneCat").forEach(cat => {
    const label = cat.querySelector("b").textContent;
    const note = cat.querySelector("textarea").value || "(no notes entered)";
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", 40, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(note, pageW - 100);
    doc.text(lines, 60, y + 14);
    y += 14 + lines.length * 12 + 14;
  });

  stampLogoOnAllPages(doc);
  showPdfPreview(doc, "Edge_Crack_QC_Analysis.pdf", "Edge Crack - 7 QC Tools Analysis");
});

