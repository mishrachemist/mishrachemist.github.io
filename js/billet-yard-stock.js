/* ===================== BILLET YARD STOCK =====================
   WhatsApp message "Billet Yard Stock / Dated: 12.11.26 / 182 Pcs 130x3m ..." ->
   Daily Stock block of that date, column N (MANUAL STOCK PCS) of each size in the message:
   whole pcs (nearest) of N vs message pcs; the difference goes at the end of N's own formula
   =((J25+L25+N7)-(F25+H25))  ->  =((J25+L25+N7)-(F25+H25))+1 . A second run replaces that day's
   earlier +/- instead of adding another one. Sizes not in the message are not touched.
   Preview first; only the changed N cells are written; Undo puts the old formulas back. ===== */
(function billetYardStock() {
  const $ = id => document.getElementById(id);
  if (!$("ysCheckBtn")) return;
  const esc = htmlEsc;
  let job = null, undo = null;
  const say = (t, cls) => { const st = $("ysStatus"); st.className = cls || ""; st.innerHTML = t; };
  const sheetUrl = (wb, name) => `${wb}/worksheets('${encodeURIComponent(String(name).replace(/'/g, "''"))}')`;
  const dmy = iso => iso.split("-").reverse().join(".");
  const sizeKey = (sec, len) => `${+sec}X${+len}`;                       // 130X3, 110X5.25
  const sheetKey = t => { const m = /^(110|130|160)\s*X\s*(\d+(?:\.\d+)?)$/i.exec(String(t || "").trim().replace(/\s+/g, " ")); return m ? sizeKey(m[1], m[2]) : String(t || "").toUpperCase().replace(/\s+/g, ""); };
  const sgn = d => (d > 0 ? "+" : "-") + Math.abs(d);

  function parseMsg(text) {
    const out = { iso: null, heat: "", items: [], bad: [] };
    const dm = /Dated?\s*[:\-.]?\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/i.exec(text);
    if (dm) { let y = +dm[3]; if (y < 100) y += 2000; out.iso = `${y}-${String(+dm[2]).padStart(2, "0")}-${String(+dm[1]).padStart(2, "0")}`; }
    const hm = /heat\s*no\.?\s*[:\-]?\s*([\d.]+)/i.exec(text); if (hm) out.heat = hm[1];
    const seen = new Map();
    String(text).split(/\r?\n/).forEach(raw => {
      const line = raw.replace(/[‎‏‪-‮]/g, "").trim();
      if (!line) return;
      let m = /^(\d+)\s*pcs?\.?\s*(110|130|160)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(?:m|mtr|mtrs|meter|metre)?\.?$/i.exec(line);
      let pcs, sec, len;
      if (m) { pcs = +m[1]; sec = m[2]; len = m[3]; }
      else if ((m = /^(110|130|160)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(?:m|mtr|mtrs|meter|metre)?\.?\s*[-:=]?\s*(\d+)\s*pcs?\.?$/i.exec(line))) { sec = m[1]; len = m[2]; pcs = +m[3]; }
      else { if (/pcs?\b/i.test(line) && /\d/.test(line)) out.bad.push(line); return; }
      const key = sizeKey(sec, len);
      if (seen.has(key)) { seen.get(key).dup = true; out.bad.push(line + "  (size given twice)"); return; }
      const it = { key, label: `${sec} x ${+len}m`, pcs, line };
      seen.set(key, it); out.items.push(it);
    });
    return out;
  }

  async function readBlock(wb, token, iso) {
    const sh = sheetUrl(wb, "Daily Stock");
    const colA = await graphFetch(`${sh}/range(address='A1:A2000')?$select=values,text`, token, { noCache: true });
    let top = -1;
    colA.values.forEach((r, i) => {
      const v = r[0];
      let d = null;
      if (typeof v === "number" && v > 40000) d = excelSerialToISODate(v);
      else { const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(String(v || "").trim()); if (m) { let y = +m[3]; if (y < 100) y += 2000; d = `${y}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`; } }
      if (d === iso) top = i + 1;
    });
    if (top < 0) return null;
    const blk = await graphFetch(`${sh}/range(address='A${top}:N${top + 17}')?$select=values,formulas,text`, token, { noCache: true });
    const rows = [];
    for (let i = 3; i < blk.values.length; i++) {
      const size = String(blk.text[i][0] || "").trim();
      if (!size) { if (rows.length) break; continue; }
      rows.push({ size, key: sheetKey(size), rowNo: top + i, n: blk.values[i][13], nText: blk.text[i][13], nF: blk.formulas[i][13] });
    }
    return { top, rows };
  }

  // new N formula for a target whole-pcs count, or null when nothing has to change
  function newFormula(r, target) {
    r.err = "";
    const f = r.nF == null ? "" : String(r.nF).trim();
    const cur = typeof r.n === "number" ? r.n : (String(r.n == null ? "" : r.n).trim() === "" ? null : NaN);
    if (cur !== null && isNaN(cur)) { r.err = "N is not a number - left as it is"; return null; }
    if (cur === null && f === "") { r.cur = 0; r.diff = target; return target === 0 ? null : target; }
    const sm = /^(=.*\))\s*([+-])\s*(\d+(?:\.\d+)?)\s*$/.exec(f);
    if (sm) {                                   // that day's earlier +/- is replaced
      const base = cur - (sm[2] === "-" ? -1 : 1) * +sm[3];
      r.cur = Math.round(cur); r.diff = target - r.cur;
      const d2 = target - Math.round(base);
      const nf = sm[1] + (d2 ? sgn(d2) : "");
      return nf === f ? null : nf;
    }
    r.cur = Math.round(cur); r.diff = target - r.cur;
    if (!r.diff) return null;
    return (f.startsWith("=") ? f : "=" + (f === "" ? "0" : f)) + sgn(r.diff);   // a typed 182 becomes =182+1
  }

  function render() {
    $("ysApplyRow").classList.toggle("hidden", !(job && job.changes.length));
    if (!job) { $("ysPreview").innerHTML = ""; return; }
    const j = job;
    let h = `<table class="ysT"><tr><th>Size</th><th>Yard</th><th>Sheet N</th><th>Adjust</th></tr>`;
    j.rows.forEach(r => {
      const cls = r.diff > 0 ? "ysPlus" : r.diff < 0 ? "ysMinus" : "";
      h += `<tr><td>${esc(r.size)}</td><td>${r.target}</td><td>${r.err ? "⚠️" : esc(r.nText === "" ? "0" : r.nText)}</td><td class="${cls}">${r.err ? "" : r.diff ? sgn(r.diff) : "✓"}</td></tr>`;
      if (r.err) h += `<tr><td colspan="4" class="ysF">⚠️ ${esc(r.err)}</td></tr>`;
      else if (r.newF != null) h += `<tr><td colspan="4" class="ysF">N${r.rowNo}: ${esc(r.nF === "" || r.nF == null ? "(blank)" : r.nF)} → <b>${esc(String(r.newF))}</b></td></tr>`;
    });
    h += `</table>`;
    if (j.missing.length) h += `<div class="ysNote">⚠️ Not in the Daily Stock block: ${j.missing.map(it => esc(it.label)).join(", ")}</div>`;
    if (j.bad.length) h += `<div class="ysNote">⚠️ Line(s) not read: ${j.bad.map(esc).join(" · ")}</div>`;
    if (j.left.length) h += `<div class="ysNote">Not in the message (left as it is): ${j.left.map(esc).join(", ")}</div>`;
    $("ysPreview").innerHTML = h;
  }

  async function check() {
    job = null; render(); $("ysUndoRow").classList.add("hidden");
    const p = parseMsg($("ysMsg").value);
    if (p.iso && !$("ysDate").value) $("ysDate").value = p.iso;
    if (p.iso && p.iso !== $("ysDate").value && confirm(`The message says ${dmy(p.iso)}.\n\nUse this date?\n(Cancel = keep ${dmy($("ysDate").value)})`)) $("ysDate").value = p.iso;
    const iso = $("ysDate").value;
    if (!p.items.length) throw new Error("no size line found in the message (like \"182 Pcs 130x3m\")");
    if (!iso) throw new Error("pick the date");
    say("⏳ Reading Daily Stock " + esc(dmy(iso)) + "…");
    const [y, m] = iso.split("-").map(Number);
    const token = await getToken();
    const path = await detectFilePathForMonth(token, y, m - 1);
    if (!path) throw new Error(`the Reports file for ${MONTH_ABBR[m - 1]} ${y} was not found`);
    const wb = await resolveWorkbook(token, path);
    const blk = await readBlock(wb, token, iso);
    if (!blk) throw new Error(`no Daily Stock block for ${dmy(iso)} - create the day's block first, or pick another date`);
    const byKey = new Map(blk.rows.map(r => [r.key, r]));
    const rows = [], missing = [];
    p.items.forEach(it => {
      if (it.dup) return;
      const r = byKey.get(it.key);
      if (!r) { missing.push(it); return; }
      const row = { ...r, target: it.pcs };
      row.newF = newFormula(row, it.pcs);
      rows.push(row);
    });
    const used = new Set(rows.map(r => r.key));
    const left = blk.rows.filter(r => !used.has(r.key) && typeof r.n === "number" && Math.round(r.n) !== 0).map(r => `${r.size.replace(/\s+/g, " ")} (${Math.round(r.n)})`);
    job = { iso, wb, path, heat: p.heat, rows, missing, bad: p.bad, left, changes: rows.filter(r => r.newF != null && !r.err) };
    render();
    const head = `📦 ${esc(path.split("/").pop())} · Daily Stock ${esc(dmy(iso))}${p.heat ? ` · Heat no. ${esc(p.heat)} till` : ""}`;
    say(job.changes.length ? `${head}<br>${job.changes.length} size(s) to adjust.` : `${head}<br>✅ All sizes already match - nothing to change.`, job.changes.length ? "" : "ok");
  }

  async function apply() {
    if (!job || !job.changes.length) return;
    const j = job, btn = $("ysApplyBtn"); btn.disabled = true;
    try {
      const token = await getToken(), sh = sheetUrl(j.wb, "Daily Stock");
      const u = { wb: j.wb, iso: j.iso, cells: [] };
      for (const r of j.changes) {
        say(`⏳ ${esc(r.size)} (N${r.rowNo})…`);
        await graphFetch(`${sh}/range(address='N${r.rowNo}')`, token, { method: "PATCH", body: JSON.stringify({ formulas: [[r.newF]] }) });
        u.cells.push({ rowNo: r.rowNo, size: r.size, old: r.nF == null ? "" : r.nF });
      }
      // read N back: whole pcs must now equal the yard count
      const first = Math.min(...j.changes.map(r => r.rowNo)), last = Math.max(...j.changes.map(r => r.rowNo));
      const back = await graphFetch(`${sh}/range(address='N${first}:N${last}')?$select=values`, token, { noCache: true });
      const wrong = j.changes.filter(r => { const v = back.values[r.rowNo - first][0]; return typeof v !== "number" || Math.round(v) !== r.target; });
      undo = u; job = null; render();
      $("ysUndoRow").classList.remove("hidden");
      say(`✅ Daily Stock ${esc(dmy(j.iso))}: ${j.changes.length} cell(s) adjusted - ${j.changes.map(r => `${esc(r.size.replace(/\s+/g, " "))} ${sgn(r.diff)}`).join(", ")}.` +
        (wrong.length ? `<br>⚠️ Still not equal after the change: ${wrong.map(r => esc(r.size.replace(/\s+/g, " "))).join(", ")} - please check.` : ""), wrong.length ? "err" : "ok");
    } catch (e) {
      say("❌ " + esc(e && e.message ? e.message : e), "err");
    } finally { btn.disabled = false; }
  }

  async function doUndo() {
    if (!undo || !confirm(`Undo: put back the old N formulas of Daily Stock ${dmy(undo.iso)}?`)) return;
    const u = undo;
    try {
      const token = await getToken(), sh = sheetUrl(u.wb, "Daily Stock");
      say("⏳ Undoing…");
      for (const c of u.cells) await graphFetch(`${sh}/range(address='N${c.rowNo}')`, token, { method: "PATCH", body: JSON.stringify({ formulas: [[c.old]] }) });
      undo = null; $("ysUndoRow").classList.add("hidden");
      say(`↩️ Undone - ${u.cells.length} N cell(s) of Daily Stock ${esc(dmy(u.iso))} are back as they were.`, "ok");
    } catch (e) { say("❌ Undo failed: " + esc(e && e.message ? e.message : e), "err"); }
  }

  $("ysMsg").addEventListener("input", () => { const p = parseMsg($("ysMsg").value); if (p.iso) $("ysDate").value = p.iso; job = null; render(); say(""); });
  $("ysDate").addEventListener("change", () => { job = null; render(); say(""); });
  $("ysCheckBtn").addEventListener("click", async () => {
    const b = $("ysCheckBtn"); b.disabled = true;
    try { await check(); } catch (e) { job = null; render(); say("❌ " + esc(e && e.message ? e.message : e), "err"); }
    finally { b.disabled = false; }
  });
  $("ysApplyBtn").addEventListener("click", apply);
  $("ysUndoBtn").addEventListener("click", doUndo);
  $("ysClearBtn").addEventListener("click", () => { $("ysMsg").value = ""; job = null; render(); say(""); });
})();
