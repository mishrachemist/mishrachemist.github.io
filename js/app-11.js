/* ===================== PHYSICAL STOCK VERIFICATION ===================== */
// Same 4 blocks and the same formulas as the "SMS" sheet of the monthly
// Physical_Stock_Verification file:
//   Raw Material (Scrap) / (Other than Scrap):  F = physical + E
//   Finished Good:  C = pieces (or metres for RANDOM), F = C x length x density, E entered in pieces
//   By Product:     F = physical
//   every row:      G = (F - E) - D,  H = G / D        (D = ERP stock, E = receipt/issue after the ERP report)
// ERP stock is the Raw Material Stock report's closing stock on the "ERP Stock as on" date
// (billets: the Daily Stock sheet's ERP stock weight). Entries stay on this phone (localStorage).
const PSV_DENS = { 110: 0.095, 130: 0.132335, 160: 0.198005 };   // MT per metre, as in the sheet
const PSV_FG_DEFAULT = [
  { name: "110 X 110 RANDOM", sec: 110, len: 0, uom: "MTR" },
  { name: "130 X 130 X 6", sec: 130, len: 6, uom: "MT" }, { name: "130 X 130 X 5", sec: 130, len: 5, uom: "MT" },
  { name: "130 X 130 X 4", sec: 130, len: 4, uom: "MT" }, { name: "130 X 130 X 3", sec: 130, len: 3, uom: "MT" },
  { name: "160 X 160 X 5", sec: 160, len: 5, uom: "MT" }, { name: "160 X 160 X 4", sec: 160, len: 4, uom: "MT" },
  { name: "160 X 160 X 3", sec: 160, len: 3, uom: "MT" }
];
const PSV_SECTIONS = [
  { key: "scrap", nature: "Raw Material (Scrap)", mode: "rm",
    head: ["Lot No", "UOM", "Lot Weight"],
    items: [
      { name: "STEEL MELTING SCRAP", erp: "Steel Melting Scrap", lots: 4, lotRe: /^STEEL\s*MELTING\s*SCRAP\b/i,
        lotLabel: n => `STEEL MELTING SCRAP ${n}` + (n === 1 ? " (Incoming)" : n === 4 ? " (Running)" : "") },
      { name: "MS SCRAP-ROLLING", erp: "MS Scrap - Rolling Mill" },
      { name: "MS SCRAP", erp: "MS Scrap" },
      { name: "CI MIX SCRAP", label: "CI MIX SCRAP (Weighted)", erp: "CI Mix Scrap" }] },
  { key: "other", nature: "Raw Material (Other than Scrap)", mode: "rm", measLabel: "Measurement (L × W × H)",
    head: ["Name of item", "UOM", "Measurement by Length, Width and Height"],
    items: [
      { name: "SI LUMPS", erp: "Lumps", lots: 2, fixedLots: true, lotRe: /^SI\s*LUMPS\b/i, lotLabel: n => `SI LUMPS LOT ${n}` },
      { name: "S I PELLETS", erp: "Pellets" }, { name: "SI FINES", erp: "Fines" },
      { name: "PIG IRON", label: "PIG IRON (Weighted)", erp: "Pig Iron" }, { name: "SILICO MANGANESE", label: "SILICO MANGANESE (Weighted)", erp: "Silico Manganeese" }] },
  { key: "fg", nature: "Finished Good", mode: "fg",
    head: ["Size of Billet & Length of Billet", "UOM", "Measurement using by counting of No. of billets (i.e. No. of pieces X density)"],
    items: [] },   // filled from PSV_FG_DEFAULT + extra Daily Stock sizes
  { key: "bp", nature: "By Product", mode: "bp", measLabel: "Visual estimate",
    head: ["Name of item", "UOM", "Visual Estimate"],
    items: [
      { name: "BAG FILTER DUST", label: "BAG FILTER DUST (Weighted)", erp: "Bag Filter Dust" }, { name: "MILL SCALE", erp: "Mill Scale-SMS" },
      { name: "RAW SLAG", label: "RAW SLAG (Weighted)", erp: "Raw Slag" }, { name: "SLAG METAL FINES", erp: "Slag Metal Fines, Size: 1mm to 3mm" },
      { name: "SLAG WASTE", erp: "Slag Waste" }, { name: "OVER SIZE SPONGE", label: "OVER SIZE SPONGE (Weighted)", erp: "Over Size Sponge" },
      { name: "SCRAP DUST (MIX)", erp: null }] }
];
// 2nd sheet "SMS - RM" (monthly stock & consumption): [particular, Raw Material Stock item, assumed yield]
const PSV_RM_ROWS = [["SPONGE IRON LUMPS", "Lumps", 0.7832], ["SPONGE IRON FINES", "Fines", 0.734], ["SPONGE IRON PELLETS", "Pellets", 0.7893],
  ["PIG IRON", "Pig Iron"], ["PIG IRON SPLASHES", null], ["SCRAP", "Steel Melting Scrap"], ["PIG IRON GRANULATED", null], ["CI MIX SCRAP", "CI Mix Scrap"],
  ["MS SCRAP- ROLLING MILL", "MS Scrap - Rolling Mill"], ["PCM JAM/CI RUNNER", null], ["MS SCRAP", "MS Scrap"], ["MS SKULL", null], ["OVER SIZE MAG", null],
  ["SLAG METAL (Mag Material)", "Mag Material"], ["Hot Roll Coil Random", null]];
// rows 31-70 of that sheet (billet -> strip -> coil -> pipe balance): labels, norms and formulas only, no month figures
const PSV_RM_SPEC = [["A31","f","+H31"],["H31","d",null],["A32","s","Billet received from SMS"],["D32","f","I33"],["H32","s","Opening"],["I32","s","Received"],["J32","s","Production"],["K32","s","M to M"],["L32","s","issue"],["M32","s","Coil build "],["N32","s","Coil slit"],["O32","s","Pipe"],["P32","s","Inter div"],["Q32","s","SMS (Ms scrap)"],["R32","s","Sale"],["S32","s","Closing"],["T32","s","ERP  stock"],["U32","s","Diff"],["V32","s","Closing Physical"],["W32","s","Diff"],["A33","s","Opening stock & closing of billet"],["B33","f","+H33"],["C33","f","+S33"],["D33","f","+D32+B33-C33"],["G33","s","Billet"],["I33","f","-'SMS - RM'!F28"],["K33","f","-I33"],["S33","f","SUM(H33:R33)"],["U33","f","+T33-S33"],["A34","s","Billet to strip"],["B34","f","+SUM(B36:B39)"],["C34","f","+SUM(C36:C39)"],["D34","f","-K33"],["A36","s","Hot Roll Coil"],["B36","f","100%-SUM(B37:B39)"],["C36","f","+IFERROR(D36/$D$34,0)"],["D36","f","+J36"],["G36","s","Hot Roll Coil "],["I36","f","-SUM(K33)"],["S36","f","SUM(J36:R36)+H36"],["U36","f","+T36-S36"],["W36","f","+S36+S44+S50-V36"],["A37","s","Mill Scale"],["B37","p",0.015],["C37","f","+IFERROR(D37/$D$34,0)"],["D37","f","+J37"],["G37","s","Mill Scale-Strip"],["S37","f","SUM(H37:R37)"],["U37","f","+T37-S37"],["W37","f","+S37-V37"],["A38","s","Miss roll"],["B38","p",0.01],["C38","f","+IFERROR(D38/$D$34,0)"],["D38","f","+J38"],["G38","s","Miss roll"],["S38","f","SUM(H38:R38)"],["U38","f","+T38-S38"],["W38","f","+S38-V38"],["A39","f","+G39"],["B39","p",0.0045],["C39","f","+IFERROR(D39/$D$34,0)"],["D39","f","+J39"],["G39","s","Roughing Shear End Cut"],["S39","f","SUM(H39:R39)"],["U39","f","+T39-S39"],["W39","f","+S39-V39"],["D40","f","SUM(D36:D39)"],["C41","s","Diff"],["D41","f","+D33-D40"],["A44","s","Hot Roll Coil build up"],["B44","f","100%-B45-B46"],["C44","f","+IFERROR(D44/$I$44,0)"],["D44","f","+J44"],["G44","s","Hot Roll Coil build up"],["I44","f","-M36"],["S44","f","+H44+I44-J45-J46+SUM(K44:R44)"],["U44","f","+T44-S44"],["A45","s","End cut Coil build up"],["B45","p",0.012],["C45","f","+IFERROR(D45/$I$44,0)"],["D45","f","+J45"],["G45","s","End cut Coil build up"],["S45","f","SUM(J45:R45)+H45"],["U45","f","+T45-S45"],["W45","f","+S45-V45"],["A46","s","Mill Scale- Coil Build up"],["B46","p",0.005],["C46","f","+IFERROR(D46/$I$44,0)"],["D46","f","+J46"],["G46","s","Mill Scale- Coil Build up"],["S46","f","SUM(J46:R46)+H46"],["U46","f","+T46-S46"],["W46","f","+S46-V46"],["D47","f","SUM(D44:D46)"],["C48","s","Diff"],["D48","f","+D47-I44"],["A50","s","Hot Roll Coil Slit"],["B50","f","100%-B51-B52"],["C50","f","+IFERROR(D50/$I$50,0)"],["D50","f","+J50"],["G50","s","Hot Roll Coil Slit"],["I50","f","-N44-N36"],["S50","f","+H50+I50-J51-J52+SUM(K50:R50)"],["U50","f","+T50-S50"],["A51","s","Slitting"],["B51","p",0.013],["C51","f","+IFERROR(D51/$D$36,0)"],["D51","f","+J51"],["G51","s","Slitting"],["S51","f","SUM(H51:R51)"],["U51","f","+T51-S51"],["W51","f","+S51-V51"],["A52","s","Mill Scale- Slitting"],["B52","p",0.002],["C52","f","+IFERROR(D52/$D$36,0)"],["D52","f","+J52"],["G52","s","Mill Scale- Slitting"],["S52","f","SUM(H52:R52)"],["U52","f","+T52-S52"],["W52","f","+S52-V52"],["D53","f","SUM(D50:D52)"],["C54","s","Diff"],["D54","f","+I50-D53"],["A56","s","Total strip"],["B56","f","100%-SUM(B37:B39)-B45-B51-B46-B52"],["C56","f","100%-SUM(C37:C39)-C45-C46-C51-C52"],["A59","s","Pipe"],["B59","f","100%-SUM(B61:B67)"],["C59","f","+IFERROR(D59/$I$59,0)"],["D59","f","+J59"],["G59","s","Pipe"],["I59","f","-O44-O50-O36"],["S59","f","+SUM(H59:I59)-SUM(J60:J67)+SUM(K59:R59)"],["U59","f","+T59-S59"],["W59","f","+S59+S60-V59-V60"],["A60","s","WIP -Pipe"],["B60","p",0],["C60","f","+IFERROR(D60/$I$59,0)"],["D60","f","+J60"],["G60","s","WIP Pipe"],["S60","f","SUM(H60:R60)"],["U60","f","+T60-S60"],["A61","s","Mill Scale (%)"],["B61","p",0.003],["C61","f","+IFERROR(D61/$I$59,0)"],["D61","f","+J61"],["G61","s","Mill Scale (%)"],["S61","f","SUM(H61:R61)"],["U61","f","+T61-S61"],["W61","f","+S61-V61"],["A62","s","Bead (%)"],["B62","p",0.005],["C62","f","+IFERROR(D62/$I$59,0)"],["D62","f","+J62"],["G62","s","Bead (%)"],["S62","f","SUM(H62:R62)"],["U62","f","+T62-S62"],["W62","f","+S62-V62"],["A63","s","End cutting (%) - Accumulator"],["B63","p",0.001],["C63","f","+IFERROR(D63/$I$59,0)"],["D63","f","+J63"],["G63","s","End Accumulator"],["S63","f","SUM(H63:R63)"],["U63","f","+T63-S63"],["W63","f","+S63-V63"],["A64","s","End cutting (%) - Pipe"],["B64","p",0.0015],["C64","f","+IFERROR(D64/$I$59,0)"],["D64","f","+J64"],["G64","s","End Pipe"],["S64","f","SUM(H64:R64)"],["U64","f","+T64-S64"],["W64","f","+S64-V64"],["A65","s","Random Pipe"],["B65","p",0],["C65","f","+IFERROR(D65/$I$59,0)"],["D65","f","+J65"],["G65","s","Random Pipe"],["S65","f","SUM(H65:R65)"],["U65","f","+T65-S65"],["W65","f","+S65-V65"],["A66","s","Rejection (%)"],["B66","p",0.02],["C66","f","+IFERROR(D66/$I$59,0)"],["D66","f","+J66"],["G66","s","Rejection (%)"],["S66","f","SUM(H66:R66)"],["U66","f","+T66-S66"],["W66","f","+S66-V66"],["A67","s","Joint Loss (%)"],["B67","p",0.031],["C67","f","+IFERROR(D67/$I$59,0)"],["D67","f","+J67"],["G67","s","Joint Loss (%)"],["S67","f","SUM(H67:R67)"],["U67","f","+T67-S67"],["W67","f","+S67-V67"],["D68","f","SUM(D59:D67)"],["P68","f","+SUM(P59:P67)+SUM(P50:P52)+SUM(P44:P46)+SUM(P36:P39)"],["Q68","f","+SUM(Q59:Q67)+SUM(Q50:Q52)+SUM(Q44:Q46)+SUM(Q36:Q39)"],["R68","f","+SUM(R59:R67)+SUM(R50:R52)+SUM(R44:R46)+SUM(R36:R39)"],["S68","f","+SUM(S60:S67)+S51+S52+S45+S46"],["T68","f","+SUM(T60:T67)+T51+T52+T45+T46"],["C69","s","Diff"],["D69","f","+D68-I59"],["J69","f","+SUM(J36:J68)"],["K69","f","+SUM(K59:K67)+SUM(K50:K51)+SUM(K44:K46)+SUM(K36:K39)"],["A70","s","Total shortage / (excess) Production"],["B70","f","+B56*B59"],["C70","f","+C56*C59"],["D70","f","+D41+D48+D54+D69"]];
const PSV_HEAD_REST = ["ERP Stock", "Receipt/issue after ERP Stock report generated", "Physical stock", "Gap", "Gap %", "Date of adjustment in Books", "Remarks"];
const PSV_LETTERS = ["A", "B", "C", "D", "E", "F", "G=(F-E)-D", "H=G/D×100", "I", "J"];
const PSV_KEY = "psvDraft";
// signature block: QAD-Team x2, Finance Team x1, Prod Team x2, Plant Head x1 (older entries had one "Deptt. -HOD" -> Prod Team 1)
function psvSigners(s) { s = s || {}; return { qad: s.qad || "", qad2: s.qad2 || "", fin: s.fin || "", prod: s.prod || s.hod || "", prod2: s.prod2 || "", ph: s.ph || "" }; }
let psvState = null;

function psvNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "" || s === "-" || s === ".") return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}
function psvSizeKey(name) {
  const up = String(name || "").toUpperCase();
  const nums = (up.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!nums.length) return "";
  if (/RAND/.test(up)) return nums[0] + "|R";
  const len = nums.length >= 3 ? nums[2] : nums[1];
  return len === undefined ? "" : nums[0] + "|" + len;
}
function psvFgItems() {
  const extra = (psvState && psvState.extraFg) || [];
  return PSV_FG_DEFAULT.concat(extra).map(f => ({ name: f.name, sec: f.sec, len: f.len, uom: f.uom || (f.len ? "MT" : "MTR"), fgKey: psvSizeKey(f.name) }));
}
// items a month's file had beyond the usual list (e.g. PIG IRON GRANULES, CI SKULL) - kept per verification, ERP entered by hand
function psvExtraItems(sec) { const x = psvState && psvState.extraItems && psvState.extraItems[sec.key]; return Array.isArray(x) ? x.map(n => ({ name: n, erp: null, extra: true })) : []; }
function psvSectionItems(sec) { return sec.key === "fg" ? psvFgItems() : sec.items.concat(psvExtraItems(sec)); }
function psvId(sec, item) { return sec.key + ":" + item.name; }
const psvLabel = item => item.label || item.name;
function psvLotLabel(item, n) { return item.lotLabel ? item.lotLabel(n) : `${item.name} ${n}`; }
function psvSt(sec, item) {
  const id = psvId(sec, item);
  if (!psvState.items[id]) psvState.items[id] = { erp: "", e: "", phys: "", lots: item.lots ? new Array(item.lots).fill("") : undefined, meas: "", adj: "", rem: "", src: "" };
  const st = psvState.items[id];
  if (item.lots && !Array.isArray(st.lots)) {
    st.lots = new Array(item.lots).fill("");
    if (psvNum(st.phys) !== null) st.lots[0] = st.phys;   // saved before this item had lots
  }
  if (item.fixedLots && Array.isArray(st.lots)) {         // SI LUMPS: always LOT 1 and LOT 2
    const extra = st.lots.slice(item.lots).map(psvNum).filter(v => v !== null).reduce((a, b) => a + b, 0);
    st.lots = st.lots.slice(0, item.lots); while (st.lots.length < item.lots) st.lots.push("");
    if (extra) st.lots[item.lots - 1] = String(Math.round(((psvNum(st.lots[item.lots - 1]) || 0) + extra) * 1000) / 1000);
  }
  return st;
}
function psvLoad() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(PSV_KEY) || "null"); } catch (e) { o = null; }
  psvState = Object.assign({ period: "Monthly", division: "SMS", date: "", erpDate: "", signs: {}, items: {}, extraFg: [] }, o || {});
  if (!psvState.items || typeof psvState.items !== "object") psvState.items = {};
  if (!Array.isArray(psvState.extraFg)) psvState.extraFg = [];
  if (!psvState.signs || typeof psvState.signs !== "object") psvState.signs = {};
  psvMigrate(psvState);
}

// Older versions kept rows like "SI LUMPS LOT 1", "PIG IRON (Weighted)", "CI MIX SCRAP (Weighted)" as extra items
// beside the usual ones (so the report showed an empty "SI LUMPS" / "PIG IRON" row too). Move them into the usual item.
function psvMigrate(state) {
  if (!state || !state.extraItems || typeof state.extraItems !== "object") return state;
  const norm = x => String(x || "").toUpperCase().replace(/\([^)]*\)/g, "").replace(/[^A-Z0-9]/g, "");
  const empty = st => !st || (![st.phys, st.e, st.erp, st.adj, st.rem, st.meas].some(v => String(v || "").trim()) && !(st.lots || []).some(v => String(v || "").trim()));
  PSV_SECTIONS.forEach(sec => {
    const list = state.extraItems[sec.key]; if (!Array.isArray(list) || !list.length) return;
    const keep = [];
    list.forEach(name => {
      const xid = sec.key + ":" + name, x = state.items[xid];
      const lotItem = sec.items.find(it => it.lots && it.lotRe && it.lotRe.test(name));
      const std = lotItem || sec.items.find(it => norm(it.name) === norm(name) || norm(it.label) === norm(name));
      if (!std) { keep.push(name); return; }
      const sid = sec.key + ":" + std.name;
      const cur = state.items[sid];
      if (lotItem) {
        const st = cur && Array.isArray(cur.lots) ? cur : Object.assign({ erp: "", e: "", phys: "", meas: "", adj: "", rem: "", src: "" }, cur || {}, { lots: new Array(lotItem.lots).fill("") });
        const m = /(\d+)\s*$/.exec(name.replace(/\([^)]*\)/g, "").trim());
        const li = Math.max(0, (m ? +m[1] : 1) - 1);
        while (st.lots.length <= li) st.lots.push("");
        if (x) {
          const phys = psvNum(x.phys), e = psvNum(x.e) || 0;
          if (phys !== null) st.lots[li] = String(Math.round(phys * 1000) / 1000);   // the old row kept F - E as its physical
          if (li === 0 || !String(st.erp || "").trim()) {
            ["erp", "src", "adj", "rem"].forEach(k => { if (String(x[k] || "").trim() && !String(st[k] || "").trim()) st[k] = x[k]; });
            if (e && !String(st.e || "").trim()) st.e = x.e;
          }
        }
        state.items[sid] = st;
      } else if (empty(cur) && x) {
        state.items[sid] = Object.assign({}, x);
      } else if (!empty(x)) { keep.push(name); return; }
      delete state.items[xid];
    });
    state.extraItems[sec.key] = keep;
  });
  return state;
}
let psvReadOnly = false;   // a locked month opened from "Saved verifications": view + download only
function psvSave() { if (psvReadOnly) return; try { localStorage.setItem(PSV_KEY, JSON.stringify(psvState)); } catch (e) { /* storage blocked: still works for this session */ } }
function psvDirty() { if (!psvReadOnly) { psvState.dirty = true; psvSave(); psvBanner(); } }

// One row's numbers, exactly as the sheet works them out.
function psvCalc(sec, item, st) {
  const D = psvNum(st.erp);
  let C = null, E = psvNum(st.e) || 0, F = null, lotsSum = null, factor = null;
  if (item.lots) {
    const nums = st.lots.map(psvNum).filter(v => v !== null);
    if (nums.length) { lotsSum = nums.reduce((a, b) => a + b, 0); F = lotsSum + E; }
  } else if (sec.mode === "fg") {
    const dens = PSV_DENS[item.sec] || 0;
    factor = item.len ? item.len * dens : dens;
    C = psvNum(st.phys);
    E = (psvNum(st.e) || 0) * factor;          // receipt/issue entered in pieces (metres for RANDOM)
    if (C !== null) F = C * factor;            // physical stock does NOT add E (sheet: AB = Y x len x density)
  } else if (sec.mode === "rm") {
    const p = psvNum(st.phys);
    if (p !== null) F = p + E;                 // sheet: Q = physical + P
  } else {
    const p = psvNum(st.phys);
    if (p !== null) F = p;                     // sheet: AM = physical
  }
  let G = null, H = null;
  if (F !== null) { G = (F - E) - (D || 0); H = D ? G / D : null; }
  return { C, D, E, F, G, H, lotsSum, factor, ePcs: sec.mode === "fg" ? psvNum(st.e) : null };
}
function psvTotals(sec) {
  const t = { D: 0, E: 0, F: 0, G: 0 };
  psvSectionItems(sec).forEach(item => {
    const r = psvCalc(sec, item, psvSt(sec, item));
    t.D += r.D || 0; t.E += r.E || 0; t.F += r.F || 0; t.G += r.G || 0;
  });
  t.H = t.D ? t.G / t.D : null;
  return t;
}
const psvF3 = v => (v === null || v === undefined || !isFinite(v)) ? "" : v.toFixed(3);
const psvPct = v => (v === null || v === undefined || !isFinite(v)) ? "" : (v * 100).toFixed(2) + "%";

const psvOpenIds = new Set();   // which items are opened (kept when the list is drawn again)
function psvRender() {
  const box = document.getElementById("psvBody");
  if (!box) return;
  const inp = (field, val, ph, mode) => `<input type="text" inputmode="${mode || "decimal"}" data-f="${field}" value="${_escH(val)}" placeholder="${_escH(ph || "")}">`;
  let h = "";
  PSV_SECTIONS.forEach(sec => {
    h += `<div class="psvSec" data-sec="${sec.key}"><div class="psvSecHead">${_escH(sec.nature)}</div>`;
    psvSectionItems(sec).forEach(item => {
      const st = psvSt(sec, item), id = psvId(sec, item);
      const uom = item.uom || "MT";
      h += `<details class="psvItem" data-id="${_escH(id)}"${psvOpenIds.has(id) ? " open" : ""}>`;
      h += `<summary class="psvItemHead"><span class="psvChev">▸</span><b>${_escH(psvLabel(item))}</b><span class="psvUom">${_escH(uom)}</span>` +
        (st.src === "auto" ? `<span class="psvBadge">ERP auto</span>` : (item.erp === null ? `<span class="psvBadge psvBadgeM">ERP manual</span>` : "")) +
        `<span class="psvSum" data-sum="1"></span></summary>`;
      h += `<div class="psvFields">`;
      h += `<label>ERP Stock (MT)${inp("erp", st.erp, "0.000")}</label>`;
      h += `<label>Receipt/Issue after ERP report ${sec.mode === "fg" ? (item.len ? "(pcs, ±)" : "(m, ±)") : "(MT, ±)"}${inp("e", st.e, "0", "text")}</label>`;
      if (item.lots) {
        st.lots.forEach((lv, li) => {
          h += `<label>${_escH(psvLotLabel(item, li + 1))} (MT)<input type="text" inputmode="decimal" data-f="lot" data-li="${li}" value="${_escH(lv)}" placeholder="0"></label>`;
        });
      } else if (sec.mode === "fg") {
        h += `<label>${item.len ? "No. of pieces" : "Metres"}${inp("phys", st.phys, "0")}</label>`;
      } else {
        h += `<label>Physical (MT)${inp("phys", st.phys, "0.000")}</label>`;
      }
      if (sec.measLabel && !item.lots) h += `<label>${_escH(sec.measLabel)}<input type="text" data-f="meas" value="${_escH(st.meas)}"></label>`;
      h += `</div>`;
      if (item.lots && !item.fixedLots) h += `<div class="psvLotBtns"><button type="button" class="psvMini" data-act="addlot">+ Lot</button>${st.lots.length > 1 ? `<button type="button" class="psvMini" data-act="dellot">− Lot</button>` : ""}</div>`;
      h += `<div class="psvRes" data-res="1"></div>`;
      h += `<details class="psvMore"><summary>Date of adjustment / Remarks</summary><div class="psvFields">` +
        `<label>Date of adjustment in Books<input type="text" data-f="adj" value="${_escH(st.adj)}" placeholder="dd-mm-yyyy"></label>` +
        `<label>Remarks<input type="text" data-f="rem" value="${_escH(st.rem)}"></label></div></details>`;
      h += `</details>`;
    });
    h += `<div class="psvSecTot" data-tot="${sec.key}"></div></div>`;
  });
  box.innerHTML = h;
  box.querySelectorAll("details.psvItem").forEach(d => d.addEventListener("toggle", () => {
    if (d.open) psvOpenIds.add(d.dataset.id); else psvOpenIds.delete(d.dataset.id);
  }));
  if (psvReadOnly) box.querySelectorAll("input,select,textarea").forEach(el => { el.disabled = true; });
  psvRefreshResults();
  psvBanner();
}
function psvFindItem(id) {
  for (const sec of PSV_SECTIONS) for (const item of psvSectionItems(sec)) if (psvId(sec, item) === id) return { sec, item };
  return null;
}
function psvRefreshResults() {
  document.querySelectorAll("#psvBody .psvItem").forEach(el => {
    const f = psvFindItem(el.dataset.id); if (!f) return;
    const r = psvCalc(f.sec, f.item, psvSt(f.sec, f.item));
    const res = el.querySelector("[data-res]"), sum = el.querySelector("[data-sum]");
    const erpTxt = r.D === null ? "ERP —" : "ERP " + psvF3(r.D);
    if (r.F === null) {
      res.innerHTML = `<span class="psvMuted">Physical stock not entered</span>`;
      sum.innerHTML = `${erpTxt} · <span class="psvMuted">physical —</span>`;
      return;
    }
    const cls = r.G < -0.0005 ? "psvNeg" : (r.G > 0.0005 ? "psvPos" : "");
    sum.innerHTML = `${erpTxt} · Phy ${psvF3(r.F)} · <span class="${cls}">Gap ${psvF3(r.G)}${r.H === null ? "" : " (" + psvPct(r.H) + ")"}</span>`;
    res.innerHTML = (f.sec.mode === "fg" ? `<span>E = ${psvF3(r.E)} MT</span>` : (f.item.lots ? `<span>Lots = ${psvF3(r.lotsSum)}</span>` : "")) +
      `<span>Physical F = <b>${psvF3(r.F)}</b></span><span class="${cls}">Gap G = <b>${psvF3(r.G)}</b></span><span class="${cls}">Gap % = <b>${r.H === null ? "—" : psvPct(r.H)}</b></span>`;
  });
  PSV_SECTIONS.forEach(sec => {
    const el = document.querySelector(`#psvBody [data-tot="${sec.key}"]`); if (!el) return;
    const t = psvTotals(sec);
    el.innerHTML = `<b>Total</b><span>ERP ${psvF3(t.D)}</span><span>Rec/Iss ${psvF3(t.E)}</span><span>Physical ${psvF3(t.F)}</span><span>Gap ${psvF3(t.G)}</span><span>Gap % ${t.H === null ? "—" : psvPct(t.H)}</span>`;
  });
}
function psvSyncHeader() {
  const g = id => document.getElementById(id);
  psvState.period = g("psvPeriod").value; psvState.division = g("psvDivision").value;
  psvState.date = g("psvDate").value; psvState.erpDate = g("psvErpDate").value;
  psvState.signs = { qad: g("psvSignQad").value, qad2: g("psvSignQad2").value, fin: g("psvSignFin").value,
    prod: g("psvSignProd").value, prod2: g("psvSignProd2").value, ph: g("psvSignPh").value };
}
function psvFillHeader() {
  const g = id => document.getElementById(id);
  if (!psvState.date) psvState.date = localDateToISO(new Date());
  if (!psvState.erpDate) { const d = new Date(psvState.date + "T00:00:00"); d.setDate(d.getDate() - 1); psvState.erpDate = localDateToISO(d); }
  g("psvPeriod").value = psvState.period || "Monthly"; g("psvDivision").value = psvState.division || "SMS";
  g("psvDate").value = psvState.date; g("psvErpDate").value = psvState.erpDate;
  const s = psvState.signs || {};
  g("psvSignQad").value = s.qad || ""; g("psvSignQad2").value = s.qad2 || ""; g("psvSignFin").value = s.fin || "";
  g("psvSignProd").value = s.prod || s.hod || ""; g("psvSignProd2").value = s.prod2 || ""; g("psvSignPh").value = s.ph || "";
}
function psvInit() {
  if (!document.getElementById("psvBody")) return;
  psvBackToDraft();   // the draft on this phone (a month that has since been locked starts a new entry)
  const body = document.getElementById("psvBody");
  body.addEventListener("input", ev => {
    const t = ev.target, wrap = t.closest(".psvItem"); if (!wrap || !t.dataset.f) return;
    const f = psvFindItem(wrap.dataset.id); if (!f) return;
    const st = psvSt(f.sec, f.item);
    if (t.dataset.f === "lot") st.lots[+t.dataset.li] = t.value;
    else st[t.dataset.f] = t.value;
    if (t.dataset.f === "erp") st.src = "manual";
    psvDirty(); psvRefreshResults();
    if (t.dataset.f === "erp") { const b = wrap.querySelector(".psvBadge"); if (b && f.item.erp !== null) b.remove(); }
  });
  body.addEventListener("click", ev => {
    const b = ev.target.closest("button[data-act]"); if (!b) return;
    const wrap = b.closest(".psvItem"), f = psvFindItem(wrap.dataset.id); if (!f) return;
    const st = psvSt(f.sec, f.item);
    if (b.dataset.act === "addlot") st.lots.push("");
    if (b.dataset.act === "dellot" && st.lots.length > 1) st.lots.pop();
    psvDirty(); psvRender();
  });
  ["psvPeriod", "psvDivision", "psvDate", "psvErpDate", "psvSignQad", "psvSignQad2", "psvSignFin", "psvSignProd", "psvSignProd2", "psvSignPh"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => { if (psvReadOnly) return; psvSyncHeader(); psvDirty(); });
    document.getElementById(id).addEventListener("input", () => { if (psvReadOnly) return; psvSyncHeader(); psvDirty(); });
  });
  document.getElementById("psvFetchBtn").addEventListener("click", psvFetchErp);
  document.getElementById("psvClearBtn").addEventListener("click", () => {
    if (!confirm("Clear all entered physical stock, ERP and remarks? (Names in the signature block are kept.)")) return;
    const keepSigns = psvState.signs;
    psvState = { period: psvState.period, division: psvState.division, date: psvState.date, erpDate: psvState.erpDate, signs: keepSigns, items: {}, extraFg: [], recMonth: psvState.recMonth || null };
    psvDirty(); psvRender();
  });
  document.getElementById("psvSaveBtn").addEventListener("click", () => { psvSyncHeader(); psvSave(); psvSaveCloud(); });
  document.getElementById("psvImportBtn").addEventListener("click", () => { const f = document.getElementById("psvImportFile"); f.value = ""; f.click(); });
  document.getElementById("psvImportFile").addEventListener("change", ev => { const f = ev.target.files && ev.target.files[0]; if (f) psvImportXlsx(f); });
  document.getElementById("psvNewBtn").addEventListener("click", psvBackToDraft);
  document.getElementById("psvHistReload").addEventListener("click", psvLoadHistory);
  document.getElementById("psvBulkBtn").addEventListener("click", () => { const f = document.getElementById("psvBulkFile"); f.value = ""; f.click(); });
  document.getElementById("psvBulkFile").addEventListener("change", ev => { const fs = Array.from(ev.target.files || []); if (fs.length) psvBulkImport(fs); });
  document.querySelector('[data-substock="psv"]').addEventListener("click", () => { if (!psvHistLoaded) psvLoadHistory(); });
  document.getElementById("psvPdfBtn").addEventListener("click", () => { if (!psvReadOnly) { psvSyncHeader(); psvSave(); } psvPdf(); });
  document.getElementById("psvXlsxBtn").addEventListener("click", () => { if (!psvReadOnly) { psvSyncHeader(); psvSave(); } psvXlsx(); });
}

