/* ===================== CONSUMPTION MESSAGE (RM Report sheet) ===================== */
const CONSUMPTION_SHEET_NAME = "RM Report";
const CONSUMPTION_COLS = { lumps: "AI", fines: "AJ", pellets: "AK", steelMeltingScrap: "AL", magMaterial: "AM", rollingMillScrap: "AN", msScrap: "AO", ciMixScrap: "AP", pigIron: "AQ", overSizeMag: "AR" };

function isConsumptionMessage(msg) {   // words: Get Started → Message Formats
  return wfHas(msg, WA_FMT.cons.ident, true) && !wfHas(msg, WA_FMT.cons.exclude, true);
}

function parseConsumptionMessage(msg) {
  const C = WA_FMT.cons;
  const dateMatch = msg.match(new RegExp("(?:" + wfAlt(C.date) + ")\\s*[:\\-]?\\s*(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{4})", "i"));
  const iso = dateMatch ? `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}` : null;

  const num = re => {
    const m = msg.match(re);
    return m ? parseFloat(m[1]) : null;
  };

  // "<label> = 12.5" (or "-" / ":"), labels from the message format
  const values = {};
  Object.keys(C.mat).forEach(k => { values[k] = num(new RegExp("(?:" + wfAlt(C.mat[k]) + ")\\s*[=\\-:]\\s*([\\d.]+)", "i")); });
  return { iso, values };
}

async function submitConsumptionMessage(msg) {
  const statusEl = document.getElementById("status");
  const manualFilePath = document.getElementById("filePath").value.trim();

  const parsed = parseConsumptionMessage(msg);
  if (!parsed.iso) {
    statusEl.className = "err";
    statusEl.textContent = "Date not found in the Consumption message. Please check the format.";
    return;
  }
  await xlFmtLoad();
  const CS = XL.cons;

  statusEl.className = "wait";
  statusEl.textContent = "Processing consumption entry...";

  try {
    const token = await getToken();

    // Use the message's own Date line to automatically find the right
    // month's file, instead of relying on the manually-set File Location
    // every time. Falls back to the manual File Location if auto-detect
    // can't find a match.
    const [y, m] = parsed.iso.split("-").map(Number);
    statusEl.textContent = `Locating the file for ${MONTH_ABBR[m - 1]} ${y}...`;
    const autoPath = await detectFilePathForMonth(token, y, m - 1);
    let filePath = autoPath || manualFilePath;

    if (!filePath) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't automatically find the file for ${MONTH_ABBR[m - 1]} ${y} - is it on your OneDrive? (Menu → Get Started → Put formats on the Desktop)`;
      return;
    }

    statusEl.textContent = "Processing consumption entry...";
    const wb = await resolveWorkbook(token, filePath);

    // Column A always has the real date filled in - use it to find the
    // matching row (Y is meant to mirror A, but its formula may not always
    // be dragged down to cover newer rows, so A is more reliable).
    const colA = await graphFetch(
      `${xlSheetUrl(wb, CS.sheet)}/range(address='${CS.dateCol}1:${CS.dateCol}2000')?$select=values`,
      token
    );
    let rowIndex = -1;
    for (let i = 0; i < colA.values.length; i++) {
      const v = colA.values[i][0];
      if (typeof v === "number" && excelSerialToISODate(v) === parsed.iso) { rowIndex = i + 1; break; }
    }

    if (rowIndex === -1) {
      statusEl.className = "err";
      statusEl.textContent = `Date ${parsed.iso} not found in column ${CS.dateCol} of "${CS.sheet}".`;
      return;
    }

    let log = "";
    const cells = [];
    for (const key in CONSUMPTION_COLS) {
      const v = parsed.values[key];
      if (v !== null) {
        const col = CS[key] || CONSUMPTION_COLS[key];
        if (col === "-") continue;              // not in this company's format
        cells.push({ addr: `${col}${rowIndex}`, value: v });
        log += `${key} = ${v} (${col}${rowIndex})\n`;
      }
    }
    await patchCells(wb, CS.sheet, cells, token);   // one write for all values

    if (log === "") {
      statusEl.className = "err";
      statusEl.textContent = "No recognizable consumption values found in the message.";
      return;
    }

    statusEl.className = "ok";
    statusEl.textContent = `Consumption (${parsed.iso}) updated:\n${log}`;
    showCompletionPopup(`Consumption (${parsed.iso}) updated:\n${log}`);
    document.getElementById("msgBox").value = "";
    recordDailyStreak();
    recordUpdateCount();
    recordActivity(`Consumption updated for ${parsed.iso}`);

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

// Draws the company logo at the top-left of whichever PDF page is
// currently active. Used on every generated report except the Test
// Certificate, which has its own fixed letterhead layout.
function addLogoHeader(doc) {
  coDrawLogo(doc, 18, 8, 170, 24);   // the company logo from Get Started > Company details (nothing if none was added)
}

// Same logo, stamped on every page of the finished document (not just the
// first) - called right before a report is shown/saved so multi-page
// reports (one page per date, etc.) all carry it, not only page 1.
function stampLogoOnAllPages(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    addLogoHeader(doc);
  }
}

