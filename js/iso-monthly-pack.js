/* ===================== ISO 9001 - MONTHLY PACK (all 5 records in one PDF) ===================== */
// After a month ends the app offers to prepare that month's 5 ISO 9001 records
// (NCR & CAPA, Calibration, Vendor Rating, Traceability, Quality Objectives) from
// the data it can read itself, and asks only for what the data cannot give.
(function isoPack() {
  const $ = id => document.getElementById(id);
  const LSget = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const LSset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const ymLabel = ym => { const [y, m] = ym.split("-").map(Number); return `${MONTH_ABBR[m - 1]} ${y}`; };
  const prevYM = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const monthEnd = ym => { const [y, m] = ym.split("-").map(Number); return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`; };
  const dmy = iso => iso ? String(iso).split("-").reverse().join("-") : "";
  const num = v => typeof v === "number" ? v : (v === "" || v == null ? null : (isNaN(parseFloat(v)) ? null : parseFloat(v)));
  const f3 = v => typeof v === "number" ? v.toFixed(3) : (v == null ? "" : String(v));
  const f2 = v => typeof v === "number" ? v.toFixed(2) : "";

  // ---------- question popup ----------
  function ask({ step, title, intro, fields, html, buttons }) {
    return new Promise(resolve => {
      let ov = $("isoAskOverlay");
      if (!ov) { ov = document.createElement("div"); ov.id = "isoAskOverlay"; ov.className = "pdfOverlay"; document.body.appendChild(ov); }
      const f = (fields || []).map(x => {
        const id = "isoF_" + x.key;
        if (x.type === "textarea") return `<label for="${id}">${esc(x.label)}</label><textarea id="${id}" placeholder="${esc(x.ph || "")}">${esc(x.value || "")}</textarea>`;
        if (x.type === "rating") return `<label for="${id}">${esc(x.label)}</label><select id="${id}">` +
          ["", 1, 2, 3, 4, 5].map(v => `<option value="${v}" ${String(x.value) === String(v) && v !== "" ? "selected" : ""}>${v === "" ? "- choose -" : v}</option>`).join("") + `</select>`;
        return `<label for="${id}">${esc(x.label)}</label><input type="${x.type || "text"}" id="${id}" value="${esc(x.value == null ? "" : x.value)}" placeholder="${esc(x.ph || "")}"${x.step ? ` step="${x.step}"` : ""}>`;
      }).join("");
      const btns = buttons || [["save", "Save & next", "primary"], ["skip", "Skip for now", "secondary"]];
      ov.innerHTML = `<div class="card isoAskCard">${step ? `<div class="isoAskStep">${esc(step)}</div>` : ""}<h3>${esc(title)}</h3>` +
        (intro ? `<div class="isoAskIntro">${intro}</div>` : "") + (html || "") + f +
        `<div class="btnRow isoAskBtns">${btns.map(([k, l, c]) => `<button type="button" class="${c}" data-k="${k}">${esc(l)}</button>`).join("")}</div></div>`;
      ov.classList.remove("hidden");
      ov.querySelectorAll("button[data-k]").forEach(b => b.addEventListener("click", () => {
        const v = {};
        (fields || []).forEach(x => { const el = $("isoF_" + x.key); v[x.key] = el ? el.value.trim() : ""; });
        ov.querySelectorAll("[data-iso]").forEach(el => { v[el.dataset.iso] = el.value.trim(); });
        ov.classList.add("hidden"); ov.innerHTML = "";
        resolve({ k: b.dataset.k, v });
      }));
    });
  }
  const say = (cls, txt) => { const st = $("status"); if (st) { st.className = cls; st.textContent = txt; } const p = $("isoPackStatus"); if (p) p.textContent = txt; };

  // ---------- data the app reads itself ----------
  async function loadHeats(token, ym) {
    const [y, m] = ym.split("-").map(Number);
    const path = await detectFilePathForMonth(token, y, m - 1);
    if (!path) throw new Error(`${ymLabel(ym)} production file not found`);
    const wb = await resolveWorkbook(token, path);
    const data = await graphFetch(`${wb}/worksheets('Prod.')/range(address='A1:AB2000')?$select=values`, token);
    const values = data.values || [], from = `${ym}-01`, to = monthEnd(ym), seen = new Set(), heats = [];
    for (let i = 0; i < values.length; i++) {
      if (typeof values[i][0] !== "number") continue;
      const iso = excelSerialToISODate(values[i][0]);
      if (!(iso >= from && iso <= to)) continue;
      for (let j = i; j < Math.min(i + 12, values.length); j++) {
        const row = values[j];
        if (seen.has(j) || !row[1]) continue;
        seen.add(j);
        heats.push({ date: iso, heat: String(row[1]).trim(), c: row[2], mn: row[3], si: row[4], s: row[5], p: row[6], size: row[7],
          t: typeof row[27] === "number" ? row[27] : null, issues: checkOutOfSpec(row) });
      }
    }
    return { path, heats };
  }
  async function loadEdgeCrack(token, ym) {
    const path = (($("ecFilePath") || {}).value || "Desktop/Strip_Coils_EDGE_CRACK_Data.xlsm").trim();
    const sheet = (($("ecSheetName") || {}).value || "Sheet1").trim();
    const wb = await resolveWorkbook(token, path);
    const data = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheet).replace(/'/g, "''"))}')/range(address='A2:K500')?$select=values`, token);
    return (data.values || []).filter(r => r[0] && (pipeMillDateToISO(r[0]) || "").slice(0, 7) === ym).map(r => ({
      reason: String(r[1] || "").trim(), strip: Number(r[2]) || 0, buildup: Number(r[4]) || 0, tube: Number(r[6]) || 0,
      total: Number(r[8]) || 0, totalStrip: Number(r[10]) || 0 }));
  }
  // Inward raw material lots of the month, grouped by supplier (Party Name) + material.
  // A lot is "in spec" when every value that was tested meets the PO; untested values are not judged.
  const VEN_RULES = {
    "SILICO MANGANES": { label: "Silico Manganese", rules: r => [["Over size +150 mm %", r.plus150, "max", SILICO_PO.overSize], ["Under size -25 mm %", r.minus25, "max", SILICO_PO.underSize],
      ["Mn %", r.mn, "min", r.minLimit != null ? r.minLimit : SILICO_PO.mn], ["Si %", r.si, "min", SILICO_PO.si], ["C %", r.c, "max", SILICO_PO.c], ["P %", r.p, "max", SILICO_PO.p], ["S %", r.s, "max", SILICO_PO.s]] },
    "SPONGE IRON LUM": { label: "Sponge Iron Lumps", rules: r => [["Over size +20 mm %", r.plus20, "max", LUMPS_PO.overSize], ["Under size -4 mm %", r.minus4, "max", LUMPS_PO.underSize],
      ["Fe(M) %", r.fem, "min", r.minLimit != null ? r.minLimit : LUMPS_PO.fem], ["P %", r.p, "max", LUMPS_PO.p], ["S %", r.s, "max", LUMPS_PO.s], ["N.Mag %", r.nmag, "max", LUMPS_PO.nmag]] },
    "SPONGE IRON FIN": { label: "Sponge Iron Fines", rules: r => [["Under size -1 mm %", r.minus1, "max", FINES_PO.underSize],
      ["Fe(M) %", r.fem, "min", r.minLimit], ["P %", r.p, "max", FINES_PO.p], ["S %", r.s, "max", FINES_PO.s], ["N.Mag %", r.nmag, "max", FINES_PO.nmag]] }
  };
  const qualityRating = pct => pct == null ? null : pct >= 95 ? 5 : pct >= 85 ? 4 : pct >= 70 ? 3 : pct >= 50 ? 2 : 1;
  async function loadVendors(token, ym) {
    const { data, col: col0, rowCol, isHeader } = await readInwardRmTable1(token);
    const colErr = inwardRmMissingColsError(col0);
    if (colErr) throw new Error(colErr);
    const from = `${ym}-01`, to = monthEnd(ym), groups = {};
    for (let i = 1; i < data.values.length; i++) {
      if (isHeader(i)) continue;
      const row = data.values[i], txt = data.text[i], col = rowCol[i];
      const bucket = classifyInwardItem(row[col.itemName]);
      if (!bucket) continue;
      const iso = inwardRmDateToISO(row[col.grnDate], txt[col.grnDate]);
      if (!iso || iso < from || iso > to) continue;
      const party = String(row[col.partyName] || "").trim() || "(no party name)";
      const k = party.toUpperCase() + "|" + bucket;
      const g = groups[k] || (groups[k] = { key: k, party, bucket, material: VEN_RULES[bucket].label, lots: 0, tested: 0, ok: 0, fails: {} });
      g.lots++;
      const r = {}; ["plus150", "plus20", "minus1", "minus25", "minus4", "c", "fem", "mn", "nmag", "p", "s", "si", "minLimit"].forEach(f => { r[f] = num(row[col[f]]); });
      const checks = VEN_RULES[bucket].rules(r).filter(([, v, , lim]) => v != null && lim != null);
      if (!checks.length) continue;
      g.tested++;
      const bad = checks.filter(([, v, t, lim]) => { const x = Math.round(v * 1000) / 1000; return t === "max" ? x > lim : x < lim; });
      if (!bad.length) g.ok++; else bad.forEach(([n]) => { g.fails[n] = (g.fails[n] || 0) + 1; });
    }
    return Object.values(groups).sort((a, b) => a.party.localeCompare(b.party) || a.material.localeCompare(b.material)).map(g => {
      g.pct = g.tested ? g.ok / g.tested * 100 : null; g.q = qualityRating(g.pct); return g; });
  }

  // ---------- the wizard ----------
  let running = false;
  async function run(ym) {
    if (running) return; running = true;
    try {
      const token = await getToken();
      const label = ymLabel(ym), R = { ym, errors: {} };
      // record numbers - asked once, may stay blank
      if (!LSget("isoDocNosAsked", false)) {
        const a = await ask({ step: "Setup (asked once)", title: "Document / format numbers",
          intro: "If your ISO records have format numbers, type them here - they print on every page. Leave blank if not used. You can change them later (Monthly ISO Pack → Doc numbers).",
          fields: [["ncr", "NCR & CAPA Log"], ["cal", "Calibration Log"], ["ven", "Vendor Rating"], ["trace", "Traceability Register"], ["obj", "Quality Objectives"]].map(([k, l]) => ({ key: k, label: l, value: (LSget("isoDocNos", {}))[k] || "" })),
          buttons: [["save", "Save", "primary"], ["skip", "Not used", "secondary"]] });
        if (a.k === "save") LSset("isoDocNos", a.v);
        LSset("isoDocNosAsked", true);
      }
      say("wait", `ISO pack ${label}: reading the production file...`);
      try { R.prod = await loadHeats(token, ym); } catch (e) { R.errors.prod = shortError(e.message || e); }
      say("wait", `ISO pack ${label}: reading the edge crack file...`);
      try { R.ec = await loadEdgeCrack(token, ym); } catch (e) { R.errors.ec = shortError(e.message || e); }
      say("wait", `ISO pack ${label}: reading Inward Raw Material data...`);
      try { R.ven = await loadVendors(token, ym); } catch (e) { R.errors.ven = shortError(e.message || e); }
      say("wait", `ISO pack ${label}: a few questions for you...`);

      // 1. NCR & CAPA - one per edge crack line of the month
      const ncrs = getNcrList(), dismissed = LSget("isoNcrDismiss", {});
      const ecRows = (R.ec || []).filter(r => r.total > 0);
      const lastResp = (ncrs.slice().reverse().find(n => n.responsible) || {}).responsible || "";
      let n = 0;
      for (const r of ecRows) {
        n++;
        const key = `EC|${ym}|${r.reason}`;
        if (dismissed[key] || ncrs.some(x => x.key === key && x.rootCause && x.action)) continue;
        const pct = r.totalStrip > 0 ? (r.total / r.totalStrip * 100) : null;
        const desc = `Edge crack rejection ${label}: Grand Total ${f2(r.total)}` + (pct != null ? ` (${pct.toFixed(3)}% of Total Strip ${f2(r.totalStrip)})` : "") +
          ` - Strip Mill ${f2(r.strip)}, Buildup ${f2(r.buildup)}, Tube Mill ${f2(r.tube)}` + (r.reason ? ` - Reason in file: ${r.reason}` : "");
        const old = ncrs.find(x => x.key === key) || {};
        const a = await ask({ step: `1 of 4 · NCR & CAPA (${n}/${ecRows.length})`, title: "Edge crack NCR",
          intro: `<b>${esc(desc)}</b><br><span class="isoAskHint">From ${esc(($("ecFilePath") || {}).value || "the edge crack file")}. Fill what the file cannot tell.</span>`,
          fields: [{ key: "rootCause", label: "Root cause", type: "textarea", value: old.rootCause || r.reason },
            { key: "action", label: "Corrective action", type: "textarea", value: old.action || "" },
            { key: "responsible", label: "Responsible person", value: old.responsible || lastResp },
            { key: "targetDate", label: "Target closure date", type: "date", value: old.targetDate || "" }],
          buttons: [["save", "Save NCR", "primary"], ["skip", "Skip for now", "secondary"], ["none", "No NCR needed", "secondary"]] });
        if (a.k === "none") { dismissed[key] = 1; LSset("isoNcrDismiss", dismissed); continue; }
        if (a.k !== "save") continue;
        const rec = { date: monthEnd(ym), description: desc, rootCause: a.v.rootCause, action: a.v.action, responsible: a.v.responsible,
          targetDate: a.v.targetDate, status: old.status || "open", key, src: "Edge crack", ym };
        const i = ncrs.findIndex(x => x.key === key);
        if (i >= 0) ncrs[i] = Object.assign(ncrs[i], rec); else ncrs.push(rec);
        saveNcrList(ncrs);
      }
      if (typeof renderNcrTable === "function") renderNcrTable();

      // 2. Calibration - add equipment if none; update overdue / incomplete entries
      let cal = getCalList();
      if (!cal.length) {
        for (;;) {
          const a = await ask({ step: "2 of 4 · Calibration", title: "No equipment in the Calibration Log yet",
            intro: "Add the instruments that need calibration (spectrometer, balance, furnace thermocouple...). Add one, then the next.",
            fields: [{ key: "name", label: "Equipment name" }, { key: "id", label: "Equipment ID / Serial No." }, { key: "lastDate", label: "Last calibration date", type: "date" },
              { key: "dueDate", label: "Next due date", type: "date" }, { key: "agency", label: "Calibrated by / Agency" }, { key: "certNo", label: "Certificate No." }],
            buttons: [["more", "Add & next instrument", "primary"], ["done", "Add & finish", "primary"], ["skip", "Skip for now", "secondary"]] });
          if (a.k === "skip") break;
          if (a.v.name && a.v.dueDate) { cal.push({ name: a.v.name, id: a.v.id, lastDate: a.v.lastDate, dueDate: a.v.dueDate, agency: a.v.agency, certNo: a.v.certNo }); saveCalList(cal); }
          else alert("Equipment name and Next due date are needed - this one was not added.");
          if (a.k === "done") break;
        }
      } else {
        const today = todayISO();
        const need = cal.map((c, i) => ({ c, i })).filter(({ c }) => !c.dueDate || c.dueDate < today || !c.lastDate || !c.agency || !c.certNo);
        if (need.length) {
          const rows = need.map(({ c, i }) => `<tr><td><b>${esc(c.name)}</b><br><small>${esc(c.id || "")}${c.dueDate && c.dueDate < today ? ` · <span style="color:#e5533d;">due ${esc(dmy(c.dueDate))} passed</span>` : ""}</small></td>` +
            `<td><input type="date" data-iso="l${i}" value="${esc(c.lastDate || "")}"></td><td><input type="date" data-iso="d${i}" value="${esc(c.dueDate || "")}"></td>` +
            `<td><input type="text" data-iso="a${i}" value="${esc(c.agency || "")}" placeholder="Agency"></td><td><input type="text" data-iso="c${i}" value="${esc(c.certNo || "")}" placeholder="Cert No."></td></tr>`).join("");
          const a = await ask({ step: "2 of 4 · Calibration", title: `${need.length} instrument(s) need details`,
            intro: "Dates are missing, overdue, or the agency / certificate no. is blank. Fill what you have - anything left blank stays as it is and shows as 'Not provided' in the pack.",
            html: `<div class="tableScroll"><table class="matrixTable isoVenTable isoCalTable"><tr><th>Equipment</th><th>Last calibration</th><th>Next due</th><th>Agency</th><th>Certificate No.</th></tr>${rows}</table></div>` });
          if (a.k === "save") {
            cal = getCalList();
            need.forEach(({ i }) => { if (!cal[i]) return; [["l", "lastDate"], ["d", "dueDate"], ["a", "agency"], ["c", "certNo"]].forEach(([p, f]) => { const v = a.v[p + i]; if (v) cal[i][f] = v; }); });
            saveCalList(cal);
          }
        }
      }
      if (typeof renderCalTable === "function") renderCalTable();
      if (typeof checkCalibrationReminders === "function") checkCalibrationReminders();

      // 3. Vendor rating - quality from the data, delivery & price from you
      if (R.ven && R.ven.length) {
        const prev = LSget("isoVenRatings", {});
        const lastOf = key => { const ms = Object.keys(prev).filter(m => m < ym && prev[m][key]).sort(); return ms.length ? prev[ms[ms.length - 1]][key] : {}; };
        const cur = prev[ym] || {};
        const sel = (k, v) => `<select data-iso="${esc(k)}">${["", 1, 2, 3, 4, 5].map(x => `<option value="${x}" ${String(v) === String(x) && x !== "" ? "selected" : ""}>${x === "" ? "-" : x}</option>`).join("")}</select>`;
        const rows = R.ven.map((g, i) => { const old = cur[g.key] || lastOf(g.key);
          return `<tr><td><b>${esc(g.party)}</b><br><small>${esc(g.material)} · ${g.lots} lot(s)</small></td><td>${g.q == null ? "not tested" : `${g.q} <small>(${g.pct.toFixed(0)}% in spec)</small>`}</td>` +
            `<td>${sel("d" + i, old.d)}</td><td>${sel("p" + i, old.p)}</td></tr>`; }).join("");
        const a = await ask({ step: "3 of 4 · Vendor rating", title: `Suppliers in ${label}`,
          intro: "Quality is worked out from the lab results (lots meeting the PO). Give <b>Delivery</b> and <b>Price</b> 1 to 5 (5 = best). Last month's marks are filled in where available.",
          html: `<div class="tableScroll"><table class="matrixTable isoVenTable"><tr><th>Supplier</th><th>Quality</th><th>Delivery</th><th>Price</th></tr>${rows}</table></div>` });
        if (a.k === "save") {
          const out = {}; R.ven.forEach((g, i) => { out[g.key] = { d: a.v["d" + i] || "", p: a.v["p" + i] || "" }; });
          prev[ym] = out; LSset("isoVenRatings", prev);
          // also kept in the Vendor Rating page
          let vl = getVenList().filter(x => x.isoYm !== ym);
          R.ven.forEach(g => { const d = parseInt(out[g.key].d, 10), p = parseInt(out[g.key].p, 10);
            if (g.q != null && d && p) vl.push({ vendor: `${g.party} (${g.material})`, date: monthEnd(ym), quality: g.q, delivery: d, price: p,
              remarks: `Auto ${label}: ${g.ok}/${g.tested} tested lot(s) in spec`, isoYm: ym }); });
          saveVenList(vl); if (typeof renderVenTable === "function") renderVenTable();
        }
      }

      // 4. Quality objectives - targets
      const objT = getObjTargets(), ext = LSget("isoObjExt", {});
      const lastKey = (o, f) => { const ms = Object.keys(o).filter(m => m <= ym && (f ? o[m] && o[m][f] != null && o[m][f] !== "" : o[m] != null)).sort(); return ms.length ? ms[ms.length - 1] : null; };
      const lk = lastKey(objT), le = lastKey(ext, "ec"), lp = lastKey(ext, "prod");
      const a4 = await ask({ step: "4 of 4 · Quality objectives", title: `Targets for ${label}`,
        intro: "Leave a box blank if that objective is not tracked. Previous targets are filled in.",
        fields: [{ key: "oos", label: "Out-of-spec heats (%) should be under", type: "number", step: "0.1", value: objT[ym] != null ? objT[ym] : (lk ? objT[lk] : "") },
          { key: "ec", label: "Edge crack rejection (%) should be under", type: "number", step: "0.01", value: ext[ym] && ext[ym].ec != null ? ext[ym].ec : (le ? ext[le].ec : "") },
          { key: "prod", label: "Month production target (MT) - at least", type: "number", step: "100", value: ext[ym] && ext[ym].prod != null ? ext[ym].prod : (lp ? ext[lp].prod : (localStorage.getItem("monthProdTarget") || "")) }],
        buttons: [["save", "Save & make the pack", "primary"], ["skip", "Make the pack without changes", "secondary"]] });
      if (a4.k === "save") {
        if (a4.v.oos !== "") objT[ym] = parseFloat(a4.v.oos); else delete objT[ym];
        localStorage.setItem("iso9001_objectives", JSON.stringify(objT));
        ext[ym] = { ec: a4.v.ec === "" ? null : parseFloat(a4.v.ec), prod: a4.v.prod === "" ? null : parseFloat(a4.v.prod) };
        LSset("isoObjExt", ext);
      }

      say("wait", `ISO pack ${label}: making the PDF...`);
      const doc = buildPdf(ym, R);
      const done = LSget("isoPackDone", {}); done[ym] = Date.now(); LSset("isoPackDone", done);
      renderPanel();
      say("ok", `✅ ISO 9001 pack for ${label} is ready.` + (Object.keys(R.errors).length ? `\n⚠️ Not read: ${Object.entries(R.errors).map(([k, e]) => `${{ prod: "production file", ec: "edge crack file", ven: "Inward RM data" }[k]} (${e})`).join("; ")}` : ""));
      showPdfPreview(doc, `ISO9001_Monthly_Pack_${MONTH_ABBR[Number(ym.slice(5)) - 1]}_${ym.slice(0, 4)}.pdf`, `ISO 9001 pack - ${label}`);
    } catch (e) {
      say("err", "ISO pack: " + (typeof shortError === "function" ? shortError(e.message || e) : e.message));
    } finally { running = false; }
  }

  // ---------- the PDF ----------
  function buildPdf(ym, R) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const NAVY = [31, 56, 100], GOLD = [201, 162, 39], label = ymLabel(ym), nos = LSget("isoDocNos", {});
    const genDate = dmy(todayISO());
    let first = true;
    const page = (title, clause, noKey) => {
      if (!first) doc.addPage(); first = false;
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NAVY);
      doc.text(title, W / 2, 30, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(120, 95, 15);
      const bits = [`Month: ${label}`]; if (clause) bits.push(`ISO 9001:2015 Clause ${clause}`); if (noKey && nos[noKey]) bits.push(`Doc No: ${nos[noKey]}`);
      doc.text(bits.join("     |     "), W / 2, 46, { align: "center" });
      doc.setDrawColor(...GOLD); doc.setLineWidth(2); doc.line(20, 54, W - 20, 54);
      return 66;
    };
    const table = (startY, head, body, opts) => {
      doc.autoTable(Object.assign({ startY, head: [head], body, theme: "grid", styles: { fontSize: 8.5, cellPadding: 4, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: NAVY, textColor: 255 }, alternateRowStyles: { fillColor: [244, 248, 253] }, margin: { left: 24, right: 24, top: 44, bottom: 46 } }, opts || {}));
      return doc.lastAutoTable.finalY + 14;
    };
    const note = (y, lines) => {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
      lines.forEach(l => { const parts = doc.splitTextToSize(l, W - 48); if (y + parts.length * 11 > H - 50) { doc.addPage(); y = 50; doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80); } doc.text(parts, 24, y); y += parts.length * 11 + 3; });
      return y;
    };
    const status = {};

    // NCR
    const ncrs = getNcrList().filter(n => n.ym === ym || (!n.ym && n.date && n.date.slice(0, 7) === ym));
    const dismissed = LSget("isoNcrDismiss", {});
    const pendingEc = (R.ec || []).filter(r => r.total > 0 && !dismissed[`EC|${ym}|${r.reason}`] && !ncrs.some(n => n.key === `EC|${ym}|${r.reason}`));
    const ncrRows = ncrs.map((n, i) => [i + 1, dmy(n.date), n.src || "Manual", n.description, n.rootCause || "Not provided", n.action || "Not provided", n.responsible || "Not provided", dmy(n.targetDate) || "Not provided", n.status === "closed" ? "Closed" : "Open"]);
    pendingEc.forEach(r => ncrRows.push([ncrRows.length + 1, dmy(monthEnd(ym)), "Edge crack", `Edge crack rejection: Grand Total ${f2(r.total)}${r.reason ? " - " + r.reason : ""}`, "Pending", "Pending", "Pending", "Pending", "Open"]));
    const ncrMissing = ncrs.filter(n => !n.rootCause || !n.action || !n.responsible || !n.targetDate).length + pendingEc.length;
    status.ncr = R.errors.ec ? `Edge crack file not read (${R.errors.ec})` : ncrMissing ? `${ncrMissing} NCR(s) with details pending` : "Complete";

    // Calibration
    const today = todayISO(), cal = getCalList();
    const calMissing = cal.filter(c => !c.lastDate || !c.dueDate || !c.agency || !c.certNo).length, calOver = cal.filter(c => c.dueDate && c.dueDate < today).length;
    status.cal = !cal.length ? "No equipment registered" : (calOver || calMissing) ? [calOver ? `${calOver} overdue` : "", calMissing ? `${calMissing} with details missing` : ""].filter(Boolean).join(", ") : "Complete";

    // Vendor
    const vr = (LSget("isoVenRatings", {}))[ym] || {};
    const venRows = (R.ven || []).map(g => { const d = parseInt((vr[g.key] || {}).d, 10), p = parseInt((vr[g.key] || {}).p, 10);
      const parts = [g.q, d || null, p || null]; const overall = parts.every(x => x) ? (parts.reduce((s, x) => s + x, 0) / 3).toFixed(1) : "Pending";
      return [g.party, g.material, g.lots, g.tested, g.ok, g.pct == null ? "-" : g.pct.toFixed(1) + "%", g.q == null ? "-" : g.q, d || "Pending", p || "Pending", overall,
        Object.entries(g.fails).map(([k, c]) => `${k} x${c}`).join(", ")]; });
    const venPending = venRows.filter(r => r[9] === "Pending").length;
    status.ven = R.errors.ven ? `Inward RM data not read (${R.errors.ven})` : !venRows.length ? "No lots received in the month" : venPending ? `${venPending} supplier(s) with delivery/price pending` : "Complete";

    // Traceability
    const heats = (R.prod && R.prod.heats) || [];
    status.trace = R.errors.prod ? `Production file not read (${R.errors.prod})` : heats.length ? "Complete" : "No heats found for the month";

    // Objectives
    const objT = getObjTargets(), ext = (LSget("isoObjExt", {}))[ym] || {};
    const oosN = heats.filter(h => h.issues.length).length, oosPct = heats.length ? oosN / heats.length * 100 : null;
    const ecRows = R.ec || [], ecTot = ecRows.reduce((s, r) => s + r.total, 0), ecStrip = ecRows.reduce((m, r) => Math.max(m, r.totalStrip), 0);
    const ecPct = ecStrip > 0 ? ecTot / ecStrip * 100 : null;
    const prodTot = heats.reduce((s, h) => s + (h.t || 0), 0);
    const objRows = [];
    const res = (act, tgt, kind) => act == null ? "No data" : tgt == null || isNaN(tgt) ? "Target not set" : (kind === "max" ? act <= tgt : act >= tgt) ? "Met" : "Not met";
    objRows.push(["Out-of-spec heats (C, S, P) %", objT[ym] != null ? `under ${objT[ym]}%` : "Not set", oosPct == null ? "-" : `${oosPct.toFixed(2)}% (${oosN} of ${heats.length} heats)`, res(oosPct, objT[ym], "max")]);
    if (ext.ec != null) objRows.push(["Edge crack rejection %", `under ${ext.ec}%`, ecPct == null ? "-" : `${ecPct.toFixed(3)}%`, res(ecPct, ext.ec, "max")]);
    if (ext.prod != null) objRows.push(["Month production (MT)", `at least ${ext.prod}`, heats.length ? prodTot.toFixed(2) : "-", res(heats.length ? prodTot : null, ext.prod, "min")]);
    status.obj = objT[ym] == null && ext.ec == null && ext.prod == null ? "No targets set" : objRows.some(r => r[3] === "No data") ? "Some actuals not available" : "Complete";

    // ---- page 1: summary
    let y = page(`ISO 9001 Monthly Records - ${label}`, "", "");
    y = table(y, ["#", "Record", "ISO 9001:2015 clause", "Status"], [
      [1, "Non-Conformance Report (NCR) & CAPA Log", "10.2", status.ncr], [2, "Equipment Calibration Log", "7.1.5", status.cal],
      [3, "Vendor / Supplier Performance Evaluation", "8.4", status.ven], [4, "Product Traceability Register", "8.5.2", status.trace],
      [5, "Quality Objectives", "6.2 / 9.1", status.obj]], { columnStyles: { 0: { cellWidth: 26 }, 3: { cellWidth: 300 } } });
    note(y, [`Generated on ${genDate} by Moltrix from: ${R.prod ? R.prod.path : "production file (not read)"}; ${($("ecFilePath") || {}).value || "edge crack file"}; ${INWARD_RM_FILE_PATH}; and the logs kept in the app on this device.`,
      `"Pending" / "Not provided" means the detail was not entered when this pack was made.`]);

    // ---- NCR
    y = page("Non-Conformance Report (NCR) & CAPA Log", "10.2", "ncr");
    if (R.errors.ec) y = note(y, [`Edge crack file could not be read: ${R.errors.ec}`]);
    if (ncrRows.length) y = table(y, ["#", "Date", "Source", "Nonconformity", "Root cause", "Corrective action", "Responsible", "Target date", "Status"], ncrRows,
      { styles: { fontSize: 8, cellPadding: 3.5, overflow: "linebreak" }, columnStyles: { 0: { cellWidth: 22 }, 3: { cellWidth: 190 } } });
    else y = note(y, ["No nonconformity recorded for this month."]);

    // ---- Calibration
    y = page("Equipment Calibration Log", "7.1.5", "cal");
    if (cal.length) y = table(y, ["Sl.", "Equipment", "ID", "Make", "Model", "Range / Accuracy", "Last calibration", "Next due", "Agency", "Certificate No.", `Status on ${genDate}`],
      cal.map((c, i) => [i + 1, c.name, c.id || "-", c.make || "", c.model || "", c.range || "", dmy(c.lastDate) || "Not provided", dmy(c.dueDate) || "Not provided", c.agency || "Not provided", c.certNo || "Not provided",
        !c.dueDate ? "Date not entered" : c.dueDate < today ? "Overdue" : (new Date(c.dueDate) - new Date(today)) / 86400000 <= 30 ? "Due within 30 days" : "OK"]),
      { styles: { fontSize: 7.5, cellPadding: 3 } });
    else y = note(y, ["No equipment registered in the Calibration Log."]);

    // ---- Vendor
    y = page("Vendor / Supplier Performance Evaluation", "8.4", "ven");
    if (R.errors.ven) y = note(y, [`Inward Raw Material data could not be read: ${R.errors.ven}`]);
    if (venRows.length) y = table(y, ["Supplier (Party Name)", "Material", "Lots", "Tested", "In spec", "In spec %", "Quality (1-5)", "Delivery (1-5)", "Price (1-5)", "Overall", "Out of spec (lots)"], venRows,
      { styles: { fontSize: 8, cellPadding: 3.5 }, columnStyles: { 0: { cellWidth: 150 }, 10: { cellWidth: 150 } } });
    else if (!R.errors.ven) y = note(y, ["No Silico Manganese / Sponge Iron lots with a GRN date in this month."]);
    note(y, ["Quality: a lot is 'in spec' when every tested value meets the PO; values not tested are not judged. Quality mark: 95% or more lots in spec = 5, 85-94.9% = 4, 70-84.9% = 3, 50-69.9% = 2, below 50% = 1.",
      `PO limits used - Silico Manganese: +150 mm max ${SILICO_PO.overSize}%, -25 mm max ${SILICO_PO.underSize}%, Mn min = Min Limit in Excel (else ${SILICO_PO.mn}%), Si min ${SILICO_PO.si}%, C max ${SILICO_PO.c}%, P max ${SILICO_PO.p}%, S max ${SILICO_PO.s}%. ` +
      `Lumps: +20 mm max ${LUMPS_PO.overSize}%, -4 mm max ${LUMPS_PO.underSize}%, Fe(M) min = Min Limit (else ${LUMPS_PO.fem}%), P max ${LUMPS_PO.p}%, S max ${LUMPS_PO.s}%, N.Mag max ${LUMPS_PO.nmag}%. ` +
      `Fines: -1 mm max ${FINES_PO.underSize}%, Fe(M) min = Min Limit, P max ${FINES_PO.p}%, S max ${FINES_PO.s}%, N.Mag max ${FINES_PO.nmag}%.`,
      "Delivery and Price marks are given by QAD-SMS. Overall = average of Quality, Delivery and Price."]);

    // ---- Traceability
    y = page("Product Traceability Register (heat-wise)", "8.5.2", "trace");
    if (R.errors.prod) y = note(y, [`Production file could not be read: ${R.errors.prod}`]);
    if (heats.length) y = table(y, ["Date", "Heat No.", "%C", "%Mn", "%Si", "%S", "%P", "Size", "Production (MT)", "Chemistry"],
      heats.map(h => [dmy(h.date), h.heat, f3(h.c), f3(h.mn), f3(h.si), f3(h.s), f3(h.p), h.size == null ? "" : String(h.size), h.t == null ? "" : h.t.toFixed(2), h.issues.length ? "Out of spec: " + h.issues.join(", ") : "OK"]),
      { styles: { fontSize: 7.5, cellPadding: 2.5, halign: "center" }, columnStyles: { 9: { halign: "left", cellWidth: 170 } },
        didParseCell: d => { if (d.section === "body" && d.column.index === 9 && String(d.cell.raw).startsWith("Out")) d.cell.styles.textColor = [163, 39, 28]; } });
    if (heats.length) note(y, [`${heats.length} heats, ${prodTot.toFixed(2)} MT. Source: ${R.prod.path}, Prod. sheet. Out of spec = ${CHEM_SPEC_LIMITS.map(s => `${s.label} ${s.type} ${s.value}`).join(", ")}.`]);

    // ---- Objectives
    y = page("Quality Objectives - Monitoring", "6.2 / 9.1", "obj");
    y = table(y, ["Objective", "Target", "Actual", "Result"], objRows, { didParseCell: d => { if (d.section === "body" && d.column.index === 3) d.cell.styles.textColor = d.cell.raw === "Met" ? [30, 107, 60] : d.cell.raw === "Not met" ? [163, 39, 28] : [90, 90, 90]; } });
    note(y, [`Out-of-spec heats from the Prod. sheet (${CHEM_SPEC_LIMITS.map(s => `${s.label} ${s.type} ${s.value}`).join(", ")}).` +
      (ext.ec != null ? ` Edge crack % = Grand Total / Total Strip from the edge crack file.` : "") + (ext.prod != null ? " Production = sum of heat-wise Production (MT) above." : "")]);

    // footer on every page
    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
      doc.text("Prepared by: Durgesh Mishra, Manager, QAD-SMS", 24, H - 28);
      doc.text("Approved by: ______________________", W / 2, H - 28, { align: "center" });
      doc.text(`Page ${p} of ${pages}`, W - 24, H - 28, { align: "right" });
    }
    stampLogoOnAllPages(doc);
    return doc;
  }

  // ---------- the "Monthly ISO Pack" page ----------
  function renderPanel() {
    const list = $("isoPackHistory"); if (!list) return;
    const done = LSget("isoPackDone", {});
    const ms = Object.keys(done).sort().reverse();
    list.innerHTML = ms.length ? ms.map(m => `<li><b>${esc(ymLabel(m))}</b> - made on ${esc(new Date(done[m]).toLocaleDateString("en-GB"))}</li>`).join("") : "<li>No pack made yet.</li>";
  }
  function initPanel() {
    const mi = $("isoPackMonth"); if (mi && !mi.value) mi.value = prevYM();
    const gb = $("isoPackGenBtn"); if (gb) gb.addEventListener("click", () => { const v = (mi && mi.value) || prevYM(); run(v); });
    const nb = $("isoPackDocNosBtn"); if (nb) nb.addEventListener("click", async () => {
      const cur = LSget("isoDocNos", {});
      const a = await ask({ title: "Document / format numbers", intro: "Printed on each record's page. Leave blank if not used.",
        fields: [["ncr", "NCR & CAPA Log"], ["cal", "Calibration Log"], ["ven", "Vendor Rating"], ["trace", "Traceability Register"], ["obj", "Quality Objectives"]].map(([k, l]) => ({ key: k, label: l, value: cur[k] || "" })),
        buttons: [["save", "Save", "primary"], ["skip", "Cancel", "secondary"]] });
      if (a.k === "save") { LSset("isoDocNos", a.v); LSset("isoDocNosAsked", true); }
    });
    renderPanel();
  }
  initPanel();

  // ---------- after a month ends: offer to make last month's pack ----------
  window.isoPackAutoCheck = async function () {
    try { if (typeof isViewer === "function" && isViewer()) return; } catch (e) {}
    const ym = prevYM(), done = LSget("isoPackDone", {});
    if (done[ym] || running) return;
    const today = todayISO();
    if (LSget("isoPackSnooze", "") === today) return;
    const told = LSget("isoPackTold", "");
    if (told !== ym) { try { addNotification(`ISO 9001 pack for ${ymLabel(ym)} is due - Menu: ISO 9001 → Monthly ISO Pack`, "📦"); } catch (e) {} LSset("isoPackTold", ym); }
    const a = await ask({ title: `ISO 9001 pack - ${ymLabel(ym)}`,
      intro: `${esc(ymLabel(ym))} is over. The app can prepare all 5 ISO 9001 records now from the production, edge crack and inward raw material data, and will ask you only for what the data cannot give (root cause, delivery / price marks, targets...).`,
      buttons: [["go", "Prepare now", "primary"], ["later", "Remind me tomorrow", "secondary"]] });
    if (a.k === "go") run(ym); else LSset("isoPackSnooze", today);
  };
  window.isoPackRun = run;
  window.__iso = { VEN_RULES, qualityRating, loadHeats };   // used by the RM Supplier Scorecard / RM Mix vs Quality below
})();
/* ===================== ISO 9001 - RM SUPPLIER SCORECARD (auto, from Inward Raw Material Data) ===================== */
(function supplierScorecard() {
  const $ = id => document.getElementById(id);
  const E = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const num = v => typeof v === "number" ? v : (v === "" || v == null ? null : (isNaN(parseFloat(v)) ? null : parseFloat(v)));
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ymLab = ym => { const [y, m] = ym.split("-").map(Number); return `${MON[m - 1]} ${String(y).slice(2)}`; };
  const stars = q => q == null ? "-" : "★".repeat(q) + "☆".repeat(5 - q);
  let last = null;

  function period(v) {   // → { from, to, label }
    const t = new Date(), y = t.getFullYear(), m = t.getMonth();
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const to = iso(t);
    if (v === "fy") { const fy = m >= 3 ? y : y - 1; return { from: `${fy}-04-01`, to, label: `FY ${fy}-${String(fy + 1).slice(2)} (till today)` }; }
    const n = +v || 1, f = new Date(y, m - (n - 1), 1);
    return { from: iso(f), to, label: n === 1 ? `${MON[m]} ${y}` : `${MON[f.getMonth()]} ${f.getFullYear()} - ${MON[m]} ${y}` };
  }

  async function build() {
    const st = $("status"), out = $("scOut");
    if (!window.__iso) { alert("Please wait for the app to finish loading."); return; }
    const { VEN_RULES, qualityRating } = window.__iso;
    const P = period($("scPeriod").value);
    st.className = "wait"; st.textContent = "Reading Inward Raw Material Data...";
    out.innerHTML = "";
    try {
      const token = await getToken();
      const { data, col: col0, rowCol, isHeader } = await readInwardRmTable1(token);
      const colErr = inwardRmMissingColsError(col0); if (colErr) throw new Error(colErr);
      const groups = {};
      for (let i = 1; i < data.values.length; i++) {
        if (isHeader(i)) continue;
        const row = data.values[i], txt = data.text[i], col = rowCol[i];
        const bucket = classifyInwardItem(row[col.itemName]); if (!bucket) continue;
        const iso = inwardRmDateToISO(row[col.grnDate], txt[col.grnDate]);
        if (!iso || iso < P.from || iso > P.to) continue;
        const party = String(row[col.partyName] || "").trim() || "(no party name)";
        const k = party.toUpperCase() + "|" + bucket;
        const g = groups[k] || (groups[k] = { party, material: VEN_RULES[bucket].label, lots: 0, qty: 0, tested: 0, ok: 0, fails: {}, par: {}, months: {} });
        g.lots++;
        const q = num(row[col.reachedQty]); if (q != null) g.qty += q;
        const r = {}; ["plus150", "plus20", "minus1", "minus25", "minus4", "c", "fem", "mn", "nmag", "p", "s", "si", "minLimit"].forEach(f => { r[f] = num(row[col[f]]); });
        const checks = VEN_RULES[bucket].rules(r).filter(([, v, , lim]) => v != null && lim != null);
        checks.forEach(([n, v, t, lim]) => { const a = g.par[n] || (g.par[n] = { sum: 0, n: 0, t, lim }); a.sum += v; a.n++; a.lim = lim; });
        if (!checks.length) continue;
        g.tested++;
        const ym = iso.slice(0, 7), mo = g.months[ym] || (g.months[ym] = { tested: 0, ok: 0 });
        mo.tested++;
        const bad = checks.filter(([, v, t, lim]) => { const x = Math.round(v * 1000) / 1000; return t === "max" ? x > lim : x < lim; });
        if (!bad.length) { g.ok++; mo.ok++; } else bad.forEach(([n]) => { g.fails[n] = (g.fails[n] || 0) + 1; });
      }
      const rows = Object.values(groups).map(g => {
        g.pct = g.tested ? g.ok / g.tested * 100 : null; g.q = qualityRating(g.pct);
        g.topFail = Object.entries(g.fails).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n, c]) => `${n} ×${c}`).join(", ");
        g.avg = Object.entries(g.par).map(([n, a]) => {
          const av = a.sum / a.n, okv = a.t === "max" ? av <= a.lim : av >= a.lim;
          return { n, av, lim: a.lim, t: a.t, okv };
        });
        g.trend = Object.keys(g.months).sort().map(ym => ({ ym, pct: g.months[ym].tested ? g.months[ym].ok / g.months[ym].tested * 100 : null }));
        return g;
      }).sort((a, b) => a.material.localeCompare(b.material) || (b.pct == null ? -1 : a.pct == null ? 1 : b.pct - a.pct) || b.lots - a.lots);
      if (!rows.length) { st.className = "ok"; st.textContent = `No inward lots of these materials in ${P.label}.`; out.innerHTML = `<div class="aovNote" style="display:block">No Sponge Iron / Silico Manganese lots in ${E(P.label)}.</div>`; $("scPdfBtn").classList.add("hidden"); last = null; return; }
      last = { P, rows };
      const mats = [...new Set(rows.map(r => r.material))];
      const pc = v => v == null ? "#78909c" : v >= 85 ? "#2e7d32" : v >= 70 ? "#ef6c00" : "#c62828";
      const chip = (t, bad) => `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 7px;border-radius:999px;font-size:11.5px;background:${bad ? "rgba(198,40,40,.10)" : "rgba(31,56,100,.07)"};color:${bad ? "#c62828" : "inherit"}">${t}</span>`;
      out.innerHTML = `<div style="font-size:13px;color:var(--muted);margin-bottom:6px">${E(P.label)} · ${rows.reduce((s, r) => s + r.lots, 0)} lots · ${rows.length} supplier-material pairs</div>` +
        mats.map(mt => {
          const rs = rows.filter(r => r.material === mt), best = rs.find(r => r.tested >= 3 && r.pct != null);
          return `<h3 style="margin:14px 0 6px">${E(mt)}${best ? ` <span style="font-size:12px;font-weight:600;color:${pc(best.pct)}">· top: ${E(best.party)} (${best.pct.toFixed(0)}%)</span>` : ""}</h3>` +
          rs.map(r => `<div style="border:1px solid rgba(31,56,100,.15);border-left:5px solid ${pc(r.pct)};border-radius:10px;padding:9px 11px;margin:7px 0;background:rgba(255,255,255,.55)">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <div style="font-weight:700;line-height:1.25">${E(r.party)}</div>
              <div style="text-align:right;white-space:nowrap"><div style="font-size:20px;font-weight:800;color:${pc(r.pct)};line-height:1">${r.pct == null ? "-" : r.pct.toFixed(0) + "%"}</div>
                <div style="color:#d4a017;font-size:13px;letter-spacing:1px">${stars(r.q)}</div></div></div>
            <div style="font-size:12.5px;color:var(--muted);margin:3px 0 4px">${r.lots} lots · ${r.qty ? r.qty.toFixed(1) : "-"} qty · ${r.tested} tested${r.topFail ? ` · fails most on <b style="color:#c62828">${E(r.topFail)}</b>` : ""}</div>
            ${r.avg.length ? `<div>${r.avg.map(a => chip(`${E(a.n.replace(/ %$/, ""))} ${a.av.toFixed(a.av >= 10 ? 1 : 3)} <span style="opacity:.65">${a.t === "max" ? "≤" : "≥"}${a.lim}</span>`, !a.okv)).join("")}</div>` : ""}
            ${r.trend.length > 1 ? `<div style="margin-top:3px">${r.trend.map(t => chip(`${ymLab(t.ym)} <b style="color:${pc(t.pct)}">${t.pct == null ? "-" : t.pct.toFixed(0) + "%"}</b>`)).join("")}</div>` : ""}
          </div>`).join("");
        }).join("") +
        `<div class="aovNote" style="display:block;margin-top:8px">% = lots in PO spec out of tested lots. Rating: ★5 ≥95% · ★4 ≥85% · ★3 ≥70% · ★2 ≥50% · ★1 below. Red chips: average outside the PO limit. Lots with no test values are counted but not judged.</div>`;
      $("scPdfBtn").classList.remove("hidden");
      try { localStorage.setItem("scLastMade", new Date().toISOString()); } catch (e) {}
      st.className = "ok"; st.textContent = `Scorecard ready - ${P.label}.`;
    } catch (e) {
      st.className = "err"; st.textContent = "Scorecard: " + (typeof shortError === "function" ? shortError(e.message || e) : (e.message || e));
    }
  }

  function pdf() {
    if (!last) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    addLogoHeader(doc);
    const W = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(31, 56, 100);
    doc.text("Raw Material Supplier Scorecard", W / 2, 30, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(60);
    doc.text(`${last.P.label} · from Inward Raw Material Data (each tested lot against the PO spec)`, W / 2, 46, { align: "center" });
    doc.autoTable({
      startY: 58,
      head: [["Material", "Supplier", "Lots", "Qty", "Tested", "In spec %", "Rating (1-5)", "Fails most on", "Average vs PO", "Month-wise in spec"]],
      body: last.rows.map(r => [r.material, r.party, r.lots, r.qty ? r.qty.toFixed(1) : "-", r.tested, r.pct == null ? "-" : r.pct.toFixed(0) + "%", r.q == null ? "-" : r.q,
        r.topFail || "-", r.avg.map(a => `${a.n.replace(/ %$/, "")} ${a.av.toFixed(a.av >= 10 ? 1 : 3)} (${a.t === "max" ? "max" : "min"} ${a.lim})${a.okv ? "" : " !"}`).join("\n"),
        r.trend.map(t => `${ymLab(t.ym)}: ${t.pct == null ? "-" : t.pct.toFixed(0) + "%"}`).join("\n")]),
      styles: { fontSize: 8, cellPadding: 4, valign: "middle" }, headStyles: { fillColor: [31, 56, 100] }, theme: "grid",
      didParseCell: d => { if (d.section === "body" && d.column.index === 5) { const v = parseFloat(d.cell.raw); if (!isNaN(v)) d.cell.styles.textColor = v >= 85 ? [46, 125, 50] : v >= 70 ? [239, 108, 0] : [198, 40, 40]; } }
    });
    doc.setFontSize(8); doc.setTextColor(90);
    doc.text("Rating: 5 = 95% or more lots in spec, 4 = 85%+, 3 = 70%+, 2 = 50%+, 1 = below 50%. '!' = average outside the PO limit.", 40, doc.lastAutoTable.finalY + 16);
    stampLogoOnAllPages(doc);
    showPdfPreview(doc, `RM_Supplier_Scorecard_${last.P.from}_to_${last.P.to}.pdf`, "RM Supplier Scorecard");
  }

  $("scBuildBtn").addEventListener("click", build);
  $("scPdfBtn").addEventListener("click", pdf);
})();