async function psvFetchErp() {
  const statusEl = document.getElementById("status");
  psvSyncHeader();
  const asOn = psvState.erpDate;
  if (!asOn) { statusEl.className = "err"; statusEl.textContent = "Please select the \"ERP Stock as on\" date."; return; }
  const btn = document.getElementById("psvFetchBtn");
  btn.disabled = true;
  statusEl.className = "wait"; statusEl.textContent = "Reading ERP stock...";
  try {
    const token = await getToken();
    const monthStart = asOn.slice(0, 7) + "-01";
    const { results: wbList, missing } = await getWorkbooksForRange(token, monthStart, asOn);
    if (!wbList.length) { statusEl.className = "err"; statusEl.textContent = `Couldn't find the file for ${missing.join(", ") || asOn}.`; return; }
    const names = [];
    PSV_SECTIONS.forEach(sec => sec.items.forEach(it => { if (it.erp && !names.includes(it.erp)) names.push(it.erp); }));
    PSV_RM_ROWS.forEach(x => { if (x[1] && !names.includes(x[1])) names.push(x[1]); });
    const [rows, sizes] = await Promise.all([
      computeStockRowsForItems(wbList, names, statusEl, token),
      getBilletStockBySize(wbList[wbList.length - 1].wb, monthStart, asOn, token)
    ]);
    const closing = {}; rows.forEach(r => { closing[r.name] = r.closing; });
    // month figures for the 2nd sheet ("SMS - RM"): same numbers as the Raw Material Stock report
    const rmRows = {}; rows.forEach(r => { rmRows[r.name] = { o: r.opening, i: r.incoming, c: r.consumption, t: r.transfer || 0 }; });
    const billet = { o: 0, p: 0, c: 0, cl: 0 };
    Object.keys(sizes).forEach(n => {
      const s = sizes[n];
      if (s.latestQty === null || s.latestQty === undefined || ["110X6", "110X5.25"].includes(n.toUpperCase().replace(/\s+/g, ""))) return;
      const o = s.openingQty !== null && s.openingQty !== undefined ? s.openingQty : (s.latestQty - s.production + s.consumption);
      billet.o += o; billet.p += s.production; billet.c += o + s.production - s.latestQty; billet.cl += s.latestQty;
    });
    psvState.rmMonth = { month: asOn.slice(0, 7), asOn, rows: rmRows, billet };
    psvState.dirty = true;
    let filled = 0;
    PSV_SECTIONS.forEach(sec => sec.items.forEach(it => {
      if (!it.erp || closing[it.erp] === undefined) return;
      const st = psvSt(sec, it); st.erp = (Math.round(closing[it.erp] * 1000) / 1000).toFixed(3); st.src = "auto"; filled++;
    }));
    // billets: Daily Stock "ERP stock weight" of each size
    const bySize = {};
    Object.keys(sizes).forEach(n => { const s = sizes[n]; if (s.latestQty !== null && s.latestQty !== undefined) bySize[psvSizeKey(n)] = { name: n, qty: s.latestQty }; });
    const fgSec = PSV_SECTIONS.find(s => s.key === "fg");
    const known = new Set(psvFgItems().map(f => f.fgKey));
    const skipped = [];
    Object.keys(bySize).forEach(k => {
      if (!k || known.has(k) || Math.abs(bySize[k].qty) < 0.0005) return;
      const [secTxt, lenTxt] = k.split("|"), sec = Number(secTxt);
      if (!PSV_DENS[sec]) { skipped.push(bySize[k].name); return; }
      const isR = lenTxt === "R";
      psvState.extraFg.push({ name: isR ? `${sec} X ${sec} RANDOM` : `${sec} X ${sec} X ${lenTxt}`, sec, len: isR ? 0 : Number(lenTxt), uom: isR ? "MTR" : "MT" });
      known.add(k);
    });
    let fgFilled = 0;
    psvFgItems().forEach(it => {
      const st = psvSt(fgSec, it), hit = bySize[it.fgKey];
      st.erp = hit ? (Math.round(hit.qty * 1000) / 1000).toFixed(3) : "0.000"; st.src = "auto";
      if (hit) fgFilled++;
    });
    psvSave(); psvRender();
    statusEl.className = "ok";
    statusEl.textContent = `ERP stock as on ${asOn} filled for ${filled} item(s) and ${fgFilled} billet size(s).` +
      (skipped.length ? ` Not added (density not known): ${skipped.join(", ")}.` : "") +
      (missing.length ? ` (No file for: ${missing.join(", ")})` : "");
  } catch (e) {
    statusEl.className = "err"; statusEl.textContent = "Error: " + e.message;
  } finally { btn.disabled = false; }
}

// Fills psvState from a Physical_Stock_Verification workbook (already read by XLSX). Keeps date / ERP date.
function psvFillFromWorkbook(wb) {
  const ws = wb.Sheets["SMS"];
  if (!ws) throw new Error('sheet "SMS" not found in this file');
  const V = a => (ws[a] ? ws[a].v : null);
  const N = a => { const v = V(a); return typeof v === "number" ? v : psvNum(v); };
  const T = a => { const v = V(a); return v === null || v === undefined ? "" : (v instanceof Date ? psvDateText(localDateToISO(v)) : String(v).trim()); };
  const fmt = v => (v === null || v === undefined || !isFinite(v)) ? "" : String(Math.round(v * 1000) / 1000);
  const norm = x => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  psvState.items = {}; psvState.extraFg = []; psvState.extraItems = {};
  let count = 0;
  const lotSeen = {};   // item name -> { n: lots read, F, E of its first row }
  const base = x => norm(String(x || "").replace(/\([^)]*\)/g, ""));
  const notFound = [];
  PSV_SECTIONS.forEach((sec, bi) => {
    const col = i => psvColName(bi * 11 + 1 + i);
    for (let r = 10; r < 80; r++) {
      const name = T(col(0) + r);
      if (!name) continue;
      if (/^total$/i.test(name)) break;
      const D = N(col(3) + r), E = N(col(4) + r), F = N(col(5) + r), C = col(2) + r;
      // rows of a lot item ("STEEL MELTING SCRAP 1 (Incoming)", "SI LUMPS LOT 2", or just "SI LUMPS") - one lot each, in order
      const lotItem = sec.items.find(it => it.lots && it.lotRe && it.lotRe.test(name));
      let lotM = null;
      if (lotItem) { const ls = lotSeen[lotItem.name] = lotSeen[lotItem.name] || { n: 0, F: null, E: 0 }; lotM = [name, String(++ls.n)]; }
      let item = null;
      if (lotM) item = lotItem;
      else item = psvSectionItems(sec).find(it => base(it.name) === base(name) || base(psvLabel(it)) === base(name));
      if (!item && sec.key === "fg") {
        const k = psvSizeKey(name);
        item = psvFgItems().find(it => it.fgKey === k);
        if (!item && k) {
          const [a, b] = k.split("|"), sc = Number(a);
          if (PSV_DENS[sc]) { psvState.extraFg.push({ name, sec: sc, len: b === "R" ? 0 : Number(b), uom: b === "R" ? "MTR" : "MT" }); item = psvFgItems().find(it => it.fgKey === k); }
        }
      }
      if (!item && !lotM && sec.key !== "fg" && /[A-Z]/i.test(name)) {   // a row the usual list does not have: keep it for this month
        psvState.extraItems[sec.key] = (psvState.extraItems[sec.key] || []).concat([name]);
        item = psvSectionItems(sec).find(it => it.name === name);
      }
      if (!item) { notFound.push(name); continue; }
      const st = psvSt(sec, item);
      if (lotM) {
        const li = +lotM[1] - 1;
        while (st.lots.length <= li) st.lots.push("");
        st.lots[li] = fmt(N(C));
        if (li > 0) continue;            // ERP / E / remarks are on the first lot row
        lotSeen[item.name].F = F; lotSeen[item.name].E = E || 0;
      }
      if (D !== null) { st.erp = fmt(D); st.src = "excel"; }
      st.adj = T(col(8) + r); st.rem = T(col(9) + r);
      if (sec.mode === "fg") {
        const dens = PSV_DENS[item.sec] || 0, factor = item.len ? item.len * dens : dens;
        st.phys = fmt(N(C));
        st.e = E && factor ? fmt(E / factor) : "";   // the sheet keeps E in MT; the app takes pieces (metres)
      } else if (sec.mode === "rm") {
        st.e = E ? fmt(E) : "";
        if (!item.lots) st.phys = F !== null ? fmt(F - (E || 0)) : "";
        if (sec.measLabel && !item.lots) st.meas = T(C);
      } else {
        st.e = E ? fmt(E) : "";
        st.phys = F !== null ? fmt(F) : "";
        st.meas = T(C);
      }
      count++;
    }
  });
  // a lot item without lot weights (older files): physical = F - E of its row, kept as lot 1
  PSV_SECTIONS.forEach(sec => sec.items.filter(it => it.lots).forEach(it => {
    const seen = lotSeen[it.name]; if (!seen) return;
    const st = psvSt(sec, it);
    const lotNums = st.lots.map(psvNum).filter(v => v !== null);
    if (!lotNums.length && seen.F !== null) st.lots = [fmt(seen.F - seen.E)].concat(new Array(Math.max(0, st.lots.length - 1)).fill(""));
    while (st.lots.length > (it.lots || 1) && !String(st.lots[st.lots.length - 1]).trim()) st.lots.pop();
  }));
  // names under the signature block (row "Name" of the first block)
  for (let r = 10; r < 90; r++) if (/^name$/i.test(T("A" + r))) {
    const was = psvSigners(psvState.signs);
    const head = ["B", "C", "D", "E", "F", "G", "H", "I", "J"].map(c => T(c + (r - 1))).join(" ");
    const head2 = ["B", "E", "H"].map(c => T(c + (r + 2))).join(" ");
    const got = /finance/i.test(head) && /prod/i.test(head2) && /^name$/i.test(T("A" + (r + 3)))
      ? { qad: T("B" + r), qad2: T("E" + r), fin: T("H" + r), prod: T("B" + (r + 3)), prod2: T("E" + (r + 3)), ph: T("H" + (r + 3)) }   // this app: two bands of three
      : /prod/i.test(head)
      ? { qad: T("B" + r), qad2: T("D" + r), fin: T("E" + r), prod: T("F" + r), prod2: T("H" + r), ph: T("I" + r) }     // one band (v2026.11.02.6)
      : { qad: T("B" + r), qad2: "", fin: T("E" + r), prod: T("G" + r), prod2: "", ph: T("I" + r) };                   // older sheet (Deptt. -HOD)
    psvState.signs = {};
    Object.keys(was).forEach(k => { psvState.signs[k] = got[k] || was[k]; });
    break;
  }
  // 2nd sheet: opening / received / issue / M to M & sale and the billet line
  let rmNote = "";
  const wr = wb.Sheets["SMS - RM"];
  if (wr) {
    const RV = a => (wr[a] ? wr[a].v : null), RN = a => { const v = RV(a); return typeof v === "number" ? v : (psvNum(v) || 0); };
    const rows = {};
    for (let r = 4; r <= 18; r++) {
      const hit = PSV_RM_ROWS.find(x => x[1] && norm(x[0]) === norm(RV("B" + r)));
      if (hit) rows[hit[1]] = { o: RN("C" + r), i: RN("D" + r), c: RN("F" + r), t: -RN("G" + r) };
    }
    const o = RN("D26"), pr = RN("E26"), c = -RN("F26"), sale = RN("G26");
    psvState.rmMonth = { month: (psvState.erpDate || "").slice(0, 7), asOn: psvState.erpDate, rows, billet: { o, p: pr, c, s: sale, cl: o + pr - c + sale }, src: "excel" };
    rmNote = ` "SMS - RM" figures taken too (its title in the file: ${String(RV("A1") || "").trim() || "-"}).`;
  }
  return { count, notFound, rmNote };
}

