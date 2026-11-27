// prints the structure of the page's bu-data JSON (for fixing the parser); no secrets, nothing saved
const hr = await fetch("https://bullions.co.in/", { headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36", "Accept-Language": "en-IN,en;q=0.9" } });
const html = await hr.text();
const m = /<script[^>]*id="bu-data"[^>]*>([\s\S]*?)<\/script>/.exec(html);
const d = JSON.parse(m[1]);
const sum = (o, p = "", depth = 0) => { if (Array.isArray(o)) { console.log("KEY", p, "array", o.length, JSON.stringify(o.slice(0, 2)).slice(0, 200), "…", JSON.stringify(o.slice(-1)).slice(0, 120)); return; }
  if (o && typeof o === "object") { if (depth > 4) { console.log("KEY", p, "obj", Object.keys(o).join(",")); return; } Object.keys(o).forEach(k => sum(o[k], p + "." + k, depth + 1)); return; }
  console.log("KEY", p, JSON.stringify(o)); };
sum(d);
const live = html.indexOf("India commodity exchange"); console.log("LIVEHTML", JSON.stringify(html.slice(live - 600, live + 1600)));
const ch = html.indexOf("Change by period"); console.log("CHHTML", JSON.stringify(html.slice(ch, ch + 2500)));
const nw = html.indexOf("Bullions News</span>"); console.log("NEWSHTML", JSON.stringify(html.slice(nw, nw + 1500)));
