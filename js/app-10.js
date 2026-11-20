/* ===================== FILE AUTO-DETECT BY MONTH ===================== */
const MONTH_ABBR = ["January","February","March","April","May","June","July","August","September","October","November","December"];

async function tryGetItem(token, path) {
  try {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const item = await graphFetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}`,
      token
    );
    return item;
  } catch (e) {
    return null; // not found at this path - that's expected, not a real error
  }
}

async function listChildren(token, path) {
  try {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const data = await graphFetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/children?$select=name,folder`,
      token
    );
    return data.value || [];
  } catch (e) {
    return [];
  }
}

// Searches for expectedName inside baseFolder and its subfolders (breadth-first,
// capped at a reasonable depth so it can't run away on a huge tree).
async function findFileInFolderTree(token, baseFolder, expectedName, maxFolders = 40) {
  let queue = [baseFolder];
  let checked = 0;
  while (queue.length > 0 && checked < maxFolders) {
    const folder = queue.shift();
    checked++;
    const children = await listChildren(token, folder);
    for (const child of children) {
      if (!child.folder && child.name.toLowerCase() === expectedName.toLowerCase()) {
        return `${folder}/${child.name}`;
      }
    }
    for (const child of children) {
      if (child.folder) queue.push(`${folder}/${child.name}`);
    }
  }
  return null;
}

// Given a year and 0-based month, returns the OneDrive path of that month's
// file (checking Desktop, then the Production Sheet folder and its
// sub-folders), or null if it can't be found anywhere.
// Caches resolved file paths per (year, month) for this session - avoids
// repeating the same (often slow) file-detection work when multiple
// reports need the same month, or when a report loops over many months.
const _filePathCache = new Map();

async function detectFilePathForMonth(token, year, month0based) {   // one file for every crucible (crucibles are sheets)
  const cacheKey = `${year}-${month0based}`;
  if (_filePathCache.has(cacheKey)) return _filePathCache.get(cacheKey);

  if (typeof XL !== "undefined" && !xlIsDefaultFile()) {   // Get Started → Excel Formats: own file name / folder
    const name = xlFileName(year, month0based), folder = XL.file.folder.replace(/^\/+|\/+$/g, "");
    let found = (await tryGetItem(token, `${folder}/${name}`)) ? `${folder}/${name}` : null;
    if (!found) found = await findFileInFolderTree(token, folder, name);
    _filePathCache.set(cacheKey, found || null);
    return found || null;
  }
  const abbr = MONTH_ABBR[month0based];
  const yy = String(year).slice(2);
  const expectedName = `${abbr}'${yy}_Reports.xlsx`;

  // Some historical files have one-off naming quirks from before the naming
  // convention was standardized (a typo, or singular "Report" instead of
  // "Reports") - try those specific known variants too.
  const nameVariants = [expectedName];
  if (abbr === "February") nameVariants.push(`Feburary'${yy}_Reports.xlsx`); // known typo for Feb 2026
  if (abbr === "March") nameVariants.push(`March'${yy}_Report.xlsx`); // known singular-"Report" naming for Mar 2026
  nameVariants.push(`${abbr}'${yy}_Report.xlsx`); // generic singular fallback, just in case

  const prodSheetBase = "Desktop/MIPPL/Production Sheet";
  const foldersToCheck = ["Desktop", prodSheetBase, `${prodSheetBase}/Reports 25-26`];

  // Check every folder/name-variant combination at once instead of one at a
  // time - this used to be up to 12 sequential network round-trips before
  // even reaching the fallback search; now they all happen concurrently.
  const candidates = [];
  for (const folder of foldersToCheck) {
    for (const name of nameVariants) {
      candidates.push(`${folder}/${name}`);
    }
  }
  const results = await Promise.all(candidates.map(path => tryGetItem(token, path).then(ok => ok ? path : null)));
  let found = results.find(r => r !== null);

  // Last resort: recursive search using the standard expected name (only
  // if none of the direct-path guesses worked).
  if (!found) {
    found = await findFileInFolderTree(token, prodSheetBase, expectedName);
  }

  _filePathCache.set(cacheKey, found || null);
  return found || null;
}

// For a From/To date range that may span multiple months (and therefore
// multiple separate monthly Excel files), resolves each month's workbook and
// the portion of the overall range that falls within that month. Reports
// then loop over these entries, adding pages from each file into one PDF.
// Formats a Date using its LOCAL calendar date (year/month/day as the user's
// browser sees them), not toISOString()'s UTC conversion - which was shifting
// dates back by a day for users in positive UTC-offset timezones like India.
function localDateToISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function getWorkbooksForRange(token, fromDate, toDate, opts) {
  if (opts && opts.allCru && xlCrus()[0]) {   // every crucible, crucible by crucible: the same file(s), entry.cru tells which sheets
    const r = await getWorkbooksForRange(token, fromDate, toDate);
    const results = [];
    xlCrus().forEach(c => r.results.forEach(e => results.push(Object.assign({}, e, { cru: c }))));
    return { results, missing: r.missing };
  }
  let cursor = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate + "T00:00:00");

  // First, build the list of months to fetch (no network calls yet).
  const monthsToFetch = [];
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth(); // 0-based
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);
    const rangeStart = cursor > monthStart ? cursor : monthStart;
    const rangeEnd = end < monthEnd ? end : monthEnd;
    monthsToFetch.push({ y, m, rangeStart, rangeEnd });
    cursor = new Date(y, m + 1, 1); // advance to the 1st of the next month
  }

  // Fetch every month concurrently - Promise.all with map() keeps results
  // in the same (chronological) order the months were listed in, even
  // though the underlying requests may finish in any order.
  const fetched = await Promise.all(monthsToFetch.map(async ({ y, m, rangeStart, rangeEnd }) => {
    const filePath = await detectFilePathForMonth(token, y, m);
    if (!filePath) return { missing: `${MONTH_ABBR[m]} ${y}` };
    const wb = await resolveWorkbook(token, filePath);
    return { entry: { filePath, wb, fromDate: localDateToISO(rangeStart), toDate: localDateToISO(rangeEnd) } };
  }));

  const results = [], missing = [];
  fetched.forEach(r => {
    if (r.entry) results.push(r.entry);
    else missing.push(r.missing);
  });

  return { results, missing };
}