// Many past months at once: month from the file name (e.g. "..._October26.xlsx"), verification on the 1st,
// ERP stock as on the last day of the month before. Months already saved are left as they are.
const PSV_MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function psvMonthFromName(name) {
  const m = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s_.'’-]*(\d{4}|\d{2})(?!\d)/i.exec(String(name || ""));
  if (!m) return null;
  let y = +m[2]; if (y < 100) y += 2000;
  return `${y}-${String(PSV_MON[m[1].toLowerCase()]).padStart(2, "0")}`;
}
async function psvBulkImport(files) {
  const statusEl = document.getElementById("status");
  const list = [], bad = [];
  for (const f of files) { const m = psvMonthFromName(f.name); if (m) list.push({ f, m }); else bad.push(f.name); }
  if (!list.length) { statusEl.className = "err"; statusEl.textContent = "Month could not be read from the file name(s): " + bad.join(", ") + ' (name should have the month and year, e.g. "Physical_Stock_Verification_October26.xlsx").'; return; }
  list.sort((x, y) => x.m < y.m ? -1 : 1);
  const done = [], skipped = [], failed = [], replaced = [];
  let token;
  try { token = await getToken(); if (!token) throw new Error("not signed in"); }
  catch (e) { statusEl.className = "err"; statusEl.textContent = "Error: " + e.message; return; }
  // what is already saved? Months added from Excel files earlier may be replaced; months verified in the app stay as they are.
  statusEl.className = "wait"; statusEl.textContent = "Checking saved months...";
  const existing = await Promise.all(list.map(x => psvGetRecord(token, x.m).catch(() => ({ unreadable: true }))));
  const fresh = [], again = [], keepApp = [];
  list.forEach((x, i) => { const ex = existing[i]; if (!ex) fresh.push(x); else if (ex.importedFrom) again.push(x); else keepApp.push(x); });
  if (!fresh.length && !again.length) {
    statusEl.className = "err";
    statusEl.textContent = `Nothing to save - these months were verified in the app and are not changed: ${keepApp.map(x => psvMonthLabel(x.m)).join(", ")}.`;
    return;
  }
  if (!confirm(`Save to OneDrive (verification date = 1st of the month, locked straight away):\n\n` +
    (fresh.length ? `NEW:\n${fresh.map(x => `${psvMonthLabel(x.m)}  ←  ${x.f.name}`).join("\n")}\n\n` : "") +
    (again.length ? `REPLACE (added from Excel earlier):\n${again.map(x => `${psvMonthLabel(x.m)}  ←  ${x.f.name}`).join("\n")}\n\n` : "") +
    (keepApp.length ? `NOT CHANGED (verified in the app): ${keepApp.map(x => psvMonthLabel(x.m)).join(", ")}\n\n` : "") +
    (bad.length ? `Skipped (no month in name): ${bad.join(", ")}` : ""))) return;
  keepApp.forEach(x => skipped.push(psvMonthLabel(x.m)));
  const todo = fresh.concat(again).sort((x, y) => x.m < y.m ? -1 : 1);
  try {
    const keep = psvState;
    for (let k = 0; k < todo.length; k++) {
      const { f, m } = todo[k];
      const isAgain = again.includes(todo[k]);
      statusEl.className = "wait"; statusEl.textContent = `Saving ${psvMonthLabel(m)} (${k + 1}/${todo.length})...`;
      try {
        const old = isAgain ? existing[list.indexOf(todo[k])] : null;
        const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
        const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1), prev = new Date(d); prev.setDate(0);
        psvState = { period: "Monthly", division: keep.division || "SMS", date: localDateToISO(d), erpDate: localDateToISO(prev), signs: {}, items: {}, extraFg: [] };
        let rec;
        try { psvFillFromWorkbook(wb); } finally { rec = psvState; psvState = keep; }
        const now = new Date().toISOString();
        const out = Object.assign({}, rec, { v: 1, month: m, savedAt: now, firstSavedAt: (old && old.firstSavedAt) || now, importedFrom: f.name });
        delete out.recMonth; delete out.dirty;
        const r = await fetch(psvRecUrl(m), { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(out) });
        if (!r.ok) throw new Error("OneDrive save failed (" + r.status + ")");
        (isAgain ? replaced : done).push(psvMonthLabel(m));
      } catch (e) { psvState = keep; failed.push(`${f.name}: ${e.message}`); }
    }
  } catch (e) { failed.push(e.message); }
  statusEl.className = failed.length ? "err" : "ok";
  statusEl.textContent = `Saved: ${done.join(", ") || "none"}.` + (replaced.length ? ` Replaced: ${replaced.join(", ")}.` : "") +
    (skipped.length ? ` Verified in the app (not changed): ${skipped.join(", ")}.` : "") +
    (bad.length ? ` No month in name: ${bad.join(", ")}.` : "") + (failed.length ? ` Failed: ${failed.join("; ")}.` : "");
  psvLoadHistory();
}

// Fills the entry from a Physical_Stock_Verification Excel file (sheet "SMS", plus "SMS - RM" if it is there).
// Reads the values Excel saved in the file. The Date of Verification on screen is kept.
async function psvImportXlsx(file) {
  const statusEl = document.getElementById("status");
  try {
    if (psvReadOnly) return;
    const hasData = Object.values(psvState.items || {}).some(st => st && (st.phys || st.e || (st.lots || []).some(Boolean)));
    if (hasData && !confirm("Replace the entries on screen with the ones from this Excel file?")) return;
    statusEl.className = "wait"; statusEl.textContent = "Reading the Excel file...";
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const { count, notFound, rmNote } = psvFillFromWorkbook(wb);
    psvState.dirty = true; psvSave(); psvFillHeader(); psvRender();
    statusEl.className = "ok";
    statusEl.textContent = `Imported ${count} item(s) from ${file.name}.` + rmNote +
      (notFound.length ? ` Not matched: ${notFound.join(", ")}.` : "") +
      " ERP stock is as in the file - pressing ⬇️ Fetch ERP Stock would replace it. Check, edit, then press 💾 Save verification.";
  } catch (e) {
    statusEl.className = "err"; statusEl.textContent = "Import error: " + e.message;
  }
}

