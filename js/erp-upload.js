/* ===================== ERP UPLOAD (Durgesh / M2M) =====================
   The ERP report (sent by someone while you are on leave) is written into the month's Reports file:
   the whole Durgesh or M2M sheet is cleared and the ERP data is written as it is from A1 (like paste).
   Durgesh also fills Daily Stock column Q (ERP weight) of the chosen date's block = Durgesh "4-CLOSING"
   of the ERP item(s) chosen for each size (chosen once, remembered on this device).
   Preview first; nothing is written until "Write". The last upload can be undone. ===== */
(function erpUpload() {
  const $ = id => document.getElementById(id);
  if (!$("erpDurgeshBtn")) return;
  const MAP_KEY = "erpQMap";
  let target = "Durgesh", job = null, undo = null;
  const say = (t, cls) => { const st = $("erpStatus"); st.className = cls || ""; st.innerHTML = t; };
  const esc = htmlEsc;
  const r3 = x => Math.round(x * 1000) / 1000;
  const num = v => { if (typeof v === "number") return v; const t = String(v == null ? "" : v).replace(/,/g, "").trim(); return t !== "" && isFinite(+t) ? +t : null; };
  const loadMap = () => { try { return JSON.parse(localStorage.getItem(MAP_KEY) || "{}") || {}; } catch (e) { return {}; } };
  const saveMap = m => { try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch (e) {} };
  const sheetUrl = (wb, name) => `${wb}/worksheets('${encodeURIComponent(String(name).replace(/'/g, "''"))}')`;
  const colL = i => XLSX.utils.encode_col(i);
  const normSize = t => String(t || "").toUpperCase().replace(/\s+/g, "");

  if (!$("erpDate").value) $("erpDate").value = todayISO();

  // ---- read the uploaded ERP file: values exactly as shown in the ERP sheet ----
  function readErp(buf, name) {
    const wbx = XLSX.read(buf, { type: "array", cellDates: false, cellNF: true, cellText: true, raw: /\.csv$/i.test(name) ? false : undefined });
    let ws = null, wsName = "";
    for (const n of wbx.SheetNames) { const w = wbx.Sheets[n]; if (w && w["!ref"]) { ws = w; wsName = n; break; } }
    if (!ws) throw new Error("the file has no data");
    const rg = XLSX.utils.decode_range(ws["!ref"]);
    const rows = [];
    for (let r = 0; r <= rg.e.r; r++) {
      const row = [];
      for (let c = 0; c <= rg.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        let v = "";
        if (cell && cell.v != null) {
          if (cell.t === "n" && cell.z && XLSX.SSF.is_date(cell.z) && cell.w) v = cell.w;   // dates as shown (Excel reads them back as dates)
          else if (cell.t === "b") v = cell.v ? "TRUE" : "FALSE";
          else if (cell.t === "e") v = cell.w || "";
          else v = cell.v;
        }
        row.push(v);
      }
      rows.push(row);
    }
    while (rows.length && rows[rows.length - 1].every(v => v === "")) rows.pop();   // no blank tail
    let lastC = -1; rows.forEach(r => r.forEach((v, c) => { if (v !== "" && c > lastC) lastC = c; }));
    return { wsName, rows: rows.map(r => r.slice(0, lastC + 1)), cols: lastC + 1 };
  }

  // a date written in the ERP title rows ("as on 23-10-2026", "From .. To 23/10/2026") -> suggested Daily Stock date
  function erpDateGuess(rows) {
    let found = null;
    rows.slice(0, 6).forEach(r => r.forEach(v => {
      const re = /(\d{1,2})[\/\-.](\d{1,2}|[A-Za-z]{3})[\/\-.](\d{2,4})/g; let m;
      while ((m = re.exec(String(v)))) {
        let d = +m[1], mo = isNaN(+m[2]) ? "JANFEBMARAPRMAYJUNJULAUGSEPOCTNOVDEC".indexOf(m[2].toUpperCase()) / 3 + 1 : +m[2], y = +m[3]; if (y < 100) y += 2000;
        const dt = new Date(y, mo - 1, d);
        if (mo >= 1 && mo <= 12 && dt.getDate() === d) found = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }));
    return found;
  }

  // ---- ERP report in list form (one line per item and Tnature: Division | Item Code | Item Name | Division | Tnature Group | Tnature | Qty)
  //      -> the usual table (one line per item: Opening, Receipts, Issues, Closing), the same columns as before, so FC Report,
  //      Billet Stock and the Daily Stock ERP weight read it as always. Tnatures not in the usual list go after TOTAL.
  const DUR_COLS = [["1-OPENING", ""], ["2-RECIEPT", "GOODS RECEPIET NOTE"], ["2-RECIEPT", "INTER DIV STOCK TRANSFER"], ["2-RECIEPT", "INTER STOCK TRANSFER"],
    ["2-RECIEPT", "MATERIAL TO MATERIAL TRANSFER"], ["2-RECIEPT", "PRODUCTION"], ["3-ISSUE", "INTER STOCK TRANSFER"], ["3-ISSUE", "ISSUE"],
    ["3-ISSUE", "MATERIAL TO MATERIAL TRANSFER"], ["3-ISSUE", "PRODUCTION"], ["3-ISSUE", "SALE"], ["4-CLOSING", ""]];
  function longToWide(rows) {
    const T = v => String(v == null ? "" : v).trim();
    const U = v => T(v).toUpperCase().replace(/\s+/g, " ");
    let hr = -1;
    for (let r = 0; r < Math.min(rows.length, 15) && hr < 0; r++) if (rows[r].some(v => /^TNATURE\s*GROUP$/i.test(T(v))) && rows[r].some(v => /^QTY$/i.test(T(v)))) hr = r;
    if (hr < 0) return null;
    const H = rows[hr].map(U), ix = re => H.findIndex(h => re.test(h));
    const cG = ix(/^TNATURE GROUP$/), cT = ix(/^TNATURE$/), cQ = ix(/^QTY$/), cCode = ix(/^ITEM CODE$/), cName = ix(/^ITEM NAME$/), cDiv = ix(/^DIVISION CODE$/);
    if (cG < 0 || cQ < 0 || cName < 0) return null;
    const tn = v => { const t = U(v); return t === "0" ? "" : t; };
    const cols = DUR_COLS.map(c => c.slice()), extra = [], items = new Map();
    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r], g = U(row[cG]); if (!g) continue;
      const t = cT >= 0 ? tn(row[cT]) : "", q = num(row[cQ]);
      const key = (cCode >= 0 ? T(row[cCode]) : "") + "|" + T(row[cName]);
      if (!items.has(key)) items.set(key, { div: cDiv >= 0 ? T(row[cDiv]) : "", code: cCode >= 0 ? T(row[cCode]) : "", name: T(row[cName]), v: new Map() });
      let k = cols.findIndex(c => c[0] === g && c[1] === t);
      if (k < 0) { let e = extra.findIndex(c => c[0] === g && c[1] === t); if (e < 0) { extra.push([g, t]); e = extra.length - 1; } k = 100 + e; }
      const it = items.get(key); it.v.set(k, (it.v.get(k) || 0) + (q || 0));
    }
    if (!items.size) return null;
    const title = rows.slice(0, hr).map(r => r.map(T).filter(Boolean).join(" ")).filter(Boolean);
    const n = cols.length, w = 4 + n + 1 + extra.length;
    const line = a => { const o = a.slice(); while (o.length < w) o.push(""); return o; };
    const out = [line([title[0] || "Durgesh stock report"]), line([title[1] || ""]),
      line(["", "", "", "Tnature Group", ...cols.map(c => c[0]), " ", ...extra.map(c => c[0])]),
      line(["", "", "", "Tnature", ...cols.map(c => c[1]), "", ...extra.map(c => c[1])]),
      line(["Division  Code", "Item Code", "Item Name", "Division  Code", ...cols.map(() => "   Qty"), "TOTAL", ...extra.map(() => "   Qty")])];
    const sums = new Array(n + extra.length).fill(0), r3x = x => Math.round(x * 1000) / 1000;
    items.forEach(it => {
      const vals = cols.map((c, k) => r3x(it.v.get(k) || 0)), ex = extra.map((c, e) => r3x(it.v.get(100 + e) || 0));
      vals.forEach((v, k) => { sums[k] += v; }); ex.forEach((v, e) => { sums[n + e] += v; });
      out.push(line([it.div, it.code, it.name, it.div, ...vals, r3x([...vals, ...ex].reduce((a, b) => a + b, 0)), ...ex]));
    });
    out.push(line([]));
    out.push(line(["", "", "", "Total", ...sums.slice(0, n).map(r3x), "", ...sums.slice(n).map(r3x)]));
    return { rows: out, cols: w, items: items.size };
  }

  // ---- Durgesh: "4-CLOSING" column and the item list ----
  function durgeshItems(rows) {
    let hr = -1, cc = -1;
    for (let r = 0; r < Math.min(rows.length, 15) && hr < 0; r++) rows[r].forEach((v, c) => { if (cc < 0 && /4\s*-?\s*CLOSING/i.test(String(v))) { hr = r; cc = c; } });
    if (hr < 0) for (let r = 0; r < Math.min(rows.length, 15) && hr < 0; r++) rows[r].forEach((v, c) => { if (cc < 0 && /CLOSING/i.test(String(v))) { hr = r; cc = c; } });
    if (hr < 0) return { error: 'no "4-CLOSING" column found in the first 15 rows of the ERP file' };
    const items = [];
    let billetTotal = 0, billetCount = 0, billetSkipped = 0, billetSkippedWt = 0, endCut = 0, endCutWt = 0;
    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r], val = num(row[cc]);
      // billet total for Billet Stock Format: items with "BILLET" in the name AND item code starting with F
      // (codes starting with R are skipped); total / sub-total lines never counted; "BILLET END CUT" is scrap, never counted
      const isEndCut = row.slice(0, cc).some(v => typeof v === "string" && /END\s*-?\s*CUTS?\b/i.test(v));
      if (val != null && isEndCut && row.slice(0, cc).some(v => typeof v === "string" && /BILLET/i.test(v))) { endCut++; endCutWt += val; }
      else if (val != null && row.slice(0, cc).some(v => typeof v === "string" && /BILLET/i.test(v)) && !row.slice(0, cc).some(v => typeof v === "string" && /\b(SUB\s*-?\s*)?TOTAL\b/i.test(v))) {
        // item code = column B of the ERP sheet 
        const code = String(row[1] == null ? "" : row[1]).trim().toUpperCase();
        if (code.startsWith("F")) { billetTotal += val; billetCount++; }
        else { billetSkipped++; billetSkippedWt += val; }
      }
      const texts = row.slice(0, cc).filter(v => typeof v === "string" && v.trim() && !/^[\d.,\s-]+$/.test(v)).map(v => v.trim());
      if (!texts.length) continue;
      const code = String(row[2] == null ? "" : row[2]).trim();               // FC Report looks items up by column C
      const name = texts.filter(t => t !== code).sort((x, y) => y.length - x.length)[0] || "";   // the longest text = item name
      if (/^(GRAND\s*)?TOTAL\b/i.test(name) && !code) continue;
      const key = code || name;
      const all = [code, ...texts].filter(Boolean), codeLike = String(row[1] == null ? "" : row[1]).trim();   // item code = column B
      const nm = all.filter(v => v !== codeLike).sort((x, y) => y.length - x.length)[0] || "";
      items.push({ key, label: codeLike && nm ? `${nm} (${codeLike})` : (nm || codeLike || key), value: val, row: r + 1 });
    }
    if (items.length && !items.some(it => it.value != null)) return { error: 'the "4-CLOSING" column of the ERP file has no numbers - its layout is not the usual one, so the ERP weight (Q) is not changed' };
    return { headerRow: hr + 1, col: cc, colName: String(rows[hr][cc]), items, billetTotal: r3(billetTotal), billetCount, billetSkipped, billetSkippedWt: r3(billetSkippedWt), endCut, endCutWt: r3(endCutWt) };
  }
  // best guess of the ERP item(s) for a Daily Stock size like "130 X 6", "RAN 160", "110X 5.25"
  function guessFor(size, items) {
    const t = normSize(size); let sec, len = null, ran = false, m;
    if ((m = t.match(/^RAN(\d{3})$/))) { sec = m[1]; ran = true; } else if ((m = t.match(/^(\d{3})X([\d.]+)$/))) { sec = m[1]; len = +m[2]; } else return [];
    const hits = items.filter(it => {
      // "160X160X4MTR", "160*160 4.0 M", "BILLET 160 SQ 4000MM", "160 X 160 X 4 MTRS" ...
      let L = " " + it.label.toUpperCase().replace(/[×*]/g, "X").replace(/\(([^)]*)\)\s*$/, " $1 ") + " ";
      if (!new RegExp("(^|\\D)" + sec + "(\\D|$)").test(L)) return false;
      const isRan = /RANDOM|\bRAN\b|R\/L|\bRL\b|\bR\.L\b/.test(L);
      if (ran) return isRan;
      if (isRan) return false;
      L = L.replace(new RegExp(sec + "\\s*X\\s*" + sec, "g"), " SEC ").replace(new RegExp("(^|\\D)" + sec + "(\\D|$)", "g"), "$1 SEC $2");
      const nums = (L.match(/\d+(\.\d+)?/g) || []).map(Number);
      return nums.some(n => Math.abs(n - len) < 1e-9 || Math.abs(n - len * 1000) < 1e-6);   // metres (4, 4.0, 5.25) or mm (4000, 5250)
    });
    if (hits.length === 1) return [hits[0].key];
    return [];
  }

  // ---- Daily Stock block of the date ----
  function cellISO(v) {
    if (typeof v === "number" && v > 40000) return excelSerialToISODate(v);
    const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(String(v || "").trim());
    if (!m) return null; let y = +m[3]; if (y < 100) y += 2000;
    return `${y}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
  }
  async function readStockBlock(wb, token, iso) {
    const sh = sheetUrl(wb, "Daily Stock");
    const colA = await graphFetch(`${sh}/range(address='A1:A2000')?$select=values`, token, { noCache: true });
    let top = -1;
    colA.values.forEach((r, i) => { if (cellISO(r[0]) === iso) top = i + 1; });
    if (top < 0) return null;
    const blk = await graphFetch(`${sh}/range(address='A${top}:Q${top + 17}')?$select=values,formulas,text`, token, { noCache: true });
    const rows = [];
    for (let i = 3; i < blk.values.length; i++) {
      const size = String(blk.text[i][0] || "").trim();
      if (!size) { if (rows.length) break; continue; }
      rows.push({ size, rowNo: top + i, q: blk.values[i][16], qText: blk.text[i][16], qFormula: blk.formulas[i][16] });
    }
    return { top, rows };
  }

  // ---- Billet Stock Format: the day's block ("As on DD.MM.YYYY" in column R) -> its "Total" line (G and H) ----
  async function readBilletTotal(wb, token, iso) {
    const sh = sheetUrl(wb, "Billet Stock Format");
    const d = await graphFetch(`${sh}/range(address='A1:R2500')?$select=text`, token, { noCache: true });
    let asOn = -1;
    d.text.forEach((r, i) => {
      const m = /As\s*on\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/i.exec(String(r[17] || ""));
      if (m) { let y = +m[3]; if (y < 100) y += 2000; if (`${y}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}` === iso) asOn = i; }
    });
    if (asOn < 0) return null;
    let tot = -1;
    for (let i = Math.max(0, asOn - 6); i < Math.min(d.text.length, asOn + 45); i++) if (/^\s*total\s*$/i.test(String(d.text[i][0] || ""))) { tot = i; break; }
    if (tot < 0) return null;
    const row = tot + 1;
    const gh = await graphFetch(`${sh}/range(address='G${row}:H${row}')?$select=values,formulas`, token, { noCache: true });
    return { row, g: gh.values[0][0], h: gh.values[0][1], gF: gh.formulas[0][0], hF: gh.formulas[0][1] };
  }

  // the same amount added at the end of a cell's own formula (a typed number becomes =number+x)
  const appendAdj = (f, diff) => { const t = f == null ? "" : String(f).trim(); const d = (diff > 0 ? "+" : "-") + String(+Math.abs(diff).toFixed(3)); return (t.startsWith("=") ? t : "=" + (t === "" ? "0" : t)) + d; };
  // only a rounding-size difference (0.001 - 0.010 MT) is adjusted; anything bigger means a mistake somewhere, so it is only reported
  const BILLET_ADJ_MAX = 0.010;

  // ---- preview ----
  function previewHtml() {
    const j = job, show = j.erp.rows.slice(0, 8), more = j.erp.rows.length - show.length;
    let h = `<div class="erpBox"><h4>📄 ${esc(j.fileName)}${j.erp.wsName ? " · " + esc(j.erp.wsName) : ""}</h4>
      ${j.erp.converted ? `<div>🔄 The ERP file is in list form (one line per item and Tnature) - turned into the usual table (${j.erp.converted} items: Opening, Receipts, Issues, Closing), so FC Report, Billet Stock and the ERP weight read it as always.</div>` : ""}
      <div>${j.erp.rows.length} rows × ${j.erp.cols} columns → <b>${esc(j.fileLabel)}</b> → sheet <b>${esc(target)}</b> (whole sheet cleared, then written from A1).</div>
      <div class="erpScroll" style="margin-top:8px;"><table class="erpT"><tr><th></th>${Array.from({ length: Math.min(j.erp.cols, 26) }, (_, c) => `<th>${colL(c)}</th>`).join("")}</tr>
      ${show.map((r, i) => `<tr><th>${i + 1}</th>${r.slice(0, 26).map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</table></div>
      ${more > 0 ? `<div style="font-size:12px;opacity:.8;margin-top:4px;">… and ${more} more rows</div>` : ""}</div>`;
    if (j.q) {
      if (j.q.error) h += `<div class="erpBox">⚠️ Daily Stock not changed: ${esc(j.q.error)}</div>`;
      else {
        const opts = sel => `<option value="">— leave Q as it is —</option>` + j.q.items.map(it => `<option value="${esc(it.key)}"${it.key === sel ? " selected" : ""}>${esc(it.label)}${it.value != null ? " = " + it.value : ""}</option>`).join("");
        h += `<div class="erpBox"><h4>📦 Daily Stock ${esc(j.iso.split("-").reverse().join("."))} · ERP weight (Q) = Durgesh "${esc(j.q.colName)}"</h4>
          <div style="font-size:12px;opacity:.85;margin-bottom:6px;">Pick the ERP item for each size once - it is remembered on this device. More than one item for a size = their total.</div>
          ${j.q.rows.map((r, i) => `<div class="erpRow" data-i="${i}">
            <div class="erpRowHead"><b>${esc(r.size)}</b><span class="num">Q: ${typeof r.q === "number" ? r.q.toFixed(3) : esc(r.qText || "blank")} → <b class="${r.newF != null ? "chg" : ""}">${r.newQ == null ? "no change" : r.newQ.toFixed(3)}</b></span></div>
            <div class="erpF">${r.qErr ? "⚠️ " + esc(r.qErr) : r.newF == null ? (r.newQ == null ? "" : "same as ERP - cell not touched") : `${esc(r.qFormula === "" || r.qFormula == null ? "(blank)" : r.qFormula)} → <b>${esc(r.newF)}</b>`}</div>
            ${(r.keys.length ? r.keys : [""]).map(k => `<select class="erpSel">${opts(k)}</select>`).join("")}
            <div class="erpRowFoot"><button type="button" class="secondary addItem">+ item</button>${r.guessed ? '<span class="erpGuess">guessed - please check</span>' : ""}</div>
          </div>`).join("")}</div>`;
      }
    }
    if (j.b) {
      if (j.b.error) h += `<div class="erpBox">⚠️ Billet Stock Format not changed: ${esc(j.b.error)}</div>`;
      else {
        const qDelta = j.q && j.q.rows ? j.q.rows.reduce((a, r) => a + (r.newF != null && typeof r.q === "number" && r.newQ != null ? r.newQ - r.q : 0), 0) : 0;
        const est = typeof j.b.h === "number" ? r3(j.b.target - (j.b.h + qDelta)) : null;
        h += `<div class="erpBox"><h4>🧱 Billet Stock Format ${esc(j.iso.split("-").reverse().join("."))} · Total line (row ${j.b.row})</h4>
          <div>ERP billets total (${j.b.count} "BILLET" items with item code in column B starting F, 4-CLOSING): <b>${j.b.target.toFixed(3)}</b></div>
          ${j.b.skipped ? `<div style="font-size:12px;opacity:.85;">Skipped ${j.b.skipped} "BILLET" item(s) whose item code (column B) does not start with F (e.g. R…) - ${j.b.skippedWt.toFixed(3)} MT</div>` : ""}
          ${j.b.endCut ? `<div style="font-size:12px;opacity:.85;">Not counted: ${j.b.endCut} "BILLET END CUT" item(s) - ${j.b.endCutWt.toFixed(3)} MT</div>` : ""}
          <div>H total now: <b>${typeof j.b.h === "number" ? j.b.h.toFixed(3) : esc(j.b.h)}</b> · G total now: <b>${typeof j.b.g === "number" ? j.b.g.toFixed(3) : esc(j.b.g)}</b></div>
          <div style="margin-top:4px;">A difference of 0.001 - 0.010 MT (after the Daily Stock Q changes) is added at the end of <b>both</b> H and G; a bigger difference is <b>not</b> added - it only shows a warning${est == null ? "" : ` - expected about <b class="${Math.abs(est) >= 0.0005 ? "chg" : ""}">${est >= 0 ? "+" : ""}${est.toFixed(3)}</b> MT${Math.abs(est) > BILLET_ADJ_MAX + 0.0005 ? " ⚠️ too big - will NOT be added, please check" : ""}`}.</div>
          <div class="erpF">H: ${esc(j.b.hF)} · G: ${esc(j.b.gF)}</div></div>`;
      }
    }
    return h;
  }
  function recalcQ() {
    if (!job || !job.q || job.q.error) return;
    const byKey = new Map(job.q.items.map(it => [it.key, it]));
    job.q.rows.forEach(r => {
      const keys = r.keys.filter(k => byKey.has(k));
      r.newQ = keys.length ? r3(keys.reduce((a, k) => a + (byKey.get(k).value || 0), 0)) : null;
      r.newF = qFormula(r);
    });
  }
  // Q keeps its own formula; only the difference to the ERP value is added at its end: =34.364-1.28  ->  =34.364-1.28+0.001
  function qFormula(r) {
    r.qErr = "";
    if (r.newQ == null) return null;                                   // no ERP item chosen -> cell untouched
    const f = r.qFormula == null ? "" : String(r.qFormula).trim();
    const cur = typeof r.q === "number" ? r.q : (String(r.q == null ? "" : r.q).trim() === "" ? null : NaN);
    if (cur !== null && isNaN(cur)) { r.qErr = "Q is not a number - left as it is"; return null; }
    if (cur === null && f === "") return r.newQ === 0 ? null : r.newQ;   // empty cell -> just the ERP value (stays empty when ERP is 0)
    const sm = /^(=.*\))\s*([+-])\s*(\d+(?:\.\d+)?)\s*$/.exec(f);
    if (sm && cur !== null) {                                          // =(Q68+K86+M86)-(G86+I86)-339.791 : the earlier adjustment is replaced
      const base = cur - (sm[2] === "-" ? -1 : 1) * +sm[3], d2 = r3(r.newQ - base);
      const nf = sm[1] + (Math.abs(d2) >= 0.0005 ? (d2 > 0 ? "+" : "-") + String(+Math.abs(d2).toFixed(3)) : "");
      return nf === f ? null : nf;
    }
    const diff = r3(r.newQ - cur);
    if (Math.abs(diff) < 0.0005) return null;                         // already equal -> untouched
    const d = (diff > 0 ? "+" : "-") + String(+Math.abs(diff).toFixed(3));
    return (f.startsWith("=") ? f : "=" + (f === "" ? "0" : f)) + d;  // a typed number 74.87 becomes =74.87+0.001
  }
  function render() { $("erpPreview").innerHTML = job ? previewHtml() : ""; $("erpApplyRow").classList.toggle("hidden", !job); }
  $("erpPreview").addEventListener("change", e => {
    if (!e.target.classList.contains("erpSel")) return;
    const tr = e.target.closest(".erpRow"), r = job.q.rows[+tr.dataset.i];
    r.keys = Array.from(tr.querySelectorAll(".erpSel")).map(s => s.value).filter(Boolean); r.guessed = false;
    recalcQ(); render();
  });
  $("erpPreview").addEventListener("click", e => {
    if (!e.target.classList.contains("addItem")) return;
    const row = e.target.closest(".erpRow"), sel = row.querySelector(".erpSel").cloneNode(true); sel.value = "";
    row.insertBefore(sel, e.target.parentElement);
  });

  async function prepare(file) {
    job = null; render(); $("erpUndoRow").classList.add("hidden");
    say("⏳ Reading " + esc(file.name) + "…");
    const erp = readErp(new Uint8Array(await file.arrayBuffer()), file.name);
    if (!erp.rows.length) throw new Error("the ERP file is empty");
    // Durgesh always gets the usual table (Opening / Receipt / Issue / Closing columns). A list-form report (one line per Tnature)
    // is a different ERP report chosen by mistake -> stop before anything in the file is changed.
    if (target === "Durgesh" && longToWide(erp.rows)) throw new Error("this ERP file is in list form (one line per item and Tnature: Tnature Group | Tnature | Qty). The Durgesh sheet needs the usual ERP stock report with the Opening / Receipt / Issue / Closing columns - please choose that file. Nothing was changed.");
    const guess = erpDateGuess(erp.rows);
    if (guess && guess !== $("erpDate").value && confirm(`The ERP file says ${guess.split("-").reverse().join(".")}.\n\nUse this date for the Daily Stock / Reports file?\n(Cancel = keep ${$("erpDate").value.split("-").reverse().join(".")})`)) $("erpDate").value = guess;
    const iso = $("erpDate").value; if (!iso) throw new Error("pick the date first");
    const [y, m] = iso.split("-").map(Number);
    const token = await getToken();
    const path = await detectFilePathForMonth(token, y, m - 1);
    if (!path) throw new Error(`the Reports file for ${MONTH_ABBR[m - 1]} ${y} was not found`);
    const wb = await resolveWorkbook(token, path);
    const sheets = await graphFetch(`${wb}/worksheets?$select=name`, token, { noCache: true });
    if (!(sheets.value || []).some(w => w.name === target)) throw new Error(`sheet "${target}" not found in ${path.split("/").pop()}`);
    job = { target, fileName: file.name, fileLabel: path.split("/").pop(), path, wb, iso, erp, q: null };
    if (target === "Durgesh") {
      const d = durgeshItems(erp.rows);
      if (d.error) job.q = { error: d.error };
      else {
        const blk = await readStockBlock(wb, token, iso);
        if (!blk) job.q = { error: `no Daily Stock block for ${iso.split("-").reverse().join(".")} - create the day's block first, or pick another date` };
        else {
          const map = loadMap(), keys = new Set(d.items.map(it => it.key));
          const rows = blk.rows.map(r => {
            const saved = (map[normSize(r.size)] || []).filter(k => keys.has(k));
            const g = saved.length ? saved : guessFor(r.size, d.items);
            return { ...r, keys: g, guessed: !saved.length && g.length > 0 };
          });
          job.q = { ...d, top: blk.top, rows };
          recalcQ();
        }
        // Billet Stock Format total (G / H) of the same day
        if (!d.billetCount) job.b = { error: 'no "BILLET" item with an item code (column B) starting with F in the ERP file' };
        else {
          const bt = await readBilletTotal(wb, token, iso);
          job.b = bt ? { ...bt, target: d.billetTotal, count: d.billetCount, skipped: d.billetSkipped, skippedWt: d.billetSkippedWt, endCut: d.endCut, endCutWt: d.endCutWt } : { error: `no Billet Stock Format block "As on ${iso.split("-").reverse().join(".")}" with a Total line` };
        }
      }
    }
    render();
    say(`Check the preview, then tap <b>✅ Write to Reports file</b>.`);
  }

  async function writeGrid(sh, token, rows, cols) {
    const CH = 400;
    for (let i = 0; i < rows.length; i += CH) {
      const part = rows.slice(i, i + CH).map(r => { const a = r.slice(); while (a.length < cols) a.push(""); return a; });
      await graphFetch(`${sh}/range(address='A${i + 1}:${colL(cols - 1)}${i + part.length}')`, token, { method: "PATCH", body: JSON.stringify({ values: part }) });
    }
  }
  async function apply() {
    if (!job) return;
    const j = job, btn = $("erpApplyBtn"); btn.disabled = true;
    try {
      const token = await getToken(), sh = sheetUrl(j.wb, j.target);
      say(`⏳ Saving a copy of the old ${esc(j.target)} sheet (for Undo)…`);
      const used = await graphFetch(`${sh}/usedRange?$select=address,values`, token, { noCache: true });
      const addr = String(used.address || "").split("!").pop() || "A1";
      const u = { wb: j.wb, target: j.target, fileLabel: j.fileLabel, addr, values: used.values, q: null };
      say(`⏳ Clearing ${esc(j.target)} and writing ${j.erp.rows.length} ERP rows…`);
      await graphFetch(`${sh}/range(address='${addr}')/clear`, token, { method: "POST", body: JSON.stringify({ applyTo: "Contents" }) });
      await writeGrid(sh, token, j.erp.rows, j.erp.cols);
      let qMsg = "";
      if (j.q && !j.q.error) {
        const map = loadMap(); j.q.rows.forEach(r => { map[normSize(r.size)] = r.keys; }); saveMap(map);
        const ch = j.q.rows.filter(r => r.newF != null);
        if (ch.length) {
          const first = j.q.rows[0].rowNo, last = j.q.rows[j.q.rows.length - 1].rowNo;
          u.q = { first, last, formulas: j.q.rows.map(r => [r.qFormula === "" || r.qFormula == null ? "" : r.qFormula]), changed: j.q.rows.map((r, i) => r.newF != null ? i : -1).filter(i => i >= 0) };
          for (const r of ch)   // one cell at a time: other Q cells are never touched
            await graphFetch(`${sheetUrl(j.wb, "Daily Stock")}/range(address='Q${r.rowNo}')`, token, { method: "PATCH", body: JSON.stringify({ formulas: [[r.newF]] }) });
          qMsg = `<br>📦 Daily Stock ${esc(j.iso.split("-").reverse().join("."))}: ERP weight (Q) adjusted in ${ch.length} cell(s) - ${ch.map(r => esc(r.size.replace(/\s+/g, " ")) + " " + esc(String(r.newF))).join(", ")}.`;
        } else qMsg = `<br>📦 Daily Stock: all ERP weights already match - nothing changed.`;
      } else if (j.q && j.q.error) qMsg = `<br>⚠️ Daily Stock not changed: ${esc(j.q.error)}`;
      // Billet Stock Format: re-read H after the Q changes; a 0.001 - 0.010 MT difference goes at the end of H and G, a bigger one is only reported
      if (j.b && !j.b.error) {
        const now = await readBilletTotal(j.wb, token, j.iso);
        if (!now || typeof now.h !== "number") qMsg += `<br>⚠️ Billet Stock Format not changed: Total line could not be read again.`;
        else {
          const diff = r3(j.b.target - now.h);
          if (Math.abs(diff) < 0.0005) qMsg += `<br>🧱 Billet Stock Format: H total already equals the ERP billets total (${j.b.target.toFixed(3)}) - nothing changed.`;
          else if (Math.abs(diff) > BILLET_ADJ_MAX + 0.0005) qMsg += `<br>⚠️ Billet Stock Format (row ${now.row}) NOT changed: ERP billets total ${j.b.target.toFixed(3)} vs H total ${now.h.toFixed(3)} = difference ${diff > 0 ? "+" : ""}${diff.toFixed(3)} MT - more than 0.010 MT, so something is wrong; please check the stock / ERP items.`;
          else {
            const nH = appendAdj(now.hF, diff), nG = appendAdj(now.gF, diff), bs = sheetUrl(j.wb, "Billet Stock Format");
            u.b = { row: now.row, gF: now.gF, hF: now.hF };
            await graphFetch(`${bs}/range(address='H${now.row}')`, token, { method: "PATCH", body: JSON.stringify({ formulas: [[nH]] }) });
            await graphFetch(`${bs}/range(address='G${now.row}')`, token, { method: "PATCH", body: JSON.stringify({ formulas: [[nG]] }) });
            qMsg += `<br>🧱 Billet Stock Format (row ${now.row}): ${diff > 0 ? "+" : ""}${diff.toFixed(3)} added to H (${esc(nH)}) and G (${esc(nG)}).`;
          }
        }
      } else if (j.b && j.b.error) qMsg += `<br>⚠️ Billet Stock Format not changed: ${esc(j.b.error)}`;
      undo = u; job = null; render();
      $("erpUndoRow").classList.remove("hidden");
      say(`✅ ${esc(j.fileLabel)} → <b>${esc(j.target)}</b> updated from ${esc(j.fileName)} (${j.erp.rows.length} rows).${qMsg}`, "ok");
    } catch (e) {
      say("❌ " + esc(e && e.message ? e.message : e), "err");
    } finally { btn.disabled = false; }
  }
  async function doUndo() {
    if (!undo || !confirm(`Undo: put back the old ${undo.target} sheet${undo.q ? ", the old Daily Stock ERP weights" : ""}${undo.b ? " and the old Billet Stock Format totals" : ""}?`)) return;
    const u = undo;
    try {
      const token = await getToken(), sh = sheetUrl(u.wb, u.target);
      say("⏳ Undoing…");
      const used = await graphFetch(`${sh}/usedRange?$select=address`, token, { noCache: true });
      await graphFetch(`${sh}/range(address='${String(used.address || "A1").split("!").pop()}')/clear`, token, { method: "POST", body: JSON.stringify({ applyTo: "Contents" }) });
      const start = u.addr.split(":")[0];
      if (u.values && u.values.length && !(u.values.length === 1 && u.values[0].length === 1 && u.values[0][0] === "")) {
        const c0 = XLSX.utils.decode_cell(start);
        const endC = colL(c0.c + u.values[0].length - 1), endR = c0.r + u.values.length;
        await graphFetch(`${sh}/range(address='${start}:${endC}${endR}')`, token, { method: "PATCH", body: JSON.stringify({ values: u.values }) });
      }
      if (u.q) for (const i of u.q.changed)   // only the cells this upload changed
        await graphFetch(`${sheetUrl(u.wb, "Daily Stock")}/range(address='Q${u.q.first + i}')`, token, { method: "PATCH", body: JSON.stringify({ formulas: [u.q.formulas[i]] }) });
      if (u.b) {
        const bs = sheetUrl(u.wb, "Billet Stock Format");
        await graphFetch(`${bs}/range(address='H${u.b.row}')`, token, { method: "PATCH", body: JSON.stringify({ formulas: [[u.b.hF]] }) });
        await graphFetch(`${bs}/range(address='G${u.b.row}')`, token, { method: "PATCH", body: JSON.stringify({ formulas: [[u.b.gF]] }) });
      }
      undo = null; $("erpUndoRow").classList.add("hidden");
      say(`↩️ Undone - ${esc(u.target)}${u.q ? ", Daily Stock" : ""}${u.b ? ", Billet Stock Format" : ""} are back as they were.`, "ok");
    } catch (e) { say("❌ Undo failed: " + esc(e && e.message ? e.message : e), "err"); }
  }

  const pick = t => { target = t; $("erpFileInput").value = ""; $("erpFileInput").click(); };
  $("erpDurgeshBtn").addEventListener("click", () => pick("Durgesh"));
  $("erpM2mBtn").addEventListener("click", () => pick("M2M"));
  $("erpFileInput").addEventListener("change", async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { await prepare(f); } catch (err) { job = null; render(); say("❌ " + esc(err && err.message ? err.message : err), "err"); }
  });
  $("erpApplyBtn").addEventListener("click", apply);
  $("erpCancelBtn").addEventListener("click", () => { job = null; render(); say("Cancelled - nothing was written."); });
  $("erpUndoBtn").addEventListener("click", doUndo);
  window._erpTest = { readErp, durgeshItems, guessFor, erpDateGuess, longToWide, qFormula };
})();
