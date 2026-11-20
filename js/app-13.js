/* ===================== MONTH-OVER-MONTH COMPARISON ===================== */
let momChartInstance = null;

async function getMonthTotals(token, sheetName, year, month0based) {
  const filePath = await detectFilePathForMonth(token, year, month0based);
  if (!filePath) return null;

  const wb = await resolveWorkbook(token, filePath);
  const monthStart = `${year}-${String(month0based + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month0based + 1, 0).getDate();
  const monthEnd = `${year}-${String(month0based + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // whole sheet in ONE read (was 2 reads per day, one day after another)
  const values = (await graphFetch(
    `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:AH2000')?$select=values`,
    token
  )).values;
  const totals = { heatCount: 0, totalProd: 0, hotCharging: 0, bypass: 0, rhf: 0, hotOut: 0 };
  let days = 0;

  for (let i = 0; i < values.length; i++) {
    const v = values[i][0];
    if (typeof v !== "number") continue;
    const iso = excelSerialToISODate(v);
    if (iso < monthStart || iso > monthEnd) continue;
    const s = daySummaryFromValues(values, i);
    totals.heatCount += s.heatCount;
    totals.totalProd += s.totalProd;
    totals.hotCharging += s.hotCharging;
    totals.bypass += s.bypass;
    totals.rhf += s.rhf;
    totals.hotOut += s.hotOut;
    days++;
  }

  return { filePath, days, totals };
}

async function loadMonthOverMonth() {
  const statusEl = document.getElementById("status");
  const sheetName = document.getElementById("sheetName").value.trim();
  const momVal = document.getElementById("momMonth").value; // "YYYY-MM"

  if (!momVal) {
    statusEl.className = "err";
    statusEl.textContent = "Please select a month first.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Loading month-over-month comparison...";
  document.getElementById("momChartWrap").classList.add("hidden");

  try {
    const token = await getToken();
    const [y, m] = momVal.split("-").map(Number); // m is 1-based
    const thisMonth0 = m - 1;
    let prevMonth0 = thisMonth0 - 1, prevYear = y;
    if (prevMonth0 < 0) { prevMonth0 = 11; prevYear = y - 1; }

    // the three months are read at the same time
    const safe = pr => pr.catch(() => null);
    const [thisData, prevData, yoyData] = await Promise.all([
      getMonthTotals(token, sheetName, y, thisMonth0),
      getMonthTotals(token, sheetName, prevYear, prevMonth0),
      safe(getMonthTotals(token, sheetName, y - 1, thisMonth0)) // same month, last year
    ]);

    if (!thisData && !prevData) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't find files for either ${MONTH_ABBR[thisMonth0]} ${y} or ${MONTH_ABBR[prevMonth0]} ${prevYear}.`;
      return;
    }

    const t = thisData ? thisData.totals : { totalProd: 0, hotCharging: 0, bypass: 0, rhf: 0, hotOut: 0 };
    const p = prevData ? prevData.totals : { totalProd: 0, hotCharging: 0, bypass: 0, rhf: 0, hotOut: 0 };
    const yy = yoyData ? yoyData.totals : null; // null if last year's file isn't available - shown blank, not zero
    const thisLabel = `${MONTH_ABBR[thisMonth0]} ${y}`;
    const prevLabel = `${MONTH_ABBR[prevMonth0]} ${prevYear}`;
    const yoyLabel = `${MONTH_ABBR[thisMonth0]} ${y - 1}`;

    const metrics = [
      { key: "totalProd", label: "Total Production (MT)" },
      { key: "hotCharging", label: "Hot Charging (MT)" },
      { key: "bypass", label: "Bypass (MT)" },
      { key: "rhf", label: "RHF (MT)" },
      { key: "hotOut", label: "Hot Out (MT)" }
    ];

    document.getElementById("momChartWrap").classList.remove("hidden");
    const ctx = document.getElementById("momChart").getContext("2d");
    if (momChartInstance) momChartInstance.destroy();
    const datasets = [
      { label: prevLabel, data: metrics.map(m => p[m.key]), backgroundColor: "#9dc3e6" },
      { label: thisLabel, data: metrics.map(m => t[m.key]), backgroundColor: "#1f3864" }
    ];
    if (yy) datasets.push({ label: yoyLabel + " (last year)", data: metrics.map(m => yy[m.key]), backgroundColor: "#c9a227" });
    momChartInstance = new Chart(ctx, {
      type: "bar",
      data: { labels: metrics.map(m => m.label), datasets },
      options: {
        responsive: true,
        devicePixelRatio: 2,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } }
      }
    });

    let tableHtml = `<table class="momTable"><tr><th>Metric</th><th>${prevLabel}</th><th>${thisLabel}</th><th>MoM Change</th>`;
    if (yy) tableHtml += `<th>${yoyLabel}</th><th>YoY Change</th>`;
    tableHtml += `</tr>`;
    metrics.forEach(m => {
      const pv = p[m.key], tv = t[m.key];
      const pct = pv !== 0 ? ((tv - pv) / pv * 100) : (tv > 0 ? 100 : 0);
      const cls = pct >= 0 ? "momUp" : "momDown";
      const arrow = pct >= 0 ? "▲" : "▼";
      tableHtml += `<tr><td>${m.label}</td><td>${pv.toFixed(3)}</td><td>${tv.toFixed(3)}</td><td class="${cls}">${arrow} ${Math.abs(pct).toFixed(1)}%</td>`;
      if (yy) {
        const yv = yy[m.key];
        const yoyPct = yv !== 0 ? ((tv - yv) / yv * 100) : (tv > 0 ? 100 : 0);
        const yoyCls = yoyPct >= 0 ? "momUp" : "momDown";
        const yoyArrow = yoyPct >= 0 ? "▲" : "▼";
        tableHtml += `<td>${yv.toFixed(3)}</td><td class="${yoyCls}">${yoyArrow} ${Math.abs(yoyPct).toFixed(1)}%</td>`;
      }
      tableHtml += `</tr>`;
    });
    tableHtml += "</table>";
    document.getElementById("momTable").innerHTML = tableHtml;

    let note = "";
    if (!thisData) note += ` Couldn't find a file for ${thisLabel}.`;
    if (!prevData) note += ` Couldn't find a file for ${prevLabel}.`;
    if (!yy) note += ` (Year-over-year comparison unavailable - no file for ${yoyLabel}.)`;

    statusEl.className = "ok";
    statusEl.textContent = `Comparison loaded: ${prevLabel} vs ${thisLabel}.${note}`;

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("momLoadBtn").addEventListener("click", loadMonthOverMonth);
document.getElementById("momChartDownloadBtn").addEventListener("click", () => {
  downloadChartAsPng(momChartInstance, "Month_Over_Month.png");
});
document.getElementById("momChartPdfBtn").addEventListener("click", () => {
  downloadChartAsPdf(momChartInstance, "Month-over-Month Comparison", "Month_Over_Month.pdf");
});
/* ===================== TREND CHARTS ===================== */
let trendChartInstance = null;
let pieChartInstance = null;
let trendSummaryRows = [];   // [series, highest, high date, lowest, low date, average, cumulative]

// Highest / lowest / average / cumulative (total of the period) for one series
function trendStats(labels, data) {
  const vals = data.map((v, i) => ({ v: Number(v), i })).filter(x => Number.isFinite(x.v));
  if (!vals.length) return null;
  let hi = vals[0], lo = vals[0], sum = 0;
  vals.forEach(x => { if (x.v > hi.v) hi = x; if (x.v < lo.v) lo = x; sum += x.v; });
  return { hi: hi.v, hiI: hi.i, hiDate: labels[hi.i], lo: lo.v, loI: lo.i, loDate: labels[lo.i], avg: sum / vals.length, sum, n: vals.length };
}
// Chart.js plugin: marks the highest (▲) and lowest (▼) point of every visible line with its value
const hiLoMarkerPlugin = {
  id: "hiLoMarker",
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden || !chart.isDatasetVisible(di) || ds.noHiLo) return;
      const st = trendStats(chart.data.labels, ds.data); if (!st || st.n < 2) return;
      const col = ds.borderColor || "#333";
      [[st.hiI, st.hi, true], [st.loI, st.lo, false]].forEach(([i, v, up]) => {
        const pt = meta.data[i]; if (!pt) return;
        const x = pt.x, y = pt.y, sz = 6;
        ctx.save();
        ctx.fillStyle = up ? "#1e8e3e" : "#d93025"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (up) { ctx.moveTo(x, y - sz - 4); ctx.lineTo(x - sz, y - 4 + sz * 0.6); ctx.lineTo(x + sz, y - 4 + sz * 0.6); }
        else { ctx.moveTo(x, y + sz + 4); ctx.lineTo(x - sz, y + 4 - sz * 0.6); ctx.lineTo(x + sz, y + 4 - sz * 0.6); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (chart.width < 600) { ctx.restore(); return; } // small phone screen: markers only, values are in the table
        const txt = (up ? "High " : "Low ") + v.toFixed(3);
        ctx.font = "bold 11px Arial"; const w = ctx.measureText(txt).width;
        let tx = Math.min(Math.max(x - w / 2, chartArea.left + 2), chartArea.right - w - 2);
        let ty = up ? y - sz - 10 : y + sz + 18;
        if (up && ty < chartArea.top + 10) ty = y + sz + 18;
        if (!up && ty > chartArea.bottom - 2) ty = y - sz - 10;
        ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillRect(tx - 2, ty - 11, w + 4, 14);
        ctx.fillStyle = up ? "#1e7a35" : "#c0261d"; ctx.fillText(txt, tx, ty);
        ctx.restore();
      });
    });
  }
};
function renderTrendSummary(labels, datasets) {
  trendSummaryRows = datasets.map(ds => {
    const st = trendStats(labels, ds.data); if (!st) return null;
    return [ds.label, st.hi.toFixed(3), st.hiDate, st.lo.toFixed(3), st.loDate, st.avg.toFixed(3), st.sum.toFixed(3)];
  }).filter(Boolean);
  const td = "border:1px solid rgba(128,128,128,.45);padding:4px 6px;text-align:left;white-space:nowrap";
  const head = ["Series", "Highest", "Date", "Lowest", "Date", "Average / day", "Cumulative (total)"];
  document.getElementById("trendSummary").innerHTML = trendSummaryRows.length
    ? `<table style="border-collapse:collapse;font-size:12px;width:100%"><tr>${head.map(h => `<th style="${td}">${h}</th>`).join("")}</tr>` +
      trendSummaryRows.map(r => `<tr>${r.map((c, i) => `<td style="${td}${i === 1 ? ";color:#1e8e3e;font-weight:600" : i === 3 ? ";color:#d93025;font-weight:600" : ""}">${_escH(c)}</td>`).join("")}</tr>`).join("") +
      `</table><div style="font-size:11px;color:var(--muted);margin-top:4px">${labels.length} day(s): ${_escH(labels[0])} to ${_escH(labels[labels.length - 1])}. Values in MT. ▲ / ▼ on the chart mark the highest / lowest day.</div>`
    : "";
}

// ---- Fast data for the trend charts: ONE read of the Prod. sheet (A1:AH2000) per month file,
// instead of one or two network calls per day. Day blocks are found from the dates in column A.
async function readProdBlocksForRange(token, sheetName, fromDate, toDate) {
  const { results: wbList, missing } = await getWorkbooksForRange(token, fromDate, toDate);
  const reads = await Promise.all(wbList.map(sub => graphFetch(
    `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:AH2000')?$select=values`, token)
    .then(r => ({ sub, values: r.values }))));
  const blocks = [];
  for (const { sub, values } of reads) {
    for (let i = 0; i < values.length; i++) {
      const v = values[i][0];
      if (typeof v !== "number") continue;
      const iso = excelSerialToISODate(v);
      if (iso >= sub.fromDate && iso <= sub.toDate) blocks.push({ iso, values, i });
    }
  }
  blocks.sort((a, b) => a.iso.localeCompare(b.iso));
  return { blocks, wbCount: wbList.length, missing };
}
// same numbers as getDaySummary(), taken from the already-read sheet values
function daySummaryFromValues(values, i) {
  const n = v => (typeof v === "number" ? v : 0);
  const hb = heatsAt(values, i);
  const heatRows = values.slice(i, i + hb);
  const maxRow = values[i + hb + 1] || [], totalRow = values[i + hb + 2] || [];
  return {
    heatCount: heatRows.filter(isRealHeatRow).length,
    totalProd: n(totalRow[27]), hotCharging: n(totalRow[20]), bypass: n(totalRow[26]),
    rhf: n(maxRow[14]) + n(totalRow[14]), hotOut: n(totalRow[33])
  };
}
// Table: one row per category with its total over the period, share, best/worst day, average/day
function categorySummaryRows(labels, cats) {
  const grand = cats.reduce((a, c) => a + c.data.reduce((x, y) => x + (Number(y) || 0), 0), 0);
  return cats.map(c => {
    const st = trendStats(labels, c.data); if (!st) return null;
    return [c.label, st.sum.toFixed(3), grand ? (st.sum / grand * 100).toFixed(1) + " %" : "-", st.hi.toFixed(3), st.hiDate, st.lo.toFixed(3), st.loDate, st.avg.toFixed(3)];
  }).filter(Boolean);
}
const CATEGORY_SUMMARY_HEAD = ["Category", "Cumulative (MT)", "Share", "Highest day (MT)", "Date", "Lowest day (MT)", "Date", "Average / day (MT)"];
function renderSummaryTable(boxId, head, rows, note, hiCol, loCol) {
  const box = document.getElementById(boxId); if (!box) return;
  const td = "border:1px solid rgba(128,128,128,.45);padding:4px 6px;text-align:left;white-space:nowrap";
  box.innerHTML = rows.length
    ? `<table style="border-collapse:collapse;font-size:12px;width:100%"><tr>${head.map(h => `<th style="${td}">${h}</th>`).join("")}</tr>` +
      rows.map(r => `<tr>${r.map((c, i) => `<td style="${td}${i === hiCol ? ";color:#1e8e3e;font-weight:600" : i === loCol ? ";color:#d93025;font-weight:600" : ""}">${_escH(c)}</td>`).join("")}</tr>`).join("") +
      `</table>${note ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">${note}</div>` : ""}`
    : "";
}
function pdfSummary(head, rows, hiCol, loCol) { return { head, body: rows, hiCol, loCol }; }
let pieSummaryRows = [], sizeSummaryRows = [], chemSummaryRows = [];

async function loadTrendChart() {
  const statusEl = document.getElementById("status");
  const sheetName = document.getElementById("sheetName").value.trim();
  const fromDate = document.getElementById("trendFromDate").value;
  const toDate = document.getElementById("trendToDate").value;
  if (!fromDate || !toDate) { statusEl.className = "err"; statusEl.textContent = "Please select both From Date and To Date."; return; }
  statusEl.className = "wait";
  statusEl.textContent = "Reading the file(s) for this date range...";
  try {
    const token = await getToken();
    const { blocks, wbCount, missing } = await readProdBlocksForRange(token, sheetName, fromDate, toDate);
    if (!wbCount) { statusEl.className = "err"; statusEl.textContent = `Couldn't find a file for any month in this range (${missing.join(", ")}).`; return; }
    if (!blocks.length) { statusEl.className = "err"; statusEl.textContent = "No dates in this range were found in the available file(s)."; return; }

    const labels = [], totalProdData = [], hotChargingData = [], bypassData = [], rhfData = [], hotOutData = [];
    for (const b of blocks) {
      const s = daySummaryFromValues(b.values, b.i);
      labels.push(b.iso);
      totalProdData.push(s.totalProd); hotChargingData.push(s.hotCharging); bypassData.push(s.bypass);
      rhfData.push(s.rhf); hotOutData.push(s.hotOut);
    }
    const sum = a => a.reduce((x, y) => x + y, 0);

    document.getElementById("trendChartWrap").classList.remove("hidden");
    const ctx = document.getElementById("trendChart").getContext("2d");
    if (trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Total Production (MT)", data: totalProdData, borderColor: "#c9a227", backgroundColor: "rgba(201,162,39,0.15)", tension: 0.25, fill: true },
          { label: "Hot Charging (MT)", data: hotChargingData, borderColor: "#1f3864", backgroundColor: "rgba(31,56,100,0.1)", tension: 0.25 },
          { label: "Bypass (MT)", data: bypassData, borderColor: "#9dc3e6", backgroundColor: "rgba(157,195,230,0.1)", tension: 0.25 }
        ]
      },
      options: { responsive: true, devicePixelRatio: 2, layout: { padding: { top: 18 } }, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } },
      plugins: [hiLoMarkerPlugin]
    });
    renderTrendSummary(labels, trendChartInstance.data.datasets);

    document.getElementById("pieChartWrap").classList.remove("hidden");
    const pieCtx = document.getElementById("pieChart").getContext("2d");
    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = new Chart(pieCtx, {
      type: "pie",
      data: { labels: ["Hot Charging", "Bypass", "RHF", "Hot Out"],
        datasets: [{ data: [sum(hotChargingData), sum(bypassData), sum(rhfData), sum(hotOutData)], backgroundColor: ["#1f3864", "#9dc3e6", "#c9a227", "#e8d38a"] }] },
      options: { responsive: true, devicePixelRatio: 2, plugins: { legend: { position: "bottom" } } }
    });
    pieSummaryRows = categorySummaryRows(labels, [
      { label: "Hot Charging", data: hotChargingData }, { label: "Bypass", data: bypassData },
      { label: "RHF", data: rhfData }, { label: "Hot Out", data: hotOutData }]);
    renderSummaryTable("pieSummary", CATEGORY_SUMMARY_HEAD, pieSummaryRows,
      `${labels.length} day(s): ${_escH(labels[0])} to ${_escH(labels[labels.length - 1])}. Cumulative = total of the period.`, 3, 5);

    statusEl.className = "ok";
    statusEl.textContent = `Trend loaded for ${blocks.length} date(s) across ${wbCount} file(s).` + (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");
  } catch (e) { statusEl.className = "err"; statusEl.textContent = "Error: " + e.message; }
}

