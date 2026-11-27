// Gold / silver rates from https://bullions.co.in/ -> the bullion.json the Moltrix Market screen reads.
// 27-Nov-2026: the site was redesigned on 25-Nov ("24 Carat", new cards); the rates now come from the page's own
// data block (<script id="bu-data">), which is far steadier than reading the visible text. The old text reading
// stays as a fallback for the previous layout. Used by .github/workflows/moltrix-wa-sync.yml.
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const num = v => Number(String(v).replace(/[,\s]/g, "").replace(/[−–]/g, "-"));
const iso = d => d.toISOString().slice(0, 10);

function plainText(html) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&#x20B9;|&#8377;/gi, "₹").replace(/&#x24;/gi, "$").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#0?39;|&#x27;/g, "'")
    .replace(/&#8217;|&rsquo;/g, "’").replace(/&middot;/g, "·").replace(/&#9660;/g, "▼").replace(/&#9650;/g, "▲").replace(/\s+/g, " ");
}

/* "27 Nov 2026, 10:35 India time" -> { date: Date (UTC midnight of that day), text: "Friday, 27 Nov 2026 10:35 AM" } */
function stampOf(s) {
  const m = /(\d{1,2}) (\w{3}) (\d{4}),? (\d{1,2}):(\d{2})/.exec(s || "");
  if (!m || !(m[2] in MON)) return null;
  const d = new Date(Date.UTC(+m[3], MON[m[2]], +m[1])), h = +m[4];
  const ap = h >= 12 ? "PM" : "AM", h12 = h % 12 || 12;
  return { date: d, text: `${DAYS[d.getUTCDay()]}, ${+m[1]} ${m[2]} ${m[3]} ${String(h12).padStart(2, "0")}:${m[5]} ${ap}` };
}