/* ===================== TRENDS - RM MIX vs QUALITY ===================== */
(function rmMixVsQuality() {
  const $ = id => document.getElementById(id);
  const E = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const METRICS = [["off", "Off-spec heats %"], ["s", "Avg S %"], ["p", "Avg P %"], ["c", "Avg C %"], ["mn", "Avg Mn %"]];
  let days = [], items = [], chart = null, rep = { from: "", to: "", lines: [], cells: [] };

  (function defaults() {
    const d = new Date(), ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const p = new Date(d.getFullYear(), d.getMonth() - 1, 1), pym = `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
    if (!$("rmqFrom").value) $("rmqFrom").value = pym;
    if (!$("rmqTo").value) $("rmqTo").value = ym;
  })();

  function pearson(xs, ys) {
    const n = xs.length; if (n < 5) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    if (sxx < 1e-12 || syy < 1e-12) return null;
    return sxy / Math.sqrt(sxx * syy);
  }
  const pairs = (key, mk) => { const xs = [], ys = []; days.forEach(d => { const x = d.mix[key], y = d.q[mk]; if (x != null && y != null) { xs.push(x); ys.push(y); } }); return [xs, ys]; };
  const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  const nums = (hs, k) => hs.map(h => h[k]).filter(v => typeof v === "number");

  async function monthData(token, ym) {
    const [y, m] = ym.split("-").map(Number);
    const { path, heats } = await window.__iso.loadHeats(token, ym);
    const wb = await resolveWorkbook(token, path);
    const sh = `worksheets('${encodeURIComponent(String(CONSUMPTION_SHEET_NAME).replace(/'/g, "''"))}')`;
    const [a, b] = await Promise.all([
      graphFetch(`${wb}/${sh}/range(address='A1:A2000')?$select=values`, token),
      graphFetch(`${wb}/${sh}/range(address='AI1:AR2000')?$select=values`, token)]);
    const cons = {};
    (a.values || []).forEach((r, i) => {
      if (typeof r[0] !== "number") return;
      const iso = excelSerialToISODate(r[0]); if (!iso || iso.slice(0, 7) !== ym || cons[iso]) return;
      cons[iso] = ((b.values || [])[i] || []).map(v => typeof v === "number" ? v : 0);
    });
    const byDay = {};
    heats.forEach(h => { (byDay[h.date] = byDay[h.date] || []).push(h); });
    return Object.keys(byDay).sort().map(date => {
      const hs = byDay[date], rm = cons[date] || null, tot = rm ? rm.reduce((s, v) => s + v, 0) : 0;
      const mix = {}; HEAT_CONSUMPTION_ITEMS.forEach((it, k) => { mix[it.key] = rm && tot > 0 ? rm[k] / tot * 100 : null; });
      return { date, n: hs.length, mix, tot, q: { off: hs.length ? hs.filter(h => (h.issues || []).length).length / hs.length * 100 : null,
        s: avg(nums(hs, "s")), p: avg(nums(hs, "p")), c: avg(nums(hs, "c")), mn: avg(nums(hs, "mn")) } };
    }).filter(d => d.tot > 0);
  }

  async function load() {
    const st = $("status");
    if (!window.__iso) { alert("Please wait for the app to finish loading."); return; }
    let from = $("rmqFrom").value, to = $("rmqTo").value;
    if (!from || !to) { alert("Choose the months."); return; }
    if (from > to) [from, to] = [to, from];
    rep.from = from; rep.to = to;
    const yms = []; for (let d = new Date(+from.slice(0, 4), +from.slice(5) - 1, 1); ; d.setMonth(d.getMonth() + 1)) {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; yms.push(ym); if (ym >= to || yms.length >= 12) break; }
    days = [];
    try {
      const token = await getToken();
      for (const ym of yms) {
        st.className = "wait"; st.textContent = `RM mix vs quality: reading ${ym}...`;
        try { days.push(...await monthData(token, ym)); } catch (e) { st.textContent = `${ym}: ${e.message || e}`; }
      }
      if (days.length < 5) { st.className = "err"; st.textContent = `Only ${days.length} day(s) with both heats and RM consumption - need at least 5.`; $("rmqOut").classList.add("hidden"); return; }
      items = HEAT_CONSUMPTION_ITEMS.filter(it => days.some(d => d.mix[it.key] > 0));
      render();
      st.className = "ok"; st.textContent = `RM mix vs quality: ${days.length} days, ${days.reduce((s, d) => s + d.n, 0)} heats.`;
    } catch (e) { st.className = "err"; st.textContent = "RM mix vs quality: " + (e.message || e); }
  }

  function render() {
    const cells = [];
    items.forEach(it => METRICS.forEach(([mk, ml]) => { const [xs, ys] = pairs(it.key, mk); const r = pearson(xs, ys); if (r != null) cells.push({ it, mk, ml, r, n: xs.length }); }));
    const strong = cells.filter(c => Math.abs(c.r) >= 0.4).sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 5);
    const word = r => Math.abs(r) >= 0.6 ? "strongly" : "clearly";
    rep.cells = cells.slice();
    rep.lines = strong.map(c => `When ${c.it.label} share goes up, ${c.ml} ${word(c.r)} goes ${c.r > 0 ? "up" : "down"} (r = ${c.r.toFixed(2)}, ${c.n} days)`);
    $("rmqInsights").innerHTML = strong.length
      ? `<b>What moves together</b><ul style="margin:6px 0 4px 18px;padding:0">${strong.map(c => `<li>When <b>${E(c.it.label)}</b> share goes up, <b>${E(c.ml)}</b> ${word(c.r)} goes ${c.r > 0 ? "up" : "down"} <span style="color:var(--muted)">(r = ${c.r.toFixed(2)}, ${c.n} days)</span></li>`).join("")}</ul>
         <div class="aovNote" style="display:block">Moving together is a clue, not proof - check the furnace practice on those days before changing the mix.</div>`
      : `<div class="aovNote" style="display:block">No raw material moves clearly with quality in these ${days.length} days (all |r| below 0.4).</div>`;
    const color = r => r == null ? "" : Math.abs(r) < 0.2 ? "" : `background:${r > 0 ? "rgba(198,40,40," : "rgba(46,125,50,"}${Math.min(Math.abs(r), 0.8) * 0.45})`;
    $("rmqMatrix").innerHTML = `<b>Strength (r) - every material against every quality figure</b><div class="tableScroll"><table class="matrixTable stockTable"><tr><th>Material share</th>${METRICS.map(([, ml]) => `<th>${E(ml)}</th>`).join("")}</tr>` +
      items.map(it => `<tr><td style="text-align:left">${E(it.label)}</td>${METRICS.map(([mk]) => { const c = cells.find(x => x.it === it && x.mk === mk); return `<td style="${color(c && c.r)}">${c ? c.r.toFixed(2) : "-"}</td>`; }).join("")}</tr>`).join("") +
      `</table></div><div class="aovNote" style="display:block">+1 = always rise together, -1 = one rises when the other falls, 0 = no link. Red: more of that material, higher figure.</div>`;
    $("rmqTable").innerHTML = `<b>Day by day</b><div class="tableScroll"><table class="matrixTable stockTable"><tr><th>Date</th><th>Heats</th>${items.map(it => `<th>${E(it.label)} %</th>`).join("")}${METRICS.map(([, ml]) => `<th>${E(ml)}</th>`).join("")}</tr>` +
      days.map(d => `<tr><td>${d.date.split("-").reverse().join("-")}</td><td>${d.n}</td>${items.map(it => `<td>${d.mix[it.key] == null ? "-" : d.mix[it.key].toFixed(1)}</td>`).join("")}${METRICS.map(([mk]) => `<td>${d.q[mk] == null ? "-" : mk === "off" ? d.q[mk].toFixed(0) : d.q[mk].toFixed(3)}</td>`).join("")}</tr>`).join("") + `</table></div>`;
    const top = strong[0] || cells.sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];
    $("rmqItem").innerHTML = items.map(it => `<option value="${it.key}">${E(it.label)} %</option>`).join("");
    $("rmqMetric").innerHTML = METRICS.map(([mk, ml]) => `<option value="${mk}">${E(ml)}</option>`).join("");
    if (top) { $("rmqItem").value = top.it.key; $("rmqMetric").value = top.mk; }
    $("rmqOut").classList.remove("hidden");
    drawChart();
  }

  function drawChart() {
    const key = $("rmqItem").value, mk = $("rmqMetric").value;
    const it = items.find(x => x.key === key), ml = (METRICS.find(x => x[0] === mk) || [])[1];
    if (!it) return;
    if (chart) chart.destroy();
    chart = new Chart($("rmqChart").getContext("2d"), {
      type: "line",
      data: { labels: days.map(d => d.date.slice(8) + "/" + d.date.slice(5, 7)), datasets: [
        { label: it.label + " %", data: days.map(d => d.mix[key]), borderColor: "#d4a017", backgroundColor: "rgba(212,160,23,.15)", yAxisID: "y", tension: .25, spanGaps: true },
        { label: ml, data: days.map(d => d.q[mk]), borderColor: "#c62828", backgroundColor: "rgba(198,40,40,.12)", yAxisID: "y1", tension: .25, spanGaps: true }] },
      options: { responsive: true, interaction: { mode: "index", intersect: false },
        scales: { y: { position: "left", title: { display: true, text: it.label + " %" } }, y1: { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: ml } } } }
    });
  }

  function pdf() {
    if (!days.length) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const mLab = ym => { const [y, m] = ym.split("-").map(Number); return `${MONTH_ABBR[m - 1]} ${y}`; };
    addLogoHeader(doc);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(31, 56, 100);
    doc.text("Raw Material Mix vs Quality", W / 2, 30, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(60);
    doc.text(`${rep.from === rep.to ? mLab(rep.from) : mLab(rep.from) + " to " + mLab(rep.to)} · ${days.length} days · ${days.reduce((s, d) => s + d.n, 0)} heats · RM share from the RM Report sheet, quality from the Prod. sheet`, W / 2, 46, { align: "center" });
    let y = 64;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(31, 56, 100); doc.text("What moves together", 40, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(40);
    (rep.lines.length ? rep.lines : ["No raw material moves clearly with quality in this period (all |r| below 0.4)."]).forEach(t => { doc.text("• " + t, 46, y); y += 13; });
    doc.setFontSize(8); doc.setTextColor(110); doc.text("r: +1 = always rise together, -1 = one rises when the other falls, 0 = no link. Moving together is a clue, not proof.", 46, y + 2); y += 14;
    try {   // the chart on screen (material and quality figure chosen there), kept to its own shape and inside the page
      const cv = $("rmqChart"), img = cv.toDataURL("image/png"), ratio = cv.height / cv.width;
      let cw = W - 80, ch = cw * ratio;
      if (ch > H - y - 60) { ch = Math.max(H - y - 60, 150); cw = ch / ratio; }
      if (y + ch + 30 > H - 30) { doc.addPage(); y = 50; ch = Math.min((W - 80) * ratio, H - 120); cw = ch / ratio; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(31, 56, 100);
      doc.text(`Chart: ${$("rmqItem").selectedOptions[0].text} vs ${$("rmqMetric").selectedOptions[0].text}`, 40, y + 4);
      doc.addImage(img, "PNG", 40 + (W - 80 - cw) / 2, y + 10, cw, ch); y += ch + 24;
    } catch (e) {}
    if (y > H - 170) { doc.addPage(); y = 50; }   // the tables never start on top of the chart
    doc.autoTable({ startY: y, pageBreak: "auto", margin: { top: 50 },
      head: [["Material share", ...METRICS.map(m => m[1])]],
      body: items.map(it => [it.label, ...METRICS.map(([mk]) => { const c = rep.cells.find(x => x.it === it && x.mk === mk); return c ? c.r.toFixed(2) : "-"; })]),
      styles: { fontSize: 8.5, cellPadding: 4, halign: "center" }, columnStyles: { 0: { halign: "left" } }, headStyles: { fillColor: [31, 56, 100] }, theme: "grid",
      didParseCell: d => { if (d.section === "body" && d.column.index > 0) { const v = parseFloat(d.cell.raw); if (!isNaN(v) && Math.abs(v) >= 0.4) { d.cell.styles.fontStyle = "bold"; d.cell.styles.textColor = v > 0 ? [198, 40, 40] : [46, 125, 50]; } } } });
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 14, margin: { top: 50 },
      head: [["Date", "Heats", ...items.map(it => it.label + " %"), ...METRICS.map(m => m[1])]],
      body: days.map(d => [d.date.split("-").reverse().join("-"), d.n, ...items.map(it => d.mix[it.key] == null ? "-" : d.mix[it.key].toFixed(1)),
        ...METRICS.map(([mk]) => d.q[mk] == null ? "-" : mk === "off" ? d.q[mk].toFixed(0) : d.q[mk].toFixed(3))]),
      styles: { fontSize: 7, cellPadding: 2.5, halign: "center" }, headStyles: { fillColor: [31, 56, 100], fontSize: 7 }, theme: "grid" });
    stampLogoOnAllPages(doc);
    showPdfPreview(doc, `RM_Mix_vs_Quality_${rep.from}_to_${rep.to}.pdf`, "RM Mix vs Quality");
  }

  $("rmqLoadBtn").addEventListener("click", load);
  $("rmqPdfBtn").addEventListener("click", pdf);
  $("rmqItem").addEventListener("change", drawChart);
  $("rmqMetric").addEventListener("change", drawChart);
})();