// ---- saved verifications (OneDrive app folder: PhysicalStockVerification/PSV_YYYY-MM.json) ----
// A month can be changed until 3 days after its date of verification (e.g. 01-11 -> till 04-11), then it is locked.
const PSV_DIR = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/PhysicalStockVerification";
const psvRecUrl = month => `${PSV_DIR}/PSV_${month}.json:/content`;
let psvHistLoaded = false;
function psvEditUntil(dateIso) { const d = new Date(dateIso + "T00:00:00"); d.setDate(d.getDate() + 3); return localDateToISO(d); }
function psvIsLocked(dateIso) { return !!dateIso && localDateToISO(new Date()) > psvEditUntil(dateIso); }
function psvMonthLabel(month) { const [y, m] = month.split("-"); return new Date(+y, +m - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" }); }
function psvBanner() {
  const el = document.getElementById("psvBanner"); if (!el) return;
  const panel = document.getElementById("substock-psv");
  if (panel) panel.classList.toggle("psvRO", psvReadOnly);
  ["psvPeriod", "psvDivision", "psvDate", "psvErpDate", "psvSignQad", "psvSignQad2", "psvSignFin", "psvSignProd", "psvSignProd2", "psvSignPh"].forEach(id => {
    const x = document.getElementById(id); if (x) x.disabled = psvReadOnly || (id === "psvDate" && !!psvState.recMonth);
  });
  if (psvReadOnly) {
    el.className = "psvBanner lock";
    el.textContent = `🔒 ${psvMonthLabel(psvState.recMonth)} - verification of ${psvDateText(psvState.date)} is locked (could be changed till ${psvDateText(psvEditUntil(psvState.date))}). PDF / Excel can still be downloaded.`;
  } else if (psvState.recMonth) {
    el.className = "psvBanner " + (psvState.dirty ? "dirty" : "edit");
    el.textContent = `✏️ ${psvMonthLabel(psvState.recMonth)} - saved verification, can be changed till ${psvDateText(psvEditUntil(psvState.date))}.` +
      (psvState.dirty ? " Changes not saved yet - press 💾 Save verification." : "");
  } else {
    el.className = "psvBanner" + (psvState.dirty ? " dirty" : "");
    el.textContent = "🆕 New verification (not saved to OneDrive yet). Press 💾 Save verification when done.";
  }
}
async function psvGetRecord(token, month) {
  const r = await fetch(psvRecUrl(month), { headers: { Authorization: "Bearer " + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("OneDrive read failed (" + r.status + ")");
  return await r.json();
}
async function psvSaveCloud() {
  const statusEl = document.getElementById("status");
  if (psvReadOnly) return;
  if (!psvState.date) { statusEl.className = "err"; statusEl.textContent = "Please select the Date of Verification."; return; }
  const month = psvState.recMonth || psvState.date.slice(0, 7);
  const btn = document.getElementById("psvSaveBtn"); btn.disabled = true;
  statusEl.className = "wait"; statusEl.textContent = "Saving to OneDrive...";
  try {
    const token = await getToken(); if (!token) throw new Error("not signed in");
    const old = await psvGetRecord(token, month);
    if (old && psvIsLocked(old.date)) {
      statusEl.className = "err";
      statusEl.textContent = `${psvMonthLabel(month)} is already saved and locked (could be changed till ${psvDateText(psvEditUntil(old.date))}). Not changed.`;
      return;
    }
    if (!old && psvIsLocked(psvState.date) &&
      !confirm(`The date of verification (${psvDateText(psvState.date)}) is more than 3 days ago, so ${psvMonthLabel(month)} will be locked as soon as it is saved. Save it?`)) {
      statusEl.className = ""; statusEl.textContent = ""; return;
    }
    if (old && !psvState.recMonth &&
      !confirm(`${psvMonthLabel(month)} is already saved (verification of ${psvDateText(old.date)}). Replace it with what is on this screen?`)) {
      statusEl.className = ""; statusEl.textContent = ""; return;
    }
    const now = new Date().toISOString();
    const rec = Object.assign({}, psvState, { v: 1, month, recMonth: undefined, dirty: undefined, savedAt: now, firstSavedAt: (old && old.firstSavedAt) || now });
    delete rec.recMonth; delete rec.dirty;
    const r = await fetch(psvRecUrl(month), { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(rec) });
    if (!r.ok) throw new Error("OneDrive save failed (" + r.status + ")");
    psvState.recMonth = month; psvState.dirty = false; psvSave();
    if (psvIsLocked(psvState.date)) { psvReadOnly = true; psvRender(); } else psvBanner();   // locked straight away -> view mode, "Back to new entry" starts the next one
    statusEl.className = "ok";
    statusEl.textContent = `Saved: ${psvMonthLabel(month)} verification. ` + (psvIsLocked(psvState.date) ? "It is now locked." : `It can be changed till ${psvDateText(psvEditUntil(psvState.date))}.`);
    psvLoadHistory();
  } catch (e) {
    statusEl.className = "err"; statusEl.textContent = "Save error: " + e.message;
  } finally { btn.disabled = false; }
}
function psvApplyRecord(rec, month) {
  const st = Object.assign({ period: "Monthly", division: "SMS", date: "", erpDate: "", signs: {}, items: {}, extraFg: [] }, rec);
  delete st.v; delete st.month; delete st.savedAt; delete st.firstSavedAt;
  st.recMonth = month; st.dirty = false;
  return psvMigrate(st);
}
async function psvOpenRecord(month, then) {
  const statusEl = document.getElementById("status");
  statusEl.className = "wait"; statusEl.textContent = `Opening ${psvMonthLabel(month)}...`;
  try {
    const token = await getToken(); if (!token) throw new Error("not signed in");
    const rec = await psvGetRecord(token, month);
    if (!rec) throw new Error("not found in OneDrive");
    const locked = psvIsLocked(rec.date);
    let draft = null; try { draft = JSON.parse(localStorage.getItem(PSV_KEY) || "null"); } catch (e) { draft = null; }
    if (!locked && draft && draft.dirty && draft.recMonth !== month &&
      !confirm("Your current entry has changes that are not saved to OneDrive. Opening this month will replace it on this phone. Continue?")) {
      statusEl.className = ""; statusEl.textContent = ""; return;
    }
    if (locked) {
      psvReadOnly = true;                 // the draft in this phone's storage is left as it is
      psvState = psvApplyRecord(rec, month);
    } else {
      psvReadOnly = false;
      psvState = psvApplyRecord(rec, month);
      psvSave();
    }
    psvFillHeader(); psvRender();
    statusEl.className = "ok";
    statusEl.textContent = `${psvMonthLabel(month)} opened` + (locked ? " (locked - view and download only)." : ` (can be changed till ${psvDateText(psvEditUntil(rec.date))}).`);
    if (then === "pdf") psvPdf();
    else if (then === "xlsx") psvXlsx();
    else document.getElementById("psvBanner").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (e) {
    statusEl.className = "err"; statusEl.textContent = "Open error: " + e.message;
  }
}
function psvBackToDraft() {
  psvReadOnly = false; psvLoad();
  if (psvState.recMonth && psvIsLocked(psvState.date)) psvState = { period: psvState.period, division: psvState.division, signs: psvState.signs, items: {}, extraFg: [], date: "", erpDate: "" };
  psvFillHeader(); psvRender();
}
async function psvLoadHistory() {
  const box = document.getElementById("psvHistory"); if (!box) return;
  psvHistLoaded = true;
  box.innerHTML = `<div class="skeletonBar" style="width:80%;"></div><div class="skeletonBar" style="width:60%;"></div>`;
  try {
    const token = await getToken(); if (!token) throw new Error("not signed in");
    const h = { Authorization: "Bearer " + token };
    const r = await fetch(`${PSV_DIR}:/children?$select=name&$top=500`, { headers: h });
    if (r.status === 404) { box.innerHTML = `<p class="psvMuted">Nothing saved yet.</p>`; return; }
    if (!r.ok) throw new Error("OneDrive list failed (" + r.status + ")");
    const months = ((await r.json()).value || []).map(f => (/^PSV_(\d{4}-\d{2})\.json$/.exec(f.name) || [])[1]).filter(Boolean).sort().reverse().slice(0, 36);
    if (!months.length) { box.innerHTML = `<p class="psvMuted">Nothing saved yet.</p>`; return; }
    const recs = await Promise.all(months.map(m => psvGetRecord(token, m).catch(() => null)));
    box.innerHTML = months.map((m, i) => {
      const rec = recs[i], d = rec && rec.date;
      const st = !rec ? "⚠️ could not be read" : (psvIsLocked(d) ? `🔒 locked` : `✏️ can be changed till ${psvDateText(psvEditUntil(d))}`);
      return `<div class="psvHistRow"><div class="psvHistTxt"><b>${_escH(psvMonthLabel(m))}</b><br><span class="psvMuted" style="font-style:normal">` +
        `Verified ${_escH(psvDateText(d || ""))} · ${st}${rec && rec.importedFrom ? " · from Excel" : ""}</span></div>` +
        `<button type="button" class="secondary" data-psvopen="${m}">${rec && !psvIsLocked(d) ? "✏️ Open" : "👁️ View"}</button>` +
        `<button type="button" class="secondary" data-psvpdf="${m}">📄 PDF</button><button type="button" class="secondary" data-psvxlsx="${m}">📊 Excel</button></div>`;
    }).join("");
    box.querySelectorAll("[data-psvopen]").forEach(b => b.addEventListener("click", () => psvOpenRecord(b.dataset.psvopen)));
    box.querySelectorAll("[data-psvpdf]").forEach(b => b.addEventListener("click", () => psvOpenRecord(b.dataset.psvpdf, "pdf")));
    box.querySelectorAll("[data-psvxlsx]").forEach(b => b.addEventListener("click", () => psvOpenRecord(b.dataset.psvxlsx, "xlsx")));
  } catch (e) {
    box.innerHTML = `<p class="psvNeg">Could not load the list: ${_escH(e.message)}</p>`;
  }
}

// Rows of one block, in the same order the sheet prints them.
function psvBlockRows(sec) {
  const out = [];
  psvSectionItems(sec).forEach(item => {
    const st = psvSt(sec, item), r = psvCalc(sec, item, st);
    if (item.lots) {
      st.lots.forEach((lv, li) => out.push({ sec, item, st, r, first: li === 0, span: st.lots.length, lotIdx: li,
        a: psvLotLabel(item, li + 1), lot: psvNum(lv) }));
    } else out.push({ sec, item, st, r, first: true, span: 1, a: psvLabel(item) });
  });
  return out;
}
function psvDateText(iso) { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; }
function psvFileName(ext) {
  const iso = psvState.date || localDateToISO(new Date());
  const d = new Date(iso + "T00:00:00");
  return `Physical_Stock_Verification_${d.toLocaleString("en-US", { month: "long" })}${String(d.getFullYear()).slice(2)}.${ext}`;
}

function psvPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(), M = 28;
  PSV_SECTIONS.forEach((sec, si) => {
    if (si) doc.addPage();
    // header: logo | company name, then the title
    doc.setDrawColor(60); doc.setLineWidth(0.6);
    doc.rect(M, 20, pw - 2 * M, 38);
    coDrawLogo(doc, M + 6, 24, 150, 30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(20, 20, 20);
    if (COMPANY.name) coFitText(doc, COMPANY.name, pw / 2 + 40, 44, pw - 2 * M - 200, "center");
    doc.setFontSize(12);
    doc.rect(M, 58, pw - 2 * M, 18);
    doc.text("Physical verification of stock", pw / 2, 71, { align: "center" });
    doc.autoTable({
      startY: 76, keepZeros: true, theme: "grid", margin: { left: M, right: M },
      body: [["Period", psvState.period || ""], ["Date of Verification", psvDateText(psvState.date)],
        ["Nature Of Product", sec.nature], ["Division", psvState.division || ""]],
      styles: { fontSize: 8.5, cellPadding: 3, lineColor: [60, 60, 60], lineWidth: 0.5, textColor: 20 },
      columnStyles: { 0: { cellWidth: 140, fontStyle: "bold" } }
    });
    const head = [sec.head.concat(PSV_HEAD_REST), PSV_LETTERS];
    const body = [];
    psvBlockRows(sec).forEach(row => {
      const r = row.r, isFg = sec.mode === "fg";
      let c = "";
      if (row.item.lots) c = psvF3(row.lot);
      else if (isFg) c = r.C === null ? "" : String(r.C);
      else c = row.st.meas || "";
      const cells = [row.a, row.item.uom || "MT", c];
      if (row.first) {
        const sp = row.span > 1 ? { rowSpan: row.span } : {};
        const v = (t, extra) => Object.assign({ content: t }, sp, extra || {});
        const gCol = r.G === null ? {} : { textColor: r.G < -0.0005 ? [163, 39, 28] : (r.G > 0.0005 ? [30, 107, 60] : [20, 20, 20]) };
        cells.push(v(psvF3(r.D)), v(r.E ? psvF3(r.E) : ""), v(psvF3(r.F)), v(psvF3(r.G), { styles: gCol }), v(r.H === null ? "" : psvPct(r.H), { styles: gCol }),
          v(row.st.adj || ""), v(row.st.rem || ""));
      }
      body.push(cells);
    });
    const t = psvTotals(sec);
    const B = x => ({ content: x, styles: { fontStyle: "bold", fillColor: [242, 242, 242] } });
    body.push([B("Total"), B(""), B(""), B(psvF3(t.D)), B(t.E ? psvF3(t.E) : ""), B(psvF3(t.F)), B(psvF3(t.G)), B(t.H === null ? "" : psvPct(t.H)), B(""), B("")]);
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 6, keepZeros: true, theme: "grid", margin: { left: M, right: M },
      head, body,
      styles: { fontSize: 8, cellPadding: 3, halign: "center", valign: "middle", lineColor: [60, 60, 60], lineWidth: 0.5, textColor: 20, overflow: "linebreak" },
      headStyles: { fillColor: [221, 235, 247], textColor: 20, fontStyle: "bold", fontSize: 7.5 },
      columnStyles: { 0: { halign: "left", cellWidth: 120 }, 1: { cellWidth: 34 }, 2: { cellWidth: 90 }, 3: { cellWidth: 62 }, 4: { cellWidth: 78 },
        5: { cellWidth: 62 }, 6: { cellWidth: 58 }, 7: { cellWidth: 52 }, 8: { cellWidth: 70 } },
      didParseCell: d => { if (d.section === "head" && d.row.index === 1) { d.cell.styles.fillColor = [242, 242, 242]; d.cell.styles.fontStyle = "normal"; } }
    });
    // signature block
    const s = psvSigners(psvState.signs);
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 14, keepZeros: true, theme: "grid", margin: { left: M, right: M },
      head: [["", { content: "QAD-Team", colSpan: 2 }, "Finance Team", { content: "Prod Team", colSpan: 2 }, "Plant Head"]],
      body: [["Name", s.qad, s.qad2, s.fin, s.prod, s.prod2, s.ph], ["Sign.", "", "", "", "", "", ""]],
      styles: { fontSize: 8.5, cellPadding: 4, halign: "center", valign: "middle", lineColor: [60, 60, 60], lineWidth: 0.5, textColor: 20, minCellHeight: 16 },
      headStyles: { fillColor: [242, 242, 242], textColor: 20, fontStyle: "bold" },
      columnStyles: Object.assign({ 0: { cellWidth: 70, fontStyle: "bold" } },
        ...[1, 2, 3, 4, 5, 6].map(i => ({ [i]: { cellWidth: (pw - 2 * M - 70) / 6 } }))),   // every signatory gets the same width
      didParseCell: d => { if (d.section === "body" && d.row.index === 1) d.cell.styles.minCellHeight = 46; }
    });
  });
  showPdfPreview(doc, psvFileName("pdf"), "Physical Stock Verification");
}

// Sheet 2 "SMS - RM": opening / received / issue / M to M & sale for the month of the "ERP Stock as on" date,
// pre-filled from the same numbers as the Raw Material Stock report; formulas as in the sheet.
function psvRmSheet(wb) {
  const rm = psvState.rmMonth || null;
  const iso = (rm && rm.asOn) || psvState.erpDate || psvState.date || localDateToISO(new Date());
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7);
  const monthDate = new Date(Date.UTC(y, m - 1, 1));
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][m - 1];
  const ws = wb.addWorksheet("SMS - RM", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const W = { A: 30.43, B: 23, C: 9.86, D: 10.71, E: 10.71, F: 11.14, G: 20.29, H: 10.43, I: 11, J: 11.57, K: 10.71, L: 10.71, M: 10.71, N: 10.71, Q: 14.29, R: 10.71, T: 10.57, U: 10.71, V: 15.71, W: 12.14 };
  Object.keys(W).forEach(k => { ws.getColumn(k).width = W[k]; });
  const thin = { style: "thin", color: { argb: "FF000000" } }, BOX = { top: thin, left: thin, bottom: thin, right: thin };
  const N3 = "0.000", N2 = "0.00", P2 = "0.00%";
  const put = (a, v, fmt, extra) => { const c = ws.getCell(a); c.value = v; if (fmt) c.numFmt = fmt; if (extra) Object.assign(c, extra); return c; };
  const f = (formula, result) => (result === undefined ? { formula } : { formula, result });
  ws.mergeCells("A1:M1"); ws.mergeCells("A2:M2");
  put("A1", `SMS Monthly Report - ${MON}'${String(y).slice(2)}`).font = { bold: true, size: 14 };
  put("A2", "SMS Stock and Consumption reports. As per actual Physical stock").font = { bold: true };
  ws.getCell("A1").alignment = ws.getCell("A2").alignment = { horizontal: "center" };
  ["Sl no", "Particular", "Opening", "Received", "Total", "Issue", "M to M \n& Sale", "Closing to be filled from Physical stock report",
    "% Target Consp.", "% Actual cons.", "Metal conv.", "Assumed yield %"].forEach((t, i) => {
    const c = ws.getCell(3, i + 1); c.value = t; c.font = { bold: true }; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
  });
  ws.getRow(3).height = 60;
  // numbers first, so results can go with the formulas
  const vals = PSV_RM_ROWS.map(([, item, yld]) => {
    const r = rm && item ? rm.rows[item] : null;
    const o = r ? r.o : 0, i = r ? r.i : 0, c = r ? r.c : 0, g = r && r.t ? -r.t : 0;
    return { o, i, c, g, e: o + i, h: o + i - (c - g), yld: yld || null };
  });
  const totF = vals.reduce((s, v) => s + v.c, 0);
  let totK = 0;
  vals.forEach((v, k) => {
    const r = 4 + k, label = PSV_RM_ROWS[k][0];
    put("A" + r, k === 0 ? 1 : f(`+A${r - 1}+1`, k + 1));
    put("B" + r, label);
    put("C" + r, v.o, N3); put("D" + r, v.i, N3);
    put("E" + r, f(`+C${r}+D${r}`, v.e), N3);
    put("F" + r, v.c, N3);
    if (v.g) put("G" + r, v.g, N3);
    put("H" + r, f(`+E${r}-(F${r}-G${r})`, v.h), N3);
    const j = totF ? v.c / totF * 100 : 0, kk = v.yld ? j * v.yld : 0; totK += kk;
    put("J" + r, f(`IFERROR((F${r}/$F$19)*100,0)`, j), N2);
    put("K" + r, f(`J${r}*L${r}`, kk), N2);
    if (v.yld) put("L" + r, v.yld, P2);
  });
  const sum = key => vals.reduce((s, v) => s + v[key], 0);
  put("B19", "TOTAL").font = { bold: true };
  [["C", sum("o"), N3], ["D", sum("i"), N3], ["E", sum("e"), N3], ["F", totF, N3], ["G", sum("g"), N3], ["H", sum("h"), N3], ["I", 0, N2], ["J", totF ? 100 : 0, N2], ["K", totK, N2]]
    .forEach(([col, res, fmt]) => { const c = put(col + "19", f(`SUM(${col}4:${col}18)`, res), fmt); c.font = { bold: true }; });
  put("A20", 16); put("B20", "Salg Iron (Jam)"); put("C20", 0, N3); put("E20", f("+C20+D20", 0), N3); put("G20", 0, N3);
  put("H20", f("+E20-F20-G20", 0), N3); put("I20", 0); put("J20", 0); put("K20", 0);
  for (let r = 3; r <= 20; r++) for (let c = 1; c <= 12; c++) ws.getCell(r, c).border = BOX;
  // billet section
  ws.mergeCells("C24:I24");
  put("C24", monthDate, "mmm-yy").alignment = { horizontal: "center" };
  [["D25", "Opening"], ["E25", "Production/Purchase"], ["F25", "Consumption in RM"], ["G25", "Sale"], ["H25", "Closing to be filled from Physical stock report"],
    ["L25", "Actual \nYield"], ["M25", "Diff."]].forEach(([a, t]) => { const c = put(a, t); c.font = { bold: true }; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; });
  ws.getRow(25).height = 45;
  const b = rm ? rm.billet : null;
  put("C26", "Billet-FG");
  const bs = b && b.s ? b.s : 0;
  if (b) { put("D26", b.o, N3); put("E26", b.p, N3); put("F26", -b.c, N3); if (bs) put("G26", bs, N3); }
  put("H26", f("SUM(D26:G26)", b ? b.o + b.p - b.c + bs : 0), N3);
  put("C27", "Billet-RM"); put("H27", f("SUM(D27:G27)", 0), N3);
  const ly = totF && b ? b.p / totF * 100 : 0;
  put("L27", f("+(E26+J26)/F19*100", ly), N3); put("M27", f("+L27-K19", ly - totK), N3);
  put("C28", "Total").font = { bold: true };
  [["D", b ? b.o : 0], ["E", b ? b.p : 0], ["F", b ? -b.c : 0], ["G", bs], ["H", b ? b.o + b.p - b.c + bs : 0], ["J", 0]]
    .forEach(([col, res]) => { put(col + "28", f(`SUM(${col}26:${col}27)`, res), N3).font = { bold: true }; });
  for (let r = 25; r <= 28; r++) for (let c = 3; c <= 13; c++) ws.getCell(r, c).border = BOX;
  // billet -> strip -> coil -> pipe balance: same labels / norms / formulas, month figures left for you
  ws.mergeCells("A31:D31"); ws.mergeCells("H31:U31");
  PSV_RM_SPEC.forEach(([a, kind, v]) => {
    const col = a.replace(/\d+/g, "");
    if (kind === "d") put(a, monthDate, "mmm-yy").font = { bold: true };
    else if (kind === "s") put(a, v);
    else if (kind === "p") put(a, v, P2);
    else put(a, f(v), (col === "B" || col === "C") ? P2 : N2);
  });
  ws.getCell("A31").value = f("+H31"); ws.getCell("A31").numFmt = "mmm-yy"; ws.getCell("A31").alignment = ws.getCell("H31").alignment = { horizontal: "center" };
  ws.eachRow(row => row.eachCell(c => { c.font = Object.assign({ name: "Calibri", size: 10 }, c.font || {}); }));
}
const PSV_EXCELJS = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
function psvLoadExcelJs() {
  if (window.ExcelJS) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = PSV_EXCELJS; s.integrity = "sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz"; s.crossOrigin = "anonymous";
    s.onload = res; s.onerror = () => rej(new Error("Excel library could not load (internet needed)"));
    document.head.appendChild(s);
  });
}
function psvColName(n) { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

async function psvXlsx() {
  const statusEl = document.getElementById("status");
  try {
    statusEl.className = "wait"; statusEl.textContent = "Making the Excel file...";
    await psvLoadExcelJs();
    const wb = new ExcelJS.Workbook();
    wb.calcProperties.fullCalcOnLoad = true;
    const ws = wb.addWorksheet("SMS", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 } });
    const WIDTHS = [22.14, 5.43, 16.71, 9.29, 13.86, 8.57, 11.71, 10.29, 12.43, 14.0];
    const thin = { style: "thin", color: { argb: "FF000000" } };
    const BOX = { top: thin, left: thin, bottom: thin, right: thin };
    const F3 = "0.000", PCT = "0.00%";
    let logoId = null;
    if (COMPANY.logo && reportLogoOn()) {
      const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(COMPANY.logo);
      if (m) logoId = wb.addImage({ base64: m[2], extension: m[1].toLowerCase() === "png" ? "png" : "jpeg" });
    }
    const blocks = PSV_SECTIONS.map(sec => ({ sec, rows: psvBlockRows(sec) }));
    const nData = Math.max(11, ...blocks.map(b => b.rows.length));
    const R0 = 10, RT = R0 + nData, RS = RT + 1;   // first data row, total row, first signature row
    const dateVal = psvState.date ? new Date(psvState.date + "T00:00:00Z") : null;

    blocks.forEach((blk, bi) => {
      const sec = blk.sec, b = bi * 11;              // A, L, W, AH
      const col = i => psvColName(b + 1 + i);        // i = 0..9 -> A..J of this block
      const cell = (i, r) => ws.getCell(col(i) + r);
      for (let i = 0; i < 10; i++) ws.getColumn(b + 1 + i).width = WIDTHS[i];
      if (bi < 3) ws.getColumn(b + 11).width = 3;
      ws.mergeCells(`${col(0)}1:${col(1)}2`);
      ws.mergeCells(`${col(2)}1:${col(9)}2`);
      Object.assign(cell(2, 1), { value: COMPANY.name || "" });
      cell(2, 1).font = { bold: true, size: 14 }; cell(2, 1).alignment = { horizontal: "center", vertical: "middle" };
      if (logoId !== null) {
        const iw = COMPANY.lw || 171, ih = COMPANY.lh || 38, k = Math.min(180 / iw, 36 / ih);
        ws.addImage(logoId, { tl: { col: b + 0.1, row: 0.1 }, ext: { width: Math.round(iw * k), height: Math.round(ih * k) } });
      }
      ws.mergeCells(`${col(0)}3:${col(9)}3`);
      cell(0, 3).value = "Physical verification of stock"; cell(0, 3).font = { bold: true, size: 12 }; cell(0, 3).alignment = { horizontal: "center" };
      [["Period", psvState.period || ""], ["Date of Verification", dateVal], ["Nature Of Product", sec.nature], ["Division", psvState.division || ""]]
        .forEach(([k, v], j) => {
          const r = 4 + j;
          cell(0, r).value = k; cell(0, r).font = { bold: true };
          ws.mergeCells(`${col(1)}${r}:${col(9)}${r}`);
          cell(1, r).value = v; cell(1, r).alignment = { horizontal: "left" };
          if (v instanceof Date) cell(1, r).numFmt = "dd-mm-yyyy";
        });
      sec.head.concat(PSV_HEAD_REST).forEach((t, i) => {
        const c = cell(i, 8); c.value = t; c.font = { bold: true }; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
      });
      PSV_LETTERS.forEach((t, i) => { const c = cell(i, 9); c.value = t.replace("×100", "*100"); c.alignment = { horizontal: "center" }; });

      blk.rows.forEach((row, k) => {
        const r = R0 + k, rr = row.r, isFg = sec.mode === "fg";
        cell(0, r).value = row.a; cell(1, r).value = row.item.uom || "MT";
        if (row.item.lots) { if (row.lot !== null) { cell(2, r).value = row.lot; cell(2, r).numFmt = F3; } }
        else if (isFg) { if (rr.C !== null) cell(2, r).value = rr.C; }
        else if (row.st.meas) cell(2, r).value = row.st.meas;
        if (!row.first) return;
        const D = col(3) + r, E = col(4) + r, Fc = col(5) + r, G = col(6) + r;
        if (rr.D !== null) { cell(3, r).value = rr.D; cell(3, r).numFmt = F3; }
        if (isFg) {
          if (rr.ePcs) { cell(4, r).value = { formula: `${rr.ePcs}*${row.item.len ? row.item.len + "*" : ""}${PSV_DENS[row.item.sec]}`, result: rr.E }; cell(4, r).numFmt = F3; }
        } else if (psvNum(row.st.e) !== null && psvNum(row.st.e) !== 0) { cell(4, r).value = psvNum(row.st.e); cell(4, r).numFmt = F3; }
        if (rr.F !== null) {
          let f;
          if (row.item.lots) f = `SUM(${col(2)}${r}:${col(2)}${r + row.span - 1})+${E}`;
          else if (isFg) f = `${col(2)}${r}*${row.item.len ? row.item.len + "*" : ""}${PSV_DENS[row.item.sec]}`;
          else if (sec.mode === "rm") f = `${psvNum(row.st.phys)}+${E}`;
          if (f) cell(5, r).value = { formula: f, result: rr.F }; else cell(5, r).value = rr.F;
          cell(5, r).numFmt = F3;
          cell(6, r).value = { formula: `SUM(${Fc}-${E})-${D}`, result: rr.G }; cell(6, r).numFmt = F3;
          cell(7, r).value = { formula: `IFERROR(${G}/${D},"")`, result: rr.H === null ? "" : rr.H }; cell(7, r).numFmt = PCT;   // as in the sheet
        }
        if (row.st.adj) cell(8, r).value = row.st.adj;
        if (row.st.rem) cell(9, r).value = row.st.rem;
      });
      // total row
      const t = psvTotals(sec);
      cell(0, RT).value = "Total"; cell(0, RT).font = { bold: true };
      [[3, t.D], [4, t.E], [5, t.F], [6, t.G]].forEach(([i, v]) => {
        const c = cell(i, RT); c.value = { formula: `SUM(${col(i)}${R0}:${col(i)}${RT - 1})`, result: v }; c.numFmt = F3; c.font = { bold: true };
      });
      cell(7, RT).value = { formula: `IFERROR(${col(6)}${RT}/${col(3)}${RT},"")`, result: t.H === null ? "" : t.H }; cell(7, RT).numFmt = PCT; cell(7, RT).font = { bold: true };
      // signature block: two bands of three equal boxes (B:D, E:G, H:J) - enough room to sign
      const s = psvSigners(psvState.signs);
      const span = (a, b2, r) => ws.mergeCells(`${col(a)}${r}:${col(b2)}${r}`);
      [[RS, [["QAD-Team (1)", s.qad], ["QAD-Team (2)", s.qad2], ["Finance Team", s.fin]]],
       [RS + 3, [["Prod Team (1)", s.prod], ["Prod Team (2)", s.prod2], ["Plant Head", s.ph]]]].forEach(([r0, boxes]) => {
        boxes.forEach(([title, n], k) => {
          const a = 1 + k * 3, b2 = a + 2;
          for (let q = 0; q < 3; q++) span(a, b2, r0 + q);
          cell(a, r0).value = title; cell(a, r0).font = { bold: true }; cell(a, r0).alignment = { horizontal: "center" };
          if (n) { cell(a, r0 + 1).value = n; cell(a, r0 + 1).alignment = { horizontal: "center" }; }
        });
        cell(0, r0 + 1).value = "Name"; cell(0, r0 + 2).value = "Sign.";
        ws.getRow(r0 + 2).height = 42;
      });
      // borders + font on the whole block
      for (let r = 1; r <= RS + 5; r++) for (let i = 0; i < 10; i++) {
        const c = cell(i, r); c.border = BOX;
        c.font = Object.assign({ name: "Calibri", size: 10 }, c.font || {});
        if (r >= R0 && r <= RT && i >= 3 && i <= 7) c.alignment = Object.assign({ horizontal: "right" }, c.alignment || {});
      }
    });
    ws.getRow(8).height = 62;
    ws.pageSetup.printArea = `A1:${psvColName(33 + 10)}${RS + 5}`;
    psvRmSheet(wb);
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = psvFileName("xlsx"); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 10000);
    statusEl.className = "ok"; statusEl.textContent = `Excel downloaded: ${psvFileName("xlsx")}`;
  } catch (e) {
    statusEl.className = "err"; statusEl.textContent = "Excel error: " + e.message;
  }
}
psvInit();

