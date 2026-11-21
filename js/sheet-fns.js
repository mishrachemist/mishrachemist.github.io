/* ===================== MOLTRIX SHEET: Google Sheets functions that the spreadsheet engine (Univer) does not have =====================
   Plain functions (no page needed), registered as custom formulas by js/sheet.js:
   QUERY, SPLIT, JOIN, ARRAYFORMULA, FLATTEN, ARRAY_CONSTRAIN, SORTN, COUNTUNIQUE, ENCODEURL, and the data ones
   GOOGLEFINANCE, IMPORTRANGE, IMPORTDATA, IMPORTHTML, IMPORTXML (these need a "fetch" helper given by sheet.js).
   A range comes in as a 2-D array; an empty argument as 0 or undefined. An error is returned as its text ("#N/A"). */
(function (root) {
  const NA = "#N/A", VALUE = "#VALUE!";
  const isArr = Array.isArray;
  const mat = x => isArr(x) ? (isArr(x[0]) ? x : [x]) : [[x]];
  const flat = (...a) => { const out = []; a.forEach(x => mat(x).forEach(r => r.forEach(v => out.push(v)))); return out; };
  const blank = v => v === undefined || v === null || v === "";
  const truthy = (v, def) => v === undefined ? def : !(v === false || v === 0 || v === "FALSE" || v === "false");
  const one = x => isArr(x) ? one(x[0]) : x;   // a single value from a 1x1 range

  // ---------- dates (sheet serial number <-> JS) ----------
  const DAY = 86400000, EPOCH = Date.UTC(1899, 11, 30);
  const serialToMs = s => EPOCH + s * DAY;
  const msToSerial = ms => (ms - EPOCH) / DAY;
  const isoToSerial = iso => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(iso).trim()); if (!m) return null;
    return msToSerial(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))); };

  // ---------- simple array functions ----------
  function SPLIT(text, delim, byEach, removeEmpty) {
    text = String(one(text) ?? ""); delim = String(one(delim) ?? "");
    if (delim === "") return VALUE;
    let parts;
    if (truthy(one(byEach), true)) { const set = [...delim].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"); parts = text.split(new RegExp(set)); }
    else parts = text.split(delim);
    if (truthy(one(removeEmpty), true)) parts = parts.filter(p => p !== "");
    parts = parts.map(p => (p.trim() !== "" && !isNaN(Number(p)) ? Number(p) : p));
    return parts.length ? [parts] : [[""]];
  }
  const JOIN = (delim, ...vals) => flat(...vals).filter(v => v !== undefined && v !== null).map(v => v === true ? "TRUE" : v === false ? "FALSE" : v).join(String(one(delim) ?? ""));
  const ARRAYFORMULA = x => x;
  const FLATTEN = (...a) => { const f = flat(...a).filter(v => !blank(v)); return f.length ? f.map(v => [v]) : [[""]]; };
  function ARRAY_CONSTRAIN(arr, rows, cols) {
    const m = mat(arr), r = Math.max(1, Math.floor(Number(one(rows)) || 0)), c = Math.max(1, Math.floor(Number(one(cols)) || 0));
    return m.slice(0, r).map(row => row.slice(0, c));
  }
  const COUNTUNIQUE = (...a) => new Set(flat(...a).filter(v => !blank(v)).map(v => typeof v + ":" + v)).size;
  const ENCODEURL = t => encodeURIComponent(String(one(t) ?? ""));
  const cmp = (a, b) => { const ba = blank(a), bb = blank(b); if (ba || bb) return ba === bb ? 0 : ba ? 1 : -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "number") return -1; if (typeof b === "number") return 1;
    return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true }); };
  // SORTN(range, [n], [display_ties_mode], [sort_column, is_ascending], ...)
  function SORTN(range, n, ties, ...spec) {
    const m = mat(range); let N = n === undefined ? 1 : Math.floor(Number(one(n)) || 0); if (N < 0) return VALUE;
    const keys = []; for (let i = 0; i < spec.length; i += 2) keys.push({ c: Math.max(1, Number(one(spec[i])) || 1) - 1, asc: truthy(one(spec[i + 1]), true) });
    if (!keys.length) keys.push({ c: 0, asc: true });
    const sorted = m.map((r, i) => ({ r, i })).sort((x, y) => { for (const k of keys) { const d = cmp(x.r[k.c], y.r[k.c]); if (d) return k.asc ? d : -d; } return x.i - y.i; }).map(x => x.r);
    const mode = Math.floor(Number(one(ties)) || 0), same = (a, b) => keys.every(k => cmp(a[k.c], b[k.c]) === 0);
    let out;
    if (mode === 1) { out = sorted.slice(0, N); const last = out[out.length - 1]; if (last) for (let i = N; i < sorted.length && same(sorted[i], last); i++) out.push(sorted[i]); }
    else if (mode === 2) { out = []; for (const r of sorted) { if (!out.some(o => o.every((v, i) => cmp(v, r[i]) === 0))) out.push(r); if (out.length >= N) break; } }
    else if (mode === 3) { out = []; let groups = 0, prev = null; for (const r of sorted) { if (!prev || !same(prev, r)) { groups++; if (groups > N) break; } out.push(r); prev = r; } }
    else out = sorted.slice(0, N);
    return out.length ? out : [[""]];
  }

  // =====================================================================================================
  // QUERY(data, query, [headers]) — the Google Visualization query language:
  // select, where, group by, pivot, order by, limit, offset, label, format (ignored), options (ignored).
  // Columns: A, B, C… (counted from the first column of the data) or Col1, Col2…
  // =====================================================================================================
  const KW = ["select", "where", "group", "pivot", "order", "limit", "offset", "label", "format", "options", "by", "and", "or", "not", "asc", "desc",
    "contains", "starts", "ends", "with", "matches", "like", "is", "null", "true", "false", "date", "datetime", "timeofday", "timestamp"];
  function tokenize(q) {
    const t = []; let i = 0;
    while (i < q.length) {
      const c = q[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "'" || c === '"') { let j = i + 1, s = ""; while (j < q.length && q[j] !== c) s += q[j++]; if (j >= q.length) throw new Error("unclosed quote"); t.push({ k: "str", v: s }); i = j + 1; continue; }
      if (c === "`") { let j = i + 1, s = ""; while (j < q.length && q[j] !== "`") s += q[j++]; t.push({ k: "id", v: s }); i = j + 1; continue; }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(q[i + 1] || ""))) { let j = i; while (j < q.length && /[0-9.eE]/.test(q[j])) j++; t.push({ k: "num", v: Number(q.slice(i, j)) }); i = j; continue; }
      if (/[A-Za-z_]/.test(c)) { let j = i; while (j < q.length && /[A-Za-z0-9_]/.test(q[j])) j++; const w = q.slice(i, j); const lw = w.toLowerCase(); t.push(KW.includes(lw) ? { k: "kw", v: lw } : { k: "id", v: w }); i = j; continue; }
      const two = q.slice(i, i + 2);
      if (["<=", ">=", "!=", "<>"].includes(two)) { t.push({ k: "op", v: two === "<>" ? "!=" : two }); i += 2; continue; }
      if ("=<>+-*/(),".includes(c)) { t.push({ k: "op", v: c }); i++; continue; }
      throw new Error("unexpected '" + c + "'");
    }
    return t;
  }
  const AGG = ["sum", "avg", "count", "max", "min"];
  const SCALAR = ["year", "month", "day", "hour", "minute", "second", "millisecond", "quarter", "dayofweek", "now", "datediff", "todate", "upper", "lower", "tostring"];
  function parseQuery(q) {
    const T = tokenize(q); let p = 0;
    const peek = (o = 0) => T[p + o], at = (k, v) => { const x = T[p]; return x && x.k === k && (v === undefined || x.v === v); };
    const eat = (k, v) => { if (!at(k, v)) throw new Error("expected " + (v || k) + (T[p] ? " near '" + T[p].v + "'" : " at the end")); return T[p++]; };
    const isClause = () => at("kw") && ["where", "group", "pivot", "order", "limit", "offset", "label", "format", "options"].includes(peek().v);
    // expressions
    function primary() {
      const x = T[p];
      if (!x) throw new Error("unexpected end");
      if (x.k === "num") { p++; return { t: "lit", v: x.v }; }
      if (x.k === "str") { p++; return { t: "lit", v: x.v }; }
      if (x.k === "kw" && (x.v === "true" || x.v === "false")) { p++; return { t: "lit", v: x.v === "true" }; }
      if (x.k === "kw" && (x.v === "date" || x.v === "datetime" || x.v === "timestamp")) { p++; const s = eat("str").v; const v = isoToSerial(s); if (v === null) throw new Error("bad date '" + s + "'"); return { t: "lit", v }; }
      if (x.k === "kw" && x.v === "timeofday") { p++; const s = eat("str").v; const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s); if (!m) throw new Error("bad time"); return { t: "lit", v: (+m[1] * 3600 + +m[2] * 60 + +(m[3] || 0)) / 86400 }; }
      if (x.k === "op" && x.v === "(") { p++; const e = orExpr(); eat("op", ")"); return e; }
      if (x.k === "op" && x.v === "-") { p++; return { t: "neg", a: primary() }; }
      if (x.k === "id") {
        p++;
        const lw = x.v.toLowerCase();
        if (at("op", "(")) {
          p++;
          const args = [];
          if (!at("op", ")")) { args.push(orExpr()); while (at("op", ",")) { p++; args.push(orExpr()); } }
          eat("op", ")");
          if (AGG.includes(lw)) { if (args.length !== 1) throw new Error(lw + "() takes one column"); return { t: "agg", f: lw, a: args[0] }; }
          if (SCALAR.includes(lw)) return { t: "fn", f: lw, a: args };
          throw new Error("unknown function " + x.v);
        }
        return { t: "col", id: x.v };
      }
      throw new Error("unexpected '" + x.v + "'");
    }
    function mul() { let a = primary(); while (at("op", "*") || at("op", "/")) { const o = T[p++].v; a = { t: "bin", o, a, b: primary() }; } return a; }
    function add() { let a = mul(); while (at("op", "+") || at("op", "-")) { const o = T[p++].v; a = { t: "bin", o, a, b: mul() }; } return a; }
    function comp() {
      const a = add();
      if (at("op") && ["=", "!=", "<", ">", "<=", ">="].includes(peek().v)) { const o = T[p++].v; return { t: "cmp", o, a, b: add() }; }
      if (at("kw", "is")) { p++; let neg = false; if (at("kw", "not")) { p++; neg = true; } eat("kw", "null"); return { t: "isnull", a, neg }; }
      if (at("kw", "contains")) { p++; return { t: "str", o: "contains", a, b: add() }; }
      if (at("kw", "starts")) { p++; eat("kw", "with"); return { t: "str", o: "starts", a, b: add() }; }
      if (at("kw", "ends")) { p++; eat("kw", "with"); return { t: "str", o: "ends", a, b: add() }; }
      if (at("kw", "matches")) { p++; return { t: "str", o: "matches", a, b: add() }; }
      if (at("kw", "like")) { p++; return { t: "str", o: "like", a, b: add() }; }
      if (at("kw", "not") && peek(1) && peek(1).k === "kw" && ["contains", "starts", "ends", "matches", "like"].includes(peek(1).v)) { p++; const e = comp2(a); return { t: "not", a: e }; }
      return a;
    }
    function comp2(a) { const x = T[p++].v; if (x === "starts" || x === "ends") eat("kw", "with"); return { t: "str", o: x, a, b: add() }; }
    function notExpr() { if (at("kw", "not")) { p++; return { t: "not", a: notExpr() }; } return comp(); }
    function andExpr() { let a = notExpr(); while (at("kw", "and")) { p++; a = { t: "and", a, b: notExpr() }; } return a; }
    function orExpr() { let a = andExpr(); while (at("kw", "or")) { p++; a = { t: "or", a, b: andExpr() }; } return a; }
    const list = (item) => { const out = [item()]; while (at("op", ",")) { p++; out.push(item()); } return out; };

    const Q = { select: null, where: null, group: [], pivot: [], order: [], limit: null, offset: 0, label: [] };
    while (p < T.length) {
      const k = eat("kw").v;
      if (k === "select") { if (at("op", "*")) { p++; Q.select = null; } else Q.select = list(orExpr); }
      else if (k === "where") Q.where = orExpr();
      else if (k === "group") { eat("kw", "by"); Q.group = list(orExpr); }
      else if (k === "pivot") Q.pivot = list(orExpr);
      else if (k === "order") { eat("kw", "by"); Q.order = list(() => { const e = orExpr(); let asc = true; if (at("kw", "asc")) p++; else if (at("kw", "desc")) { p++; asc = false; } return { e, asc }; }); }
      else if (k === "limit") Q.limit = eat("num").v;
      else if (k === "offset") Q.offset = eat("num").v;
      else if (k === "label") Q.label = list(() => { const e = orExpr(); const s = eat("str").v; return { e, s }; });
      else if (k === "format") { list(() => { orExpr(); eat("str"); }); }
      else if (k === "options") { while (p < T.length && !isClause()) p++; }
      else throw new Error("unexpected '" + k + "'");
    }
    return Q;
  }
  // expression text, for headers (e.g. "sum Price") and matching label/order targets
  function exprKey(e) {
    switch (e.t) {
      case "col": return e.id.toUpperCase();
      case "lit": return JSON.stringify(e.v);
      case "agg": return e.f + "(" + exprKey(e.a) + ")";
      case "fn": return e.f + "(" + e.a.map(exprKey).join(",") + ")";
      case "bin": return "(" + exprKey(e.a) + e.o + exprKey(e.b) + ")";
      case "neg": return "-" + exprKey(e.a);
      default: return JSON.stringify(e);
    }
  }
  const colLetters = i => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  function serialParts(v) { const d = new Date(serialToMs(v)); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), ms: d.getUTCMilliseconds(), wd: d.getUTCDay() }; }
  function QUERY(data, query, headers) {
    try {
      const m = mat(data).map(r => r.map(v => (v === undefined ? null : v)));
      if (!m.length) return NA;
      const width = Math.max(...m.map(r => r.length));
      m.forEach(r => { while (r.length < width) r.push(null); });
      let h = headers === undefined || headers === null || headers === "" ? -1 : Math.max(0, Math.floor(Number(one(headers)) || 0));
      if (h < 0) {   // guess, as Google does: a first row of text over a column with numbers = header
        const r0 = m[0], rest = m.slice(1, 6);
        h = m.length > 1 && r0.every(v => typeof v === "string" || v === null) && r0.some(v => typeof v === "string" && v !== "") && rest.some(r => r.some(v => typeof v === "number" || typeof v === "boolean")) ? 1 : 0;
      }
      h = Math.min(h, m.length);
      const names = []; for (let c = 0; c < width; c++) names.push(m.slice(0, h).map(r => r[c]).filter(v => !blank(v)).join(" "));
      const rows = m.slice(h).filter(r => r.some(v => !blank(v)));
      const Q = parseQuery(String(one(query) ?? "").trim() || "select *");
      const colIdx = id => {
        const s = String(id); let mm = /^col(\d+)$/i.exec(s);
        if (mm) { const i = +mm[1] - 1; if (i >= 0 && i < width) return i; }
        if (/^[A-Za-z]{1,3}$/.test(s)) { let i = 0; for (const ch of s.toUpperCase()) i = i * 26 + (ch.charCodeAt(0) - 64); i--; if (i >= 0 && i < width) return i; }
        const byName = names.findIndex(n => n && n.toLowerCase() === s.toLowerCase()); if (byName >= 0) return byName;
        throw new Error("no column " + s);
      };
      const num = v => typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : (v === null || v === "" ? null : (isNaN(Number(v)) ? null : Number(v)));
      function ev(e, row, grp) {
        switch (e.t) {
          case "lit": return e.v;
          case "col": return row ? row[colIdx(e.id)] : null;
          case "neg": { const a = num(ev(e.a, row, grp)); return a === null ? null : -a; }
          case "bin": { const a = num(ev(e.a, row, grp)), b = num(ev(e.b, row, grp)); if (a === null || b === null) return null;
            return e.o === "+" ? a + b : e.o === "-" ? a - b : e.o === "*" ? a * b : (b === 0 ? null : a / b); }
          case "agg": {
            if (!grp) throw new Error(e.f + "() needs group by or a whole-table select");
            const vals = grp.map(r => ev(e.a, r, null)).filter(v => !blank(v));
            if (e.f === "count") return vals.length;
            if (e.f === "max" || e.f === "min") { if (!vals.length) return null; return vals.reduce((x, y) => (e.f === "max" ? (cmp(y, x) > 0 ? y : x) : (cmp(y, x) < 0 ? y : x))); }
            const ns = vals.map(num).filter(v => v !== null); if (!ns.length) return null;
            const s = ns.reduce((x, y) => x + y, 0); return e.f === "sum" ? s : s / ns.length;
          }
          case "fn": {
            const a = e.a.map(x => ev(x, row, grp));
            const v = a[0];
            switch (e.f) {
              case "now": return msToSerial(Date.now());
              case "upper": return v === null ? null : String(v).toUpperCase();
              case "lower": return v === null ? null : String(v).toLowerCase();
              case "tostring": return v === null ? null : String(v);
              case "todate": return typeof v === "number" ? Math.floor(v) : null;
              case "datediff": return typeof v === "number" && typeof a[1] === "number" ? Math.floor(v) - Math.floor(a[1]) : null;
              default: {
                if (typeof v !== "number") return null;
                const P = serialParts(v);
                return { year: P.y, month: P.m, day: P.d, hour: P.h, minute: P.mi, second: P.s, millisecond: P.ms, quarter: Math.floor(P.m / 3) + 1, dayofweek: P.wd + 1 }[e.f];
              }
            }
          }
          case "cmp": {
            const a = ev(e.a, row, grp), b = ev(e.b, row, grp);
            if (blank(a) || blank(b)) return e.o === "!=" ? !(blank(a) && blank(b)) : e.o === "=" ? blank(a) && blank(b) : false;
            let d;
            if (typeof a === "number" && typeof b === "number") d = a - b;
            else if (typeof a === "boolean" || typeof b === "boolean") d = (a === b) ? 0 : 1;
            else d = String(a).localeCompare(String(b));
            return { "=": d === 0, "!=": d !== 0, "<": d < 0, ">": d > 0, "<=": d <= 0, ">=": d >= 0 }[e.o];
          }
          case "str": {
            const a = ev(e.a, row, grp), b = ev(e.b, row, grp); if (a === null || b === null) return false;
            const s = String(a), t = String(b);
            if (e.o === "contains") return s.includes(t);
            if (e.o === "starts") return s.startsWith(t);
            if (e.o === "ends") return s.endsWith(t);
            if (e.o === "matches") { try { return new RegExp("^(?:" + t + ")$").test(s); } catch (x) { return false; } }
            if (e.o === "like") return new RegExp("^" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "s").test(s);
            return false;
          }
          case "isnull": { const a = ev(e.a, row, grp); return e.neg ? !blank(a) : blank(a); }
          case "not": return !ev(e.a, row, grp);
          case "and": return !!ev(e.a, row, grp) && !!ev(e.b, row, grp);
          case "or": return !!ev(e.a, row, grp) || !!ev(e.b, row, grp);
        }
        throw new Error("bad expression");
      }
      const hasAgg = e => !!e && (e.t === "agg" || (e.a && (isArr(e.a) ? e.a.some(hasAgg) : hasAgg(e.a))) || (e.b && hasAgg(e.b)));
      const headName = e => { const k = exprKey(e); const lab = Q.label.find(l => exprKey(l.e) === k); if (lab) return lab.s;
        return pretty(e); };
      const pretty = e => e.t === "col" ? (names[colIdx(e.id)] || (h ? "" : colLetters(colIdx(e.id)))) : e.t === "agg" ? e.f + " " + pretty(e.a)
        : e.t === "fn" ? e.f + "(" + e.a.map(pretty).join(", ") + ")" : e.t === "bin" ? pretty(e.a) + e.o + pretty(e.b) : e.t === "neg" ? "-" + pretty(e.a) : e.t === "lit" ? String(e.v) : "";

      let filtered = Q.where ? rows.filter(r => !!ev(Q.where, r, null)) : rows;
      const sel = Q.select || [...Array(width).keys()].map(i => ({ t: "col", id: "Col" + (i + 1) }));
      const aggMode = Q.group.length > 0 || Q.pivot.length > 0 || sel.some(hasAgg);
      let outHead, outRows;
      if (!aggMode) {
        if (Q.order.length) filtered = filtered.map((r, i) => ({ r, i })).sort((x, y) => { for (const o of Q.order) { const d = cmp(ev(o.e, x.r, null), ev(o.e, y.r, null)); if (d) return o.asc ? d : -d; } return x.i - y.i; }).map(x => x.r);
        outRows = filtered.map(r => sel.map(e => ev(e, r, null)));
        outHead = sel.map(headName);
      } else {
        const gkey = r => JSON.stringify(Q.group.map(g => ev(g, r, null)));
        const groups = new Map(); filtered.forEach(r => { const k = gkey(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
        if (!Q.group.length && !groups.size) groups.set("[]", []);
        const plain = sel.filter(e => !hasAgg(e)), aggs = sel.filter(hasAgg);
        if (Q.pivot.length) {
          const pkey = r => Q.pivot.map(pv => ev(pv, r, null)).map(v => v === null ? "" : String(v)).join(", ");
          const pvals = [...new Set(filtered.map(pkey))].sort((a, b) => cmp(a, b));
          outHead = plain.map(headName); pvals.forEach(pv => aggs.forEach(a => outHead.push(aggs.length > 1 ? pv + " " + headName(a) : pv)));
          outRows = [...groups.values()].map(g => { const r = plain.map(e => ev(e, g[0], g)); pvals.forEach(pv => { const sub = g.filter(x => pkey(x) === pv); aggs.forEach(a => r.push(sub.length ? ev(a, sub[0], sub) : null)); }); return { r, g }; });
        } else {
          outHead = sel.map(headName);
          outRows = [...groups.values()].map(g => ({ r: sel.map(e => ev(e, g[0] || null, g)), g }));
        }
        if (Q.order.length) outRows.sort((x, y) => { for (const o of Q.order) { const d = cmp(ev(o.e, x.g[0] || null, x.g), ev(o.e, y.g[0] || null, y.g)); if (d) return o.asc ? d : -d; } return 0; });
        outRows = outRows.map(x => x.r);
      }
      outRows = outRows.slice(Q.offset || 0, Q.limit === null ? undefined : (Q.offset || 0) + Q.limit);
      const showHead = h > 0 || aggMode || Q.label.length > 0;
      const out = (showHead ? [outHead] : []).concat(outRows).map(r => r.map(v => (v === null ? "" : v)));
      return out.length ? out : NA;
    } catch (e) {
      return "#VALUE!";   // Google shows the parse message in a note; the cell just says #VALUE!
    }
  }
  function queryError(data, query, headers) { try { parseQuery(String(one(query) ?? "")); return ""; } catch (e) { return e.message; } }

  // =====================================================================================================
  // data functions — fetch(kind, arg) is given by sheet.js:
  //   fetch("yahoo", url) -> JSON text, fetch("web", url) -> page text, fetch("range", {book, sheet, range}) -> 2-D values
  // =====================================================================================================
  const YIDX = { NIFTY_50: "^NSEI", NIFTY: "^NSEI", NIFTY_BANK: "^NSEBANK", BANKNIFTY: "^NSEBANK", NIFTY_FIN_SERVICE: "NIFTY_FIN_SERVICE.NS", FINNIFTY: "NIFTY_FIN_SERVICE.NS",
    NIFTY_MID_SELECT: "NIFTY_MID_SELECT.NS", MIDCPNIFTY: "NIFTY_MID_SELECT.NS", NIFTY_IT: "^CNXIT", NIFTY_NEXT_50: "^NSMIDCP", INDIA_VIX: "^INDIAVIX", INDIAVIX: "^INDIAVIX",
    SENSEX: "^BSESN", ".INX": "^GSPC", ".DJI": "^DJI", ".IXIC": "^IXIC", ".NDX": "^NDX", ".VIX": "^VIX" };
  function yahooSymbols(ticker) {
    const t = String(ticker || "").trim().toUpperCase(); if (!t) return [];
    const [ex, sym] = t.includes(":") ? t.split(/:(.+)/) : ["", t];
    if (ex === "NSE") return [sym + ".NS"];
    if (ex === "BOM" || ex === "BSE") return [sym + ".BO"];
    if (ex === "CURRENCY") return [sym + "=X"];
    if (/^INDEX/.test(ex) || ex === "") { if (YIDX[sym]) return [YIDX[sym]]; }
    if (ex === "") return /[.=^]/.test(sym) ? [sym] : [sym, sym + ".NS"];
    return [sym];   // NASDAQ:AAPL, NYSE:IBM … -> AAPL, IBM
  }
  const HIST = { open: "open", high: "high", low: "low", close: "close", volume: "volume", price: "close", all: "all" };
  async function GOOGLEFINANCE(fetch, ticker, attribute, start, endOrDays, interval) {
    const syms = yahooSymbols(one(ticker)); if (!syms.length) return NA;
    const attr = String(one(attribute) || "price").toLowerCase();
    const histWanted = start !== undefined && one(start) !== 0 && one(start) !== "";
    for (const sym of syms) {
      let j;
      if (!histWanted) {
        try { j = JSON.parse(await fetch("yahoo", "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?interval=1d&range=1d")); } catch (e) { j = null; }
        const r = j && j.chart && j.chart.result && j.chart.result[0]; if (!r || !r.meta) continue;
        const M = r.meta, q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
        const price = M.regularMarketPrice, prev = M.chartPreviousClose ?? M.previousClose;
        const last = a => isArr(a) ? a.filter(v => v != null).slice(-1)[0] : undefined;
        const map = {
          price, priceopen: last(q.open), open: last(q.open), high: M.regularMarketDayHigh ?? last(q.high), low: M.regularMarketDayLow ?? last(q.low),
          volume: M.regularMarketVolume ?? last(q.volume), closeyest: prev, change: price != null && prev != null ? price - prev : undefined,
          changepct: price != null && prev ? (price - prev) / prev * 100 : undefined, high52: M.fiftyTwoWeekHigh, low52: M.fiftyTwoWeekLow,
          tradetime: M.regularMarketTime ? msToSerial(M.regularMarketTime * 1000 + (M.gmtoffset || 0) * 1000) : undefined,
          datadelay: 0, currency: M.currency, name: M.longName || M.shortName, exchange: M.fullExchangeName || M.exchangeName
        };
        const v = map[attr];
        return v === undefined || v === null ? NA : v;
      }
      // history: start date, then an end date or a number of days
      const s0 = one(start), e0 = one(endOrDays);
      const startMs = typeof s0 === "number" ? serialToMs(Math.floor(s0)) : Date.parse(s0);
      if (!isFinite(startMs)) return VALUE;
      let endMs;
      if (e0 === undefined || e0 === "" || e0 === 0) endMs = startMs + DAY;
      else if (typeof e0 === "number" && e0 < 30000) endMs = startMs + e0 * DAY;   // a number of days
      else endMs = (typeof e0 === "number" ? serialToMs(Math.floor(e0)) : Date.parse(e0)) + DAY;
      const iv = /^week/i.test(String(one(interval) || "")) || one(interval) === 7 ? "1wk" : "1d";
      try { j = JSON.parse(await fetch("yahoo", "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?interval=" + iv + "&period1=" + Math.floor(startMs / 1000) + "&period2=" + Math.floor(endMs / 1000))); } catch (e) { j = null; }
      const r = j && j.chart && j.chart.result && j.chart.result[0]; if (!r || !r.meta) continue;
      const ts = r.timestamp || [], q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {}, off = (r.meta.gmtoffset || 0) * 1000;
      const key = HIST[attr]; if (!key) return NA;
      const dayAt = t => Math.floor(msToSerial(t * 1000 + off)) + 16 / 24;   // Google gives each day's close at 16:00
      const out = key === "all" ? [["Date", "Open", "High", "Low", "Close", "Volume"]] : [["Date", key === "volume" ? "Volume" : key[0].toUpperCase() + key.slice(1)]];
      ts.forEach((t, i) => { if (q.close && q.close[i] == null) return;
        out.push(key === "all" ? [dayAt(t), q.open[i], q.high[i], q.low[i], q.close[i], q.volume[i]] : [dayAt(t), q[key][i]]); });
      return out.length > 1 ? out : NA;
    }
    return NA;
  }

  async function IMPORTRANGE(fetch, book, range) {
    book = String(one(book) || "").trim(); range = String(one(range) || "").trim();
    if (!book || !range) return VALUE;
    const mm = /^(?:'?(.+?)'?!)?\$?([A-Za-z]{1,3})\$?(\d*)(?::\$?([A-Za-z]{1,3})\$?(\d*))?$/.exec(range);
    if (!mm) return VALUE;
    try { const v = await fetch("range", { book, sheet: mm[1] || "", range: range.replace(/^.*!/, "") }); return v && v.length ? v : NA; }
    catch (e) { return "#REF!"; }
  }

  function parseCsv(text, sep) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"') { q = true; continue; }
      if (c === sep) { row.push(cell); cell = ""; continue; }
      if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; continue; }
      cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    const w = Math.max(0, ...rows.map(r => r.length));
    return rows.map(r => { const o = r.map(v => (v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : v)); while (o.length < w) o.push(""); return o; });
  }
  async function IMPORTDATA(fetch, url, delimiter) {
    url = String(one(url) || "").trim(); if (!/^https:\/\//i.test(url)) return "#REF!";
    let t; try { t = await fetch("web", url); } catch (e) { return "#REF!"; }
    const sep = delimiter !== undefined && one(delimiter) !== 0 && one(delimiter) !== "" ? String(one(delimiter)) : (/\.tsv(\?|$)/i.test(url) ? "\t" : ",");
    const out = parseCsv(String(t), sep);
    return out.length ? out : NA;
  }
  const cellText = el => (el.textContent || "").replace(/\s+/g, " ").trim();
  const numIf = s => (s !== "" && !isNaN(Number(s.replace(/,/g, ""))) && /^[-+]?[\d,]*\.?\d+(e[-+]?\d+)?$/i.test(s) ? Number(s.replace(/,/g, "")) : s);
  async function IMPORTHTML(fetch, url, query, index) {
    url = String(one(url) || "").trim(); if (!/^https:\/\//i.test(url)) return "#REF!";
    const kind = String(one(query) || "table").toLowerCase(), n = Math.max(1, Math.floor(Number(one(index)) || 1));
    let t; try { t = await fetch("web", url); } catch (e) { return "#REF!"; }
    const doc = new DOMParser().parseFromString(String(t), "text/html");
    if (kind === "list") {
      const lists = doc.querySelectorAll("ul, ol"), L = lists[n - 1]; if (!L) return NA;
      const items = [...L.children].filter(x => x.tagName === "LI").map(li => [numIf(cellText(li))]);
      return items.length ? items : NA;
    }
    const T = doc.querySelectorAll("table")[n - 1]; if (!T) return NA;
    const grid = [];
    [...T.rows].forEach((tr, ri) => {
      grid[ri] = grid[ri] || []; let ci = 0;
      [...tr.cells].forEach(td => {
        while (grid[ri][ci] !== undefined) ci++;
        const cs = Math.max(1, td.colSpan || 1), rs = Math.max(1, td.rowSpan || 1), v = numIf(cellText(td));
        for (let r = 0; r < rs; r++) for (let c = 0; c < cs; c++) { grid[ri + r] = grid[ri + r] || []; grid[ri + r][ci + c] = r === 0 && c === 0 ? v : ""; }
        ci += cs;
      });
    });
    const w = Math.max(0, ...grid.map(r => (r ? r.length : 0)));
    const out = grid.filter(Boolean).map(r => { const o = []; for (let i = 0; i < w; i++) o.push(r[i] === undefined ? "" : r[i]); return o; });
    return out.length ? out : NA;
  }
  async function IMPORTXML(fetch, url, xpath) {
    url = String(one(url) || "").trim(); xpath = String(one(xpath) || "").trim(); if (!/^https:\/\//i.test(url) || !xpath) return "#REF!";
    let t; try { t = await fetch("web", url); } catch (e) { return "#REF!"; }
    const s = String(t), isXml = /^\s*<\?xml/i.test(s) && !/<html/i.test(s.slice(0, 2000));
    const doc = new DOMParser().parseFromString(s, isXml ? "application/xml" : "text/html");
    let res;
    try { res = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null); } catch (e) { return "#VALUE!"; }
    if (res.resultType === XPathResult.NUMBER_TYPE) return res.numberValue;
    if (res.resultType === XPathResult.STRING_TYPE) return numIf(res.stringValue.trim());
    if (res.resultType === XPathResult.BOOLEAN_TYPE) return res.booleanValue;
    const out = []; let node;
    while ((node = res.iterateNext())) {
      const kids = node.nodeType === 1 ? [...node.children] : [];
      if (kids.length > 1 && kids.every(k => !k.children.length)) out.push(kids.map(k => numIf(cellText(k))));
      else out.push([numIf(node.nodeType === 2 ? String(node.value).trim() : cellText(node))]);
      if (out.length > 5000) break;
    }
    if (!out.length) return NA;
    const w = Math.max(...out.map(r => r.length));
    return out.map(r => { while (r.length < w) r.push(""); return r; });
  }

  const SYNC = { QUERY, SPLIT, JOIN, ARRAYFORMULA, FLATTEN, ARRAY_CONSTRAIN, SORTN, COUNTUNIQUE, ENCODEURL };
  const ASYNC = { GOOGLEFINANCE, IMPORTRANGE, IMPORTDATA, IMPORTHTML, IMPORTXML };
  const HELP = {
    QUERY: "QUERY(data, query, [headers]) - Google query language: select, where, group by, pivot, order by, limit, offset, label. Columns: A, B… from the first column of the data, or Col1, Col2…",
    SPLIT: "SPLIT(text, delimiter, [split_by_each], [remove_empty_text])",
    JOIN: "JOIN(delimiter, value_or_array1, …)",
    ARRAYFORMULA: "ARRAYFORMULA(array_formula) - arrays work without it too",
    FLATTEN: "FLATTEN(range1, …) - all values in one column",
    ARRAY_CONSTRAIN: "ARRAY_CONSTRAIN(input_range, num_rows, num_cols)",
    SORTN: "SORTN(range, [n], [display_ties_mode], [sort_column], [is_ascending], …)",
    COUNTUNIQUE: "COUNTUNIQUE(value1, …)",
    ENCODEURL: "ENCODEURL(text)",
    GOOGLEFINANCE: "GOOGLEFINANCE(ticker, [attribute], [start_date], [end_date|num_days], [interval]) - e.g. \"NSE:RELIANCE\", \"INDEXNSE:NIFTY_50\", \"CURRENCY:USDINR\". Moltrix Android app only",
    IMPORTRANGE: "IMPORTRANGE(sheet, range) - another Moltrix Sheet by name, or an Excel file in your OneDrive (path ending .xlsx), e.g. IMPORTRANGE(\"Stock\", \"Sheet1!A1:D20\")",
    IMPORTDATA: "IMPORTDATA(url, [delimiter]) - a CSV / TSV file. Moltrix Android app only",
    IMPORTHTML: "IMPORTHTML(url, \"table\"|\"list\", index). Moltrix Android app only",
    IMPORTXML: "IMPORTXML(url, xpath_query). Moltrix Android app only"
  };
  root.mzSheetFns = { SYNC, ASYNC, HELP, parseQuery, queryError, yahooSymbols, parseCsv, isoToSerial, msToSerial, serialToMs };
})(typeof window !== "undefined" ? window : globalThis);
