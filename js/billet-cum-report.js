/* ===================== BILLET CUM REPORT: "Cumulative Stock" sheet (B1:J17) -> JPG / PDF, Excel colours =====================
   Colours = the sheet's own fills (Excel theme shades): date line light blue, header blue-grey, section grey,
   TOTAL lines and the 110 line light yellow, OK / HOLD lines white; HOLD figures red; a 0 is shown in white
   (the sheet's conditional format); date and the summary in Times New Roman bold. Figures exactly as Excel
   shows them (Graph "text"). */
(function billetCumReport() {
  const $ = id => document.getElementById(id);
  if (!$("bcPdfBtn")) return;
  const COLS = ["B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const CW = [64, 106, 70, 80, 89, 100, 105, 73, 72];                           // Excel column widths in px
  const RH = [26, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 20, 20, 20, 20, 20, 20];  // rows 1..17 in px
  const FILL = { blue: "#DDEBF7", head: "#ACB9CA", sect: "#D0CECE", yel: "#FFF2CC", white: "#FFFFFF" };
  const RED = new Set(["D6", "E6", "F6", "G6", "J6", "E10", "F10", "G10", "H10", "J10"]);
  let data = null;   // { text:[][], values:[][], date, file }
  const cv = document.createElement("canvas");
  const fillOf = (r, c) => {       // r = sheet row 1..17, c = 0..8 (B..J)
    if (r === 1) return FILL.blue;
    if (r === 3) return FILL.head;
    if (r >= 4 && r <= 11) {
      if (r === 7 || r === 11) return FILL.yel;
      if (c === 0) return r === 8 ? FILL.white : FILL.sect;
      if (r === 4) return FILL.yel;
    }
    return FILL.white;
  };
  async function load() {
    const st = $("bcStatus"); data = null; $("bcPreview").removeAttribute("src");
    st.className = "wait"; st.textContent = "Reading Cumulative Stock…";
    try {
      const token = await getToken(), now = new Date();
      const path = await detectFilePathForMonth(token, now.getFullYear(), now.getMonth());
      if (!path) throw new Error(`${MONTH_ABBR[now.getMonth()]}'${String(now.getFullYear()).slice(2)}_Reports.xlsx not found on OneDrive.`);
      const wb = await resolveWorkbook(token, path);
      // B1 is =NOW() and every figure looks up the "As on <B1>" block of Billet Stock Format. A file on OneDrive
      // keeps the date of its last calculation, so Excel is asked to recalculate first -> B1 = today, figures = today.
      const todayIso = todayISO(), rng = `${wb}/worksheets('Cumulative%20Stock')/range(address='B1:J17')?$select=values,text`;
      const calc = async type => { try { await graphFetch(`${wb}/application/calculate`, token, { method: "POST", body: JSON.stringify({ calculationType: type }) }); } catch (e) { console.warn("calculate", type, e); } };
      st.textContent = "Recalculating the Excel file (today's date)…";
      await calc("Recalculate");
      let r = await graphFetch(rng, token, { noCache: true });
      const isoB1 = x => typeof x === "number" && x > 40000 ? excelSerialToISODate(x) : "";
      if (isoB1(r.values[0][0]) !== todayIso) { await calc("Full"); r = await graphFetch(rng, token, { noCache: true }); }
      if (isoB1(r.values[0][0]) !== todayIso) {
        // Excel on OneDrive does not refresh =NOW() -> put today's date in B1 for a moment, read, then put the formula back
        st.textContent = "Reading today's figures…";
        const b1Url = `${wb}/worksheets('Cumulative%20Stock')/range(address='B1')`;
        const orig = await graphFetch(`${b1Url}?$select=formulas`, token, { noCache: true });
        const f0 = orig && orig.formulas ? orig.formulas[0][0] : "=NOW()";
        const [ty, tm, td] = todayIso.split("-").map(Number), serial = Date.UTC(ty, tm - 1, td) / 86400000 + 25569;
        try {
          await graphFetch(b1Url, token, { method: "PATCH", body: JSON.stringify({ values: [[serial]] }) });
          r = await graphFetch(rng, token, { noCache: true });
        } finally {
          try { await graphFetch(b1Url, token, { method: "PATCH", body: JSON.stringify({ formulas: [[f0 === "" || f0 == null ? "=NOW()" : f0]] }) }); }
          catch (e) { st.className = "err"; st.textContent = "⚠️ Cumulative Stock B1 could not be set back to " + (f0 || "=NOW()") + " - please type it in Excel."; }
        }
      }
      data = { text: r.text.map(row => row.map(v => String(v == null ? "" : v))), values: r.values, file: path.split("/").pop() };
      data.date = data.text[0][0] || now.toLocaleDateString("en-GB");
      const b1 = isoB1(r.values[0][0]);
      const nums = r.values.slice(3, 11).map(row => row.slice(2)).flat().filter(v => typeof v === "number");   // figures D:J (not the 110/130/160 labels)
      st.className = ""; st.textContent = "";
      if (b1 && b1 !== todayIso) { st.className = "err"; st.textContent = `⚠️ Excel could not be recalculated - the sheet still shows ${data.date}, so these figures are for ${data.date}, not today.`; }
      else if (nums.length && nums.every(v => v === 0)) { st.className = "err"; st.textContent = `⚠️ All figures are 0 - Billet Stock Format has no "As on ${todayIso.split("-").reverse().join(".")}" block yet (create today's block first).`; }
      $("bcPreview").src = (await draw()).toDataURL("image/jpeg", 0.92);
    } catch (e) { st.className = "err"; st.textContent = "⚠️ " + (e && e.message ? e.message : e); }
  }
  async function draw() {
    const S = 2.4, PAD = 18 * S, logo = typeof snLogo === "function" ? await snLogo() : null;
    const xs = [PAD]; CW.forEach((w, i) => xs.push(xs[i] + w * S));
    let lh = 0, lw = 0; if (logo) { lh = 34 * S; lw = lh * logo.naturalWidth / logo.naturalHeight; if (lw > 200 * S) { lw = 200 * S; lh = lw * logo.naturalHeight / logo.naturalWidth; } }
    const top = PAD + (logo ? lh + 10 * S : 0);
    const ys = [top]; RH.forEach((h, i) => ys.push(ys[i] + h * S));
    cv.width = Math.round(xs[9] + PAD); cv.height = Math.round(ys[17] + PAD);
    const g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
    if (logo) g.drawImage(logo, PAD, PAD, lw, lh);
    const T = data.text, V = data.values;
    const merged = { "1": [0, 8], "2": [0, 8] };    // B1:J1, B2:J2 across; B5:B6 and B9:B10 down
    const box = (r, c) => {
      if (r === 1 || r === 2) return [xs[0], ys[r - 1], xs[9], ys[r]];
      if (c === 0 && (r === 5 || r === 9)) return [xs[0], ys[r - 1], xs[1], ys[r + 1]];
      return [xs[c], ys[r - 1], xs[c + 1], ys[r]];
    };
    const skip = (r, c) => ((r === 1 || r === 2) && c > 0) || (c === 0 && (r === 6 || r === 10));
    for (let r = 1; r <= 17; r++) for (let c = 0; c < 9; c++) {
      if (skip(r, c)) continue;
      const [x1, y1, x2, y2] = box(r, c);
      g.fillStyle = fillOf(r, c); g.fillRect(x1, y1, x2 - x1, y2 - y1);
      const txt = T[r - 1][c]; if (txt === "") continue;
      const v = V[r - 1][c], ref = COLS[c] + r;
      const tnr = r === 1 || r >= 13, bold = r <= 2 || r >= 13, size = (r === 1 ? 14 : 11) * 1.333 * S;
      g.font = `${bold ? "700" : "400"} ${size}px ${tnr ? '"Times New Roman", Times, serif' : 'Calibri, Carlito, "Segoe UI", Arial, sans-serif'}`;
      g.fillStyle = v === 0 ? "#FFFFFF" : RED.has(ref) ? "#FF0000" : "#000000";     // 0 -> white (sheet's conditional format)
      g.textBaseline = "middle";
      let align = "center";
      if (r >= 13) align = c === 8 ? "right" : "left";
      else if (c === 8 && typeof v === "number") align = "right";
      else if ((c === 7 || c === 8) && r <= 4) align = typeof v === "number" ? "right" : "left";
      g.textAlign = align;
      const xx = align === "center" ? (x1 + x2) / 2 : align === "left" ? x1 + 4 * S : x2 - 4 * S;
      g.fillText(txt, xx, (y1 + y2) / 2 + 0.5 * S);
    }
    // borders: thin black grid over the table B1:J11, thicker outer frame (rows 12-17 have none, like Excel)
    g.strokeStyle = "#000"; g.lineWidth = 1 * S;
    for (let r = 1; r <= 11; r++) for (let c = 0; c < 9; c++) { if (skip(r, c)) continue; const [x1, y1, x2, y2] = box(r, c); g.strokeRect(x1, y1, x2 - x1, y2 - y1); }
    g.lineWidth = 2 * S; g.strokeRect(xs[0], ys[0], xs[9] - xs[0], ys[11] - ys[0]);
    return cv;
  }
  const base = () => "Billet_Cum_Report_" + (data && data.date ? data.date.replace(/[\\/:*?"<>|\s]+/g, "-") : "");
  const jpgBlob = async () => { await draw(); return new Promise(res => cv.toBlob(res, "image/jpeg", 0.92)); };
  function dl(b, name) { const u = URL.createObjectURL(b), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
  async function ensure() { if (!data) await load(); return !!data; }
  $("bcJpgBtn").addEventListener("click", async () => { if (await ensure()) dl(await jpgBlob(), base() + ".jpg"); });
  $("bcShareBtn").addEventListener("click", async () => {
    if (!(await ensure())) return;
    try {
      const b = await jpgBlob(), f = new File([b], base() + ".jpg", { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: f.name });
      else { alert("Direct sharing isn't supported here - the picture will be downloaded; send it from the gallery / Downloads."); dl(b, f.name); }
    } catch (e) { if (e.name !== "AbortError") alert("Share failed: " + e.message); }
  });
  $("bcPdfBtn").addEventListener("click", async () => {
    if (!(await ensure())) return;
    const c = await draw(), { jsPDF } = window.jspdf;
    const landscape = c.width > c.height * 1.15;
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: landscape ? "landscape" : "portrait" });
    const pw = doc.internal.pageSize.getWidth(), M = 28, w = pw - 2 * M, h = w * c.height / c.width;
    doc.addImage(c.toDataURL("image/jpeg", 0.95), "JPEG", M, M, w, h);
    showPdfPreview(doc, base() + ".pdf", "Billet Cum Report - " + (data.date || ""));
  });
  $("bcReloadBtn").addEventListener("click", load);
  const tile = document.querySelector('#reportsSubNav .navItem[data-subreport="billetcum"]');
  if (tile) tile.addEventListener("click", load);
  window._bcTest = { set: d => { data = d; return draw(); } };
})();
