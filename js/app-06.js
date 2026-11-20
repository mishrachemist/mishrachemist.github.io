/* ===================== STRIP MILL PDF ===================== */
// Strip Mill block offsets (from the title row): headers 1-2, data from 3.
// Columns are 1:1 with A:U.
function renderStripMillPage(doc, t, dateVal, layout) {
  const headerLine1 = t[1]; // titleRow+1
  const headerLine2 = t[2]; // titleRow+2
  const body = t.slice(3);  // 12 data rows + 3 summary rows = 15 rows

  const head1 = buildHead(headerLine1);
  const head2 = [];
  let colPtr = 0;
  for (const cell of head1) {
    if (cell.colSpan > 1) {
      for (let k = 0; k < cell.colSpan; k++) head2.push(headerLine2[colPtr + k] || "");
    }
    colPtr += cell.colSpan;
  }
  const headRow1 = head1.map(c => c.colSpan === 1 ? { ...c, rowSpan: 2 } : c);

  lastReportRows = body;
  lastReportHeaders = headerLine1.map((h, idx) => h || headerLine2[idx] || "");

  const YELLOW_HDR = [255, 255, 255];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("COLD BILLET CHARGING SMS TO STRIP MILL", 421, 26, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${dateVal}`, 20, 42);

  doc.autoTable({
    head: [headRow1, head2],
    body: body,
    startY: 50,
    styles: { fontSize: 6.5, cellPadding: 2.5, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.5 },
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold", lineColor: [80, 80, 80], lineWidth: 0.5 },
    theme: "grid",
    margin: { left: 20, right: 20 },
    didParseCell: function (data) {
      if (layout) {
        const ro = data.section === "head" ? 1 + data.row.index : data.section === "body" ? 3 + data.row.index : -1;
        if (ro >= 0) pdfCellFromLayout(data, layout, ro, data.column.index);
        return;
      }
      if (data.section === "head") {
        const groupHeaders = ["130 x 130", "130 X 130"];
        if (data.cell.raw && groupHeaders.some(g => (data.cell.raw.content || data.cell.raw).toString().toUpperCase().includes("130"))) {
          data.cell.styles.fillColor = YELLOW_HDR;
        }
      }
    }
  });
}

async function downloadStripMillPDF(mode) {
  const asJpg = mode === "jpgplain";
  const pageDates = [];
  const statusEl = document.getElementById("status");
  const sheetName0 = document.getElementById("stripSheetName").value.trim();
  let sheetName = sheetName0;
  const fromDate = document.getElementById("stripFromDate").value;
  const toDate = document.getElementById("stripToDate").value;

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

      // Sheet colours (remembered layout, or read once from this file).
      let layout = null;
      if (matches.length) {
        try {
          layout = await readBlockFormats({ wb: sub.wb, sheetName, token, srcTop: matches[0].dataStart - 3,
            nRows: (await prodHeatsFor(sub.wb, token)) + 6, lastColIdx: 20, label: "Strip Mill PDF", useCache: true });
        } catch (e) { layout = null; }
      }

      const sh_ = await prodHeatsFor(sub.wb, token);
      await graphPrefetchBatch(matches.map(({ dataStart }) => `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A${dataStart - 3}:U${dataStart + sh_ + 2}')?$select=text`), token); // all dates in one go
      for (const { dataStart, iso } of matches) {
        const blockTitleRow = dataStart - 3;
        const blockEnd = dataStart + sh_ + 2; // heat rows + 3 summary rows
        const address = `A${blockTitleRow}:U${blockEnd}`;
        const blockData = await graphFetch(
          `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='${address}')?$select=text`,
          token
        );

        if (pageAdded) doc.addPage();
        renderStripMillPage(doc, blockData.text, iso, layout);
        xlCruStamp(doc, sub.cru);
        pageDates.push(iso);
        pageAdded = true;
        totalDates++;
        statusEl.textContent = `Preparing Strip Mill PDF... (${totalDates} date(s) so far)`;
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
      const imgs = await pdfToStickyJpgs(doc, pageDates.map(d => `StripMill_${d.split("-").reverse().join(".")}.jpg`),
        (i, n) => { statusEl.textContent = `Making JPG ${i} of ${n}...`; }, true);
      showStickyJpgs(imgs, "Strip Mill - JPG");
      statusEl.className = "ok";
      statusEl.textContent = `Strip Mill JPG (${totalDates} date(s)) ready.` + (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");
      return;
    }
    showPdfPreview(doc, `StripMill_${fromDate}_to_${toDate}.pdf`, `Strip Mill - ${fromDate} to ${toDate}`);

    statusEl.className = "ok";
    statusEl.textContent = `Strip Mill PDF (${totalDates} date(s)) is ready - check the preview.` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("stripPdfBtn").addEventListener("click", () => downloadStripMillPDF());
document.getElementById("stripJpgPlainBtn").addEventListener("click", () => downloadStripMillPDF("jpgplain"));

/* ===================== BIS DOC PDF ===================== */
function buildHead(row) {
  const cells = [];
  let i = 0;
  while (i < row.length) {
    const v = (row[i] || "").toString().trim();
    let span = 1, j = i + 1;
    while (j < row.length && (row[j] || "").toString().trim() === "") { span++; j++; }
    cells.push(v === "" ? { content: "", colSpan: span } : { content: v, colSpan: span });
    i = j;
  }
  return cells;
}

function renderBisDocPage(doc, t) {
  const companyName = t[0][0];
  const companyAddr = t[1][0];
  const manufDate = t[2][0];
  const formatNo = t[2][13] || "";
  const headerLine1 = t[3];
  const headerLine2 = t[4];
  const body = t.slice(5, 29); // 24 heat rows (Ladle+Final pairs)
  const totalLine = t[31];

  lastReportRows = body;
  lastReportHeaders = headerLine1.map((h, idx) => h || headerLine2[idx] || "");

  const head1raw = buildHead(headerLine1);
  const head2 = [];
  let colPtr = 0;
  for (const cell of head1raw) {
    if (cell.colSpan > 1) {
      for (let k = 0; k < cell.colSpan; k++) head2.push(headerLine2[colPtr + k] || "");
    }
    colPtr += cell.colSpan;
  }
  const headRow1 = head1raw.map(c => c.colSpan === 1 ? { ...c, rowSpan: 2 } : c);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(companyName, 421, 27, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(companyAddr, 421, 39, { align: "center" });
  doc.text(manufDate, 20, 53);
  doc.text(formatNo, 750, 53, { align: "right" });

  doc.autoTable({
    head: [headRow1, head2],
    body: body,
    startY: 59,
    styles: { fontSize: 7.8, cellPadding: 2.2, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.4, overflow: "linebreak" },
    headStyles: { fillColor: [235, 235, 235], textColor: 0, fontStyle: "bold", lineColor: [80, 80, 80], lineWidth: 0.4, fontSize: 7.3 },
    theme: "grid",
    margin: { left: 15, right: 15 },
    tableWidth: "auto",
    // Explicit widths for the 19 columns, scaled up to use more of the page
    // width and give each column a bit more breathing room than before.
    columnStyles: {
      0: { cellWidth: 24 },   // Sl No
      1: { cellWidth: 47 },   // Batch/Heat No
      2: { cellWidth: 30 },   // Ladle/Final
      3: { cellWidth: 50 },   // Section (MM)
      4: { cellWidth: 42 },   // Quantity (MT)
      5: { cellWidth: 30 },   // %C
      6: { cellWidth: 30 },   // %Mn
      7: { cellWidth: 35 },   // %P
      8: { cellWidth: 33 },   // %S
      9: { cellWidth: 30 },   // %Si
      10: { cellWidth: 33 },  // %N
      11: { cellWidth: 38 },  // %(S+P)
      12: { cellWidth: 30 },  // %CE
      13: { cellWidth: 59 },  // Bend MM/Meter
      14: { cellWidth: 59 },  // Camber MM/Meter
      15: { cellWidth: 38 },  // Length (Meter)
      16: { cellWidth: 54 },  // Width (MM)
      17: { cellWidth: 42 },  // Freedom From Defects
      18: { cellWidth: 111 }  // Grade
    }
  });

  let yPos = doc.lastAutoTable.finalY + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text((totalLine[2] || "Total production:"), 20, yPos);
  doc.text(String(totalLine[4] || ""), 105, yPos);

  // Signature block (compact, sits beside the totals line)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  if (COMPANY.name) coFitText(doc, "For  " + COMPANY.name.toUpperCase(), 650, yPos, 170, "left");
  if (SIGNATURE_IMG) doc.addImage(SIGNATURE_IMG, "PNG", 655, yPos + 4, 68, 42); else sigMissingWarn();
  doc.text("Manager (QAD)", 650, yPos + 50);

  // Outer border with equal top/bottom clearance (top margin mirrors the
  // gap left below the signature block, same left/right margin as the table).
  const topMargin = 7;
  const bottomY = yPos + 50 + 8;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.75);
  const pageW = doc.internal.pageSize.getWidth();
  doc.rect(10, topMargin, pageW - 20, bottomY - topMargin);
}

async function downloadBisDocPDF() {
  const statusEl = document.getElementById("status");
  const sheetName0 = document.getElementById("bisSheetName").value.trim();
  let sheetName = sheetName0;
  const fromDate = document.getElementById("bisFromDate").value;
  const toDate = document.getElementById("bisToDate").value;

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
      const scanA = await graphFetch(
        `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A1:A2992')?$select=text`,
        token
      );
      const colA = scanA.text;
      const titleRows = [];
      for (let i = 0; i < colA.length; i++) {
        const line = (colA[i][0] || "").toString();
        if (!/date of manufacturing/i.test(line)) continue;
        const m1 = line.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
        if (!m1) continue;
        const iso = `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
        if (iso >= sub.fromDate && iso <= sub.toDate) titleRows.push({ row: i + 1 - 2, iso });
      }
      titleRows.sort((a, b) => a.iso.localeCompare(b.iso));

      await graphPrefetchBatch(titleRows.map(({ row }) => `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A${row}:S${row + 31}')?$select=text`), token); // all dates in one go
      for (const { row: titleRow } of titleRows) {
        const address = `A${titleRow}:S${titleRow + 31}`;
        const blockData = await graphFetch(
          `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='${address}')?$select=text`,
          token
        );
        if (pageAdded) doc.addPage();
        renderBisDocPage(doc, blockData.text);
        xlCruStamp(doc, sub.cru);
        pageAdded = true;
        totalDates++;
        statusEl.textContent = `Preparing BIS Doc PDF... (${totalDates} date(s) so far)`;
      }
    }

    if (totalDates === 0) {
      statusEl.className = "err";
      statusEl.textContent = "No dates in this range were found in the available file(s).";
      return;
    }

    stampLogoOnAllPages(doc);
    showPdfPreview(doc, `BISDoc_${fromDate}_to_${toDate}.pdf`, `BIS Doc - ${fromDate} to ${toDate}`);

    statusEl.className = "ok";
    statusEl.textContent = `BIS Doc PDF (${totalDates} date(s)) is ready - check the preview.` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("bisPdfBtn").addEventListener("click", downloadBisDocPDF);

/* ===================== T.C. (TEST CERTIFICATE) PDF ===================== */
function renderTCPage(doc, t, certDateText) {
  const certNo = t[5][3] || "";
  const toMs = t[7][0] || "";
  const certifyText = t[9][0] || "";
  const specNote = t[11][0] || "";
  const rawBody = t.slice(17, 23);
  const body = rawBody.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[15], r[16], r[17], r[19], r[20]]);

  // Totals row: sum the "Quantity in M.T" column (index 4), rest left blank
  const totalQty = body.reduce((sum, row) => sum + (parseFloat(row[4]) || 0), 0);
  const totalRow = new Array(body[0].length).fill("");
  totalRow[4] = totalQty.toFixed(3);
  body.push(totalRow);

  lastReportRows = body;
  lastReportHeaders = ["Order No. Date", "Billet Size", "Heat/Batch No.", "Grade & Quality", "Quantity in M.T", "C%", "Si%", "Mn%", "P%", "S%", "Product Designation", "Freedom from defects", "Sulphur print test", "macro-examination", "inclusion content", "Remarks"];

  const headRow1 = [
    { content: "Order No. Date", rowSpan: 2 },
    { content: "Billet Size", rowSpan: 2 },
    { content: "Heat/Batch No.", rowSpan: 2 },
    { content: "Grade & Quality", rowSpan: 2 },
    { content: "Quantity in M.T", rowSpan: 2 },
    { content: "CHEMICAL COMPOSITION", colSpan: 6 },
    { content: "Freedom from defects", rowSpan: 2 },
    { content: "Sulphur print test", rowSpan: 2 },
    { content: "macro-examination", rowSpan: 2 },
    { content: "inclusion content", rowSpan: 2 },
    { content: "Remarks", rowSpan: 2 }
  ];
  const headRow2 = ["C %", "Si%", "Mn%", "P%", "S%", { content: "Product Designation" }];

  coDrawLogo(doc, 20, 18, 90, 47, true);   // letterhead logo (Get Started > Company details); nothing if none was added

  doc.setFont("helvetica", "bold");   // ISI mark stays in the code; the CM/L licence no. comes from Company details
  doc.setFontSize(8);
  doc.text("IS 14650:2023", 794, 16, { align: "center" });
  if (reportLogoOn()) doc.addImage(ISI_LOGO, "PNG", 767, 18, 55, 41);   // ISI mark also follows the "Logo on report" switch
  if (COMPANY.cml) { doc.setFontSize(7.5); doc.text(coCmlText(), 794, 66, { align: "center" }); }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  if (COMPANY.name) coFitText(doc, COMPANY.name.toUpperCase(), 421, 30, 560);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  if (COMPANY.address) {
    const addrWidth = coFitText(doc, COMPANY.address, 421, 42, 560);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(421 - addrWidth / 2, 44, 421 + addrWidth / 2, 44);   // address underline
  }
  if (COMPANY.cml) doc.text(coCmlText(), 421, 52, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TEST CERTIFICATE FOR CARBON STEEL CAST BILLET INGOTS, BILLETS, BLOOMS AND SLABS FOR", 421, 66, { align: "center" });
  doc.text("RE-ROLLING INTO STEEL FOR GENERAL STRUCTURAL PURPOSES", 421, 77, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("TEST CERTIFICATE No.: ", 20, 88);
  const certLabelWidth = doc.getTextWidth("TEST CERTIFICATE No.: ");
  doc.setFont("helvetica", "bold");
  doc.text(certNo, 20 + certLabelWidth, 88);
  const certNoWidth = doc.getTextWidth(certNo);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(20 + certLabelWidth, 90, 20 + certLabelWidth + certNoWidth, 90);
  doc.setFont("helvetica", "normal");
  doc.text(`DATE:- ${certDateText}`, 650, 88);
  const toMsClean = toMs.replace(/^\s*To\s*M\/s\.?\s*/i, "").trim();
  doc.text("To M/s. ", 20, 102);
  const toLabelWidth = doc.getTextWidth("To M/s. ");
  doc.text(toMsClean, 20 + toLabelWidth, 102);
  const toMsWidth = doc.getTextWidth(toMsClean);
  doc.line(20 + toLabelWidth, 104, 20 + toLabelWidth + toMsWidth, 104);

  const splitCertify = doc.splitTextToSize(certifyText, 760);
  doc.text(splitCertify, 20, 116);

  let yPos = 116 + splitCertify.length * 10 + 6;
  doc.text(specNote, 20, yPos);
  yPos += 16;
  doc.setFont("helvetica", "bold");
  doc.text("Test Results", 20, yPos);
  const trWidth = doc.getTextWidth("Test Results");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 20 + trWidth, yPos + 2);
  yPos += 8;

  doc.autoTable({
    head: [headRow1, headRow2],
    body: body,
    startY: yPos,
    styles: { fontSize: 7.5, cellPadding: 2.5, halign: "center", valign: "middle", overflow: "linebreak" },
    bodyStyles: { lineWidth: 0 },
    headStyles: { fillColor: [235, 235, 235], textColor: 0, fontStyle: "bold", lineColor: [80, 80, 80], lineWidth: 0.5 },
    theme: "grid",
    margin: { left: 20, right: 20 },
    tableWidth: "auto",
    columnStyles: {
      0: { cellWidth: 55 },  // Order No. Date
      1: { cellWidth: 55 },  // Billet Size
      2: { cellWidth: 55 },  // Heat/Batch No.
      3: { cellWidth: 55 },  // Grade & Quality
      4: { cellWidth: 50 },  // Quantity in M.T
      5: { cellWidth: 30 },  // C%
      6: { cellWidth: 30 },  // Si%
      7: { cellWidth: 30 },  // Mn%
      8: { cellWidth: 32 },  // P%
      9: { cellWidth: 30 },  // S%
      10: { cellWidth: 90 }, // Product Designation
      11: { cellWidth: 55 }, // Freedom from defects
      12: { cellWidth: 55 }, // Sulphur print test
      13: { cellWidth: 55 }, // macro-examination
      14: { cellWidth: 55 }, // inclusion content
      15: { cellWidth: 70 }  // Remarks
    },
    didParseCell: function (data) {
      if (data.section === "body" && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawCell: function (data) {
      const isTotalsRow = data.row.index === body.length - 1;

      if (data.section === "body") {
        const { x, y, width, height } = data.cell;
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.5);
        // Vertical column dividers run through every row, including the
        // totals row, so they connect continuously down to the bottom border.
        doc.line(x, y, x, y + height);
        doc.line(x + width, y, x + width, y + height);
        // Top edge of the very first data row - separates data block from header
        if (data.row.index === 0) {
          doc.line(x, y, x + width, y);
        }
      }
      // Totals row: top border above the Quantity cell, plus a full-width
      // bottom border across every column to close the outer table box.
      if (data.section === "body" && isTotalsRow) {
        const { x, y, width, height } = data.cell;
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.5);
        if (data.column.index === 4) {
          doc.line(x, y, x + width, y);
        }
        doc.line(x, y + height, x + width, y + height);
      }
    }
  });

  yPos = doc.lastAutoTable.finalY + 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Invoice No.", 20, yPos);
  if (COMPANY.name) coFitText(doc, "For  " + COMPANY.name.toUpperCase(), 650, yPos, 170, "left");
  yPos += 20;
  doc.text("Date .", 20, yPos);
  // Signature image sits between "For <company>" and "Manager (QAD)"
  if (SIGNATURE_IMG) doc.addImage(SIGNATURE_IMG, "PNG", 655, yPos - 8, 76, 46); else sigMissingWarn();
  yPos += 50;
  doc.text("Manager (QAD)", 650, yPos);

  // Outer border around the certificate content only - top margin (8pt,
  // matching where the header starts) is mirrored at the bottom instead of
  // stretching the box down to the full page height.
  const topMargin = 6;
  const bottomY = yPos + 8;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.75);
  const pageW = doc.internal.pageSize.getWidth();
  doc.rect(10, topMargin, pageW - 20, bottomY - topMargin);
}

async function downloadTCPDF() {
  const statusEl = document.getElementById("status");
  const sheetName = document.getElementById("tcSheetName").value.trim();
  const fromDate = document.getElementById("tcFromDate").value;
  const toDate = document.getElementById("tcToDate").value;

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
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    let totalPages = 0;
    let pageAdded = false;

    for (const sub of wbList) {
      const scanT = await graphFetch(
        `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='T1:T2992')?$select=values`,
        token
      );
      const colT = scanT.values;
      const titleRows = [];
      for (let i = 0; i < colT.length; i++) {
        const v = colT[i][0];
        if (typeof v === "number") {
          const iso = excelSerialToISODate(v);
          if (iso >= sub.fromDate && iso <= sub.toDate) titleRows.push({ row: i + 1 - 5, iso });
        }
      }
      titleRows.sort((a, b) => a.iso.localeCompare(b.iso));

      await graphPrefetchBatch(titleRows.map(({ row }) => `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A${row}:U${row + 33}')?$select=text`), token); // all dates in one go
      for (const { row: titleRow, iso } of titleRows) {
        const address = `A${titleRow}:U${titleRow + 33}`;
        const blockData = await graphFetch(
          `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='${address}')?$select=text`,
          token
        );
        if (pageAdded) doc.addPage();
        const certDateText = iso.split("-").reverse().join("-");
        renderTCPage(doc, blockData.text, certDateText);
        pageAdded = true;
        totalPages++;
        statusEl.textContent = `Preparing T.C. PDF... (${totalPages} page(s) so far)`;
      }
    }

    if (totalPages === 0) {
      statusEl.className = "err";
      statusEl.textContent = "No dates in this range were found in the available file(s).";
      return;
    }

    showPdfPreview(doc, `TC_${fromDate}_to_${toDate}.pdf`, `Test Certificate - ${fromDate} to ${toDate}`);

    statusEl.className = "ok";
    statusEl.textContent = `T.C. PDF (${totalPages} page(s)) is ready - check the preview.` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("tcPdfBtn").addEventListener("click", downloadTCPDF);

/* ===================== RM / SCRAP REPORT PDF ===================== */
const RM_CATEGORIES = ["SCRAP", "SUPER HEAVY", "HEAVY", "COMMERCIAL", "LIGHT COMMERCIAL", "CI MIX SCRAP", "DUST"];

async function downloadRMReportPDF() {
  const statusEl = document.getElementById("status");
  const sheetName = document.getElementById("rmReportSheetName").value.trim();
  const fromDate = document.getElementById("rmReportFromDate").value;
  const toDate = document.getElementById("rmReportToDate").value;

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

    const rows = [];
    const totals = [0, 0, 0, 0, 0, 0, 0];

    for (const sub of wbList) {
      const data = await graphFetch(
        `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A2:AF32')?$select=text,values`,
        token
      );
      for (let r = 0; r < data.values.length; r++) {
        const iso = anyDateToISO(data.values[r][0], data.text[r][0]); // column A - reliable; column Y is a mirror formula that may not extend to newer months
        if (!iso) continue;
        if (iso < sub.fromDate || iso > sub.toDate) continue;

        const rowText = data.text[r];
        const rowValues = data.values[r];
        rows.push([iso, ...rowText.slice(25, 32)]); // Z:AF (0-based idx 25-31) = the 7 scrap categories
        for (let c = 0; c < 7; c++) {
          const v = rowValues[c + 25];
          if (typeof v === "number") totals[c] += v;
        }
      }
    }

    if (rows.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = "No dates in this range were found in the available file(s).";
      return;
    }

    rows.sort((a, b) => a[0].localeCompare(b[0]));
    rows.push(["TOTAL", ...totals.map(v => v.toFixed(3))]);

    lastReportRows = rows;
    lastReportHeaders = ["Date", ...RM_CATEGORIES];

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    addLogoHeader(doc);
    const pageW = doc.internal.pageSize.getWidth();
    const NAVY = [31, 56, 100], GOLD = [201, 162, 39];

    // White header band so the company logo stays visible (navy hid it)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(3);
    doc.line(0, 66, pageW, 66);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(31, 56, 100);
    doc.text("RM / Scrap Report", pageW / 2, 30, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 118, 20);
    doc.text(`${fromDate} to ${toDate}`, pageW / 2, 50, { align: "center" });

    const rmTableWidth = 60 + 62 * 4 + 70 + 62 + 55; // 495pt - sum of all fixed column widths below
    const rmMargin = (pageW - rmTableWidth) / 2; // true center - equal left/right space
    doc.autoTable({
      head: [["Date", ...RM_CATEGORIES]],
      body: rows,
      startY: 82,
      styles: { fontSize: 9.5, cellPadding: 4, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.5 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [244, 248, 253] },
      theme: "grid",
      margin: { left: rmMargin, right: rmMargin },
      tableWidth: rmTableWidth,
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 62 }, 2: { cellWidth: 62 }, 3: { cellWidth: 62 }, 4: { cellWidth: 62 },
        5: { cellWidth: 70 }, 6: { cellWidth: 62 }, 7: { cellWidth: 55 }
      },
      didParseCell: function (data) {
        if (data.section === "body" && data.row.index === rows.length - 1) {
          data.cell.styles.fillColor = [255, 235, 130];
          data.cell.styles.fontStyle = "bold";
        }
      }
    });

    // Category-wise Summary table - each scrap category's own total, shown
    // as its own clear section (matching how other reports show a summary).
    // SCRAP (index 0) is the overall total weight; every other category is
    // a sub-item drawn from within it, so each one's % is shown against the
    // SCRAP total (SCRAP itself is therefore always 100%).
    const scrapTotal = totals[0];
    let sumY = doc.lastAutoTable.finalY + 22;
    if (sumY > 680) { doc.addPage(); sumY = 40; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text("Summary", 40, sumY);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1.5);
    doc.line(40, sumY + 4, 40 + doc.getTextWidth("Summary"), sumY + 4);
    doc.autoTable({
      startY: sumY + 12,
      head: [["Category", "Total Quantity", "% of Total"]],
      body: RM_CATEGORIES.map((cat, i) => [cat, totals[i].toFixed(3), scrapTotal > 0 ? `${((totals[i] / scrapTotal) * 100).toFixed(2)}%` : "0.00%"]),
      styles: { fontSize: 9, cellPadding: 5, halign: "center" },
      headStyles: { fillColor: NAVY, textColor: 255 },
      alternateRowStyles: { fillColor: [244, 248, 253] },
      columnStyles: { 0: { halign: "left" } },
      theme: "grid",
      margin: { left: 40, right: 40 },
      didParseCell: function (data) {
        if (data.section === "body" && data.row.index === 0) {
          data.cell.styles.fillColor = [255, 235, 130];
          data.cell.styles.fontStyle = "bold";
        }
      }
    });

    const rmPageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= rmPageCount; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`SMS/QAD${COMPANY.name ? " - " + COMPANY.name : ""}  |  Page ${p} of ${rmPageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });
    }

    stampLogoOnAllPages(doc);
    showPdfPreview(doc, `RM_Report_${fromDate}_to_${toDate}.pdf`, `RM / Scrap Report - ${fromDate} to ${toDate}`);

    statusEl.className = "ok";
    statusEl.textContent = `RM Report (${rows.length - 1} day(s) across ${wbList.length} file(s)) is ready - check the preview.` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("rmReportPdfBtn").addEventListener("click", downloadRMReportPDF);

/* ===================== SLAG CRUSHER REPORT PDF ===================== */
const SLAG_HEADERS = ["Raw Slag Pro", "Raw Slag Trf", "Consumption", "Slag Iron", "Jam", "Fe(T)", "Mag%", "N/Mag%"];
// Column letters within RM Report: Date=A, then C,E,F,G,H,I,J,K (D is unused)
const SLAG_COLS = ["C", "E", "F", "G", "H", "I", "J", "K"];

async function downloadSlagReportPDF() {
  const statusEl = document.getElementById("status");
  const sheetName = document.getElementById("slagReportSheetName").value.trim();
  const fromDate = document.getElementById("slagReportFromDate").value;
  const toDate = document.getElementById("slagReportToDate").value;

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

    const rows = [];
    // running sums for Raw Slag Pro/Trf/Consumption/Slag Iron/Jam, and
    // running sum+count for Fe(T)/Mag%/N-Mag% (averaged, not summed)
    const sums = [0, 0, 0, 0, 0];
    const avgSums = [0, 0, 0];
    const avgCounts = [0, 0, 0];

    // Renders a value as blank whenever it's exactly zero (or zero-like
    // text), so 0.000 doesn't clutter the report - matching how the
    // original Excel sheet just leaves those cells empty-looking.
    const blankIfZero = v => {
      const n = parseFloat(v);
      return (!isNaN(n) && n === 0) ? "" : v;
    };

    for (const sub of wbList) {
      const data = await graphFetch(
        `${sub.wb}/worksheets('${encodeURIComponent(String(sheetName).replace(/'/g, "''"))}')/range(address='A2:K32')?$select=text,values`,
        token
      );
      for (let r = 0; r < data.values.length; r++) {
        const iso = anyDateToISO(data.values[r][0], data.text[r][0]);
        if (!iso) continue;
        if (iso < sub.fromDate || iso > sub.toDate) continue;

        const colIdx = letter => colLetterToIndex(letter); // 0-based, relative to column A
        const rowVals = SLAG_COLS.map(col => data.values[r][colIdx(col)]);
        const rowText = SLAG_COLS.map(col => blankIfZero(data.text[r][colIdx(col)]));

        rows.push([iso, ...rowText]);

        for (let c = 0; c < 5; c++) {
          if (typeof rowVals[c] === "number") sums[c] += rowVals[c];
        }
        for (let c = 0; c < 3; c++) {
          const v = rowVals[c + 5];
          if (typeof v === "number") { avgSums[c] += v; avgCounts[c]++; }
        }
      }
    }

    if (rows.length === 0) {
      statusEl.className = "err";
      statusEl.textContent = "No dates in this range were found in the available file(s).";
      return;
    }

    rows.sort((a, b) => a[0].localeCompare(b[0]));
    const totalRow = [
      "TOTAL",
      blankIfZero(sums[0].toFixed(3)), blankIfZero(sums[1].toFixed(3)), blankIfZero(sums[2].toFixed(3)),
      blankIfZero(sums[3].toFixed(3)), blankIfZero(sums[4].toFixed(3)),
      avgCounts[0] ? blankIfZero((avgSums[0] / avgCounts[0]).toFixed(2)) : "",
      avgCounts[1] ? blankIfZero((avgSums[1] / avgCounts[1]).toFixed(2)) : "",
      avgCounts[2] ? blankIfZero((avgSums[2] / avgCounts[2]).toFixed(2)) : ""
    ];
    rows.push(totalRow);

    lastReportRows = rows;
    lastReportHeaders = ["Date", ...SLAG_HEADERS];

    // Closing Report summary: same Opening/Incoming/Consumption/Closing
    // logic as the Stock Report tab (month-wise), filtered to just these
    // 5 slag-related items.
    statusEl.textContent = "Reading closing stock summary...";
    const closingItemNames = ["Raw Slag", "Mag Material", "Over Size Sponge", "Slag Jaam", "Slag Metal Fines, Size: 1mm to 3mm"];
    const closingRowsRaw = await computeStockRowsForItems(wbList, closingItemNames, statusEl, token);
    const closingRows = closingRowsRaw.map(r => ({ name: r.name, opening: r.opening, production: r.incoming, consumption: r.consumption, closing: r.closing }));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    addLogoHeader(doc);
    const pageW = doc.internal.pageSize.getWidth();
    const NAVY = [31, 56, 100], GOLD = [201, 162, 39];

    // White header band so the company logo stays visible (navy hid it)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(3);
    doc.line(0, 66, pageW, 66);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(31, 56, 100);
    doc.text("Slag Crusher Report", pageW / 2, 30, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 118, 20);
    doc.text(`${fromDate} to ${toDate}`, pageW / 2, 50, { align: "center" });

    const slagTableWidth = 68 + 62 * 3 + 58 + 50 + 46 * 2 + 50; // 504pt - sum of fixed column widths below
    const slagMargin = (pageW - slagTableWidth) / 2; // true center - equal left/right space
    doc.autoTable({
      head: [["Date", ...SLAG_HEADERS]],
      body: rows,
      startY: 82,
      styles: { fontSize: 8, cellPadding: 2.3, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.4, overflow: "linebreak" },
      headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [244, 248, 253] },
      theme: "grid",
      margin: { left: slagMargin, right: slagMargin },
      tableWidth: slagTableWidth,
      columnStyles: {
        0: { cellWidth: 68 },  // Date
        1: { cellWidth: 62 },  // Raw Slag Pro
        2: { cellWidth: 62 },  // Raw Slag Trf
        3: { cellWidth: 62 },  // Consumption
        4: { cellWidth: 58 },  // Slag Iron
        5: { cellWidth: 50 },  // Jam
        6: { cellWidth: 46 },  // Fe(T)
        7: { cellWidth: 46 },  // Mag%
        8: { cellWidth: 50 }   // N/Mag%
      },
      didParseCell: function (data) {
        if (data.section === "body" && data.row.index === rows.length - 1) {
          data.cell.styles.fillColor = [255, 235, 130];
          data.cell.styles.fontStyle = "bold";
        }
      }
    });

    // Closing Report summary table, styled to match the Stock Report tab
    // (colored header band + color-coded dot "icon" per item).
    let y = doc.lastAutoTable.finalY + 26;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(31, 56, 100);
    doc.text("CLOSING REPORT", pageW / 2, y, { align: "center" });
    y += 14;

    const CLOSING_COLORS = {
      "Raw Slag": [163, 39, 28], "Mag Material": [11, 110, 153],
      "Over Size Sponge": [122, 31, 162], "Slag Jaam": [201, 162, 39],
      "Slag Metal Fines, Size: 1mm to 3mm": [30, 107, 60]
    };

    const closingBody = closingRows.map(r => [
      { content: r.name, styles: { textColor: CLOSING_COLORS[r.name] || [31, 56, 100], fontStyle: "bold", halign: "left", cellPadding: { left: 20, top: 9, bottom: 9, right: 8 } } },
      blankIfZero(r.opening.toFixed(3)), blankIfZero(r.production.toFixed(3)), blankIfZero(r.consumption.toFixed(3)), blankIfZero(r.closing.toFixed(3))
    ]);

    doc.autoTable({
      head: [["Item", "Opening", "Production", "Consumption", "Closing"]],
      body: closingBody,
      startY: y,
      styles: { fontSize: 9.5, cellPadding: 7, halign: "center", valign: "middle", lineColor: [80, 80, 80], lineWidth: 0.5 },
      headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold", fontSize: 10 },
      alternateRowStyles: { fillColor: [244, 248, 253] },
      theme: "grid",
      margin: { left: slagMargin, right: slagMargin },
      tableWidth: slagTableWidth, // matches the main table's total width so both tables' edges line up
      columnStyles: { 0: { cellWidth: 165 }, 1: { cellWidth: 85 }, 2: { cellWidth: 85 }, 3: { cellWidth: 85 }, 4: { cellWidth: 84 } },
      didDrawCell: function (data) {
        if (data.section === "body" && data.column.index === 0) {
          const rgb = data.cell.styles.textColor;
          if (Array.isArray(rgb)) {
            doc.setFillColor(rgb[0], rgb[1], rgb[2]);
            doc.circle(data.cell.x + 10, data.cell.y + data.cell.height / 2, 3.2, "F");
          }
        }
      },
      didParseCell: function (data) {
        if (data.section === "body" && data.column.index === 4 && data.cell.raw !== "") {
          const val = parseFloat(data.cell.raw);
          data.cell.styles.fillColor = val < 0 ? [251, 233, 231] : [231, 247, 234];
          data.cell.styles.textColor = val < 0 ? [163, 39, 28] : [30, 107, 60];
          data.cell.styles.fontStyle = "bold";
        }
      }
    });

    // Outer border framing the whole document for a more polished look
    const finalY = doc.lastAutoTable.finalY + 16;
    doc.setDrawColor(31, 56, 100);
    doc.setLineWidth(1);
    doc.rect(12, 10, pageW - 24, finalY - 10);

    const slagPageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= slagPageCount; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`SMS/QAD${COMPANY.name ? " - " + COMPANY.name : ""}  |  Page ${p} of ${slagPageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });
    }

    stampLogoOnAllPages(doc);
    showPdfPreview(doc, `Slag_Crusher_Report_${fromDate}_to_${toDate}.pdf`, `Slag Crusher Report - ${fromDate} to ${toDate}`);

    statusEl.className = "ok";
    statusEl.textContent = `Slag Crusher Report (${rows.length - 1} day(s) across ${wbList.length} file(s)) is ready - check the preview.` +
      (missing.length ? ` (Couldn't find a file for: ${missing.join(", ")})` : "");

  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}

