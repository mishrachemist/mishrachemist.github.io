/* ===================== MOLTRIX SHEET (☰ / Home → Moltrix Sheet) =====================
   A spreadsheet like Google Sheets inside Moltrix. The grid and its ~540 Excel-style functions are Univer
   (open source, Apache-2.0, vendor/univer-1.6.0/, loaded only when a sheet is opened); the Google-only functions
   (QUERY, GOOGLEFINANCE, IMPORTRANGE, IMPORTDATA/HTML/XML, SPLIT, JOIN …) and the Excel ones Univer lacks
   (PIVOTBY, FORECAST.ETS…, STOCKHISTORY, WEBSERVICE, DETECTLANGUAGE, TRIMRANGE, INFO, JIS, PHONETIC) are in js/sheet-fns.js.
   Saved in the user's own OneDrive app folder ("Moltrix Sheets/<name>.json") and on this device (IndexedDB),
   so a sheet opens offline too; changes are saved a few seconds after each edit.
   .xlsx: open into a Moltrix Sheet / download as .xlsx (values, formulas, number formats, merges, column widths). ===== */
(function moltrixSheet() {
  const VER = "univer-1.6.0", BASE = "vendor/" + VER + "/";
  const FOLDER = "Moltrix Sheets";
  const G = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/" + encodeURIComponent(FOLDER);
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const signed = () => { try { return typeof account !== "undefined" && !!account; } catch (e) { return false; } };
  const native = () => !!(window.MoltrixApp && typeof MoltrixApp.httpGet === "function" && window.mzNativeCall);
  const nativeWeb = () => native() && typeof MoltrixApp.webGet === "function";
  const safeName = n => String(n || "").replace(/[\\/:*?"<>|#%{}~&]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80);
  const fileUrl = name => G + "/" + encodeURIComponent(name + ".json");
  const fmtT = t => { if (!t) return ""; const d = new Date(t); return d.toLocaleDateString("en-GB").replace(/\//g, "-") + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }); };
  const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
  const err = (where, e) => { try { if (window.mzErr) mzErr("Sheet", where + ": " + (e && e.message || e)); } catch (x) {} };

  // ---------- this device: IndexedDB copy of each sheet ----------
  let dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise((res, rej) => { const r = indexedDB.open("mzSheets", 1); r.onupgradeneeded = () => r.result.createObjectStore("books", { keyPath: "name" }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return dbP;
  }
  const tx = (mode, fn) => db().then(d => new Promise((res, rej) => { const t = d.transaction("books", mode), s = t.objectStore("books"); const r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
  const local = { get: n => tx("readonly", s => s.get(n)).catch(() => null), put: o => tx("readwrite", s => s.put(o)).catch(() => null), del: n => tx("readwrite", s => s.delete(n)).catch(() => null),
    all: () => tx("readonly", s => s.getAll()).catch(() => []) };

  // ---------- OneDrive app folder ----------
  async function auth() { const t = await getToken(); if (!t) throw new Error("Sign in first"); return { Authorization: "Bearer " + t }; }
  async function remoteList() {
    const r = await fetch(G + ":/children?$select=name,lastModifiedDateTime,size&$top=999&t=" + Date.now(), { headers: await auth(), cache: "no-store" });
    if (r.status === 404) return [];
    if (!r.ok) throw new Error("OneDrive: HTTP " + r.status);
    return ((await r.json()).value || []).filter(x => /\.json$/i.test(x.name)).map(x => ({ name: x.name.replace(/\.json$/i, ""), t: Date.parse(x.lastModifiedDateTime) || 0, size: x.size || 0 }));
  }
  async function remoteRead(name) {
    const r = await fetch(fileUrl(name) + ":/content?t=" + Date.now(), { headers: await auth(), cache: "no-store" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("OneDrive: HTTP " + r.status);
    return r.json();
  }
  async function remoteWrite(name, obj) {
    const body = JSON.stringify(obj), h = await auth();
    let r;
    if (body.length < 3900000) r = await fetch(fileUrl(name) + ":/content", { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, h), body });
    else {   // big sheet: an upload session (one piece, up to 60 MB)
      const s = await fetch(fileUrl(name) + ":/createUploadSession", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, h), body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }) });
      if (!s.ok) throw new Error("OneDrive: HTTP " + s.status);
      const bytes = new TextEncoder().encode(body);
      r = await fetch((await s.json()).uploadUrl, { method: "PUT", headers: { "Content-Range": `bytes 0-${bytes.length - 1}/${bytes.length}` }, body: bytes });
    }
    if (!r.ok) throw new Error("OneDrive: HTTP " + r.status);
    const j = await r.json().catch(() => ({}));
    return Date.parse(j.lastModifiedDateTime) || Date.now();
  }
  async function remoteRename(from, to) {
    const r = await fetch(fileUrl(from), { method: "PATCH", headers: Object.assign({ "Content-Type": "application/json" }, await auth()), body: JSON.stringify({ name: to + ".json" }) });
    if (r.status === 409) throw new Error("A sheet with this name already exists");
    if (!r.ok && r.status !== 404) throw new Error("OneDrive: HTTP " + r.status);
  }
  async function remoteDelete(name) {
    const r = await fetch(fileUrl(name), { method: "DELETE", headers: await auth() });
    if (!r.ok && r.status !== 404) throw new Error("OneDrive: HTTP " + r.status);
  }

  // the sheet list = OneDrive + sheets only on this device (made offline)
  let listCache = [];
  async function listAll() {
    const loc = await local.all();
    let rem = null;
    try { rem = await remoteList(); } catch (e) { err("list", e); }
    const map = new Map();
    (rem || []).forEach(x => map.set(x.name, Object.assign({ where: "cloud" }, x)));
    loc.forEach(x => { const m = map.get(x.name); if (!m) { if (x.dirty || !rem) map.set(x.name, { name: x.name, t: x.t, size: x.size || 0, where: x.dirty ? "device" : "cloud" }); } else if (x.dirty) m.where = "device"; });
    listCache = [...map.values()].sort((a, b) => b.t - a.t);
    return { list: listCache, offline: !rem };
  }
  // newest copy: this device's unsaved changes win, else whichever is newer
  async function loadBook(name) {
    const loc = await local.get(name);
    if (loc && loc.dirty) return loc.data;
    let meta = listCache.find(x => x.name === name);
    try {
      if (!loc || !meta || meta.t > (loc.t || 0)) {
        const d = await remoteRead(name);
        if (d) { await local.put({ name, data: d, t: meta ? meta.t : Date.now(), size: JSON.stringify(d).length, dirty: false }); return d; }
      }
    } catch (e) { err("open", e); if (!loc) throw e; }
    if (loc) return loc.data;
    return null;
  }

  // ---------- Univer (loaded on first use) ----------
  let uniP = null;
  function loadUniver() {
    if (uniP) return uniP;
    if (!document.querySelector("link[data-ms-css]")) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = BASE + "univer.css"; l.dataset.msCss = "1"; document.head.appendChild(l); }
    uniP = import(new URL(BASE + "univer.js", location.href).href).then(m => m.MzUniver || window.MzUniver).catch(e => { uniP = null; throw e; });
    return uniP;
  }

  // ---------- data for the Google-style functions ----------
  const fcache = new Map();
  let francP = null;
  async function fetcher(kind, arg) {
    if (kind === "yahoo" || kind === "web") {
      if (kind === "yahoo" ? !native() : !nativeWeb()) throw new Error("Moltrix Android app only");
      const r = await mzNativeCall(kind === "yahoo" ? "httpGet" : "webGet", arg);
      if (!r || r.s !== 200) throw new Error("HTTP " + (r && r.s));
      return r.t;
    }
    if (kind === "range") return readRange(arg);
    if (kind === "franc") { const m = await (francP || (francP = import(new URL("vendor/franc-min-6.2.0/franc.js", location.href).href).catch(e => { francP = null; throw e; }))); return m.franc(arg, { minLength: 3 }); }
    throw new Error("?");
  }
  const colNum = s => { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  function parseA1(a1) {
    const m = /^\$?([A-Za-z]{1,3})\$?(\d*)(?::\$?([A-Za-z]{1,3})\$?(\d*))?$/.exec(a1.trim()); if (!m) throw new Error("bad range");
    const c1 = colNum(m[1]), c2 = colNum(m[3] || m[1]);
    return { c1: Math.min(c1, c2), c2: Math.max(c1, c2), r1: m[2] ? +m[2] - 1 : 0, r2: m[3] ? (m[4] ? +m[4] - 1 : null) : (m[2] ? +m[2] - 1 : null) };
  }
  async function readRange({ book, sheet, range }) {
    if (/\.xls[xm]?$/i.test(book)) {   // an Excel file in OneDrive
      const token = await getToken();
      const path = book.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
      const base = `https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/workbook/worksheets`;
      let sn = sheet;
      if (!sn) { const w = await graphFetch(base + "?$select=name&$top=1", token, { noSession: true }); sn = w.value && w.value[0] && w.value[0].name; }
      const j = await graphFetch(`${base}('${encodeURIComponent(String(sn).replace(/'/g, "''"))}')/range(address='${range}')?$select=values`, token, { noSession: true });
      return j.values || [];
    }
    const name = book.replace(/^moltrix:/i, "").trim();
    const data = cur && cur.name === name && cur.api ? { wb: cur.api.getActiveWorkbook().save() } : await loadBook(name);
    if (!data || !data.wb) throw new Error("no sheet " + name);
    const wb = data.wb, ids = wb.sheetOrder || Object.keys(wb.sheets || {});
    const id = sheet ? ids.find(i => (wb.sheets[i].name || "").toLowerCase() === sheet.toLowerCase()) : ids[0];
    if (!id) throw new Error("no tab " + sheet);
    const S = wb.sheets[id], cd = S.cellData || {};
    const R = parseA1(range);
    let r2 = R.r2;
    if (r2 === null) { r2 = 0; Object.keys(cd).forEach(r => { if (Object.keys(cd[r] || {}).some(c => +c >= R.c1 && +c <= R.c2 && cd[r][c] && cd[r][c].v != null && cd[r][c].v !== "")) r2 = Math.max(r2, +r); }); }
    const out = [];
    for (let r = R.r1; r <= r2; r++) { const row = []; for (let c = R.c1; c <= R.c2; c++) { const x = cd[r] && cd[r][c]; row.push(x && x.v != null ? x.v : ""); } out.push(row); }
    return out;
  }
  function ttlFor(name, args) {
    if (name === "GOOGLEFINANCE") return args.length > 2 && args[2] !== 0 && args[2] !== undefined ? 6 * 3600e3 : 120e3;
    if (name === "IMPORTRANGE") return 30e3;
    if (name === "STOCKHISTORY") return 6 * 3600e3;
    if (name === "DETECTLANGUAGE") return 24 * 3600e3;
    return 30 * 60e3;
  }
  function cached(name, args, run) {
    const key = name + JSON.stringify(args), hit = fcache.get(key);
    if (hit && Date.now() - hit.t < ttlFor(name, args)) return hit.p;
    const p = Promise.resolve().then(run).catch(e => (/app only/.test(e && e.message) ? "#N/A" : "#REF!"));
    fcache.set(key, { t: Date.now(), p });
    return p;
  }
  function registerFns(api) {
    const F = api.getFormula(), S = window.mzSheetFns;
    if (!S) return;
    Object.keys(S.SYNC).forEach(n => { try { F.registerFunction(n, S.SYNC[n], S.HELP[n] || n); } catch (e) { err("fn " + n, e); } });
    Object.keys(S.ASYNC).forEach(n => { try { F.registerAsyncFunction(n, (...a) => cached(n, a, () => S.ASYNC[n](fetcher, ...a)), S.HELP[n] || n); } catch (e) { err("fn " + n, e); } });
  }

  // ---------- .xlsx in / out (SheetJS is already in the app) ----------
  function fromXlsx(buf) {
    const X = window.XLSX; if (!X) throw new Error("Excel reader not loaded");
    const wb = X.read(buf, { type: "array", cellFormula: true, cellNF: true, cellStyles: true });
    const sheets = {}, order = [];
    wb.SheetNames.forEach((sn, i) => {
      const ws = wb.Sheets[sn], id = "s" + (i + 1); order.push(id);
      const rg = ws["!ref"] ? X.utils.decode_range(ws["!ref"]) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
      const cellData = {};
      for (let r = rg.s.r; r <= rg.e.r; r++) for (let c = rg.s.c; c <= rg.e.c; c++) {
        const x = ws[X.utils.encode_cell({ r, c })]; if (!x) continue;
        const o = {};
        if (x.f) o.f = "=" + x.f;
        if (x.t === "n") { o.v = x.v; o.t = 2; }
        else if (x.t === "b") { o.v = x.v ? 1 : 0; o.t = 3; }
        else if (x.t === "e") { o.v = x.w || "#N/A"; o.t = 1; }
        else if (x.t === "d") { o.v = (x.v.getTime() - Date.UTC(1899, 11, 30)) / 864e5; o.t = 2; }
        else if (x.v !== undefined && x.v !== "") { o.v = String(x.v); o.t = 1; }
        if (x.z && x.z !== "General" && x.t === "n") o.s = { n: { pattern: String(x.z) } };
        if (o.v === undefined && !o.f) continue;
        (cellData[r] = cellData[r] || {})[c] = o;
      }
      const columnData = {}; (ws["!cols"] || []).forEach((cw, ci) => { if (cw && (cw.wpx || cw.wch)) columnData[ci] = { w: Math.round(cw.wpx || cw.wch * 7 + 5) }; });
      const rowData = {}; (ws["!rows"] || []).forEach((rh, ri) => { if (rh && rh.hpx) rowData[ri] = { h: Math.round(rh.hpx) }; });
      const mergeData = (ws["!merges"] || []).map(m => ({ startRow: m.s.r, endRow: m.e.r, startColumn: m.s.c, endColumn: m.e.c }));
      sheets[id] = { id, name: sn.slice(0, 31), cellData, columnData, rowData, mergeData, rowCount: Math.max(1000, rg.e.r + 50), columnCount: Math.max(26, rg.e.c + 6) };
    });
    return { id: "ms-" + Date.now().toString(36), name: "Book", sheetOrder: order, sheets, styles: {} };
  }
  function toXlsx(snap) {
    const X = window.XLSX; if (!X) throw new Error("Excel writer not loaded");
    const book = X.utils.book_new(), used = new Set();
    (snap.sheetOrder || Object.keys(snap.sheets)).forEach(id => {
      const S = snap.sheets[id], cd = S.cellData || {}, ws = {};
      let maxR = 0, maxC = 0;
      Object.keys(cd).forEach(r => Object.keys(cd[r] || {}).forEach(c => {
        const x = cd[r][c]; if (!x) return;
        const o = {}, v = x.v;
        if (x.f) o.f = String(x.f).replace(/^=/, "");
        if (v === undefined || v === null || v === "") { if (!o.f) return; o.t = "s"; o.v = ""; }
        else if (typeof v === "number") { o.t = x.t === 3 ? "b" : "n"; o.v = x.t === 3 ? !!v : v; }
        else if (typeof v === "boolean") { o.t = "b"; o.v = v; }
        else { o.t = "s"; o.v = String(v); }
        const st = typeof x.s === "string" ? (snap.styles || {})[x.s] : x.s;
        if (st && st.n && st.n.pattern) o.z = st.n.pattern;
        ws[X.utils.encode_cell({ r: +r, c: +c })] = o; maxR = Math.max(maxR, +r); maxC = Math.max(maxC, +c);
      }));
      ws["!ref"] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
      if (S.mergeData && S.mergeData.length) ws["!merges"] = S.mergeData.map(m => ({ s: { r: m.startRow, c: m.startColumn }, e: { r: m.endRow, c: m.endColumn } }));
      const cols = []; Object.keys(S.columnData || {}).forEach(ci => { if (S.columnData[ci] && S.columnData[ci].w) cols[+ci] = { wpx: S.columnData[ci].w }; }); if (cols.length) ws["!cols"] = cols;
      let nm = String(S.name || "Sheet").replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || "Sheet", k = 2; while (used.has(nm.toLowerCase())) nm = nm.slice(0, 28) + " " + k++;
      used.add(nm.toLowerCase());
      X.utils.book_append_sheet(book, ws, nm);
    });
    return X.write(book, { type: "array", bookType: "xlsx" });
  }

  // ---------- small dialogs ----------
  function dialog(title, inner, buttons) {
    return new Promise(res => {
      const d = document.createElement("div");
      d.className = "msDlgOv";
      d.innerHTML = `<div class="msDlg"><div class="msDlgT">${title}</div>${inner}<div class="msDlgB">${buttons.map((b, i) => `<button type="button" class="${b.cls || "secondary"}" data-i="${i}">${b.t}</button>`).join("")}</div></div>`;
      document.body.appendChild(d);
      const inp = d.querySelector("input"); if (inp) { setTimeout(() => { inp.focus(); inp.select(); }, 50); inp.addEventListener("keydown", e => { if (e.key === "Enter") d.querySelector('[data-i="' + (buttons.length - 1) + '"]').click(); }); }
      d.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (!b && e.target !== d) return; const i = b ? +b.dataset.i : 0; const v = inp ? inp.value : null; d.remove(); res({ i, v }); });
    });
  }
  async function askName(title, value) {
    const r = await dialog(title, `<input type="text" id="msNameIn" maxlength="80" value="${esc(value || "")}">`, [{ t: "Cancel" }, { t: "OK", cls: "primary" }]);
    return r.i === 1 ? safeName(r.v) : null;
  }
  const confirmBox = async (title, msg, okText) => (await dialog(title, `<div class="msDlgM">${esc(msg)}</div>`, [{ t: "Cancel" }, { t: okText || "OK", cls: "primary" }])).i === 1;
  const toast = msg => { const t = document.createElement("div"); t.className = "msToast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); };

  // ---------- list screen ----------
  async function renderList() {
    const box = $("msList"); if (!box) return;
    if (!signed()) { box.innerHTML = `<div class="msEmpty">Sign in first</div>`; return; }
    box.innerHTML = `<div class="msEmpty">Loading…</div>`;
    let res;
    try { res = await listAll(); } catch (e) { box.innerHTML = `<div class="msEmpty">⚠️ ${esc(e.message || e)}</div>`; return; }
    const { list, offline } = res;
    box.innerHTML = (offline ? `<div class="msOff">⚠️ OneDrive not reachable - showing the sheets on this device</div>` : "") +
      (list.length ? list.map(x => `<button type="button" class="msItem" data-name="${esc(x.name)}"><img class="msIco" alt="" src="img/3dd1552de097.svg"><span class="msTxt"><b>${esc(x.name)}</b><small>${fmtT(x.t)}${x.size ? " · " + fmtSize(x.size) : ""}${x.where === "device" ? " · not yet in OneDrive" : ""}</small></span></button>`).join("")
        : `<div class="msEmpty">No sheets yet</div>`);
  }
  function uniqueName(base) { let n = base, k = 2; const has = s => listCache.some(x => x.name.toLowerCase() === s.toLowerCase()); while (has(n)) n = base + " " + k++; return n; }
  async function newSheet() {
    const name = await askName("New sheet", uniqueName("Sheet " + new Date().toLocaleDateString("en-GB").replace(/\//g, "-")));
    if (!name) return;
    if (listCache.some(x => x.name.toLowerCase() === name.toLowerCase())) { toast("A sheet with this name already exists"); return; }
    const data = { app: "Moltrix Sheet", v: 1, name, wb: { id: "ms-" + Date.now().toString(36), name, sheetOrder: ["s1"], sheets: { s1: { id: "s1", name: "Sheet1", rowCount: 1000, columnCount: 26, cellData: {} } }, styles: {} } };
    await local.put({ name, data, t: Date.now(), size: 0, dirty: true });
    listCache.unshift({ name, t: Date.now(), where: "device" });
    openSheet(name, data);
  }
  async function importFile(file) {
    if (!file) return;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const wb = fromXlsx(buf);
      const name = await askName("Sheet name", uniqueName(safeName(file.name.replace(/\.[^.]+$/, "")) || "Imported"));
      if (!name) return;
      wb.name = name;
      const data = { app: "Moltrix Sheet", v: 1, name, wb };
      await local.put({ name, data, t: Date.now(), size: buf.length, dirty: true });
      listCache.unshift({ name, t: Date.now(), where: "device" });
      openSheet(name, data);
    } catch (e) { toast("Not opened: " + (e.message || e)); err("import", e); }
  }

  // ---------- editor ----------
  let cur = null;   // { name, univer, api, dirty, timer, saving, data }
  function editorShell(name) {
    let ov = $("msOverlay");
    if (ov) ov.remove();
    ov = document.createElement("div");
    ov.id = "msOverlay";
    ov.className = "msOverlay";
    ov.innerHTML = `<div class="msBar"><button type="button" id="msClose" aria-label="Close">✕</button><button type="button" class="msTitle" id="msTitle"></button>
      <span class="msState" id="msState"></span><button type="button" id="msRefresh" aria-label="Refresh data" title="Refresh data">⟳</button><button type="button" id="msMore" aria-label="More">⋮</button></div>
      <div id="msGrid"><div class="msLoading">Opening…</div></div>`;
    document.body.appendChild(ov);
    $("msTitle").textContent = name;
    $("msClose").onclick = closeEditor;
    $("msTitle").onclick = renameCur;
    $("msRefresh").onclick = () => { fcache.clear(); try { cur && cur.api && cur.api.getFormula().executeCalculation(); } catch (e) {} toast("Refreshing data…"); };
    $("msMore").onclick = moreMenu;
    return ov;
  }
  function setState(t) { const s = $("msState"); if (s) s.textContent = t; }
  async function openSheet(name, given) {
    if (cur) await closeEditor();
    editorShell(name);
    let data = given, U;
    try {
      [U, data] = await Promise.all([loadUniver(), given ? Promise.resolve(given) : loadBook(name)]);
    } catch (e) { const g = $("msGrid"); if (g) g.innerHTML = `<div class="msLoading">⚠️ ${esc(e.message || e)}</div>`; err("open", e); return; }
    if (!$("msOverlay")) return;   // closed while loading
    if (!data || !data.wb) { $("msGrid").innerHTML = `<div class="msLoading">⚠️ Sheet not found</div>`; return; }
    $("msGrid").innerHTML = "";
    const { univer, univerAPI } = U.createUniver({ locale: U.LocaleType.EN_US, locales: { [U.LocaleType.EN_US]: U.mergeLocales(U.enUS) }, presets: [U.UniverSheetsCorePreset({ container: "msGrid" })] });
    registerFns(univerAPI);
    univerAPI.createWorkbook(data.wb);
    cur = { name, univer, api: univerAPI, dirty: false, timer: 0, saving: null, data };
    const me = cur;
    univerAPI.addEvent(univerAPI.Event.CommandExecuted, ev => {
      if (me !== cur || !ev || ev.type !== 2) return;   // 2 = a change of the data
      if (/^formula\.mutation\.(set-formula-calculation|set-trigger|set-formula-calculation-notification)|calculation-result|^doc\./.test(ev.id)) return;
      me.dirty = true; setState("…");
      clearTimeout(me.timer); me.timer = setTimeout(() => save(me), 2500);
    });
    const loc = await local.get(name);
    if (loc && loc.dirty) save(cur);   // made offline / not yet in OneDrive
    else setState("");
  }
  async function save(c) {
    if (!c || !c.api) return;
    if (c.saving) { c.again = true; return c.saving; }
    clearTimeout(c.timer);
    c.saving = (async () => {
      let snap;
      try { snap = c.api.getActiveWorkbook().save(); } catch (e) { err("save", e); return; }
      snap.name = c.name;
      const data = { app: "Moltrix Sheet", v: 1, name: c.name, at: new Date().toISOString(), wb: snap };
      c.data = data; c.dirty = false;
      const size = JSON.stringify(data).length;
      await local.put({ name: c.name, data, t: Date.now(), size, dirty: true });
      if (c === cur) setState("Saving…");
      try {
        const t = await remoteWrite(c.name, data);
        await local.put({ name: c.name, data, t, size, dirty: false });
        const m = listCache.find(x => x.name === c.name); if (m) { m.t = t; m.size = size; m.where = "cloud"; }
        if (c === cur) setState("Saved");
      } catch (e) {
        if (c === cur) setState("Saved on this device");
        err("save", e);
      }
    })();
    try { await c.saving; } finally { c.saving = null; if (c.again) { c.again = false; save(c); } }
  }
  async function closeEditor() {
    const c = cur;
    if (c) {
      if (c.dirty) await save(c); else if (c.saving) await c.saving;
      cur = null;
      try { c.univer.dispose(); } catch (e) {}
    }
    const ov = $("msOverlay"); if (ov) ov.remove();
    renderList();
  }
  async function renameCur() {
    if (!cur) return;
    const to = await askName("Rename sheet", cur.name);
    if (!to || to === cur.name) return;
    if (listCache.some(x => x.name.toLowerCase() === to.toLowerCase())) { toast("A sheet with this name already exists"); return; }
    const from = cur.name;
    try {
      await save(cur);
      await remoteRename(from, to);
      const loc = await local.get(from); await local.del(from);
      if (loc) { loc.name = to; if (loc.data) loc.data.name = to; await local.put(loc); }
      const m = listCache.find(x => x.name === from); if (m) m.name = to;
      cur.name = to; $("msTitle").textContent = to;
      await save(cur);
    } catch (e) { toast(e.message || String(e)); }
  }
  async function moreMenu() {
    if (!cur) return;
    const r = await dialog(esc(cur.name), "", [{ t: "Rename" }, { t: "Download .xlsx" }, { t: "Delete", cls: "danger" }, { t: "Close", cls: "primary" }]);
    if (r.i === 0) renameCur();
    else if (r.i === 1) {
      try {
        const out = toXlsx(cur.api.getActiveWorkbook().save());
        const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = cur.name + ".xlsx"; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      } catch (e) { toast("Not saved: " + (e.message || e)); }
    } else if (r.i === 2) {
      if (!(await confirmBox("Delete sheet", `Delete "${cur.name}" from OneDrive and this device?`, "Delete"))) return;
      const name = cur.name, c = cur;
      cur = null; clearTimeout(c.timer);
      try { c.univer.dispose(); } catch (e) {}
      try { await remoteDelete(name); } catch (e) { toast(e.message || String(e)); }
      await local.del(name);
      listCache = listCache.filter(x => x.name !== name);
      const ov = $("msOverlay"); if (ov) ov.remove();
      renderList();
    }
  }

  // ---------- wiring ----------
  function wire() {
    const sec = $("section-msheet"); if (!sec || sec.dataset.msWired) return;
    sec.dataset.msWired = "1";
    $("msNew").onclick = () => { if (!signed()) { toast("Sign in first"); return; } newSheet(); };
    $("msImport").onclick = () => { if (!signed()) { toast("Sign in first"); return; } $("msFile").click(); };
    $("msFile").onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; importFile(f); };
    $("msList").addEventListener("click", e => { const b = e.target.closest(".msItem"); if (b) openSheet(b.dataset.name); });
    document.querySelectorAll('.navItem[data-section="msheet"]').forEach(b => b.addEventListener("click", () => { renderList(); setTimeout(() => loadUniver().catch(() => {}), 1500); }));
  }
  window.addEventListener("online", () => { if (cur && cur.data) local.get(cur.name).then(l => { if (l && l.dirty) save(cur); }); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && cur && cur.dirty) save(cur); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();

  window.mzSheet = { open: openSheet, list: listAll, close: closeEditor, render: renderList, _test: { fromXlsx, toXlsx, readRange, parseA1, local, get cur() { return cur; } } };
})();
