/* ===================== AOP vs INDENT & CONSUMPTION ===================== */
// Reads an AOP Excel (the AOP tile's files), the ERP "Master Indent Report" Excel and the QAD store-issue (consumption)
// Excel, matches every AOP item with its indents and its issues, lists items that are not in the AOP as new items,
// and makes a comparison Excel in the AOP's look.
(function aopVsModule() {
  const $ = id => document.getElementById(id);
  if (!$("aovRun")) return;
  const IND_DIR = AOP_ROOT + "/Indent", CONS_DIR = AOP_ROOT + "/Consumption";
  const R = { aop: null, ind: null, res: null };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const norm = x => String(x == null ? "" : x).toUpperCase().replace(/ /g, " ").replace(/[^A-Z0-9]/g, "");
  const num = v => {
    if (typeof v === "number" && isFinite(v)) return v;
    const s = String(v == null ? "" : v).replace(/,/g, "").trim();
    return s !== "" && !isNaN(+s) ? +s : 0;
  };
  const tx = c => (c && c.v != null) ? String(c.v).replace(/ /g, " ").trim() : "";
  const fmt = (v, d) => (v === null || v === undefined || v === "") ? "" : Number(v).toLocaleString("en-IN", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const monName = k => `${MON[k % 12]}-${Math.floor(k / 12)}`;          // k = year*12 + month(0-11)

  /* ---------- OneDrive ---------- */
  async function listInto(dir, sel, keep, optional) {
    const token = await getToken(); if (!token) return;
    const r = await fetch(`${dir}:/children?$select=name&$top=300`, { headers: { Authorization: "Bearer " + token } });
    const names = r.status === 404 ? [] : ((await r.json()).value || []).map(f => f.name).filter(n => /\.xls[xm]?$/i.test(n)).sort();
    sel.innerHTML = (names.length ? names.map(n => `<option>${_escH(n)}</option>`).join("") : (optional ? "" : `<option value="">(none yet)</option>`)) +
      (optional ? `<option value="">— not used —</option>` : "");
    if (keep !== undefined && (keep === "" ? optional : names.includes(keep))) sel.value = keep;
  }
  async function readFile(dir, name) {
    const token = await getToken(); if (!token) throw new Error("not signed in");
    const r = await fetch(`${dir}/${encodeURIComponent(name)}:/content`, { headers: { Authorization: "Bearer " + token } });
    if (!r.ok) throw new Error(`could not read ${name} (${r.status})`);
    return XLSX.read(new Uint8Array(await r.arrayBuffer()), { type: "array" });
  }
  async function refresh(keepInd, keepCons) {
    try {
      await Promise.all([listInto(AOP_ROOT, $("aovAop"), $("aovAop").value),
        listInto(IND_DIR, $("aovInd"), keepInd !== undefined ? keepInd : ($("aovInd").options.length > 1 ? $("aovInd").value : undefined), true),
        listInto(CONS_DIR, $("aovCons"), keepCons !== undefined ? keepCons : ($("aovCons").options.length > 1 ? $("aovCons").value : undefined), true)]);
    } catch (e) { $("status").className = "err"; $("status").textContent = "AOP vs Indent: " + e.message; }
  }

  /* ---------- AOP: sections, and where each one's FY indent / consumption qty & cost are ---------- */
  function parseAop(wb) {
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn]; if (!ws["!ref"]) continue;
      const rg = XLSX.utils.decode_range(ws["!ref"]), cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
      const heads = [];
      for (let r = 0; r <= rg.e.r; r++) if (/^s(r)?\.?\s*no/i.test(tx(cell(r, 0)))) heads.push(r);
      if (!heads.length) continue;
      // the AOP year = the latest "FY xx-yy" in the headings
      let fyStart = 0;
      // "FY 26-27" or "FY-2026/27"
      heads.forEach(h => { for (let c = 0; c <= rg.e.c; c++) { const m = /FY\s*-?\s*(?:20)?(\d{2})\s*[-\/]\s*(\d{2})\b/i.exec(tx(cell(h, c))); if (m) fyStart = Math.max(fyStart, +m[1]); } });
      const fy = `${fyStart}-${fyStart + 1}`, isCur = h => new RegExp(`FY\\s*-?\\s*(20)?${fyStart}\\s*[-/]\\s*${fyStart + 1}\\b`, "i").test(h);
      const sections = heads.map(h => {
        let title = "";
        for (let k = h - 1; k >= Math.max(0, h - 6) && !title; k--) for (let c = 0; c <= 3; c++) { const t = tx(cell(k, c)); if (t) { title = t; break; } }
        const H = []; for (let c = 0; c <= rg.e.c; c++) H.push(tx(cell(h, c)));
        const find = (re, cur) => { let k = -1; H.forEach((t, c) => { if (re.test(t) && (!cur || isCur(t))) k = c; }); return k; };
        const first = re => H.findIndex(t => re.test(t));
        const cqCol = find(/consumption.*qty|qty.*consumption/i, true), ccCol = find(/consumption.*cost|cost.*consumption/i, true);
        let qtyCol = find(/indent\s*(budget\s*)?qty/i, true), costCol = find(/indent\s*(budget\s*)?cost/i, true);
        const indentBudget = qtyCol >= 0 || costCol >= 0;
        if (qtyCol < 0) qtyCol = cqCol;
        if (costCol < 0) costCol = ccCol;
        const col = { code: first(/item\s*code/i), name: first(/item\s*name|description|particular/i), um: first(/^(um|uom|unit)$/i), rate: first(/rate/i), qty: qtyCol, cost: costCol, cq: cqCol, cc: ccCol,
          inv: find(/budgeted\s*inventory\s*qty|inventory\s*budget\s*qty/i, true) };
        const items = [];
        for (let r = h + 1; r <= rg.e.r; r++) {
          const sr = tx(cell(r, 0));
          if (!/^\d+$/.test(sr)) break;
          const g = k => k >= 0 ? cell(r, k) : null, v = k => num(g(k) && g(k).v);
          const extra = []; for (let c = 0; c <= rg.e.c; c++) if (!Object.values(col).includes(c) && c > 0 && /[A-Za-z]/.test(tx(cell(r, c))) && !H[c]) extra.push(tx(cell(r, c)));
          items.push({ sec: title || `Table ${items.length + 1}`, sr: +sr, code: tx(g(col.code)).replace(/^-$/, ""), name: tx(g(col.name)), um: tx(g(col.um)),
            rate: v(col.rate), qty: v(col.qty), cost: v(col.cost), cq: v(col.cq), cc: v(col.cc), inv: v(col.inv), remark: extra.join(" ") });
        }
        return { title: title || "Table", items, indentBudget, hasCons: cqCol >= 0 || ccCol >= 0,
          meaning: indentBudget ? "AOP indent budget" : "AOP consumption budget (not an indent budget - kept out of the indent total)" };
      });
      return { sheet: sn, fy, fyStart, sections };
    }
    throw new Error("no AOP table (\"Sr.No.\" heading) found in this file");
  }

  /* ---------- indent report: every sheet, lines of the chosen department; a line in two sheets counts once ---------- */
  function parseIndent(wb, dept) {
    const want = norm(dept);
    const best = new Map();   // key -> { line, sheets }
    const cancelled = new Set();   // indent no.|item code of lines cancelled in full (Net Indent Qty 0) - left out everywhere
    let period = "";
    wb.SheetNames.forEach(sn => {
      const ws = wb.Sheets[sn]; if (!ws["!ref"]) return;
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
      for (let r = 0; r < Math.min(8, rows.length); r++) { const m = /period\s*from\s*(\S+)\s*to\s*(\S+)/i.exec(rows[r].join(" ")); if (m) period = `${m[1]} to ${m[2]}`; }
      const hr = rows.findIndex((row, i) => i < 20 && row.some(c => /^indent\s*number$/i.test(String(c).trim())) && row.some(c => /^item\s*code$/i.test(String(c).trim())));
      if (hr < 0) return;
      const H = rows[hr].map(c => String(c).trim().toLowerCase());
      const ix = name => H.indexOf(name.toLowerCase());
      const C = { date: ix("Indent Date"), no: ix("Indent Number"), code: ix("Item Code"), name: ix("Item Name"), um: ix("UM"), dept: ix("Department Name"),
        qty: ix("Indent Quantity"), canc: ix("Cancelled Quantity"), net: ix("Net Indent Quantity"), rate: ix("Indent Prov. Rate"), po: ix("po rate"),
        val: ix("Indent Val for Budget"), pono: ix("Purchase Order No."), vendor: ix("Vendor Name"), grn: ix("GRN Number"), pend: ix("Balance Indent Qty (GRN)") };
      if (C.no < 0 || C.code < 0) return;
      const count = new Map();
      for (let r = hr + 1; r < rows.length; r++) {
        const row = rows[r], no = String(row[C.no] || "").trim();
        if (!no) continue;
        if (want && C.dept >= 0 && norm(row[C.dept]) !== want) continue;
        const g = k => k >= 0 ? row[k] : "";
        const line = { date: String(g(C.date)), no, code: String(g(C.code)).trim(), name: String(g(C.name)).replace(/ /g, " ").trim(), um: String(g(C.um)),
          qty: num(g(C.qty)), canc: num(g(C.canc)), net: num(g(C.net)), rate: num(g(C.rate)), po: num(g(C.po)), val: num(g(C.val)),
          pono: String(g(C.pono)), vendor: String(g(C.vendor)), grn: String(g(C.grn)), pend: num(g(C.pend)) };
        if (C.net >= 0 && line.net <= 0) { cancelled.add(norm(no) + "|" + norm(line.code)); continue; }
        const key = [no, line.code, line.qty, line.net].join("|");
        const k2 = (count.get(key) || 0) + 1; count.set(key, k2);
        const kk = key + "#" + k2, b = best.get(kk);
        if (b) b.sheets.push(sn); else best.set(kk, { line, sheets: [sn] });
      }
    });
    const nSheets = new Set([].concat(...[...best.values()].map(b => b.sheets))).size;
    let lines = [...best.values()].map(b => Object.assign(b.line, { onlyIn: b.sheets.length < nSheets ? b.sheets.join(", ") : "" }));
    // dummy ₹1 lines: rate ₹1, value ₹1, no PO - for an item that has a real (priced) indent too -> left out
    const priced = new Set(lines.filter(l => l.val > 1).map(l => norm(l.code)));
    const dummy = new Set(), dummyNos = [];
    lines = lines.filter(l => {
      const noPo = !String(l.pono || "").trim() || String(l.pono).trim() === "0";
      if (l.rate <= 1 && l.val <= 1 && noPo && l.code && priced.has(norm(l.code))) { dummy.add(norm(l.no) + "|" + norm(l.code)); dummyNos.push(l.no); return false; }
      return true;
    });
    if (!lines.length && !cancelled.size) throw new Error(`no indent lines for department "${dept}" in this file`);
    return { lines, period, cancelled, dummy, dummyNos };
  }

  /* ---------- consumption: QAD store issue sheet (Month, Issue Date, Slip No, Item Code, Item Name, UM, Qty, Rate, Value, Remark) ---------- */
  function cellMonth(v) {          // -> year*12 + month(0-11), or null
    if (v instanceof Date && !isNaN(v)) return v.getFullYear() * 12 + v.getMonth();
    if (typeof v === "number" && v > 20000 && v < 80000) { const d = XLSX.SSF.parse_date_code(v); return d ? d.y * 12 + d.m - 1 : null; }
    const s = String(v == null ? "" : v).trim();
    let m = /^(\d{1,2})[-\/.](\d{1,2}|[A-Za-z]{3})[A-Za-z]*[-\/.](\d{2,4})/.exec(s);
    if (m) { const mo = isNaN(+m[2]) ? MON.findIndex(x => x.toLowerCase() === m[2].slice(0, 3).toLowerCase()) : +m[2] - 1; let y = +m[3]; if (y < 100) y += 2000; return mo >= 0 ? y * 12 + mo : null; }
    m = /^([A-Za-z]{3})[A-Za-z]*[-\s'\/]*(\d{2,4})$/.exec(s);
    if (m) { const mo = MON.findIndex(x => x.toLowerCase() === m[1].toLowerCase()); let y = +m[2]; if (y < 100) y += 2000; return mo >= 0 ? y * 12 + mo : null; }
    m = /^(\d{4})-(\d{2})/.exec(s);
    return m ? +m[1] * 12 + +m[2] - 1 : null;
  }
  function parseCons(wb) {
    const order = wb.SheetNames.slice().sort((a, b) => (/issue|consum/i.test(b) ? 1 : 0) - (/issue|consum/i.test(a) ? 1 : 0));
    for (const sn of order) {
      const ws = wb.Sheets[sn]; if (!ws["!ref"]) continue;
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
      const hr = rows.findIndex((row, i) => i < 20 && row.some(c => /^item\s*code$/i.test(String(c).trim())) && row.some(c => /^(qty|quantity|issue\s*qty)$/i.test(String(c).trim())));
      if (hr < 0) continue;
      const H = rows[hr].map(c => String(c).trim().toLowerCase());
      const ix = (...re) => H.findIndex(h => re.some(x => x.test(h)));
      const C = { month: ix(/^month$/), date: ix(/^issue\s*date$/, /^date$/), slip: ix(/^slip\s*no/, /^issue\s*no/), code: ix(/^item\s*code$/), name: ix(/^item\s*name$/, /^description$/),
        um: ix(/^(um|uom|unit)$/), qty: ix(/^(qty|quantity|issue\s*qty)$/), rate: ix(/^rate$/), val: ix(/^(value|amount|issue\s*value)$/), remark: ix(/^remarks?$/) };
      if (C.month < 0 && C.date < 0) continue;
      const lines = [];
      for (let r = hr + 1; r < rows.length; r++) {
        const row = rows[r], g = k => k >= 0 ? row[k] : "";
        const code = String(g(C.code)).trim();
        if (!code) continue;
        const mk = cellMonth(g(C.month)) != null ? cellMonth(g(C.month)) : cellMonth(g(C.date));
        const dk = g(C.date), qty = num(g(C.qty)), rate = num(g(C.rate));
        const val = C.val >= 0 && String(g(C.val)).trim() !== "" ? num(g(C.val)) : qty * rate;
        let date = "";
        if (typeof dk === "number" && dk > 20000) { const d = XLSX.SSF.parse_date_code(dk); date = `${String(d.d).padStart(2, "0")}-${MON[d.m - 1]}-${d.y}`; }
        else if (dk instanceof Date) date = `${String(dk.getDate()).padStart(2, "0")}-${MON[dk.getMonth()]}-${dk.getFullYear()}`;
        else date = String(dk);
        lines.push({ mk, month: mk == null ? "" : monName(mk), date, slip: String(g(C.slip)), code, name: String(g(C.name)).replace(/ /g, " ").trim(), um: String(g(C.um)),
          qty, rate, val, remark: String(g(C.remark)) });
      }
      if (!lines.length) continue;
      return { sheet: sn, lines };
    }
    throw new Error("no store-issue table (Item Code, Qty and Month / Issue Date headings) found in this file");
  }

  /* ---------- compare ---------- */
  function compare(aop, ind, cons) {
    ind = ind || { lines: [], period: "" };
    const all = [].concat(...aop.sections.map(s => s.items));
    const byCode = new Map(); all.forEach(it => { if (it.code && !byCode.has(it.code)) byCode.set(it.code, it); });
    const fresh = new Map();
    const match = l => {
      let it = byCode.get(l.code), how = it ? "item code" : "";
      if (!it) {
        const n = norm(l.name);
        it = all.find(a => !a.code && a.name && (n.startsWith(norm(a.name)) || norm(a.name).startsWith(n)));
        if (it) { how = "item name"; it.byName = true; }
      }
      if (!it) {
        const fk = l.code || "N:" + norm(l.name);
        if (!fresh.has(fk)) fresh.set(fk, { sec: "New items (not in AOP)", sr: fresh.size + 1, code: l.code, name: l.name, um: l.um, rate: 0, qty: 0, cost: 0, cq: 0, cc: 0, remark: "", isNew: true });
        it = fresh.get(fk);
      }
      l.target = it; l.how = how;
      // same item code but a quite different name in the ERP line -> shown, so a wrong code in the ERP is noticed
      if (how === "item code" && l.name && it.name && !calNameAlike(l.name, it.name)) l.nameDiff = true;
      return it;
    };
    // indents
    const agg = new Map();
    ind.lines.forEach(l => {
      const it = match(l);
      const a = agg.get(it) || { qty: 0, val: 0, n: 0, canc: 0, nos: [], notes: [] };
      a.qty += l.net; a.val += l.val; a.n++; a.canc += l.canc;
      a.nos.push(`${l.no} (${l.date.slice(0, 11)})`);
      if (l.nameDiff) a.notes.push(`⚠️ indent ${l.no} has this item code but the name "${l.name}"`);
      if (l.onlyIn) a.notes.push(`${l.no} only in sheet ${l.onlyIn}`);
      agg.set(it, a);
    });
    // consumption (issues inside the AOP year only)
    const fyFrom = (2000 + aop.fyStart) * 12 + 3, fyTo = fyFrom + 11;
    const cAgg = new Map(), cMonths = new Set();
    let cOut = 0;
    const cLines = cons ? cons.lines.filter(l => { const ok = l.mk != null && l.mk >= fyFrom && l.mk <= fyTo; if (!ok) cOut++; l.inFy = ok; return ok; }) : [];
    cLines.forEach(l => {
      const it = match(l);
      cMonths.add(l.mk);
      const c = cAgg.get(it) || { qty: 0, val: 0, n: 0, months: new Set(), diff: [] };
      c.qty += l.qty; c.val += l.val; c.n++; c.months.add(l.mk);
      if (l.nameDiff) c.diff.push(`⚠️ issue ${l.slip || ""} (${l.date}, ₹${Math.round(l.val).toLocaleString("en-IN")}) has this item code but the name "${l.name}"`);
      cAgg.set(it, c);
    });
    fresh.forEach(it => {
      const a = agg.get(it), c = cAgg.get(it);
      it.rate = a && a.qty ? a.val / a.qty : (c && c.qty ? c.val / c.qty : 0);
    });
    const mList = [...cMonths].sort((a, b) => a - b);
    const cm = mList.length ? Math.max(1, Math.min(12, mList[mList.length - 1] - fyFrom + 1)) : 12;
    const status = (it, a) => {
      if (it.isNew) return !a ? "" : (a.qty === 0 ? "New item - indent cancelled" : "New item (not in AOP)");
      if (!a) return (it.qty || it.cost) ? "Not indented yet" : "No indent in AOP";
      if (a.qty === 0) return "Indent cancelled";
      if ((it.qty && a.qty > it.qty + 1e-9) || (it.cost && a.val > it.cost + 0.5) || (!it.cost && a.val > 0)) return "Over AOP";
      return "Within AOP";
    };
    const cStatus = (it, c) => {
      if (!cons) return "";
      if (it.isNew) return c ? "Consumed - new item (not in AOP)" : "";
      if (!it.cq && !it.cc) return c ? "Consumed - no AOP consumption budget" : "No consumption budget";
      if (!c) return "Not consumed yet";
      if ((it.cq && c.qty > it.cq + 1e-9) || (it.cc && c.val > it.cc + 0.5)) return "Over annual budget";
      if (it.cc ? c.val > it.cc * cm / 12 + 0.5 : c.qty > it.cq * cm / 12 + 1e-9) return "Above pro-rata";
      return "Within pro-rata";
    };
    const sections = aop.sections.concat([{ title: "New items (not in AOP)", items: [...fresh.values()], indentBudget: true, hasCons: true, meaning: "not in the AOP; rate = indent rate (or issue rate if not indented)", isNew: true }])
      .map(sec => {
        const rows = sec.items.map(it => {
          const a = agg.get(it), c = cAgg.get(it);
          const remark = [a ? a.nos.join(", ") : "", a && a.canc ? `cancelled qty ${a.canc}` : "", ...(a ? a.notes : []),
            c ? `issued in ${[...c.months].sort((x, y) => x - y).map(k => MON[k % 12]).join(", ")}` : "", ...(c && c.diff ? c.diff : []),
            it.byName ? "matched by item name (no item code in AOP)" : "", it.remark].filter(Boolean).join("; ");
          const ir = a && a.qty ? a.val / a.qty : null, cr = c && c.qty ? c.val / c.qty : null, ar = Math.round(it.rate * 1e4) / 1e4;
          return { it, a, c, iq: a ? a.qty : null, iv: a ? a.val : null, n: a ? a.n : null, cqv: c ? c.qty : null, cvv: c ? c.val : null, cn: c ? c.n : null,
            ir, cr, id: ir === null || it.isNew ? null : ir - ar, cd: cr === null || it.isNew ? null : cr - ar,
            status: status(it, a), cstatus: cStatus(it, c), remark, nameDiff: !!((a && a.notes.some(x => /^⚠️/.test(x))) || (c && c.diff && c.diff.length)) };
        });
        const t = rows.reduce((s, r) => ({ cost: s.cost + (r.it.cost || 0), val: s.val + (r.iv || 0), n: s.n + (r.n || 0), cc: s.cc + (r.it.cc || 0), cv: s.cv + (r.cvv || 0), cn: s.cn + (r.cn || 0) }),
          { cost: 0, val: 0, n: 0, cc: 0, cv: 0, cn: 0 });
        return Object.assign({}, sec, { rows, tot: t });
      });
    // months of the AOP year covered by the indent report (for the indent pro-rata column)
    let months = 12;
    const m = /(\d{1,2})-([A-Z]{3})-(\d{2,4})\s*$/i.exec(ind.period || "");
    if (m) {
      const MO = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 }[m[2].toUpperCase()];
      let y = +m[3]; if (y < 100) y += 2000;
      months = Math.max(1, Math.min(12, (y * 12 + MO) - ((2000 + aop.fyStart) * 12 + 4) + 1));
    }
    const missing = []; if (mList.length) for (let k = fyFrom; k <= mList[mList.length - 1]; k++) if (!cMonths.has(k)) missing.push(MON[k % 12]);
    const cPeriod = mList.length ? `${monName(fyFrom)} to ${monName(mList[mList.length - 1])}` : "";
    return { sections, lines: ind.lines, period: ind.period, months, fy: aop.fy, fyStart: aop.fyStart, aopSheet: aop.sheet, aopName: R.aopName, indName: R.indName, consName: R.consName, dept: $("aovDept").value.trim(),
      hasInd: ind.lines.length > 0, hasCons: !!cons, cSheet: cons ? cons.sheet : "", cLines, cOut, cm, cPeriod, cMonthsWith: mList.map(k => MON[k % 12]), cMissing: missing };
  }

  /* ---------- show: a Summary tab + one tab per AOP section (Consumables, Minimax, SRN ...), items as cards ---------- */
  const isBad = s => /Over|Above|New item \(|new item/.test(s || "");
  const needsLook = r => r.nameDiff || isBad(r.status) || isBad(r.cstatus) || (r.id !== null && r.id > 0.005) || (r.cd !== null && r.cd > 0.005);
  const isActive = r => !!(r.a || r.c);
  function show(res) {
    const pct = (a, b) => b ? (a / b * 100).toFixed(1) + "%" : "–";
    if (!R.tab || (R.tab !== "sum" && !res.sections[+R.tab.slice(1)])) R.tab = "sum";
    R.filter = R.filter || "act";
    // what was compared
    let h = `<div class="aovInfo">📑 AOP FY ${res.fy} · ${_escH(res.dept)}<br>` +
      (res.hasInd ? `🧾 Indents ${_escH(res.period || "")} · ${res.lines.length} line(s)` : "🧾 No indent file") + "<br>" +
      (res.hasCons ? `📦 Issues ${_escH(res.cPeriod)} · ${res.cLines.length} line(s)` : "📦 No consumption file") +
      (res.manI || res.manC ? `<br>➕ Added in the app: ${res.manI} indent(s), ${res.manC} requisition(s)` : "") + `</div>`;
    if (res.manDup) h += `<div class="aovNote">${res.manDup} app entr${res.manDup > 1 ? "ies are" : "y is"} now in the ERP file (same indent / slip no.) - counted once, from the file.</div>`;
    if (res.hasCons && res.cMissing.length) h += `<div class="aovNote aovWarn">⚠️ No issue lines for ${_escH(res.cMissing.join(", "))} in the consumption file. If those months had issues, add them and compare again.</div>`;
    if (res.hasCons && res.cOut) h += `<div class="aovNote">${res.cOut} issue line(s) outside FY ${res.fy} (or without a month) left out.</div>`;
    // tabs
    const tabs = [{ k: "sum", t: "📋 Summary" }].concat(res.sections.map((s, i) => ({ k: "s" + i, t: s.isNew ? "🆕 New items" : s.title, n: s.rows.filter(isActive).length, m: s.rows.filter(needsLook).length })));
    h += `<div class="aovTabs" role="tablist">` + tabs.map(t => `<button type="button" role="tab" class="aovTab${R.tab === t.k ? " on" : ""}" data-tab="${t.k}">${_escH(t.t)}` +
      (t.n !== undefined ? ` <span class="aovBadge">${t.n}</span>` : "") + (t.m ? ` <span class="aovBadge bad">${t.m}</span>` : "") + `</button>`).join("") + `</div>`;
    h += `<div class="aovPanel">${R.tab === "sum" ? sumPanel(res, pct) : secPanel(res, res.sections[+R.tab.slice(1)], pct)}</div>`;
    $("aovOut").innerHTML = h;
  }
  function sumPanel(res, pct) {
    let h = "";
    if (res.hasInd) {
      const inTot = res.sections.filter(s => s.indentBudget), info = res.sections.filter(s => !s.indentBudget);
      const T = inTot.reduce((s, x) => ({ cost: s.cost + x.tot.cost, val: s.val + x.tot.val, n: s.n + x.tot.n }), { cost: 0, val: 0, n: 0 });
      const row = (title, t, bold) => `<tr${bold ? ' class="rowTotal"' : ""}><td style="text-align:left">${_escH(title)}</td><td>${fmt(t.cost)}</td><td>${fmt(t.val)}</td><td>${fmt(t.cost - t.val)}</td><td>${pct(t.val, t.cost)}</td><td>${fmt(t.cost * res.months / 12)}</td><td>${t.n}</td></tr>`;
      h += `<h3 class="aovH3">🧾 Indent vs AOP</h3><div class="tableScroll"><table class="matrixTable stockTable"><tr><th>Section</th><th>AOP indent cost</th><th>Indented</th><th>Balance</th><th>% used</th><th>AOP pro-rata (${res.months}/12)</th><th>Indents</th></tr>`;
      inTot.forEach(s => { h += row(s.title, s.tot); });
      h += row("TOTAL", T, true);
      info.forEach(s => { h += row(s.title + " (consumption budget, not in total)", s.tot); });
      h += `</table></div>`;
    }
    if (res.hasCons) {
      const secs = res.sections.filter(s => s.hasCons || s.tot.cv);
      const T = secs.reduce((s, x) => ({ cc: s.cc + x.tot.cc, cv: s.cv + x.tot.cv, cn: s.cn + x.tot.cn }), { cc: 0, cv: 0, cn: 0 });
      const row = (title, t, bold) => { const pr = t.cc * res.cm / 12;
        return `<tr${bold ? ' class="rowTotal"' : ""}><td style="text-align:left">${_escH(title)}</td><td>${fmt(t.cc)}</td><td>${fmt(t.cv)}</td><td>${fmt(t.cc - t.cv)}</td><td>${pct(t.cv, t.cc)}</td><td>${fmt(pr)}</td><td class="${t.cv > pr + 0.5 ? "psvNeg" : ""}">${fmt(t.cv - pr)}</td><td>${t.cn}</td></tr>`; };
      h += `<h3 class="aovH3">📦 Consumption vs AOP</h3><div class="tableScroll"><table class="matrixTable stockTable"><tr><th>Section</th><th>AOP consumption cost</th><th>Consumed</th><th>Balance</th><th>% used</th><th>AOP pro-rata (${res.cm}/12)</th><th>Consumed vs pro-rata</th><th>Issue lines</th></tr>`;
      secs.forEach(s => { h += row(s.title, s.tot); });
      h += row("TOTAL", T, true) + `</table></div>`;
    }
    const all = [].concat(...res.sections.map(s => s.rows));
    const notes = [`⚠️ <b>${all.filter(needsLook).length}</b> item(s) need a look (over AOP / above pro-rata / new / costlier than the AOP rate) - red number on each tab`];
    if (res.hasInd) notes.push(`${all.filter(r => r.status === "Not indented yet").length} AOP item(s) with an indent budget are not indented yet`);
    if (res.hasCons) notes.push(`${all.filter(r => r.cstatus === "Not consumed yet").length} AOP item(s) with a consumption budget are not consumed yet`);
    h += `<ul class="aovList">${notes.map(n => `<li>${n}</li>`).join("")}</ul>`;
    return h;
  }
  function secPanel(res, sec, pct) {
    const rows = sec.rows, nAct = rows.filter(isActive).length, nLook = rows.filter(needsLook).length;
    const list = R.filter === "all" ? rows : (R.filter === "look" ? rows.filter(needsLook) : rows.filter(isActive));
    const t = sec.tot;
    let h = `<div class="aovTotRow">` +
      (res.hasInd ? `<div class="aovTotBox"><span>🧾 Indent</span><b>₹${fmt(t.val)}</b><small>of AOP ₹${fmt(t.cost)} · ${pct(t.val, t.cost)}${sec.indentBudget ? "" : " · consumption budget"}</small></div>` : "") +
      (res.hasCons ? `<div class="aovTotBox"><span>📦 Consumption</span><b>₹${fmt(t.cv)}</b><small>of AOP ₹${fmt(t.cc)} · ${pct(t.cv, t.cc)} · pro-rata ₹${fmt(t.cc * res.cm / 12)}</small></div>` : "") + `</div>`;
    h += `<div class="aovFilters">` + [["act", `Indented / consumed (${nAct})`], ["look", `⚠️ Needs a look (${nLook})`], ["all", `All items (${rows.length})`]]
      .map(([k, l]) => `<button type="button" class="aovChip${R.filter === k ? " on" : ""}" data-flt="${k}">${l}</button>`).join("") + `</div>`;
    if (!list.length) return h + `<p class="aovNote">No item here.</p>`;
    const chip = s => s ? `<span class="aovSt ${isBad(s) ? "bad" : (/Within/.test(s) ? "ok" : "")}">${_escH(s)}</span>` : "";
    const diff = d => d === null ? "" : ` <b class="${d > 0.005 ? "psvNeg" : (d < -0.005 ? "psvPos" : "")}">(${Math.abs(d) < 0.005 ? "same as AOP" : (d > 0 ? "+" : "") + fmt(d, 2)})</b>`;
    const q = (v, um) => v === null ? "" : `${fmt(v, 2)} ${_escH(um || "")}`;
    h += list.map(r => {
      const it = r.it;
      let x = `<div class="aovItem${needsLook(r) ? " look" : ""}"><div class="aovItemHead"><b>${_escH(it.name)}</b><small>${_escH(it.code || "no code")}${it.um ? " · " + _escH(it.um) : ""}${it.isNew ? "" : ` · AOP rate ₹${fmt(it.rate, 2)}`}</small></div>`;
      if (res.hasInd) x += `<div class="aovLine"><span class="aovLbl">🧾 Indent</span><span>AOP ₹${fmt(it.cost || 0)}${it.qty ? ` (${q(it.qty, it.um)})` : ""}</span>` +
        (r.a ? `<span>Indented ₹${fmt(r.iv)} (${q(r.iq, it.um)})</span>${r.ir !== null ? `<span>Rate ₹${fmt(r.ir, 2)}${diff(r.id)}</span>` : ""}` : "") + chip(r.status) + `</div>`;
      if (res.hasCons) x += `<div class="aovLine"><span class="aovLbl">📦 Consumption</span><span>AOP ₹${fmt(it.cc || 0)}${it.cq ? ` (${q(it.cq, it.um)})` : ""}</span>` +
        (r.c ? `<span>Consumed ₹${fmt(r.cvv)} (${q(r.cqv, it.um)})</span>${r.cr !== null ? `<span>Rate ₹${fmt(r.cr, 2)}${diff(r.cd)}</span>` : ""}` : "") + chip(r.cstatus) + `</div>`;
      if (r.remark) x += `<div class="aovRem">${_escH(r.remark)}</div>`;
      return x + `</div>`;
    }).join("");
    return h;
  }

  /* ---------- Excel, in the AOP's look ---------- */
  async function excel() {
    const res = R.res, st = $("status");
    if (!res) return;
    try {
      st.className = "wait"; st.textContent = "Making the Excel...";
      await psvLoadExcelJs();
      const wb = new ExcelJS.Workbook(); wb.calcProperties.fullCalcOnLoad = true;
      const title = res.hasInd && res.hasCons ? "Indent & Consumption" : (res.hasCons ? "Consumption" : "Indent");
      const ws = wb.addWorksheet(`AOP vs ${res.hasInd && res.hasCons ? "Ind & Cons" : title}`, { views: [{ state: "frozen", xSplit: 3, ySplit: 3 }],
        pageSetup: { paperSize: 8, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
      const fill = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
      const GREEN = fill("FF92D050"), YELLOW = fill("FFFFFF00"), GREY = fill("FFF2F2F2"), RED = fill("FFFFC7CE"), BLUE = fill("FFDDEBF7"), ORANGE = fill("FFFCE4D6");
      const thin = { style: "thin", color: { argb: "FF000000" } }, BOX = { top: thin, left: thin, bottom: thin, right: thin };
      const NUM = '_ * #,##0_ ;_ * \\-#,##0_ ;_ * "-"??_ ;_ @_ ', QTY = '_ * #,##0.##_ ;_ * \\-#,##0.##_ ;_ * "-"??_ ;_ @_ ', PCT = "0.0%";
      const RATE = '_ * #,##0.00_ ;_ * \\-#,##0.00_ ;_ * "-"??_ ;_ @_ ';
      const diffFill = d => d === null ? undefined : (d > 0.005 ? RED : (d < -0.005 ? fill("FFC6EFCE") : undefined));
      const L = c => { let s = ""; for (c = +c; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + (c - 1) % 26) + s; return s; };
      const put = (r, c, v, o) => { o = o || {}; const x = ws.getCell(r, c); x.value = v; x.border = BOX; x.font = { name: "Calibri", size: 11, bold: !!o.bold };
        if (o.fmt) x.numFmt = o.fmt; if (o.fill) x.fill = o.fill; if (o.wrap || o.align) x.alignment = { wrapText: !!o.wrap, horizontal: o.align, vertical: "middle" }; return x; };
      const f = (formula, result) => ({ formula, result });
      const r2 = v => Math.round(v * 100) / 100;
      const bad = s => /Over|Above|New item \(|new item/.test(s);
      // columns: key, heading, width, value(row, r, col) ; c(key) gives a column's letter so formulas follow the layout
      const COLS = [
        { k: "sr", h: "Sr.No.", w: 6.3, v: (r, k) => k + 1, o: { align: "center" } },
        { k: "code", h: "Item Code", w: 14.1, v: r => r.it.code || "-" },
        { k: "name", h: "Item Name", w: 47.7, v: r => r.it.name },
        { k: "um", h: "UM", w: 8, v: r => r.it.um, o: { align: "center" } },
        { k: "rate", h: "AOP Rate", w: 12.6, v: r => Math.round(r.it.rate * 1e4) / 1e4, o: { fmt: RATE } }];
      if (res.hasInd) COLS.push(
        { k: "aq", h: `AOP Qty FY ${res.fy}`, w: 13, v: r => r.it.qty || null, o: { fmt: QTY } },
        { k: "ac", h: `AOP Cost FY ${res.fy}`, w: 15, v: r => r.it.cost ? r2(r.it.cost) : null, o: { fmt: NUM }, sum: true },
        { k: "iq", h: `Indent Qty (${res.period})`, w: 14, v: r => r.iq, o: { fmt: QTY } },
        { k: "iv", h: `Indent Value (${res.period})`, w: 15, v: r => r.iv === null ? null : r2(r.iv), o: { fmt: NUM }, sum: true },
        { k: "ir", h: "Avg Indent Rate", w: 12, v: (r, k, R0, c) => f(`IFERROR(${c("iv")}${R0}/${c("iq")}${R0},"")`, r.iq ? r.iv / r.iq : ""), o: { fmt: RATE } },
        { k: "id", h: "Indent Rate − AOP Rate", w: 12, v: (r, k, R0, c) => r.it.isNew ? null : f(`IF(${c("ir")}${R0}="","",${c("ir")}${R0}-${c("rate")}${R0})`, r.id === null ? "" : r.id), o: { fmt: RATE }, fillBy: r => diffFill(r.id) },
        { k: "bq", h: "Balance Qty", w: 11, v: (r, k, R0, c) => f(`${c("aq")}${R0}-${c("iq")}${R0}`, (r.it.qty || 0) - (r.iq || 0)), o: { fmt: QTY } },
        { k: "bc", h: "Balance Cost", w: 14, v: (r, k, R0, c) => f(`${c("ac")}${R0}-${c("iv")}${R0}`, (r.it.cost || 0) - (r.iv || 0)), o: { fmt: NUM }, sum: true },
        { k: "ip", h: "% of AOP Cost Used", w: 11, v: (r, k, R0, c) => f(`IFERROR(${c("iv")}${R0}/${c("ac")}${R0},"")`, r.it.cost ? (r.iv || 0) / r.it.cost : ""), o: { fmt: PCT }, tot: c => `IFERROR(${c("iv")}#/${c("ac")}#,"")` },
        { k: "in", h: "No. of Indents", w: 9, v: r => r.n, o: { align: "center" }, sum: true },
        { k: "is", h: "Indent Status", w: 22, v: r => r.status, fillBy: r => bad(r.status) ? RED : (r.a ? BLUE : undefined) });
      if (res.hasCons) COLS.push(
        { k: "cq", h: `AOP Consumption Qty FY ${res.fy}`, w: 13, v: r => r.it.cq || null, o: { fmt: QTY } },
        { k: "cc", h: `AOP Consumption Cost FY ${res.fy}`, w: 15, v: r => r.it.cc ? r2(r.it.cc) : null, o: { fmt: NUM }, sum: true },
        { k: "xq", h: `Consumed Qty (${res.cPeriod})`, w: 14, v: r => r.cqv, o: { fmt: QTY } },
        { k: "xv", h: `Consumed Value (${res.cPeriod})`, w: 15, v: r => r.cvv === null ? null : r2(r.cvv), o: { fmt: NUM }, sum: true },
        { k: "xa", h: "Avg Issue Rate", w: 12, v: (r, k, R0, c) => f(`IFERROR(${c("xv")}${R0}/${c("xq")}${R0},"")`, r.cqv ? r.cvv / r.cqv : ""), o: { fmt: RATE } },
        { k: "xd", h: "Issue Rate − AOP Rate", w: 12, v: (r, k, R0, c) => r.it.isNew ? null : f(`IF(${c("xa")}${R0}="","",${c("xa")}${R0}-${c("rate")}${R0})`, r.cd === null ? "" : r.cd), o: { fmt: RATE }, fillBy: r => diffFill(r.cd) },
        { k: "xb", h: "Consumption Balance Cost", w: 14, v: (r, k, R0, c) => f(`${c("cc")}${R0}-${c("xv")}${R0}`, (r.it.cc || 0) - (r.cvv || 0)), o: { fmt: NUM }, sum: true },
        { k: "xp", h: "% of Consumption Budget Used", w: 12, v: (r, k, R0, c) => f(`IFERROR(${c("xv")}${R0}/${c("cc")}${R0},"")`, r.it.cc ? (r.cvv || 0) / r.it.cc : ""), o: { fmt: PCT }, tot: c => `IFERROR(${c("xv")}#/${c("cc")}#,"")` },
        { k: "xr", h: `Consumption pro-rata (${res.cm}/12)`, w: 14, v: (r, k, R0, c) => f(`${c("cc")}${R0}*${res.cm}/12`, (r.it.cc || 0) * res.cm / 12), o: { fmt: NUM }, sum: true },
        { k: "xn", h: "No. of Issue Lines", w: 9, v: r => r.cn, o: { align: "center" }, sum: true },
        { k: "xs", h: "Consumption Status", w: 24, v: r => r.cstatus, fillBy: r => bad(r.cstatus) ? RED : (r.c ? ORANGE : undefined) });
      COLS.push({ k: "rm", h: res.hasInd ? "Indent No. (Date) / Remarks" : "Remarks", w: 60, v: r => r.remark, o: { wrap: true } });
      const pos = {}; COLS.forEach((x, i) => { pos[x.k] = i + 1; });
      const c = k => L(pos[k]), NC = COLS.length;
      COLS.forEach((x, i) => { ws.getColumn(i + 1).width = x.w; });
      ws.getCell("C1").value = `AOP FY ${res.fy} vs ${title.toUpperCase()} - ${res.dept}`; ws.getCell("C1").font = { name: "Calibri", size: 14, bold: true }; ws.getCell("C1").fill = YELLOW;
      ws.getCell("C2").value = [res.hasInd ? `Indents: ${res.period || ""} (ERP Master Indent Report, department ${res.dept}); Net Indent Qty and 'Indent Val for Budget' (cancelled quantity left out); file ${res.indName}.` : "",
        res.hasCons ? `Consumption: store issues ${res.cPeriod} (file ${res.consName || "-"}, sheet ${res.cSheet}: Qty and Value)${res.cMissing.length ? `; no issue lines for ${res.cMissing.join(", ")}` : ""}.` : "",
        res.manI || res.manC ? `Added in the app: ${res.manI} indent(s), ${res.manC} requisition(s).` : "",
        `AOP: ${res.aopName}.`].filter(Boolean).join(" ");
      ws.getCell("C2").font = { name: "Calibri", size: 10, italic: true };
      // where the summary goes: indent block and / or consumption block
      const SUM_TOP = 4, nSec = res.sections.length;
      const indSumRows = res.hasInd ? nSec + 3 : 0, conSumRows = res.hasCons ? nSec + 3 : 0;
      let row = SUM_TOP + indSumRows + (res.hasInd && res.hasCons ? 2 : 0) + conSumRows + 3;
      const totals = [];
      res.sections.forEach(sec => {
        ws.getCell(row, 3).value = sec.title; ws.getCell(row, 3).font = { name: "Calibri", size: 16, bold: true }; ws.getCell(row, 3).fill = YELLOW;
        ws.getCell(row, 5).value = res.hasInd ? `AOP figure = ${sec.meaning}` : ""; ws.getCell(row, 5).font = { name: "Calibri", size: 9, italic: true };
        row++;
        COLS.forEach((x, i) => put(row, i + 1, x.h, { bold: true, fill: GREEN, wrap: true, align: "center" }));
        ws.getRow(row).height = 45; row++;
        const first = row;
        sec.rows.forEach((r, k) => {
          COLS.forEach((x, i) => { const o = Object.assign({}, x.o || {}); const fl = x.fillBy && x.fillBy(r); if (fl) o.fill = fl; put(row, i + 1, x.v(r, k, row, c), o); });
          row++;
        });
        const last = row - 1;
        for (let k = 1; k <= NC; k++) put(row, k, null, { fill: GREY });
        put(row, 3, "Total", { bold: true, fill: GREY });
        COLS.forEach((x, i) => {
          if (x.sum) put(row, i + 1, last >= first ? f(`SUM(${L(i + 1)}${first}:${L(i + 1)}${last})`) : 0, { fmt: x.k === "in" || x.k === "xn" ? undefined : NUM, bold: true, fill: GREY, align: x.k === "in" || x.k === "xn" ? "center" : undefined });
          else if (x.tot) put(row, i + 1, f(x.tot(c).replace(/#/g, row)), { fmt: PCT, bold: true, fill: GREY });
        });
        totals.push({ sec, row });
        row += 3;
      });
      // summary blocks (formulas point at the section totals); fixed columns C..P, merged where the item columns are narrow
      let r = SUM_TOP;
      const block = (head, cols, list, totalLabel, extra) => {
        ws.getCell(r, 3).value = head; ws.getCell(r, 3).font = { name: "Calibri", size: 14, bold: true }; ws.getCell(r, 3).fill = YELLOW; r++;
        const SH = { 3: "Section", 7: cols.budget, 9: cols.actual, 12: "Balance Cost", 13: "% Used", 14: cols.count, 15: cols.pr, 16: cols.vs };
        Object.keys(SH).forEach(k => put(r, +k, SH[k], { bold: true, fill: GREEN, wrap: true, align: "center" }));
        ws.getRow(r).height = 32; r++;
        const sFirst = r;
        const sumRow = (t, label) => {
          put(r, 3, label, { wrap: true }); put(r, 7, f(`${c(cols.kb)}${t.row}`), { fmt: NUM }); put(r, 9, f(`${c(cols.ka)}${t.row}`), { fmt: NUM });
          put(r, 12, f(`G${r}-I${r}`), { fmt: NUM }); put(r, 13, f(`IFERROR(I${r}/G${r},"")`), { fmt: PCT }); put(r, 14, f(`${c(cols.kn)}${t.row}`), { align: "center" });
          put(r, 15, f(`G${r}*${cols.m}/12`), { fmt: NUM }); put(r, 16, f(`I${r}-O${r}`), { fmt: NUM });
          ws.mergeCells(r, 3, r, 6); ws.mergeCells(r, 7, r, 8); ws.mergeCells(r, 9, r, 11); r++;
        };
        list.forEach(t => sumRow(t, t.sec.title));
        put(r, 3, totalLabel, { bold: true, fill: GREY });
        [7, 9, 12, 14, 15, 16].forEach(k => put(r, k, f(`SUM(${L(k)}${sFirst}:${L(k)}${r - 1})`), { fmt: k === 14 ? undefined : NUM, bold: true, fill: GREY }));
        put(r, 13, f(`IFERROR(I${r}/G${r},"")`), { fmt: PCT, bold: true, fill: GREY });
        ws.mergeCells(r, 3, r, 6); ws.mergeCells(r, 7, r, 8); ws.mergeCells(r, 9, r, 11); r++;
        if (extra) extra(sumRow);
      };
      if (res.hasInd) {
        block("SUMMARY - INDENT", { budget: `AOP Indent Cost FY ${res.fy}`, actual: `Indent Value (${res.period})`, count: "No. of Indents", pr: `AOP pro-rata (${res.months}/12)`, vs: "Indent vs pro-rata",
          kb: "ac", ka: "iv", kn: "in", m: res.months }, totals.filter(t => t.sec.indentBudget), "TOTAL",
          sumRow => totals.filter(t => !t.sec.indentBudget).forEach(t => { sumRow(t, `${t.sec.title} (consumption budget - not in total)`); ws.getRow(r - 1).height = 30; }));
        if (res.hasCons) r += 2;
      }
      if (res.hasCons)
        block("SUMMARY - CONSUMPTION", { budget: `AOP Consumption Cost FY ${res.fy}`, actual: `Consumed Value (${res.cPeriod})`, count: "No. of Issue Lines", pr: `AOP pro-rata (${res.cm}/12)`, vs: "Consumed vs pro-rata",
          kb: "cc", ka: "xv", kn: "xn", m: res.cm }, totals.filter(t => t.sec.hasCons || t.sec.tot.cv), "TOTAL");
      const sheetOf = (name, H2, widths, lines, vals, mark) => {
        const w2 = wb.addWorksheet(name, { views: [{ state: "frozen", xSplit: 4, ySplit: 1 }], pageSetup: { paperSize: 8, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
        widths.forEach((w, i) => { w2.getColumn(i + 1).width = w; });
        H2.forEach((t, i) => { const x = w2.getCell(1, i + 1); x.value = t; x.font = { name: "Calibri", bold: true }; x.fill = GREEN; x.border = BOX; x.alignment = { wrapText: true, horizontal: "center", vertical: "middle" }; });
        w2.getRow(1).height = 32;
        lines.forEach((l, i) => { const fl = mark(l);
          vals(l).forEach((v, k) => { const x = w2.getCell(i + 2, k + 1); x.value = v === "" ? null : v; x.border = BOX; x.font = { name: "Calibri" };
            if (H2[k].fmt) x.numFmt = H2[k].fmt; if (fl) x.fill = fl; }); });
        return w2;
      };
      // indent lines, each with what it was matched to
      if (res.hasInd) {
        const w2 = sheetOf("Indent lines", ["Indent Date", "Indent Number", "Item Code", "Item Name", "UM", "Indent Quantity", "Cancelled Quantity", "Net Indent Quantity", "Indent Prov. Rate", "po rate",
          "Indent Val for Budget", "Purchase Order No.", "Vendor Name", "GRN Number", "Matched to AOP section", "AOP Sr.No.", "Matched by", "Note"],
          [12, 13, 11, 50, 6, 9, 9, 9, 11, 10, 12, 13, 32, 13, 22, 8, 11, 22],
          res.lines.slice().sort((a, b) => (a.code + a.no).localeCompare(b.code + b.no)),
          l => [l.date, l.no, l.code, l.name, l.um, l.qty, l.canc, l.net, l.rate, l.po, l.val, l.pono, l.vendor, l.grn,
            l.target.isNew ? "NEW (not in AOP)" : l.target.sec, l.target.isNew ? null : l.target.sr, l.how || "-", l.manual ? "added in app" + (l.remark ? ": " + l.remark : "") : (l.onlyIn ? `only in sheet ${l.onlyIn}` : "")],
          l => l.target.isNew ? RED : (l.onlyIn ? BLUE : undefined));
        [9, 10, 11].forEach(k => { w2.getColumn(k).numFmt = NUM; });
      }
      // consumption lines, each with what it was matched to
      if (res.hasCons) {
        const w3 = sheetOf("Consumption lines", ["Month", "Issue Date", "Slip No", "Item Code", "Item Name", "UM", "Qty", "Rate", "Value", "Remark", "Matched to AOP section", "AOP Sr.No.", "Matched by"],
          [10, 12, 13, 12, 50, 6, 9, 12, 13, 28, 22, 8, 11],
          res.cLines.slice().sort((a, b) => a.mk - b.mk || a.date.localeCompare(b.date)),
          l => [l.month, l.date, l.slip, l.code, l.name, l.um, l.qty, r2(l.rate), r2(l.val), l.remark, l.target.isNew ? "NEW (not in AOP)" : l.target.sec, l.target.isNew ? null : l.target.sr, l.how || "-"],
          l => l.target.isNew ? RED : undefined);
        [8, 9].forEach(k => { w3.getColumn(k).numFmt = NUM; });
        const n = res.cLines.length + 2;
        w3.getCell(n, 5).value = "Total"; w3.getCell(n, 5).font = { name: "Calibri", bold: true };
        w3.getCell(n, 9).value = f(`SUM(I2:I${n - 1})`); w3.getCell(n, 9).font = { name: "Calibri", bold: true }; w3.getCell(n, 9).numFmt = NUM;
      }
      const buf = await wb.xlsx.writeBuffer();
      const per = res.hasInd ? res.period : res.cPeriod;
      const name = `AOP_FY${res.fy}_vs_${res.hasInd && res.hasCons ? "Indent_Consumption" : title}_${(per || "").replace(/\s+to\s+/i, "_to_").replace(/[^A-Za-z0-9_-]/g, "")}.xlsx`;
      const u = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })), a = document.createElement("a");
      a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 10000);
      st.className = "ok"; st.textContent = `Downloaded ${name}`;
    } catch (e) { st.className = "err"; st.textContent = "Excel error: " + e.message; }
  }

  /* ---------- next FY AOP (work in progress) from the AOP + indent + consumption ---------- */
  // Same table layout for every section (the Consumables format, one year on) + [WIP] working columns on the right,
  // which "Move to final AOP" drops. Estimate Nov-Mar: average of the months so far x the months left; an item not consumed
  // so far (and services, J codes / SRN) -> what is left of its AOP budget. Budget qty FY next = estimated total of this FY.
  // everything the next FY AOP sheet needs (headings, styles, one item row) - used to make it and to add new items to it later
  // ---------- stock file (store inventory: Item Code / Item Name / UM / Qty / Value) - last upload kept on this phone ----------
  const STOCK_KEY = "moltrixAopStock";
  let STOCK = {};
  try { STOCK = JSON.parse(localStorage.getItem(STOCK_KEY) || "{}") || {}; } catch (e) { STOCK = {}; }
  function stockOf(it) {
    if (!STOCK.rows) return null;
    const c = norm(it.code || ""), n = norm(it.name || "");
    const hit = STOCK.rows.filter(r => c ? norm(r.code) === c : (n && norm(r.name) === n));
    return hit.length ? hit.reduce((a, r) => a + (+r.qty || 0), 0) : null;
  }
  function stockShow() {
    const st = $("aovStockSt"); if (!st) return;
    if (STOCK.asOn) $("aovStockDate").value = STOCK.asOn.split("-").reverse().join("-");
    st.innerHTML = STOCK.rows ? `📦 ${STOCK.rows.length} item(s) from <b>${_escH(STOCK.file || "")}</b>, stock as on <b>${_escH(STOCK.asOn || "date not set")}</b> - used for the opening inventory of the next FY AOP.`
      : "No stock file yet - the next FY AOP takes the current stock as 0.";
  }
  $("aovStockBtn").addEventListener("click", () => $("aovStockFile").click());
  $("aovStockDate").addEventListener("change", () => {
    const v = $("aovStockDate").value; if (!STOCK.rows) return;
    STOCK.asOn = v ? v.split("-").reverse().join("-") : ""; try { localStorage.setItem(STOCK_KEY, JSON.stringify(STOCK)); } catch (e) {} stockShow();
  });
  $("aovStockFile").addEventListener("change", async () => {
    const f = $("aovStockFile").files[0]; $("aovStockFile").value = ""; if (!f) return;
    const st = $("aovStockSt");
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      let rows = null;
      for (const sn of wb.SheetNames) {
        const a = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: "" });
        const hi = a.findIndex(r => r.some(c => /item\s*code/i.test(String(c))) && r.some(c => /^\s*qty|quantity/i.test(String(c))));
        if (hi < 0) continue;
        const H = a[hi].map(c => String(c).trim()), col = re => H.findIndex(h => re.test(h));
        const cC = col(/item\s*code/i), cN = col(/item\s*name|description/i), cU = col(/^u\.?o?\.?m$|^unit/i), cQ = col(/^qty|quantity/i), cV = col(/^value|amount/i);
        rows = a.slice(hi + 1).map(r => ({ code: String(r[cC] || "").trim(), name: String(cN >= 0 ? r[cN] : "").replace(/\u00a0/g, " ").trim(),
          um: String(cU >= 0 ? r[cU] : "").trim(), qty: +r[cQ], val: cV >= 0 ? +r[cV] : null })).filter(r => r.code && isFinite(r.qty));
        if (rows.length) break;
      }
      if (!rows || !rows.length) throw new Error("no Item Code / Qty columns found");
      const d = $("aovStockDate").value;
      STOCK = { file: f.name, rows, asOn: d ? d.split("-").reverse().join("-") : "" };
      try { localStorage.setItem(STOCK_KEY, JSON.stringify(STOCK)); } catch (e) {}
      stockShow(); if (R.res) secPdfButtons(R.res);
      if (!STOCK.asOn) st.innerHTML += ` <b style="color:#c0392b">Set the "Stock as on" date.</b>`;
    } catch (e) { st.innerHTML = `<span style="color:#c0392b">Stock file: ${_escH(e.message)}</span>`; }
  });
  stockShow();

  // Next FY AOP (WIP) in the WIP format (AOP_FORMAT_FY_27-28): A-Q per item (quantities), R empty, S-V the value check
  // (next FY budget qty x old / new rate), SUMMARY at the top. Dates come from the data: consumption so far up to the end
  // of its last month, opening the day after.
  function nextAopCtx(res, ws) {
    const n0 = res.fyStart + 1, FY = `${n0}-${n0 + 1}`, PFY = res.fy, cm = res.cm, rest = 12 - cm;
    const fyFrom = (2000 + res.fyStart) * 12 + 3, ml = k => `${MON[k % 12]}-${String(Math.floor(k / 12)).slice(2)}`;
    const soFar = `${ml(fyFrom)} to ${ml(fyFrom + cm - 1)}`, ahead = `${ml(fyFrom + cm)} to ${ml(fyFrom + 11)}`;
    const P = `20${res.fyStart}/${res.fyStart + 1}`, N = `20${n0}/${n0 + 1}`;
    const cutK = fyFrom + cm - 1, cutY = Math.floor(cutK / 12), cutM = cutK % 12, cutD = new Date(cutY, cutM + 1, 0).getDate();
    const opK = cutK + 1, opY = Math.floor(opK / 12), opM = opK % 12, YN = 2000 + n0, febD = new Date(YN, 2, 0).getDate();
    const ord = d => String(d).padStart(2, "0") + ([1, 21, 31].includes(d) ? "st" : [2, 22].includes(d) ? "nd" : [3, 23].includes(d) ? "rd" : "th");
    // headings word for word as in the WIP format file (its dates: Oct cut-off, Nov opening) - the months follow the data
    const cutL = `${ord(cutD)} ${MON[cutM]}-${cutY}`, openL = `${ord(1)} ${MON[opM]}-${opY}`, openS = `01-${MON[opM]}-${opY}`;
    const endS = `31-Mar-${YN}`, endL = `31st March-${YN}`, febL = `${ord(febD)}-Feb-${YN}`;
    const fill = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
    const GREEN = fill("FF92D050"), YELLOW = fill("FFFFFF00"), GREY = fill("FFF2F2F2"), WIPF = fill("FFFCE4D6");
    const thin = { style: "thin", color: { argb: "FF000000" } }, BOX = { top: thin, left: thin, bottom: thin, right: thin };
    const NUM = '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)', NUM0 = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"??_);_(@_)';
    const put = (r, c, v, o) => { o = o || {}; const x = ws.getCell(r, c); x.value = v; x.border = BOX; x.font = { name: "Calibri", size: o.size || 8, bold: !!o.bold };
      if (o.fmt) x.numFmt = o.fmt; if (o.fill) x.fill = o.fill; if (o.wrap || o.align) x.alignment = { wrapText: !!o.wrap, horizontal: o.align, vertical: "middle" }; return x; };
    const f = (formula, result) => ({ formula, result });
    const r2 = v => Math.round(v * 100) / 100, r4 = v => Math.round(v * 1e4) / 1e4;
    const NY = `${n0}/${n0 + 1}`;
    // 22 columns: A-Q, R empty (spacer), S-V - exactly as in the format file
    const HEAD = ["S. No.", "Item Code", "Material Description", "UoM", `Budgeted Consumption Qty FY-${P}`,
      `Total Consumed Qty Till ${cutL}\n FY-${P}\n (A)`, `Assumption\nTotal Expected Consumed Qty ${openS} to ${endS} \n(B)`,
      `Assumption Total Consumed Qty Till ${endS} \n(A+B)`, `Expected Opening Qty Till ${openL}`, `Pending Indent Qty Till ${openS}`,
      `To Be indent Qty. Till ${febL}`, `Total Pending  Indent Qty. Till ${febL}`, `Total Expected Opening Qty Till ${endL}`,
      `Annual Consumption Budget Qty FY-${N}`, `Annual Indent Budget Qty FY-${N}`, `Annual Inventory Budget Qty FY-${N}`, "Remark", null,
      `Actual Consumption FY-${NY}  Value As per Old Rate (Budgeted)`, `Actual Consumption FY-${NY}  Value As per New Rate`, "Diffrence Rate", "% Variation"];
    const WIDTHS = [5.92, 10.09, 43.45, 7.26, 11.7, 17.35, 17.62, 17.62, 15.33, 18.7, 18.7, 18.7, 18.7, 17.35, 15.07, 11.97, 12.38, 1.61, 19.1, 11.3, 11.97, 11.3];
    const NCOL = HEAD.length;
    const L = c => { let s = ""; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = (c - 1 - m) / 26; } return s; };
    const dkey = s => { const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/.exec(String(s || "").trim()); if (!m) return 0;
      const mo = MON.findIndex(x => x.toLowerCase() === m[2].toLowerCase()); let y = +m[3]; if (y < 100) y += 2000; return y * 10000 + (mo + 1) * 100 + +m[1]; };
    const latest = (lines, q, v) => lines.filter(l => l[q] > 0 && l[v] > 0).sort((a, b) => dkey(b.date) - dkey(a.date))[0];
    const newKey = it => it.code ? "C:" + norm(it.code) : "N:" + norm(it.name);
    const secTitle = sec => sec.isNew ? `NEW ITEMS (NOT IN AOP FY ${PFY})` : String(sec.title || "").trim().toUpperCase();
    const isNewLayout = head => /^% Variation$/i.test(String(head[21] || "").trim()) && /^Annual Indent Budget Qty/i.test(String(head[14] || "").trim());
    // one item row at R0 (k = serial no. - 1); returns its money figures for the SUMMARY (E F I N)
    function writeRow(R0, k, r, sec) {
      const it = r.it, svc = /^J/i.test(it.code || "") || /\bSRN\b/i.test(sec.title);
      const iLines = res.lines.filter(l => l.target === it), cLines = res.cLines.filter(l => l.target === it);
      const actual = r2(svc ? (r.a ? r.a.qty : 0) : (r.c ? r.c.qty : 0));
      const G = it.isNew ? 0 : (it.cq || 0);
      const li = latest(cLines, "qty", "val"), ln = latest(iLines, "net", "val");
      let rate = it.isNew ? 0 : it.rate, src = "";
      if (li) { rate = li.val / li.qty; src = `rate: issue ${li.date}`; }
      else if (ln) { rate = ln.val / ln.net; src = `rate: indent ${ln.no}`; }
      rate = r4(rate || 0);
      const Fr = it.isNew ? rate : r4(it.rate || 0);                  // budgeted rate (AOP FY now); a new item has none - its actual rate
      const est = r2(svc ? Math.max(0, G - actual) : (actual > 0 ? actual / cm * rest : Math.max(0, G - actual)));
      const stk = svc ? null : stockOf(it);
      const J = stk === null ? 0 : r4(stk), Np = svc ? 0 : r2(iLines.reduce((s, l) => s + (l.net > 0 ? l.pend : 0), 0));
      const Pp = Math.max(0, est - J - Np), R = Pp + Np, T = J + R - est, V = actual + est;
      const X = r2(V), AB = svc ? 0 : (it.inv || 0), Z = X + AB - T;
      const remark = [it.remark, sec.isNew ? (r.c ? `issued ${soFar}` : `indented ${soFar}`) : "", svc ? `service: ${soFar} from indents` : "", src].filter(Boolean).join("; ");
      const c = { align: "center", wrap: true }, m = Object.assign({ fmt: NUM }, c);
      const sOld = X * Fr, sNew = X * rate, dif = sNew - sOld;
      put(R0, 1, k + 1, { align: "center" }); put(R0, 2, it.code || "-"); put(R0, 3, it.name); put(R0, 4, it.um, { align: "center" });
      put(R0, 5, G, c); put(R0, 6, actual, c); put(R0, 7, est, c);
      put(R0, 8, f(`F${R0}+G${R0}`, V), c);
      put(R0, 9, stk === null ? null : J, c); put(R0, 10, Np, c);
      put(R0, 11, f(`MAX(0,G${R0}-I${R0}-J${R0})`, Pp), c);
      put(R0, 12, f(`K${R0}+J${R0}`, R), c);
      put(R0, 13, f(`(I${R0}+L${R0})-G${R0}`, T), c);
      put(R0, 14, X, c);
      put(R0, 15, f(`(N${R0}+P${R0})-M${R0}`, Z), c);
      put(R0, 16, AB, c);
      put(R0, 17, remark || null, { wrap: true });
      // S-V: next FY budget qty (N) x budgeted rate / x latest rate (the rates sit in the formulas, there is no rate column)
      put(R0, 19, f(`N${R0}*${Fr}`, sOld), m); put(R0, 20, f(`N${R0}*${rate}`, sNew), m);
      put(R0, 21, f(`T${R0}-S${R0}`, dif), m);
      put(R0, 22, f(`IF(S${R0}=0,0,U${R0}/S${R0})`, sOld ? dif / sOld : 0), Object.assign({}, c, { fmt: "0.00%" }));
      return { 5: V * Fr, 6: T * Fr, 9: sNew, 14: AB * rate };
    }
    // section title row: name in A (yellow, as in the format: A-C)
    function titleRow(R0, title) {
      put(R0, 1, title, { size: 14, bold: true, fill: YELLOW, align: "left" });
      put(R0, 2, null, { bold: true, fill: YELLOW, wrap: true, align: "center" }); put(R0, 3, null, { bold: true, fill: YELLOW, wrap: true, align: "center" });
      ws.getRow(R0).height = 19.5;
    }
    function headRow(R0) {
      HEAD.forEach((t, i) => { if (t === null) return; put(R0, i + 1, t, { bold: i < 17, fill: GREEN, wrap: i < 20, align: "center" }); });
      ws.getRow(R0).height = 49.5;
    }
    return { n0, FY, PFY, P, N, cm, rest, soFar, ahead, put, f, r2, L, GREEN, YELLOW, GREY, WIPF, NUM, NUM0, HEAD, WIDTHS, NCOL, newKey, writeRow, titleRow, headRow, secTitle, isNewLayout,
      newRows: sec => sec.rows.filter(r => (r.a && r.a.qty > 0) || r.c) };
  }

  async function nextAop() {
    const res = R.res, st = $("status");
    if (!res || !res.hasCons) { st.className = "err"; st.textContent = "Compare with a consumption file first - the estimate needs it."; return; }
    try {
      st.className = "wait"; st.textContent = "Making the next FY AOP...";
      await psvLoadExcelJs();
      const wb = new ExcelJS.Workbook(); wb.calcProperties.fullCalcOnLoad = true;
      const ws0 = wb.addWorksheet(`QAD-SMS FY-${res.fyStart + 1}-${res.fyStart + 2}`);
      const X = nextAopCtx(res, ws0), ws = ws0;
      const { n0, FY, PFY, P, N, put, f, r2, L, GREEN, YELLOW, GREY, NUM, NUM0 } = X;
      X.WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
      // sections and their rows (new items: only those really indented or issued)
      const secs = res.sections.map(sec => ({ sec, rows: sec.isNew ? X.newRows(sec) : sec.rows }));
      const SR = 4, TOT = SR + secs.length;                         // summary lines, then its Total
      let row = TOT + 3;
      const totals = [];
      let nItems = 0, firstHead = 0;
      secs.forEach(({ sec, rows }) => {
        const title = X.secTitle(sec), tRow = row, hRow = row + 1, first = row + 2;
        X.headRow(hRow); if (!firstHead) firstHead = hRow;
        const sum = { 5: 0, 6: 0, 9: 0, 14: 0 };
        rows.forEach((r, k) => { const s1 = X.writeRow(first + k, k, r, sec); Object.keys(sum).forEach(c => { sum[c] += s1[c]; }); nItems++; });
        const last = first + rows.length - 1;
        X.titleRow(tRow, `QAD-SMS ${title} FY-${N}`);
        totals.push({ sec, title, row: tRow, first, last, sum });
        row = Math.max(last, hRow) + 4;                             // 3 empty rows between sections
      });
      // SUMMARY (as in the format: C Description, D UOM, E Actual Consumption Cost FY now, F Opening inventory value,
      // I Annual Consumption Cost FY next = the section's T column (budget qty x new rate), N Inventory Cost; G H J-M empty)
      put(2, 3, "SUMMARY ", { size: 14, bold: true, fill: YELLOW });
      ws.getRow(2).height = 18.75;
      const SH = { 3: "Description", 4: "UOM", 5: `Actual  Consumption  Cost FY ${PFY}`, 6: `Opening inventory value as on 01-04-20${n0 - 1} `,
        9: `Annual Consumption Cost \nFY-${N}`, 14: ` Inventory Cost \nFY-${P}` };   // word for word as in the format file
      for (let c = 3; c <= 14; c++) put(3, c, SH[c] || null, { bold: true, fill: GREEN, wrap: true, align: "center" });
      ws.getRow(3).height = 54.6;
      const gt = {};
      totals.forEach((t, i) => {
        const r = SR + i;
        const sv = { 5: t.sum[5], 6: t.sum[6], 9: t.sum[9], 14: t.sum[14] };
        Object.keys(sv).forEach(c => { gt[c] = (gt[c] || 0) + sv[c]; });
        put(r, 3, t.title, { bold: true, wrap: true }); put(r, 4, "RS", { align: "center" });
        for (let c = 5; c <= 14; c++) put(r, c, null, { fmt: NUM0, align: "center" });
        put(r, 5, r2(sv[5]), { fmt: NUM0, align: "center" }); put(r, 6, r2(sv[6]), { fmt: NUM0, align: "center" });
        put(r, 9, t.last >= t.first ? f(`SUM(T${t.first}:T${t.last})`, sv[9]) : 0, { fmt: NUM0, align: "center" });
        put(r, 14, r2(sv[14]), { fmt: NUM0, align: "center" });
      });
      put(TOT, 3, "Total", { bold: true, wrap: true }); put(TOT, 4, null, { bold: true, align: "center" });
      for (let c = 5; c <= 14; c++) put(TOT, c, [5, 6, 9, 14].includes(c) ? f(`SUM(${L(c)}${SR}:${L(c)}${TOT - 1})`, gt[c] || 0) : null, { fmt: NUM0, bold: true });
      ws.getRow(TOT).height = 19.15; ws.getRow(TOT + 2).height = 15.75;
      ws.views = [{ state: "frozen", xSplit: 0, ySplit: firstHead, zoomScale: 130 }];
      const buf = await wb.xlsx.writeBuffer();
      // into OneDrive -> AOP -> WIP, then open it in the Next FY AOP tile
      const pre = `${res.fyStart}-${res.fyStart + 1}`;
      const name = nextAopName(res);
      const token = await getToken(); if (!token) return;
      const url = `${AOP_ROOT}/WIP/${encodeURIComponent(name)}:/content`;
      const ex = await fetch(url, { method: "HEAD", headers: { Authorization: "Bearer " + token } }).catch(() => null);
      if (ex && ex.ok && !confirm(`${name} is already in Next FY AOP (WIP). Make it again from these files? Changes saved in that file will be replaced.`)) { st.className = ""; st.textContent = ""; return; }
      const up = await fetch(url, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, body: buf });
      if (!up.ok) throw new Error("OneDrive upload failed (" + up.status + ")");
      try { Object.keys(localStorage).filter(k => k.startsWith("aopwEdits:" + name + ":")).forEach(k => localStorage.removeItem(k)); } catch (e) {}
      await nextAopAddedSave(token, name, X.newRows(res.sections[res.sections.length - 1]).map(r => X.newKey(r.it)));
      const back = document.getElementById("backToAopMenuBtn"), tile = document.querySelector('[data-subaop="next"]');
      if (back) back.click(); if (tile) tile.click();
      if (window._aopWip) { const ab = buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); await window._aopWip.openFile(name, ab); await window._aopWip.listFiles(name, true); }
      let stockNote = "";
      if (STOCK.rows) {
        const have = new Set(); secs.forEach(({ rows }) => rows.forEach(r => { if (r.it.code) have.add(norm(r.it.code)); }));
        const miss = STOCK.rows.filter(x => !have.has(norm(x.code)));
        stockNote = ` Stock as on ${STOCK.asOn || "(date not set)"} used for ${STOCK.rows.length - miss.length} item(s)` +
          (miss.length ? `; ${miss.length} stock item(s) are not in this AOP and were left out: ${miss.map(x => x.name || x.code).join(", ")}.` : ".");
      }
      st.className = "ok"; st.textContent = `${name} made (${nItems} items, WIP format A-Q + S-V) and opened in Next FY AOP (WIP). ✅ Move to final AOP turns it into the final AOP format.` + stockNote;
    } catch (e) { st.className = "err"; st.textContent = "Next FY AOP error: " + e.message; }
  }

  // ---------- Next FY AOP (WIP) kept up to date: items indented / issued for the first time are added to its new-items section ----------
  function nextAopName(res) {
    const FY = `${res.fyStart + 1}-${res.fyStart + 2}`, pre = `${res.fyStart}-${res.fyStart + 1}`;
    return (R.aopName && R.aopName.includes(pre) ? R.aopName.replace(pre, FY) : `AOP_FY_${FY}.xlsx`).replace(/\.xls[xm]?$/i, "") + ".xlsx";
  }
  const addedUrl = name => `${AOP_ROOT}/WIP/${encodeURIComponent(name.replace(/\.xlsx$/i, "") + ".newitems.json")}:/content`;
  async function nextAopAddedLoad(token, name) {
    const r = await fetch(addedUrl(name), { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("list of added items not readable (" + r.status + ")");
    const j = await r.json(); return new Set(j.keys || []);
  }
  async function nextAopAddedSave(token, name, keys) {
    const r = await fetch(addedUrl(name), { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ file: name, keys: [...new Set(keys)], savedAt: new Date().toISOString() }) });
    if (!r.ok) throw new Error("list of added items not saved (" + r.status + ")");
  }
  async function syncNextAop(res) {
    const newSec = res.sections[res.sections.length - 1];
    if (!newSec || !newSec.isNew) return "";
    const token = await getToken(); if (!token) return "";
    const name = nextAopName(res);
    const fr = await fetch(`${AOP_ROOT}/WIP/${encodeURIComponent(name)}:/content`, { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
    if (fr.status === 404) return "";                       // no Next FY AOP (WIP) yet - nothing to update
    if (!fr.ok) throw new Error("WIP file not readable (" + fr.status + ")");
    await psvLoadExcelJs();
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await fr.arrayBuffer());
    const ws = wb.worksheets[0];
    const X = nextAopCtx(res, ws);
    const txt = v => { if (v && typeof v === "object") v = v.richText ? v.richText.map(t => t.text).join("") : (v.result !== undefined ? v.result : v.text); return String(v == null ? "" : v).trim(); };
    const numv = v => { if (v && typeof v === "object") v = v.result; return typeof v === "number" ? v : 0; };
    const isHead = rn => /^s(r)?\.?\s*no/i.test(txt(ws.getCell(rn, 1).value));
    const NEWRE = /NEW ITEMS \(NOT IN AOP/i;
    // what is in the sheet already (any section), and what was added before (deleted ones stay out)
    const have = new Set();
    let title = 0, sr = 0, tot = 0;
    ws.eachRow((rw, rn) => {
      const a = txt(rw.getCell(1).value), code = txt(rw.getCell(2).value), nm = txt(rw.getCell(3).value);
      if (NEWRE.test(a) && isHead(rn + 1)) { title = rn; return; }                       // the new-items section (its heading row follows)
      if (NEWRE.test(nm) && /^rs/i.test(txt(rw.getCell(4).value))) { sr = rn; return; }   // its line in the SUMMARY at the top
      if (/^total$/i.test(nm) && !title && sr && !tot) tot = rn;                          // the SUMMARY total
      if (/^\d+$/.test(a)) { if (code && code !== "-") have.add("C:" + norm(code)); if (nm) have.add("N:" + norm(nm)); }
    });
    let added = await nextAopAddedLoad(token, name);
    const firstTime = !added; if (!added) added = new Set();
    const want = X.newRows(newSec).filter(r => { const k = X.newKey(r.it); return !have.has(k) && !have.has("N:" + norm(r.it.name)) && !added.has(k); });
    if (!want.length) {
      if (firstTime) await nextAopAddedSave(token, name, X.newRows(newSec).map(r => X.newKey(r.it)).filter(k => have.has(k)));
      return "";
    }
    if (!title) throw new Error(`no "NEW ITEMS (NOT IN AOP ...)" section in ${name}`);
    { const hd = []; for (let c = 1; c <= X.NCOL; c++) hd.push(txt(ws.getCell(title + 1, c).value));
      if (!X.isNewLayout(hd)) throw new Error(`${name} is in the old WIP layout - make the Next FY AOP again (new format), then new items get added to it`); }
    const first = title + 2;
    let last = first - 1; while (/^\d+$/.test(txt(ws.getCell(last + 1, 1).value))) last++;
    for (let rn = last + 1; rn <= last + want.length; rn++) for (let c = 1; c <= X.NCOL; c++)
      if (txt(ws.getCell(rn, c).value)) throw new Error(`something is written below the "NEW ITEMS" list (row ${rn}) - not changed, add the items by hand`);
    const k0 = last - first + 1;
    const add = { 5: 0, 6: 0, 9: 0, 14: 0 };
    want.forEach((r, i) => { const s1 = X.writeRow(last + 1 + i, k0 + i, r, newSec); Object.keys(add).forEach(c => { add[c] += s1[c]; }); });
    const nl = last + want.length;
    // its SUMMARY line: E / F / N go up by the new items, I sums its T column (now down to the last new item); then the Total
    if (sr && sr < title) {
      [5, 6, 14].forEach(c => { const x = ws.getCell(sr, c); x.value = X.r2(numv(x.value) + add[c]); });
      let t9 = 0; for (let rn = first; rn <= nl; rn++) t9 += numv(ws.getCell(rn, 20).value);
      ws.getCell(sr, 9).value = { formula: `SUM(T${first}:T${nl})`, result: t9 };
      if (tot) [5, 6, 9, 14].forEach(c => {
        const g = ws.getCell(tot, c).value; if (!g || typeof g !== "object" || !g.formula) return;
        const m = /^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/i.exec(g.formula); if (!m) return;
        let t = 0; for (let q = +m[2]; q <= +m[4]; q++) t += numv(ws.getCell(q, c).value);
        ws.getCell(tot, c).value = { formula: g.formula, result: t };
      });
    }
    wb.calcProperties.fullCalcOnLoad = true;
    const buf = await wb.xlsx.writeBuffer();
    const up = await fetch(`${AOP_ROOT}/WIP/${encodeURIComponent(name)}:/content`, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, body: buf });
    if (!up.ok) throw new Error("OneDrive upload failed (" + up.status + ")");
    want.forEach(r => added.add(X.newKey(r.it)));
    if (firstTime) X.newRows(newSec).forEach(r => { const k = X.newKey(r.it); if (have.has(k)) added.add(k); });
    await nextAopAddedSave(token, name, [...added]);
    // the Next FY AOP tile shows the new version (your unsaved changes there stay - they are kept by cell)
    if (window._aopWip && window._aopWip.S && window._aopWip.S.name === name) {
      const ab = buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      await window._aopWip.openFile(name, ab);
    }
    return `➕ Next FY AOP (${name}): ${want.length} new item(s) added - ${want.map(r => r.it.code || r.it.name).slice(0, 8).join(", ")}${want.length > 8 ? " ..." : ""}`;
  }

  // ---------- Move to final AOP: the WIP sheet becomes the final AOP format (CCM's FY 26-27 sheet: A-Q) ----------
  // two WIP layouts are read (by their headings): the WIP format A-Q + S-V (no rate column - the rates sit in the S / T formulas
  // "N16*rate") and the older CCM WIP layout A-AD (Consumption Rate columns).
  // final: Rate = actual (new) rate, Budgeted Qty FY now, Total Consumed Qty FY now = A+B, Expected Opening Qty March,
  // Annual Consumption Budget Qty, Annual Indent Budget Qty = K+O-I, Annual Inventory Budget Qty, Remark
  const isCcmWip = head => (head.some(h => /^Consumption Rate \(Actual\)$/i.test(h)) || head.some(h => /^% Variation$/i.test(h))) && head.some(h => /^Annual Inventory Budget Qty/i.test(h));
  async function wipToFinal(ab) {
    await psvLoadExcelJs();
    const src = new ExcelJS.Workbook(); await src.xlsx.load(ab);
    const ws = src.worksheets[0];
    const txt = v => { if (v && typeof v === "object") v = v.richText ? v.richText.map(t => t.text).join("") : (v.result !== undefined ? v.result : v.text); return String(v == null ? "" : v).trim(); };
    const numv = v => { if (v && typeof v === "object") v = v.result; return typeof v === "number" && isFinite(v) ? v : (typeof v === "string" && v.trim() !== "" && isFinite(+v) ? +v : 0); };
    const raw = v => (v && typeof v === "object" && v.formula !== undefined) ? (v.result === undefined ? null : v.result) : v;
    const isHead = rn => /^s(r)?\.?\s*no/i.test(txt(ws.getCell(rn, 1).value));
    // the rate written in a "N16*123.45" formula (else value / qty)
    const fRate = (v, qty) => { const m = v && typeof v === "object" && v.formula ? /^\$?N\$?\d+\*([\d.]+(?:E[+-]?\d+)?)$/i.exec(String(v.formula).replace(/\s+/g, "")) : null;
      return m ? +m[1] : (qty ? numv(v) / qty : 0); };
    // the WIP headings tell the years: "Budgeted Consumption Qty FY-2026/27", "Annual Consumption Budget Qty FY-2027/28"
    let P = "", N = "";
    const secs = [], sumLines = [], maxR = ws.rowCount, maxC = Math.min(40, ws.columnCount || 40);   // (getCell past the end adds rows - so the end is fixed first)
    let newLayout = false;
    for (let rn = 1; rn < maxR; rn++) {
      if (!isHead(rn + 1)) continue;
      const head = []; for (let c = 1; c <= maxC; c++) head.push(txt(ws.getCell(rn + 1, c).value));
      if (!isCcmWip(head)) throw new Error("this WIP sheet is not in the WIP layout");
      const col = re => head.findIndex(h => re.test(h)) + 1;          // 1-based, 0 = not there
      const C = { bud: col(/^Budgeted Consumption Qty/i), used: col(/^Assumption Total Consumed Qty Till/i), open: col(/^Total Expected Opening Qty Till .*March/i),
        next: col(/^Annual Consumption Budget Qty/i), inv: col(/^Annual Inventory Budget Qty/i), rem: col(/^Remark$/i),
        rate: col(/^Consumption Rate \(Actual\)$/i), oldR: col(/As per Old Rate/i), newR: col(/As per New Rate/i) };
      if (!C.bud || !C.used || !C.open || !C.next || !C.inv) throw new Error("WIP headings not found (Budgeted / Consumed / Opening / Annual budget qty)");
      if (C.newR) newLayout = true;
      if (!P) { const m1 = /FY-(\d{4}\/\d{2})/.exec(head[C.bud - 1]), m2 = /FY-(\d{4}\/\d{2})/.exec(head[C.next - 1]); P = m1 ? m1[1] : ""; N = m2 ? m2[1] : ""; }
      const title = txt(ws.getCell(rn, 1).value), items = [];
      let budCost = 0;
      for (let k = rn + 2; k <= maxR && /^\d+$/.test(txt(ws.getCell(k, 1).value)); k++) {
        const g = c => c ? ws.getCell(k, c).value : null;
        const q4 = v => Math.round(v * 1e4) / 1e4;
        const next = q4(numv(g(C.next)));
        const rate = C.rate ? q4(numv(g(C.rate))) : q4(fRate(g(C.newR), next));
        const budQty = raw(g(C.bud));
        if (C.oldR) budCost += numv(budQty) * fRate(g(C.oldR), next);
        items.push({ code: txt(g(2)), name: txt(g(3)), um: txt(g(4)), rate, budQty, used: q4(numv(g(C.used))), open: q4(numv(g(C.open))),
          next, inv: q4(numv(g(C.inv))), remark: C.rem ? txt(g(C.rem)) : "" });
      }
      secs.push({ title, items, budCost });
    }
    if (!secs.length) throw new Error("no sections found");
    // SUMMARY lines (Description / RS) in the same order as the sections; the Budget Cost: old layout - its column F,
    // WIP format - budgeted qty x budgeted rate of the section's items
    for (let rn = 1; rn < maxR && sumLines.length < secs.length; rn++) if (/^rs$/i.test(txt(ws.getCell(rn, 4).value)))
      sumLines.push({ desc: txt(ws.getCell(rn, 3).value), budget: newLayout ? Math.round(secs[sumLines.length].budCost) : numv(ws.getCell(rn, 6).value) });
    const yS = P ? +P.slice(2, 4) : 0, yN = N ? +N.slice(2, 4) : yS + 1, PFY = `${yS}-${yS + 1}`;
    const wb = new ExcelJS.Workbook(); wb.calcProperties.fullCalcOnLoad = true;
    const out = wb.addWorksheet(ws.name);
    const fill = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
    const GREEN = fill("FF92D050"), YELLOW = fill("FFFFFF00");
    const thin = { style: "thin", color: { argb: "FF000000" } }, BOX = { top: thin, left: thin, bottom: thin, right: thin };
    const NUM = '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)', NUM0 = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"??_);_(@_)';
    const put = (r, c, v, o) => { o = o || {}; const x = out.getCell(r, c); x.value = v; x.border = BOX; x.font = { name: "Calibri", size: o.size || 8, bold: !!o.bold };
      if (o.fmt) x.numFmt = o.fmt; if (o.fill) x.fill = o.fill; if (o.wrap || o.align) x.alignment = { wrapText: !!o.wrap, horizontal: o.align, vertical: "middle" }; return x; };
    const f = (formula, result) => ({ formula, result });
    [5.9, 10.1, 43.4, 7.3, 11, 13, 13, 15, 14, 15, 14, 15, 14, 15, 14, 15, 24].forEach((w, i) => { out.getColumn(i + 1).width = w; });
    const HEAD = ["S.\nNo.", "Item code", "Material Description", "Uom", "Consumption Rate", `Budgeted  Consumption Qty\nFY-${P}`, `Total Consumed Qty FY-${P}`,
      `Total Consumed Cost \nFY-${P}`, `Total Expected Opening Qty Till March-20${yN}`, `Total Expected Opening Qty Cost Till March-20${yN}`,
      `Annual Consumption Budget Qty \nFY-${N}`, `Annual Consumption Budget Cost \nFY-${N}`, `Annual Indent Budget QTY\n FY-${N}`, `Annual Indent Budget Cost\n FY-${N}`,
      `Annual Inventory Budget Qty\n FY-${N}`, `Annual Inventory Budget Cost\n FY-${N}`, "Remark"];
    const SR = 4, TOT = SR + secs.length;
    let row = TOT + 3, firstHead = 0;
    const tot = [];
    secs.forEach(sec => {
      const t = row, h = row + 1, first = row + 2; if (!firstHead) firstHead = h;
      HEAD.forEach((x, i) => put(h, i + 1, x, { bold: true, fill: GREEN, wrap: true, align: "center" })); out.getRow(h).height = 56.25;
      const s = { 8: 0, 10: 0, 12: 0, 14: 0, 16: 0 };
      sec.items.forEach((it, k) => {
        const r = first + k, c = { align: "center", wrap: true }, E = it.rate, I = it.open, K = it.next, O = it.inv, M = K + O - I;
        put(r, 1, k + 1, { align: "center" }); put(r, 2, it.code || "-"); put(r, 3, it.name); put(r, 4, it.um, { align: "center" });
        put(r, 5, E, c); put(r, 6, it.budQty, c); put(r, 7, it.used, c); put(r, 8, f(`G${r}*E${r}`, it.used * E), Object.assign({ fmt: NUM }, c));
        put(r, 9, I, c); put(r, 10, f(`I${r}*E${r}`, I * E), Object.assign({ fmt: NUM }, c));
        put(r, 11, K, c); put(r, 12, f(`K${r}*E${r}`, K * E), Object.assign({ fmt: NUM }, c));
        put(r, 13, f(`K${r}+O${r}-I${r}`, M), c); put(r, 14, f(`M${r}*E${r}`, M * E), Object.assign({ fmt: NUM }, c));
        put(r, 15, O, c); put(r, 16, f(`O${r}*E${r}`, O * E), Object.assign({ fmt: NUM }, c));
        put(r, 17, it.remark || null, { wrap: true }); out.getRow(r).height = 14.45;
        s[8] += it.used * E; s[10] += I * E; s[12] += K * E; s[14] += M * E; s[16] += O * E;
      });
      const last = first + sec.items.length - 1;
      put(t, 1, sec.title, { size: 14, bold: true, fill: YELLOW, align: "left" });
      [8, 10, 12, 14, 16].forEach(c => { const Lc = String.fromCharCode(64 + c); put(t, c, last >= first ? f(`SUM(${Lc}${first}:${Lc}${last})`, s[c]) : 0, { size: 11, bold: true, fmt: NUM, align: "center" }); });
      out.getRow(t).height = 19.5;
      tot.push({ t, s });
      row = Math.max(last, h) + 4;
    });
    put(2, 3, "SUMMARY ", { size: 14, bold: true, fill: YELLOW });
    const SH = { 3: "Description", 4: "UOM", 5: `Budget Cost \nFY-${P}`, 6: `Actual  Consumption  Cost FY ${PFY}`, 7: `Opening inventory value as on 01-04-20${yN} `,
      8: `Monthly Consumption Cost \nFY-${N}`, 9: `Annual Consumption Cost \nFY-${N}`, 10: ` Annual Indent  Cost FY-${N}`, 11: ` Inventory Cost \nFY-${N}` };
    Object.keys(SH).forEach(c => put(3, +c, SH[c], { bold: true, fill: GREEN, wrap: true, align: "center" })); out.getRow(3).height = 54.6;
    const gt = {};
    secs.forEach((sec, i) => {
      const r = SR + i, T = tot[i], sl = sumLines[i] || { desc: sec.title, budget: 0 };
      const v = { 5: sl.budget, 6: T.s[8], 7: T.s[10], 8: T.s[12] / 12, 9: T.s[12], 10: T.s[14], 11: T.s[16] };
      Object.keys(v).forEach(c => { gt[c] = (gt[c] || 0) + v[c]; });
      put(r, 3, sl.desc, { wrap: true }); put(r, 4, "RS"); put(r, 5, sl.budget, { fmt: NUM0 });
      put(r, 6, f(`H${T.t}`, v[6]), { fmt: NUM0 }); put(r, 7, f(`J${T.t}`, v[7]), { fmt: NUM0 }); put(r, 8, f(`I${r}/12`, v[8]), { fmt: NUM0 });
      put(r, 9, f(`L${T.t}`, v[9]), { fmt: NUM0 }); put(r, 10, f(`N${T.t}`, v[10]), { fmt: NUM0 }); put(r, 11, f(`P${T.t}`, v[11]), { fmt: NUM0 });
    });
    put(TOT, 3, "Total", { bold: true });
    for (let c = 5; c <= 11; c++) { const Lc = String.fromCharCode(64 + c); put(TOT, c, f(`SUM(${Lc}${SR}:${Lc}${TOT - 1})`, gt[c] || 0), { fmt: NUM0, bold: true }); }
    out.views = [{ state: "frozen", xSplit: 0, ySplit: firstHead }];
    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  window._wipToFinal = { isCcmWip, wipToFinal };

  /* ---------- PDF: one section (Consumables, Central Store, Minimax ...) per PDF, big clear print ---------- */
  function secPdf(si) {
    const res = R.res, st = $("status");
    if (!res) { st.className = "err"; st.textContent = "Press ⚖️ Compare first."; return; }
    const sec = res.sections[si]; if (!sec) return;
    try {
      const rows = sec.isNew ? sec.rows.filter(isActive) : sec.rows;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), M = 30;
      const NAVY = [31, 56, 100], GOLD = [201, 162, 39], INK = [30, 34, 45], MUTED = [105, 112, 125];
      const RED = [176, 32, 32], GRN = [24, 120, 60], REDBG = [253, 228, 226], GRNBG = [226, 243, 232], LOOKBG = [255, 246, 245];
      const pctv = (a, b) => b ? a / b * 100 : null, pcts = (a, b) => b ? (a / b * 100).toFixed(1) + "%" : "-";
      // the PDF font has no emoji / rupee sign
      const L1 = v => String(v == null ? "" : v).replace(/⚠️?/g, "Check:").replace(/₹\s*/g, "Rs ").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
      const title = L1(sec.isNew ? "New items (not in AOP)" : sec.title);
      const what = res.hasInd && res.hasCons ? "Indent & Consumption" : (res.hasCons ? "Consumption" : "Indent");
      let y = 72;
      // ---- section heading + what was compared
      doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...NAVY); doc.text(title, M, y + 4);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...MUTED);
      const info = [`${res.dept}  |  AOP FY ${res.fy}`,
        res.hasInd ? `Indents: ${res.period || "-"}` : "", res.hasCons ? `Consumption: ${res.cPeriod}` : ""].filter(Boolean).join("   |   ");
      doc.text(info, M, y + 22);
      y += 40;
      // ---- KPI cards
      const t = sec.tot, cards = [];
      if (res.hasInd) cards.push({ h: "INDENT vs AOP", big: t.val, of: t.cost, p: pctv(t.val, t.cost), lines: [`AOP indent cost  Rs ${fmt(t.cost)}`, `Balance  Rs ${fmt(t.cost - t.val)}`, `${t.n} indent line(s)${sec.indentBudget ? "" : "  (consumption budget)"}`] });
      if (res.hasCons) { const pr = t.cc * res.cm / 12;
        cards.push({ h: "CONSUMPTION vs AOP", big: t.cv, of: t.cc, p: pctv(t.cv, t.cc), over: t.cv > pr + 0.5, lines: [`AOP consumption cost  Rs ${fmt(t.cc)}`, `Pro-rata (${res.cm}/12)  Rs ${fmt(pr)}`, `${t.cn} issue line(s)`] }); }
      const nLook = rows.filter(needsLook).length, nAct = rows.filter(isActive).length;
      cards.push({ h: "ITEMS", count: true, lines: [`${rows.length} item(s) in this section`, `${nAct} indented / consumed`, `${rows.length - nAct} not indented / consumed yet`], look: nLook });
      const gap = 12, cw = (pw - 2 * M - gap * (cards.length - 1)) / cards.length, chh = 102;
      cards.forEach((c, i) => {
        const x = M + i * (cw + gap);
        doc.setFillColor(246, 248, 252); doc.setDrawColor(214, 220, 232); doc.setLineWidth(0.8); doc.roundedRect(x, y, cw, chh, 8, 8, "FD");
        doc.setFillColor(...GOLD); doc.rect(x, y + 10, 3.5, chh - 20, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...MUTED); doc.text(c.h, x + 14, y + 18);
        if (c.count) {
          doc.setFontSize(22); doc.setTextColor(...(c.look ? RED : GRN)); doc.text(String(c.look), x + 14, y + 44);
          const nw = doc.getTextWidth(String(c.look));
          doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...INK); doc.text(c.look === 1 ? "item needs a look" : "items need a look", x + 14 + nw + 6, y + 44);
        } else {
          doc.setFontSize(19); doc.setTextColor(...NAVY); doc.text("Rs " + fmt(c.big), x + 14, y + 42);
          const ptxt = c.p === null ? "" : c.p.toFixed(1) + "%";
          doc.setFontSize(12); doc.setTextColor(...((c.p !== null && c.p > 100) || c.over ? RED : GRN)); doc.text(ptxt, x + cw - 14, y + 42, { align: "right" });
          // progress bar
          const bx = x + 14, bw = cw - 28, by = y + 50;
          doc.setFillColor(225, 230, 240); doc.roundedRect(bx, by, bw, 6, 3, 3, "F");
          if (c.p !== null && c.p > 0) { doc.setFillColor(...(c.p > 100 || c.over ? RED : GOLD)); doc.roundedRect(bx, by, Math.max(6, bw * Math.min(c.p, 100) / 100), 6, 3, 3, "F"); }
        }
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.2); doc.setTextColor(...INK);
        c.lines.forEach((l, k) => doc.text(l, x + 14, y + (c.count ? 60 : 69) + k * 11.5));
      });
      y += chh + 18;
      // ---- item table
      const head1 = [{ content: "#", rowSpan: 2 }, { content: "Item", rowSpan: 2 }, { content: "AOP\nrate", rowSpan: 2 }];
      const head2 = [];
      if (res.hasInd) { head1.push({ content: "INDENT", colSpan: 4 }); head2.push("AOP cost", "Indented", "Indent rate", "Status"); }
      if (res.hasCons) { head1.push({ content: "CONSUMPTION", colSpan: 5 }); head2.push("AOP cost", "Qty", "Consumed", "Issue rate", "Status"); }
      const rate = (v, d) => v === null ? "" : fmt(v, 2) + (d === null || Math.abs(d) < 0.005 ? "" : `\n(${d > 0 ? "+" : ""}${fmt(d, 2)})`);
      const body = [], meta = [];
      rows.forEach((r, i) => {
        const it = r.it;
        const line = [String(i + 1), `${L1(it.name)}\n${L1(it.code || "no code")}${it.um ? "  |  " + L1(it.um) : ""}`, it.isNew ? "-" : fmt(it.rate, 2)];
        if (res.hasInd) line.push(fmt(it.cost) || "-", r.iv === null ? "" : fmt(r.iv), rate(r.ir, r.id), r.status || "");
        if (res.hasCons) line.push(fmt(it.cc) || "-", r.cqv === null ? "" : fmt(r.cqv, 2), r.cvv === null ? "" : fmt(r.cvv), rate(r.cr, r.cd), r.cstatus || "");
        body.push(line); meta.push({ r, kind: "item" });
        if (r.remark && needsLook(r)) { body.push([{ content: "Note: " + L1(r.remark), colSpan: line.length }]); meta.push({ r, kind: "note" }); }
      });
      const ncol = 3 + (res.hasInd ? 4 : 0) + (res.hasCons ? 5 : 0);
      const tot = new Array(ncol).fill(""); tot[1] = "TOTAL";
      let c0 = 3;
      if (res.hasInd) { tot[c0] = fmt(t.cost); tot[c0 + 1] = fmt(t.val); c0 += 4; }
      if (res.hasCons) { tot[c0] = fmt(t.cc); tot[c0 + 2] = fmt(t.cv); }
      body.push(tot); meta.push({ kind: "total" });
      // column widths: item gets what is left
      const cs = { 0: { cellWidth: 20, halign: "center" }, 2: { cellWidth: 50 } };
      let ci = 3; const W = { cost: 62, val: 62, rate: 62, st: 74, qty: 52 };
      if (res.hasInd) { cs[ci++] = { cellWidth: W.cost }; cs[ci++] = { cellWidth: W.val }; cs[ci++] = { cellWidth: W.rate }; cs[ci++] = { cellWidth: W.st, halign: "center" }; }
      if (res.hasCons) { cs[ci++] = { cellWidth: W.cost }; cs[ci++] = { cellWidth: W.qty }; cs[ci++] = { cellWidth: W.val }; cs[ci++] = { cellWidth: W.rate }; cs[ci++] = { cellWidth: W.st, halign: "center" }; }
      const used = Object.values(cs).reduce((s, c) => s + c.cellWidth, 0);
      cs[1] = { cellWidth: Math.max(140, pw - 2 * M - used), halign: "left" };
      const stCols = [], rateCols = [];
      ci = 3; if (res.hasInd) { rateCols.push(ci + 2); stCols.push(ci + 3); ci += 4; } if (res.hasCons) { rateCols.push(ci + 3); stCols.push(ci + 4); }
      doc.autoTable({
        startY: y, head: [head1, head2], body, theme: "grid", columnStyles: cs, showHead: "everyPage", rowPageBreak: "avoid",
        margin: { left: M, right: M, top: 70, bottom: 40 },
        styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }, halign: "right", valign: "middle", textColor: INK, lineColor: [205, 211, 222], lineWidth: 0.5, overflow: "linebreak" },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", halign: "center", fontSize: 9, lineColor: [70, 92, 135] },
        alternateRowStyles: { fillColor: [249, 250, 253] },
        didParseCell: d => {
          if (d.section === "head" && d.row.index === 0 && /INDENT|CONSUMPTION/.test(String(d.cell.raw && d.cell.raw.content || ""))) d.cell.styles.fillColor = [44, 76, 130];
          if (d.section !== "body") return;
          const m = meta[d.row.index]; if (!m) return;
          if (m.kind === "total") { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [248, 241, 218]; d.cell.styles.fontSize = 9.8; return; }
          if (m.kind === "note") { d.cell.styles.halign = "left"; d.cell.styles.fontStyle = "italic"; d.cell.styles.fontSize = 8; d.cell.styles.textColor = [120, 72, 20]; d.cell.styles.fillColor = LOOKBG; d.cell.styles.cellPadding = { top: 2, bottom: 4, left: 26, right: 4 }; return; }
          if (needsLook(m.r)) d.cell.styles.fillColor = LOOKBG;
          const raw = String(d.cell.raw == null ? "" : d.cell.raw);
          if (d.column.index === 1) d.cell.styles.fontStyle = "bold";
          if (stCols.includes(d.column.index) && raw) {
            const badS = isBad(raw), okS = /Within/.test(raw);
            d.cell.styles.fontSize = 8.2; d.cell.styles.fontStyle = "bold";
            d.cell.styles.textColor = badS ? RED : (okS ? GRN : MUTED); d.cell.styles.fillColor = badS ? REDBG : (okS ? GRNBG : d.cell.styles.fillColor);
          }
          if (rateCols.includes(d.column.index)) { const dd = d.column.index === rateCols[0] && res.hasInd ? m.r.id : m.r.cd; if (dd !== null && dd > 0.005) d.cell.styles.textColor = RED; else if (dd !== null && dd < -0.005) d.cell.styles.textColor = GRN; }
        },
        didDrawCell: d => {   // item name bold, code / UM smaller and grey on the second line
          if (d.section !== "body" || d.column.index !== 1) return;
          const m = meta[d.row.index]; if (!m || m.kind !== "item") return;
          const [nm, sub] = String(d.cell.raw).split("\n");
          const fill = d.cell.styles.fillColor; doc.setFillColor(...(Array.isArray(fill) ? fill : [255, 255, 255]));
          doc.rect(d.cell.x + 0.5, d.cell.y + 0.5, d.cell.width - 1, d.cell.height - 1, "F");
          doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...INK);
          const lines = doc.splitTextToSize(nm, d.cell.width - 8);
          let ty = d.cell.y + 11; lines.forEach(l => { doc.text(l, d.cell.x + 4, ty); ty += 10.5; });
          doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(...MUTED); doc.text(sub || "", d.cell.x + 4, ty);
        }
      });
      // ---- header / footer on every page
      const n = doc.internal.getNumberOfPages(), today = new Date().toLocaleDateString("en-GB");
      for (let p = 1; p <= n; p++) {
        doc.setPage(p);
        coDrawLogo(doc, M, 14, 140, 32);
        doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NAVY); doc.text(`AOP FY ${res.fy} vs ${what}`, pw / 2, 28, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...MUTED); doc.text(p === 1 ? res.dept : `${title}  |  ${res.dept}`, pw / 2, 43, { align: "center" });
        if (COMPANY.name) { doc.setFontSize(9); doc.text(COMPANY.name, pw - M, 26, { align: "right" }); }
        doc.setDrawColor(...GOLD); doc.setLineWidth(1.2); doc.line(M, 54, pw - M, 54);
        doc.setDrawColor(220, 224, 232); doc.setLineWidth(0.6); doc.line(M, ph - 30, pw - M, ph - 30);
        doc.setFontSize(8.5); doc.setTextColor(...MUTED);
        doc.text(`Generated ${today}   |   red = over AOP / costlier than the AOP rate, green = within / cheaper   |   Rs = Indian rupees`, M, ph - 16);
        doc.text(`Page ${p} of ${n}`, pw - M, ph - 16, { align: "right" });
      }
      const safe = title.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
      showPdfPreview(doc, `AOP_FY${res.fy}_${safe}_vs_${what.replace(/ & /, "_")}.pdf`, `${title} - AOP vs ${what}`);
      st.className = "ok"; st.textContent = `PDF ready: ${title}.`;
    } catch (e) { st.className = "err"; st.textContent = "PDF error: " + e.message; }
  }
  /* ---------- PDF: Summary - Indent vs AOP and Consumption vs AOP, category-wise ---------- */
  function sumPdf() {
    const res = R.res, st = $("status");
    if (!res) { st.className = "err"; st.textContent = "Press ⚖️ Compare first."; return; }
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), M = 30;
      const NAVY = [31, 56, 100], GOLD = [201, 162, 39], INK = [30, 34, 45], MUTED = [105, 112, 125], RED = [176, 32, 32], GRN = [24, 120, 60];
      const L1 = v => String(v == null ? "" : v).replace(/⚠️?/g, "Check:").replace(/₹\s*/g, "Rs ").replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
      const pctv = (a, b) => b ? a / b * 100 : null;
      const what = res.hasInd && res.hasCons ? "Indent & Consumption" : (res.hasCons ? "Consumption" : "Indent");
      const secName = s => L1(s.isNew ? "New items (not in AOP)" : s.title);
      let y = 72;
      doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...NAVY); doc.text("Summary", M, y + 4);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...MUTED);
      doc.text([`${res.dept}  |  AOP FY ${res.fy}`, res.hasInd ? `Indents: ${res.period || "-"}` : "", res.hasCons ? `Consumption: ${res.cPeriod}` : ""].filter(Boolean).join("   |   "), M, y + 22);
      y += 40;
      // ---- overall cards
      const inTot = res.sections.filter(s => s.indentBudget), info = res.sections.filter(s => !s.indentBudget);
      const TI = inTot.reduce((s, x) => ({ cost: s.cost + x.tot.cost, val: s.val + x.tot.val, n: s.n + x.tot.n }), { cost: 0, val: 0, n: 0 });
      const cSecs = res.sections.filter(s => s.hasCons || s.tot.cv);
      const TC = cSecs.reduce((s, x) => ({ cc: s.cc + x.tot.cc, cv: s.cv + x.tot.cv, cn: s.cn + x.tot.cn }), { cc: 0, cv: 0, cn: 0 });
      const all = [].concat(...res.sections.map(s => s.rows)), nLook = all.filter(needsLook).length;
      const cards = [];
      if (res.hasInd) cards.push({ h: "INDENT vs AOP (total)", big: TI.val, p: pctv(TI.val, TI.cost), lines: [`AOP indent cost  Rs ${fmt(TI.cost)}`, `Balance  Rs ${fmt(TI.cost - TI.val)}`, `${TI.n} indent line(s)`] });
      if (res.hasCons) { const pr = TC.cc * res.cm / 12; cards.push({ h: "CONSUMPTION vs AOP (total)", big: TC.cv, p: pctv(TC.cv, TC.cc), over: TC.cv > pr + 0.5, lines: [`AOP consumption cost  Rs ${fmt(TC.cc)}`, `Pro-rata (${res.cm}/12)  Rs ${fmt(pr)}`, `${TC.cn} issue line(s)`] }); }
      cards.push({ h: "ITEMS", count: nLook, lines: [`${all.length} item(s) in ${res.sections.length} categories`, `${all.filter(isActive).length} indented / consumed`, res.hasInd ? `${all.filter(r => r.status === "Not indented yet").length} not indented yet` : `${all.filter(r => r.cstatus === "Not consumed yet").length} not consumed yet`] });
      const gap = 12, cw = (pw - 2 * M - gap * (cards.length - 1)) / cards.length, chh = 102;
      cards.forEach((c, i) => {
        const x = M + i * (cw + gap);
        doc.setFillColor(246, 248, 252); doc.setDrawColor(214, 220, 232); doc.setLineWidth(0.8); doc.roundedRect(x, y, cw, chh, 8, 8, "FD");
        doc.setFillColor(...GOLD); doc.rect(x, y + 10, 3.5, chh - 20, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...MUTED); doc.text(c.h, x + 14, y + 18);
        if (c.count !== undefined) {
          doc.setFontSize(22); doc.setTextColor(...(c.count ? RED : GRN)); doc.text(String(c.count), x + 14, y + 44);
          const nw = doc.getTextWidth(String(c.count));
          doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...INK); doc.text(c.count === 1 ? "item needs a look" : "items need a look", x + 20 + nw, y + 44);
        } else {
          doc.setFontSize(19); doc.setTextColor(...NAVY); doc.text("Rs " + fmt(c.big), x + 14, y + 42);
          const bad = (c.p !== null && c.p > 100) || c.over;
          doc.setFontSize(12); doc.setTextColor(...(bad ? RED : GRN)); doc.text(c.p === null ? "" : c.p.toFixed(1) + "%", x + cw - 14, y + 42, { align: "right" });
          doc.setFillColor(225, 230, 240); doc.roundedRect(x + 14, y + 50, cw - 28, 6, 3, 3, "F");
          if (c.p) { doc.setFillColor(...(bad ? RED : GOLD)); doc.roundedRect(x + 14, y + 50, Math.max(6, (cw - 28) * Math.min(c.p, 100) / 100), 6, 3, 3, "F"); }
        }
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.2); doc.setTextColor(...INK);
        c.lines.forEach((l, k) => doc.text(l, x + 14, y + (c.count !== undefined ? 60 : 69) + k * 11.5));
      });
      y += chh + 22;
      // ---- tables
      const base = { theme: "grid", showHead: "everyPage", rowPageBreak: "avoid", margin: { left: M, right: M, top: 70, bottom: 40 },
        styles: { font: "helvetica", fontSize: 10, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 }, halign: "right", valign: "middle", textColor: INK, lineColor: [205, 211, 222], lineWidth: 0.5 },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", halign: "center", fontSize: 9.8 }, alternateRowStyles: { fillColor: [249, 250, 253] } };
      const heading = t => { if (y > ph - 140) { doc.addPage(); y = 76; }
        doc.setFillColor(...GOLD); doc.rect(M, y - 12, 4, 17, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY); doc.text(t, M + 12, y + 1); y += 12; };
      const bar = (d, p, bad) => {   // a small progress bar under the % in the "% used" column
        const bx = d.cell.x + 8, bw = d.cell.width - 16, by = d.cell.y + d.cell.height - 9;
        doc.setFillColor(225, 230, 240); doc.roundedRect(bx, by, bw, 4, 2, 2, "F");
        if (p) { doc.setFillColor(...(bad ? RED : GOLD)); doc.roundedRect(bx, by, Math.max(4, bw * Math.min(p, 100) / 100), 4, 2, 2, "F"); }
      };
      if (res.hasInd) {
        heading(`Indent vs AOP  -  FY ${res.fy}`);
        const meta = [], body = [];
        const add = (s, t, kind) => { const p = pctv(t.val, t.cost); body.push([kind === "total" ? "TOTAL" : (kind === "info" ? secName(s) + "\n(consumption budget - not in total)" : secName(s)), fmt(t.cost), fmt(t.val), fmt(t.cost - t.val), p === null ? "-" : p.toFixed(1) + "%", fmt(t.cost * res.months / 12), String(t.n)]); meta.push({ kind, p, bad: p !== null && p > 100 }); };
        inTot.forEach(s => add(s, s.tot, "sec")); add(null, TI, "total"); info.forEach(s => add(s, s.tot, "info"));
        doc.autoTable(Object.assign({}, base, { startY: y, head: [["Category", "AOP indent cost (Rs)", "Indented (Rs)", "Balance (Rs)", "% used", `AOP pro-rata ${res.months}/12 (Rs)`, "Indent lines"]], body,
          columnStyles: { 0: { halign: "left", cellWidth: 210, fontStyle: "bold" }, 4: { cellWidth: 80, halign: "center" }, 6: { cellWidth: 70, halign: "center" } },
          didParseCell: d => { if (d.section !== "body") return; const m = meta[d.row.index];
            if (m.kind === "total") { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [248, 241, 218]; d.cell.styles.fontSize = 10.5; }
            if (m.kind === "info") { d.cell.styles.textColor = MUTED; d.cell.styles.fontStyle = d.column.index ? "italic" : "bold"; }
            if (d.column.index === 3 && /^-/.test(String(d.cell.raw))) d.cell.styles.textColor = RED;
            if (d.column.index === 4) { d.cell.styles.textColor = m.bad ? RED : (m.p !== null ? GRN : MUTED); d.cell.styles.fontStyle = "bold"; d.cell.styles.cellPadding = { top: 4, bottom: 12, left: 6, right: 6 }; } },
          didDrawCell: d => { if (d.section === "body" && d.column.index === 4) { const m = meta[d.row.index]; if (m.p !== null) bar(d, m.p, m.bad); } } }));
        y = doc.lastAutoTable.finalY + 30;
      }
      if (res.hasCons) {
        heading(`Consumption vs AOP  -  FY ${res.fy}`);
        const meta = [], body = [];
        const add = (s, t, kind) => { const p = pctv(t.cv, t.cc), pr = t.cc * res.cm / 12, dv = t.cv - pr;
          body.push([kind === "total" ? "TOTAL" : secName(s), fmt(t.cc), fmt(t.cv), fmt(t.cc - t.cv), p === null ? "-" : p.toFixed(1) + "%", fmt(pr), (dv > 0.5 ? "+" : "") + fmt(dv), String(t.cn)]);
          meta.push({ kind, p, bad: (p !== null && p > 100) || dv > 0.5, dv }); };
        cSecs.forEach(s => add(s, s.tot, "sec")); add(null, TC, "total");
        doc.autoTable(Object.assign({}, base, { startY: y, head: [["Category", "AOP consumption cost (Rs)", "Consumed (Rs)", "Balance (Rs)", "% used", `AOP pro-rata ${res.cm}/12 (Rs)`, "Consumed vs pro-rata (Rs)", "Issue lines"]], body,
          columnStyles: { 0: { halign: "left", cellWidth: 190, fontStyle: "bold" }, 4: { cellWidth: 74, halign: "center" }, 7: { cellWidth: 62, halign: "center" } },
          didParseCell: d => { if (d.section !== "body") return; const m = meta[d.row.index];
            if (m.kind === "total") { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [248, 241, 218]; d.cell.styles.fontSize = 10.5; }
            if (d.column.index === 3 && /^-/.test(String(d.cell.raw))) d.cell.styles.textColor = RED;
            if (d.column.index === 6) { d.cell.styles.textColor = m.dv > 0.5 ? RED : GRN; d.cell.styles.fontStyle = "bold"; }
            if (d.column.index === 4) { d.cell.styles.textColor = m.bad ? RED : (m.p !== null ? GRN : MUTED); d.cell.styles.fontStyle = "bold"; d.cell.styles.cellPadding = { top: 4, bottom: 12, left: 6, right: 6 }; } },
          didDrawCell: d => { if (d.section === "body" && d.column.index === 4) { const m = meta[d.row.index]; if (m.p !== null) bar(d, m.p, m.bad); } } }));
        y = doc.lastAutoTable.finalY + 30;
      }
      // ---- items per category
      heading("Items per category");
      const ib = res.sections.map(s => { const rws = s.isNew ? s.rows.filter(isActive) : s.rows;
        return [secName(s), String(rws.length), String(rws.filter(isActive).length), String(rws.filter(needsLook).length)]; });
      doc.autoTable(Object.assign({}, base, { startY: y, head: [["Category", "Items", "Indented / consumed", "Need a look"]], body: ib, tableWidth: 520,
        columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 220 }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } },
        didParseCell: d => { if (d.section === "body" && d.column.index === 3) { const n = +d.cell.raw; d.cell.styles.textColor = n ? RED : GRN; d.cell.styles.fontStyle = "bold"; } } }));
      // ---- header / footer
      const n = doc.internal.getNumberOfPages(), today = new Date().toLocaleDateString("en-GB");
      for (let p = 1; p <= n; p++) {
        doc.setPage(p);
        coDrawLogo(doc, M, 14, 140, 32);
        doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NAVY); doc.text(`AOP FY ${res.fy} vs ${what}`, pw / 2, 28, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...MUTED); doc.text(p === 1 ? res.dept : `Summary  |  ${res.dept}`, pw / 2, 43, { align: "center" });
        if (COMPANY.name) { doc.setFontSize(9); doc.text(COMPANY.name, pw - M, 26, { align: "right" }); }
        doc.setDrawColor(...GOLD); doc.setLineWidth(1.2); doc.line(M, 54, pw - M, 54);
        doc.setDrawColor(220, 224, 232); doc.setLineWidth(0.6); doc.line(M, ph - 30, pw - M, ph - 30);
        doc.setFontSize(8.5); doc.setTextColor(...MUTED);
        doc.text(`Generated ${today}   |   red = over AOP / above pro-rata, green = within   |   Rs = Indian rupees`, M, ph - 16);
        doc.text(`Page ${p} of ${n}`, pw - M, ph - 16, { align: "right" });
      }
      showPdfPreview(doc, `AOP_FY${res.fy}_Summary_vs_${what.replace(/ & /, "_")}.pdf`, `Summary - AOP vs ${what}`);
      st.className = "ok"; st.textContent = "PDF ready: Summary.";
    } catch (e) { st.className = "err"; st.textContent = "PDF error: " + e.message; }
  }
  /* ---------- PDF: Indent / Requisition balance - item-wise, what is still left of the AOP to indent and to issue ---------- */
  function balPdf() {
    const res = R.res, st = $("status");
    if (!res) { st.className = "err"; st.textContent = "Press ⚖️ Compare first."; return; }
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), M = 30;
      const NAVY = [31, 56, 100], GOLD = [201, 162, 39], INK = [30, 34, 45], MUTED = [105, 112, 125], RED = [176, 32, 32], GRN = [24, 120, 60];
      const L1 = v => String(v == null ? "" : v).replace(/⚠️?/g, "Check:").replace(/₹\s*/g, "Rs ").replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
      const n0 = v => (v === null || v === undefined || v === "" || isNaN(v)) ? 0 : +v;
      const q2 = v => fmt(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 2);
      const hasI = res.hasInd, hasC = res.hasCons;
      // per item balances: qty = AOP qty - done qty, Rs = AOP cost - done value
      const secs = res.sections.map(s => {
        const rows = (s.isNew ? s.rows.filter(isActive) : s.rows).map(r => {
          const it = r.it;
          const ib = n0(it.qty) - n0(r.iq), cb = n0(it.cq) - n0(r.cqv), rt = it.isNew ? 0 : n0(it.rate);
          return { r, it, ib, ibv: ib * rt, cb, cbv: cb * rt };
        }).filter(x => (hasI && x.ib > 1e-9) || (hasC && x.cb > 1e-9));   // only items with something still to indent / issue
        return { s, title: L1(s.isNew ? "New items (not in AOP)" : s.title), rows };
      }).filter(x => x.rows.length);
      const all = [].concat(...secs.map(x => x.rows));
      const sumPos = (k) => all.reduce((a, b) => a + Math.max(0, b[k]), 0), sumNeg = (k) => all.reduce((a, b) => a + Math.min(0, b[k]), 0);
      let y = 72;
      doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...NAVY); doc.text("Indent / Requisition balance", M, y + 4);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...MUTED);
      doc.text([`${res.dept}  |  AOP FY ${res.fy}`, hasI ? `Indents: ${res.period || "-"}` : "", hasC ? `Requisitions (store issues): ${res.cPeriod}` : ""].filter(Boolean).join("   |   "), M, y + 22);
      y += 40;
      const cards = [];
      if (hasI) cards.push({ h: "LEFT TO INDENT (AOP - indented)", big: sumPos("ibv"), lines: [`${all.filter(x => x.ib > 1e-9).length} item(s) still to indent`] });
      if (hasC) cards.push({ h: "LEFT TO REQUISITION (AOP - issued)", big: sumPos("cbv"), lines: [`${all.filter(x => x.cb > 1e-9).length} item(s) still to issue`] });
      const gap = 12, cw = (pw - 2 * M - gap * (cards.length - 1)) / cards.length, chh = 92;
      cards.forEach((c, i) => {
        const x = M + i * (cw + gap);
        doc.setFillColor(246, 248, 252); doc.setDrawColor(214, 220, 232); doc.setLineWidth(0.8); doc.roundedRect(x, y, cw, chh, 8, 8, "FD");
        doc.setFillColor(...GOLD); doc.rect(x, y + 10, 3.5, chh - 20, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...MUTED); doc.text(c.h, x + 14, y + 18);
        doc.setFontSize(19); doc.setTextColor(...NAVY); doc.text("Rs " + fmt(c.big), x + 14, y + 42);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.2); doc.setTextColor(...INK);
        c.lines.forEach((l, k) => doc.text(l, x + 14, y + 58 + k * 11.5));
      });
      y += chh + 18;
      const head1 = [{ content: "#", rowSpan: 2 }, { content: "Item", rowSpan: 2 }, { content: "AOP\nrate", rowSpan: 2 }], head2 = [];
      if (hasI) { head1.push({ content: "INDENT", colSpan: 4 }); head2.push("AOP qty", "Indented", "Balance qty", "Balance Rs\n(at AOP rate)"); }
      if (hasC) { head1.push({ content: "REQUISITION (store issue)", colSpan: 4 }); head2.push("AOP qty", "Issued", "Balance qty", "Balance Rs\n(at AOP rate)"); }
      const ncol = 3 + (hasI ? 4 : 0) + (hasC ? 4 : 0);
      const body = [], meta = [];
      const sgn = v => (v < -0.005 ? "-" : "") + q2(Math.abs(v));
      secs.forEach(sx => {
        body.push([{ content: sx.title, colSpan: ncol }]); meta.push({ kind: "sec" });
        sx.rows.forEach((x, i) => {
          const it = x.it, line = [String(i + 1), `${L1(it.name)}\n${L1(it.code || "no code")}${it.um ? "  |  " + L1(it.um) : ""}`, it.isNew ? "-" : fmt(it.rate, 2)];
          // balance shown only where something is still pending; nothing pending on that side = "-"
          if (hasI) line.push(q2(n0(it.qty)), x.r.iq === null ? "-" : q2(n0(x.r.iq)), x.ib > 1e-9 ? sgn(x.ib) : "-", x.ib > 1e-9 && !it.isNew ? sgn(x.ibv) : "-");
          if (hasC) line.push(q2(n0(it.cq)), x.r.cqv === null ? "-" : q2(n0(x.r.cqv)), x.cb > 1e-9 ? sgn(x.cb) : "-", x.cb > 1e-9 && !it.isNew ? sgn(x.cbv) : "-");
          body.push(line); meta.push({ kind: "item", x });
        });
        const t = new Array(ncol).fill(""); t[1] = "Total - " + sx.title; let c0 = 3;
        if (hasI) { t[c0 + 3] = sgn(sx.rows.reduce((a, b) => a + Math.max(0, b.ibv), 0)); c0 += 4; }
        if (hasC) t[c0 + 3] = sgn(sx.rows.reduce((a, b) => a + Math.max(0, b.cbv), 0));
        body.push(t); meta.push({ kind: "tot" });
      });
      const cs = { 0: { cellWidth: 20, halign: "center" }, 2: { cellWidth: 50 } };
      let ci = 3; const balCols = [];
      [hasI, hasC].forEach(on => { if (!on) return; cs[ci] = { cellWidth: 56 }; cs[ci + 1] = { cellWidth: 56 }; cs[ci + 2] = { cellWidth: 64 }; cs[ci + 3] = { cellWidth: 70 }; balCols.push(ci + 2, ci + 3); ci += 4; });
      const used = Object.values(cs).reduce((a, c) => a + c.cellWidth, 0);
      cs[1] = { cellWidth: Math.max(150, pw - 2 * M - used), halign: "left" };
      doc.autoTable({
        startY: y, head: [head1, head2], body, theme: "grid", columnStyles: cs, showHead: "everyPage", rowPageBreak: "avoid",
        margin: { left: M, right: M, top: 70, bottom: 40 },
        styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }, halign: "right", valign: "middle", textColor: INK, lineColor: [205, 211, 222], lineWidth: 0.5, overflow: "linebreak" },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", halign: "center", fontSize: 9, lineColor: [70, 92, 135] },
        alternateRowStyles: { fillColor: [249, 250, 253] },
        didParseCell: d => {
          if (d.section === "head" && d.row.index === 0 && /INDENT|REQUISITION/.test(String(d.cell.raw && d.cell.raw.content || ""))) d.cell.styles.fillColor = [44, 76, 130];
          if (d.section !== "body") return;
          const m = meta[d.row.index]; if (!m) return;
          if (m.kind === "sec") { d.cell.styles.halign = "left"; d.cell.styles.fontStyle = "bold"; d.cell.styles.fontSize = 10.5; d.cell.styles.textColor = NAVY; d.cell.styles.fillColor = [232, 238, 248]; return; }
          if (m.kind === "tot") { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [248, 241, 218]; if (d.column.index === 1) d.cell.styles.halign = "left"; }
          if (m.kind === "item" && d.column.index === 1) d.cell.styles.fontStyle = "bold";
          if (balCols.includes(d.column.index)) { const v = String(d.cell.raw || ""); if (v === "-") { d.cell.styles.textColor = MUTED; return; } if (/^-/.test(v)) d.cell.styles.textColor = RED; else if (v && v !== "0") { d.cell.styles.textColor = GRN; } d.cell.styles.fontStyle = "bold"; }
        },
        didDrawCell: d => {
          if (d.section !== "body" || d.column.index !== 1) return;
          const m = meta[d.row.index]; if (!m || m.kind !== "item") return;
          const [nm, sub] = String(d.cell.raw).split("\n");
          const fill = d.cell.styles.fillColor; doc.setFillColor(...(Array.isArray(fill) ? fill : [255, 255, 255]));
          doc.rect(d.cell.x + 0.5, d.cell.y + 0.5, d.cell.width - 1, d.cell.height - 1, "F");
          doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...INK);
          let ty = d.cell.y + 11; doc.splitTextToSize(nm, d.cell.width - 8).forEach(l => { doc.text(l, d.cell.x + 4, ty); ty += 10.5; });
          doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(...MUTED); doc.text(sub || "", d.cell.x + 4, ty);
        }
      });
      const n = doc.internal.getNumberOfPages(), today = new Date().toLocaleDateString("en-GB");
      for (let p = 1; p <= n; p++) {
        doc.setPage(p);
        coDrawLogo(doc, M, 14, 140, 32);
        doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NAVY); doc.text(`AOP FY ${res.fy} - Indent / Requisition balance`, pw / 2, 28, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...MUTED); doc.text(res.dept, pw / 2, 43, { align: "center" });
        if (COMPANY.name) { doc.setFontSize(9); doc.text(COMPANY.name, pw - M, 26, { align: "right" }); }
        doc.setDrawColor(...GOLD); doc.setLineWidth(1.2); doc.line(M, 54, pw - M, 54);
        doc.setDrawColor(220, 224, 232); doc.setLineWidth(0.6); doc.line(M, ph - 30, pw - M, ph - 30);
        doc.setFontSize(8.5); doc.setTextColor(...MUTED);
        doc.text(`Generated ${today}   |   Only items still pending.  Balance qty = AOP qty - done;  Balance Rs = balance qty x AOP rate   |   Rs = Indian rupees`, M, ph - 16);
        doc.text(`Page ${p} of ${n}`, pw - M, ph - 16, { align: "right" });
      }
      showPdfPreview(doc, `AOP_FY${res.fy}_Indent_Requisition_Balance.pdf`, "Indent / Requisition balance");
      st.className = "ok"; st.textContent = "PDF ready: Indent / Requisition balance.";
    } catch (e) { st.className = "err"; st.textContent = "PDF error: " + e.message; }
  }
  /* ---------- PDF: Inventory (the uploaded stock file) - item-wise by AOP category, against the AOP budgeted inventory ---------- */
  function invPdf() {
    const res = R.res, st = $("status");
    if (!res) { st.className = "err"; st.textContent = "Press ⚖️ Compare first."; return; }
    if (!STOCK.rows || !STOCK.rows.length) { st.className = "err"; st.textContent = "Choose the 📦 Stock file first."; return; }
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), M = 30;
      const NAVY = [31, 56, 100], GOLD = [201, 162, 39], INK = [30, 34, 45], MUTED = [105, 112, 125], RED = [176, 32, 32];
      const L1 = v => String(v == null ? "" : v).replace(/₹\s*/g, "Rs ").replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "").replace(/ /g, " ").trim();
      const q2 = v => Math.abs(v) < 1e-9 ? "0" : fmt(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 3);
      // each stock line -> the AOP item with the same code (first section that has it)
      const byCode = new Map();
      res.sections.forEach(s => { if (s.isNew) return; s.rows.forEach(r => { const c = norm(r.it.code || ""); if (c && !byCode.has(c)) byCode.set(c, { s, it: r.it }); }); });
      const groups = new Map(), ORDER = res.sections.filter(s => !s.isNew).map(s => s.title).concat(["Not in AOP"]);
      STOCK.rows.forEach(x => {
        const m = byCode.get(norm(x.code)), g = m ? m.s.title : "Not in AOP";
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push({ x, it: m ? m.it : null });
      });
      const secs = ORDER.filter(g => groups.has(g)).map(g => ({ title: L1(g), rows: groups.get(g).sort((a, b) => String(a.x.name).localeCompare(String(b.x.name))) }));
      const tv = STOCK.rows.reduce((a, x) => a + (isFinite(x.val) ? +x.val : 0), 0);
      const withInv = [].concat(...secs.map(s => s.rows)).filter(r => r.it && isFinite(+r.it.inv) && +r.it.inv > 0);
      const above = withInv.filter(r => r.x.qty > +r.it.inv + 1e-9);
      let y = 72;
      doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...NAVY); doc.text("Inventory", M, y + 4);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...MUTED);
      doc.text(`${res.dept}  |  Stock as on ${STOCK.asOn || "(date not set)"}  |  file ${L1(STOCK.file)}  |  AOP FY ${res.fy}`, M, y + 22);
      y += 40;
      const cards = [
        { h: "STOCK VALUE", big: "Rs " + fmt(tv), lines: [`${STOCK.rows.length} item(s) in stock`, `${groups.has("Not in AOP") ? groups.get("Not in AOP").length : 0} item(s) not in the AOP`] },
        { h: "AGAINST AOP BUDGETED INVENTORY", big: `${above.length} of ${withInv.length}`, lines: ["item(s) with stock above the AOP budgeted inventory qty", "(only items that have an AOP inventory qty)"] }];
      const gap = 12, cw = (pw - 2 * M - gap) / 2, chh = 80;
      cards.forEach((c, i) => {
        const x = M + i * (cw + gap);
        doc.setFillColor(246, 248, 252); doc.setDrawColor(214, 220, 232); doc.setLineWidth(0.8); doc.roundedRect(x, y, cw, chh, 8, 8, "FD");
        doc.setFillColor(...GOLD); doc.rect(x, y + 10, 3.5, chh - 20, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...MUTED); doc.text(c.h, x + 14, y + 18);
        doc.setFontSize(19); doc.setTextColor(...NAVY); doc.text(c.big, x + 14, y + 42);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.2); doc.setTextColor(...INK);
        c.lines.forEach((l, k) => doc.text(l, x + 14, y + 58 + k * 11.5));
      });
      y += chh + 18;
      const head = [["#", "Item", "UM", "Stock qty", "Stock value (Rs)", "Value / unit (Rs)", "AOP budgeted\ninventory qty", "Stock -\nAOP inventory"]];
      const body = [], meta = [];
      secs.forEach(sx => {
        body.push([{ content: sx.title, colSpan: 8 }]); meta.push({ kind: "sec" });
        let sv = 0;
        sx.rows.forEach((r, i) => {
          const x = r.x, v = isFinite(x.val) ? +x.val : null, iv = r.it ? r.it.inv : null, inv = iv !== null && iv !== undefined && iv !== "" && isFinite(+iv) ? +iv : null;
          sv += v || 0;
          body.push([String(i + 1), `${L1(x.name || (r.it && r.it.name) || "")}\n${L1(x.code)}`, L1(x.um || (r.it && r.it.um) || ""), q2(x.qty),
            v === null ? "-" : fmt(v, 2), v === null || !x.qty ? "-" : fmt(v / x.qty, 2), inv === null ? "-" : q2(inv),
            inv === null ? "-" : (x.qty - inv > 1e-9 ? "+" : "") + q2(x.qty - inv)]);
          meta.push({ kind: "item", above: inv !== null && inv > 0 && x.qty > inv + 1e-9 });
        });
        body.push(["", "Total - " + sx.title, "", "", fmt(sv, 2), "", "", ""]); meta.push({ kind: "tot" });
      });
      body.push(["", "GRAND TOTAL", "", "", fmt(tv, 2), "", "", ""]); meta.push({ kind: "grand" });
      const used = 20 + 40 + 64 + 84 + 78 + 86 + 80;
      doc.autoTable({
        startY: y, head, body, theme: "grid", showHead: "everyPage", rowPageBreak: "avoid",
        columnStyles: { 0: { cellWidth: 20, halign: "center" }, 1: { cellWidth: pw - 2 * M - used, halign: "left" }, 2: { cellWidth: 40, halign: "center" }, 3: { cellWidth: 64 }, 4: { cellWidth: 84 }, 5: { cellWidth: 78 }, 6: { cellWidth: 86 }, 7: { cellWidth: 80 } },
        margin: { left: M, right: M, top: 70, bottom: 40 },
        styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }, halign: "right", valign: "middle", textColor: INK, lineColor: [205, 211, 222], lineWidth: 0.5, overflow: "linebreak" },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", halign: "center", fontSize: 9, lineColor: [70, 92, 135] },
        alternateRowStyles: { fillColor: [249, 250, 253] },
        didParseCell: d => {
          if (d.section !== "body") return;
          const m = meta[d.row.index]; if (!m) return;
          if (m.kind === "sec") { d.cell.styles.halign = "left"; d.cell.styles.fontStyle = "bold"; d.cell.styles.fontSize = 10.5; d.cell.styles.textColor = NAVY; d.cell.styles.fillColor = [232, 238, 248]; return; }
          if (m.kind === "tot" || m.kind === "grand") { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = m.kind === "grand" ? [232, 238, 248] : [248, 241, 218]; if (d.column.index === 1) d.cell.styles.halign = "left"; }
          if (m.kind === "item" && d.column.index === 7 && m.above) { d.cell.styles.textColor = RED; d.cell.styles.fontStyle = "bold"; }
          if (m.kind === "item" && d.column.index === 3) d.cell.styles.fontStyle = "bold";
        },
        didDrawCell: d => {
          if (d.section !== "body" || d.column.index !== 1) return;
          const m = meta[d.row.index]; if (!m || m.kind !== "item") return;
          const [nm, sub] = String(d.cell.raw).split("\n");
          const fill = d.cell.styles.fillColor; doc.setFillColor(...(Array.isArray(fill) ? fill : [255, 255, 255]));
          doc.rect(d.cell.x + 0.5, d.cell.y + 0.5, d.cell.width - 1, d.cell.height - 1, "F");
          doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...INK);
          let ty = d.cell.y + 11; doc.splitTextToSize(nm, d.cell.width - 8).forEach(l => { doc.text(l, d.cell.x + 4, ty); ty += 10.5; });
          doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(...MUTED); doc.text(sub || "", d.cell.x + 4, ty);
        }
      });
      const n = doc.internal.getNumberOfPages(), today = new Date().toLocaleDateString("en-GB");
      for (let p = 1; p <= n; p++) {
        doc.setPage(p);
        coDrawLogo(doc, M, 14, 140, 32);
        doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NAVY); doc.text(`Inventory as on ${STOCK.asOn || "-"}`, pw / 2, 28, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...MUTED); doc.text(res.dept, pw / 2, 43, { align: "center" });
        if (COMPANY.name) { doc.setFontSize(9); doc.text(COMPANY.name, pw - M, 26, { align: "right" }); }
        doc.setDrawColor(...GOLD); doc.setLineWidth(1.2); doc.line(M, 54, pw - M, 54);
        doc.setDrawColor(220, 224, 232); doc.setLineWidth(0.6); doc.line(M, ph - 30, pw - M, ph - 30);
        doc.setFontSize(8.5); doc.setTextColor(...MUTED);
        doc.text(`Generated ${today}   |   Qty and value as in the stock file;  red + = stock above the AOP budgeted inventory qty   |   Rs = Indian rupees`, M, ph - 16);
        doc.text(`Page ${p} of ${n}`, pw - M, ph - 16, { align: "right" });
      }
      showPdfPreview(doc, `Inventory_${(STOCK.asOn || "").replace(/[^0-9-]/g, "") || "stock"}.pdf`, "Inventory");
      st.className = "ok"; st.textContent = "PDF ready: Inventory.";
    } catch (e) { st.className = "err"; st.textContent = "PDF error: " + e.message; }
  }
  function secPdfButtons(res) {
    const box = $("aovSecPdfs"); if (!box) return;
    box.innerHTML = `<button class="secondary" type="button" data-sumpdf="1">📄 Summary</button>` +
      `<button class="secondary" type="button" data-balpdf="1">📄 Indent / Req. balance</button>` +
      `<button class="secondary" type="button" data-invpdf="1">📄 Inventory${STOCK.rows ? ` <small>(${STOCK.rows.length})</small>` : ""}</button>` + res.sections.map((s, i) => {
      const n = s.isNew ? s.rows.filter(isActive).length : s.rows.length;
      if (!n) return "";
      return `<button class="secondary" type="button" data-secpdf="${i}">📄 ${_escH(s.isNew ? "New items" : s.title)} <small>(${n})</small></button>`;
    }).join("");
  }

  /* ---------- indents / requisitions added in the app (OneDrive -> AOP -> Manual -> entries.json) ---------- */
  // An entry is left out on its own once the ERP indent report / consumption file has the same indent / slip number for that item.
  const MAN_URL = `${AOP_ROOT}/Manual/entries.json:/content`;
  async function manLoad() {
    const token = await getToken(); if (!token) throw new Error("not signed in");
    const r = await fetch(MAN_URL, { headers: { Authorization: "Bearer " + token } });
    if (r.status === 404) return [];
    if (!r.ok) throw new Error("could not read the app entries (" + r.status + ")");
    const j = await r.json().catch(() => []);
    return Array.isArray(j) ? j : (j.entries || []);
  }
  async function manSave(list) {
    const token = await getToken(); if (!token) throw new Error("not signed in");
    const r = await fetch(MAN_URL, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(list, null, 1) });
    if (!r.ok) throw new Error("OneDrive save failed (" + r.status + ")");
  }
  const isoTo = (iso, upper) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); if (!m) return ""; const mo = MON[+m[2] - 1]; return `${m[3]}-${upper ? mo.toUpperCase() : mo}-${m[1]}`; };
  // merges the app entries of this department into the indent / consumption data (file lines win)
  function manMerge(list, dept, ind, cons) {
    const mine = list.filter(e => norm(e.dept) === norm(dept));
    const iKeys = new Set((ind ? ind.lines : []).map(l => norm(l.no) + "|" + norm(l.code)).concat(ind && ind.cancelled ? [...ind.cancelled] : [], ind && ind.dummy ? [...ind.dummy] : []));
    const cKeys = new Set((cons ? cons.lines : []).map(l => norm(l.slip) + "|" + norm(l.code)));
    let nI = 0, nC = 0, dup = 0;
    const iAdd = [], cAdd = [];
    mine.forEach(e => {
      const qty = num(e.qty), rate = num(e.rate), no = String(e.no || "").trim();
      if (e.type === "indent") {
        if (no && iKeys.has(norm(no) + "|" + norm(e.code))) { dup++; return; }
        iAdd.push({ date: isoTo(e.date, true), no: no || "APP", code: e.code || "", name: e.name || "", um: e.um || "", qty, canc: 0, net: qty, rate, po: 0, val: qty * rate,
          pono: "", vendor: "", grn: "", pend: qty, onlyIn: "", manual: true, remark: e.remark || "" }); nI++;
      } else {
        if (no && cKeys.has(norm(no) + "|" + norm(e.code))) { dup++; return; }
        const m = /^(\d{4})-(\d{2})/.exec(e.date || "");
        const mk = m ? +m[1] * 12 + +m[2] - 1 : null;
        cAdd.push({ mk, month: mk == null ? "" : monName(mk), date: isoTo(e.date), slip: no || "APP", code: e.code || "", name: e.name || "", um: e.um || "", qty, rate, val: qty * rate,
          remark: "added in app" + (e.remark ? ": " + e.remark : ""), manual: true }); nC++;
      }
    });
    if (iAdd.length) ind = ind ? Object.assign({}, ind, { lines: ind.lines.concat(iAdd) }) : { lines: iAdd, period: "" };
    if (cAdd.length) cons = cons ? Object.assign({}, cons, { lines: cons.lines.concat(cAdd) }) : { sheet: "app entries", lines: cAdd };
    return { ind, cons, nI, nC, dup };
  }
  async function manAopItems() {   // AOP items for the item box
    const an = $("aovAop").value; if (!an) return [];
    if (!R.aopCache || R.aopCache.name !== an) R.aopCache = { name: an, aop: parseAop(await readFile(AOP_ROOT, an)) };
    return [].concat(...R.aopCache.aop.sections.map(s => s.items.map(it => Object.assign({ secTitle: s.title }, it))));
  }
  const itemLabel = it => `${it.code || "-"} · ${it.name}`;
  // item list for ERP → Indent / Requisition: AOP items + items of the chosen indent and store-issue files (one per code)
  window.aovCatalog = async function () {
    if (!$("aovAop").value) await refresh();
    const an = $("aovAop").value, inn = $("aovInd").value, cn = $("aovCons").value, dept = $("aovDept").value.trim();
    const map = new Map();
    const add = (o, src) => {
      const code = String(o.code || "").trim(), name = String(o.name || "").replace(/\u00a0/g, " ").trim(); if (!code && !name) return;
      const k = code ? norm(code) : "N:" + norm(name), e = map.get(k);
      if (e) { if (!e.um && o.um) e.um = String(o.um); if (!e.name && name) e.name = name; return e; }
      const n = { code, name, um: String(o.um || ""), src }; map.set(k, n); return n;
    };
    // day number of an indent date (Excel serial, dd-Mon-yyyy, dd-mm-yyyy or yyyy-mm-dd); -1 if unreadable
    const MO = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
    const dayOf = v => {
      const t = String(v == null ? "" : v).trim(); let m;
      if (/^\d+(\.\d+)?$/.test(t) && +t > 20000) return Math.floor(+t);
      if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 + 25569;
      if ((m = t.match(/^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*[-/. ](\d{2,4})/)) && MO[m[2].toUpperCase()]) return Date.UTC(+m[3] < 100 ? 2000 + +m[3] : +m[3], MO[m[2].toUpperCase()] - 1, +m[1]) / 864e5 + 25569;
      if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) return Date.UTC(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]) / 864e5 + 25569;
      return -1;
    };
    if (an) (await manAopItems()).forEach(it => add(it, "AOP"));
    // last indent rate per item = rate on its latest indent line (later line wins on the same date)
    if (inn) try { parseIndent(await readFile(IND_DIR, inn), dept).lines.forEach(l => {
      const e = add(l, "Indent"), r = num(l.rate); if (!e || !(r > 0)) return;
      const dd = dayOf(l.date); if (e.rateDay === undefined || dd >= e.rateDay) { e.lastRate = r; e.rateDay = dd; e.rateDate = String(l.date || ""); e.rateNo = String(l.no || ""); }
    }); } catch (e) {}
    if (cn) try { parseCons(await readFile(CONS_DIR, cn)).lines.forEach(l => add(l, "Store issue")); } catch (e) {}
    return { items: [...map.values()].sort((a, b) => a.name.localeCompare(b.name)), files: [an, inn, cn].filter(Boolean) };
  };
  async function manFillItems() {
    try { const items = await manAopItems(); $("aovMItems").innerHTML = items.map(it => `<option value="${_escH(itemLabel(it))}">${_escH(it.secTitle)}</option>`).join(""); R.manItems = items; }
    catch (e) { $("status").className = "err"; $("status").textContent = "AOP items: " + e.message; }
  }
  async function manShow() {
    const box = $("aovMList");
    try {
      const list = await manLoad(); R.man = list;
      const mine = list.filter(e => norm(e.dept) === norm($("aovDept").value)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      box.innerHTML = mine.length ? `<div class="tableScroll"><table class="matrixTable stockTable"><tr><th>Date</th><th>Type</th><th>No.</th><th>Item</th><th>Qty</th><th>Rate</th><th>Value</th><th></th></tr>` +
        mine.map(e => `<tr><td>${_escH(isoTo(e.date))}</td><td>${e.type === "indent" ? "Indent" : "Requisition"}</td><td>${_escH(e.no || "")}</td><td style="text-align:left">${_escH(e.name)}<br><small style="color:var(--muted)">${_escH(e.code || "no code")}${e.remark ? " · " + _escH(e.remark) : ""}</small></td>` +
          `<td>${fmt(num(e.qty), 2)} ${_escH(e.um || "")}</td><td>${fmt(num(e.rate), 2)}</td><td>${fmt(num(e.qty) * num(e.rate))}</td><td><button class="secondary" type="button" data-del="${_escH(e.id)}" style="padding:4px 8px">🗑</button></td></tr>`).join("") + `</table></div>`
        : `<p style="font-size:12.5px;color:var(--muted);">No indent / requisition added in the app yet for ${_escH($("aovDept").value)}.</p>`;
    } catch (e) { box.innerHTML = `<p class="psvNeg" style="font-size:12.5px;">${_escH(e.message)}</p>`; }
  }

  /* ---------- events ---------- */
  $("aovRun").addEventListener("click", async () => {
    const st = $("status");
    const an = $("aovAop").value, inn = $("aovInd").value, cn = $("aovCons").value;
    if (!an) { st.className = "err"; st.textContent = "Choose an AOP file."; return; }
    try {
      st.className = "wait"; st.textContent = "Reading the files...";
      const [aw, iw, cw, man] = await Promise.all([readFile(AOP_ROOT, an), inn ? readFile(IND_DIR, inn) : null, cn ? readFile(CONS_DIR, cn) : null, manLoad().catch(() => [])]);
      R.aopName = an; R.indName = inn; R.consName = cn;
      const aop = parseAop(aw), dept = $("aovDept").value.trim();
      const mm = manMerge(man, dept, iw ? parseIndent(iw, dept) : null, cw ? parseCons(cw) : null);
      if (!mm.ind && !mm.cons) throw new Error("choose an indent file and / or a consumption file (📥 Import), or add an indent / requisition in the app");
      R.res = compare(aop, mm.ind, mm.cons);
      Object.assign(R.res, { manI: mm.nI, manC: mm.nC, manDup: mm.dup });
      $("aovDlBox").classList.remove("hidden");
      show(R.res); secPdfButtons(R.res);
      $("aovNext").disabled = !R.res.hasCons; $("aovNext").textContent = `🛠️ Make FY ${aop.fyStart + 1}-${aop.fyStart + 2} AOP (WIP)`;
      const nNew = R.res.sections[R.res.sections.length - 1].rows.length;
      const nCanc = mm.ind && mm.ind.cancelled ? mm.ind.cancelled.size : 0, nDum = mm.ind && mm.ind.dummy ? mm.ind.dummy.size : 0;
      st.className = "ok"; st.textContent = `Compared ${[mm.ind ? `${mm.ind.lines.length} indent line(s)` : "", mm.cons ? `${R.res.cLines.length} issue line(s)` : ""].filter(Boolean).join(" and ")}${mm.nI + mm.nC ? ` (${mm.nI + mm.nC} added in the app)` : ""} with ${[].concat(...aop.sections.map(s => s.items)).length} AOP item(s); ${nNew} new item(s).` +
        (nCanc ? ` ${nCanc} cancelled indent line(s) left out.` : "") + (nDum ? ` ${nDum} dummy ₹1 indent line(s) left out (${(mm.ind.dummyNos || []).join(", ")}).` : "");
      // new items indented / issued since the Next FY AOP (WIP) was made -> added to it
      const said = st.textContent;
      if (R.res.hasCons || R.res.hasInd) syncNextAop(R.res).then(msg => { if (msg) { st.className = "ok"; st.textContent = said + "\n" + msg; } })
        .catch(e => { st.className = "err"; st.textContent = said + "\n⚠️ Next FY AOP not updated: " + e.message; });
    } catch (e) { st.className = "err"; st.textContent = "Compare error: " + e.message; }
  });
  $("aovOut").addEventListener("click", ev => {
    const t = ev.target.closest("[data-tab],[data-flt]"); if (!t || !R.res) return;
    if (t.dataset.tab) { R.tab = t.dataset.tab; R.filter = "act"; show(R.res); const on = $("aovOut").querySelector(".aovTab.on"); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest", inline: "center" }); }
    else { R.filter = t.dataset.flt; show(R.res); }
  });
  $("aovNext").addEventListener("click", nextAop);
  // step 1: the file choices open from a button, like Compare; the chosen files are shown under it
  const chosenLine = () => { const v = id => { const e = $(id); return e && e.value ? e.value : ""; };
    $("aovChosen").textContent = [v("aovAop") && "📑 " + v("aovAop"), v("aovInd") && "🧾 " + v("aovInd"), v("aovCons") && "📦 " + v("aovCons"), v("aovDept") && "🏷️ " + v("aovDept")].filter(Boolean).join("   ·   "); };
  const filesOpen = open => { $("aovFiles").classList.toggle("hidden", !open); $("aovChooseBtn").setAttribute("aria-expanded", open ? "true" : "false");
    $("aovChooseBtn").textContent = open ? "✔️ Done - hide the file choices" : "📂 Choose the files"; $("aovChosen").classList.toggle("hidden", open); chosenLine(); };
  $("aovChooseBtn").addEventListener("click", () => filesOpen($("aovFiles").classList.contains("hidden")));
  ["aovAop", "aovInd", "aovCons", "aovDept"].forEach(id => $(id).addEventListener("change", chosenLine));
  ["aovAop", "aovInd", "aovCons"].forEach(id => new MutationObserver(chosenLine).observe($(id), { childList: true }));
  $("aovRun").addEventListener("click", () => { if (!$("aovFiles").classList.contains("hidden")) filesOpen(false); });
  $("aovSecPdfs").addEventListener("click", ev => { if (ev.target.closest("[data-sumpdf]")) { sumPdf(); return; } if (ev.target.closest("[data-balpdf]")) { balPdf(); return; } if (ev.target.closest("[data-invpdf]")) { invPdf(); return; } const b = ev.target.closest("[data-secpdf]"); if (b) secPdf(+b.dataset.secpdf); });
  $("aovAddBox").addEventListener("toggle", () => {
    if (!$("aovAddBox").open) return;
    if (!$("aovMDate").value) { const d = new Date(); $("aovMDate").value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
    manFillItems(); manShow();
  });
  $("aovAop").addEventListener("change", () => { if ($("aovAddBox").open) manFillItems(); });
  $("aovMItem").addEventListener("input", () => {
    const it = (R.manItems || []).find(x => itemLabel(x) === $("aovMItem").value.trim()); if (!it) return;
    $("aovMCode").value = it.code || ""; $("aovMName").value = it.name; $("aovMUm").value = it.um || ""; $("aovMRate").value = it.rate ? String(Math.round(it.rate * 100) / 100) : "";
  });
  $("aovMAdd").addEventListener("click", async () => {
    const st = $("status"), v = id => $(id).value.trim();
    const qty = parseFloat(v("aovMQty").replace(/,/g, "")), rate = parseFloat(v("aovMRate").replace(/,/g, ""));
    if (!v("aovMDate")) { st.className = "err"; st.textContent = "Enter the date."; return; }
    if (!v("aovMName")) { st.className = "err"; st.textContent = "Choose an item (or type its name)."; return; }
    if (!(qty > 0)) { st.className = "err"; st.textContent = "Enter the quantity."; return; }
    if (!(rate >= 0)) { st.className = "err"; st.textContent = "Enter the rate."; return; }
    try {
      st.className = "wait"; st.textContent = "Adding...";
      const list = await manLoad();
      list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type: v("aovMType") === "issue" ? "issue" : "indent", dept: v("aovDept"), date: v("aovMDate"),
        no: v("aovMNo"), code: v("aovMCode"), name: v("aovMName"), um: v("aovMUm"), qty, rate, remark: v("aovMRemark"), by: (account && account.username) || "", at: new Date().toISOString() });
      await manSave(list);
      ["aovMItem", "aovMCode", "aovMName", "aovMUm", "aovMQty", "aovMRate", "aovMNo", "aovMRemark"].forEach(id => { $(id).value = ""; });
      await manShow();
      st.className = "ok"; st.textContent = `Added. Press ⚖️ Compare to see it in the comparison.`;
    } catch (e) { st.className = "err"; st.textContent = "Add error: " + e.message; }
  });
  $("aovMList").addEventListener("click", async ev => {
    const b = ev.target.closest("[data-del]"); if (!b) return;
    const st = $("status");
    try {
      const list = await manLoad(), e = list.find(x => x.id === b.dataset.del); if (!e) return;
      if (!confirm(`Delete this ${e.type === "indent" ? "indent" : "requisition"}: ${e.name}, qty ${e.qty}?`)) return;
      await manSave(list.filter(x => x.id !== e.id)); await manShow();
      st.className = "ok"; st.textContent = "Deleted. Press ⚖️ Compare again.";
    } catch (e2) { st.className = "err"; st.textContent = "Delete error: " + e2.message; }
  });
  const importer = (btn, input, dir, check, label, keep) => {
    $(btn).addEventListener("click", () => { const f = $(input); f.value = ""; f.click(); });
    $(input).addEventListener("change", async ev => {
      const file = ev.target.files && ev.target.files[0]; if (!file) return;
      const st = $("status");
      try {
        const bytes = await file.arrayBuffer();
        check(XLSX.read(new Uint8Array(bytes), { type: "array" }));   // is it the right kind of report?
        const name = file.name.replace(/^\d{10,}_/, "").replace(/[\\/:*?"<>|#%]/g, "_");
        const token = await getToken(); if (!token) return;
        st.className = "wait"; st.textContent = `Putting ${name} in OneDrive...`;
        const r = await fetch(`${dir}/${encodeURIComponent(name)}:/content`, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/octet-stream" }, body: bytes });
        if (!r.ok) throw new Error("OneDrive upload failed (" + r.status + ")");
        await keep(name);
        st.className = "ok"; st.textContent = `${name} added. Press ⚖️ Compare.`;
      } catch (e) { st.className = "err"; st.textContent = `${label} import error: ` + e.message; }
    });
  };
  importer("aovIndImportBtn", "aovIndFile", IND_DIR, wb => parseIndent(wb, ""), "Indent", name => refresh(name, undefined));
  importer("aovConsImportBtn", "aovConsFile", CONS_DIR, wb => parseCons(wb), "Consumption", name => refresh(undefined, name));
  document.querySelectorAll('[data-subaop="vs"]').forEach(b => b.addEventListener("click", () => refresh()));
  window._aovTest = { parseAop, parseIndent, parseCons, compare, manMerge, R };
})();

