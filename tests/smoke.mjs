// Moltrix smoke test (headless Chrome) - run by the "Test" workflow on every pull request, or by hand:
//   python3 -m http.server 8123 &   then   node tests/smoke.mjs
// Microsoft sign-in is replaced by a stub (no real login). Fails (exit 1) on any page error. Part A: website as a signed-in owner, every menu item clicked, games opened.
// Part B: the Android app's bridge mocked (fake NSE / Yahoo data): F&O option chain, Screener, Log.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "playwright-core");
const BASE = process.env.BASE || "http://localhost:8123";
const CHROME = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find(p => fs.existsSync(p));
const LOCAL_NM = process.env.LOCAL_NM || "";   // optional: serve the CDN libraries from a local node_modules (no internet)
const local = { "@azure/msal-browser@5.16.0/lib/msal-browser.min.js": "@azure/msal-browser/lib/msal-browser.min.js", "jspdf@2.5.1/dist/jspdf.umd.min.js": "jspdf/dist/jspdf.umd.min.js",
  "jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js": "jspdf-autotable/dist/jspdf.plugin.autotable.min.js", "chart.js@4.5.0/dist/chart.umd.min.js": "chart.js/dist/chart.umd.min.js", "xlsx@0.18.5/dist/xlsx.full.min.js": "xlsx/dist/xlsx.full.min.js" };
const MSAL_STUB = "window.msal={PublicClientApplication:class{constructor(){} initialize(){return Promise.resolve()} handleRedirectPromise(){return Promise.resolve(null)} getAllAccounts(){return []} getAccountByHomeId(){return null} getActiveAccount(){return null} setActiveAccount(){} addEventCallback(){} acquireTokenSilent(){return Promise.reject(new Error('test: no sign-in'))} loginRedirect(){return new Promise(()=>{})} acquireTokenRedirect(){return new Promise(()=>{})} logoutRedirect(){return new Promise(()=>{})}}};";
const fails = [];
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
async function newPage(init) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 412, height: 900 }, timezoneId: "Asia/Kolkata" });
  await ctx.route("**/*", route => {
    const u = route.request().url();
    if (u.startsWith(BASE)) return route.continue();
    const m = /cdn\.jsdelivr\.net\/npm\/(.*)$/.exec(u);
    if (m && /msal-browser/.test(m[1])) return route.fulfill({ status: 200, contentType: "application/javascript", body: MSAL_STUB });   // no real Microsoft sign-in in a test
    if (m && LOCAL_NM && local[m[1]]) return route.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(LOCAL_NM + local[m[1]]) });
    if (m && !LOCAL_NM) return route.continue();
    return route.abort();   // Microsoft sign-in, Graph, fonts, weather ... not needed for the test
  });
  if (init) await ctx.addInitScript(init, "20-Nov-2026");
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 300)));
  p.on("dialog", d => d.dismiss());
  await p.route("**/index.html", async r => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace(/ integrity="[^"]+"/g, "") }); });
  await p.goto(BASE + "/index.html", { waitUntil: "load" });
  await p.waitForTimeout(2500);
  return { p, errs, ctx };
}
const signIn = p => p.evaluate(() => { account = { username: ALLOWED_EMAILS[0], homeAccountId: "test", name: "Test" }; showSignedIn(); });

// ---------- A: website ----------
{
  const { p, errs, ctx } = await newPage(null);
  await signIn(p); await p.waitForTimeout(2000);
  const n = await p.evaluate(async () => {
    const items = [...document.querySelectorAll(".navItem, .bottomTabItem, .navDrawerItem")].filter(e => !/signout|logout|switchacc|apk|qr/i.test(e.id + " " + (e.dataset.drawerAction || "")));
    for (const el of items) { try { el.click(); } catch (e) {} await new Promise(r => setTimeout(r, 30)); document.querySelectorAll(".mzBkOv, #mzErrBox").forEach(x => x.remove()); }
    return items.length;
  });
  await p.evaluate(() => window.openGames && window.openGames()); await p.waitForTimeout(2500);
  const games = await p.evaluate(() => { const o = document.getElementById("gamesOverlay"); return !!o && !o.classList.contains("hidden"); });
  const errlog = await p.evaluate(() => { window.mzErr("Test", "sample error"); document.querySelector('[data-drawer-action="errlog"]').click(); const b = document.getElementById("mzErrBox"); const ok = !!b && /sample error/.test(b.textContent); if (b) b.remove(); return ok; });
  if (!errlog) fails.push("A: error log did not show the sample error");
  if (!games) fails.push("A: games did not open");
  if (n < 50) fails.push("A: only " + n + " menu items found");
  errs.forEach(e => fails.push("A: " + e));
  console.log(`A website: ${n} menu items clicked, games ${games ? "open" : "NOT open"}, error log ${errlog ? "ok" : "NOT ok"}, ${errs.length} page errors`);
  await ctx.close();
}

