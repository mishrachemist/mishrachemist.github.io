// runs the bullion parser on the live page and prints what it found (no secrets, nothing saved)
import { parseBullion } from "./bullion-parse.mjs";
const hr = await fetch("https://bullions.co.in/", { headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36", "Accept-Language": "en-IN,en;q=0.9" } });
const html = await hr.text();
const prev = { hist: { gold: [["2016-12-15", 27445], ["2026-11-20", 122000], ["2026-11-25", 121000]], silver: [["2018-11-30", 35364]] } };
const d = parseBullion(html, prev);
console.log("SOURCE", d.source, "UPDATED", d.updated, "|", d.silverUpdated);
console.log("GOLD", JSON.stringify(d.gold));
console.log("SILVER", JSON.stringify(d.silver));
console.log("HEAD", JSON.stringify(d.head));
console.log("CHANGE", JSON.stringify(d.change));
console.log("LIVE", JSON.stringify(d.live));
console.log("NEWS", JSON.stringify(d.news));
console.log("HIST", d.hist.gold.length, JSON.stringify(d.hist.gold.slice(0, 3)), JSON.stringify(d.hist.gold.slice(-4)), d.hist.silver.length);
const ok = d.gold.length === 8 && d.silver.length === 4 && d.head.gold.price > 0 && d.change && d.live.length === 4 && d.news.length > 0 && d.hist.gold.length > 100;
console.log(ok ? "ALL GOOD" : "SOMETHING MISSING"); if (!ok) process.exit(1);