function fromDataBlock(html, txt) {
  const m = /<script[^>]*id=["']bu-data["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  const d = JSON.parse(m[1]);
  const units = p => ({ g1: num(p[0]), g10: num(p[1]), g100: num(p[2]), kg: num(p[3]), oz: num(p[4]), tola: num(p[5]) });
  const gold = ((d.gold && d.gold.rows) || []).map(r => Object.assign({ k: parseInt(r.k, 10) }, units(r.p || []))).filter(r => r.k && r.g10 > 0);
  const silver = ((d.silver && d.silver.rows) || []).map(r => Object.assign({ p: parseInt(r.h, 10), name: String(r.k || "") }, units(r.p || []))).filter(r => r.p && r.kg > 0);
  if (!gold.some(x => x.k === 24) || !silver.length) return null;
  const st = stampOf(d.stamp) || stampOf((/Updated (\d{1,2} \w{3} \d{4}, \d{1,2}:\d{2})/.exec(txt) || [])[1]);
  // daily points (2 weeks) + weekly (1 year) + monthly (10 years, dated the 1st)
  const series = metal => { const s = (d.series && d.series[metal]) || {}, out = {};
    (s["10y"] || []).forEach(([dt, v]) => { if (/^\d{4}-\d\d$/.test(dt)) out[dt + "-01"] = num(v); });
    ["1y", "2w"].forEach(k => (s[k] || []).forEach(([dt, v]) => { if (/^\d{4}-\d\d-\d\d$/.test(dt)) out[dt] = num(v); }));
    return Object.keys(out).sort().map(k => [k, out[k]]); };
  // "1 day from ₹122,790 ▲ +1.88%" ... for each metal, in the "Change by period" block
  const chBlock = (txt.split("Change by period")[1] || "").split("Where are we against the peak")[0];
  const chOf = label => { const seg = (chBlock.split(label)[1] || "");
    const rows = [...seg.matchAll(/(1 day|1 week|1 month|1 year) from ₹ ?([\d,]+(?:\.\d+)?) [▲▼•]? ?([+\-−]?[\d.]+)%/g)].slice(0, 4);
    return rows.length === 4 ? rows.map(r => ({ price: num(r[2]), pct: num(r[3]) })) : null; };
  const chG = chOf("Gold 24 Carat"), chS = chOf("Silver 999");
  let dates = null;
  if (st) { const t = st.date, y = t.getUTCFullYear(), mo = t.getUTCMonth(), dd = t.getUTCDate();
    dates = [new Date(Date.UTC(y, mo, dd - 1)), new Date(Date.UTC(y, mo, dd - 7)), new Date(Date.UTC(y, mo - 1, dd)), new Date(Date.UTC(y - 1, mo, dd))].map(iso); }
  // headline: today, change against yesterday, % (from the cards: "▲ +2,310.00 (+1.88%) today")
  const headOf = (metal, row, unit) => {
    const card = (txt.split(metal === "gold" ? "Gold 24 Carat Rate card" : "Silver 999 Rate card")[1] || "").slice(0, 400);
    const c = /([+\-−][\d,]+(?:\.\d+)?) \(([+\-−]?[\d.]+)%\) today/.exec(card);
    const price = row[unit];
    return { price, chg: c ? num(c[1]) : null, pct: c ? num(c[2]) : num(d[metal] && d[metal].pct) };
  };
  // commodity exchange (futures): "Gold · India commodity exchange · ₹ per 10 g ₹ 124,465 ▲ +2,193 (+1.79%) Low … High … Previous close …"
  const liveAt = (txt.match(/Commodity exchange rates for India and the US, (\d{1,2} \w{3} \d{4}), (\d{1,2}:\d{2})/) || []);
  const liveTime = liveAt[1] ? liveAt[1].replace(/ \d{4}$/, "") + ", " + liveAt[2] : "";
  const live = [["Gold · India commodity exchange", "Gold · India MCX", "₹/10 g"], ["Silver · India commodity exchange", "Silver · India MCX", "₹/kg"],
    ["Gold · US commodity exchange", "Gold · US Comex", "$/oz"], ["Silver · US commodity exchange", "Silver · US Comex", "$/oz"]].map(([lab, name, unit]) => {
    const r = new RegExp(lab + " · [^·]*? [₹$] ?([\\d,]+(?:\\.\\d+)?) [▲▼•]? ?([+\\-−]?[\\d,]+(?:\\.\\d+)?) \\(([+\\-−]?[\\d.]+)%\\) Low ([\\d,]+(?:\\.\\d+)?) High ([\\d,]+(?:\\.\\d+)?) Previous close ([\\d,]+(?:\\.\\d+)?)").exec(txt);
    return r ? { name, unit, price: num(r[1]), chg: num(r[2]), pct: num(r[3]), high: num(r[5]), low: num(r[4]), prev: num(r[6]), time: liveTime } : null;
  }).filter(Boolean);
  const newsSeg = (txt.split("Bullions News")[2] || txt.split("Bullions News")[1] || "").split("About India")[0].split("Advertisement")[0];
  const news = [...newsSeg.matchAll(/(.{12,160}?) (\d{1,2} \w{3} \d{4})/g)].map(n => ({ t: n[1].trim(), d: n[2] })).filter(n => /gold|silver|bullion|fed|dollar|rate/i.test(n.t)).slice(0, 8);
  const g24 = gold.find(x => x.k === 24), s999 = silver.find(x => x.p === 999) || silver[0];
  return {
    updated: st ? st.text : String(d.stamp || ""), silverUpdated: st ? st.text : String(d.stamp || ""),
    head: { gold: headOf("gold", g24, "g10"), silver: headOf("silver", s999, "kg") }, gold, silver,
    change: dates && chG && chS ? { dates, gold: chG, silver: chS } : null,
    live, news, hist: { gold: series("gold"), silver: series("silver") }, peak: d.peak || null, source: "bu-data"
  };
}

// the layout before 25-Nov-2026 (kept in case the old page comes back)
function fromOldText(html, txt) {
  const N6 = "([\\d,]+(?:\\.\\d+)?) ([\\d,]+(?:\\.\\d+)?) ([\\d,]+(?:\\.\\d+)?) ([\\d,]+(?:\\.\\d+)?) ([\\d,]+(?:\\.\\d+)?) ([\\d,]+(?:\\.\\d+)?)";
  const units = m => ({ g1: num(m[1]), g10: num(m[2]), g100: num(m[3]), kg: num(m[4]), oz: num(m[5]), tola: num(m[6]) });
  const gold = [...txt.matchAll(new RegExp("Gold (\\d{1,2}) Karat \\(Rs ₹\\) " + N6, "g"))].map(m => Object.assign({ k: +m[1] }, units(m.slice(1))));
  const silver = [...txt.matchAll(new RegExp("Silver (\\d{3}) (\\w+) \\(Rs ₹\\) " + N6, "g"))].map(m => Object.assign({ p: +m[1], name: m[2] }, units(m.slice(2))));
  if (!gold.length || !silver.length || !gold.some(x => x.k === 24)) return null;
  const upd = (/Gold Rate Today in India Last Update : (\w+, \d{1,2} \w{3} \d{4} \d{1,2}:\d{2} [AP]M)/.exec(txt) || [])[1] || "";
  const sUpd = (/Silver Rate Today in India Last Update : (\w+, \d{1,2} \w{3} \d{4} \d{1,2}:\d{2} [AP]M)/.exec(txt) || [])[1] || upd;
  const head = k => { const m = new RegExp(k + " ([\\d,]+\\.\\d+) ([+-][\\d,]+\\.\\d+) \\(([+-][\\d.]+)%\\)").exec(txt); return m ? { price: num(m[1]), chg: num(m[2]), pct: +m[3] } : null; };
  const dm = /1 Day Ago (\d{4}-\d\d-\d\d) 1 Week Ago (\d{4}-\d\d-\d\d) 1 Month Ago (\d{4}-\d\d-\d\d) 1 Year Ago (\d{4}-\d\d-\d\d)/.exec(txt);
  const chRow = re => { const m = re.exec(txt); return m ? [0, 1, 2, 3].map(i => ({ price: num(m[1 + 2 * i]), pct: +m[2 + 2 * i] })) : null; };
  const P4 = " ([\\d,]+\\.\\d+) ([+-]?[\\d.]+)% ([\\d,]+\\.\\d+) ([+-]?[\\d.]+)% ([\\d,]+\\.\\d+) ([+-]?[\\d.]+)% ([\\d,]+\\.\\d+) ([+-]?[\\d.]+)%";
  const live = [["Gold - India MCX", "₹/10 g"], ["Silver - India MCX", "₹/kg"], ["Gold - US Comex", "$/oz"], ["Silver - US Comex", "$/oz"]].map(([n, u]) => {
    const m = new RegExp(n.replace(/ /g, "\\s") + " \\([^)]*\\) ([\\d,]+\\.\\d+) ([+-]?[\\d,]+\\.\\d+) ([+-]?[\\d.]+)% ([\\d,]+\\.\\d+) ([\\d,]+\\.\\d+) ([\\d,]+\\.\\d+) (\\d{1,2} \\w{3}, \\d{1,2}:\\d{2})").exec(txt);
    return m ? { name: n.replace(" - ", " · "), unit: u, price: num(m[1]), chg: num(m[2]), pct: +m[3], high: num(m[4]), low: num(m[5]), prev: num(m[6]), time: m[7] } : null;
  }).filter(Boolean);
  const newsSeg = (txt.split("publish their rates once or more during the day")[1] || "").split("Copyright")[0];
  const news = [...newsSeg.matchAll(/([A-Z][^]{10,140}?) In News (\w{3}, \w{3} \d{1,2} \d{4})/g)].map(m => ({ t: m[1].replace(/^.*?News\s+/, "").trim(), d: m[2] })).slice(0, 8);
  const hist = id => { const m = new RegExp("var " + id + "=\\[([\\s\\S]*?)\\];").exec(html); return m ? [...m[1].matchAll(/date: '(\d{4}-\d\d-\d\d)', value:([\d.]+)/g)].map(x => [x[1], +x[2]]) : []; };
  return { updated: upd, silverUpdated: sUpd, head: { gold: head("GOLD"), silver: head("SILVER") }, gold, silver,
    change: dm ? { dates: dm.slice(1, 5), gold: chRow(new RegExp("Gold 24 Karat \\( Rs ₹ /10gm\\)" + P4)), silver: chRow(new RegExp("Silver 999 \\(Rs ₹/1kg\\)" + P4)) } : null,
    live, news, hist: { gold: hist("chartData1"), silver: hist("chartData2") }, source: "old-text" };
}

/* the old file's daily history is kept and the new points are laid over it (the new page only has 2 weeks daily) */
function mergeHist(oldH, newH) {
  const map = {};
  (Array.isArray(oldH) ? oldH : []).forEach(p => { if (Array.isArray(p) && /^\d{4}-\d\d-\d\d$/.test(p[0]) && p[1] > 0) map[p[0]] = p[1]; });
  const firstNew = (newH || []).find(p => !/-01$/.test(p[0]));   // monthly points only fill months the old file did not have
  (newH || []).forEach(([d, v]) => { if (!(v > 0)) return;
    if (/-01$/.test(d) && firstNew && d < firstNew[0]) { const ym = d.slice(0, 7); if (Object.keys(map).some(k => k.startsWith(ym))) return; }
    map[d] = v; });
  return Object.keys(map).sort().map(k => [k, map[k]]);
}

export function parseBullion(html, prev) {
  const txt = plainText(html);
  let r = null, err = "";
  try { r = fromDataBlock(html, txt); } catch (e) { err = "data block: " + e.message; }
  if (!r) r = fromOldText(html, txt);
  if (!r) throw new Error("rates not found on the page" + (err ? " (" + err + ")" : ""));
  if (prev && prev.hist) r.hist = { gold: mergeHist(prev.hist.gold, r.hist.gold), silver: mergeHist(prev.hist.silver, r.hist.silver) };
  return Object.assign({ v: 1, fetchedAt: new Date().toISOString() }, r);
}
