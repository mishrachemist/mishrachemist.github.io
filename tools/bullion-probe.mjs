// prints parts of the bullion page (for fixing the parser); no secrets, nothing saved
const hr = await fetch("https://bullions.co.in/", { headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36", "Accept-Language": "en-IN,en;q=0.9" } });
const html = await hr.text();
console.log("status", hr.status, "html length", html.length);
const show = (label, i, a = 400, b = 900) => console.log(label, i, JSON.stringify(html.slice(Math.max(0, i - a), i + b)));
let k = 0; for (const m of html.matchAll(/Sterling/g)) { if (k++ > 3) break; show("STERLING", m.index); }
k = 0; for (const m of html.matchAll(/152,?740/g)) { if (k++ > 6) break; show("SILVERNUM", m.index, 300, 300); }
k = 0; for (const m of html.matchAll(/data-[a-z-]+=['"][\[{]/g)) { if (k++ > 10) break; show("DATAJSON", m.index, 50, 700); }
k = 0; for (const m of html.matchAll(/\d{4}-\d\d-\d\d/g)) { if (k++ > 3) break; show("DATE", m.index, 300, 300); }
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
scripts.forEach((m, j) => { if (/125,?100|152,?740|rates|chart/i.test(m[1])) console.log("SCRIPT", j, m[0].slice(0, 120).replace(/\s+/g, " "), m[1].length, JSON.stringify(m[1].slice(0, 1200))); });
show("UPDATED", html.indexOf("Updated 27") >= 0 ? html.indexOf("Updated ") : html.indexOf("Updated"), 200, 400);
show("LIVE", html.indexOf("India commodity exchange"), 300, 900);
show("CHANGE", html.indexOf("Change by period"), 100, 1500);
