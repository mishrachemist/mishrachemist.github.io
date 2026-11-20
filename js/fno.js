/* ===================== F&O (Market → F&O) =====================
   Option chain + OI / PCR / max pain, BUY CE / PE checklist, expiry-day gamma alert and option-selling setup for
   NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY and F&O stocks. The data comes from NSE on the phone itself (the Moltrix
   Android app opens NSE's own page in the background and asks its option-chain API; Yahoo gives the price candles),
   because NSE blocks cloud servers. Rules are mechanical and written in FNO_CFG. Not investment advice.
   Missing data stays missing (shown as NOT FOUND), never guessed. ===== */
(function fnoModule() {
  const FNO_CFG = {
    TZ: "Asia/Kolkata",
    NSE_BASES: ["https://www.nseindia.in", "https://www.nseindia.com"],   // NSE moved to .in in Nov 2026; .com as spare
    INDICES: [
      { s: "NIFTY", y: "^NSEI" }, { s: "BANKNIFTY", y: "^NSEBANK" },
      { s: "FINNIFTY", y: "NIFTY_FIN_SERVICE.NS" }, { s: "MIDCPNIFTY", y: "NIFTY_MID_SELECT.NS" }
    ],
    POLL_SEL_S: 60, POLL_ALL_S: 180,              // seconds: chosen symbol / the index cards
    MARKET: ["09:15", "15:30"],
    SIG_WINDOW: ["09:30", "14:30"],               // new BUY CE / PE only in this time
    PCR_BULL: 1.0, PCR_BEAR: 0.8,                 // BUY CE needs PCR ≥ 1.0, BUY PE needs PCR ≤ 0.8
    ROOM_PCT: 0.3,                                // at least 0.3 % room to the biggest OI wall in the trade's direction
    NEAR_STEPS: 2,                                // ATM ± 2 strikes for the change-in-OI check
    SL_PCT: 25, T1_PCT: 25, T2_PCT: 50,           // premium stop-loss / targets (T1 = 1R, T2 = 2R)
    GAMMA_FROM: "11:00", GAMMA_WIN_MIN: 15, GAMMA_JUMP_PCT: 50, GAMMA_MIN_PREM: 2,
    SELL_VIX_MAX: 16, SELL_PCR: [0.8, 1.25], SELL_MIN_STEPS: 2, SELL_MAX_DTE: 7, SELL_HEDGE_STEPS: 3,
    CHAIN_ROWS: 8                                 // strikes shown each side of ATM
  };
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const NF = "NOT FOUND";
  const native = () => !!(window.MoltrixApp && typeof MoltrixApp.mkGet === "function" && typeof MoltrixApp.mkTake === "function");
  const nativeOld = () => !!(window.MoltrixApp && !native());

  // ---------- requests through the Android app ----------
  const pend = new Map(); let seq = 0;
  window.mzMkDone = id => {
    const cb = pend.get(id); if (!cb) return; pend.delete(id);
    let r; try { r = JSON.parse(MoltrixApp.mkTake(id) || "{}"); } catch (e) { r = { s: 0, t: String(e) }; }
    cb(r);
  };
  const call = (fn, ...a) => new Promise(res => {
    const id = "mk" + (++seq) + "_" + Date.now().toString(36);
    pend.set(id, res);
    try { MoltrixApp[fn](id, ...a); } catch (e) { pend.delete(id); res({ s: 0, t: String(e) }); return; }
    setTimeout(() => { if (pend.has(id)) { pend.delete(id); res({ s: 0, t: "timeout" }); } }, 32000);
  });
  const json = r => { try { return r && r.s === 200 ? JSON.parse(r.t) : null; } catch (e) { return null; } };
  let nseBase = (() => { try { return localStorage.getItem("fnoNseBase") || FNO_CFG.NSE_BASES[0]; } catch (e) { return FNO_CFG.NSE_BASES[0]; } })();
  async function nse(path) {
    const bases = [nseBase, ...FNO_CFG.NSE_BASES.filter(b => b !== nseBase)];
    let last = null;
    for (const b of bases) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await call("mkGet", b + "/option-chain", path);
        const j = json(r);
        if (j) { if (b !== nseBase) { nseBase = b; try { localStorage.setItem("fnoNseBase", b); } catch (e) {} } return j; }
        last = r;
        if (!(r && (r.s === 401 || r.s === 403))) break;      // 401/403: the app opened NSE again - ask once more
        await new Promise(x => setTimeout(x, 2500));
      }
    }
    throw new Error("NSE: " + (last ? (last.s ? "HTTP " + last.s : last.t || "no answer") : "no answer"));
  }
  async function yahoo(sym, interval, range) {
    const r = await call("httpGet", "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?interval=" + (interval || "5m") + "&range=" + (range || "5d"));
    const j = json(r), res = j && j.chart && j.chart.result && j.chart.result[0];
    if (!res || !res.timestamp) return null;
    const q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
    const bars = res.timestamp.map((t, i) => ({ t, o: q.open && q.open[i], h: q.high && q.high[i], l: q.low && q.low[i], c: q.close && q.close[i], v: q.volume && q.volume[i] }))
      .filter(b => b.c != null && b.h != null && b.l != null);
    return bars.length ? bars : null;
  }

  // ---------- time (IST) ----------
  const istParts = d => Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: FNO_CFG.TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false })
    .formatToParts(d || new Date()).map(p => [p.type, p.value]));
  const istHM = d => { const p = istParts(d); return `${p.hour === "24" ? "00" : p.hour}:${p.minute}`; };
  const istDate = d => { const p = istParts(d); return `${p.year}-${p.month}-${p.day}`; };
  const marketOpen = () => { const p = istParts(); if (p.weekday === "Sat" || p.weekday === "Sun") return false; const hm = istHM(); return hm >= FNO_CFG.MARKET[0] && hm <= FNO_CFG.MARKET[1]; };
  const MON = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const expISO = e => {
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(String(e || "").trim()); if (!m) return "";
    const mm = MON[m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()];
    return mm ? `${m[3]}-${mm}-${m[1].padStart(2, "0")}` : "";
  };
  const dte = e => { const iso = expISO(e); if (!iso) return null; return Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(istDate() + "T00:00:00Z")) / 86400000); };

  // ---------- maths ----------
  const num = v => (v === null || v === undefined || v === "" || v === "-" || !isFinite(+v)) ? null : +v;
  const tick = v => Math.round(v * 20) / 20;
  const ema = (arr, n) => { const k = 2 / (n + 1); let e = null; return arr.map(x => (e = e === null ? x : x * k + e * (1 - k))); };
  function parseChain(j, wantExp) {
    const rec = (j && (j.records || j)) || {};
    let data = Array.isArray(rec.data) ? rec.data : (j && j.filtered && Array.isArray(j.filtered.data) ? j.filtered.data : []);
    if (wantExp) { const f = data.filter(d => (d.expiryDate || (d.CE || d.PE || {}).expiryDate) === wantExp); if (f.length) data = f; }
    const rows = data.map(d => ({ k: num(d.strikePrice), ce: d.CE || null, pe: d.PE || null })).filter(r => r.k !== null).sort((a, b) => a.k - b.k);
    let spot = num(rec.underlyingValue);
    if (spot === null) for (const r of rows) { const v = num((r.ce && r.ce.underlyingValue) || (r.pe && r.pe.underlyingValue)); if (v !== null) { spot = v; break; } }
    const exp = wantExp || (rows[0] && ((rows[0].ce || rows[0].pe || {}).expiryDate)) || "";
    return { rows, spot, ts: rec.timestamp || "", exp };
  }
  const oi = o => (o && num(o.openInterest)) || 0, doi = o => (o && num(o.changeinOpenInterest)) || 0, ltp = o => o ? num(o.lastPrice) : null;
  function analyse(ch) {
    const R = ch.rows; if (!R.length || ch.spot === null) return null;
    const diffs = []; for (let i = 1; i < R.length; i++) diffs.push(R[i].k - R[i - 1].k);
    diffs.sort((a, b) => a - b); const step = diffs.length ? diffs[Math.floor(diffs.length / 2)] : null;
    let atmI = 0; R.forEach((r, i) => { if (Math.abs(r.k - ch.spot) < Math.abs(R[atmI].k - ch.spot)) atmI = i; });
    const ceOI = R.reduce((s, r) => s + oi(r.ce), 0), peOI = R.reduce((s, r) => s + oi(r.pe), 0);
    const ceD = R.reduce((s, r) => s + doi(r.ce), 0), peD = R.reduce((s, r) => s + doi(r.pe), 0);
    let mp = null, mpPain = Infinity;
    for (const S of R) { let p = 0; for (const r of R) p += oi(r.ce) * Math.max(0, S.k - r.k) + oi(r.pe) * Math.max(0, r.k - S.k); if (p < mpPain) { mpPain = p; mp = S.k; } }
    const maxBy = f => R.reduce((b, r) => (f(r) > f(b) ? r : b), R[0]);
    const res = maxBy(r => oi(r.ce)), sup = maxBy(r => oi(r.pe));
    const near = R.slice(Math.max(0, atmI - FNO_CFG.NEAR_STEPS), atmI + FNO_CFG.NEAR_STEPS + 1);
    return { step, atmI, atm: R[atmI].k, ceOI, peOI, ceD, peD, pcr: ceOI ? peOI / ceOI : null, pcrD: ceD > 0 && peD > 0 ? peD / ceD : null, maxPain: mp,
      res: oi(res.ce) ? res.k : null, sup: oi(sup.pe) ? sup.k : null, nearCeD: near.reduce((s, r) => s + doi(r.ce), 0), nearPeD: near.reduce((s, r) => s + doi(r.pe), 0) };
  }
  function trendOf(bars, isIndex) {
    if (!bars || bars.length < 25) return null;
    const c = bars.map(b => b.c), L = c.length - 1, e9 = ema(c, 9)[L], e21 = ema(c, 21)[L];
    const day = istDate(new Date(bars[L].t * 1000)), today = bars.filter(b => istDate(new Date(b.t * 1000)) === day);
    let vwap = null;
    if (!isIndex) { let pv = 0, vv = 0; today.forEach(b => { if (b.v) { pv += (b.h + b.l + b.c) / 3 * b.v; vv += b.v; } }); vwap = vv ? pv / vv : null; }
    const mom = L >= 3 ? c[L] - c[L - 3] : null;
    return { last: c[L], e9, e21, vwap, mom, at: istHM(new Date((bars[L].t + 300) * 1000)), day };
  }
  function signal(ch, a, tr) {
    const hm = istHM(), inWin = marketOpen() && hm >= FNO_CFG.SIG_WINDOW[0] && hm <= FNO_CFG.SIG_WINDOW[1];
    const mk = side => {
      const up = side === 1, chk = [];
      const add = (name, ok, txt) => chk.push({ name, ok, txt });
      add("Trend (5-min EMA 9 / 21)", tr ? (up ? tr.last > tr.e21 && tr.e9 > tr.e21 : tr.last < tr.e21 && tr.e9 < tr.e21) : null,
        tr ? `${tr.last.toFixed(2)} · EMA9 ${tr.e9.toFixed(1)} / EMA21 ${tr.e21.toFixed(1)}` : NF);
      if (tr && tr.vwap !== null) add("VWAP", up ? tr.last > tr.vwap : tr.last < tr.vwap, "VWAP " + tr.vwap.toFixed(2));
      else add("Last 15 min", tr && tr.mom !== null ? (up ? tr.mom > 0 : tr.mom < 0) : null, tr && tr.mom !== null ? (tr.mom >= 0 ? "+" : "") + tr.mom.toFixed(2) : NF);
      add(`PCR ${up ? "≥ " + FNO_CFG.PCR_BULL : "≤ " + FNO_CFG.PCR_BEAR}`, a.pcr === null ? null : up ? a.pcr >= FNO_CFG.PCR_BULL : a.pcr <= FNO_CFG.PCR_BEAR, a.pcr === null ? NF : a.pcr.toFixed(2));
      add(`ATM ± ${FNO_CFG.NEAR_STEPS}: ${up ? "put" : "call"} writing more`, up ? a.nearPeD > a.nearCeD : a.nearCeD > a.nearPeD, `ΔOI CE ${fmtN(a.nearCeD)} · PE ${fmtN(a.nearPeD)}`);
      const wall = up ? a.res : a.sup, room = wall === null ? null : (up ? (wall - ch.spot) : (ch.spot - wall)) / ch.spot * 100;
      add(`Room to ${up ? "resistance" : "support"} ≥ ${FNO_CFG.ROOM_PCT} %`, room === null ? null : room >= FNO_CFG.ROOM_PCT, wall === null ? NF : `${wall} (${room.toFixed(2)} %)`);
      add(`Time ${FNO_CFG.SIG_WINDOW[0]}–${FNO_CFG.SIG_WINDOW[1]}`, inWin, hm);
      const pass = chk.filter(x => x.ok === true).length;
      return { side, chk, pass, all: chk.every(x => x.ok === true) };
    };
    const ce = mk(1), pe = mk(-1);
    const best = ce.pass >= pe.pass ? ce : pe;
    const row = ch.rows[a.atmI], leg = best.side === 1 ? row.ce : row.pe, p = ltp(leg);
    const out = { ce, pe, best, strike: row.k, type: best.side === 1 ? "CE" : "PE", prem: p };
    out.signal = best.all ? (best.side === 1 ? "BUY CE" : "BUY PE") : best.pass >= best.chk.length - 2 ? (best.side === 1 ? "WATCH (CE)" : "WATCH (PE)") : "NO TRADE";
    if (best.all && p) Object.assign(out, { sl: tick(p * (1 - FNO_CFG.SL_PCT / 100)), t1: tick(p * (1 + FNO_CFG.T1_PCT / 100)), t2: tick(p * (1 + FNO_CFG.T2_PCT / 100)) });
    return out;
  }
  function sellSetup(ch, a, vix) {
    const R = ch.rows, st = a.step || 0;
    const above = R.filter(r => r.k > ch.spot && oi(r.ce)), below = R.filter(r => r.k < ch.spot && oi(r.pe));
    if (!above.length || !below.length) return null;
    const sc = above.reduce((b, r) => (oi(r.ce) > oi(b.ce) ? r : b), above[0]), sp = below.reduce((b, r) => (oi(r.pe) > oi(b.pe) ? r : b), below[0]);
    const find = k => R.find(r => r.k === k);
    const hc = find(sc.k + FNO_CFG.SELL_HEDGE_STEPS * st), hp = find(sp.k - FNO_CFG.SELL_HEDGE_STEPS * st);
    const cP = ltp(sc.ce), pP = ltp(sp.pe), hcP = hc ? ltp(hc.ce) : null, hpP = hp ? ltp(hp.pe) : null;
    const credit = cP !== null && pP !== null ? cP + pP : null;
    const condor = credit !== null && hcP !== null && hpP !== null ? credit - hcP - hpP : null;
    const d = dte(ch.exp), chk = [];
    const add = (name, ok, txt) => chk.push({ name, ok, txt });
    add(`India VIX ≤ ${FNO_CFG.SELL_VIX_MAX}`, vix === null ? null : vix <= FNO_CFG.SELL_VIX_MAX, vix === null ? NF : vix.toFixed(2));
    add(`PCR ${FNO_CFG.SELL_PCR[0]}–${FNO_CFG.SELL_PCR[1]}`, a.pcr === null ? null : a.pcr >= FNO_CFG.SELL_PCR[0] && a.pcr <= FNO_CFG.SELL_PCR[1], a.pcr === null ? NF : a.pcr.toFixed(2));
    add(`Short strikes ≥ ${FNO_CFG.SELL_MIN_STEPS} strikes away`, st ? sc.k - ch.spot >= FNO_CFG.SELL_MIN_STEPS * st && ch.spot - sp.k >= FNO_CFG.SELL_MIN_STEPS * st : null, `${sp.k} PE · ${sc.k} CE`);
    add(`Days to expiry ≤ ${FNO_CFG.SELL_MAX_DTE}`, d === null ? null : d <= FNO_CFG.SELL_MAX_DTE, d === null ? NF : String(d));
    return { sc: sc.k, sp: sp.k, cP, pP, credit, hc: hc ? hc.k : null, hp: hp ? hp.k : null, hcP, hpP, condor,
      beUp: credit !== null ? sc.k + credit : null, beDn: credit !== null ? sp.k - credit : null,
      maxLoss: condor !== null && st ? FNO_CFG.SELL_HEDGE_STEPS * st - condor : null, chk, ok: chk.every(x => x.ok === true) };
  }
  // expiry-day gamma: premiums of ATM ± 2 kept for 15 minutes (only while this screen is open)
  const gHist = new Map();   // symbol|exp -> [{t, p:{"25600CE": 12.3, ...}}]
  const gSent = new Map();
  function gamma(sym, ch, a) {
    const isExp = expISO(ch.exp) === istDate();
    if (!isExp) return { isExp, next: ch.exp };
    const key = sym + "|" + ch.exp, now = Date.now(), H = gHist.get(key) || [];
    const p = {}; ch.rows.slice(Math.max(0, a.atmI - 2), a.atmI + 3).forEach(r => { const c = ltp(r.ce), q = ltp(r.pe); if (c !== null) p[r.k + " CE"] = c; if (q !== null) p[r.k + " PE"] = q; });
    H.push({ t: now, p }); while (H.length && now - H[0].t > FNO_CFG.GAMMA_WIN_MIN * 60000) H.shift(); gHist.set(key, H);
    const hits = [];
    if (istHM() >= FNO_CFG.GAMMA_FROM && marketOpen()) for (const k in p) {
      const lows = H.map(h => h.p[k]).filter(v => v != null), lo = Math.min(...lows);
      if (lows.length >= 2 && p[k] >= FNO_CFG.GAMMA_MIN_PREM && lo > 0 && (p[k] / lo - 1) * 100 >= FNO_CFG.GAMMA_JUMP_PCT) hits.push({ k, from: lo, now: p[k], pct: (p[k] / lo - 1) * 100 });
    }
    hits.forEach(h => {
      const id = key + "|" + h.k; if (now - (gSent.get(id) || 0) < FNO_CFG.GAMMA_WIN_MIN * 60000) return; gSent.set(id, now);
      try { if (window.MoltrixApp && MoltrixApp.notify) MoltrixApp.notify(`⚡ ${sym} ${h.k} +${h.pct.toFixed(0)} %`, `${h.from.toFixed(2)} → ${h.now.toFixed(2)} in ≤ ${FNO_CFG.GAMMA_WIN_MIN} min (expiry today)`); } catch (e) {}
    });
    return { isExp, hits, samples: H.length, from: FNO_CFG.GAMMA_FROM };
  }

  // ---------- data per symbol ----------
  const state = { sel: "NIFTY", exp: {}, data: {}, vix: null, vixAt: 0, busy: false, timer: 0, allAt: 0, open: false, err: "",
    tab: (() => { try { return localStorage.getItem("fnoTab") === "scr" ? "scr" : "chain"; } catch (e) { return "chain"; } })() };
  const isIndex = s => FNO_CFG.INDICES.some(x => x.s === s);
  const ySym = s => (FNO_CFG.INDICES.find(x => x.s === s) || {}).y || (s + ".NS");
  async function load(sym, withTrend) {
    const type = isIndex(sym) ? "Indices" : "Equity";
    let exps = (state.data[sym] && state.data[sym].exps) || null;
    if (!exps) { const ci = await nse("/api/option-chain-contract-info?symbol=" + encodeURIComponent(sym)); exps = (ci && ci.expiryDates) || []; if (!exps.length) throw new Error(sym + ": no expiry dates from NSE"); }
    const today = istDate(); exps = exps.filter(e => !expISO(e) || expISO(e) >= today);
    const exp = state.exp[sym] && exps.includes(state.exp[sym]) ? state.exp[sym] : exps[0];
    const j = await nse(`/api/option-chain-v3?type=${type}&symbol=${encodeURIComponent(sym)}&expiry=${encodeURIComponent(exp)}`);
    const ch = parseChain(j, exp), a = analyse(ch);
    if (!a) throw new Error(sym + ": empty option chain");
    const d = { sym, exps, exp, ch, a, at: Date.now(), tr: (state.data[sym] || {}).tr || null };
    if (withTrend) { try { d.tr = trendOf(await yahoo(ySym(sym)), isIndex(sym)); } catch (e) { d.tr = null; } }
    d.sig = signal(ch, a, d.tr);
    state.data[sym] = d;
    return d;
  }
  async function loadVix() {
    if (Date.now() - state.vixAt < 5 * 60000 && state.vix !== null) return;
    try { const j = await nse("/api/allIndices"); const v = (j && j.data || []).find(x => /INDIA VIX/i.test(x.index || x.indexSymbol || "")); state.vix = v ? num(v.last) : null; state.vixAt = Date.now(); } catch (e) {}
  }
  async function refresh(all) {
    if (state.busy || !native()) return;
    state.busy = true; state.err = ""; renderStatus("…");
    try {
      await loadVix();
      try { const d = await load(state.sel, true); d.g = gamma(state.sel, d.ch, d.a); } catch (e) { state.err = e.message || String(e); }
      renderAll();
      if (all || Date.now() - state.allAt > FNO_CFG.POLL_ALL_S * 1000) {
        for (const x of FNO_CFG.INDICES) if (x.s !== state.sel) { try { await load(x.s, true); } catch (e) {} renderCards(); }
        state.allAt = Date.now();
      }
    } finally { state.busy = false; renderAll(); schedule(); }
  }
  function schedule() {
    clearTimeout(state.timer);
    if (!state.open || !marketOpen() || state.tab !== "chain") return;
    state.timer = setTimeout(() => {
      const r = $("fnoRoot");
      if (!r || r.offsetParent === null) { state.open = false; return; }   // F&O screen left (another tab / section)
      if (document.visibilityState === "visible") refresh(false); else schedule();
    }, FNO_CFG.POLL_SEL_S * 1000);
  }

  // ---------- screen ----------
  const fmtN = v => { if (v === null || v === undefined || !isFinite(v)) return NF; const a = Math.abs(v); return (v < 0 ? "−" : "") + (a >= 1e7 ? (a / 1e7).toFixed(2) + " Cr" : a >= 1e5 ? (a / 1e5).toFixed(2) + " L" : a >= 1e3 ? (a / 1e3).toFixed(1) + " K" : String(Math.round(a))); };
  const f2 = v => v === null || v === undefined || !isFinite(v) ? NF : (+v).toFixed(2);
  const mark = ok => ok === true ? '<b class="fOk">✓</b>' : ok === false ? '<b class="fNo">✗</b>' : '<b class="fNa">?</b>';
  const sigCls = s => /^BUY CE/.test(s) ? "fBuy" : /^BUY PE/.test(s) ? "fSell" : /WATCH/.test(s) ? "fWatch" : "fNone";
  function ensureRoot() {
    let r = $("fnoRoot"); if (r) return r;
    const wrap = document.querySelector("#marketSubContent .mdWrap"); if (!wrap) return null;
    r = document.createElement("div"); r.id = "fnoRoot"; r.className = "fnoRoot hidden";
    wrap.parentNode.insertBefore(r, wrap.nextSibling);
    r.addEventListener("click", e => {
      const tab = e.target.closest("[data-ftab]");
      if (tab) { state.tab = tab.dataset.ftab; try { localStorage.setItem("fnoTab", state.tab); } catch (x) {} renderAll();
        if (state.tab === "scr") { if (Date.now() - scr.at > SCR_CFG.RESCAN_MIN * 60000) scan(); else scheduleScr(); } else refresh(false); return; }
      if (e.target.closest("#scrGo")) { scan(); return; }
      const row = e.target.closest("[data-scrsym]");
      if (row) { state.sel = row.dataset.scrsym; state.tab = "chain"; renderAll(); refresh(false); window.scrollTo({ top: 0, behavior: "instant" }); return; }
      const chip = e.target.closest("[data-fsym]"); if (chip) { state.sel = chip.dataset.fsym; renderAll(); refresh(false); return; }
      if (e.target.id === "fnoStkGo") { const v = ($("fnoStk").value || "").trim().toUpperCase().replace(/[^A-Z0-9&-]/g, ""); if (v) { state.sel = v; renderAll(); refresh(false); } }
    });
    r.addEventListener("change", e => { if (e.target.id === "fnoExp") { state.exp[state.sel] = e.target.value; refresh(false); } });
    r.addEventListener("keydown", e => { if (e.target.id === "fnoStk" && e.key === "Enter") { e.preventDefault(); $("fnoStkGo").click(); } });
    return r;
  }
  function renderStatus(t) { const s = $("fnoStatus"); if (s) s.textContent = t; }
  function renderCards() {
    const box = $("fnoCards"); if (!box) return;
    box.innerHTML = FNO_CFG.INDICES.map(x => {
      const d = state.data[x.s];
      return `<button type="button" class="fCard${state.sel === x.s ? " on" : ""}" data-fsym="${x.s}"><b>${x.s}</b>
        <span class="fSpot">${d ? d.ch.spot.toFixed(2) : "…"}</span>
        <span>PCR ${d && d.a.pcr !== null ? d.a.pcr.toFixed(2) : "…"}</span>
        <span class="fExp">${d ? "Exp " + esc(d.exp.replace(/-\d{4}$/, "")) + (dte(d.exp) !== null ? " · " + (dte(d.exp) === 0 ? "today" : dte(d.exp) + "d") : "") : ""}</span>
        <i class="${d ? sigCls(d.sig.signal) : "fNone"}">${d ? esc(d.sig.signal) : "…"}</i></button>`;
    }).join("");
  }
  function renderAll() {
    const r = ensureRoot(); if (!r) return;
    if (!native()) {
      r.innerHTML = `<div class="fnoMsg">${nativeOld() ? "📲 Update the Moltrix app: ☰ → Download Android App" : "📱 F&amp;O opens in the Moltrix Android app."}</div>`;
      return;
    }
    if (!r.dataset.built) {
      r.dataset.built = "1";
      r.innerHTML = `<div class="fTabs"><button type="button" data-ftab="chain">📋 Option chain</button><button type="button" data-ftab="scr">🔎 Screener</button></div>
        <div id="fnoScrView" class="hidden"></div><div id="fnoChainView"><div class="fCards" id="fnoCards"></div>
        <div class="fBar"><input id="fnoStk" class="fStk" placeholder="F&amp;O stock e.g. RELIANCE" autocomplete="off" spellcheck="false"><button type="button" id="fnoStkGo">Go</button>
          <select id="fnoExp" aria-label="Expiry"></select></div>
        <div class="fStatus"><span id="fnoStatus"></span><span class="mzInfoNote fRules" data-info-for=".fStatus">${esc(rulesText())}</span></div>
        <div id="fnoBody"></div></div>`;
      if (window.mzInfoAttach) window.mzInfoAttach(r);
    }
    r.querySelectorAll("[data-ftab]").forEach(b => b.classList.toggle("on", b.dataset.ftab === state.tab));
    $("fnoChainView").classList.toggle("hidden", state.tab !== "chain");
    $("fnoScrView").classList.toggle("hidden", state.tab !== "scr");
    if (state.tab === "scr") { renderScr(); return; }
    renderCards();
    const d = state.data[state.sel], body = $("fnoBody");
    const sel = $("fnoExp");
    if (d) { sel.innerHTML = d.exps.map(e => `<option${e === d.exp ? " selected" : ""}>${esc(e)}</option>`).join(""); sel.classList.remove("hidden"); } else sel.classList.add("hidden");
    const age = d ? Math.round((Date.now() - d.at) / 60000) : null;
    renderStatus(state.busy ? "Loading…" : state.err ? "⚠️ " + state.err : d ? `${d.sym} · ${d.ch.ts || istHM(new Date(d.at))}${age ? ` · ${age} min ago` : ""}${marketOpen() ? "" : " · market closed"}` : "");
    if (!d) { body.innerHTML = state.busy ? '<div class="fnoMsg">Loading NSE data…</div>' : ""; return; }
    const a = d.a, s = d.sig, ch = d.ch;
    const chkList = c => c.chk.map(x => `<li>${mark(x.ok)} ${esc(x.name)} <small>${esc(x.txt)}</small></li>`).join("");
    const g = d.g || {}, ss = sellSetup(ch, a, state.vix);
    const lo = Math.max(0, a.atmI - FNO_CFG.CHAIN_ROWS), hi = Math.min(ch.rows.length, a.atmI + FNO_CFG.CHAIN_ROWS + 1), rows = ch.rows.slice(lo, hi);
    const maxCe = Math.max(1, ...rows.map(r => oi(r.ce))), maxPe = Math.max(1, ...rows.map(r => oi(r.pe)));
    body.innerHTML = `
      <div class="fGrid">
        <div class="fTile"><small>Spot</small><b>${f2(ch.spot)}</b></div>
        <div class="fTile"><small>PCR (OI)</small><b>${a.pcr === null ? NF : a.pcr.toFixed(2)}</b></div>
        <div class="fTile"><small>Max pain</small><b>${a.maxPain ?? NF}</b></div>
        <div class="fTile"><small>Support (PE OI)</small><b>${a.sup ?? NF}</b></div>
        <div class="fTile"><small>Resistance (CE OI)</small><b>${a.res ?? NF}</b></div>
        <div class="fTile"><small>India VIX</small><b>${state.vix === null ? NF : state.vix.toFixed(2)}</b></div>
      </div>
      <div class="fBox"><div class="fHead">🎯 Signal <i class="${sigCls(s.signal)}">${esc(s.signal)}</i></div>
        ${s.sl ? `<div class="fLv"><span>${esc(s.strike + " " + s.type)}</span><span>Entry ${f2(s.prem)}</span><span class="fNo">SL ${f2(s.sl)}</span><span class="fOk">T1 ${f2(s.t1)}</span><span class="fOk">T2 ${f2(s.t2)}</span></div>` : ""}
        <div class="fTwo"><div><div class="fSub">BUY CE ${s.ce.pass}/${s.ce.chk.length}</div><ul class="fChk">${chkList(s.ce)}</ul></div>
        <div><div class="fSub">BUY PE ${s.pe.pass}/${s.pe.chk.length}</div><ul class="fChk">${chkList(s.pe)}</ul></div></div></div>
      <div class="fBox"><div class="fHead">⚡ Expiry-day gamma ${g.isExp ? `<i class="${g.hits && g.hits.length ? "fSell" : "fNone"}">${g.hits && g.hits.length ? "ALERT" : "watching"}</i>` : ""}</div>
        ${g.isExp ? (g.hits && g.hits.length ? `<ul class="fChk">${g.hits.map(h => `<li><b class="fSell">${esc(h.k)}</b> ${f2(h.from)} → ${f2(h.now)} <small>+${h.pct.toFixed(0)} %</small></li>`).join("")}</ul>`
          : `<small>ATM ± 2 · from ${esc(g.from)} · ${g.samples || 0} readings</small>`) : `<small>Expiry ${esc(ch.exp)}${dte(ch.exp) !== null ? ` · ${dte(ch.exp)} day(s) left` : ""}</small>`}</div>
      <div class="fBox"><div class="fHead">🛡️ Option selling ${ss ? `<i class="${ss.ok ? "fBuy" : "fNone"}">${ss.ok ? "SETUP OK" : "NOT NOW"}</i>` : ""}</div>
        ${ss ? `<div class="fLv"><span>Sell ${ss.sp} PE ${f2(ss.pP)}</span><span>Sell ${ss.sc} CE ${f2(ss.cP)}</span><span>Credit ${f2(ss.credit)}</span></div>
          <div class="fLv"><span>Break-even ${f2(ss.beDn)} – ${f2(ss.beUp)}</span></div>
          ${ss.hc !== null && ss.hp !== null ? `<div class="fLv"><span>Hedge: buy ${ss.hp} PE ${f2(ss.hpP)} · ${ss.hc} CE ${f2(ss.hcP)}</span><span>Net ${f2(ss.condor)}</span><span class="fNo">Max loss ${f2(ss.maxLoss)}</span></div>` : ""}
          <ul class="fChk">${ss.chk.map(x => `<li>${mark(x.ok)} ${esc(x.name)} <small>${esc(x.txt)}</small></li>`).join("")}</ul><small>per unit · × lot size</small>` : `<small>${NF}</small>`}</div>
      <div class="fBox fChainBox"><div class="fHead">📋 Option chain <small>${esc(ch.exp)} · ΔOI CE ${fmtN(a.ceD)} · PE ${fmtN(a.peD)}</small></div>
        <div class="fChainWrap"><table class="fChain"><thead><tr><th>OI</th><th>ΔOI</th><th>IV</th><th>LTP</th><th class="fK">Strike</th><th>LTP</th><th>IV</th><th>ΔOI</th><th>OI</th></tr></thead><tbody>
        ${rows.map(r => { const atm = r.k === a.atm, itmC = r.k < ch.spot, itmP = r.k > ch.spot;
          const bar = (v, m, cls) => `<span class="fOiBar ${cls}" style="width:${Math.round(v / m * 100)}%"></span>`;
          return `<tr class="${atm ? "fAtm" : ""}"><td class="${itmC ? "fItm" : ""}">${bar(oi(r.ce), maxCe, "c")}<span>${fmtN(oi(r.ce))}</span></td><td class="${itmC ? "fItm" : ""} ${doi(r.ce) < 0 ? "fNo" : ""}">${fmtN(doi(r.ce))}</td>
            <td class="${itmC ? "fItm" : ""}">${r.ce && num(r.ce.impliedVolatility) ? (+r.ce.impliedVolatility).toFixed(1) : "-"}</td><td class="${itmC ? "fItm" : ""}">${r.ce ? f2(ltp(r.ce)) : "-"}</td>
            <td class="fK">${r.k}${r.k === a.res ? " 🔴" : ""}${r.k === a.sup ? " 🟢" : ""}${r.k === a.maxPain ? " ◎" : ""}</td>
            <td class="${itmP ? "fItm" : ""}">${r.pe ? f2(ltp(r.pe)) : "-"}</td><td class="${itmP ? "fItm" : ""}">${r.pe && num(r.pe.impliedVolatility) ? (+r.pe.impliedVolatility).toFixed(1) : "-"}</td>
            <td class="${itmP ? "fItm" : ""} ${doi(r.pe) < 0 ? "fNo" : ""}">${fmtN(doi(r.pe))}</td><td class="${itmP ? "fItm" : ""}">${bar(oi(r.pe), maxPe, "p")}<span>${fmtN(oi(r.pe))}</span></td></tr>`; }).join("")}
        </tbody></table></div><small>🔴 biggest CE OI · 🟢 biggest PE OI · ◎ max pain</small></div>`;
  }
  function rulesText() {
    const c = FNO_CFG;
    return `BUY CE: 5-min EMA9 > EMA21 and price above EMA21; price above VWAP (stocks) or up in the last 15 min (indices); PCR ≥ ${c.PCR_BULL}; ATM ± ${c.NEAR_STEPS} put writing more than call writing; ≥ ${c.ROOM_PCT} % room to the biggest CE OI strike; ${c.SIG_WINDOW[0]}–${c.SIG_WINDOW[1]}. BUY PE: the mirror (PCR ≤ ${c.PCR_BEAR}). ATM option; SL −${c.SL_PCT} %, T1 +${c.T1_PCT} %, T2 +${c.T2_PCT} % of the premium. ` +
      `Gamma alert: expiry day after ${c.GAMMA_FROM}, an ATM ± 2 premium up ≥ ${c.GAMMA_JUMP_PCT} % within ${c.GAMMA_WIN_MIN} min (only while this screen is open). ` +
      `Option selling: sell the biggest-OI CE above / PE below the price, hedge ${c.SELL_HEDGE_STEPS} strikes further; VIX ≤ ${c.SELL_VIX_MAX}, PCR ${c.SELL_PCR[0]}–${c.SELL_PCR[1]}, ≤ ${c.SELL_MAX_DTE} days to expiry. ` +
      `Data: NSE (on this phone) and Yahoo 5-min candles; delay NOT FOUND. Rules are a checklist, not a prediction; not investment advice.`;
  }


  // ================= SCREENER: all F&O stocks, intraday BUY (same 10 checks as the V5 PRO Intraday dashboard) =================
  const SCR_CFG = {
    PREFILTER_MAX: 40,            // step 1 (one NSE list): up today, above open, in the upper 40 % of today's range -> best 40 go to step 2
    SIGNAL_SCORE: 6, RSI: [55, 75], RSI_MAX: 80, RVOL_MIN: 1.5, ATR_MULT: 1.5, ENTRY_BUFFER: 0.0005,
    WINDOW: ["09:30", "14:45"], RESCAN_MIN: 15, PARALLEL: 4, CE_TOP: 6, TF: 900
  };
  const scr = { busy: false, at: 0, done: 0, total: 0, universe: 0, list: [], nifty: null, err: "", timer: 0 };
  async function foList() {
    let last = null;
    for (const ep of ["equity-stockIndex", "equity-stockIndices"]) {
      try { const j = await nse(`/api/${ep}?index=${encodeURIComponent("SECURITIES IN F&O")}`); const d = (j && j.data || []).filter(x => x && x.symbol && !/\s/.test(x.symbol) && x.priority !== 1); if (d.length > 20) return d; last = "empty list"; }
      catch (e) { last = e.message; }
    }
    throw new Error("F&O list: " + (last || "no answer"));
  }
  function prefilter(list) {
    return list.map(q => {
      const lp = num(q.lastPrice), op = num(q.open), hi = num(q.dayHigh), lo = num(q.dayLow), pc = num(q.previousClose), ch = num(q.pChange);
      if ([lp, op, hi, lo, pc, ch].some(v => v === null) || hi <= lo) return null;
      const pos = (lp - lo) / (hi - lo);
      return lp > op && lp > pc && ch > 0 && pos >= 0.6 ? { symbol: q.symbol, lp, ch, pos, rank: ch + 2 * pos } : null;
    }).filter(Boolean).sort((a, b) => b.rank - a.rank).slice(0, SCR_CFG.PREFILTER_MAX);
  }
  const istDay = t => istDate(new Date(t * 1000)), istSlot = t => istHM(new Date(t * 1000));
  function wilder(arr, n) { let a = null; return arr.map((x, i) => { if (i < n - 1) return null; if (a === null) { a = arr.slice(0, n).reduce((s, v) => s + v, 0) / n; return a; } a = (a * (n - 1) + x) / n; return a; }); }
  function atrOf(B, n) { const tr = B.map((b, i) => i ? Math.max(b.h - b.l, Math.abs(b.h - B[i - 1].c), Math.abs(b.l - B[i - 1].c)) : b.h - b.l); return wilder(tr, n); }
  function rsiOf(c, n) {
    if (c.length <= n) return null;
    let g = 0, l = 0; for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
    g /= n; l /= n;
    for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; }
    return l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  function superTrend(B, n, m) {
    const atr = atrOf(B, n); let fu = null, fl = null, dir = 1;
    B.forEach((b, i) => {
      if (atr[i] === null) return;
      const mid = (b.h + b.l) / 2, bu = mid + m * atr[i], bl = mid - m * atr[i], pc = i ? B[i - 1].c : b.c;
      const nu = fu === null || bu < fu || pc > fu ? bu : fu, nl = fl === null || bl > fl || pc < fl ? bl : fl;
      if (fu !== null) dir = dir === 1 ? (b.c < fl ? -1 : 1) : (b.c > fu ? 1 : -1);
      fu = nu; fl = nl;
    });
    return atr[atr.length - 1] === null ? null : { dir, line: dir === 1 ? fl : fu };
  }
  function days(B) { const m = new Map(); B.forEach(b => { const d = istDay(b.t); if (!m.has(d)) m.set(d, []); m.get(d).push(b); }); return [...m.entries()].map(([d, bs]) => ({ d, bs, h: Math.max(...bs.map(x => x.h)), l: Math.min(...bs.map(x => x.l)), c: bs[bs.length - 1].c })); }
  function niftyBias(bars) {
    if (!bars) return { up: null, txt: NF };
    const B = bars.filter(b => b.t + SCR_CFG.TF <= Date.now() / 1000); if (B.length < 25) return { up: null, txt: NF };
    const c = B.map(b => b.c), L = c.length - 1, e9 = ema(c, 9)[L], e21 = ema(c, 21)[L], D = days(B), pdc = D.length > 1 ? D[D.length - 2].c : null;
    const up = c[L] > e21 && e9 > e21 && (pdc === null || c[L] > pdc), dn = c[L] < e21 && e9 < e21 && (pdc === null || c[L] < pdc);
    return { up, txt: `${c[L].toFixed(2)} → ${up ? "UP" : dn ? "DOWN" : "MIXED"}` };
  }
  function intra(bars, nb) {
    if (!bars) return null;
    const B = bars.filter(b => b.t + SCR_CFG.TF <= Date.now() / 1000 && b.o != null);
    if (B.length < 40) return null;
    const D = days(B); if (D.length < 2) return null;
    const T = D[D.length - 1], P = D[D.length - 2], tb = T.bs, last = B[B.length - 1], L = B.length - 1;
    const c = B.map(b => b.c), e9 = ema(c, 9)[L], e21 = ema(c, 21)[L];
    let pv = 0, vv = 0; tb.forEach(b => { if (b.v) { pv += (b.h + b.l + b.c) / 3 * b.v; vv += b.v; } });
    const vwap = vv ? pv / vv : null, st = superTrend(B, 10, 3), rsi = rsiOf(c, 14);
    const m12 = ema(c, 12), m26 = ema(c, 26), macd = c.map((x, i) => m12[i] - m26[i]), sig = ema(macd, 9), hist = macd.map((x, i) => x - sig[i]);
    const orh = tb.length >= 2 ? tb[0].h : null;
    const piv = (P.h + P.l + P.c) / 3, r1 = 2 * piv - P.l, r2 = piv + (P.h - P.l);
    const slot = istSlot(last.t), same = D.slice(-5, -1).map(d => (d.bs.find(b => istSlot(b.t) === slot) || {}).v).filter(v => v), avgV = same.length ? same.reduce((s, v) => s + v, 0) / same.length : null;
    const rv = avgV ? last.v / avgV : null;
    const dEma = ema(D.map(d => d.c), 20)[D.length - 1];
    const chk = [];
    const add = (k, name, ok, txt) => chk.push({ k, name, ok, txt });
    add("vwap", "VWAP", vwap === null ? null : last.c > vwap, vwap === null ? NF : vwap.toFixed(2));
    add("ema", "EMA 9/21", e9 > e21, `${e9.toFixed(1)} / ${e21.toFixed(1)}`);
    add("st", "Supertrend", st ? st.dir === 1 : null, st ? (st.dir === 1 ? "UP " : "DOWN ") + st.line.toFixed(2) : NF);
    add("rsi", "RSI", rsi === null ? null : rsi >= SCR_CFG.RSI[0] && rsi <= SCR_CFG.RSI[1], rsi === null ? NF : rsi.toFixed(1));
    add("macd", "MACD", hist[L] > 0 && hist[L] > hist[L - 1], hist[L].toFixed(2));
    add("orb", "Opening range", orh === null ? null : last.c > orh, orh === null ? NF : "ORH " + orh.toFixed(2));
    add("piv", "Pivot", last.c > piv, "P " + piv.toFixed(2));
    add("rvol", "Volume", rv === null ? null : rv >= SCR_CFG.RVOL_MIN && last.c > last.o, rv === null ? NF : rv.toFixed(2) + "×");
    add("d20", "Daily EMA 20", last.c > dEma, dEma.toFixed(2));
    add("nifty", "Nifty", nb ? nb.up : null, nb ? nb.txt : NF);
    const score = chk.filter(x => x.ok === true).length, must = ["vwap", "ema", "st"].every(k => chk.find(x => x.k === k).ok === true);
    const hm = istHM(), today = T.d === istDate(), inWin = today && marketOpen() && hm >= SCR_CFG.WINDOW[0] && hm <= SCR_CFG.WINDOW[1];
    const out = { chk, score, last: last.c, at: istSlot(last.t + SCR_CFG.TF), today, rsi };
    if (score >= SCR_CFG.SIGNAL_SCORE && must && !(rsi !== null && rsi > SCR_CFG.RSI_MAX)) {
      out.signal = inWin ? "BUY" : "BUY setup (outside entry time)";
      const atr = atrOf(B, 14)[L];
      if (atr) {
        const e = tick(last.h * (1 + SCR_CFG.ENTRY_BUFFER)), sl = tick(e - SCR_CFG.ATR_MULT * atr), risk = e - sl;
        Object.assign(out, { entry: e, sl, t1: tick(e + risk), t2: tick(e + 2 * risk), riskPct: risk / e * 100 });
        const blk = [P.h, r1, r2].filter(x => x > e && x < out.t1).sort((a, b) => a - b)[0];
        if (blk) out.block = blk;
      }
    } else out.signal = score >= 4 ? "WATCH" : "NO TRADE";
    if (out.signal === "WATCH") out.miss = chk.filter(x => x.ok !== true).map(x => x.name);
    return out;
  }
  async function ceFor(sym) {
    let d = await load(sym, false);
    if (dte(d.exp) !== null && dte(d.exp) <= 1 && d.exps[1]) { state.exp[sym] = d.exps[1]; d = await load(sym, false); }   // expiry today / tomorrow: next expiry's CE
    const row = d.ch.rows[d.a.atmI], p = ltp(row.ce);
    return { exp: d.exp, k: row.k, p, oi: oi(row.ce), sl: p ? tick(p * (1 - FNO_CFG.SL_PCT / 100)) : null, t1: p ? tick(p * (1 + FNO_CFG.T1_PCT / 100)) : null, t2: p ? tick(p * (1 + FNO_CFG.T2_PCT / 100)) : null };
  }
  const RANK = s => !s ? -1 : s === "BUY" ? 3 : /^BUY/.test(s) ? 2 : s === "WATCH" ? 1 : 0;
  async function scan() {
    if (scr.busy || !native()) { renderScr(); return; }
    clearTimeout(scr.timer);
    scr.busy = true; scr.err = ""; scr.done = 0; scr.total = 0; renderScr();
    try {
      const all = await foList(); scr.universe = all.length;
      const cands = prefilter(all); scr.total = cands.length; renderScr();
      scr.nifty = niftyBias(await yahoo("^NSEI", "15m", "1mo"));
      const out = []; let i = 0;
      await Promise.all(Array.from({ length: SCR_CFG.PARALLEL }, async () => {
        while (i < cands.length) {
          const q = cands[i++]; let a = null;
          try { a = intra(await yahoo(q.symbol + ".NS", "15m", "1mo"), scr.nifty); } catch (e) { a = null; }
          out.push({ q, a }); scr.done++; renderScrProgress();
        }
      }));
      out.sort((x, y) => (RANK(y.a && y.a.signal) - RANK(x.a && x.a.signal)) || ((y.a ? y.a.score : -1) - (x.a ? x.a.score : -1)) || (y.q.ch - x.q.ch));
      scr.list = out; scr.at = Date.now(); renderScr();
      for (const r of out.filter(x => x.a && /^BUY/.test(x.a.signal)).slice(0, SCR_CFG.CE_TOP)) {
        try { r.ce = await ceFor(r.q.symbol); } catch (e) { r.ce = { err: e.message }; }
        renderScr();
      }
    } catch (e) { scr.err = e.message || String(e); }
    finally { scr.busy = false; renderScr(); scheduleScr(); }
  }
  function scheduleScr() {
    clearTimeout(scr.timer);
    if (!state.open || state.tab !== "scr" || !marketOpen()) return;
    scr.timer = setTimeout(() => {
      const r = $("fnoRoot"); if (!r || r.offsetParent === null) { state.open = false; return; }
      if (document.visibilityState === "visible" && state.tab === "scr") scan(); else scheduleScr();
    }, SCR_CFG.RESCAN_MIN * 60000);
  }
  function renderScrProgress() { const p = $("scrProg"); if (p) { p.style.width = (scr.total ? scr.done / scr.total * 100 : 5) + "%"; } const t = $("scrStat"); if (t && scr.busy) t.textContent = scr.total ? `Scanning ${scr.done} / ${scr.total}…` : "Loading the F&O list…"; }
  const SHORT = { vwap: "VWAP", ema: "EMA", st: "ST", rsi: "RSI", macd: "MACD", orb: "ORB", piv: "PIV", rvol: "VOL", d20: "D20", nifty: "NIFTY" };
  function renderScr() {
    const v = $("fnoScrView"); if (!v || state.tab !== "scr") return;
    if (!v.dataset.built) {
      v.dataset.built = "1";
      v.innerHTML = `<div class="fBar"><button type="button" id="scrGo" class="scrGo">🔎 Scan now</button><span class="fStatus scrStat"><span id="scrStat"></span><span class="mzInfoNote fRules" data-info-for=".scrStat">${esc(scrRules())}</span></span></div>
        <div class="scrProgW"><i id="scrProg"></i></div><div id="scrList"></div>`;
      if (window.mzInfoAttach) window.mzInfoAttach(v);
    }
    const go = $("scrGo"); go.disabled = scr.busy;
    $("scrProg").parentNode.classList.toggle("hidden", !scr.busy);
    renderScrProgress();
    const buys = scr.list.filter(x => x.a && /^BUY/.test(x.a.signal)), watch = scr.list.filter(x => x.a && x.a.signal === "WATCH");
    if (!scr.busy) $("scrStat").textContent = scr.err ? "⚠️ " + scr.err : scr.at ? `${istHM(new Date(scr.at))} · ${scr.universe} F&O · ${scr.total} checked · ${buys.length} BUY · Nifty ${scr.nifty ? scr.nifty.txt : NF}${marketOpen() ? "" : " · market closed"}` : "";
    const card = r => {
      const a = r.a, q = r.q, ce = r.ce;
      const chips = a.chk.map(x => `<span class="sChip ${x.ok === true ? "y" : x.ok === false ? "n" : "u"}" title="${esc(x.name + ": " + x.txt)}">${SHORT[x.k]}</span>`).join("");
      return `<div class="sCard" data-scrsym="${esc(q.symbol)}"><div class="sTop"><b>${esc(q.symbol)}</b><span>${q.lp.toFixed(2)} <small class="fOk">+${q.ch.toFixed(2)} %</small></span>
          <i class="${/^BUY/.test(a.signal) ? "fBuy" : "fWatch"}">${esc(a.signal)} · ${a.score}/10</i></div>
        <div class="sChips">${chips}</div>
        ${a.entry ? `<div class="fLv"><span>Entry ${f2(a.entry)}</span><span class="fNo">SL ${f2(a.sl)}</span><span class="fOk">T1 ${f2(a.t1)}</span><span class="fOk">T2 ${f2(a.t2)}</span><small>risk ${a.riskPct.toFixed(2)} %</small></div>` : ""}
        ${a.block ? `<div class="sWarn">⚠ resistance ${f2(a.block)} before T1</div>` : ""}
        ${a.miss ? `<div class="sMiss">missing: ${esc(a.miss.join(", "))}</div>` : ""}
        ${ce ? (ce.err ? `<div class="sMiss">CE: ${esc(ce.err)}</div>` : `<div class="fLv sCe"><span>CE ${ce.k} · ${esc(ce.exp)}</span><span>${f2(ce.p)}</span><span class="fNo">SL ${f2(ce.sl)}</span><span class="fOk">T1 ${f2(ce.t1)}</span><span class="fOk">T2 ${f2(ce.t2)}</span></div>`) : (/^BUY/.test(a.signal) && scr.busy === false && buys.indexOf(r) >= SCR_CFG.CE_TOP ? "" : "")}
      </div>`;
    };
    const L = $("scrList");
    if (!scr.at) { L.innerHTML = scr.busy ? "" : `<div class="fnoMsg">${native() ? "🔎 Scan now" : "📱"}</div>`; return; }
    L.innerHTML = (buys.length ? buys.map(card).join("") : `<div class="fnoMsg">No BUY right now</div>`) +
      (watch.length ? `<div class="sHead">WATCH (${watch.length})</div>` + watch.map(card).join("") : "");
  }
  function scrRules() {
    const c = SCR_CFG;
    return `Step 1 (NSE list of all F&O stocks): up today, above today's open, in the upper 40 % of today's range; the best ${c.PREFILTER_MAX} go on. ` +
      `Step 2 (Yahoo 15-min candles, 1 month): the 10 checks of the V5 PRO Intraday dashboard - VWAP, EMA 9/21, Supertrend 10,3 (these 3 are a must), RSI ${c.RSI[0]}–${c.RSI[1]}, MACD histogram positive and rising, above the opening-range high, above pivot, last candle volume ≥ ${c.RVOL_MIN}× the same time on earlier days (green candle), above the daily EMA 20, Nifty UP. ` +
      `BUY = ≥ ${c.SIGNAL_SCORE}/10 with the 3 musts (RSI not above ${c.RSI_MAX}), ${c.WINDOW[0]}–${c.WINDOW[1]}; WATCH = 4–5. Entry = last candle high + 0.05 %, SL = ${c.ATR_MULT} × ATR(14), T1 / T2 = 1R / 2R. ` +
      `CE = ATM call of the nearest expiry (the next one when it expires today or tomorrow), SL −${FNO_CFG.SL_PCT} %, T1 +${FNO_CFG.T1_PCT} %, T2 +${FNO_CFG.T2_PCT} %. Scan again every ${c.RESCAN_MIN} min while this tab is open. Delay of Yahoo data: NOT FOUND. A checklist, not a prediction; not investment advice.`;
  }

  window.mzFno = {
    show() { const r = ensureRoot(); if (!r) return; state.open = true; r.classList.remove("hidden"); renderAll();
      if (!native()) return;
      if (state.tab === "scr") { if (Date.now() - scr.at > SCR_CFG.RESCAN_MIN * 60000) scan(); else scheduleScr(); } else refresh(!Object.keys(state.data).length); },
    hide() { state.open = false; clearTimeout(state.timer); clearTimeout(scr.timer); const r = $("fnoRoot"); if (r) r.classList.add("hidden"); },
    refresh() { if (state.tab === "scr") scan(); else refresh(true); },
    _test: { scr, intraScan: (bars, nb) => intra(bars, nb), niftyBias, prefilter, parseChain, analyse, signal, sellSetup, trendOf, gamma, expISO, dte, FNO_CFG, state }
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && state.open && state.tab === "chain") refresh(false); });
})();
