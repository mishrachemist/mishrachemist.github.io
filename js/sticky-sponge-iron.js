/* ===================== STICKY NOTE: Sponge Iron Required (JPG for the WhatsApp group) ===================== */
(function spongeNote() {
  const $ = id => document.getElementById(id);
  const box = $("snRows"); if (!box) return;
  const DEF = { title: "SPONGE IRON REQUIRED", rows: [{ n: "PELLETS-", f: "79+", q: "100 MT" }, { n: "FINES-", f: "", q: "AS PER AVAILABILITY" }], sign: true };
  const ROWPAL = ["#1565c0", "#2e7d32", "#e65100", "#ad1457", "#6a1b9a", "#00838f", "#c62828", "#5d4037"];
  const PAPERS = [["#ffe45c", "Yellow"], ["#ffb3d1", "Pink"], ["#b9f6ca", "Green"], ["#b3e5fc", "Blue"], ["#ffcc80", "Orange"], ["#d1c4e9", "Lavender"], ["#ffffff", "White"]];
  const DEFCOL = { multi: true, paper: "#ffe45c", cTitle: "#0d47a1", cDate: "#c62828", cHead: "#1c2742", cInk: "#1c2742" };
  const rowCol = (r, i) => (r.c && /^#[0-9a-f]{6}$/i.test(r.c)) ? r.c : ROWPAL[i % ROWPAL.length];
  let st;
  try { st = JSON.parse(localStorage.getItem("spongeNote") || "null") || DEF; } catch (e) { st = DEF; }
  if (!Array.isArray(st.rows) || !st.rows.length) st.rows = DEF.rows.slice();
  Object.keys(DEFCOL).forEach(k => { if (st[k] === undefined) st[k] = DEFCOL[k]; });
  const save = () => { try { localStorage.setItem("spongeNote", JSON.stringify(st)); } catch (e) {} };
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const todayVal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

  $("snTitle").value = st.title || DEF.title;
  $("snDate").value = todayVal();               // always today's date when the page opens
  $("snSign").checked = st.sign !== false;

  function drawRows() {
    box.innerHTML = st.rows.map((r, i) => `<div class="snRow" data-i="${i}">
      <input type="text" data-k="n" value="${esc(r.n)}" placeholder="Material" aria-label="Material">
      <input type="text" data-k="f" value="${esc(r.f)}" placeholder="FeM" aria-label="FeM">
      <input type="text" data-k="q" value="${esc(r.q)}" placeholder="Qty" aria-label="Qty">
      <input type="color" class="snRowC" data-k="c" value="${rowCol(r, i)}" title="Colour of this line" aria-label="Line colour">
      <button type="button" class="snDel" title="Remove this line" aria-label="Remove">✕</button></div>`).join("");
  }
  drawRows();
  box.addEventListener("input", e => {
    const row = e.target.closest(".snRow"); if (!row || !e.target.dataset.k) return;
    st.rows[+row.dataset.i][e.target.dataset.k] = e.target.value; save(); later();
  });
  box.addEventListener("click", e => {
    if (!e.target.classList.contains("snDel")) return;
    const i = +e.target.closest(".snRow").dataset.i;
    if (st.rows.length <= 1) return;
    st.rows.splice(i, 1); save(); drawRows(); render();
  });
  $("snAddRow").addEventListener("click", () => { st.rows.push({ n: "", f: "", q: "" }); save(); drawRows(); render(); });
  $("snTitle").addEventListener("input", () => { st.title = $("snTitle").value; save(); later(); });
  $("snDate").addEventListener("input", later);
  $("snSign").addEventListener("change", () => { st.sign = $("snSign").checked; save(); render(); });
  $("snReset").addEventListener("click", () => { const keep = {}; Object.keys(DEFCOL).forEach(k => keep[k] = st[k]); st = Object.assign(JSON.parse(JSON.stringify(DEF)), keep); save(); $("snTitle").value = st.title; $("snSign").checked = true; drawRows(); render(); });
  // ---- colour choices ----
  function drawColors() {
    $("snStyle").querySelectorAll("button").forEach(b => b.classList.toggle("on", (b.dataset.m === "1") === !!st.multi));
    const isPreset = PAPERS.some(p => p[0] === st.paper);
    $("snPaper").innerHTML = PAPERS.map(([c, n]) => `<button type="button" data-c="${c}" title="${n}" aria-label="${n} paper" style="background:${c}" class="${st.paper === c ? "on" : ""}"></button>`).join("") +
      `<input type="color" id="snPaperC" value="${st.paper}" title="Any other paper colour" aria-label="Other paper colour"${isPreset ? "" : ' style="outline:3px solid var(--gold)"'}>`;
    $("snCTitle").value = st.cTitle; $("snCDate").value = st.cDate; $("snCHead").value = st.cHead; $("snCInk").value = st.cInk;
  }
  drawColors();
  $("snStyle").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; st.multi = b.dataset.m === "1"; save(); drawColors(); render(); });
  $("snPaper").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; st.paper = b.dataset.c; save(); drawColors(); render(); });
  $("snPaper").addEventListener("input", e => { if (e.target.id !== "snPaperC") return; st.paper = e.target.value; save(); later(); });
  $("snPaper").addEventListener("change", e => { if (e.target.id === "snPaperC") drawColors(); });
  [["snCTitle", "cTitle"], ["snCDate", "cDate"], ["snCHead", "cHead"], ["snCInk", "cInk"]].forEach(([id, k]) => $(id).addEventListener("input", () => { st[k] = $(id).value; save(); later(); }));
  $("snColReset").addEventListener("click", () => { Object.assign(st, DEFCOL); st.rows.forEach(r => delete r.c); save(); drawColors(); drawRows(); render(); });

  let tmr = 0;
  function later() { clearTimeout(tmr); tmr = setTimeout(render, 250); }
  const dmy = v => v ? v.split("-").reverse().join("-") : "";
  const rgb = h => { const n = parseInt(String(h).replace("#", ""), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return "#" + A.map((v, k) => Math.round(v + (B[k] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const hexA = (h, a) => `rgba(${rgb(h).join(",")},${a})`;

  // ---- the picture ----
  const cv = document.createElement("canvas");
  async function draw() {
    try { await Promise.all(['800 60px "Baloo 2"', '700 40px "Baloo 2"', '700 40px "Poppins"', '600 40px "Poppins"'].map(f => document.fonts.load(f))); } catch (e) {}
    const rows = st.rows.filter(r => (r.n || r.f || r.q).trim());
    const W = 1080, H = Math.max(1080, 700 + rows.length * 118);
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    // table top background
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#e8edf3"); bg.addColorStop(1, "#d5dde7");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // the note, a little tilted
    const nx = 95, ny = 120, nw = W - 190, nh = H - 230, fold = 78;
    g.save();
    g.translate(W / 2, H / 2); g.rotate(-1.3 * Math.PI / 180); g.translate(-W / 2, -H / 2);
    const notePath = () => { g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + nw, ny); g.lineTo(nx + nw, ny + nh - fold); g.lineTo(nx + nw - fold, ny + nh); g.lineTo(nx, ny + nh); g.closePath(); };
    g.save(); g.shadowColor = "rgba(30,40,60,.32)"; g.shadowBlur = 46; g.shadowOffsetY = 22;
    const P = st.paper || DEFCOL.paper, isYellow = P.toLowerCase() === "#ffe45c";
    notePath(); const ng = g.createLinearGradient(0, ny, 0, ny + nh);
    ng.addColorStop(0, isYellow ? "#fff480" : mix(P, "#ffffff", .35)); ng.addColorStop(1, isYellow ? "#ffdc4e" : mix(P, "#000000", .04));
    g.fillStyle = ng; g.fill(); g.restore();
    // folded corner
    g.beginPath(); g.moveTo(nx + nw, ny + nh - fold); g.lineTo(nx + nw - fold, ny + nh - fold + 6); g.lineTo(nx + nw - fold, ny + nh); g.closePath();
    g.fillStyle = isYellow ? "#e2bb32" : mix(P, "#000000", .2); g.fill();
    const multi = !!st.multi, ink = st.cInk || DEFCOL.cInk;
    // faint ruled lines (simple style only)
    if (!multi) { g.strokeStyle = "rgba(60,100,170,.16)"; g.lineWidth = 2;
      for (let y = ny + 360; y < ny + nh - 40; y += 118) { g.beginPath(); g.moveTo(nx + 40, y); g.lineTo(nx + nw - 40, y); g.stroke(); } }
    // tape on top
    g.save(); g.translate(W / 2, ny + 4); g.rotate(2 * Math.PI / 180);
    g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(-120, -30, 240, 60);
    g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 2; g.strokeRect(-120, -30, 240, 60); g.restore();

    const fit = (txt, w, fam, size, maxW) => { let s = size; do { g.font = `${w} ${s}px "${fam}"`; if (g.measureText(txt).width <= maxW) break; s -= 2; } while (s > 18); return s; };
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    // title + date
    g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = st.cTitle || DEFCOL.cTitle;
    const title = (st.title || "").trim() || DEF.title;
    fit(title, 800, "Baloo 2", 78, nw - 110); g.fillText(title, W / 2, ny + 140);
    const d = $("snDate").value, dc = st.cDate || DEFCOL.cDate;
    if (d) {
      const dt = `AS ON ${dmy(d)}`;
      if (multi) {   // date in a coloured pill
        const fs = fit(dt, 700, "Baloo 2", 46, nw - 200), tw = g.measureText(dt).width, ph = fs + 22;
        g.fillStyle = dc; rr(W / 2 - tw / 2 - 30, ny + 168, tw + 60, ph, ph / 2); g.fill();
        g.fillStyle = "#ffffff"; g.fillText(dt, W / 2, ny + 168 + ph / 2 + fs * 0.36);
      } else { g.fillStyle = dc; fit(dt, 700, "Baloo 2", 54, nw - 110); g.fillText(dt, W / 2, ny + 212); }
    }
    // table
    const c1 = nx + 60, c2 = nx + nw * 0.43, c3 = nx + nw * 0.64, right = nx + nw - 50;
    g.textAlign = "left"; g.font = '700 44px "Poppins"';
    if (multi) {   // heading band
      g.fillStyle = st.cHead || DEFCOL.cHead; rr(nx + 36, ny + 262, nw - 72, 84, 18); g.fill();
      g.fillStyle = "#ffffff";
    } else {
      g.strokeStyle = "rgba(28,39,66,.55)"; g.lineWidth = 3; g.beginPath(); g.moveTo(nx + 60, ny + 250); g.lineTo(nx + nw - 60, ny + 250); g.stroke();
      g.fillStyle = st.cHead || ink;
    }
    g.fillText("SPONGE", c1, ny + 320); g.fillText("FeM", c2, ny + 320); g.fillText("QTY", c3, ny + 320);
    let y = ny + 438;
    st.rows.forEach((r, i) => {
      if (!(r.n || r.f || r.q).trim()) return;
      const rc = rowCol(r, i);
      if (multi) {   // soft coloured band with a solid strip on the left
        g.fillStyle = hexA(rc, .16); rr(nx + 36, y - 66, nw - 72, 96, 18); g.fill();
        g.fillStyle = rc; rr(nx + 36, y - 66, 14, 96, 7); g.fill();
      }
      g.fillStyle = multi ? mix(rc, "#000000", .15) : rc;
      fit(r.n || "", 700, "Poppins", 46, c2 - c1 - 20); g.fillText(r.n || "", c1, y);
      g.fillStyle = multi ? mix(rc, "#000000", .45) : ink;
      if ((r.f || "").trim()) {
        fit(r.f, 600, "Poppins", 46, c3 - c2 - 20); g.fillText(r.f, c2, y);
        fit(r.q || "", 600, "Poppins", 46, right - c3); g.fillText(r.q || "", c3, y);
      } else {   // no FeM: quantity / remark uses both columns, like the Excel sheet
        fit(r.q || "", 600, "Poppins", 46, right - c2); g.fillText(r.q || "", c2, y);
      }
      y += 118;
    });
    if (st.sign) { g.textAlign = "right"; g.fillStyle = "rgba(28,39,66,.55)"; g.font = '600 30px "Baloo 2"'; g.fillText("- QAD-SMS", nx + nw - fold - 24, ny + nh - 34); }
    g.restore();
    return cv;
  }
  async function render() {
    await draw();
    const img = $("snPreview"); if (img) img.src = cv.toDataURL("image/jpeg", 0.92);
  }
  const fileName = () => `Sponge_Iron_Required_${dmy($("snDate").value) || "note"}.jpg`;
  const blob = async () => { await draw(); return new Promise(res => cv.toBlob(res, "image/jpeg", 0.92)); };
  $("snShare").addEventListener("click", async () => {
    try {
      const b = await blob(); const f = new File([b], fileName(), { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: fileName() });
      else { alert("Direct sharing isn't supported here - the picture will be downloaded; send it from the gallery / Downloads."); dl(b); }
    } catch (e) { if (e.name !== "AbortError") alert("Share failed: " + e.message); }
  });
  function dl(b) {
    const u = URL.createObjectURL(b), a = document.createElement("a");
    a.href = u; a.download = fileName(); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
  $("snDownload").addEventListener("click", async () => dl(await blob()));
  // draw whenever the page is opened (date refreshed to today)
  const tile = document.querySelector('#whatsappSubNav .navItem[data-subwhatsapp="spongenote"]');
  if (tile) tile.addEventListener("click", () => { $("snDate").value = todayVal(); render(); });
  render();
  window.spongeNoteRender = render;
})();
