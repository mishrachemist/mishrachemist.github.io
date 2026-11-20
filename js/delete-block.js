/* ===== Delete Block: the LAST block of ONE sheet, only when its date is the chosen date. Clears exactly the area
   "Create Next Day Block" makes (same rows / columns): values, formulas, colours, borders, merged cells. ===== */
(function deleteBlock() {
  const $ = id => document.getElementById(id);
  if (!$("delBlkBtn")) return;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const t = new Date(); t.setDate(t.getDate() + 1); if (!$("delBlkDate").value) $("delBlkDate").value = iso(t);
  const sh = (wb, name) => `${wb}/worksheets('${encodeURIComponent(String(name).replace(/'/g, "''"))}')`;
  const dmyISO = (d, m, y) => `${y}-${String(+m).padStart(2, "0")}-${String(+d).padStart(2, "0")}`;
  // the last block of a sheet: same detection as the matching "Create Next Day Block" routine
  async function lastBlock(wb, token, choice) {
    if (choice === "prod") {
      const name = $("sheetName").value.trim();
      const m = await graphFetch(`${sh(wb, name)}/range(address='M1:M2000')?$select=text`, token, { noCache: true });
      let top = -1; m.text.forEach((r, i) => { if (/total prod sheet/i.test(r[0] || "")) top = i + 1; });
      if (top < 0) throw new Error("Prod.: no block found ('TOTAL PROD SHEET' in column M).");
      const a = await graphFetch(`${sh(wb, name)}/range(address='A${top + 3}')?$select=values`, token, { noCache: true });
      if (typeof a.values[0][0] !== "number") throw new Error("Prod.: couldn't read the date of the last block.");
      return { label: "Prod.", name, top, n: (await prodHeatsFor(wb, token, name)) + 6, lastCol: XLSX.utils.encode_col(COL.AH), iso: excelSerialToISODate(a.values[0][0]) };
    }
    if (choice === "stripmill") {
      const name = $("stripSheetName").value.trim() || "Strip Mill";
      const a = await graphFetch(`${sh(wb, name)}/range(address='A1:A2000')?$select=values`, token, { noCache: true });
      let row = -1, v = null; a.values.forEach((r, i) => { if (typeof r[0] === "number") { row = i + 1; v = r[0]; } });
      if (row < 0) throw new Error("Strip Mill: no date found.");
      return { label: "Strip Mill", name, top: row - 3, n: (await prodHeatsFor(wb, token)) + 6, lastCol: "U", iso: excelSerialToISODate(v) };
    }
    if (choice === "billetstock") {
      const name = $("stockSheetName").value.trim() || "Billet Stock Format";
      const a = await graphFetch(`${sh(wb, name)}/range(address='A1:A2000')?$select=text`, token, { noCache: true });
      let row = -1, txt = ""; a.text.forEach((r, i) => { if (/as on/i.test(r[0] || "")) { row = i + 1; txt = r[0]; } });
      const m = String(txt).match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
      if (row < 0 || !m) throw new Error("Billet Stock Format: no 'As on' date found.");
      return { label: "Billet Stock Format", name, top: row - 1, n: 32, lastCol: "I", extra: "X:AA", iso: dmyISO(m[1], m[2], m[3]) };
    }
    if (choice === "dailyprodformat") {
      const name = $("rmSheetName").value.trim() || "Daily Prod Format";
      const a = await graphFetch(`${sh(wb, name)}/range(address='A1:A2000')?$select=text`, token, { noCache: true });
      let row = -1, txt = ""; a.text.forEach((r, i) => { if (/date-\d/i.test(r[0] || "")) { row = i + 1; txt = r[0]; } });
      const m = String(txt).match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
      if (row < 0 || !m) throw new Error("Daily Prod Format: no 'DATE-...' found.");
      return { label: "Daily Prod Format", name, top: row, n: 40, lastCol: "I", iso: dmyISO(m[1], m[2], m[3]) };
    }
    if (choice === "dailystock") {
      const name = "Daily Stock";
      const a = await graphFetch(`${sh(wb, name)}/range(address='A1:A2000')?$select=values`, token, { noCache: true });
      let row = -1, v = null; a.values.forEach((r, i) => { if (typeof r[0] === "number" && r[0] > 40000) { row = i + 1; v = r[0]; } });
      if (row < 0) throw new Error("Daily Stock: no date found.");
      return { label: "Daily Stock", name, top: row, n: 18, lastCol: "S", iso: excelSerialToISODate(v) };
    }
    throw new Error("Pick a sheet first.");
  }
  $("delBlkBtn").addEventListener("click", async () => {
    const st = $("status"), btn = $("delBlkBtn"), want = $("delBlkDate").value, choice = $("nextDaySheetSelect").value;
    if (!want) { alert("Pick the block date first."); return; }
    btn.disabled = true; st.className = "wait"; st.textContent = "Finding the block…";
    let token = null, started = false;
    try {
      token = await getTokenFresh(10 * 60000);
      const [y, m] = want.split("-").map(Number);
      const path = await detectFilePathForMonth(token, y, m - 1);
      if (!path) throw new Error(`The Reports file for ${MONTH_ABBR[m - 1]} ${y} was not found.`);
      const wb = await resolveWorkbook(token, path);
      const b = await lastBlock(wb, token, choice);
      const dWant = want.split("-").reverse().join("."), dLast = b.iso.split("-").reverse().join(".");
      if (b.iso !== want) throw new Error(`${b.label}: only the LAST block can be deleted. The last block is ${dLast} (row ${b.top}), not ${dWant}.`);
      const addr = `A${b.top}:${b.lastCol}${b.top + b.n - 1}`;
      // how much typed data (not formulas) is in it - shown before asking
      const blk = await graphFetch(`${sh(wb, b.name)}/range(address='${addr}')?$select=formulas`, token, { noCache: true });
      const typed = blk.formulas.reduce((a, r) => a + r.filter(v => v !== "" && v !== null && !(typeof v === "string" && v.startsWith("="))).length, 0);
      if (!confirm(`Delete the ${b.label} block of ${dWant}?\n\n${path.split("/").pop()} → ${b.name}, rows ${b.top}-${b.top + b.n - 1} (${addr})\nValues, formulas, colours and borders in these rows are removed. ${typed} typed cell(s) (not formulas) are in it.\n\nThis cannot be undone from the app.`)) { st.className = ""; st.textContent = "Not deleted."; return; }
      st.textContent = `Deleting ${b.label} ${dWant}…`;
      await nextDayJobStart(wb, token); started = true;
      try { await graphFetch(`${sh(wb, b.name)}/range(address='${addr}')/unmerge`, token, { method: "POST" }); } catch (e) { /* nothing merged */ }
      await graphFetch(`${sh(wb, b.name)}/range(address='${addr}')/clear`, token, { method: "POST", body: JSON.stringify({ applyTo: "All" }) });
      if (b.extra) {   // Billet Stock Format: the small block X:AA of the same rows
        const [c1, c2] = b.extra.split(":"), a2 = `${c1}${b.top}:${c2}${b.top + b.n - 1}`;
        try { await graphFetch(`${sh(wb, b.name)}/range(address='${a2}')/unmerge`, token, { method: "POST" }); } catch (e) {}
        await graphFetch(`${sh(wb, b.name)}/range(address='${a2}')/clear`, token, { method: "POST", body: JSON.stringify({ applyTo: "All" }) });
      }
      try { if (typeof _colBCache !== "undefined") _colBCache.delete(`${wb}|${b.name}`); } catch (e) {}
      st.className = "ok";
      st.textContent = `🗑️ ${b.label}: block of ${dWant} deleted (rows ${b.top}-${b.top + b.n - 1}). The last block is now the day before. To make it again: Create Next Day Block.`;
      showCompletionPopup(st.textContent);
    } catch (e) {
      st.className = "err"; st.textContent = "Not deleted: " + (e && e.message ? e.message : e);
    } finally {
      btn.disabled = false;
      if (started) await nextDayJobEnd(token);
    }
  });
})();