async function updateExcel(msgOverride, opts = {}) {
  const statusEl = document.getElementById("status");
  await xlFmtLoad();   // Get Started → Excel Formats: where the entries go
  const manualFilePath = document.getElementById("filePath").value.trim();
  let sheetName = document.getElementById("sheetName").value.trim() || XL.heat.sheet;
  const H = XL.heat;
  const isBatch = msgOverride !== undefined;
  const msg = isBatch ? msgOverride : document.getElementById("msgBox").value;

  if (!isBatch && isConsumptionMessage(msg)) {
    await submitConsumptionMessage(msg);
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Processing...";

  const parsed = parseMessage(msg);
  if (!parsed.heatKey) {
    statusEl.className = "err";
    statusEl.textContent = parsed.heatIssue || "Heat number not found in the message. Please check it.";
    return { ok: false, error: parsed.heatIssue ? "Heat number not found - " + parsed.heatIssue : "Heat number not found" };
  }

  // Smart validation: only warn when something in the message is actually
  // inconsistent - specifically, when a section states its own "TOTAL
  // PCS=NN" but the individual "Xmtr=Y" lines above it add up to a
  // different number (a real typo/miscount), rather than flagging normal
  // values against an arbitrary threshold.
  const anomalies = [];
  const checkPcsTotal = (label, group, gotFlag, statedTotal) => {
    if (!gotFlag || statedTotal === null) return;
    const actualTotal = [3, 4, 5, 6].reduce((s, i) => s + (group[i] || 0), 0);
    if (actualTotal !== statedTotal) {
      anomalies.push(`${label}: message says TOTAL PCS=${statedTotal}, but the individual billet counts add up to ${actualTotal}`);
    }
  };
  checkPcsTotal("Hot Charging (Feeded Strip Mill)", parsed.hot, parsed.gotHot, parsed.hotTotalStated);
  checkPcsTotal("Bypass 160 (By Pass + Strip Mill Bypass in CCM)", parsed.byp, parsed.gotByp, parsed.bypTotalStated);
  checkPcsTotal("130 X 130 (130x130 bypass in a 160 heat)", parsed.grp130, parsed.got130, parsed.grp130TotalStated);
  checkPcsTotal("Hot Out", parsed.hotout, parsed.gotHotOut, parsed.hotoutTotalStated);
  const chemLimits = { C: 2, MN: 3, SI: 2, S: 0.5, P: 0.5 };
  Object.keys(chemLimits).forEach(key => {
    const v = parsed.chem[key];
    if (typeof v === "number" && v > chemLimits[key]) anomalies.push(`%${key}: ${v} looks unusually high (maybe a decimal point issue?)`);
  });
  if (anomalies.length > 0 && !opts.skipConfirm) {
    const proceed = confirm(`⚠️ These values look unusual - please double check:\n\n${anomalies.join("\n")}\n\nContinue anyway?`);
    if (!proceed) {
      statusEl.className = "err";
      statusEl.textContent = "Update cancelled - please check the values and try again.";
      return { ok: false, error: "Cancelled after anomaly warning" };
    }
  }
  // Batch mode skips the confirm() dialog above (can't block on a popup per
  // heat) - any anomalies are folded into this heat's result log instead,
  // further down, so they're still visible in the batch summary.

  statusEl.className = "wait";
  statusEl.textContent = "Processing...";

  try {
    sessionStorage.setItem("pendingResume", JSON.stringify({ action: "updateExcel", msgBox: msg, filePath: manualFilePath, sheetName, section: document.getElementById("msgSection").value, msgDate: document.getElementById("msgDate").value }));
    const token = await getToken();
    if (!token) return; // page is navigating away for a redirect; will auto-resume on return
    sessionStorage.removeItem("pendingResume");

    // Prefer the explicitly-picked date (most reliable - no risk of a typo
    // or mis-parsed date in the message), then the message's own "Date
    // DD/MM" line, then the heat number's embedded "date.month.serial"
    // (e.g. "8.7.1" = 7 August) as a last resort. Any of these replaces
    // needing to manually update the File Location every month.
    let filePath = manualFilePath;
    let heatMonth = null, year = null, monthNote = "";

    // The heat number itself ("D.M.N") decides the MONTH: the row is looked
    // up by that exact heat number, so it can only exist in that month's
    // file. A picked date or the message's "Date" line only supplies the
    // YEAR (and the month when the heat number has none). This stops a
    // wrong/old "Date=" line in a message (e.g. a copied template) from
    // sending the update to a different month's file.
    const pickedDate = document.getElementById("msgDate").value; // "YYYY-MM-DD" or ""
    const heatParts = parsed.heatKey.split(".");
    const keyMonth = heatParts.length >= 2 ? parseInt(heatParts[1], 10) : NaN;
    let otherMonth = null, otherYear = null, otherSrc = "";
    if (pickedDate) {
      const [py, pm] = pickedDate.split("-").map(Number);
      otherMonth = pm; otherYear = py; otherSrc = "picked date";
    } else if (parsed.dateLine) {
      otherMonth = parsed.dateLine.month; otherYear = parsed.dateLine.year || null; otherSrc = "message Date line";
    }
    if (keyMonth >= 1 && keyMonth <= 12) {
      heatMonth = keyMonth;
      if (otherYear && otherMonth === keyMonth) {
        year = otherYear;
      } else if (otherYear && otherMonth) {
        // Month differs - use that year, but handle a Dec/Jan boundary.
        year = otherYear;
        if (keyMonth === 12 && otherMonth === 1) year -= 1;
        if (keyMonth === 1 && otherMonth === 12) year += 1;
      } else {
        const now = new Date();
        year = now.getFullYear();
        // A heat month "ahead" of the current month almost always means it
        // belongs to last year (you wouldn't be entering future data).
        if (heatMonth > now.getMonth() + 1) year -= 1;
      }
      if (otherMonth && otherMonth !== keyMonth) {
        monthNote = `ℹ️ ${otherSrc} says ${MONTH_ABBR[otherMonth - 1] || "month " + otherMonth}, but heat ${parsed.heatKey} is ${MONTH_ABBR[keyMonth - 1]} - used ${MONTH_ABBR[keyMonth - 1]}'s file\n`;
      }
    } else if (otherMonth) {
      heatMonth = otherMonth;
      year = otherYear || new Date().getFullYear();
    }

    // 2-3 crucibles: the heat goes to its crucible's sheet (Prod. / Prod. B / Prod. C) - the message must say F-A / F-B / F-C
    const crusW = xlCrus();
    if (crusW[0] && !crusW.includes(parsed.furnace)) {
      statusEl.className = "err";
      statusEl.textContent = `Heat ${parsed.heatKey}: write the crucible before the heat no. (${crusW.map(c => "F-" + c).join(" / ")}, e.g. F-${crusW[1]}-${parsed.heatKey}) and send again.`;
      return { ok: false, error: `Heat ${parsed.heatKey}: crucible (${crusW.map(c => "F-" + c).join(" / ")}) not given in the message` };
    }
    if (crusW[0]) sheetName = xlSheetFor(sheetName, parsed.furnace);
    if (heatMonth) {
      statusEl.textContent = `Locating the file for ${MONTH_ABBR[heatMonth - 1]} ${year}...`;
      const autoPath = await detectFilePathForMonth(token, year, heatMonth - 1);
      if (autoPath) {
        filePath = autoPath;
      } else if (!manualFilePath) {
        statusEl.className = "err";
        statusEl.textContent = `Couldn't automatically find the file for ${MONTH_ABBR[heatMonth - 1]} ${year} - is it on your OneDrive? (Menu → Get Started → Put formats on the Desktop)`;
        return { ok: false, error: `Couldn't find the file for ${MONTH_ABBR[heatMonth - 1]} ${year}` };
      }
      // else: auto-detect failed but a manual File Location is set - fall back to it.
    }

    statusEl.textContent = "Processing...";
    const wb = await resolveWorkbook(token, filePath);

    // Read column B to find the heat row - cached per workbook+sheet for
    // the lifetime of the page so a batch of several heats (same file,
    // same sheet) doesn't re-fetch this same ~3000-row column on every
    // single heat, which was the main reason batch submissions felt slow.
    const colBCacheKey = `${wb}|${sheetName}|${H.heatCol}`;
    const loadColB = async () => {
      const colB = await graphFetch(
        `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='${H.heatCol}1:${H.heatCol}3000')?$select=values,text`,
        token, { noCache: true }
      );
      const v = { values: colB.values || [], text: colB.text || [] };
      _colBCache.set(colBCacheKey, v);
      return v;
    };
    let colBData = _colBCache.get(colBCacheKey);
    const fromCache = !!colBData;
    if (!colBData || !colBData.values) colBData = await loadColB();

    // Match the heat number by its numbers, not the exact text, so
    // "01.10.06", "1.10.6 " and "1.10.6" are all the same heat. Also checks
    // the cell's displayed text, in case Excel stored it differently.
    const wantKey = normalizeHeatKey(parsed.heatKey);
    // Two furnaces: the sheet has F-A-5.11.3 and F-B-5.11.3 - the message must say which furnace.
    let bothFurnaces = false;
    const findRow = (d) => {
      const furn = [];
      for (let i = 0; i < d.values.length; i++) {
        const raw = d.values[i] ? d.values[i][0] : "";
        const txt = d.text[i] ? d.text[i][0] : "";
        const k = normalizeHeatKey(raw) || normalizeHeatKey(txt);
        if (!k) continue;
        if (k === wantKey) return i + 1;                                   // one furnace (plain heat no.)
        if (k.endsWith(":" + wantKey)) {
          if (parsed.furnace && k === `${parsed.furnace}:${wantKey}`) return i + 1;
          furn.push(i + 1);
        }
      }
      if (!parsed.furnace && furn.length === 1) return furn[0];
      if (!parsed.furnace && furn.length > 1) bothFurnaces = true;
      return -1;
    };
    let rowIndex = findRow(colBData);
    // Not found in an older cached copy? The sheet may have changed since
    // (e.g. a new day's rows were added) - read column B again once.
    if (rowIndex === -1 && fromCache && !bothFurnaces) rowIndex = findRow(await loadColB());

    if (rowIndex === -1 && bothFurnaces) {
      statusEl.className = "err";
      statusEl.textContent = `Heat ${parsed.heatKey}: the sheet has this heat for both furnaces (F-A and F-B). Write the furnace in the message (e.g. "F-A" or "F-B") and send again.`;
      return { ok: false, error: `Heat ${parsed.heatKey}: furnace (F-A / F-B) not given in the message` };
    }
    if (rowIndex === -1) {
      statusEl.className = "err";
      const fileName = String(filePath || "").split("/").pop();
      statusEl.textContent = `Heat ${parsed.heatKey} not found in the sheet (${fileName}, column ${H.heatCol}).`;
      return { ok: false, error: `Heat ${parsed.heatKey} not found in the sheet (${fileName})` };
    }

    // pieces already in this heat row (from the other message of the same heat) - compared before writing;
    // the entry still goes in (this message's pieces), and a difference is marked on the Total Prod cell
    const diffs = await pcsMismatch(wb, sheetName, rowIndex, parsed, token);

    let log = `Heat ${parsed.furnace ? "F-" + parsed.furnace + "-" : ""}${parsed.heatKey} (row ${rowIndex}) updated:\n`;
    if (parsed.heatFixedFrom) log += `ℹ️ Heat no. auto-corrected from "${parsed.heatFixedFrom}" to ${parsed.heatKey}\n`;
    if (monthNote) log += monthNote;
    const bz = v => (v === 0 ? "" : v);

    const section = (isBatch && parsed.sz) ? String(parsed.sz) : document.getElementById("msgSection").value;
    // All cells of this heat row are collected and written in ONE call (patchCells below).
    const pieces = [];
    const patchRange = async (_wb, _sheet, addr, values) => { pieces.push({ addr, values }); };
    if (H.sectionCol !== "-") {
      await patchRange(wb, sheetName, `${H.sectionCol}${rowIndex}`, [[parseInt(section)]], token);
      log += `Section -> ${section} (${H.sectionCol}${rowIndex})\n`;
    }
    const grp4 = (c) => `${c}${rowIndex}:${xlShift(c, 3)}${rowIndex}`;

    if (parsed.gotHot && H.hot !== "-") {
      await patchRange(wb, sheetName, grp4(H.hot), [[bz(parsed.hot[3]), bz(parsed.hot[4]), bz(parsed.hot[5]), bz(parsed.hot[6])]], token);
      log += `HOT CHARGING -> 3M=${parsed.hot[3]} 4M=${parsed.hot[4]} 5M=${parsed.hot[5]} 6M=${parsed.hot[6]}\n`;
    }
    if (parsed.gotByp && H.bypass !== "-") {
      // BY PASS + STRIP MILL BYPASS of the heat's own size (parseMessage already adds them together)
      await patchRange(wb, sheetName, grp4(H.bypass), [[bz(parsed.byp[3]), bz(parsed.byp[4]), bz(parsed.byp[5]), bz(parsed.byp[6])]], token);
      log += `BYPASS -> 3M=${parsed.byp[3]} 4M=${parsed.byp[4]} 5M=${parsed.byp[5]} 6M=${parsed.byp[6]}\n`;
    }
    if (parsed.got130 && H.b130 !== "-") {
      // 130x130 billets in a 160 heat -> "130 X 130" columns (J:M) of the heat row
      await patchRange(wb, sheetName, grp4(H.b130), [[bz(parsed.grp130[3]), bz(parsed.grp130[4]), bz(parsed.grp130[5]), bz(parsed.grp130[6])]], token);
      log += `130 X 130 -> 3M=${parsed.grp130[3]} 4M=${parsed.grp130[4]} 5M=${parsed.grp130[5]} 6M=${parsed.grp130[6]} (${grp4(H.b130)})\n`;
    }
    if (parsed.gotHotOut && H.hotout !== "-") {
      await patchRange(wb, sheetName, grp4(H.hotout), [[bz(parsed.hotout[3]), bz(parsed.hotout[4]), bz(parsed.hotout[5]), bz(parsed.hotout[6])]], token);
      log += `HOT OUT -> 3M=${parsed.hotout[3]} 4M=${parsed.hotout[4]} 5M=${parsed.hotout[5]} 6M=${parsed.hotout[6]}\n`;
    }

    const chemMap = { C: H.C, MN: H.MN, SI: H.SI, S: H.S, P: H.P };
    let gotChem = false;
    for (const key in chemMap) {
      if (parsed.chem[key] !== null) {
        gotChem = true;
        const col = chemMap[key];
        if (col === "-") continue;
        await patchRange(wb, sheetName, `${col}${rowIndex}:${col}${rowIndex}`, [[bz(parsed.chem[key])]], token);
      }
    }
    await patchCells(wb, sheetName, rowPiecesToCells(pieces), token);
    if (diffs.length) log += await markPcsMismatch(wb, sheetName, rowIndex, parsed.heatKey, diffs, token);
    if (gotChem) {
      log += `Chemical Report -> %C=${fmt(parsed.chem.C)} %Mn=${fmt(parsed.chem.MN)} %Si=${fmt(parsed.chem.SI)} %S=${fmt(parsed.chem.S)} %P=${fmt(parsed.chem.P)}\n`;
    }

    if (!parsed.gotHot && !parsed.gotByp && !parsed.got130 && !parsed.gotHotOut && !gotChem) {
      log += "No data found (format not recognized).\n";
    }
    if (anomalies.length > 0) {
      log += `⚠️ Unusual values (please double check): ${anomalies.join("; ")}\n`;
    }

    statusEl.className = "ok";
    statusEl.textContent = log;
    if (!isBatch) {
      showCompletionPopup(log);
      document.getElementById("msgBox").value = "";
    }
    recordDailyStreak();
    recordUpdateCount();
    recordActivity(`Heat ${parsed.heatKey} updated`);
    return { ok: true, heatKey: parsed.heatKey, log, hadAnomalies: anomalies.length > 0 };

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
    return { ok: false, error: e.message, heatKey: parsed.heatKey };
  }
}

// Pieces already in the heat row (130x130, hot charging, bypass, hot out - columns from Excel Formats) vs this message.
// Only groups the message carries AND that already have a number in the sheet are compared.
async function pcsMismatch(wb, sheetName, rowIndex, parsed, token) {
  const H = XL.heat;
  const groups = [
    { group: "130 X 130", got: parsed.got130, v: parsed.grp130, k: "b130" },
    { group: "Hot Charging", got: parsed.gotHot, v: parsed.hot, k: "hot" },
    { group: "Bypass", got: parsed.gotByp, v: parsed.byp, k: "bypass" },
    { group: "Hot Out", got: parsed.gotHotOut, v: parsed.hotout, k: "hotout" }].filter(g => g.got && H[g.k] !== "-").map(g => Object.assign(g, { c: colLetterToIndex(H[g.k]) }));
  if (!groups.length) return [];
  const c1 = Math.min(...groups.map(g => g.c)), c2 = Math.max(...groups.map(g => g.c)) + 3;
  groups.forEach(g => { g.off = g.c - c1; });
  let row;
  try {
    const r = await graphFetch(`${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='${colLetter(c1)}${rowIndex}:${colLetter(c2)}${rowIndex}')?$select=values`, token, { noCache: true });
    row = (r.values && r.values[0]) || [];
  } catch (e) { return []; }   // could not read: enter as before, without a check
  const n = x => { if (typeof x === "number") return x; const v = parseFloat(String(x == null ? "" : x).trim()); return isNaN(v) ? 0 : v; };
  const out = [];
  groups.forEach(g => {
    const have = [3, 4, 5, 6].map((L, i) => n(row[g.off + i]));
    if (!have.some(Boolean)) return;            // empty in the sheet: this is the first message for this group
    [3, 4, 5, 6].forEach((L, i) => { if (have[i] !== (g.v[L] || 0)) out.push({ group: g.group, len: L, before: have[i], now: g.v[L] || 0 }); });
  });
  return out;
}
// Total Prod cell of the heat row (Excel Formats; AB by default): light-red fill + an Excel comment "MISMATCH ..." listing both messages' pieces
async function markPcsMismatch(wb, sheetName, rowIndex, heatKey, diffs, token) {
  if (XL.heat.total === "-") return "";
  const cell = `${XL.heat.total}${rowIndex}`;
  const sh = `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')`;
  const text = `MISMATCH - heat ${heatKey}: the two messages have different pieces. ` +
    diffs.map(d => `${d.group} ${d.len}M: earlier ${d.before}, latest ${d.now}`).join("; ") + ". The latest message's pieces are entered.";
  let note = `⚠️ MISMATCH with the earlier message: ${diffs.map(d => `${d.group} ${d.len}M ${d.before}→${d.now}`).join(", ")} (latest entered; marked on ${cell})\n`;
  try { await graphFetch(`${sh}/range(address='${cell}')/format/fill`, token, { method: "PATCH", body: JSON.stringify({ color: "#FFC7CE" }) }); }
  catch (e) { note += `(could not colour ${cell}: ${e.message})\n`; }
  try {
    const beta = wb.replace("/v1.0/", "/beta/");
    const addr = `'${String(sheetName).replace(/'/g, "''")}'!${cell}`;
    const r = await fetch(`${beta}/comments`, { method: "POST",
      headers: { Authorization: "Bearer " + (cachedAccessToken || token), "Content-Type": "application/json" },
      body: JSON.stringify({ cellAddress: addr, content: text, contentType: "plain" }) });
    if (!r.ok) throw new Error("HTTP " + r.status);
  } catch (e) { note += `(note on ${cell} could not be added: ${e.message} - the cell is coloured red instead)\n`; }
  return note;
}

function fmt(v) { return v === null ? "-" : v; }

async function patchRange(wb, sheetName, address, values, token) {
  await graphFetch(
    `${wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='${address}')`,
    token,
    { method: "PATCH", body: JSON.stringify({ values }) }
  );
}

// Several cells of one sheet in ONE Excel write instead of one write per cell:
// the smallest rectangle around them is sent, with null for every cell in
// between (null = that cell is left exactly as it is - value and formula).
// If Excel refuses the rectangle (e.g. a merged cell inside it), the cells are
// written one by one as before. cells: [{ addr: "AQ12", value }]
async function patchCells(wb, sheetName, cells, token) {
  if (!cells.length) return;
  const P = cells.map(x => { const m = /^([A-Z]+)(\d+)$/.exec(x.addr); return { c: colLetterToIndex(m[1]), r: +m[2], v: x.value, addr: x.addr }; });
  const r1 = Math.min(...P.map(p => p.r)), r2 = Math.max(...P.map(p => p.r));
  const c1 = Math.min(...P.map(p => p.c)), c2 = Math.max(...P.map(p => p.c));
  const one = async () => { for (const p of P) await patchRange(wb, sheetName, `${p.addr}:${p.addr}`, [[p.v]], token); };
  if (P.length === 1 || (r2 - r1 + 1) * (c2 - c1 + 1) > 3000) return one();
  const grid = [];
  for (let r = r1; r <= r2; r++) grid.push(new Array(c2 - c1 + 1).fill(null));
  P.forEach(p => { grid[p.r - r1][p.c - c1] = p.v; });
  try {
    await patchRange(wb, sheetName, `${colLetter(c1)}${r1}:${colLetter(c2)}${r2}`, grid, token);
  } catch (e) {
    if (/locked|busy|not responding|expired|network|internet/i.test(String(e && e.message))) throw e;
    await one();
  }
}
// Row pieces [{ addr: "P12:S12", values: [[..]] }] -> single cells for patchCells
function rowPiecesToCells(pieces) {
  const out = [];
  pieces.forEach(({ addr, values }) => {
    const m = /^([A-Z]+)(\d+)/.exec(addr);
    const c0 = colLetterToIndex(m[1]), r0 = +m[2];
    values.forEach((row, i) => row.forEach((v, j) => out.push({ addr: `${colLetter(c0 + j)}${r0 + i}`, value: v })));
  });
  return out;
}

document.getElementById("updateBtn").addEventListener("click", () => updateExcel());
document.getElementById("clearBtn").addEventListener("click", () => {
  document.getElementById("msgBox").value = "";
  document.getElementById("status").className = "";
  document.getElementById("status").textContent = "";
});

// Splits a pasted block of several WhatsApp messages into individual
// message bodies. Each WhatsApp export line looks like
// "[8/9, 12:06] Deepak Tiwari MIEPL: <message text>" - that timestamp+name
// prefix marks the start of a new message; everything after it (across
// following lines, until the next such prefix) belongs to that message.
function splitBatchMessages(text) {
  const prefixRe = /^\[\d{1,2}\/\d{1,2}(?:\/\d{2,4})?,\s*\d{1,2}:\d{2}(?:\s?[APap][Mm])?\]\s*[^:]+:\s?/;
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (prefixRe.test(line)) {
      if (current !== null) blocks.push(current.join("\n").trim());
      current = [line.replace(prefixRe, "")];
    } else if (current !== null) {
      current.push(line);
    }
  }
  if (current !== null) blocks.push(current.join("\n").trim());
  return blocks.filter(b => b.length > 0);
}

