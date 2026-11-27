/* Notes (27-Nov-2026): date-wise notes, kept in the signed-in account's own OneDrive (app folder → Moltrix Notes/notes.json)
   and on this device, so phone and PC show the same notes and they open without internet. Everything (or what the search /
   month filter shows) downloads in one go as PDF (Hindi works: pages are drawn like the other reports), Excel or text. */
(function moltrixNotes() {
  "use strict";
  const $ = id => document.getElementById(id);
  const FILE = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/" + encodeURIComponent("Moltrix Notes") + "/notes.json";
  const T = s => (typeof uiT === "function" ? uiT(s) : s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const pad = n => String(n).padStart(2, "0");
  const isoOf = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = () => isoOf(new Date());
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dOf = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const dateLong = iso => { const d = dOf(iso); return DAYS[d.getDay()] + ", " + d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(); };
  const dmy = iso => iso.split("-").reverse().join("-");
  const timeOf = ms => { const d = new Date(ms); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  const who = () => { try { return (typeof accountEmail === "function" && account) ? accountEmail(account) : "local"; } catch (e) { return "local"; } };
  const LS = () => "mzNotes:" + who();

  let notes = [], dirty = false, saveT = 0, syncing = false, editId = "", q = "", month = "", lastSync = 0;

  function load() { try { const v = JSON.parse(localStorage.getItem(LS()) || "[]"); notes = Array.isArray(v) ? v : []; } catch (e) { notes = []; } }
  function keep() { try { localStorage.setItem(LS(), JSON.stringify(notes)); } catch (e) { status("⚠️ " + T("Could not save on this device (storage full?)")); } }
  const live = () => notes.filter(n => !n.del);
  function status(t) { const s = $("ntStatus"); if (s) s.textContent = t; }

  /* ---- OneDrive: one small JSON file; merged note by note (newest change wins), deletions kept as markers ---- */
  async function auth() { const t = await getToken(); if (!t) throw new Error("not signed in"); return { Authorization: "Bearer " + t }; }
  function merge(remote) {
    const by = {}; notes.forEach(n => { by[n.id] = n; });
    (Array.isArray(remote) ? remote : []).forEach(r => { if (!r || !r.id) return; const l = by[r.id]; if (!l || (r.u || 0) > (l.u || 0)) by[r.id] = r; });
    const cut = Date.now() - 90 * 86400000;   // forget deletion markers after 90 days
    notes = Object.values(by).filter(n => !(n.del && (n.u || 0) < cut));
  }
  async function sync() {
    if (syncing) return; syncing = true;
    try {
      const h = await auth();
      const r = await fetch(FILE + ":/content?t=" + Date.now(), { headers: h, cache: "no-store" });
      if (r.ok) merge(await r.json()); else if (r.status !== 404) throw new Error("OneDrive " + r.status);
      keep(); render();
      const w = await fetch(FILE + ":/content", { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, h), body: JSON.stringify(notes) });
      if (!w.ok) throw new Error("OneDrive " + w.status);
      dirty = false; lastSync = Date.now();
      status("☁️ " + T("Saved in OneDrive") + " · " + timeOf(lastSync));
    } catch (e) {
      status((dirty ? "💾 " + T("Saved on this device - will go to OneDrive when online") : "📴 " + T("Showing the notes saved on this device")) + " (" + (e && e.message || e) + ")");
    } finally { syncing = false; }
  }
  function changed() { keep(); dirty = true; status("💾 " + T("Saving...")); render(); clearTimeout(saveT); saveT = setTimeout(sync, 1200); }

  function add(iso, text) {
    text = String(text || "").replace(/\s+$/, ""); if (!text.trim()) return false;
    const now = Date.now();
    notes.push({ id: now.toString(36) + Math.random().toString(36).slice(2, 7), d: iso || today(), x: text.slice(0, 20000), c: now, u: now });
    changed(); return true;
  }

  /* ---- what is shown (search + month) ---- */
  function shown() {
    const ql = q.trim().toLowerCase();
    return live().filter(n => (!month || n.d.slice(0, 7) === month) && (!ql || n.x.toLowerCase().includes(ql) || dmy(n.d).includes(ql) || dateLong(n.d).toLowerCase().includes(ql)))
      .sort((a, b) => b.d.localeCompare(a.d) || b.c - a.c);
  }
  const linkify = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  function render() {
    const box = $("ntList"); if (!box) return;
    const L = shown(), all = live();
    const months = [...new Set(all.map(n => n.d.slice(0, 7)))].sort().reverse();
    const ms = $("ntMonth");
    if (ms) { ms.innerHTML = `<option value="">${esc(T("All months"))} (${all.length})</option>` + months.map(m => { const [y, mo] = m.split("-"); return `<option value="${m}"${m === month ? " selected" : ""}>${MON[+mo - 1]} ${y} (${all.filter(n => n.d.slice(0, 7) === m).length})</option>`; }).join(""); }
    const dl = $("ntDlInfo"); if (dl) dl.textContent = (q || month ? T("Downloads the notes shown") : T("Downloads all notes")) + ": " + L.length;
    if (!all.length) { box.innerHTML = `<div class="ntEmpty">📝 ${esc(T("No notes yet - write the first one above."))}</div>`; return; }
    if (!L.length) { box.innerHTML = `<div class="ntEmpty">🔎 ${esc(T("No note matches the search."))}</div>`; return; }
    let html = "", cur = "";
    L.forEach(n => {
      if (n.d !== cur) { if (cur) html += "</div>"; cur = n.d; const cnt = L.filter(x => x.d === cur).length;
        html += `<div class="ntPage"><div class="ntPageH"><span class="ntPgDay">${esc(T(DAYS[dOf(cur).getDay()]))}</span><span class="ntPgDate" title="${esc(T("Date"))}">${dmy(cur)}</span><span class="ntCnt" title="${cnt} ${esc(T("Notes"))}">${cnt}</span></div>`; }
      if (n.id === editId) {
        html += `<div class="ntNote ntEdit" data-id="${n.id}"><span class="ntTime">${timeOf(n.c)}</span><input type="date" class="ntEdD" value="${n.d}"><textarea class="ntEdX ntRuled" rows="4">${esc(n.x)}</textarea>` +
          `<div class="ntBtns"><button type="button" class="primary" data-act="save">💾 ${esc(T("Save"))}</button><button type="button" class="secondary" data-act="cancel">${esc(T("Cancel"))}</button></div></div>`;
      } else {
        html += `<div class="ntNote" data-id="${n.id}"><span class="ntTime" title="${n.u - n.c > 60000 ? esc(T("edited")) + " " + timeOf(n.u) : ""}">${timeOf(n.c)}${n.u - n.c > 60000 ? "*" : ""}</span>` +
          `<span class="ntAct"><button type="button" data-act="edit" title="${esc(T("Edit"))}">✏️</button><button type="button" data-act="copy" title="${esc(T("Copy"))}">📋</button><button type="button" data-act="del" title="${esc(T("Delete"))}">🗑️</button></span>` +
          `<div class="ntText">${linkify(n.x)}</div></div>`;
      }
    });
    box.innerHTML = html + "</div>";
    const ed = box.querySelector(".ntEdX"); if (ed) { ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); }
  }

  function onListClick(e) {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const card = b.closest(".ntNote"), n = card && notes.find(x => x.id === card.dataset.id); if (!n) return;
    const act = b.dataset.act;
    if (act === "edit") { editId = n.id; render(); }
    else if (act === "cancel") { editId = ""; render(); }
    else if (act === "save") {
      const x = card.querySelector(".ntEdX").value.replace(/\s+$/, ""), d = card.querySelector(".ntEdD").value || n.d;
      if (!x.trim()) { if (!confirm(T("The note is empty. Delete it?"))) return; n.del = 1; n.x = ""; } else { n.x = x.slice(0, 20000); n.d = d; }
      n.u = Date.now(); editId = ""; changed();
    }
    else if (act === "del") { if (!confirm(T("Delete this note?") + "\n\n" + n.x.slice(0, 120))) return; n.del = 1; n.x = ""; n.u = Date.now(); changed(); }
    else if (act === "copy") { try { navigator.clipboard.writeText(n.x).then(() => status("📋 " + T("Copied"))); } catch (x) {} }
  }

  /* ---- downloads ---- */
  const stamp = () => { const L = shown(); if (!L.length) return ""; const a = L[L.length - 1].d, z = L[0].d; return a === z ? dmy(a) : dmy(a) + "_to_" + dmy(z); };
  function dlBlob(blob, name) {
    const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 30000);
  }
  function dlText() {
    const L = shown(); if (!L.length) return status(T("Nothing to download"));
    let out = "MOLTRIX NOTES\n", cur = "";
    L.slice().reverse().forEach(n => { if (n.d !== cur) { cur = n.d; out += "\n" + dmy(cur) + " (" + DAYS[dOf(cur).getDay()] + ")\n" + "-".repeat(30) + "\n"; } out += "[" + timeOf(n.c) + "] " + n.x.replace(/\n/g, "\n        ") + "\n"; });
    dlBlob(new Blob(["﻿" + out.replace(/\n/g, "\r\n")], { type: "text/plain;charset=utf-8" }), "Moltrix_Notes_" + stamp() + ".txt");
  }
  function dlExcel() {
    const L = shown(); if (!L.length) return status(T("Nothing to download"));
    const X = window.XLSX, rows = [["Date", "Day", "Time", "Note"]].concat(L.slice().reverse().map(n => [dmy(n.d), DAYS[dOf(n.d).getDay()], timeOf(n.c), n.x]));
    const ws = X.utils.aoa_to_sheet(rows); ws["!cols"] = [{ wch: 12 }, { wch: 11 }, { wch: 7 }, { wch: 90 }];
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, "Notes"); X.writeFile(wb, "Moltrix_Notes_" + stamp() + ".xlsx");
  }
  // spiral-notebook pages drawn on a canvas (handwriting font Kalam: English + Hindi), one picture per A4 page
  async function dlPdf() {
    const L = shown().slice().reverse(); if (!L.length) return status(T("Nothing to download"));
    status("📄 " + T("Making the PDF..."));
    try { await Promise.all([document.fonts.load("30px Kalam", "Notes"), document.fonts.load("30px Kalam", "नोट्स"), document.fonts.load("bold 30px Kalam", "Date")]); } catch (e) {}
    const W = 1240, H = 1754, TOP = 176, LH = 46, MX = 212, RX = W - 70, HAND = "Kalam, 'Noto Sans Devanagari', 'Nirmala UI', 'Segoe UI', sans-serif";
    const INK = "#1d3a8a", RED = "#d9534f";
    const pages = []; let cv, ctx, row, pageDate = "";
    const yOf = r => TOP + r * LH;                         // baseline area of ruled line r (text sits just above the rule)
    const maxRow = Math.floor((H - 110 - TOP) / LH) - 1;
    const page = d => {
      cv = document.createElement("canvas"); cv.width = W; cv.height = H; ctx = cv.getContext("2d"); pages.push(cv); row = 0; pageDate = d;
      ctx.fillStyle = "#fffdf4"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#a9c6e8"; ctx.lineWidth = 2;           // ruled lines
      for (let y = TOP + LH; y < H - 70; y += LH) { ctx.beginPath(); ctx.moveTo(110, y); ctx.lineTo(W - 40, y); ctx.stroke(); }
      ctx.strokeStyle = "#f19a95"; ctx.lineWidth = 3;           // red margin
      ctx.beginPath(); ctx.moveTo(MX - 22, 0); ctx.lineTo(MX - 22, H); ctx.stroke();
      ctx.strokeStyle = "#f3b6b2"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(110, TOP); ctx.lineTo(W - 40, TOP); ctx.stroke();
      for (let y = 60; y < H - 30; y += 74) {                   // spiral: punched hole + metal ring
        ctx.fillStyle = "#4b5563"; ctx.beginPath(); ctx.arc(78, y, 11, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = "#8b95a3"; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(78, y - 4); ctx.bezierCurveTo(30, y - 22, 4, y - 6, 8, y + 6); ctx.stroke();
        ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(74, y - 7); ctx.bezierCurveTo(32, y - 22, 10, y - 8, 12, y + 2); ctx.stroke();
      }
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#64748b"; ctx.font = "22px " + HAND; ctx.textAlign = "left"; ctx.fillText("Moltrix Notes", MX, TOP - 70);
      ctx.fillStyle = INK; ctx.font = "bold 30px " + HAND; ctx.textAlign = "right";
      ctx.fillText(T("Date") + ": " + dmy(d) + "  (" + T(DAYS[dOf(d).getDay()]) + ")", RX, TOP - 18); ctx.textAlign = "left";
    };
    const wrap = (text, font, maxW) => { ctx.font = font; const out = [];
      String(text).split("\n").forEach(par => { if (!par) { out.push(""); return; } let line = "";
        for (const word of par.split(/(\s+)/)) { const t = line + word; if (ctx.measureText(t).width <= maxW) { line = t; continue; }
          if (line.trim()) { out.push(line.replace(/\s+$/, "")); line = word.replace(/^\s+/, ""); } else line = word;
          while (ctx.measureText(line).width > maxW) { let k = line.length; while (k > 1 && ctx.measureText(line.slice(0, k)).width > maxW) k--; out.push(line.slice(0, k)); line = line.slice(k); } }
        out.push(line.replace(/\s+$/, "")); }); return out; };
    let cur = "";
    for (const n of L) {
      if (n.d !== cur) {                                     // a new date: new page, like a fresh notebook page for the day
        cur = n.d;
        if (!pages.length || row > 0) page(cur);
      }
      const lines = wrap(n.x, "31px " + HAND, RX - MX);
      if (row + Math.min(lines.length, 3) > maxRow) page(cur);
      lines.forEach((ln, k) => {
        if (row > maxRow) page(cur);
        const y = yOf(row + 1) - 9;
        if (k === 0) { ctx.fillStyle = "#94a3b8"; ctx.font = "21px " + HAND; ctx.textAlign = "right"; ctx.fillText(timeOf(n.c), MX - 34, y); ctx.textAlign = "left"; }
        ctx.fillStyle = INK; ctx.font = "31px " + HAND; ctx.fillText(ln, MX, y); row++;
      });
      row++;                                                  // one empty line between notes
    }
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" });
    pages.forEach((c, i) => { if (i) doc.addPage(); const g = c.getContext("2d"); g.fillStyle = "#94a3b8"; g.font = "20px " + HAND; g.textAlign = "center"; g.fillText("— " + (i + 1) + " / " + pages.length + " —", W / 2, H - 40);
      doc.addImage(c.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 210, 297); });
    status("");
    const name = "Moltrix_Notes_" + stamp() + ".pdf";
    if (typeof showPdfPreview === "function") showPdfPreview(doc, name, "Notes"); else doc.save(name);
  }

  /* ---- wiring (once) ---- */
  function wire() {
    const sec = $("section-notes"); if (!sec || sec.dataset.ntWired) return; sec.dataset.ntWired = "1";
    $("ntDate").value = today(); $("ntText").classList.add("ntRuled");
    const save = () => { if (add($("ntDate").value || today(), $("ntText").value)) { $("ntText").value = ""; $("ntText").style.height = ""; q = ""; $("ntSearch").value = ""; } else $("ntText").focus(); };
    $("ntSave").onclick = save;
    $("ntText").addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } });
    $("ntText").addEventListener("input", e => { const t = e.target; t.style.height = "auto"; t.style.height = Math.min(400, t.scrollHeight + 2) + "px"; });
    $("ntToday").onclick = () => { $("ntDate").value = today(); };
    $("ntSearch").addEventListener("input", e => { q = e.target.value; render(); });
    $("ntMonth").addEventListener("change", e => { month = e.target.value; render(); });
    $("ntList").addEventListener("click", onListClick);
    $("ntPdf").onclick = () => dlPdf().catch(e => status("⚠️ PDF: " + (e && e.message || e)));
    $("ntXls").onclick = () => { try { dlExcel(); } catch (e) { status("⚠️ Excel: " + (e && e.message || e)); } };
    $("ntTxt").onclick = dlText;
    window.addEventListener("online", () => { if (dirty) sync(); });
  }
  function open() { wire(); load(); render(); if (Date.now() - lastSync > 20000 || dirty) sync(); }
  document.addEventListener("click", e => { if (e.target.closest && e.target.closest('.navItem[data-section="notes"]')) setTimeout(open, 0); }, true);
  window.mzNotesOpen = open;
  window.mzNotesTest = { add, shown, merge: r => { merge(r); keep(); render(); }, all: () => notes, dlPdf, dlText, dlExcel };
})();