document.getElementById("slagReportPdfBtn").addEventListener("click", downloadSlagReportPDF);

/* ===================== OUT-OF-SPEC CHEMISTRY REPORT ===================== */
// C=col index 2, Mn=3, Si=4, S=5, P=6 within A:G (A=0,B=1,C=2,D=3,E=4,F=5,G=6)
const CHEM_SPEC_LIMITS = [
  { key: "C", label: "%C", type: "max", value: 0.12, colOffset: 2 },
  { key: "S", label: "%S", type: "max", value: 0.050, colOffset: 5 },
  { key: "P", label: "%P", type: "max", value: 0.100, colOffset: 6 }
];

function checkOutOfSpec(row) {
  const issues = [];
  CHEM_SPEC_LIMITS.forEach(spec => {
    const raw = row[spec.colOffset];
    if (typeof raw !== "number") return;
    // Round to 3 decimals first, matching how these values are normally
    // displayed/entered (e.g. "0.050") - avoids flagging a value that's
    // only microscopically over the limit due to floating-point storage.
    const v = Math.round(raw * 1000) / 1000;
    if (spec.type === "max" && v > spec.value) issues.push(`${spec.label}=${v} (max ${spec.value})`);
    if (spec.type === "min" && v < spec.value) issues.push(`${spec.label}=${v} (min ${spec.value})`);
  });
  return issues;
}

// Scans the given date range for out-of-spec heats, capturing tonnage
// (column AB - Total Prod for that heat) alongside the chemistry values.
// Returns { flaggedHeats, totalHeatsScanned } - shared by both the
// Dashboard view and the PDF export so they always agree with each other.
/* ===================== MONTHLY MIS (ONE PAGE) ===================== */
async function downloadMonthlyMisPDF() {
  const statusEl = document.getElementById("status");
  const mv = document.getElementById("misMonth").value; // YYYY-MM
  if (!mv) { statusEl.className = "err"; statusEl.textContent = "Please choose a month."; return; }
  const [y, m] = mv.split("-").map(Number);
  const m0 = m - 1;
  const sheetName = document.getElementById("sheetName").value.trim() || "Prod.";
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  const monthLabel = `${MONTH_ABBR[m0]} ${y}`;
  statusEl.className = "wait";
  statusEl.textContent = `Monthly MIS ${monthLabel}: reading production...`;
  try {
    const token = await getToken();
    const mt = await getMonthTotals(token, sheetName, y, m0);
    if (!mt) throw new Error(`No file found for ${monthLabel}.`);
    const t = mt.totals;
    const wb = await resolveWorkbook(token, mt.filePath);

    statusEl.textContent = `Monthly MIS ${monthLabel}: reading raw material consumption...`;
    const rm = await getRmIncomingAndConsumption(wb, start, end, token);

    statusEl.textContent = `Monthly MIS ${monthLabel}: checking off-spec heats...`;
    let spec = null;
    try { spec = await scanOutOfSpecHeats(sheetName, start, end, null, token); } catch (e) { spec = null; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const M = 36;
    addLogoHeader(doc);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(31, 56, 100);
    doc.text(`Monthly MIS - ${monthLabel}`, pageW / 2, 58, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
    doc.text(`SMS${COMPANY.name ? " - " + COMPANY.name : ""}  |  ${mt.days} production day(s) recorded`, pageW / 2, 72, { align: "center" });
    doc.setDrawColor(201, 162, 39); doc.setLineWidth(1.2); doc.line(M, 80, pageW - M, 80);

    // KPI cards
    const kpis = [
      ["Total Production", `${t.totalProd.toFixed(3)} MT`],
      ["Heats", String(t.heatCount)],
      ["Avg per Heat", t.heatCount ? `${(t.totalProd / t.heatCount).toFixed(3)} MT` : "-"],
      ["Avg per Day", mt.days ? `${(t.totalProd / mt.days).toFixed(3)} MT` : "-"]
    ];
    const cw = (pageW - 2 * M - 3 * 10) / 4;
    kpis.forEach((k, i) => {
      const x = M + i * (cw + 10), yy = 92;
      doc.setFillColor(31, 56, 100); doc.roundedRect(x, yy, cw, 52, 6, 6, "F");
      doc.setTextColor(232, 211, 138); doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(k[0], x + cw / 2, yy + 17, { align: "center" });
      doc.setTextColor(255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text(k[1], x + cw / 2, yy + 38, { align: "center" });
    });

    const tableStyle = {
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 4, lineColor: [180, 180, 180], lineWidth: 0.4 },
      headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold" },
      margin: { left: M, right: M }
    };
    const pct = (a) => t.totalProd > 0 ? `${(a / t.totalProd * 100).toFixed(1)}%` : "-";

    doc.autoTable({ ...tableStyle, startY: 160,
      head: [["Production breakdown", "Quantity (MT)", "% of Production"]],
      body: [
        ["Hot Charging", t.hotCharging.toFixed(3), pct(t.hotCharging)],
        ["Bypass", t.bypass.toFixed(3), pct(t.bypass)],
        ["RHF", t.rhf.toFixed(3), pct(t.rhf)],
        ["Hot Out", t.hotOut.toFixed(3), pct(t.hotOut)]
      ],
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } }
    });

    let specBody;
    if (spec && !spec.noFiles) {
      const f = spec.flaggedHeats;
      const ton = f.reduce((a, h) => a + h.tonnage, 0);
      const c = { C: 0, S: 0, P: 0 };
      f.forEach(h => h.issueList.forEach(k => { c[k] = (c[k] || 0) + 1; }));
      specBody = [
        ["Out-of-spec heats", `${f.length} of ${spec.totalHeatsScanned}`],
        ["% of heats", spec.totalHeatsScanned ? `${(f.length / spec.totalHeatsScanned * 100).toFixed(1)}%` : "-"],
        ["Out-of-spec tonnage", `${ton.toFixed(3)} MT`],
        ["Failures by element", `C: ${c.C}   S: ${c.S}   P: ${c.P}`]
      ];
    } else {
      specBody = [["Out-of-spec check", "Could not be read for this month"]];
    }
    doc.autoTable({ ...tableStyle, startY: doc.lastAutoTable.finalY + 14,
      head: [["Quality (Out of Spec)", "Value"]], body: specBody,
      columnStyles: { 1: { halign: "right" } }
    });

    const rmRows = STOCK_ITEMS
      .filter(it => it.consumeCol && Math.abs(rm.consumption[it.name] || 0) > 0.0005)
      .map(it => {
        const q = rm.consumption[it.name];
        return [it.name, q.toFixed(3), t.totalProd > 0 ? (q / t.totalProd * 1000).toFixed(1) : "-"];
      });
    const rmTotal = STOCK_ITEMS.filter(it => it.consumeCol).reduce((a, it) => a + (rm.consumption[it.name] || 0), 0);
    if (rmRows.length) rmRows.push([{ content: "TOTAL", styles: { fontStyle: "bold" } },
      { content: rmTotal.toFixed(3), styles: { fontStyle: "bold" } },
      { content: t.totalProd > 0 ? (rmTotal / t.totalProd * 1000).toFixed(1) : "-", styles: { fontStyle: "bold" } }]);
    doc.autoTable({ ...tableStyle, startY: doc.lastAutoTable.finalY + 14,
      head: [["Raw material consumption", "Quantity (MT)", "kg per MT of production"]],
      body: rmRows.length ? rmRows : [["No consumption recorded in RM Report for this month", "", ""]],
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } }
    });

    doc.setFontSize(8); doc.setTextColor(120); doc.setFont("helvetica", "italic");
    doc.text("Power consumption per ton is not recorded in the Excel file, so it is not shown.", M, doc.lastAutoTable.finalY + 16);

    showPdfPreview(doc, `Monthly_MIS_${MONTH_ABBR[m0]}_${y}.pdf`, `Monthly MIS - ${monthLabel}`);
    statusEl.className = "ok";
    statusEl.textContent = `Monthly MIS for ${monthLabel} is ready - check the preview.`;
  } catch (e) {
    statusEl.className = "err";
    statusEl.textContent = "Error: " + e.message;
  }
}
document.getElementById("misPdfBtn").addEventListener("click", downloadMonthlyMisPDF);
// Kashvi voice input (Web Speech API - works in Chrome / the Android app)
(function kashviVoice() {
  const micBtn = document.getElementById("kashviMic");
  const input = document.getElementById("kashviInput");
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    micBtn.classList.add("unsupported");
    micBtn.addEventListener("click", () => {
      _askChatTarget = "kashviChat";
      askDataAppendMessage("Voice input is not supported in this browser - please type your query.", false);
    });
    return;
  }
  let rec = null, listening = false;
  const stop = () => { listening = false; micBtn.classList.remove("listening"); input.placeholder = "Type or speak your query..."; };
  micBtn.addEventListener("click", () => {
    if (listening && rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = "en-IN";              // Indian English - Hinglish comes out in English letters
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = "";
    rec.onstart = () => { listening = true; micBtn.classList.add("listening"); input.value = ""; input.placeholder = "Listening..."; };
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      input.value = (finalText + interim).trim();
    };
    rec.onerror = (e) => {
      stop();
      const msg = e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "Microphone permission is off - allow the microphone for this app and try again."
        : e.error === "no-speech" ? "I didn't hear anything - tap the mic and speak again."
        : e.error === "network" ? "Voice input needs internet - please check the connection." : "";
      if (msg) { _askChatTarget = "kashviChat"; askDataAppendMessage(msg, false); }
    };
    rec.onend = () => {
      stop();
      if (input.value.trim()) document.getElementById("kashviSend").click(); // ask automatically
    };
    try { rec.start(); } catch (e) { stop(); }
  });
  // stop listening if the chat box is closed
  document.getElementById("kashviClose").addEventListener("click", () => { if (listening && rec) rec.abort(); });
})();