document.getElementById("batchSubmitBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const rawText = document.getElementById("msgBox").value;
  const messages = splitBatchMessages(rawText);

  if (messages.length === 0) {
    statusEl.className = "err";
    statusEl.textContent = "No WhatsApp-style messages found (each one should start with a line like \"[8/9, 12:06] Name: ...\"). Paste them straight from a WhatsApp export/forward.";
    return;
  }
  if (messages.length === 1) {
    // Nothing to batch - just run the normal single-message flow.
    await updateExcel();
    return;
  }

  const results = [];
  for (let i = 0; i < messages.length; i++) {
    statusEl.className = "wait";
    statusEl.textContent = `Processing heat ${i + 1} of ${messages.length}...`;
    const r = await updateExcel(messages[i], { skipConfirm: true });
    results.push(r || { ok: false, error: "Unknown error" });
  }

  const okCount = results.filter(r => r.ok).length;
  const failCount = results.length - okCount;
  let summary = `Batch complete: ${okCount} of ${results.length} heat(s) saved successfully.\n\n`;
  results.forEach((r, i) => {
    if (r.ok) {
      summary += `✅ Heat ${r.heatKey}${r.hadAnomalies ? " (⚠️ check anomaly note)" : ""}\n`;
    } else {
      summary += `❌ Message ${i + 1}: ${r.error}\n`;
    }
  });

  statusEl.className = failCount === 0 ? "ok" : "err";
  statusEl.textContent = summary;
  showCompletionPopup(summary);
  if (failCount === 0) document.getElementById("msgBox").value = "";
});

/* ===================== WHATSAPP INBOX (MacroDroid -> Apps Script Sheet) ===================== */
// Messages from the 3 WhatsApp groups are saved by MacroDroid into a Google
// Sheet ("Inbox" tab) via the WA_Inbox Apps Script. This fetches only the rows
// after the last processed one and runs each through the normal updateExcel()
// batch path (same parser as manual paste).
function waInboxCfg() {
  return {
    url: localStorage.getItem("waInboxUrl") || "",
    token: localStorage.getItem("waInboxToken") || "",
    lastRow: parseInt(localStorage.getItem("waInboxLastRow") || "0", 10) || 0
  };
}

function waInboxShowInfo() {
  const c = waInboxCfg();
  const el = document.getElementById("waInboxInfo");
  if (!el) return;
  if (!c.url) { el.textContent = "WhatsApp Inbox not set up yet - tap ⚙️ Inbox Settings."; return; }
  const note = localStorage.getItem("waInboxLastNote") || "";
  const at = parseInt(localStorage.getItem("waInboxLastAt") || "0", 10) || 0;
  const dev = localStorage.getItem("waInboxLastDevice") || "";
  let last = "";
  if (note && at) {
    const d = new Date(at);
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const sameDay = d.toDateString() === new Date().toDateString();
    const when = sameDay ? time : `${d.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]} ${time}`;
    last = ` · ${note} ${when}` + (dev ? ` (${dev})` : "");
  }
  let retry = 0;
  try { retry = (JSON.parse(localStorage.getItem("waInboxRetry") || "[]") || []).length; } catch (e) {}
  el.textContent = `WhatsApp Inbox: last processed row = ${c.lastRow}` + last +
    (retry ? ` · 🔁 ${retry} pending retry` : "") + (waSyncEnabled() ? " · ☁️ synced" : "");
}

function waInboxEditSettings() {
  const c = waInboxCfg();
  const url = prompt("Apps Script Web app URL (ending in /exec):", c.url);
  if (url === null) return;
  const token = prompt("Secret TOKEN (same as in the Apps Script):", c.token);
  if (token === null) return;
  const last = prompt("Last processed row (0 = fetch everything again):", String(c.lastRow));
  if (last === null) return;
  localStorage.setItem("waInboxUrl", url.trim());
  localStorage.setItem("waInboxToken", token.trim());
  localStorage.setItem("waInboxLastRow", String(parseInt(last, 10) || 0));
  localStorage.removeItem("waInboxAutoMin");
  waStateTouch();
  waInboxShowInfo();
  waCloudPush();
}

let waInboxBusy = false;
let waAutoRun = false;   // true while the scheduled (fixed-time) auto-fetch is running (quiet mode: no pop-up)

// Retry queue: messages that failed for a reason that may clear up later
// (Excel file open/locked on PC, network, heat row / file not created yet).
// They are retried on every fetch until they succeed, or dropped after
// WA_RETRY_MAX_DAYS. Writes are fixed-cell overwrites, so a retry is safe.
const WA_RETRY_MAX_DAYS = 3;
function waRetryLoad() {
  try { return JSON.parse(localStorage.getItem("waInboxRetry") || "[]") || []; }
  catch (e) { return []; }
}
function waRetrySave(list) { localStorage.setItem("waInboxRetry", JSON.stringify(list)); waStateTouch(); }

/* ===================== WHATSAPP INBOX STATE - OneDrive sync (primary account) ===================== */
// For the primary login (the FIRST owner account in the access script) the WhatsApp Inbox
// state is also kept in OneDrive (Apps folder -> wa_inbox_state.json), so every
// device signed in with that account shows the same last-fetch status and
// continues from the same last processed row (no re-processing of old rows).
// Rule: whichever copy (this device / OneDrive) was changed last wins.
const WA_STATE_FILE_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/wa_inbox_state.json:/content";
const WA_SYNC_KEYS = ["waInboxUrl", "waInboxToken", "waInboxLastRow", "waLastHeat", "waInboxRetry",
  "rhfPartyApplied2", "waInboxLastNote", "waInboxLastAt", "waInboxLastDevice", "waSlots", "waCloudOff"];
function waSyncEnabled() { return !!account && accountRole(account) === "owner" && ALLOWED_EMAILS.length > 0 && accountEmail(account) === ALLOWED_EMAILS[0]; }
function waStateTouch() { try { localStorage.setItem("waStateTs", String(Date.now())); } catch (e) {} }
function waDeviceLabel() {
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone/iPad";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Macintosh|Mac OS/i.test(ua)) return "Mac";
  return "Browser";
}
function waStateSnapshot() {
  const keys = {};
  WA_SYNC_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null) keys[k] = v; });
  return { updatedAt: parseInt(localStorage.getItem("waStateTs") || "0", 10) || 0, device: waDeviceLabel(), keys };
}
let waCloudBusy = null, waCloudLastPull = 0;
async function waCloudPush() {
  if (!waSyncEnabled()) return;
  try {
    const token = await getToken(); if (!token) return;
    const snap = waStateSnapshot();
    if (!snap.updatedAt) { waStateTouch(); snap.updatedAt = parseInt(localStorage.getItem("waStateTs"), 10); }
    const r = await fetch(WA_STATE_FILE_URL, { method: "PUT",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(snap) });
    if (!r.ok) console.warn("WA state upload failed", r.status);
  } catch (e) { console.warn("WA state upload failed", e); }
}
// Returns "pulled" (OneDrive copy applied here), "pushed" (this device was newer),
// "same", "off" or "error".
function waCloudPull() {
  if (!waSyncEnabled()) return Promise.resolve("off");
  if (waCloudBusy) return waCloudBusy;
  waCloudBusy = (async () => {
    try {
      const token = await getToken(); if (!token) return "error";
      const r = await fetch(WA_STATE_FILE_URL + "?t=" + Date.now(), { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      const localTs = parseInt(localStorage.getItem("waStateTs") || "0", 10) || 0;
      if (r.status === 404) {   // first time: upload what this device has
        if (localStorage.getItem("waInboxUrl")) { await waCloudPush(); return "pushed"; }
        return "same";
      }
      if (!r.ok) return "error";
      const cloud = await r.json();
      const cloudTs = Number(cloud && cloud.updatedAt) || 0;
      if (cloudTs > localTs && cloud.keys) {
        WA_SYNC_KEYS.forEach(k => {
          if (k in cloud.keys) localStorage.setItem(k, cloud.keys[k]);
          else localStorage.removeItem(k);
        });
        localStorage.setItem("waStateTs", String(cloudTs));
        return "pulled";
      }
      if (localTs > cloudTs) { await waCloudPush(); return "pushed"; }
      return "same";
    } catch (e) { console.warn("WA state download failed", e); return "error"; }
    finally { waCloudLastPull = Date.now(); waCloudBusy = null; waInboxShowInfo(); updateNavSubs(); }
  })();
  return waCloudBusy;
}
// Remember the result of the latest fetch (shown under the Fetch button, synced).
function waInboxSetLast(note) {
  localStorage.setItem("waInboxLastNote", note);
  localStorage.setItem("waInboxLastAt", String(Date.now()));
  localStorage.setItem("waInboxLastDevice", waDeviceLabel());
  waStateTouch();
  if (typeof updateNavSubs === "function") updateNavSubs();
}
// App brought back to the screen -> refresh the status from OneDrive (max once a minute).
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && account && !waInboxBusy && Date.now() - waCloudLastPull > 60000) waCloudPull();
});
/* ===================== "Billets Transferred - SMS TO RHF" messages (SMS-QAD MIPPL group) ===================== */
// MIPPL / no party  -> Prod. sheet RHF cells of that date (same cells as RHF Billets Entry;
//                      a later message for the same date = full total, so it overwrites)
// other party        -> 'Billet Stock Format' column E of that party + size row: "-pcs" is
//                      appended to the formula (only the difference vs. what was already
//                      taken off for that date, so a Day shift + Day+night pair is not doubled)
const RHF_PARTY_ALIAS = { "ari": "AR ISPAT", "ma shiva": "MASHIVA", "mashiva": "MASHIVA",
  "maha siva": "MASHIVA", "maha shiva": "MASHIVA", "mahasiva": "MASHIVA", "mahashiva": "MASHIVA", "ma siva": "MASHIVA",
  "shyam metal": "SHYAM", "shyam metals": "SHYAM", "shyam": "SHYAM" };
