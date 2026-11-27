// offline check of tools/bullion-parse.mjs with a small page in the new layout (run: node tests/bullion-parse.test.mjs)
import { parseBullion } from "../tools/bullion-parse.mjs";
const data = { place: "India", stamp: "27 Nov 2026, 10:35 India time",
  gold: { pct: 1.88, rows: [{ k: "24C", h: "999", p: [12510, 125100, 1251000, 12510000, 389104, 145914] }, { k: "22C", h: "916", p: [11902, 119020, 1190200, 11902000, 370194, 138823] }] },
  silver: { pct: 4.22, rows: [{ k: "Fine", h: "999", p: [153, 1527, 15274, 152740, 4751, 1782] }] },
  series: { gold: { "2w": [["2026-11-26", 122790], ["2026-11-27", 125100]], "1y": [["2026-11-20", 122510]], "10y": [["2016-11", 28852]] }, silver: { "2w": [["2026-11-27", 152740]], "1y": [], "10y": [] } } };
const html = `<html><body>Gold 24 Carat Rate card Gold 24 Carat Fine gold ₹ 125,100 .00 Rupees per 10 grams ▲ +2,310.00 (+1.88%) today
 Silver 999 Rate card Silver 999 ₹ 152,740 .00 ▲ +6,190.00 (+4.22%) today
 Commodity exchange rates for India and the US, 27 Nov 2026, 10:35 India time.
 <p>Gold · India commodity exchange · ₹ per 10 g</p><b>₹</b> 124,465 ▲ +2,193 (+1.79%) Low 123,779 High 124,787 Previous close 122,272
 Change by period Gold 24 Carat per 10 g −20% 0% 1 day from ₹122,790 ▲ +1.88% 1 week from ₹122,510 ▲ +2.11% 1 month from ₹144,000 ▼ −13.13% 1 year from ₹126,180 ▼ −0.86%
 Silver 999 per 1 kg 1 day from ₹146,550 ▲ +4.22% 1 week from ₹149,590 ▲ +2.11% 1 month from ₹194,990 ▼ −21.67% 1 year from ₹163,130 ▼ −6.37% Where are we against the peak
 Bullions News menu ... Bullions News Gold Falls on Firm Dollar 26 Nov 2026 Silver Falls as Dollar Strengthens 25 Nov 2026 Advertisement
 <script type="application/json" id="bu-data">${JSON.stringify(data)}</script></body></html>`;
const d = parseBullion(html, { hist: { gold: [["2026-11-01", 140000]], silver: [] } });
const want = [d.source === "bu-data", d.updated === "Friday, 27 Nov 2026 10:35 AM", d.gold[0].k === 24 && d.gold[0].g10 === 125100, d.silver[0].p === 999 && d.silver[0].kg === 152740,
  d.head.gold.chg === 2310 && d.head.gold.pct === 1.88, d.change && d.change.gold[2].pct === -13.13 && d.change.dates[0] === "2026-11-26", d.live[0] && d.live[0].price === 124465 && d.live[0].name === "Gold · India MCX",
  d.news.length === 2, d.hist.gold.some(p => p[0] === "2026-11-01") && d.hist.gold[d.hist.gold.length - 1][0] === "2026-11-27"];
console.log(want.every(Boolean) ? "bullion parser: all checks passed" : "bullion parser FAILED " + JSON.stringify(want)); if (!want.every(Boolean)) process.exit(1);