/* ===================== AOP (Annual Operating Plan) ===================== */
// Works on the AOP Excel itself: Import puts the file in your OneDrive app folder (Apps/<app>/AOP/), the app reads it,
// you change the input numbers, Save / Download write those numbers (and the recalculated results) straight into the
// same file - every format, formula, colour and width stays exactly as it was. Nothing of the AOP is kept in this code.
const AOP_ROOT = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/AOP";
// One editor per tile: "aop" = the AOPs you keep (folder AOP), "aopw" = next FY work in progress (folder AOP/WIP).
function aopEditor(P, AOP_DIR, opts) {
  opts = opts || {};
  const $ = id => document.getElementById(/^aop/.test(id) ? P + id.slice(3) : id);
  if (!$("aopBody")) return null;
  const S = { name: "", bytes: null, wb: null, sheet: "", ws: null, edits: {}, model: null, memo: null };

  /* ---------- zip (xlsx) read / write, browser-native deflate ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  async function streamBytes(u8, stream) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer()); }
  function zipRead(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("not an Excel (.xlsx) file");
    const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    const out = [];
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("damaged xlsx (central directory)");
      const method = dv.getUint16(p + 10, true), time = dv.getUint16(p + 12, true), date = dv.getUint16(p + 14, true);
      const crc = dv.getUint32(p + 16, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const fl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + fl));
      const lfl = dv.getUint16(lho + 26, true), lxl = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lfl + lxl;
      out.push({ name, method, time, date, crc, csize, usize, data: u8.subarray(start, start + csize) });
      p += 46 + fl + xl + cl;
    }
    return out;
  }
  async function zipText(e) {
    const raw = e.method === 0 ? e.data : await streamBytes(e.data, new DecompressionStream("deflate-raw"));
    return new TextDecoder().decode(raw);
  }
  async function zipSetText(e, text) {
    const raw = new TextEncoder().encode(text);
    e.data = await streamBytes(raw, new CompressionStream("deflate-raw")); e.method = 8;
    e.crc = crc32(raw); e.csize = e.data.length; e.usize = raw.length;
  }
  function zipWrite(entries) {
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
    entries.forEach(e => {
      const nb = enc.encode(e.name), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, e.method, true);
      h.setUint16(10, e.time, true); h.setUint16(12, e.date, true); h.setUint32(14, e.crc, true); h.setUint32(18, e.csize, true);
      h.setUint32(22, e.usize, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nb, e.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, e.method, true);
      c.setUint16(12, e.time, true); c.setUint16(14, e.date, true); c.setUint32(16, e.crc, true); c.setUint32(20, e.csize, true); c.setUint32(24, e.usize, true);
      c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
      cen.push(new Uint8Array(c.buffer), nb);
      off += 30 + nb.length + e.data.length;
    });
    const cenSize = cen.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cenSize, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [new Uint8Array(end.buffer)]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  /* ---------- formula evaluation (what the sheet uses: + - * / ( ) numbers, cells, SUM / ROUND / MIN / MAX / ABS / IF / IFERROR) ---------- */
  const enc = (r, c) => XLSX.utils.encode_cell({ r, c });
  function cellNum(addr) {
    if (S.memo.has(addr)) return S.memo.get(addr);
    S.memo.set(addr, 0);   // guards a circular reference
    let v;
    if (Object.prototype.hasOwnProperty.call(S.edits, addr)) { const n = parseFloat(S.edits[addr]); v = isNaN(n) ? 0 : n; }
    else {
      const c = S.ws[addr];
      if (!c) v = 0;
      else if (c.f) { try { v = evalFormula(c.f); } catch (e) { v = typeof c.v === "number" ? c.v : 0; } }
      else v = typeof c.v === "number" ? c.v : 0;
    }
    if (typeof v !== "number" || !isFinite(v)) v = 0;
    S.memo.set(addr, v);
    return v;
  }
  function rangeVals(a, b) {
    const s = XLSX.utils.decode_cell(a.replace(/\$/g, "")), e = XLSX.utils.decode_cell(b.replace(/\$/g, "")), out = [];
    for (let r = Math.min(s.r, e.r); r <= Math.max(s.r, e.r); r++) for (let c = Math.min(s.c, e.c); c <= Math.max(s.c, e.c); c++) out.push(cellNum(enc(r, c)));
    return out;
  }
  function evalFormula(f) {
    const src = String(f).replace(/^=/, "");
    const toks = []; const re = /\s*(\$?[A-Z]{1,3}\$?\d+:\$?[A-Z]{1,3}\$?\d+|\$?[A-Z]{1,3}\$?\d+|[A-Z][A-Z0-9.]*\(|\d+(?:\.\d+)?(?:E[+-]?\d+)?%?|"[^"]*"|<=|>=|<>|[-+*/^(),<>=&])/iy;
    let m; re.lastIndex = 0;
    while (re.lastIndex < src.length) { m = re.exec(src); if (!m) { if (/^\s*$/.test(src.slice(re.lastIndex))) break; throw new Error("unsupported"); } toks.push(m[1]); }
    let i = 0;
    const peek = () => toks[i], next = () => toks[i++];
    const expect = t => { if (next() !== t) throw new Error("syntax"); };
    function args() { const a = []; if (peek() === ")") { next(); return a; } for (;;) { a.push(cmp()); const t = next(); if (t === ")") return a; if (t !== ",") throw new Error("syntax"); } }
    function prim() {
      const t = next();
      if (t === undefined) throw new Error("syntax");
      if (t === "(") { const v = cmp(); expect(")"); return v; }
      if (t === "-") return -prim();
      if (t === "+") return prim();
      if (/^"/.test(t)) return t.slice(1, -1);
      if (/^\d/.test(t)) return t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t);
      if (/:/.test(t)) { const [a, b] = t.split(":"); return rangeVals(a, b); }
      if (/\($/.test(t)) {
        const fn = t.slice(0, -1).toUpperCase(), a = args();
        const flat = a.flat().map(x => typeof x === "number" ? x : (parseFloat(x) || 0));
        if (fn === "SUM") return flat.reduce((s, x) => s + x, 0);
        if (fn === "MIN") return Math.min(...flat);
        if (fn === "MAX") return Math.max(...flat);
        if (fn === "AVERAGE") return flat.length ? flat.reduce((s, x) => s + x, 0) / flat.length : 0;
        if (fn === "ABS") return Math.abs(flat[0] || 0);
        if (fn === "ROUND") { const p = Math.pow(10, flat[1] || 0); return Math.round((flat[0] || 0) * p) / p; }
        if (fn === "IF") return (a[0] && a[0] !== 0) ? (a[1] !== undefined ? a[1] : true) : (a[2] !== undefined ? a[2] : false);
        if (fn === "IFERROR") { const x = a[0]; return (typeof x === "number" && !isFinite(x)) ? a[1] : x; }
        throw new Error("unsupported function " + fn);
      }
      return cellNum(t.replace(/\$/g, "").toUpperCase());
    }
    const num = x => Array.isArray(x) ? (x[0] || 0) : (typeof x === "number" ? x : (parseFloat(x) || 0));
    function pow() { let v = prim(); while (peek() === "^") { next(); v = Math.pow(num(v), num(prim())); } return v; }
    function mul() { let v = pow(); while (peek() === "*" || peek() === "/") { const o = next(), r = num(pow()); v = o === "*" ? num(v) * r : num(v) / r; } return v; }
    function add() { let v = mul(); while (peek() === "+" || peek() === "-") { const o = next(), r = num(mul()); v = o === "+" ? num(v) + r : num(v) - r; } return v; }
    function cmp() { let v = add(); while (["<", ">", "=", "<=", ">=", "<>"].includes(peek())) { const o = next(), r = add(); const a = num(v), b = num(r);
      v = o === "<" ? a < b : o === ">" ? a > b : o === "=" ? a === b : o === "<=" ? a <= b : o === ">=" ? a >= b : a !== b; v = v ? 1 : 0; } return v; }
    const v = cmp();
    if (i < toks.length) throw new Error("syntax");
    return num(v);
  }

  /* ---------- read the sheet into sections ---------- */
  const txt = c => (c && c.v !== undefined && c.v !== null) ? String(c.v).trim() : "";
  function buildModel() {
    const ws = S.ws, rg = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    const lastC = rg.e.c, lastR = rg.e.r;
    const isHeader = r => /^s(r)?\.?\s*no/i.test(txt(ws[enc(r, 0)]));   // "Sr.No." or "S. No."
    const sections = [];
    let summary = null;
    for (let r = 0; r <= lastR; r++) {
      if (!isHeader(r)) continue;
      // title: nearest text above in columns A-D (e.g. "Consumables")
      let title = "", titleRow = -1;
      for (let k = r - 1; k >= Math.max(0, r - 6); k--) { for (let c = 0; c <= 3; c++) { const t = txt(ws[enc(k, c)]); if (t && !/^s(r)?\.?\s*no/i.test(t)) { title = t; titleRow = k; break; } } if (title) break; }
      const head = []; for (let c = 0; c <= lastC; c++) head.push(txt(ws[enc(r, c)]));
      const rows = []; let total = null;
      for (let k = r + 1; k <= lastR; k++) {
        if (isHeader(k)) break;
        const a = ws[enc(k, 0)];
        const hasA = a && a.v !== "" && a.v !== null && a.v !== undefined;
        let any = false; for (let c = 0; c <= lastC; c++) { const x = ws[enc(k, c)]; if (x && (x.f || (x.v !== "" && x.v !== undefined && x.v !== null))) { any = true; break; } }
        if (hasA) { rows.push(k); continue; }
        if (any && rows.length) { total = k; break; }     // the total row under the list
        if (!any && rows.length) { let more = false; for (let z = k + 1; z <= Math.min(lastR, k + 2); z++) if (ws[enc(z, 0)] && !isHeader(z) && ws[enc(z, 0)].v !== undefined && ws[enc(z, 0)].v !== "") more = true; if (!more) break; }
      }
      const cols = head.map((h, c) => c).filter(c => head[c] || rows.some(k => ws[enc(k, c)]));
      // input columns: a typed number in at least one row (not the Sr. No. column)
      const input = new Set(cols.filter(c => c > 0 && rows.some(k => { const x = ws[enc(k, c)]; return x && !x.f && typeof x.v === "number"; })));
      sections.push({ title: title || `Table ${sections.length + 1}`, titleRow, headRow: r, head, rows, total, cols, input });
    }
    // summary: rows above the first table that have formulas / numbers (e.g. the SUMMARY block)
    const firstHead = sections.length ? sections[0].titleRow >= 0 ? sections[0].titleRow : sections[0].headRow : lastR + 1;
    let sHead = -1;
    for (let r = 0; r < firstHead; r++) { let n = 0; for (let c = 0; c <= lastC; c++) if (txt(ws[enc(r, c)])) n++; if (n >= 3 && sHead < 0) { sHead = r; break; } }
    if (sHead >= 0) {
      const head = []; for (let c = 0; c <= lastC; c++) head.push(txt(ws[enc(sHead, c)]));
      const rows = [];
      for (let r = sHead + 1; r < firstHead; r++) { let any = false; for (let c = 0; c <= lastC; c++) { const x = ws[enc(r, c)]; if (x && (x.f || typeof x.v === "number" || txt(x))) any = true; } if (any) rows.push(r); }
      const cols = head.map((h, c) => c).filter(c => head[c]);
      const input = new Set(cols.filter(c => rows.some(k => { const x = ws[enc(k, c)]; return x && !x.f && typeof x.v === "number"; })));
      summary = { head, rows, cols, input };
    }
    return { sections, summary, lastC };
  }

  /* ---------- display ---------- */
  const fmtN = (v, money) => (v === "" || v === null || v === undefined) ? "" :
    Number(v).toLocaleString("en-IN", { minimumFractionDigits: money ? 2 : 0, maximumFractionDigits: money ? 2 : 3 });
  const isMoney = h => /cost|value|rs\b|amount|budget.*cost|rate/i.test(h || "");
  const shown = addr => { const c = S.ws[addr]; if (Object.prototype.hasOwnProperty.call(S.edits, addr)) return S.edits[addr]; return c && !c.f ? (typeof c.v === "number" ? c.v : txt(c)) : ""; };
  function render() {
    S.memo = new Map();
    const box = $("aopBody"), M = S.model;
    const openIds = new Set([...box.querySelectorAll("details[open]")].map(d => d.dataset.k));
    let h = "";
    if (M.summary) {
      const sm = M.summary;
      h += `<details class="aopSec" data-k="summary" ${openIds.size ? (openIds.has("summary") ? "open" : "") : "open"}><summary>📋 Summary</summary><div class="tableScroll"><table class="matrixTable aopTbl"><tr>` +
        sm.cols.map(c => `<th>${_escH(sm.head[c])}</th>`).join("") + `</tr>` +
        sm.rows.map(r => `<tr>` + sm.cols.map(c => {
          const a = enc(r, c), x = S.ws[a];
          if (x && x.f) return `<td class="aopCalc" data-a="${a}">${fmtN(cellNum(a), isMoney(sm.head[c]))}</td>`;
          if (sm.input.has(c)) return opts.locked ? `<td>${lockedVal(a, sm.head[c])}</td>` : `<td><input class="aopIn" data-a="${a}" inputmode="decimal" value="${_escH(shown(a))}"></td>`;
          return `<td style="text-align:left">${_escH(txt(x))}</td>`;
        }).join("") + `</tr>`).join("") + `</table></div></details>`;
    }
    M.sections.forEach((sec, si) => {
      const nameCol = sec.cols.find(c => /item\s*name|description|particular/i.test(sec.head[c])) ?? 2;
      const umCol = sec.cols.find(c => /^(um|uom|unit)$/i.test(sec.head[c]));
      const fcol = c => sec.rows.some(k => S.ws[enc(k, c)] && S.ws[enc(k, c)].f);
      const keyCol = [...sec.cols].reverse().find(c => /consum.*cost/i.test(sec.head[c]) && fcol(c)) ?? [...sec.cols].reverse().find(c => /cost/i.test(sec.head[c]) && fcol(c));
      const totTxt = sec.total !== null && keyCol !== undefined ? ` · ${_escH(sec.head[keyCol])}: ₹${fmtN(cellNum(enc(sec.total, keyCol)), true)}` : "";
      h += `<details class="aopSec" data-k="s${si}" ${openIds.has("s" + si) ? "open" : ""}><summary>${_escH(sec.title)} <small>(${sec.rows.length} items${totTxt})</small></summary>`;
      sec.rows.forEach(r => {
        const name = txt(S.ws[enc(r, nameCol)]) || `Row ${r + 1}`, sr = txt(S.ws[enc(r, 0)]);
        const keyV = keyCol !== undefined ? `₹${fmtN(cellNum(enc(r, keyCol)), true)}` : "";
        h += `<details class="aopItem" data-k="r${r}" ${openIds.has("r" + r) ? "open" : ""}><summary><b>${_escH(sr)}. ${_escH(name)}</b>` +
          (umCol !== undefined ? ` <span class="psvUom">${_escH(txt(S.ws[enc(r, umCol)]))}</span>` : "") + `<span class="aopKey" data-a="${keyCol !== undefined ? enc(r, keyCol) : ""}">${keyV}</span></summary><div class="aopGrid">`;
        sec.cols.forEach(c => {
          if (c === 0 || c === nameCol || c === umCol) return;
          const a = enc(r, c), x = S.ws[a], lab = _escH(sec.head[c] || XLSX.utils.encode_col(c));
          if (x && x.f) h += `<label>${lab}<span class="aopCalc" data-a="${a}">${fmtN(cellNum(a), isMoney(sec.head[c]))}</span></label>`;
          else if (sec.input.has(c)) h += opts.locked ? `<label>${lab}<span>${lockedVal(a, sec.head[c])}</span></label>` : `<label>${lab}<input class="aopIn" data-a="${a}" inputmode="decimal" value="${_escH(shown(a))}"></label>`;
          else if (txt(x)) h += `<label>${lab}<span>${_escH(txt(x))}</span></label>`;
        });
        h += `</div></details>`;
      });
      if (sec.total !== null) {
        h += `<div class="aopTot"><b>Total</b>` + sec.cols.filter(c => { const x = S.ws[enc(sec.total, c)]; return x && x.f; })
          .map(c => `<span>${_escH(sec.head[c])}: <b class="aopCalc" data-a="${enc(sec.total, c)}">${fmtN(cellNum(enc(sec.total, c)), isMoney(sec.head[c]))}</b></span>`).join("") + `</div>`;
      }
      h += `</details>`;
    });
    box.innerHTML = h;
    status();
  }
  function refreshCalc() {   // after an input changes: only the calculated numbers are redrawn
    S.memo = new Map();
    document.querySelectorAll("#aopBody [data-a]").forEach(el => {
      const a = el.dataset.a; if (!a || el.tagName === "INPUT") return;
      const head = headOf(a);
      const v = cellNum(a);
      el.textContent = el.classList.contains("aopKey") ? `₹${fmtN(v, true)}` : fmtN(v, isMoney(head));
    });
    status();
  }
  function headOf(a) {
    const { r, c } = XLSX.utils.decode_cell(a), M = S.model;
    if (M.summary && M.summary.rows.includes(r)) return M.summary.head[c];
    for (const sec of M.sections) if (sec.rows.includes(r) || sec.total === r) return sec.head[c];
    return "";
  }
  function status() {
    const n = Object.keys(S.edits).length;
    $("aopInfo").innerHTML = S.name ? `📄 <b>${_escH(S.name)}</b> · sheet <b>${_escH(S.sheet)}</b>` +
      (opts.locked ? ` · <span style="color:#d4a72c">🔒 locked - view / download only</span>` : (n ? ` · <span style="color:#d4a72c">✏️ ${n} change(s) not saved yet</span>` : ` · <span class="psvMuted" style="font-style:normal">saved</span>`)) : "";
  }
  const EDIT_PREFIX = P === "aop" ? "aopEdits:" : P + "Edits:";
  const editKey = () => EDIT_PREFIX + S.name + ":" + S.sheet;
  const saveEditsLocal = () => { if (opts.locked) return; try { localStorage.setItem(editKey(), JSON.stringify(S.edits)); } catch (e) {} };
  const lockedVal = (a, head) => { const v = shown(a); return typeof v === "number" ? fmtN(v, isMoney(head)) : _escH(String(v)); };

  /* ---------- write the numbers into the xlsx (only <v> of changed cells + cached results) ---------- */
  async function buildXlsx(opt) {
    const entries = zipRead(S.bytes.slice(0));
    const get = n => entries.find(e => e.name === n);
    const wbXml = await zipText(get("xl/workbook.xml"));
    const rels = await zipText(get("xl/_rels/workbook.xml.rels"));
    const sheetEl = [...wbXml.matchAll(/<sheet\b[^>]*>/g)].map(m => m[0]).find(t => (t.match(/name="([^"]*)"/) || [])[1] === S.sheet.replace(/&/g, "&amp;"));
    const rid = (sheetEl.match(/r:id="([^"]+)"/) || [])[1];
    const relT = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => m[0]).find(t => t.includes(`Id="${rid}"`));
    let target = (relT.match(/Target="([^"]+)"/) || [])[1];
    target = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
    const se = get(target);
    const doc = new DOMParser().parseFromString(await zipText(se), "application/xml");
    const NS = doc.documentElement.namespaceURI;
    const sd = doc.getElementsByTagNameNS(NS, "sheetData")[0];
    const rowEls = new Map(); [...sd.getElementsByTagNameNS(NS, "row")].forEach(r => rowEls.set(+r.getAttribute("r"), r));
    const cellEl = new Map(); [...sd.getElementsByTagNameNS(NS, "c")].forEach(c => cellEl.set(c.getAttribute("r"), c));
    const colNum = a => XLSX.utils.decode_cell(a).c;
    function ensureCell(a) {
      if (cellEl.has(a)) return cellEl.get(a);
      const rn = XLSX.utils.decode_cell(a).r + 1;
      let row = rowEls.get(rn);
      if (!row) {
        row = doc.createElementNS(NS, "row"); row.setAttribute("r", String(rn));
        const after = [...rowEls.keys()].filter(k => k < rn).sort((x, y) => y - x)[0];
        if (after) rowEls.get(after).after(row); else sd.insertBefore(row, sd.firstChild);
        rowEls.set(rn, row);
      }
      const c = doc.createElementNS(NS, "c"); c.setAttribute("r", a);
      const later = [...row.getElementsByTagNameNS(NS, "c")].find(x => colNum(x.getAttribute("r")) > colNum(a));
      if (later) row.insertBefore(c, later); else row.appendChild(c);
      row.removeAttribute("spans");
      cellEl.set(a, c);
      return c;
    }
    const setV = (c, num) => {
      [...c.childNodes].forEach(ch => { if (ch.localName === "v" || ch.localName === "is") c.removeChild(ch); });
      c.removeAttribute("t");
      if (num === null) return;
      const v = doc.createElementNS(NS, "v"); v.textContent = String(num); c.appendChild(v);
    };
    // typed numbers you changed
    Object.keys(S.edits).forEach(a => {
      const s = String(S.edits[a]).trim(), n = parseFloat(s.replace(/,/g, ""));
      const c = ensureCell(a);
      [...c.childNodes].forEach(ch => { if (ch.localName === "f") c.removeChild(ch); });
      setV(c, s === "" || isNaN(n) ? null : n);
    });
    // fresh results in every formula cell (Excel recalculates anyway on opening)
    S.memo = new Map();
    cellEl.forEach((c, a) => {
      const f = [...c.childNodes].find(ch => ch.localName === "f");
      if (!f) return;
      const x = S.ws[a];
      if (!x || !x.f) return;
      let v; try { v = evalFormula(x.f); } catch (e) { return; }   // a formula the app can't work out keeps its old result
      if (typeof v !== "number" || !isFinite(v)) return;
      if (c.getAttribute("t") === "str" || c.getAttribute("t") === "e" || c.getAttribute("t") === "b") c.removeAttribute("t");
      [...c.childNodes].forEach(ch => { if (ch.localName === "v") c.removeChild(ch); });
      const ve = doc.createElementNS(NS, "v"); ve.textContent = String(Math.round(v * 1e10) / 1e10); c.appendChild(ve);
    });
    // final AOP: the [WIP] working columns are left out; a formula that used them keeps its number
    if (opt && opt.stripWip && S.model) {
      const wip = new Set(); S.model.sections.forEach(sec => sec.head.forEach((h, c) => { if (/^\[WIP\]/.test(h)) wip.add(c); }));
      if (wip.size) {
        cellEl.forEach((c, a) => {
          if (wip.has(colNum(a))) { c.parentNode.removeChild(c); return; }
          const fe = [...c.childNodes].find(ch => ch.localName === "f");
          if (!fe) return;
          let hit = false;
          String(fe.textContent).replace(/("[^"]*")|\$?([A-Z]{1,3})\$?\d+/g, (m, q, col) => { if (!q && wip.has(XLSX.utils.decode_col(col))) hit = true; return m; });
          if (hit) c.removeChild(fe);
        });
        rowEls.forEach(r => r.removeAttribute("spans"));
      }
    }
    let xml = new XMLSerializer().serializeToString(doc);
    if (!/^<\?xml/.test(xml)) xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + xml;
    await zipSetText(se, xml);
    const wbNew = /<calcPr\b/.test(wbXml) ? wbXml.replace(/<calcPr\b([^>]*?)\s*(\/?)>/, (m, a, sl) => `<calcPr${a.replace(/\s*fullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"${sl ? "/" : ""}>`)
      : wbXml.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
    if (wbNew !== wbXml) await zipSetText(get("xl/workbook.xml"), wbNew);
    return zipWrite(entries);
  }

  /* ---------- OneDrive ---------- */
  const fileUrl = n => `${AOP_DIR}/${encodeURIComponent(n)}:/content`;
  async function listFiles(selectName, noOpen) {
    const sel = $("aopFile");
    try {
      const token = await getToken(); if (!token) return;
      const r = await fetch(`${AOP_DIR}:/children?$select=name,lastModifiedDateTime&$top=200`, { headers: { Authorization: "Bearer " + token } });
      const names = r.status === 404 ? [] : ((await r.json()).value || []).map(f => f.name).filter(n => /\.xlsx$/i.test(n)).sort();
      sel.innerHTML = names.length ? names.map(n => `<option>${_escH(n)}</option>`).join("") : `<option value="">(no AOP file yet - Import Excel)</option>`;
      if (selectName && names.includes(selectName)) sel.value = selectName;
      if (!noOpen && sel.value && sel.value !== S.name) openFile(sel.value);
    } catch (e) { $("status").className = "err"; $("status").textContent = "AOP: could not read the file list - " + e.message; }
  }
  async function openFile(name, bytes) {
    const st = $("status");
    try {
      st.className = "wait"; st.textContent = `Opening ${name}...`;
      if (!bytes) {
        const token = await getToken(); if (!token) return;
        const r = await fetch(fileUrl(name), { headers: { Authorization: "Bearer " + token } });
        if (!r.ok) throw new Error("OneDrive read failed (" + r.status + ")");
        bytes = await r.arrayBuffer();
      }
      S.name = name; S.bytes = bytes;
      S.wb = XLSX.read(new Uint8Array(bytes), { type: "array", cellFormula: true, cellNF: false, cellStyles: false });
      const ss = $("aopSheet");
      ss.innerHTML = S.wb.SheetNames.map(n => `<option>${_escH(n)}</option>`).join("");
      ss.closest("div").style.display = S.wb.SheetNames.length > 1 ? "" : "none";
      useSheet(S.wb.SheetNames[0]);
      st.className = "ok"; st.textContent = `${name} opened.`;
    } catch (e) { st.className = "err"; st.textContent = "AOP: " + e.message; }
  }
  function useSheet(sheet) {
    S.sheet = sheet; S.ws = S.wb.Sheets[sheet];
    try { S.edits = opts.locked ? {} : (JSON.parse(localStorage.getItem(editKey()) || "{}") || {}); } catch (e) { S.edits = {}; }
    S.model = buildModel();
    $("aopSheet").value = sheet;
    render();
  }
  async function saveToCloud() {
    const st = $("status");
    if (!S.name) return;
    try {
      st.className = "wait"; st.textContent = "Saving the AOP to OneDrive...";
      const blob = await buildXlsx();
      const token = await getToken(); if (!token) return;
      const r = await fetch(fileUrl(S.name), { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": blob.type }, body: blob });
      if (!r.ok) throw new Error("OneDrive save failed (" + r.status + ")");
      const bytes = await blob.arrayBuffer();
      try { localStorage.removeItem(editKey()); } catch (e) {}
      await openFile(S.name, bytes);
      st.className = "ok"; st.textContent = `Saved: ${S.name} (OneDrive → Apps → AOP).`;
    } catch (e) { st.className = "err"; st.textContent = "AOP save error: " + e.message; }
  }
  async function download() {
    const st = $("status");
    if (!S.name) return;
    try {
      st.className = "wait"; st.textContent = "Making the Excel...";
      const blob = await buildXlsx();
      const u = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = u; a.download = S.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
      st.className = "ok"; st.textContent = `Downloaded ${S.name}` + (Object.keys(S.edits).length ? " (with your unsaved changes - press 💾 Save to keep them in OneDrive)." : ".");
    } catch (e) { st.className = "err"; st.textContent = "AOP download error: " + e.message; }
  }
  // PDF: the Summary and every table of the sheet, with the numbers as they stand now (unsaved changes too)
  function pdf() {
    const st = $("status");
    if (!S.name || !S.model) { st.className = "err"; st.textContent = "Open an AOP file first."; return; }
    try {
      S.memo = new Map();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), M = 24;
      const title = S.name.replace(/\.xlsx$/i, "").replace(/_/g, " ");
      const val = (a, head) => {
        const x = S.ws[a];
        if (x && x.f) return fmtN(cellNum(a), isMoney(head));
        if (Object.prototype.hasOwnProperty.call(S.edits, a)) { const n = parseFloat(S.edits[a]); return isNaN(n) ? String(S.edits[a]) : fmtN(n, isMoney(head)); }
        if (x && typeof x.v === "number") return fmtN(x.v, isMoney(head));
        return txt(x);
      };
      const NAVY = [31, 56, 100], GOLD = [201, 162, 39];
      const tableStyles = {
        theme: "grid", keepZeros: true, margin: { left: M, right: M, top: 64, bottom: 30 },
        styles: { fontSize: 7, cellPadding: 2.5, halign: "right", valign: "middle", lineColor: [150, 150, 150], lineWidth: 0.4, textColor: 20, overflow: "linebreak" },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", halign: "center", fontSize: 6.8 }
      };
      let y = 70;
      const sectionTitle = (t) => {
        if (y > ph - 90) { doc.addPage(); y = 70; }
        doc.setFillColor(...GOLD); doc.rect(M, y, pw - 2 * M, 16, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
        doc.text(t, M + 6, y + 11.5); y += 18;
      };
      const M0 = S.model;
      if (M0.summary) {
        const sm = M0.summary;
        sectionTitle("Summary");
        doc.autoTable(Object.assign({}, tableStyles, {
          startY: y, head: [sm.cols.map(c => sm.head[c])],
          body: sm.rows.map(r => sm.cols.map(c => val(XLSX.utils.encode_cell({ r, c }), sm.head[c]))),
          columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 150 } },
          didParseCell: d => { if (d.section === "body" && d.row.index === sm.rows.length - 1 && !txt(S.ws[XLSX.utils.encode_cell({ r: sm.rows[sm.rows.length - 1], c: sm.cols[0] })])) { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [242, 242, 242]; } }
        }));
        y = doc.lastAutoTable.finalY + 16;
      }
      M0.sections.forEach(sec0 => {
        let sec = sec0;
        const nameCol = sec.cols.find(c => /item\s*name|description|particular/i.test(sec.head[c])) ?? 2;
        sectionTitle(sec.title);
        // a column with no heading and nothing in it is left out
        const cols = sec.cols.filter(c => sec.head[c] || sec.rows.concat(sec.total !== null ? [sec.total] : []).some(r => val(XLSX.utils.encode_cell({ r, c }), "") !== ""));
        sec = Object.assign({}, sec, { cols });
        const colStyles = {};
        sec.cols.forEach((c, i) => {
          if (c === nameCol) colStyles[i] = { halign: "left", cellWidth: 140 };
          else if (c === 0) colStyles[i] = { halign: "center", cellWidth: 26 };
          else if (/code|^um$|^uom$|unit/i.test(sec.head[c])) colStyles[i] = { halign: "center" };
        });
        const body = sec.rows.map(r => sec.cols.map(c => val(XLSX.utils.encode_cell({ r, c }), sec.head[c])));
        if (sec.total !== null) {
          const tr = sec.cols.map(c => val(XLSX.utils.encode_cell({ r: sec.total, c }), sec.head[c]));
          const ni = sec.cols.indexOf(nameCol); if (ni >= 0 && !tr[ni]) tr[ni] = "Total";
          body.push(tr.map(t => ({ content: t, styles: { fontStyle: "bold", fillColor: [242, 242, 242] } })));
        }
        doc.autoTable(Object.assign({}, tableStyles, {
          startY: y, head: [sec.cols.map(c => sec.head[c] || "Remarks")], body, columnStyles: colStyles
        }));
        y = doc.lastAutoTable.finalY + 16;
      });
      // header + footer on every page
      const n = doc.internal.getNumberOfPages(), today = new Date().toLocaleDateString("en-GB");
      const unsaved = Object.keys(S.edits).length;
      for (let p = 1; p <= n; p++) {
        doc.setPage(p);
        coDrawLogo(doc, M, 12, 150, 30);
        doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NAVY);
        doc.text(opts.pdfTitle || "Annual Operating Plan", pw / 2, 26, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(70, 70, 70);
        doc.text(`${title}  ·  sheet ${S.sheet}`, pw / 2, 41, { align: "center" });
        if (COMPANY.name) { doc.setFontSize(9); doc.text(COMPANY.name, pw - M, 22, { align: "right" }); }
        doc.setDrawColor(...GOLD); doc.setLineWidth(1); doc.line(M, 52, pw - M, 52);
        doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
        doc.text(`Generated ${today}` + (unsaved ? `  ·  includes ${unsaved} change(s) not saved to the Excel yet` : ""), M, ph - 14);
        doc.text(`Page ${p} of ${n}`, pw - M, ph - 14, { align: "right" });
      }
      showPdfPreview(doc, S.name.replace(/\.xlsx$/i, "") + ".pdf", "AOP");
      st.className = "ok"; st.textContent = "AOP PDF ready.";
    } catch (e) { st.className = "err"; st.textContent = "AOP PDF error: " + e.message; }
  }
  async function importFile(file) {
    const st = $("status");
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error("please choose an .xlsx file");
      const bytes = await file.arrayBuffer();
      zipRead(bytes.slice(0));   // is it a real xlsx?
      const name = file.name.replace(/^\d{10,}_/, "").replace(/[\\/:*?"<>|#%]/g, "_");
      st.className = "wait"; st.textContent = `Putting ${name} in OneDrive...`;
      const token = await getToken(); if (!token) return;
      const ex = await fetch(fileUrl(name), { method: "HEAD", headers: { Authorization: "Bearer " + token } }).catch(() => null);
      if (ex && ex.ok && !confirm(`${name} is already in the AOP folder. Replace it with this file?`)) { st.className = ""; st.textContent = ""; return; }
      const r = await fetch(fileUrl(name), { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, body: bytes });
      if (!r.ok) throw new Error("OneDrive upload failed (" + r.status + ")");
      try { Object.keys(localStorage).filter(k => k.startsWith(EDIT_PREFIX + name + ":")).forEach(k => localStorage.removeItem(k)); } catch (e) {}
      await openFile(name, bytes);
      await listFiles(name);
    } catch (e) { st.className = "err"; st.textContent = "AOP import error: " + e.message; }
  }

  /* ---------- events ---------- */
  $("aopBody").addEventListener("input", ev => {
    const t = ev.target; if (!t.classList.contains("aopIn")) return;
    const a = t.dataset.a, c = S.ws[a];
    const orig = c && !c.f ? (typeof c.v === "number" ? String(c.v) : txt(c)) : "";
    if (t.value.trim() === orig.trim()) delete S.edits[a]; else S.edits[a] = t.value.trim();
    saveEditsLocal(); refreshCalc();
  });
  const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };   // the locked (final) AOP has no import / save / undo buttons
  on("aopImportBtn", "click", () => { const f = $("aopImportFile"); f.value = ""; f.click(); });
  on("aopImportFile", "change", ev => { const f = ev.target.files && ev.target.files[0]; if (f) importFile(f); });
  $("aopFile").addEventListener("change", e => { if (e.target.value) openFile(e.target.value); });
  $("aopSheet").addEventListener("change", e => useSheet(e.target.value));
  $("aopReloadBtn").addEventListener("click", () => listFiles(S.name));
  on("aopSaveBtn", "click", saveToCloud);
  $("aopXlsxBtn").addEventListener("click", download);
  $("aopPdfBtn").addEventListener("click", pdf);
  on("aopUndoBtn", "click", () => { if (!Object.keys(S.edits).length || !confirm("Undo all changes not saved yet?")) return; S.edits = {}; saveEditsLocal(); render(); });
  // the file list is read when its tile is opened
  document.querySelectorAll(`[data-subaop="${opts.tile}"]`).forEach(b => b.addEventListener("click", () => { if (!S.name) listFiles(); }));
  // WIP: copy the finished AOP (with any unsaved changes) into the AOP folder
  if ($("aopFinalBtn")) $("aopFinalBtn").addEventListener("click", async () => {
    const st = $("status");
    if (!S.name) { st.className = "err"; st.textContent = "Open a work-in-progress AOP first."; return; }
    try {
      const token = await getToken(); if (!token) return;
      const dest = `${AOP_ROOT}/${encodeURIComponent(S.name)}:/content`;
      const ex = await fetch(dest, { method: "HEAD", headers: { Authorization: "Bearer " + token } }).catch(() => null);
      if (ex && ex.ok) { st.className = "err"; st.textContent = `🔒 ${S.name} is already a final AOP and final AOPs are locked - it was not changed. Give this WIP file another name (📥 Import it again under a new name) if it should be kept as well.`; return; }
      const hasWip = S.model && S.model.sections.some(sec => sec.head.some(h => /^\[WIP\]/.test(h)));
      if (!confirm(`Move ${S.name} to the AOP tile as a final AOP? Once moved it is locked (view and download only).` + (hasWip ? "\n\nThe [WIP] working columns are left out of the final AOP (kept in the WIP copy)." : "") + (S.model && window._wipToFinal && S.model.sections.some(sec => window._wipToFinal.isCcmWip(sec.head)) ? "\n\nThe final AOP is made in the final format (Rate, Budgeted / Consumed Qty, Expected Opening, Annual Consumption / Indent / Inventory Budget, Remark); the WIP copy keeps all its columns." : ""))) return;
      st.className = "wait"; st.textContent = "Copying to the AOP tile...";
      let blob = await buildXlsx({ stripWip: true });
      // the CCM-style WIP (A-AD) is turned into the final AOP format (A-Q)
      if (window._wipToFinal && S.model && S.model.sections.some(sec => window._wipToFinal.isCcmWip(sec.head))) blob = await window._wipToFinal.wipToFinal(await blob.arrayBuffer());
      const r = await fetch(dest, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": blob.type }, body: blob });
      if (!r.ok) throw new Error("OneDrive save failed (" + r.status + ")");
      st.className = "ok"; st.textContent = `${S.name} is now in the AOP tile (the work-in-progress copy is kept here too).`;
      if (window._aopMain) await window._aopMain.listFiles(window._aopMain.S.name || undefined, true);   // just refresh its list
    } catch (e) { st.className = "err"; st.textContent = "Move error: " + e.message; }
  });
  return { evalFormula: f => { S.memo = new Map(); return evalFormula(f); }, S, openFile, buildXlsx, zipRead, zipText, listFiles };
}
window._aopMain = aopEditor("aop", AOP_ROOT, { tile: "app", locked: true });
window._aopTest = window._aopMain;
window._aopWip = aopEditor("aopw", AOP_ROOT + "/WIP", { tile: "next", pdfTitle: "Annual Operating Plan (work in progress)" });

// do two item names mean the same thing? (at least one real word in common, or one inside the other)
function calNameAlike(a, b) {
  const STOPW = new Set(["FOR", "OF", "THE", "AND", "WITH", "IN", "TO", "NOS", "SIZE", "TYPE", "GRADE", "NO"]);
  const w = t => new Set(String(t || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(x => x.length >= 3 && !STOPW.has(x)));
  const A = w(a), B = w(b), na = [...A].join(""), nb = [...B].join("");
  if (!A.size || !B.size) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  for (const x of A) for (const y of B) if (x === y || (x.length >= 5 && y.length >= 5 && (x.startsWith(y.slice(0, 5)) || y.startsWith(x.slice(0, 5))))) return true;
  return false;
}