// Party name in a message vs. column B of Billet Stock Format: exact, alias, or one name starting with the
// other (e.g. "SHYAM METAL" -> "SHYAM"); spaces / dots ignored.
// alias lookup ignoring spaces / dots / case: "A R I", "A.R.I", "ari" -> AR ISPAT
function partyAlias(name) {
  const k = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return null;
  for (const a in RHF_PARTY_ALIAS) if (a.replace(/[^a-z]/g, "") === k) return RHF_PARTY_ALIAS[a];
  return null;
}
function partyNameMatch(sheetName, wanted) {
  const n = (x) => String(x || "").toUpperCase().replace(/[^A-Z]/g, "");
  const a = n(sheetName), b = n(wanted);
  if (!a || !b) return false;
  if (a === b) return true;
  const al = partyAlias(wanted);
  if (al && n(al) === a) return true;
  return a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a));
}
function isRhfTransferMessage(text) {   // words: Get Started → Message Formats
  return wfAll(text, WA_FMT.rhf.ident);
}
function parseRhfTransferMessage(text) {
  const dm = /\b(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})\b/.exec(text);
  if (!dm) return { error: "RHF transfer: date (dd.mm.yyyy) not found" };
  const y = +dm[3] < 100 ? 2000 + +dm[3] : +dm[3];
  const dateISO = `${y}-${String(+dm[2]).padStart(2, "0")}-${String(+dm[1]).padStart(2, "0")}`;
  const own = { 130: { 3: 0, 4: 0, 5: 0, 6: 0 }, 160: { 3: 0, 4: 0, 5: 0, 6: 0 } };
  const ownSizes = new Set();
  const party = {}; // "MASHIVA|160" -> pcs
  const bad = [];
  const re = /(\d+)\s*pcs?\s*(\d{3})\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*m(?:tr|eter)?\b\s*(?:\(([^)]*)\))?/gi;
  let m, lines = 0;
  while ((m = re.exec(text))) {
    lines++;
    const pcs = +m[1], size = m[2], len = Math.round(+m[3]);
    const p = String(m[4] || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!p || WA_FMT.rhf.own.some(t => { t = String(t).trim().toLowerCase(); return !!t && p.includes(t); })) {
      if (!own[size] || !(len in own[size])) { bad.push(`${pcs} pcs ${size}×${m[3]}m (only 130/160 and 3-6 m go to the logsheet)`); continue; }
      own[size][len] += pcs; ownSizes.add(size);
    } else {
      const name = partyAlias(p) || p.toUpperCase();
      party[`${name}|${size}`] = (party[`${name}|${size}`] || 0) + pcs;
    }
  }
  if (!lines) return { error: "RHF transfer: no 'pcs size×length' line found" };
  return { dateISO, own, ownSizes: [...ownSizes], party, bad };
}
async function submitRhfTransferMessage(text) {
  const P = parseRhfTransferMessage(text);
  if (P.error) return { ok: false, error: P.error };
  const token = await getToken();
  const [py, pm] = P.dateISO.split("-").map(Number);
  const path = await detectFilePathForMonth(token, py, pm - 1);
  if (!path) return { ok: false, error: `RHF transfer: file for ${MONTH_ABBR[pm - 1]} ${py} not found` };
  const wb = await resolveWorkbook(token, path);
  await xlFmtLoad();
  const R = XL.rhf;
  const log = [];
  // 1. own billets -> Prod. RHF cells (Excel Formats: sheet, date column, rows below the date row)
  if (P.ownSizes.length && R.col === "-") log.push("RHF (own billets): not in this Excel format - skipped");
  if (P.ownSizes.length && R.col !== "-") {
    const sheet = R.sheet;
    const colA = (await graphFetch(`${xlSheetUrl(wb, sheet)}/range(address='${R.dateCol}1:${R.dateCol}600')?$select=values`, token)).values;
    let dataStart = -1;
    for (let i = 0; i < colA.length; i++) {
      const v = colA[i][0];
      if (typeof v === "number" && excelSerialToISODate(v) === P.dateISO) { dataStart = i + 1; break; }
    }
    if (dataStart === -1) return { ok: false, error: `RHF transfer: ${sheet} block for ${P.dateISO} not found (create the day's block first)` };
    for (const size of P.ownSizes) {
      const r = dataStart + (size === "130" ? R.row130 : R.row160);
      const v = P.own[size];
      const addr = `${R.col}${r}:${xlShift(R.col, 3)}${r}`;
      await patchRange(wb, sheet, addr, [[v[3], v[4], v[5], v[6]]], token);
      log.push(`RHF ${size}: 3M ${v[3]} · 4M ${v[4]} · 5M ${v[5]} · 6M ${v[6]} (${addr})`);
    }
  }
  // 2. other parties -> Billet Stock Format column E
  const keys = Object.keys(P.party);
  if (keys.length && R.pQtyCol === "-") log.push("RHF (party billets): not in this Excel format - skipped");
  if (keys.length && R.pQtyCol !== "-") {
    const sheet = R.pSheet;
    // The sheet has one block per day (title, then "As on dd.mm.yyyy" in col A
    // of the next row); take the block of the message date.
    const ci = { a: colLetterToIndex(R.pAsOnCol), p: colLetterToIndex(R.pPartyCol), s: colLetterToIndex(R.pSizeCol), q: colLetterToIndex(R.pQtyCol) };
    const cMax = Math.max(ci.a, ci.p, ci.s, ci.q);
    const rng = await graphFetch(`${xlSheetUrl(wb, sheet)}/range(address='A1:${colLetter(cMax)}1100')?$select=values,formulas`, token);
    const [yy, mm, dd] = P.dateISO.split("-");
    const asOn = `${dd}.${mm}.${yy}`;
    const asRow = rng.values.findIndex(r => String(r[ci.a] || "").replace(/\s+/g, " ").includes("As on " + asOn));
    if (asRow < 0) return { ok: false, error: `RHF transfer: ${sheet} block "As on ${asOn}" not found` };
    let applied = {};
    try { applied = JSON.parse(localStorage.getItem("rhfPartyApplied2") || "{}") || {}; } catch (e) { applied = {}; }
    const normName = (s) => String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
    for (const k of keys) {
      const [name, size] = k.split("|");
      const want = P.party[k];
      const doneKey = `${P.dateISO}|${name}|${size}`;
      const delta = want - (applied[doneKey] || 0);
      if (!delta) { log.push(`${name} ${size}: ${want} pcs already taken off`); continue; }
      let row = -1;
      for (let i = asRow + 1; i < Math.min(rng.values.length, asRow + 40); i++) {
        if (/^total$/i.test(String(rng.values[i][ci.a] || "").trim())) break;
        if (partyNameMatch(rng.values[i][ci.p], name) && String(rng.values[i][ci.s] || "").replace(/\s/g, "").startsWith(size)) { row = i; break; }
      }
      if (row < 0) { log.push(`⚠️ ${name} ${size}: row not found in ${sheet} (${asOn}) - ${want} pcs NOT taken off`); continue; }
      const f = rng.formulas[row][ci.q];
      const base = (typeof f === "string" && f.startsWith("=")) ? f : "=" + (f === "" || f == null ? 0 : f);
      const nf = base + (delta > 0 ? `-${delta}` : `+${-delta}`);
      await graphFetch(`${xlSheetUrl(wb, sheet)}/range(address='${R.pQtyCol}${row + 1}')`, token,
        { method: "PATCH", body: JSON.stringify({ formulas: [[nf]] }) });
      applied[doneKey] = want;
      localStorage.setItem("rhfPartyApplied2", JSON.stringify(applied));
      waStateTouch();
      log.push(`${name} ${size}: ${delta > 0 ? "-" + delta : "+" + (-delta)} pcs in ${R.pQtyCol}${row + 1}`);
    }
  }
  P.bad.forEach(b => log.push("⚠️ " + b));
  return { ok: true, note: `RHF transfer ${P.dateISO}: ` + log.join("; ") };
}

function waIsPermanentError(err) {
  return /Heat number not found|Cancelled after anomaly|No recognizable consumption|RHF transfer: (date|no )|crucible \(F-/i.test(String(err || ""));
}

async function waInboxFetch() {
  if (waInboxBusy) {
    alert("WhatsApp fetch is already running - please wait.");
    return;
  }
  await waFmtLoad();   // the message format words (Get Started → Message Formats) before reading any message
  await xlFmtLoad();   // where the entries go (Get Started → Excel Formats)
  const statusEl = document.getElementById("status");
  // Another device may have fetched meanwhile - take the latest row / status from OneDrive first.
  if (waSyncEnabled()) {
    waInboxBusy = true;   // block a second tap while checking
    statusEl.className = "wait";
    statusEl.textContent = "Checking last WhatsApp update status...";
    try { await waCloudPull(); } finally { waInboxBusy = false; }
  }
  let c = waInboxCfg();
  if (!c.url || !c.token) {
    waInboxEditSettings();
    c = waInboxCfg();
    if (!c.url || !c.token) return;
  }

  waInboxBusy = true;
  const stamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  try {
    statusEl.className = "wait";
    statusEl.textContent = "Fetching new WhatsApp messages...";

    let data;
    try {
      const res = await fetch(`${c.url}?token=${encodeURIComponent(c.token)}&after=${c.lastRow}`);
      data = await res.json();
    } catch (e) {
      const msg = "Could not reach the WhatsApp Inbox sheet: " + e.message;
      statusEl.className = "err"; statusEl.textContent = msg; return;
    }
    if (!data || !data.ok) {
      const msg = "WhatsApp Inbox error: " + ((data && data.error) || "unknown") + " (check URL/TOKEN in ⚙️ Inbox Settings)";
      statusEl.className = "err"; statusEl.textContent = msg; return;
    }

    // New messages from the sheet + earlier failures waiting for a retry.
    const fresh = (data.messages || []).map(m => ({ ...m, isRetry: false }));
    const freshRows = new Set(fresh.map(m => Number(m.row)));
    let retryList = waRetryLoad();
    const retries = retryList
      .filter(q => !freshRows.has(Number(q.row)))
      .map(q => ({ ...q, isRetry: true }));
    const msgs = fresh.concat(retries).sort((a, b) => a.row - b.row);

    if (msgs.length === 0) {
      waInboxSetLast("checked, nothing new");
      waInboxShowInfo();
      statusEl.className = "ok";
      statusEl.textContent = "No new WhatsApp messages since row " + c.lastRow + ".";
      return;
    }

    // Sign-in check BEFORE the loop, so a login redirect can't interrupt
    // the batch halfway.
    const tok = await getToken();
    if (!tok) return;

    // A date picked in the "Select date" box would override every message's
    // own heat date - clear it during the fetch and restore afterwards.
    const dateBox = document.getElementById("msgDate");
    const savedDate = dateBox.value;
    dateBox.value = "";
    const boxEl = document.getElementById("msgBox");

    const results = [];
    let maxRow = c.lastRow;
    const setRetry = (m, err) => {
      retryList = retryList.filter(q => Number(q.row) !== Number(m.row));
      if (err === null) return "cleared";
      const firstFail = m.isRetry && m.firstFail ? m.firstFail : Date.now();
      if (Date.now() - firstFail > WA_RETRY_MAX_DAYS * 86400000) return "gaveup";
      retryList.push({ row: m.row, group: m.group, sender: m.sender, text: m.text, receivedAt: m.receivedAt, firstFail, lastError: err });
      return "queued";
    };

    try {
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        const text = String(m.text || "");
        const label = `Row ${m.row} (${m.group} - ${m.sender})${m.isRetry ? " [retry]" : ""}`;
        statusEl.className = "wait";
        statusEl.textContent = `Processing WhatsApp message ${i + 1} of ${msgs.length}...`;

        let res;
        const rt = m.receivedAt ? new Date(m.receivedAt) : null;
        heatDateHint = rt && !isNaN(rt) ? { date: rt, exact: false, received: true } : null;
        const pre = parseMessage(text);
        // "Power consumption" (KWH/KVAH) messages are not raw-material
        // consumption - let them fall through to the skip branch.
        if (isRhfTransferMessage(text)) {
          // Only the Day+night message is used: the one received after the
          // midnight that ends its date (e.g. 09.10 data arriving 10/10 08:05).
          // The same-day "Day shift" message (e.g. 10.10 at 20:04) is ignored.
          const P0 = parseRhfTransferMessage(text);
          const rtISO = rt && !isNaN(rt) ? localDateToISO(rt) : null;
          if (!P0.error && rtISO && rtISO <= P0.dateISO) {
            res = { label, kind: "skip", isRetry: m.isRetry, note: "RHF day-shift message (before midnight)" };
          } else {
            let rr;
            try { rr = await submitRhfTransferMessage(text); } catch (e) { rr = { ok: false, error: "RHF transfer: " + e.message }; }
            res = rr.ok ? { label, kind: "rhf", isRetry: m.isRetry, note: rr.note } : { label, kind: "fail", isRetry: m.isRetry, r: { error: rr.error } };
          }
        } else if (isConsumptionMessage(text)) {   // ("Power consumption" KWH messages are left out by the format's exclude words)
          // submitConsumptionMessage() returns nothing and clears the paste
          // box on success - read its result from the status line instead,
          // and keep whatever the user had typed in the box.
          const savedBox = boxEl.value;
          await submitConsumptionMessage(text);
          boxEl.value = savedBox;
          res = statusEl.className === "ok"
            ? { label, kind: "consumption", isRetry: m.isRetry }
            : { label, kind: "fail", isRetry: m.isRetry, r: { error: "Consumption: " + statusEl.textContent } };
        } else if (!pre.heatKey && pre.heatIssue) {
          res = { label, kind: "fail", isRetry: m.isRetry, r: { error: "Heat number not found - " + pre.heatIssue } };
        } else if (!pre.heatKey) {
          res = { label, kind: "skip", isRetry: m.isRetry, note: text.split(/\r?\n/)[0].slice(0, 40) };
        } else {
          const r = await updateExcel(text, { skipConfirm: true });
          res = { label, kind: r && r.ok ? "ok" : "fail", isRetry: m.isRetry, r: r || { error: "Unknown error" }, fixedFrom: pre.heatFixedFrom };
        }
        heatDateHint = null;
        // Remember the latest heat number seen (for the sequence rule).
        if (pre.heatKey && rt && !isNaN(rt)) {
          const [hd, hm, hn] = pre.heatKey.split(".").map(Number);
          let last = null;
          try { last = JSON.parse(localStorage.getItem("waLastHeat") || "null"); } catch (e) {}
          if (hd && hm && hn && (!last || rt.getTime() >= last.t)) {
            let hy = rt.getFullYear();
            if (hm === 12 && rt.getMonth() === 0) hy -= 1;
            localStorage.setItem("waLastHeat", JSON.stringify({ d: hd, m: hm, y: hy, n: hn, t: rt.getTime() }));
            waStateTouch();
          }
        }

        if (res.kind === "fail" && !waIsPermanentError(res.r.error)) {
          res.retry = setRetry(m, res.r.error);   // "queued" or "gaveup"
        } else {
          setRetry(m, null);
        }
        results.push(res);

        if (!m.isRetry) {
          maxRow = Math.max(maxRow, Number(m.row) || 0);
          localStorage.setItem("waInboxLastRow", String(maxRow));
          waStateTouch();
        }
        waRetrySave(retryList);
      }
    } finally {
      dateBox.value = savedDate;
      heatDateHint = null;
    }

    const okN = results.filter(x => x.kind === "ok").length;
    const failN = results.filter(x => x.kind === "fail").length;
    const skipN = results.filter(x => x.kind === "skip").length;
    const consN = results.filter(x => x.kind === "consumption").length;
    const rhfN = results.filter(x => x.kind === "rhf").length;
    let summary = `WhatsApp fetch: ${okN} saved` + (failN ? `, ${failN} failed` : "") + (skipN ? ` (${skipN} other message(s) ignored)` : "") +
      (consN ? `, ${consN} consumption` : "") + (rhfN ? `, ${rhfN} RHF transfer` : "") + "\n";
    if (results.some(x => x.kind === "fail" && /locked/.test(shortError(x.r.error))))
      summary += `⚠️ Excel file is open on the PC - close it, then press Fetch again.\n`;
    if (retryList.length) summary += `🔁 ${retryList.length} message(s) will be retried on the next Fetch.\n`;
    summary += "\n";
    results.forEach(x => {
      if (x.kind === "ok") summary += `✅ ${x.label}: Heat ${x.r.heatKey}${x.fixedFrom ? ` (ℹ️ corrected from "${x.fixedFrom}")` : ""}${x.r.hadAnomalies ? " (⚠️ check anomaly note)" : ""}\n`;
      else if (x.kind === "fail") {
        const tag = x.retry === "queued" ? " → 🔁 will retry" : x.retry === "gaveup" ? ` → gave up after ${WA_RETRY_MAX_DAYS} days` : "";
        summary += `❌ ${x.label}: ${shortError(x.r.error)}${tag}\n`;
      }
      else if (x.kind === "consumption") summary += `🧾 ${x.label}: consumption message submitted\n`;
      else if (x.kind === "rhf") summary += `🧱 ${x.label}: ${x.note}\n`;
      // Skipped messages (photo captions, power consumption, chat, etc.)
      // are not listed - only their count in the first line.
    });

    statusEl.className = failN === 0 ? "ok" : "err";
    statusEl.textContent = summary;
    waInboxSetLast(`fetched ${okN} saved` + (failN ? `, ${failN} failed` : ""));
    waInboxShowInfo();
    if (waAutoRun) addNotification("Auto-fetch: " + summary.split("\n")[0], failN ? "⚠️" : "📥");   // quiet: no pop-up while you work
    else showCompletionPopup(summary);
  } finally {
    waInboxBusy = false;
    waCloudPush();   // save the new row / status to OneDrive for the other devices
  }
}