/* ===================== ISO 9001 - AUDIT READY (ISO 9001 + NABL / ISO/IEC 17025) ===================== */
(function auditReady() {
  const $ = id => document.getElementById(id);
  const E = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const AU_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/audit_checklist.json:/content";
  const LS = "auditChecklist";
  const today = () => (typeof todayISO === "function" ? todayISO() : new Date().toISOString().slice(0, 10));
  const daysAgo = iso => iso ? Math.floor((new Date(today()) - new Date(iso)) / 864e5) : null;
  const dmy = iso => iso ? iso.split("-").reverse().join("-") : "";
  let std = "9001", state = {}, saveT = null;
  try { state = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { state = {}; }

  // ---- checks the app can do from its own records ----
  const A = {
    cal() {
      const l = getCalList(); if (!l.length) return [false, "No instruments in the Calibration Log"];
      const noDate = l.filter(r => !r.dueDate).length, over = l.filter(r => r.dueDate && r.dueDate < today()).length;
      const soon = l.filter(r => r.dueDate && r.dueDate >= today() && daysAgo(r.dueDate) >= -30).length;
      return [!noDate && !over, `${l.length} instruments · ${over} overdue · ${soon} due in 30 days · ${noDate} without due date`];
    },
    calCert() {
      const l = getCalList(); if (!l.length) return [false, "No instruments in the Calibration Log"];
      const miss = l.filter(r => !String(r.certNo || "").trim()).length;
      return [!miss, miss ? `${miss} of ${l.length} without certificate no.` : `All ${l.length} have a certificate no.`];
    },
    ncr() {
      const l = getNcrList(), open = l.filter(r => r.status !== "closed");
      const late = open.filter(r => r.targetDate && r.targetDate < today()).length;
      const thin = l.filter(r => !String(r.rootCause || "").trim() || !String(r.action || "").trim()).length;
      return [!late && !thin, `${l.length} NCRs · ${open.length} open · ${late} past target date · ${thin} without root cause / action`];
    },
    ven() {
      const l = getVenList().filter(r => daysAgo(r.date) != null && daysAgo(r.date) <= 365);
      let sc = ""; try { sc = localStorage.getItem("scLastMade") || ""; } catch (e) {}
      const scOk = sc && daysAgo(sc.slice(0, 10)) <= 92;
      return [l.length > 0 || scOk, `${l.length} evaluation(s) in the last 12 months${scOk ? ` · RM scorecard made ${dmy(sc.slice(0, 10))}` : " · RM scorecard not made in the last 3 months"}`];
    },
    obj() {
      let t = {}; try { t = getObjTargets() || {}; } catch (e) {}
      const n = Object.keys(t).length; return [n > 0, n ? `${n} objective target(s) set` : "No quality objective target set"];
    },
    packs() {
      let done = {}; try { done = JSON.parse(localStorage.getItem("isoPackDone") || "{}") || {}; } catch (e) {}
      const want = [1, 2, 3].map(k => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
      const miss = want.filter(ym => !done[ym]);
      return [!miss.length, miss.length ? `Monthly ISO pack missing for ${miss.join(", ")}` : "ISO packs made for the last 3 months"];
    },
    sop() {
      const n = (typeof SOP_LIST !== "undefined" && SOP_LIST.length) || 0;
      return [n > 0, n ? `${n} SOP / WI in the app (DM/QA series)` : (typeof SOP_LOADED !== "undefined" && !SOP_LOADED ? "SOP list still loading - open again" : "No SOP / WI")];
    },
    report() {
      const sig = typeof SIGNATURE_IMG !== "undefined" && !!SIGNATURE_IMG, co = typeof COMPANY !== "undefined" && !!(COMPANY.name && COMPANY.logo);
      return [sig && co, `Signature ${sig ? "set" : "not set"} · company name / logo ${co ? "set" : "not set"}`];
    }
  };

  // ---- the checklists: [id, clause, item, auto check | null, needs a date within N days] ----
  const LISTS = {
    "9001": [
      ["q1", "4.3", "Scope of the QMS written and approved", null],
      ["q2", "5.2", "Quality policy displayed and known to the team", null],
      ["q3", "6.1", "Risks and opportunities register reviewed", null, 365],
      ["q4", "6.2", "Quality objectives set and monitored", "obj"],
      ["q5", "7.1.5", "Measuring equipment calibrated, none overdue", "cal"],
      ["q6", "7.2", "Training / competence records of the team up to date", null, 365],
      ["q7", "7.5", "Documents controlled (no., revision, approval)", "sop"],
      ["q8", "8.4", "External providers evaluated (vendor rating / RM scorecard)", "ven"],
      ["q9", "8.5.2", "Heat-wise traceability available", null],
      ["q10", "8.7", "Nonconforming product (off-spec heats) recorded and handled", "packs"],
      ["q11", "9.1.2", "Customer complaints / feedback register", null],
      ["q12", "9.2", "Internal audit done", null, 365],
      ["q13", "9.3", "Management review done (minutes signed)", null, 365],
      ["q14", "10.2", "NCR / CAPA closed with root cause and action", "ncr"]
    ],
    "17025": [
      ["n1", "4.1", "Impartiality declaration signed by lab staff", null, 365],
      ["n2", "4.2", "Confidentiality undertaking signed", null, 365],
      ["n3", "6.2", "Personnel: qualification, training and authorisation records", null, 365],
      ["n4", "6.3", "Environmental conditions (temperature / humidity) monitored and recorded", null, 31],
      ["n5", "6.4", "Equipment calibrated, none overdue", "cal"],
      ["n6", "6.5", "Metrological traceability: calibration certificates on file", "calCert"],
      ["n7", "6.6", "CRMs / reference materials and consumables from evaluated suppliers", null],
      ["n8", "7.2", "Test methods (SOP / WI) documented; validation / verification records", "sop"],
      ["n9", "7.4", "Sample receipt, identification and retention", null],
      ["n10", "7.6", "Measurement uncertainty estimated for each test", null, 365],
      ["n11", "7.7", "Proficiency testing / ILC done", null, 365],
      ["n12", "7.7", "Internal quality control (control charts, CRM checks, duplicates)", null, 31],
      ["n13", "7.8", "Test report format: signature, company details, CML no.", "report"],
      ["n14", "7.9 / 7.10", "Complaints and nonconforming work recorded (NCR / CAPA)", "ncr"],
      ["n15", "8.8", "Internal audit done", null, 365],
      ["n16", "8.9", "Management review done", null, 365]
    ]
  };

  function status(row) {
    const [id, , , auto, within] = row, m = state[id] || {};
    if (auto) { const [ok, note] = A[auto](); return { ok, note, auto: true }; }
    if (!m.ok) return { ok: false, note: m.note || "Not ticked yet" };
    if (within && (!m.date || daysAgo(m.date) > within)) return { ok: false, note: m.date ? `Last on ${dmy(m.date)} - older than ${within >= 365 ? "12 months" : within + " days"}` : "Date not entered" };
    return { ok: true, note: (m.date ? `Done ${dmy(m.date)}` : "Done") + (m.note ? " · " + m.note : "") };
  }

  function render() {
    $("auStd9001").className = std === "9001" ? "primary" : "secondary";
    $("auStd17025").className = std === "17025" ? "primary" : "secondary";
    const list = LISTS[std], sts = list.map(status), ok = sts.filter(s => s.ok).length, pct = Math.round(ok / list.length * 100);
    $("auScore").innerHTML = `${std === "9001" ? "ISO 9001" : "NABL (ISO/IEC 17025)"}: <span style="color:${pct >= 85 ? "#2e7d32" : pct >= 60 ? "#ef6c00" : "#c62828"}">${ok} of ${list.length} ready (${pct}%)</span>`;
    $("auList").innerHTML = list.map((row, i) => {
      const [id, cl, item, auto, within] = row, s = sts[i], m = state[id] || {};
      return `<div class="card" style="margin:8px 0;padding:10px 12px;border-left:4px solid ${s.ok ? "#2e7d32" : "#c62828"}">
        <div style="display:flex;gap:8px;align-items:flex-start"><span>${s.ok ? "✅" : "❌"}</span>
          <div style="flex:1"><div style="font-weight:600">${E(item)} <span style="font-size:11px;color:var(--muted)">cl. ${E(cl)}${auto ? " · checked by the app" : ""}</span></div>
          <div style="font-size:12px;color:var(--muted)">${E(s.note)}</div>
          ${auto ? "" : `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px">
            <label style="display:flex;gap:4px;align-items:center;margin:0;font-size:12px"><input type="checkbox" data-au="${id}" data-f="ok" ${m.ok ? "checked" : ""} style="width:auto;margin:0"> Done</label>
            <input type="date" data-au="${id}" data-f="date" value="${E(m.date || "")}" style="width:auto;flex:0 0 150px;margin:0" title="${within ? "Date done" : "Date (optional)"}">
            <input type="text" data-au="${id}" data-f="note" value="${E(m.note || "")}" placeholder="Note / document no." style="flex:1;min-width:120px;margin:0"></div>`}</div></div></div>`;
    }).join("");
    $("auList").querySelectorAll("[data-au]").forEach(el => el.addEventListener("change", () => {
      const m = state[el.dataset.au] || (state[el.dataset.au] = {});
      m[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value.trim();
      if (el.dataset.f === "ok" && el.checked && !m.date) m.date = today();
      save(); render();
    }));
  }

  function save() {
    state._at = new Date().toISOString();
    try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {}
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      try { const token = await getToken(); if (!token) return;
        await fetch(AU_URL, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(state) });
      } catch (e) { /* kept on this device; goes up with the next change */ }
    }, 1500);
  }
  async function loadCloud() {
    try {
      if (!account) return;
      const token = await getToken(); if (!token) return;
      const r = await fetch(AU_URL, { headers: { Authorization: "Bearer " + token } }); if (!r.ok) return;
      const o = await r.json();
      if (o && (!state._at || (o._at || "") > state._at)) { state = o; try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} render(); }
    } catch (e) {}
  }

  function pdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    addLogoHeader(doc);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(31, 56, 100);
    doc.text("Audit Readiness Report", W / 2, 32, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80);
    doc.text(`As on ${dmy(today())}${typeof COMPANY !== "undefined" && COMPANY.name ? " · " + COMPANY.name : ""}`, W / 2, 46, { align: "center" });
    let y = 60;
    [["9001", "ISO 9001:2015 - Quality Management System"], ["17025", "NABL - ISO/IEC 17025:2017 (Testing Laboratory)"]].forEach(([k, title]) => {
      const list = LISTS[k], sts = list.map(status), ok = sts.filter(s => s.ok).length;
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(31, 56, 100);
      doc.text(`${title}: ${ok} of ${list.length} ready (${Math.round(ok / list.length * 100)}%)`, 40, y + 12);
      doc.autoTable({
        startY: y + 18,
        head: [["Clause", "Requirement", "Status", "Evidence / gap"]],
        body: list.map((r, i) => [r[1], r[2], sts[i].ok ? "Ready" : "Gap", sts[i].note]),
        styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [31, 56, 100] }, theme: "grid",
        columnStyles: { 0: { cellWidth: 48 }, 2: { cellWidth: 42 } },
        didParseCell: d => { if (d.section === "body" && d.column.index === 2) d.cell.styles.textColor = d.cell.raw === "Ready" ? [46, 125, 50] : [198, 40, 40]; }
      });
      y = doc.lastAutoTable.finalY + 14;
    });
    stampLogoOnAllPages(doc);
    showPdfPreview(doc, `Audit_Readiness_${today()}.pdf`, "Audit Readiness Report");
  }

  $("auStd9001").addEventListener("click", () => { std = "9001"; render(); });
  $("auStd17025").addEventListener("click", () => { std = "17025"; render(); });
  $("auPdfBtn").addEventListener("click", pdf);
  document.querySelectorAll('#iso9001SubNav .navItem[data-subiso="audit"]').forEach(b => b.addEventListener("click", () => { render(); loadCloud(); }));
  render();
})();