/* ===================== ANY QUERY: Excel numbers (any date / month, consumption, stock) ===================== */
const AQ_MONTHS = { jan:0, january:0, feb:1, february:1, mar:2, march:2, apr:3, april:3, may:4, jun:5, june:5, jul:6, july:6,
  aug:7, august:7, sep:8, sept:8, september:8, oct:9, october:9, nov:10, november:10, dec:11, december:11 };
function aqISO(d) { return localDateToISO(d); }
function aqLabel(a, b) {
  const f = (x) => x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return a.getTime() === b.getTime() ? f(a) : `${f(a)} to ${f(b)}`;
}
// Finds the period in a question. Returns { from: Date, to: Date, label } or null.
// common spoken / typed variants -> one form ("cal ka" = "kal ka", "aj" = "aaj", "yesterdy" ...)
function aqNormalize(q) {
  return String(q).toLowerCase()
    .replace(/\b(cal|kl|kall|kaal|yesterdy|yestarday|yesturday|yday)\b/g, "kal")
    .replace(/\b(aj|tday)\b/g, "aaj")
    .replace(/\b(parso|parson|parsoo|parsu)\b/g, "parso");
}
function aqParsePeriod(q) {
  q = aqNormalize(q);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (/\bparso\b|day before yesterday/.test(q)) { const y = new Date(now); y.setDate(y.getDate() - 2); return { from: y, to: y, label: aqLabel(y, y) }; }
  const day = (y, m, d) => new Date(y, m, d);
  const yearFix = (y) => (y ? (y < 100 ? 2000 + y : y) : null);
  const guessYear = (m, d) => { // a date "ahead" of today means last year
    const y = now.getFullYear();
    return day(y, m, d || 1) > now ? y - 1 : y;
  };
  const dates = [];
  // 15/9/2026, 15-09-26, 15.9
  q.replace(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/g, (all, d, m, y) => {
    if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) dates.push(day(yearFix(+y) || guessYear(+m - 1, +d), +m - 1, +d));
    return all;
  });
  // 15 september 2026, 15 sep
  q.replace(/\b(\d{1,2})(?:st|nd|rd|th)?\s*([a-z]{3,9})\b(?:\s*(\d{4}|'\d{2}))?/g, (all, d, mn, y) => {
    if (mn in AQ_MONTHS) { const m = AQ_MONTHS[mn]; const yy = y ? yearFix(parseInt(y.replace("'", ""), 10)) : guessYear(m, +d); dates.push(day(yy, m, +d)); }
    return all;
  });
  if (dates.length >= 2) { dates.sort((a, b) => a - b); return { from: dates[0], to: dates[dates.length - 1], label: aqLabel(dates[0], dates[dates.length - 1]) }; }
  if (dates.length === 1) return { from: dates[0], to: dates[0], label: aqLabel(dates[0], dates[0]) };

  if (/\b(today|aaj)\b/.test(q)) return { from: now, to: now, label: aqLabel(now, now) };
  if (/\b(yesterday|kal)\b/.test(q)) { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: y, to: y, label: aqLabel(y, y) }; }
  let m = /\blast\s+(\d{1,3})\s+days?\b/.exec(q) || /\bpichh?le\s+(\d{1,3})\s+din\b/.exec(q);
  if (m) { const f = new Date(now); f.setDate(f.getDate() - (+m[1] - 1)); return { from: f, to: now, label: aqLabel(f, now) }; }
  if (/\b(last|pichh?le)\s+(month|mahine)\b/.test(q)) {
    const f = day(now.getFullYear(), now.getMonth() - 1, 1), t = day(now.getFullYear(), now.getMonth(), 0);
    return { from: f, to: t, label: aqLabel(f, t) };
  }
  // a month name alone: "september", "sep 2026"
  m = /\b(january|february|march|april|may|june|july|august|september|sept|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b(?:\s*(\d{4}|'\d{2}))?/.exec(q);
  if (m) {
    const mo = AQ_MONTHS[m[1]];
    const y = m[2] ? yearFix(parseInt(m[2].replace("'", ""), 10)) : guessYear(mo, 1);
    const f = day(y, mo, 1); let t = day(y, mo + 1, 0); if (t > now) t = now;
    return { from: f, to: t, label: aqLabel(f, t) };
  }
  if (/\b(this|is)\s+(month|mahine|maheene)\b/.test(q) || /\b(average|avg|total)\b/.test(q)) {
    const f = day(now.getFullYear(), now.getMonth(), 1);
    return { from: f, to: now, label: aqLabel(f, now) };
  }
  return null;
}

function aqFindItems(q) {
  const hits = STOCK_ITEMS.filter(it => q.includes(it.name.toLowerCase().split(",")[0].replace(/ee/g, "e")) || q.includes(it.name.toLowerCase().split(",")[0]));
  const alias = [
    [/\bsimn|silico\s*mang/, "Silico Manganeese"], [/\blumps?\b/, "Lumps"], [/\bfines?\b/, "Fines"], [/\bpellets?\b/, "Pellets"],
    [/\bpig\s*iron\b/, "Pig Iron"], [/\bci\s*mix\b/, "CI Mix Scrap"], [/\bsms\s*scrap|steel\s*melting/, "Steel Melting Scrap"],
    [/\bms\s*scrap\b/, "MS Scrap"], [/\brolling\s*mill\s*scrap\b/, "MS Scrap - Rolling Mill"], [/\bmag(netic)?\s*material\b/, "Mag Material"],
    [/\bmill\s*scale\b/, "Mill Scale-SMS"], [/\bbag\s*filter|fes\s*dust\b/, "Bag Filter Dust"], [/\braw\s*slag\b/, "Raw Slag"],
    [/\bover\s*size\b/, "Over Size Sponge"], [/\bslag\s*waste\b/, "Slag Waste"], [/\bslag\s*jaam\b/, "Slag Jaam"], [/\bslag\s*metal\b/, "Slag Metal Fines, Size: 1mm to 3mm"]
  ];
  alias.forEach(([re, name]) => { if (re.test(q) && !hits.some(h => h.name === name)) { const it = STOCK_ITEMS.find(x => x.name === name); if (it) hits.push(it); } });
  // "ms scrap" should not also pull "ms scrap - rolling mill" unless asked
  return hits;
}

async function aqProdMetric(token, from, to, metricKey) {
  const list = await getWorkbooksForRange(token, aqISO(from), aqISO(to));
  const wbs = (list && list.results) || [];
  const colMap = { c: 2, mn: 3, si: 4, s: 5, p: 6, production: 27, rolled: 20 }; // rolled = Hot Charging qty (col U)
  let sum = 0, count = 0;
  for (const sub of wbs) {
    const values = (await graphFetch(`${sub.wb}/worksheets('Prod.')/range(address='A1:AB2000')?$select=values`, token)).values;
    // The date is written only once per block (first heat row, col A); the
    // other heat rows of that day have A blank. So carry the block's date
    // down to every heat row (col B = heat no. like 5.10.3) until the next
    // block starts ("TOTAL PROD SHEET" title in col M). MIN / MAX / TOTAL
    // rows are skipped because their col B is not a heat number.
    let curISO = null;
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      if (/total\s*prod\s*sheet/i.test(String(row[12] || ""))) { curISO = null; continue; }
      if (typeof row[0] === "number" && row[0] > 40000) curISO = excelSerialToISODate(row[0]);
      if (!curISO || curISO < sub.fromDate || curISO > sub.toDate) continue;
      if (!HEAT_NO_RE.test(String(row[1] || ""))) continue;
      const v = row[colMap[metricKey]];
      if (typeof v === "number" && v > 0) { sum += v; count++; } // empty heats give 0 / "" - not counted
    }
  }
  if (!count) return null;
  return { value: (metricKey === "production" || metricKey === "rolled") ? sum : sum / count, heats: count };
}

// Returns an answer string, or null if the question is not about Excel numbers.
// ---- one heat's full details: "kal ke 6th heat ...", "heat 7.10.6", "5 oct heat no 3" ----
function aqHeatRequest(q) {
  // explicit heat key d.m.n
  let m = /\b(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\b/.exec(q);
  if (m && /\bheat|h\.?\s*no|\bhno\b/.test(q)) {
    const now = new Date(); let y = now.getFullYear();
    if (new Date(y, +m[2] - 1, +m[1]) > now) y -= 1;
    return { day: new Date(y, +m[2] - 1, +m[1]), n: +m[3] };
  }
  m = /\b(\d{1,2})\s*(?:st|nd|rd|th|vi|va|vi|wa|wi)?\s*(?:no\.?\s*)?heat\b/.exec(q) ||
      /\bheat\s*(?:no\.?|number|nomber|num|#)?\s*(\d{1,2})\b(?!\s*[\/.\-]\s*\d)/.exec(q) ||
      /\bh\.?\s*no\.?\s*(\d{1,2})\b(?!\s*[\/.\-]\s*\d)/.exec(q);
  if (!m) return null;
  const n = +m[1];
  if (!(n >= 1 && n <= 30)) return null;
  // period from the rest of the sentence (heat number removed so it is not read as a date)
  const p = aqParsePeriod(q.replace(m[0], " "));
  return { day: p ? p.from : null, n, period: p };
}
function aqHeatKeyNorm(v) {
  const parts = String(v == null ? "" : v).replace(/\s+/g, "").replace(/^h\.?no\.?/i, "").split(".").filter(Boolean);
  return parts.length === 3 ? parts.map(x => String(parseInt(x, 10))).join(".") : "";
}
async function aqHeatDetails(token, day, n) {
  const key = `${day.getDate()}.${day.getMonth() + 1}.${n}`;
  const list = await getWorkbooksForRange(token, aqISO(day), aqISO(day));
  const wbs = (list && list.results) || [];
  if (!wbs.length) return `No production file found for ${aqLabel(day, day)}.`;
  const values = (await graphFetch(`${wbs[0].wb}/worksheets('Prod.')/range(address='A1:AH2000')?$select=values`, token)).values;
  const idx = values.findIndex(r => aqHeatKeyNorm(r[1]) === key);
  if (idx < 0) return `Heat ${key} (${aqLabel(day, day)}) is not in the Prod. sheet yet.`;
  const r = values[idx];
  let hdr = null; // nearest header row above (col B = "H.No.") for the size group name in J
  for (let i = idx - 1; i >= 0; i--) if (/^h\.?\s*no/i.test(String(values[i][1] || "").trim())) { hdr = values[i]; break; }
  const num = (v) => (typeof v === "number" ? v : (v === "" || v == null ? 0 : parseFloat(v) || 0));
  const mt = (v) => num(v).toFixed(3);
  const pcs = (a) => [3, 4, 5, 6].map((L, i) => `${L}M ${num(r[a + i])}`).join(" · ");
  const chem = ["C", "Mn", "Si", "S", "P"].map((e, i) => `${e} ${r[2 + i] === "" || r[2 + i] == null ? "-" : r[2 + i]}`).join(" · ");
  const grpName = hdr && String(hdr[9] || "").trim() ? String(hdr[9]).trim() : "Billets (J-M)";
  return [
    `Heat ${key} - ${aqLabel(day, day)}`,
    `Chemistry: ${chem}`,
    `Size: ${r[7] === "" || r[7] == null ? "-" : r[7]}`,
    `${grpName}: ${pcs(9)} → ${mt(r[14])} MT`,
    `Hot Charging: ${pcs(15)} → ${mt(r[20])} MT`,
    `Bypass: ${pcs(21)} → ${mt(r[26])} MT`,
    `Total Prod: ${mt(r[27])} MT`,
    `Hot Out: ${pcs(28)} → ${mt(r[33])} MT`
  ].join("\n");
}

// ---- RHF billets fed: daily block -> MAX row (130, J-M pcs, O qty) and the
// next row (160, J-M pcs; its O = 160 qty + 130 qty = day's RHF total) ----
async function aqRhf(token, from, to) {
  const list = await getWorkbooksForRange(token, aqISO(from), aqISO(to));
  const wbs = (list && list.results) || [];
  const num = (v) => (typeof v === "number" ? v : 0);
  let total = 0, q130 = 0, days = 0;
  const pcs130 = [0, 0, 0, 0], pcs160 = [0, 0, 0, 0];
  for (const sub of wbs) {
    const values = (await graphFetch(`${sub.wb}/worksheets('Prod.')/range(address='A1:AB2000')?$select=values`, token)).values;
    let curISO = null;
    for (let i = 0; i < values.length - 1; i++) {
      const row = values[i];
      if (/total\s*prod\s*sheet/i.test(String(row[12] || ""))) { curISO = null; continue; }
      if (typeof row[0] === "number" && row[0] > 40000) curISO = excelSerialToISODate(row[0]);
      if (!curISO || curISO < sub.fromDate || curISO > sub.toDate) continue;
      if (String(row[1] || "").trim().toUpperCase() !== "MAX") continue;
      const next = values[i + 1];
      days++;
      q130 += num(row[14]);
      total += num(next[14]);
      for (let k = 0; k < 4; k++) { pcs130[k] += num(row[9 + k]); pcs160[k] += num(next[9 + k]); }
    }
  }
  if (!days) return null;
  return { total, q130, q160: total - q130, pcs130, pcs160, days };
}

async function answerExcelQuery(question) {
  const q = " " + question.toLowerCase().replace(/[?,]/g, " ") + " ";
  if (/\brhf\b/.test(q) && !/\b(report|pdf)\b/.test(q)) {
    if (!account) return null;
    const pr = aqParsePeriod(q);
    if (!pr) return `RHF feed for which date or period? e.g. "RHF billet feed yesterday", "september RHF".`;
    const r = await aqRhf(await getToken(), pr.from, pr.to);
    if (!r) return `${pr.label}: no RHF block found in the Prod. sheet.`;
    const pc = (a) => [3, 4, 5, 6].map((L, i) => `${L}M ${a[i]}`).join(" · ");
    return `${pr.label}: RHF billet feed ${r.total.toFixed(3)} MT` + (r.days > 1 ? ` (${r.days} days)` : "") +
      `\n130: ${pc(r.pcs130)} → ${r.q130.toFixed(3)} MT\n160: ${pc(r.pcs160)} → ${r.q160.toFixed(3)} MT`;
  }
  const heatReq = aqHeatRequest(aqNormalize(q));
  if (heatReq) {
    if (!account) return null;
    if (!heatReq.day) return `Heat no. ${heatReq.n} of which date? e.g. "5 oct heat ${heatReq.n}" or "heat 5.10.${heatReq.n}".`;
    const det = await aqHeatDetails(await getToken(), heatReq.day, heatReq.n);
    // "rolled" = Hot Charging: put that figure first when asked
    if (/\b(rolled|rolling|roll|hot\s*charg\w*)\b/.test(q)) {
      const hc = /^Hot Charging: (.*) → ([\d.]+) MT$/m.exec(det);
      if (hc) return `Rolled (Hot Charging): ${hc[2]} MT  (${hc[1]})\n\n` + det;
    }
    return det;
  }
  const period = aqParsePeriod(q);
  const items = aqFindItems(q);
  const wantStock = /\b(stock|balance|closing|bacha|bachi)\b/.test(q);
  const wantIn = /\b(incoming|received|receipt|inward|aaya|aayi|aamad)\b/.test(q);
  const wantCons = /\b(consumption|consumed|consume|use[d]?|khapat|kharch)\b/.test(q);
  let metricKey = null, metricLabel = "";
  if (/\b(rolled|rolling|roll|hot\s*charg\w*)\b/.test(q)) { metricKey = "rolled"; metricLabel = "Rolled (Hot Charging)"; }
  else if (/\b(production|output|utpadan|prod)\b/.test(q)) { metricKey = "production"; metricLabel = "Total production"; }
  else if (/\bmn%|\bmn\b|manganese\b/.test(q) && !items.length) { metricKey = "mn"; metricLabel = "Average Mn%"; }
  else if (/\bc%|\bcarbon\b/.test(q)) { metricKey = "c"; metricLabel = "Average C%"; }
  else if (/\bsi%|\bsilicon\b/.test(q)) { metricKey = "si"; metricLabel = "Average Si%"; }
  else if (/\bs%|\bsulph?ur\b|\bsulfur\b/.test(q)) { metricKey = "s"; metricLabel = "Average S%"; }
  else if (/\bp%|\bphosphorus\b/.test(q)) { metricKey = "p"; metricLabel = "Average P%"; }

  const isRm = items.length || wantStock || wantIn || wantCons;
  if (!metricKey && !isRm) return null;          // not an Excel question
  if (!account) {                                // not signed in: never redirect to login from the chat
    return (period && (metricKey || wantStock || wantIn || wantCons))
      ? "Production / stock figures come from the plant's Excel files and need sign-in. Standards and SOPs can be asked without signing in."
      : null;
  }
  if (!period) {
    // without a date it is usually a question about the app / a standard
    if ((items.length && (wantStock || wantIn || wantCons)) || metricKey === "production")
      return "Please add a date or period - e.g. today, yesterday, 15 Sep, 1/9 to 15/9, September, last month, last 7 days.";
    return null;
  }
  const token = await getToken();

  if (metricKey && !isRm) {
    const r = await aqProdMetric(token, period.from, period.to, metricKey);
    if (!r) return `${metricLabel} for ${period.label}: NOT FOUND (no heats in the Prod. sheet for that period).`;
    if (metricKey === "rolled") return `${period.label}: ${r.heats} heat${r.heats === 1 ? "" : "s"} me ${r.value.toFixed(3)} MT rolled (Hot Charging)`;
    return metricKey === "production"
      ? `${period.label}: ${r.heats} heat${r.heats === 1 ? "" : "s"} me ${r.value.toFixed(3)} MT production`
      : `${metricLabel} for ${period.label}: ${r.value.toFixed(3)} % (average of ${r.heats} heat(s))`;
  }

  // Raw material: incoming / consumption / stock - same calculation as the Stock report
  const list = await getWorkbooksForRange(token, aqISO(period.from), aqISO(period.to));
  const wbs = (list && list.results) || [];
  if (!wbs.length) return `No month file found for ${period.label} (NOT FOUND).`;
  const missNote = list.missing && list.missing.length ? `\n(No file for: ${list.missing.join(", ")})` : "";
  const names = (items.length ? items : STOCK_ITEMS).map(i => i.name);
  const rows = await computeStockRowsForItems(wbs, names, null, token);
  const show = (!wantIn && !wantCons && !wantStock) ? ["consumption"] :
    [wantIn && "incoming", wantCons && "consumption", wantStock && "closing"].filter(Boolean);
  const lab = { incoming: "Incoming", consumption: "Consumption", closing: "Closing stock" };
  const lines = rows
    .filter(r => items.length || show.some(k => Math.abs(r[k] || 0) > 0.0005))
    .map(r => `• ${r.name}: ` + show.map(k => `${lab[k]} ${(r[k] || 0).toFixed(3)} MT`).join(", "));
  if (!lines.length) return `Nothing recorded for ${period.label}.`;
  return `${period.label}${wantStock ? " (closing on " + aqLabel(period.to, period.to) + ")" : ""}:\n` + lines.join("\n") + missNote;
}

// Kashvi: chat box opened from the floating sticker
function openKashvi() {
  if (document.body.classList.contains("userMode")) return;   // Kashvi only for the owner's accounts
  const p = document.getElementById("kashviPanel");
  p.classList.remove("hidden");
  document.body.classList.add("kashviOpen");
  const chat = document.getElementById("kashviChat");
  if (!chat.dataset.greeted) {
    chat.dataset.greeted = "1";
    _askChatTarget = "kashviChat";
    askDataAppendMessage("Hi, I am Kashvi, how may I help you?\nAsk for any report with a date, e.g. \"logsheet 1 to 15 october\", \"MIS august\", \"today's summary\".", false);
    if (!account) askDataAppendMessage("You can ask me about Indian Standards and SOPs without signing in. Plant figures need sign-in.", false);
  }
  setTimeout(() => document.getElementById("kashviInput").focus(), 200);
}
function closeKashvi() {
  kvStopSpeaking();
  document.getElementById("kashviPanel").classList.add("hidden");
  document.body.classList.remove("kashviOpen");
}
document.getElementById("kashviClose").addEventListener("click", closeKashvi);
document.getElementById("kashviSend").addEventListener("click", async () => {
  const input = document.getElementById("kashviInput");
  const q = input.value.trim();
  if (!q) return;
  input.value = "";
  _askChatTarget = "kashviChat";
  await answerAnyQuery(q);
});
document.getElementById("kashviInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("kashviSend").click();
});

/* ===================== ANY QUERY: search everything inside the app ===================== */
// App-usage notes (features whose explanation is not written on screen).
// SOPs: add entries here - they are searchable by Kashvi for everyone
// (signed in or not). Format:
// { id: "sop-xxx", no: "SOP/QAD/01", title: "...", dept: "QAD-SMS", rev: "00", date: "2026-10-06",
//   purpose: "...", scope: "...", steps: ["...", "..."], records: ["..."], keywords: "..." }
let SOP_LIST = [], SOP_LOADED = false;   // the SOP / WI texts (~1.3 MB) come from data/sop_list.json - see loadSopList() below
const SOP_REQ = {"SOP-01": {"c": [], "g": [["Double scoop", ""], ["Agate mortar and pestle", ""], ["Test sieve (IS sieve)", "150 micron"], ["Test sieve (IS sieve)", "212 micron"], ["Air tight container", ""]], "i": [["Sampling device", "width 6 times nominal top size"], ["Mechanically assisted increment sampling device", "for moving conveyor"], ["Jaw crusher", ""], ["Cone crusher", ""], ["Vertical mill ring grinder", ""], ["Double cone mixer", ""], ["Riffle divider / splitter", ""], ["Scoop crusher", ""], ["Disc pulverizer / disc grinder", ""]], "k": [["Plastic sheet / tarpaulin", ""]]}, "SOP-02": {"c": [], "g": [["Small mould", "for liquid-metal spoon samples"], ["Sampling spoon", ""], ["Square frame", "each side at least 3 times largest lump size"], ["Test sieve (IS sieve)", "5 mm"], ["Test sieve (IS sieve)", "150 micron"], ["Hardened alloy steel mortar and pestle", ""], ["Sampling scoop", ""], ["Smooth flat plate", "non-moisture absorbing"], ["Bumper plate", ""]], "i": [["Riffle divider / splitter", "different sizes"], ["Sample cutter", ""]], "k": [["Glazed paper", ""]]}, "SOP-03": {"c": [], "g": [["Shovel", ""]], "i": [["Riffle (quartering - coning) sampler", ""], ["Balance (laboratory)", "10 kg capacity, ± 0.1 g"]], "k": []}, "SOP-04": {"c": [], "g": [["Sampling spoon", "non-contaminating material"], ["Mortar", ""], ["Percussion mortar", ""], ["Crucible", "pre-heated, for melting"], ["Glass bottle", "wide-mouthed, well stoppered"]], "i": [["Saw", ""], ["Drill", ""], ["Milling cutter", ""], ["Magnet (hand magnet)", "strong"], ["Jaw crusher", ""], ["Roll crusher", ""]], "k": [["Paper sample envelope", "tight, leakproof"], ["Cardboard carton", ""]]}, "SOP-05": {"c": [], "g": [["Sample container", "clean, dry, with proper closure, air-tight sealable"]], "i": [["Sampling instrument", ""]], "k": []}, "WI-01": {"c": [["Oxygen", "pure"], ["Tin (granules / shots)", "pure"], ["Iron filings", "pure, 99.99 percent"], ["Methyl red", ""], ["Acidulated water / brine water", "for burette filling"], ["Potassium hydroxide", "caustic potash"], ["Sulphur gas absorbent", "suitable"], ["Ether", ""], ["Acetone", ""], ["Standard steel", "suitable carbon value"]], "g": [["Combustion boat", "porcelain, withstands 1 150 °C / 1 250 °C"], ["Combustion tube", ""], ["Gas measuring burette", "special jacketed, with bulb, reads percent carbon for 1 g, bend way stopcock"], ["Levelling bottle", ""], ["Absorbing bulb", "caustic potash"]], "i": [["Carbon by direct combustion apparatus", "as per IS 6226 (Part 1)"], ["Combustion furnace", "1 000 °C to 1 250 °C"], ["Oxygen flow control", "300 ml to 400 ml per minute"], ["Air oven", "100 °C ± 5 °C"], ["Analytical balance", ""]], "k": [["Rubber stopper / bung", "for furnace inlet"]]}, "WI-02": {"c": [["Nitric acid", "rd 1.42"], ["Phosphoric acid", "85 percent"], ["Sulphuric acid", ""], ["Ammonium persulphate", "analytical grade"], ["Silver nitrate", "analytical grade"], ["Sodium chloride", "analytical grade"], ["Sodium arsenite", "for standard sodium arsenite solution (user lab practice)"], ["Arsenious oxide", "analytical grade"], ["Sodium carbonate", "analytical grade"], ["Standard steel", "known manganese content, similar composition"], ["Distilled / reagent grade water", "IS 1070"]], "g": [["Conical flask", "250 ml"], ["Beaker", "800 ml"], ["Bottle", "2 litre"], ["Burette", ""]], "i": [["Analytical balance", ""], ["Heating arrangement", ""]], "k": [["Filter pad", ""]]}, "WI-03": {"c": [["Nitric acid", "rd 1.42"], ["Hydrochloric acid", "rd 1.16"], ["Hydrofluoric acid", "40 percent"], ["Perchloric acid", "70 percent"], ["Sulphuric acid", ""], ["Hydrobromic acid", ""], ["Ammonium hydroxide (ammonia solution)", "rd 0.90"], ["Potassium permanganate", "analytical grade"], ["Sodium nitrite", "analytical grade"], ["Molybdic acid", "MoO3, 85 percent (or ammonium molybdate)"], ["Ammonium molybdate", "analytical grade"], ["Ammonium phosphate", "analytical grade"], ["Potassium nitrate", "analytical grade"], ["Phenolphthalein", "powder"], ["Ethanol / alcohol (absolute alcohol, rectified spirit)", "or methyl alcohol"], ["Methanol", "or rectified spirit"], ["Sodium hydroxide", "analytical grade"], ["Sodium carbonate", "analytical grade"], ["Ferrous sulphate", "FeSO4.7H2O crystals"], ["Sulphur dioxide", "gas"], ["Distilled / reagent grade water", "IS 1070"]], "g": [["Conical flask", "250 ml"], ["Conical flask", "500 ml"], ["Beaker", "400 ml"], ["Platinum crucible", ""]], "i": [["Water bath", "cold"], ["Hot plate", ""], ["Suction filtration apparatus", ""]], "k": [["Filter paper", "Whatman No. 40"], ["Filter paper", "Whatman No. 42"], ["Filter paper pulp", ""]]}, "WI-04": {"c": [["Nitric acid", "rd 1.42"], ["Sulphuric acid", "rd 1.84"], ["Hydrochloric acid", ""], ["Hydrofluoric acid", "40 percent"], ["Perchloric acid", "70 percent"], ["Tartaric acid", "analytical grade"], ["Silver nitrate", "analytical grade"], ["Distilled / reagent grade water", ""]], "g": [["Porcelain casserole", "300 ml"], ["Beaker", "500 ml"], ["Beaker", ""], ["Platinum crucible", ""], ["Desiccator", ""]], "i": [["Air oven", "110 °C"], ["Muffle furnace", "750 °C / 1 050 °C"], ["Balance (laboratory)", ""]], "k": [["Filter paper", "medium textured"], ["Filter paper pulp", ""]]}, "WI-05": {"c": [["Argon", "99.995 percent minimum"], ["Magnesium / Titanium (Mg/Ti)", "for argon purifier furnace"], ["Primary standard samples", "spectrographic standards, low and high alloy"], ["Working standard samples", "same metallurgical condition as samples"]], "g": [["Cast-iron mould", ""], ["Copper mould", "single or split type"], ["Immersion / lollypop sampler", ""]], "i": [["Optical emission spectrometer", "vacuum type, 1 700 to 4 000 Å"], ["Counter electrode", "pure silver or thoriated tungsten"], ["Spark stand", "with argon flow, water cooled"], ["Excitation source", "controlled high voltage capacitor discharge"], ["Argon purifier furnace", "reducing atmosphere, 425/450 °C"], ["Cutting machine", ""], ["Grinding machine", ""]], "k": [["Grit paper", "60/120"], ["Molecular sieves", ""]]}, "WI-06": {"c": [["Cadmium chloride", ""], ["Ammonium hydroxide (ammonia solution)", "sp gr 0.66 (as written)"], ["Sodium thiosulphate", ""], ["Sodium bicarbonate", ""], ["Potassium dichromate", "pure"], ["Sulphuric acid", ""], ["Potassium iodide", ""], ["Potassium iodate", "alternative for iodine solution"], ["Hydrochloric acid", "sp gr 1.16, free from Cl2 and FeCl3"], ["Starch", "indicator, freshly prepared"], ["Distilled / reagent grade water", ""]], "g": [["Flat bottom flask", "500 ml"], ["Thistle funnel", ""], ["Delivery tube", ""], ["Absorption vessel", "to hold 200 ml"], ["Burette", ""]], "i": [], "k": [["Rubber stopper / bung", "to hold thistle funnel and delivery tube"]]}, "WI-07": {"c": [["Oxygen", "pure, dried"], ["Methyl red", "salt"], ["Ethanol / alcohol (absolute alcohol, rectified spirit)", ""], ["Silver nitrate", ""], ["Sodium hydroxide", ""], ["Tin (granules / shots)", ""], ["Standard sample", "known sulphur content"], ["Distilled / reagent grade water", ""]], "g": [["Combustion boat", "porcelain"], ["Conical flask", "250 ml"], ["Burette", ""]], "i": [["Combustion furnace", "tube type, silicon carbide heating rods, 1 200 °C"], ["Dried oxygen supply", "1 to 3 l/min"]], "k": []}, "WI-10": {"c": [["Ferric chloride", "FeCl3.6H2O"], ["Hydrochloric acid", "rd 1.16"], ["Phosphoric acid", "rd 1.75"], ["Sulphuric acid", ""], ["Barium diphenylamine sulphonate", ""], ["Sodium sulphate", ""], ["Sodium diphenylamine sulphonate", "alternative indicator, 0.2 percent"], ["Potassium dichromate", "dried at 100 to 110 °C"], ["Nitrogen", "gas"]], "g": [["Conical flask", "500 ml, with stopper"], ["Beaker", "1 litre"], ["Volumetric flask", "1 000 ml"], ["Burette", ""], ["Amber / brown / dark glass bottle", ""], ["Stirring bar", "polypropylene coated"]], "i": [["Magnetic stirrer", ""]], "k": [["Filter paper", "medium texture"]]}, "WI-11": {"c": [["Bromine", ""], ["Methanol", "water-free"], ["Stannous chloride", "pure"], ["Tin (granules / shots)", ""], ["Hydrochloric acid", "rd 1.16"], ["Mercuric chloride", ""], ["Potassium dichromate", "dried at 100 to 110 °C"], ["Barium diphenylamine sulphonate", ""], ["Sodium sulphate", ""], ["Sodium diphenylamine sulphonate", "alternative indicator, 0.2 percent"], ["Sulphuric acid", "rd 1.84"], ["Phosphoric acid", "rd 1.71"], ["Potassium permanganate", "for 0.1 N solution"], ["Distilled / reagent grade water", ""]], "g": [["Ground glass joint flask", "500 ml"], ["Reflux condenser", ""], ["Watch glass", ""], ["Volumetric flask", "1 000 ml"], ["Burette", ""], ["Filtration assembly", ""], ["Amber / brown / dark glass bottle", "air-tight"], ["Amber / brown / dark glass bottle", ""]], "i": [], "k": [["Filter paper", ""]]}, "WI-13": {"c": [["Hydrochloric acid", "rd 1.16"], ["Nitric acid", "rd 1.42"], ["Sulphuric acid", "concentrated"], ["Hydrofluoric acid", "40 percent"], ["Perchloric acid", "rd 1.67 (70 percent m/m)"], ["Phosphoric acid", "syrupy"], ["Sodium carbonate", "solid, AR"], ["Potassium bisulphate", "solid, AR"], ["Ammonium chloride", "solid, AR"], ["Ammonium hydroxide (ammonia solution)", "rd 0.89"], ["Sodium diphenylamine sulphonate", "powdered"], ["Potassium dichromate", "minimum purity 99.9 percent (m/m)"], ["Stannous chloride", "pure"], ["Tin (granules / shots)", ""], ["Mercuric chloride", ""], ["Potassium permanganate", "for 0.1 N solution"], ["Iron (pure)", "minimum purity 99.9 percent (m/m)"], ["Hydrogen peroxide", "30 percent (m/m)"], ["Calcium chloride", "desiccant, calcined at 700 °C to 800 °C"], ["Certified standard sample of iron ore (SRM)", "similar iron content"], ["Distilled / reagent grade water", "IS 1070 (or de-ionized)"]], "g": [["Beaker", "400 ml"], ["Conical flask", "500 ml"], ["Volumetric flask", "250 ml"], ["Volumetric flask", "1 000 ml"], ["Pipette", "one-mark, 1.0 ml"], ["Pipette", "one-mark, 50 ml"], ["Burette", ""], ["Measuring cylinder", ""], ["Watch glass", ""], ["Funnel", "small"], ["Petri dish", "glass, aluminium or stainless steel, with cover"], ["Desiccator", ""], ["Platinum crucible", ""], ["Glass rod", "rubber tipped / policeman"], ["Amber / brown / dark glass bottle", ""], ["Amber / brown / dark glass bottle", "air-tight"], ["Test sieve (IS sieve)", "150 micron IS sieve"], ["Plastic bottle", "10 litre (3 nos, mercury waste)"]], "i": [["Analytical balance", "200 g max, 0.1 mg"], ["Air oven", "105 °C ± 5 °C"], ["Air bath", "140 °C"], ["Hot plate", ""], ["Sand bath", ""], ["Muffle furnace", "1 050 °C"]], "k": [["Filter paper", "medium texture, low ash"], ["Filter paper", "No. 40"], ["Non-absorbent paper", ""], ["Aluminium or iron rods", "3 kg per bottle, mercury removal"]]}, "WI-14": {"c": [["Hydrochloric acid", "rd 1.16"], ["Nitric acid", "rd 1.42"], ["Sulphuric acid", ""], ["Hydrofluoric acid", "40 percent"], ["Perchloric acid", "rd 1.67 (70 percent m/m)"], ["Phosphoric acid", ""], ["Sodium carbonate", "solid, AR"], ["Potassium bisulphate", "solid, AR"], ["Ammonium chloride", "solid, AR"], ["Ammonium hydroxide (ammonia solution)", "rd 0.89"], ["Methyl red", "indicator"], ["Sodium diphenylamine sulphonate", "powdered"], ["Potassium dichromate", "minimum purity 99.9 percent (m/m)"], ["Iron (pure)", "minimum purity 99.9 percent (m/m)"], ["Hydrogen peroxide", "30 percent (m/m)"], ["Silver nitrate", "AR"], ["Calcium chloride", "desiccant, calcined at 700 °C to 800 °C"], ["Certified standard sample of iron ore (SRM)", "similar iron content"], ["Distilled / reagent grade water", "IS 1070 (or de-ionized)"]], "g": [["Beaker", "400 ml"], ["Beaker", "600 ml"], ["Conical flask", "500 ml"], ["Volumetric flask", "250 ml"], ["Volumetric flask", "1 000 ml"], ["Pipette", "one-mark, 1.0 ml"], ["Pipette", "one-mark, 50 ml"], ["Burette", ""], ["Measuring cylinder", ""], ["Watch glass", ""], ["Funnel", "small"], ["Petri dish", "glass, aluminium or stainless steel, with cover"], ["Desiccator", ""], ["Platinum crucible", ""], ["Glass rod", "rubber tipped / policeman"], ["Amber / brown / dark glass bottle", ""], ["Test sieve (IS sieve)", "150 micron IS sieve"], ["Silver reductor column", "pyrex glass tube 12 cm x 2 cm, glass stopper, 6 cm cup"], ["Perforated ceramic disc", "for reductor column"]], "i": [["Analytical balance", "200 g max, 0.1 mg"], ["Air oven", "105 °C ± 5 °C"], ["Air bath", "140 °C"], ["Hot plate", ""], ["Sand bath", ""], ["Muffle furnace", "1 050 °C"]], "k": [["Filter paper", "medium texture, low ash"], ["Filter paper", "No. 40"], ["Non-absorbent paper", ""], ["Zinc rods", "2 nos, about 15 cm long, 5 mm to 6 mm diameter"], ["Glass wool", ""]]}, "WI-15": {"c": [["Hydrochloric acid", "rd 1.16"], ["Nitric acid", "rd 1.42"], ["Sulphuric acid", "concentrated"], ["Hydrofluoric acid", "40 percent"], ["Perchloric acid", "rd 1.67 (70 percent m/m)"], ["Perchloric acid", "rd 1.7 (Option 2)"], ["Phosphoric acid", "syrupy"], ["Sodium carbonate", "solid, AR"], ["Potassium bisulphate", "solid, AR"], ["Sodium diphenylamine sulphonate", "powdered"], ["Barium diphenylamine sulphonate", "alternative indicator"], ["Potassium dichromate", "minimum purity 99.9 percent (m/m)"], ["Stannous chloride", "pure"], ["Tin (granules / shots)", ""], ["Potassium permanganate", "AR"], ["Iron (pure)", "minimum purity 99.9 percent (m/m)"], ["Hydrogen peroxide", "30 percent"], ["Titanium (III) chloride solution", "about 20 percent TiCl3"], ["Titanium sponge", "alternative for TiCl3 solution"], ["Indigo carmine", "disodium salt"], ["Calcium chloride", "desiccant, calcined at 700 °C to 800 °C"], ["Certified standard sample of iron ore (SRM)", "similar iron content"], ["Distilled / reagent grade water", "IS 1070 (or de-ionized)"]], "g": [["Beaker", "400 ml"], ["Conical flask", "500 ml"], ["Volumetric flask", "250 ml"], ["Volumetric flask", "1 000 ml"], ["Pipette", "one-mark, 1.0 ml"], ["Pipette", "one-mark, 50 ml"], ["Burette", ""], ["Measuring cylinder", ""], ["Watch glass", ""], ["Funnel", "small"], ["Petri dish", "glass, aluminium or stainless steel, with cover"], ["Desiccator", ""], ["Platinum crucible", ""], ["Glass rod", "rubber tipped / policeman"], ["Amber / brown / dark glass bottle", ""], ["Amber / brown / dark glass bottle", "air-tight"], ["Test sieve (IS sieve)", "150 micron IS sieve"]], "i": [["Analytical balance", "200 g max, 0.1 mg"], ["Air oven", "105 °C ± 5 °C"], ["Air bath", "140 °C"], ["Hot plate", ""], ["Sand bath", ""], ["Muffle furnace", "1 050 °C"], ["Water bath", ""], ["Cooling bath", ""]], "k": [["Filter paper", "medium texture, low ash"], ["Filter paper", "No. 40"], ["Non-absorbent paper", ""]]}, "WI-17": {"c": [["Cadmium chloride", ""], ["Ammonium hydroxide (ammonia solution)", "sp gr 0.66 (as written)"], ["Sodium thiosulphate", ""], ["Sodium bicarbonate", ""], ["Potassium dichromate", "pure"], ["Sulphuric acid", ""], ["Potassium iodide", ""], ["Potassium iodate", "alternative for iodine solution"], ["Hydrochloric acid", "sp gr 1.16, free from Cl2 and FeCl3"], ["Starch", "indicator, freshly prepared"], ["Distilled / reagent grade water", ""]], "g": [["Flat bottom flask", "500 ml"], ["Thistle funnel", ""], ["Delivery tube", ""], ["Absorption vessel", "to hold 200 ml"], ["Burette", ""]], "i": [], "k": [["Rubber stopper / bung", "to hold thistle funnel and delivery tube"]]}, "WI-18": {"c": [["Oxygen", "pure, dried"], ["Methyl red", "salt"], ["Ethanol / alcohol (absolute alcohol, rectified spirit)", ""], ["Silver nitrate", ""], ["Sodium hydroxide", ""], ["Tin (granules / shots)", ""], ["Standard sample", "known sulphur content"], ["Distilled / reagent grade water", ""]], "g": [["Combustion boat", "porcelain"], ["Conical flask", "250 ml"], ["Burette", ""]], "i": [["Combustion furnace", "tube type, silicon carbide heating rods, 1 200 °C"], ["Dried oxygen supply", "1 to 3 l/min"]], "k": []}, "WI-19": {"c": [], "g": [["Sampling scoop", "8 kg capacity"], ["Sample container", ""], ["Shovel", "standard"]], "i": [["Balance (laboratory)", "50 kg capacity"], ["Magnet (hand magnet)", "100 x 150 mm, with handle and detachable plate, 950 to 1 000 gauss"], ["Magnetic separator", "alternative to hand magnet"]], "k": []}, "WI-20": {"c": [["Liquid synthetic detergent", "for cleaning sieves"]], "g": [["Test sieve (IS sieve)", "20 mm nominal aperture, IS 460"], ["Test sieve (IS sieve)", "4 mm nominal aperture, IS 460"], ["Sieve lid", ""], ["Receiver pan", ""], ["Soft brush", "e.g. paint brush"]], "i": [["Balance (laboratory)", "better than 0.1 percent of charge mass"], ["Test sieving machine", "optional"]], "k": []}, "WI-29": {"c": [["Sodium carbonate", "anhydrous"], ["Sodium peroxide", "solid"], ["Sodium hydroxide", "solid"], ["Hydrochloric acid", "sp gr 1.16"], ["Sulphuric acid", "for 1 : 1 (v/v) dilution"], ["Hydrofluoric acid", "40 percent"], ["Distilled / reagent grade water", ""]], "g": [["Iron crucible", "50 ml"], ["Iron or nickel rod", "small, for mixing"], ["Porcelain dish", ""], ["Platinum crucible", "25 to 30 ml, with lid"], ["Desiccator", ""]], "i": [["Hot plate", ""], ["Muffle furnace", "1 000 °C"]], "k": [["Filter paper", "Whatman No. 40"]]}, "WI-30": {"c": [["Nitric acid", "sp gr 1.42"], ["Sulphuric acid", "sp gr 1.84"], ["Sulphur dioxide", "for approx. 5 percent sulphurous acid solution"], ["Sodium bismuthate", "80 percent (as printed in IS)"], ["Ferrous ammonium sulphate", "crystals, FeSO4.(NH4)2SO4.6H2O"], ["Phosphoric acid", "85 percent"], ["Potassium permanganate", "for 0.1 N solution"], ["Sodium oxalate", "Analar"], ["Distilled / reagent grade water", ""]], "g": [["Volumetric flask", "500 ml"], ["Pipette", "25 ml"], ["Beaker", "500 ml"], ["Gooch crucible", ""], ["Fritted glass crucible", "fine porosity"], ["Amber / dark glass-stoppered bottle", ""], ["Burette", ""]], "i": [], "k": []}, "WI-31": {"c": [["Sulphuric acid", "sp gr 1.84"], ["Sodium carbonate", "anhydrous"], ["Zinc oxide", "finely divided"], ["Nitric acid", "sp gr 1.42"], ["Potassium permanganate", "for 0.1 N solution"], ["Sodium oxalate", "Analar"], ["Standard ferromanganese or manganese ore", "known manganese content (preferred for standardizing permanganate)"], ["Distilled / reagent grade water", ""]], "g": [["Volumetric flask", "500 ml"], ["Pipette", "25 ml"], ["Conical flask", "500 ml"], ["Gooch crucible", ""], ["Fritted glass crucible", "fine porosity"], ["Amber / dark glass-stoppered bottle", ""], ["Burette", ""]], "i": [], "k": []}, "WI-32": {"c": [["Oxygen", "99.5 percent, free from carbonaceous matter"], ["Sulphuric acid", "sp gr 1.84"], ["Chromic anhydride", ""], ["Manganese sulphate", "MnSO4.4H2O, solid"], ["Ammonium hydroxide (ammonia solution)", "sp gr 0.90"], ["Ammonium persulphate", "for 25 and 22.5 percent (w/v) solution"], ["Soda asbestos (Ascarite)", "graded IS Sieves 140 to 50"], ["Soda asbestos (Ascarite)", "alternative to soda asbestos"], ["Magnesium perchlorate (Anhydrone)", ""], ["Magnesite brick powder", "passing IS Sieve 50, calcined"], ["Low carbon standard steel", "known carbon content"], ["Distilled / reagent grade water", ""]], "g": [["Gas holder", "8 to 10 litres"], ["Arnold bottle", ""], ["Exit bulb", "packed with glass wool"], ["Absorption bottle", "soda asbestos / anhydrone"], ["Gas absorption bottle", "chromic-sulphuric acid"], ["Desiccant tube", ""], ["Carbon dioxide absorption bottle", "80 ml"], ["Guard bottle", ""], ["Midvale or Nesbitt bulb", "alternative to bottles F, G, H"], ["Combustion tube", "about 650 mm long, 20 mm ID, fused silica or fireclay"], ["Combustion boat", "porcelain, refractory clay, nickel sheet or alumina, about 100 x 20 x 15 mm"], ["Counterpoise bottle", ""], ["Desiccator", ""], ["Buchner funnel", ""], ["Test sieve (IS sieve)", "140"], ["Test sieve (IS sieve)", "50"], ["Test sieve (IS sieve)", "85"], ["Test sieve (IS sieve)", "70"]], "i": [["Combustion furnace", "horizontal tube, electric, up to 1 350 °C (run at 1 200 to 1 300 °C)"], ["Muffle furnace", ""], ["Flowmeter", ""]], "k": [["Rubber tubing", ""], ["Rubber stopper / bung", ""], ["Glass wool", ""], ["Asbestos", "ignited, 75 mm plug"], ["Lead foil", "assay grade, 0.127 mm thick"]]}, "WI-33": {"c": [["Oxygen", "99.5 percent, free from carbonaceous matter"], ["Potassium hydroxide", "for 30 percent (w/v) solution"], ["Sodium hydroxide", "for 30 percent (w/v) solution (alternative to potassium hydroxide)"], ["Sulphuric acid", "sp gr 1.84"], ["Potassium permanganate", "crystals"], ["Magnesite brick powder", "passing IS Sieve 50, calcined"], ["Methyl orange", ""], ["Standard steel", "known carbon content"], ["Distilled / reagent grade water", ""]], "g": [["Gas holder", "8 to 10 litres"], ["Arnold bottle", ""], ["Combustion tube", "about 650 mm long, 20 mm ID, fused silica or fireclay"], ["Three-way stop-cock", ""], ["Bulbed tubing", ""], ["Water-jacketed spiral cooling tube", ""], ["Bend-way manifold stop-cock", ""], ["Gas measuring burette", "water-jacketed, graduated in percent carbon up to 1.5 percent for 1 g"], ["Absorption pipette", ""], ["Levelling bottle", ""], ["Combustion boat", "nickel, clay or porcelain, 75 x 15 x 15 mm"], ["Test sieve (IS sieve)", "50"]], "i": [["Combustion furnace", "horizontal tube, 1 350 °C"], ["Muffle furnace", ""]], "k": [["Rubber tubing", ""], ["Rubber stopper / bung", ""], ["Glass wool", ""], ["Asbestos", "ignited, 75 mm plug"]]}, "WI-34": {"c": [["Nitric acid", "sp gr 1.42"], ["Hydrofluoric acid", "40 percent"], ["Sulphuric acid", "sp gr 1.84"], ["Hydrochloric acid", "sp gr 1.16"], ["Ammonium hydroxide (ammonia solution)", "sp gr 0.90"], ["Sulphur dioxide", "for sulphurous acid (saturated in water)"], ["Potassium permanganate", "for 2.5 percent (w/v) solution"], ["Potassium nitrite", "solid"], ["Molybdic acid", "MoO3, 85 percent"], ["Ammonium molybdate", "alternative to molybdic acid"], ["Ammonium phosphate", ""], ["Perchloric acid", "70 percent"], ["Hydrobromic acid", "48 percent"], ["Potassium nitrate", "for 1 percent (w/v) wash solution"], ["Sodium hydroxide", "purified, for 0.1 N solution"], ["Barium hydroxide", ""], ["Phenolphthalein", ""], ["Ethanol / alcohol (absolute alcohol, rectified spirit)", ""], ["Sodium carbonate", "for standardizing hydrochloric acid"], ["Ammonium bromide", ""], ["Distilled / reagent grade water", ""]], "g": [["Platinum dish", "large, with cover"], ["Beaker", "400 ml"], ["Platinum crucible", ""], ["Test tube", ""], ["Burette", ""]], "i": [["Water bath", "cold, for cooling molybdate solution"]], "k": [["Filter paper", "Whatman No. 1"], ["Filter paper pulp", ""]]}, "WI-35": {"c": [["Nitric acid", "sp gr 1.42"], ["Hydrofluoric acid", "40 percent"], ["Potassium nitrate", "crystals"], ["Boric acid", "for saturated solution"], ["Hydrochloric acid", "sp gr 1.16"], ["Zinc", "20 to 30 mesh powder, sulphur-free"], ["Barium chloride", "for 10 percent (w/v) solution"], ["Distilled / reagent grade water", ""]], "g": [["Platinum dish", "300 ml, with cover"], ["Porcelain vessel", ""], ["Beaker", ""], ["Platinum crucible", "or porcelain crucible"], ["Porcelain crucible", "or platinum crucible"], ["Test sieve (IS sieve)", "15"]], "i": [["Steam bath", ""], ["Muffle furnace", "800 to 900 °C"]], "k": [["Filter paper", "close texture"], ["Filter paper", "Whatman No. 42"]]}, "WI-36": {"c": [["Sodium carbonate", "anhydrous"], ["Hydrochloric acid", "for 1 : 1, 1 : 3 and 1 : 19 (v/v) dilutions"], ["Sulphuric acid", "for 1 : 1 (v/v) dilution"], ["Hydrofluoric acid", "40 percent"], ["Potassium pyrosulphate", "solid"], ["EDTA disodium salt dihydrate", "for 0.025 M solution"], ["Phenolphthalein", ""], ["Ethanol / alcohol (absolute alcohol, rectified spirit)", ""], ["Ammonium hydroxide (ammonia solution)", "ammonia solution, for 1 : 3 (v/v) dilution"], ["Ferric ammonium sulphate (ammonium iron (III) sulphate)", "NH4Fe(SO4)2.12H2O"], ["Ammonium molybdate", ""], ["Oxalic acid", ""], ["Ascorbic acid", ""], ["Silica", "pure, 99.8 percent"], ["Sodium hydroxide", ""], ["Distilled / reagent grade water", ""]], "g": [["Agate mortar and pestle", ""], ["Test sieve (IS sieve)", "15 (149 microns)"], ["Glass weighing bottle", ""], ["Platinum dish", "100 ml, with lid"], ["Glass rod", "with flattened end"], ["Rubber-tipped glass rod", ""], ["Volumetric flask", "500 ml"], ["Platinum crucible", ""], ["Volumetric flask", "100 ml"], ["Absorption cell", ""], ["Plastic (polythene) beaker", ""], ["Polyethylene bottle", ""], ["Amber / brown / dark glass bottle", ""]], "i": [["Crusher", "hardened tool steel faces"], ["Magnet (hand magnet)", ""], ["Air oven", "105 to 110 °C"], ["Meker burner", ""], ["Steam bath", ""], ["Muffle furnace", "1 050 °C (IS says 'furnace')"], ["Hot plate", "or sand bath"], ["Sand bath", "alternative to hot plate"], ["Fume cupboard", ""], ["Photometer", "light band centred at about 810 nm"]], "k": [["Filter paper", "Whatman No. 42"]]}, "WI-37": {"c": [["Magnesium perchlorate (Anhydrone)", "anhydrous, desiccant"], ["Distilled / reagent grade water", ""]], "g": [["Agate mortar and pestle", ""], ["Test sieve (IS sieve)", "15 (75 microns, as written)"], ["Glass weighing bottle", ""], ["Platinum crucible", ""], ["Desiccator", "preferably with magnesium perchlorate"]], "i": [["Crusher", "hardened tool steel faces"], ["Magnet (hand magnet)", ""], ["Air oven", "105 to 110 °C"], ["Muffle furnace", "1 025 ± 20 °C"]], "k": []}, "WI-38": {"c": [["Sodium hydroxide", "min 98 % (ISO 6353-2 R 34)"], ["Hydrochloric acid", "35 % mass fraction (ISO 6353-2 R 13)"], ["Calcium carbonate", "min 99.5 % (ISO 6353-3 R 53)"], ["Bromocresol purple", ""], ["Boric acid", ""], ["D(−)-mannitol", "solid"], ["Soda lime", "for CO2 absorption tubes"], ["Germanium oxide", "only if germanium correction is needed"], ["Distilled / reagent grade water", "grade 2 as per ISO 3696 (e.g. double-distilled)"]], "g": [["Boat", "gold, platinum or porcelain"], ["Lid", "gold or platinum"], ["Beaker", "100 ml"], ["Beaker", "200 ml"], ["Plastic (polythene) beaker", "200 ml"], ["Beaker", "250 ml"], ["Volumetric flask", "1 000 ml"], ["Volumetric flask", "2 000 ml"], ["Pipette", "4.0 ml"], ["Pipette", "100 ml"], ["Polyethylene bottle", ""], ["Automatic-filling burette", "25 ml, fitted with soda lime tubes"], ["Soda lime tube", ""], ["Piston burette", "optional, with automatic titration equipment"], ["Desiccator", ""], ["Test sieve (IS sieve)", "6.7 mm (ISO 3310-1)"], ["Test sieve (IS sieve)", "300 µm (ISO 3310-1)"], ["Test sieve (IS sieve)", "106 µm (ISO 3310-1)"], ["Heat-resistant plate", "non-reactive, e.g. polytetrafluoroethylene"], ["Flat weighing bottle", "50 mm x 30 mm"], ["Sample tube", "50 mm x 25 mm"]], "i": [["Muffle furnace", "control up to at least 700 °C"], ["pH meter", "with glass electrode"], ["Magnetic stirrer", ""], ["Air oven", "110 °C ± 5 °C (drying oven / air bath)"], ["Analytical balance", "0.1 mg"], ["Hot plate", ""], ["Automatic titration equipment", "optional"]], "k": [["Filter paper", "white-ribbon"]]}, "WI-39": {"c": [["Sodium hydroxide", "for 10 percent (m/v) solution"], ["Methyl red", ""], ["Distilled / reagent grade water", ""]], "g": [["Lunge nitrometer", "water-jacketed, 50 cc bulb, graduated stem, stopcock and cup"], ["Levelling bulb", ""], ["Reaction bottle", "about 60 ml"], ["Weighing tube", "closed one end, about 4 cm long, 0.5 cm ID"], ["Funnel", ""], ["Bent glass tube", ""], ["Stand with clamps", ""]], "i": [["Water bath", ""], ["Thermometer", "for water jacket and water-bath"], ["Barometer", ""]], "k": [["Rubber tubing", ""]]}, "WI-40": {"c": [["Sulphuric acid", "rd 1.84"], ["Nitric acid", "rd 1.42"], ["Hydrochloric acid", "rd 1.16"], ["Hydrofluoric acid", "40 percent"], ["Ammonium fluoride", "solid"], ["Ammonium hydroxide (ammonia solution)", "20 percent"], ["Acetic acid", "glacial"], ["Urea", ""], ["Potassium iodide", ""], ["Sodium thiosulphate", "for 0.05 N and 0.02 N solutions"], ["Borax", ""], ["Electrolytic copper", "for standardizing thiosulphate"], ["Starch", "soluble"], ["Ammonium thiocyanate", "solid"], ["Sodium hydroxide", "for 20 percent (m/v) solution"], ["Sodium sulphide", "for 15 percent (m/v) solution"], ["Sulphur dioxide", "for sulphurous acid"], ["Hydrogen sulphide", "gas"], ["Distilled / reagent grade water", "reagent grade (IS 1070)"]], "g": [["Beaker", "400 ml"], ["Beaker", "600 ml"], ["Porcelain crucible", "or silica crucible"], ["Silica crucible", "or porcelain crucible"], ["Platinum crucible", ""], ["Conical flask", "300 ml"], ["Beaker", "300 ml (alternative to conical flask)"], ["Volumetric flask", "250 ml"], ["Pipette", "25 ml"], ["Pipette", ""], ["Burette", ""]], "i": [["Analytical balance", ""]], "k": [["Filter paper pulp", "ashless, for pulp pad"]]}, "WI-41": {"c": [["Sulphuric acid", "rd 1.84"], ["Hydrochloric acid", "rd 1.16"], ["Nitric acid", "rd 1.42"], ["Hydrogen sulphide", "gas"], ["Tartaric acid", "for 30 percent solution"], ["Ammonium hydroxide (ammonia solution)", "20 percent"], ["Methyl red", ""], ["Sodium hydroxide", "for 0.1 N solution"], ["Formic acid", "rd 1.20"], ["Ammonium sulphate", ""], ["Ammonium nitrate", "solid"], ["Methylated spirit", "industrial"], ["Mercuric chloride", ""], ["Potassium thiocyanate", ""], ["Distilled / reagent grade water", "reagent grade (IS 1070)"]], "g": [["Conical beaker", "weighed"], ["Sintered glass funnel", ""], ["Sintered glass crucible", "weighed"], ["Burette", ""], ["Pipette", ""]], "i": [["Air oven", "110 °C"], ["Analytical balance", ""]], "k": [["Filter paper pulp", "for pulp pad"]]}, "WI-42": {"c": [["Sodium hydroxide", "solid"], ["Hydrogen peroxide", "20 volumes"], ["Sodium carbonate", "solid"], ["Methyl red", ""], ["Ammonium hydroxide (ammonia solution)", "20 percent"], ["Ammonium chloride", "solid"], ["Hydrochloric acid", "rd 1.16"], ["Hydrogen sulphide", "gas"], ["Ammonium persulphate", "solid"], ["Bromine", "for saturated bromine water"], ["8-Hydroxyquinoline", ""], ["Acetic acid", "glacial"], ["Ammonium acetate", ""], ["Distilled / reagent grade water", "reagent grade (IS 1070)"]], "g": [["Conical flask", "250 ml, wide mouthed (Erlenmeyer)"], ["Beaker", "250 ml"], ["Sintered glass funnel", "weighed"], ["Burette", ""], ["Pipette", ""]], "i": [["Air oven", "100 to 105 °C"], ["Analytical balance", ""], ["Hot plate", ""]], "k": [["Filter paper", ""]]}, "WI-43": {"c": [["Sodium hydroxide", "for 50 percent (m/v) solution"], ["Hydrogen peroxide", "20 volumes"], ["Sulphuric acid", "rd 1.84"], ["Perchloric acid", "70 percent"], ["Nitric acid", "rd 1.42"], ["Sulphur dioxide", "gas, for sulphurous acid"], ["Hydrochloric acid", "rd 1.16"], ["Hydrofluoric acid", "40 percent"], ["Ammonium acetate", "only if lead is present (hot solution for washing)"], ["Distilled / reagent grade water", "reagent grade (IS 1070)"]], "g": [["Stainless steel beaker", "or nickel beaker"], ["Nickel beaker", "or stainless steel beaker"], ["Rubber-tipped glass rod", ""], ["Platinum crucible", ""], ["Desiccator", ""], ["Burette", ""], ["Pipette", ""]], "i": [["Hot plate", ""], ["Muffle furnace", "500 °C and 900 to 950 °C (IS says 'furnace')"], ["Analytical balance", ""]], "k": [["Filter paper", "low ash, medium texture"], ["Filter paper pulp", ""]]}, "WI-44": {"c": [["Iron (pure)", "pure, 99.99 percent"], ["Hydrochloric acid", ""], ["Sulphuric acid", ""], ["Potassium dichromate", "dried at 110 °C for 1 h"], ["Stannous chloride", ""], ["Mercuric chloride", ""], ["Sodium diphenylamine sulphonate", ""], ["Phosphoric acid", ""], ["Distilled / reagent grade water", "reagent grade (IS 1070)"]], "g": [["Conical flask", "500 ml"], ["Volumetric flask", "2 litre"], ["Beaker", "2 litre"], ["Beaker", "1 litre"], ["Plastic dropping bottle", ""], ["Dropping bottle", ""], ["Plastic container", ""], ["Burette", ""], ["Pipette", ""]], "i": [["Hot plate", ""], ["Analytical balance", ""]], "k": []}, "WI-45": {"c": [["Antimony", "metallic powder"], ["Aluminium sheet / foil", "tin free"], ["Hydrochloric acid", "for 1 : 1 and 1 : 2 (v/v) dilutions"], ["Carbon dioxide", "gas"], ["Starch", "soluble"], ["Potassium iodide", ""], ["Potassium iodate", "dried at 180 °C, for 0.025 N solution"], ["Sodium hydroxide", ""], ["Tin (granules / shots)", "metal, for standard tin solution"], ["Potassium chlorate", "if tin dissolves with difficulty"], ["Distilled / reagent grade water", "reagent grade (IS 1070)"]], "g": [["Conical flask", "500 ml (Erlenmeyer)"], ["Air condenser", "290 mm, 12 mm bore"], ["Gas inlet tube", ""], ["Glass rod", ""], ["Beaker", "400 ml, covered"], ["Volumetric flask", "1 litre"], ["Burette", ""], ["Pipette", ""]], "i": [["Analytical balance", ""]], "k": [["Rubber stopper / bung", "three-holed"]]}, "WI-46": {"c": [["Nitric acid", "rd 1.42"], ["Sodium bismuthate", "solid"], ["Sulphur dioxide", "for approx. 5 percent sulphurous acid"], ["Phosphoric acid", "85 percent (m/v)"], ["Ferrous ammonium sulphate", "Fe(NH4)2(SO4)2.6H2O, for 0.03 N solution"], ["Sulphuric acid", "for 5 : 95 dilution"], ["Sodium oxalate", ""], ["Potassium permanganate", "for 0.030 N solution"], ["Sodium hydroxide", "solution (strength not given in doc)"], ["Distilled / reagent grade water", "reagent grade (IS 1070)"]], "g": [["Beaker", "500 ml"], ["Gooch crucible", "asbestos"], ["Fritted glass crucible", ""], ["Amber / dark glass-stoppered bottle", ""], ["Volumetric flask", "1 litre"], ["Burette", ""], ["Pipette", ""]], "i": [["Hot plate", ""], ["Analytical balance", ""]], "k": []}, "WI-47": {"c": [["Hydrochloric acid", "concentrated (IS 265-1976)"], ["Nitric acid", ""], ["Sulphuric acid", ""], ["Ammonium hydroxide (ammonia solution)", ""], ["Hydrogen sulphide", ""], ["Bromine", ""], ["Hydrogen peroxide", ""], ["Ammonium chloride", ""], ["Ammonium persulphate", ""], ["Ammonium carbonate", ""], ["Uranyl acetate or uranyl nitrate", ""], ["Potassium ferrocyanide", ""], ["Zinc", "metal, for standardisation"], ["Distilled / reagent grade water", "IS 1070-1977"]], "g": [["Beaker", "300 ml"], ["Beaker", "500 ml"], ["Conical flask", "500 ml"], ["Watch glass", ""], ["Funnel", ""], ["Porcelain plate", "spot plate"], ["Glass rod", ""], ["Amber / brown / dark glass bottle", ""]], "i": [["Analytical balance", ""], ["Hydrogen sulphide gas supply", ""]], "k": [["Filter paper", ""], ["Litmus paper", ""]]}, "WI-48": {"c": [["Hydrochloric acid", "concentrated (IS 265-1976)"], ["Nitric acid", ""], ["Sulphuric acid", ""], ["Acetic acid", "glacial"], ["Ascorbic acid", ""], ["Ammonium hydroxide (ammonia solution)", ""], ["Ammonium chloride", ""], ["Ammonium acetate", ""], ["Ammonium fluoride", ""], ["Sodium thiosulphate", ""], ["Xylenol orange", ""], ["Ethanol / alcohol (absolute alcohol, rectified spirit)", ""], ["Sodium diethyl dithiocarbamate", ""], ["Eriochrome black T", ""], ["Hydroxylamine hydrochloride", ""], ["Zinc", "metal, for standard solution and standardisation"], ["EDTA disodium salt dihydrate", ""], ["Distilled / reagent grade water", "IS 1070-1977"]], "g": [["Watch glass", ""], ["Funnel", ""], ["Ion-exchange resin column", "Fig. 1 of IS 9252: dropping funnel 100 ml (30 mm ID, 230 mm, with stopcock); column tube 10 mm ID x 300 mm, resin length 200 mm, G1 glass filter and stopcock"], ["Beaker", "250 ml"], ["Beaker", "500 ml"], ["Conical flask", "500 ml"]], "i": [["Analytical balance", ""], ["pH meter", ""]], "k": [["Filter paper", ""], ["Strongly basic anion exchange resin", "grain size 215 to 150 micron IS sieve (IS 460-1962)"]]}, "WI-50": {"c": [["EDTA disodium salt dihydrate", ""], ["Methyl orange", ""], ["Ethanol / alcohol (absolute alcohol, rectified spirit)", ""], ["Ammonium hydroxide (ammonia solution)", ""], ["Sodium acetate", ""], ["Acetic acid", "glacial"], ["Xylenol orange", ""], ["Hydrochloric acid", "concentrated"], ["Zinc acetate dihydrate", ""], ["Aluminium sheet / foil", "for standard aluminium solution"], ["Sodium fluoride", "solid"], ["Distilled / reagent grade water", "analytical grade reagents and distilled water"]], "g": [["Conical flask", "250 ml"], ["Volumetric flask", "1000 ml"], ["Beaker", ""], ["Desiccator", ""], ["Agate mortar and pestle", ""], ["Test sieve (IS sieve)", "IS Sieve 15, aperture 75 µm (IS 460 (Part 1))"], ["Glass weighing bottle", ""]], "i": [["Crusher", "hardened tool steel faces"], ["Magnet (hand magnet)", ""], ["Air oven", "105 to 110 °C"]], "k": []}, "WI-51": {"c": [["Phenolphthalein", ""], ["Distilled / reagent grade water", "IS 1070 : 1992; freshly boiled"]], "g": [["Beaker", "400 ml"], ["Gooch crucible", "tared, with suction"], ["Desiccator", ""], ["Test sieve (IS sieve)", "150 micron IS Sieve (IS 460 : 1985)"]], "i": [["Air oven", "110 ± 5 °C"], ["Autoclave", "4 kg/cm2"]], "k": []}, "WI-52": {"c": [["Distilled / reagent grade water", "IS 1070 : 1992; boiled and cooled to 27 ± 0.5 °C"], ["Ethanol / alcohol (absolute alcohol, rectified spirit)", ""], ["Acetone", ""]], "g": [["Pyknometer", "wide neck, stopper channel not capillary (Types 5 and 6 of IS 5717 : 1991)"]], "i": [["Water bath", "27 ± 0.5 °C"], ["Analytical balance", "0.001 g"]], "k": []}, "WI-53": {"c": [["Hydrochloric acid", "1 N standard volumetric solution"], ["Methyl orange", "0.5 g/l solution"], ["Distilled / reagent grade water", ""]], "g": [["Volumetric flask", "250 ml, one-mark"], ["Burette", ""]], "i": [], "k": []}, "WI-54": {"c": [["Hydrochloric acid", "concentrated (IS 265 : 1993)"], ["Sulphuric acid", "concentrated (IS 266 : 1993)"], ["Hydrofluoric acid", "about 40 percent (m/v)"], ["Silver nitrate", ""], ["Distilled / reagent grade water", "IS 1070 : 1992; freshly boiled"]], "g": [["Volumetric flask", "500 ml"], ["Test sieve (IS sieve)", "150 micron IS Sieve (IS 460 : 1985)"], ["Porcelain dish", "suitable capacity"], ["Watch glass", ""], ["Glass triangle", ""], ["Funnel", ""], ["Platinum crucible", ""], ["Desiccator", ""]], "i": [["Autoclave", "4 kg/cm2"], ["Water bath", "boiling"], ["Air oven", "110 to 120 °C and 100 to 105 °C"], ["Hot plate", ""], ["Muffle furnace", "950 to 975 °C"], ["Analytical balance", "0.0002 g"]], "k": [["Filter paper", ""], ["Filter paper", "ashless, medium porosity"]]}, "WI-55": {"c": [["Distilled / reagent grade water", ""], ["Sodium fluoride", "anhydrous"], ["Ethanol / alcohol (absolute alcohol, rectified spirit)", "approximately 95 percent (v/v) (IS 323 : 1959)"], ["Hydrochloric acid", "1 N standard solution"], ["Hydrochloric acid", "approximately 0.1 N solution"], ["Sodium hydroxide", "1 N standard solution"], ["Methyl red", ""]], "g": [["Conical flask", "250 ml"], ["Volumetric flask", "250 ml, one-mark"], ["Volumetric flask", "200 ml, one-mark"], ["Pipette", "graduated"], ["Burette", ""], ["Desiccator", ""]], "i": [], "k": [["Filter paper", "folded, dry, close grained"]]}, "WI-56": {"c": [], "g": [], "i": [], "k": []}, "WI-57": {"c": [], "g": [["Platinum crucible", "clean, tared"], ["Desiccator", ""]], "i": [], "k": []}, "WI-58": {"c": [["Nitric acid", "concentrated (IS 264 : 1976)"], ["Ammonium persulphate", "solid"], ["Potassium thiocyanate", ""], ["n-Butanol", ""], ["Sulphuric acid", ""], ["Ferrous ammonium sulphate", "FeSO4(NH4)2SO4.6H2O"], ["Distilled / reagent grade water", "IS 1070 : 1992; freshly boiled"]], "g": [["Nessler cylinder", "50 ml (two)"], ["Burette", ""], ["Volumetric flask", "100 ml"], ["Test sieve (IS sieve)", "150 micron IS Sieve (IS 460 : 1985)"]], "i": [["Autoclave", "4 kg/cm2"]], "k": [["Filter paper", ""]]}, "WI-59": {"c": [["Nitric acid", "65 percent, Suprapure"], ["Iron standard stock solution", "certified, 10, 100 or 1000 µg/ml Fe in 2 to 5 percent nitric acid (or soluble iron compound, preferably spectroscopic grade)"], ["Argon", ""]], "g": [["Volumetric flask", "50 ml"], ["Volumetric flask", "100 ml"], ["Pipette", ""], ["HDPE or PP container", "PTFE for ultra-trace analysis"]], "i": [["ICP-OES", ""]], "k": []}, "WI-60": {"c": [], "g": [], "i": [["Torsion viscometer", "two cylinders: motor-driven outer water jacketed cylinder kept at 20 °C; inner cylinder on torsion spring with pointer and scale"]], "k": []}, "WI-61": {"c": [["Nitrobenzene", ""], ["Nitric acid", "approximately 5 N solution"], ["Silver nitrate", "0.1 N standard volumetric solution"], ["Ammonium thiocyanate", "0.1 N standard volumetric solution"], ["Ferric ammonium sulphate (ammonium iron (III) sulphate)", ""], ["Distilled / reagent grade water", "IS 1070 : 1960"]], "g": [["Stoppered flask", "500 ml (two)"], ["Pipette", ""], ["Burette", ""]], "i": [], "k": []}, "WI-62": {"c": [["Distilled / reagent grade water", "or deionized water, free from anions of interest"], ["Sodium bicarbonate", ""], ["Sodium carbonate", ""], ["Sulphuric acid", "concentrated"], ["Sodium chloride", ""]], "g": [["Sample bottle", "glass or polyethylene"], ["Beaker", "PTFE/HDPE"], ["Syringe", ""]], "i": [["Ion chromatograph", "anion guard column, anion separator column, anion micro membrane suppressor, conductivity detector, software"], ["Sample loop", "100, 200, 500 or 1000 µl"], ["Magnetic stirrer", ""]], "k": [["Membrane filter", "0.45 µ"]]}, "WI-63": {"c": [["Hydrochloric acid", "approximately 2 N solution"], ["Sulphuric acid", "ρ approximately 1.84 g/ml, about 96 percent (m/m)"], ["Hydrofluoric acid", "ρ approximately 1.15 g/ml, about 40 percent (m/m)"], ["Barium chloride", ""], ["Silver nitrate", ""], ["Nitric acid", ""], ["Methyl orange", ""], ["Potassium sodium carbonate", "maximum sulphate 0.005 percent (m/m)"], ["Distilled / reagent grade water", ""]], "g": [["Beaker", "1000 ml (two)"], ["Watch glass", ""], ["Volumetric flask", "1000 ml, one-mark"], ["Crucible", ""], ["Desiccator", ""]], "i": [["Water bath", "boiling"], ["Air oven", "110 ± 2 °C"], ["Meker burner", ""], ["Air bath", ""], ["Hot plate", ""], ["Analytical balance", "0.1 mg"]], "k": [["Filter paper", "ash-free fine grade B42"], ["Ash-free cellulose powder", ""]]}, "WI-64": {"c": [["Distilled / reagent grade water", "or deionized water, free from anions of interest"], ["Sodium bicarbonate", ""], ["Sodium carbonate", ""], ["Sulphuric acid", "concentrated"], ["Potassium sulphate", ""]], "g": [["Sample bottle", "glass or polyethylene"], ["Beaker", "PTFE/HDPE"], ["Syringe", ""]], "i": [["Ion chromatograph", "anion guard column, anion separator column, anion micro membrane suppressor, conductivity detector, software"], ["Sample loop", "100, 200, 500 or 1000 µl"], ["Magnetic stirrer", ""]], "k": [["Membrane filter", "0.45 µ"]]}, "WI-49": {"c": [["Hydrochloric acid", "concentrated"], ["Nitric acid", "concentrated"], ["Ammonium sulphate", "for 30 percent solution"], ["Potassium fluoride", "for 10 percent solution"], ["Ammonia solution", ""], ["Methyl orange", "indicator"], ["Sodium thiosulphate", "for 10 percent solution"], ["Sodium acetate", "for 20 percent solution"], ["Ascorbic acid", ""], ["Xylenol orange", "indicator"], ["EDTA standard solution", "standardized"], ["Distilled water", ""]], "g": [["Beaker", "250 ml"], ["Watch glass", ""], ["Pipette", "10 ml"], ["Pipette", "15 ml"], ["Pipette", "50 ml"], ["Pipette", "5 ml"], ["Measuring cylinder", "25 ml"], ["Measuring cylinder", "50 ml"], ["Funnel", ""], ["Volumetric flask", "500 ml"], ["Conical flask", "250 ml"], ["Dropping bottle", ""], ["Burette", ""], ["Plastic bottle", "for potassium fluoride solution"]], "i": [["Analytical balance", "0.1 mg"], ["Hot plate", ""]], "k": [["Filter paper", ""], ["Spatula", ""]]}, "WI-09": {"c": [["Sulphuric acid", "rd 1.84"], ["Phosphoric acid", "rd 1.75"], ["Nitric acid", "rd 1.42 (IS 264)"], ["Silver nitrate", "crystals"], ["Ammonium persulphate", ""], ["Potassium permanganate", "crystals"], ["Hydrochloric acid", "rd 1.16"], ["Ferrous ammonium sulphate", ""], ["Sodium oxalate", "dried 1 h at 105 °C"], ["Distilled / reagent grade water", "IS 1070"]], "g": [["Conical flask", "wide mouth"], ["Glass beads", ""], ["Burette", "for ferrous ammonium sulphate"], ["Burette", "for potassium permanganate"], ["Sintered glass crucible", ""], ["Amber glass bottle", ""], ["Stoppered glass bottle", ""]], "i": [["Analytical balance", ""], ["Heating arrangement", ""], ["Oven", "105 °C"]], "k": []}, "WI-08": {"c": [["Oxygen", "pure, dried"], ["Potassium iodate", ""], ["Starch", ""], ["Potassium iodide", ""], ["Hydrochloric acid", ""], ["Tin (granules / shots)", ""], ["Standard sample", "known sulphur content"], ["D.M. water", ""]], "g": [["Combustion boat", "porcelain"], ["Conical flask", "250 ml"], ["Burette", ""], ["Measuring cylinder", ""], ["Dropping bottle", ""], ["Beaker", ""], ["Volumetric flask", "1000 ml"], ["Volumetric flask", "500 ml"]], "i": [["Combustion furnace", "tube type, silicon carbide heating rods, 1 200 °C"], ["Dried oxygen supply", "1 to 3 l/min"], ["Hot plate", ""], ["Analytical balance", ""]], "k": []}, "WI-23": {"c": [["Silica gel, self-indicating", "desiccant"]], "g": [["Weighing vessel", "silica / glass, ground cover, about 10 cm²"], ["Desiccator", ""], ["Test sieve (IS sieve)", "212 micron"]], "i": [["Air oven", "ventilated, 108 ± 2 °C"], ["Analytical balance", ""]], "k": []}, "WI-24": {"c": [["Silica gel, self-indicating", "desiccant"]], "g": [["Non-corrodible tray", "about 1 000 cm²"], ["Weighing vessel", "silica / glass / stainless steel, ground cover, about 40 cm²"], ["Desiccator", ""], ["Test sieve (IS sieve)", "2.90 mm"]], "i": [["Air oven", "ventilated, 108 ± 2 °C"], ["Balance", "reads to 0.5 g"], ["Analytical balance", ""], ["Crusher", "to 2.90 mm"]], "k": []}, "WI-25": {"c": [["Silica gel, self-indicating", "desiccant"]], "g": [["Non-corrodible tray", "about 1 000 cm²"], ["Weighing vessel", "silica / glass / stainless steel, ground cover, about 40 cm²"], ["Desiccator", ""]], "i": [["Air oven", "ventilated, 38 ± 2 °C"], ["Air oven", "ventilated, 108 ± 2 °C"], ["Balance", "reads to 0.5 g"], ["Analytical balance", ""], ["Crusher", "to 12.5 mm and 2.90 mm"]], "k": []}, "WI-26": {"c": [["Silica gel, self-indicating", "desiccant (or activated alumina / anhydrous calcium sulphate)"], ["Benzene", "for coke / low volatile coal"]], "g": [["Silica crucible with lid", "fused silica, 10 to 14 g with lid, Fig. 2"], ["Desiccator", ""], ["Metal plate", "for cooling"]], "i": [["Muffle furnace", "900 ± 10 °C, uniform zone, chimney"], ["Thermocouple (unsheathed)", "wire thicker than 1 mm"], ["Crucible stand", "heat-resistant steel wire (Fig. 3A / 3B)"], ["Analytical balance", ""]], "k": [["Asbestos disc", "25 mm diameter, 1 mm thick"]]}, "WI-27": {"c": [["Silica gel, self-indicating", "desiccant"]], "g": [["Dish with lid", "silica / porcelain / platinum, 10 to 15 mm deep"], ["Desiccator", ""], ["Metal slab", "cold, for cooling"], ["Brush", "to brush out the ash"]], "i": [["Muffle furnace", "500 °C, 815 ± 10 °C (850 ± 10 °C), about 5 air changes per minute"], ["Laboratory mechanical mixer", ""], ["Analytical balance", ""]], "k": []}, "WI-28": {"c": [], "g": [], "i": [], "k": []}, "WI-12": {"c": [["Mercuric chloride", "solid, highly toxic"], ["Potassium dichromate", "0.1 N"], ["Orthophosphoric acid", ""], ["Sulphuric acid", "concentrated"], ["Potassium permanganate", "0.1 N"], ["Barium diphenylamine sulphonate", "indicator"], ["Sodium sulphate", ""], ["D.M. water", ""]], "g": [["Beaker", "250 ml"], ["Funnel", ""], ["Measuring cylinder", "100 ml"], ["Measuring cylinder", "20 ml"], ["Burette", ""], ["Dropping bottle", ""], ["Volumetric flask", "1000 ml"]], "i": [["Hot plate", ""], ["Analytical balance", ""], ["Fume hood", ""]], "k": [["Filter paper", "Whatman No. 41"], ["Hazardous waste container", "for mercury waste"]]}, "WI-16": {"c": [["Hydrochloric acid", "concentrated, rd 1.16"], ["Nitric acid", "concentrated, rd 1.42"], ["Sulphuric acid", ""], ["Hydrofluoric acid", "40 percent"], ["Sodium carbonate", "solid"], ["Potassium bisulphate", "solid"], ["Perchloric acid", "rd 1.67 (70 percent)"], ["Calcium chloride", "desiccant, calcined 700 to 800 °C"], ["Distilled / reagent grade water", ""]], "g": [["Beaker", "400 ml"], ["Watch glass", ""], ["Volumetric flask", "250 ml"], ["Platinum crucible", "with lid"], ["Policeman / rubber-tipped glass rod", ""], ["Petri dish", "glass / aluminium / stainless steel, with cover"], ["Desiccator", ""], ["Test sieve (IS sieve)", "150 micron"]], "i": [["Hot plate", ""], ["Sand bath", ""], ["Muffle furnace", "1 050 °C"], ["Air oven", "105 ± 5 °C"], ["Analytical balance", "200 g max, 0.1 mg"], ["Fume hood", "for HF and perchloric acid"]], "k": [["Filter paper", "medium texture, low ash"], ["Filter paper", "No. 40"]]}, "WI-21": {"c": [["Sodium hydrogen carbonate", "solid, 1 g to 2 g per test; also saturated solution for the trap"], ["Hydrochloric acid", "ρ 1.16 to 1.19 g/ml, oxygen-free"], ["Hydrofluoric acid", "40 percent, only for silica ≥ 5 percent"], ["Sulphuric acid", "ρ 1.84 g/ml"], ["Phosphoric acid", "ρ 1.71 g/ml"], ["Potassium dichromate", "0.016 67 mol/l (4.904 g/l)"], ["Sodium diphenylaminesulphonate", "indicator, 0.2 g/100 ml"], ["Certified reference material", "slag / iron ore, similar type"], ["Calcium gluconate gel", "HF first aid"], ["D.M. water", ""]], "g": [["Conical flask", "500 ml"], ["Göckel safety trap / Bunsen valve", "slit rubber valve"], ["Burette", "Class B"], ["Measuring cylinder", "50 ml"], ["Measuring cylinder", "500 ml"], ["Volumetric flask", "1 000 ml"], ["Dropping bottle", "brown glass"], ["Agate mortar and pestle", ""], ["Test sieve (IS sieve)", "100 micron"], ["Desiccator", ""]], "i": [["Hot plate", "about 90 °C"], ["Air oven", "105 °C ± 2 °C"], ["Analytical balance", "0.000 2 g"], ["Fume hood", ""]], "k": [["Magnet", "to remove metallic iron prills"], ["HF-resistant gloves", ""], ["Face shield", ""]]}, "WI-22": {"c": [["Sodium carbonate", "solid, 1 g per test"], ["Hydrochloric acid", "1 : 1"], ["Hydrofluoric acid", "40 percent, 10 drops per test"], ["Orthophosphoric acid", ""], ["Sulphuric acid", "concentrated"], ["Potassium permanganate", "0.1 N (for the acid mixture)"], ["Barium diphenylamine sulphonate", "indicator"], ["Sodium sulphate", ""], ["Potassium dichromate", "0.1 N"], ["Calcium gluconate gel", "HF first aid"], ["D.M. water", ""]], "g": [["Conical flask", "500 ml"], ["Measuring cylinder", "25 ml"], ["Measuring cylinder", "50 ml"], ["Dropping bottle", "plastic, for HF"], ["Dropping bottle", "indicator / orthophosphoric acid"], ["Burette", ""], ["Volumetric flask", "1000 ml"]], "i": [["Hot plate", ""], ["Analytical balance", ""], ["Fume hood", ""]], "k": [["Magnet", "to remove metallic iron prills (slag)"], ["HF-resistant gloves", ""], ["Face shield", ""]]}};

const APP_FAQ = [
  { t: "Fetch WhatsApp messages", a: "Production Update → 📥 Fetch WhatsApp pulls new messages saved by MacroDroid into the Google Sheet and writes them to Excel. Strip Reports group gives billets, SMS PRODUCTION & QUALITY gives chemistry, SMS Stock Group gives the daily Consumption message. It runs only when you press the button.", go: "whatsapp", k: "whatsapp fetch macrodroid inbox google sheet group message feed automatic" },
  { t: "Inbox Settings (URL / TOKEN / last row)", a: "⚙️ Inbox Settings asks for the Apps Script Web app URL (ending /exec), the TOKEN set in the script, and the last processed row (0 = fetch everything again). They are saved on this phone.", go: "whatsapp", k: "token url apps script settings last row" },
  { t: "Retry queue (failed WhatsApp messages)", a: "If a message fails for a temporary reason (Excel file open on PC, network, heat row not created yet) it is kept and retried on every next Fetch, up to 3 days.", go: "whatsapp", k: "retry failed pending locked" },
  { t: "Excel file locked / open on the PC", a: "Office 2021 on the PC does not support co-authoring, so while the file is open there the app cannot write. Close it (or open it in Excel for the web) and try again.", go: null, k: "locked open pc error 409 editing workbook co-authoring" },
  { t: "Heat number auto-correction", a: "Heat numbers written without dots (01.1001, H.no 1) are rebuilt from the date. A production day starts at 8 AM; a lower heat number than the last one means the next day. Heats 10-12 received between 8 AM and 12 noon with no reference are not guessed - they show an error to correct.", go: "whatsapp", k: "heat number h.no dot correct 8 am rule sequence" },
  { t: "Create Next Day Block", a: "New Block → choose a sheet → Create Next Day Block copies formulas, number formats and colours from the previous day's block and never touches cells that already have data. 🎨 Fix Colours of Last Block repaints the latest block only.", go: "nextday", k: "next day block colour fix format copy" },
  { t: "Create Next Month File", a: "New Block screen → Create Next Month File copies Desktop/MIPPL/Production Sheet/Template.xlsx to <Month>'YY_Reports.xlsx, changes every month written in it (except SCRAP, CALCULATION, Durgesh, M2M), blanks dates that don't exist, and copies the previous month's last Daily Stock (pcs whole, ERP weight 3 decimals).", go: "nextday", k: "next month file template november new month opening stock" },
  { t: "Monthly MIS PDF", a: "Reports → Monthly MIS makes a one-page summary: production, heats, hot charging/bypass/RHF/hot out, off-spec heats and raw material kg per MT.", go: "reports", sub: ["subreport", "mis"], k: "mis monthly management summary one page" },
  { t: "Calibration reminders", a: "ISO 9001 → Calibration Log: a 🔔 notification comes 7 days before the due date and again when due/overdue.", go: "iso9001", k: "calibration due reminder instrument notification" },
  { t: "PDF colours same as Excel", a: "Logsheet, Billet Stock and Strip Mill PDFs take their colours from the sheet. After changing colours in Excel run 🎨 Fix Colours of Last Block once for that sheet.", go: "nextday", k: "pdf colour logsheet billet strip excel same" }
];

let _qIndex = null;
function buildQueryIndex() {
  const idx = [];
  const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();
  // 1. every section and sub-section, with its visible texts
  document.querySelectorAll(".sectionPanel[id^='section-']").forEach(sec => {
    const secId = sec.id.replace("section-", "");
    if (!account && secId !== "indstd" && secId !== "sopwi") return; // signed out: only standards / SOPs / notes
    if (secId === "askdata") return; // don't match the help text of this box itself
    const tile = document.querySelector(`#mainSidebar > .navItem[data-section="${secId}"] .navLabel`);
    const secName = tile ? clean(tile.textContent) : secId;
    const subPanels = sec.querySelectorAll(".sub-sectionPanel[id]");
    const addPanel = (panel, sub) => {
      const h = panel.querySelector("h2, h3");
      const title = clean(h ? h.textContent : secName);
      const texts = [...panel.querySelectorAll("p, label, button, th, h4, option")].map(e => clean(e.textContent)).filter(Boolean);
      idx.push({ kind: "section", title: sub ? `${secName} › ${title}` : title, text: texts.join(" · "), go: secId, sub });
    };
    if (subPanels.length) {
      subPanels.forEach(p => {
        const m = /^(sub[a-z]+)-(.+)$/.exec(p.id);
        addPanel(p, m ? [m[1], m[2]] : null);
      });
      const h = sec.querySelector("h2");
      idx.push({ kind: "section", title: secName, text: clean(h ? h.textContent : ""), go: secId });
    } else addPanel(sec, null);
  });
  // 2. standards
  (typeof IND_STANDARDS !== "undefined" ? IND_STANDARDS : []).forEach(x => {
    const follow = clean(String(x.follow || "").replace(/<[^>]+>/g, " "));
    idx.push({ kind: "std", title: `${x.no} — ${x.title}`, text: [x.scope, x.facts.join(" · "), follow, x.keywords || ""].join(" · "), go: "indstd", std: x.id });
  });
  // 3. SOPs
  SOP_LIST.forEach(x => idx.push({ kind: "sop", title: `${x.no} — ${sopDocOf(x, sopLang()).title.replace(/<[^>]+>/g, "")}`,
    text: sopPlainText(x), go: "sopwi", sop: x.id }));
  // 4. app notes (only for signed-in users - they are about using the app)
  if (account) APP_FAQ.forEach(f => idx.push({ kind: "faq", title: f.t, text: f.a, extra: f.k, go: f.go, sub: f.sub }));
  return idx;
}

const Q_STOP = new Set("the a an of in on for to is are was what how which who me my show give tell about please kya hai hain ka ki ke ko me mein se aur batao bataiye kaise kahan kitna kitne wala wali".split(" "));
function qTokens(t) {
  return String(t).toLowerCase().replace(/[^a-z0-9.%()+ऀ-ॿ ]+/g, " ").split(/\s+/)
    .map(w => w.replace(/^[.(]+|[.)]+$/g, "")).filter(w => w && !Q_STOP.has(w));
}
let _qIndexSigned = null;
function searchApp(query) {
  if (!_qIndex || _qIndexSigned !== !!account) { _qIndex = buildQueryIndex(); _qIndexSigned = !!account; }
  const toks = qTokens(query);
  if (!toks.length) return [];
  const syn = { sulfur: "sulphur", s: "sulphur", c: "carbon", mn: "manganese", si: "silicon", p: "phosphorus", n: "nitrogen", tmt: "1786", rebar: "1786", billet: "billet", strip: "strip", tc: "test", cert: "certificate" };
  return _qIndex.map(e => {
    const title = e.title.toLowerCase();
    const body = (e.text + " " + (e.extra || "")).toLowerCase();
    let score = 0, hits = 0;
    toks.forEach(t => {
      const alt = syn[t];
      const inT = title.includes(t) || (alt && title.includes(alt));
      const inB = body.includes(t) || (alt && body.includes(alt));
      if (inT) score += 3; if (inB) score += 1;
      if (inT || inB) hits++;
    });
    if (e.kind === "std" && /\d{3,5}/.test(query) && title.includes(query.match(/\d{3,5}/)[0])) score += 6;
    return { e, score: hits ? score * (hits / toks.length) : 0 };
  }).filter(r => r.score > 0.9).sort((a, b) => b.score - a.score).slice(0, 4);
}

function snippetFor(text, query) {
  const toks = qTokens(query);
  const parts = text.split(" · ");
  const good = parts.filter(p => toks.some(t => p.toLowerCase().includes(t)));
  const out = (good.length ? good : parts).slice(0, 3).join(" · ");
  return out.length > 260 ? out.slice(0, 257) + "..." : out;
}

function goToAppPlace(r) {
  if (!r.go) return;
  if (typeof closeKashvi === "function") closeKashvi();
  const tile = document.querySelector(`#mainSidebar > .navItem[data-section="${r.go}"]`);
  if (tile) tile.click();
  setTimeout(() => {
    if (r.sub) {
      const b = document.querySelector(`[data-${r.sub[0]}="${r.sub[1]}"]`);
      if (b) b.click();
    }
    if (r.std) {
      document.getElementById("stdSearch").value = "";
      renderIndStandards();
      const d = document.querySelector(`.stdItem[data-id="${r.std}"]`);
      if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }
    if (r.sop) {
      document.getElementById("sopSearch").value = "";
      renderSopList();
      const d = document.querySelector(`.sopItem[data-id="${r.sop}"]`);
      if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }
  }, 150);
}

function _escH(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function stdDetailHtml(id) {
  const x = IND_STANDARDS.find(z => z.id === id); if (!x) return "";
  return `<h4>Used for</h4><div>${_escH(x.scope)}</div><h4>Key points</h4><ul>${x.facts.map(f => `<li>${_escH(f)}</li>`).join("")}</ul>` +
    `<h4>Limits / clauses to follow</h4><div>${x.follow || "Detailed clauses and limits: <b>NOT FOUND</b>"}</div>`;
}
function sopMk(t) { // SOP text uses <sub>,<super>,<b>,<i>,<br/>, entities - keep only those tags
  return String(t == null ? "" : t).replace(/<super>/g, "<sup>").replace(/<\/super>/g, "</sup>")
    .replace(/<(?!\/?(sub|sup|b|i)>|br\s*\/?>)[^>]*>/g, "");
}
const SOP_LBL = {
  en: { purpose: "Purpose", scope: "Scope", reference: "Reference", range: "Range", principle: "Principle", apparatus: "Apparatus / Equipment",
    reagents: "Reagents", sampling: "Sample", procedure: "Procedure", end_point: "End point", calculation: "Calculation",
    precision: "Precision / Reproducibility", reporting: "Reporting", notes: "Notes", view: "🖨️ View / Print", other: "हिंदी में देखें" },
  hi: { purpose: "उद्देश्य (Purpose)", scope: "कार्य-क्षेत्र (Scope)", reference: "संदर्भ (Reference)", range: "रेंज (Range)",
    principle: "सिद्धांत (Principle)", apparatus: "उपकरण (Apparatus)", reagents: "रसायन / अभिकर्मक (Reagents)", sampling: "नमूना (Sample)",
    procedure: "विधि (Procedure)", end_point: "अंत बिंदु (End point)", calculation: "गणना (Calculation)", precision: "परिशुद्धता (Precision)",
    reporting: "रिपोर्टिंग (Reporting)", notes: "टिप्पणियाँ (Notes)", view: "🖨️ देखें / Print", other: "View in English" }
};
function sopLang() {
  try { return localStorage.getItem("sopLang") || localStorage.getItem("appLanguage") || "en"; } catch (e) { return "en"; }
}
function sopSetLang(l) { try { localStorage.setItem("sopLang", l); } catch (e) {} }
function sopDocOf(x, lang) {   // the language text + its diagrams (x.fig: one SVG, caption per language)
  const d = x[lang] || x.en;
  return x.fig && x.fig.length ? Object.assign({}, d, { figures: x.fig.map(f => ({ svg: f.svg, cap: f[lang] || f.en })) }) : d;
}
function sopPlainText(x) {
  const pl = (v) => String(v || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const one = (d) => [d.title, d.purpose, d.scope, d.reference, d.principle, (d.apparatus || []).join(" · "),
    (d.reagents || []).map(r => r.name + " " + (r.prep || "")).join(" · "), d.sampling, (d.procedure || []).join(" · "),
    (d.calculation || []).join(" · ")];
  return [x.cat, x.keywords, ...one(x.en), ...one(x.hi || {})].filter(Boolean).map(pl).join(" · ");
}
function sopBodyHtml(d, L, compact) {
  const ol = (a, type) => `<ol${type ? ` type="${type}"` : ""}>${a.map(v => `<li>${sopMk(v)}</li>`).join("")}</ol>`;
  const sec = (k, v) => v ? (compact ? `<h4>${L[k]}</h4><div>${sopMk(v)}</div>` : `<p class="sec"><b>${L[k]}:</b> ${sopMk(v)}</p>`) : "";
  const head = (k) => compact ? `<h4>${L[k]}</h4>` : `<p class="sec"><b>${L[k]}:</b></p>`;
  let h = ["purpose", "scope", "reference", "range", "principle"].map(k => sec(k, d[k])).join("");
  if (d.apparatus) h += head("apparatus") + ol(d.apparatus);
  (d.figures || []).forEach(f => {   // diagram (own SVG from data/sop_list.json) on a white card, so it reads in the dark theme too
    h += `<div class="sopFig" style="background:#fff;color:#000;border:1px solid #ccc;border-radius:8px;padding:8px;margin:10px 0;page-break-inside:avoid;break-inside:avoid">${f.svg}<div style="font-size:.9em;text-align:center;margin-top:4px">${sopMk(f.cap)}</div></div>`;
  });
  if (d.reagents) h += head("reagents") + `<ol>${d.reagents.map(r => `<li><b>${sopMk(r.name)}</b>${r.prep ? " — " + sopMk(r.prep) : ""}</li>`).join("")}</ol>`;
  h += sec("sampling", d.sampling);
  if (d.procedure) h += head("procedure") + ol(d.procedure, "a");
  h += sec("end_point", d.end_point);
  (d.tables || []).forEach(t => {
    const tb = `<table class="sopT${t.landscape ? " land" : ""}">` + t.rows.map((r, i) =>
      `<tr>${r.map(c => `<${i ? "td" : "th"}>${sopMk(c)}</${i ? "td" : "th"}>`).join("")}</tr>`).join("") + `</table>`;
    h += `<div class="sopTW${t.landscape && !compact ? " landPage" : ""}">${t.title ? `<p class="sec"><b>${sopMk(t.title)}</b></p>` : ""}<div style="overflow-x:auto">${tb}</div>${t.after ? `<div style="font-size:.9em">${sopMk(t.after)}</div>` : ""}</div>`;
  });
  if (d.calculation) h += head("calculation") + d.calculation.map(c => `<div>${sopMk(c)}</div>`).join("");
  h += sec("precision", d.precision) + sec("reporting", d.reporting);
  if (d.notes) h += head("notes") + ol(d.notes);
  return h;
}
function sopDetailHtml(id, langOpt) {
  const x = SOP_LIST.find(z => z.id === id); if (!x) return "";
  const lang = langOpt || sopLang(), d = sopDocOf(x, lang), L = SOP_LBL[lang];
  let h = `<div style="font-size:12px;opacity:.8">${_escH([x.cat, x.type === "SOP" ? "Sampling SOP" : "Work Instruction", "Rev " + (x.rev || "00")].join(" · "))}</div>`;
  h += `<div style="margin:8px 0;display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="sopDocBtn" data-id="${x.id}" data-l="${lang}" style="padding:6px 12px;border-radius:8px;font-size:13px;width:auto;">${L.view}</button>` +
    `<button type="button" class="secondary sopDocBtn" data-id="${x.id}" data-l="${lang === "hi" ? "en" : "hi"}" style="padding:6px 12px;border-radius:8px;font-size:13px;width:auto;">${L.other}</button></div>`;
  return h + `<div lang="${lang}">${sopBodyHtml(d, L, true)}</div>`;
}
function sopPrintableHtml(x, lang, mode) {
  const d = sopDocOf(x, lang), L = SOP_LBL[lang], e = _escH;
  const sans = "'Liberation Sans', Arial, 'Noto Sans Devanagari', 'Nirmala UI', sans-serif", serif = "'Times New Roman', Times, serif";
  const st = d.short_title || x.en.short_title || "";
  const head = `<div class="hd"><div class="c1"><div class="own">Durgesh Mishra</div><div class="tt">Title : ${sopMk(st)}</div></div>
    <div class="c2"><div>Department</div><div>${e(x.dept || "Quality")}</div></div>
    <div class="c3"><div>DOC. NO: ${e(x.no)}</div><div>Issue No./ Date :</div><div>Revision No. : ${e(x.rev || "00")}</div><div>Revision Date:</div></div></div>`;
  const foot = `<div class="ft">${["Prepared By", "Approved By", "Issued By", "Control Status"].map((c, i) =>
    `<div><div class="fh">${c}</div><div class="fb">${i === 0 ? `${SIGNATURE_IMG ? `<img src="${SIGNATURE_IMG}" alt="">` : ""}<span>Durgesh Mishra</span>` : ""}</div></div>`).join("")}</div>`;
  const landTbl = (t) => `<table class="pg landPage"><thead><tr><td>${head}</td></tr></thead><tbody><tr><td>${sopBodyHtml({ tables: [Object.assign({}, t, { landscape: true })] }, L, true)}</td></tr></tbody></table>`;
  const rotPage = (t, first) => `<div class="rotPage${first ? " first" : ""}"><div class="rotBox">${head}<div class="rotT">${sopBodyHtml({ tables: [Object.assign({}, t, { landscape: true })] }, L, true)}</div>${foot}</div></div>`;
  let html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(x.no)}</title><style>
  @page { size: A4; margin: 10mm 12mm; }
  html,body{background:#fff;color:#000;margin:0} body{font-family:${sans};font-size:10.5pt;line-height:1.42}
  .wrap{max-width:186mm;margin:0 auto;padding:8px} table.pg{width:100%;border-collapse:collapse;table-layout:fixed;overflow-wrap:anywhere} table.pg>thead td,table.pg>tfoot td{padding:0}
  .hd{display:flex;border:1px solid #000;margin-bottom:5mm;font-size:9pt} .hd>div{border-right:1px solid #000} .hd>div:last-child{border-right:0}
  .c1{width:34%;display:flex;flex-direction:column} .own{flex:1;display:flex;align-items:center;justify-content:center;font:bold 15pt ${serif};min-height:18mm;border-bottom:1px solid #000}
  .tt{padding:2px 4px;font-size:8pt} .c2{width:30%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13pt}
  .c3{flex:1;display:flex;flex-direction:column} .c3>div{flex:1;border-top:1px solid #000;padding:2px 4px;display:flex;align-items:flex-end} .c3>div:first-child{border-top:0}
  .ft{display:flex;border:1px solid #000;margin-top:5mm} .ft>div{flex:1;border-left:1px solid #000} .ft>div:first-child{border-left:0}
  .fh{border-bottom:1px solid #000;text-align:center;font:10pt ${serif};padding:2px} .fb{height:15mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;font-size:7pt}
  .fb img{height:9mm} h1{font:bold 13pt ${serif};text-align:center;text-decoration:underline;margin:0 0 8pt}
  .sec{margin:7pt 0 3pt;break-after:avoid} ol{margin:2pt 0;padding-left:24pt} li{margin:0 0 2pt}
  table.sopT{border-collapse:collapse;font-size:9pt;line-height:1.3;margin:3pt 0} .sopT td,.sopT th{border:.5pt solid #000;padding:2pt 3pt;vertical-align:top;text-align:left}
  .sopT th{background:#e8e8e8} .sopT.land{font-size:6pt;line-height:1.1} .sopT.land td,.sopT.land th{padding:.5pt;text-align:center}
  tr{break-inside:avoid} .landPage{page:land;break-before:page;table-layout:auto} .landPage .sopT{width:100%} .landPage .fb{height:9mm} .landPage .fb img{height:6mm} .landPage .own{min-height:9mm;font-size:12pt} .landPage .hd{margin-bottom:2mm;font-size:7.5pt} .landPage .ft{margin-top:2mm} .landPage .sopT.land{font-size:5.6pt;line-height:1.05} .landPage .sec{margin:0 0 2pt}
  @media print{ .wrap{max-width:none;padding:0} }
  .rotPage{display:none}
  @media print{
    .landScreen{display:none}
    .rotPage{display:block;break-before:page;position:relative;width:185mm;height:255mm;overflow:hidden}
    .rotPage.first{break-before:auto}
    .rotBox{position:absolute;top:0;left:0;width:255mm;height:185mm;transform-origin:0 0;transform:translateY(255mm) rotate(-90deg);display:flex;flex-direction:column}
    .rotBox .hd{margin-bottom:2mm;font-size:7pt} .rotBox .own{min-height:8mm;font-size:12pt} .rotBox .c2{font-size:11pt}
    .rotBox .ft{margin-top:auto} .rotBox .fb{height:9mm} .rotBox .fb img{height:6mm} .rotBox .fh{font-size:9pt}
    .rotBox .sec{margin:0 0 2pt;font-size:8pt} .rotBox .sopT{width:100%;table-layout:fixed;margin:0}
    .rotBox .sopT.land{font-size:6.2pt;line-height:1.15} .rotBox .sopT.land td,.rotBox .sopT.land th{padding:.4pt .1pt}
  }
  @media screen and (max-width:600px){ body{font-size:13px} .hd{font-size:10px} .own{font-size:15px} .c2{font-size:12px} }
  </style>
</head>
<body><div class="wrap"><table class="pg"><thead><tr><td>${head}</td></tr></thead><tfoot><tr><td>${foot}</td></tr></tfoot>
  <tbody><tr><td><h1>${sopMk(d.title)}</h1>${sopBodyHtml(Object.assign({}, d, { tables: (d.tables || []).filter(t => !t.landscape) }), L, false)}</td></tr></tbody></table>
  ${(d.tables || []).filter(t => t.landscape).map(t => `<div class="landScreen">${landTbl(t)}</div>${rotPage(t, false)}`).join("")}
  </div></body></html>`;
  if (mode === "land") {
    // only the landscape table(s); on paper they are printed turned sideways (rotated) so any phone / printer gives a full-size table
    const lt = (d.tables || []).filter(t => t.landscape);
    html = html.replace(/<body>[\s\S]*<\/body>/, `<body><div class="wrap landWrap"><div class="landScreen">${lt.map(landTbl).join("")}</div>${lt.map((t, i) => rotPage(t, i === 0)).join("")}</div></body>`)
      .replace("@page { size: A4; margin: 10mm 12mm; }", "@page { size: A4; margin: 10mm 12mm; } @media screen{ .landWrap{max-width:none;overflow-x:auto} .landWrap table.pg{table-layout:auto;overflow-wrap:normal} .landWrap .sopT td,.landWrap .sopT th{white-space:nowrap} .landWrap .sopT{min-width:900px} .landWrap .sopT.land{font-size:6.9pt;line-height:1.2} }");
  }
  return html;
}
// Landscape table as a real landscape A4 PDF page (upright, not turned sideways) - drawn on canvas so every phone gives the same result
async function sopLandPdf(x, lang) {
  const d = sopDocOf(x, lang), tables = (d.tables || []).filter(t => t.landscape);
  if (!tables.length) return;
  try { if (typeof account !== "undefined" && account) await loadSignature(); } catch (e) {}
  let sig = null;
  if (SIGNATURE_IMG) sig = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = SIGNATURE_IMG; });
  const txt = v => { const el = document.createElement("div"); el.innerHTML = sopMk(v); return el.textContent.replace(/\s+/g, " ").trim(); };
  const K = 10, W = 297 * K, H = 210 * K, ML = 12 * K, MT = 10 * K, CW = W - 2 * ML;   // 10 px per mm (254 dpi)
  const SERIF = "'Times New Roman', Times, 'Liberation Serif', 'Noto Serif Devanagari', serif";
  const SANS = "Arial, 'Liberation Sans', 'Noto Sans Devanagari', 'Nirmala UI', sans-serif";
  const st = (d.short_title || x.en.short_title || "").replace(/<[^>]+>/g, "");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  tables.forEach((t, ti) => {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.strokeStyle = "#000"; g.fillStyle = "#000"; g.textBaseline = "middle";
    const box = (x0, y0, w, h, lw) => { g.lineWidth = lw || 2; g.strokeRect(x0, y0, w, h); };
    const line = (x1, y1, x2, y2, lw) => { g.lineWidth = lw || 2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    const fit = (s, font, size, maxW) => { let z = size; g.font = font.replace("{}", z + "px"); while (z > 8 && g.measureText(s).width > maxW) { z -= 1; g.font = font.replace("{}", z + "px"); } return z; };
    // header (same boxes as the printed SOP)
    const HH = 20 * K, c1 = CW * 0.34, c2 = CW * 0.30, c3 = CW - c1 - c2, y0 = MT;
    box(ML, y0, CW, HH); line(ML + c1, y0, ML + c1, y0 + HH); line(ML + c1 + c2, y0, ML + c1 + c2, y0 + HH);
    line(ML, y0 + 13 * K, ML + c1, y0 + 13 * K);
    g.textAlign = "center"; fit("Durgesh Mishra", `bold {} ${SERIF}`, 58, c1 - 20); g.fillText("Durgesh Mishra", ML + c1 / 2, y0 + 6.5 * K);
    g.textAlign = "left"; fit("Title : " + st, `{} ${SANS}`, 30, c1 - 20); g.fillText("Title : " + st, ML + 10, y0 + 16.5 * K);
    g.textAlign = "center"; g.font = `46px ${SERIF}`; g.fillText("Department", ML + c1 + c2 / 2, y0 + 7 * K); g.fillText(x.dept || "Quality", ML + c1 + c2 / 2, y0 + 14 * K);
    g.textAlign = "left"; g.font = `30px ${SANS}`;
    ["DOC. NO: " + x.no, "Issue No./ Date :", "Revision No. : " + (x.rev || "00"), "Revision Date:"].forEach((s2, i) => {
      if (i) line(ML + c1 + c2, y0 + i * 5 * K, ML + CW, y0 + i * 5 * K); g.fillText(s2, ML + c1 + c2 + 10, y0 + i * 5 * K + 2.6 * K); });
    // table title
    let y = y0 + HH + 3 * K;
    const title = txt(t.title || "");
    if (title) { g.textAlign = "left"; fit(title, `bold {} ${SANS}`, 34, CW); g.fillText(title, ML, y + 2.4 * K); y += 6 * K; }
    // footer
    const FH = 18 * K, fy = H - MT - FH, fw = CW / 4;
    box(ML, fy, CW, FH); line(ML, fy + 6 * K, ML + CW, fy + 6 * K);
    ["Prepared By", "Approved By", "Issued By", "Control Status"].forEach((c, i) => { if (i) line(ML + i * fw, fy, ML + i * fw, fy + FH);
      g.textAlign = "center"; g.font = `36px ${SERIF}`; g.fillText(c, ML + i * fw + fw / 2, fy + 3 * K); });
    if (sig) { const sh = 8 * K, sw = Math.min(fw - 40, sig.naturalWidth * sh / sig.naturalHeight); g.drawImage(sig, ML + fw / 2 - sw / 2, fy + 6.5 * K, sw, sh); }
    g.font = `26px ${SANS}`; g.textAlign = "center"; g.fillText("Durgesh Mishra", ML + fw / 2, fy + FH - 1.6 * K);
    // the table itself - fills the space between title and footer
    const rows = t.rows.map(r => r.map(txt)), nC = Math.max(...rows.map(r => r.length));
    const tTop = y, tBot = fy - 3 * K, nR = rows.length;
    const rh = (tBot - tTop) / (nR + 0.5), hh = rh * 1.5;   // header row 1.5 x
    g.font = `bold 30px ${SANS}`;
    const h0 = (rows[0][0] || "").split(" "), h0a = h0.slice(0, Math.ceil(h0.length / 2)).join(" "), h0b = h0.slice(Math.ceil(h0.length / 2)).join(" ");
    const firstW = Math.min(CW * 0.12, Math.max(14 * K, g.measureText(h0a).width * 0.8 + 20, g.measureText(h0b).width * 0.8 + 20, ...rows.slice(1).map(r => g.measureText(r[0] || "").width + 20)));
    const cw = (CW - firstW) / (nC - 1), colX = i => ML + (i ? firstW + (i - 1) * cw : 0), colW = i => i ? cw : firstW;
    let fs = Math.floor(rh * 0.62); g.font = `${fs}px ${SANS}`;
    const widest = Math.max(...rows.slice(1).flatMap(r => r.slice(1).map(c => g.measureText(c).width)));
    if (widest > cw - 8) fs = Math.floor(fs * (cw - 8) / widest);
    g.fillStyle = "#e8e8e8"; g.fillRect(ML, tTop, CW, hh); g.fillStyle = "#000";
    rows.forEach((r, ri) => {
      const ry = ri ? tTop + hh + (ri - 1) * rh : tTop, h = ri ? rh : hh;
      for (let ci = 0; ci < nC; ci++) {
        const c = r[ci] || "", cx = colX(ci), w = colW(ci);
        g.textAlign = "center";
        if (ri === 0 || ci === 0) {
          const f0 = `bold {} ${SANS}`; let z = fit(c, f0, fs, w - 8);
          if (z < fs * 0.8 && / /.test(c)) {   // long header text: two lines
            const words = c.split(" "), half = Math.ceil(words.length / 2), l1 = words.slice(0, half).join(" "), l2 = words.slice(half).join(" ");
            z = Math.min(fit(l1, f0, fs, w - 8), fit(l2, f0, fs, w - 8)); g.font = f0.replace("{}", z + "px");
            g.fillText(l1, cx + w / 2, ry + h / 2 - z * 0.55); g.fillText(l2, cx + w / 2, ry + h / 2 + z * 0.55);
          } else g.fillText(c, cx + w / 2, ry + h / 2 + 1);
        } else { g.font = `${fs}px ${SANS}`; g.fillText(c, cx + w / 2, ry + h / 2 + 1); }
      }
      if (ri % 2 === 0 && ri) { g.fillStyle = "rgba(0,0,0,.035)"; g.fillRect(ML, ry, CW, h); g.fillStyle = "#000"; }
      line(ML, ry + h, ML + CW, ry + h, 1.5);
    });
    const tEnd = tTop + hh + (nR - 1) * rh;
    for (let ci = 1; ci < nC; ci++) line(colX(ci), tTop, colX(ci), tEnd, 1.5);
    box(ML, tTop, CW, tEnd - tTop, 2.5);
    if (t.after) { g.textAlign = "left"; fit(txt(t.after), `{} ${SANS}`, 26, CW); g.fillText(txt(t.after), ML, tEnd + 1.5 * K); }
    if (ti) doc.addPage("a4", "landscape");
    doc.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 297, 210, undefined, "FAST");
  });
  const blob = doc.output("blob"), u = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = u; a.download = `${x.no.replace(/\//g, "-")}_Table_${lang === "hi" ? "HI" : "EN"}.pdf`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
  if (!SIGNATURE_IMG && typeof sigMissingWarn === "function" && typeof account !== "undefined" && account) sigMissingWarn();
}
function openSopDoc(id, lang, mode) {
  const x = SOP_LIST.find(z => z.id === id); if (!x) return;
  lang = lang || sopLang();
  if (typeof closeKashvi === "function") closeKashvi();
  let ov = document.getElementById("sopDocOverlay");
  if (!ov) {
    ov = document.createElement("div"); ov.id = "sopDocOverlay";
    ov.style.cssText = "position:fixed;inset:0;z-index:10050;background:#fff;display:flex;flex-direction:column;";
    ov.innerHTML = `<div style="display:flex;gap:6px;align-items:center;padding:8px 10px;background:#1f2937;color:#fff;flex-wrap:wrap">
      <b id="sopDocTitle" style="flex:1;min-width:120px;font-size:14px"></b>
      <button type="button" id="sopDocLang" style="width:auto;padding:5px 10px;font-size:13px"></button>
      <button type="button" id="sopDocLand" style="width:auto;padding:5px 10px;font-size:13px">📐 Table (landscape)</button>
      <button type="button" id="sopDocPrint" style="width:auto;padding:5px 10px;font-size:13px">🖨️ Print / PDF</button>
      <button type="button" id="sopDocClose" style="width:auto;padding:5px 10px;font-size:13px">✕</button></div>
      <iframe id="sopDocFrame" title="SOP / WI" style="flex:1;border:0;width:100%;background:#fff"></iframe>`;
    document.body.appendChild(ov);
    ov.querySelector("#sopDocClose").addEventListener("click", () => ov.classList.add("hidden"));
    ov.querySelector("#sopDocPrint").addEventListener("click", async () => {
      if (ov.dataset.mode === "land") {   // table only: a real landscape A4 PDF (upright)
        const b = ov.querySelector("#sopDocPrint"), t0 = b.textContent; b.disabled = true; b.textContent = "⏳ Making PDF...";
        try { await sopLandPdf(SOP_LIST.find(z => z.id === ov.dataset.id), ov.dataset.lang); } catch (e) { alert("PDF failed: " + e.message); }
        finally { b.disabled = false; b.textContent = t0; }
        return;
      }
      // the browser names the saved PDF after the page title ("Moltrix") - give it the document's own name while printing
      const f = document.getElementById("sopDocFrame"), x0 = SOP_LIST.find(z => z.id === ov.dataset.id);
      const nm = `${String(x0 ? x0.no : "Document").replace(/[\\/:*?"<>|]+/g, "-")}_${ov.dataset.lang === "hi" ? "HI" : "EN"}`;
      const oldTop = document.title, fd = f.contentDocument, oldIn = fd ? fd.title : "";
      let restored = false;
      const restore = () => { if (restored) return; restored = true; document.title = oldTop; try { if (fd) fd.title = oldIn; } catch (e) {} };
      document.title = nm; try { if (fd) fd.title = nm; } catch (e) {}
      try { f.contentWindow.addEventListener("afterprint", () => setTimeout(restore, 500), { once: true }); } catch (e) {}
      window.addEventListener("afterprint", () => setTimeout(restore, 500), { once: true });
      setTimeout(restore, 120000);
      f.contentWindow.focus(); f.contentWindow.print(); });
    ov.querySelector("#sopDocLang").addEventListener("click", () => openSopDoc(ov.dataset.id, ov.dataset.lang === "hi" ? "en" : "hi", ov.dataset.mode));
    ov.querySelector("#sopDocLand").addEventListener("click", () => openSopDoc(ov.dataset.id, ov.dataset.lang, ov.dataset.mode === "land" ? "" : "land"));
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") ov.classList.add("hidden"); });
  }
  const hasLand = (sopDocOf(x, lang).tables || []).some(t => t.landscape);
  mode = hasLand && mode === "land" ? "land" : "";
  ov.dataset.id = id; ov.dataset.lang = lang; ov.dataset.mode = mode;
  ov.querySelector("#sopDocTitle").textContent = `${x.no} (${lang === "hi" ? "हिंदी" : "English"})${mode ? " — Table (landscape)" : ""}`;
  ov.querySelector("#sopDocLang").textContent = lang === "hi" ? "English" : "हिंदी";
  const lb = ov.querySelector("#sopDocLand");
  lb.style.display = hasLand ? "" : "none"; lb.textContent = mode ? "📄 Full document" : "📐 Table (landscape)";
  ov.querySelector("#sopDocPrint").textContent = mode ? "⬇️ Landscape PDF" : "🖨️ Print / PDF";
  document.getElementById("sopDocFrame").srcdoc = sopPrintableHtml(x, lang, mode);
  ov.classList.remove("hidden");
}
document.addEventListener("click", (ev) => {
  const b = ev.target.closest && ev.target.closest(".sopDocBtn");
  if (b) { ev.preventDefault(); openSopDoc(b.dataset.id, b.dataset.l); return; }
  const l = ev.target.closest && ev.target.closest("#sopLangSw button");
  if (l) { sopSetLang(l.dataset.l); renderSopList(); }
});

function askAppendResults(results, query) {
  const chat = document.getElementById(_askChatTarget);
  const box = document.createElement("div");
  box.style.cssText = "margin-bottom:10px; padding:10px 12px; border-radius:10px; max-width:92%; font-size:13px; line-height:1.45; background:rgba(0,0,0,.06); color:var(--ink);";
  if (!results.length) {
    box.textContent = "Nothing about that was found inside the app (NOT FOUND). Try other words - e.g. a standard number, a report name or a sheet name.";
  } else {
    const icon = { section: "📂", std: "📚", faq: "💡", sop: "📋" };
    results.forEach(({ e }) => {
      const card = document.createElement("div");
      card.style.cssText = "padding:8px 0; border-bottom:1px solid rgba(128,128,128,.25);";
      const t = document.createElement("div"); t.style.fontWeight = "700"; t.textContent = `${icon[e.kind]} ${e.title}`;
      const p = document.createElement("div"); p.style.cssText = "margin:3px 0 6px; opacity:.9;"; p.textContent = e.kind === "faq" ? e.text : snippetFor(e.text, query);
      card.append(t, p);
      // Standards and SOPs open right here in the chat (works without sign-in)
      if (e.kind === "std" || e.kind === "sop") {
        const more = document.createElement("button");
        more.className = "secondary"; more.style.cssText = "padding:4px 12px; font-size:12px; width:auto; margin-right:6px;";
        more.textContent = "Show details";
        more.addEventListener("click", () => {
          more.remove();
          const d = document.createElement("div");
          d.className = "stdBody"; d.style.padding = "4px 0 0";
          d.innerHTML = e.kind === "std" ? stdDetailHtml(e.std) : sopDetailHtml(e.sop);
          card.insertBefore(d, card.querySelector("button"));
          chat.scrollTop = chat.scrollHeight;
        });
        card.append(more);
      }
      if (e.go && account) {
        const b = document.createElement("button");
        b.className = "secondary"; b.style.cssText = "padding:4px 12px; font-size:12px; width:auto;";
        b.textContent = "Open"; b.addEventListener("click", () => goToAppPlace(e));
        card.append(b);
      }
      box.append(card);
    });
  }
  chat.appendChild(box);
  chat.scrollTop = chat.scrollHeight;
}

// Replace the old Ask button handler with the combined one.
(function wireAnyQuery() {
  const oldBtn = document.getElementById("askDataSendBtn");
  const btn = oldBtn.cloneNode(true);
  oldBtn.replaceWith(btn);
  btn.addEventListener("click", async () => {
    _askChatTarget = "askDataChat";
    const input = document.getElementById("askDataInput");
    const question = input.value.trim();
    if (!question) return;
    input.value = "";
    await answerAnyQuery(question);
  });
})();