async function autoDetectFile() {
  const resultEl = document.getElementById("autoDetectResult");
  const monthVal = document.getElementById("autoDetectMonth").value; // "YYYY-MM"

  if (!monthVal) {
    resultEl.style.color = "#a3271c";
    resultEl.textContent = "Please select a month first.";
    return;
  }

  const [yyyy, mm] = monthVal.split("-");
  const expectedName = `${MONTH_ABBR[parseInt(mm) - 1]}'${yyyy.slice(2)}_Reports.xlsx`;

  resultEl.style.color = "var(--muted)";
  resultEl.textContent = `Looking for "${expectedName}"...`;

  try {
    const token = await getToken();
    const foundPath = await detectFilePathForMonth(token, parseInt(yyyy), parseInt(mm) - 1);

    if (foundPath) {
      document.getElementById("filePath").value = foundPath;
      resultEl.style.color = "#1e6b3c";
      resultEl.textContent = `✅ Found: ${foundPath} (set as File Location)`;
    } else {
      resultEl.style.color = "#a3271c";
      resultEl.textContent = `Couldn't find "${expectedName}" in Desktop, Production Sheet, or its sub-folders. Check the file exists and the naming pattern matches.`;
    }

  } catch (e) {
    resultEl.style.color = "#a3271c";
    resultEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("autoDetectBtn").addEventListener("click", autoDetectFile);

/* ===================== DASHBOARD ===================== */
// Returns { titleRow, dataStart } for the date's 18-row block, or null if not found.
async function findProdBlockForDate(wb, sheetName, dateVal, token) {
  const colA = await graphFetch(
    `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=values`,
    token
  );
  const values = colA.values;
  for (let i = 0; i < values.length; i++) {
    const v = values[i][0];
    if (typeof v === "number" && excelSerialToISODate(v) === dateVal) {
      const dataStart = i + 1;
      return { titleRow: dataStart - 3, dataStart };
    }
  }
  return null;
}

// Computes one day's summary: heat count (from actual filled Heat No. cells,
// not a total-row label), Total Prod, Hot Charging, Bypass, Hot Out (all from
// the Total row), and RHF (summed from BOTH the MAX row [130 section] and the
// Total row [160 section], since RHF entries split across those two rows).
// "Monthly Prod" sheet tracks Hot Out in F (Net Weight) always, but G
// (Calculated Weight) only has meaningful data from August 2026 onward -
// before that, only F should be read/shown.
async function getMonthlyProdHotOut(wb, dateVal, token) {
  const isPreAugust = dateVal.slice(0, 7) < "2026-08";
  try {
    const data = await graphFetch(
      `${wb}/worksheets('Monthly Prod')/range(address='A1:G2000')?$select=values,text`,
      token
    );
    for (let i = 0; i < data.values.length; i++) {
      const row = data.values[i];
      const dateCell = row[0];
      const textCell = data.text[i][0];
      const iso = anyDateToISO(dateCell, textCell);
      if (!iso) continue;
      if (iso === dateVal) {
        return {
          net: typeof row[5] === "number" ? row[5] : 0,                          // F
          calc: isPreAugust ? null : (typeof row[6] === "number" ? row[6] : 0)   // G - not applicable before August
        };
      }
    }
  } catch (e) { /* Monthly Prod sheet missing from this workbook - stays 0 */ }
  return { net: 0, calc: isPreAugust ? null : 0 };
}

// A heat counts only when its row has a heat no. (B) AND real data - its
// production (AB) or chemistry (C-G). A heat no. typed/pre-filled ahead of
// time, or a copied formula, no longer counts as a made heat.
function isRealHeatRow(r) {
  if (!r || r[1] === null || r[1] === undefined || String(r[1]).trim() === "") return false;
  const pos = v => typeof v === "number" && v > 0;
  return pos(r[27]) || pos(r[2]) || pos(r[3]) || pos(r[4]) || pos(r[5]) || pos(r[6]);
}
async function getDaySummary(wb, sheetName, titleRow, dataStart, token) {
  const heats = await prodHeatsFor(wb, token, sheetName);
  const [heatCol, rows] = await Promise.all([
    graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A${dataStart}:AB${dataStart + heats - 1}')?$select=values`, token),
    graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A${titleRow + heats + 4}:AH${titleRow + heats + 5}')?$select=values`, token)
  ]);

  const heatCount = heatCol.values.filter(isRealHeatRow).length;
  const maxRow = rows.values[0];   // titleRow+16 (130 section)
  const totalRow = rows.values[1]; // titleRow+17 (160 section)

  const n = v => (typeof v === "number" ? v : 0);
  return {
    heatCount,
    totalProd: n(totalRow[27]),      // AB
    hotCharging: n(totalRow[20]),    // U
    bypass: n(totalRow[26]),         // AA
    rhf: n(maxRow[14]) + n(totalRow[14]), // O on both the MAX row (130) and Total row (160)
    hotOut: n(totalRow[33])          // AH
  };
}

// Returns the total Consumption (sum of AI:AO - Lumps, Fines, Pellets, Steel
// Melting Scrap, Mag Material, Rolling Mill Scrap, M.S Scrap) for a specific
// date on the "RM Report" sheet (column Y holds that sheet's own dates).
// Returns 0 if the date isn't found on that sheet (workbook may not have a
// "RM Report" sheet, or the date hasn't been logged there yet).
async function getConsumptionForDate(wb, dateVal, token) {
  try {
    const colA = await graphFetch(
      `${wb}/worksheets('${encodeURIComponent(String(CONSUMPTION_SHEET_NAME).replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=values`,
      token
    );
    let rowIndex = -1;
    for (let i = 0; i < colA.values.length; i++) {
      const v = colA.values[i][0];
      if (typeof v === "number" && excelSerialToISODate(v) === dateVal) { rowIndex = i + 1; break; }
    }
    if (rowIndex === -1) return 0;

    const data = await graphFetch(
      `${wb}/worksheets('${encodeURIComponent(String(CONSUMPTION_SHEET_NAME).replace(/'/g, "''"))}')/range(address='AI${rowIndex}:AR${rowIndex}')?$select=values`,
      token
    );
    return data.values[0].reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0);
  } catch (e) {
    return 0; // sheet not present in this workbook, or range unavailable - treat as no consumption logged
  }
}

/* ===================== HEAT-WISE CONSUMPTION ===================== */
// Every raw-material item is entered once as a 24-hour cumulative figure.
// This splits that single number across the day's individual heats, in
// proportion to each heat's production weight (from the Logsheet), while
// keeping every share a whole number and making sure the heats for any one
// item still add up to exactly the original 24-hour total - the classic
// "largest remainder" apportionment method, applied at kg precision (the
// same 3-decimal-MT granularity the rest of the app already uses).
const HEAT_CONSUMPTION_ITEMS = [
  { key: "lumps", label: "Lumps" },
  { key: "fines", label: "Fines" },
  { key: "pellets", label: "Pellets" },
  { key: "steelMeltingScrap", label: "Steel Melting Scrap" },
  { key: "magMaterial", label: "Mag Material" },
  { key: "rollingMillScrap", label: "MS Scrap - Rolling Mill" },
  { key: "msScrap", label: "MS Scrap" },
  { key: "ciMixScrap", label: "CI Mix Scrap" },
  { key: "pigIron", label: "Pig Iron" },
  { key: "overSizeMag", label: "Over Size Mag" }
];

function apportionIntegerByWeight(totalUnits, weights) {
  // totalUnits: whole-number total to distribute. weights: parallel array
  // of (any consistent unit) heat weights. Returns whole-number shares
  // that add up to exactly totalUnits, biggest weights first when ties.
  const sumW = weights.reduce((s, w) => s + w, 0);
  if (sumW <= 0 || totalUnits === 0) return weights.map(() => 0);
  const raw = weights.map(w => (totalUnits * w) / sumW);
  const floors = raw.map(Math.floor);
  const distributed = floors.reduce((s, v) => s + v, 0);
  let remainder = Math.round(totalUnits - distributed);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const result = floors.slice();
  for (let k = 0; k < remainder && k < order.length; k++) {
    result[order[k].i] += 1;
  }
  return result;
}

async function getConsumptionRowForDate(wb, dateVal, token) {
  try {
    const colA = await graphFetch(
      `${wb}/worksheets('${encodeURIComponent(String(CONSUMPTION_SHEET_NAME).replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=values`,
      token
    );
    let rowIndex = -1;
    for (let i = 0; i < colA.values.length; i++) {
      const v = colA.values[i][0];
      if (typeof v === "number" && excelSerialToISODate(v) === dateVal) { rowIndex = i + 1; break; }
    }
    if (rowIndex === -1) return new Array(HEAT_CONSUMPTION_ITEMS.length).fill(0);

    const data = await graphFetch(
      `${wb}/worksheets('${encodeURIComponent(String(CONSUMPTION_SHEET_NAME).replace(/'/g, "''"))}')/range(address='AI${rowIndex}:AR${rowIndex}')?$select=values`,
      token
    );
    return data.values[0].map(v => (typeof v === "number" ? v : 0));
  } catch (e) {
    return new Array(HEAT_CONSUMPTION_ITEMS.length).fill(0);
  }
}

async function getHeatWeightsForDate(wb, dateVal, sheetName, token) {
  const colA = await graphFetch(
    `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=values`,
    token
  );
  let dataStart = -1;
  for (let i = 0; i < colA.values.length; i++) {
    const v = colA.values[i][0];
    if (typeof v === "number" && excelSerialToISODate(v) === dateVal) { dataStart = i + 1; break; }
  }
  if (dataStart === -1) return [];

  // 12 (or 24) heat rows per day; MIN/MAX/TOTAL summary rows follow and are
  // deliberately excluded (column B is blank for those anyway).
  const blockEnd = dataStart + (await prodHeatsFor(wb, token, sheetName)) - 1;
  const data = await graphFetch(
    `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='B${dataStart}:AB${blockEnd}')?$select=values`,
    token
  );
  const heats = [];
  data.values.forEach(row => {
    const heatNo = row[0];
    const weight = row[row.length - 1]; // last column = Total Prod
    if (heatNo !== null && heatNo !== "" && typeof weight === "number" && weight > 0) {
      heats.push({ heatNo: heatNo.toString(), weight });
    }
  });
  return heats;
}

async function loadHeatwiseConsumption() {
  const statusEl = document.getElementById("status");
  const sheetName = document.getElementById("heatConsSheetName").value.trim();
  const dateVal = document.getElementById("heatConsDate").value;

  if (!dateVal) {
    statusEl.className = "err";
    statusEl.textContent = "Please select a date.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Loading heat-wise consumption...";

  try {
    const token = await getToken();
    const { results: wbList } = await getWorkbooksForRange(token, dateVal, dateVal);
    if (wbList.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = "Couldn't find a file for this date.";
      return;
    }
    const wb = wbList[0].wb;

    const heats = await getHeatWeightsForDate(wb, dateVal, sheetName, token);
    if (heats.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = `No heats found for ${dateVal} in the "${sheetName}" sheet.`;
      return;
    }

    const consumptionRow = await getConsumptionRowForDate(wb, dateVal, token);
    const weights = heats.map(h => h.weight);

    // Work in units of 0.01 MT (10 kg) so every heat's share always ends
    // in a zero third decimal - a round figure - then convert back to MT
    // for display. This means the total the heats add up to is the true
    // 24-hour figure rounded to the nearest 10 kg, not the exact kg value;
    // that's an unavoidable trade-off once every heat's own share has to
    // be a round number, and the resulting gap is at most a few kg.
    const perHeatUnits = HEAT_CONSUMPTION_ITEMS.map((item, idx) => {
      const totalUnits = Math.round((consumptionRow[idx] || 0) * 100);
      return apportionIntegerByWeight(totalUnits, weights);
    });

    const table = document.getElementById("heatConsTable");
    let html = "<tr><th>H.No.</th><th>Production (MT)</th>" +
      HEAT_CONSUMPTION_ITEMS.map(i => `<th>${i.label} (MT)</th>`).join("") +
      "<th>Total Consumption (MT)</th></tr>";

    const totalsUnits = new Array(HEAT_CONSUMPTION_ITEMS.length).fill(0);
    let totalWeight = 0;
    heats.forEach((h, hIdx) => {
      totalWeight += h.weight;
      let rowTotalUnits = 0;
      let cells = "";
      HEAT_CONSUMPTION_ITEMS.forEach((item, iIdx) => {
        const units = perHeatUnits[iIdx][hIdx];
        totalsUnits[iIdx] += units;
        rowTotalUnits += units;
        cells += `<td>${(units / 100).toFixed(3)}</td>`;
      });
      html += `<tr><td>${htmlEsc(h.heatNo)}</td><td>${h.weight.toFixed(3)}</td>${cells}<td>${(rowTotalUnits / 100).toFixed(3)}</td></tr>`;
    });

    const grandTotalUnits = totalsUnits.reduce((s, v) => s + v, 0);
    html += `<tr class="rowTotal"><td>TOTAL</td><td>${totalWeight.toFixed(3)}</td>` +
      totalsUnits.map(v => `<td>${(v / 100).toFixed(3)}</td>`).join("") +
      `<td>${(grandTotalUnits / 100).toFixed(3)}</td></tr>`;

    table.innerHTML = html;
    document.getElementById("heatConsWrap").classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = `Loaded ${heats.length} heat(s) for ${dateVal}.`;
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("heatConsLoadBtn").addEventListener("click", loadHeatwiseConsumption);

/* ===================== MONTH-WISE CONSUMPTION ===================== */
// Sums the daily 24-hour consumption row (RM Report, columns AI:AR - the same
// cells Heat-wise Consumption uses) for every date of the chosen month, then
// shows each material's month total and its share (%) of the month's total.
// Like getConsumptionRowForDate, only the first row found for a date counts.
async function loadMonthwiseConsumption() {
  const statusEl = document.getElementById("status");
  const monthVal = document.getElementById("monthConsMonth").value; // "YYYY-MM"
  if (!monthVal) {
    statusEl.className = "err";
    statusEl.textContent = "Please select a month.";
    return;
  }
  statusEl.className = "wait";
  statusEl.textContent = "Loading month-wise consumption...";
  try {
    const [yy, mm] = monthVal.split("-").map(Number);
    const first = `${monthVal}-01`;
    const last = `${monthVal}-${String(new Date(yy, mm, 0).getDate()).padStart(2, "0")}`;
    const token = await getToken();
    const { results: wbList } = await getWorkbooksForRange(token, first, last);
    if (wbList.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = "Couldn't find the file for this month.";
      return;
    }
    const wb = wbList[0].wb;
    const sh = encodeURIComponent(String(CONSUMPTION_SHEET_NAME).replace(/'/g, "''"));
    const [colA, data] = await Promise.all([
      graphFetch(`${wb}/worksheets('${sh}')/range(address='A1:A2000')?$select=values`, token),
      graphFetch(`${wb}/worksheets('${sh}')/range(address='AI1:AR2000')?$select=values`, token)
    ]);
    const totals = new Array(HEAT_CONSUMPTION_ITEMS.length).fill(0);
    const seen = new Set();
    for (let i = 0; i < colA.values.length; i++) {
      const v = colA.values[i][0];
      if (typeof v !== "number") continue;
      const iso = excelSerialToISODate(v);
      if (!iso || !iso.startsWith(monthVal + "-") || seen.has(iso)) continue;
      const row = (data.values[i] || []);
      if (!row.some(x => typeof x === "number" && x !== 0)) continue; // day with no entry
      seen.add(iso);
      HEAT_CONSUMPTION_ITEMS.forEach((_, k) => { if (typeof row[k] === "number") totals[k] += row[k]; });
    }
    if (seen.size === 0) {
      statusEl.className = "err";
      statusEl.textContent = `No consumption entries found for ${monthVal} in the "${CONSUMPTION_SHEET_NAME}" sheet.`;
      return;
    }
    const grand = totals.reduce((s, v) => s + v, 0);
    const pct = v => (grand > 0 ? (v / grand) * 100 : 0);
    let html = "<tr><th>Raw Material</th><th>Weight (MT)</th><th>% of Total</th></tr>";
    HEAT_CONSUMPTION_ITEMS.forEach((item, k) => {
      const p = pct(totals[k]);
      html += `<tr><td style="text-align:left">${htmlEsc(item.label)}</td><td>${totals[k].toFixed(3)}</td>` +
        `<td style="min-width:110px"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">` +
        `<span style="flex:1;height:6px;border-radius:3px;background:rgba(127,127,127,.25);overflow:hidden">` +
        `<span style="display:block;height:100%;width:${p.toFixed(2)}%;background:var(--accent,#d4a72c)"></span></span>` +
        `<span>${p.toFixed(2)}%</span></div></td></tr>`;
    });
    html += `<tr class="rowTotal"><td style="text-align:left">TOTAL</td><td>${grand.toFixed(3)}</td><td>${grand > 0 ? "100.00%" : "0.00%"}</td></tr>`;
    document.getElementById("monthConsTable").innerHTML = html;
    const [ly, lm] = [yy, mm - 1];
    document.getElementById("monthConsInfo").textContent =
      `${MONTH_ABBR[lm]} ${ly} · ${seen.size} day(s) with consumption entries`;
    document.getElementById("monthConsWrap").classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = `Loaded month-wise consumption for ${monthVal} (${seen.size} day(s)).`;
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}
document.getElementById("monthConsLoadBtn").addEventListener("click", loadMonthwiseConsumption);
(() => { const el = document.getElementById("monthConsMonth"); if (el && !el.value) { const d = new Date(); el.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; } })();

/* ===================== PARTY TEST REPORTS ===================== */
// Reads Party_Wise_Test_Reports.xlsx (one sheet per party, one row per heat,
// vehicle number on every row). The header row is located by name rather than
// by a fixed position, and every column found there is shown, so it keeps
// working if columns are added or moved in the workbook.
const PARTY_REPORT_FILE_NAME = "Party_Wise_Test_Reports.xlsx";
const PARTY_REPORT_SKIP_SHEETS = ["summary", "staging", "master", "r.m billets reports"];
let _partyRepWb = null;
let partyRepSheet = null;   // { headers, vehicleIdx, heatIdx, holdIdx, weightIdx, piecesIdx, dateIdx, rows }
let partyRepCurrent = null; // what's currently displayed (used by the PDF button)
let _partyRepLoadSeq = 0;

function partyRepEsc(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function getPartyReportWorkbook(token) {
  if (_partyRepWb) return _partyRepWb;
  const n = PARTY_REPORT_FILE_NAME;
  const guesses = [`Desktop/${n}`, `Desktop/MIPPL/${n}`, `Desktop/MIPPL/Production Sheet/${n}`, n];
  let found = null;
  for (const p of guesses) {
    if (await tryGetItem(token, p)) { found = p; break; }
  }
  if (!found) found = await findFileInFolderTree(token, "Desktop", n);
  if (!found) throw new Error(`Couldn't find ${n} on your Desktop (OneDrive).`);
  _partyRepWb = await resolveWorkbook(token, found);
  return _partyRepWb;
}

async function loadPartyReportList() {
  const statusEl = document.getElementById("status");
  const sel = document.getElementById("partyRepParty");
  const vSel = document.getElementById("partyRepVehicle");
  if (sel.dataset.loaded === "1") return; // already populated this session
  statusEl.className = "wait";
  statusEl.textContent = "Loading party list...";
  try {
    const token = await getToken();
    const wb = await getPartyReportWorkbook(token);
    const data = await graphFetch(`${wb}/worksheets?$select=name,visibility`, token);
    const parties = (data.value || [])
      .filter(s => (s.visibility || "Visible") === "Visible")
      .map(s => s.name)
      .filter(n => !PARTY_REPORT_SKIP_SHEETS.includes(n.trim().toLowerCase()));
    if (parties.length === 0) throw new Error("No party sheets found in the workbook.");
    sel.innerHTML = '<option value="">-- Select party --</option>' +
      parties.map(p => `<option value="${partyRepEsc(p)}">${partyRepEsc(p)}</option>`).join("");
    sel.dataset.loaded = "1";
    vSel.innerHTML = '<option value="">Select a party first</option>';
    vSel.disabled = true;
    statusEl.className = "ok";
    statusEl.textContent = `${parties.length} parties found.`;
  } catch (e) {
    sel.innerHTML = '<option value="">Could not load parties</option>';
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

async function loadPartySheet(partyName) {
  const statusEl = document.getElementById("status");
  const vSel = document.getElementById("partyRepVehicle");
  const seq = ++_partyRepLoadSeq;
  partyRepSheet = null;
  document.getElementById("partyRepWrap").classList.add("hidden");
  if (!partyName) {
    vSel.innerHTML = '<option value="">Select a party first</option>';
    vSel.disabled = true;
    return;
  }
  vSel.innerHTML = '<option value="">Loading vehicles...</option>';
  vSel.disabled = true;
  statusEl.className = "wait";
  statusEl.textContent = `Loading ${partyName}...`;
  try {
    const token = await getToken();
    const wb = await getPartyReportWorkbook(token);
    const data = await graphFetch(
      `${wb}/worksheets('${encodeURIComponent(String(partyName).replace(/'/g, "''"))}')/usedRange(valuesOnly=true)?$select=text`,
      token
    );
    if (seq !== _partyRepLoadSeq) return; // a newer party was picked meanwhile
    const grid = data.text || [];

    const text = grid.map(r => r.map(x => String(x).trim()));

    // Find the top header row: the first one mentioning both "heat" and "vehicle".
    let hIdx = -1;
    for (let r = 0; r < Math.min(text.length, 20); r++) {
      if (text[r].some(x => /heat/i.test(x)) && text[r].some(x => /vehicle/i.test(x))) { hIdx = r; break; }
    }
    if (hIdx === -1) throw new Error(`Couldn't find the Heat No. / Vehicle number header row in "${partyName}".`);

    // The header can be several rows deep (e.g. "Parameters" on top, then
    // C / S / P / Mn / N / Si, then a units row like % / ppm). Merged cells
    // only carry their text in the top row, so keep reading rows below the
    // top header while they have no Heat No./Vehicle and hold only text.
    const topHeatIdx = text[hIdx].findIndex(x => /heat/i.test(x));
    const topVehIdx = text[hIdx].findIndex(x => /vehicle/i.test(x));
    const isUnit = x => /^(%|ppm|ppb|mm|mt|kg|nos\.?)$/i.test(x);
    const isNum = x => /^-?[\d.,]+$/.test(x);
    const headerRows = [text[hIdx]];
    let unitRow = null;
    for (let k = hIdx + 1; k < Math.min(hIdx + 4, text.length); k++) {
      const row = text[k];
      const filled = row.filter(x => x !== "");
      if (row[topHeatIdx] !== "" || row[topVehIdx] !== "" || filled.length === 0 || filled.some(isNum)) break;
      if (filled.every(isUnit)) { unitRow = row; break; }
      headerRows.push(row);
    }
    const dataStart = hIdx + headerRows.length + (unitRow ? 1 : 0);

    // One name per column: the deepest label found (so "C" wins over the
    // "Parameters" group title), with its unit appended, e.g. "C (%)".
    const ncols = text[hIdx].length;
    const headers = [];
    for (let j = 0; j < ncols; j++) {
      const labels = headerRows.map(r => r[j] || "").filter(Boolean);
      let name = labels.length ? labels[labels.length - 1] : "";
      const unit = unitRow ? (unitRow[j] || "") : "";
      if (name && unit && !name.includes(unit)) name += ` (${unit})`;
      headers.push(name);
    }
    const find = re => headers.findIndex(h => re.test(h));
    const info = {
      headers,
      vehicleIdx: find(/vehicle/i),
      heatIdx: find(/heat/i),
      holdIdx: find(/^hold/i),
      weightIdx: find(/weight/i),
      piecesIdx: find(/piece/i),
      dateIdx: find(/^dated?$/i),
      rows: []
    };

    let lastVehicle = "";
    for (let r = dataStart; r < text.length; r++) {
      const row = text[r].slice();
      const heat = row[info.heatIdx] || "";
      let vehicle = row[info.vehicleIdx] || "";
      if (!heat && !vehicle) continue;          // blank / formula-only rows
      if (vehicle) lastVehicle = vehicle; else if (heat) vehicle = lastVehicle;
      row[info.vehicleIdx] = vehicle;
      info.rows.push(row);
    }
    if (info.rows.length === 0) throw new Error(`No test reports found in "${partyName}".`);

    partyRepSheet = info;
    partyRepSheet.party = partyName;

    // Unique vehicles, latest first.
    const seen = new Set();
    const vehicles = [];
    for (let i = info.rows.length - 1; i >= 0; i--) {
      const v = info.rows[i][info.vehicleIdx];
      if (v && !seen.has(v)) { seen.add(v); vehicles.push(v); }
    }
    vSel.innerHTML = '<option value="">-- Select vehicle --</option>' +
      vehicles.map(v => `<option value="${partyRepEsc(v)}">${partyRepEsc(v)}</option>`).join("");
    vSel.disabled = false;
    statusEl.className = "ok";
    statusEl.textContent = `${partyName}: ${vehicles.length} vehicle(s), ${info.rows.length} heat(s).`;
  } catch (e) {
    if (seq !== _partyRepLoadSeq) return;
    vSel.innerHTML = '<option value="">Could not load vehicles</option>';
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

function showPartyVehicleReport() {
  const statusEl = document.getElementById("status");
  const party = document.getElementById("partyRepParty").value;
  const vehicle = document.getElementById("partyRepVehicle").value;
  if (!party || !vehicle || !partyRepSheet || partyRepSheet.party !== party) {
    statusEl.className = "err";
    statusEl.textContent = "Please select both a party and a vehicle number.";
    return;
  }
  const s = partyRepSheet;
  const rows = s.rows.filter(r => r[s.vehicleIdx] === vehicle);
  const num = v => { const n = parseFloat(String(v).replace(/,/g, "")); return isNaN(n) ? 0 : n; };

  const pieces = s.piecesIdx >= 0 ? rows.reduce((t, r) => t + num(r[s.piecesIdx]), 0) : null;
  const weight = s.weightIdx >= 0 ? rows.reduce((t, r) => t + num(r[s.weightIdx]), 0) : null;
  const date = s.dateIdx >= 0 ? (rows.find(r => r[s.dateIdx]) || [])[s.dateIdx] || "" : "";
  const onHold = s.holdIdx >= 0 && rows.some(r => r[s.holdIdx]);

  const cards = [
    ["Party", party], ["Vehicle No.", vehicle], ["Heats", rows.length]
  ];
  if (date) cards.push(["Dated", date]);
  if (pieces !== null && pieces > 0) cards.push(["Total Pieces", pieces]);
  if (weight !== null && weight > 0) cards.push(["Weight (MT)", weight.toFixed(3)]);
  if (onHold) cards.push(["Status", "HOLD"]);
  document.getElementById("partyRepSummary").innerHTML = cards.map(([l, v]) =>
    `<div class="dashCard${l === "Status" ? " dashOrange" : ""}"><div class="dashLabel">${partyRepEsc(l)}</div><div class="dashValue" style="font-size:16px;">${partyRepEsc(v)}</div></div>`
  ).join("");

  // Show every column that has a header name.
  const cols = s.headers.map((h, i) => i).filter(i => s.headers[i]);
  let html = "<tr>" + cols.map(i => `<th>${partyRepEsc(s.headers[i])}</th>`).join("") + "</tr>";
  rows.forEach(r => {
    const hold = s.holdIdx >= 0 && r[s.holdIdx];
    html += `<tr${hold ? ' style="background:rgba(230,57,70,.22);"' : ""}>` +
      cols.map(i => `<td>${partyRepEsc(r[i])}</td>`).join("") + "</tr>";
  });
  document.getElementById("partyRepTable").innerHTML = html;
  document.getElementById("partyRepWrap").classList.remove("hidden");

  partyRepCurrent = { party, vehicle, cols, headers: s.headers, holdIdx: s.holdIdx, rows, date, cards };
  statusEl.className = "ok";
  statusEl.textContent = `Showing ${rows.length} heat(s) for vehicle ${vehicle}.`;
}

function downloadPartyVehiclePdf() {
  if (!partyRepCurrent) { alert("Show a vehicle's report first."); return; }
  const p = partyRepCurrent;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  addLogoHeader(doc);
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text("TEST REPORT", pageW / 2, 52, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const meta = [`Party: ${p.party}`, `Vehicle No.: ${p.vehicle}`];
  if (p.date) meta.push(`Dated: ${p.date}`);
  meta.push(`Heats: ${p.rows.length}`);
  doc.text(meta.join("     "), pageW / 2, 68, { align: "center" });

  doc.autoTable({
    head: [p.cols.map(i => p.headers[i])],
    body: p.rows.map(r => p.cols.map(i => r[i])),
    startY: 80,
    styles: { fontSize: 8.5, cellPadding: 4, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.5 },
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold" },
    theme: "grid",
    margin: { left: 24, right: 24 },
    didParseCell: function (data) {
      if (data.section === "body" && p.holdIdx >= 0 && p.rows[data.row.index][p.holdIdx]) {
        data.cell.styles.fillColor = [255, 220, 220];
      }
    }
  });

  stampLogoOnAllPages(doc);
  const safe = s => String(s).replace(/[^A-Za-z0-9_-]+/g, "_");
  showPdfPreview(doc, `Test_Report_${safe(p.party)}_${safe(p.vehicle)}.pdf`, `Test Report - ${p.party} - ${p.vehicle}`);
}

document.getElementById("partyRepParty").addEventListener("change", e => loadPartySheet(e.target.value));
document.getElementById("partyRepSubmitBtn").addEventListener("click", showPartyVehicleReport);
document.getElementById("partyRepPdfBtn").addEventListener("click", downloadPartyVehiclePdf);

/* ---- Party Test Reports: add a new report from a photo / screenshot ---- */
// Reads the report table from the picture (grid lines -> cells, merged cells
// found from missing borders), OCRs every cell with Tesseract.js, and turns it
// into the same block layout the 'R.M Billets Reports' sheet uses (Date:-,
// V.No./Party Name:-, SIZE, 3 header rows, PO row, 2 rows per heat, pieces /
// qty merged exactly as in the picture). The report's own values are kept
// as they are; only OCR mistakes are fixed by the user in the preview.
function prtGray(img) {
  const W = img.width, H = img.height, d = img.data, g = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
  return g;
}
// Table lines = long straight dark runs (text strokes are short). Cells that
// have no border between them are joined, so merged cells come out whole.
function prtGrid(img) {
  const W = img.width, H = img.height, gv = prtGray(img), g = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = gv[i] < 110 ? 1 : 0;
  const minV = Math.max(12, H * 0.025), minH = Math.max(30, W * 0.06);
  const colRun = x => { let b = 0, c = 0; for (let y = 0; y < H; y++) { c = g[y * W + x] ? c + 1 : 0; if (c > b) b = c; } return b; };
  const rowRun = y => { let b = 0, c = 0; for (let x = 0; x < W; x++) { c = g[y * W + x] ? c + 1 : 0; if (c > b) b = c; } return b; };
  const lines = (n, f, thr) => { const out = []; let st = -1; for (let i = 0; i <= n; i++) { const on = i < n && f(i) >= thr; if (on && st < 0) st = i; if (!on && st >= 0) { out.push(Math.round((st + i - 1) / 2)); st = -1; } } return out; };
  const ys = lines(H, rowRun, minH), xs = lines(W, colRun, minV);
  if (!ys.length || ys[0] > 3) ys.unshift(0); if (H - 1 - ys[ys.length - 1] > 6) ys.push(H - 1);
  if (!xs.length || xs[0] > 3) xs.unshift(0); if (W - 1 - xs[xs.length - 1] > 6) xs.push(W - 1);
  const dk = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y * W + x];
  const hB = (y, x0, x1) => { let s = 0, n = 0; for (let x = x0 + 2; x < x1 - 1; x++) { s += (dk(x, y - 1) || dk(x, y) || dk(x, y + 1)) ? 1 : 0; n++; } return n ? s / n > 0.85 : true; };
  const vB = (x, y0, y1) => { let s = 0, n = 0; for (let y = y0 + 2; y < y1 - 1; y++) { s += (dk(x - 1, y) || dk(x, y) || dk(x + 1, y)) ? 1 : 0; n++; } return n ? s / n > 0.85 : true; };
  const R = ys.length - 1, C = xs.length - 1;
  const par = [...Array(Math.max(0, R * C)).keys()];
  const find = a => par[a] === a ? a : (par[a] = find(par[a]));
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (c < C - 1 && !vB(xs[c + 1], ys[r], ys[r + 1])) uni(r * C + c, r * C + c + 1);
    if (r < R - 1 && !hB(ys[r + 1], xs[c], xs[c + 1])) uni(r * C + c, (r + 1) * C + c);
  }
  const m = new Map();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const k = find(r * C + c), o = m.get(k) || { r0: r, c0: c, r1: r, c1: c };
    o.r0 = Math.min(o.r0, r); o.c0 = Math.min(o.c0, c); o.r1 = Math.max(o.r1, r); o.c1 = Math.max(o.c1, c); m.set(k, o);
  }
  const cells = [...m.values()].map(o => ({ ...o, x0: xs[o.c0], x1: xs[o.c1 + 1], y0: ys[o.r0], y1: ys[o.r1 + 1] }));
  return { xs, ys, R, C, cells, gv, W };
}
// ink box + background colour of one cell
function prtInk(img, gv, W, cell) {
  const p = 3, d = img.data; let bg = 0, n = 0, rr = 0, gg = 0, bb = 0;
  for (let y = cell.y0 + p; y < cell.y1 - p; y += 2) for (let x = cell.x0 + p; x < cell.x1 - p; x += 2) { const i = y * W + x; bg += gv[i]; rr += d[i * 4]; gg += d[i * 4 + 1]; bb += d[i * 4 + 2]; n++; }
  if (!n) return null;
  // background = the most common colour, not the mean (text would darken the mean)
  const hist = new Map();
  for (let y = cell.y0 + p; y < cell.y1 - p; y += 2) for (let x = cell.x0 + p; x < cell.x1 - p; x += 2) { const i = (y * W + x) * 4; const k = (d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4); hist.set(k, (hist.get(k) || 0) + 1); }
  let top = "", tc = 0; hist.forEach((v, k) => { if (v > tc) { tc = v; top = k; } });
  const [hr, hg, hb] = top.split(",").map(v => v * 16 + 8);
  const bgL = hr * 0.299 + hg * 0.587 + hb * 0.114, thr = Math.min(bgL - 60, 150);
  const fill = (hr > 232 && hg > 232 && hb > 232) ? "" : "#" + [hr, hg, hb].map(v => Math.min(255, v).toString(16).padStart(2, "0")).join("");
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, k = 0;
  for (let y = cell.y0 + p; y < cell.y1 - p; y++) for (let x = cell.x0 + p; x < cell.x1 - p; x++) if (gv[y * W + x] < thr) { k++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { fill, box: k ? { x0, y0, x1, y1, thr } : null };
}
function prtCellCanvas(src, b, scale, mode) {
  const m = 2, w = b.x1 - b.x0 + 1 + 2 * m, h = b.y1 - b.y0 + 1 + 2 * m;
  const cv = document.createElement("canvas"); cv.width = w * scale + 40; cv.height = h * scale + 40;
  const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = "high";
  cx.drawImage(src, b.x0 - m, b.y0 - m, w, h, 20, 20, w * scale, h * scale);
  const im = cx.getImageData(0, 0, cv.width, cv.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    let v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    v = mode === "thr" ? (v < 128 ? 0 : 255) : mode === "raw" ? (v < b.thr + 40 ? v : 255) : Math.max(0, Math.min(255, (v - (b.thr - 40)) * 255 / 120));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  cx.putImageData(im, 0, 0); return cv;
}
const prtClean = t => String(t || "").replace(/[|\[\]{}()€]/g, " ").replace(/\s+/g, " ").trim();
// One cell: quick read; if Tesseract is unsure, read it several ways and take
// the answer most of them agree on (marked "check" unless all agree).
async function prtReadCell(worker, src, b) {
  const s0 = Math.max(1, Math.min(6, 40 / (b.y1 - b.y0 + 1)));
  const first = await worker.recognize(prtCellCanvas(src, b, s0, "stretch"));
  const t = prtClean(first.data.text), conf = first.data.confidence;
  if (conf >= 85) return { text: t, conf, sure: true };
  const votes = new Map(), add = (x, c) => { const v = votes.get(x) || { n: 0, c: 0 }; v.n++; v.c += c; votes.set(x, v); };
  add(t, conf); let total = 1;
  for (const k of [0.75, 1, 1.25, 1.5, 2]) for (const mode of ["stretch", "raw", "thr"]) {
    const r = await worker.recognize(prtCellCanvas(src, b, s0 * k, mode));
    add(prtClean(r.data.text), r.data.confidence); total++;
  }
  let best = "", bv = null; votes.forEach((v, x) => { if (x && (!bv || v.n > bv.n || (v.n === bv.n && v.c > bv.c))) { best = x; bv = v; } });
  return { text: best, conf: bv ? bv.c / bv.n : 0, sure: !!bv && bv.n >= total - 1 };
}
async function prtOcr(src, worker, onProg) {
  const cx = src.getContext("2d"), img = cx.getImageData(0, 0, src.width, src.height);
  const grid = prtGrid(img);
  let k = 0;
  for (const cell of grid.cells) {
    cell.text = ""; cell.sure = true; cell.fill = "";
    const ink = prtInk(img, grid.gv, grid.W, cell);
    if (ink) {
      cell.fill = ink.fill;
      const b = ink.box;
      if (b) {
        const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
        if (bh <= 3 && bw <= 14) cell.text = "-";
        else if (bh > 3 || bw > 3) Object.assign(cell, await prtReadCell(worker, src, b));
      }
    }
    if (onProg) onProg(++k, grid.cells.length);
  }
  return grid;
}

// ---- picture cells -> sheet block (rows of 10 cells A..J + merges) ----
const PRT_DATE_FMT = "[$-409]d\\-mmm\\-yyyy;@";
function prtSerial(d, m, y) { if (y < 100) y += 2000; return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000); }
function prtValue(t) {
  t = String(t || "").trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) { const dec = (t.split(".")[1] || "").length; return { v: parseFloat(t), fmt: dec ? "0." + "0".repeat(dec) : "0", text: t }; }
  return { v: t, fmt: t ? "@" : "General", text: t };
}
function prtParse(grid) {
  const warn = [], cells = grid.cells.slice().sort((a, b) => a.r0 - b.r0 || a.c0 - b.c0);
  const txt = c => (c && c.text) || "";
  const rightOf = c => cells.filter(o => o.r0 === c.r0 && o.c0 > c.c1 && txt(o)).sort((a, b) => a.c0 - b.c0)[0];
  const label = re => cells.find(c => re.test(txt(c)));
  const top = {};
  const dl = label(/^date/i), vl = label(/^v\s*\.?\s*no/i), pl = label(/party\s*name/i), sl = label(/^size\b/i);
  const val = l => l ? rightOf(l) : null;
  const dC = val(dl), vC = val(vl), pC = val(pl), sC = val(sl);
  top.dateText = txt(dC); top.vehicle = txt(vC).replace(/\s+/g, " "); top.party = txt(pC); top.size = txt(sC);
  const dm = top.dateText.match(/(\d{1,2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{2,4})/);
  top.date = dm ? prtSerial(+dm[1], +dm[2], +dm[3]) : null;
  if (!dm) warn.push("Date not read - type it in the preview (dd-mm-yyyy).");
  top.sure = { date: !dC || dC.sure, vehicle: !vC || vC.sure, party: !pC || pC.sure, size: !sC || sC.sure };
  // table body: first PO row, else first heat (a left cell spanning 2 rows)
  const poC = label(/^po\b/i);
  const isHeatCell = c => c.r1 === c.r0 + 1 && c.c0 === 0 && txt(c) && !/heat|h.t\s*no/i.test(txt(c));
  const firstHeat = cells.filter(isHeatCell).sort((a, b) => a.r0 - b.r0)[0];
  if (!firstHeat) throw new Error("No heat rows found in the picture. Send a clear screenshot of the whole report table.");
  const bodyR0 = poC && poC.r0 < firstHeat.r0 ? poC.r0 : firstHeat.r0;
  const totC = cells.find(c => /^total$/i.test(txt(c)) && c.r0 > firstHeat.r0);
  const bodyR1 = (totC ? totC.r0 : grid.R) - 1;
  // sheet columns A..J = the cells of the first heat row, left to right
  const colCells = cells.filter(c => c.r0 <= firstHeat.r0 && c.r1 >= firstHeat.r0).sort((a, b) => a.x0 - b.x0);
  if (colCells.length !== 10) warn.push(`The heat row has ${colCells.length} columns (expected 10: Heat, Report, C, S, P, Mn, N, Si, Pieces, Qty). Check the preview.`);
  const bounds = colCells.slice(0, 10).map(c => [c.x0, c.x1]);
  const sheetCols = c => { const out = []; bounds.forEach(([a, b], i) => { const mid = (a + b) / 2; if (mid > c.x0 && mid < c.x1) out.push(i); }); return out; };
  // block rows: 0 Date, 1 V.No., 2 SIZE, 3-5 headers, then body
  const B0 = 6, nBody = bodyR1 - bodyR0 + 1, rows = [];
  for (let r = 0; r < B0 + nBody; r++) rows.push(Array.from({ length: 10 }, () => ({ v: "", fmt: "General", text: "", sure: true, fill: "" })));
  const put = (r, c, t, extra) => { rows[r][c] = { ...prtValue(t), sure: true, fill: "", ...(extra || {}) }; };
  const merges = [];
  put(0, 0, "Date:-");
  rows[0][1] = { v: top.date === null ? "" : top.date, fmt: PRT_DATE_FMT, text: top.dateText, sure: top.sure.date && !!dm, fill: "", isDate: true };
  merges.push([0, 1, 0, 9]);
  put(1, 0, "V.No."); put(1, 1, top.vehicle, { sure: top.sure.vehicle, fmt: "@", v: top.vehicle }); merges.push([1, 1, 1, 2]);
  put(1, 3, "Party Name:-"); merges.push([1, 3, 1, 4]); put(1, 5, top.party, { sure: top.sure.party, fmt: "@", v: top.party });
  put(2, 0, "SIZE"); put(2, 1, top.size, { sure: top.sure.size, fmt: "@", v: top.size }); merges.push([2, 1, 2, 2]);
  put(3, 0, "Heat No."); put(3, 1, "Report "); put(3, 2, "Parameters "); merges.push([3, 2, 3, 7]);
  put(3, 8, "No. Of pieces"); merges.push([3, 8, 5, 8]); put(3, 9, "QTY (MT)"); merges.push([3, 9, 5, 9]);
  ["C ", "S ", "P ", "Mn ", "N ", "Si "].forEach((h, i) => put(4, 2 + i, h));
  ["%", "%", "%", "%", "ppm", "%"].forEach((h, i) => put(5, 2 + i, h));
  for (const c of cells) {
    if (c.r0 < bodyR0 || c.r0 > bodyR1) continue;
    const sc = sheetCols(c); if (!sc.length) continue;
    const r0 = B0 + c.r0 - bodyR0, r1 = B0 + Math.min(c.r1, bodyR1) - bodyR0, c0 = sc[0], c1 = sc[sc.length - 1];
    let t = c.text || "";
    if (c0 === 0) t = t.replace(/^([A-Z]+)\s*(\d+\.\d+)\s*([A-Z]+\s*\d+)$/i, "$1 $2 $3");  // OCR spacing only
    rows[r0][c0] = { ...prtValue(t), sure: c.sure !== false, fill: c.fill || "" };
    for (let r = r0; r <= r1; r++) for (let k = c0; k <= c1; k++) if (r !== r0 || k !== c0) rows[r][k].fill = c.fill || "";
    if (r1 > r0 || c1 > c0) merges.push([r0, c0, r1, c1]);
  }
  // unusual values (kept as they are - only pointed out)
  const heats = [];
  for (let r = B0; r < rows.length; r++) {
    const h = rows[r][0].text; if (h && !/^po/i.test(h) && !/^po/i.test(rows[r][1].text)) heats.push(h);
    [2, 3, 4, 5, 7].forEach(k => { const x = rows[r][k]; if (typeof x.v === "number" && x.v > 5) x.odd = "No decimal point? Kept as in the report."; });
  }
  return { top, rows, merges, heats, warn, bodyStart: B0 };
}

// ---- app side: preview, checks, write to OneDrive, undo ----
const PRT_RAW_SHEET = "r.m billets reports";
const PRT_STAGING_LAST_RAW_ROW = 3000;   // Staging rows 2-3001 read raw rows 1-3000
const PRT_MASTER_ROWS = 1000;            // Master!A2:A1001
let prtAdd = null;      // { block, info, imgUrl }
let prtLastAdd = null;  // { sh, start, end, vehicle }
let _prtBusy = false;

async function prtRawSheet(token) {
  const wb = await getPartyReportWorkbook(token);
  const list = await graphFetch(`${wb}/worksheets?$select=name`, token);
  const ws = (list.value || []).find(s => s.name.trim().toLowerCase() === PRT_RAW_SHEET);
  if (!ws) throw new Error(`Sheet "R.M Billets Reports" not found in ${PARTY_REPORT_FILE_NAME}.`);
  const q = n => `${wb}/worksheets('${encodeURIComponent(n.replace(/'/g, "''"))}')`;
  return { wb, sh: q(ws.name), names: (list.value || []).map(s => s.name), q };
}
// last used row + earlier blocks (date, vehicle, party) for the duplicate / name checks
async function prtSheetInfo(token) {
  const s = await prtRawSheet(token);
  const ur = await graphFetch(`${s.sh}/usedRange(valuesOnly=true)?$select=address`, token, { noCache: true });
  const m = String(ur.address || "").match(/(\d+)\s*$/);
  const last = m ? parseInt(m[1], 10) : 0;
  const blocks = [];
  if (last) {
    const r = await graphFetch(`${s.sh}/range(address='A1:F${last}')?$select=values`, token, { noCache: true });
    const v = r.values || [];
    let date = null;
    for (let i = 0; i < v.length; i++) {
      const a = String(v[i][0] || "").trim();
      if (/^date\s*:?-/i.test(a)) date = v[i][1];
      if (/^v\.?\s*no/i.test(a)) {
        const pn = String(v[i][3] || "");
        const party = /party\s*name\s*:-/i.test(pn) ? String(v[i][5] || "").trim() : /party\s*name-/i.test(pn) ? pn.replace(/^.*?-/, "").trim() : "";
        blocks.push({ row: i + 1, date, vehicle: String(v[i][1] || "").trim(), party });
      }
    }
  }
  let masterUsed = null;
  try {
    const mr = await graphFetch(`${s.q("Master")}/range(address='A2:A${PRT_MASTER_ROWS + 1}')?$select=values`, token);
    masterUsed = (mr.values || []).filter(x => String(x[0] || "").trim() !== "").length;
  } catch (e) { /* Master sheet not readable - skip that check */ }
  return { ...s, last, blocks, masterUsed };
}
const prtNormVeh = v => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const prtDateText = serial => { if (typeof serial !== "number") return String(serial || ""); const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000); return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`; };

function prtRenderPreview() {
  const box = document.getElementById("prtAddPreview");
  if (!prtAdd) { box.innerHTML = ""; return; }
  const { block, info, imgUrl } = prtAdd, rows = block.rows;
  const cover = rows.map(r => r.map(() => null));
  block.merges.forEach(([r0, c0, r1, c1]) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cover[r][c] = (r === r0 && c === c0) ? { rs: r1 - r0 + 1, cs: c1 - c0 + 1 } : "x"; });
  const start = info.last ? info.last + 2 : 1, end = start + rows.length - 1;
  let h = `<div style="font-size:13px;margin:6px 0;">Will be added at rows <b>${start}–${end}</b> of R.M Billets Reports (last entry ends at row ${info.last || "-"}). ${block.heats.length} heats.</div>`;
  h += `<details style="margin:6px 0;"><summary style="cursor:pointer;font-size:13px;">🖼️ Show the picture</summary><img src="${imgUrl}" style="max-width:100%;border:1px solid #ccc;margin-top:6px;"></details>`;
  h += `<div class="tableScroll"><table class="matrixTable" id="prtAddTable" style="font-size:12px;">`;
  rows.forEach((r, ri) => {
    h += "<tr>";
    r.forEach((c, ci) => {
      const cv = cover[ri][ci]; if (cv === "x") return;
      const span = cv ? `${cv.rs > 1 ? ` rowspan="${cv.rs}"` : ""}${cv.cs > 1 ? ` colspan="${cv.cs}"` : ""}` : "";
      const fixed = ri >= 3 && ri <= 5 || (ri <= 2 && (ci === 0 || (ri === 1 && ci === 3)));
      let style = `white-space:nowrap;text-align:${ri <= 2 && ci > 0 ? "left" : "center"};`;
      if (c.fill) style += `background:${c.fill};color:#111;`;
      if (!c.sure) style += "background:#fff3b0;color:#111;";
      if (c.odd) style += "background:#ffd8a8;color:#111;";
      const title = !c.sure ? "Not read clearly - compare with the picture" : c.odd || "";
      const text = c.isDate ? (typeof c.v === "number" ? prtDateText(c.v) : c.text) : c.text;
      h += `<td${span} data-r="${ri}" data-c="${ci}"${fixed ? "" : ' contenteditable="true"'} style="${style}"${title ? ` title="${partyRepEsc(title)}"` : ""}>${partyRepEsc(text)}</td>`;
    });
    h += "</tr>";
  });
  h += "</table></div>";
  const notes = [...block.warn];
  const unsure = rows.flat().filter(c => !c.sure).length, odd = rows.flat().filter(c => c.odd).length;
  if (unsure) notes.push(`${unsure} cell(s) in yellow were not read clearly - please compare them with the picture.`);
  if (odd) notes.push(`${odd} value(s) in orange look unusual (e.g. no decimal point) - they are added as they are in the report.`);
  info.notes.forEach(n => notes.push(n));
  if (notes.length) h += `<ul style="font-size:13px;margin:8px 0;padding-left:18px;">${notes.map(n => `<li>${partyRepEsc(n)}</li>`).join("")}</ul>`;
  box.innerHTML = h;
}
// read the (possibly corrected) preview back into the block
function prtReadPreview() {
  const rows = prtAdd.block.rows;
  document.querySelectorAll("#prtAddTable td[contenteditable]").forEach(td => {
    const r = +td.dataset.r, c = +td.dataset.c, old = rows[r][c], t = td.textContent.replace(/\s+/g, " ").trim();
    if (old.isDate) {
      const m = t.match(/^(\d{1,2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{2,4})$/);
      rows[r][c] = { ...old, text: t, v: m ? prtSerial(+m[1], +m[2], +m[3]) : "" };
    } else if (old.fmt === "@" && r <= 2) rows[r][c] = { ...old, text: t, v: t };
    else rows[r][c] = { ...old, ...prtValue(t) };
  });
  return rows;
}
function prtNotes(block, info) {
  const n = [], start = info.last ? info.last + 2 : 1, end = start + block.rows.length - 1;
  if (end > PRT_STAGING_LAST_RAW_ROW) n.push(`Rows ${start}-${end} go past row ${PRT_STAGING_LAST_RAW_ROW}: the Staging sheet only reads up to raw row ${PRT_STAGING_LAST_RAW_ROW}, so this report would not show in the party sheets until Staging is extended.`);
  const mippl = block.rows.filter((r, i) => i >= block.bodyStart && /^mippl$/i.test(r[1].text)).length;
  if (info.masterUsed !== null && info.masterUsed + mippl > PRT_MASTER_ROWS) n.push(`Master holds ${PRT_MASTER_ROWS} rows (${info.masterUsed} used); ${mippl} more MIPPL rows will not all fit.`);
  const party = (block.top.party || "").trim().toLowerCase();
  if (party && !info.blocks.some(b => b.party.toLowerCase() === party)) n.push(`"${block.top.party}" is a new party name (no earlier report has exactly this name) - its party sheet will only show it if the name matches.`);
  const veh = prtNormVeh(block.top.vehicle);
  const same = info.blocks.filter(b => veh && prtNormVeh(b.vehicle) === veh);
  if (same.length) n.push(`Vehicle ${block.top.vehicle} is already in the sheet (row ${same.map(b => `${b.row}, date ${prtDateText(b.date)}`).join("; row ")}).`);
  return n;
}

async function prtReadFile(file) {
  const st = document.getElementById("prtAddStatus");
  const addBtn = document.getElementById("prtAddBtn");
  addBtn.classList.add("hidden");
  prtAdd = null; prtRenderPreview();
  if (!file) return;
  let worker = null;
  try {
    st.className = "wait"; st.textContent = "Loading OCR (first time ~10 MB)...";
    await rmLoadOcr();
    const src = await rmFileToCanvas(file);
    const token = await getToken();
    const infoP = prtSheetInfo(token);
    infoP.catch(() => {});
    worker = await Tesseract.createWorker("eng");
    await worker.setParameters({ tessedit_pageseg_mode: "7" });
    const grid = await prtOcr(src, worker, (k, n) => { st.textContent = `Reading the report... ${Math.round(k * 100 / n)}%`; });
    if (grid.R < 6 || grid.C < 6) throw new Error("Table lines not found. Send a clear, straight screenshot of the whole report table (with cell borders).");
    const block = prtParse(grid);
    st.textContent = "Checking the Excel sheet...";
    const info = await infoP;
    info.notes = prtNotes(block, info);
    prtAdd = { block, info, imgUrl: URL.createObjectURL(file) };
    prtRenderPreview();
    st.className = "ok";
    st.textContent = `Read: ${block.top.party || "?"} · ${block.top.vehicle || "?"} · ${block.top.dateText || "?"} · ${block.heats.length} heats. Check the preview, then Add to Excel.`;
    addBtn.classList.remove("hidden");
  } catch (e) {
    st.className = "err"; st.textContent = "Error: " + e.message;
  } finally {
    if (worker) try { await worker.terminate(); } catch (e) { }
  }
}

async function prtAddToExcel() {
  if (!prtAdd || _prtBusy) return;
  const st = document.getElementById("prtAddStatus");
  const rows = prtReadPreview(), top = prtAdd.block.top;
  top.vehicle = rows[1][1].text; top.party = rows[1][5].text;
  if (typeof rows[0][1].v !== "number") { st.className = "err"; st.textContent = "Date is not valid - type it as dd-mm-yyyy in the preview."; return; }
  if (!top.vehicle || !top.party) { st.className = "err"; st.textContent = "Vehicle No. and Party Name are needed."; return; }
  _prtBusy = true;
  const addBtn = document.getElementById("prtAddBtn");
  addBtn.disabled = true;
  try {
    st.className = "wait"; st.textContent = "Checking the Excel sheet...";
    const token = await getToken();
    const info = await prtSheetInfo(token);   // fresh: someone may have added rows meanwhile
    const S = info.last ? info.last + 2 : 1, E = S + rows.length - 1;
    if (E > PRT_STAGING_LAST_RAW_ROW && !confirm(`These rows (${S}-${E}) go past row ${PRT_STAGING_LAST_RAW_ROW}, which the Staging sheet does not read. Add anyway?`)) throw new Error("Not added.");
    const dup = info.blocks.find(b => prtNormVeh(b.vehicle) === prtNormVeh(top.vehicle) && b.date === rows[0][1].v);
    if (dup && !confirm(`Vehicle ${top.vehicle} dated ${prtDateText(dup.date)} is already in the sheet (row ${dup.row}). Add it again?`)) throw new Error("Not added (already in the sheet).");
    const sh = info.sh, rng = a => `${sh}/range(address='${a}')`;
    const values = rows.map(r => r.map(c => c.v === undefined ? "" : c.v));
    const numberFormat = rows.map(r => r.map(c => c.fmt || "General"));
    const whole = `A${S}:J${E}`;
    const reqs = [];
    reqs.push({ method: "POST", url: `${rng(whole)}/unmerge`, body: {} });
    reqs.push({ method: "PATCH", url: rng(whole), body: { numberFormat, values } });
    reqs.push({ method: "PATCH", url: `${rng(whole)}/format`, body: { horizontalAlignment: "Center", verticalAlignment: "Center" } });
    reqs.push({ method: "PATCH", url: `${rng(whole)}/format/font`, body: { name: "Calibri", size: 11, bold: true } });
    reqs.push({ method: "PATCH", url: `${rng(`B${S}:J${S + 1}`)}/format`, body: { horizontalAlignment: "Left" } });
    reqs.push({ method: "PATCH", url: `${rng(`D${S + 1}`)}/format`, body: { horizontalAlignment: "Right" } });
    ["EdgeTop", "EdgeBottom", "EdgeLeft", "EdgeRight", "InsideHorizontal", "InsideVertical"].forEach(side =>
      reqs.push({ method: "PATCH", url: `${rng(whole)}/format/borders('${side}')`, body: { style: "Continuous", weight: "Thin", color: "#000000" } }));
    // cell colours from the picture (e.g. the blue PO row), same-colour runs in one write
    rows.forEach((r, ri) => {
      let c = 0;
      while (c < 10) {
        const f = r[c].fill; if (!f) { c++; continue; }
        let k = c; while (k + 1 < 10 && r[k + 1].fill === f) k++;
        reqs.push({ method: "PATCH", url: `${rng(`${colLetter(c)}${S + ri}:${colLetter(k)}${S + ri}`)}/format/fill`, body: { color: f } });
        c = k + 1;
      }
    });
    prtAdd.block.merges.forEach(([r0, c0, r1, c1]) =>
      reqs.push({ method: "POST", url: `${rng(`${colLetter(c0)}${S + r0}:${colLetter(c1)}${S + r1}`)}/merge`, body: { across: false } }));
    st.textContent = `Adding at rows ${S}-${E}...`;
    const bad = await graphBatchWrite(token, reqs, (d, n) => { st.textContent = `Adding at rows ${S}-${E}... ${d}/${n}`; });
    // read back the values to be sure they are there
    const back = await graphFetch(`${rng(`A${S}:B${S + 1}`)}?$select=values`, token, { noCache: true });
    if (!back.values || String(back.values[0][0]).trim() !== "Date:-" || prtNormVeh(back.values[1][1]) !== prtNormVeh(top.vehicle)) throw new Error("The rows could not be confirmed in the sheet - please open the Excel and check.");
    prtLastAdd = { sh, start: S, end: E, vehicle: top.vehicle };
    document.getElementById("prtUndoBtn").classList.remove("hidden");
    // party list / party sheets now have new data
    const sel = document.getElementById("partyRepParty"); sel.dataset.loaded = ""; partyRepSheet = null;
    st.className = bad.length ? "err" : "ok";
    st.textContent = `✅ Added ${top.party} · ${top.vehicle} at rows ${S}-${E} of R.M Billets Reports.` + (bad.length ? ` Some formatting did not apply: ${bad.slice(0, 3).join("; ")}` : "");
    addBtn.classList.add("hidden");
    prtAdd = null; prtRenderPreview();
    document.getElementById("prtAddFile").value = "";
    loadPartyReportList();
  } catch (e) {
    st.className = "err"; st.textContent = "Error: " + e.message;
  } finally {
    _prtBusy = false; addBtn.disabled = false;
  }
}

async function prtUndo() {
  if (!prtLastAdd || _prtBusy) return;
  const { sh, start, end, vehicle } = prtLastAdd;
  if (!confirm(`Remove rows ${start}-${end} (${vehicle}) that were just added to R.M Billets Reports?`)) return;
  const st = document.getElementById("prtAddStatus");
  _prtBusy = true;
  try {
    st.className = "wait"; st.textContent = "Removing...";
    const token = await getToken();
    const rng = a => `${sh}/range(address='${a}')`;
    const back = await graphFetch(`${rng(`A${start}:B${start + 1}`)}?$select=values`, token, { noCache: true });
    if (!back.values || String(back.values[0][0]).trim() !== "Date:-" || prtNormVeh(back.values[1][1]) !== prtNormVeh(vehicle)) throw new Error(`Rows ${start}-${end} no longer hold that report - nothing removed.`);
    await graphFetch(`${rng(`A${start}:J${end}`)}/unmerge`, token, { method: "POST", body: "{}" });
    await graphFetch(`${rng(`A${start}:J${end}`)}/clear`, token, { method: "POST", body: JSON.stringify({ applyTo: "All" }) });
    prtLastAdd = null;
    document.getElementById("prtUndoBtn").classList.add("hidden");
    const sel = document.getElementById("partyRepParty"); sel.dataset.loaded = ""; partyRepSheet = null;
    st.className = "ok"; st.textContent = `Removed rows ${start}-${end}.`;
    loadPartyReportList();
  } catch (e) {
    st.className = "err"; st.textContent = "Error: " + e.message;
  } finally { _prtBusy = false; }
}
document.getElementById("prtAddFile").addEventListener("change", e => prtReadFile(e.target.files[0]));
document.getElementById("prtAddBtn").addEventListener("click", prtAddToExcel);
document.getElementById("prtUndoBtn").addEventListener("click", prtUndo);

async function loadDashboard() {
  const statusEl = document.getElementById("status");
  const sheetName = xlSheetFor(document.getElementById("sheetName").value.trim(), xlCruPicked("dashCru"));
  const dateVal = document.getElementById("dashDate").value;

  if (!dateVal) {
    statusEl.className = "err";
    statusEl.textContent = "Please select a date first.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Locating the file for this date...";
  document.getElementById("dashStats").classList.add("hidden");

  try {
    const token = await getToken();
    const [y, m] = dateVal.split("-").map(Number);
    const filePath = await detectFilePathForMonth(token, y, m - 1);

    if (!filePath) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't find the file for ${MONTH_ABBR[m - 1]} ${y}.`;
      return;
    }

    const wb = await resolveWorkbook(token, filePath);
    const block = await findProdBlockForDate(wb, sheetName, dateVal, token);

    if (!block) {
      statusEl.className = "err";
      statusEl.textContent = "No data found for this date.";
      return;
    }

    const s = await getDaySummary(wb, sheetName, block.titleRow, block.dataStart, token);
    const hotOutWeights = await getMonthlyProdHotOut(wb, dateVal, token);
    const consumption = await getConsumptionForDate(wb, dateVal, token);
    const yieldPct = consumption > 0 ? (s.totalProd / consumption * 100) : 0;
    const num = v => v.toFixed(3);

    document.getElementById("dashHeats").textContent = ""; animateNumber("dashHeats", s.heatCount, 0);
    document.getElementById("dashTotalProd").textContent = ""; animateNumber("dashTotalProd", s.totalProd, 3);
    document.getElementById("dashHotCharging").textContent = ""; animateNumber("dashHotCharging", s.hotCharging, 3);
    document.getElementById("dashBypass").textContent = ""; animateNumber("dashBypass", s.bypass, 3);
    document.getElementById("dashRhf").textContent = ""; animateNumber("dashRhf", s.rhf, 3);
    document.getElementById("dashHotOutNet").textContent = ""; animateNumber("dashHotOutNet", hotOutWeights.net, 3);
    document.getElementById("dashHotOutCalc").textContent = hotOutWeights.calc === null ? "N/A" : ""; if (hotOutWeights.calc !== null) animateNumber("dashHotOutCalc", hotOutWeights.calc, 3);
    document.getElementById("dashConsumption").textContent = ""; animateNumber("dashConsumption", consumption, 3);
    document.getElementById("dashYield").textContent = consumption > 0 ? "" : "N/A"; if (consumption > 0) animateNumber("dashYield", yieldPct, 2, "%");

    document.getElementById("dashStats").classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = `Dashboard loaded for ${dateVal} (from ${filePath}).`;

    generateInsightsNarrative(wb, sheetName, token); // background, non-blocking

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

// Month insight under the Daily Summary. Basis (shown in the text): only COMPLETE days with production -
// real dates in column A (Excel date numbers, not the heat-count cell under each block), real heat rows only
// (same rule as the Daily Summary, MIN/MAX rows excluded), today (still running), future and blank (0 MT)
// blocks are left out. Shows: average per heat, heats per day, average per day, and - if that rate continues
// for the days left (today to month end) - the month's expected total.
async function generateInsightsNarrative(wb, sheetName, token) {
  const box = document.getElementById("insightsNarrative");
  try {
    const data = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:AB2000')?$select=values`, token);
    const values = data.values, today = todayISO();
    const isDate = v => typeof v === "number" && v > 40000;
    const dayTotals = {}, dayHeats = {};   // { iso: MT }, { iso: heats }
    for (let i = 0; i < values.length; i++) {
      if (!isDate(values[i][0])) continue;
      const iso = excelSerialToISODate(values[i][0]);
      if (iso >= today) continue;                                     // today is not finished; future blocks are empty
      let total = 0, heats = 0;
      for (let r = i; r < Math.min(values.length, i + 12); r++) {     // the 12 heat rows of the block
        if (r > i && isDate(values[r][0])) break;                       // next day's block starts
        if (/^(MIN|MAX)$/i.test(String(values[r][1] || "").trim())) break;
        if (!isRealHeatRow(values[r])) continue;
        heats++; if (typeof values[r][27] === "number") total += values[r][27];   // AB = Total Prod
      }
      if (heats > 0 && total > 0) { dayTotals[iso] = (dayTotals[iso] || 0) + total; dayHeats[iso] = (dayHeats[iso] || 0) + heats; }
    }
    const days = Object.keys(dayTotals).sort();
    if (days.length < 1) { box.classList.add("hidden"); return; }
    const f0 = v => Math.round(v).toLocaleString("en-IN");
    const dm = iso => { const [, m, d] = iso.split("-"); return `${+d}.${+m}`; };
    const totalMT = days.reduce((a, d) => a + dayTotals[d], 0), totalHeats = days.reduce((a, d) => a + dayHeats[d], 0);
    const perDay = totalMT / days.length, perHeat = totalHeats ? totalMT / totalHeats : 0, heatsPerDay = totalHeats / days.length;
    const [y, m] = days[days.length - 1].split("-").map(Number);
    const monthName = new Date(y, m - 1, 1).toLocaleString("en-GB", { month: "long" });
    const daysInMonth = new Date(y, m, 0).getDate();
    const [ty, tm, td] = today.split("-").map(Number);
    // days still to come in this month: from today (not finished yet) to the month end
    const left = (ty === y && tm === m) ? daysInMonth - td + 1 : (ty < y || (ty === y && tm < m)) ? daysInMonth : 0;

    let txt = `💡 ${dm(days[0])} – ${dm(days[days.length - 1])} (${days.length} complete day${days.length > 1 ? "s" : ""}; today and blank days not counted): ` +
      `${totalHeats} heats, ${f0(totalMT)} MT → average ${perHeat.toFixed(2)} MT per heat, ${heatsPerDay.toFixed(1)} heats per day, ${f0(perDay)} MT per day.`;
    if (left > 0) txt += ` If this continues for the ${left} day${left > 1 ? "s" : ""} left (${td}.${m} – ${daysInMonth}.${m}), ${monthName} will end at about ${f0(totalMT + perDay * left)} MT.`;
    else txt += ` ${monthName} total: ${f0(totalMT)} MT.`;
    box.textContent = txt;
    box.classList.remove("hidden");
  } catch (e) {
    box.classList.add("hidden"); // insights are a bonus - fail quietly
  }
}

document.getElementById("dashLoadBtn").addEventListener("click", loadDashboard);

/* ===================== MONTHLY DASHBOARD ===================== */
async function loadMonthlyDashboard() {
  const statusEl = document.getElementById("status");
  const sheetName = xlSheetFor(document.getElementById("sheetName").value.trim(), xlCruPicked("dashMonthCru"));
  const fromDate = document.getElementById("dashFromDate").value;
  const toDate = document.getElementById("dashToDate").value;

  if (!fromDate || !toDate) {
    statusEl.className = "err";
    statusEl.textContent = "Please select both From Date and To Date.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Locating the file(s) for this date range...";
  document.getElementById("dashMonthStats").classList.add("hidden");

  try {
    const token = await getToken();
    const { results: wbList, missing } = await getWorkbooksForRange(token, fromDate, toDate);

    if (wbList.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't find a file for any month in this range (${missing.join(", ")}).`;
      return;
    }

    const totals = { heatCount: 0, totalProd: 0, hotCharging: 0, bypass: 0, rhf: 0, hotOutNet: 0, hotOutCalc: 0, consumption: 0 };
    let dayCount = 0;

    // Every file's sheets are requested together; the loop below gets them from memory.
    wbList.forEach(sub => graphPrefetch([
      `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:AH2000')?$select=values`,
      `${sub.wb}/worksheets('${encodeURIComponent(String(CONSUMPTION_SHEET_NAME).replace(/'/g, "''"))}')/range(address='A1:AR2000')?$select=values`,
      `${sub.wb}/worksheets('Monthly Prod')/range(address='A1:G2000')?$select=values,text`], token));
    for (let wIdx = 0; wIdx < wbList.length; wIdx++) {
      const sub = wbList[wIdx];
      statusEl.textContent = `Loading period summary... (${wIdx + 1}/${wbList.length} file(s))`;

      // Fetch the WHOLE month's Prod. sheet (A:AH) in one call, instead of
      // 2 small calls per matching date - this is the main speed fix.
      const prodData = await graphFetch(
        `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:AH2000')?$select=values`,
        token
      );
      const values = prodData.values;
      const blocksThisMonth = [];
      for (let i = 0; i < values.length; i++) {
        const v = values[i][0];
        if (typeof v === "number") {
          const iso = excelSerialToISODate(v);
          if (iso >= sub.fromDate && iso <= sub.toDate) {
            blocksThisMonth.push({ dataIdx: i, iso }); // 0-based index into `values`
          }
        }
      }

      const isPreAugust = sub.fromDate.slice(0, 7) < "2026-08";
      let monthConsumption = 0;
      let consumptionByDate = {};
      let hotOutByDate = {}; // { iso: { net, calc } }

      if (isPreAugust) {
        // No daily data exists yet - use FC Report's whole-month "Issue"
        // total (summed across every raw material the Consumption message
        // tracks) instead of a per-day figure that doesn't exist.
        const fc = await getFcData(sub.wb, token);
        // Only the 9 items the daily Consumption message actually tracks
        // (Lumps, Fines, Pellets, Steel Melting Scrap, Mag Material, MS
        // Scrap - Rolling Mill, MS Scrap, CI Mix Scrap, Pig Iron) count
        // toward Total Consumption - NOT every item with a consumeCol (e.g.
        // Raw Slag has its own separate consumeCol="F" for its own daily
        // tracking).
        const CONSUMPTION_MESSAGE_ITEMS = ["Lumps", "Fines", "Pellets", "Steel Melting Scrap", "Mag Material", "MS Scrap - Rolling Mill", "MS Scrap", "CI Mix Scrap", "Pig Iron", "Over Size Mag"];
        STOCK_ITEMS.filter(item => CONSUMPTION_MESSAGE_ITEMS.includes(item.name)).forEach(item => {
          monthConsumption += Math.abs(fc.colValues[item.name]["G"] || 0);
        });
      } else {
        // Fetch the whole month's RM Report (A + AI:AQ) in one call, instead
        // of up to 2 small calls per matching date.
        try {
          const rmData = await graphFetch(
            `${sub.wb}/worksheets('${encodeURIComponent(String(CONSUMPTION_SHEET_NAME).replace(/'/g, "''"))}')/range(address='A1:AR2000')?$select=values`,
            token
          );
          rmData.values.forEach(row => {
            const dateVal = row[0];
            if (typeof dateVal !== "number") return;
            const iso = excelSerialToISODate(dateVal);
            const sum = row.slice(34, 44).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0); // AI(idx34) to AR(idx43)
            consumptionByDate[iso] = sum;
          });
        } catch (e) { /* RM Report sheet missing - consumption stays 0 for this month */ }
      }

      // "Monthly Prod" sheet tracks Hot Out in two columns (F = Net Weight,
      // G = Calculated Weight) for every month, before and after August
      // alike. Fetch the whole month at once and build a date lookup.
      try {
        const mpData = await graphFetch(
          `${sub.wb}/worksheets('Monthly Prod')/range(address='A1:G2000')?$select=values,text`,
          token
        );
        mpData.values.forEach((row, idx) => {
          const iso = anyDateToISO(row[0], mpData.text[idx][0]);
          if (!iso) return;
          hotOutByDate[iso] = {
            net: typeof row[5] === "number" ? row[5] : 0,
            calc: typeof row[6] === "number" ? row[6] : 0
          };
        });
      } catch (e) { /* Monthly Prod sheet missing - Hot Out stays 0 for this month */ }

      for (const block of blocksThisMonth) {
        const titleRow = block.dataIdx - 2; // dataIdx (0-based) corresponds to Excel row (dataIdx+1) = titleRow(1-based)+3, so titleRow = dataIdx-2
        const dataStart = block.dataIdx + 1; // 1-based Excel row of first heat row

        const hb = heatsAt(values, block.dataIdx);
        const heatRows = values.slice(block.dataIdx, block.dataIdx + hb);
        const heatCount = heatRows.filter(isRealHeatRow).length;

        const maxRow = values[block.dataIdx + hb + 1];   // MAX row (130)
        const totalRow = values[block.dataIdx + hb + 2]; // Total row (160)

        const n = v => (typeof v === "number" ? v : 0);
        totals.heatCount += heatCount;
        totals.totalProd += n(totalRow[27]);
        totals.hotCharging += n(totalRow[20]);
        totals.bypass += n(totalRow[26]);
        totals.rhf += n(maxRow[14]) + n(totalRow[14]);
        totals.hotOutNet += (hotOutByDate[block.iso] || {}).net || 0;
        totals.hotOutCalc += (hotOutByDate[block.iso] || {}).calc || 0;
        if (!isPreAugust) {
          totals.consumption += consumptionByDate[block.iso] || 0;
        }
        dayCount++;
      }

      if (isPreAugust) totals.consumption += monthConsumption;
    }

    if (dayCount === 0) {
      statusEl.className = "err";
      statusEl.textContent = "No dates in this range were found in the available file(s).";
      return;
    }

    const yieldPct = totals.consumption > 0 ? (totals.totalProd / totals.consumption * 100) : 0;

    const num = v => v.toFixed(3);
    document.getElementById("dashMonthDays").textContent = dayCount;
    document.getElementById("dashMonthHeats").textContent = totals.heatCount;
    document.getElementById("dashMonthTotalProd").textContent = num(totals.totalProd);
    document.getElementById("dashMonthHotCharging").textContent = num(totals.hotCharging);
    document.getElementById("dashMonthBypass").textContent = num(totals.bypass);
    document.getElementById("dashMonthRhf").textContent = num(totals.rhf);
    document.getElementById("dashMonthHotOutNet").textContent = num(totals.hotOutNet);
    document.getElementById("dashMonthHotOutCalc").textContent = num(totals.hotOutCalc);
    document.getElementById("dashMonthConsumption").textContent = num(totals.consumption);
    document.getElementById("dashMonthYield").textContent = totals.consumption > 0 ? yieldPct.toFixed(2) + "%" : "N/A";

    document.getElementById("dashMonthStats").classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = `Period summary loaded for ${fromDate} to ${toDate} (${dayCount} days across ${wbList.length} file(s)).` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("dashMonthLoadBtn").addEventListener("click", loadMonthlyDashboard);

/* ===================== RAW MATERIAL DASHBOARD ===================== */
let rmDashPieChartInstance = null;

let rmDashData = null;

async function loadRawMaterialDashboard() {
  const statusEl = document.getElementById("status");
  const sheetName = document.getElementById("rmDashSheetName").value.trim();
  const fromDate = document.getElementById("rmDashFromDate").value;
  const toDate = document.getElementById("rmDashToDate").value;

  if (!fromDate || !toDate) {
    statusEl.className = "err";
    statusEl.textContent = "Please select both From Date and To Date.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Locating the file(s) for this date range...";
  document.getElementById("rmDashStats").classList.add("hidden");

  try {
    const token = await getToken();
    const { results: wbList, missing } = await getWorkbooksForRange(token, fromDate, toDate);

    if (wbList.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't find a file for any month in this range (${missing.join(", ")}).`;
      return;
    }

    const totals = [0, 0, 0, 0, 0, 0, 0];
    let dayCount = 0;

    for (const sub of wbList) {
      const data = await graphFetch(
        `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='Y2:AF32')?$select=values`,
        token
      );
      for (const row of data.values) {
        const dateVal = row[0];
        if (typeof dateVal !== "number") continue;
        const iso = excelSerialToISODate(dateVal);
        if (iso < sub.fromDate || iso > sub.toDate) continue;
        dayCount++;
        for (let c = 0; c < 7; c++) {
          const v = row[c + 1];
          if (typeof v === "number") totals[c] += v;
        }
      }
    }

    if (dayCount === 0) {
      statusEl.className = "err";
      statusEl.textContent = "No dates in this range were found in the available file(s).";
      return;
    }

    rmDashData = { fromDate, toDate, totals };

    const RM_COLORS = ["#1f3864", "#9dc3e6", "#c9a227", "#e8d38a", "#7a1fa2", "#0b6e99", "#a3271c"];
    const RM_ICONS = ["🔩", "⚙️", "🔧", "🏗️", "🧱", "♻️", "💨"];

    const table = document.getElementById("rmDashTable");
    table.innerHTML = `<tr><td colspan="2" style="background:${RM_COLORS[0]};color:#fff;font-weight:800;text-align:left;padding:10px 12px;">SCRAP BREAKDOWN</td></tr><tr><th>Item</th><th>Total (MT)</th></tr>`;
    RM_CATEGORIES.forEach((cat, i) => {
      table.innerHTML += `<tr><td>${RM_ICONS[i]} ${cat}</td><td>${totals[i].toFixed(3)}</td></tr>`;
    });

    const ctx = document.getElementById("rmDashPieChart").getContext("2d");
    if (rmDashPieChartInstance) rmDashPieChartInstance.destroy();
    rmDashPieChartInstance = new Chart(ctx, {
      type: "pie",
      data: {
        labels: RM_CATEGORIES,
        datasets: [{ data: totals, backgroundColor: RM_COLORS }]
      },
      options: {
        responsive: true,
        devicePixelRatio: 2,
        plugins: { legend: { position: "bottom" } }
      }
    });

    document.getElementById("rmDashStats").classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = `R.M Description loaded for ${fromDate} to ${toDate} (${dayCount} day(s) across ${wbList.length} file(s)).` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("rmDashLoadBtn").addEventListener("click", loadRawMaterialDashboard);

document.getElementById("rmDashPdfBtn").addEventListener("click", () => {
  if (!rmDashData) { alert("Load R.M Description first."); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  addLogoHeader(doc);
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(31, 56, 100);
  doc.text("R.M Description", pageW / 2, 40, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text(`Period: ${rmDashData.fromDate} to ${rmDashData.toDate}`, pageW / 2, 58, { align: "center" });

  const RM_COLORS = [[31, 56, 100], [157, 195, 230], [201, 162, 39], [232, 211, 138], [122, 31, 162], [11, 110, 153], [163, 39, 28]];

  const body = [
    [{ content: "SCRAP BREAKDOWN", colSpan: 2, styles: { fillColor: RM_COLORS[0], textColor: [255, 255, 255], fontStyle: "bold", halign: "left", fontSize: 10.5 } }]
  ];
  RM_CATEGORIES.forEach((cat, i) => {
    body.push([
      { content: cat, styles: { textColor: RM_COLORS[i], fontStyle: "bold", halign: "left", cellPadding: { left: 18, top: 7, bottom: 7, right: 7 } } },
      rmDashData.totals[i].toFixed(3)
    ]);
  });

  doc.autoTable({
    head: [["Item", "Total (MT)"]],
    body: body,
    startY: 75,
    styles: { fontSize: 10, cellPadding: 7, halign: "center", valign: "middle" },
    headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 248, 253] },
    margin: { left: 30, right: 30 },
    didDrawCell: function (data) {
      if (data.section === "body" && data.column.index === 0 && data.row.raw.length === 2) {
        const rgb = data.cell.styles.textColor;
        if (Array.isArray(rgb)) {
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.circle(data.cell.x + 9, data.cell.y + data.cell.height / 2, 3, "F");
        }
      }
    }
  });

  stampLogoOnAllPages(doc);
  showPdfPreview(doc, `RM_Description_${rmDashData.fromDate}_to_${rmDashData.toDate}.pdf`, "R.M Description");
});

/* ===================== RAW MATERIAL STOCK REPORT ===================== */
// Canonical raw material list, mapping each item to:
// - fcPattern: regex to match FC Report's item-name column (Fines/Lumps can
//   appear as more than one row there - all matching rows get summed)
// - rmCols: RM Report incoming column letter(s), N:W (Fines/Lumps can appear
//   as two separate columns there too - both get summed)
// - consumeCol: RM Report consumption column letter, AI:AO (from the
//   WhatsApp Consumption message feature), or null if not tracked there
// - fcIncomingCol: for items whose incoming isn't in RM Report at all, but
//   is available as a monthly "Received" total on FC Report itself (column
//   E) - summed across every month the selected range touches
const STOCK_ITEMS = [
  { name: "Lumps", category: "RAW MATERIAL", fcPattern: /lumps/i, rmCols: ["W"], consumeCol: "AI" }, // incoming = RM Report col W only
  { name: "Fines", category: "RAW MATERIAL", fcPattern: /^(?!.*slag).*fines/i, rmCols: ["T", "V"], consumeCol: "AJ" },
  { name: "Pellets", category: "RAW MATERIAL", fcPattern: /pellets/i, rmCols: ["S"], consumeCol: "AK" },
  { name: "Steel Melting Scrap", category: "RAW MATERIAL", fcPattern: /steel melting scrap/i, rmCols: ["N"], consumeCol: "AL" },
  { name: "Pig Iron", category: "RAW MATERIAL", fcPattern: /^pig iron$/i, rmCols: [], consumeCol: "AQ", fcIncomingCol: "E" },
  { name: "CI Mix Scrap", category: "RAW MATERIAL", fcPattern: /ci mix scrap/i, rmCols: ["Q"], consumeCol: "AP" },
  { name: "Silico Manganeese", category: "RAW MATERIAL", fcPattern: /silico\s*mangan/i, rmCols: [], consumeCol: null, fcIncomingCol: "E", fcConsumeCol: "G" },
  { name: "Over Size Sponge", category: "RAW MATERIAL", fcPattern: /over\s*size\s*sponge/i, rmCols: [], consumeCol: null, fcIncomingCol: "E", fcConsumeCol: "G" },
  { name: "MS Scrap", category: "INTERNAL SCRAP", fcPattern: /^ms scrap$/i, rmCols: ["O"], consumeCol: "AO" },
  { name: "MS Scrap - Rolling Mill", category: "INTERNAL SCRAP", fcPattern: /rolling mill/i, rmCols: ["P"], consumeCol: "AN" },
  { name: "Mag Material", category: "SEMIFINISHED GOODS", fcPattern: /mag material/i, rmCols: ["G"], consumeCol: "AM" },
  { name: "Mill Scale-SMS", category: "BY PRODUCTS", fcPattern: /mill scale/i, rmCols: [], consumeCol: null, fcIncomingCol: "E", fcConsumeCol: "G" },
  { name: "Bag Filter Dust", category: "BY PRODUCTS", fcPattern: /bag\s*filter\s*dust/i, rmCols: [], consumeCol: null, fcIncomingCol: "E", fcConsumeCol: "G" },
  { name: "Raw Slag", category: "BY PRODUCTS", fcPattern: /^raw\s*slag/i, rmCols: ["C"], consumeCol: "F" },
  { name: "Slag Metal Fines, Size: 1mm to 3mm", category: "BY PRODUCTS", fcPattern: /slag\s*metal\s*fines/i, rmCols: [], consumeCol: null, fcIncomingCol: "E", fcConsumeCol: "G" },
  { name: "Slag Waste", category: "BY PRODUCTS", fcPattern: /slag\s*waste/i, rmCols: [], consumeCol: null, fcIncomingCol: "E", fcConsumeCol: "G" },
  { name: "Slag Jaam", category: "BY PRODUCTS", fcPattern: /slag[e]?\s*jaam/i, rmCols: [], consumeCol: null, fcIncomingCol: "E", fcConsumeCol: "G" }
];

const CATEGORY_ORDER = ["RAW MATERIAL", "INTERNAL SCRAP", "SEMIFINISHED GOODS", "BY PRODUCTS", "FINISHED PRODUCT"];
const CATEGORY_COLORS = {
  "RAW MATERIAL": "#c9a227",
  "INTERNAL SCRAP": "#7a1fa2",
  "SEMIFINISHED GOODS": "#0b6e99",
  "BY PRODUCTS": "#a3271c",
  "FINISHED PRODUCT": "#1e6b3c"
};
const ITEM_ICONS = {
  "Lumps": "🪨", "Fines": "🟤", "Pellets": "⚪", "Steel Melting Scrap": "🔩",
  "Pig Iron": "⬛", "CI Mix Scrap": "🔧",
  "MS Scrap - Rolling Mill": "🛠️", "MS Scrap": "⚙️",
  "Mill Scale-SMS": "🔥", "Mag Material": "🧱",
  "Silico Manganeese": "🔶", "Over Size Sponge": "🟫",
  "Bag Filter Dust": "💨", "Raw Slag": "🪵",
  "Slag Metal Fines, Size: 1mm to 3mm": "✨", "Slag Waste": "🗑️", "Slag Jaam": "🧿"
};
const getIcon = name => name.startsWith("MS Billet") ? "🧊" : (ITEM_ICONS[name] || "📦");

function colLetterToIndex(letter) {
  let idx = 0;
  for (let i = 0; i < letter.length; i++) idx = idx * 26 + (letter.charCodeAt(i) - 64);
  return idx - 1; // 0-based
}

async function getFcData(wb, token) {
  const openings = {};
  const colValues = {}; // colValues[itemName] = { D, E, F, G } summed values
  STOCK_ITEMS.forEach(item => { openings[item.name] = 0; colValues[item.name] = { D: 0, E: 0, F: 0, G: 0, P: 0 }; });
  try {
    // B:P - column P = Inter-Division Transfer (out), subtracted from stock
    const data = await graphFetch(`${wb}/worksheets('FC Report')/range(address='B1:P100')?$select=values`, token);
    data.values.forEach(row => {
      const label = (row[0] || "").toString().trim();
      if (!label) return;
      // relative to B:G -> B=0,C=1,D=2,E=3,F=4,G=5
      const cols = { D: row[2], E: row[3], F: row[4], G: row[5], P: row[14] };
      STOCK_ITEMS.forEach(item => {
        if (item.fcPattern && item.fcPattern.test(label)) {
          openings[item.name] += (typeof cols.D === "number" ? cols.D : 0);
          ["D", "E", "F", "G", "P"].forEach(letter => {
            const v = cols[letter];
            if (typeof v === "number") colValues[item.name][letter] += v;
          });
        }
      });
    });
  } catch (e) { /* FC Report sheet missing from this workbook - stays 0 */ }
  return { openings, colValues };
}

async function getRmIncomingAndConsumption(wb, fromDate, toDate, token) {
  const incoming = {}, consumption = {};
  STOCK_ITEMS.forEach(item => { incoming[item.name] = 0; consumption[item.name] = 0; });
  // Reads a cell as a number whether it's a genuine Excel number or a
  // number typed/stored as plain text (e.g. entered via a form that writes
  // strings, or a copied/dragged cell that lost its number formatting) -
  // a strict "must already be typeof number" check was silently treating
  // every text-stored number as 0, which is why only the days whose cells
  // happened to be real numbers (often just the first day of a range) were
  // ever counted.
  const numOrParsed = (v, t) => {
    if (typeof v === "number") return v;
    const s = (t !== undefined ? t : v);
    const n = parseFloat((s || "").toString().replace(/,/g, ""));
    return isNaN(n) ? null : n;
  };
  try {
    const data = await graphFetch(`${wb}/worksheets('RM Report')/range(address='A1:AQ2000')?$select=values,text`, token);
    data.values.forEach((row, i) => {
      const dateVal = row[0]; // column A - always reliably filled, unlike Y which mirrors A via a formula that may not be dragged down for newer months
      // Some rows have this stored as a genuine Excel date serial (a
      // number), others as plain text (e.g. "1.9.2026") - a strict
      // "must be a number" check silently skipped every text-dated row,
      // which is why only the first day of a range was ever being summed.
      const iso = anyDateToISO(dateVal, data.text[i][0]);
      if (!iso || iso < fromDate || iso > toDate) return;
      const rowText = data.text[i];

      STOCK_ITEMS.forEach(item => {
        item.rmCols.forEach(col => {
          const idx = colLetterToIndex(col);
          const v = numOrParsed(row[idx], rowText[idx]);
          if (v !== null) incoming[item.name] += v;
        });
        if (item.consumeCol) {
          const idx = colLetterToIndex(item.consumeCol);
          const v = numOrParsed(row[idx], rowText[idx]);
          if (v !== null) consumption[item.name] += v;
        }
      });
    });
  } catch (e) { /* RM Report sheet missing from this workbook - stays 0 */ }
  return { incoming, consumption };
}

let stockReportData = null;

// Reads the "Daily Stock" sheet: it uses repeating 18-row date-blocks
// (title row holds the date, followed by "SIZE"/"WEIGHT" headers, then one
// row per billet size with its C/E/F/M/Q values - matching the same block
// pattern as the Prod. sheet). For every block whose date falls in range,
// sums C (production), E+F-M (consumption), and Q (stock) PER SIZE
// category (e.g. "160 X 4"). Returns each size's LAST matching block's Q
// value as its current stock (already authoritative, not re-derived).
async function getBilletStockBySize(wb, fromDate, toDate, token) {
  const sizes = {}; // { "160 X 4": { production, consumption, latestQty, latestDate, openingQty } }
  try {
    const data = await graphFetch(`${wb}/worksheets('Daily Stock')/range(address='A1:Q2000')?$select=values,text`, token);
    const rows = data.values;
    const texts = data.text;

    // Parses a "DD/MM/YYYY" or "DD-MM-YYYY" text date into ISO format.
    // Carried-over reference blocks (e.g. last month's closing pasted at
    // the top of this month's sheet) are sometimes typed in manually as
    // text instead of a real Excel date-serial, so title rows need to be
    // detected both ways.
    function textToISODate(t) {
      const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec((t || "").trim());
      if (!m) return null;
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      const day = parseInt(m[1], 10), month = parseInt(m[2], 10);
      const chk = new Date(year, month - 1, day);
      if (month < 1 || month > 12 || day < 1 || chk.getMonth() !== month - 1 || chk.getDate() !== day) return null;   // e.g. 31/13/2026 or 31/04/2026
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    const titleRows = []; // { rowIdx, iso }
    for (let i = 0; i < rows.length; i++) {
      if (typeof rows[i][0] === "number") {
        titleRows.push({ rowIdx: i, iso: excelSerialToISODate(rows[i][0]) });
      } else {
        const iso = textToISODate(texts[i][0]);
        if (iso) titleRows.push({ rowIdx: i, iso });
      }
    }

    // The true Opening for each size = the Q value from the closest block
    // BEFORE the range starts (i.e. "yesterday's Closing"), not a
    // back-calculated figure - find that block first.
    let priorBlockIdx = -1, priorBlockDate = null;
    for (let t = 0; t < titleRows.length; t++) {
      const iso = titleRows[t].iso;
      if (iso < fromDate && (!priorBlockDate || iso >= priorBlockDate)) {
        priorBlockDate = iso;
        priorBlockIdx = t;
      }
    }
    if (priorBlockIdx !== -1) {
      const startIdx = titleRows[priorBlockIdx].rowIdx;
      const endIdx = (priorBlockIdx + 1 < titleRows.length) ? titleRows[priorBlockIdx + 1].rowIdx : rows.length;
      for (let r = startIdx; r < endIdx; r++) {
        const row = rows[r];
        const sizeName = (row[0] || "").toString().trim();
        if (!sizeName || sizeName.toUpperCase() === "SIZE") continue;
        const q = row[16];
        if (!sizes[sizeName]) sizes[sizeName] = { production: 0, consumption: 0, latestQty: null, latestDate: null, openingQty: null };
        if (typeof q === "number") sizes[sizeName].openingQty = q;
      }
    }

    for (let t = 0; t < titleRows.length; t++) {
      const startIdx = titleRows[t].rowIdx;
      const iso = titleRows[t].iso;
      if (iso < fromDate || iso > toDate) continue;

      const endIdx = (t + 1 < titleRows.length) ? titleRows[t + 1].rowIdx : rows.length;
      for (let r = startIdx; r < endIdx; r++) {
        const row = rows[r];
        const sizeName = (row[0] || "").toString().trim();
        if (!sizeName || sizeName.toUpperCase() === "SIZE") continue; // skip title/header rows

        // C=Total Prod Weight, E=Hot Rolled Weight, G=RHF Weight (F is RHF
        // Pieces-count, not weight - never used here), M=Hotout Weight, Q=ERP Stock Weight.
        const c = row[2], e = row[4], g = row[6], m = row[12], q = row[16];
        if (!sizes[sizeName]) sizes[sizeName] = { production: 0, consumption: 0, latestQty: null, latestDate: null, openingQty: null };

        if (typeof c === "number") sizes[sizeName].production += c;
        const eN = typeof e === "number" ? e : 0;
        const gN = typeof g === "number" ? g : 0;
        const mN = typeof m === "number" ? m : 0;
        if (typeof e === "number" || typeof g === "number" || typeof m === "number") {
          sizes[sizeName].consumption += (eN + gN - mN);
        }
        if (typeof q === "number" && (!sizes[sizeName].latestDate || iso >= sizes[sizeName].latestDate)) {
          sizes[sizeName].latestQty = q;
          sizes[sizeName].latestDate = iso;
        }
      }
    }
  } catch (e) { /* Daily Stock sheet missing from this workbook - stays empty */ }
  return sizes;
}

// FC Report's Opening is a whole-month starting figure. If the user's
// selected From Date is mid-month (not the 1st), that raw Opening doesn't
// match "yesterday's Closing" - it needs to be rolled forward day-by-day
// from the 1st of the month up to the day before From Date. Only done for
// August 2026 onward, since that's where genuine daily incoming/consumption
// data exists; earlier months only have one whole-month figure to begin with.
async function getAdjustedOpenings(wbList, itemNames, token) {
  const firstSub = wbList[0];
  const baseOpenings = (await getFcData(firstSub.wb, token)).openings;

  const monthStartDate = firstSub.fromDate.slice(0, 7) + "-01";
  const isPreAugust = monthStartDate.slice(0, 7) < "2026-08";
  if (isPreAugust || firstSub.fromDate === monthStartDate) {
    return baseOpenings; // range already starts at month-start, or no daily data to roll forward with
  }

  const dayBefore = new Date(firstSub.fromDate + "T00:00:00");
  dayBefore.setDate(dayBefore.getDate() - 1);
  const preRangeEnd = localDateToISO(dayBefore);

  const r = await getRmIncomingAndConsumption(firstSub.wb, monthStartDate, preRangeEnd, token);

  const adjusted = {};
  itemNames.forEach(name => {
    const item = STOCK_ITEMS.find(i => i.name === name);
    if (!item) { adjusted[name] = baseOpenings[name] || 0; return; }
    if (item.fcIncomingCol || item.fcConsumeCol) {
      // This item only has a whole-month figure to begin with (no daily
      // breakdown exists) - rolling it forward day-by-day isn't possible,
      // so just use FC Report's raw month-start Opening as-is.
      adjusted[name] = baseOpenings[name] || 0;
      return;
    }
    adjusted[name] = (baseOpenings[name] || 0) + r.incoming[name] - r.consumption[name];
  });
  return adjusted;
}

// Computes Opening/Incoming/Consumption/Closing for a given list of item
// names, using the exact same logic as the Stock Report tab (Opening from
// the first month's FC Report, rolled forward to the exact From Date so it
// matches the previous day's Closing, Incoming/Consumption summed across
// every month the range touches, with the pre-August-2026 FC Report
// fallback for months before daily tracking started). Reused by both the
// Stock Report and the Slag Crusher Report's Closing Report summary.
async function computeStockRowsForItems(wbList, itemNames, statusEl, token) {
  const items = STOCK_ITEMS.filter(item => itemNames.includes(item.name));
  const opening = await getAdjustedOpenings(wbList, itemNames, token);

  const incoming = {}, consumption = {}, transfer = {};
  items.forEach(item => { incoming[item.name] = 0; consumption[item.name] = 0; transfer[item.name] = 0; });

  for (let i = 0; i < wbList.length; i++) {
    if (statusEl) statusEl.textContent = `Reading incoming/consumption... (${i + 1}/${wbList.length} file(s))`;
    const sub = wbList[i];
    const [r, fc] = await Promise.all([   // both reads at the same time
      getRmIncomingAndConsumption(sub.wb, sub.fromDate, sub.toDate, token), getFcData(sub.wb, token)]);
    const isPreAugust = sub.fromDate.slice(0, 7) < "2026-08";
    items.forEach(item => {
      // Incoming and consumption each independently decide whether their
      // own figure comes from FC Report (a single whole-month number) or
      // from RM Report's daily columns - this used to be one combined
      // check ("if either FC column is set, use FC for both"), which broke
      // items like Pig Iron that need incoming from FC Report (it has no
      // daily incoming column anywhere) but consumption from RM Report's
      // daily AQ column (from the WhatsApp Consumption message).
      const useFcForIncoming = isPreAugust || (item.fcIncomingCol && item.rmCols.length === 0);
      const useFcForConsumption = isPreAugust || (item.fcConsumeCol && !item.consumeCol);

      if (useFcForIncoming) {
        incoming[item.name] += fc.colValues[item.name][item.fcIncomingCol || "E"] || 0;
      } else {
        incoming[item.name] += r.incoming[item.name];
      }

      if (useFcForConsumption) {
        const consCol = item.fcConsumeCol || "G";
        consumption[item.name] += Math.abs(fc.colValues[item.name][consCol] || 0);
      } else {
        consumption[item.name] += r.consumption[item.name];
      }
      // Inter-division transfer out (FC Report col P, a month figure)
      transfer[item.name] += Math.abs(fc.colValues[item.name].P || 0);
    });
  }

  return items.map(item => {
    const o = opening[item.name], inc = incoming[item.name], c = consumption[item.name], t = transfer[item.name];
    return { name: item.name, category: item.category, opening: o, incoming: inc, consumption: c, transfer: t, closing: o + inc - c - t };
  });
}

// "Billet Stock Format" sheet has some rows where column B holds a party's
// name instead of "MS BILLET" - these track billet stock physically held at
// a third party's premises (tracked separately since 24 Aug 2026), not our
// own warehouse stock. This "physical verification" block gets appended
// further down the sheet each time it's redone, so its row position isn't
// fixed - the header row must be located dynamically. Matching by party
// NAME (not Sl No) because the Sl No assigned to each party can shift
// between redoes of this block, which previously caused stale/wrong values
// to be picked up for a party whose row had moved.
const PARTY_STOCK_NAMES = ["SHYAM", "VRKP", "SWADESH", "SHRI RADHE", "MASHIVA", "AKASH"];

async function getPartyStock(wb, token) {
  try {
    const data = await graphFetch(`${wb}/worksheets('Billet Stock Format')/range(address='A1:G3000')?$select=values`, token);
    const values = data.values;

    // Find the header row ("Sl No." in column A) - take the LAST match in
    // case there's more than one such block in the sheet's history.
    let headerRowIdx = -1;
    for (let i = 0; i < values.length; i++) {
      const label = (values[i][0] || "").toString().trim().toLowerCase();
      if (label === "sl no." || label === "sl no" || label.startsWith("sl no")) headerRowIdx = i;
    }
    if (headerRowIdx === -1) return [];

    const rows = [];
    const byParty = {}; // keeps the LAST occurrence of each party within this block
    for (let i = headerRowIdx + 1; i < values.length; i++) {
      const row = values[i];
      const label = (row[0] || "").toString().trim().toLowerCase();
      if (label === "total") break; // end of this block
      const partyRaw = (row[1] || "").toString().trim();
      const partyMatch = PARTY_STOCK_NAMES.find(p => p.toLowerCase() === partyRaw.toLowerCase());
      if (partyMatch) {
        const stock = typeof row[6] === "number" ? row[6] : 0; // G = Quantity (In Mt)
        byParty[partyMatch] = stock; // overwrite if this party appears again lower down
      }
    }
    PARTY_STOCK_NAMES.forEach(party => {
      if (byParty[party] !== undefined) rows.push({ party, stock: byParty[party] });
    });
    return rows;
  } catch (e) {
    return []; // sheet missing or not present in this month's file
  }
}

// "Cumulative Stock" sheet (in every monthly file from September 2026):
// a dated block with columns  Section | Quality Status | MIPPL | <party> ... | Total
// and rows per section (OK / HOLD / TOTAL). Inward billet stock = every
// supplier column except MIPPL (our own) and Total, summed over the OK and
// HOLD rows of all sections (TOTAL rows are skipped so nothing is counted
// twice). Columns are found by their header text, so a new party column or
// a moved column is picked up automatically. If the sheet has more than one
// dated block, the latest one on or before the report's To Date is used.
const CUM_MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, sept:8, oct:9, nov:10, dec:11 };
function cumParseDate(v, t) {
  if (typeof v === "number" && v > 30000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const s = String(t || v || "").trim();
  let m = /^(\d{1,2})[\s\-\/.]+([A-Za-z]{3,9})[\s\-\/.,]+(\d{2,4})$/.exec(s);
  if (m) {
    const mo = CUM_MONTHS[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith("sept") ? 4 : 3)];
    if (mo === undefined) return null;
    let y = +m[3]; if (y < 100) y += 2000;
    return new Date(y, mo, +m[1]);
  }
  m = /^(\d{1,2})[\-\/.](\d{1,2})[\-\/.](\d{2,4})$/.exec(s);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
  return null;
}

async function getCumulativeStock(wb, token, toDateISO) {
  let data;
  try {
    data = await graphFetch(`${wb}/worksheets('Cumulative Stock')/range(address='A1:Z3000')?$select=values,text`, token);
  } catch (e) {
    return null; // sheet not in this file (months before September 2026)
  }
  const values = data.values || [], text = data.text || [];
  const norm = (x) => String(x === null || x === undefined ? "" : x).trim().toLowerCase().replace(/\s+/g, " ");

  // find every header row and the date written above it
  const blocks = [];
  let lastDate = null;
  for (let i = 0; i < values.length; i++) {
    const row = values[i] || [];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === "" || row[c] === null) continue;
      const d = cumParseDate(row[c], (text[i] || [])[c]);
      if (d) { lastDate = d; break; }
    }
    const h = row.map(norm);
    const secIdx = h.indexOf("section");
    const qIdx = h.indexOf("quality status");
    if (secIdx !== -1 && qIdx !== -1) blocks.push({ header: i, secIdx, qIdx, date: lastDate });
  }
  if (!blocks.length) return null;

  const limit = toDateISO ? new Date(toDateISO + "T00:00:00") : null;
  let blk = null;
  if (limit) {
    blocks.filter(b => b.date && b.date <= limit).forEach(b => { if (!blk || b.date >= blk.date) blk = b; });
  }
  if (!blk) blk = blocks[blocks.length - 1];

  // party columns
  const h = (values[blk.header] || []).map(norm);
  const parties = [];
  for (let c = blk.qIdx + 1; c < h.length; c++) {
    if (!h[c]) continue;
    if (h[c] === "total") break;
    if (h[c] === "mippl") continue; // own stock, not inward
    parties.push({ c, name: String(values[blk.header][c]).trim() });
  }

  const acc = {};
  parties.forEach(p => acc[p.name] = { ok: 0, hold: 0 });
  const nextHeader = blocks.find(b => b.header > blk.header);
  const end = nextHeader ? nextHeader.header : values.length;
  for (let i = blk.header + 1; i < end; i++) {
    const row = values[i] || [];
    const cells = row.map(norm);
    if (cells.some(x => x === "not ok" || x === "ok inward" || x === "ok mippl")) break; // summary area
    if (i > blk.header + 1 && row.some((v, c) => v !== "" && cumParseDate(v, (text[i] || [])[c]))) break; // next date title
    const q = cells[blk.qIdx];
    if (!q || q === "total") continue;
    const isOk = q === "ok";
    parties.forEach(p => {
      const v = row[p.c];
      const n = typeof v === "number" ? v : parseFloat(v);
      if (!isNaN(n)) acc[p.name][isOk ? "ok" : "hold"] += n;
    });
  }

  const rows = parties
    .map(p => ({ party: p.name, ok: acc[p.name].ok, hold: acc[p.name].hold, stock: acc[p.name].ok + acc[p.name].hold }))
    .filter(r => Math.abs(r.stock) > 0.0005);
  const label = blk.date ? blk.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
  return { rows, dateLabel: label };
}

async function loadStockReport() {
  const statusEl = document.getElementById("status");
  const fromDate = document.getElementById("stockFromDateStock").value;
  const toDate = document.getElementById("stockToDateStock").value;

  if (!fromDate || !toDate) {
    statusEl.className = "err";
    statusEl.textContent = "Please select both From Date and To Date.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Locating the file(s) for this date range...";
  document.getElementById("stockReportWrap").classList.add("hidden");
  const stockReportTableEl = document.getElementById("stockReportTable");
  stockReportTableEl.innerHTML = `<tr><td colspan="6"><div class="skeletonBar" style="width:90%;"></div><div class="skeletonBar" style="width:70%;"></div><div class="skeletonBar" style="width:80%;"></div></td></tr>`;

  try {
    const token = await getToken();
    const { results: wbList, missing } = await getWorkbooksForRange(token, fromDate, toDate);

    if (wbList.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't find a file for any month in this range (${missing.join(", ")}).`;
      return;
    }

    statusEl.textContent = "Reading opening stock (FC Report, rolled forward to the From Date)...";
    const allItemNames = STOCK_ITEMS.map(item => item.name);
    const opening = await getAdjustedOpenings(wbList, allItemNames, token);

    const incoming = {}, consumption = {};
    STOCK_ITEMS.forEach(item => { incoming[item.name] = 0; consumption[item.name] = 0; });
    const transfer = {};
    STOCK_ITEMS.forEach(item => { transfer[item.name] = 0; });

    const billetSizes = {}; // merged across all months in range: { sizeName: {production, consumption, latestQty, latestDate} }

    statusEl.textContent = `Reading incoming/consumption for ${wbList.length} month(s)...`;
    const monthResults = await Promise.all(wbList.map(async (sub) => {
      const [r, fc, sizesThisFile] = await Promise.all([   // three reads at the same time
        getRmIncomingAndConsumption(sub.wb, sub.fromDate, sub.toDate, token), getFcData(sub.wb, token),
        getBilletStockBySize(sub.wb, sub.fromDate, sub.toDate, token)]);
      const isPreAugust = sub.fromDate.slice(0, 7) < "2026-08";
      return { r, fc, isPreAugust, sizesThisFile };
    }));

    // Aggregation itself is fast (no network calls) - do it sequentially
    // over the already-fetched results, so the "only the first month has a
    // true Opening" logic (i === 0) still works exactly as before.
    for (let i = 0; i < monthResults.length; i++) {
      const { r, fc, isPreAugust, sizesThisFile } = monthResults[i];
      STOCK_ITEMS.forEach(item => {
        // Incoming and consumption each independently decide whether their
        // own figure comes from FC Report (a single whole-month number) or
        // from RM Report's daily columns - this used to be one combined
        // check ("if either FC column is set, use FC for both"), which
        // broke items like Pig Iron that need incoming from FC Report (it
        // has no daily incoming column anywhere) but consumption from RM
        // Report's daily AQ column (from the WhatsApp Consumption message).
        const useFcForIncoming = isPreAugust || (item.fcIncomingCol && item.rmCols.length === 0);
        const useFcForConsumption = isPreAugust || (item.fcConsumeCol && !item.consumeCol);

        if (useFcForIncoming) {
          incoming[item.name] += fc.colValues[item.name][item.fcIncomingCol || "E"] || 0;
        } else {
          incoming[item.name] += r.incoming[item.name];
        }

        if (useFcForConsumption) {
          const consCol = item.fcConsumeCol || "G";
          consumption[item.name] += Math.abs(fc.colValues[item.name][consCol] || 0);
        } else {
          consumption[item.name] += r.consumption[item.name];
        }
        // Inter-division transfer out (FC Report col P, a month figure)
        transfer[item.name] += Math.abs(fc.colValues[item.name].P || 0);
      });

      Object.keys(sizesThisFile).forEach(sizeName => {
        const s = sizesThisFile[sizeName];
        if (!billetSizes[sizeName]) billetSizes[sizeName] = { production: 0, consumption: 0, latestQty: null, latestDate: null, openingQty: null };
        billetSizes[sizeName].production += s.production;
        billetSizes[sizeName].consumption += s.consumption;
        if (s.latestDate && (!billetSizes[sizeName].latestDate || s.latestDate >= billetSizes[sizeName].latestDate)) {
          billetSizes[sizeName].latestQty = s.latestQty;
          billetSizes[sizeName].latestDate = s.latestDate;
        }
        // Only the first month in the range can have a genuine "day before"
        // block to pull the true Opening from.
        if (i === 0 && s.openingQty !== null) {
          billetSizes[sizeName].openingQty = s.openingQty;
        }
      });
    }

    const rows = STOCK_ITEMS.map(item => {
      const o = opening[item.name], inc = incoming[item.name], c = consumption[item.name], t = transfer[item.name];
      return { name: item.name, category: item.category, opening: o, incoming: inc, consumption: c, transfer: t, closing: o + inc - c - t };
    });

    // One row per billet SIZE (e.g. "160 X 4"), sorted alphabetically -
    // Closing Stock comes straight from column Q (already authoritative),
    // Opening is derived so the row still balances. "110 X 6" and
    // "110 X 5.25" are excluded - they're always 0.
    const EXCLUDED_BILLET_SIZES = ["110X6", "110X5.25"];
    const normalizeSizeName = s => s.toUpperCase().replace(/\s+/g, "");

    Object.keys(billetSizes).sort().forEach(sizeName => {
      if (EXCLUDED_BILLET_SIZES.includes(normalizeSizeName(sizeName))) return;
      const s = billetSizes[sizeName];
      if (s.latestQty === null) return; // no stock figure found for this size in range
      // True Opening = the actual Q value from the closest block before the
      // range started (yesterday's Closing). Falls back to a back-calculated
      // figure only if no earlier block exists in the file (e.g. this is the
      // very first date ever logged for this size).
      const openingVal = s.openingQty !== null ? s.openingQty : (s.latestQty - s.production + s.consumption);
      // Consumption is derived from Opening + Production - Closing (both
      // Opening and Closing come from column Q, the authoritative actual
      // weight) rather than summed from the daily E+G-M columns directly -
      // this keeps the report internally consistent even when the ERP
      // occasionally records a size's consumption against a different
      // size (a real-world data-entry quirk, not something the E/G/M
      // columns alone can correct for).
      const derivedConsumption = openingVal + s.production - s.latestQty;
      rows.push({
        name: `MS Billet - ${sizeName}`,
        category: "FINISHED PRODUCT",
        opening: openingVal,
        incoming: s.production,
        consumption: derivedConsumption,
        transfer: 0,
        closing: s.latestQty
      });
    });

    stockReportData = { fromDate, toDate, rows };

    const table = document.getElementById("stockReportTable");
    table.innerHTML = "<tr><th>Item</th><th>Opening</th><th>Incoming</th><th>Consumption</th><th>Transfer</th><th>Closing Stock</th></tr>";
    CATEGORY_ORDER.forEach(cat => {
      const catRows = rows.filter(r => r.category === cat);
      if (catRows.length === 0) return;
      const color = CATEGORY_COLORS[cat];
      table.innerHTML += `<tr><td colspan="6" style="background:${color};color:#fff;font-weight:800;text-align:left;padding:10px 12px;">${cat}</td></tr>`;
      catRows.forEach(r => {
        const closingCls = r.closing < 0 ? "stockNegative" : "stockPositive";
        table.innerHTML += `<tr><td>${getIcon(r.name)} ${_escH(r.name)}</td><td>${r.opening.toFixed(3)}</td><td>${r.incoming.toFixed(3)}</td><td>${r.consumption.toFixed(3)}</td><td>${(r.transfer || 0).toFixed(3)}</td><td class="${closingCls}">${r.closing.toFixed(3)}</td></tr>`;
      });
      const catTotal = catRows.reduce((acc, r) => ({
        opening: acc.opening + r.opening, incoming: acc.incoming + r.incoming,
        consumption: acc.consumption + r.consumption, transfer: acc.transfer + (r.transfer || 0), closing: acc.closing + r.closing
      }), { opening: 0, incoming: 0, consumption: 0, transfer: 0, closing: 0 });
      table.innerHTML += `<tr class="rowTotal"><td>Total - ${cat}</td><td>${catTotal.opening.toFixed(3)}</td><td>${catTotal.incoming.toFixed(3)}</td><td>${catTotal.consumption.toFixed(3)}</td><td>${catTotal.transfer.toFixed(3)}</td><td>${catTotal.closing.toFixed(3)}</td></tr>`;
    });
    table.querySelectorAll("td.stockPositive, td.stockNegative").forEach(cell => {
      flashCell(cell, cell.classList.contains("stockPositive"));
    });

    // Party Stock is a current snapshot (not a period total), so always
    // read it from the latest month touched by the range.
    // From September 2026 the "Cumulative Stock" sheet is the source; older
    // months fall back to the party block in "Billet Stock Format".
    const lastWb = wbList[wbList.length - 1].wb;
    const cum = await getCumulativeStock(lastWb, token, toDate);
    const partyStockRows = cum ? cum.rows : await getPartyStock(lastWb, token);
    const hasSplit = !!cum;
    const noteEl = document.querySelector("#partyStockWrap p");
    if (noteEl) noteEl.textContent = cum
      ? `From "Cumulative Stock" sheet${cum.dateLabel ? " (" + cum.dateLabel + ")" : ""} - all suppliers except MIPPL, OK + HOLD.`
      : "Tracked separately from own-warehouse billet stock (started 24 Aug 2026).";
    const partyStockTable = document.getElementById("partyStockTable");
    if (partyStockRows.length > 0) {
      partyStockTable.innerHTML = hasSplit
        ? "<tr><th>Party</th><th>OK (MT)</th><th>HOLD (MT)</th><th>Total (MT)</th></tr>"
        : "<tr><th>Party</th><th>Stock (MT)</th></tr>";
      let partyTotal = 0, okTotal = 0, holdTotal = 0;
      const cell = (v) => `<td class="countUpTarget" data-target="${htmlEsc(v)}">0.000</td>`;
      partyStockTable.innerHTML += partyStockRows.map(r => {
        partyTotal += r.stock; okTotal += r.ok || 0; holdTotal += r.hold || 0;
        return hasSplit
          ? `<tr><td>${htmlEsc(r.party)}</td>${cell(r.ok)}${cell(r.hold)}${cell(r.stock)}</tr>`
          : `<tr><td>${htmlEsc(r.party)}</td>${cell(r.stock)}</tr>`;
      }).join("");
      partyStockTable.innerHTML += hasSplit
        ? `<tr class="rowTotal"><td>TOTAL</td>${cell(okTotal)}${cell(holdTotal)}${cell(partyTotal)}</tr>`
        : `<tr class="rowTotal"><td>TOTAL</td>${cell(partyTotal)}</tr>`;
      stockReportData.partySplit = hasSplit;
      stockReportData.partyDateLabel = cum ? cum.dateLabel : "";
      document.getElementById("partyStockWrap").classList.remove("hidden");
      stockReportData.partyStockRows = partyStockRows;
      partyStockTable.querySelectorAll(".countUpTarget").forEach(cell => {
        animateCountUp(cell, parseFloat(cell.dataset.target));
      });
    } else {
      document.getElementById("partyStockWrap").classList.add("hidden");
      stockReportData.partyStockRows = [];
    }

    document.getElementById("stockReportWrap").classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = `Stock report loaded for ${fromDate} to ${toDate} (opening from ${wbList[0].filePath}).` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("stockReportLoadBtn").addEventListener("click", loadStockReport);

document.getElementById("stockReportPdfBtn").addEventListener("click", () => {
  if (!stockReportData) { alert("Load the stock report first."); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  addLogoHeader(doc);
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(31, 56, 100);
  doc.text("Raw Material Stock Report", pageW / 2, 40, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text(`Period: ${stockReportData.fromDate} to ${stockReportData.toDate}`, pageW / 2, 58, { align: "center" });

  const hexToRgb = hex => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  // Build the body with a full-width colored category header row before
  // each group's items (emoji don't render in jsPDF's fonts, so each item
  // gets a real vector-drawn colored dot - matching its category color -
  // as an "icon" instead, drawn via didDrawCell below), followed by a
  // bold "Total - <category>" subtotal row.
  const body = [];
  CATEGORY_ORDER.forEach(cat => {
    const catRows = stockReportData.rows.filter(r => r.category === cat);
    if (catRows.length === 0) return;
    const rgb = hexToRgb(CATEGORY_COLORS[cat]);
    body.push([{
      content: cat, colSpan: 6,
      styles: { fillColor: rgb, textColor: [255, 255, 255], fontStyle: "bold", halign: "left", fontSize: 9 }
    }]);
    catRows.forEach(r => {
      body.push([
        { content: r.name, styles: { textColor: rgb, fontStyle: "bold", halign: "left", cellPadding: { left: 16, top: 4, bottom: 4, right: 5 } } },
        r.opening.toFixed(3), r.incoming.toFixed(3), r.consumption.toFixed(3), (r.transfer || 0).toFixed(3), r.closing.toFixed(3)
      ]);
    });
    const catTotal = catRows.reduce((acc, r) => ({
      opening: acc.opening + r.opening, incoming: acc.incoming + r.incoming,
      consumption: acc.consumption + r.consumption, transfer: acc.transfer + (r.transfer || 0), closing: acc.closing + r.closing
    }), { opening: 0, incoming: 0, consumption: 0, transfer: 0, closing: 0 });
    body.push([
      { content: `Total - ${cat}`, styles: { fontStyle: "bold", halign: "left", fillColor: [253, 243, 216] } },
      { content: catTotal.opening.toFixed(3), styles: { fontStyle: "bold", fillColor: [253, 243, 216] } },
      { content: catTotal.incoming.toFixed(3), styles: { fontStyle: "bold", fillColor: [253, 243, 216] } },
      { content: catTotal.consumption.toFixed(3), styles: { fontStyle: "bold", fillColor: [253, 243, 216] } },
      { content: catTotal.transfer.toFixed(3), styles: { fontStyle: "bold", fillColor: [253, 243, 216] } },
      { content: catTotal.closing.toFixed(3), styles: { fontStyle: "bold", fillColor: [253, 243, 216] } }
    ]);
  });

  doc.autoTable({
    head: [["Item", "Opening", "Incoming", "Consumption", "Transfer", "Closing Stock"]],
    body: body,
    startY: 70,
    styles: { fontSize: 6.8, cellPadding: 2.2, halign: "center", valign: "middle" },
    headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [244, 248, 253] },
    margin: { left: 26, right: 26 },
    didDrawCell: function (data) {
      // Draw a small colored dot "icon" before each item name (real vector
      // shape, not a font glyph - fully reliable regardless of font support).
      // Skip subtotal rows (they don't have a per-item color to show).
      const isSubtotalRow = data.section === "body" && data.row.raw.length === 6 &&
        typeof data.row.raw[0].content === "string" && data.row.raw[0].content.startsWith("Total - ");
      if (data.section === "body" && data.column.index === 0 && data.row.raw.length === 6 && !isSubtotalRow) {
        const rgb = data.cell.styles.textColor;
        if (Array.isArray(rgb)) {
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.circle(data.cell.x + 8, data.cell.y + data.cell.height / 2, 2.6, "F");
        }
      }
    },
    didParseCell: function (data) {
      const isSubtotalRow = data.section === "body" && data.row.raw.length === 6 &&
        typeof data.row.raw[0].content === "string" && data.row.raw[0].content.startsWith("Total - ");
      if (isSubtotalRow) return; // keep the light-gold subtotal styling already set above, skip the closing-color logic
      if (data.section === "body" && data.column.index === 5 && data.row.raw.length === 6) {
        const val = parseFloat(data.cell.raw);
        if (val < 0) {
          data.cell.styles.fillColor = [251, 233, 231];
          data.cell.styles.textColor = [163, 39, 28];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.fillColor = [231, 247, 234];
          data.cell.styles.textColor = [30, 107, 60];
          data.cell.styles.fontStyle = "bold";
        }
      }
    }
  });

  // Party Stock is tracked separately from own-warehouse billet stock -
  // rendered as its own clearly distinct section (gap + border + separate
  // heading), never mixed into the main table above.
  if (stockReportData.partyStockRows && stockReportData.partyStockRows.length > 0) {
    let y = doc.lastAutoTable.finalY + 18;
    doc.setDrawColor(31, 56, 100);
    doc.setLineWidth(1.2);
    doc.line(26, y - 10, pageW - 26, y - 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(31, 56, 100);
    doc.text("Inward Billet Stock", pageW / 2, y, { align: "center" });
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    const split = !!stockReportData.partySplit;
    doc.text(split
      ? `(From "Cumulative Stock" sheet${stockReportData.partyDateLabel ? " - " + stockReportData.partyDateLabel : ""}; all suppliers except MIPPL)`
      : "(Tracked separately - started 24 Aug 2026)", pageW / 2, y + 11, { align: "center" });

    const pr = stockReportData.partyStockRows;
    const partyTotal = pr.reduce((s, r) => s + r.stock, 0);
    const bold = (v) => ({ content: v, styles: { fontStyle: "bold" } });
    let partyBody, partyHead;
    if (split) {
      partyHead = ["Party", "OK (MT)", "HOLD (MT)", "Total (MT)"];
      partyBody = pr.map(r => [r.party, (r.ok || 0).toFixed(3), (r.hold || 0).toFixed(3), r.stock.toFixed(3)]);
      partyBody.push([bold("TOTAL"), bold(pr.reduce((s, r) => s + (r.ok || 0), 0).toFixed(3)), bold(pr.reduce((s, r) => s + (r.hold || 0), 0).toFixed(3)), bold(partyTotal.toFixed(3))]);
    } else {
      partyHead = ["Party", "Stock (MT)"];
      partyBody = pr.map(r => [r.party, r.stock.toFixed(3)]);
      partyBody.push([bold("TOTAL"), bold(partyTotal.toFixed(3))]);
    }

    doc.autoTable({
      head: [partyHead],
      body: partyBody,
      startY: y + 18,
      styles: { fontSize: 8.5, cellPadding: 5, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.5 },
      headStyles: { fillColor: [122, 31, 162], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 240, 252] },
      theme: "grid",
      margin: { left: 60, right: 60 },
      didParseCell: function (data) {
        if (data.section === "body" && data.row.index === partyBody.length - 1) {
          data.cell.styles.fillColor = [255, 235, 130];
        }
      }
    });
  }

  stampLogoOnAllPages(doc);
  showPdfPreview(doc, `Stock_Report_${stockReportData.fromDate}_to_${stockReportData.toDate}.pdf`, "Raw Material Stock Report");
});