async function loadSizeBreakdown() {
  const statusEl = document.getElementById("status");
  const sheetName = document.getElementById("sheetName").value.trim();
  const fromDate = document.getElementById("sizeFromDate").value;
  const toDate = document.getElementById("sizeToDate").value;
  if (!fromDate || !toDate) { statusEl.className = "err"; statusEl.textContent = "Please select both From Date and To Date."; return; }
  statusEl.className = "wait";
  statusEl.textContent = "Reading the file(s) for this date range...";
  try {
    const token = await getToken();
    const { blocks, wbCount, missing } = await readProdBlocksForRange(token, sheetName, fromDate, toDate);
    if (!wbCount) { statusEl.className = "err"; statusEl.textContent = `Couldn't find a file for any month in this range (${missing.join(", ")}).`; return; }
    if (!blocks.length) { statusEl.className = "err"; statusEl.textContent = "No dates in this range were found in the available file(s)."; return; }
    const labels = [], d130 = [], d160 = [];
    for (const b of blocks) {
      let t130 = 0, t160 = 0;
      for (const row of b.values.slice(b.i, b.i + 12)) {
        const size = (row[7] == null ? "" : row[7]).toString().trim();   // H
        const prod = row[27];                                            // AB
        if (typeof prod !== "number") continue;
        if (size === "130") t130 += prod; else if (size === "160") t160 += prod;
      }
      labels.push(b.iso); d130.push(t130); d160.push(t160);
    }
    const total130 = d130.reduce((a, b) => a + b, 0), total160 = d160.reduce((a, b) => a + b, 0);
    document.getElementById("size130Value").textContent = total130.toFixed(3);
    document.getElementById("size160Value").textContent = total160.toFixed(3);
    document.getElementById("sizeChartWrap").classList.remove("hidden");
    const ctx = document.getElementById("sizePieChart").getContext("2d");
    if (sizePieChartInstance) sizePieChartInstance.destroy();
    sizePieChartInstance = new Chart(ctx, {
      type: "pie",
      data: { labels: ["130 X 130", "160 X 160"], datasets: [{ data: [total130, total160], backgroundColor: ["#c9a227", "#1f3864"] }] },
      options: { responsive: true, devicePixelRatio: 2, plugins: { legend: { position: "bottom" } } }
    });
    sizeSummaryRows = categorySummaryRows(labels, [{ label: "130 X 130", data: d130 }, { label: "160 X 160", data: d160 }]);
    renderSummaryTable("sizeSummary", CATEGORY_SUMMARY_HEAD, sizeSummaryRows,
      `${labels.length} day(s): ${_escH(labels[0])} to ${_escH(labels[labels.length - 1])}. Day-wise production by billet size.`, 3, 5);
    statusEl.className = "ok";
    statusEl.textContent = `Size breakdown loaded for ${fromDate} to ${toDate} (${blocks.length} day(s) across ${wbCount} file(s)).` + (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");
  } catch (e) { statusEl.className = "err"; statusEl.textContent = "Error: " + e.message; }
}

async function loadChemicalTrend() {
  const statusEl = document.getElementById("status");
  const sheetName = document.getElementById("sheetName").value.trim();
  const fromDate = document.getElementById("chemFromDate").value;
  const toDate = document.getElementById("chemToDate").value;
  if (!fromDate || !toDate) { statusEl.className = "err"; statusEl.textContent = "Please select both From Date and To Date."; return; }
  statusEl.className = "wait";
  statusEl.textContent = "Reading the file(s) for this date range...";
  try {
    const token = await getToken();
    const { blocks, wbCount, missing } = await readProdBlocksForRange(token, sheetName, fromDate, toDate);
    if (!wbCount) { statusEl.className = "err"; statusEl.textContent = `Couldn't find a file for any month in this range (${missing.join(", ")}).`; return; }
    if (!blocks.length) { statusEl.className = "err"; statusEl.textContent = "No dates in this range were found in the available file(s)."; return; }
    const labels = [], avgC = [], avgMn = [], avgSi = [], avgS = [], avgP = [];
    const heats = []; // every heat: { iso, heat, v: [C, Mn, Si, S, P] }
    for (const b of blocks) {
      const rows = b.values.slice(b.i, b.i + heatsAt(b.values, b.i));
      const avg = col => { const nums = rows.map(r => r[col]).filter(v => typeof v === "number"); return nums.length ? nums.reduce((a, c) => a + c, 0) / nums.length : null; };
      labels.push(b.iso); avgC.push(avg(2)); avgMn.push(avg(3)); avgSi.push(avg(4)); avgS.push(avg(5)); avgP.push(avg(6));
      rows.forEach(r => { if (r[1] !== null && r[1] !== "" && [2, 3, 4, 5, 6].some(c => typeof r[c] === "number")) heats.push({ iso: b.iso, heat: String(r[1]), v: [r[2], r[3], r[4], r[5], r[6]] }); });
    }
    // specification per element (same limits as the dashed lines); Si 0.14 has no max/min -> not checked
    const r3 = v => Math.round(v * 1000) / 1000;
    const EL = [
      { name: "%C", idx: 0, color: "#a3271c", bad: v => r3(v) > 0.12 },
      { name: "%Mn", idx: 1, color: "#1e6b3c", bad: v => r3(v) < 0.45 },
      { name: "%Si", idx: 2, color: "#996600", bad: null },
      { name: "%S", idx: 3, color: "#7a1fa2", bad: v => r3(v) > 0.050 },
      { name: "%P", idx: 4, color: "#0b6e99", bad: v => r3(v) > 0.100 }
    ];
    const limitDatasets = Object.entries(CHEM_LIMITS).map(([name, info]) => ({
      label: name, data: labels.map(() => info.value), borderColor: info.color, borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5, noHiLo: true
    }));
    // every out-of-spec HEAT is drawn as a big ✕ at its own value (the lines are only daily averages,
    // so a single bad heat would otherwise be hidden in the average)
    const outDatasets = EL.filter(e => e.bad).map(e => {
      const pts = heats.filter(h => typeof h.v[e.idx] === "number" && e.bad(h.v[e.idx])).map(h => ({ x: h.iso, y: h.v[e.idx], heat: h.heat }));
      return pts.length ? { type: "scatter", label: `${e.name} out of spec (heat)`, data: pts, borderColor: e.color, backgroundColor: e.color,
        pointStyle: "crossRot", pointRadius: 9, pointHoverRadius: 11, borderWidth: 3, showLine: false, clip: false, noHiLo: true } : null;
    }).filter(Boolean);
    document.getElementById("chemChartWrap").classList.remove("hidden");
    const ctx = document.getElementById("chemChart").getContext("2d");
    if (chemChartInstance) chemChartInstance.destroy();
    const avgSeries = [avgC, avgMn, avgSi, avgS, avgP];
    const actual = EL.map(e => ({ label: `${e.name} (daily avg)`, data: avgSeries[e.idx], borderColor: e.color, backgroundColor: "transparent", tension: 0.25, spanGaps: true, noHiLo: true }));
    chemChartInstance = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: [...actual, ...limitDatasets, ...outDatasets] },
      options: { responsive: true, devicePixelRatio: 2, layout: { padding: { top: 12 } },
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } },
          tooltip: { callbacks: { label: (c) => c.raw && c.raw.heat ? `${c.dataset.label}: heat ${c.raw.heat} = ${Number(c.raw.y).toFixed(3)}` : `${c.dataset.label}: ${c.parsed.y == null ? "-" : c.parsed.y.toFixed(3)}` } }
        },
        scales: { y: { beginAtZero: true, title: { display: true, text: "%" } } } }
    });
    // table is heat-wise: highest / lowest heat (with heat no.), average of all heats, heats beyond limit
    chemSummaryRows = EL.map(e => {
      const hv = heats.filter(h => typeof h.v[e.idx] === "number");
      if (!hv.length) return null;
      let hi = hv[0], lo = hv[0], sum = 0;
      hv.forEach(h => { if (h.v[e.idx] > hi.v[e.idx]) hi = h; if (h.v[e.idx] < lo.v[e.idx]) lo = h; sum += h.v[e.idx]; });
      const bad = e.bad ? hv.filter(h => e.bad(h.v[e.idx])) : null;
      return [e.name, hi.v[e.idx].toFixed(3), `${hi.heat} (${hi.iso})`, lo.v[e.idx].toFixed(3), `${lo.heat} (${lo.iso})`, (sum / hv.length).toFixed(3),
        bad ? `${bad.length} of ${hv.length}` + (bad.length ? ": " + bad.slice(0, 6).map(h => `${h.heat}=${h.v[e.idx].toFixed(3)}`).join(", ") + (bad.length > 6 ? " ..." : "") : "") : "-"];
    }).filter(Boolean);
    renderSummaryTable("chemSummary", ["Element", "Highest heat", "Heat (date)", "Lowest heat", "Heat (date)", "Average (all heats)", "Heats beyond limit"], chemSummaryRows,
      `Lines = daily average. ✕ = each heat beyond limit, at its own value. ${heats.length} heat(s), ${labels.length} day(s). Limits: C max 0.12, Mn min 0.45, S max 0.050, P max 0.100 (Si 0.14 not checked).`, 1, 3);
    statusEl.className = "ok";
    statusEl.textContent = `Chemical composition trend loaded for ${fromDate} to ${toDate} (${blocks.length} days across ${wbCount} file(s)).` + (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");
  } catch (e) { statusEl.className = "err"; statusEl.textContent = "Error: " + e.message; }
}

