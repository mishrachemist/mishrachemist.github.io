/* ===================== RAW MATERIAL daily report (Daily Prod Format U:X block) -> JPG for WhatsApp ===================== */
(function rmDailyReport() {
  const $ = id => document.getElementById(id);
  if (!$("rmdDate")) return;
  const pad = n => String(n).padStart(2, "0");
  const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return isoOf(d); };
  let style = "classic"; try { style = localStorage.getItem("rmdStyle") || "classic"; } catch (e) {}
  let data = null;   // { title, date, rows:[{label,v,w,x}], total }
  const cv = document.createElement("canvas");

  async function load() {
    const st = $("rmdStatus"), iso = $("rmdDate").value;
    if (!iso) return;
    data = null; $("rmdPreview").removeAttribute("src");
    st.className = "wait"; st.textContent = "Reading Daily Prod Format...";
    try {
      const token = await getToken();
      const [y, m, d] = iso.split("-").map(Number);
      const path = await detectFilePathForMonth(token, y, m - 1);
      if (!path) throw new Error(`${MONTH_ABBR[m - 1]}'${String(y).slice(2)}_Reports.xlsx not found on OneDrive.`);
      const wb = await resolveWorkbook(token, path);
      const sheet = ($("rmSheetName") && $("rmSheetName").value.trim()) || "Daily Prod Format";
      const sh = `${wb}/worksheets('${encodeURIComponent(String(sheet).replace(/'/g, "''"))}')`;
      const scan = await graphFetch(`${sh}/range(address='A1:A2000')?$select=values,text`, token);
      let t = -1;
      for (let i = 0; i < scan.values.length && t < 0; i++) {
        const v = scan.values[i][0], txt = String(scan.text[i][0] || "");
        if (typeof v === "number" && v > 40000 && excelSerialToISODate(v) === iso) t = i + 1;
        const mm = txt.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
        if (t < 0 && mm && `${mm[3]}-${mm[2].padStart(2, "0")}-${mm[1].padStart(2, "0")}` === iso) t = i + 1;
      }
      if (t < 0) throw new Error(`The ${d}-${m}-${y} block is not in "${sheet}" yet.`);
      const blk = await graphFetch(`${sh}/range(address='U${t + 3}:X${t + 20}')?$select=values,text`, token);
      const T = blk.text.map(r => r.map(c => String(c == null ? "" : c).trim()));
      const out = { title: T[0][0] || "RAW MATERIAL", date: T[1][0] || `DATE-${pad(d)}-${pad(m)}-${y}`, h2: T[1][2] || "DAILY AVG", h3: T[1][3] || "MONTHLY AVG", rows: [], total: null };
      for (let i = 2; i < T.length; i++) {
        const r = T[i];
        if (!r[0]) { if (out.rows.length) continue; else continue; }
        if (/total/i.test(r[0])) { out.total = { label: r[0], v: /^[-+]?(?:0+(?:\.0*)?|\.0+)$/.test(r[1]) ? "" : r[1] }; break; }
        const z = v => /^[-+]?(?:0+(?:\.0*)?|\.0+)\s*%?$/.test(v) ? "" : v;
        out.rows.push({ label: r[0], v: z(r[1]), w: z(r[2]), x: z(r[3]) });
      }
      if (!out.rows.length) throw new Error("No raw material lines found in that block.");
      data = out;
      st.className = ""; st.textContent = "";
      render();
    } catch (e) { st.className = "err"; st.textContent = "⚠️ " + e.message; }
  }

  function draw() {
    const D = data, rows = D.rows, colour = style === "colour";
    const W = 1080, X0 = 40, CW = [400, 200, 190, 210], RH = 66, TH = 74;
    const H = 40 + TH * 2 + 26 + rows.length * RH + 92 + 40 + (colour ? 40 : 0);
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const F = (w, s) => `${w} ${s}px Calibri, Carlito, "Segoe UI", Arial, sans-serif`;
    g.fillStyle = colour ? "#eef3f9" : "#ffffff"; g.fillRect(0, 0, W, H);
    const tw = CW.reduce((a, b) => a + b, 0), xs = [X0]; CW.forEach((w, i) => xs.push(xs[i] + w));
    let y = 40;
    const line = (x1, y1, x2, y2, c, lw) => { g.strokeStyle = c || "#000"; g.lineWidth = lw || 2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    const text = (s, x, yy, align, font, col) => { g.font = font; g.fillStyle = col || "#000"; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, yy); };
    const grid = colour ? "#9fb3c8" : "#000";
    // title
    if (colour) { g.fillStyle = "#0b2545"; g.fillRect(X0, y, tw, TH); }
    text(D.title, X0 + tw / 2, y + TH / 2, "center", F(700, 38), colour ? "#ffffff" : "#000");
    y += TH;
    // date + headings
    if (colour) { g.fillStyle = "#c9a227"; g.fillRect(X0, y, tw, TH); }
    text(D.date, X0 + (CW[0] + CW[1]) / 2, y + TH / 2, "center", F(700, 32), colour ? "#0b2545" : "#000");
    text(D.h2, xs[2] + CW[2] / 2, y + TH / 2, "center", F(700, 28), colour ? "#0b2545" : "#000");
    text(D.h3, xs[3] + CW[3] / 2, y + TH / 2, "center", F(700, 28), colour ? "#0b2545" : "#000");
    const headTop = y; y += TH;
    y += 26;   // the empty row
    const bodyTop = y;
    rows.forEach((r, i) => {
      if (colour && i % 2 === 0) { g.fillStyle = "#ffffff"; g.fillRect(X0, y, tw, RH); }
      if (colour && i % 2 === 1) { g.fillStyle = "#f6f9fc"; g.fillRect(X0, y, tw, RH); }
      text(r.label, X0 + 14, y + RH / 2, "left", F(500, 32), colour ? "#14213d" : "#000");
      text(r.v, xs[2] - 14, y + RH / 2, "right", F(colour ? 700 : 500, 32), colour ? "#0b2545" : "#000");
      if (r.w) text(r.w, xs[3] - 14, y + RH / 2, "right", F(500, 32), colour ? "#1565c0" : "#000");
      if (r.x) text(r.x, xs[4] - 14, y + RH / 2, "right", F(500, 32), colour ? "#2e7d32" : "#000");
      y += RH; line(X0, y, X0 + tw, y, grid, colour ? 1.5 : 2);
    });
    // total
    const TT = 92;
    if (colour) { g.fillStyle = "#0b2545"; g.fillRect(X0, y, xs[2] - X0, TT); }
    if (D.total) {
      text(D.total.label, X0 + 14, y + TT / 2, "left", `italic ${F(700, 44)}`, colour ? "#ffffff" : "#000");
      text(D.total.v, xs[2] - 14, y + TT / 2, "right", `italic ${F(700, 44)}`, colour ? "#ffffff" : "#000");
    }
    const bottom = y + TT;
    // grid lines (Excel look)
    g.lineWidth = 2; g.strokeStyle = grid;
    g.strokeRect(X0, 40, tw, TH);
    g.strokeRect(X0, headTop, tw, TH);
    line(xs[2], headTop, xs[2], headTop + TH, grid); line(xs[3], headTop, xs[3], headTop + TH, grid);
    g.strokeRect(X0, headTop + TH, tw, 26);
    g.strokeRect(X0, bodyTop, tw, bottom - bodyTop);
    [1, 2].forEach(k => line(xs[k], bodyTop, xs[k], bottom, grid));
    line(xs[3], bodyTop, xs[3], bottom - TT, grid);
    line(X0, bottom - TT, X0 + tw, bottom - TT, grid, 2.5);
    if (colour) { g.font = F(600, 22); g.fillStyle = "#5a6478"; g.textAlign = "right"; g.textBaseline = "alphabetic"; g.fillText("QAD-SMS", X0 + tw, H - 24); }
    return cv;
  }
  function render() { if (!data) return; draw(); $("rmdPreview").src = cv.toDataURL("image/jpeg", 0.92); }
  const fileName = () => `Raw_Material_${$("rmdDate").value.split("-").reverse().join("-")}.jpg`;
  const blob = () => new Promise(res => { draw(); cv.toBlob(res, "image/jpeg", 0.92); });
  function dl(b) { const u = URL.createObjectURL(b), a = document.createElement("a"); a.href = u; a.download = fileName(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
  $("rmdShare").addEventListener("click", async () => {
    if (!data) return;
    try {
      const b = await blob(), f = new File([b], fileName(), { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: fileName() });
      else { alert("Direct sharing isn't supported here - the picture will be downloaded; send it from the gallery / Downloads."); dl(b); }
    } catch (e) { if (e.name !== "AbortError") alert("Share failed: " + e.message); }
  });
  $("rmdDownload").addEventListener("click", async () => { if (data) dl(await blob()); });
  $("rmdDate").addEventListener("change", load);
  $("rmdReload").addEventListener("click", load);
  const syncStyle = () => $("rmdStyle").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.s === style));
  $("rmdStyle").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; style = b.dataset.s; try { localStorage.setItem("rmdStyle", style); } catch (x) {} syncStyle(); render(); });
  syncStyle();
  const tile = document.querySelector('#reportsSubNav .navItem[data-subreport="rmdaily"]');
  if (tile) tile.addEventListener("click", () => { $("rmdDate").value = yesterday(); load(); });
  window._rmdTest = { set: d => { data = d; render(); } };
})();
