/* Moltrix → Lighthouse ERP filler  (loaded by the "Moltrix ERP" bookmark on the ERP page)
   1. Bookmark loads this file on the ERP page and shows a small panel.
   2. "Open Moltrix" opens Moltrix (already signed in to OneDrive); there you pick the
      date and press "Send to ERP". Moltrix sends the ERP Entry Sheet here with postMessage.
   3. Tick the heats and press Start. For every heat the filler creates a Production Entry
      (series Q2) through the ERP's own screens, fills the billet lines and the RM
      consumption, and saves it (Unapproved). Every value is read back and checked
      before saving; a heat with any problem is NOT saved and is reported.
   Modes:  full – billets + RM consumption (the ERP refuses a Production Entry without
                  at least one RM line, so this is the normal mode)
           prod – billets only (only works if the ERP admin makes RM consumption optional)
           cons – open the heat's saved voucher and add the RM lines that are missing.
           qc   – Production QC (series 2G, HEAT WISE ANALYSIS): one entry per heat on the heat's
                  first billet line, the BIS Doc Final row (C Mn P S Si N S+P CE, Bend, Camber,
                  Length, Width, Freedom From Defects, Grade if asked), QC Time = heat date
                  10:00 (shift A), every test Pass. Needs the production voucher approved (only
                  approved vouchers are in the ERP's Batch No. list). Start on Production QC.   */
