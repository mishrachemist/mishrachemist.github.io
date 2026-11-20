// The app's code is in js/*.js and css/*.css; index.html loads each with ?v=<content hash>.
// After changing any of those files run:  node tools/stamp.mjs
// It puts the new hash into index.html, so phones get the new file (the old one stays cached under its old ?v=).
// The "Stamp app files" workflow runs this on every push to main as a safety net.
import fs from "node:fs";
import crypto from "node:crypto";
const file = new URL("../index.html", import.meta.url);
const html = fs.readFileSync(file, "utf8");
let n = 0;
const out = html.replace(/((?:src|href)=")((?:js|css)\/[\w.-]+\.(?:js|css))\?v=([0-9a-f]+)"/g, (all, pre, p, old) => {
  const h = crypto.createHash("sha256").update(fs.readFileSync(new URL("../" + p, import.meta.url))).digest("hex").slice(0, 10);
  if (h !== old) { n++; console.log(`${p}: ${old} -> ${h}`); }
  return `${pre}${p}?v=${h}"`;
});
if (out !== html) fs.writeFileSync(file, out);
console.log(n ? `${n} file(s) re-stamped` : "all stamps up to date");
