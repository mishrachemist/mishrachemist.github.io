/* ===================== MOLTRIX SHEET (☰ / Home → Moltrix Sheet) =====================
   A spreadsheet like Google Sheets inside Moltrix. The grid and its ~540 Excel-style functions are Univer
   (open source, Apache-2.0, vendor/univer-1.6.0/, loaded only when a sheet is opened); the Google-only functions
   (QUERY, GOOGLEFINANCE, IMPORTRANGE, IMPORTDATA/HTML/XML, SPLIT, JOIN …) and the Excel ones Univer lacks
   (PIVOTBY, FORECAST.ETS…, STOCKHISTORY, WEBSERVICE, DETECTLANGUAGE, TRIMRANGE, INFO, JIS, PHONETIC) are in js/sheet-fns.js.
   Saved in the user's own OneDrive app folder ("Moltrix Sheets/<name>.json") and on this device (IndexedDB),
   so a sheet opens offline too; changes are saved a few seconds after each edit.
   .xlsx: open into a Moltrix Sheet (values, formulas, number formats, merges, column widths, row heights, borders, fill
   colours, fonts, alignment) / download as .xlsx (values, formulas, number formats, merges, column widths). ===== */
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

  // ---------- .xlsx cell formatting (26-Nov-2026): SheetJS (community) does not read borders, fill colours, fonts or
  // alignment, so they are read here straight from the file (styles.xml + theme + each sheet's cell "s" index) ----------
  const XL_IDX = ["000000","FFFFFF","FF0000","00FF00","0000FF","FFFF00","FF00FF","00FFFF","000000","FFFFFF","FF0000","00FF00","0000FF","FFFF00","FF00FF","00FFFF",
    "800000","008000","000080","808000","800080","008080","C0C0C0","808080","9999FF","993366","FFFFCC","CCFFFF","660066","FF8080","0066CC","CCCCFF",
    "000080","FF00FF","FFFF00","00FFFF","800080","800000","008080","0000FF","00CCFF","CCFFFF","CCFFCC","FFFF99","99CCFF","FF99CC","CC99FF","FFCC99",
    "3366FF","33CCCC","99CC00","FFCC00","FF9900","FF6600","666699","969696","003366","339966","003300","333300","993300","993366","333399","333333"];
  const XL_BORDER = { thin: 1, hair: 2, dotted: 3, dashed: 4, dashDot: 5, dashDotDot: 6, double: 7, medium: 8, mediumDashed: 9, mediumDashDot: 10, mediumDashDotDot: 11, slantDashDot: 12, thick: 13 };
  const XL_H = { left: 1, center: 2, centerContinuous: 2, right: 3, justify: 4, distributed: 4, fill: 1 }, XL_V = { top: 1, center: 2, bottom: 3, justify: 2, distributed: 2 };
  function xlTint(hex, tint) {
    if (!tint) return hex;
    let r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, sat = 0, l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; sat = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
    const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    if (!sat) r = g = b = l; else { const q = l < .5 ? l * (1 + sat) : l + sat - l * sat, pp = 2 * l - q; r = f(pp, q, h + 1 / 3); g = f(pp, q, h); b = f(pp, q, h - 1 / 3); }
    return [r, g, b].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  function xlsxStyles(buf) {   // → { "<sheet name>": { "r,c": xfIndex }, xf: [univer style …] }  (null when it can't be read)
    const X = window.XLSX; if (!X || !X.CFB) return null;
    const zip = X.CFB.read(buf instanceof Uint8Array ? buf : new Uint8Array(buf), { type: "array" });
    const get = p => { const f = X.CFB.find(zip, p) || X.CFB.find(zip, "/" + p); if (!f || !f.content) return null; return new TextDecoder().decode(f.content instanceof Uint8Array ? f.content : new Uint8Array(f.content)); };
    const xml = t => t ? new DOMParser().parseFromString(t, "application/xml") : null;
    const kids = (el, n) => el ? [...el.children].filter(k => k.localName === n) : [];
    const kid = (el, n) => kids(el, n)[0] || null;
    const all = (el, n) => el ? [...el.getElementsByTagName("*")].filter(k => k.localName === n) : [];
    const st = xml(get("xl/styles.xml")); if (!st) return null;
    // theme colours: Excel's index 0 = lt1, 1 = dk1, 2 = lt2, 3 = dk2, then accent1-6, hlink, folHlink
    const th = xml(get("xl/theme/theme1.xml")), theme = [];
    const cs = th ? all(th, "clrScheme")[0] : null;
    if (cs) { const c = [...cs.children].map(k => { const x = k.firstElementChild; return x ? (x.getAttribute("val") && x.localName === "srgbClr" ? x.getAttribute("val") : x.getAttribute("lastClr") || "000000") : "000000"; });
      theme.push(c[1], c[0], c[3], c[2], ...c.slice(4)); }
    const col = el => {
      if (!el || el.getAttribute("auto") === "1") return null;
      let hex = null;
      if (el.getAttribute("rgb")) hex = el.getAttribute("rgb").slice(-6);
      else if (el.getAttribute("theme") != null) hex = theme[+el.getAttribute("theme")] || null;
      else if (el.getAttribute("indexed") != null) { const i = +el.getAttribute("indexed"); hex = i === 64 ? "000000" : i === 65 ? "FFFFFF" : XL_IDX[i] || null; }
      if (!hex) return null;
      return "#" + xlTint(hex.toUpperCase(), parseFloat(el.getAttribute("tint") || "0"));
    };
    const on = el => !!el && !/^(0|false)$/i.test(el.getAttribute("val") || "1");
    const fonts = kids(kid(st.documentElement, "fonts"), "font").map((f, i) => {
      const o = {};
      if (on(kid(f, "b"))) o.bl = 1;
      if (on(kid(f, "i"))) o.it = 1;
      if (kid(f, "u") && kid(f, "u").getAttribute("val") !== "none") o.ul = { s: 1 };
      if (on(kid(f, "strike"))) o.st = { s: 1 };
      const sz = kid(f, "sz"); if (sz && i > 0) o.fs = +sz.getAttribute("val") || 11;
      const nm = kid(f, "name"); if (nm && i > 0) o.ff = nm.getAttribute("val");
      const c = col(kid(f, "color")); if (c && c !== "#000000") o.cl = { rgb: c };
      return o;
    });
    const fills = kids(kid(st.documentElement, "fills"), "fill").map(f => {
      const pf = kid(f, "patternFill"); if (!pf) return null;
      const t = pf.getAttribute("patternType") || (kid(pf, "fgColor") ? "solid" : "none");
      if (t === "none" || t === "gray125") return null;
      const c = col(kid(pf, "fgColor")) || col(kid(pf, "bgColor"));
      return c ? { rgb: c } : null;
    });
    const borders = kids(kid(st.documentElement, "borders"), "border").map(b => {
      const o = {};
      [["left", "l"], ["right", "r"], ["top", "t"], ["bottom", "b"]].forEach(([n, k]) => {
        const e = kid(b, n), s = e && XL_BORDER[e.getAttribute("style")];
        if (s) o[k] = { s, cl: { rgb: col(kid(e, "color")) || "#000000" } };
      });
      return Object.keys(o).length ? o : null;
    });
    const xf = kids(kid(st.documentElement, "cellXfs"), "xf").map(x => {
      const o = Object.assign({}, fonts[+x.getAttribute("fontId") || 0] || {});
      const fl = fills[+x.getAttribute("fillId") || 0]; if (fl) o.bg = fl;
      const bd = borders[+x.getAttribute("borderId") || 0]; if (bd) o.bd = bd;
      const al = kid(x, "alignment");
      if (al) {
        if (XL_H[al.getAttribute("horizontal")]) o.ht = XL_H[al.getAttribute("horizontal")];
        if (XL_V[al.getAttribute("vertical")]) o.vt = XL_V[al.getAttribute("vertical")];
        if (/^(1|true)$/i.test(al.getAttribute("wrapText") || "")) o.tb = 3;
      }
      return Object.keys(o).length ? o : null;
    });
    // which file is which sheet
    const wbx = xml(get("xl/workbook.xml")), rel = xml(get("xl/_rels/workbook.xml.rels")), target = {};
    all(rel, "Relationship").forEach(r => { target[r.getAttribute("Id")] = r.getAttribute("Target"); });
    const out = { xf };
    all(wbx, "sheet").forEach(sh => {
      const rid = sh.getAttribute("r:id") || [...sh.attributes].find(a => a.localName === "id")?.value;
      let t = target[rid]; if (!t) return;
      t = t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, "");
      const txt = get(t); if (!txt) return;
      const m = {}, re = /<(?:\w+:)?c\b([^>]*)>/g; let g;
      while ((g = re.exec(txt))) {
        const a = g[1], s = / s="(\d+)"/.exec(a), r = / r="([A-Z]+)(\d+)"/.exec(a);
        if (!s || !r || s[1] === "0" || !xf[+s[1]]) continue;
        let c = 0; for (const ch of r[1]) c = c * 26 + ch.charCodeAt(0) - 64;
        m[(+r[2] - 1) + "," + (c - 1)] = +s[1];
      }
      out[sh.getAttribute("name")] = m;
    });
    return out;
  }

  // ---------- .xlsx in / out (SheetJS is already in the app) ----------
  function fromXlsx(buf) {
    const X = window.XLSX; if (!X) throw new Error("Excel reader not loaded");
    const wb = X.read(buf, { type: "array", cellFormula: true, cellNF: true, cellStyles: true });
    const sheets = {}, order = [], styles = {}, npIdx = {};
    let XS = null; try { XS = xlsxStyles(buf); } catch (e) { err("xlsx formatting", e); }
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
      // borders / colours / fonts / alignment (also on empty cells), kept once per Excel style in "styles"
      const SM = XS && XS[sn];
      if (SM) Object.keys(SM).forEach(k => {
        const [r, c] = k.split(",").map(Number), base = XS.xf[SM[k]], cell = (cellData[r] = cellData[r] || {})[c] || (cellData[r][c] = {});
        const np = cell.s && cell.s.n ? cell.s.n.pattern : "";
        if (np && !(np in npIdx)) npIdx[np] = Object.keys(npIdx).length;
        const id = "x" + SM[k] + (np ? "n" + npIdx[np] : "");
        if (!styles[id]) styles[id] = np ? Object.assign({}, base, { n: { pattern: np } }) : base;
        cell.s = id;
      });
      const columnData = {}; (ws["!cols"] || []).forEach((cw, ci) => { if (cw && (cw.wpx || cw.wch)) columnData[ci] = { w: Math.round(cw.wpx || cw.wch * 7 + 5) }; });
      const rowData = {}; (ws["!rows"] || []).forEach((rh, ri) => { if (rh && rh.hpx) rowData[ri] = { h: Math.round(rh.hpx) }; });
      const mergeData = (ws["!merges"] || []).map(m => ({ startRow: m.s.r, endRow: m.e.r, startColumn: m.s.c, endColumn: m.e.c }));
      sheets[id] = { id, name: sn.slice(0, 31), cellData, columnData, rowData, mergeData, rowCount: Math.max(1000, rg.e.r + 50), columnCount: Math.max(26, rg.e.c + 6) };
    });
    return { id: "ms-" + Date.now().toString(36), name: "Book", sheetOrder: order, sheets, styles };
  }
  function toXlsx(snap) {
    const X = window.XLSX; if (!X) throw new Error("Excel writer not loaded");
    const book = X.utils.book_new(), used = new Set();
    xfs = [null]; xfKey = {}; cellXf = [];
    (snap.sheetOrder || Object.keys(snap.sheets)).forEach(id => {
      const S = snap.sheets[id], cd = S.cellData || {}, ws = {}, sm = {};
      let maxR = 0, maxC = 0;
      Object.keys(cd).forEach(r => Object.keys(cd[r] || {}).forEach(c => {
        const x = cd[r][c]; if (!x) return;
        const o = {}, v = x.v;
        const st0 = typeof x.s === "string" ? (snap.styles || {})[x.s] : x.s;
        const xi = st0 ? xfOf(st0) : 0;
        if (xi) { sm[X.utils.encode_cell({ r: +r, c: +c })] = xi; maxR = Math.max(maxR, +r); maxC = Math.max(maxC, +c); }
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
      const rows = []; Object.keys(S.rowData || {}).forEach(ri => { if (S.rowData[ri] && S.rowData[ri].h) rows[+ri] = { hpx: S.rowData[ri].h }; }); if (rows.length) ws["!rows"] = rows;
      let nm = String(S.name || "Sheet").replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || "Sheet", k = 2; while (used.has(nm.toLowerCase())) nm = nm.slice(0, 28) + " " + k++;
      used.add(nm.toLowerCase());
      X.utils.book_append_sheet(book, ws, nm);
      cellXf.push(sm);
    });
    const out = X.write(book, { type: "array", bookType: "xlsx" });
    if (xfs.length <= 1) return out;
    try { return xlsxWriteStyles(out, cellXf); } catch (e) { err("xlsx formatting (save)", e); return out; }   // the values always save
  }

  // ---------- borders / colours / fonts / alignment into the downloaded .xlsx (26-Nov-2026) ----------
  // SheetJS (free edition) writes no cell formatting, so toXlsx collects one Excel "xf" per distinct Univer style and
  // this rewrites xl/styles.xml and puts s="n" on the cells (adding empty cells that only carry a border or colour)
  let xfs = [], xfKey = {}, cellXf = [];
  const BORDER_XL = Object.fromEntries(Object.entries(XL_BORDER).map(([k, v]) => [v, k]));
  const H_XL = { 1: "left", 2: "center", 3: "right", 4: "justify" }, V_XL = { 1: "top", 2: "center", 3: "bottom" };
  function xlCol(c) {
    if (!c) return null; const v = typeof c === "string" ? c : c.rgb; if (!v) return null;
    let m = /^#?([0-9a-f]{6})$/i.exec(v.trim()); if (m) return "FF" + m[1].toUpperCase();
    m = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v.trim()); if (m) return ("FF" + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toUpperCase();
    m = /rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i.exec(v); if (m) return "FF" + [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, "0")).join("").toUpperCase();
    return null;
  }
  function xfOf(st) {   // → index into xfs (0 = plain)
    const o = {};
    if (st.ff) o.ff = String(st.ff); if (st.fs) o.fs = +st.fs;
    if (st.bl) o.bl = 1; if (st.it) o.it = 1; if (st.ul && st.ul.s) o.ul = 1; if (st.st && st.st.s) o.st = 1;
    const fc = xlCol(st.cl); if (fc) o.cl = fc;
    const bg = xlCol(st.bg); if (bg) o.bg = bg;
    if (st.bd) ["l", "r", "t", "b"].forEach(k => { const e = st.bd[k]; if (e && BORDER_XL[e.s]) o["B" + k] = BORDER_XL[e.s] + ":" + (xlCol(e.cl) || "FF000000"); });
    if (H_XL[st.ht]) o.ht = H_XL[st.ht]; if (V_XL[st.vt]) o.vt = V_XL[st.vt]; if (st.tb === 3) o.wr = 1;
    if (st.n && st.n.pattern && st.n.pattern !== "General") o.nf = String(st.n.pattern);
    const k = JSON.stringify(o); if (k === "{}") return 0;
    if (!(k in xfKey)) { xfKey[k] = xfs.length; xfs.push(o); }
    return xfKey[k];
  }
  function xlsxWriteStyles(buf, perSheet) {
    const X = window.XLSX, zip = X.CFB.read(new Uint8Array(buf), { type: "array" });
    const get = p => { const f = X.CFB.find(zip, "/" + p); return f && f.content ? new TextDecoder().decode(f.content instanceof Uint8Array ? f.content : new Uint8Array(f.content)) : null; };
    const put = (p, t) => X.CFB.utils.cfb_add(zip, "/" + p, new TextEncoder().encode(t));
    const ea = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const BUILTIN = { "0": 1, "0.00": 2, "#,##0": 3, "#,##0.00": 4, "0%": 9, "0.00%": 10, "0.00E+00": 11, "mm-dd-yy": 14, "d-mmm-yy": 15, "d-mmm": 16, "mmm-yy": 17, "h:mm AM/PM": 18, "h:mm:ss AM/PM": 19, "h:mm": 20, "h:mm:ss": 21, "m/d/yy h:mm": 22, "@": 49 };
    const fonts = ['<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>'], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'],
      borders = ["<border><left/><right/><top/><bottom/><diagonal/></border>"], nfs = [], idx = (arr, x) => { let i = arr.indexOf(x); if (i < 0) { i = arr.length; arr.push(x); } return i; };
    const xf = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    xfs.slice(1).forEach(o => {
      const font = "<font>" + (o.bl ? "<b/>" : "") + (o.it ? "<i/>" : "") + (o.st ? "<strike/>" : "") + (o.ul ? "<u/>" : "") + '<sz val="' + (o.fs || 11) + '"/>' +
        (o.cl ? '<color rgb="' + o.cl + '"/>' : '<color theme="1"/>') + '<name val="' + ea(o.ff || "Calibri") + '"/><family val="2"/></font>';
      const fontId = font === '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>' ? 0 : idx(fonts, font);
      const fillId = o.bg ? idx(fills, '<fill><patternFill patternType="solid"><fgColor rgb="' + o.bg + '"/><bgColor indexed="64"/></patternFill></fill>') : 0;
      const side = (n, k) => { const v = o["B" + k]; if (!v) return "<" + n + "/>"; const [st, c] = v.split(":"); return "<" + n + ' style="' + st + '"><color rgb="' + c + '"/></' + n + ">"; };
      const bd = "<border>" + side("left", "l") + side("right", "r") + side("top", "t") + side("bottom", "b") + "<diagonal/></border>";
      const borderId = bd === borders[0] ? 0 : idx(borders, bd);
      let numFmtId = 0; if (o.nf) numFmtId = BUILTIN[o.nf] || 164 + idx(nfs, o.nf);
      const al = o.ht || o.vt || o.wr ? "<alignment" + (o.ht ? ' horizontal="' + o.ht + '"' : "") + (o.vt ? ' vertical="' + o.vt + '"' : "") + (o.wr ? ' wrapText="1"' : "") + "/>" : "";
      xf.push('<xf numFmtId="' + numFmtId + '" fontId="' + fontId + '" fillId="' + fillId + '" borderId="' + borderId + '" xfId="0"' + (numFmtId ? ' applyNumberFormat="1"' : "") +
        (fontId ? ' applyFont="1"' : "") + (fillId ? ' applyFill="1"' : "") + (borderId ? ' applyBorder="1"' : "") + (al ? ' applyAlignment="1">' + al + "</xf>" : "/>"));
    });
    put("xl/styles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (nfs.length ? '<numFmts count="' + nfs.length + '">' + nfs.map((f, i) => '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + ea(f) + '"/>').join("") + "</numFmts>" : "") +
      '<fonts count="' + fonts.length + '">' + fonts.join("") + '</fonts><fills count="' + fills.length + '">' + fills.join("") + '</fills><borders count="' + borders.length + '">' + borders.join("") +
      '</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="' + xf.length + '">' + xf.join("") +
      '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0"/></styleSheet>');
    const colN = a => { let c = 0; for (const ch of a) c = c * 26 + ch.charCodeAt(0) - 64; return c; };
    perSheet.forEach((sm, i) => {
      const p = "xl/worksheets/sheet" + (i + 1) + ".xml", t = get(p); if (!t) return;
      const a = t.indexOf("<sheetData"), b = t.indexOf("</sheetData>"); if (a < 0) return;
      const open = t.indexOf(">", a), selfClosed = t[open - 1] === "/";
      const body = selfClosed ? "" : t.slice(open + 1, b), rows = {};   // row number → { attrs, cells: { col: xml } }
      body.replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (m, at, inner) => {
        const r = +/\br="(\d+)"/.exec(at)[1], cells = {};
        (inner || "").replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (cm, ca) => { const ref = /\br="([A-Z]+)\d+"/.exec(ca); if (ref) cells[colN(ref[1])] = cm.replace(/^<c\b([^>]*?)\s+s="\d+"/, "<c$1"); return ""; });
        rows[r] = { at, cells }; return "";
      });
      Object.keys(sm).forEach(ref => {
        const g = /^([A-Z]+)(\d+)$/.exec(ref), r = +g[2], c = colN(g[1]), row = rows[r] || (rows[r] = { at: ' r="' + r + '"', cells: {} });
        const cur = row.cells[c];
        row.cells[c] = cur ? cur.replace(/^<c\b([^>]*?)(\/?>)/, (m, ca, end) => "<c" + ca.replace(/\s+s="\d+"/, "") + ' s="' + sm[ref] + '"' + end) : '<c r="' + ref + '" s="' + sm[ref] + '"/>';
      });
      const xmlRows = Object.keys(rows).map(Number).sort((x, y) => x - y).map(r => {
        const cs = Object.keys(rows[r].cells).map(Number).sort((x, y) => x - y).map(c => rows[r].cells[c]).join("");
        return "<row" + rows[r].at + (cs ? ">" + cs + "</row>" : "/>");
      }).join("");
      put(p, t.slice(0, a) + "<sheetData>" + xmlRows + "</sheetData>" + t.slice(selfClosed ? open + 1 : b + "</sheetData>".length));
    });
    return X.CFB.write(zip, { fileType: "zip", type: "array" });
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
      (list.length ? list.map(x => `<button type="button" class="msItem" data-name="${esc(x.name)}"><img class="msIco" alt="" src="img/298886d24449.webp"><span class="msTxt"><b>${esc(x.name)}</b><small>${fmtT(x.t)}${x.size ? " · " + fmtSize(x.size) : ""}${x.where === "device" ? " · not yet in OneDrive" : ""}</small></span></button>`).join("")
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
