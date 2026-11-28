/* ===================== SOP / WI TAB ===================== */
/* ---- Requirement list (chemicals / glassware / instruments / consumables) for selected SOP / WI ---- */
const SOP_REQ_CATS = [["c", "Chemicals", "रसायन"], ["g", "Glassware / Labware", "काँच के बर्तन / लैब सामान"], ["i", "Instruments / Equipment", "उपकरण"], ["k", "Consumables", "उपभोग्य सामग्री"]];
const sopReqSel = new Set();
function sopReqShortNo(id) { return id.replace("-", "/"); }
const SOP_REQ_SPEC = { c: false, g: true, i: false, k: true }; // show size/spec only for glassware and consumables
// volumetric glassware: show only the capacities, e.g. "100, 250, 500, 1000 ml"
const SOP_REQ_VOL = /beaker|flask|pipette|burette|cylinder|platinum dish|crucible|casserole|^bottle$|absorption bottle|reaction bottle/i;
function sopReqCaps(name, specs) {
  const nat = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  if (!SOP_REQ_VOL.test(name)) return specs.sort(nat);
  const vols = new Set(), other = [];
  specs.forEach(sp => {
    const rg = sp.match(/\d+\s*to\s*\d+\s*(ml|litres?)/i); if (rg) { other.push(rg[0]); return; }
    const re = /(\d+(?:[ ,]\d{3})*(?:\.\d+)?)\s*(ml|cc|litres?|l)\b/gi; let mm, hit = false;
    while ((mm = re.exec(sp))) {
      hit = true; let v = parseFloat(mm[1].replace(/[ ,]/g, ""));
      if (/^l/i.test(mm[2])) v *= 1000;
      vols.add(v);
    }
    if (!hit && !/^(or |weighed|tared|clean)/i.test(sp)) other.push(sp);
  });
  const out = [];
  if (vols.size) out.push([...vols].sort((a, b) => a - b).join(", ") + " ml");
  return out.concat(other.sort(nat));
}
function sopReqMerge(ids) {
  // one row per item name (never repeated); for glassware / consumables all sizes go in one cell
  const out = {}, nat = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  SOP_REQ_CATS.forEach(([k]) => {
    const m = new Map();
    ids.forEach(id => (SOP_REQ[id] && SOP_REQ[id][k] || []).forEach(([n, sp]) => {
      const key = n.trim().toLowerCase();
      if (!m.has(key)) m.set(key, { n: n.trim(), sizes: new Map() });
      const t = (sp || "").trim();
      if (t && !m.get(key).sizes.has(t.toLowerCase())) m.get(key).sizes.set(t.toLowerCase(), t);
    }));
    out[k] = [...m.values()].sort((a, b) => nat(a.n, b.n)).map(r => ({ n: r.n, sizes: k === "g" ? sopReqCaps(r.n, [...r.sizes.values()]) : [...r.sizes.values()].sort(nat) }));
  });
  return out;
}
function sopReqIds() { return SOP_LIST.map(x => x.id).filter(id => sopReqSel.has(id)); }
function sopReqRenderOpts() {
  const box = document.getElementById("sopReqOpts"); if (!box) return;
  const q = (document.getElementById("sopReqSearch").value || "").trim().toLowerCase();
  const lang = sopLang();
  const list = SOP_LIST.filter(x => !q || (x.no + " " + x.cat + " " + x.en.title + " " + (x.hi ? x.hi.title : "")).toLowerCase().includes(q));
  const cats = [...new Set(list.map(x => x.cat))];
  box.innerHTML = cats.map(c => {
    const items = list.filter(x => x.cat === c);
    const all = items.every(x => sopReqSel.has(x.id));
    return `<div style="margin:6px 0 2px;font-weight:700;font-size:13px;display:flex;gap:8px;align-items:center">
      <label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" class="sopReqGrp" data-cat="${_escH(c)}" ${all ? "checked" : ""} style="width:auto;margin:0">${_escH(c)}</label></div>` +
      items.map(x => `<label style="display:flex;gap:8px;align-items:flex-start;padding:3px 0 3px 18px;font-size:13px;cursor:pointer">
        <input type="checkbox" class="sopReqOpt" value="${x.id}" ${sopReqSel.has(x.id) ? "checked" : ""} style="width:auto;margin:2px 0 0">
        <span><b>${_escH(x.no.replace("DM/QA/", ""))}</b> ${sopMk(sopDocOf(x, lang).short_title || x.en.short_title)}</span></label>`).join("");
  }).join("") || `<div style="font-size:13px;color:var(--muted)">No match.</div>`;
}
function sopReqRenderChips() {
  const ids = sopReqIds();
  document.getElementById("sopReqSum").textContent = ids.length ? `${ids.length} SOP / WI selected ▾` : "Select SOP / WI ▾";
  document.getElementById("sopReqChips").innerHTML = ids.map(id => `<span style="font-size:12px;padding:3px 8px;border-radius:12px;background:rgba(128,128,128,.18)">${sopReqShortNo(id)} <a href="#" class="sopReqDel" data-id="${id}" style="text-decoration:none">✕</a></span>`).join("");
}
function sopReqRender() {
  const out = document.getElementById("sopReqOut"), ids = sopReqIds();
  if (!ids.length) { out.innerHTML = `<div style="font-size:13px;color:var(--muted)">Select at least one SOP / WI.</div>`; return; }
  const m = sopReqMerge(ids), hi = sopLang() === "hi";
  const td = "border:1px solid rgba(128,128,128,.5);padding:3px 5px;text-align:left";
  out.innerHTML = SOP_REQ_CATS.map(([k, en, h]) => `<h4 style="margin:12px 0 4px">${hi ? `${h} (${en})` : en} — ${m[k].length}</h4>` +
    (m[k].length ? `<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:12px;width:100%"><tr>${["#", "Item"].concat(SOP_REQ_SPEC[k] ? ["Size / specification"] : []).map(t => `<th style="${td}">${t}</th>`).join("")}</tr>` +
      m[k].map((r, i) => `<tr><td style="${td};width:28px">${i + 1}</td><td style="${td}">${_escH(r.n)}</td>${SOP_REQ_SPEC[k] ? `<td style="${td}">${r.sizes.map(_escH).join(", ")}</td>` : ""}</tr>`).join("") + `</table></div>`
      : `<div style="font-size:12px;color:var(--muted)">None named in the selected documents.</div>`)).join("");
}
function sopReqPdfTxt(t) { // jsPDF standard fonts only print Latin-1 / WinAnsi
  return String(t).replace(/ρ/g, "rho").replace(/[−‐]/g, "-").replace(/α/g, "alpha").replace(/β/g, "beta").replace(/μ/g, "µ")
    .replace(/[₀-₉]/g, c => String(c.charCodeAt(0) - 0x2080)).replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/→/g, "->");
}
function sopReqPdf() {
  const ids = sopReqIds();
  if (!ids.length) { sopReqRender(); return; }
  if (!window.jspdf) { alert("PDF library not loaded. Check internet and try again."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), M = 36, m = sopReqMerge(ids);
  const today = new Date().toLocaleDateString("en-GB");
  const head = () => {
    doc.setDrawColor(0); doc.setLineWidth(0.8); doc.rect(M, 24, W - 2 * M, 44);
    doc.line(M + 150, 24, M + 150, 68); doc.line(W - M - 120, 24, W - M - 120, 68);
    doc.setFont("times", "bold"); doc.setFontSize(15); doc.setTextColor(0); doc.text("Durgesh Mishra", M + 75, 51, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.text("Requirement List", (M + 150 + W - M - 120) / 2, 43, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text("Chemicals, Glassware, Instruments & Consumables", (M + 150 + W - M - 120) / 2, 57, { align: "center" });
    doc.setFontSize(9); doc.text("Department: Quality", W - M - 114, 42); doc.text("Date: " + today, W - M - 114, 57);
  };
  let y = 84;
  const tbl = (title, headRow, body, widths) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0);
    if (y > doc.internal.pageSize.getHeight() - 90) { doc.addPage(); y = 84; }
    doc.text(title, M, y); y += 6;
    if (!body.length) { doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.text("None named in the selected documents.", M, y + 10); y += 26; return; }
    doc.autoTable({ startY: y, head: [headRow], body, margin: { left: M, right: M, top: 84, bottom: 40 }, theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 3, textColor: 0, lineColor: 120, lineWidth: 0.4, overflow: "linebreak" },
      headStyles: { fillColor: [232, 232, 232], textColor: 0, fontStyle: "bold" },
      columnStyles: widths, didDrawPage: head });
    y = doc.lastAutoTable.finalY + 18;
  };
  head();
  tbl("Selected documents", ["Doc. No.", "Title"], ids.map(id => { const x = SOP_LIST.find(z => z.id === id); return [x.no, sopReqPdfTxt(x.en.title.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&"))]; }), { 0: { cellWidth: 92 } });
  SOP_REQ_CATS.forEach(([k, en]) => tbl(`${en} (${m[k].length})`, ["#", "Item"].concat(SOP_REQ_SPEC[k] ? ["Size / specification"] : []),
    m[k].map((r, i) => [i + 1, sopReqPdfTxt(r.n)].concat(SOP_REQ_SPEC[k] ? [sopReqPdfTxt(r.sizes.join(", "))] : [])),
    SOP_REQ_SPEC[k] ? { 0: { cellWidth: 24 }, 1: { cellWidth: 190 } } : { 0: { cellWidth: 24 } }));
  doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(80);
  if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); head(); y = 84; }
  doc.text("Each item is listed once. Chemical grades / strengths are given in the respective WI. Quantities to stock are not given in the documents.", M, y);
  const n = doc.internal.getNumberOfPages();
  for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(0); doc.text(`Page ${p} of ${n}`, W - M, doc.internal.pageSize.getHeight() - 22, { align: "right" }); }
  const fname = "Requirement_List_" + (ids.length <= 4 ? ids.join("_") : ids.length + "_docs") + ".pdf";
  if (typeof showPdfPreview === "function") showPdfPreview(doc, fname, "Requirement List"); else doc.save(fname);
}
document.addEventListener("change", (ev) => {
  const t = ev.target;
  if (t.classList && t.classList.contains("sopReqOpt")) { t.checked ? sopReqSel.add(t.value) : sopReqSel.delete(t.value); sopReqRenderOpts(); sopReqRenderChips(); }
  else if (t.classList && t.classList.contains("sopReqGrp")) {
    SOP_LIST.filter(x => x.cat === t.dataset.cat).forEach(x => t.checked ? sopReqSel.add(x.id) : sopReqSel.delete(x.id));
    sopReqRenderOpts(); sopReqRenderChips();
  }
});
document.addEventListener("click", (ev) => {
  const d = ev.target.closest && ev.target.closest(".sopReqDel");
  if (d) { ev.preventDefault(); sopReqSel.delete(d.dataset.id); sopReqRenderOpts(); sopReqRenderChips(); if (document.getElementById("sopReqOut").innerHTML) sopReqRender(); }
});
mzAfterLoad(() => {
  if (!document.getElementById("sopReqOpts")) return;
  document.getElementById("sopReqSearch").addEventListener("input", sopReqRenderOpts);
  document.getElementById("sopReqShow").addEventListener("click", () => { document.getElementById("sopReqPick").open = false; sopReqRender(); });
  document.getElementById("sopReqPdf").addEventListener("click", () => { document.getElementById("sopReqPick").open = false; sopReqPdf(); });
  document.getElementById("sopReqClear").addEventListener("click", () => { sopReqSel.clear(); sopReqRenderOpts(); sopReqRenderChips(); document.getElementById("sopReqOut").innerHTML = ""; });
  sopReqRenderOpts(); sopReqRenderChips();
});

function renderSopList() {
  const box = document.getElementById("sopList");
  if (!box) return;
  const lang = sopLang();
  document.querySelectorAll("#sopLangSw button").forEach(b => { b.className = b.dataset.l === lang ? "" : "secondary"; });
  const q = (document.getElementById("sopSearch").value || "").trim().toLowerCase();
  if (typeof sopReqRenderOpts === "function" && document.getElementById("sopReqOpts")) sopReqRenderOpts();
  const list = SOP_LIST.filter(x => !q || (x.no + " " + sopPlainText(x)).toLowerCase().includes(q));
  if (!list.length) { box.innerHTML = `<div style="color:var(--muted);font-size:13px;">${!SOP_LOADED ? "Loading SOP / WI…" : SOP_LIST.length ? `No SOP / WI matches "${_escH(q)}".` : "No SOP added yet."}</div>`; return; }
  const cats = [...new Set(list.map(x => x.cat))];
  const openCats = window.__sopOpenCats || (window.__sopOpenCats = new Set());
  // only the material groups show; tap one to see its SOP / WI. While searching, groups with a match open by themselves.
  box.innerHTML = cats.map(c => `<details class="sopCat" data-cat="${_escH(c)}"${q || openCats.has(c) ? " open" : ""}>
    <summary>${_escH(c)} <span class="sopCatN">(${list.filter(x => x.cat === c).length})</span></summary><div class="sopCatBody">` + list.filter(x => x.cat === c).map(x => `
    <details class="stdItem sopItem" data-id="${x.id}">
      <summary><span class="stdNo">${_escH(x.no)}</span><span class="stdTitle" lang="${lang}">${sopMk(sopDocOf(x, lang).title)}</span></summary>
      <div class="stdBody"></div>
    </details>`).join("") + `</div></details>`).join("");
  if (!q) box.querySelectorAll(".sopCat").forEach(d => d.addEventListener("toggle", () => {
    if (d.open) openCats.add(d.dataset.cat); else openCats.delete(d.dataset.cat);
  }));
  box.querySelectorAll(".sopItem").forEach(d => d.addEventListener("toggle", () => {
    const body = d.querySelector(".stdBody");
    if (d.open && !body.dataset.done) { body.innerHTML = sopDetailHtml(d.dataset.id); body.dataset.done = "1"; }
  }));
}

document.getElementById("sopSearch").addEventListener("input", renderSopList);
renderSopList();
// the SOP / WI list is a separate file, so the app page opens without it; it arrives a moment later (kept on the phone)
(function loadSopList(tries) {
  fetch("data/sop_list.json").then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
    .then(a => { SOP_LIST = Array.isArray(a) ? a : []; SOP_LOADED = true; _qIndex = null; renderSopList(); })
    .catch(e => {
      if (tries < 3) return setTimeout(() => loadSopList(tries + 1), 4000 * (tries + 1));
      SOP_LOADED = true; const b = document.getElementById("sopList");
      if (b) b.innerHTML = `<div style="color:var(--muted);font-size:13px;">The SOP / WI list couldn't load (${_escH(e.message)}) - check the internet and reopen the app.</div>`;
    });
})(0);

(() => { const d = new Date(); d.setMonth(d.getMonth() - 1);
  document.getElementById("misMonth").value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();

async function scanOutOfSpecHeats(sheetName0, fromDate, toDate, statusEl, token, readOpts) {
  const { results: wbList, missing } = await getWorkbooksForRange(token, fromDate, toDate, { allCru: true });

  if (wbList.length === 0) {
    return { flaggedHeats: [], totalHeatsScanned: 0, missing, noFiles: true };
  }

  const flaggedHeats = [];
  let totalHeatsScanned = 0;

  for (let wIdx = 0; wIdx < wbList.length; wIdx++) {
    const sub = wbList[wIdx];
    const sheetName = xlSheetFor(sheetName0, sub.cru);   // crucible B / C: Prod. B …
    if (statusEl) statusEl.textContent = `Scanning heats... (${wIdx + 1}/${wbList.length} file(s))`;

    // Fetch the whole month's A:AB data in one call (C-G for chemistry, AB
    // for tonnage) - much faster than one small call per date.
    const data = await graphFetch(
      `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:AB2000')?$select=values`,
      token, readOpts || {}
    );
    const values = data.values;
    const blocks = [];
    for (let i = 0; i < values.length; i++) {
      const v = values[i][0];
      if (typeof v === "number") {
        const iso = excelSerialToISODate(v);
        if (iso >= sub.fromDate && iso <= sub.toDate) blocks.push({ dataStart: i, iso });
      }
    }

    for (const block of blocks) {
      const blockRows = values.slice(block.dataStart, block.dataStart + heatsAt(values, block.dataStart));
      blockRows.forEach(row => {
        const heatNo = row[1];
        if (!heatNo) return; // blank heat row
        totalHeatsScanned++;
        const issues = checkOutOfSpec(row);
        if (issues.length > 0) {
          flaggedHeats.push({
            date: block.iso, heatNo,
            c: row[2], mn: row[3], si: row[4], s: row[5], p: row[6],
            tonnage: typeof row[27] === "number" ? row[27] : 0, // AB
            issueList: CHEM_SPEC_LIMITS.filter(spec => {
              const raw = row[spec.colOffset];
              if (typeof raw !== "number") return false;
              const v = Math.round(raw * 1000) / 1000;
              return (spec.type === "max" && v > spec.value) || (spec.type === "min" && v < spec.value);
            }).map(spec => spec.key),
            issues: issues.join(", ")
          });
        }
      });
    }
  }

  flaggedHeats.sort((a, b) => a.date.localeCompare(b.date));
  return { flaggedHeats, totalHeatsScanned, missing, noFiles: false };
}

let chemSpecReasonChartInstance = null;

async function loadChemSpecDashboard() {
  const statusEl = document.getElementById("status");
  const sheetName = document.getElementById("chemSpecSheetName").value.trim();
  const fromDate = document.getElementById("chemSpecFromDate").value;
  const toDate = document.getElementById("chemSpecToDate").value;

  if (!fromDate || !toDate) {
    statusEl.className = "err";
    statusEl.textContent = "Please select both From Date and To Date.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Locating the file(s) for this date range...";
  document.getElementById("chemSpecDashWrap").classList.add("hidden");

  try {
    const token = await getToken();
    const { flaggedHeats, totalHeatsScanned, missing, noFiles } = await scanOutOfSpecHeats(sheetName, fromDate, toDate, statusEl, token);

    if (noFiles) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't find a file for any month in this range (${missing.join(", ")}).`;
      return;
    }

    const totalTonnage = flaggedHeats.reduce((s, h) => s + h.tonnage, 0);
    const pctOfAll = totalHeatsScanned > 0 ? (flaggedHeats.length / totalHeatsScanned * 100) : 0;

    document.getElementById("chemSpecTotalHeats").textContent = flaggedHeats.length;
    document.getElementById("chemSpecTotalTonnage").textContent = totalTonnage.toFixed(3);
    document.getElementById("chemSpecPctOfAll").textContent = pctOfAll.toFixed(1) + "%";

    // Month-wise breakdown
    const byMonth = {}; // { "2026-08": { count, tonnage, C, S, P } }
    flaggedHeats.forEach(h => {
      const m = h.date.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { count: 0, tonnage: 0, C: 0, S: 0, P: 0 };
      byMonth[m].count++;
      byMonth[m].tonnage += h.tonnage;
      h.issueList.forEach(key => { byMonth[m][key]++; });
    });

    const monthTable = document.getElementById("chemSpecMonthTable");
    monthTable.innerHTML = "<tr><th>Month</th><th>Out-of-Spec Heats</th><th>Tonnage (MT)</th><th>C Failures</th><th>S Failures</th><th>P Failures</th></tr>";
    monthTable.innerHTML += Object.keys(byMonth).sort().map(m => {
      const d = byMonth[m];
      return `<tr><td>${htmlEsc(m)}</td><td>${d.count}</td><td>${d.tonnage.toFixed(3)}</td><td>${d.C}</td><td>${d.S}</td><td>${d.P}</td></tr>`;
    }).join("");

    // Reason breakdown chart (total failures per parameter, across the whole range)
    const reasonTotals = { C: 0, S: 0, P: 0 };
    flaggedHeats.forEach(h => h.issueList.forEach(key => { reasonTotals[key]++; }));

    const ctx = document.getElementById("chemSpecReasonChart").getContext("2d");
    if (chemSpecReasonChartInstance) chemSpecReasonChartInstance.destroy();
    chemSpecReasonChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["%C over limit", "%S over limit", "%P over limit"],
        datasets: [{ label: "Number of heats", data: [reasonTotals.C, reasonTotals.S, reasonTotals.P], backgroundColor: ["#a3271c", "#7a1fa2", "#0b6e99"] }]
      },
      options: { responsive: true, devicePixelRatio: 2, plugins: { legend: { display: false } } }
    });

    // Detailed flagged-heats table
    const detailTable = document.getElementById("chemSpecDetailTable");
    detailTable.innerHTML = "<tr><th>Date</th><th>Heat No</th><th>Tonnage</th><th>%C</th><th>%S</th><th>%P</th><th>Out of Spec</th></tr>";
    detailTable.innerHTML += flaggedHeats.map(h =>
      `<tr><td>${htmlEsc(h.date)}</td><td>${_escH(h.heatNo)}</td><td>${h.tonnage.toFixed(3)}</td><td>${_escH(h.c)}</td><td>${_escH(h.s)}</td><td>${_escH(h.p)}</td><td style="text-align:left;color:#a3271c;font-weight:700;">${_escH(h.issues)}</td></tr>`).join("");

    document.getElementById("chemSpecDashWrap").classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = `Found ${flaggedHeats.length} out-of-spec heat(s) out of ${totalHeatsScanned} scanned, from ${fromDate} to ${toDate}.` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("chemSpecLoadBtn").addEventListener("click", loadChemSpecDashboard);

async function downloadChemSpecReportPDF() {
  const statusEl = document.getElementById("status");
  const sheetName = document.getElementById("chemSpecSheetName").value.trim();
  const fromDate = document.getElementById("chemSpecFromDate").value;
  const toDate = document.getElementById("chemSpecToDate").value;

  if (!fromDate || !toDate) {
    statusEl.className = "err";
    statusEl.textContent = "Please select both From Date and To Date.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Locating the file(s) for this date range...";

  try {
    const token = await getToken();
    const { flaggedHeats, missing, noFiles } = await scanOutOfSpecHeats(sheetName, fromDate, toDate, statusEl, token);

    if (noFiles) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't find a file for any month in this range (${missing.join(", ")}).`;
      return;
    }

    if (flaggedHeats.length === 0) {
      statusEl.className = "ok";
      statusEl.textContent = `No out-of-spec heats found from ${fromDate} to ${toDate} - everything is within limits.`;
      return;
    }

    const rows = flaggedHeats.map(h => [
      h.date, h.heatNo, h.tonnage.toFixed(3), h.c, h.mn, h.si, h.s, h.p, h.issues
    ]);
    lastReportRows = rows;
    lastReportHeaders = ["Date", "Heat No", "Tonnage", "%C", "%Mn", "%Si", "%S", "%P", "Out of Spec"];

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    addLogoHeader(doc);
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(163, 39, 28);
    doc.text("Out-of-Spec Chemistry Report", pageW / 2, 26, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);
    doc.text(`Period: ${fromDate} to ${toDate}  |  Limits: C max 0.12, S max 0.050, P max 0.100`, pageW / 2, 42, { align: "center" });

    doc.autoTable({
      head: [["Date", "Heat No", "Tonnage", "%C", "%Mn", "%Si", "%S", "%P", "Out of Spec"]],
      body: rows,
      startY: 52,
      styles: { fontSize: 8.5, cellPadding: 4, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.5 },
      headStyles: { fillColor: [163, 39, 28], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [253, 240, 238] },
      theme: "grid",
      margin: { left: 25, right: 25 },
      columnStyles: { 8: { halign: "left", fontStyle: "bold", textColor: [163, 39, 28] } }
    });

    stampLogoOnAllPages(doc);
    showPdfPreview(doc, `OutOfSpec_Chemistry_${fromDate}_to_${toDate}.pdf`, `Out-of-Spec Chemistry - ${fromDate} to ${toDate}`);

    statusEl.className = "ok";
    statusEl.textContent = `Found ${flaggedHeats.length} out-of-spec heat(s) from ${fromDate} to ${toDate}.` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("chemSpecPdfBtn").addEventListener("click", downloadChemSpecReportPDF);

/* ===================== ERP PRODUCTION (FC Report C24) ===================== */
let erpProdData = null;

/* ===================== SI DEBIT NOTE (single running file, not month-wise) ===================== */
const DEBIT_NOTE_FILE_PATH = "Desktop/Debit Note Data 26-27.xlsm";
let debitNoteData = null;

// Converts an Excel serial datetime (or a date-like string) to a
// "YYYY-MM-DD" string for range comparisons, and returns a readable
// display string separately.
function excelSerialToDateTimeParts(value) {
  if (typeof value === "number") {
    const utcDays = Math.floor(value - 25569);
    const utcMs = utcDays * 86400 * 1000;
    const date = new Date(utcMs);
    const fractionalDay = value - Math.floor(value);
    const totalSeconds = Math.round(fractionalDay * 86400);
    const hh = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const iso = date.toISOString().slice(0, 10);
    const display = `${date.toLocaleDateString("en-GB")} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    return { iso, display };
  }
  // Fallback: already a text date - use as-is, best-effort ISO extraction.
  const text = (value || "").toString();
  return { iso: text.slice(0, 10), display: text };
}

async function getDebitNoteData(token) {
  const wb = await resolveWorkbook(token, DEBIT_NOTE_FILE_PATH);
  const sheetsData = await graphFetch(`${wb}/worksheets?$select=name`, token);
  const sheetName = sheetsData.value[0].name; // first sheet, whatever it's named
  const data = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:Q5000')?$select=values`, token);
  const rows = data.values;

  const entries = [];
  for (let i = 1; i < rows.length; i++) { // skip header row
    const row = rows[i];
    const party = (row[1] || "").toString().trim(); // B
    if (!party) continue;
    const vehicle = (row[4] || "").toString().trim(); // E
    const weight = typeof row[7] === "number" ? row[7] : 0; // H
    const debitNote = row[13]; // N
    const gst = row[14]; // O
    const dateVal = row[16]; // Q
    const { iso, display } = excelSerialToDateTimeParts(dateVal);
    entries.push({ party, vehicle, weight, debitNote, gst, dateIso: iso, dateDisplay: display });
  }
  return entries;
}

async function loadDebitNoteData() {
  const statusEl = document.getElementById("status");
  const fromDate = document.getElementById("debitFromDate").value;
  const toDate = document.getElementById("debitToDate").value;

  statusEl.className = "wait";
  statusEl.textContent = "Reading debit note data...";
  document.getElementById("debitWrap").classList.add("hidden");

  try {
    const token = await getToken();
    let entries = await getDebitNoteData(token);

    if (fromDate) entries = entries.filter(e => e.dateIso >= fromDate);
    if (toDate) entries = entries.filter(e => e.dateIso <= toDate);

    if (entries.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = "No debit note entries found for this range.";
      return;
    }

    // Party-wise totals
    const partyTotals = {}; // { party: { count, weight } }
    entries.forEach(e => {
      if (!partyTotals[e.party]) partyTotals[e.party] = { count: 0, weight: 0 };
      partyTotals[e.party].count += 1;
      partyTotals[e.party].weight += e.weight;
    });
    const grandTotalWeight = entries.reduce((s, e) => s + e.weight, 0);
    const grandTotalDeduction = entries.reduce((s, e) => s + (typeof e.debitNote === "number" ? e.debitNote : 0), 0);
    const grandTotalGst = entries.reduce((s, e) => s + (typeof e.gst === "number" ? e.gst : 0), 0);
    const partyRows = Object.keys(partyTotals).map(party => ({
      party,
      count: partyTotals[party].count,
      weight: partyTotals[party].weight,
      pct: grandTotalWeight > 0 ? (partyTotals[party].weight / grandTotalWeight * 100) : 0
    })).sort((a, b) => b.weight - a.weight); // highest first

    debitNoteData = { fromDate, toDate, entries, partyRows, grandTotalWeight, grandTotalDeduction, grandTotalGst };

    document.getElementById("debitTotalEntries").textContent = entries.length;
    document.getElementById("debitTotalWeight").textContent = grandTotalWeight.toFixed(3);
    document.getElementById("debitTotalDeduction").textContent = grandTotalDeduction.toFixed(2);
    document.getElementById("debitTotalGst").textContent = grandTotalGst.toFixed(2);
    document.getElementById("debitTopParty").textContent = partyRows.length > 0 ? partyRows[0].party : "-";

    const partyTable = document.getElementById("debitPartyTable");
    partyTable.innerHTML = "<tr><th>Party</th><th>Entries</th><th>Total Weight</th><th>% Share</th></tr>";
    partyRows.forEach(r => {
      partyTable.innerHTML += `<tr><td>${_escH(r.party)}</td><td>${r.count}</td><td>${r.weight.toFixed(3)}</td><td>${r.pct.toFixed(2)}%</td></tr>`;
    });

    const fullTable = document.getElementById("debitFullTable");
    fullTable.innerHTML = "<tr><th>Party</th><th>Vehicle No.</th><th>Weight</th><th>Debit Note</th><th>GST</th><th>Date/Time</th></tr>";
    entries.forEach(e => {
      fullTable.innerHTML += `<tr><td>${_escH(e.party)}</td><td>${_escH(e.vehicle)}</td><td>${e.weight.toFixed(3)}</td><td>${_escH(e.debitNote ?? "")}</td><td>${_escH(e.gst ?? "")}</td><td>${_escH(e.dateDisplay)}</td></tr>`;
    });

    document.getElementById("debitWrap").classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = `Loaded ${entries.length} debit note entries` + (fromDate || toDate ? ` (filtered ${fromDate || "start"} to ${toDate || "now"}).` : ".");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("debitLoadBtn").addEventListener("click", loadDebitNoteData);

document.getElementById("debitExcelBtn").addEventListener("click", () => {
  if (!debitNoteData) { alert("Load the data first."); return; }
  const rows = [["Party", "Vehicle No.", "Weight", "Debit Note", "GST", "Date/Time"]];
  debitNoteData.entries.forEach(e => rows.push([e.party, e.vehicle, e.weight, e.debitNote ?? "", e.gst ?? "", e.dateDisplay]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wbOut = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbOut, ws, "Debit Notes");
  XLSX.writeFile(wbOut, `Debit_Note_Full_List.xlsx`);
});

document.getElementById("debitPdfBtn").addEventListener("click", () => {
  if (!debitNoteData) { alert("Load the data first."); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  addLogoHeader(doc);
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(31, 56, 100);
  doc.text("SI Debit Note - Party-wise Share", pageW / 2, 34, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  const rangeLabel = (debitNoteData.fromDate || debitNoteData.toDate)
    ? `${debitNoteData.fromDate || "Start"} to ${debitNoteData.toDate || "Now"}`
    : "Full list";
  doc.text(rangeLabel, pageW / 2, 50, { align: "center" });

  const body = debitNoteData.partyRows.map(r => [r.party, r.count, r.weight.toFixed(3), r.pct.toFixed(2) + "%"]);
  body.push([
    { content: "TOTAL", styles: { fontStyle: "bold" } },
    { content: debitNoteData.entries.length, styles: { fontStyle: "bold" } },
    { content: debitNoteData.grandTotalWeight.toFixed(3), styles: { fontStyle: "bold" } },
    { content: "100.00%", styles: { fontStyle: "bold" } }
  ]);

  doc.autoTable({
    head: [["Party", "Entries", "Total Weight", "% Share"]],
    body: body,
    startY: 65,
    styles: { fontSize: 10, cellPadding: 8, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.5 },
    headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 248, 253] },
    theme: "grid",
    margin: { left: 60, right: 60 },
    didParseCell: function (data) {
      if (data.section === "body" && data.row.index === 0) {
        data.cell.styles.fillColor = [255, 235, 130]; // highlight the top party
      }
      if (data.section === "body" && data.row.index === body.length - 1) {
        data.cell.styles.fillColor = [230, 230, 230];
      }
    }
  });

  stampLogoOnAllPages(doc);
  showPdfPreview(doc, `Debit_Note_Party_Share.pdf`, "SI Debit Note - Party-wise Share");
});

async function getErpProduction(wb, token) {
  try {
    // The row holding "Production" isn't fixed (FC Report's item list grows
    // or shrinks between months, shifting everything below it) - search
    // column B for the label, then read column C on that same row.
    const data = await graphFetch(`${wb}/worksheets('FC Report')/range(address='B1:C60')?$select=values`, token);
    for (const row of data.values) {
      const label = (row[0] || "").toString().trim().toLowerCase();
      if (label === "production" || label.includes("production")) {
        return typeof row[1] === "number" ? row[1] : 0;
      }
    }
    return 0; // no "Production" row found in this month's file
  } catch (e) {
    return 0; // FC Report sheet missing - treat as no data
  }
}

// Rows 26-32 of FC Report list billet sizes (column A) with their Opening
// weight split across B (130/160 only) and C (every size), and Rolled
// weight across G+H.
async function getErpOpeningAndRolled(wb, token) {
  try {
    // The size-wise table (100*100/110*110/130*130/160*160 rows) doesn't
    // always sit at rows 26-32 - extra rows inserted above it in some
    // months' files shift it further down. Search a wide range for the
    // actual size-label rows instead of assuming a fixed position.
    const data = await graphFetch(`${wb}/worksheets('FC Report')/range(address='A1:H80')?$select=values`, token);
    let opening = 0, rolled = 0;
    data.values.forEach(row => {
      const label = (row[0] || "").toString().toUpperCase().replace(/\s+/g, "");
      const isSizeRow = /^(100|110|130|160)[X*]/.test(label) || /^(100|110|130|160)$/.test(label);
      if (!isSizeRow) return; // skip anything that isn't one of these 4 size rows (headers, TOTAL, blanks, etc.)

      // Column B (Pieces/Nos) is a count, not a weight - never used.
      const c = typeof row[2] === "number" ? row[2] : 0; // Opening Full Length
      const d = typeof row[3] === "number" ? row[3] : 0; // Opening Short Length
      const g = typeof row[6] === "number" ? row[6] : 0; // Hot Rolled Full Length
      const h = typeof row[7] === "number" ? row[7] : 0; // Hotout

      const is130or160 = label.includes("130") || label.includes("160");
      const is110or130or160 = label.includes("110") || label.includes("130") || label.includes("160");

      if (is130or160) opening += c;   // Full Length - only 130/160 sections
      opening += d;                    // Short Length - every section counts

      if (is110or130or160) rolled += (g - h); // Hot Rolled Full Length minus Hotout - 110/130/160 sections only
    });
    return { opening, rolled };
  } catch (e) {
    return { opening: 0, rolled: 0 }; // FC Report sheet missing - treat as no data
  }
}

async function loadErpProduction() {
  const statusEl = document.getElementById("status");
  const fromDate = document.getElementById("erpProdFromDate").value;
  const toDate = document.getElementById("erpProdToDate").value;

  if (!fromDate || !toDate) {
    statusEl.className = "err";
    statusEl.textContent = "Please select both From Date and To Date.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Locating the file(s) for this date range...";
  document.getElementById("erpProdWrap").classList.add("hidden");

  try {
    const token = await getToken();
    const { results: wbList, missing } = await getWorkbooksForRange(token, fromDate, toDate);

    if (wbList.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't find a file for any month in this range (${missing.join(", ")}).`;
      return;
    }

    statusEl.textContent = `Reading ERP production for ${wbList.length} month(s)...`;
    const rows = await Promise.all(wbList.map(async (sub) => {
      const production = await getErpProduction(sub.wb, token);
      const { opening, rolled } = await getErpOpeningAndRolled(sub.wb, token);
      const stock = opening + production - rolled;
      const monthLabel = `${MONTH_ABBR[parseInt(sub.fromDate.slice(5, 7), 10) - 1]} ${sub.fromDate.slice(0, 4)}`;
      return { month: monthLabel, opening, production, rolled, stock };
    }));

    const totals = rows.reduce((acc, r) => ({
      opening: acc.opening + r.opening, production: acc.production + r.production,
      rolled: acc.rolled + r.rolled, stock: acc.stock + r.stock
    }), { opening: 0, production: 0, rolled: 0, stock: 0 });

    erpProdData = { fromDate, toDate, rows, totals };

    document.getElementById("erpProdMonths").textContent = ""; animateNumber("erpProdMonths", rows.length, 0);
    document.getElementById("erpProdTotal").textContent = ""; animateNumber("erpProdTotal", totals.production, 3);

    const table = document.getElementById("erpProdTable");
    table.innerHTML = "<tr><th>Month</th><th>Opening (MT)</th><th>Production (MT)</th><th>Rolled (MT)</th><th>Stock (MT)</th></tr>";
    rows.forEach(r => {
      table.innerHTML += `<tr><td>${r.month}</td><td>${r.opening.toFixed(3)}</td><td>${r.production.toFixed(3)}</td><td>${r.rolled.toFixed(3)}</td><td>${r.stock.toFixed(3)}</td></tr>`;
    });
    table.innerHTML += `<tr class="rowTotal"><td>TOTAL</td><td>${totals.opening.toFixed(3)}</td><td>${totals.production.toFixed(3)}</td><td>${totals.rolled.toFixed(3)}</td><td>${totals.stock.toFixed(3)}</td></tr>`;

    document.getElementById("erpProdWrap").classList.remove("hidden");
    statusEl.className = "ok";
    statusEl.textContent = `ERP Production loaded for ${fromDate} to ${toDate} (${rows.length} month(s)).` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("erpProdLoadBtn").addEventListener("click", loadErpProduction);

document.getElementById("erpProdPdfBtn").addEventListener("click", () => {
  if (!erpProdData) { alert("Load ERP Production first."); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  addLogoHeader(doc);
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(31, 56, 100);
  doc.text("ERP Production Report", pageW / 2, 34, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text(`Period: ${erpProdData.fromDate} to ${erpProdData.toDate}`, pageW / 2, 50, { align: "center" });

  const body = erpProdData.rows.map(r => [r.month, r.opening.toFixed(3), r.production.toFixed(3), r.rolled.toFixed(3), r.stock.toFixed(3)]);
  body.push([
    { content: "TOTAL", styles: { fontStyle: "bold" } },
    { content: erpProdData.totals.opening.toFixed(3), styles: { fontStyle: "bold" } },
    { content: erpProdData.totals.production.toFixed(3), styles: { fontStyle: "bold" } },
    { content: erpProdData.totals.rolled.toFixed(3), styles: { fontStyle: "bold" } },
    { content: erpProdData.totals.stock.toFixed(3), styles: { fontStyle: "bold" } }
  ]);

  doc.autoTable({
    head: [["Month", "Opening (MT)", "Production (MT)", "Rolled (MT)", "Stock (MT)"]],
    body: body,
    startY: 65,
    styles: { fontSize: 9.5, cellPadding: 7, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.5 },
    headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 248, 253] },
    theme: "grid",
    margin: { left: 30, right: 30 },
    didParseCell: function (data) {
      if (data.section === "body" && data.row.index === body.length - 1) {
        data.cell.styles.fillColor = [255, 235, 130];
      }
    }
  });

  stampLogoOnAllPages(doc);
  showPdfPreview(doc, `ERP_Production_${erpProdData.fromDate}_to_${erpProdData.toDate}.pdf`, `ERP Production - ${erpProdData.fromDate} to ${erpProdData.toDate}`);
});

/* ===================== ERP ENTRY SHEET (heat-wise) =====================
   Everything to be typed into the Lighthouse ERP for one day:
   - Production Entry (series Q2): one voucher per heat; one line per length
     and per hot charging / bypass. Godown = the SMS2 godown, Batch d/m/n,
     Ref No d/m/nR (hot charging = rolled) or d/m/nB (bypass), Tran UM PCS,
     C/F = length x weight per mtr (ERP keeps 5 decimals), Department QAD-SMS.
     RM consumption = the day's RM Report figures split per heat by weight
     (same split as Heat-wise Consumption), the SMS1 godown.
   - Material to Material Transfer (series BL):
       hot charging  SMS2 (F03..) -> BLRM (R06..), batch d/m/firstRTOd/m/lastR
       hot out       BLRM (R06..) -> SMS2 (F03..)
       RHF           SMS2 (F03..) -> BLRM (R06..), batch RHF-dd/mm/yyyy
   Prod. columns (0-based in A..AF): B=1 heat, H=7 size, I=8 wt/mtr,
   J:M=9..12 RHF pcs (130 row / 160 row after the heats), P:S=15..18 hot
   charging pcs, V:Y=21..24 bypass pcs, AB=27 total prod, AC:AF=28..31 hot out pcs. */
const ERP_LENGTHS = [3, 4, 5, 6];
const ERP_WT_PER_MTR = { 130: 0.132335, 160: 0.198005 };
// SMS2 side (F03..) and BLRM side (R06..) item codes, read from the ERP item list
let ERP_BILLET_CODES = {};   // SMS2 / BLRM billet item codes by size and length - from erp_config.json (OneDrive)
// HEAT_CONSUMPTION_ITEMS order - from erp_config.json (OneDrive)
let ERP_RM_CODES = {};
let ERP_SMS2 = "", ERP_BLRM = "", ERP_SMS1 = "";   // godown names - from erp_config.json (OneDrive)
let erpEntryData = null;

const erpR = (v, d) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
const erpNum = v => (typeof v === "number" && isFinite(v) ? v : 0);
// "4.11.1" -> "4/11/1"; "F-A-4.11.1" -> "F-A-4/11/1"
function erpBatchOf(heat) {
  const m = String(heat || "").trim().match(HEAT_NO_RE);
  if (!m) return String(heat || "").trim();
  return `${m[1] ? `F-${m[1].toUpperCase()}-` : ""}${+m[2]}/${+m[3]}/${+m[4]}`;
}
function erpBillet(size, len, wpm) {
  const codes = (ERP_BILLET_CODES[size] || {})[len] || [null, null];
  const w = ERP_WT_PER_MTR[size] || wpm || 0;
  return { sms2Code: codes[0], blrmCode: codes[1], cf: erpR(len * w, 5) };
}

// rows = Prod. values A(dataStart):AF(dataStart+heats+2); consRow = RM Report AI:AR of the day
function erpEntryBuild(rows, heats, consRow, dateISO) {
  const [yy, mm, dd] = dateISO.split("-").map(Number);
  const heatRows = rows.slice(0, heats).filter(r => isRealHeatRow(r));
  const warn = [];
  const line = (heat, kind, size, len, pcs, wpm) => {
    const b = erpBillet(size, len, wpm);
    if (!b.sms2Code) warn.push(`No ERP item code for ${size} ${len} Mtr (heat ${heat}).`);
    return { heat, batch: erpBatchOf(heat), kind, size, len, pcs, ...b, mt: erpR(pcs * b.cf, 3) };
  };

  // consumption split per heat by total production weight (0.01 MT units, like Heat-wise Consumption)
  const weights = heatRows.map(r => erpNum(r[27]));
  const perItem = HEAT_CONSUMPTION_ITEMS.map((it, k) => apportionIntegerByWeight(Math.round(erpNum((consRow || [])[k]) * 100), weights));

  const vouchers = heatRows.map((r, h) => {
    const heat = String(r[1]).trim(), size = erpNum(r[7]), wpm = erpNum(r[8]);
    const lines = [];
    ERP_LENGTHS.forEach((len, k) => { const p = erpNum(r[15 + k]); if (p > 0) lines.push(line(heat, "R", size, len, p, wpm)); });
    ERP_LENGTHS.forEach((len, k) => { const p = erpNum(r[21 + k]); if (p > 0) lines.push(line(heat, "B", size, len, p, wpm)); });
    lines.forEach(l => { l.ref = l.batch + l.kind; });
    const rm = HEAT_CONSUMPTION_ITEMS.map((it, k) => ({ key: it.key, label: it.label, code: ERP_RM_CODES[it.key] || null, qty: perItem[k][h] / 100 }))
      .filter(x => x.qty > 0);
    rm.filter(x => !x.code).forEach(x => warn.push(`No ERP item code for ${x.label} - it will be skipped in the ERP.`));
    const hotOut = [];
    ERP_LENGTHS.forEach((len, k) => { const p = erpNum(r[28 + k]); if (p > 0) hotOut.push(line(heat, "HO", size, len, p, wpm)); });
    return { heat, batch: erpBatchOf(heat), size, lines, rm, hotOut,
      sheetMt: erpNum(r[27]), erpMt: erpR(lines.reduce((s, l) => s + l.mt, 0), 3) };
  });

  // hot charging transfer: all rolled lines of the day, receive grouped per item
  const hcIssue = vouchers.flatMap(v => v.lines.filter(l => l.kind === "R"));
  const rolledHeats = vouchers.filter(v => v.lines.some(l => l.kind === "R"));
  let rangeBatch = "";
  if (rolledHeats.length) {
    const a = rolledHeats[0].batch, z = rolledHeats[rolledHeats.length - 1].batch;
    rangeBatch = a === z ? `${a}R` : `${a}RTO${z}R`;
  }
  const groupBy = (arr) => {
    const g = new Map();
    arr.forEach(l => { const k = `${l.size}|${l.len}`; const x = g.get(k) || { size: l.size, len: l.len, sms2Code: l.sms2Code, blrmCode: l.blrmCode, cf: l.cf, pcs: 0, mt: 0 }; x.pcs += l.pcs; x.mt = erpR(x.mt + l.mt, 3); g.set(k, x); });
    return [...g.values()];
  };
  const hcReceive = groupBy(hcIssue).map(x => ({ ...x, batch: rangeBatch }));
  const hotOut = vouchers.flatMap(v => v.hotOut);

  // RHF: pcs per section on the two rows after the heats (130 first, 160 second)
  const rhf = [];
  const rhfBatch = `RHF-${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yy}`;
  [[130, heats + 1], [160, heats + 2]].forEach(([size, idx]) => {
    const r = rows[idx] || [];
    ERP_LENGTHS.forEach((len, k) => {
      const p = erpNum(r[9 + k]);
      if (p > 0) { const b = erpBillet(size, len, 0); if (!b.sms2Code) warn.push(`No ERP item code for RHF ${size} ${len} Mtr.`); rhf.push({ size, len, pcs: p, ...b, mt: erpR(p * b.cf, 3), batch: rhfBatch }); }
    });
  });

  return { dateISO, heats: vouchers.length, vouchers, hcIssue, hcReceive, rangeBatch, hotOut, rhf, rhfBatch,
    totals: { sheetMt: erpR(vouchers.reduce((s, v) => s + v.sheetMt, 0), 3), erpMt: erpR(vouchers.reduce((s, v) => s + v.erpMt, 0), 3),
      hotOutMt: erpR(hotOut.reduce((s, l) => s + l.mt, 0), 3), rhfMt: erpR(rhf.reduce((s, l) => s + l.mt, 0), 3) },
    warn: [...new Set(warn)] };
}

function erpEntryRender(d) {
  const e = htmlEsc;
  const tbl = (head, rows) => `<div class="tableScroll"><table class="matrixTable stockTable erpCopy"><tr>${head.map(h => `<th>${e(h)}</th>`).join("")}</tr>` +
    rows.map(r => `<tr>${r.map(c => `<td>${e(c === null || c === undefined ? "NOT FOUND" : c)}</td>`).join("")}</tr>`).join("") + `</table></div>`;
  const dmy = d.dateISO.split("-").reverse().join("-");
  let h = `<div class="dashGrid">
    <div class="dashCard"><div class="dashLabel">Heats</div><div class="dashValue">${d.heats}</div></div>
    <div class="dashCard"><div class="dashLabel">Production - ERP (MT)</div><div class="dashValue">${d.totals.erpMt.toFixed(3)}</div></div>
    <div class="dashCard"><div class="dashLabel">Production - Sheet (MT)</div><div class="dashValue">${d.totals.sheetMt.toFixed(3)}</div></div>
    <div class="dashCard"><div class="dashLabel">Hot Out (MT)</div><div class="dashValue">${d.totals.hotOutMt.toFixed(3)}</div></div>
    <div class="dashCard"><div class="dashLabel">RHF (MT)</div><div class="dashValue">${d.totals.rhfMt.toFixed(3)}</div></div></div>`;
  if (d.warn.length) h += `<p class="err" style="white-space:pre-line;margin-top:10px;">${e(d.warn.join("\n"))}</p>`;
  h += `<p style="font-size:12px;color:var(--muted);margin:8px 0;">ERP MT = pcs × C/F with C/F rounded to 5 decimals (as the ERP stores it), so it can differ from the sheet by about 0.001 MT per line.</p>`;

  h += `<h3 style="color:var(--navy);margin-top:18px;">1. Production Entry - one voucher per heat</h3>
    <p style="font-size:12px;color:var(--muted);margin:0 0 8px;">Series PRODUCTION ENTRY - STEEL MELTING SHOP (Q2) · Transaction Type STOCK MATERIAL · Plant INDUCTION FURNACE (INDF1) · Process BILLETS · Cost INDUCTION FURNACE (INFUR) · Production In / Out Date ${e(dmy)} · Manual</p>`;
  d.vouchers.forEach(v => {
    h += `<details style="margin:8px 0;"><summary><b>Heat ${e(v.heat)}</b> - ${v.lines.reduce((s, l) => s + l.pcs, 0)} pcs, ${v.erpMt.toFixed(3)} MT (sheet ${v.sheetMt.toFixed(3)})</summary>`;
    h += `<div style="font-size:12px;margin:6px 0 2px;">Production Received - Godown ${ERP_SMS2} · Stock Type R - REVENUE · Department QAD-SMS · Tran UM PCS</div>`;
    h += tbl(["Item Code", "Size", "Length", "Batch No.", "Ref No", "PCS", "C/F", "Qty (MT)"],
      v.lines.map(l => [l.sms2Code, l.size, `${l.len} Mtr`, l.batch, l.ref, l.pcs, l.cf.toFixed(5), l.mt.toFixed(3)]));
    h += `<div style="font-size:12px;margin:6px 0 2px;">RM Consumption - Godown ${ERP_SMS1} · Stock Type R - REVENUE</div>`;
    h += v.rm.length ? tbl(["Item Code", "Item", "Qty (MT)"], v.rm.map(x => [x.code, x.label, x.qty.toFixed(3)])) : `<div style="font-size:12px;">No consumption entered for this date in RM Report.</div>`;
    h += `</details>`;
  });

  h += `<h3 style="color:var(--navy);margin-top:18px;">2. Material to Material Transfer - Hot Charging (SMS2 → BLRM)</h3>
    <p style="font-size:12px;color:var(--muted);margin:0 0 8px;">Series Billet Tranfer from SMS to RM (BL) · Transaction Type STOCK MATERIAL · Tran UM PCS</p>`;
  if (d.hcIssue.length) {
    h += `<div style="font-size:12px;margin:6px 0 2px;">Item Issued - Godown ${ERP_SMS2}</div>`;
    h += tbl(["Item Code", "Size", "Length", "Batch No.", "Ref No", "PCS", "C/F", "Qty (MT)"], d.hcIssue.map(l => [l.sms2Code, l.size, `${l.len} Mtr`, l.batch, l.ref, l.pcs, l.cf.toFixed(5), l.mt.toFixed(3)]));
    h += `<div style="font-size:12px;margin:6px 0 2px;">Item Received - Godown ${ERP_BLRM}</div>`;
    h += tbl(["Item Code", "Size", "Length", "Batch No.", "PCS", "C/F", "Qty (MT)"], d.hcReceive.map(x => [x.blrmCode, x.size, `${x.len} Mtr`, x.batch, x.pcs, x.cf.toFixed(5), x.mt.toFixed(3)]));
  } else h += `<div style="font-size:12px;">No hot charging on this date.</div>`;

  h += `<h3 style="color:var(--navy);margin-top:18px;">3. Material to Material Transfer - Hot Out (BLRM → SMS2)</h3>`;
  h += d.hotOut.length ? tbl(["Heat", "Issue: Item Code (BLRM)", "Issue Batch", "Receive: Item Code (SMS2)", "Receive Batch", "Receive Ref No", "Size", "Length", "PCS", "C/F", "Qty (MT)"],
    d.hotOut.map(l => [l.heat, l.blrmCode, d.rangeBatch || "NOT FOUND", l.sms2Code, l.batch, l.batch + "R", l.size, `${l.len} Mtr`, l.pcs, l.cf.toFixed(5), l.mt.toFixed(3)]))
    : `<div style="font-size:12px;">No hot out on this date.</div>`;

  h += `<h3 style="color:var(--navy);margin-top:18px;">4. Material to Material Transfer - RHF (SMS2 → BLRM)</h3>`;
  h += d.rhf.length ? tbl(["Issue: Item Code (SMS2)", "Receive: Item Code (BLRM)", "Receive Batch", "Size", "Length", "PCS", "C/F", "Qty (MT)"],
    d.rhf.map(x => [x.sms2Code, x.blrmCode, x.batch, x.size, `${x.len} Mtr`, x.pcs, x.cf.toFixed(5), x.mt.toFixed(3)]))
    : `<div style="font-size:12px;">No RHF on this date.</div>`;
  return h;
}

// Reads the Prod. block + RM Report consumption of one date and builds the ERP entry data
async function erpEntryFetch(dateVal) {
  const token = await getToken();
  const { results: wbList } = await getWorkbooksForRange(token, dateVal, dateVal);
  if (!wbList.length) throw new Error("Couldn't find the Reports file for this date.");
  const wb = wbList[0].wb, sheet = "Prod.";
  const sh = encodeURIComponent(sheet.replace(/'/g, "''"));
  const colA = await graphFetch(`${wb}/worksheets('${sh}')/range(address='A1:A2000')?$select=values`, token);
  let dataStart = -1;
  for (let i = 0; i < colA.values.length; i++) { const v = colA.values[i][0]; if (typeof v === "number" && excelSerialToISODate(v) === dateVal) { dataStart = i + 1; break; } }
  if (dataStart === -1) throw new Error(`No block for ${dateVal} in the Prod. sheet.`);
  const heats = await prodHeatsFor(wb, token, sheet);
  const [prod, consRow] = await Promise.all([
    graphFetch(`${wb}/worksheets('${sh}')/range(address='A${dataStart}:AF${dataStart + heats + 2}')?$select=values`, token),
    getConsumptionRowForDate(wb, dateVal, token)]);
  const d = erpEntryBuild(prod.values, heats, consRow, dateVal);
  if (!d.heats) throw new Error(`No heats entered for ${dateVal}.`);
  d.consAvailable = (consRow || []).some(v => typeof v === "number" && v > 0);
  if (!d.consAvailable) d.rmPh = await erpPrevRm(dateVal, token);
  return d;
}
// RM Report still empty on dateVal (consumption comes last in the day): the latest of the 7 days before with consumption ->
// its items that have an ERP code, biggest first. Production + RM then enters 0.001 MT of the first one with SMS1 stock.
async function erpPrevRm(dateVal, token) {
  for (let k = 1; k <= 7; k++) {
    const dt = new Date(dateVal + "T00:00:00Z"); dt.setUTCDate(dt.getUTCDate() - k);
    const iso = dt.toISOString().slice(0, 10);
    let row = null;
    try { const { results } = await getWorkbooksForRange(token, iso, iso); if (results.length) row = await getConsumptionRowForDate(results[0].wb, iso, token); } catch (e) {}
    if (!row || !row.some(v => erpNum(v) > 0)) continue;
    const items = HEAT_CONSUMPTION_ITEMS.map((it, i) => ({ code: ERP_RM_CODES[it.key] || null, label: it.label, qty: erpNum(row[i]) }))
      .filter(x => x.code && x.qty > 0).sort((a, b) => b.qty - a.qty);
    if (items.length) return { from: iso.split("-").reverse().join("-"), items: items.map(x => ({ code: x.code, label: x.label })) };
  }
  return null;
}

async function loadErpEntrySheet() {
  const statusEl = document.getElementById("status");
  const dateVal = document.getElementById("erpEntryDate").value;
  const wrap = document.getElementById("erpEntryWrap");
  if (!dateVal) { statusEl.className = "err"; statusEl.textContent = "Please select a date."; return; }
  statusEl.className = "wait"; statusEl.textContent = "Building the ERP entry sheet...";
  wrap.classList.add("hidden"); erpEntryData = null;
  try {
    const d = await erpEntryFetch(dateVal);
    erpEntryData = d; erpSendRefresh();
    wrap.innerHTML = `<details><summary>📄 Entry sheet · ${d.heats} heat(s) · ${d.totals.erpMt.toFixed(3)} MT</summary>${erpEntryRender(d)}</details>`;
    wrap.classList.remove("hidden");
    statusEl.className = d.warn.length ? "err" : "ok";
    statusEl.textContent = `ERP entry sheet ready for ${dateVal}: ${d.heats} heat voucher(s), ${d.totals.erpMt.toFixed(3)} MT.` + (d.warn.length ? "\n" + [...new Set(d.warn)].join("\n") : "");
  } catch (e) { statusEl.className = "err"; statusEl.textContent = "Error: " + e.message; }
}

function erpEntryXlsx() {
  const d = erpEntryData;
  if (!d) { alert("Load the ERP entry sheet first."); return; }
  const wbOut = XLSX.utils.book_new();
  const prod = [["Heat", "Item Code", "Godown", "Size", "Length (Mtr)", "Batch No.", "Ref No", "Department", "Tran UM", "PCS", "C/F", "Qty (MT)"]];
  d.vouchers.forEach(v => v.lines.forEach(l => prod.push([v.heat, l.sms2Code || "NOT FOUND", ERP_SMS2, l.size, l.len, l.batch, l.ref, "QAD-SMS", "PCS", l.pcs, l.cf, l.mt])));
  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(prod), "Production");
  const rm = [["Heat", "Item Code", "Item", "Godown", "Qty (MT)"]];
  d.vouchers.forEach(v => v.rm.forEach(x => rm.push([v.heat, x.code || "NOT FOUND", x.label, ERP_SMS1, x.qty])));
  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(rm), "RM Consumption");
  const m = [["Transfer", "Side", "Heat", "Item Code", "Godown", "Size", "Length (Mtr)", "Batch No.", "Ref No", "Tran UM", "PCS", "C/F", "Qty (MT)"]];
  d.hcIssue.forEach(l => m.push(["Hot Charging", "Issue", l.heat, l.sms2Code || "NOT FOUND", ERP_SMS2, l.size, l.len, l.batch, l.ref, "PCS", l.pcs, l.cf, l.mt]));
  d.hcReceive.forEach(x => m.push(["Hot Charging", "Receive", "", x.blrmCode || "NOT FOUND", ERP_BLRM, x.size, x.len, x.batch, "", "PCS", x.pcs, x.cf, x.mt]));
  d.hotOut.forEach(l => { m.push(["Hot Out", "Issue", l.heat, l.blrmCode || "NOT FOUND", ERP_BLRM, l.size, l.len, d.rangeBatch, "", "PCS", l.pcs, l.cf, l.mt]);
    m.push(["Hot Out", "Receive", l.heat, l.sms2Code || "NOT FOUND", ERP_SMS2, l.size, l.len, l.batch, l.batch + "R", "PCS", l.pcs, l.cf, l.mt]); });
  d.rhf.forEach(x => { m.push(["RHF", "Issue", "", x.sms2Code || "NOT FOUND", ERP_SMS2, x.size, x.len, "", "", "PCS", x.pcs, x.cf, x.mt]);
    m.push(["RHF", "Receive", "", x.blrmCode || "NOT FOUND", ERP_BLRM, x.size, x.len, x.batch, "", "PCS", x.pcs, x.cf, x.mt]); });
  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(m), "M2M");
  XLSX.writeFile(wbOut, `ERP_Entry_${d.dateISO}.xlsx`);
}

document.getElementById("erpEntryLoadBtn").addEventListener("click", loadErpEntrySheet);
document.getElementById("erpEntryXlsxBtn").addEventListener("click", erpEntryXlsx);
document.getElementById("erpEntryWrap").addEventListener("click", ev => {
  const td = ev.target.closest("table.erpCopy td");
  if (!td) return;
  const t = td.textContent.trim();
  if (!t || t === "NOT FOUND") return;
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => {
    td.style.outline = "2px solid #2e9d5b"; setTimeout(() => { td.style.outline = ""; }, 700);
  }).catch(() => {});
});
(() => { const el = document.getElementById("erpEntryDate"); if (el && !el.value) { const y = new Date(Date.now() - 864e5); el.value = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`; } })();

/* ---- Send to ERP: Moltrix opened from the ERP bookmark gets window.opener = the ERP page ---- */
let ERP_ORIGIN = "", ERP_PATH = "";
/* ERP settings (address, item codes, godown names) are kept in the owner's OneDrive - Apps folder → erp_config.json -
   so they are not in this public code. Loaded after sign-in and kept on this device. */
const ERP_CONFIG_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/erp_config.json:/content";
function erpConfigNow() { return { v: 1, erpOrigin: ERP_ORIGIN, erpPath: ERP_PATH, billetCodes: ERP_BILLET_CODES, rmCodes: ERP_RM_CODES, godowns: { sms2: ERP_SMS2, blrm: ERP_BLRM, sms1: ERP_SMS1 } }; }
function erpConfigApply(o) {
  if (!o || typeof o !== "object") return false;
  if (/^https?:\/\/[^/\s]+$/i.test(o.erpOrigin || "")) ERP_ORIGIN = o.erpOrigin;
  if (/^\/[^\s]*$/.test(o.erpPath || "")) ERP_PATH = o.erpPath;
  if (o.billetCodes && typeof o.billetCodes === "object") ERP_BILLET_CODES = o.billetCodes;
  if (o.rmCodes && typeof o.rmCodes === "object") ERP_RM_CODES = o.rmCodes;
  const g = o.godowns || {}; if (g.sms2) ERP_SMS2 = g.sms2; if (g.blrm) ERP_BLRM = g.blrm; if (g.sms1) ERP_SMS1 = g.sms1;
  return true;
}
try { erpConfigApply(JSON.parse(localStorage.getItem("erpConfig") || "null")); } catch (e) {}
let _erpCfgP = null;
function erpConfigLoad(force) {
  if (_erpCfgP && !force) return _erpCfgP;
  _erpCfgP = (async () => {
    try {
      if (!account || (typeof isViewer === "function" && isViewer())) return false;
      const token = await getToken(); if (!token) return false;
      const r = await fetch(ERP_CONFIG_URL, { headers: { Authorization: "Bearer " + token } });
      if (r.ok) { const o = await r.json(); if (erpConfigApply(o)) { try { localStorage.setItem("erpConfig", JSON.stringify(o)); } catch (e) {} return true; } return false; }
      if (r.status === 404 && ERP_ORIGIN && accountRole(account) === "owner") {   // first time: save the current settings there
        const w = await fetch(ERP_CONFIG_URL, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(erpConfigNow()) });
        if (w.ok) { try { localStorage.setItem("erpConfig", JSON.stringify(erpConfigNow())); } catch (e) {} }
        return w.ok;
      }
      return false;
    } catch (e) { _erpCfgP = null; return false; }
  })();
  return _erpCfgP;
}
const ERP_FILLER_URL = "https://mishrachemist.github.io/erpfill.js";
// 27-Nov-2026: ONE production voucher per date. The voucher number of each date (sent back by the ERP panel when it saves)
// is kept here and in OneDrive (Apps → erp_day_vouchers.json), so the panel on any PC / phone adds later heats of that
// date to the same voucher.
const ERP_DAYVR_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/erp_day_vouchers.json:/content";
const erpDayVrLocal = () => { try { return JSON.parse(localStorage.getItem("erpDayVr") || "{}") || {}; } catch (e) { return {}; } };
async function erpDayVrLoad() {
  try {
    if (!account || (typeof isViewer === "function" && isViewer())) return erpDayVrLocal();
    const token = await getToken(); if (!token) return erpDayVrLocal();
    const r = await fetch(ERP_DAYVR_URL, { headers: { Authorization: "Bearer " + token } });
    const o = r.ok ? await r.json() : {}, m = Object.assign({}, o && typeof o === "object" ? o : {}, erpDayVrLocal());
    try { localStorage.setItem("erpDayVr", JSON.stringify(m)); } catch (e) {}
    return m;
  } catch (e) { return erpDayVrLocal(); }
}
async function erpDayVrSave(date, vr) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(date || "") || !vr || /^(DRY RUN|\()/.test(vr)) return;
  const m = erpDayVrLocal(); if (m[date] === vr) return;
  m[date] = vr; try { localStorage.setItem("erpDayVr", JSON.stringify(m)); } catch (e) {}
  try {
    const token = await getToken(); if (!token) return;
    const r = await fetch(ERP_DAYVR_URL, { headers: { Authorization: "Bearer " + token } });
    const o = r.ok ? await r.json() : {}; o[date] = vr;
    await fetch(ERP_DAYVR_URL, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(o) });
  } catch (e) {}
}
window.addEventListener("message", ev => {
  if (ev.origin !== ERP_ORIGIN || !ev.data || ev.data.type !== "moltrix-erp-done") return;
  if (/^(full|prod)$/.test(ev.data.mode || "")) erpDayVrSave(ev.data.date, ev.data.vr);
});
const erpBridge = (() => { try { return new URLSearchParams(location.search).get("erpbridge") === "1" && !!window.opener; } catch (e) { return false; } })();
// Android phone (not opened from the ERP bookmark): only the 📲 buttons; PC: mode list + Send to ERP + set-up
if (/Android/i.test(navigator.userAgent) && !erpBridge) document.body.classList.add("erpPhone");
function erpPayload(d, mode) {
  const dmy = d.dateISO.split("-").reverse().join("-");
  const bad = [];
  if (mode === "m2m") {   // hot charging only (Ref No ends in R): SMS2 (F03..) -> BLRM (R06..), same billet; the ERP takes one
    // Received line per voucher when there are several Issued lines, so one voucher per heat AND length
    const heats = [];
    d.vouchers.forEach(v => v.lines.filter(l => l.kind === "R").forEach(l => {
      if (!l.sms2Code || !l.blrmCode) { bad.push(`heat ${v.heat}: no ERP code for ${l.size} ${l.len} Mtr`); return; }
      heats.push({ heat: v.heat, remark: `Heat ${v.heat} - ${l.size} ${l.len} Mtr`, date: dmy, mt: l.mt,
        lines: [{ code: l.sms2Code, rcode: l.blrmCode, batch: l.batch, ref: l.ref, pcs: l.pcs, cf: l.cf, mt: l.mt, len: l.len, size: l.size }] });
    }));
    if (!heats.length && !bad.length) bad.push("no hot charging (R) billets on this date");
    return { bad, payload: { v: 1, mode, date: dmy, heats } };
  }
  const heats = d.vouchers.map(v => {
    v.lines.forEach(l => { if (!l.sms2Code) bad.push(`heat ${v.heat}: no ERP code for ${l.size} ${l.len} Mtr`); });
    return { heat: v.heat, remark: `Heat ${v.heat}`, date: dmy, mt: v.erpMt,
      lines: v.lines.map(l => ({ code: l.sms2Code, batch: l.batch, ref: l.ref, pcs: l.pcs, cf: l.cf, mt: l.mt, len: l.len })),
      rm: v.rm.map(x => ({ code: x.code, label: x.label, qty: x.qty })),
      ...(mode === "full" && !v.rm.length && d.rmPh ? { rmPh: d.rmPh.items, rmPhFrom: d.rmPh.from } : {}) };
  });
  return { bad, payload: { v: 1, mode, date: dmy, heats } };
}
const ERP_QC_KEYS = ["C", "Mn", "P", "S", "Si", "N", "S+P", "CE", "Bend", "Camber", "Length", "Width", "Defects", "Grade"];
const ERP_QC_NEED = ["C", "Mn", "P", "S", "Si", "N", "S+P", "CE", "Bend", "Camber", "Length", "Width", "Defects"];
// Final-row chemistry of one date from the BIS Doc sheet: heat -> {C, Mn, P, S, Si} (as shown in the sheet)
async function erpBisFetch(dateVal) {
  const token = await getToken();
  const { results: wbList } = await getWorkbooksForRange(token, dateVal, dateVal);
  if (!wbList.length) throw new Error("Couldn't find the Reports file for this date.");
  const wb = wbList[0].wb, sh = encodeURIComponent("BIS Doc");
  const colA = await graphFetch(`${wb}/worksheets('${sh}')/range(address='A1:A2992')?$select=text`, token, { noCache: true });
  const dmy = dateVal.split("-").reverse().join("-");
  let dRow = -1;
  (colA.text || []).forEach((r, i) => { const t = String(r[0] || ""); if (dRow < 0 && /date of manufacturing/i.test(t)) { const m = t.match(/(\d{1,2})-(\d{1,2})-(\d{4})/); if (m && `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}-${m[3]}` === dmy) dRow = i + 1; } });
  if (dRow < 0) throw new Error(`No block for ${dmy} in the BIS Doc sheet.`);
  const blk = await graphFetch(`${wb}/worksheets('${sh}')/range(address='A${dRow}:S${dRow + 28}')?$select=text,values`, token, { noCache: true });
  const out = {};
  const val = (t, v) => { t = String(t || "").trim(); if (/^\d*\.?\d+$/.test(t)) return t; return typeof v === "number" ? String(Math.round(v * 10000) / 10000) : ""; };
  (blk.text || []).forEach((r, i) => {
    if (String(r[2] || "").trim().toLowerCase() !== "final") return;
    const heat = String(r[1] || "").trim(); if (!heat) return;
    const v = blk.values[i];
    const t = k => String(r[k] || "").replace(/\s+/g, " ").trim();
    out[heat.toUpperCase().replace(/\s+/g, "")] = { heat, C: val(r[5], v[5]), Mn: val(r[6], v[6]), P: val(r[7], v[7]), S: val(r[8], v[8]), Si: val(r[9], v[9]),
      N: val(r[10], v[10]), "S+P": val(r[11], v[11]), CE: val(r[12], v[12]), Bend: val(r[13], v[13]), Camber: val(r[14], v[14]), Length: val(r[15], v[15]),
      Width: t(16), Defects: t(17), Grade: t(18) };
  });
  return out;
}
function erpQcPayload(d, bis) {
  const dmy = d.dateISO.split("-").reverse().join("-");
  const bad = [], heats = [], warn = [];
  d.vouchers.forEach(v => {
    const q = bis[String(v.heat).toUpperCase().replace(/\s+/g, "")], l = v.lines[0];
    if (!q) { bad.push(`heat ${v.heat}: no Final row in the BIS Doc`); return; }
    // what the BIS Doc has goes to the ERP; a blank parameter is left empty there (not a reason to hold the heat back)
    const miss = ERP_QC_NEED.filter(k => !q[k]);
    if (miss.length === ERP_QC_NEED.length) { bad.push(`heat ${v.heat}: the BIS Doc Final row is empty`); return; }
    if (miss.length) warn.push(`heat ${v.heat}: BIS Doc has no ${miss.join(", ")} - sent without them`);
    if (!l || !l.sms2Code) { bad.push(`heat ${v.heat}: no billet line / ERP item code`); return; }
    heats.push({ heat: v.heat, date: dmy, mt: v.erpMt, lines: v.lines.map(x => ({ code: x.sms2Code, batch: x.batch, ref: x.ref, pcs: x.pcs, cf: x.cf, mt: x.mt, len: x.len })), rm: [],
      qc: { code: l.sms2Code, codes: [...new Set(v.lines.map(x => x.sms2Code).filter(Boolean))], batch: l.batch, vals: Object.fromEntries(ERP_QC_KEYS.map(k => [k, q[k]])) } });
  });
  return { bad, warn, payload: { v: 1, mode: "qc", date: dmy, heats } };
}
function erpSendLog(m, cls) { const L = document.getElementById("erpSendLog"); if (!L) return; const d = document.createElement("div"); d.textContent = m;
  d.style.color = cls === "err" ? "#c0392b" : cls === "ok" ? "#2e9d5b" : cls === "h" ? "#b7860b" : ""; L.appendChild(d); L.scrollTop = L.scrollHeight; }
const ERP_MODE_NOTE = {
  full: "ONE production voucher per date: the heats' billet lines (+ one RM line of 0.001 MT in a new voucher) - later heats of the date go into the same voucher; the consumption later with Add RM.",
  cons: "The TOTAL RM consumption of all heats of the date into the date's voucher (only what is missing is added).",
  qc: "BIS Doc Final row - only after the voucher is approved. The tests the ERP has get entered and saved; run it again later and the tests still empty are added to the same QC (needs Edit rights on Production QC in the ERP).",
  approve: "Approves the date's production voucher (✓ → Approve) - needed before Production QC.",
  m2m: "Hot charging (R) billets, series BL - one voucher per heat and length."
};
function erpModeNote() { const m = document.getElementById("erpSendMode"), n = document.getElementById("erpSendModeNote"); if (m && n) n.textContent = ERP_MODE_NOTE[m.value] || "";
}
document.getElementById("erpSendMode").addEventListener("change", erpModeNote);
function erpSendRefresh() {
  const b = document.getElementById("erpSendBtn"), h = document.getElementById("erpSendHint");
  if (!b) return;
  b.disabled = !(erpBridge && erpEntryData);
  const cb = document.getElementById("erpCopyBtn"); if (cb) cb.disabled = !erpEntryData;
  h.textContent = erpBridge ? (erpEntryData ? "Opened from the ERP - press Send to ERP, then Start in the ERP window." : "Opened from the ERP - load the date first.")
    : "PC: open this from the ERP with the Moltrix ERP bookmark (set-up below), then Send to ERP. Phone: load the date, press Copy for ERP, then paste it in the ERP panel (set-up below).";
}
// the payload for the ERP filler (null if it can't be sent); used by Send (PC) and Copy for ERP (phone)
async function erpBuildPayload() {
  await erpConfigLoad();
  if (!ERP_ORIGIN || !Object.keys(ERP_BILLET_CODES).length) { await erpConfigLoad(true); if (!ERP_ORIGIN) throw new Error("ERP settings (OneDrive → Apps → erp_config.json) not loaded - sign in, check the internet and try again."); }
  if (!erpEntryData) { alert("Load the ERP entry sheet first."); return null; }
  const mode = document.getElementById("erpSendMode").value;
  let bad, payload;
  if (mode === "qc") {
    let bis;
    try { erpSendLog("Reading the BIS Doc sheet..."); bis = await erpBisFetch(erpEntryData.dateISO); }
    catch (e) { erpSendLog("✗ " + e.message, "err"); return null; }
    let warn; ({ bad, warn, payload } = erpQcPayload(erpEntryData, bis));
    (warn || []).forEach(w => erpSendLog("⚠ " + w, "h"));
    bad.forEach(b => erpSendLog("✗ " + b + " - not sent", "err"));
    if (!payload.heats.length) { alert("Nothing to send - " + bad.join("; ")); return null; }
    payload.heats.forEach(h => { const v = h.qc.vals; erpSendLog(`Heat ${h.heat} (${h.qc.batch}, ${h.qc.code}): ` + ERP_QC_KEYS.filter(k => v[k]).map(k => `${k === "Defects" ? "Freedom From Defects" : k} ${v[k]}`).join(" · ")); });
  } else {
    ({ bad, payload } = erpPayload(erpEntryData, mode));
    if (bad.length) { alert("Can't send - " + bad.join("; ")); return null; }
    if (mode !== "m2m") { const dv = (await erpDayVrLoad())[payload.date]; if (dv) { payload.dayVr = dv; if (mode === "full") erpSendLog(`Voucher of ${payload.date}: ${dv} - the heats are added to it.`); } }
  }
  return payload;
}
// copy text on the phone (navigator.clipboard, else the old select + copy way)
async function erpCopyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
  try { const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:0;left:0;opacity:0;"; document.body.appendChild(a); a.select(); a.setSelectionRange(0, t.length);
    const ok = document.execCommand("copy"); a.remove(); return ok; } catch (e) { return false; }
}
const ERP_PASTE_TAG = "MOLTRIX-ERP1 ";
// 📲 buttons: the Moltrix ERP Android app (android-erp/ in this repo) logs in, opens the screen and does the entry itself.
// The data goes in the intent (and on the clipboard as a backup - the app's 📋 button reads it).
const ERP_APP_PKG = "com.mishrachemist.moltrixerp";
const ERP_APP_APK = "https://github.com/mishrachemist/mishrachemist.github.io/releases/download/moltrix-erp-apk/MoltrixERP.apk";
function erpAppUrl(payload) {
  return `intent://run#Intent;scheme=moltrixerp;package=${ERP_APP_PKG};S.payload=${encodeURIComponent(JSON.stringify(payload))};S.browser_fallback_url=${encodeURIComponent(ERP_APP_APK)};end`;
}
async function erpAppOpen(payload, logEl) {
  if (!/Android/i.test(navigator.userAgent)) { alert("📲 works on the Android phone with the Moltrix ERP app. On the PC use Send to ERP."); return; }
  await erpConfigLoad();
  if (!ERP_ORIGIN) { alert("ERP address not loaded yet - sign in and try again in a moment."); return; }
  payload.erpUrl = ERP_ORIGIN + ERP_PATH;   // the app keeps the ERP address from here (it asks once before saving it)
  await erpCopyText(ERP_PASTE_TAG + JSON.stringify(payload));
  const url = erpAppUrl(payload), n = payload.heats ? payload.heats.length : (payload.items || []).length;
  if (logEl) {
    const d = document.createElement("div");
    d.append(`${n} ${payload.heats ? (payload.mode === "m2m" ? "voucher(s)" : "heat(s)") + " · " + payload.date : "item(s)"} → Moltrix ERP app. Didn't open? `);
    const a = document.createElement("a"); a.href = url; a.textContent = "📲 Open the ERP app"; a.style.fontWeight = "700";
    d.append(a, " · ");
    const g = document.createElement("a"); g.href = ERP_APP_APK; g.textContent = "install / update the app";
    d.append(g);
    logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight;
  }
  location.href = url;
}
document.querySelectorAll("[data-erpapp]").forEach(b => b.addEventListener("click", async () => {
  const sel = document.getElementById("erpSendMode");
  sel.value = b.dataset.erpapp; erpModeNote();
  const payload = await erpBuildPayload(); if (!payload) return;
  erpAppOpen(payload, document.getElementById("erpSendLog"));
}));
document.getElementById("erpSendBtn").addEventListener("click", async () => {
  if (!erpBridge || !window.opener) { alert("Open Moltrix from the ERP bookmark to send - or use \"Copy for ERP\" and paste it in the ERP panel (phone)."); return; }
  const payload = await erpBuildPayload(); if (!payload) return;
  try { window.opener.postMessage({ type: "moltrix-erp-data", payload }, ERP_ORIGIN); }
  catch (e) { alert("Couldn't reach the ERP window: " + e.message); return; }
  erpSendLog(`Sent ${payload.heats.length} ${payload.mode === "m2m" ? "voucher(s)" : "heat(s)"} for ${payload.date} - now press Start in the ERP window.`, "h");
});
document.getElementById("erpCopyBtn").addEventListener("click", async () => {
  const payload = await erpBuildPayload(); if (!payload) return;
  if (await erpCopyText(ERP_PASTE_TAG + JSON.stringify(payload)))
    erpSendLog(`Copied ${payload.heats.length} ${payload.mode === "m2m" ? "voucher(s)" : "heat(s)"} for ${payload.date}. Now open the ERP in Chrome → the right screen → Moltrix ERP bookmark → Paste → long-press the box → Paste → Load → Start.`, "h");
  else alert("Couldn't copy on this phone - try again, or use the PC.");
});
window.addEventListener("message", ev => {
  if (ev.origin !== ERP_ORIGIN || !ev.data) return;
  if (ev.data.type === "moltrix-erp-log") erpSendLog(ev.data.text, ev.data.cls);
});
(() => {
  const a = document.getElementById("erpBookmarklet");
  if (a) a.href = `javascript:(()=>{const s=document.createElement('script');s.src='${ERP_FILLER_URL}?t='+Date.now();document.body.appendChild(s);})()`;
  const bm = document.getElementById("erpBmCopy");
  if (bm && a) bm.addEventListener("click", async () => { if (await erpCopyText(a.href)) erpSendLog("Bookmark code copied - paste it as the URL of the Moltrix ERP bookmark in phone Chrome.", "h"); else alert("Couldn't copy - long-press the yellow Moltrix ERP button and copy the link address."); });
  erpSendRefresh(); erpModeNote();
  if (erpBridge && !/[?&]erpsub=(indent|req)\b/.test(location.search)) {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const nav = document.querySelector('#mainSidebar .navItem[data-section="erpprod"]');
      const app = document.getElementById("app");
      if (nav && app && !app.classList.contains("hidden") && typeof account !== "undefined" && account) {
        clearInterval(iv); nav.click();
        setTimeout(() => { openErpSub("entry"); const c = document.getElementById("erpSendBox"); if (c) c.scrollIntoView({ block: "start" });
          if (/[?&]erpsub=m2m\b/.test(location.search)) { const m = document.getElementById("erpSendMode"); if (m) { m.value = "m2m"; erpModeNote(); } } }, 400);
      } else if (Date.now() - t0 > 120000) clearInterval(iv);
    }, 500);
  }
})();
window._erpEntryTest = { erpEntryBuild, erpBatchOf };

/* ===================== ERP → INDENT / REQUISITION (item list from name/code or from a photo) ===================== */
(function irqModule() {
  const $ = id => document.getElementById(id);
  if (!$("irqItem")) return;
  const DRAFT_KEY = "moltrixIrqDraft";
  const norm = x => String(x == null ? "" : x).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const words = t => String(t || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(w => w.length >= 3 && !/^\d+$/.test(w));
  const qtyOk = q => /^\d+(\.\d+)?$/.test(String(q).trim()) && +q > 0;
  const S = { cat: null, catP: null, list: [] };
  const isoPlus = n => { const t = new Date(Date.now() + n * 864e5); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
  $("irqReqDate").value = isoPlus(15);
  try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); if (d && Array.isArray(d.list)) { S.list = d.list; if (d.type) $("irqType").value = d.type;
    if (d.purpose) $("irqPurpose").value = d.purpose; if (d.remark) $("irqRemark").value = d.remark; } } catch (e) {}
  const save = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ type: $("irqType").value, list: S.list, purpose: $("irqPurpose").value, remark: $("irqRemark").value })); } catch (e) {} };
  const isInd = () => $("irqType").value === "indent";
  const rateOk = r => /^\d+(\.\d+)?$/.test(String(r == null ? "" : r).trim()) && +r > 0;
  const label = it => `${it.code || "-"} · ${it.name}`;

  /* ---- item list: AOP + indent report + store issue files (same files as AOP vs Indent) ---- */
  function loadCat(force) {
    if (S.catP && !force) return S.catP;
    const st = $("irqCatSt"); st.textContent = "Loading the item list...";
    S.catP = (async () => {
      if (typeof window.aovCatalog !== "function") throw new Error("item list not available");
      const r = await window.aovCatalog();
      S.cat = r.items;
      $("irqItems").innerHTML = r.items.map(it => `<option value="${_escH(label(it))}">${_escH([it.um, it.src].filter(Boolean).join(" · "))}</option>`).join("");
      st.textContent = r.items.length ? "" : "No items found - choose the files in AOP vs Indent first.";
      return r.items;
    })().catch(e => { S.catP = null; st.textContent = "Item list: " + e.message; return []; });
    return S.catP;
  }
  function findTyped(txt) {
    const t = String(txt || "").trim(); if (!t || !S.cat) return null;
    const exact = S.cat.find(it => label(it) === t); if (exact) return exact;
    const n = norm(t);
    return S.cat.find(it => it.code && norm(it.code) === n) || S.cat.find(it => norm(it.name) === n) || null;
  }

  /* ---- list ---- */
  const rateOf = it => it.lastRate > 0 ? { rate: String(it.lastRate), rateNote: `last indent ${it.rateDate || ""}${it.rateNo ? " (" + it.rateNo + ")" : ""}`.trim() } : { rate: "", rateNote: "" };
  function addRow(it, qty, extra) {
    const same = S.list.find(x => it.code ? norm(x.code) === norm(it.code) : norm(x.name) === norm(it.name));
    if (same && !extra) { same.qty = String(+(+same.qty || 0) + +qty); }
    else S.list.push(Object.assign({ code: it.code || "", name: it.name || "", um: it.um || "", qty: String(qty), remark: "", check: "" }, rateOf(it), extra || {}));
    save(); draw();
  }
  function draw() {
    const box = $("irqList");
    $("irqBtns").classList.toggle("hidden", !S.list.length);
    $("irqAppLb").textContent = (isInd() ? "Indent" : "Requisition") + " → ERP (Chrome)";
    if (!S.list.length) { box.innerHTML = ""; return; }
    const rowBad = x => x.check || !x.code || !qtyOk(x.qty) || (isInd() && String(x.rate || "").trim() !== "" && !rateOk(x.rate));
    const bad = S.list.filter(rowBad).length;
    $("irqOptI").classList.toggle("hidden", !isInd()); $("irqOptR").classList.toggle("hidden", isInd());
    box.innerHTML = `<div class="aovNote" style="margin-bottom:6px;"><b>${S.list.length}</b> item(s) for ${$("irqType").value === "indent" ? "Indent" : "Requisition"}` +
      (bad ? ` · <span style="color:#c0392b;font-weight:700">${bad} to check (yellow)</span>` : "") + `</div>` +
      S.list.map((x, i) => {
        const warn = rowBad(x);
        return `<div class="irqCard${warn ? " irqWarn" : ""}"><div class="irqTop"><span class="irqNo">${i + 1}</span>` +
          `<input type="text" list="irqItems" data-k="item" data-i="${i}" value="${_escH(x.code || x.name ? label(x) : "")}" autocomplete="off" placeholder="pick the item" aria-label="Item">` +
          `<button class="secondary irqDel" type="button" data-del="${i}" aria-label="Remove">🗑</button></div>` +
          (x.name ? `<div class="irqName">${_escH(x.name)}</div>` : "") + (x.check ? `<div class="irqChk">${_escH(x.check)}</div>` : "") + (x.ocr ? `<div class="irqOcr">read: ${_escH(x.ocr)}</div>` : "") +
          `<div class="irqBot"><label>Qty<input type="text" inputmode="decimal" data-k="qty" data-i="${i}" value="${_escH(x.qty)}"></label>` +
          `<span class="irqUm">${_escH(x.um || "")}</span>` +
          (isInd() ? `<label>Rate if ERP has none<input type="text" inputmode="decimal" data-k="rate" data-i="${i}" value="${_escH(x.rate || "")}" style="width:96px"></label>` : "") +
          `<label class="irqRem">Note (Excel only)<input type="text" data-k="remark" data-i="${i}" value="${_escH(x.remark)}"></label></div>` +
          (isInd() ? `<div class="irqOcr">ERP's own rate is used${rateOk(x.rate) ? "; if the ERP has none: " + _escH(x.rate) + " (" + _escH(x.rateNote || "typed in the app") + ")" : "; if the ERP has none this item stops - type a rate here to avoid that"}</div>` : "") + `</div>`;
      }).join("");
  }
  $("irqList").addEventListener("change", ev => {
    const el = ev.target, i = +el.dataset.i, x = S.list[i]; if (!x) return;
    if (el.dataset.k === "qty") { x.qty = el.value.trim(); if (qtyOk(x.qty) && x.check === "check the qty") x.check = ""; }
    else if (el.dataset.k === "remark") x.remark = el.value.trim();
    else if (el.dataset.k === "rate") { x.rate = el.value.trim(); x.rateNote = rateOk(x.rate) ? "rate typed in the app" : ""; }
    else if (el.dataset.k === "item") {
      const it = findTyped(el.value);
      if (it) Object.assign(x, { code: it.code, name: it.name, um: it.um, check: qtyOk(x.qty) ? "" : "check the qty" }, rateOf(it));
      else { x.check = "pick the item from the list"; }
    }
    save(); draw();
  });
  $("irqList").addEventListener("click", ev => { const b = ev.target.closest("[data-del]"); if (!b) return; S.list.splice(+b.dataset.del, 1); save(); draw(); });
  $("irqType").addEventListener("change", () => { save(); draw(); });
  ["irqPurpose", "irqRemark"].forEach(id => $(id).addEventListener("change", save));
  $("irqClear").addEventListener("click", () => { if (!confirm("Clear the whole list?")) return; S.list = []; save(); draw(); });

  /* ---- option 1: pick by name / code ---- */
  $("irqItem").addEventListener("focus", () => loadCat());
  $("irqAdd").addEventListener("click", async () => {
    await loadCat();
    const it = findTyped($("irqItem").value), q = $("irqQty").value.trim(), st = $("irqCatSt");
    if (!it) { st.innerHTML = `<span style="color:#c0392b">Pick the item from the list (type part of the code or name).</span>`; return; }
    if (!qtyOk(q)) { st.innerHTML = `<span style="color:#c0392b">Enter the qty.</span>`; $("irqQty").focus(); return; }
    addRow(it, q); $("irqItem").value = ""; $("irqQty").value = ""; $("irqItem").focus();
  });
  $("irqQty").addEventListener("keydown", ev => { if (ev.key === "Enter") $("irqAdd").click(); });

  /* ---- option 2: photo -> OCR -> lines -> matched items ---- */
  function prep(cv) {   // grey, scaled so text is ~30px high, contrast stretched
    const sc = Math.max(1, Math.min(3, 2200 / Math.max(cv.width, cv.height)));
    const c = document.createElement("canvas"); c.width = Math.round(cv.width * sc); c.height = Math.round(cv.height * sc);
    const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(cv, 0, 0, c.width, c.height);
    const im = x.getImageData(0, 0, c.width, c.height), d = im.data; let lo = 255, hi = 0;
    for (let i = 0; i < d.length; i += 4) { const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = g; if (g < lo) lo = g; if (g > hi) hi = g; }
    const k = 255 / Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4) { const g = (d[i] - lo) * k; d[i] = d[i + 1] = d[i + 2] = g; }
    x.putImageData(im, 0, 0); return c;
  }
  const fixDigits = t => t.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/[Ss]/g, "5").replace(/B/g, "8").replace(/Z/g, "2");
  function parseLine(raw) {
    let t = String(raw || "").replace(/\s+/g, " ").trim();
    if (!t || !/[A-Za-z0-9]/.test(t)) return null;
    if (/^(s\.?\s*no|sr\.?|item\s*(code|name)|description|qty|quantity|uom|unit)\b/i.test(t) && !/\d{4,}/.test(t)) return null;   // header row
    let code = "";
    const cm = t.match(/(?:^|[\s(\[])([A-Z$]{1,3})[\s-]?([0-9OoIlSB|]{6,10})(?=$|[\s)\].,])/) || t.match(/(?:^|[\s(\[])()(\d{7,11})(?=$|[\s)\].,])/);
    if (cm) { code = cm[1].toUpperCase() + fixDigits(cm[2]); t = (t.slice(0, cm.index) + " " + t.slice(cm.index + cm[0].length)).trim(); }
    let qty = "";
    const qm = t.match(/(\d+(?:[.,]\d+)?)\s*(nos?|pcs?|kgs?|ltrs?|l|cyl|pkt|mtrs?|m|set|box|bottles?)?\.?\s*$/i);
    if (qm) { qty = qm[1].replace(",", "."); t = t.slice(0, qm.index).trim(); }
    const name = t.replace(/^\d{1,3}\s*[.)\-:]?\s+/, "").replace(/[|_=]+/g, " ").replace(/\s+/g, " ").trim();
    if (!code && words(name).length === 0) return null;
    return { code, qty, name, raw: String(raw).trim() };
  }
  function match(p) {
    const cat = S.cat || [];
    const byName = nameMatch(p, cat);
    if (p.code) {
      const ex = cat.find(it => norm(it.code) === norm(p.code)); if (ex) return { it: ex, sure: true };
      // the letter in front is often misread ($ or 5 for S) - compare the digits, the name must agree
      const dg = norm(p.code).replace(/^[A-Z]+/, ""), dOf = it => norm(it.code).replace(/^[A-Z]+/, "");
      const byDig = cat.filter(it => it.code && (dOf(it) === dg || (dg.length === dOf(it).length + 1 && /^5/.test(dg) && dg.slice(1) === dOf(it))));
      if (byDig.length === 1) return { it: byDig[0], sure: !!(byName && byName.it === byDig[0]), why: `code read as ${p.code}` };
      const near = cat.filter(it => it.code && norm(it.code).length === norm(p.code).length && rmLev(norm(it.code), norm(p.code)) <= 1);
      if (near.length === 1) return { it: near[0], sure: !!(byName && byName.it === near[0]), why: `code read as ${p.code}` };
    }
    return byName;
  }
  function nameMatch(p, cat) {
    const W = words(p.name); if (!W.length) return null;
    let best = null, bs = 0;
    cat.forEach(it => {
      const I = words(it.name); if (!I.length) return;
      let hit = 0; W.forEach(w => { if (I.some(v => v === w || (w.length >= 5 && v.length >= 5 && (v.startsWith(w.slice(0, 5)) || w.startsWith(v.slice(0, 5)))) || (w.length >= 4 && rmLev(w, v) <= 1))) hit++; });
      const sc = hit / Math.max(W.length, Math.min(I.length, 4));
      if (sc > bs) { bs = sc; best = it; }
    });
    return best && bs >= 0.5 ? { it: best, sure: false, why: "matched by name" } : null;
  }
  $("irqFileBtn").addEventListener("click", () => $("irqFile").click());
  $("irqFile").addEventListener("change", async () => {
    const f = $("irqFile").files[0]; $("irqFile").value = ""; if (!f) return;
    const st = $("irqOcrSt"); let worker = null;
    try {
      st.textContent = "Loading the item list...";
      await loadCat();
      st.textContent = "Reading the photo...";
      await rmLoadOcr();
      const cv = prep(await rmFileToCanvas(f));
      worker = await Tesseract.createWorker("eng");
      await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
      const { data } = await worker.recognize(cv);
      const lines = (data.lines || []).map(l => l.text).filter(Boolean);
      const got = lines.map(parseLine).filter(Boolean);
      if (!got.length) throw new Error("no item lines found in the photo - try a clearer, straight photo");
      let ok = 0, chk = 0;
      got.forEach(p => {
        const m = match(p);
        const qGood = qtyOk(p.qty);
        if (m) {
          const check = [m.sure ? "" : m.why + " - check the item", qGood ? "" : "check the qty"].filter(Boolean).join("; ");
          addRow(m.it, qGood ? p.qty : (p.qty || ""), { ocr: p.raw, check });
          check ? chk++ : ok++;
        } else {
          S.list.push({ code: "", name: "", um: "", qty: qGood ? p.qty : "", remark: "", ocr: p.raw, check: "not found in the item list - pick the item" }); chk++;
        }
      });
      save(); draw();
      st.innerHTML = `${got.length} line(s) read: <b>${ok}</b> sure` + (chk ? `, <b style="color:#c0392b">${chk}</b> to check (yellow) - fix them in the list below` : "") + ".";
    } catch (e) { st.innerHTML = `<span style="color:#c0392b">${_escH(e.message)}</span>`; }
    finally { if (worker) try { await worker.terminate(); } catch (e) {} }
  });

  /* ---- tabs ---- */
  document.querySelectorAll(".irqTab").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".irqTab").forEach(x => x.classList.toggle("active", x === b));
    $("irqPick").classList.toggle("hidden", b.dataset.irq !== "pick"); $("irqPhoto").classList.toggle("hidden", b.dataset.irq !== "photo");
    loadCat();
  }));
  document.querySelectorAll('#erpSubNav .navItem[data-suberp="indreq"]').forEach(b => b.addEventListener("click", () => loadCat()));

  /* ---- Send to ERP (Moltrix opened from the ERP bookmark) ---- */
  function sendLog(m, cls) { const L = $("irqSendLog"); const d = document.createElement("div"); d.textContent = m;
    d.style.color = cls === "err" ? "#c0392b" : cls === "ok" ? "#2e9d5b" : cls === "h" ? "#b7860b" : ""; L.appendChild(d); L.scrollTop = L.scrollHeight; }
  function sendHint() { $("irqSendHint").textContent = erpBridge ? "Opened from the ERP - Send to ERP, then Start in the ERP window (open Purchase Requisition Entry for an Indent, Store Issue Requisition for a Requisition)."
    : "PC: open Moltrix from the ERP with the Moltrix ERP bookmark, then Send to ERP. Phone: Copy for ERP, then paste it in the ERP panel."; }
  function irqPayload() {
    const ind = isInd(), bad = [];
    S.list.forEach((x, i) => {
      const n = `#${i + 1} ${x.code || x.ocr || ""}`;
      if (!x.code) bad.push(`${n}: pick the item`); else if (x.check) bad.push(`${n}: ${x.check}`);
      if (!qtyOk(x.qty)) bad.push(`${n}: qty`);
      if (ind && String(x.rate || "").trim() !== "" && !rateOk(x.rate)) bad.push(`${n}: rate`);
    });
    const codes = S.list.map(x => norm(x.code)), dup = codes.filter((c, i) => c && codes.indexOf(c) !== i);
    if (dup.length) bad.push("same item twice: " + [...new Set(dup)].join(", "));
    const rd = $("irqReqDate").value;
    if (ind && !rd) bad.push("required date"); if (ind && !$("irqPurpose").value.trim()) bad.push("purpose"); if (!ind && !$("irqRemark").value.trim()) bad.push("remark");
    if (!S.list.length) bad.push("the list is empty");
    if (bad.length) { alert("Fix first:\n" + bad.join("\n")); return null; }
    return { v: 1, mode: ind ? "indent" : "req", id: (ind ? "IND-" : "REQ-") + Date.now(),
      items: S.list.map(x => Object.assign({ code: x.code.trim(), name: x.name, um: x.um, qty: +x.qty }, ind ? { rate: rateOk(x.rate) ? +x.rate : 0 } : {})),
      opts: ind ? { series: "IR", cost: "LAB01", priority: "Medium", reqDate: rd.split("-").reverse().join("-"), purpose: $("irqPurpose").value.trim() }
        : { cost: "LAB01", godown: "CENTRAL STORE", remark: $("irqRemark").value.trim() } };
  }
  $("irqSend").addEventListener("click", () => {
    if (!erpBridge || !window.opener) { alert("Open Moltrix from the ERP with the Moltrix ERP bookmark (ERP → ERP Entry → set-up), then send - or use \"Copy for ERP\" and paste it in the ERP panel (phone)."); return; }
    const payload = irqPayload(); if (!payload) return;
    try { window.opener.postMessage({ type: "moltrix-erp-data", payload }, ERP_ORIGIN); }
    catch (e) { alert("Couldn't reach the ERP window: " + e.message); return; }
    sendLog(`Sent ${payload.items.length} item(s) for ${payload.mode === "indent" ? "Indent" : "Requisition"} - now press Start in the ERP window.`, "h");
  });
  // 14-Nov: the Indent saves from phone Chrome but the ERP refuses it from the app ("Problem in Approval") - so this
  // button copies the data and opens the ERP in Chrome; there: Moltrix ERP bookmark → Paste → Start
  $("irqApp").addEventListener("click", async () => {
    const payload = irqPayload(); if (!payload) return;
    const text = ERP_PASTE_TAG + JSON.stringify(payload);
    let ok = false;
    try { const a = document.createElement("textarea"); a.value = text; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:0;left:0;opacity:0;"; document.body.appendChild(a); a.select(); a.setSelectionRange(0, text.length); ok = document.execCommand("copy"); a.remove(); } catch (e) {}
    // Inside the Moltrix app (Chrome-based) any link to the ERP opens in a small tab with no address bar and no "Open in
    // Chrome", so the bookmark can't be used there - in the app only copy; in a normal Chrome tab open the ERP next to it
    const erpUrl = ERP_ORIGIN + ERP_PATH;
    const inApp = !!window.MZ_NATIVE || (window.matchMedia && (matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches)) || /^android-app:/.test(document.referrer || "");
    const w = inApp ? true : window.open(erpUrl, "moltrixErpChrome");
    if (!ok) ok = await erpCopyText(text);
    const scr = payload.mode === "indent" ? "Purchase Requisition Entry" : "Store Issue Requisition";
    sendLog(ok ? (inApp ? `Copied ${payload.items.length} item(s). Now open the Chrome app (not this app) → ERP tab → ${scr} → address bar → "Moltrix ERP" bookmark → Paste → Start.`
                        : `Copied ${payload.items.length} item(s). In the ERP tab: open ${scr} → address bar → "Moltrix ERP" bookmark → Paste → Start.`)
               : "Couldn't copy - press 📋 Copy for ERP below, then use the ERP tab.", ok ? "h" : "err");
    if (ok && inApp) alert(`Copied ✓\n\nNow open the Chrome app → ERP tab → ${scr} → type "Moltrix ERP" in the address bar → the bookmark → Paste → Start.`);
    if (!w) sendLog(`The ERP tab didn't open (pop-up blocked?) - open ${ERP_ORIGIN}${ERP_PATH} in Chrome yourself.`, "err");
  });
  $("irqCopy").addEventListener("click", async () => {
    const payload = irqPayload(); if (!payload) return;
    if (await erpCopyText(ERP_PASTE_TAG + JSON.stringify(payload)))
      sendLog(`Copied ${payload.items.length} item(s) for ${payload.mode === "indent" ? "Indent" : "Requisition"}. Now open the ERP in Chrome → ${payload.mode === "indent" ? "Purchase Requisition Entry" : "Store Issue Requisition"} → Moltrix ERP bookmark → Paste → long-press the box → Paste → Load → Start.`, "h");
    else alert("Couldn't copy on this phone - try again, or use the PC.");
  });
  window.addEventListener("message", ev => {
    if (ev.origin !== ERP_ORIGIN || !ev.data) return;
    if (ev.data.type === "moltrix-erp-log" && !$("suberp-indreq").classList.contains("hidden")) sendLog(ev.data.text, ev.data.cls);
    if (ev.data.type === "moltrix-erp-irq-done" && ev.data.vr && ev.data.vr !== "DRY RUN") sendLog(`Saved in the ERP as ${ev.data.vr}. Clear the list when you are done.`, "ok");
  });
  // opened from the ERP on the Indent / Requisition screen → straight to this tile
  (() => {
    let sub = ""; try { sub = new URLSearchParams(location.search).get("erpsub") || ""; } catch (e) {}
    if (!erpBridge || !/^(indent|req)$/.test(sub)) return;
    $("irqType").value = sub; save();
    const t0 = Date.now(), iv = setInterval(() => {
      const nav = document.querySelector('#mainSidebar .navItem[data-section="erpprod"]'), app = document.getElementById("app");
      if (nav && app && !app.classList.contains("hidden") && typeof account !== "undefined" && account) {
        clearInterval(iv); nav.click(); setTimeout(() => { openErpSub("indreq"); loadCat(); draw(); }, 700);
      } else if (Date.now() - t0 > 120000) clearInterval(iv);
    }, 500);
  })();
  sendHint();

  /* ---- Excel ---- */
  $("irqXlsx").addEventListener("click", () => {
    if (!S.list.length) return;
    const typ = $("irqType").value === "indent" ? "Indent" : "Requisition";
    const ind = isInd();
    const rows = [[typ + " list - " + new Date().toLocaleDateString("en-GB")], [], ["#", "Item Code", "Item Name", "UM", "Qty"].concat(ind ? ["Rate if ERP has none (Rs)", "Rate from"] : [], ["Note", "Check"])]
      .concat(S.list.map((x, i) => [i + 1, x.code, x.name, x.um, qtyOk(x.qty) ? +x.qty : x.qty].concat(ind ? [rateOk(x.rate) ? +x.rate : "", x.rateNote || ""] : [], [x.remark, x.check || ""])));
    const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = [{ wch: 4 }, { wch: 13 }, { wch: 46 }, { wch: 7 }, { wch: 9 }].concat(ind ? [{ wch: 10 }, { wch: 28 }] : [], [{ wch: 22 }, { wch: 30 }]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, typ);
    XLSX.writeFile(wb, `${typ}_list_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
  draw();
  window._irqTest = { parseLine, match, S, draw, addRow };
})();

/* ===================== HOT OUT ENTRY ===================== */
const HOTOUT_OFFSETS = {
  "130": { 6: 4, 5: 5, 4: 6, 3: 7, weight: 8 },
  "160": { 6: 12, 5: 13, 4: 14, 3: 15, weight: 16 }
};

async function submitHotOut() {
  const statusEl = document.getElementById("status");
  const manualFilePath = document.getElementById("filePath").value.trim();
  const sheetName = document.getElementById("sheetName").value.trim();
  const dateVal = document.getElementById("hotoutDate").value; // "YYYY-MM-DD"
  const section = document.getElementById("hotoutSectionSelect").value;

  const data = {
    6: document.getElementById("hotoutPcs6").value.trim(),
    5: document.getElementById("hotoutPcs5").value.trim(),
    4: document.getElementById("hotoutPcs4").value.trim(),
    3: document.getElementById("hotoutPcs3").value.trim(),
    weight: document.getElementById("hotoutWeight").value.trim()
  };

  if (!dateVal) {
    statusEl.className = "err";
    statusEl.textContent = "Please select a date first.";
    return;
  }

  // Other party -> only the Billet Stock Format sheet (column E "+pcs"), not the Prod. sheet
  const hoParty = (document.getElementById("hotoutParty") || {}).value || "MIPPL";
  if (hoParty !== "MIPPL") { await submitHotOutToParty(dateVal, section, hoParty, data); return; }

  statusEl.className = "wait";
  statusEl.textContent = "Hot Out entry in progress...";

  try {
    const token = await getToken();

    // Auto-detect the correct month's file from the picked date (same fix
    // as RHF Billets Entry) - otherwise this keeps using whatever file
    // happens to be in the File Location box, which fails with a 404
    // once the month rolls over.
    const [hoy, hom] = dateVal.split("-").map(Number);
    statusEl.textContent = `Locating the file for ${MONTH_ABBR[hom - 1]} ${hoy}...`;
    const hoAutoPath = await detectFilePathForMonth(token, hoy, hom - 1);
    let filePath = hoAutoPath || manualFilePath;
    if (!filePath) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't automatically find the file for ${MONTH_ABBR[hom - 1]} ${hoy} - is it on your OneDrive? (Menu → Get Started → Put formats on the Desktop)`;
      return;
    }

    statusEl.textContent = "Hot Out entry in progress...";
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
    const offsets = HOTOUT_OFFSETS[section];
    let log = "";

    // Cells are collected and written in ONE call (patchCells) instead of one call each.
    const _pieces = [];
    const patchRange = async (_wb, _sheet, addr, values) => { _pieces.push({ addr, values }); };
    for (const len of [6, 5, 4, 3]) {
      const v = data[len];
      if (v !== "") {
        const r = titleRow + offsets[len];
        await patchRange(wb, sheetName, `AQ${r}:AQ${r}`, [[parseFloat(v)]], token);
        log += `[${section}] ${len}Mtr pcs = ${v} (AQ${r})\n`;
      }
    }
    if (data.weight !== "") {
      const rw = titleRow + offsets.weight;
      await patchRange(wb, sheetName, `AR${rw}:AR${rw}`, [[parseFloat(data.weight)]], token);
      log += `[${section}] Weight = ${data.weight} MT (AR${rw})\n`;
    }

    await patchCells(wb, sheetName, rowPiecesToCells(_pieces), token);
    if (log === "") {
      statusEl.className = "err";
      statusEl.textContent = "Please fill in at least one cell.";
      return;
    }

    statusEl.className = "ok";
    statusEl.textContent = `Hot Out (${dateVal}) updated:\n${log}`;
    showCompletionPopup(`Hot Out (${dateVal}) updated:\n${log}`);

    ["hotoutPcs6", "hotoutPcs5", "hotoutPcs4", "hotoutPcs3", "hotoutWeight"]
      .forEach(id => document.getElementById(id).value = "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("hotoutBtn").addEventListener("click", submitHotOut);
/* ---- Hot Out to another party: "+pcs" in that party's row (column E) of the date's block in "Billet Stock Format" ---- */
mzAfterLoad(function initHotOutParty() { // runs after the whole script, so PARTY_STOCK_NAMES (declared further down) is ready
  const HOTOUT_PARTIES = ["MIPPL", ...new Set([...PARTY_STOCK_NAMES, ...Object.values(RHF_PARTY_ALIAS)])];
  const sel = document.getElementById("hotoutParty"); if (!sel) return;
  sel.innerHTML = HOTOUT_PARTIES.map(p => `<option value="${p}">${p}</option>`).join("");
  const note = document.getElementById("hotoutPartyNote");
  const upd = () => {
    const party = sel.value !== "MIPPL";
    note.textContent = party
      ? `${sel.value}: total pcs (6+5+4+3 mtr) are added as "+pcs" in column E of the ${sel.value} row of that date's block in the Billet Stock Format sheet. Weight is not used.`
      : "MIPPL: entry goes to the Prod. sheet Hot Out cells (as before).";
    document.getElementById("hotoutWeight").disabled = party;
    if (party) document.getElementById("hotoutWeight").value = "";
  };
  sel.addEventListener("change", upd); upd();
});
async function submitHotOutToParty(dateVal, section, party, data) {
  const statusEl = document.getElementById("status");
  const parts = [6, 5, 4, 3].filter(l => data[l] !== "").map(l => ({ l, n: Number(data[l]) }));
  if (!parts.length) { statusEl.className = "err"; statusEl.textContent = "Please fill in at least one pcs cell."; return; }
  const bad = parts.find(x => !Number.isFinite(x.n) || x.n < 0 || Math.round(x.n) !== x.n);
  if (bad) { statusEl.className = "err"; statusEl.textContent = `${bad.l}mtr pcs must be a whole number.`; return; }
  const pcs = parts.reduce((a, x) => a + x.n, 0);
  if (!pcs) { statusEl.className = "err"; statusEl.textContent = "Total pcs is 0 - nothing to add."; return; }
  const [yy, mm, dd] = dateVal.split("-");
  const asOn = `${dd}.${mm}.${yy}`;
  if (!confirm(`Hot Out → ${party}\nDate: ${asOn} · Section: ${section}\n${parts.map(x => `${x.l}mtr: ${x.n}`).join(" · ")}\n\nAdd "+${pcs}" in Billet Stock Format (column E, ${party} ${section} row)?`)) return;
  statusEl.className = "wait";
  statusEl.textContent = `Hot Out (${party}) entry in progress...`;
  try {
    const token = await getToken();
    const path = await detectFilePathForMonth(token, +yy, +mm - 1) || document.getElementById("filePath").value.trim();
    if (!path) throw new Error(`file for ${MONTH_ABBR[+mm - 1]} ${yy} not found`);
    const wb = await resolveWorkbook(token, path);
    const sheet = document.getElementById("stockSheetName").value.trim() || "Billet Stock Format";
    const rng = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheet).replace(/'/g, "''"))}')/range(address='A1:E1500')?$select=values,formulas`, token);
    const asRow = rng.values.findIndex(r => String(r[0] || "").replace(/\s+/g, " ").includes("As on " + asOn));
    if (asRow < 0) throw new Error(`${sheet}: block "As on ${asOn}" not found (create that day's block first)`);
    const normName = (x) => String(x || "").toUpperCase().replace(/[^A-Z]/g, "");
    let row = -1;
    for (let i = asRow + 1; i < Math.min(rng.values.length, asRow + 40); i++) {
      if (/^total$/i.test(String(rng.values[i][0] || "").trim())) break;
      if (partyNameMatch(rng.values[i][1], party) && String(rng.values[i][2] || "").replace(/\s/g, "").startsWith(section)) { row = i; break; }
    }
    if (row < 0) throw new Error(`${party} ${section}: row not found in the "As on ${asOn}" block of ${sheet}`);
    const f = rng.formulas[row][4];
    const base = (typeof f === "string" && f.startsWith("=")) ? f : "=" + (f === "" || f == null ? 0 : f);
    const nf = `${base}+${pcs}`;
    await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheet).replace(/'/g, "''"))}')/range(address='E${row + 1}')`, token,
      { method: "PATCH", body: JSON.stringify({ formulas: [[nf]] }) });
    const msg = `Hot Out → ${party} (${asOn}, ${section}):\n${parts.map(x => `${x.l}mtr ${x.n}`).join(" · ")} = +${pcs} pcs\n${sheet} E${row + 1}: ${nf}`;
    statusEl.className = "ok"; statusEl.textContent = msg;
    showCompletionPopup(msg);
    ["hotoutPcs6", "hotoutPcs5", "hotoutPcs4", "hotoutPcs3", "hotoutWeight"].forEach(id => document.getElementById(id).value = "");
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Hot Out (" + party + ") error: " + e.message;
  }
}