(() => {
  "use strict";
  const VERSION = "2026.11.07.2";
  const APP_ORIGIN = "https://mishrachemist.github.io";
  const APP_URL = APP_ORIGIN + "/?erpbridge=1";
  const DONE_KEY = "moltrixErpDone";   // date|heat -> voucher no (this browser only)
  const QC_DONE_KEY = "moltrixErpQcDone"; // date|heat -> Production QC voucher no
  if (window.MZF && window.MZF.busy) { window.MZF.show(); return; }

  /* ================= helpers ================= */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const vis = e => !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length));
  const txt = e => (e && e.innerText || "").replace(/\s+/g, " ").trim();
  let STOP = false;
  const chk = () => { if (STOP) throw new Error("Stopped by user"); };
  async function waitFor(fn, ms = 15000, what = "") {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { chk(); let v; try { v = fn(); } catch (e) { if (/^ERP said/.test(e.message)) throw e; v = null; } if (v) return v; await sleep(150); }
    const a = alertBox();
    throw new Error("Timed out waiting for " + (what || "the ERP") + (a ? ` (ERP message: ${a.text.replace(/Know More.*$/i, "").slice(0, 160)})` : ""));
  }
  let DEBUG = false, dbgT = Date.now();
  const dbg = m => { if (!DEBUG) return; const t = Date.now(); console.log(`[MZF +${((t - dbgT) / 1000).toFixed(1)}s] ${m}`); dbgT = t; };
  const mouse = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  const click = el => { mouse(el, "mousedown"); mouse(el, "mouseup"); mouse(el, "click"); };
  const keyEv = (el, k) => { const kc = { Tab: 9, Enter: 13 }[k] || 0;
    ["keydown", "keyup"].forEach(t => el.dispatchEvent(new KeyboardEvent(t, { key: k, code: k, keyCode: kc, which: kc, bubbles: true, cancelable: true }))); };
  const setIn = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  const setTa = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
  async function typeInto(inp, v, wait = 350) {
    inp.focus(); (inp.tagName === "TEXTAREA" ? setTa : setIn).call(inp, String(v));
    inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true }));
    keyEv(inp, "Tab");
    inp.dispatchEvent(new FocusEvent("blur", { bubbles: true })); inp.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); inp.blur();
    await sleep(wait);
  }
  const btn = (re, root = document) => [...root.querySelectorAll("ion-button, button")].filter(vis).find(b => re.test(txt(b)));
  const near = (a, b, tol) => Math.abs(+a - +b) <= tol;

  /* ================= ERP message boxes ================= */
  function alertBox() {
    const box = [...document.querySelectorAll("ion-popover.modelalert-box, ion-content.alert-boxes")].map(b => b.closest("ion-popover") || b).find(vis);
    if (!box) return null;
    const t = txt(box);
    return { box, text: t, kind: /saved successfully|updated successfully/i.test(t) ? "ok" : /which figure do you want to change/i.test(t) ? "opt" : "err" };
  }
  async function closeAlert(a) {
    const ok = btn(/^OK$/i, a.box); if (ok) click(ok);
    await waitFor(() => !vis(a.box) || !document.contains(a.box), 5000, "message to close").catch(() => {}); await sleep(300);
  }
  // "Which figure do you want to change?" → keep C/F, recalculate the other quantity
  async function answerOptions() { await sleep(400); const a = alertBox(); if (a && a.kind === "opt") { const b = btn(/^Adnl Quantity$/i, a.box); if (b) click(b); await sleep(500); } }

  /* ================= lookups ================= */
  const lov = () => document.querySelector("#sigleMultiLov.show");
  async function closeLov() { const L = lov(); if (!L) return; const c = btn(/^Close$/, L); if (c) click(c); await waitFor(() => !lov(), 5000).catch(() => {}); await sleep(250); }
  const lovRows = L => [...L.querySelectorAll("tbody.single_selectlov tr")].filter(r => txt(r));
  async function pickLov(col, value) {
    const L = await waitFor(lov, 15000, "lookup panel");
    await waitFor(() => lovRows(L).length, 20000, "lookup rows");
    const heads = [...L.querySelectorAll("thead tr")].find(tr => [...tr.children].some(c => txt(c)));
    const names = [...heads.children].map(c => txt(c).replace(/\*$/, "").toLowerCase());
    const ci = names.indexOf(col.toLowerCase());
    if (ci < 0) throw new Error(`Lookup column "${col}" not found`);
    const ftr = [...L.querySelectorAll("thead tr")].find(tr => tr.querySelector("input"));
    const f = ftr && ftr.children[ci] && ftr.children[ci].querySelector("input");
    const want = String(value).trim().toUpperCase();
    const match = () => lovRows(L).find(r => { const c = r.children[ci]; return c && txt(c).toUpperCase() === want; });
    if (!match() && f) await typeInto(f, `%${value}%`, 300);
    let row;
    try { row = await waitFor(match, 15000, `"${value}"`); }
    catch (e) { await closeLov(); throw new Error(`"${value}" is not in the ERP's ${col} list`); }
    const td = [...row.children].find(t => getComputedStyle(t).display !== "none") || row.firstElementChild;
    mouse(td, "click"); mouse(td, "dblclick");
    await waitFor(() => !lov(), 15000, "lookup to close"); await sleep(600);
  }

  /* ================= header fields ================= */
  function field(label) {
    const lab = [...document.querySelectorAll("p.input-group-label, ion-label.input-group-label")].filter(vis).find(p => txt(p).replace(/\*$/, "") === label);
    if (!lab) throw new Error(`Field "${label}" not found`);
    let w = lab; for (let i = 0; i < 6 && w && !w.querySelector("input,textarea"); i++) w = w.parentElement;
    return { inp: w.querySelector("input,textarea"), wrap: w };
  }
  async function headerLov(label, col, value, expect) {
    const { inp, wrap } = field(label);
    if (lov()) await closeLov();
    click(wrap.querySelector("ion-icon[name=search]") || wrap.querySelector("ion-icon"));
    await pickLov(col, value);
    if (expect && !new RegExp(expect, "i").test(inp.value)) throw new Error(`${label} shows "${inp.value}"`);
  }

  /* ================= grids ================= */
  function grid(title) {
    const t = [...document.querySelectorAll("*")].filter(vis).find(e => e.children.length === 0 && txt(e) === title && !e.closest("ion-button,button"));
    if (!t) throw new Error(`Grid "${title}" not found`);
    let fr = t; for (let i = 0; i < 8 && fr && !fr.querySelector("table"); i++) fr = fr.parentElement;
    return fr;
  }
  // real (editable) rows have a search icon in the Item Name cell; the grey filler rows don't
  const realRows = fr => [...fr.querySelector("table").querySelectorAll("tbody tr")].filter(r => { const i = r.querySelector("input#ITEM_NAME"); return i && i.closest("td").querySelector("ion-icon[name=search]"); });
  const cell = (tr, id) => tr.querySelector("input#" + id);
  async function activate(tr) {      // the grid works on its "active" row, which follows focus -
    // always re-focus: the row can look active while the ERP's own current-row index is elsewhere
    const inp = cell(tr, "SLNO") || tr.querySelector("input");
    inp.dispatchEvent(new FocusEvent("focus", { bubbles: true })); inp.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await waitFor(() => tr.classList.contains("trow-active"), 4000, "row to become active"); await sleep(150);
  }
  async function addRow(fr) {
    const n = realRows(fr).length;
    const last = realRows(fr).slice(-1)[0]; if (last) await activate(last);
    const add = [...fr.querySelectorAll("ion-icon[name=add-circle-outline]")].find(vis); click(add.closest("ion-button") || add);
    await waitFor(() => { const a = alertBox(); if (a && a.kind === "err") throw new Error("ERP said: " + a.text.slice(0, 200)); return realRows(fr).length > n; }, 20000, "new row");
    const empties = realRows(fr).filter(r => !cell(r, "ITEM_CODE").value.trim());
    const nr = empties[empties.length - 1]; if (!nr) throw new Error("new row not found");
    await activate(nr); return nr;
  }
  // delete works on the last CLICKED row (not the focused one), so focus + click it, then make sure
  // exactly that row went
  async function deleteRow(fr, tr) {
    const codes = () => realRows(fr).map(r => cell(r, "ITEM_CODE").value.trim());
    const before = codes(), idx = realRows(fr).indexOf(tr);
    await activate(tr);
    click((cell(tr, "SLNO") || tr.querySelector("input")).closest("td")); click(tr); await sleep(400);
    const t = [...fr.querySelectorAll("ion-icon[name=trash-outline]")].find(vis); click(t.closest("ion-button") || t);
    await waitFor(() => realRows(fr).length < before.length, 5000, "row delete");
    await sleep(400);
    const want = before.slice(0, idx).concat(before.slice(idx + 1)).join("|");
    if (codes().join("|") !== want) throw new Error(`row delete went wrong (now ${codes().join(", ")})`);
  }
  async function cellLov(tr, id, col, value) {
    await activate(tr);
    const inp = cell(tr, id); if (!inp) throw new Error("Cell " + id + " not found");
    if (lov()) await closeLov();
    click(inp.closest("td").querySelector("ion-icon[name=search]")); await pickLov(col, value);
  }
  async function editCell(inp, v) {   // grid cells only take typing after a double-click
    const tr = inp.closest("tr"); if (tr && cell(tr, "SLNO")) await activate(tr);
    mouse(inp, "click"); mouse(inp, "dblclick"); await sleep(300); await typeInto(inp, v);
  }
  async function setStockType(tr, v = "R") {
    const s = tr.querySelector("ion-select"); if (!s || s.value === v) return;
    s.value = v; s.dispatchEvent(new CustomEvent("ionChange", { detail: { value: v }, bubbles: true })); await sleep(300);
  }
  async function openTab(name) {
    [...document.querySelectorAll("*")].filter(vis).filter(e => e.children.length === 0 && txt(e) === name && !e.closest("app-frame-newtable2")).forEach(t => click(t));
    await sleep(900);
  }

  /* ================= one billet line ================= */
  async function fillProdLine(tr, l) {
    dbg("line start " + l.ref);
    await cellLov(tr, "ITEM_NAME", "Item Code", l.code); dbg("item");
    if (cell(tr, "ITEM_CODE").value.trim() !== l.code) throw new Error(`item ${l.code} not set`);
    await cellLov(tr, "GODOWN_NAME", "Godown Code", "SMS2"); dbg("godown");
    await editCell(cell(tr, "BATCHNO"), l.batch);
    await editCell(cell(tr, "REF_SLNO"), l.ref);
    await setStockType(tr, "R");
    await cellLov(tr, "DEPT_NAME", "Department", "QAD03"); dbg("dept");
    await cellLov(tr, "AUM", "Tranum", "PCS"); dbg("aum");
    await sleep(500);
    await editCell(cell(tr, "AQTYRECD"), String(l.pcs)); await answerOptions();
    for (let k = 0; k < 5; k++) {   // the ERP reloads the master C/F a moment later - keep ours
      await sleep(600);
      if (near(cell(tr, "AUMTOUM").value, l.cf, 1e-6)) { await sleep(700); if (near(cell(tr, "AUMTOUM").value, l.cf, 1e-6)) break; }
      await editCell(cell(tr, "AUMTOUM"), String(l.cf)); await answerOptions();
    }
    dbg("cf");
    const got = { batch: cell(tr, "BATCHNO").value, ref: cell(tr, "REF_SLNO").value, pcs: cell(tr, "AQTYRECD").value, cf: cell(tr, "AUMTOUM").value, mt: cell(tr, "QTYRECD").value, st: (tr.querySelector("ion-select") || {}).value, godown: cell(tr, "GODOWN_CODE").value };
    const bad = [];
    if (got.godown !== "SMS2") bad.push("godown"); if (got.batch !== l.batch) bad.push("batch"); if (got.ref !== l.ref) bad.push("Ref No");
    if (!near(got.pcs, l.pcs, 1e-9)) bad.push("pcs"); if (!near(got.cf, l.cf, 1e-6)) bad.push("C/F " + got.cf);
    if (!near(got.mt, l.mt, 0.0005)) bad.push(`MT ${got.mt} (expected ${l.mt})`); if (got.st !== "R") bad.push("stock type");
    if (bad.length) throw new Error(`billet ${l.code} ${l.ref}: ${bad.join(", ")} did not take`);
  }

  /* ================= one RM consumption line (SMS1 stock) ================= */
  async function fillRmLine(rf, tr, l) {
    await cellLov(tr, "ITEM_NAME", "Item Code", l.code);
    if (cell(tr, "ITEM_CODE").value.trim() !== l.code) throw new Error(`item ${l.code} not set`);
    click(cell(tr, "GODOWN_NAME").closest("td").querySelector("ion-icon[name=search]"));
    const sf = await waitFor(() => [...document.querySelectorAll("[id^=WETE]")].find(e => vis(e) && /Stock Details/.test(txt(e.querySelector("h2") || e))), 15000, "stock picker");
    let d = sf; while (d && !(btn(/^Ok$/, d) && btn(/^Show$/, d))) d = d.parentElement;
    const back = async () => { const b = btn(/^Back$/, d); if (b) click(b); await waitFor(() => !vis(sf), 8000).catch(() => {}); await sleep(400); };
    click(btn(/^Show$/, d));
    const rowsOf = () => [...sf.querySelectorAll("table tbody tr")].filter(r => txt(r.children[3]));
    await waitFor(() => rowsOf().length, 12000, "stock rows").catch(() => {});
    const stock = r => +txt(r.children[11]).replace(/,/g, "") || 0;
    const rows = rowsOf().filter(r => txt(r.children[3]) === "SMS1" && stock(r) > 0);
    const avail = rows.reduce((s, r) => s + stock(r), 0);
    if (avail + 1e-9 < l.qty) { await back(); throw new Error(`SMS1 stock is ${avail.toFixed(3)} MT, need ${l.qty.toFixed(3)} MT`); }
    let left = Math.round(l.qty * 1000) / 1000; const used = [];
    for (const r of rows) {
      if (left <= 0) break;
      const take = Math.min(left, stock(r));
      const cb = r.querySelector("ion-checkbox"); if (!cb.checked) { click(cb); await sleep(300); }
      await editCell(r.children[12].querySelector("input"), take.toFixed(3));
      const aq = r.children[16] && r.children[16].querySelector("input");
      if (aq && !near(aq.value, take, 0.0005)) await editCell(aq, take.toFixed(3));
      used.push(`${txt(r.children[7])} ${take.toFixed(3)}`);
      left = Math.round((left - take) * 1000) / 1000;
    }
    click(btn(/^Ok$/, d));
    await waitFor(() => !vis(sf), 10000, "stock picker to close"); await sleep(600);
    const a = alertBox(); if (a) { const t = a.text; await closeAlert(a); throw new Error("ERP said: " + t.slice(0, 200)); }
    // both quantity columns must show our figure
    for (const t of realRows(rf).filter(t => cell(t, "ITEM_CODE").value.trim() === l.code)) {
      const q = cell(t, "QTYISSUED").value, aq = cell(t, "AQTYISSUED");
      if (!near(aq.value, q, 0.0005)) { await editCell(aq, q); await answerOptions(); }
      await setStockType(t, "R");
    }
    const lines = realRows(rf).filter(t => cell(t, "ITEM_CODE").value.trim() === l.code);
    const q = lines.reduce((s, t) => s + (+cell(t, "QTYISSUED").value || 0), 0), aqs = lines.reduce((s, t) => s + (+cell(t, "AQTYISSUED").value || 0), 0);
    if (!near(q, l.qty, 0.0005) || !near(aqs, l.qty, 0.0005)) throw new Error(`ERP shows ${q.toFixed(3)} / ${aqs.toFixed(3)} MT, expected ${l.qty.toFixed(3)}`);
    return used.join(", ");
  }

  // add the RM lines. Items without an ERP code are skipped (reported). Any other problem
  // (no stock, item not in the list, ...) stops this heat WITHOUT saving: removing a half-filled
  // line is not reliable in this ERP, so nothing is left to chance. Returns {ok, missing}
  async function fillRm(rm, log, existing = []) {
    await openTab("RM Consumption");
    const rf = await waitFor(() => grid("R.M. Consumed For Material"), 10000, "RM Consumption grid");
    const ok = [], missing = [];
    let spare = realRows(rf).find(t => !cell(t, "ITEM_CODE").value.trim()) || null;   // the blank first row
    for (const l of rm) {
      if (existing.includes(l.code)) continue;
      if (!l.code) { missing.push(`${l.label} ${l.qty.toFixed(3)} MT (no ERP item code)`); log(`   RM ${l.label} ${l.qty.toFixed(3)} MT skipped - no ERP item code`, "err"); continue; }
      const tr = spare || await addRow(rf); spare = null;
      try { const u = await fillRmLine(rf, tr, l); ok.push(l.code); log(`   RM ${l.label} ${l.qty.toFixed(3)} MT ✓ (${u})`, "ok"); }
      catch (e) { if (lov()) await closeLov(); throw new Error(`RM ${l.label} ${l.qty.toFixed(3)} MT: ${e.message}`); }
    }
    return { ok, missing };
  }

  /* ================= final check before saving ================= */
  const r3 = v => Math.round(+v * 1000) / 1000;
  function prodRowsNow() {
    const pf = grid("Production Received");
    return realRows(pf).map(t => ({ code: cell(t, "ITEM_CODE").value.trim(), godown: cell(t, "GODOWN_CODE").value.trim(), batch: cell(t, "BATCHNO").value, ref: cell(t, "REF_SLNO").value,
      um: cell(t, "AUM").value.trim(), pcs: +cell(t, "AQTYRECD").value, cf: +cell(t, "AUMTOUM").value, mt: +cell(t, "QTYRECD").value, st: (t.querySelector("ion-select") || {}).value }));
  }
  function rmRowsNow() {
    const rf = grid("R.M. Consumed For Material");
    return realRows(rf).map(t => ({ code: cell(t, "ITEM_CODE").value.trim(), godown: cell(t, "GODOWN_CODE").value.trim(), q: +cell(t, "QTYISSUED").value || 0, aq: +cell(t, "AQTYISSUED").value || 0 }));
  }
  const rmTotals = rows => rows.reduce((m, r) => { if (r.code) m[r.code] = r3((m[r.code] || 0) + r.q); return m; }, {});
  async function checkProd(lines) {
    await openTab("Production Received");
    const got = prodRowsNow(), bad = [];
    if (got.length !== lines.length) bad.push(`${got.length} billet lines in the ERP, expected ${lines.length}`);
    lines.forEach((l, i) => { const g = got[i]; if (!g) return;
      if (g.code !== l.code || g.godown !== "SMS2" || g.batch !== l.batch || g.ref !== l.ref || g.um !== "PCS" || !near(g.pcs, l.pcs, 1e-9) || !near(g.cf, l.cf, 1e-6) || !near(g.mt, l.mt, 0.0005) || g.st !== "R")
        bad.push(`line ${i + 1} shows ${g.code} ${g.ref} ${g.pcs} pcs C/F ${g.cf} = ${g.mt}`); });
    if (bad.length) throw new Error("check before saving failed - " + bad.join("; "));
  }
  async function checkRm(expect) {        // expect: {code: qty}
    await openTab("RM Consumption");
    const rows = rmRowsNow(), bad = [];
    if (rows.some(r => !r.code)) bad.push("an empty RM line is left");
    rows.forEach(r => { if (r.code && (r.godown !== "SMS1" || !near(r.q, r.aq, 0.0005))) bad.push(`${r.code} ${r.godown} ${r.q} / ${r.aq}`); });
    const tot = rmTotals(rows);
    const codes = new Set([...Object.keys(tot), ...Object.keys(expect)]);
    codes.forEach(c => { if (!near(tot[c] || 0, expect[c] || 0, 0.0005)) bad.push(`${c}: ERP ${(tot[c] || 0).toFixed(3)}, expected ${(expect[c] || 0).toFixed(3)}`); });
    if (bad.length) throw new Error("check before saving failed - " + bad.join("; "));
  }

  /* ================= listing / vouchers ================= */
  // the screen title, e.g. "Production Entry Listing [QP:PROD]" / "Production Entry [QP:PROD]"
  const screenTitle = () => {
    const c = [...document.querySelectorAll("body *")].filter(x => { const tc = x.textContent || ""; if (tc.length > 120 || !/\[[A-Z]{2}:/.test(tc) || !vis(x)) return false; return /[A-Za-z]\s*\[[A-Z]{2}:[A-Z0-9]+\]\s*$/.test(txt(x)); });
    c.sort((a, b) => txt(a).length - txt(b).length); return c.length ? txt(c[0]) : "";
  };
  const onListing = () => /^Production Entry Listing/i.test(screenTitle()) && !!btn(/^Create New Record$/) && !btn(/^(Save|Update)$/) && !lov();
  // the ERP's own tab strip at the top ("Production Entry Listing | Menu Object | ...")
  const erpTab = () => [...document.querySelectorAll("*")].filter(vis).find(e => e.children.length === 0 && txt(e) === "Production Entry Listing" && e.getBoundingClientRect().top < 80);
  async function backToListing() {
    for (let i = 0; i < 4 && !onListing(); i++) {
      const a = alertBox(); if (a) await closeAlert(a); if (lov()) await closeLov();
      const b = btn(/^Back$/);
      if (b && /\[QP:PROD\]/.test(screenTitle())) click(b);         // a Production Entry voucher is open
      else { const t = erpTab(); if (t) click(t); else if (b) click(b); }
      await sleep(2500);
    }
    try { await waitFor(onListing, 15000, "Production Entry Listing"); }
    catch (e) {
      if (e.message === "Stopped by user") throw e;
      const shown = screenTitle() || "(no screen title found)";
      throw new Error(`the ERP is not on Production Entry Listing (it shows "${shown}"). Open the Production Entry Listing screen, wait for the list, then press Start again`);
    }
  }
  async function save(re) {
    const b = btn(re); if (!b) throw new Error("Save button not found"); click(b);
    const a = await waitFor(alertBox, 120000, "the ERP to answer Save");
    const text = a.text; await closeAlert(a);
    if (a.kind !== "ok") throw new Error("ERP said: " + text.replace(/Know More.*$/i, "").slice(0, 300));
    const m = text.match(/Voucher number\s+(\S+)\s+(saved|updated)/i); return m ? m[1] : "(number not shown)";
  }
  async function newVoucher(h, mode, log) {
    await backToListing();
    click(btn(/^Create New Record$/));
    try { await waitFor(lov, 8000, "series list"); }
    catch (e) { await sleep(1500); click(btn(/^Create New Record$/)); await waitFor(lov, 15000, "series list"); }   // list was still refreshing
    await pickLov("Series", "Q2");
    await waitFor(() => { try { return field("Transaction Type"); } catch (e) { return null; } }, 20000, "new Production Entry"); await sleep(800);
    await headerLov("Transaction Type", "Tran-Type Name", "STOCK MATERIAL", "STOCK MATERIAL");
    await headerLov("Plant Name", "Plant Code", "INDF1", "INDUCTION FURNACE");
    await headerLov("Process Name", "Process Code", "BILLETS", "BILLETS");
    await headerLov("Cost Name", "Cost Code", "INFUR", "INDUCTION FURNACE");
    await typeInto(field("Remark").inp, h.remark);
    for (const l of ["Production In Date", "Production Out Date"]) { const i = field(l).inp; await typeInto(i, h.date); if (i.value !== h.date) throw new Error(`${l} shows "${i.value}"`); }
    const pf = grid("Production Received");
    for (let i = 0; i < h.lines.length; i++) {
      const tr = i === 0 ? realRows(pf)[0] : await addRow(pf);
      await fillProdLine(tr, h.lines[i]); log(`   billet ${h.lines[i].ref} ${h.lines[i].len} Mtr ${h.lines[i].pcs} pcs = ${h.lines[i].mt.toFixed(3)} MT ✓`, "ok");
    }
    let missing = [], expect = {};
    if (mode === "full") {
      const r = await fillRm(h.rm, log); missing = r.missing;
      if (!r.ok.length) throw new Error("no RM consumption line could be entered and the ERP needs at least one");
      h.rm.filter(l => r.ok.includes(l.code)).forEach(l => { expect[l.code] = r3((expect[l.code] || 0) + l.qty); });
      await checkRm(expect);
    }
    await checkProd(h.lines);
    log("   all lines re-checked ✓", "ok");
    const vr = await save(/^Save$/);
    return { vr, missing };
  }
  async function openVoucherForEdit(vr) {
    await backToListing();
    const findRow = () => [...document.querySelectorAll("tr")].filter(vis).find(r => new RegExp("\\b" + vr + "\\b").test(txt(r)));
    if (!findRow()) {
      const s = [...document.querySelectorAll("input")].filter(vis).find(i => /Search Here/i.test(i.placeholder || ""));
      if (s) { await typeInto(s, vr); keyEv(s, "Enter"); await sleep(2500); }
    }
    const r = await waitFor(findRow, 15000, "voucher " + vr + " in the list");
    click(r.children[1]); await sleep(800);
    const pen = [...document.querySelectorAll("ion-icon")].filter(vis).find(i => /create|pencil/.test(i.getAttribute("name") || ""));
    if (!pen) throw new Error("Edit button not found"); click(pen.closest("ion-button") || pen);
    await waitFor(() => btn(/^Update$/), 20000, "voucher to open in Edit");
    await waitFor(() => { const v = document.getElementById("VRNO"); return v && v.value === vr; }, 10000, "voucher " + vr);
    await sleep(800);
    const ar = field("Audit Remark").inp; await typeInto(ar, "RM consumption added by Moltrix");
  }
  async function addConsumption(h, vr, log) {
    await openVoucherForEdit(vr);
    await openTab("RM Consumption");
    const rf = await waitFor(() => grid("R.M. Consumed For Material"), 10000, "RM Consumption grid");
    const before = rmRowsNow().filter(x => x.code);
    const existing = before.map(x => x.code);
    const r = await fillRm(h.rm, log, existing);
    if (!r.ok.length) { await backToListing(); return { vr, missing: r.missing, nothing: true }; }
    const expect = rmTotals(before);
    h.rm.filter(l => r.ok.includes(l.code)).forEach(l => { expect[l.code] = r3((expect[l.code] || 0) + l.qty); });
    await checkRm(expect);
    log("   all RM lines re-checked ✓", "ok");
    const v2 = await save(/^Update$/);
    return { vr: v2, missing: r.missing };
  }


  /* ================= Production QC (one per heat) ================= */
  const onQcListing = () => /^Production QC \[NQ:QCPRO\]/i.test(screenTitle()) && !!btn(/^Create New Record$/) && !btn(/^(Save|Update)$/) && !lov();
  const qcTab = () => [...document.querySelectorAll("*")].filter(vis).find(e => e.children.length === 0 && txt(e) === "Production QC" && e.getBoundingClientRect().top < 80);
  async function backToQcListing() {
    for (let i = 0; i < 4 && !onQcListing(); i++) {
      const a = alertBox(); if (a) await closeAlert(a); if (lov()) await closeLov();
      const b = btn(/^Back$/);
      if (b && /\[NQ:QCPRO\]/.test(screenTitle())) click(b); else { const t = qcTab(); if (t) click(t); else if (b) click(b); }
      await sleep(2500);
    }
    try { await waitFor(onQcListing, 15000, "Production QC"); }
    catch (e) {
      if (e.message === "Stopped by user") throw e;
      throw new Error(`the ERP is not on the Production QC screen (it shows "${screenTitle() || "(no screen title found)"}"). Open Production QC (Quick Search → QC → Production QC), then press Start again`);
    }
  }
  const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  const dmyOf = s => { const m = String(s).trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/); return m ? `${m[1].padStart(2, "0")}-${String(MON[m[2].toUpperCase()]).padStart(2, "0")}-${m[3]}` : ""; };
  // Batch No. list = lines of approved production vouchers; its search box only matches the
  // voucher number from the start, so list the Q2 vouchers and filter on the batch column
  async function qcPickBatch(h) {
    const { inp, wrap } = field("Batch No.");
    if (lov()) await closeLov();
    click(wrap.querySelector("ion-icon[name=search]") || wrap.querySelector("ion-icon"));
    const L = await waitFor(lov, 15000, "Batch No. list");
    const s = [...L.querySelectorAll("input")].find(i => /Search Here/i.test(i.placeholder || ""));
    s.focus(); setIn.call(s, "Q2"); s.dispatchEvent(new Event("input", { bubbles: true }));
    click(btn(/^Find$/, L));
    await waitFor(() => lovRows(L).length, 30000, "production vouchers in the Batch No. list");
    const heads = [...L.querySelectorAll("thead tr")].find(tr => [...tr.children].some(c => txt(c)));
    const names = [...heads.children].map(c => txt(c).replace(/\*$/, "").toLowerCase());
    const ci = n => { const i = names.indexOf(n); if (i < 0) throw new Error(`Batch No. list has no "${n}" column`); return i; };
    const cB = ci("batch no."), cI = ci("item code"), cD = ci("production vr date"), cV = ci("production vr no."), cS = ci("slno");
    const ftr = [...L.querySelectorAll("thead tr")].find(tr => tr.querySelector("input"));
    const f = ftr && ftr.children[cB] && ftr.children[cB].querySelector("input");
    if (f) await typeInto(f, `%${h.qc.batch}%`, 300);
    const match = () => { const r = lovRows(L).filter(r => txt(r.children[cB]) === h.qc.batch && txt(r.children[cI]) === h.qc.code && dmyOf(txt(r.children[cD])) === h.date);
      return r.length ? r.sort((a, b) => +txt(a.children[cS]) - +txt(b.children[cS])) : null; };
    let rows;
    try { rows = await waitFor(match, 15000, `batch ${h.qc.batch}`); }
    catch (e) { await closeLov(); throw new Error(`batch ${h.qc.batch} (${h.qc.code}, ${h.date}) is not in the ERP's Batch No. list - is the heat's production voucher approved?`); }
    const row = rows[0], vr = txt(row.children[cV]);
    const td = [...row.children].find(t => getComputedStyle(t).display !== "none") || row.firstElementChild;
    mouse(td, "click"); mouse(td, "dblclick");
    await waitFor(() => !lov(), 15000, "lookup to close"); await sleep(800);
    if (inp.value.trim() !== h.qc.batch) throw new Error(`Batch No. shows "${inp.value}"`);
    return vr;
  }
  // ERP test (code or name) -> BIS Doc column. The ERP admin sets the test names, so match loosely.
  const QC_KEYS = ["C", "Mn", "P", "S", "Si", "N", "S+P", "CE", "Bend", "Camber", "Length", "Width", "Defects", "Grade"];
  const QC_NEED = ["C", "Mn", "P", "S", "Si", "N", "S+P", "CE", "Bend", "Camber", "Length", "Width", "Defects"];   // Grade only if the ERP asks
  function qcKeyOf(raw) {
    const t = String(raw || "").toLowerCase().replace(/[%()\s._-]+/g, " ").trim();
    if (!t) return null;
    if (/s ?\+ ?p|sulph?f?ur ?\+ ?phos|s and p/.test(t)) return "S+P";
    if (/carbon equiv|^ce$|^c ?e$|^c\.?e\.?$/.test(t)) return "CE";
    if (/^c$|carbon/.test(t)) return "C";
    if (/^mn$|mangan/.test(t)) return "Mn";
    if (/^p$|phosph/.test(t)) return "P";
    if (/^s$|sulph|sulf/.test(t)) return "S";
    if (/^si$|silic/.test(t)) return "Si";
    if (/^n$|nitrog/.test(t)) return "N";
    if (/bend/.test(t)) return "Bend";
    if (/camber/.test(t)) return "Camber";
    if (/length/.test(t)) return "Length";
    if (/width|size|dimension/.test(t)) return "Width";
    if (/defect|crack|visual|freedom|surface/.test(t)) return "Defects";
    if (/grade/.test(t)) return "Grade";
    return null;
  }
  function qcRowsNow() {
    const t = [...document.querySelectorAll("table")].filter(vis).filter(t => /Test Code/.test(txt(t.querySelector("thead") || t))).pop();
    return t ? [...t.querySelectorAll("tbody tr")].filter(tr => { const c = tr.querySelector("input#TEST_CODE"); return c && c.value.trim(); }) : [];
  }
  const testOf = tr => qcKeyOf(tr.querySelector("input#TEST_CODE").value) || qcKeyOf((tr.querySelector("input#TEST_NAME") || {}).value);
  // numbers must come back equal (the ERP may round them); text must come back the same
  const sameVal = (got, want) => /^-?\d*\.?\d+$/.test(String(want).trim()) ? near(got, +want, 1e-9) : String(got).replace(/\s+/g, " ").trim() === String(want).replace(/\s+/g, " ").trim();
  async function newQc(h, log) {
    await backToQcListing();
    click(btn(/^Create New Record$/));
    try { await waitFor(lov, 8000, "series list"); }
    catch (e) { await sleep(1500); click(btn(/^Create New Record$/)); await waitFor(lov, 15000, "series list"); }
    await pickLov("Series", "2G");
    await waitFor(() => { try { return field("Batch No."); } catch (e) { return null; } }, 20000, "new Production QC"); await sleep(800);
    await headerLov("Plant", "Plant Code", "INDF1", "INDUCTION FURNACE");
    await headerLov("Process", "Process Code", "BILLETS", "BILLETS");
    await headerLov("Item Category", "Item Category", "BL", "BILLETS");
    await headerLov("Item Name", "Item Code", h.qc.code);
    await headerLov("Shift Code", "Shift Code", "A", "^A$");
    const qt = field("QC Time").inp, when = `${h.date} 10:00:00`;
    await typeInto(qt, when); if (qt.value !== when) throw new Error(`QC Time shows "${qt.value}"`);
    const vr = await qcPickBatch(h);
    log(`   production voucher ${vr}, batch ${h.qc.batch} (${h.qc.code})`);
    click(btn(/^Show$/));
    await waitFor(() => { const a = alertBox(); if (a && a.kind === "err") throw new Error("ERP said: " + a.text.replace(/Know More.*$/i, "").slice(0, 200)); return qcRowsNow().length; }, 20000, "test list");
    await sleep(800);
    const rows = qcRowsNow(), inErp = rows.map(testOf);
    const unknown = rows.filter(r => !testOf(r)).map(r => r.querySelector("input#TEST_CODE").value.trim() + " " + ((r.querySelector("input#TEST_NAME") || {}).value || ""));
    if (unknown.length) throw new Error(`the ERP asks for test(s) "${unknown.join('", "')}" that Moltrix can't match to a BIS Doc column - send me the test names`);
    const notInErp = QC_NEED.filter(k => !inErp.includes(k));
    if (notInErp.length && !window.MZF_DRY) throw new Error(`the ERP's test list for ${h.qc.code} has no ${notInErp.join(", ")} (it has ${inErp.join(", ")}) - ask the ERP admin to add them`);
    for (const tr of rows) {
      const k = testOf(tr), want = h.qc.vals[k];
      if (want === null || want === undefined || want === "") throw new Error(`no ${k} value in the BIS Doc for this heat`);
      const inp = tr.querySelector("input#TEST_RESULT");
      inp.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      await editCell(inp, String(want));
      if (!sameVal(inp.value, want)) throw new Error(`${k}: typed "${want}" but the ERP keeps "${inp.value}" - ask the ERP admin to allow ${/^-?\d*\.?\d+$/.test(want) ? "3-4 decimals" : "text"} in this Test Result`);
      const sel = tr.querySelector("ion-select");
      if (sel && sel.value !== "P") { sel.value = "P"; sel.dispatchEvent(new CustomEvent("ionChange", { detail: { value: "P" }, bubbles: true })); await sleep(300); }
      if (!sel || sel.value !== "P") throw new Error(`${k}: Test Status did not take Pass`);
    }
    // final check
    const got = qcRowsNow().map(tr => `${testOf(tr)} ${tr.querySelector("input#TEST_RESULT").value} ${(tr.querySelector("ion-select") || {}).value}`);
    const bad = qcRowsNow().filter(tr => !sameVal(tr.querySelector("input#TEST_RESULT").value, h.qc.vals[testOf(tr)]) || (tr.querySelector("ion-select") || {}).value !== "P");
    if (bad.length || field("Batch No.").inp.value.trim() !== h.qc.batch || field("QC Time").inp.value !== when) throw new Error("check before saving failed - " + got.join("; "));
    log(`   ${got.map(g => g.replace(/ P$/, "")).join(", ")} · Pass ✓`, "ok");
    if (window.MZF_DRY) { log("   (dry run - not saved)", "h"); return "DRY RUN"; }
    return await save(/^Save$/);
  }

  /* ================= panel ================= */
  const store = (key = DONE_KEY) => { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; } };
  const remember = (k, v, key = DONE_KEY) => { try { const s = store(key); s[k] = v; localStorage.setItem(key, JSON.stringify(s)); } catch (e) {} };
  let data = null, appWin = null;
  function panel() {
    let p = document.getElementById("mzfPanel"); if (p) return p;
    p = document.createElement("div"); p.id = "mzfPanel";
    p.style.cssText = "position:fixed;right:12px;bottom:12px;width:420px;max-height:70vh;display:flex;flex-direction:column;background:#0f1d33;color:#e8eef8;font:13px/1.4 system-ui,Segoe UI,sans-serif;border:2px solid #d4a017;border-radius:10px;z-index:2147483647;box-shadow:0 8px 28px rgba(0,0,0,.45)";
    p.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #2b3d5c">
        <b style="flex:1;color:#f2c94c">Moltrix → ERP <span style="font-weight:400;color:#8ea3c4;font-size:11px">v${VERSION}</span></b>
        <button data-a="open">Open Moltrix</button><button data-a="stop">Stop</button><button data-a="x">✕</button></div>
      <div id="mzfBody" style="padding:8px 10px;overflow:auto"></div>
      <div id="mzfLog" style="padding:6px 10px;overflow:auto;max-height:36vh;border-top:1px solid #2b3d5c;font:12px/1.35 Consolas,monospace;white-space:pre-wrap"></div>`;
    p.querySelectorAll("button").forEach(b => b.style.cssText = "background:#1f3558;color:#fff;border:1px solid #3d5a86;border-radius:6px;padding:3px 8px;cursor:pointer");
    p.addEventListener("click", ev => { const a = ev.target.getAttribute && ev.target.getAttribute("data-a");
      if (a === "open") openApp(); else if (a === "stop") { STOP = true; log("Stopping after the current step…", "err"); } else if (a === "x") { if (!MZF.busy) p.remove(); } else if (a === "start") start(); });
    document.body.appendChild(p); return p;
  }
  function log(m, cls) { const L = panel().querySelector("#mzfLog"); const d = document.createElement("div"); d.textContent = m; d.style.color = cls === "err" ? "#ff8a80" : cls === "ok" ? "#9be7a0" : cls === "h" ? "#f2c94c" : "#e8eef8"; L.appendChild(d); L.scrollTop = L.scrollHeight;
    try { if (appWin) appWin.postMessage({ type: "moltrix-erp-log", text: m, cls }, APP_ORIGIN); } catch (e) {} }
  function openApp() { appWin = window.open(APP_URL, "moltrixErpBridge", "width=520,height=760"); if (!appWin) log("Pop-up blocked - allow pop-ups for this ERP site, then press Open Moltrix again.", "err"); }
  function renderData() {
    if (!data) { panel().querySelector("#mzfBody").innerHTML = `<div>Press <b>Open Moltrix</b>, pick the date there and press <b>Send to ERP</b>.</div>`; return; }
    const b = panel().querySelector("#mzfBody"), mode = data.mode, s = store(mode === "qc" ? QC_DONE_KEY : DONE_KEY);
    if (mode === "qc") {
      b.innerHTML = `<div style="margin-bottom:6px"><b>${data.date}</b> · Production QC (Final chemistry from BIS Doc)</div>` +
        data.heats.map((h, i) => { const done = s[data.date + "|" + h.heat], v = h.qc.vals;
          return `<label style="display:flex;gap:6px;align-items:center;margin:2px 0"><input type="checkbox" data-i="${i}" ${done ? "" : "checked"}>
            Heat ${h.heat} · ${QC_KEYS.filter(k => v[k] !== undefined && v[k] !== "").map(k => k + " " + v[k]).join(" ")}${done ? ` <span style="color:#9be7a0">(${done})</span>` : ""}</label>`; }).join("") +
        `<div style="margin-top:8px"><button data-a="start" style="background:#d4a017;color:#10213a;border:0;border-radius:6px;padding:6px 14px;font-weight:700;cursor:pointer">Start</button>
         <span style="color:#8ea3c4;font-size:11px"> Start on the Production QC screen. Keep this tab in front.</span></div>`;
      return;
    }
    b.innerHTML = `<div style="margin-bottom:6px"><b>${data.date}</b> · ${mode === "full" ? "Production + RM consumption" : mode === "cons" ? "Add RM consumption to saved vouchers" : "Production only"}</div>` +
      data.heats.map((h, i) => { const k = data.date + "|" + h.heat, done = s[k]; const can = mode === "cons" ? !!done : true;
        return `<label style="display:flex;gap:6px;align-items:center;margin:2px 0;${can ? "" : "opacity:.5"}"><input type="checkbox" data-i="${i}" ${can && (mode === "cons" || !done) ? "checked" : ""} ${can ? "" : "disabled"}>
          Heat ${h.heat} · ${h.lines.reduce((x, l) => x + l.pcs, 0)} pcs · ${h.mt.toFixed(3)} MT${done ? ` <span style="color:#9be7a0">(${done})</span>` : ""}</label>`; }).join("") +
      `<div style="margin-top:8px"><button data-a="start" style="background:#d4a017;color:#10213a;border:0;border-radius:6px;padding:6px 14px;font-weight:700;cursor:pointer">Start</button>
       <span style="color:#8ea3c4;font-size:11px"> Keep this tab open and don't click in the ERP while it runs.</span></div>`;
  }
  async function start() {
    if (MZF.busy || !data) return;
    const picked = [...panel().querySelectorAll("#mzfBody input[type=checkbox]")].filter(c => c.checked).map(c => data.heats[+c.dataset.i]);
    if (!picked.length) { log("No heat selected.", "err"); return; }
    MZF.busy = true; STOP = false; const t0 = Date.now(); let okN = 0;
    log(`Starting ${picked.length} heat(s) for ${data.date}`, "h");
    const qc = data.mode === "qc", back = qc ? backToQcListing : backToListing;
    try { await back(); }
    catch (e) { log(`✗ ${e.message}`, "err"); log("Nothing was entered.", "err"); MZF.busy = false; STOP = false; return; }
    for (const h of picked) {
      const k = data.date + "|" + h.heat;
      log(`Heat ${h.heat}`, "h");
      try {
        let r;
        if (qc) r = { vr: await newQc(h, log) };
        else if (data.mode === "cons") { const vr = store()[k]; if (!vr) throw new Error("no saved voucher recorded for this heat"); r = await addConsumption(h, vr, log); }
        else r = await newVoucher(h, data.mode, log);
        if (r.nothing) log(`   nothing added to ${r.vr}`, "err");
        else { remember(k, r.vr, qc ? QC_DONE_KEY : DONE_KEY); okN++; log(`   saved ${r.vr}`, "ok"); }
        if (r.missing && r.missing.length) log(`   NOT entered: ${r.missing.join("; ")}`, "err");
        try { if (appWin) appWin.postMessage({ type: "moltrix-erp-done", date: data.date, heat: h.heat, vr: r.vr, missing: r.missing || [] }, APP_ORIGIN); } catch (e) {}
      } catch (e) {
        log(`   ✗ ${e.message} - this heat was NOT saved`, "err");
        try { await back(); } catch (e2) {}
        if (STOP) break;
      }
      renderData();
      if (STOP) break;
    }
    log(`Finished: ${okN} of ${picked.length} heat(s) saved in ${Math.round((Date.now() - t0) / 60000)} min.`, "h");
    MZF.busy = false; STOP = false;
  }
  window.addEventListener("message", ev => {
    if (ev.origin !== APP_ORIGIN || !ev.data || ev.data.type !== "moltrix-erp-data") return;
    if (MZF.busy) { log("Still busy - wait for the current run to finish.", "err"); return; }
    data = ev.data.payload; appWin = ev.source || appWin;
    log(`Received ${data.heats.length} heat(s) for ${data.date} from Moltrix.`, "h"); renderData();
  });
  window.MZF = { VERSION, busy: false, show() { panel(); renderData(); }, _t: { newVoucher, addConsumption, fillRm, backToListing, log, setData(d) { data = d; renderData(); }, debug(on) { DEBUG = on; dbgT = Date.now(); },
    grid, realRows, addRow, activate, fillProdLine, fillRmLine, alertBox, lov, pickLov, field, cell, newQc, backToQcListing, qcPickBatch, qcRowsNow, screenTitle } };
  panel(); renderData();
  if (!/erpv7\.marutisteel\.in/i.test(location.host)) log("This doesn't look like the Lighthouse ERP page.", "err");
  else log(`ERP screen now: ${screenTitle() || "(unknown)"}`, onListing() || onQcListing() ? "ok" : "");
})();