document.getElementById("waFetchBtn").addEventListener("click", () => waInboxFetch());
document.getElementById("waInboxSettingsBtn").addEventListener("click", waInboxEditSettings);
waInboxShowInfo();

/* ===================== AUTO-FETCH (fixed times only; also via MacroDroid when the app is closed) ===================== */
// While the app is open (also in the background) every minute it checks "has a fixed time passed since the last fetch?"
// and, if so, runs the normal Fetch quietly (no pop-up, result goes to the bell list). It waits while you are typing,
// and never starts a sign-in redirect by itself. (The old "every 2 hours" auto-fetch was removed on request.)
const WA_AUTO_RETRY_MS = 15 * 60 * 1000;
function waAutoLastTry() { try { return parseInt(localStorage.getItem("waAutoLastTry") || "0", 10) || 0; } catch (e) { return 0; } }
function waAutoLastAt() { try { return parseInt(localStorage.getItem("waInboxLastAt") || "0", 10) || 0; } catch (e) { return 0; } }
/* ----- Scheduled sync at fixed times (default: every hour) -----
   The cloud (GitHub workflow "Moltrix WhatsApp sync") fetches after each time even when every device is off.
   While the app is open (any device): at each time the normal Fetch runs quietly, unless any device or the cloud
   already fetched after that time (last-fetch time is shared through OneDrive).
   The old link  <app>/?autofetch=1  still makes the app fetch straight away. */
const WA_SLOTS_DEFAULT = "every hour", WA_SLOTS_OLD = ["20:00, 06:00, 11:00", "04:00, 12:00"];   // old saved defaults -> new default
const AUTO_SYNC_KEY = "autoSyncPending", AUTO_SYNC_MAX_MS = 20 * 60 * 1000;
function waSlotOn() { try { return localStorage.getItem("waSlotOn") !== "0"; } catch (e) { return true; } }
function waSlotParse(txt) {   // "20:00, 6, 11:30" -> [[20,0],[6,0],[11,30]] (sorted, no duplicates); null if any part is wrong
  if (/^\s*(every\s*hour|hourly)\s*$/i.test(String(txt || ""))) return Array.from({ length: 24 }, (_, h) => [h, 0]);
  const out = [];
  for (const part of String(txt || "").split(/[,;\s]+/).filter(Boolean)) {
    const m = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(part);
    if (!m || +m[1] > 23 || +(m[2] || 0) > 59) return null;
    const v = [+m[1], +(m[2] || 0)];
    if (!out.some(x => x[0] === v[0] && x[1] === v[1])) out.push(v);
  }
  return out.sort((a, b) => a[0] * 60 + a[1] - (b[0] * 60 + b[1]));
}
function waSlotList() {
  let t = WA_SLOTS_DEFAULT; try { t = localStorage.getItem("waSlots") || WA_SLOTS_DEFAULT; } catch (e) {}
  const key = x => (waSlotParse(x) || []).map(waSlotFmt).join(",");
  if (WA_SLOTS_OLD.some(o => key(t) === key(o))) t = WA_SLOTS_DEFAULT;
  return waSlotParse(t) || waSlotParse(WA_SLOTS_DEFAULT);
}
const waSlotFmt = (v) => String(v[0]).padStart(2, "0") + ":" + String(v[1]).padStart(2, "0");
const waSlotText = (list) => list.length === 24 && list.every((v, i) => v[0] === i && v[1] === 0) ? "every hour" : list.map(waSlotFmt).join(", ");
function waLastSlotTime(now) {   // the latest fixed time that has already passed (within the last 24 h)
  now = now || Date.now(); let best = 0;
  waSlotList().forEach(v => { const d = new Date(now); d.setHours(v[0], v[1], 0, 0); let t = d.getTime(); if (t > now) t -= 86400000; if (t > best) best = t; });
  return best;
}
function waNextSlotTime(now) {
  now = now || Date.now(); let best = Infinity;
  waSlotList().forEach(v => { const d = new Date(now); d.setHours(v[0], v[1], 0, 0); let t = d.getTime(); if (t <= now) t += 86400000; if (t < best) best = t; });
  return best;
}
// ☁️ Cloud auto sync ON/OFF (24-Nov-2026): "waCloudOff" = "1" travels to OneDrive with the WhatsApp state
// (wa_inbox_state.json); the cloud sync (GitHub workflow) reads it and does not fetch while it is OFF
function waCloudOn() { try { return localStorage.getItem("waCloudOff") !== "1"; } catch (e) { return true; } }
function waCloudShowInfo() {
  const cb = document.getElementById("waCloudToggle"), el = document.getElementById("waCloudInfo");
  if (cb) { cb.checked = waCloudOn(); cb.disabled = !waSyncEnabled(); }
  if (!el) return;
  if (!waSyncEnabled()) { el.textContent = uiT("Only for the main owner account."); return; }
  el.textContent = uiT(waCloudOn() ? "ON - messages in the WhatsApp Inbox go to Excel even when the app is closed and the PC is off. The phone must be on: MacroDroid puts the messages in the Inbox."
    : "OFF - only 📥 Fetch WhatsApp in the app saves the messages.");
}
function waSlotShowInfo() {
  waCloudShowInfo();
  const cb = document.getElementById("waSlotToggle"), inp = document.getElementById("waSlotTimes"),
        el = document.getElementById("waSlotInfo"), link = document.getElementById("waSlotLink");
  if (cb) cb.checked = waSlotOn();
  if (inp && document.activeElement !== inp) inp.value = waSlotText(waSlotList());
  if (link) link.value = location.origin + location.pathname + "?autofetch=1";
  if (!el) return;
  if (!waSlotOn()) { el.textContent = uiT("Scheduled sync is off on this device."); return; }
  const nx = new Date(waNextSlotTime());
  el.textContent = uiT("Next scheduled sync: ") + nx.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
    uiT(nx.toDateString() === new Date().toDateString() ? " today" : " tomorrow") + (waCloudOn() ? uiT(" (cloud)") : "");
}

function waAutoReason(now, forced) {   // "" = go ahead, otherwise the reason it is not running now
  now = now || Date.now();
  if (!account) return "not signed in";
  if (typeof isViewer === "function" && isViewer()) return "view-only account";
  const c = waInboxCfg(); if (!c.url || !c.token) return "inbox not set up";
  if (waInboxBusy || waAutoRun) return "busy";
  if (navigator.onLine === false) return "offline";
  if (forced) return "";   // opened by MacroDroid with ?autofetch=1: run now
  const slotDue = waSlotOn() && waLastSlotTime(now) > waAutoLastAt();
  if (!slotDue) return waSlotOn() ? "not due" : "off";
  if (now - waAutoLastTry() < WA_AUTO_RETRY_MS) return "tried recently";
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return "you are typing";
  const box = document.getElementById("msgBox"); if (box && box.value.trim()) return "message box in use";
  return "";
}
function waAutoShowInfo() { waSlotShowInfo(); }
async function waAutoTick() {
  if (waAutoReason()) { waAutoShowInfo(); return; }
  try { localStorage.setItem("waAutoLastTry", String(Date.now())); } catch (e) {}
  try { await msalInstance.acquireTokenSilent({ scopes: graphScopes, account }); } catch (e) { return; }   // needs a sign-in? then wait - never redirect in the background
  waAutoRun = true;
  const fab = document.getElementById("bottomTabFetch");
  if (fab) fab.classList.add("busy");
  try { await waInboxFetch(); } catch (e) { console.warn("auto-fetch failed", e); }
  finally { waAutoRun = false; if (fab) fab.classList.remove("busy"); waAutoShowInfo(); }
}
mzAfterLoad(() => setInterval(waAutoTick, 60000));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(waAutoTick, 3000); });   // back on screen: catch up
mzAfterLoad(() => setTimeout(waAutoTick, 20000));
document.addEventListener("change", e => {
  if (e.target && e.target.id === "waCloudToggle") {
    try { if (e.target.checked) localStorage.removeItem("waCloudOff"); else localStorage.setItem("waCloudOff", "1"); } catch (x) {}
    waStateTouch(); waCloudPush(); waAutoShowInfo();
  }
  if (e.target && e.target.id === "waSlotToggle") { try { localStorage.setItem("waSlotOn", e.target.checked ? "1" : "0"); } catch (x) {} waAutoShowInfo(); }
});
(function () {
  const save = document.getElementById("waSlotSave"), copy = document.getElementById("waSlotCopy");
  if (save) save.addEventListener("click", () => {
    const inp = document.getElementById("waSlotTimes");
    const v = waSlotParse(inp ? inp.value : "");
    if (!v || !v.length) { alert("Write the times like this: 04:00, 12:00 (or: every hour)"); return; }
    try { localStorage.setItem("waSlots", waSlotText(v)); } catch (e) {}
    waStateTouch(); waCloudPush();   // same times on every device
    if (inp) inp.value = waSlotText(v);
    waAutoShowInfo();
    alert("Saved: " + waSlotText(v));
  });
  if (copy) copy.addEventListener("click", async () => {
    const link = location.origin + location.pathname + "?autofetch=1";
    try { await navigator.clipboard.writeText(link); copy.textContent = "✅ Copied"; }
    catch (e) { const l = document.getElementById("waSlotLink"); if (l) { l.select(); try { document.execCommand("copy"); copy.textContent = "✅ Copied"; } catch (x) {} } }
    setTimeout(() => { copy.textContent = "📋 Copy"; }, 2000);
  });
})();


/* ----- Phone notification after a cloud sync (Web Push) -----
   The VAPID key pair is made here once and kept with the subscriptions in the owner's OneDrive app folder
   (push_config.json, private). The cloud sync (GitHub workflow) reads that file and sends the notification. */
