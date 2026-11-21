// Keeps the app's own styles for header / input / select / textarea / label out of Moltrix Sheet's grid (#msGrid):
// every such selector gets :where(:not(#msGrid *, [class*=univer-], …)) - no change in specificity. Run again after editing css/app-*.css (idempotent).
import fs from "node:fs";
const TAG = /^(header|input|select|textarea|label)(?![\w-])/, MARK = ":where(:not(#msGrid *, [class*=univer-], [class*=univer-] *))";
function scopeSel(sel) {
  if (sel.includes(MARK)) return sel;
  let out = "", depth = 0, cur = "";
  const flush = () => {
    if (!cur) return;
    const m = TAG.exec(cur);
    if (m) { const pe = cur.indexOf("::"); cur = pe >= 0 ? cur.slice(0, pe) + MARK + cur.slice(pe) : cur + MARK; }
    out += cur; cur = "";
  };
  for (const ch of sel) {
    if (ch === "[" || ch === "(") depth++;
    if (ch === "]" || ch === ")") depth--;
    if (depth === 0 && /[\s>+~]/.test(ch)) { flush(); out += ch; continue; }
    cur += ch;
  }
  flush();
  return out;
}
for (const f of process.argv.slice(2)) {
  const s = fs.readFileSync(f, "utf8");
  let n = 0;
  const t = s.replace(/(^|[{}])([^{}@]+?)\{/g, (all, pre, sels) => {
    if (/^\s*(\d+%|from|to)\s*$/.test(sels)) return all;
    const parts = sels.split(/,(?![^()]*\))/);
    const done = parts.map(p => { const lead = p.match(/^\s*/)[0], body = p.trim(); const r = scopeSel(body); if (r !== body) n++; return lead + r + (p.match(/\s*$/)[0] && body ? p.match(/\s*$/)[0] : ""); });
    return pre + done.join(",") + "{";
  });
  fs.writeFileSync(f, t);
  console.log(f, n, "selectors scoped");
}