// ---------- B: Android app (mocked NSE / Yahoo) ----------
const NATIVE_MOCK = (today) => {
  const store = {}; let call = 0; window.__calls = [];
  const spotOf = { NIFTY: 25600, BANKNIFTY: 57800, FINNIFTY: 27100, MIDCPNIFTY: 13300, RELIANCE: 1510 };
  const stepOf = { NIFTY: 50, BANKNIFTY: 100, FINNIFTY: 50, MIDCPNIFTY: 25, RELIANCE: 10 };
  function chain(sym, exp, bump) {
    const S = spotOf[sym] || 1000, st = stepOf[sym] || 10, data = [];
    for (let i = -20; i <= 20; i++) {
      const k = Math.round(S / st) * st + i * st;
      const tv = Math.max(0.5, 120 * Math.exp(-Math.abs(k - S) / (6 * st)));
      const ceL = Math.max(0, S - k) + tv * (i === 0 ? bump : 1), peL = Math.max(0, k - S) + tv;
      const ceOI = 50000 + (k === Math.round(S / st) * st + 8 * st ? 400000 : 0) + Math.max(0, i) * 9000;
      const peOI = 50000 + (k === Math.round(S / st) * st - 6 * st ? 350000 : 0) + Math.max(0, -i) * 9500;
      data.push({ strikePrice: k, expiryDate: exp,
        CE: { strikePrice: k, expiryDate: exp, openInterest: ceOI, changeinOpenInterest: (i >= -2 && i <= 2) ? 3000 : 1000, lastPrice: +ceL.toFixed(2), impliedVolatility: 11.5, underlyingValue: S },
        PE: { strikePrice: k, expiryDate: exp, openInterest: peOI, changeinOpenInterest: (i >= -2 && i <= 2) ? 9000 : 1500, lastPrice: +peL.toFixed(2), impliedVolatility: 12.1, underlyingValue: S } });
    }
    return { records: { expiryDates: [exp], data, timestamp: "20-Nov-2026 11:30:00", underlyingValue: S } };
  }
  function bars(sym) { const S = spotOf[sym] || 1000, out = []; const now = Math.floor(Date.now() / 1000); for (let i = 300; i >= 0; i--) { const c = S * (0.985 + 0.015 * (300 - i) / 300); out.push({ t: now - i * 300, c, h: c * 1.001, l: c * 0.999, o: c, v: 1000 }); }
    return { chart: { result: [{ timestamp: out.map(x => x.t), indicators: { quote: [{ open: out.map(x => x.o), high: out.map(x => x.h), low: out.map(x => x.l), close: out.map(x => x.c), volume: out.map(x => x.v) }] } }] } }; }
  function bars15(sym) {   // 22 sessions of 15-min candles, rising; today's last candle with big volume
    const out = []; const now = new Date(); const dayMs = 86400000; let price = 1000, k = 0;
    const strong = /STK(1|2|4)\.NS$/.test(sym) ? -1 : 1; let seed = sym.length * 7 + 3; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 - 0.5; };
    for (let d = 21; d >= 0; d--) {
      const day = new Date(now.getTime() - d * dayMs); const wd = day.getUTCDay(); if (wd === 0 || wd === 6) continue;
      const y = day.getUTCFullYear(), m = day.getUTCMonth(), dd = day.getUTCDate();
      for (let s = 0; s < 25; s++) {
        const t = Date.UTC(y, m, dd, 3, 45) / 1000 + s * 900; if (t + 900 > now.getTime() / 1000) break;
        price *= 1 + strong * 0.0009 + rnd() * 0.006; k++;
        const o = price * (1 - 0.0008 * strong), c = price;
        out.push({ t, o, h: Math.max(o, c) * 1.001, l: Math.min(o, c) * 0.999, c, v: (d === 0 && t + 1800 > now.getTime() / 1000) ? 90000 : 30000 });
      }
    }
    return { chart: { result: [{ timestamp: out.map(x => x.t), indicators: { quote: [{ open: out.map(x => x.o), high: out.map(x => x.h), low: out.map(x => x.l), close: out.map(x => x.c), volume: out.map(x => x.v) }] } }] } };
  }
  window.__bump = 1;
  const reply = (id, s, t) => setTimeout(() => { store[id] = JSON.stringify({ s, t }); window.mzMkDone && window.mzMkDone(id); }, 20);
  window.MoltrixApp = { version: () => "3", lockOn: () => false, lockPossible: () => false, setLock() {}, notifyOn: () => false, notifyAllowed: () => true, setBars() {}, setNotify() {}, gameMode() {}, saveFile() {}, shareFile() {}, shareText() {}, askNotify() {},
    notify(t, bd) { window.__calls.push("NOTIFY " + t + " | " + bd); }, gwOn: false, gammaWatchOn() { return this.gwOn; }, gammaWatchStatus() { return this.gwOn ? "11:05 · NIFTY 25600.00 · watching" : ""; }, gammaWatch(on, cfg) { this.gwOn = on; window.__calls.push("GW " + on + " " + cfg); },
    mkTake(id) { const r = store[id]; delete store[id]; return r || ""; },
    mkGet(id, page, path) { window.__calls.push(page.replace("https://www.", "") + " " + path);
      const sym = (/symbol=([^&]+)/.exec(path) || [])[1];
      if (/contract-info/.test(path)) return reply(id, 200, JSON.stringify({ expiryDates: ({ NIFTY: [today, "24-Nov-2026"], BANKNIFTY: ["25-Nov-2026", "30-Dec-2026"], FINNIFTY: ["25-Nov-2026"], MIDCPNIFTY: ["25-Nov-2026"] })[decodeURIComponent(sym)] || ["25-Nov-2026", "30-Dec-2026"] }));
      if (/option-chain-v3/.test(path)) return reply(id, 200, JSON.stringify(chain(decodeURIComponent(sym), decodeURIComponent((/expiry=([^&]+)/.exec(path) || [])[1]), window.__bump)));
      if (/equity-stockIndex/.test(path)) { const L = [{ symbol: "SECURITIES IN F&O", priority: 1 }]; for (let n = 0; n < 60; n++) { const base = 500 + n * 37; const up = n % 3 !== 0; L.push({ symbol: n === 0 ? "RELIANCE" : "STK" + n, priority: 0, open: base, dayHigh: base * (up ? 1.03 : 1.01), dayLow: base * 0.995, lastPrice: base * (up ? 1.028 : 0.999), previousClose: base * 0.99, pChange: up ? 3.8 - n * 0.03 : -0.1, totalTradedVolume: 100000 }); } return reply(id, 200, JSON.stringify({ data: L })); }
      if (/allIndices/.test(path)) return reply(id, 200, JSON.stringify({ data: [{ index: "NIFTY 50", last: 25600 }, { index: "INDIA VIX", last: 13.25 }] }));
      reply(id, 404, "");
    },
    httpGet(id, url) { if (/interval=15m/.test(url)) { const sym = decodeURIComponent(url.split("/chart/")[1].split("?")[0]); window.__calls.push("y15 " + sym); return reply(id, 200, JSON.stringify(bars15(sym))); } window.__calls.push("yahoo " + url.split("/chart/")[1]); const s = decodeURIComponent(url.split("/chart/")[1].split("?")[0]); const map = { "^NSEI": "NIFTY", "^NSEBANK": "BANKNIFTY", "NIFTY_FIN_SERVICE.NS": "FINNIFTY", "NIFTY_MID_SELECT.NS": "MIDCPNIFTY", "RELIANCE.NS": "RELIANCE" }; reply(id, 200, JSON.stringify(bars(map[s]))); }
  };
};
{
  const { p, errs, ctx } = await newPage(NATIVE_MOCK);
  await p.evaluate(() => { account = { username: ALLOWED_EMAILS[0], homeAccountId: "test" }; document.body.classList.add("isOwner"); window.canMarket = () => true;
    document.querySelectorAll(".sectionPanel").forEach(x => x.classList.add("hidden")); let el = document.getElementById("section-marketdash"); while (el) { el.classList && el.classList.remove("hidden"); el = el.parentElement; } });
  await p.evaluate(() => { localStorage.setItem("fnoTab", "chain"); document.querySelector('#marketSubNav [data-submkt="fno"]').click(); });
  await p.waitForTimeout(3000);
  const chain = await p.evaluate(() => { const d = mzFno._test.state.data.NIFTY; return d ? { pcr: d.a.pcr, mp: d.a.maxPain, sig: d.sig.signal } : null; });
  if (!chain || !(chain.pcr > 0) || !chain.mp) fails.push("B: option chain not built " + JSON.stringify(chain));
  await p.evaluate(() => document.getElementById("gwTgl").click()); await p.waitForTimeout(600);
  const gw = await p.evaluate(() => (document.getElementById("gwTgl") || {}).textContent || "none");
  if (!/ON/.test(gw)) fails.push("B: background watch toggle " + gw);
  await p.evaluate(() => document.querySelector('[data-ftab="scr"]').click()); await p.waitForTimeout(6000);
  const sc = await p.evaluate(() => { const S = mzFno._test.scr; return { u: S.universe, n: S.list.length, err: S.err }; });
  if (!(sc.u > 0 && sc.n > 0) || sc.err) fails.push("B: screener " + JSON.stringify(sc));
  await p.evaluate(() => document.querySelector('[data-ftab="log"]').click()); await p.waitForTimeout(2500);
  const lg = await p.evaluate(() => mzFno._test.logLoad().length);
  errs.forEach(e => fails.push("B: " + e));
  console.log(`B app: gamma toggle ${gw}, option chain ${chain ? "PCR " + chain.pcr.toFixed(2) + " · max pain " + chain.mp + " · " + chain.sig : "none"}, screener ${sc.n}/${sc.u}, log ${lg}, ${errs.length} page errors`);
  await ctx.close();
}
await browser.close();
if (fails.length) { console.log("\nFAILED:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("\nAll checks passed.");