const PUSH_CFG_URL = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/push_config.json:/content";
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (t) => { t = String(t).replace(/-/g, "+").replace(/_/g, "/"); while (t.length % 4) t += "="; return Uint8Array.from(atob(t), c => c.charCodeAt(0)); };
function pushSupported() { return !!window.MZ_NATIVE || ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window); }
async function pushCfgGet(token) {
  const r = await fetch(PUSH_CFG_URL + "?t=" + Date.now(), { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
  if (r.status === 404) return {};
  if (!r.ok) throw new Error("OneDrive " + r.status);
  return (await r.json().catch(() => ({}))) || {};
}
async function pushCfgPut(token, cfg) {
  const r = await fetch(PUSH_CFG_URL, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
  if (!r.ok) throw new Error("OneDrive " + r.status);
}
async function pushCurrentSub() {
  if (!pushSupported()) return null;
  try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch (e) { return null; }
}
async function pushShowInfo() {
  const cb = document.getElementById("waPushToggle"), el = document.getElementById("waPushInfo");
  if (!cb) return;
  if (!pushSupported()) { cb.checked = false; cb.disabled = true; if (el) el.textContent = "Not supported on this device."; return; }
  if (window.MZ_NATIVE) {   // Moltrix Android app: the app checks every hour
    cb.checked = MoltrixApp.notifyOn();
    if (el) el.textContent = cb.checked && !MoltrixApp.notifyAllowed() ? "Notifications are blocked for this app in the phone settings." : "";
    return;
  }
  const sub = await pushCurrentSub();
  const on = !!sub && Notification.permission === "granted" && localStorage.getItem("waPushEndpoint") === sub.endpoint;
  cb.checked = on;
  if (el) el.textContent = Notification.permission === "denied" ? "Notifications are blocked for this app in the phone settings." : "";
}
async function pushEnable() {
  if (!waSyncEnabled()) throw new Error("Only the owner account can turn this on.");
  if (window.MZ_NATIVE) {   // Moltrix Android app: a key shared with the cloud sync (push_config.json); the sync's news file is encrypted with it
    const token = await getToken();
    const cfg = await pushCfgGet(token);
    if (!cfg.app || !cfg.app.key) {
      cfg.app = { key: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))), at: new Date().toISOString() };
      await pushCfgPut(token, cfg);
    }
    if ((cfg.subs || []).some(x => x && x.device === "Android")) {   // the Chrome notifications of Android phones are no longer needed
      cfg.subs = cfg.subs.filter(x => !(x && x.device === "Android"));
      await pushCfgPut(token, cfg);
    }
    MoltrixApp.setNotify(true, cfg.app.key);
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notification permission was not given.");
  const token = await getToken();
  const cfg = await pushCfgGet(token);
  if (!cfg.vapid || !cfg.vapid.publicKey || !cfg.vapid.privateKey) {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
    const raw = await crypto.subtle.exportKey("raw", kp.publicKey);
    cfg.vapid = { publicKey: b64u(raw), privateKey: jwk.d, subject: location.origin + "/" };
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const k = sub.options && sub.options.applicationServerKey ? b64u(sub.options.applicationServerKey) : "";
    if (k !== cfg.vapid.publicKey) { try { await sub.unsubscribe(); } catch (e) {} sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(cfg.vapid.publicKey) });
  const j = sub.toJSON();
  cfg.subs = (cfg.subs || []).filter(x => x && x.endpoint !== j.endpoint);
  cfg.subs.push({ endpoint: j.endpoint, keys: j.keys, device: waDeviceLabel(), at: new Date().toISOString() });
  await pushCfgPut(token, cfg);
  localStorage.setItem("waPushEndpoint", j.endpoint);
}
async function pushDisable() {
  if (window.MZ_NATIVE) { MoltrixApp.setNotify(false, ""); return; }
  const sub = await pushCurrentSub();
  const ep = sub ? sub.endpoint : localStorage.getItem("waPushEndpoint");
  if (sub) { try { await sub.unsubscribe(); } catch (e) {} }
  localStorage.removeItem("waPushEndpoint");
  if (ep && waSyncEnabled()) {
    const token = await getToken();
    const cfg = await pushCfgGet(token);
    if (cfg.subs && cfg.subs.some(x => x && x.endpoint === ep)) { cfg.subs = cfg.subs.filter(x => x && x.endpoint !== ep); await pushCfgPut(token, cfg); }
  }
}
document.addEventListener("change", async e => {
  if (!e.target || e.target.id !== "waPushToggle") return;
  const cb = e.target, el = document.getElementById("waPushInfo");
  cb.disabled = true; if (el) el.textContent = "…";
  try {
    if (cb.checked) { await pushEnable(); if (el) el.textContent = "✅ On"; }
    else { await pushDisable(); if (el) el.textContent = ""; }
  } catch (x) { if (el) el.textContent = "⚠️ " + (x && x.message ? x.message : x); }
  finally { cb.disabled = false; setTimeout(pushShowInfo, 1500); }
});
setTimeout(pushShowInfo, 4000);

/* ----- Opened with ?autofetch=1 (MacroDroid at the fixed times) ----- */
(function () {   // remember the request for this tab (it survives a sign-in redirect) and clean the address
  try {
    const u = new URL(location.href);
    if (u.searchParams.get("autofetch") === "1") {
      sessionStorage.setItem(AUTO_SYNC_KEY, String(Date.now()));
      sessionStorage.removeItem("autoSyncRedirects");
      u.searchParams.delete("autofetch");
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    }
  } catch (e) {}
})();
function autoSyncCard(state, text) {   // state: wait | run | ok | err
  let el = document.getElementById("autoSyncCard");
  if (!el) {
    el = document.createElement("div"); el.id = "autoSyncCard";
    el.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100000;width:min(92vw,380px);" +
      "background:var(--card,#fff);color:var(--ink,#111);border:2px solid var(--gold,#c9a227);border-radius:16px;padding:18px;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.35);text-align:center;font-size:14px;line-height:1.5;";
    document.body.appendChild(el);
  }
  const icon = { wait: "⏳", run: "🔄", ok: "✅", err: "⚠️" }[state] || "ℹ️";
  const esc = t => String(t).replace(/[&<>"']/g, ch => "&#" + ch.charCodeAt(0) + ";");
  el.innerHTML = `<div style="font-size:34px;line-height:1.2;">${icon}</div>` +
    `<div style="font-weight:700;margin:4px 0;">Scheduled WhatsApp sync</div>` +
    `<div style="white-space:pre-line;">${esc(text)}</div>` +
    (state === "ok" || state === "err" ? `<button class="primary" type="button" style="width:100%;margin-top:12px;">OK</button>` : "");
  const b = el.querySelector("button"); if (b) b.addEventListener("click", () => el.remove());
}
let autoSyncRunning = false;
async function autoSyncKick() {
  let since = 0; try { since = parseInt(sessionStorage.getItem(AUTO_SYNC_KEY) || "0", 10) || 0; } catch (e) {}
  if (!since || autoSyncRunning) return;
  const stop = () => { try { sessionStorage.removeItem(AUTO_SYNC_KEY); sessionStorage.removeItem("autoSyncRedirects"); } catch (e) {} };
  if (Date.now() - since > AUTO_SYNC_MAX_MS) { stop(); autoSyncCard("err", "Could not start within 20 minutes (no sign-in / no internet). The next scheduled time will try again."); return; }
  if (!account) {   // the saved sign-in is restored a moment after start
    if (Date.now() - since > 60000) { stop(); autoSyncCard("err", "Not signed in on this phone. Open the app here once and sign in, then the fixed-time sync will work."); }
    else autoSyncCard("wait", "Starting…");
    return;
  }
  const why = waAutoReason(0, true);
  if (why === "busy") { autoSyncCard("run", "A fetch is already running - waiting for it…"); return; }
  if (why === "offline") { autoSyncCard("wait", "No internet yet - waiting…"); return; }
  if (why) { stop(); autoSyncCard("err", "Not run: " + why + "."); return; }
  autoSyncRunning = true;
  try {
    autoSyncCard("run", "Signing in…");
    try {
      const r = await msalInstance.acquireTokenSilent({ scopes: graphScopes, account });
      cachedAccessToken = r.accessToken;
      cachedTokenExpiry = r.expiresOn ? r.expiresOn.getTime() : Date.now() + 3300000;
    } catch (e) {   // saved sign-in expired: one full-page sign-in with the same account (no tap needed while Microsoft remembers it)
      const n = parseInt(sessionStorage.getItem("autoSyncRedirects") || "0", 10) || 0;
      if (n >= 2) { stop(); autoSyncCard("err", "Microsoft sign-in needs you. Open the app and sign in once; the next scheduled time will work again."); return; }
      sessionStorage.setItem("autoSyncRedirects", String(n + 1));
      await msalRedirect({ scopes: graphScopes, account, loginHint: accountEmail(account) });
      return;   // page goes to Microsoft and comes back; this request is still remembered for the tab
    }
    stop();
    try { localStorage.setItem("waAutoLastTry", String(Date.now())); } catch (e) {}
    autoSyncCard("run", "Fetching WhatsApp messages and writing them to Excel…\nPlease leave the app open.");
    waAutoRun = true;
    const fab = document.getElementById("bottomTabFetch");
    if (fab) fab.classList.add("busy");
    const st = document.getElementById("status");
    try { await waInboxFetch(); } catch (e) { console.warn("scheduled sync failed", e); if (st) { st.className = "err"; st.textContent = "Scheduled sync failed: " + (e && e.message ? e.message : e); } }
    finally { waAutoRun = false; if (fab) fab.classList.remove("busy"); waAutoShowInfo(); }
    const line = st ? String(st.textContent || "").split("\n")[0] : "";
    const ok = st ? st.className !== "err" : false;
    const at = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    autoSyncCard(ok ? "ok" : "err", (line || "Done.") + "\n" + at);
    if (!ok && line && !/^WhatsApp fetch:/.test(line)) addNotification("Scheduled sync: " + line, "⚠️");   // fetch results are already in the bell
  } finally { autoSyncRunning = false; }
}
mzAfterLoad(() => { setInterval(autoSyncKick, 5000); setTimeout(autoSyncKick, 2500); });
waAutoShowInfo();
/* ===== end auto-fetch ===== */

/* ===================== LOGSHEET PDF ===================== */
function excelSerialToISODate(serial) {
  const ms = Math.round((serial - 25569) * 86400 * 1000); // 25569 = days between 1899-12-30 and 1970-01-01
  const d = new Date(ms);
  const yr = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
  return `${yr}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Parses a "DD/MM/YYYY" or "DD-MM-YYYY" text date into ISO format - some
// rows (especially carried-over reference blocks, or manually re-typed
// dates) store the date as plain text instead of a real Excel date-serial.
function textToISODate(t) {
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec((t || "").trim());
  if (!m) return null;
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  const day = parseInt(m[1], 10), month = parseInt(m[2], 10);
  const chk = new Date(year, month - 1, day);
  if (month < 1 || month > 12 || day < 1 || chk.getMonth() !== month - 1 || chk.getDate() !== day) return null;   // e.g. 31/13/2026 or 31/04/2026
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Reads a date from a cell that might be a genuine Excel serial number OR
// plain text - returns its ISO date, or null if neither works.
function anyDateToISO(value, textValue) {
  if (typeof value === "number") return excelSerialToISODate(value);
  return textToISODate(textValue !== undefined ? textValue : value);
}

// "#RRGGBB" -> [r, g, b]
function hexToRgbArr(h) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(h || ""));
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

// Paints one autoTable cell with the colours of sheet cell (ro, sc) from a
// layout read by readBlockFormats(). Returns true if something was applied.
function pdfCellFromLayout(data, layout, ro, sc) {
  if (!layout) return false;
  const f = layout[`${ro},${sc}`];
  if (!f) return false;
  const fill = hexToRgbArr(f.fill);
  if (fill) data.cell.styles.fillColor = fill;
  const fc = hexToRgbArr(f.font && f.font.color);
  if (fc) data.cell.styles.textColor = fc;
  const b = f.font && f.font.bold, it = f.font && f.font.italic;
  data.cell.styles.fontStyle = b ? (it ? "bolditalic" : "bold") : (it ? "italic" : "normal");
  return true;
}

// PDF column -> sheet column of the Prod. block (A:AB, column I dropped,
// then the three TOTAL MTR columns dropped).
const LOGSHEET_PDF_TO_SHEET_COL = (() => {
  const afterI = [];
  for (let c = 0; c <= 27; c++) if (c !== 8) afterI.push(c);
  return afterI.filter((_, i) => ![12, 18, 24].includes(i));
})();

function renderLogsheetPage(doc, rows, dateVal, layout) {
  // The three "TOTAL MTR" columns (source columns 12, 18, 24) are hidden.
  const HIDE_COLS = [12, 18, 24];
  rows = rows.map(r => r.filter((_, i) => !HIDE_COLS.includes(i)));
  lastReportRows = rows;
  lastReportHeaders = ["DATE","H.No.","%C","%Mn","%Si","%S","%P","SIZE","3M","4M","5M","6M","Qty(MT)","3M","4M","5M","6M","Qty(MT)","3M","4M","5M","6M","Qty(MT)","Total Prod"];
  const TAN = [255, 255, 255];
  const NAVY = [255, 255, 255];
  const LIGHTBLUE = [255, 255, 255];
  const GOLD = [153, 102, 0];

  // Column widths (relative). They are scaled so the table fills the page
  // width between equal left/right margins, and the table is centred.
  const baseWidths = [
    55, 40,                 // DATE, H.No.
    32, 32, 32, 32, 32,     // %C %Mn %Si %S %P
    30, 24, 24, 24, 24,     // SIZE + 130x130 3-6M
    40,                     // Quantity (MT)
    24, 24, 24, 24, 40,     // HOT CHARGING 3-6M + Quantity (MT)
    24, 24, 24, 24, 40,     // BYPASS 3-6M + Quantity (MT)
    40                      // Total Prod
  ];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const SIDE = 28;    // ~10 mm left and right
  const BOTTOM = 28;  // ~10 mm bottom
  const baseTotal = baseWidths.reduce((s, w) => s + w, 0);
  const scale = (pageW - 2 * SIDE) / baseTotal;
  const widths = baseWidths.map(w => Math.floor(w * scale * 10) / 10);
  const tableWidth = widths.reduce((s, w) => s + w, 0);
  const leftMargin = (pageW - tableWidth) / 2; // equal margins both sides

  const colStyles = {};
  widths.forEach((w, i) => { colStyles[i] = { cellWidth: w }; });
  for (let i = 7; i <= 11; i++) colStyles[i].fillColor = TAN;

  const centerX = pageW / 2;

  // Colours copied from the sheet's own Prod. block (if available).
  // Body row r = block row 3 + r; header rows = block rows 1 and 2.
  const applySheetLayout = (data) => {
    if (!layout) return;
    let ro;
    if (data.section === "body") ro = 3 + data.row.index;
    else if (data.section === "head") ro = 1 + data.row.index;
    else return;
    const sc = LOGSHEET_PDF_TO_SHEET_COL[data.column.index];
    const f = layout[`${ro},${sc}`];
    if (!f) return;
    const fill = hexToRgbArr(f.fill);
    if (fill) data.cell.styles.fillColor = fill;
    const fc = hexToRgbArr(f.font && f.font.color);
    if (fc) data.cell.styles.textColor = fc;
    data.cell.styles.fontStyle = f.font && f.font.bold ? (f.font.italic ? "bolditalic" : "bold") : (f.font && f.font.italic ? "italic" : "normal");
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0);
  doc.text("TOTAL PROD SHEET", centerX, 26, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${dateVal}`, leftMargin, 46);

  const head = [
    [
      { content: "DATE", rowSpan: 2 },
      { content: "H.No.", rowSpan: 2 },
      { content: "Analysis Report", colSpan: 5 },
      { content: "SIZE", rowSpan: 2, styles: { fillColor: TAN } },
      { content: "130 X 130", colSpan: 4, styles: { fillColor: TAN } },
      { content: "Quantity (MT)", rowSpan: 2 },
      { content: "HOT CHARGING", colSpan: 4 },
      { content: "Quantity (MT)", rowSpan: 2, styles: { fillColor: NAVY, textColor: 0 } },
      { content: "BYPASS", colSpan: 4 },
      { content: "Quantity (MT)", rowSpan: 2 },
      { content: "Total Prod", rowSpan: 2 }
    ],
    ["%C", "% Mn", "%Si", "%S", "% P", "3M", "4M", "5M", "6M", "3M", "4M", "5M", "6M", "3M", "4M", "5M", "6M"]
  ];

  doc.autoTable({
    head,
    body: rows,
    startY: 54,
    styles: { fontSize: 7, cellPadding: 2.5, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.5, overflow: "linebreak" },
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold", lineColor: [80, 80, 80], lineWidth: 0.5 },
    columnStyles: colStyles,
    theme: "grid",
    tableWidth: tableWidth,
    margin: { left: leftMargin, right: pageW - leftMargin - tableWidth, top: 54, bottom: BOTTOM },
    didParseCell: function (data) {
      applySheetLayout(data);
      if (data.section !== "body") return;
      if (layout) return; // sheet colours already applied
      const col = data.column.index;
      const row = data.row.index; // 0..11 data, 12 MIN, 13 MAX, 14 TOTAL

      // tan band: SIZE + 130x130 group, all rows
      if (col >= 7 && col <= 11) {
        data.cell.styles.fillColor = TAN;
      }

      // navy Quantity(MT) under Hot Charging - data rows + total row
      if (col === 17 && (row <= 11 || row === 14)) {
        data.cell.styles.fillColor = NAVY;
        data.cell.styles.textColor = 0;
      }

      // MAX row band: hot charging 3-6M navy, bypass 3-6M light blue
      if (row === 13) {
        if (col >= 13 && col <= 16) {
          data.cell.styles.fillColor = NAVY;
          data.cell.styles.textColor = 0;
        }
        if (col >= 18 && col <= 21) {
          data.cell.styles.fillColor = LIGHTBLUE;
        }
      }

      // MIN / MAX rows: gold text for H.No label + analysis report values
      if ((row === 12 || row === 13) && col >= 1 && col <= 6) {
        data.cell.styles.textColor = GOLD;
        data.cell.styles.fontStyle = "bold";
      }
    }
  });
}

async function downloadLogsheetPDF() {
  const statusEl = document.getElementById("status");
  const sheetName0 = document.getElementById("sheetName").value.trim();
  let sheetName = sheetName0;
  const fromDate = document.getElementById("logFromDate").value;
  const toDate = document.getElementById("logToDate").value;

  if (!fromDate || !toDate) {
    statusEl.className = "err";
    statusEl.textContent = "Please select both From Date and To Date.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Locating the file(s) for this date range...";

  try {
    const token = await getToken();
    const { results: wbList, missing } = await getWorkbooksForRange(token, fromDate, toDate, { allCru: true });

    if (wbList.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't find a file for any month in this range (${missing.join(", ")}).`;
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    addLogoHeader(doc);
    let totalDates = 0;
    let pageAdded = false;

    for (const sub of wbList) {
      sheetName = xlSheetFor(sheetName0, sub.cru);   // crucible B / C: their own sheet (Prod. B …)
      const colA = await graphFetch(
        `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=values`,
        token
      );
      const values = colA.values;
      const matches = [];
      for (let i = 0; i < values.length; i++) {
        const v = values[i][0];
        if (typeof v === "number") {
          const iso = excelSerialToISODate(v);
          if (iso >= sub.fromDate && iso <= sub.toDate) matches.push({ dataStart: i + 1, iso });
        }
      }
      matches.sort((a, b) => a.iso.localeCompare(b.iso));

      // Sheet colours for this file's Prod. block (remembered layout, or
      // read once from the first block of this file).
      let layout = null;
      if (matches.length) {
        try {
          layout = await readBlockFormats({ wb: sub.wb, sheetName, token, srcTop: matches[0].dataStart - 3,
            nRows: (await prodHeatsFor(sub.wb, token, sheetName)) + 6, lastColIdx: COL.AH, label: "Logsheet", useCache: true });
        } catch (e) { layout = null; } // fall back to plain white
      }

      const lh = await prodHeatsFor(sub.wb, token, sheetName);
      await graphPrefetchBatch(matches.map(({ dataStart }) => `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A${dataStart}:AB${dataStart + lh + 2}')?$select=text`), token); // all dates in one go
      for (const { dataStart, iso } of matches) {
        const blockEnd = dataStart + lh + 2; // heat rows + MIN + MAX + TOTAL
        const address = `A${dataStart}:AB${blockEnd}`;
        const blockData = await graphFetch(
          `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='${address}')?$select=text`,
          token
        );
        const rows = blockData.text.map(r => r.filter((_, idx) => idx !== 8)); // drop column I

        if (pageAdded) doc.addPage();
        renderLogsheetPage(doc, rows, iso, layout);
        xlCruStamp(doc, sub.cru);
        pageAdded = true;
        totalDates++;
        statusEl.textContent = `Preparing Logsheet PDF... (${totalDates} date(s) so far)`;
      }
    }

    if (totalDates === 0) {
      statusEl.className = "err";
      statusEl.textContent = "No dates in this range were found in the available file(s).";
      return;
    }

    stampLogoOnAllPages(doc);
    showPdfPreview(doc, `Logsheet_${fromDate}_to_${toDate}.pdf`, `Logsheet - ${fromDate} to ${toDate}`);

    statusEl.className = "ok";
    statusEl.textContent = `Logsheet PDF (${totalDates} date(s)) is ready - check the preview.` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("pdfBtn").addEventListener("click", downloadLogsheetPDF);

/* ===================== BILLET STOCK FORMAT PDF ===================== */
// Billet Stock block offsets (from the title row): headers 3-4, data 5-22,
// total 23, stock table header 24 / values 26, "Monthly production" bar 28,
// monthly table header 29 / values 30. Columns are 1:1 with A:I.
function renderBilletStockPage(doc, t, dateVal, layout) {
  const dataRows = t.slice(5, 23);      // 18 MS BILLET rows
  const totalRow = t[23];
  const stockHeader = [t[24].slice(0, 7), t[25].slice(0, 7)];
  const stockValues = t[26].slice(0, 7);
  const monthlyHeaderRow = t[29].slice(0, 7);
  const monthlyValues = t[30].slice(0, 7);

  lastReportRows = dataRows.concat([totalRow]);
  lastReportHeaders = ["Sl No.", "Particular", "Size", "Length (In Mtr)", "No of Pieces/Meter", "Standard Weight", "Quantity (In Mt)", "Quantity as per ERP (In Mt)", "Remarks"];

  const HEADER_BLUE = [255, 255, 255];
  const GREY = [255, 255, 255];
  const YELLOW = [255, 255, 255];
  const ERP_BLUE = [255, 255, 255];
  const PARTY_HIGHLIGHT = [255, 255, 255]; // distinct orange - flags rows where Particular isn't "MS BILLET"

  const tableWidth = 482;
  const pageW = doc.internal.pageSize.getWidth();
  const leftMargin = (pageW - tableWidth) / 2; // true center, equal left/right space
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Calculation of physical verification of finished goods", 297.5, 48, { align: "center" });
  doc.setFontSize(11);
  doc.text(`As on ${dateVal.split("-").reverse().join(".")}`, 297.5, 64, { align: "center" });

  const head1 = [
    [
      { content: "Sl No.", rowSpan: 2 },
      { content: "Particular", rowSpan: 2 },
      { content: "Size", rowSpan: 2 },
      { content: "Length (In Mtr)", rowSpan: 2 },
      { content: "As per physical verification", colSpan: 3 },
      { content: "Quantity as per ERP (In Mt)", rowSpan: 2 },
      { content: "Remarks", rowSpan: 2 }
    ],
    ["No of Pieces/Meter", "Standard Weight (Mt /)", "Quantity (In Mt)"]
  ];

  const body1 = dataRows.concat([totalRow]);

  doc.autoTable({
    head: head1,
    body: body1,
    startY: 76,
    tableWidth: tableWidth,
    styles: { fontSize: 8, cellPadding: 3, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.5 },
    headStyles: { fillColor: HEADER_BLUE, textColor: 0, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 32 }, 1: { cellWidth: 60 }, 2: { cellWidth: 50, fillColor: GREY },
      3: { cellWidth: 60 }, 4: { cellWidth: 55 }, 5: { cellWidth: 55 },
      6: { cellWidth: 55 }, 7: { cellWidth: 65, fillColor: ERP_BLUE }, 8: { cellWidth: 50 }
    },
    theme: "grid",
    margin: { left: leftMargin, right: leftMargin },
    didParseCell: function (data) {
      if (layout) {
        const ro = data.section === "head" ? 3 + data.row.index : data.section === "body" ? 5 + data.row.index : -1;
        if (ro >= 0) pdfCellFromLayout(data, layout, ro, data.column.index);
        return;
      }
      if (data.section !== "body") return;
      const isTotalRow = data.row.index === body1.length - 1;
      const rowData = body1[data.row.index];
      const particular = (rowData[1] || "").toString().trim().toUpperCase();
      const isPartyRow = !isTotalRow && particular !== "" && particular !== "MS BILLET";

      if (isTotalRow) {
        data.cell.styles.fillColor = YELLOW;
        data.cell.styles.fontStyle = "bold";
      } else if (isPartyRow) {
        data.cell.styles.fillColor = PARTY_HIGHLIGHT;
      }
    }
  });

  let yPos = doc.lastAutoTable.finalY + 15;
  doc.autoTable({
    head: [stockHeader[0]],
    body: [stockValues],
    startY: yPos,
    tableWidth: 482,
    styles: { fontSize: 8, cellPadding: 3, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.5 },
    headStyles: { fillColor: HEADER_BLUE, textColor: 0, fontStyle: "bold" },
    theme: "grid",
    margin: { left: leftMargin, right: leftMargin },
    didParseCell: function (data) {
      const ro = data.section === "head" ? 24 : data.section === "body" ? 26 : -1;
      if (ro >= 0) pdfCellFromLayout(data, layout, ro, data.column.index);
    }
  });

  yPos = doc.lastAutoTable.finalY + 15;
  const barFill = layout && layout["28,0"] ? hexToRgbArr(layout["28,0"].fill) : null;
  doc.setFillColor(...(barFill || YELLOW));
  doc.rect(leftMargin, yPos, 482, 16, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Monthly production", leftMargin + 241, yPos + 11, { align: "center" });

  doc.autoTable({
    head: [monthlyHeaderRow],
    body: [monthlyValues],
    startY: yPos + 20,
    tableWidth: 482,
    styles: { fontSize: 8, cellPadding: 3, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.5 },
    headStyles: { fillColor: HEADER_BLUE, textColor: 0, fontStyle: "bold" },
    theme: "grid",
    margin: { left: leftMargin, right: leftMargin },
    didParseCell: function (data) {
      const ro = data.section === "head" ? 29 : data.section === "body" ? 30 : -1;
      if (ro >= 0) pdfCellFromLayout(data, layout, ro, data.column.index);
    }
  });
}

async function downloadBilletStockPDF(mode) {
  const asJpg = mode === "jpg" || mode === "jpgplain", plainJpg = mode === "jpgplain";
  const pageDates = [];
  const statusEl = document.getElementById("status");
  const sheetName = document.getElementById("stockSheetName").value.trim();
  const fromDate = document.getElementById("stockFromDate").value;
  const toDate = document.getElementById("stockToDate").value;

  if (!fromDate || !toDate) {
    statusEl.className = "err";
    statusEl.textContent = "Please select both From Date and To Date.";
    return;
  }

  statusEl.className = "wait";
  statusEl.textContent = "Locating the file(s) for this date range...";

  try {
    const token = await getToken();
    const { results: wbList, missing } = await getWorkbooksForRange(token, fromDate, toDate);

    if (wbList.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = `Couldn't find a file for any month in this range (${missing.join(", ")}).`;
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    addLogoHeader(doc);
    let totalDates = 0;
    let pageAdded = false;

    for (const sub of wbList) {
      const colA = await graphFetch(
        `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:A2000')?$select=text`,
        token
      );
      const texts = colA.text;
      const matches = [];
      for (let i = 0; i < texts.length; i++) {
        const txt = (texts[i][0] || "").toString().trim();
        const m = txt.match(/as on\s+(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/i);
        if (m) {
          const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
          if (iso >= sub.fromDate && iso <= sub.toDate) matches.push({ titleRow: i + 1 - 1, iso });
        }
      }
      matches.sort((a, b) => a.iso.localeCompare(b.iso));

      // Sheet colours (remembered layout, or read once from this file).
      let layout = null;
      if (matches.length) {
        try {
          layout = await readBlockFormats({ wb: sub.wb, sheetName, token, srcTop: matches[0].titleRow,
            nRows: 32, lastColIdx: 8, label: "Billet Stock PDF", useCache: true });
        } catch (e) { layout = null; }
      }

      await graphPrefetchBatch(matches.map(({ titleRow }) => `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A${titleRow}:I${titleRow + 31}')?$select=text`), token); // all dates in one go
      for (const { titleRow, iso } of matches) {
        const blockEndRow = titleRow + 31;
        const address = `A${titleRow}:I${blockEndRow}`;
        const blockData = await graphFetch(
          `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='${address}')?$select=text`,
          token
        );

        if (pageAdded) doc.addPage();
        renderBilletStockPage(doc, blockData.text, iso, layout);
        pageDates.push(iso);
        pageAdded = true;
        totalDates++;
        statusEl.textContent = `Preparing Billet Stock PDF... (${totalDates} date(s) so far)`;
      }
    }

    if (totalDates === 0) {
      statusEl.className = "err";
      statusEl.textContent = "No dates in this range were found in the available file(s).";
      return;
    }

    stampLogoOnAllPages(doc);
    if (asJpg) {
      statusEl.textContent = `Making ${totalDates} JPG(s)...`;
      const imgs = await pdfToStickyJpgs(doc, pageDates.map(d => `BilletStock_${d.split("-").reverse().join(".")}.jpg`),
        (i, n) => { statusEl.textContent = `Making JPG ${i} of ${n}...`; }, plainJpg);
      showStickyJpgs(imgs, "Billet Stock - JPG");
      statusEl.className = "ok";
      statusEl.textContent = `Billet Stock JPG (${totalDates} date(s)) ready.` + (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");
      return;
    }
    showPdfPreview(doc, `BilletStock_${fromDate}_to_${toDate}.pdf`, `Billet Stock - ${fromDate} to ${toDate}`);

    statusEl.className = "ok";
    statusEl.textContent = `Billet Stock PDF (${totalDates} date(s)) is ready - check the preview.` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("stockPdfBtn").addEventListener("click", () => downloadBilletStockPDF());
document.getElementById("stockJpgBtn").addEventListener("click", () => downloadBilletStockPDF("jpg"));
document.getElementById("stockJpgPlainBtn").addEventListener("click", () => downloadBilletStockPDF("jpgplain"));

/* ---- PDF page -> high quality JPG drawn on a sticky note ----
   Each page is rendered at 3x (pdf.js), trimmed to its content, and "written"
   on a yellow sticky note: soft shadow, tape strip on top, folded corner at
   the bottom right. White of the page takes the note colour (multiply), so
   the table looks printed on the note. */
function stickyContentBox(g, w, h) {
  const d = g.getImageData(0, 0, w, h).data;
  let x1 = w, y1 = h, x2 = -1, y2 = -1;
  for (let y = 0; y < h; y += 2) {
    const row = y * w * 4;
    for (let x = 0; x < w; x += 2) {
      const i = row + x * 4;
      if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) {
        if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
      }
    }
  }
  if (x2 < 0) return { x: 0, y: 0, w, h };
  return { x: x1, y: y1, w: x2 - x1 + 2, h: y2 - y1 + 2 };
}
// sticky-note colours: [top, bottom, fold light, fold dark, top strip]
const STICKY_COLORS = [
  ["#fff8b8", "#ffec80", "#f2d861", "#d9bb3a", "rgba(225,190,40,.18)"],   // yellow
  ["#ffd6e7", "#ffb8d4", "#f39cc0", "#d97aa3", "rgba(220,90,150,.15)"],   // pink
  ["#d4f7c8", "#b5ec9f", "#9bd885", "#78bb62", "rgba(90,170,60,.15)"],    // green
  ["#d2ecff", "#b0dbff", "#93c6f2", "#6fa6d6", "rgba(60,130,200,.15)"],   // blue
  ["#ffe2c2", "#ffc996", "#f4b073", "#d98f4f", "rgba(230,130,40,.15)"],   // orange
  ["#e8dcff", "#d5c2ff", "#bea5f0", "#9d82d4", "rgba(130,90,210,.15)"]    // purple
];
let _lastSticky = -1;
function pickStickyColor() {
  let i; do { i = Math.floor(Math.random() * STICKY_COLORS.length); } while (i === _lastSticky && STICKY_COLORS.length > 1);
  _lastSticky = i; return STICKY_COLORS[i];
}
function drawStickyNote(src, box) {
  const col = pickStickyColor();
  const S = Math.max(1, box.w / 1500);                // scale decorations with size
  const pad = Math.round(55 * S), M = Math.round(70 * S), fold = Math.round(95 * S);
  const padB = fold + Math.round(20 * S);           // bottom space so the folded corner never covers the table
  const W = box.w + 2 * pad, H = box.h + pad + padB + Math.round(25 * S);
  const c = document.createElement("canvas");
  c.width = W + 2 * M; c.height = H + 2 * M;
  const g = c.getContext("2d");
  // desk background
  g.fillStyle = "#eef0f3"; g.fillRect(0, 0, c.width, c.height);
  const x0 = M, y0 = M;
  const notePath = () => {
    g.beginPath();
    g.moveTo(x0, y0); g.lineTo(x0 + W, y0); g.lineTo(x0 + W, y0 + H - fold);
    g.lineTo(x0 + W - fold, y0 + H); g.lineTo(x0, y0 + H); g.closePath();
  };
  // shadow + paper
  g.save();
  g.shadowColor = "rgba(0,0,0,.28)"; g.shadowBlur = 34 * S; g.shadowOffsetX = 6 * S; g.shadowOffsetY = 16 * S;
  const grad = g.createLinearGradient(x0, y0, x0, y0 + H);
  grad.addColorStop(0, col[0]); grad.addColorStop(1, col[1]);
  g.fillStyle = grad; notePath(); g.fill();
  g.restore();
  // slightly darker strip at the top edge (adhesive part of a sticky note)
  g.save(); notePath(); g.clip();
  g.fillStyle = col[4]; g.fillRect(x0, y0, W, Math.round(30 * S));
  // the table, "printed" on the note
  g.globalCompositeOperation = "multiply";
  g.drawImage(src, box.x, box.y, box.w, box.h, x0 + pad, y0 + pad + Math.round(25 * S), box.w, box.h);
  g.restore();
  // folded corner
  g.save();
  g.shadowColor = "rgba(0,0,0,.25)"; g.shadowBlur = 12 * S; g.shadowOffsetX = -3 * S; g.shadowOffsetY = -3 * S;
  g.beginPath(); g.moveTo(x0 + W, y0 + H - fold); g.lineTo(x0 + W - fold, y0 + H - fold); g.lineTo(x0 + W - fold, y0 + H); g.closePath();
  const fg = g.createLinearGradient(x0 + W - fold, y0 + H - fold, x0 + W, y0 + H);
  fg.addColorStop(0, col[2]); fg.addColorStop(1, col[3]);
  g.fillStyle = fg; g.fill();
  g.restore();
  // tape strip
  g.save();
  g.translate(x0 + W / 2, y0 + 4 * S); g.rotate(-0.035);
  const tw = Math.round(260 * S), th = Math.round(54 * S);
  g.fillStyle = "rgba(255,255,255,.55)"; g.strokeStyle = "rgba(160,160,160,.35)"; g.lineWidth = 1.5 * S;
  g.fillRect(-tw / 2, -th / 2, tw, th); g.strokeRect(-tw / 2, -th / 2, tw, th);
  g.restore();
  return c;
}
async function pdfToStickyJpgs(doc, names, onProgress, plain) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: new Uint8Array(doc.output("arraybuffer")) }).promise;
  const out = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    if (onProgress) onProgress(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 3 });   // ~1785 x 2525 px for A4 = sharp print quality
    const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const g = c.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: vp }).promise;
    const box = stickyContentBox(g, c.width, c.height);
    let note;
    if (plain) {   // same look as the PDF page: white, trimmed to the content with a small margin
      const m = 48;
      note = document.createElement("canvas"); note.width = box.w + 2 * m; note.height = box.h + 2 * m;
      const ng = note.getContext("2d"); ng.fillStyle = "#ffffff"; ng.fillRect(0, 0, note.width, note.height);
      ng.drawImage(c, box.x, box.y, box.w, box.h, m, m, box.w, box.h);
    } else note = drawStickyNote(c, box);
    const blob = await new Promise(res => note.toBlob(res, "image/jpeg", 0.95));
    out.push({ name: names[p - 1] || `page_${p}.jpg`, blob, url: URL.createObjectURL(blob), w: note.width, h: note.height });
  }
  return out;
}
function showStickyJpgs(imgs, title) {
  let ov = document.getElementById("stickyJpgOverlay");
  if (!ov) {
    ov = document.createElement("div"); ov.id = "stickyJpgOverlay"; ov.className = "pdfOverlay";
    ov.innerHTML = `<div class="pdfModal" style="height:auto;max-height:92vh;max-width:640px;display:flex;flex-direction:column;">
      <div class="pdfModalHead" style="flex-shrink:0;"><span id="stickyJpgTitle"></span><div><button class="secondary" id="stickyJpgClose">Close</button></div></div>
      <div id="stickyJpgStage" style="position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column;">
        <div id="stickyJpgBody" style="padding:12px;overflow:auto;min-height:0;flex:1 1 auto;"></div></div>
      <div id="stickyJpgBtns" style="flex-shrink:0;padding:8px 12px 12px;max-height:38vh;overflow-y:auto;border-top:1px solid rgba(0,0,0,.08);"></div></div>`;
    document.body.appendChild(ov);
    const close = () => { ov.classList.add("hidden"); reportZoomLock(false); };
    document.getElementById("stickyJpgClose").addEventListener("click", close);
    enableReportZoom(document.getElementById("stickyJpgBody"));   // only the pictures zoom; the buttons sit below, outside
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
  }
  document.getElementById("stickyJpgTitle").textContent = title;
  const body = document.getElementById("stickyJpgBody"), btns = document.getElementById("stickyJpgBtns");
  body.innerHTML = ""; btns.innerHTML = "";
  reportZoomReset(body); reportZoomLock(true);
  imgs.forEach((im, k) => {
    const pic = document.createElement("div"); pic.style.cssText = k < imgs.length - 1 ? "margin-bottom:16px;" : "";
    const img = document.createElement("img"); img.src = im.url; img.alt = im.name; img.style.cssText = "width:100%;display:block;border-radius:6px;";
    pic.appendChild(img); body.appendChild(pic);
    const wrap = document.createElement("div"); wrap.style.cssText = k < imgs.length - 1 ? "margin-bottom:10px;" : "";
    const row = document.createElement("div"); row.className = "btnRow"; row.style.marginTop = "4px";
    const dl = document.createElement("button"); dl.className = "primary"; dl.textContent = "⬇️ Download " + im.name;
    dl.addEventListener("click", () => { const a = document.createElement("a"); a.href = im.url; a.download = im.name; document.body.appendChild(a); a.click(); a.remove(); });
    row.appendChild(dl);
    const file = new File([im.blob], im.name, { type: "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      const sh = document.createElement("button"); sh.className = "secondary"; sh.textContent = "📤 Share";
      sh.addEventListener("click", () => navigator.share({ files: [file], title: im.name }).catch(() => {}));
      row.appendChild(sh);
    }
    const info = document.createElement("div"); info.style.cssText = "font-size:11px;opacity:.7;margin-top:2px;";
    info.textContent = `${im.w} × ${im.h} px · ${(im.blob.size / 1024).toFixed(0)} KB`;
    wrap.append(row, info); btns.appendChild(wrap);
  });
  ov.classList.remove("hidden");
}