document.getElementById("trendLoadBtn").addEventListener("click", loadTrendChart);

function downloadChartAsPng(chartInstance, filename) {
  if (!chartInstance) return;
  const url = chartInstance.toBase64Image();
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

// Renders a chart into a properly proportioned A4 page (landscape, since
// charts with legends read better wide than tall) and opens it in the same
// preview modal used for the other reports, so it can be checked and printed
// cleanly instead of the cramped raw canvas PNG.
function downloadChartAsPdf(chartInstance, title, filename, summary) {
  if (!chartInstance) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  addLogoHeader(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const availW = pageW - margin * 2;
  const sumH = summary && summary.body.length ? 40 + 18 * summary.body.length : 0; // room for the summary table (+ stamp line)
  const availH = pageH - margin - 34 - sumH; // leave room for the title above

  // Temporarily resize the chart canvas to exactly match the printable
  // area's aspect ratio, so the exported image fills the page edge-to-edge
  // instead of leaving blank letterbox space from a mismatched aspect ratio.
  const canvas = chartInstance.canvas;
  const originalW = canvas.style.width, originalH = canvas.style.height;
  const targetW = 1400;
  const targetH = Math.round(targetW * (availH / availW));
  chartInstance.resize(targetW, targetH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, pageW / 2, 26, { align: "center" });

  const imgData = chartInstance.toBase64Image("image/png", 1.0);
  // pie / doughnut: keep the picture's own proportions so the circle stays round (line/bar charts fill the space as before)
  if (/^(pie|doughnut|polarArea)$/.test((chartInstance.config && chartInstance.config.type) || "")) {
    const cw = canvas.width || targetW, ch = canvas.height || targetH, k = Math.min(availW / cw, availH / ch);
    const iw = cw * k, ih = ch * k; doc.addImage(imgData, "PNG", margin + (availW - iw) / 2, 34 + (availH - ih) / 2, iw, ih);
  } else doc.addImage(imgData, "PNG", margin, 34, availW, availH);
  if (sumH && doc.autoTable) {
    doc.autoTable({ startY: 34 + availH + 4, head: [summary.head], body: summary.body, theme: "grid", margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: 20, lineColor: 150, lineWidth: 0.4 },
      headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold" },
      didParseCell: (d) => { const h = summary.hiCol == null ? 1 : summary.hiCol, l = summary.loCol == null ? 3 : summary.loCol; if (d.section === "body" && d.column.index === h) d.cell.styles.textColor = [30, 142, 62]; if (d.section === "body" && d.column.index === l) d.cell.styles.textColor = [217, 48, 37]; } });
  }

  // restore the chart to its normal on-screen size
  chartInstance.resize();
  if (originalW) canvas.style.width = originalW;
  if (originalH) canvas.style.height = originalH;

  stampLogoOnAllPages(doc);
  showPdfPreview(doc, filename, title);
}

document.getElementById("trendChartDownloadBtn").addEventListener("click", () => {
  downloadChartAsPng(trendChartInstance, "Trend_Chart.png");
});
document.getElementById("trendChartPdfBtn").addEventListener("click", () => {
  downloadChartAsPdf(trendChartInstance, "Production Trend Chart", "Trend_Chart.pdf",
    { head: ["Series", "Highest (MT)", "Date", "Lowest (MT)", "Date", "Average / day (MT)", "Cumulative (MT)"], body: trendSummaryRows });
});

document.getElementById("pieChartDownloadBtn").addEventListener("click", () => {
  downloadChartAsPng(pieChartInstance, "Composition_Pie_Chart.png");
});
document.getElementById("pieChartPdfBtn").addEventListener("click", () => {
  downloadChartAsPdf(pieChartInstance, "Composition Breakdown", "Composition_Pie_Chart.pdf", pdfSummary(CATEGORY_SUMMARY_HEAD, pieSummaryRows, 3, 5));
});

/* ===================== SIZE-WISE BREAKDOWN (130 vs 160) ===================== */
let sizePieChartInstance = null;

document.getElementById("sizeLoadBtn").addEventListener("click", loadSizeBreakdown);
document.getElementById("sizeChartDownloadBtn").addEventListener("click", () => {
  downloadChartAsPng(sizePieChartInstance, "Size_Breakdown.png");
});
document.getElementById("sizeChartPdfBtn").addEventListener("click", () => {
  downloadChartAsPdf(sizePieChartInstance, "Size-wise Breakdown", "Size_Breakdown.pdf", pdfSummary(CATEGORY_SUMMARY_HEAD, sizeSummaryRows, 3, 5));
});

/* ===================== CHEMICAL COMPOSITION MONTHLY TREND ===================== */
let chemChartInstance = null;

// Specification limits (as given): C% max 0.12, Mn% min 0.45, Si% 0.14,
// S% max 0.050, P% max 0.100.
const CHEM_LIMITS = {
  "%C (max 0.12)": { value: 0.12, color: "#a3271c" },
  "%Mn (min 0.45)": { value: 0.45, color: "#1e6b3c" },
  "%Si (0.14)": { value: 0.14, color: "#996600" },
  "%S (max 0.050)": { value: 0.050, color: "#7a1fa2" },
  "%P (max 0.100)": { value: 0.100, color: "#0b6e99" }
};

document.getElementById("chemLoadBtn").addEventListener("click", loadChemicalTrend);
document.getElementById("chemChartDownloadBtn").addEventListener("click", () => {
  downloadChartAsPng(chemChartInstance, "Chemical_Composition_Trend.png");
});
document.getElementById("chemChartPdfBtn").addEventListener("click", () => {
  downloadChartAsPdf(chemChartInstance, "Chemical Composition Monthly Trend", "Chemical_Composition_Trend.pdf", pdfSummary(["Element", "Highest heat", "Heat (date)", "Lowest heat", "Heat (date)", "Average (all heats)", "Heats beyond limit"], chemSummaryRows, 1, 3));
});

/* ---- Dashboard reports as sticky-note JPGs (Daily, Period, MoM, Calendar) ----
   The report is drawn fresh on a white canvas (dark text, works in any app
   theme), then put on the same random-colour sticky note as Billet Stock. */
const SN_W = 1600, SN_PAD = 50;
function snFont(px, bold) { return `${bold ? "700" : "500"} ${px}px Poppins, "Segoe UI", Arial, sans-serif`; }
function snRound(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function snWrap(g, text, maxW) {
  const out = [];
  String(text || "").split(/\n/).forEach(par => {
    let line = "";
    par.split(/\s+/).forEach(w => { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    if (line) out.push(line);
  });
  return out;
}
async function snLogo() {   // company logo from Get Started > Company details (none if not added)
  if (!COMPANY.logo || !reportLogoOn()) return null;
  return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = COMPANY.logo; });
}
// blocks: {cards:[{label,value,tone}]} | {text} | {image: canvas} | {table:[[...]]} | {calendar:{cells,legend}}
async function snRender(title, subtitle, blocks) {
  const c = document.createElement("canvas"); c.width = SN_W; c.height = 6000;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  const inner = SN_W - 2 * SN_PAD;
  let y = SN_PAD;
  const logo = await snLogo();
  if (logo) { let lw = 420, lh = lw * logo.naturalHeight / logo.naturalWidth; if (lh > 140) { lh = 140; lw = lh * logo.naturalWidth / logo.naturalHeight; } g.drawImage(logo, SN_PAD, y, lw, lh); y += lh + 30; }
  g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.font = snFont(52, true); g.fillText(title, SN_W / 2, y + 50); y += 72;
  if (subtitle) { g.font = snFont(34, false); g.fillStyle = "#333"; g.fillText(subtitle, SN_W / 2, y + 36); y += 60; }
  y += 20;
  for (const b of blocks) {
    if (b.text) {
      g.font = snFont(30, false); g.fillStyle = "#333"; g.textAlign = "left";
      snWrap(g, b.text, inner).forEach(l => { g.fillText(l, SN_PAD, y + 32); y += 44; });
      y += 20;
    }
    if (b.cards) {
      const cols = 3, gap = 26, cw = (inner - gap * (cols - 1)) / cols, ch = 190;
      const TONE = { navy: ["#1f3864", "#e8d38a", "#ffffff"], green: ["#2e8b57", "#ffffff", "#ffffff"], orange: ["#d9772b", "#ffffff", "#ffffff"] };
      b.cards.forEach((cd, i) => {
        const x = SN_PAD + (i % cols) * (cw + gap), yy = y + Math.floor(i / cols) * (ch + gap);
        const t = TONE[cd.tone] || TONE.navy;
        g.fillStyle = t[0]; snRound(g, x, yy, cw, ch, 22); g.fill();
        g.textAlign = "center"; g.fillStyle = t[1]; g.font = snFont(28, true);
        snWrap(g, cd.label, cw - 30).slice(0, 2).forEach((l, k) => g.fillText(l, x + cw / 2, yy + 48 + k * 34));
        g.fillStyle = t[2]; g.font = snFont(60, true); g.fillText(cd.value, x + cw / 2, yy + ch - 34);
      });
      y += Math.ceil(b.cards.length / cols) * (ch + gap) + 10;
    }
    if (b.image) {
      const w = inner, h = w * b.image.height / b.image.width;
      g.drawImage(b.image, SN_PAD, y, w, h); y += h + 30;
    }
    if (b.table) {
      const rows = b.table, n = rows[0].length;
      if (b.group) { // [[text, span], ...] drawn above the header row, widths follow the columns
        g.font = snFont(28, false);
        const want0 = Array.from({ length: n }, (_, k) => Math.max(...rows.map(r => g.measureText(String(r[k] || "")).width)) + 40);
        const sum0 = want0.reduce((a, v) => a + v, 0), ws0 = want0.map(v => v * inner / sum0);
        let x = SN_PAD, k = 0;
        b.group.forEach(([txt, span]) => {
          const w = ws0.slice(k, k + span).reduce((a, v) => a + v, 0);
          g.fillStyle = "#dfe5ef"; g.fillRect(x, y, w, 62); g.strokeStyle = "#555"; g.lineWidth = 2; g.strokeRect(x, y, w, 62);
          g.fillStyle = "#111"; g.font = snFont(28, true); g.textAlign = "center"; g.fillText(txt, x + w / 2, y + 41);
          x += w; k += span;
        });
        y += 62;
      }
      g.font = snFont(28, false);
      const want = Array.from({ length: n }, (_, k) => Math.max(...rows.map(r => g.measureText(String(r[k] || "")).width)) + 40);
      const sum = want.reduce((a, v) => a + v, 0), sc = inner / sum;
      const ws = want.map(v => v * sc), rh = 62;
      rows.forEach((r, ri) => {
        let x = SN_PAD;
        r.forEach((v, k) => {
          const txt = String(v || "");
          const cc = b.cellColor ? b.cellColor(ri, k, txt) : null; // {fill, ink}
          if (ri === 0) { g.fillStyle = "#e9edf4"; g.fillRect(x, y, ws[k], rh); }
          else if (cc && cc.fill) { g.fillStyle = cc.fill; g.fillRect(x, y, ws[k], rh); }
          g.strokeStyle = "#555"; g.lineWidth = 2; g.strokeRect(x, y, ws[k], rh);
          g.fillStyle = (cc && cc.ink) || (/^▲/.test(txt) ? "#1e6b3c" : /^▼/.test(txt) ? "#a3271c" : "#111");
          const boldRow = b.boldLast && ri === rows.length - 1;
          g.font = snFont(ri === 0 ? 27 : 28, ri === 0 || boldRow || /^[▲▼]/.test(txt));
          g.textAlign = k === 0 ? "left" : "center";
          g.fillText(txt, k === 0 ? x + 16 : x + ws[k] / 2, y + rh / 2 + 10);
          x += ws[k];
        });
        y += rh;
      });
      y += 30;
    }
    if (b.calendar) {
      const cells = b.calendar.cells, cs = 22, gp = 6, colsN = Math.ceil(cells.length / 7);
      const gridW = colsN * (cs + gp), x0 = SN_PAD + Math.max(0, (inner - gridW) / 2);
      const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      g.font = snFont(22, true); g.fillStyle = "#333"; g.textAlign = "left";
      let lastMon = -1, lastCol = -9;
      cells.forEach((cl, i) => {
        const col = Math.floor(i / 7);
        if (!cl.iso) return;
        const m = +cl.iso.slice(5, 7) - 1;
        if (m !== lastMon) { lastMon = m; if (col - lastCol >= 3) { g.fillText(MON[m], x0 + col * (cs + gp), y + 22); lastCol = col; } }
      });
      const gy = y + 36;
      cells.forEach((cl, i) => {
        if (!cl.color || cl.color === "transparent" || cl.color === "rgba(0, 0, 0, 0)") return;
        const col = Math.floor(i / 7), row = i % 7, x = x0 + col * (cs + gp), yy = gy + row * (cs + gp);
        g.fillStyle = cl.color; snRound(g, x, yy, cs, cs, 4); g.fill();
        if (cl.bad) { g.strokeStyle = "#e63946"; g.lineWidth = 4; snRound(g, x, yy, cs, cs, 4); g.stroke(); }
      });
      y = gy + 7 * (cs + gp) + 24;
      // legend
      g.font = snFont(24, false); g.fillStyle = "#333"; g.textAlign = "left";
      let lx = x0; g.fillText("Less", lx, y + 20); lx += 70;
      ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"].forEach(cc => { g.fillStyle = cc; snRound(g, lx, y, cs, cs, 4); g.fill(); lx += cs + 8; });
      g.fillStyle = "#333"; g.fillText("More", lx + 6, y + 20); lx += 120;
      g.fillStyle = "#ebedf0"; snRound(g, lx, y, cs, cs, 4); g.fill(); g.strokeStyle = "#e63946"; g.lineWidth = 4; g.stroke();
      g.fillStyle = "#333"; g.fillText("Out of spec", lx + cs + 12, y + 20);
      y += 60;
    }
  }
  return { canvas: c, ctx: g };
}
async function snMakeJpg(title, subtitle, blocks, fileName) {
  const { canvas, ctx } = await snRender(title, subtitle, blocks);
  const note = drawStickyNote(canvas, stickyContentBox(ctx, canvas.width, canvas.height));
  const blob = await new Promise(res => note.toBlob(res, "image/jpeg", 0.95));
  showStickyJpgs([{ name: fileName, blob, url: URL.createObjectURL(blob), w: note.width, h: note.height }], title + " - JPG");
}
const snDMY = iso => iso ? iso.split("-").reverse().join(".") : "";
function snCards(wrapId) {
  return [...document.querySelectorAll(`#${wrapId} .dashCard`)].map(cd => ({
    label: (cd.querySelector(".dashLabel") || {}).textContent || "",
    value: ((cd.querySelector(".dashValue") || {}).textContent || "-").trim(),
    tone: cd.classList.contains("dashLightGreen") ? "green" : cd.classList.contains("dashOrange") ? "orange" : "navy"
  }));
}
async function snRun(fn) {
  const st = document.getElementById("status");
  try { st.className = "wait"; st.textContent = "Making sticky-note JPG..."; await fn(); st.className = "ok"; st.textContent = "Sticky-note JPG ready."; }
  catch (e) { st.className = "err"; st.textContent = "JPG error: " + e.message; }
}
document.getElementById("dashDailyJpgBtn").addEventListener("click", () => snRun(async () => {
  const d = document.getElementById("dashDate").value;
  const nar = document.getElementById("insightsNarrative");
  const blocks = [];
  if (nar && !nar.classList.contains("hidden") && nar.textContent.trim()) blocks.push({ text: nar.textContent.trim() });
  blocks.push({ cards: snCards("dashStats") });
  await snMakeJpg("Daily Summary", snDMY(d), blocks, `Daily_Summary_${snDMY(d)}.jpg`);
}));
document.getElementById("dashPeriodJpgBtn").addEventListener("click", () => snRun(async () => {
  const f = document.getElementById("dashFromDate").value, t = document.getElementById("dashToDate").value;
  await snMakeJpg("Period Summary", `${snDMY(f)} to ${snDMY(t)}`, [{ cards: snCards("dashMonthStats") }], `Period_Summary_${snDMY(f)}_to_${snDMY(t)}.jpg`);
}));
document.getElementById("momJpgBtn").addEventListener("click", () => snRun(async () => {
  const blocks = [];
  if (momChartInstance) {
    // Chart.js needs the canvas in the page to size it - keep it off-screen
    const holder = document.createElement("div"); holder.style.cssText = "position:fixed;left:-20000px;top:0;width:1500px;height:760px;";
    const cv = document.createElement("canvas"); cv.width = 1500; cv.height = 760; cv.style.cssText = "width:1500px;height:760px;";
    holder.appendChild(cv); document.body.appendChild(holder);
    const data = JSON.parse(JSON.stringify(momChartInstance.data));
    const ch = new Chart(cv.getContext("2d"), { type: "bar", data, options: {
      responsive: false, animation: false, devicePixelRatio: 1,
      plugins: { legend: { position: "bottom", labels: { color: "#222", font: { size: 26 } } } },
      scales: { x: { ticks: { color: "#222", font: { size: 22 } }, grid: { color: "rgba(0,0,0,.08)" } },
                y: { beginAtZero: true, ticks: { color: "#222", font: { size: 22 } }, grid: { color: "rgba(0,0,0,.12)" } } } } });
    ch.draw();
    const snap = document.createElement("canvas"); snap.width = cv.width; snap.height = cv.height;
    const sg = snap.getContext("2d"); sg.fillStyle = "#fff"; sg.fillRect(0, 0, snap.width, snap.height); sg.drawImage(cv, 0, 0);
    blocks.push({ image: snap });
    ch.destroy(); holder.remove();
  }
  const rows = [...document.querySelectorAll("#momTable tr")].map(tr => [...tr.children].map(td => td.textContent.trim()));
  if (rows.length) blocks.push({ table: rows });
  const m = document.getElementById("momMonth").value;
  const lbl = m ? `${MONTH_ABBR[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}` : "";
  await snMakeJpg("Month-over-Month & Year-over-Year", lbl, blocks, `MoM_${(lbl || "report").replace(/\s+/g, "_")}.jpg`);
}));
document.getElementById("calendarJpgBtn").addEventListener("click", () => snRun(async () => {
  const cells = [...document.querySelectorAll("#calendarGrid .calendarCell")].map(el => ({
    color: el.style.background || el.style.backgroundColor, bad: /e63946|230, 57, 70/i.test(el.style.border || ""),
    iso: ((el.title || "").match(/^\d{4}-\d{2}-\d{2}/) || [""])[0]
  }));
  const isos = cells.map(c => c.iso).filter(Boolean);
  await snMakeJpg("Yearly Production Calendar", isos.length ? `${snDMY(isos[0])} to ${snDMY(isos[isos.length - 1])}` : "", [{ calendar: { cells } }],
    `Yearly_Calendar_${snDMY(isos[isos.length - 1] || "")}.jpg`);
}));

/* ---- Stock Difference (Daily Stock sheet: Manual vs ERP) as sticky note ----
   Daily Stock block (from the date row t): t+1 group headings, t+2 PCS/WEIGHT,
   t+3 .. sizes, then the total row. Columns: A size, N/O manual, P/Q ERP,
   R/S difference. */
async function readDailyStockDiff(token, iso) {
  const [y, m] = iso.split("-").map(Number);
  const path = await detectFilePathForMonth(token, y, m - 1);
  if (!path) throw new Error(`Couldn't find the file for ${MONTH_ABBR[m - 1]} ${y}.`);
  const wb = await resolveWorkbook(token, path);
  const sh = `${wb}/worksheets('${encodeURIComponent(String("Daily Stock").replace(/'/g, "''"))}')`;
  const colA = await graphFetch(`${sh}/range(address='A1:A2000')?$select=values`, token);
  let top = -1;
  colA.values.forEach((r, i) => { if (typeof r[0] === "number" && r[0] > 40000 && excelSerialToISODate(r[0]) === iso) top = i + 1; });
  if (top < 0) throw new Error(`No Daily Stock block for ${iso.split("-").reverse().join(".")}.`);
  const blk = await graphFetch(`${sh}/range(address='A${top}:S${top + 17}')?$select=text,values`, token);
  const rows = [];
  for (let i = 3; i < blk.text.length; i++) {
    const t = blk.text[i], v = blk.values[i];
    const size = String(t[0] || "").trim();
    const hasNums = [13, 14, 15, 16].some(k => String(t[k] || "").trim() !== "");
    if (!size && !hasNums) { if (rows.length) break; else continue; }
    const num = x => typeof x === "number" ? x : null;
    rows.push({ size: size || "TOTAL", isTotal: !size, cells: [t[13], t[14], t[15], t[16], t[17], t[18]].map(x => String(x == null ? "" : x).trim()),
      mPcs: num(v[13]), mWt: num(v[14]), ePcs: num(v[15]), eWt: num(v[16]),
      diffPcs: num(v[17]), diffWt: num(v[18]) });
    if (!size) break; // total row ends the block
  }
  if (!rows.length) throw new Error("Daily Stock block found but no size rows.");
  return rows;
}

// Manual stock recalculated from WHOLE pieces (nearest), per user's rule:
// weight/m: 130 = 0.132335, 160 = 0.198005, 110 = 0.095 (110 and RAN rows are
// already in METRES, so weight = metres x weight/m; other rows: pcs x length x weight/m).
const SD_WPM = { 110: 0.095, 130: 0.132335, 160: 0.198005 };
function sdSizeInfo(size) {
  const t = String(size).toUpperCase().replace(/\s+/g, "");
  let m = t.match(/^RAN(110|130|160)$/);
  if (m) return { sec: +m[1], len: null };                // random length: value is metres
  m = t.match(/^(110|130|160)X([\d.]+)$/);
  if (!m) return null;
  return +m[1] === 110 ? { sec: 110, len: null } : { sec: +m[1], len: +m[2] };   // 110 billets kept in metres
}
function sdRecalc(rows) {
  const f3 = x => x == null ? "" : x.toFixed(3);
  let tM = 0, tE = 0, tD = 0, tEp = 0, tMp = 0;
  const out = [];
  rows.forEach(r => {
    if (r.isTotal) return;
    const info = sdSizeInfo(r.size);
    if (!info || r.mPcs == null) {         // unknown size: keep the sheet's own values
      if (![r.mPcs, r.mWt, r.ePcs, r.eWt].some(v => v)) return;   // all zero / empty: leave the row out of the report
      out.push(r); if (r.mWt != null) tM += r.mWt; if (r.eWt != null) tE += r.eWt; return;
    }
    const pcs = Math.round(r.mPcs);
    const wt = info.len ? pcs * info.len * SD_WPM[info.sec] : pcs * SD_WPM[info.sec];
    const ePcs = r.ePcs == null ? 0 : r.ePcs, eWt = r.eWt == null ? 0 : r.eWt;
    const dP = pcs - Math.round(ePcs), dW = +(wt - eWt).toFixed(3);
    if (!pcs && !Math.round(ePcs) && !+wt.toFixed(3) && !+eWt.toFixed(3)) return;   // nothing in stock (manual and ERP both 0): leave the row out
    tM += wt; tE += eWt; tD += dW; tMp += pcs; tEp += ePcs;
    out.push({ size: r.size, isTotal: false, mPcs: pcs, mWt: wt, ePcs, eWt, diffPcs: dP, diffWt: dW,
      cells: [String(pcs), f3(wt), String(Math.round(ePcs)), f3(eWt), String(dP), dW === 0 ? "" : f3(dW)] });
  });
  const dT = +(tM - tE).toFixed(3);
  out.push({ size: "TOTAL", isTotal: true, diffPcs: null, diffWt: dT, cells: ["", f3(tM), "", f3(tE), "", f3(dT)] });
  return out;
}

function sdTableHtml(rows, iso) {
  const esc = x => String(x).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const col = (r, k) => { const d = k === 4 ? r.diffPcs : k === 5 ? r.diffWt : null;
    return d == null || d === 0 ? "" : d < 0 ? "color:#a3271c;font-weight:700;" : "color:#1e6b3c;font-weight:700;"; };
  return `<table class="matrixTable"><tr><th rowspan="2">SIZE</th><th colspan="2">MANUAL STOCK</th><th colspan="2">ERP STOCK</th><th colspan="2">DIFFERENCE</th></tr>
    <tr><th>PCS</th><th>WEIGHT</th><th>PCS</th><th>WEIGHT</th><th>PCS</th><th>WEIGHT</th></tr>` +
    rows.map(r => `<tr${r.isTotal ? ' style="font-weight:700;"' : ""}><td>${esc(r.size)}</td>${r.cells.map((c, k) => `<td style="${col(r, k)}">${esc(c)}</td>`).join("")}</tr>`).join("") + "</table>";
}
document.getElementById("sdJpgBtn").addEventListener("click", () => snRun(async () => {
  const iso = document.getElementById("sdDate").value;
  if (!iso) throw new Error("Please select a date.");
  const token = await getToken();
  const rows = sdRecalc(await readDailyStockDiff(token, iso));
  document.getElementById("sdTableWrap").innerHTML = sdTableHtml(rows, iso) +
    '<p style="font-size:12px;color:var(--muted);margin-top:6px;">Manual weight = whole pcs (nearest) × length × wt/m — 130: 0.132335, 160: 0.198005, 110 & RAN: metres × wt/m (110: 0.095).</p>';
  const table = [["SIZE", "PCS", "WEIGHT", "PCS", "WEIGHT", "PCS", "WEIGHT"]].concat(rows.map(r => [r.size].concat(r.cells)));
  await snMakeJpg("Stock Difference - Manual vs ERP", snDMY(iso), [{
    table, group: [["", 1], ["MANUAL STOCK", 2], ["ERP STOCK", 2], ["DIFFERENCE", 2]], boldLast: rows[rows.length - 1].isTotal,
    cellColor: (ri, k) => {
      if (ri === 0) return null;
      const r = rows[ri - 1], d = k === 5 ? r.diffPcs : k === 6 ? r.diffWt : null;
      if (d == null || d === 0) return null;
      return d < 0 ? { fill: k === 6 ? "#f6c9cc" : null, ink: "#a3271c" } : { ink: "#1e6b3c" };
    }
  }, { text: "Manual weight = whole pcs × length × wt/m  (130: 0.132335 · 160: 0.198005 · 110 & RAN in metres, 110: 0.095)" }],
  `Stock_Difference_${snDMY(iso)}.jpg`);
}));
(function sdDefaultDate() { const el = document.getElementById("sdDate"); if (el && !el.value) { const d = new Date(); d.setDate(d.getDate() - 1); el.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; } })();

