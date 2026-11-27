// prints the bullion page as plain text (for fixing the parser); no secrets, nothing saved
const hr = await fetch("https://bullions.co.in/", { headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36", "Accept-Language": "en-IN,en;q=0.9" } });
const html = await hr.text();
console.log("status", hr.status, "html length", html.length);
const txt = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
for (let i = 0; i < Math.min(txt.length, 24000); i += 1500) console.log("TXT", i, txt.slice(i, i + 1500));
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => /date|value|price|rate/i.test(s));
scripts.slice(0, 8).forEach((s, k) => console.log("SCRIPT", k, s.length, s.slice(0, 600).replace(/\s+/g, " ")));
const i = html.indexOf("24 Carat"); console.log("HTML@24Carat", html.slice(Math.max(0, i - 1500), i + 2500).replace(/\s+/g, " "));
